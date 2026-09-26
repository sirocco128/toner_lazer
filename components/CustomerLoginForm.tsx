"use client";

import { useActionState, useState } from "react";
import { customerLoginAction } from "@/app/actions/customer-auth";
import { LoginRoster } from "@/components/LoginRoster";
import { DEMO_CUSTOMER_PASSWORD } from "@/lib/demo-logins";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLoginAction, null);
  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("");

  return (
    <div className="rounded-2xl border border-forest/15 bg-paper p-5">
      <h2 className="text-lg font-semibold text-forest">เข้าสู่ระบบลูกค้า</h2>
      <p className="mt-1 text-sm text-ink/70">
        กดปุ่มรายชื่อและรหัสผ่านเพื่อเลือกบัญชีแล้วใส่ในฟอร์ม
      </p>
      <form action={action} className="mt-5 space-y-4" aria-busy={pending}>
        <div className="block text-sm">
          <label htmlFor="customer-login-username" className="font-medium text-forest">
            ชื่อผู้ใช้
          </label>
          <input
            id="customer-login-username"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
          />
        </div>
        <label className="block text-sm">
          <span className="font-medium text-forest">รหัสผ่าน</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2"
          />
        </label>
        <LoginRoster
          highlight="customer"
          sides="customer"
          onPick={(name, pass) => {
            if (pass !== DEMO_CUSTOMER_PASSWORD) return;
            setUsername(name);
            setPassword(pass);
          }}
        />
        {state?.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-forest px-4 py-2.5 text-sm font-medium text-paper hover:bg-forest-light disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
