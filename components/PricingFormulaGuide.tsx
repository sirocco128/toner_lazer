import type { ReactNode } from "react";
import type { ForcedMinQtyProfile } from "@/lib/alibaba/forced-min-qty";
import { cn } from "@/lib/utils";

const SOF_ROWS = [
  { qty: "n ≤ 20", sof: "1.50" },
  { qty: "n ≤ 50", sof: "1.40" },
  { qty: "n ≤ 100", sof: "1.30" },
  { qty: "n ≤ 300", sof: "1.20" },
  { qty: "301 ≤ n ≤ 499", sof: "1.10" },
  { qty: "n ≥ 500", sof: "1.00" },
] as const;

const MARKUP_ROWS = [
  { cost: "c ≤ 250", markup: "3.00" },
  { cost: "c ≤ 350", markup: "2.73" },
  { cost: "c ≤ 500", markup: "2.62" },
  { cost: "c ≤ 650", markup: "2.45" },
  { cost: "c > 650", markup: "2.14" },
] as const;

function Eq({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-forest/[0.04] px-3 py-2 font-mono text-sm text-forest">
      {children}
    </p>
  );
}

export function PricingFormulaGuide({
  profile = "standard",
  className,
}: {
  profile?: ForcedMinQtyProfile;
  className?: string;
}) {
  if (profile === "corporate") {
    return (
      <section
        className={cn(
          "rounded-xl border border-forest/15 bg-paper p-4 text-sm",
          className,
        )}
      >
        <h2 className="text-base font-semibold text-forest">
          สูตรองค์กร (corporate)
        </h2>
        <Eq>
          ขาย = ปัด(ลงเรือ × SOF(n) × 1.47)
        </Eq>
        <p className="mt-2 text-xs text-ink/65">
          พื้นกำไรทั้งออเดอร์ 20,000 บาท · SOF ใช้ตารางเดียวกับทั่วไป
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-forest/15 bg-paper p-4 text-sm",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-forest">
        สูตรราคาแบบสมการ (โปรไฟล์ standard)
      </h2>
      <p className="mt-1 text-xs text-ink/60">
        ใช้สูตรเดียวกับราคาบนเว็บ — ใส่รหัสสินค้าด้านบน แล้วดูรีเช็คทีละจำนวนด้านล่าง
      </p>

      <ol className="mt-4 space-y-3">
        <li>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            1) ต้นทุนโรงงานเป็นบาท
          </p>
          <Eq>บาทโรงงาน = โรงงาน CNY × FX</Eq>
        </li>
        <li>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            2) ต้นทุนลงเรือต่อชิ้น
          </p>
          <Eq>
            ลงเรือ = บาทโรงงาน + ขนส่งในจีน + รถ/เรือจีน→ไทย
          </Eq>
        </li>
        <li>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            3) ราคาขายต่อชิ้น
          </p>
          <Eq>ขาย = ปัด(ลงเรือ × SOF(n) × markup(c))</Eq>
          <p className="mt-1 text-xs text-ink/55">
            n = จำนวนสั่ง · c = ลงเรือ (บาท/ชิ้น) · ปัด = Math.round เป็นบาทเต็ม
          </p>
        </li>
        <li>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            4) กำไรทั้งออเดอร์
          </p>
          <Eq>กำไรชุด = (ขาย − ลงเรือ) × n</Eq>
          <p className="mt-1 text-xs text-ink/55">
            พื้น: n &lt; 500 → 5,000 บาท · n ≥ 500 → 3,000 บาท (ต่ำกว่าพื้นจะดัน
            MOQ)
          </p>
        </li>
      </ol>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-forest">SOF ตามจำนวน n</p>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {SOF_ROWS.map((row) => (
                <tr key={row.qty} className="border-b border-forest/10">
                  <td className="py-1 text-ink/70">{row.qty}</td>
                  <td className="py-1 text-right font-mono tabular-nums">
                    {row.sof}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="text-xs font-semibold text-forest">
            markup ตามต้นทุนลงเรือ c
          </p>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {MARKUP_ROWS.map((row) => (
                <tr key={row.cost} className="border-b border-forest/10">
                  <td className="py-1 text-ink/70">{row.cost}</td>
                  <td className="py-1 text-right font-mono tabular-nums">
                    {row.markup}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Eq>
        รวม: ขาย = ปัด((CNY×FX + ขนส่งจีน + จีน→ไทย) × SOF(n) × markup(c))
      </Eq>
      <p className="mt-2 text-xs text-ink/55">
        priceMax ≈ ราคา/ชิ้นตอนจำนวนน้อย · priceMin ≈ ราคา/ชิ้นตอนจำนวนเยอะ
      </p>
    </section>
  );
}
