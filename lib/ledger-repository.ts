import { getDb } from "@/lib/database";
import {
  bookTypeFromSourceKey,
  isJournalBookType,
  isLedgerAccountType,
  type JournalBookType,
  type JournalEntryRecord,
  type JournalLineInput,
  type JournalLineRecord,
  type LedgerAccount,
  type LedgerAccountType,
} from "@/lib/ledger-types";

type AccountRow = {
  code: string;
  name_th: string;
  name_en: string;
  type: string;
  sort_order: number;
  normal_balance?: string;
  is_header?: number;
  is_postable?: number;
};

type EntryRow = {
  id: number;
  entry_id: string;
  source_key: string;
  entry_date: string;
  memo: string;
  order_id: string | null;
  po_id: string | null;
  posted_by: string | null;
  created_at: string;
  book_type?: string;
};

type LineRow = {
  id: number;
  entry_id: string;
  line_no: number;
  account_code: string;
  debit: number;
  credit: number;
  memo: string | null;
};

function mapAccount(row: AccountRow): LedgerAccount {
  const type: LedgerAccountType = isLedgerAccountType(row.type) ? row.type : "asset";
  const creditNormal =
    row.normal_balance === "credit" ||
    type === "liability" ||
    type === "equity" ||
    type === "revenue";
  return {
    code: row.code,
    nameTh: row.name_th,
    nameEn: row.name_en,
    type,
    sortOrder: row.sort_order,
    normalBalance: creditNormal ? "credit" : "debit",
    isHeader: Number(row.is_header) === 1,
    isPostable: row.is_postable == null ? true : Number(row.is_postable) === 1,
  };
}

function mapLine(row: LineRow): JournalLineRecord {
  return {
    id: row.id,
    entryId: row.entry_id,
    lineNo: row.line_no,
    accountCode: row.account_code,
    debit: row.debit,
    credit: row.credit,
    memo: row.memo,
  };
}

export function listLedgerAccounts(opts?: { postableOnly?: boolean }): LedgerAccount[] {
  const rows = getDb()
    .prepare(`SELECT * FROM ledger_accounts ORDER BY sort_order ASC, code ASC`)
    .all() as AccountRow[];
  const mapped = rows.map(mapAccount);
  if (opts?.postableOnly) return mapped.filter((row) => row.isPostable && !row.isHeader);
  return mapped;
}

export function getAccount(code: string): LedgerAccount | null {
  const row = getDb()
    .prepare(`SELECT * FROM ledger_accounts WHERE code = ?`)
    .get(code) as AccountRow | undefined;
  return row ? mapAccount(row) : null;
}

export function upsertLedgerAccount(account: LedgerAccount): void {
  getDb()
    .prepare(
      `INSERT INTO ledger_accounts (
         code, name_th, name_en, type, sort_order, normal_balance, is_header, is_postable
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name_th = excluded.name_th,
         name_en = excluded.name_en,
         type = excluded.type,
         sort_order = excluded.sort_order,
         normal_balance = excluded.normal_balance,
         is_header = excluded.is_header,
         is_postable = excluded.is_postable`,
    )
    .run(
      account.code,
      account.nameTh,
      account.nameEn,
      account.type,
      account.sortOrder,
      account.normalBalance,
      account.isHeader ? 1 : 0,
      account.isPostable ? 1 : 0,
    );
}

export function getJournalBySourceKey(sourceKey: string): JournalEntryRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM journal_entries WHERE source_key = ?`)
    .get(sourceKey) as EntryRow | undefined;
  if (!row) return null;
  return attachLines(row);
}

export function getJournalByEntryId(entryId: string): JournalEntryRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM journal_entries WHERE entry_id = ?`)
    .get(entryId) as EntryRow | undefined;
  if (!row) return null;
  return attachLines(row);
}

function attachLines(row: EntryRow): JournalEntryRecord {
  const lines = getDb()
    .prepare(
      `SELECT * FROM journal_lines WHERE entry_id = ? ORDER BY line_no ASC, id ASC`,
    )
    .all(row.entry_id) as LineRow[];
  const bookType: JournalBookType = isJournalBookType(row.book_type)
    ? row.book_type
    : bookTypeFromSourceKey(row.source_key);
  return {
    id: row.id,
    entryId: row.entry_id,
    sourceKey: row.source_key,
    entryDate: row.entry_date,
    memo: row.memo,
    orderId: row.order_id,
    poId: row.po_id,
    postedBy: row.posted_by,
    createdAt: row.created_at,
    bookType,
    lines: lines.map(mapLine),
  };
}

export function deleteJournalBySourceKey(sourceKey: string): void {
  const existing = getJournalBySourceKey(sourceKey);
  if (!existing) return;
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`DELETE FROM journal_lines WHERE entry_id = ?`).run(existing.entryId);
    db.prepare(`DELETE FROM journal_entries WHERE entry_id = ?`).run(existing.entryId);
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }
}

export function insertJournal(params: {
  entryId: string;
  sourceKey: string;
  entryDate: string;
  memo: string;
  orderId?: string | null;
  poId?: string | null;
  postedBy?: string | null;
  createdAt: string;
  bookType?: JournalBookType;
  lines: JournalLineInput[];
}): JournalEntryRecord {
  const bookType = params.bookType ?? bookTypeFromSourceKey(params.sourceKey);
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO journal_entries (
        entry_id, source_key, entry_date, memo, order_id, po_id, posted_by, created_at, book_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      params.entryId,
      params.sourceKey,
      params.entryDate,
      params.memo,
      params.orderId ?? null,
      params.poId ?? null,
      params.postedBy ?? null,
      params.createdAt,
      bookType,
    );
    const insertLine = db.prepare(
      `INSERT INTO journal_lines (entry_id, line_no, account_code, debit, credit, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    params.lines.forEach((line, index) => {
      insertLine.run(
        params.entryId,
        index + 1,
        line.accountCode,
        line.debit,
        line.credit,
        line.memo ?? null,
      );
    });
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }
  const row = getJournalByEntryId(params.entryId);
  if (!row) throw new Error("journal_insert_failed");
  return row;
}

export function listJournals(params?: {
  fromDate?: string;
  toDate?: string;
  orderId?: string;
  poId?: string;
  bookType?: JournalBookType;
  accountCode?: string;
  limit?: number;
}): JournalEntryRecord[] {
  const clauses: string[] = [];
  const binds: (string | number)[] = [];
  if (params?.fromDate) {
    clauses.push("e.entry_date >= ?");
    binds.push(params.fromDate);
  }
  if (params?.toDate) {
    clauses.push("e.entry_date <= ?");
    binds.push(params.toDate);
  }
  if (params?.orderId) {
    clauses.push("e.order_id = ?");
    binds.push(params.orderId);
  }
  if (params?.poId) {
    clauses.push("e.po_id = ?");
    binds.push(params.poId);
  }
  if (params?.bookType) {
    clauses.push("e.book_type = ?");
    binds.push(params.bookType);
  }
  if (params?.accountCode) {
    clauses.push(
      "EXISTS (SELECT 1 FROM journal_lines x WHERE x.entry_id = e.entry_id AND x.account_code = ?)",
    );
    binds.push(params.accountCode);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(500, Math.max(1, params?.limit ?? 200));
  const rows = getDb()
    .prepare(
      `SELECT e.* FROM journal_entries e ${where} ORDER BY e.entry_date DESC, e.id DESC LIMIT ?`,
    )
    .all(...binds, limit) as EntryRow[];
  return rows.map(attachLines);
}

export type TrialBalanceRow = {
  accountCode: string;
  nameTh: string;
  type: LedgerAccountType;
  normalBalance: "debit" | "credit";
  debit: number;
  credit: number;
  netDebit: number;
  netCredit: number;
};

export function trialBalance(params?: {
  fromDate?: string;
  toDate?: string;
  includeHeaders?: boolean;
}): TrialBalanceRow[] {
  const subClauses: string[] = [];
  const binds: (string | number)[] = [];
  if (params?.fromDate) {
    subClauses.push("e.entry_date >= ?");
    binds.push(params.fromDate);
  }
  if (params?.toDate) {
    subClauses.push("e.entry_date <= ?");
    binds.push(params.toDate);
  }
  const subWhere = subClauses.length ? `WHERE ${subClauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT a.code AS account_code, a.name_th AS name_th, a.type AS type,
              a.normal_balance AS normal_balance, a.is_header AS is_header,
              a.is_postable AS is_postable,
              COALESCE(x.debit, 0) AS debit,
              COALESCE(x.credit, 0) AS credit
       FROM ledger_accounts a
       LEFT JOIN (
         SELECT l.account_code AS account_code,
                SUM(l.debit) AS debit,
                SUM(l.credit) AS credit
         FROM journal_lines l
         JOIN journal_entries e ON e.entry_id = l.entry_id
         ${subWhere}
         GROUP BY l.account_code
       ) x ON x.account_code = a.code
       ORDER BY a.sort_order ASC, a.code ASC`,
    )
    .all(...binds) as Array<{
    account_code: string;
    name_th: string;
    type: string;
    normal_balance: string | null;
    is_header: number;
    is_postable: number;
    debit: number;
    credit: number;
  }>;
  return rows
    .filter((row) => params?.includeHeaders || Number(row.is_header) !== 1)
    .map((row) => {
      const type: LedgerAccountType = isLedgerAccountType(row.type) ? row.type : "asset";
      const normalBalance: "debit" | "credit" =
        row.normal_balance === "credit" ||
        type === "liability" ||
        type === "equity" ||
        type === "revenue"
          ? "credit"
          : "debit";
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      const signed = debit - credit;
      return {
        accountCode: row.account_code,
        nameTh: row.name_th,
        type,
        normalBalance,
        debit,
        credit,
        netDebit: signed > 0.0001 ? signed : 0,
        netCredit: signed < -0.0001 ? -signed : 0,
      };
    });
}

export type LedgerMove = {
  entryDate: string;
  entryId: string;
  memo: string;
  debit: number;
  credit: number;
  running: number;
};

export function generalLedger(params: {
  accountCode: string;
  fromDate?: string;
  toDate?: string;
}): { account: LedgerAccount | null; opening: number; moves: LedgerMove[]; closing: number } {
  const account = getAccount(params.accountCode);
  const binds: (string | number)[] = [params.accountCode];
  let openingSql = `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS opening
     FROM journal_lines l
     JOIN journal_entries e ON e.entry_id = l.entry_id
     WHERE l.account_code = ?`;
  if (params.fromDate) {
    openingSql += " AND e.entry_date < ?";
    binds.push(params.fromDate);
  } else {
    openingSql += " AND 1 = 0";
  }
  const openingRaw = Number(
    (getDb().prepare(openingSql).get(...binds) as { opening: number })?.opening,
  ) || 0;
  const creditNature = account?.normalBalance === "credit";
  const opening = creditNature ? -openingRaw : openingRaw;

  const moveClauses = ["l.account_code = ?"];
  const moveBinds: (string | number)[] = [params.accountCode];
  if (params.fromDate) {
    moveClauses.push("e.entry_date >= ?");
    moveBinds.push(params.fromDate);
  }
  if (params.toDate) {
    moveClauses.push("e.entry_date <= ?");
    moveBinds.push(params.toDate);
  }
  const lines = getDb()
    .prepare(
      `SELECT e.entry_date AS entry_date, e.entry_id AS entry_id, e.memo AS memo,
              l.debit AS debit, l.credit AS credit
       FROM journal_lines l
       JOIN journal_entries e ON e.entry_id = l.entry_id
       WHERE ${moveClauses.join(" AND ")}
       ORDER BY e.entry_date ASC, e.id ASC, l.line_no ASC`,
    )
    .all(...moveBinds) as Array<{
    entry_date: string;
    entry_id: string;
    memo: string;
    debit: number;
    credit: number;
  }>;
  let running = opening;
  const moves: LedgerMove[] = lines.map((line) => {
    const delta = creditNature ? line.credit - line.debit : line.debit - line.credit;
    running += delta;
    return {
      entryDate: line.entry_date,
      entryId: line.entry_id,
      memo: line.memo,
      debit: line.debit,
      credit: line.credit,
      running,
    };
  });
  return { account, opening, moves, closing: running };
}

export function sumAccountActivity(params: {
  accountCode: string;
  side: "debit" | "credit";
  orderId?: string;
  poId?: string;
  sourcePrefix?: string;
}): number {
  const clauses = ["l.account_code = ?"];
  const binds: (string | number)[] = [params.accountCode];
  if (params.orderId) {
    clauses.push("e.order_id = ?");
    binds.push(params.orderId);
  }
  if (params.poId) {
    clauses.push("e.po_id = ?");
    binds.push(params.poId);
  }
  if (params.sourcePrefix) {
    clauses.push("e.source_key LIKE ?");
    binds.push(`${params.sourcePrefix}%`);
  }
  const col = params.side === "debit" ? "l.debit" : "l.credit";
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(${col}), 0) AS amount
       FROM journal_lines l
       JOIN journal_entries e ON e.entry_id = l.entry_id
       WHERE ${clauses.join(" AND ")}`,
    )
    .get(...binds) as { amount: number };
  return Number(row?.amount) || 0;
}
