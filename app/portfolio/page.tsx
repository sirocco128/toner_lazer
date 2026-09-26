import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { getPortfolios } from "@/lib/strapi";
import { metadataForPath } from "@/lib/page-seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/portfolio");
}

export default async function PortfolioPage() {
  const portfolios = await getPortfolios();
  const isMock = (process.env.CMS_MODE || "mock") !== "strapi";

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "ผลงาน" }]} />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-forest sm:text-4xl">ผลงาน</h1>
        <p className="mt-3 text-ink/75">
          ตัวอย่างแนวทางผลิตของพรีเมียมสำหรับองค์กร เพื่อช่วยประเมินสไตล์และขอบเขตงาน
        </p>
      </div>

      {isMock ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-forest"
        >
          ข้อมูลผลงานด้านล่างเป็นตัวอย่างในโหมดสาธิต ยังไม่ใช่เคสลูกค้าจริงที่ได้รับอนุญาตเผยแพร่
        </p>
      ) : null}

      {portfolios.length === 0 ? (
        <EmptyState
          title="ยังไม่มีผลงานที่เผยแพร่"
          description="ผลงานจะแสดงเมื่อได้รับอนุญาตจากลูกค้าและผ่านการตรวจ Legal แล้ว ในระหว่างนี้ขอใบเสนอราคาเพื่อคุยรายละเอียดโปรเจกต์ได้เลย"
        />
      ) : (
        <ul className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((item) => (
            <li key={item.slug}>
              <Link href={`/portfolio/${item.slug}`} className="group block">
              <div className="media-frame media-frame--tile rounded-2xl">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width:768px) 100vw, 33vw"
                />
              </div>
              {item.industry ? (
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brass">
                  {item.industry}
                </p>
              ) : null}
              <h2 className="mt-2 text-xl font-semibold text-forest group-hover:underline">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-ink/60">ลูกค้า: {item.client}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink/75">{item.summary}</p>
              {item.services?.length ? (
                <p className="mt-3 text-xs text-ink/60">
                  บริการ: {item.services.join(" · ")}
                </p>
              ) : null}
              {item.quantity ? (
                <p className="mt-1 text-xs text-ink/60">จำนวน: {item.quantity} เซ็ต</p>
              ) : null}
              <p className="mt-3 text-sm font-medium text-forest">ดูรายละเอียด</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12">
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper"
        >
          ปรึกษาโปรเจกต์ของคุณ
        </Link>
      </div>
    </div>
  );
}
