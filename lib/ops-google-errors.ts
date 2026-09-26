export type GoogleOAuthError =
  | "google_not_configured"
  | "google_denied"
  | "google_invalid"
  | "google_unverified"
  | "google_not_staff"
  | "google_failed";

export const GOOGLE_LOGIN_ERROR_MESSAGES: Record<GoogleOAuthError, string> = {
  google_not_configured:
    "ยังไม่ได้ตั้งค่า Google Login — ใส่ GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ใน .env.local แล้วรีสตาร์ท",
  google_denied: "ยกเลิกการเข้าสู่ระบบด้วย Google",
  google_invalid:
    "เซสชัน Google หลุด — เปิดหน้าเข้าสู่ระบบที่ http://localhost:3000/ops/login แล้วกดเข้าด้วย Google อีกครั้ง (อย่าสลับกับ 127.0.0.1)",
  google_unverified: "บัญชี Google ยังไม่ได้ยืนยันอีเมล",
  google_not_staff:
    "อีเมลนี้ไม่ได้อยู่ในรายชื่อพนักงาน — ให้ผู้ดูแลเพิ่มที่เมนูผู้ใช้ก่อน",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ",
};

export function isGoogleLoginError(value: string): value is GoogleOAuthError {
  return value in GOOGLE_LOGIN_ERROR_MESSAGES;
}
