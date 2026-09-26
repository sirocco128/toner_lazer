"use client";

import { useMemo, useState, useTransition } from "react";
import {
  applyPriceBatchAction,
  exportPriceBatchCsvAction,
  previewPriceBatchAction,
  savePriceConfigAction,
  type PriceBatchConfig,
  type PriceBatchPreviewRow,
  type PriceBatchSummary,
  type PriceConfigRecord,
} from "@/app/actions/ops-price-batch";
import { DEFAULT_QUOTE_QTYS } from "@/lib/alibaba/landed-cost";
import {
  FormulaBandLegend,
  FormulaCheckNote,
} from "@/components/FormulaCheckNote";
import { parseFactoryWorkbook } from "@/lib/factory-workbook";
import { formatThbPlain } from "@/lib/th-billing";

const MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const SAMPLE_CSV = `sku,name,rmb,per ctn,length,width,height,weight
TSQ01-2,Light humidifier + neck massager,32,20,47.5,45.5,51,17
`;

const CODE_RULES = [
  { ok: true, label: "ใช้รหัสโรงงาน", example: "nt0001, TSQ01-2" },
  { ok: false, label: "ห้ามรหัสขาย A/B/C/D", example: "A00001, B00001, C00003" },
];

function downloadBlob(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function OpsPriceImport({
  canSeeCost,
  canApply,
  mysqlOn,
  fxCny,
  savedConfigs,
}: {
  canSeeCost: boolean;
  canApply: boolean;
  mysqlOn: boolean;
  fxCny: number;
  savedConfigs: PriceConfigRecord[];
}) {
  const defaultCfg = savedConfigs.find((c) => c.isDefault)?.config;
  const [configName, setConfigName] = useState(defaultCfg ? savedConfigs.find((c) => c.isDefault)!.name : "มาตรฐานเว็บ");
  const [cnyToThb, setCnyToThb] = useState(String(defaultCfg?.cnyToThb ?? fxCny));
  const [month, setMonth] = useState(defaultCfg?.month ?? new Date().getMonth() + 1);
  const [origin, setOrigin] = useState<PriceBatchConfig["origin"]>(
    defaultCfg?.origin ?? "guangzhou_shenzhen",
  );
  const [mode, setMode] = useState<"auto" | "truck" | "sea">(
    defaultCfg?.forceMode ?? "auto",
  );
  const [category, setCategory] = useState<PriceBatchConfig["category"]>(
    defaultCfg?.category ?? "general",
  );
  const [includeFreight, setIncludeFreight] = useState(defaultCfg?.includeFreight ?? true);
  const [includePackaging, setIncludePackaging] = useState(defaultCfg?.includePackaging ?? false);
  const [profile, setProfile] = useState(defaultCfg?.profile ?? "standard");
  const [configs, setConfigs] = useState(savedConfigs);
  const [fileLabel, setFileLabel] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("วางไฟล์โรงงานแล้วกดประมวลผล — ยังไม่เขียนราคาบนเว็บ");
  const [rows, setRows] = useState<PriceBatchPreviewRow[]>([]);
  const [batch, setBatch] = useState<PriceBatchSummary | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const currentConfig = useMemo(
    (): PriceBatchConfig => ({
      cnyToThb: Number(cnyToThb) || fxCny,
      month,
      origin: origin as PriceBatchConfig["origin"],
      forceMode: mode === "auto" ? undefined : mode,
      category: category as PriceBatchConfig["category"],
      includeFreight,
      includePackaging,
      profile,
      minOrder: 10,
      bulkQty: 300,
    }),
    [cnyToThb, month, origin, mode, category, includeFreight, includePackaging, profile, fxCny],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.code} ${row.name} ${row.offerCode || ""} ${row.slug || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, filter]);

  const matched = rows.filter((row) => row.match === "matched" && row.selected !== false);
  const selectedCodes = rows.filter((row) => selected[row.code]).map((row) => row.code);

  function currentConfigPayload() {
    return currentConfig as unknown as Record<string, unknown>;
  }

  function applySaved(id: number) {
    const found = configs.find((c) => c.id === id);
    if (!found) return;
    setConfigName(found.name);
    setCnyToThb(String(found.config.cnyToThb));
    setMonth(found.config.month);
    setOrigin(found.config.origin);
    setMode(found.config.forceMode ?? "auto");
    setCategory(found.config.category);
    setIncludeFreight(found.config.includeFreight);
    setIncludePackaging(found.config.includePackaging);
    setProfile(found.config.profile);
  }

  async function onFile(file: File) {
    setError("");
    setNote("กำลังอ่านไฟล์…");
    setFileLabel(file.name);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseFactoryWorkbook(buf, file.name);
      if (parsed.products.length === 0) {
        setError(parsed.warnings[0] || "ไม่พบสินค้าในไฟล์");
        setRows([]);
        return;
      }
      const fileWarn = parsed.warnings[0] || "";
      setNote(
        fileWarn
          ? `${fileWarn} — กำลังคิดราคาตามสูตรเว็บ`
          : `อ่านได้ ${parsed.products.length} รายการ — กำลังคิดราคาตามสูตรเว็บ`,
      );
      startTransition(async () => {
        const result = await previewPriceBatchAction({
          fileName: file.name,
          config: currentConfigPayload(),
          products: parsed.products,
        });
        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }
        setBatch(result.batch);
        setRows(result.rows);
        const next: Record<string, boolean> = {};
        for (const row of result.rows) {
          next[row.code] = row.match === "matched";
        }
        setSelected(next);
        setNote(
          `จับคู่ได้ ${result.batch.matchedCount}/${result.batch.rowCount} รายการ — ส่งออกเช็คก่อน แล้วค่อยอัปเดต${
            fileWarn ? ` · ${fileWarn}` : ""
          }`,
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-forest/15 bg-paper p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-forest">ชุดเงื่อนไขที่บันทึกได้</h2>
          <p className="text-xs text-ink/60">
            สูตรเดียวกับหน้าเว็บ: ต้นทุนโรงงาน × SOF × markup + ค่าขนส่งจีน
            — เปิดสูตรรีเช็ครายแถวหลังประมวลผล
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            ชื่อชุด
            <input
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            โหลดชุดที่บันทึก
            <select
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
              defaultValue=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) applySaved(id);
              }}
            >
              <option value="">เลือก…</option>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isDefault ? " (ค่าเริ่มต้น)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            CNY → THB
            <input
              type="number"
              min={0.1}
              step={0.01}
              value={cnyToThb}
              onChange={(e) => setCnyToThb(e.target.value)}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            เดือนขนส่ง
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            ต้นทาง
            <select
              value={origin}
              onChange={(e) =>
                setOrigin(e.target.value as PriceBatchConfig["origin"])
              }
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            >
              <option value="guangzhou_shenzhen">กวางโจว / เซินเจิ้น</option>
              <option value="yiwu">อี้อู</option>
            </select>
          </label>
          <label className="text-sm">
            โหมดขนส่ง
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "auto" | "truck" | "sea")}
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            >
              <option value="auto">อัตโนมัติ (รถ/เรือตาม CBM)</option>
              <option value="truck">บังคับรถ</option>
              <option value="sea">บังคับเรือ</option>
            </select>
          </label>
          <label className="text-sm">
            ประเภทสินค้า
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as PriceBatchConfig["category"])
              }
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            >
              <option value="general">ทั่วไป</option>
              <option value="electronic_tisi">ไฟฟ้า / มอก.</option>
            </select>
          </label>
          <label className="text-sm">
            โปรไฟล์
            <select
              value={profile}
              onChange={(e) =>
                setProfile(e.target.value as "standard" | "corporate")
              }
              className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
            >
              <option value="standard">ขายเว็บสาธารณะ (10–1000)</option>
              <option value="corporate">องค์กร (markup 1.47)</option>
            </select>
          </label>
        </div>
        <FormulaBandLegend profile={profile} className="mt-3" />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeFreight}
              onChange={(e) => setIncludeFreight(e.target.checked)}
            />
            รวมค่าขนส่งจีน
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includePackaging}
              onChange={(e) => setIncludePackaging(e.target.checked)}
            />
            รวมแพ็กไทย {includePackaging ? "(45–85 บาท)" : ""}
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await savePriceConfigAction({
                  name: configName,
                  config: currentConfigPayload(),
                  asDefault: true,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setConfigs((prev) => {
                  const others = prev.filter((c) => c.id !== result.config.id);
                  return [
                    { ...result.config, isDefault: true },
                    ...others.map((c) => ({ ...c, isDefault: false })),
                  ];
                });
                setNote(`บันทึกชุด «${configName}» แล้ว`);
              })
            }
            className="rounded border border-forest/30 px-3 py-1.5"
          >
            บันทึกชุดนี้เป็นค่าเริ่มต้น
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-brass/40 bg-paper p-4">
        <h2 className="text-lg font-semibold text-forest">นำเข้าไฟล์โรงงาน</h2>
        <p className="mt-1 text-sm text-ink/70">
          .xlsx / .xlsm / .csv — อ่านในเบราว์เซอร์ ไม่ส่งรูปในไฟล์เข้าเซิร์ฟเวอร์
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {CODE_RULES.map((rule) => (
            <div
              key={rule.label}
              className={
                rule.ok
                  ? "rounded-lg border border-forest/20 bg-forest-mist/50 px-3 py-2"
                  : "rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              }
            >
              <dt className={rule.ok ? "font-medium text-forest" : "font-medium text-red-800"}>
                {rule.ok ? "ใช้" : "ห้าม"} · {rule.label}
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-ink/70">{rule.example}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink/70">
          ต้องมีคอลัมน์ <span className="font-medium">รหัสโรงงาน</span> ชื่อ ราคา RMB
          และบรรทัดแพ็กกล่อง เช่น <span className="font-mono text-xs">20 sets/ctn, 47.5*45.5*51cm, 17kgs</span>
          — รหัสขาย A/B/C/D ระบบออกเองตอนสร้าง SKU ไม่ใส่ในไฟล์นี้
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer rounded bg-forest px-4 py-2 text-sm text-paper">
            เลือกไฟล์
            <input
              type="file"
              accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          <button
            type="button"
            className="rounded border border-forest/30 px-3 py-1.5 text-sm"
            onClick={() => downloadBlob("factory-price-template.csv", SAMPLE_CSV)}
          >
            ดาวน์โหลดแม่แบบ CSV
          </button>
          {fileLabel ? (
            <span className="text-sm text-ink/70">{fileLabel}</span>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-ink/70">{pending ? "กำลังคิดราคา…" : note}</p>

      {rows.length ? (
        <section className="rounded-xl border border-forest/15 bg-paper">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-forest/10 px-4 py-3">
            <h2 className="font-semibold text-forest">
              พรีวิว {rows.length} แถว
              {batch ? ` · ชุด #${batch.id}` : ""}
            </h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="กรองรหัส / ชื่อ"
              className="rounded border border-forest/20 px-2 py-1.5 text-sm"
            />
          </header>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 bg-forest-mist text-ink/60">
                <tr>
                  <th className="px-3 py-2">ส่ง</th>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>จับคู่เว็บ</th>
                  <th>ราคาเว็บปัจจุบัน</th>
                  <th>ราคาขายใหม่</th>
                  {DEFAULT_QUOTE_QTYS.map((qty) => (
                    <th key={qty}>{qty}</th>
                  ))}
                  {canSeeCost ? <th>ต้นทุน</th> : null}
                  {canSeeCost ? <th>สูตรรีเช็ค</th> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const byQty = new Map(row.tiers.map((t) => [t.qty, t.sellThb]));
                  const byFormula = new Map(
                    row.tiers
                      .filter((t) => t.formulaNote)
                      .map((t) => [t.qty, t.formulaNote]),
                  );
                  return (
                    <tr
                      key={row.code}
                      className={`border-t border-forest/10 ${
                        row.match === "skip"
                          ? "bg-amber-50/60"
                          : row.match === "unmatched"
                            ? "bg-ink/5"
                            : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[row.code])}
                          disabled={row.match !== "matched"}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [row.code]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="font-mono text-xs">{row.code}</td>
                      <td className="max-w-[220px] truncate" title={row.name}>
                        {row.name}
                      </td>
                      <td>
                        {row.match === "matched"
                          ? row.offerCode
                          : row.match === "skip"
                            ? row.warning?.includes("รหัสขาย")
                              ? "รหัสขาย A/B/C"
                              : "คิดไม่ได้"
                            : "ไม่พบ"}
                        {row.warning ? (
                          <span className="block text-xs text-ink/55">{row.warning}</span>
                        ) : null}
                      </td>
                      <td className="tabular-nums">
                        {row.currentMin != null
                          ? `${formatThbPlain(row.currentMin)}–${formatThbPlain(row.currentMax || 0)}`
                          : "—"}
                      </td>
                      <td className="font-semibold tabular-nums text-forest">
                        {row.priceMin != null
                          ? `${formatThbPlain(row.priceMin)}–${formatThbPlain(row.priceMax || 0)}`
                          : "—"}
                      </td>
                      {DEFAULT_QUOTE_QTYS.map((qty) => (
                        <td
                          key={qty}
                          className="tabular-nums"
                          title={byFormula.get(qty)}
                        >
                          {byQty.has(qty) ? formatThbPlain(byQty.get(qty)!) : "—"}
                        </td>
                      ))}
                      {canSeeCost ? (
                        <td className="tabular-nums text-ink/70">
                          {row.cost
                            ? `${row.cost.factoryCny}¥ → ${formatThbPlain(row.cost.landedCostThb)}`
                            : "—"}
                        </td>
                      ) : null}
                      {canSeeCost ? (
                        <td className="max-w-[280px] align-top">
                          {row.formulaNote ? (
                            <details>
                              <summary className="cursor-pointer text-xs text-forest">
                                ดูสูตร MOQ / ล็อตใหญ่
                              </summary>
                              <FormulaCheckNote note={row.formulaNote} className="mt-1" />
                            </details>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-forest/10 px-4 py-3">
            <button
              type="button"
              className="rounded border border-forest/30 px-3 py-1.5 text-sm"
              onClick={() => {
                startTransition(async () => {
                  if (!batch) return;
                  const result = await exportPriceBatchCsvAction(batch.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  downloadBlob(result.fileName, result.csv);
              setNote("ส่งออกแล้ว — เปิดคอลัมน์ formula_check ใน Excel เพื่อรีเช็คสูตรก่อนกดอัปเดต");
                });
              }}
            >
              ส่งออก CSV เพื่อรีเช็ค
            </button>
            <p className="text-xs text-ink/60">
              เลือกแล้ว {selectedCodes.length} / จับคู่ได้ {matched.length}
            </p>
          </div>
        </section>
      ) : null}

      {rows.length && canApply ? (
        <section className="rounded-xl border border-forest/20 bg-forest/5 p-4">
          <h2 className="text-lg font-semibold text-forest">ส่งอัปเดตราคาขึ้นเว็บ</h2>
          <p className="mt-1 text-sm text-ink/70">
            เขียนช่วงราคาหน้าสินค้า (price min/max) และบันไดจำนวนที่ลูกค้าสั่งได้
            10 / 20 / 50 / 100 / 300 / 500 / 1000 ลง SmartGift MySQL
            {mysqlOn ? "" : " — ตอนนี้ MySQL ยังไม่เปิด เปิด SMARTGIFT_MYSQL_ENABLED ก่อน"}
          </p>
          <label className="mt-3 block text-sm">
            พิมพ์คำว่า <span className="font-semibold">อัปเดต</span> เพื่อยืนยัน
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full max-w-xs rounded border border-forest/20 px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={pending || !batch || !mysqlOn || selectedCodes.length === 0}
            onClick={() => {
              if (!batch) return;
              startTransition(async () => {
                const result = await applyPriceBatchAction({
                  batchId: batch.id,
                  codes: selectedCodes,
                  confirm,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setNote(
                  `อัปเดตแล้ว ${result.updated} รายการ` +
                    (result.skipped ? ` · ข้าม ${result.skipped}` : ""),
                );
                setConfirm("");
              });
            }}
            className="mt-3 rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
          >
            อัปเดตราคาตามแถวที่เลือก
          </button>
        </section>
      ) : null}
    </div>
  );
}
