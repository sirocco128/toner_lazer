/**
 * Upload gate: magic-byte allowlist + optional ClamAV (clamd INSTREAM).
 */

import { createConnection } from "node:net";
import type { ObjectKind } from "@/lib/object-storage";

const MZ = Buffer.from([0x4d, 0x5a]);
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

export type SniffedKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "pdf"
  | "zip"
  | "ole"
  | "csv"
  | "json"
  | "unknown";

export function sniffBytes(bytes: Buffer): SniffedKind {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") {
    return "gif";
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "pdf";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return "zip";
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
  ) {
    return "ole";
  }
  if (bytes.length >= 1 && (bytes[0] === 0x7b || bytes[0] === 0x5b)) {
    return "json";
  }
  const head = bytes.subarray(0, 256).toString("utf8");
  if (/^[\uFEFF\s]*["\w\u0E00-\u0E7F][^,]*,/.test(head) || /^[\uFEFF\s]*\w+,/.test(head)) {
    return "csv";
  }
  return "unknown";
}

function looksExecutable(bytes: Buffer): boolean {
  if (bytes.length >= 2 && bytes.subarray(0, 2).equals(MZ)) return true;
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(ELF)) return true;
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString("ascii") === "#!") return true;
  return false;
}

const KIND_ALLOWED: Record<ObjectKind, SniffedKind[]> = {
  images: ["jpeg", "png", "gif", "webp"],
  slips: ["jpeg", "png", "webp"],
  documents: ["pdf", "zip", "ole", "csv"],
  mockups: ["jpeg", "png", "json"],
};

export function assertSafeUpload(input: {
  kind: ObjectKind;
  bytes: Buffer;
  contentType: string;
}): SniffedKind {
  if (input.bytes.length < 4) throw new Error("file_too_small");
  if (looksExecutable(input.bytes)) throw new Error("executable_rejected");
  const sniffed = sniffBytes(input.bytes);
  if (sniffed === "unknown") throw new Error("file_type_rejected");
  if (!KIND_ALLOWED[input.kind].includes(sniffed)) {
    throw new Error("file_type_rejected");
  }
  const mime = (input.contentType || "").toLowerCase();
  if (sniffed === "pdf" && !mime.includes("pdf")) throw new Error("mime_mismatch");
  if (sniffed === "jpeg" && !mime.includes("jpeg") && !mime.includes("jpg")) {
    throw new Error("mime_mismatch");
  }
  if (sniffed === "png" && !mime.includes("png")) throw new Error("mime_mismatch");
  if (sniffed === "webp" && !mime.includes("webp")) throw new Error("mime_mismatch");
  return sniffed;
}

function clamdConfig(): { host: string; port: number } | null {
  const host = (process.env.CLAMD_HOST || "").trim();
  if (!host) return null;
  const port = Number(process.env.CLAMD_PORT || "3310");
  if (!Number.isInteger(port) || port < 1) return null;
  return { host, port };
}

export async function pingClamd(): Promise<boolean> {
  const cfg = clamdConfig();
  if (!cfg) return false;
  try {
    const verdict = await pingClamdSocket(cfg.host, cfg.port);
    return /PONG/i.test(verdict);
  } catch {
    return false;
  }
}

function pingClamdSocket(host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let out = "";
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error("clamav_timeout")));
    }, 2000);
    socket.on("connect", () => {
      socket.write("zPING\0");
    });
    socket.on("data", (data) => {
      out += data.toString("utf8");
      if (/PONG/i.test(out)) finish(() => resolve(out.trim()));
    });
    socket.on("error", (err) => {
      finish(() => reject(err));
    });
    socket.on("end", () => {
      finish(() => resolve(out.trim()));
    });
  });
}

export async function scanWithClamd(bytes: Buffer): Promise<void> {
  const cfg = clamdConfig();
  const required = (process.env.CLAMD_REQUIRED || "").trim() === "1";
  if (!cfg) {
    if (required) throw new Error("clamav_unavailable");
    return;
  }
  try {
    const verdict = await instreamClamd(cfg.host, cfg.port, bytes);
    if (verdict !== "OK") throw new Error("malware_rejected");
  } catch (err) {
    if (err instanceof Error && err.message === "malware_rejected") throw err;
    if (required) throw new Error("clamav_unavailable");
  }
}

function instreamClamd(host: string, port: number, bytes: Buffer): Promise<string> {
  const timeoutMs = Number(process.env.CLAMD_TIMEOUT_MS || "8000");
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let out = "";
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error("clamav_timeout")));
    }, timeoutMs);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const chunk = Buffer.alloc(4);
      chunk.writeUInt32BE(bytes.length, 0);
      socket.write(chunk);
      socket.write(bytes);
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (data) => {
      out += data.toString("utf8");
      const text = out.trim();
      if (/FOUND/i.test(text)) finish(() => reject(new Error("malware_rejected")));
      else if (/OK/i.test(text)) finish(() => resolve("OK"));
    });
    socket.on("error", (err) => {
      finish(() => reject(err));
    });
    socket.on("end", () => {
      const text = out.trim();
      if (/OK/i.test(text) && !/FOUND/i.test(text)) finish(() => resolve("OK"));
      else finish(() => reject(new Error("malware_rejected")));
    });
  });
}

export async function scanUpload(input: {
  kind: ObjectKind;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  assertSafeUpload(input);
  await scanWithClamd(input.bytes);
}
