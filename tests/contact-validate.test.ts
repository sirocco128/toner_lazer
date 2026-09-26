import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailFieldError,
  isValidEmail,
  isValidThaiPhone,
  phoneFieldError,
} from "../lib/contact-validate";

describe("contact email and phone checks", () => {
  it("accepts a company email and rejects incomplete addresses", () => {
    assert.equal(isValidEmail("somchai@acme.co.th"), true);
    assert.equal(isValidEmail("quote@example.com"), true);
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidEmail("user@gmail"), false);
    assert.equal(isValidEmail("user@"), false);
    assert.match(emailFieldError("user@gmail"), /อีเมลไม่ถูกต้อง/);
    assert.match(emailFieldError(""), /กรุณากรอกอีเมล/);
  });

  it("accepts Thai mobile and landline numbers", () => {
    assert.equal(isValidThaiPhone("081-234-5678"), true);
    assert.equal(isValidThaiPhone("02-123-4567"), true);
    assert.equal(isValidThaiPhone("+66812345678"), true);
    assert.equal(isValidThaiPhone("12345"), false);
    assert.equal(isValidThaiPhone("1111111111"), false);
    assert.match(phoneFieldError("12345"), /เบอร์โทรไม่ถูกต้อง/);
    assert.match(phoneFieldError(""), /กรุณากรอกเบอร์โทร/);
  });
});
