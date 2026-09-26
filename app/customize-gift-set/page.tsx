import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductConfiguratorStub } from "@/components/ProductConfiguratorStub";
import { QuoteForm } from "@/components/QuoteForm";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import { RFQ_NO_PAYMENT } from "@/lib/ux-copy";
import { metadataForPath } from "@/lib/page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/customize-gift-set");
}

const ELEMENTS = [
  {
    title: "สินค้าในชุด",
    body: "เลือกไอเท็มหลักและของแถมให้ตรงกลุ่มผู้รับและงบประมาณต่อเซ็ต",
  },
  {
    title: "บรรจุภัณฑ์",
    body: "Rigid Box, กล่องลูกฟูก, สีพิมพ์ และวัสดุบุภายในตามภาพลักษณ์แบรนด์",
  },
  {
    title: "อัตลักษณ์แบรนด์",
    body: "สกรีน ปัก เลเซอร์ หรือพิมพ์ UV บนสินค้าและกล่อง",
  },
  {
    title: "การแพ็กและจัดส่ง",
    body: "แพ็กแบบรวมศูนย์หรือแยกชุด พร้อมกำหนดการส่งตามแคมเปญ",
  },
] as const;

const WORKFLOW = [
  "รับโจทย์และงบประมาณ",
  "คัดเลือกสินค้าและแนวเซ็ต",
  "ทำแบบจำลองและยืนยันสเปค",
  "อนุมัติตัวอย่างก่อนผลิต",
  "ตรวจคุณภาพ แพ็ก และจัดส่ง",
] as const;

export default function CustomizeGiftSetPage() {
  const enableP2QuoteTools = isP2QuoteToolsEnabled();

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "ออกแบบเซ็ตเอง" }]} />
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          เซ็ตตามโจทย์องค์กร
        </p>
        <h1 className="mt-3 text-3xl font-bold text-forest sm:text-4xl">
          ออกแบบเซ็ตของขวัญองค์กรเอง
        </h1>
        <p className="mt-4 text-ink/80 leading-relaxed">
          ยังไม่ต้องเลือกรายการสินค้าให้ครบ — แจ้งโจทย์ งบประมาณ และกลุ่มผู้รับ
          แล้วเราจะช่วยประกอบเซ็ตตั้งแต่สินค้าจนถึงบรรจุภัณฑ์
        </p>
        {!enableP2QuoteTools ? (
          <p className="mt-4 text-sm text-ink/55">
            ตอนนี้ส่งรายละเอียดผ่านแบบฟอร์มด้านล่างได้เลย
            (ตัวปรับแต่งแบบละเอียดบนหน้าเว็บจะเปิดใช้ในภายหลัง)
          </p>
        ) : null}
        <p className="mt-4 text-sm text-ink/60">{RFQ_NO_PAYMENT}</p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-forest">องค์ประกอบที่ปรับแต่งได้</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {ELEMENTS.map((item) => (
            <li key={item.title} className="rounded-2xl border border-forest/10 p-6">
              <h3 className="text-lg font-semibold text-forest">{item.title}</h3>
              <p className="mt-2 text-sm text-ink/75">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-3xl bg-forest px-6 py-10 text-paper sm:px-10">
        <h2 className="text-2xl font-bold">ขั้นตอนทำงาน 5 ขั้น</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {WORKFLOW.map((step, index) => (
            <li key={step} className="rounded-2xl border border-paper/15 p-4">
              <p className="text-sm font-semibold text-brass-soft">{index + 1}</p>
              <p className="mt-2 text-sm font-medium">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {enableP2QuoteTools ? (
        <section className="mt-14">
          <ProductConfiguratorStub />
        </section>
      ) : null}

      <section className="mt-14">
        <QuoteForm heading="ส่งโจทย์เพื่อออกแบบเซ็ต" />
      </section>
    </div>
  );
}
