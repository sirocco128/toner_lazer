import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/database";
import {
  PARTNER_SCOPES,
  type PartnerPrincipal,
  type PartnerScope,
} from "@/lib/partner-api-types";
import { isSecretConfigured, timingSafeEqualString } from "@/lib/security";

export const PARTNER_TOKEN_PREFIX = "sgp_";
export const ENV_PARTNER_KEY_ID = "env";

type PartnerKeyRow = {
  key_id: string;
  secret_hash: string;
  name: string;
  scopes_json: string;
  enabled: number;
  expires_at: string | null;
  revoked_at: string | null;
};

export function isPartnerScope(value: string): value is PartnerScope {
  return (PARTNER_SCOPES as readonly string[]).includes(value);
}

export function parsePartnerScopes(raw: string | string[] | null | undefined): PartnerScope[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.filter(isPartnerScope))];
  }
  const text = String(raw || "").trim();
  if (!text) return [...PARTNER_SCOPES];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsePartnerScopes(
          parsed.filter((item): item is string => typeof item === "string"),
        );
      }
    } catch {
      return [];
    }
    return [];
  }
  return [
    ...new Set(
      text
        .split(/[,\s]+/)
        .map((part) => part.trim())
        .filter(isPartnerScope),
    ),
  ];
}

export function hashPartnerSecret(keyId: string, secret: string): string {
  return createHash("sha256").update(`${keyId}.${secret}`, "utf8").digest("hex");
}

export function parsePartnerToken(
  token: string,
): { keyId: string; secret: string } | null {
  const trimmed = token.trim();
  if (!trimmed.startsWith(PARTNER_TOKEN_PREFIX)) return null;
  const rest = trimmed.slice(PARTNER_TOKEN_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot < 8) return null;
  const keyId = rest.slice(0, dot);
  const secret = rest.slice(dot + 1);
  if (!/^[a-f0-9]{8,32}$/i.test(keyId) || secret.length < 32) return null;
  return { keyId, secret };
}

function envPartnerKey(): string {
  return (process.env.PARTNER_API_KEY || "").trim();
}

export function isPartnerApiConfigured(): boolean {
  if (isSecretConfigured(envPartnerKey(), 32)) return true;
  try {
    const row = getDb()
      .prepare(
        `SELECT 1 AS ok FROM partner_api_keys
         WHERE enabled = 1 AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)
         LIMIT 1`,
      )
      .get(new Date().toISOString()) as { ok: number } | undefined;
    return Boolean(row);
  } catch {
    return false;
  }
}

export function envPartnerPrincipal(): PartnerPrincipal | null {
  const key = envPartnerKey();
  if (!isSecretConfigured(key, 32)) return null;
  return {
    keyId: ENV_PARTNER_KEY_ID,
    name: (process.env.PARTNER_API_NAME || "env").trim() || "env",
    source: "env",
    scopes: parsePartnerScopes(process.env.PARTNER_API_SCOPES),
  };
}

export function verifyEnvPartnerToken(token: string): PartnerPrincipal | null {
  const principal = envPartnerPrincipal();
  if (!principal) return null;
  const expected = envPartnerKey();
  if (!timingSafeEqualString(expected, token)) return null;
  return principal;
}

function mapRow(row: PartnerKeyRow): PartnerPrincipal {
  return {
    keyId: row.key_id,
    name: row.name,
    source: "db",
    scopes: parsePartnerScopes(row.scopes_json),
  };
}

export function findPartnerKeyById(keyId: string): PartnerKeyRow | null {
  try {
    const row = getDb()
      .prepare(`SELECT key_id, secret_hash, name, scopes_json, enabled, expires_at, revoked_at
                FROM partner_api_keys WHERE key_id = ?`)
      .get(keyId) as PartnerKeyRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

export function verifyDbPartnerToken(token: string, now = new Date()): PartnerPrincipal | null {
  const parsed = parsePartnerToken(token);
  if (!parsed) return null;
  const row = findPartnerKeyById(parsed.keyId);
  if (!row) return null;
  if (!row.enabled || row.revoked_at) return null;
  if (row.expires_at && row.expires_at <= now.toISOString()) return null;
  const expected = row.secret_hash;
  const provided = hashPartnerSecret(parsed.keyId, parsed.secret);
  if (!timingSafeEqualString(expected, provided)) return null;
  return mapRow(row);
}

export function touchPartnerKeyLastUsed(keyId: string, nowIso = new Date().toISOString()): void {
  if (keyId === ENV_PARTNER_KEY_ID) return;
  try {
    getDb()
      .prepare(
        `UPDATE partner_api_keys SET last_used_at = ?, updated_at = ? WHERE key_id = ?`,
      )
      .run(nowIso, nowIso, keyId);
  } catch {
    // table may be missing in tests that only use the env key
  }
}

export type MintPartnerApiKeyInput = {
  name: string;
  scopes?: PartnerScope[];
  expiresAt?: string | null;
};

export type MintedPartnerApiKey = {
  token: string;
  principal: PartnerPrincipal;
};

export function mintPartnerApiKey(input: MintPartnerApiKeyInput): MintedPartnerApiKey {
  const name = input.name.trim();
  if (!name) throw new Error("partner_key_name_required");
  const keyId = randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("hex");
  const scopes = input.scopes?.length ? input.scopes : [...PARTNER_SCOPES];
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO partner_api_keys (
         key_id, secret_hash, name, scopes_json, enabled,
         expires_at, revoked_at, last_used_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 1, ?, NULL, NULL, ?, ?)`,
    )
    .run(
      keyId,
      hashPartnerSecret(keyId, secret),
      name,
      JSON.stringify(scopes),
      input.expiresAt ?? null,
      now,
      now,
    );
  return {
    token: `${PARTNER_TOKEN_PREFIX}${keyId}.${secret}`,
    principal: {
      keyId,
      name,
      source: "db",
      scopes,
    },
  };
}

export function revokePartnerApiKey(keyId: string, nowIso = new Date().toISOString()): boolean {
  const result = getDb()
    .prepare(
      `UPDATE partner_api_keys
       SET revoked_at = ?, enabled = 0, updated_at = ?
       WHERE key_id = ? AND revoked_at IS NULL`,
    )
    .run(nowIso, nowIso, keyId);
  return Number(result.changes ?? 0) > 0;
}
