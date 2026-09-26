import { OpsCycleForm } from "@/components/OpsCycleForm";
import { saveFactoryAction } from "@/app/actions/ops-factories";
import {
  FACTORY_CURRENCY_LABELS,
  FACTORY_CURRENCIES,
  FACTORY_PLATFORM_LABELS,
  FACTORY_PLATFORMS,
} from "@/lib/factory-po-types";
import {
  FACTORY_ORIGIN_OPTIONS,
  FACTORY_STATUS_LABELS,
  FACTORY_STATUSES,
  type FactoryRecord,
} from "@/lib/factory-registry-types";

export function FactoryRegistryForm({ factory }: { factory?: FactoryRecord | null }) {
  return (
    <OpsCycleForm
      action={saveFactoryAction}
      submitLabel={factory ? "บันทึกทะเบียน" : "สร้างทะเบียนโรงงาน"}
    >
      {factory ? <input type="hidden" name="id" value={factory.id} /> : null}

      <section className="space-y-4">
        <h2 className="font-semibold text-forest">ตัวตนโรงงาน</h2>
        <p className="text-sm text-ink/65">
          รหัสนี้เป็นรหัสผู้ขาย เช่น FAC0001 — คนละชุดกับรหัสสินค้าโรงงาน nt0001
          และรหัสขาย A00001
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">รหัสโรงงาน</span>
            <input
              name="factoryCode"
              defaultValue={factory?.factoryCode || ""}
              placeholder="ว่างไว้ให้ออก FAC0001"
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">สถานะ</span>
            <select
              name="status"
              defaultValue={factory?.status || "active"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {FACTORY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ชื่อโรงงาน / ผู้ขาย</span>
            <input
              name="name"
              required
              defaultValue={factory?.name || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ชื่อจีน</span>
            <input
              name="nameCn"
              defaultValue={factory?.nameCn || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ชื่อจดทะเบียน</span>
            <input
              name="legalName"
              defaultValue={factory?.legalName || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-forest">ที่อยู่และช่องทาง</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">ช่องทาง</span>
            <select
              name="platform"
              defaultValue={factory?.platform || "other"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {FACTORY_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ต้นทางขนส่ง</span>
            <select
              name="origin"
              defaultValue={factory?.origin || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              <option value="">ยังไม่ระบุ</option>
              {FACTORY_ORIGIN_OPTIONS.map((origin) => (
                <option key={origin.value} value={origin.value}>
                  {origin.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">เมือง</span>
            <input
              name="city"
              defaultValue={factory?.city || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Shop ID / ร้าน 1688</span>
            <input
              name="shopId"
              defaultValue={factory?.shopId || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ที่อยู่</span>
            <textarea
              name="address"
              rows={2}
              defaultValue={factory?.address || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">ลิงก์ร้าน</span>
            <input
              name="shopUrl"
              defaultValue={factory?.shopUrl || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-forest">ผู้ติดต่อ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">ชื่อผู้ติดต่อ</span>
            <input
              name="contactName"
              defaultValue={factory?.contactName || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">WeChat</span>
            <input
              name="wechat"
              defaultValue={factory?.wechat || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">โทร</span>
            <input
              name="phone"
              defaultValue={factory?.phone || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">อีเมล</span>
            <input
              name="email"
              defaultValue={factory?.email || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-forest">เงื่อนไขสั่งและจ่าย</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">สกุลเงินเริ่มต้น</span>
            <select
              name="defaultCurrency"
              defaultValue={factory?.defaultCurrency || "CNY"}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            >
              {FACTORY_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {FACTORY_CURRENCY_LABELS[currency]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ระยะผลิต (วัน)</span>
            <input
              name="leadDays"
              type="number"
              min={1}
              defaultValue={factory?.leadDays ?? ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">เงื่อนไขชำระ / MOQ</span>
            <input
              name="paymentTerms"
              defaultValue={factory?.paymentTerms || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">หมายเหตุ MOQ</span>
            <input
              name="moqNotes"
              defaultValue={factory?.moqNotes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ธนาคาร</span>
            <input
              name="bankName"
              defaultValue={factory?.bankName || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">เลขบัญชี</span>
            <input
              name="bankAccount"
              defaultValue={factory?.bankAccount || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Alipay</span>
            <input
              name="alipay"
              defaultValue={factory?.alipay || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">QC</span>
            <textarea
              name="qcNotes"
              rows={2}
              defaultValue={factory?.qcNotes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">หมายเหตุภายใน</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={factory?.notes || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
      </section>
    </OpsCycleForm>
  );
}
