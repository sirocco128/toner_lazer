"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import { upsertLedgerAccount } from "@/lib/ledger-repository";
import { postManualJournal } from "@/lib/ledger-service";
import {
  isLedgerAccountType,
  type JournalLineInput,
  type LedgerAccountType,
} from "@/lib/ledger-types";

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

function money(form: FormData, key: string): number {
  const raw = String(form.get(key) || "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const ERRORS: Record<string, string> = {
  unbalanced_journal: "เดบิตกับเครดิตไม่เท่ากัน",
  unknown_account: "รหัสบัญชีไม่ถูกต้องหรือลงรายการไม่ได้",
  memo_required: "กรุณาระบุคำอธิบาย",
  lines_required: "ต้องมีอย่างน้อยสองบรรทัด",
  code_required: "กรุณาระบุรหัสบัญชี",
  name_required: "กรุณาระบุชื่อบัญชี",
  invalid_type: "ประเภทบัญชีไม่ถูกต้อง",
};

export async function postManualJournalAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("finance.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ลงบัญชี" };
  const meta = await opsAuditRequestMeta();
  const memo = text(formData, "memo");
  const entryDate = text(formData, "entryDate");
  if (!memo) return { ok: false, error: ERRORS.memo_required };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { ok: false, error: "กรุณาระบุวันที่" };
  }
  const lines: JournalLineInput[] = [];
  for (let i = 0; i < 8; i += 1) {
    const accountCode = text(formData, `account_${i}`);
    const debit = money(formData, `debit_${i}`);
    const credit = money(formData, `credit_${i}`);
    if (!accountCode && debit <= 0 && credit <= 0) continue;
    if (!accountCode) return { ok: false, error: ERRORS.code_required };
    lines.push({
      accountCode,
      debit,
      credit,
      memo: text(formData, `line_memo_${i}`) || null,
    });
  }
  if (lines.length < 2) return { ok: false, error: ERRORS.lines_required };
  let entryId = "";
  try {
    entryId = postManualJournal({
      memo,
      entryDate,
      lines,
      actor: actor.email,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { ok: false, error: ERRORS[code] || "ลงบัญชีไม่สำเร็จ" };
  }
  writeOpsAudit({
    actor,
    action: "journal.manual",
    status: "ok",
    resourceType: "journal",
    resourceId: entryId,
    detail: { memo, entryDate, lines: lines.length },
    ...meta,
  });
  revalidatePath("/ops/finance");
  revalidatePath("/ops/finance/journals");
  revalidatePath("/ops/finance/ledger");
  revalidatePath("/ops/finance/trial-balance");
  revalidatePath("/ops/finance/balance-sheet");
  redirect(`/ops/finance/journals?ok=${encodeURIComponent(entryId)}`);
}

export async function upsertAccountAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("finance.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์แก้ผังบัญชี" };
  const meta = await opsAuditRequestMeta();
  const code = text(formData, "code");
  const nameTh = text(formData, "nameTh");
  const nameEn = text(formData, "nameEn") || nameTh;
  const typeRaw = text(formData, "type");
  if (!/^\d{4}$/.test(code)) return { ok: false, error: "รหัสบัญชีต้องเป็นตัวเลข 4 หลัก" };
  if (!nameTh) return { ok: false, error: ERRORS.name_required };
  if (!isLedgerAccountType(typeRaw)) return { ok: false, error: ERRORS.invalid_type };
  const type: LedgerAccountType = typeRaw;
  const creditNormal = type === "liability" || type === "equity" || type === "revenue";
  upsertLedgerAccount({
    code,
    nameTh,
    nameEn,
    type,
    sortOrder: Number(text(formData, "sortOrder") || code) || Number(code),
    normalBalance: creditNormal ? "credit" : "debit",
    isHeader: false,
    isPostable: true,
  });
  writeOpsAudit({
    actor,
    action: "coa.upsert",
    status: "ok",
    resourceType: "ledger_account",
    resourceId: code,
    detail: { nameTh, type },
    ...meta,
  });
  revalidatePath("/ops/finance/coa");
  return { ok: true };
}
