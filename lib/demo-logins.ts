/**
 * Local demo usernames shown on login screens.
 * Admin console and customer hub use the same roster layout.
 */

export const DEMO_ADMIN_PASSWORD = "Admin1234";
export const DEMO_CUSTOMER_PASSWORD = "Customer1234";

export type DemoLoginAccount = {
  username: string;
  label: string;
};

export const DEMO_ADMIN_ACCOUNTS: DemoLoginAccount[] = [
  { username: "superadmin", label: "ผู้ดูแลสูงสุด" },
  { username: "admin", label: "ผู้ดูแลระบบ" },
  { username: "sales-admin", label: "หัวหน้าเซลล์" },
  { username: "accountant-admin", label: "หัวหน้าบัญชี" },
  { username: "warehouse-admin", label: "หัวหน้าคลัง" },
  { username: "office-admin", label: "หัวหน้าสำนักงาน" },
  { username: "sales", label: "เซลล์" },
  { username: "accountant", label: "บัญชี" },
  { username: "viewer", label: "ดูอย่างเดียว" },
];

export const DEMO_CUSTOMER_ACCOUNTS: DemoLoginAccount[] = [
  { username: "customer", label: "ลูกค้า" },
];

export function demoAdminPassword(): string {
  const fromEnv = process.env.DEMO_ADMIN_PASSWORD?.trim();
  return fromEnv && fromEnv.length >= 8 ? fromEnv : DEMO_ADMIN_PASSWORD;
}

export function demoCustomerPassword(): string {
  const fromEnv = process.env.DEMO_CUSTOMER_PASSWORD?.trim();
  return fromEnv && fromEnv.length >= 8 ? fromEnv : DEMO_CUSTOMER_PASSWORD;
}
