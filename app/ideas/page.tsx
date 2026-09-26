import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
} from "@/lib/seo";
import { metadataForPath } from "@/lib/page-seo";
import { IDEA_THEMES, ideaThemePath } from "@/lib/seo-themes";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/ideas");
}

export default function IdeasIndexPage() {
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "ไอเดียชุดของขวัญ", path: "/ideas" },
  ]);
  const listLd = buildItemListJsonLd(
    IDEA_THEMES.map((theme) => ({
      name: theme.headline,
      path: ideaThemePath(theme.slug),
    })),
  );

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={listLd} />
      <div className="mx-auto max-w-content px-page py-12 sm:py-16">
        <Breadcrumbs items={[{ label: "ไอเดียชุดของขวัญ" }]} />
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-forest sm:text-4xl">
            ไอเดียชุดของขวัญองค์กร
          </h1>
          <p className="mt-3 text-ink/75">
            เลือกธีมธรรมชาติ วัฒนธรรม ท่องเที่ยว หรือสุขภาพ แล้วสกรีนโลโก้ได้
            ทุกชุดสั่งผลิตตามออเดอร์จากจีน ไม่ใช่ของพร้อมส่ง
          </p>
        </div>

        <ul className="mt-10 grid gap-8 sm:grid-cols-2">
          {IDEA_THEMES.map((theme) => (
            <li key={theme.slug}>
              <Link href={ideaThemePath(theme.slug)} className="group block">
                <div className="media-frame media-frame--wide rounded-2xl">
                  <Image
                    src={theme.heroImage}
                    alt={theme.headline}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width:768px) 100vw, 50vw"
                  />
                </div>
                <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brass">
                  {theme.name}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-forest group-hover:text-brass">
                  {theme.headline}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink/70">{theme.lede}</p>
                <p className="mt-3 text-sm font-medium text-brass">อ่านไอเดียธีมนี้ →</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
