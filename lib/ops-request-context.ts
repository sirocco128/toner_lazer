/**
 * Client IP, geo headers, and device fingerprint for ops audit.
 * Staff console — IP is stored so admins can see where a session came from.
 */

import { createHmac } from "node:crypto";
import { hashIp, resolveClientIp } from "@/lib/quote-service";

export type OpsAuditContext = {
  ipHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  geoLabel: string | null;
  deviceLabel: string | null;
  machineHint: string | null;
};

function headerText(headers: Headers, name: string): string | null {
  const raw = headers.get(name)?.trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export function parseDeviceLabel(userAgent: string | null | undefined): string | null {
  const ua = (userAgent || "").trim();
  if (!ua) return null;

  const os = /Windows NT 10/i.test(ua)
    ? "Windows 10+"
    : /Windows NT 11/i.test(ua)
      ? "Windows 11"
      : /Windows NT 6\.1/i.test(ua)
        ? "Windows 7"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /Android/i.test(ua)
            ? "Android"
            : /iPhone|iPad/i.test(ua)
              ? "iOS"
              : /Linux/i.test(ua)
                ? "Linux"
                : "ระบบอื่น";

  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua) || /Opera/i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "เบราว์เซอร์อื่น";

  return `${os} · ${browser}`;
}

export function parseGeoLabel(headers: Headers): string | null {
  const city =
    headerText(headers, "cf-ipcity") ||
    headerText(headers, "x-vercel-ip-city") ||
    headerText(headers, "x-geo-city");
  const region =
    headerText(headers, "cf-region") ||
    headerText(headers, "x-vercel-ip-country-region") ||
    headerText(headers, "x-geo-region");
  const country =
    headerText(headers, "cf-ipcountry") ||
    headerText(headers, "x-vercel-ip-country") ||
    headerText(headers, "x-geo-country");
  const parts = [city, region, country].filter(
    (part): part is string => typeof part === "string" && part.toUpperCase() !== "XX",
  );
  if (parts.length === 0) return null;
  return [...new Set(parts)].join(", ");
}

function machineHint(ip: string, userAgent: string | null): string | null {
  if (!ip || ip === "unknown") return null;
  const secret = (process.env.IP_HASH_SECRET || "").trim();
  const key =
    secret.length >= 32 ? secret : "dev-only-ip-hash-secret-replace-me-32chars";
  return createHmac("sha256", key)
    .update(`${ip}\n${userAgent || ""}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

export function opsAuditContextFromHeaders(headers: Headers): OpsAuditContext {
  const ipAddress = resolveClientIp(headers);
  const userAgent = headers.get("user-agent");
  return {
    ipAddress: ipAddress === "unknown" ? null : ipAddress,
    ipHash: hashIp(ipAddress),
    userAgent,
    geoLabel: parseGeoLabel(headers),
    deviceLabel: parseDeviceLabel(userAgent),
    machineHint: machineHint(ipAddress, userAgent),
  };
}

export async function opsAuditRequestMeta(): Promise<OpsAuditContext> {
  try {
    const { headers } = await import("next/headers");
    return opsAuditContextFromHeaders(await headers());
  } catch {
    return {
      ipHash: null,
      ipAddress: null,
      userAgent: null,
      geoLabel: null,
      deviceLabel: null,
      machineHint: null,
    };
  }
}
