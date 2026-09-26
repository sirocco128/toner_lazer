/**
 * Company-name / tax-id duplicate hints for ops merge.
 */

export function normalizeCompanyName(raw: string | null | undefined): string {
  return String(raw || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/บริษัท|จำกัด|มหาชน|สำนักงาน|ห้างหุ้นส่วน|จำกัดความรับผิด/g, " ")
    .replace(/\b(co|ltd|limited|inc|corp|company|public)\b\.?/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function namesLookAlike(a: string, b: string): boolean {
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);
  if (!left || !right) return false;
  return left === right;
}
