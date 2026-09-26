import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authenticateOpsGoogleEmail,
  authenticateOpsUser,
  isGoogleEmailDomainAllowed,
} from "../lib/ops-auth";
import { DEMO_ADMIN_PASSWORD } from "../lib/demo-logins";
import {
  buildGoogleAuthorizeUrl,
  createGoogleOAuthPending,
  exchangeGoogleAuthorizationCode,
  googleAuthRedirectUri,
  googleOAuthCookieOrigin,
  isOpsGoogleAuthConfigured,
  parseGoogleOAuthPending,
  pkceChallenge,
} from "../lib/ops-google-auth";

const KEYS = [
  "ADMIN_SESSION_SECRET",
  "ADMIN_PASSWORD",
  "ADMIN_EMAIL",
  "OPS_USERS",
  "DEMO_ADMIN_PASSWORD",
  "SUPERADMIN_PASSWORD",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_HOSTED_DOMAIN",
  "GOOGLE_ALLOWED_DOMAINS",
  "NEXT_PUBLIC_SITE_URL",
] as const;

function withEnv(
  values: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  run: () => void | Promise<void>,
) {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const apply = () => {
    for (const key of KEYS) {
      if (!(key in values)) continue;
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  apply();
  const restore = () => {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    const result = run();
    if (result && typeof result.then === "function") {
      return result.finally(restore);
    }
  } catch (error) {
    restore();
    throw error;
  }
  restore();
  return undefined;
}

const AUTH_ENV = {
  ADMIN_SESSION_SECRET: "test-ops-session-secret-at-least-32-chars",
  ADMIN_PASSWORD: "test-admin-pass-12",
  ADMIN_EMAIL: "ops-admin@terabis.example",
  GOOGLE_CLIENT_ID: "1234567890-abcdef.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-test-google-secret",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  OPS_USERS: JSON.stringify([
    {
      email: "sales@terabis.example",
      password: "sales-pass-12x",
      role: "sales",
      name: "เซลล์",
    },
  ]),
};

describe("ops Google Sign-In", () => {
  it("is configured only with a Google web client id, secret, and ops session", () => {
    withEnv(
      {
        ...AUTH_ENV,
        GOOGLE_CLIENT_ID: "not-a-google-client",
      },
      () => {
        assert.equal(isOpsGoogleAuthConfigured(), false);
      },
    );
    withEnv(
      {
        ...AUTH_ENV,
        GOOGLE_CLIENT_SECRET: "short",
      },
      () => {
        assert.equal(isOpsGoogleAuthConfigured(), false);
      },
    );
    withEnv(AUTH_ENV, () => {
      assert.equal(isOpsGoogleAuthConfigured(), true);
      assert.equal(
        googleAuthRedirectUri(),
        "http://localhost:3000/api/ops/auth/google/callback",
      );
      assert.equal(
        googleAuthRedirectUri("http://127.0.0.1:3000/ops/login"),
        "http://localhost:3000/api/ops/auth/google/callback",
      );
      assert.equal(
        googleOAuthCookieOrigin("http://127.0.0.1:3000/api/ops/auth/google"),
        "http://localhost:3000",
      );
      assert.equal(
        googleOAuthCookieOrigin("http://localhost:3000/api/ops/auth/google"),
        "http://localhost:3000",
      );
    });
    withEnv(
      {
        ...AUTH_ENV,
        NEXT_PUBLIC_SITE_URL: "https://smartgift.next-dev.net",
      },
      () => {
        assert.equal(
          googleOAuthCookieOrigin("http://0.0.0.0:3000/api/ops/auth/google"),
          "https://smartgift.next-dev.net",
        );
        assert.equal(
          googleAuthRedirectUri("http://0.0.0.0:3000/api/ops/auth/google"),
          "https://smartgift.next-dev.net/api/ops/auth/google/callback",
        );
        assert.equal(
          googleOAuthCookieOrigin("http://0.0.0.0:3000/api/ops/auth/google", {
            "x-forwarded-host": "smartgift.next-dev.net",
            "x-forwarded-proto": "https",
          }),
          "https://smartgift.next-dev.net",
        );
        assert.equal(
          googleOAuthCookieOrigin("http://web:3000/api/ops/auth/google", {
            "x-forwarded-host": "192.168.1.30:33100",
            "x-forwarded-proto": "http",
          }),
          "http://192.168.1.30:33100",
        );
      },
    );
  });

  it("signs and verifies a short-lived PKCE cookie", () => {
    withEnv(AUTH_ENV, () => {
      const pending = createGoogleOAuthPending(1_000);
      const parsed = parseGoogleOAuthPending(pending.cookieValue, 1_000);
      assert.ok(parsed);
      assert.equal(parsed?.state, pending.state);
      assert.equal(parsed?.verifier, pending.verifier);
      assert.equal(parsed?.redirectUri, "http://localhost:3000/api/ops/auth/google/callback");
      assert.equal(parseGoogleOAuthPending(pending.cookieValue, 1_000 + 11 * 60 * 1000), null);
      assert.equal(
        parseGoogleOAuthPending(`${pending.cookieValue.slice(0, -2)}xx`, 1_000),
        null,
      );
    });
  });

  it("builds a Google authorize URL with PKCE and optional hosted domain", () => {
    withEnv(
      {
        ...AUTH_ENV,
        GOOGLE_HOSTED_DOMAIN: "terabis.example",
      },
      () => {
        const pending = createGoogleOAuthPending();
        const url = new URL(
          buildGoogleAuthorizeUrl(pending.state, pending.verifier),
        );
        assert.equal(url.origin, "https://accounts.google.com");
        assert.equal(url.searchParams.get("client_id"), AUTH_ENV.GOOGLE_CLIENT_ID);
        assert.equal(
          url.searchParams.get("redirect_uri"),
          "http://localhost:3000/api/ops/auth/google/callback",
        );
        assert.equal(url.searchParams.get("response_type"), "code");
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        assert.equal(
          url.searchParams.get("code_challenge"),
          pkceChallenge(pending.verifier),
        );
        assert.equal(url.searchParams.get("state"), pending.state);
        assert.equal(url.searchParams.get("hd"), "terabis.example");
        assert.match(url.searchParams.get("scope") || "", /openid/);
        assert.match(url.searchParams.get("scope") || "", /email/);
      },
    );
  });

  it("maps a verified Google email onto existing env staff only", () => {
    withEnv(AUTH_ENV, () => {
      const sales = authenticateOpsGoogleEmail("sales@terabis.example");
      assert.equal(sales?.role, "sales");
      assert.equal(sales?.name, "เซลล์");
      const admin = authenticateOpsGoogleEmail("ops-admin@terabis.example");
      assert.equal(admin?.role, "admin");
      assert.equal(authenticateOpsGoogleEmail("stranger@gmail.com"), null);
      assert.equal(authenticateOpsGoogleEmail("admin"), null);
    });
  });

  it("honours an extra Google email-domain allowlist", () => {
    withEnv(
      {
        ...AUTH_ENV,
        GOOGLE_ALLOWED_DOMAINS: "terabis.example",
      },
      () => {
        assert.equal(isGoogleEmailDomainAllowed("sales@terabis.example"), true);
        assert.equal(isGoogleEmailDomainAllowed("boss@gmail.com"), false);
        assert.equal(authenticateOpsGoogleEmail("sales@terabis.example")?.role, "sales");
      },
    );
  });

  it("exchanges a Google code via PKCE and requires a verified email", async () => {
    await withEnv(AUTH_ENV, async () => {
      const calls: string[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/token")) {
          const body = String(init?.body || "");
          assert.match(body, /code=auth-code/);
          assert.match(body, /code_verifier=verifier-1/);
          return Response.json({ access_token: "ya29.token" });
        }
        return Response.json({
          sub: "google-sub-1",
          email: "sales@terabis.example",
          email_verified: true,
          name: "Sales Google",
        });
      };
      const ok = await exchangeGoogleAuthorizationCode(
        "auth-code",
        "verifier-1",
        fakeFetch,
      );
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.identity.email, "sales@terabis.example");
        assert.equal(ok.identity.sub, "google-sub-1");
      }
      assert.equal(calls[0]?.includes("/token"), true);
      assert.match(calls[1] || "", /userinfo/);
      assert.equal(calls.length, 2);

      const unverified: typeof fetch = async (input) => {
        if (String(input).includes("/token")) {
          return Response.json({ access_token: "ya29.token" });
        }
        return Response.json({
          email: "sales@terabis.example",
          email_verified: false,
        });
      };
      const denied = await exchangeGoogleAuthorizationCode(
        "auth-code",
        "verifier-1",
        unverified,
      );
      assert.equal(denied.ok, false);
      if (!denied.ok) assert.equal(denied.reason, "unverified");
    });
  });

  it("accepts a Google id_token even when userinfo is unreachable", async () => {
    await withEnv(AUTH_ENV, async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          iss: "https://accounts.google.com",
          aud: AUTH_ENV.GOOGLE_CLIENT_ID,
          email: "sales@terabis.example",
          email_verified: true,
          name: "Sales Google",
          sub: "google-sub-1",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      const idToken = `${header}.${payload}.sig`;
      const fakeFetch: typeof fetch = async (input) => {
        if (String(input).includes("/token")) {
          return Response.json({
            access_token: "ya29.token",
            id_token: idToken,
          });
        }
        return new Response("", { status: 401 });
      };
      const ok = await exchangeGoogleAuthorizationCode(
        "auth-code",
        "verifier-1",
        fakeFetch,
      );
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.identity.email, "sales@terabis.example");
        assert.equal(ok.identity.sub, "google-sub-1");
      }
    });
  });

  it("maps the admin username alias onto ADMIN_EMAIL for password login", () => {
    withEnv(AUTH_ENV, () => {
      const actor = authenticateOpsUser("admin", AUTH_ENV.ADMIN_PASSWORD);
      assert.equal(actor?.email, AUTH_ENV.ADMIN_EMAIL);
      assert.equal(actor?.role, "admin");
    });
  });

  it("logs in seeded SuperAdmin and department admins with Admin1234", () => {
    withEnv({ ...AUTH_ENV, DEMO_ADMIN_PASSWORD: undefined, SUPERADMIN_PASSWORD: undefined }, () => {
      const superadmin = authenticateOpsUser("superadmin", DEMO_ADMIN_PASSWORD);
      assert.equal(superadmin?.email, "superadmin");
      assert.equal(superadmin?.role, "superadmin");
      const salesAdmin = authenticateOpsUser("sales-admin", DEMO_ADMIN_PASSWORD);
      assert.equal(salesAdmin?.role, "sales_admin");
      const warehouseAdmin = authenticateOpsUser(
        "warehouse-admin@local",
        DEMO_ADMIN_PASSWORD,
      );
      assert.equal(warehouseAdmin?.role, "warehouse_admin");
      const sales = authenticateOpsUser("sales", DEMO_ADMIN_PASSWORD);
      assert.equal(sales?.role, "sales");
      assert.equal(authenticateOpsUser("superadmin", AUTH_ENV.ADMIN_PASSWORD), null);
    });
  });
});
