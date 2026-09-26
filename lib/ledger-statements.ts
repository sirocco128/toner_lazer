import { listLedgerAccounts, trialBalance, type TrialBalanceRow } from "@/lib/ledger-repository";
import type { LedgerAccountType } from "@/lib/ledger-types";
import { roundSatang } from "@/lib/th-billing";

export type StatementLine = {
  accountCode: string;
  nameTh: string;
  amount: number;
};

export type IncomeStatement = {
  fromDate: string;
  toDate: string;
  revenue: number;
  otherIncome: number;
  cogs: number;
  grossProfit: number;
  sellingExpense: number;
  adminExpense: number;
  contribution: number;
  netIncome: number;
  revenueLines: StatementLine[];
  cogsLines: StatementLine[];
  expenseLines: StatementLine[];
};

export type BalanceSheet = {
  asOf: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  assetTotal: number;
  liabilityTotal: number;
  equityTotal: number;
  liabilityAndEquity: number;
  balanced: boolean;
};

export type CashFlowStatement = {
  fromDate: string;
  toDate: string;
  receipts: number;
  payments: number;
  netChange: number;
  closingCash: number;
};

function netOf(row: TrialBalanceRow): number {
  return roundSatang(row.netDebit - row.netCredit);
}

function linesOf(
  rows: TrialBalanceRow[],
  types: LedgerAccountType[],
  creditNature: boolean,
): StatementLine[] {
  return rows
    .filter((row) => types.includes(row.type))
    .map((row) => {
      const signed = netOf(row);
      const amount = creditNature ? -signed : signed;
      return {
        accountCode: row.accountCode,
        nameTh: row.nameTh,
        amount: roundSatang(amount),
      };
    })
    .filter((line) => Math.abs(line.amount) > 0.009);
}

function sumLines(lines: StatementLine[]): number {
  return roundSatang(lines.reduce((sum, line) => sum + line.amount, 0));
}

export function buildIncomeStatement(params: {
  fromDate: string;
  toDate: string;
}): IncomeStatement {
  const rows = trialBalance({ fromDate: params.fromDate, toDate: params.toDate });
  const revenueLines = linesOf(rows, ["revenue"], true);
  const cogsLines = linesOf(rows, ["cogs"], false);
  const expenseLines = linesOf(rows, ["expense"], false);
  const sellingCodes = new Set(["5400", "5500"]);
  const sellingExpense = roundSatang(
    expenseLines
      .filter((line) => sellingCodes.has(line.accountCode))
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const adminExpense = roundSatang(
    expenseLines
      .filter((line) => !sellingCodes.has(line.accountCode))
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const revenue = roundSatang(
    revenueLines
      .filter((line) => line.accountCode === "4100")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const otherIncome = roundSatang(
    revenueLines
      .filter((line) => line.accountCode !== "4100")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const cogs = sumLines(cogsLines);
  const grossProfit = roundSatang(revenue - cogs);
  const contribution = roundSatang(grossProfit - sellingExpense);
  const netIncome = roundSatang(contribution + otherIncome - adminExpense);
  return {
    fromDate: params.fromDate,
    toDate: params.toDate,
    revenue,
    otherIncome,
    cogs,
    grossProfit,
    sellingExpense,
    adminExpense,
    contribution,
    netIncome,
    revenueLines,
    cogsLines,
    expenseLines,
  };
}

export function buildBalanceSheet(params: { asOf: string }): BalanceSheet {
  const rows = trialBalance({ toDate: params.asOf });
  const income = buildIncomeStatement({ fromDate: "1970-01-01", toDate: params.asOf });
  const assets = linesOf(rows, ["asset"], false);
  const liabilities = linesOf(rows, ["liability"], true);
  const postedEquity = linesOf(rows, ["equity"], true);
  const equity: StatementLine[] = [
    ...postedEquity,
    {
      accountCode: "3999",
      nameTh: "กำไร (ขาดทุน) สุทธิสะสมจากสมุด",
      amount: income.netIncome,
    },
  ].filter((line) => Math.abs(line.amount) > 0.009);
  const assetTotal = sumLines(assets);
  const liabilityTotal = sumLines(liabilities);
  const equityTotal = sumLines(equity);
  const liabilityAndEquity = roundSatang(liabilityTotal + equityTotal);
  return {
    asOf: params.asOf,
    assets,
    liabilities,
    equity,
    assetTotal,
    liabilityTotal,
    equityTotal,
    liabilityAndEquity,
    balanced: Math.abs(assetTotal - liabilityAndEquity) < 0.02,
  };
}

export function buildCashFlow(params: {
  fromDate: string;
  toDate: string;
}): CashFlowStatement {
  const period = trialBalance({ fromDate: params.fromDate, toDate: params.toDate });
  const closing = trialBalance({ toDate: params.toDate });
  const cashPeriod = period.find((row) => row.accountCode === "1110");
  const cashClose = closing.find((row) => row.accountCode === "1110");
  const receipts = roundSatang(cashPeriod?.debit ?? 0);
  const payments = roundSatang(cashPeriod?.credit ?? 0);
  return {
    fromDate: params.fromDate,
    toDate: params.toDate,
    receipts,
    payments,
    netChange: roundSatang(receipts - payments),
    closingCash: roundSatang(cashClose?.netDebit ?? 0),
  };
}

export function statementToCsv(
  title: string,
  lines: StatementLine[],
  totalLabel: string,
  total: number,
): string {
  const rows = ["รายการ,รหัส,จำนวน"];
  rows.push(`${title},,`);
  for (const line of lines) {
    rows.push(`${line.nameTh},${line.accountCode},${line.amount.toFixed(2)}`);
  }
  rows.push(`${totalLabel},,${total.toFixed(2)}`);
  return `${rows.join("\n")}\n`;
}

export function listPostableAccounts() {
  return listLedgerAccounts({ postableOnly: true });
}
