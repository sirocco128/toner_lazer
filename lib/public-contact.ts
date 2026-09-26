import {
  isPlaceholderEmail,
  isPlaceholderLine,
  isPlaceholderPhone,
} from "@/lib/company";
import type { SiteConfig } from "@/lib/site";

export type PublicContact = {
  showPhone: boolean;
  showEmail: boolean;
  showLine: boolean;
};

export function getPublicContact(site: SiteConfig): PublicContact {
  return {
    showPhone: !isPlaceholderPhone(site.phoneDisplay, site.phoneHref),
    showEmail: !isPlaceholderEmail(site.email),
    showLine: !isPlaceholderLine(site.lineId, site.lineUrl),
  };
}
