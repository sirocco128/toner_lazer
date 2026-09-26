import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { demoCustomerPassword } from "@/lib/demo-logins";

const COOKIE = "customer_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type CustomerActor = {
  username: string;
};

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.CUSTOMER_SESSION_SECRET?.trim() ||
    "local-customer-session"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authenticateCustomer(
  username: string,
  password: string,
): CustomerActor | null {
  const name = username.trim().toLowerCase().replace(/@local$/i, "");
  if (name !== "customer") return null;
  const expected = demoCustomerPassword();
  if (!timingSafeEqualString(password, expected)) return null;
  return { username: "customer" };
}

export async function getCustomerSession(): Promise<CustomerActor | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  if (!timingSafeEqualString(sign(payload), mac)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      username?: string;
    };
    if (data.username !== "customer") return null;
    return { username: "customer" };
  } catch {
    return null;
  }
}

export async function setCustomerSession(actor: CustomerActor): Promise<void> {
  const payload = Buffer.from(JSON.stringify(actor), "utf8").toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
