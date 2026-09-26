/**
 * CMS source selection — mock, Strapi, or SmartGift/NextERP MySQL.
 */

import { isNexterpMysqlEnabled } from "@/lib/nexterp-mysql";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";

export type CmsMode = "mock" | "strapi" | "mysql";

export function getCmsMode(): CmsMode {
  const mode = (process.env.CMS_MODE || "mock").trim().toLowerCase();
  if (mode === "strapi") return "strapi";
  if (mode === "mysql" || mode === "nexterp" || mode === "smartgift") {
    return "mysql";
  }
  if (
    (isSmartgiftMysqlEnabled() || isNexterpMysqlEnabled()) &&
    (process.env.CMS_MODE || "").trim() === ""
  ) {
    return "mysql";
  }
  return "mock";
}

/** Token or explicit public-read — otherwise Strapi fetches must not run. */
export function isStrapiReadConfigured(): boolean {
  const token = (process.env.STRAPI_API_TOKEN || "").trim();
  const publicRead =
    (process.env.STRAPI_PUBLIC_READ || "").toLowerCase() === "true";
  return token.length > 0 || publicRead;
}

/** Articles / FAQs / portfolios: Strapi only when CMS_MODE=strapi, or mysql+token. */
export function shouldFetchStrapiEditorial(): boolean {
  const mode = getCmsMode();
  if (mode === "strapi") return true;
  if (mode === "mysql") return isStrapiReadConfigured();
  return false;
}
