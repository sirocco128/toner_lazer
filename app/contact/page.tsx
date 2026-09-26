import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactInquiryForm } from "@/components/ContactInquiryForm";
import { QuoteForm } from "@/components/QuoteForm";
import { COMPANY, formatOpeningHoursDisplay, formatRegisteredAddress } from "@/lib/company";
import { metadataForPath } from "@/lib/page-seo";
import { getPublicContact } from "@/lib/public-contact";
import { site } from "@/lib/site";
import { CONTACT_INQUIRY_INTRO } from "@/lib/ux-copy";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/contact");
}

type ContactPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function tabClass(active: boolean) {
  return `inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold sm:flex-none sm:px-5 ${
    active
      ? "bg-forest text-paper"
      : "border border-forest/20 text-forest hover:border-forest/40"
  }`;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const note = firstParam(params.note);
  const productInterest = firstParam(params.productInterest) || firstParam(params.product);
  const productSlug = firstParam(params.productSlug) || firstParam(params.slug);
  const quantity = firstParam(params.quantity);
  const basketId = firstParam(params.basketId);
  const hasQuotePrefill = Boolean(note || productInterest || productSlug || quantity || basketId);
  const intent = firstParam(params.intent);
  const isMessage = intent === "message" && !hasQuotePrefill;
  const contact = getPublicContact(site);
  const address = formatRegisteredAddress({
    streetAddress: site.localBusiness.streetAddress,
    locality: site.localBusiness.locality,
    region: site.localBusiness.region,
    postalCode: site.localBusiness.postalCode,
  });
  const hasDirectChannel = contact.showPhone || contact.showEmail || contact.showLine;

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <Breadcrumbs items={[{ label: isMessage ? "ติดต่อเรา" : "ติดต่อ / ขอใบเสนอราคา" }]} />
      <h1 className="text-3xl font-bold text-forest sm:text-4xl">
        {isMessage ? "ติดต่อ สอบถาม หรือร้องเรียน" : "ติดต่อ / ขอใบเสนอราคา"}
      </h1>
      <p className="mt-4 max-w-2xl text-ink/80 leading-relaxed">
        {isMessage
          ? `${COMPANY.brandName} — ${CONTACT_INQUIRY_INTRO}`
          : `${COMPANY.brandName} — กรอกชื่อ บริษัท ช่องทางติดต่อ และจำนวนโดยประมาณ ทีมขายติดต่อกลับในเวลาทำการ หน้านี้ไม่ใช่การสั่งซื้อ และไม่มีการชำระเงิน หลังอนุมัติราคาแล้วจึงชำระมัดจำหรือเต็มจำนวนผ่านพร้อมเพย์ที่หน้าออเดอร์ ใบกำกับภาษีออกในนาม ${COMPANY.legalName}`}
      </p>

      <div
        className="mt-6 flex w-full gap-2 sm:w-auto"
        role="tablist"
        aria-label="เลือกประเภทข้อความ"
      >
        <Link
          href="/contact"
          role="tab"
          aria-selected={!isMessage}
          className={tabClass(!isMessage)}
        >
          ขอใบเสนอราคา
        </Link>
        <Link
          href="/contact?intent=message"
          role="tab"
          aria-selected={isMessage}
          className={tabClass(isMessage)}
        >
          ติดต่อ / สอบถาม / ร้องเรียน
        </Link>
      </div>

      {basketId ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-forest"
        >
          ตรวจพบตะกร้าใบเสนอราคา (<span className="font-mono text-xs">{basketId}</span>) —
          รายละเอียดถูกเติมในฟอร์มแล้ว กรุณาตรวจสอบก่อนส่ง
        </p>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section>
          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-semibold text-forest">นิติบุคคล</dt>
              <dd className="mt-1 text-ink/80">{site.legalName}</dd>
            </div>
            {site.taxId ? (
              <div>
                <dt className="font-semibold text-forest">เลขประจำตัวผู้เสียภาษี</dt>
                <dd className="mt-1 font-mono text-ink/80">{site.taxId}</dd>
              </div>
            ) : null}
            {contact.showPhone ? (
              <div>
                <dt className="font-semibold text-forest">โทรศัพท์</dt>
                <dd className="mt-1">
                  <a href={site.phoneHref} className="text-ink/80 hover:text-brass">
                    {site.phoneDisplay}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact.showEmail ? (
              <div>
                <dt className="font-semibold text-forest">อีเมล</dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${site.email}`}
                    className="text-ink/80 hover:text-brass"
                  >
                    {site.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact.showLine ? (
              <div>
                <dt className="font-semibold text-forest">แชทไลน์</dt>
                <dd className="mt-1">
                  <a
                    href={site.lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink/80 hover:text-brass"
                  >
                    {site.lineId}
                  </a>
                </dd>
              </div>
            ) : null}
            {address ? (
              <div>
                <dt className="font-semibold text-forest">ที่อยู่</dt>
                <dd className="mt-1 text-ink/80">{address}</dd>
              </div>
            ) : null}
            {site.localBusiness.openingHours ? (
              <div>
                <dt className="font-semibold text-forest">เวลาทำการ</dt>
                <dd className="mt-1 text-ink/80">
                  {formatOpeningHoursDisplay(site.localBusiness.openingHours)}
                </dd>
              </div>
            ) : null}
          </dl>
          {!hasDirectChannel ? (
            <p className="mt-6 rounded-xl border border-forest/10 bg-forest-mist/40 px-4 py-3 text-sm text-ink/75">
              ขณะนี้รับเรื่องผ่านแบบฟอร์มทางขวาเท่านั้น ทีมงานจะติดต่อกลับตามอีเมลหรือเบอร์ที่ให้ไว้
            </p>
          ) : null}
        </section>

        {isMessage ? (
          <ContactInquiryForm />
        ) : (
          <QuoteForm
            heading="แบบฟอร์มขอใบเสนอราคา"
            productInterest={productInterest}
            productSlug={productSlug}
            initialDetail={note}
            initialQuantity={quantity}
            basketId={basketId}
          />
        )}
      </div>
    </div>
  );
}
