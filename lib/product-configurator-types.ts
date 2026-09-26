/**
 * P2 Product Configurator dimensions (runbook §35).
 * All fields optional — stub form does not invent prices or lead times.
 */

export type ProductConfiguration = {
  productSlug?: string;
  productName?: string;
  variant?: string;
  color?: string;
  material?: string;
  capacityOrSize?: string;
  decorationMethod?: string;
  decorationPosition?: string;
  numberOfPrintColors?: number;
  logoSize?: string;
  packagingType?: string;
  insertCard?: boolean;
  ribbonOrSleeve?: boolean;
  individualName?: boolean;
  quantity?: number;
  deliveryDate?: string;
  deliveryLocations?: string;
  notes?: string;
};

export type ProductConfigurationSummary = {
  configuration: ProductConfiguration;
  humanReadable: string[];
  missingFlags: string[];
};
