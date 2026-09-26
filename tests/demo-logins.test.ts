import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authenticateCustomer } from "../lib/customer-auth";
import {
  DEMO_ADMIN_ACCOUNTS,
  DEMO_ADMIN_PASSWORD,
  DEMO_CUSTOMER_ACCOUNTS,
  DEMO_CUSTOMER_PASSWORD,
} from "../lib/demo-logins";

describe("demo logins", () => {
  it("lists admin usernames and the Admin1234 password", () => {
    assert.equal(DEMO_ADMIN_PASSWORD, "Admin1234");
    assert.deepEqual(
      DEMO_ADMIN_ACCOUNTS.map((item) => item.username),
      [
        "superadmin",
        "admin",
        "sales-admin",
        "accountant-admin",
        "warehouse-admin",
        "office-admin",
        "sales",
        "accountant",
        "viewer",
      ],
    );
  });

  it("accepts customer / Customer1234", () => {
    assert.equal(DEMO_CUSTOMER_PASSWORD, "Customer1234");
    assert.equal(DEMO_CUSTOMER_ACCOUNTS[0]?.username, "customer");
    const actor = authenticateCustomer("customer", DEMO_CUSTOMER_PASSWORD);
    assert.equal(actor?.username, "customer");
    assert.equal(authenticateCustomer("customer@local", "Customer1234")?.username, "customer");
    assert.equal(authenticateCustomer("customer", "wrong"), null);
    assert.equal(authenticateCustomer("superadmin", DEMO_CUSTOMER_PASSWORD), null);
  });
});
