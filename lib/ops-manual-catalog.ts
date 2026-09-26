/**
 * Ops work-manual catalog — maps docs/*.md to audience by Ops role / permission.
 * Source of truth for titles remains the MD files; this file only gates visibility.
 */

import {
  actorMay,
  isPlatformAdmin,
  type OpsActor,
  type OpsPermission,
  type OpsRole,
} from "@/lib/ops-roles";

export const OPS_MANUAL_GROUPS = [
  "intro",
  "core",
  "ops",
  "sales",
  "tech",
  "admin",
] as const;

export type OpsManualGroup = (typeof OPS_MANUAL_GROUPS)[number];

export const OPS_MANUAL_GROUP_LABELS: Record<OpsManualGroup, string> = {
  intro: "เริ่มต้น",
  core: "คู่มือหลัก",
  ops: "วงจรปฏิบัติการ",
  sales: "ขายและ CRM",
  tech: "เทคนิค / โครงข้อมูล",
  admin: "ผู้ดูแลระบบ",
};

export type OpsManualAudience = {
  /** Empty / omitted = every signed-in Ops user */
  roles?: OpsRole[];
  /** Actor needs ANY of these permissions (in addition to roles if set) */
  anyPermission?: OpsPermission[];
  /** Platform admin (superadmin/admin) only */
  platformAdminOnly?: boolean;
};

export type OpsManualDocMeta = {
  id: string;
  /** Path relative to repo `docs/` */
  file: string;
  title: string;
  summary: string;
  group: OpsManualGroup;
  audience: OpsManualAudience;
};

/**
 * Optional H2 section gates inside a doc (matched against slugified heading).
 * Unlisted sections inherit the document audience.
 */
export type OpsManualSectionGate = {
  /** Prefix match on section slug, e.g. "6-" for chapter 6 */
  slugPrefix: string;
  audience: OpsManualAudience;
};

export const OPS_MANUAL_DOCS: OpsManualDocMeta[] = [
  {
    id: "index",
    file: "manual/00-INDEX.md",
    title: "สารบัญชุดคู่มือ",
    summary: "ดัชนีเอกสาร manual และลิงก์ SOP ที่เกี่ยวข้อง",
    group: "intro",
    audience: {},
  },
  {
    id: "project",
    file: "manual/01-PROJECT-RECORD.md",
    title: "บันทึกการสร้างโปรแกรม",
    summary: "สแต็ก ผู้รับผิดชอบ และขอบเขตโครงการ",
    group: "intro",
    audience: {},
  },
  {
    id: "user-manual",
    file: "manual/02-USER-MANUAL.md",
    title: "คู่มือการใช้งาน",
    summary: "บทที่ 1–8 ตามเทมเพลต User Manual — กรองตามสิทธิ์",
    group: "core",
    audience: {},
  },
  {
    id: "workflows",
    file: "manual/03-WORKFLOWS.md",
    title: "Workflow diagrams",
    summary: "Sequence / State ของวงจรธุรกิจ",
    group: "core",
    audience: { anyPermission: ["orders.read", "quotes.read"] },
  },
  {
    id: "er-diagrams",
    file: "manual/04-ER-DIAGRAMS.md",
    title: "ER diagrams",
    summary: "โครง SQLite / MySQL / Strapi",
    group: "tech",
    audience: { anyPermission: ["users.read", "catalog.write", "audit.read"] },
  },
  {
    id: "function-matrix",
    file: "manual/05-FUNCTION-MATRIX.md",
    title: "Function matrix",
    summary: "ทุก route ↔ role ↔ บทคู่มือ",
    group: "core",
    audience: {},
  },
  {
    id: "sop-cycle",
    file: "SOP-CYCLE.md",
    title: "SOP ทั้งวงจร",
    summary: "สั่งผลิตสกรีนโลโก้จากจีน จัดส่งไทย",
    group: "ops",
    audience: { anyPermission: ["orders.read"] },
  },
  {
    id: "sop-checklist",
    file: "SOP-CHECKLIST.md",
    title: "เช็กลิสต์ SOP",
    summary: "รายการลงมือทำตามวงจร",
    group: "ops",
    audience: { anyPermission: ["orders.read"] },
  },
  {
    id: "ops-console",
    file: "OPS-CONSOLE.md",
    title: "Ops Console",
    summary: "ลูกค้า + ใบเสนอราคาในคอนโซล",
    group: "sales",
    audience: { anyPermission: ["quotes.read", "customers.read"] },
  },
  {
    id: "board-rules",
    file: "BOARD-STATUS-RULES.md",
    title: "กติกาสถานะบอร์ด",
    summary: "กฎย้ายการ์ดบนบอร์ดงาน",
    group: "sales",
    audience: { anyPermission: ["quotes.read", "orders.read"] },
  },
  {
    id: "partner-api",
    file: "PARTNER-API.md",
    title: "Partner API",
    summary: "REST คู่ค้า v1",
    group: "tech",
    audience: { anyPermission: ["users.read"] },
  },
  {
    id: "p2-quote-tools",
    file: "P2-QUOTE-TOOLS.md",
    title: "P2 Quote Tools",
    summary: "เป้าออกแบบเครื่องมือใบเสนอราคา",
    group: "sales",
    audience: { anyPermission: ["quotes.write", "users.read"] },
  },
  {
    id: "staging-deploy",
    file: "STAGING-DEPLOY.md",
    title: "Staging deploy",
    summary: "เส้นทาง deploy staging",
    group: "admin",
    audience: { platformAdminOnly: true },
  },
  {
    id: "nas-portainer",
    file: "NAS-PORTAINER.md",
    title: "NAS Portainer",
    summary: "Portainer + Cloudflare",
    group: "admin",
    audience: { platformAdminOnly: true },
  },
  {
    id: "git-remotes",
    file: "GIT-REMOTES.md",
    title: "Git remotes",
    summary: "backup และ CI remotes",
    group: "admin",
    audience: { platformAdminOnly: true },
  },
];

/** Extra section gates for the long user manual. */
export const USER_MANUAL_SECTION_GATES: OpsManualSectionGate[] = [
  {
    slugPrefix: "6-",
    audience: { anyPermission: ["reports.read", "finance.read"] },
  },
  {
    slugPrefix: "5-23",
    audience: { anyPermission: ["factory.read"] },
  },
  {
    slugPrefix: "5-24",
    audience: { anyPermission: ["factory.read"] },
  },
  {
    slugPrefix: "5-25",
    audience: { anyPermission: ["factory.write", "factory.read"] },
  },
  {
    slugPrefix: "5-26",
    audience: { anyPermission: ["finance.write", "factory.read"] },
  },
  {
    slugPrefix: "5-30",
    audience: { anyPermission: ["orders.write", "finance.write"] },
  },
  {
    slugPrefix: "5-34",
    audience: { anyPermission: ["audit.read"] },
  },
  {
    slugPrefix: "5-35",
    audience: { anyPermission: ["users.read"] },
  },
];

export function actorPassesAudience(
  actor: OpsActor,
  audience: OpsManualAudience,
): boolean {
  if (audience.platformAdminOnly && !isPlatformAdmin(actor.role)) {
    return false;
  }
  if (audience.roles?.length && !audience.roles.includes(actor.role)) {
    return false;
  }
  if (audience.anyPermission?.length) {
    return audience.anyPermission.some((perm) => actorMay(actor, perm));
  }
  return true;
}

export function listManualDocsForActor(actor: OpsActor): OpsManualDocMeta[] {
  return OPS_MANUAL_DOCS.filter((doc) => actorPassesAudience(actor, doc.audience));
}

export function findManualDoc(id: string): OpsManualDocMeta | undefined {
  return OPS_MANUAL_DOCS.find((doc) => doc.id === id);
}

export function sectionGatesForDoc(docId: string): OpsManualSectionGate[] {
  if (docId === "user-manual") return USER_MANUAL_SECTION_GATES;
  return [];
}
