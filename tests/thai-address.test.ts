import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeOrderShipTo,
  formatShipToLabel,
  formatThaiMailingAddress,
  listThaiDistricts,
  listThaiProvinces,
  listThaiSubdistricts,
  matchThaiAddressParts,
  parseThaiMailingAddress,
  quoteShipToParts,
  searchThaiAddress,
  thaiDistrictLabel,
  thaiSubdistrictLabel,
} from "../lib/thai-address";

describe("thai-address autocomplete", () => {
  it("lists 77 provinces including Bangkok", () => {
    const provinces = listThaiProvinces();
    assert.equal(provinces.length, 77);
    assert.ok(provinces.includes("กรุงเทพมหานคร"));
    assert.ok(listThaiProvinces("กรุง").includes("กรุงเทพมหานคร"));
    assert.ok(listThaiProvinces("กทม").includes("กรุงเทพมหานคร"));
  });

  it("cascades district and subdistrict for Thung Khru", () => {
    const districts = listThaiDistricts("กรุงเทพมหานคร");
    assert.ok(districts.includes("ทุ่งครุ"));
    const tambons = listThaiSubdistricts("กรุงเทพมหานคร", "ทุ่งครุ");
    const names = tambons.map((row) => row.name);
    assert.ok(names.includes("ทุ่งครุ"));
    assert.ok(names.includes("บางมด"));
    assert.equal(tambons.find((row) => row.name === "ทุ่งครุ")?.zip, "10140");
  });

  it("searches by tambon name", () => {
    const hits = searchThaiAddress("ทุ่งครุ", 5);
    assert.ok(hits.length >= 1);
    assert.equal(hits[0]?.province, "กรุงเทพมหานคร");
    assert.equal(
      formatShipToLabel(hits[0]!),
      "แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพมหานคร",
    );
  });

  it("matches MOC place names with อำเภอ/เขต prefixes stripped", () => {
    const matched = matchThaiAddressParts({
      province: "จังหวัดกรุงเทพมหานคร",
      district: "เขตทุ่งครุ",
      subdistrict: "แขวงทุ่งครุ",
    });
    assert.equal(matched.province, "กรุงเทพมหานคร");
    assert.equal(matched.district, "ทุ่งครุ");
    assert.equal(matched.subdistrict, "ทุ่งครุ");
  });

  it("uses เขต/แขวง for Bangkok and ตำบล/อำเภอ elsewhere", () => {
    assert.equal(thaiDistrictLabel("กรุงเทพมหานคร"), "เขต");
    assert.equal(thaiSubdistrictLabel("กทม"), "แขวง");
    assert.equal(thaiDistrictLabel("นนทบุรี"), "อำเภอ");
    assert.equal(thaiSubdistrictLabel("นนทบุรี"), "ตำบล");
    assert.equal(
      formatThaiMailingAddress({
        streetAddress: "50/238 ซอยประชาอุทิศ 72",
        province: "กรุงเทพมหานคร",
        district: "ทุ่งครุ",
        subdistrict: "ทุ่งครุ",
        zip: "10140",
      }),
      "50/238 ซอยประชาอุทิศ 72 แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพมหานคร 10140",
    );
    assert.equal(
      formatThaiMailingAddress({
        streetAddress: "99/1",
        province: "นนทบุรี",
        district: "ปากเกร็ด",
        subdistrict: "คลองข่อย",
      }),
      "99/1 ตำบลคลองข่อย อำเภอปากเกร็ด จังหวัดนนทบุรี",
    );
  });

  it("parses a composed upcountry mailing line into fields", () => {
    const parts = parseThaiMailingAddress(
      "19/13 หมู่ 2 ตำบลคลองข่อย อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
    );
    assert.equal(parts.streetAddress, "19/13 หมู่ 2");
    assert.equal(parts.subdistrict, "คลองข่อย");
    assert.equal(parts.district, "ปากเกร็ด");
    assert.equal(parts.province, "นนทบุรี");
    assert.equal(parts.zip, "11120");
  });

  it("parses a composed Bangkok mailing line into fields", () => {
    const parts = parseThaiMailingAddress(
      "50/238 ซอยประชาอุทิศ 72 แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพมหานคร 10140",
    );
    assert.equal(parts.streetAddress, "50/238 ซอยประชาอุทิศ 72");
    assert.equal(parts.subdistrict, "ทุ่งครุ");
    assert.equal(parts.district, "ทุ่งครุ");
    assert.equal(parts.province, "กรุงเทพมหานคร");
    assert.equal(parts.zip, "10140");
  });

  it("treats a province-only value as province, not street", () => {
    const parts = parseThaiMailingAddress("เชียงใหม่");
    assert.equal(parts.province, "เชียงใหม่");
    assert.equal(parts.streetAddress, "");
  });

  it("reads structured quote payload and does not dump the mailing line into province", () => {
    const parts = quoteShipToParts({
      province:
        "19/13 หมู่ 2 ตำบลคลองข่อย อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
      rawPayload: JSON.stringify({
        streetAddress: "19/13 หมู่ 2",
        province:
          "19/13 หมู่ 2 ตำบลคลองข่อย อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
        district: "ปากเกร็ด",
        subdistrict: "คลองข่อย",
        zip: "11120",
      }),
    });
    assert.equal(parts.streetAddress, "19/13 หมู่ 2");
    assert.equal(parts.province, "นนทบุรี");
    assert.equal(parts.district, "ปากเกร็ด");
    assert.equal(parts.subdistrict, "คลองข่อย");
    assert.equal(parts.zip, "11120");

    const composed = composeOrderShipTo(parts);
    assert.equal(composed.shipToProvince, "นนทบุรี");
    assert.equal(
      composed.shipToAddress,
      "19/13 หมู่ 2 ตำบลคลองข่อย อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
    );
  });
});
