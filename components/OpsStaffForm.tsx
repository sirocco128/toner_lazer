"use client";

import { useActionState, useState } from "react";
import {
  createOpsStaffAction,
  updateOpsStaffAction,
  type OpsStaffActionResult,
} from "@/app/actions/ops-staff";
import {
  DEPARTMENT_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  OPS_ROLES,
  STAFF_DEPARTMENTS,
  type OpsPermission,
  type OpsRole,
  type StaffDepartment,
} from "@/lib/ops-roles";

const initial: OpsStaffActionResult | null = null;

type StaffFormValues = {
  id?: number;
  email: string;
  name: string;
  role: OpsRole;
  department: StaffDepartment | "";
  extraGrants: OpsPermission[];
  extraDenies: OpsPermission[];
  active: boolean;
};

export function OpsStaffForm({
  mode,
  staff,
}: {
  mode: "create" | "edit";
  staff?: StaffFormValues;
}) {
  const action = mode === "create" ? createOpsStaffAction : updateOpsStaffAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [role, setRole] = useState<OpsRole>(staff?.role ?? "sales");
  const baseline = ROLE_PERMISSIONS[role];

  return (
    <form action={formAction} className="mt-6 max-w-3xl space-y-5">
      {staff?.id ? <input type="hidden" name="id" value={staff.id} /> : null}

      <label className="block text-sm">
        <span className="font-medium text-forest">ชื่อพนักงาน</span>
        <input
          name="name"
          required
          defaultValue={staff?.name ?? ""}
          className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-forest">อีเมล / ชื่อเข้าใช้งาน</span>
        <input
          name="email"
          required
          defaultValue={staff?.email ?? ""}
          readOnly={mode === "edit"}
          autoComplete="off"
          className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2 read-only:bg-forest-mist/50"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-forest">บทบาท</span>
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as OpsRole)}
            className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
          >
            {OPS_ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-forest">แผนก</span>
          <select
            name="department"
            defaultValue={staff?.department ?? ""}
            className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
          >
            <option value="">ไม่ระบุ</option>
            {STAFF_DEPARTMENTS.map((item) => (
              <option key={item} value={item}>
                {DEPARTMENT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "edit" ? (
        <>
          <input type="hidden" name="active" value="0" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              value="1"
              defaultChecked={staff?.active !== false}
            />
            <span>เปิดให้เข้าใช้งาน</span>
          </label>
        </>
      ) : (
        <input type="hidden" name="active" value="1" />
      )}

      <label className="block text-sm">
        <span className="font-medium text-forest">
          {mode === "create" ? "รหัสผ่าน" : "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"}
        </span>
        <input
          type="password"
          name="password"
          required={mode === "create"}
          minLength={mode === "create" ? 12 : undefined}
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
        />
        <span className="mt-1 block text-xs text-ink/55">อย่างน้อย 12 ตัวอักษร</span>
      </label>

      <fieldset key={`grants-${role}`} className="rounded-xl border border-forest/15 p-4">
        <p className="mb-3 text-xs text-ink/60">
          บทบาทกำหนดชุดสิทธิ์พื้นฐานแล้ว เลือกเพิ่มเฉพาะงานที่ต้องการให้ทำได้มากกว่าบทบาท
        </p>
        {PERMISSION_GROUPS.map((group) => (
          <div key={`g-${group.title}`} className="mt-4 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              {group.title}
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.items.map((permission) => {
                const inRole = baseline.includes(permission);
                return (
                  <li key={`g-${permission}`}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="grant"
                        value={permission}
                        defaultChecked={staff?.extraGrants.includes(permission)}
                        disabled={inRole}
                      />
                      <span>
                        {PERMISSION_LABELS[permission]}
                        {inRole ? (
                          <span className="block text-xs text-ink/45">มีตามบทบาทอยู่แล้ว</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </fieldset>

      <fieldset className="rounded-xl border border-forest/15 p-4">
        <legend className="px-1 text-sm font-semibold text-forest">
          ห้ามใช้แม้บทบาทมี
        </legend>
        {PERMISSION_GROUPS.map((group) => (
          <div key={`d-${group.title}`} className="mt-4 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              {group.title}
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.items.map((permission) => (
                <li key={`d-${permission}`}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="deny"
                      value={permission}
                      defaultChecked={staff?.extraDenies.includes(permission)}
                    />
                    <span>{PERMISSION_LABELS[permission]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </fieldset>

      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-5 py-2.5 text-sm font-medium text-paper hover:bg-forest-light disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มพนักงาน" : "บันทึกสิทธิ์"}
      </button>
    </form>
  );
}
