/**
 * Apply parsed CSV rows onto the local customer CRM.
 */

import {
  createCustomer,
  getCustomerByEmail,
  getCustomerByTaxId,
  updateCustomer,
} from "@/lib/customer-repository";
import type { ParsedCustomerCsvRow } from "@/lib/customer-csv";
import { parseCustomerCsv, toCreateCustomerParams } from "@/lib/customer-csv";

export type CustomerImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  preview: ParsedCustomerCsvRow[];
};

export function importCustomersFromCsv(
  text: string,
  options: { dryRun?: boolean } = {},
): CustomerImportResult {
  const parsed = parseCustomerCsv(text);
  const errors = [...parsed.errors];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (options.dryRun) {
    return {
      created: parsed.rows.length,
      updated: 0,
      skipped: 0,
      errors,
      preview: parsed.rows.slice(0, 20),
    };
  }

  for (const row of parsed.rows) {
    try {
      const existing =
        (row.taxId ? getCustomerByTaxId(row.taxId) : null) ||
        getCustomerByEmail(row.email);
      if (existing) {
        updateCustomer({
          id: existing.id,
          company: row.company,
          phone: row.phone ?? existing.phone,
          contactName: row.contactName ?? existing.contactName,
          taxId: row.taxId ?? existing.taxId,
          billingAddress: row.billingAddress ?? existing.billingAddress,
          billingBranch: row.billingBranch,
          lineId: row.lineId ?? existing.lineId,
          customerType: row.customerType,
          source: existing.source === "web_rfq" ? existing.source : "import",
          notes: row.notes ?? existing.notes,
        });
        updated += 1;
        continue;
      }
      createCustomer(toCreateCustomerParams(row));
      created += 1;
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : "import_failed";
      errors.push(`${row.company}: ${message}`);
    }
  }

  return { created, updated, skipped, errors, preview: parsed.rows.slice(0, 20) };
}
