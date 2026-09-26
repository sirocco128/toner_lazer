"use client";

import { SuggestInput, type SuggestItem } from "@/components/SuggestInput";
import {
  thaiDistrictLabel,
  thaiSubdistrictLabel,
} from "@/lib/thai-address-format";

type ThaiAddressFieldsProps = {
  streetAddress: string;
  province: string;
  district: string;
  subdistrict: string;
  zip?: string;
  streetError?: string;
  provinceError?: string;
  onChange: (next: {
    streetAddress: string;
    province: string;
    district: string;
    subdistrict: string;
    zip: string;
  }) => void;
};

function qs(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

export function ThaiAddressFields({
  streetAddress,
  province,
  district,
  subdistrict,
  zip = "",
  streetError,
  provinceError,
  onChange,
}: ThaiAddressFieldsProps) {
  const bangkok = thaiDistrictLabel(province) === "เขต";
  const districtLabel = province
    ? thaiDistrictLabel(province)
    : "อำเภอ / เขต";
  const subdistrictLabel = province
    ? thaiSubdistrictLabel(province)
    : "ตำบล / แขวง";

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="streetAddress" className="mb-1.5 block text-sm font-medium text-ink">
          ที่อยู่
        </label>
        <input
          id="streetAddress"
          name="streetAddress"
          value={streetAddress}
          autoComplete="street-address"
          placeholder="เลขที่ หมู่ ซอย ถนน"
          onChange={(event) =>
            onChange({
              streetAddress: event.target.value,
              province,
              district,
              subdistrict,
              zip,
            })
          }
          className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          aria-invalid={Boolean(streetError)}
          aria-describedby={streetError ? "streetAddress-error" : "streetAddress-hint"}
        />
        <p id="streetAddress-hint" className="mt-1 text-xs text-ink/55">
          ใส่เลขที่และชื่อซอยหรือถนน {bangkok ? "ไม่ต้องใส่แขวง เขต" : "ไม่ต้องใส่ตำบล อำเภอ จังหวัด"}
        </p>
        {streetError ? (
          <p id="streetAddress-error" className="mt-1 text-sm text-red-700">
            {streetError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SuggestInput
          id="province"
          name="province"
          label="จังหวัด"
          value={province}
          error={provinceError}
          placeholder="พิมพ์หรือเลือกจังหวัด"
          fetchUrl={(q) => `/api/thai-address?${qs({ level: "province", q })}`}
          onChange={(value) =>
            onChange({
              streetAddress,
              province: value,
              district: "",
              subdistrict: "",
              zip: "",
            })
          }
        />
        <SuggestInput
          id="district"
          name="district"
          label={districtLabel}
          value={district}
          placeholder={bangkok ? "เลือกเขต" : "เลือกอำเภอ"}
          disabled={!province}
          fetchUrl={(q) =>
            `/api/thai-address?${qs({ level: "district", province, q })}`
          }
          onChange={(value) =>
            onChange({
              streetAddress,
              province,
              district: value,
              subdistrict: "",
              zip: "",
            })
          }
        />
        <SuggestInput
          id="subdistrict"
          name="subdistrict"
          label={subdistrictLabel}
          value={subdistrict}
          placeholder={bangkok ? "เลือกแขวง" : "เลือกตำบล"}
          disabled={!province || !district}
          fetchUrl={(q) =>
            `/api/thai-address?${qs({
              level: "subdistrict",
              province,
              district,
              q,
            })}`
          }
          onChange={(value, item?: SuggestItem) =>
            onChange({
              streetAddress,
              province,
              district,
              subdistrict: item?.value || value,
              zip: item?.zip || zip,
            })
          }
        />
        <div>
          <label htmlFor="zip" className="mb-1.5 block text-sm font-medium text-ink">
            รหัสไปรษณีย์
          </label>
          <input
            id="zip"
            name="zip"
            value={zip}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="11120"
            onChange={(event) =>
              onChange({
                streetAddress,
                province,
                district,
                subdistrict,
                zip: event.target.value.replace(/\D/g, "").slice(0, 5),
              })
            }
            className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          />
        </div>
      </div>
    </div>
  );
}
