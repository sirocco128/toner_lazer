/**
 * Load and filter Ops work-manual markdown from docs/ for the signed-in actor.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { OpsActor } from "@/lib/ops-roles";
import {
  actorPassesAudience,
  findManualDoc,
  listManualDocsForActor,
  sectionGatesForDoc,
  type OpsManualDocMeta,
  type OpsManualGroup,
} from "@/lib/ops-manual-catalog";
import {
  manualMarkdownToHtml,
  slugifyManualHeading,
} from "@/lib/ops-manual-md";

export type OpsManualSection = {
  id: string;
  title: string;
  markdown: string;
  html: string;
};

export type OpsManualDocument = {
  id: string;
  title: string;
  summary: string;
  group: OpsManualGroup;
  file: string;
  html: string;
  sections: OpsManualSection[];
};

export type OpsManualTocEntry = {
  id: string;
  title: string;
  summary: string;
  group: OpsManualGroup;
};

function docsRoot(): string {
  return resolve(process.cwd(), "docs");
}

export function resolveManualFilePath(relativeFile: string): string | null {
  const safe = relativeFile.replace(/\\/g, "/").replace(/\.\./g, "");
  if (!safe || safe.startsWith("/") || !safe.endsWith(".md")) return null;
  const root = docsRoot();
  const full = resolve(root, ...safe.split("/"));
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (full !== root && !full.startsWith(prefix)) return null;
  if (!existsSync(full)) return null;
  return full;
}

export function readManualMarkdown(relativeFile: string): string | null {
  const full = resolveManualFilePath(relativeFile);
  if (!full) return null;
  return readFileSync(full, "utf8");
}

function splitMarkdownSections(markdown: string): OpsManualSection[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections: OpsManualSection[] = [];
  let currentTitle = "ภาพรวม";
  let currentLines: string[] = [];

  const push = () => {
    const body = currentLines.join("\n").trim();
    if (!body && sections.length === 0) return;
    const title = currentTitle;
    const id = slugifyManualHeading(title);
    sections.push({
      id,
      title,
      markdown: body,
      html: manualMarkdownToHtml(body),
    });
  };

  for (const line of lines) {
    const h2 = line.trim().match(/^##\s+(.+)$/);
    if (h2) {
      push();
      currentTitle = h2[1] || "หัวข้อ";
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }
  push();
  return sections.filter((s) => s.markdown.length > 0);
}

function filterSectionsForActor(
  docId: string,
  sections: OpsManualSection[],
  actor: OpsActor,
): OpsManualSection[] {
  const gates = sectionGatesForDoc(docId);
  if (!gates.length) return sections;
  return sections.filter((section) => {
    const gate = gates.find((g) => section.id.startsWith(g.slugPrefix));
    if (!gate) return true;
    return actorPassesAudience(actor, gate.audience);
  });
}

export function buildManualToc(actor: OpsActor): OpsManualTocEntry[] {
  return listManualDocsForActor(actor).map((doc) => ({
    id: doc.id,
    title: doc.title,
    summary: doc.summary,
    group: doc.group,
  }));
}

export function loadManualDocument(
  docId: string,
  actor: OpsActor,
): OpsManualDocument | { error: string; status: number } {
  const meta = findManualDoc(docId);
  if (!meta) return { error: "ไม่พบเอกสาร", status: 404 };
  if (!actorPassesAudience(actor, meta.audience)) {
    return { error: "บัญชีนี้ไม่มีสิทธิ์อ่านเอกสารนี้", status: 403 };
  }

  const markdown = readManualMarkdown(meta.file);
  if (markdown == null) {
    return { error: "ไฟล์เอกสารหายจากดิสก์", status: 404 };
  }

  const sections = filterSectionsForActor(
    meta.id,
    splitMarkdownSections(markdown),
    actor,
  );
  const html = sections.map((s) => s.html).join("\n");

  return {
    id: meta.id,
    title: meta.title,
    summary: meta.summary,
    group: meta.group,
    file: meta.file,
    html,
    sections,
  };
}

export function listDocsMissingOnDisk(): OpsManualDocMeta[] {
  return listManualDocsForActor({
    email: "check",
    name: "check",
    role: "admin",
  }).filter((doc) => !resolveManualFilePath(doc.file));
}
