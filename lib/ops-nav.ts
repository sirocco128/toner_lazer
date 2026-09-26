import { actorMay, ROLE_LABELS, type OpsActor } from "@/lib/ops-roles";
import { isNavActive } from "@/lib/nav";
import { getStrapiAdminUrl } from "@/lib/strapi-url";

/** Work-stage groups — matches how staff actually move through a giftset job. */
export const OPS_NAV_GROUP_IDS = [
  "today",
  "sales",
  "catalog",
  "cycle",
  "finance",
  "content",
  "system",
] as const;

export type OpsNavGroupId = (typeof OPS_NAV_GROUP_IDS)[number];

export const OPS_NAV_GROUP_LABELS: Record<OpsNavGroupId, string> = {
  today: "วันนี้",
  sales: "ขายและลูกค้า",
  catalog: "ราคาและสินค้า",
  cycle: "ปฏิบัติการ",
  finance: "รายงานและบัญชี",
  content: "เนื้อหาเว็บ",
  system: "ระบบ",
};

export type OpsNavLink = {
  href: string;
  label: string;
  group: OpsNavGroupId;
  external?: boolean;
};

export type OpsNavGroup = {
  id: OpsNavGroupId;
  label: string;
  links: OpsNavLink[];
};

export function buildOpsNavLinks(actor: OpsActor): OpsNavLink[] {
  const links: OpsNavLink[] = [
    { href: "/ops", label: "ภาพรวม", group: "today" },
    { href: "/ops/board", label: "บอร์ดงาน", group: "today" },
  ];
  if (actorMay(actor, "reports.read")) {
    links.push({ href: "/ops/reports", label: "รายงาน", group: "finance" });
  }
  links.push(
    { href: "/ops/quotes", label: "ใบเสนอราคา", group: "sales" },
    { href: "/ops/inquiries", label: "ข้อความติดต่อ", group: "sales" },
  );
  if (actorMay(actor, "schedule.read")) {
    links.push({ href: "/ops/schedule", label: "นัดหมาย", group: "sales" });
  }
  links.push(
    { href: "/ops/pricing", label: "คิดทีละชุด", group: "catalog" },
    { href: "/ops/price-sheet", label: "ชีตราคา 3 แท็บ", group: "catalog" },
    { href: "/ops/pricing/import", label: "อัปเดตจาก Excel", group: "catalog" },
    { href: "/ops/orders", label: "ออเดอร์", group: "sales" },
    { href: "/ops/customers", label: "ลูกค้า", group: "sales" },
    { href: "/ops/approvals", label: "อนุมัติยอด", group: "cycle" },
    { href: "/ops/cycle", label: "วงจรปฏิบัติการ", group: "cycle" },
  );

  if (actorMay(actor, "stock.read")) {
    links.push({ href: "/ops/stock", label: "คลังสินค้า", group: "cycle" });
    links.push({ href: "/ops/stock/movements", label: "เคลื่อนไหวสต็อก", group: "cycle" });
  }
  if (actorMay(actor, "stock.write")) {
    links.push({ href: "/ops/stock/adjust", label: "ปรับ/โอนสต็อก", group: "cycle" });
    links.push({ href: "/ops/stock/counts", label: "ตรวจนับสต็อก", group: "cycle" });
  }
  if (actorMay(actor, "factory.write")) {
    links.push({ href: "/ops/inbound", label: "รับสินค้าเข้า", group: "cycle" });
  }
  if (actorMay(actor, "finance.read") || actorMay(actor, "stock.read")) {
    links.push({ href: "/ops/assets", label: "ทะเบียนทรัพย์/ล็อต", group: "cycle" });
  }
  if (actorMay(actor, "factory.write")) {
    links.push({ href: "/ops/claims", label: "เคลม", group: "cycle" });
  }
  if (actorMay(actor, "factory.read")) {
    links.push({ href: "/ops/factory-po", label: "ใบสั่งโรงงาน", group: "cycle" });
    links.push({ href: "/ops/factories", label: "ทะเบียนโรงงาน", group: "cycle" });
  }
  if (actorMay(actor, "finance.write")) {
    links.push({ href: "/ops/pay-factory", label: "จ่ายโรงงาน", group: "cycle" });
  }
  if (actorMay(actor, "orders.write")) {
    links.push({ href: "/ops/receipts", label: "ใบรับเงิน", group: "cycle" });
  }
  if (actorMay(actor, "customers.write")) {
    links.push({ href: "/ops/line-lab", label: "ทดลองไลน์", group: "sales" });
  }
  if (actorMay(actor, "finance.read")) {
    links.push({ href: "/ops/finance", label: "งบผู้บริหาร", group: "finance" });
  }
  links.push({ href: "/ops/seo", label: "SEO", group: "content" });
  if (actorMay(actor, "seo.write")) {
    links.push({ href: "/ops/blog", label: "บทความ", group: "content" });
  }
  if (actorMay(actor, "catalog.write")) {
    links.push({ href: "/ops/products", label: "สินค้า A/B/C/D", group: "catalog" });
    links.push({
      href: getStrapiAdminUrl(),
      label: "เข้า Strapi",
      group: "catalog",
      external: true,
    });
    links.push({ href: "/ops/catalog-books", label: "สร้างสมุด", group: "catalog" });
    links.push({ href: "/ops/catalog-images", label: "รูปโรงงาน", group: "catalog" });
  }
  if (actorMay(actor, "assistant.use")) {
    links.push({ href: "/ops/assistant", label: "ผู้ช่วยเซลล์", group: "sales" });
  }
  if (actorMay(actor, "documents.hold")) {
    links.push({ href: "/ops/holds", label: "พักเอกสาร", group: "cycle" });
  }
  if (actorMay(actor, "audit.read")) {
    links.push({ href: "/ops/audit", label: "บันทึกการใช้งาน", group: "system" });
  }
  if (actor.role === "superadmin" || actor.role === "admin") {
    links.push({
      href: "/ops/knowledge-sync",
      label: "อัปเดตคลัง Smart Gift",
      group: "system",
    });
  }
  if (actorMay(actor, "users.read")) {
    links.push({ href: "/ops/users", label: "ผู้ใช้ / สิทธิ์", group: "system" });
  }
  links.push({ href: "/ops/manual", label: "คู่มือการทำงาน", group: "system" });
  links.push({ href: "/", label: "เว็บสาธารณะ", group: "system" });
  return links;
}

export function groupOpsNavLinks(links: OpsNavLink[]): OpsNavGroup[] {
  const byGroup = new Map<OpsNavGroupId, OpsNavLink[]>();
  for (const link of links) {
    const bucket = byGroup.get(link.group);
    if (bucket) bucket.push(link);
    else byGroup.set(link.group, [link]);
  }
  return OPS_NAV_GROUP_IDS.flatMap((id) => {
    const groupLinks = byGroup.get(id);
    if (!groupLinks?.length) return [];
    return [{ id, label: OPS_NAV_GROUP_LABELS[id], links: groupLinks }];
  });
}

export function filterOpsNavGroups(
  groups: OpsNavGroup[],
  query: string,
): OpsNavGroup[] {
  const q = query.trim().toLocaleLowerCase("th");
  if (!q) return groups;
  return groups.flatMap((group) => {
    if (group.label.toLocaleLowerCase("th").includes(q)) return [group];
    const links = group.links.filter((link) =>
      link.label.toLocaleLowerCase("th").includes(q),
    );
    if (!links.length) return [];
    return [{ ...group, links }];
  });
}

export const OPS_NAV_COLLAPSE_STORAGE_KEY = "smartgift:ops-nav-collapsed";

/** Desktop left rail open/closed (full sidebar vs collapsed). */
export const OPS_NAV_RAIL_STORAGE_KEY = "smartgift:ops-nav-rail";

export function parseOpsNavRailOpen(raw: string | null): boolean {
  if (raw == null) return true;
  if (raw === "0" || raw === "false" || raw === "collapsed") return false;
  if (raw === "1" || raw === "true" || raw === "open") return true;
  return true;
}

export function groupHasActiveLink(group: OpsNavGroup, pathname: string): boolean {
  return group.links.some((link) => isOpsNavActive(pathname, link.href));
}

export function parseCollapsedGroupIds(value: unknown): OpsNavGroupId[] {
  const source =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;
  if (!Array.isArray(source)) return [];
  const allowed = new Set(
    source.filter((id): id is OpsNavGroupId =>
      (OPS_NAV_GROUP_IDS as readonly string[]).includes(id as string),
    ),
  );
  return OPS_NAV_GROUP_IDS.filter((id) => allowed.has(id));
}

/** Keep the current page's work-stage card open so staff still see where they are. */
export function withActiveGroupExpanded(
  stored: Iterable<string>,
  groups: OpsNavGroup[],
  pathname: string,
): OpsNavGroupId[] {
  const collapsed = new Set(parseCollapsedGroupIds([...stored]));
  const activeId = groups.find((group) => groupHasActiveLink(group, pathname))?.id;
  if (activeId) collapsed.delete(activeId);
  return OPS_NAV_GROUP_IDS.filter((id) => collapsed.has(id));
}

export function isOpsNavActive(pathname: string, href: string): boolean {
  if (href.startsWith("http://") || href.startsWith("https://")) return false;
  if (href === "/ops") return pathname === "/ops";
  if (href === "/") return pathname === "/";
  if (href === "/ops/board") {
    return pathname === "/ops/board" || pathname.startsWith("/ops/board/");
  }
  if (href === "/ops/pricing") {
    return pathname === "/ops/pricing";
  }
  if (href === "/ops/price-sheet") {
    return pathname === "/ops/price-sheet" || pathname.startsWith("/ops/price-sheet/");
  }
  if (href === "/ops/reports") {
    return pathname === "/ops/reports" || pathname.startsWith("/ops/reports/");
  }
  if (href === "/ops/schedule") {
    return pathname === "/ops/schedule" || pathname.startsWith("/ops/schedule/");
  }
  return isNavActive(pathname, href);
}

export function opsActorLabel(actor: OpsActor): string {
  return `${actor.email} · ${ROLE_LABELS[actor.role]}`;
}
