"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COMPANY_TAX_LOOKUP_HINT } from "@/lib/ux-copy";
import { isValidThaiTaxId } from "@/lib/th-billing";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

export type CompanyLookupBranch = {
  code: string;
  label: string;
  streetAddress?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  zip?: string | null;
  address?: string | null;
};

export type CompanyLookupFill = {
  taxId: string;
  company: string;
  billingBranch?: string;
  streetAddress?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  zip?: string;
};

type CompanyMatch = {
  taxId: string;
  name: string;
  address?: string | null;
  streetAddress?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  zip?: string | null;
  source?: string;
  branches?: CompanyLookupBranch[];
};

type LookupPayload = {
  ok?: boolean;
  name?: string;
  taxId?: string;
  streetAddress?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  zip?: string;
  address?: string;
  status?: string;
  error?: string;
  source?: string;
  needsPick?: boolean;
  branches?: CompanyLookupBranch[];
  matches?: CompanyMatch[];
};

type CompanyLookupFieldProps = {
  taxId: string;
  company: string;
  billingBranch?: string;
  taxError?: string;
  companyError?: string;
  /** When false, parent renders the company field; lookup still fills it. */
  showCompanyField?: boolean;
  onTaxIdChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onFill: (fill: CompanyLookupFill) => void;
};

function addressFromBranch(branch: CompanyLookupBranch): Partial<CompanyLookupFill> {
  return {
    ...(branch.streetAddress ? { streetAddress: branch.streetAddress } : {}),
    ...(branch.province ? { province: branch.province } : {}),
    ...(branch.district ? { district: branch.district } : {}),
    ...(branch.subdistrict ? { subdistrict: branch.subdistrict } : {}),
    ...(branch.zip ? { zip: branch.zip } : {}),
  };
}

function sourceLabel(source?: string): string {
  if (source === "crm") return "จากลูกค้าเดิมในระบบ";
  if (source === "rd_vat") return "จากกรมสรรพากร";
  return "จากกรมพัฒนาธุรกิจการค้า";
}

function matchPlaceLine(match: CompanyMatch): string {
  return [match.streetAddress || match.address, match.district, match.province]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function branchPlaceLine(branch: CompanyLookupBranch): string {
  return [
    branch.streetAddress || branch.address,
    branch.subdistrict,
    branch.district,
    branch.province,
    branch.zip,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function hqBranchFromMatch(match: CompanyMatch): CompanyLookupBranch {
  const hq = match.branches?.[0];
  if (hq) return hq;
  return {
    code: "0",
    label: "สำนักงานใหญ่",
    streetAddress: match.streetAddress,
    province: match.province,
    district: match.district,
    subdistrict: match.subdistrict,
    zip: match.zip,
    address: match.address,
  };
}

function fillFromRecord(
  record: Pick<
    LookupPayload,
    | "taxId"
    | "name"
    | "streetAddress"
    | "province"
    | "district"
    | "subdistrict"
    | "zip"
    | "branches"
  >,
  fallbackTaxId: string,
  previousBranch: string,
): CompanyLookupFill {
  const nextBranches = Array.isArray(record.branches) ? record.branches : [];
  const hq = nextBranches[0];
  const preserved = nextBranches.find((branch) => branch.label === previousBranch);
  const chosen = preserved || hq;
  return {
    taxId: record.taxId || fallbackTaxId,
    company: record.name || "",
    billingBranch: chosen?.label || "สำนักงานใหญ่",
    streetAddress: chosen?.streetAddress || record.streetAddress,
    province: chosen?.province || record.province,
    district: chosen?.district || record.district,
    subdistrict: chosen?.subdistrict || record.subdistrict,
    zip: chosen?.zip || record.zip,
  };
}

function PickRow({
  selected,
  title,
  meta,
  detail,
  onClick,
  disabled,
}: {
  selected: boolean;
  title: string;
  meta?: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
        "disabled:cursor-wait disabled:opacity-60",
        selected
          ? "border-brass bg-brass/10 text-ink"
          : "border-forest/15 bg-paper text-ink hover:border-brass",
      )}
    >
      <span className="block font-semibold text-forest">{title}</span>
      {meta ? (
        <span className="mt-0.5 block font-mono text-xs text-ink/55">{meta}</span>
      ) : null}
      {detail ? (
        <span className="mt-0.5 block text-xs text-ink/60">{detail}</span>
      ) : null}
    </button>
  );
}

export function CompanyLookupField({
  taxId,
  company,
  billingBranch = "",
  taxError,
  companyError,
  showCompanyField = true,
  onTaxIdChange,
  onCompanyChange,
  onFill,
}: CompanyLookupFieldProps) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [pickerPending, setPickerPending] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const [branches, setBranches] = useState<CompanyLookupBranch[]>([]);
  const [matches, setMatches] = useState<CompanyMatch[]>([]);
  const [pickedMatch, setPickedMatch] = useState<CompanyMatch | null>(null);
  const [pickedBranch, setPickedBranch] = useState<CompanyLookupBranch | null>(null);
  const [pickerBranches, setPickerBranches] = useState<CompanyLookupBranch[]>([]);
  const lastLookup = useRef("");
  const pickerRequest = useRef(0);
  const onFillRef = useRef(onFill);
  const billingBranchRef = useRef(billingBranch);
  onFillRef.current = onFill;
  billingBranchRef.current = billingBranch;

  const resetPickerSelection = useCallback(() => {
    setPickedMatch(null);
    setPickedBranch(null);
    setPickerBranches([]);
    setPickerError("");
    setPickerFilter("");
  }, []);

  const applyResult = useCallback((json: LookupPayload, fallbackTaxId: string) => {
    if (!json.ok) {
      setBranches([]);
      setMatches([]);
      resetPickerSelection();
      setPickerOpen(false);
      setStatus(json.error || "ไม่พบบริษัท กรอกชื่อหรือเลขผู้เสียภาษีเองได้");
      return;
    }
    const nextMatches = Array.isArray(json.matches) ? json.matches : [];
    if (nextMatches.length > 1) {
      setMatches(nextMatches);
      setBranches([]);
      resetPickerSelection();
      setPickerOpen(true);
      setStatus(`พบ ${nextMatches.length} บริษัทจากกรมสรรพากร — เลือกชื่อและสาขาในหน้าต่างให้ตรง`);
      return;
    }
    setMatches([]);
    resetPickerSelection();
    setPickerOpen(false);
    const nextBranches = Array.isArray(json.branches) ? json.branches : [];
    setBranches(nextBranches);
    onFillRef.current(fillFromRecord(json, fallbackTaxId, billingBranchRef.current));
    const running = json.status ? ` · สถานะ ${json.status}` : "";
    const branchNote =
      nextBranches.length > 1
        ? ` · พบ ${nextBranches.length} สาขา ให้เลือกสาขาที่ออกใบกำกับภาษี`
        : "";
    setStatus(`พบ ${json.name} (${sourceLabel(json.source)}${running}${branchNote})`);
  }, [resetPickerSelection]);

  const lookup = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (query.length < 2) return;
      const digits = query.replace(/\D/g, "");
      const key = digits.length === 13 ? digits : `name:${query}`;
      if (lastLookup.current === key) return;
      lastLookup.current = key;
      setPending(true);
      setStatus(
        digits.length === 13
          ? "กำลังเช็คเลขผู้เสียภาษีกับกรมสรรพากร…"
          : "กำลังค้นชื่อบริษัทจากกรมสรรพากร…",
      );
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);
        const response = await fetch(
          `/api/company-lookup?q=${encodeURIComponent(query)}`,
          { cache: "no-store", signal: controller.signal },
        );
        window.clearTimeout(timeout);
        const text = await response.text();
        let json: LookupPayload;
        try {
          json = JSON.parse(text) as LookupPayload;
        } catch {
          lastLookup.current = "";
          setBranches([]);
          setMatches([]);
          resetPickerSelection();
          setPickerOpen(false);
          setStatus("ค้นหาไม่สำเร็จในตอนนี้ กรอกชื่อบริษัทและที่อยู่เองได้");
          return;
        }
        if (!json.ok) lastLookup.current = "";
        applyResult(json, digits.length === 13 ? digits : json.taxId || "");
      } catch {
        lastLookup.current = "";
        setBranches([]);
        setMatches([]);
        resetPickerSelection();
        setPickerOpen(false);
        setStatus("ค้นหาไม่สำเร็จในตอนนี้ กรอกชื่อบริษัทและที่อยู่เองได้");
      } finally {
        setPending(false);
      }
    },
    [applyResult, resetPickerSelection],
  );

  const loadCompanyForPicker = useCallback(async (match: CompanyMatch) => {
    const requestId = pickerRequest.current + 1;
    pickerRequest.current = requestId;
    setPickedMatch(match);
    setPickedBranch(null);
    setPickerError("");
    if (!isValidThaiTaxId(match.taxId)) {
      const fallback = hqBranchFromMatch(match);
      setPickerBranches([fallback]);
      setPickedBranch(fallback);
      return;
    }
    setPickerPending(true);
    try {
      const response = await fetch(
        `/api/company-lookup?q=${encodeURIComponent(match.taxId)}`,
        { cache: "no-store" },
      );
      const text = await response.text();
      const json = JSON.parse(text) as LookupPayload;
      if (pickerRequest.current !== requestId) return;
      if (!json.ok) {
        const fallback = hqBranchFromMatch(match);
        setPickerBranches([fallback]);
        setPickedBranch(fallback);
        setPickerError(json.error || "โหลดสาขาไม่สำเร็จ ใช้ที่อยู่สำนักงานใหญ่จากรายการค้นหาได้");
        return;
      }
      const official: CompanyMatch = {
        ...match,
        name: json.name || match.name,
        taxId: json.taxId || match.taxId,
        streetAddress: json.streetAddress || match.streetAddress,
        province: json.province || match.province,
        district: json.district || match.district,
        subdistrict: json.subdistrict || match.subdistrict,
        zip: json.zip || match.zip,
        address: json.address || match.address,
        source: json.source || match.source,
        branches: json.branches,
      };
      const nextBranches =
        Array.isArray(json.branches) && json.branches.length
          ? json.branches
          : [hqBranchFromMatch(official)];
      setPickedMatch(official);
      setPickerBranches(nextBranches);
      setPickedBranch(nextBranches[0] || null);
      lastLookup.current = official.taxId.replace(/\D/g, "");
    } catch {
      if (pickerRequest.current !== requestId) return;
      const fallback = hqBranchFromMatch(match);
      setPickerBranches([fallback]);
      setPickedBranch(fallback);
      setPickerError("โหลดสาขาไม่สำเร็จในตอนนี้ ใช้ที่อยู่สำนักงานใหญ่จากรายการค้นหาได้");
    } finally {
      if (pickerRequest.current === requestId) setPickerPending(false);
    }
  }, []);

  const confirmPicker = useCallback(() => {
    if (!pickedMatch || !pickedBranch) return;
    const digits = pickedMatch.taxId.replace(/\D/g, "");
    if (digits.length === 13) lastLookup.current = digits;
    setBranches(pickerBranches);
    setMatches([]);
    onFillRef.current({
      taxId: pickedMatch.taxId,
      company: pickedMatch.name,
      billingBranch: pickedBranch.label,
      ...addressFromBranch(pickedBranch),
    });
    setPickerOpen(false);
    resetPickerSelection();
    setStatus(`ใช้ ${pickedMatch.name} · ${pickedBranch.label} (จากกรมสรรพากร)`);
  }, [pickedBranch, pickedMatch, pickerBranches, resetPickerSelection]);

  useEffect(() => {
    const digits = taxId.replace(/\D/g, "");
    if (digits.length !== 13) {
      if (!company.trim()) {
        lastLookup.current = "";
        setBranches([]);
        setMatches([]);
        resetPickerSelection();
      }
      return;
    }
    const timer = window.setTimeout(() => {
      void lookup(digits);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [taxId, company, lookup, resetPickerSelection]);

  const selectedLabel = billingBranch || "สำนักงานใหญ่";
  const showBranchSelect = branches.length > 1;
  const filteredMatches = matches.filter((match) => {
    const needle = pickerFilter.trim().toLowerCase();
    if (!needle) return true;
    return `${match.name} ${match.taxId} ${matchPlaceLine(match)}`
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      {showCompanyField ? (
      <div>
        <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-ink">
          บริษัท / องค์กร *
        </label>
        <div className="flex gap-2">
          <input
            id="company"
            name="company"
            required
            autoComplete="organization"
            value={company}
            onChange={(event) => {
              const value = event.target.value;
              onCompanyChange(value);
              const digits = value.replace(/\D/g, "");
              if (digits.length === 13) onTaxIdChange(digits);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              lastLookup.current = "";
              void lookup(company || taxId);
            }}
            className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            aria-invalid={Boolean(companyError)}
            aria-describedby={companyError ? "company-error" : "company-lookup-hint"}
          />
          <button
            type="button"
            disabled={pending || company.trim().length < 2}
            onClick={() => {
              lastLookup.current = "";
              void lookup(company);
            }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {pending ? "ค้นหา…" : "ค้นจากสรรพากร"}
          </button>
        </div>
        {companyError ? (
          <p id="company-error" className="mt-1 text-sm text-red-700">
            {companyError}
          </p>
        ) : null}
      </div>
      ) : null}
      <div>
        <label htmlFor="taxId" className="mb-1.5 block text-sm font-medium text-ink">
          เลขประจำตัวผู้เสียภาษี
        </label>
        <div className="flex gap-2">
          <input
            id="taxId"
            name="taxId"
            inputMode="numeric"
            autoComplete="off"
            value={taxId}
            onChange={(event) => onTaxIdChange(event.target.value.replace(/\D/g, "").slice(0, 13))}
            placeholder="13 หลัก"
            className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            aria-invalid={Boolean(taxError)}
            aria-describedby={taxError ? "taxId-error" : "company-lookup-hint"}
          />
          <button
            type="button"
            disabled={pending || taxId.replace(/\D/g, "").length !== 13}
            onClick={() => {
              lastLookup.current = "";
              void lookup(taxId);
            }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {pending ? "ค้นหา…" : "ค้นหาบริษัท"}
          </button>
        </div>
        {taxError ? (
          <p id="taxId-error" className="mt-1 text-sm text-red-700">
            {taxError}
          </p>
        ) : null}
      </div>
    </div>
    <p id="company-lookup-hint" className="text-xs text-ink/55">
      {COMPANY_TAX_LOOKUP_HINT}
    </p>
    {status ? <p className="text-xs text-forest">{status}</p> : null}
    {!pickerOpen && matches.length > 1 ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPickerOpen(true)}
      >
        เปิดรายการเลือกบริษัทอีกครั้ง ({matches.length} ชื่อ)
      </Button>
    ) : null}

    <Dialog
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open && matches.length > 1) {
          setStatus(`ยังไม่ได้ยืนยันบริษัท — กดเปิดรายการอีกครั้งเพื่อเลือกชื่อและสาขาให้ตรง`);
        }
      }}
    >
      <DialogContent className="max-h-[min(90dvh,48rem)] w-[min(100%-1.5rem,36rem)]">
        <DialogHeader>
          <DialogTitle>เลือกบริษัทและสาขา</DialogTitle>
          <DialogDescription>
            พบ {matches.length} ชื่อจากกรมสรรพากร เลือกชื่อให้ตรงกับบริษัทของคุณ
            แล้วเลือกสาขาที่ออกใบกำกับภาษี ระบบจะใส่ที่อยู่ตามสาขานั้น
          </DialogDescription>
        </DialogHeader>

        {matches.length > 5 ? (
          <div>
            <label htmlFor="company-pick-filter" className="sr-only">
              กรองชื่อบริษัท
            </label>
            <input
              id="company-pick-filter"
              value={pickerFilter}
              onChange={(event) => setPickerFilter(event.target.value)}
              placeholder="พิมพ์กรองชื่อหรือเลขผู้เสียภาษี"
              className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            />
          </div>
        ) : null}

        <div className="grid gap-4">
          <section className="min-h-0">
            <h3 className="mb-2 text-sm font-semibold text-forest">1. เลือกชื่อบริษัท</h3>
            <ul className="max-h-[min(32dvh,14rem)] space-y-2 overflow-y-auto pr-1">
              {filteredMatches.map((match) => (
                <li key={`${match.taxId}-${match.name}`}>
                  <PickRow
                    selected={pickedMatch?.taxId === match.taxId && pickedMatch?.name === match.name}
                    title={match.name}
                    meta={match.taxId || "ไม่มีเลขผู้เสียภาษี"}
                    detail={matchPlaceLine(match)}
                    onClick={() => void loadCompanyForPicker(match)}
                  />
                </li>
              ))}
            </ul>
            {filteredMatches.length === 0 ? (
              <p className="text-xs text-ink/55">ไม่มีชื่อที่ตรงกับคำกรองนี้</p>
            ) : null}
          </section>

          <section className="min-h-0">
            <h3 className="mb-2 text-sm font-semibold text-forest">2. เลือกสาขา</h3>
            {!pickedMatch ? (
              <p className="rounded-xl border border-dashed border-forest/20 bg-forest-mist/40 px-3 py-4 text-sm text-ink/65">
                เลือกชื่อบริษัทก่อน แล้วระบบจะโหลดสาขาของบริษัทนั้น
              </p>
            ) : pickerPending ? (
              <p className="rounded-xl border border-forest/15 bg-forest-mist/40 px-3 py-4 text-sm text-forest">
                กำลังโหลดสาขาของ {pickedMatch.name}…
              </p>
            ) : (
              <ul className="max-h-[min(32dvh,14rem)] space-y-2 overflow-y-auto pr-1">
                {pickerBranches.map((branch) => (
                  <li key={`${branch.code}-${branch.label}`}>
                    <PickRow
                      selected={pickedBranch?.label === branch.label && pickedBranch?.code === branch.code}
                      title={branch.label}
                      detail={branchPlaceLine(branch)}
                      onClick={() => setPickedBranch(branch)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {pickerError ? (
              <p className="mt-2 text-xs text-red-700">{pickerError}</p>
            ) : pickedMatch && !pickerPending && pickerBranches.length === 1 ? (
              <p className="mt-2 text-xs text-ink/55">
                บริษัทนี้มีสำนักงานใหญ่สาขาเดียว
              </p>
            ) : null}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
            ปิด
          </Button>
          <Button
            type="button"
            disabled={!pickedMatch || !pickedBranch || pickerPending}
            onClick={confirmPicker}
          >
            ใช้ชื่อและสาขานี้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {showBranchSelect ? (
      <div>
        <label htmlFor="billingBranch" className="mb-1.5 block text-sm font-medium text-ink">
          สาขาที่ออกใบกำกับภาษี *
        </label>
        <select
          id="billingBranch"
          name="billingBranch"
          value={
            branches.some((branch) => branch.label === selectedLabel)
              ? selectedLabel
              : branches[0]?.label || "สำนักงานใหญ่"
          }
          onChange={(event) => {
            const picked =
              branches.find((branch) => branch.label === event.target.value) ||
              branches[0];
            if (!picked) return;
            onFill({
              taxId,
              company,
              billingBranch: picked.label,
              ...addressFromBranch(picked),
            });
          }}
          className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {branches.map((branch) => (
            <option key={`${branch.code}-${branch.label}`} value={branch.label}>
              {branch.label}
              {branch.streetAddress ? ` — ${branch.streetAddress}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink/55">
          เลือกสำนักงานใหญ่หรือสาขาที่ต้องการให้เขียนในใบเสนอราคาและใบกำกับภาษี ที่อยู่ด้านล่างจะตามสาขาที่เลือก
        </p>
      </div>
    ) : (
      <input
        type="hidden"
        name="billingBranch"
        value={selectedLabel || "สำนักงานใหญ่"}
      />
    )}
    </div>
  );
}
