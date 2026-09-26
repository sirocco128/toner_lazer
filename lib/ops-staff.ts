/**
 * Ops staff accounts stored in SQLite (hashed passwords + RBAC extras).
 * Env seeds (ADMIN_PASSWORD / OPS_USERS) remain a bootstrap fallback.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/database";
import {
  isOpsPermission,
  isOpsRole,
  isPlatformAdmin,
  isStaffDepartment,
  type OpsActor,
  type OpsPermission,
  type OpsRole,
  type StaffDepartment,
} from "@/lib/ops-roles";

const MIN_PASSWORD = 12;

export type OpsStaff = {
  id: number;
  email: string;
  name: string;
  role: OpsRole;
  department: StaffDepartment | null;
  extraGrants: OpsPermission[];
  extraDenies: OpsPermission[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdBy: string | null;
};

type StaffRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  password_hash: string;
  password_salt: string;
  extra_grants: string;
  extra_denies: string;
  active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string | null;
};

function parsePermissionList(raw: string): OpsPermission[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: OpsPermission[] = [];
    for (const item of parsed) {
      const value = String(item || "");
      if (isOpsPermission(value) && !out.includes(value)) out.push(value);
    }
    return out;
  } catch {
    return [];
  }
}

function mapStaff(row: StaffRow): OpsStaff {
  const role = isOpsRole(row.role) ? row.role : "viewer";
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    department: isStaffDepartment(row.department) ? row.department : null,
    extraGrants: parsePermissionList(row.extra_grants),
    extraDenies: parsePermissionList(row.extra_denies),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
  };
}

export function staffToActor(staff: OpsStaff): OpsActor {
  return {
    email: staff.email,
    name: staff.name,
    role: staff.role,
    staffId: staff.id,
    extraGrants: staff.extraGrants,
    extraDenies: staff.extraDenies,
  };
}

export function hashOpsPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyOpsPasswordHash(
  password: string,
  hash: string,
  salt: string,
): boolean {
  try {
    const next = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (next.length !== expected.length) return false;
    return timingSafeEqual(next, expected);
  } catch {
    return false;
  }
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidStaffLogin(email: string): boolean {
  const value = normalizeStaffEmail(email);
  if (value.length < 3 || value.length > 120) return false;
  if (/\s/.test(value)) return false;
  return true;
}

function tableReady(): boolean {
  try {
    getDb().prepare("SELECT 1 FROM ops_staff LIMIT 1").get();
    return true;
  } catch {
    return false;
  }
}

export function countActiveOpsStaff(): number {
  if (!tableReady()) return 0;
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM ops_staff WHERE active = 1")
    .get() as { n: number } | undefined;
  return Number(row?.n || 0);
}

export function countActiveAdmins(exceptId?: number): number {
  if (!tableReady()) return 0;
  if (exceptId) {
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM ops_staff WHERE active = 1 AND role IN ('admin','superadmin') AND id != ?",
      )
      .get(exceptId) as { n: number } | undefined;
    return Number(row?.n || 0);
  }
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM ops_staff WHERE active = 1 AND role IN ('admin','superadmin')",
    )
    .get() as { n: number } | undefined;
  return Number(row?.n || 0);
}

export function listOpsStaff(): OpsStaff[] {
  if (!tableReady()) return [];
  const rows = getDb()
    .prepare(
      `SELECT id, email, name, role, department, password_hash, password_salt,
              extra_grants, extra_denies, active, created_at, updated_at,
              last_login_at, created_by
       FROM ops_staff
       ORDER BY active DESC, role ASC, name COLLATE NOCASE ASC`,
    )
    .all() as StaffRow[];
  return rows.map(mapStaff);
}

export function getOpsStaffById(id: number): OpsStaff | null {
  if (!tableReady() || !Number.isInteger(id) || id < 1) return null;
  const row = getDb()
    .prepare(
      `SELECT id, email, name, role, department, password_hash, password_salt,
              extra_grants, extra_denies, active, created_at, updated_at,
              last_login_at, created_by
       FROM ops_staff WHERE id = ?`,
    )
    .get(id) as StaffRow | undefined;
  return row ? mapStaff(row) : null;
}

export function getOpsStaffByEmail(email: string): OpsStaff | null {
  if (!tableReady()) return null;
  const wanted = normalizeStaffEmail(email);
  if (!wanted) return null;
  const row = getDb()
    .prepare(
      `SELECT id, email, name, role, department, password_hash, password_salt,
              extra_grants, extra_denies, active, created_at, updated_at,
              last_login_at, created_by
       FROM ops_staff WHERE email = ?`,
    )
    .get(wanted) as StaffRow | undefined;
  return row ? mapStaff(row) : null;
}

function getStaffAuthRow(email: string): StaffRow | null {
  if (!tableReady()) return null;
  const wanted = normalizeStaffEmail(email);
  if (!wanted) return null;
  const row = getDb()
    .prepare(
      `SELECT id, email, name, role, department, password_hash, password_salt,
              extra_grants, extra_denies, active, created_at, updated_at,
              last_login_at, created_by
       FROM ops_staff WHERE email = ?`,
    )
    .get(wanted) as StaffRow | undefined;
  return row ?? null;
}

export type CreateOpsStaffInput = {
  email: string;
  name: string;
  role: OpsRole;
  department?: StaffDepartment | null;
  password: string;
  extraGrants?: OpsPermission[];
  extraDenies?: OpsPermission[];
  createdBy?: string | null;
};

export function createOpsStaff(input: CreateOpsStaffInput): OpsStaff {
  const email = normalizeStaffEmail(input.email);
  if (!isValidStaffLogin(email)) {
    throw new Error("อีเมลหรือชื่อเข้าใช้งานไม่ถูกต้อง");
  }
  const name = input.name.trim();
  if (!name) throw new Error("กรุณาใส่ชื่อพนักงาน");
  if (input.password.length < MIN_PASSWORD) {
    throw new Error(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
  }
  if (getOpsStaffByEmail(email)) {
    throw new Error("อีเมลนี้มีในระบบแล้ว");
  }
  const { hash, salt } = hashOpsPassword(input.password);
  const now = new Date().toISOString();
  const grants = JSON.stringify(input.extraGrants ?? []);
  const denies = JSON.stringify(input.extraDenies ?? []);
  getDb()
    .prepare(
      `INSERT INTO ops_staff (
        email, name, role, department, password_hash, password_salt,
        extra_grants, extra_denies, active, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(
      email,
      name,
      input.role,
      input.department ?? null,
      hash,
      salt,
      grants,
      denies,
      now,
      now,
      input.createdBy ?? null,
    );
  const created = getOpsStaffByEmail(email);
  if (!created) throw new Error("บันทึกพนักงานไม่สำเร็จ");
  return created;
}

export type UpdateOpsStaffInput = {
  id: number;
  name?: string;
  role?: OpsRole;
  department?: StaffDepartment | null;
  extraGrants?: OpsPermission[];
  extraDenies?: OpsPermission[];
  active?: boolean;
  password?: string | null;
};

export function updateOpsStaff(input: UpdateOpsStaffInput): OpsStaff {
  const current = getOpsStaffById(input.id);
  if (!current) throw new Error("ไม่พบพนักงาน");

  const name = input.name !== undefined ? input.name.trim() : current.name;
  if (!name) throw new Error("กรุณาใส่ชื่อพนักงาน");
  const role = input.role ?? current.role;
  const active = input.active ?? current.active;
  const department =
    input.department !== undefined ? input.department : current.department;
  const extraGrants = input.extraGrants ?? current.extraGrants;
  const extraDenies = input.extraDenies ?? current.extraDenies;
  const overlap = extraGrants.filter((item) => extraDenies.includes(item));
  if (overlap.length > 0) {
    throw new Error("สิทธิ์เดียวกันห้ามทั้งอนุญาตและห้ามพร้อมกัน");
  }

  const remainingAdmins = countActiveAdmins(current.id);
  const wouldBeAdmin = active && isPlatformAdmin(role);
  if (isPlatformAdmin(current.role) && current.active && !wouldBeAdmin && remainingAdmins < 1) {
    throw new Error("ต้องเหลือผู้ดูแลที่ใช้งานได้อย่างน้อย 1 คน");
  }

  const now = new Date().toISOString();
  const grantsJson = JSON.stringify(extraGrants);
  const deniesJson = JSON.stringify(extraDenies);
  const activeFlag = active ? 1 : 0;
  if (input.password) {
    if (input.password.length < MIN_PASSWORD) {
      throw new Error(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
    }
    const { hash, salt } = hashOpsPassword(input.password);
    getDb()
      .prepare(
        `UPDATE ops_staff SET
          name = ?, role = ?, department = ?, extra_grants = ?, extra_denies = ?,
          active = ?, updated_at = ?, password_hash = ?, password_salt = ?
         WHERE id = ?`,
      )
      .run(
        name,
        role,
        department,
        grantsJson,
        deniesJson,
        activeFlag,
        now,
        hash,
        salt,
        current.id,
      );
  } else {
    getDb()
      .prepare(
        `UPDATE ops_staff SET
          name = ?, role = ?, department = ?, extra_grants = ?, extra_denies = ?,
          active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        name,
        role,
        department,
        grantsJson,
        deniesJson,
        activeFlag,
        now,
        current.id,
      );
  }
  const next = getOpsStaffById(current.id);
  if (!next) throw new Error("อัปเดตพนักงานไม่สำเร็จ");
  return next;
}

export function authenticateOpsStaff(
  email: string,
  password: string,
): OpsActor | null {
  const row = getStaffAuthRow(email);
  if (!row || row.active !== 1) return null;
  if (!verifyOpsPasswordHash(password, row.password_hash, row.password_salt)) {
    return null;
  }
  const staff = mapStaff(row);
  markOpsStaffLastLogin(staff.id);
  return staffToActor(staff);
}

export function markOpsStaffLastLogin(staffId: number): void {
  if (!tableReady() || !Number.isInteger(staffId) || staffId < 1) return;
  getDb()
    .prepare("UPDATE ops_staff SET last_login_at = ? WHERE id = ?")
    .run(new Date().toISOString(), staffId);
}

export function hydrateOpsActor(actor: OpsActor): OpsActor | null {
  const staff = getOpsStaffByEmail(actor.email);
  if (!staff) return actor;
  if (!staff.active) return null;
  return staffToActor(staff);
}
