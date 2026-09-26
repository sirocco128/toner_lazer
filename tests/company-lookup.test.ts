import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lookupCompanyByTaxId,
  lookupCompany,
  parseRdVatSoap,
  parseRdVatSoapRecords,
  parseRdVatJsonRecords,
  uniqueCompaniesByTaxId,
  formatVatBranchLabel,
} from "../lib/company-lookup";
import { COMPANY } from "../lib/company";

const RD_VAT_SOAP = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><ServiceResponse xmlns="https://rdws.rd.go.th/serviceRD3/vatserviceRD3"><ServiceResult><vtitleName><anyType xsi:type="xsd:string">บริษัท</anyType></vtitleName><vName><anyType xsi:type="xsd:string">เทราบิส จำกัด</anyType></vName><vHouseNumber><anyType xsi:type="xsd:string">50/238</anyType></vHouseNumber><vSoiName><anyType xsi:type="xsd:string">ประชาอุทิศ 72</anyType></vSoiName><vThambol><anyType xsi:type="xsd:string">ทุ่งครุ</anyType></vThambol><vAmphur><anyType xsi:type="xsd:string">ทุ่งครุ</anyType></vAmphur><vProvince><anyType xsi:type="xsd:string">กรุงเทพมหานคร</anyType></vProvince><vPostCode><anyType xsi:type="xsd:string">10140</anyType></vPostCode><vBusinessFirstDate><anyType xsi:type="xsd:string">2013-01-25</anyType></vBusinessFirstDate><vmsgerr /></ServiceResult></ServiceResponse></soap:Body></soap:Envelope>`;

const RD_VAT_SOAP_BRANCH_1 = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><ServiceResponse xmlns="https://rdws.rd.go.th/serviceRD3/vatserviceRD3"><ServiceResult><vtitleName><anyType xsi:type="xsd:string">บริษัท</anyType></vtitleName><vName><anyType xsi:type="xsd:string">เทราบิส จำกัด</anyType></vName><vBranchNumber><anyType xsi:type="xsd:string">1</anyType></vBranchNumber><vHouseNumber><anyType xsi:type="xsd:string">99</anyType></vHouseNumber><vStreetName><anyType xsi:type="xsd:string">สาทร</anyType></vStreetName><vThambol><anyType xsi:type="xsd:string">สีลม</anyType></vThambol><vAmphur><anyType xsi:type="xsd:string">บางรัก</anyType></vAmphur><vProvince><anyType xsi:type="xsd:string">กรุงเทพมหานคร</anyType></vProvince><vPostCode><anyType xsi:type="xsd:string">10500</anyType></vPostCode><vmsgerr /></ServiceResult></ServiceResponse></soap:Body></soap:Envelope>`;

const RD_VAT_SOAP_MULTI = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><ServiceResponse xmlns="https://rdws.rd.go.th/serviceRD3/vatserviceRD3"><ServiceResult><vtitleName><anyType>บริษัท</anyType><anyType>บริษัท</anyType></vtitleName><vName><anyType>เทราบิส จำกัด</anyType><anyType>เทราบิส จำกัด</anyType></vName><vBranchNumber><anyType>0</anyType><anyType>2</anyType></vBranchNumber><vHouseNumber><anyType>50/238</anyType><anyType>12/1</anyType></vHouseNumber><vSoiName><anyType>ประชาอุทิศ 72</anyType><anyType></anyType></vSoiName><vStreetName><anyType></anyType><anyType>พระราม 9</anyType></vStreetName><vThambol><anyType>ทุ่งครุ</anyType><anyType>ห้วยขวาง</anyType></vThambol><vAmphur><anyType>ทุ่งครุ</anyType><anyType>ห้วยขวาง</anyType></vAmphur><vProvince><anyType>กรุงเทพมหานคร</anyType><anyType>กรุงเทพมหานคร</anyType></vProvince><vPostCode><anyType>10140</anyType><anyType>10310</anyType></vPostCode><vmsgerr /></ServiceResult></ServiceResponse></soap:Body></soap:Envelope>`;

describe("company tax ID lookup", () => {
  it("rejects a malformed tax ID", async () => {
    const result = await lookupCompanyByTaxId("123");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid");
  });

  it("returns a local CRM record without calling upstream", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      localRecord: {
        taxId: COMPANY.taxId,
        name: COMPANY.legalName,
        source: "crm",
      },
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, COMPANY.legalName);
      assert.equal(result.source, "crm");
    }
  });

  it("parses a Revenue Department VAT SOAP payload", () => {
    const record = parseRdVatSoap(RD_VAT_SOAP, COMPANY.taxId);
    assert.ok(record);
    assert.equal(record?.name, "บริษัท เทราบิส จำกัด");
    assert.equal(record?.source, "rd_vat");
    assert.equal(record?.province, "กรุงเทพมหานคร");
    assert.equal(record?.district, "ทุ่งครุ");
    assert.equal(record?.subdistrict, "ทุ่งครุ");
    assert.equal(record?.streetAddress, "50/238 ซอยประชาอุทิศ 72");
    assert.equal(record?.zip, "10140");
  });

  it("fills company from the Revenue Department VAT service", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () => RD_VAT_SOAP,
        }) as Response,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, COMPANY.legalName);
      assert.equal(result.source, "rd_vat");
      assert.equal(result.branches?.length, 1);
      assert.equal(result.branches?.[0]?.label, "สำนักงานใหญ่");
    }
  });

  it("parses multiple VAT branches from one SOAP payload", () => {
    const records = parseRdVatSoapRecords(RD_VAT_SOAP_MULTI, COMPANY.taxId);
    assert.equal(records.length, 2);
    assert.equal(records[0]?.branchCode, "0");
    assert.equal(records[1]?.branchCode, "2");
    assert.equal(records[1]?.streetAddress, "12/1 ถ.พระราม 9");
  });

  it("labels VAT branch codes for invoices", () => {
    assert.equal(formatVatBranchLabel("0"), "สำนักงานใหญ่");
    assert.equal(formatVatBranchLabel(1), "สาขาที่ 1 (00001)");
  });

  it("collects extra VAT branches when BranchNumber 1 returns a distinct address", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      fetchImpl: async (_input, init) => {
        const body = typeof init?.body === "string" ? init.body : "";
        if (body.includes("<vat:BranchNumber>1</vat:BranchNumber>")) {
          return {
            ok: true,
            text: async () => RD_VAT_SOAP_BRANCH_1,
          } as Response;
        }
        if (body.includes("<vat:BranchNumber>0</vat:BranchNumber>") || String(_input).includes("rd.go.th")) {
          return {
            ok: true,
            text: async () => RD_VAT_SOAP,
          } as Response;
        }
        return {
          ok: true,
          text: async () => "",
          json: async () => ({}),
        } as Response;
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok((result.branches?.length || 0) >= 2);
      assert.equal(result.branches?.[0]?.label, "สำนักงานใหญ่");
      assert.equal(result.branches?.[1]?.label, "สาขาที่ 1 (00001)");
      assert.match(result.branches?.[1]?.streetAddress || "", /99/);
    }
  });

  it("maps MOC / DBD juristic payload to a company name", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      fetchImpl: async () =>
        ({
          ok: true,
          text: async () => "",
          json: async () => ({
            juristicNameTH: "บริษัท เทราบิส จำกัด",
            juristicNameEN: "TERABIS COMPANY LIMITED",
            juristicStatus: "ยังดำเนินกิจการ",
            addressDetail: {
              province: "กรุงเทพมหานคร",
              district: "ทุ่งครุ",
              subDistrict: "ทุ่งครุ",
            },
          }),
        }) as Response,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, "บริษัท เทราบิส จำกัด");
      assert.equal(result.source, "dbd_moc");
      assert.equal(result.province, "กรุงเทพมหานคร");
      assert.equal(result.district, "ทุ่งครุ");
    }
  });

  it("uses MOC when the Revenue Department is slower than the wait window", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      preferRdMs: 40,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("rd.go.th")) {
          await new Promise((resolve) => setTimeout(resolve, 180));
          return {
            ok: true,
            text: async () => RD_VAT_SOAP,
          } as Response;
        }
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            juristicNameTH: "บริษัท เทราบิส จำกัด",
            juristicNameEN: "TERABIS COMPANY LIMITED",
            juristicStatus: "ยังดำเนินกิจการ",
            addressDetail: {
              province: "กรุงเทพมหานคร",
              district: "ทุ่งครุ",
              subDistrict: "ทุ่งครุ",
            },
          }),
        } as Response;
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.source, "dbd_moc");
  });

  it("surfaces a Thai message when the DBD source is down", async () => {
    const result = await lookupCompanyByTaxId(COMPANY.taxId, {
      fetchImpl: async () => {
        throw new Error("timeout");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "upstream");
      assert.match(result.error, /กรมสรรพากร/);
    }
  });

  it("parses a Revenue Department JSON name-search payload", () => {
    const records = parseRdVatJsonRecords({
      NID: ["0105556003873", "0105556003873", "0107546000342"],
      TitleName: ["บริษัท", "บริษัท", "บริษัท"],
      Name: ["เทราบิส จำกัด", "เทราบิส จำกัด", "ไทยเบฟเวอเรจ จำกัด (มหาชน)"],
      BranchNumber: [0, 1, 0],
      HouseNumber: ["50/238", "99", "14"],
      SoiName: ["ประชาอุทิศ 72", "-", "-"],
      StreetName: ["-", "สาทร", "-"],
      Thambol: ["ทุ่งครุ", "สีลม", "จตุจักร"],
      Amphur: ["ทุ่งครุ", "บางรัก", "จตุจักร"],
      Province: ["กรุงเทพมหานคร", "กรุงเทพมหานคร", "กรุงเทพมหานคร"],
      PostCode: ["10140", "10500", "10900"],
    });
    assert.equal(records.length, 3);
    const unique = uniqueCompaniesByTaxId(records);
    assert.equal(unique.length, 2);
    assert.equal(unique[0]?.taxId, COMPANY.taxId);
    assert.equal(unique[0]?.streetAddress, "50/238 ซอยประชาอุทิศ 72");
    assert.equal(unique[1]?.name, "บริษัท ไทยเบฟเวอเรจ จำกัด (มหาชน)");
  });

  it("parses Revenue Department JSON when fields are objects instead of arrays", () => {
    const records = parseRdVatJsonRecords({
      NID: { 0: COMPANY.taxId },
      TitleName: { 0: "บริษัท" },
      Name: { 0: "เทราบิส จำกัด" },
      HouseNumber: { 0: "50/238" },
      SoiName: { 0: "ประชาอุทิศ 72" },
      Province: { 0: "กรุงเทพมหานคร" },
    });
    assert.equal(records.length, 1);
    assert.equal(records[0]?.name, "บริษัท เทราบิส จำกัด");
    assert.equal(records[0]?.taxId, COMPANY.taxId);
  });

  it("searches the Revenue Department by company name and fills the HQ address", async () => {
    const jsonBody = JSON.stringify({
      NID: [COMPANY.taxId],
      TitleName: ["บริษัท"],
      Name: ["เทราบิส จำกัด"],
      BranchNumber: [0],
      HouseNumber: ["50/238"],
      SoiName: ["ประชาอุทิศ 72"],
      Thambol: ["ทุ่งครุ"],
      Amphur: ["ทุ่งครุ"],
      Province: ["กรุงเทพมหานคร"],
      PostCode: ["10140"],
    });
    const result = await lookupCompany("เทราบิส", {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("jsonRD")) {
          return {
            ok: true,
            text: async () =>
              `<ServiceResult>${jsonBody.replace(/</g, "&lt;")}</ServiceResult>`,
          } as Response;
        }
        return {
          ok: true,
          text: async () => RD_VAT_SOAP,
        } as Response;
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.needsPick, undefined);
      assert.equal(result.taxId, COMPANY.taxId);
      assert.equal(result.name, COMPANY.legalName);
      assert.equal(result.streetAddress, "50/238 ซอยประชาอุทิศ 72");
    }
  });

  it("asks the buyer to pick when a name matches several tax IDs", async () => {
    const jsonBody = JSON.stringify({
      NID: ["0105544001528", "0107546000342"],
      TitleName: ["บริษัท", "บริษัท"],
      Name: ["ไทยเบฟเวอเรจ มาร์เก็ตติ้ง จำกัด", "ไทยเบฟเวอเรจ จำกัด (มหาชน)"],
      BranchNumber: [0, 0],
      HouseNumber: ["1", "14"],
      Province: ["กรุงเทพมหานคร", "กรุงเทพมหานคร"],
    });
    const result = await lookupCompany("ไทยเบฟ", {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("jsonRD")) {
          return {
            ok: true,
            text: async () =>
              `<ServiceResult>${jsonBody.replace(/</g, "&lt;")}</ServiceResult>`,
          } as Response;
        }
        throw new Error("should not fetch tax id until a company is picked");
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.needsPick, true);
      assert.equal(result.matches?.length, 2);
      assert.equal(result.matches?.[1]?.taxId, "0107546000342");
    }
  });

  it("retries a name without spaces when the spaced query returns nothing", async () => {
    const jsonBody = JSON.stringify({
      NID: ["0105551000000"],
      TitleName: ["บริษัท"],
      Name: ["พีเคคอม จำกัด"],
      BranchNumber: [0],
      HouseNumber: ["1"],
      Province: ["กรุงเทพมหานคร"],
    });
    const names: string[] = [];
    const result = await lookupCompany("พีเค คอม", {
      fetchImpl: async (_input, init) => {
        const body = String(init?.body || "");
        const name = body.match(/<vat:Name>([^<]*)<\/vat:Name>/)?.[1] || "";
        names.push(name);
        if (name === "พีเคคอม") {
          return {
            ok: true,
            text: async () =>
              `<ServiceResult>${jsonBody.replace(/</g, "&lt;")}</ServiceResult>`,
          } as Response;
        }
        return {
          ok: true,
          text: async () => `<ServiceResult>{"NID":[]}</ServiceResult>`,
        } as Response;
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.name, /พีเคคอม/);
      assert.equal(result.taxId, "0105551000000");
    }
    assert.ok(names.includes("พีเค คอม"));
    assert.ok(names.includes("พีเคคอม"));
  });
});
