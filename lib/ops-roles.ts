/**
 * Ops console roles. Not TMS roles and not Strapi CMS roles.
 * superadmin = ชั้นสูงสุด (เพิ่มจาก admin) — สิทธิ์เต็มเหมือนผู้ดูแล
 * admin = full console including factory PO + finance
 * *Admin = หัวหน้าฝ่าย (สิทธิ์ฝ่ายตนเอง + ดูผู้ใช้)
 * accountant / sales / viewer = พนักงาน
 */

export const OPS_ROLES = [
  "superadmin",
  "admin",
  "sales_admin",
  "accountant_admin",
  "warehouse_admin",
  "office_admin",
  "accountant",
  "sales",
  "viewer",
] as const;

export type OpsRole = (typeof OPS_ROLES)[number];

export const PLATFORM_ADMIN_ROLES = ["superadmin", "admin"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const DEPARTMENT_ADMIN_ROLES = [
  "sales_admin",
  "accountant_admin",
  "warehouse_admin",
  "office_admin",
] as const;
export type DepartmentAdminRole = (typeof DEPARTMENT_ADMIN_ROLES)[number];

export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === "superadmin" || role === "admin";
}

export function isDepartmentAdmin(role: string | null | undefined): boolean {
  return (DEPARTMENT_ADMIN_ROLES as readonly string[]).includes(String(role || ""));
}

export const OPS_PERMISSIONS = [
  "quotes.read",
  "quotes.write",
  "customers.read",
  "customers.write",
  "customers.merge",
  "customers.import",
  "orders.read",
  "orders.write",
  "audit.read",
  "documents.read",
  "documents.write",
  "documents.restricted",
  "documents.hold",
  "documents.hold.release",
  "assistant.use",
  "seo.write",
  "factory.read",
  "factory.write",
  "stock.read",
  "stock.write",
  "finance.read",
  "finance.write",
  "reports.read",
  "catalog.write",
  "users.read",
  "users.write",
  "schedule.read",
  "schedule.write",
] as const;

export type OpsPermission = (typeof OPS_PERMISSIONS)[number];

export type OpsActor = {
  email: string;
  name: string;
  role: OpsRole;
  staffId?: number;
  extraGrants?: OpsPermission[];
  extraDenies?: OpsPermission[];
};

export const ROLE_PERMISSIONS: Record<OpsRole, OpsPermission[]> = {
  superadmin: [...OPS_PERMISSIONS],
  admin: [...OPS_PERMISSIONS],
  accountant: [
    "quotes.read",
    "customers.read",
    "orders.read",
    "orders.write",
    "factory.read",
    "finance.read",
    "finance.write",
    "reports.read",
    "audit.read",
    "documents.read",
    "documents.write",
    "documents.restricted",
    "documents.hold",
    "schedule.read",
  ],
  sales: [
    "quotes.read",
    "quotes.write",
    "customers.read",
    "customers.write",
    "orders.read",
    "orders.write",
    "documents.read",
    "documents.write",
    "documents.restricted",
    "documents.hold",
    "assistant.use",
    "seo.write",
    "catalog.write",
    "reports.read",
    "schedule.read",
    "schedule.write",
  ],
  viewer: [
    "quotes.read",
    "customers.read",
    "orders.read",
    "documents.read",
    "reports.read",
    "schedule.read",
  ],
  sales_admin: [],
  accountant_admin: [],
  warehouse_admin: [
    "quotes.read",
    "customers.read",
    "orders.read",
    "orders.write",
    "documents.read",
    "documents.write",
    "documents.restricted",
    "documents.hold",
    "factory.read",
    "factory.write",
    "stock.read",
    "stock.write",
    "catalog.write",
    "reports.read",
    "schedule.read",
    "users.read",
  ],
  office_admin: [
    "quotes.read",
    "customers.read",
    "customers.write",
    "orders.read",
    "documents.read",
    "documents.write",
    "reports.read",
    "schedule.read",
    "schedule.write",
    "users.read",
  ],
};

ROLE_PERMISSIONS.sales_admin = [...ROLE_PERMISSIONS.sales, "users.read", "audit.read"];
ROLE_PERMISSIONS.accountant_admin = [...ROLE_PERMISSIONS.accountant, "users.read"];

export const ROLE_LABELS: Record<OpsRole, string> = {
  superadmin: "ผู้ดูแลสูงสุด",
  admin: "ผู้ดูแล",
  sales_admin: "หัวหน้าฝ่ายขาย",
  accountant_admin: "หัวหน้าฝ่ายบัญชี",
  warehouse_admin: "หัวหน้าฝ่ายคลัง",
  office_admin: "หัวหน้าสำนักงาน",
  accountant: "ผู้ทำบัญชี",
  sales: "เซลล์",
  viewer: "ดูอย่างเดียว",
};

export const PERMISSION_LABELS: Record<OpsPermission, string> = {
  "quotes.read": "ดูใบเสนอราคา",
  "quotes.write": "แก้ใบเสนอราคา",
  "customers.read": "ดูลูกค้า",
  "customers.write": "แก้ลูกค้า",
  "customers.merge": "รวมลูกค้าซ้ำ",
  "customers.import": "นำเข้าลูกค้า",
  "orders.read": "ดูออเดอร์ / รับชำระ",
  "orders.write": "แก้ออเดอร์ / อนุมัติยอด",
  "audit.read": "ดูบันทึกการใช้งาน",
  "documents.read": "ดูเอกสารบัญชี / PDF",
  "documents.write": "อัปโหลดเอกสารสำคัญ",
  "documents.restricted": "เปิดสลิปและเอกสารส่วนบุคคล",
  "documents.hold": "พักลบเอกสาร (legal hold)",
  "documents.hold.release": "ปลด legal hold (คนละคนกับผู้พัก)",
  "assistant.use": "ใช้ผู้ช่วยเซลล์",
  "seo.write": "แก้ SEO",
  "factory.read": "ดูใบสั่งและทะเบียนโรงงาน",
  "factory.write": "แก้ใบสั่งและทะเบียนโรงงาน",
  "stock.read": "ดูสต็อกคลัง",
  "stock.write": "รับ/ตัด/ปรับ/โอนสต็อก",
  "finance.read": "ดูงบผู้บริหาร / สมุดบัญชี",
  "finance.write": "ลงบัญชี / ผังบัญชี / ทรัพย์สิน",
  "reports.read": "ดูรายงานวงจรรายได้",
  "catalog.write": "จัดการสินค้า / สมุดแคตตาล็อก",
  "users.read": "ดูรายชื่อพนักงาน",
  "users.write": "เพิ่ม/แก้สิทธิ์พนักงาน",
  "schedule.read": "ดูนัดหมาย",
  "schedule.write": "สร้าง / แก้ / ยกเลิกนัดหมาย",
};

export const STAFF_DEPARTMENTS = [
  "sales",
  "accounting",
  "warehouse",
  "office",
  "other",
] as const;

export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<StaffDepartment, string> = {
  sales: "ขาย",
  accounting: "บัญชี",
  warehouse: "คลัง / จัดส่ง",
  office: "สำนักงาน",
  other: "อื่น ๆ",
};

export function isStaffDepartment(
  value: string | null | undefined,
): value is StaffDepartment {
  return (STAFF_DEPARTMENTS as readonly string[]).includes(String(value || ""));
}

export function isOpsPermission(
  value: string | null | undefined,
): value is OpsPermission {
  return (OPS_PERMISSIONS as readonly string[]).includes(String(value || ""));
}

export function isOpsRole(value: string | null | undefined): value is OpsRole {
  return (OPS_ROLES as readonly string[]).includes(String(value || ""));
}

export const PERMISSION_GROUPS: Array<{
  title: string;
  items: OpsPermission[];
}> = [
  { title: "ใบเสนอราคา", items: ["quotes.read", "quotes.write"] },
  {
    title: "ลูกค้า",
    items: [
      "customers.read",
      "customers.write",
      "customers.merge",
      "customers.import",
    ],
  },
  { title: "ออเดอร์", items: ["orders.read", "orders.write"] },
  {
    title: "เอกสาร",
    items: [
      "documents.read",
      "documents.write",
      "documents.restricted",
      "documents.hold",
      "documents.hold.release",
    ],
  },
  {
    title: "โรงงาน",
    items: ["factory.read", "factory.write", "stock.read", "stock.write", "catalog.write"],
  },
  { title: "บัญชี", items: ["finance.read", "finance.write"] },
  { title: "รายงาน", items: ["reports.read"] },
  { title: "นัดหมาย", items: ["schedule.read", "schedule.write"] },
  {
    title: "ระบบ",
    items: [
      "audit.read",
      "assistant.use",
      "seo.write",
      "users.read",
      "users.write",
    ],
  },
];

export function permissionsFor(role: OpsRole): OpsPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function actorMay(actor: OpsActor, permission: OpsPermission): boolean {
  if (actor.extraDenies?.includes(permission)) return false;
  if (actor.extraGrants?.includes(permission)) return true;
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export function effectivePermissions(actor: OpsActor): OpsPermission[] {
  return OPS_PERMISSIONS.filter((permission) => actorMay(actor, permission));
}

export type OpsUserSeed = OpsActor & { password: string };

function parseOpsUsersJson(raw: string): OpsUserSeed[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: OpsUserSeed[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const email = String(row.email || "").trim().toLowerCase();
      const password = String(row.password || "");
      const name = String(row.name || "").trim() || email;
      const role = String(row.role || "").trim();
      if (!email || password.length < 12 || !isOpsRole(role)) continue;
      out.push({ email, password, role, name });
    }
    return out;
  } catch {
    return [];
  }
}

export function listOpsUserSeeds(): OpsUserSeed[] {
  const users = parseOpsUsersJson(process.env.OPS_USERS || "");
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const adminEmail = (process.env.ADMIN_EMAIL || "admin").trim().toLowerCase();
  const seedPassword = (process.env.DEMO_ADMIN_PASSWORD || "Admin1234").trim();
  if (adminPassword.length >= 8) {
    const already = users.some((u) => u.email === adminEmail);
    if (!already) {
      users.unshift({
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        name: (process.env.ADMIN_NAME || "").trim() || "ผู้ดูแล",
      });
    }
  }
  if (seedPassword.length >= 8) {
    const superFromEnv = (process.env.SUPERADMIN_PASSWORD || "").trim();
    const superPassword =
      superFromEnv.length >= 8 ? superFromEnv : seedPassword;
    const builtins: OpsUserSeed[] = [
      {
        email: "superadmin",
        password: superPassword,
        role: "superadmin",
        name: (process.env.SUPERADMIN_NAME || "").trim() || "ผู้ดูแลสูงสุด",
      },
      {
        email: "admin",
        password: seedPassword,
        role: "admin",
        name: "ผู้ดูแลระบบ",
      },
      {
        email: "sales-admin",
        password: seedPassword,
        role: "sales_admin",
        name: "หัวหน้าฝ่ายขาย",
      },
      {
        email: "accountant-admin",
        password: seedPassword,
        role: "accountant_admin",
        name: "หัวหน้าฝ่ายบัญชี",
      },
      {
        email: "warehouse-admin",
        password: seedPassword,
        role: "warehouse_admin",
        name: "หัวหน้าฝ่ายคลัง",
      },
      {
        email: "office-admin",
        password: seedPassword,
        role: "office_admin",
        name: "หัวหน้าสำนักงาน",
      },
      {
        email: "sales",
        password: seedPassword,
        role: "sales",
        name: "เซลล์",
      },
      {
        email: "accountant",
        password: seedPassword,
        role: "accountant",
        name: "บัญชี",
      },
      {
        email: "viewer",
        password: seedPassword,
        role: "viewer",
        name: "ดูอย่างเดียว",
      },
    ];
    for (const extra of builtins) {
      if (!users.some((u) => u.email === extra.email)) users.push(extra);
    }
  }
  return users;
}

export function findOpsUserByEmail(email: string): OpsUserSeed | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  return listOpsUserSeeds().find((user) => user.email === wanted) ?? null;
}
