"use client";

import { useActionState, useState } from "react";
import { opsLoginAction, type OpsActionResult } from "@/app/actions/ops";
import { LoginRoster } from "@/components/LoginRoster";
import { DEMO_ADMIN_PASSWORD } from "@/lib/demo-logins";
import {
  GOOGLE_LOGIN_ERROR_MESSAGES,
  isGoogleLoginError,
} from "@/lib/ops-google-errors";

const initial: OpsActionResult | null = null;

function GoogleMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function OpsLoginForm({ googleError }: { googleError?: string }) {
  const [state, action, pending] = useActionState(opsLoginAction, initial);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const oauthMessage =
    googleError && isGoogleLoginError(googleError)
      ? GOOGLE_LOGIN_ERROR_MESSAGES[googleError]
      : googleError
        ? GOOGLE_LOGIN_ERROR_MESSAGES.google_failed
        : null;
  const formError = state && !state.ok ? state.error : null;
  const alert = formError || oauthMessage;

  function fillAccount(name: string, pass: string) {
    if (pass !== DEMO_ADMIN_PASSWORD) return;
    setUsername(name);
    setPassword(pass);
  }

  return (
    <>
      <form action={action} className="mt-6 space-y-4" aria-busy={pending}>
        <div className="block text-sm">
          <label htmlFor="ops-login-username" className="font-medium text-forest">
            อีเมลหรือชื่อผู้ใช้
          </label>
          <input
            id="ops-login-username"
            type="text"
            name="email"
            autoComplete="username"
            placeholder="อีเมลพนักงาน หรือชื่อผู้ใช้"
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
        <LoginRoster highlight="admin" sides="admin" onPick={fillAccount} />
        {alert ? (
          <p className="text-sm text-red-700" role="alert">
            {alert}
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

      <div className="mt-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-forest/15" />
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink/45">
          หรือ
        </span>
        <span className="h-px flex-1 bg-forest/15" />
      </div>

      <a
        href="/api/ops/auth/google"
        className="mt-5 flex w-full items-center justify-center gap-2.5 rounded border border-forest/20 bg-paper px-4 py-2.5 text-sm font-medium text-forest hover:border-forest/40 hover:bg-forest-mist/50"
      >
        <GoogleMark />
        เข้าสู่ระบบด้วย Google
      </a>

      <p className="mt-4 text-xs text-ink/55">
        ใส่บัญชีพนักงานที่ได้รับสิทธิ์แล้วกดเข้าสู่ระบบ
        เข้าด้วย Google ได้เฉพาะอีเมลที่อยู่ในรายชื่อพนักงาน
        หน้านี้ไม่แสดงบนเมนูลูกค้า — บุ๊กมาร์ก{" "}
        <code className="rounded bg-forest/5 px-1">/ops/login</code> ไว้ใช้เอง
      </p>
    </>
  );
}
