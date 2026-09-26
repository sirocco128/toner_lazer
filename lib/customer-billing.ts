/**
 * Order billing defaults from the customer card (not quote ship-to province).
 */

import type { CustomerRecord } from "@/lib/customer-types";
import { isValidThaiTaxId } from "@/lib/th-billing";

export type OrderBillingDefaults = {
  billingName: string;
  billingTaxId: string;
  billingAddress: string;
  billingBranch: string;
};

export function buildOrderBillingDefaults(
  customer: CustomerRecord | null | undefined,
  fallbackCompany: string,
): OrderBillingDefaults {
  return {
    billingName: (customer?.billingName || customer?.company || fallbackCompany).trim(),
    billingTaxId: customer?.taxId || "",
    billingAddress: customer?.billingAddress || "",
    billingBranch: customer?.billingBranch || "สำนักงานใหญ่",
  };
}

export function isCustomerTaxReady(
  customer: Pick<
    CustomerRecord,
    "taxId" | "billingAddress" | "billingBranch"
  > | null,
): boolean {
  if (!customer) return false;
  return Boolean(
    isValidThaiTaxId(customer.taxId) &&
      customer.billingAddress?.trim() &&
      customer.billingBranch?.trim(),
  );
}
