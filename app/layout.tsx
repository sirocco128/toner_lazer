import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Thai, Sarabun } from "next/font/google";
import { Suspense } from "react";
import { AnalyticsConsentBanner } from "@/components/AnalyticsConsentBanner";
import { CaptureAttribution } from "@/components/CaptureAttribution";
import { BuyerAssistantWidget } from "@/components/BuyerAssistantWidget";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { FloatingQuoteDock } from "@/components/FloatingQuoteDock";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { MobileStickyCta } from "@/components/MobileStickyCta";
import { Navbar } from "@/components/Navbar";
import { ProductCompareTray } from "@/components/ProductCompareTray";
import { QuoteLaunchModal } from "@/components/QuoteLaunchModal";
import { SiteChrome } from "@/components/SiteChrome";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-presets";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import { buildMetadata } from "@/lib/metadata";
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
} from "@/lib/seo";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sarabun",
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = buildMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1c1c1c" },
    { media: "(prefers-color-scheme: dark)", color: "#14110f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organization = buildOrganizationJsonLd();
  const localBusiness = buildLocalBusinessJsonLd();
  const enableP2QuoteTools = isP2QuoteToolsEnabled();

  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${sarabun.variable} ${geist.variable} ${notoSansThai.variable}`}
    >
      <head>
        <script
          id="theme-boot"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className={`${sarabun.className} flex min-h-dvh flex-col overflow-x-clip`}>
        <ThemeProvider>
          <SmoothScroll />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brass focus:px-4 focus:py-2 focus:text-forest focus:shadow"
          >
            ข้ามไปยังเนื้อหาหลัก
          </a>
          <SiteChrome
            chrome={
              <>
                <EnvironmentBanner />
                <Navbar enableP2QuoteTools={enableP2QuoteTools} />
              </>
            }
          >
            <main id="main-content" className="min-w-0 flex-1 overflow-x-clip pb-mobile-cta">
              {children}
            </main>
          </SiteChrome>
          <SiteChrome chrome={<Footer />}>{null}</SiteChrome>
          <SiteChrome chrome={<MobileStickyCta />}>{null}</SiteChrome>
          <SiteChrome chrome={<FloatingQuoteDock enableP2QuoteTools={enableP2QuoteTools} />}>
            {null}
          </SiteChrome>
          <SiteChrome
            chrome={<BuyerAssistantWidget />}
          >
            {null}
          </SiteChrome>
          <SiteChrome chrome={<ProductCompareTray />}>{null}</SiteChrome>
          <SiteChrome chrome={<QuoteLaunchModal />}>{null}</SiteChrome>
          <SiteChrome chrome={<Toaster />}>{null}</SiteChrome>
          <JsonLd data={organization} />
          {localBusiness ? <JsonLd data={localBusiness} /> : null}
          <Suspense fallback={null}>
            <GoogleAnalytics />
          </Suspense>
          <SiteChrome chrome={<CaptureAttribution />}>{null}</SiteChrome>
          <SiteChrome chrome={<AnalyticsConsentBanner />}>{null}</SiteChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
