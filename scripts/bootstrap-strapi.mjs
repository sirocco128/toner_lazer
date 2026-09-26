#!/usr/bin/env node
/**
 * Non-interactive local Strapi bootstrap for P1-CMS-001 (dev path).
 *
 * 1. Reminds / checks Postgres (docker compose up -d postgres)
 * 2. Ensures ./cms exists (committed skeleton, or create-strapi-app, or fallback skeleton)
 * 3. Syncs schemas from strapi/content-types/* and strapi/components/shared/seo.json
 * 4. Prints next steps (develop, admin, RBAC, webhook)
 *
 * Env:
 *   SKIP_CREATE_STRAPI=1  — never call create-strapi-app (use skeleton only)
 *   FORCE_SCHEMA_SYNC=1   — always overwrite schema.json from blueprints (default)
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CMS = join(ROOT, "cms");
const BLUEPRINTS = join(ROOT, "strapi");
const CONTENT_TYPES = [
  "product",
  "gift-set-category",
  "article",
  "faq",
  "portfolio",
];

function log(msg) {
  console.log(msg);
}

function warn(msg) {
  console.warn(msg);
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function writeIfMissing(filePath, contents) {
  if (existsSync(filePath)) return false;
  ensureDir(dirname(filePath));
  writeFileSync(filePath, contents, "utf8");
  return true;
}

function writeFile(filePath, contents) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, contents, "utf8");
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

async function isPostgresUp() {
  const { createConnection } = await import("node:net");
  return new Promise((resolveProbe) => {
    const client = createConnection({ host: "127.0.0.1", port: 5432 }, () => {
      client.end();
      resolveProbe(true);
    });
    client.on("error", () => resolveProbe(false));
    client.setTimeout(1500, () => {
      client.destroy();
      resolveProbe(false);
    });
  });
}

function tryCreateStrapiApp() {
  log("\n→ Trying create-strapi-app (non-interactive, postgres)…");
  ensureDir(CMS);
  const args = [
    "--yes",
    "create-strapi-app@5.52.3",
    ".",
    "--non-interactive",
    "--typescript",
    "--no-run",
    "--skip-cloud",
    "--no-example",
    "--no-git-init",
    "--no-enable-ab-tests",
    "--use-npm",
    "--install",
    "--dbclient=postgres",
    "--dbhost=127.0.0.1",
    "--dbport=5432",
    "--dbname=giftset",
    "--dbusername=giftset",
    "--dbpassword=giftset",
    "--dbssl=false",
  ];
  const result = spawnSync("npx", args, {
    cwd: CMS,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_CLIENT: "postgres",
      DATABASE_HOST: "127.0.0.1",
      DATABASE_PORT: "5432",
      DATABASE_NAME: "giftset",
      DATABASE_USERNAME: "giftset",
      DATABASE_PASSWORD: "giftset",
      DATABASE_SSL: "false",
    },
  });
  return result.status === 0 && existsSync(join(CMS, "package.json"));
}

function writeSkeleton() {
  log("\n→ Writing minimal Strapi v5 skeleton into ./cms …");

  writeFile(
    join(CMS, "package.json"),
    `${JSON.stringify(
      {
        name: "premium-giftset-cms",
        version: "0.1.0",
        private: true,
        description: "Local Strapi v5 CMS for Premium Gift Set (Sprint 1)",
        scripts: {
          build: "strapi build",
          console: "strapi console",
          develop: "strapi develop",
          start: "strapi start",
          strapi: "strapi",
        },
        dependencies: {
          "@strapi/provider-upload-aws-s3": "5.52.3",
          "@strapi/plugin-cloud": "5.52.3",
          "@strapi/plugin-users-permissions": "5.52.3",
          "@strapi/strapi": "5.52.3",
          pg: "8.23.0",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "react-router-dom": "^6.30.1",
          "styled-components": "^6.1.18",
          typescript: "^5.9.2",
        },
        engines: {
          node: ">=20.0.0 <=24.x.x",
          npm: ">=6.0.0",
        },
        strapi: {
          uuid: "00000000-0000-4000-8000-000000000001",
        },
      },
      null,
      2,
    )}\n`,
  );

  writeFile(
    join(CMS, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "CommonJS",
          moduleResolution: "node",
          lib: ["ES2020"],
          target: "ES2019",
          strict: false,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          incremental: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          noEmitOnError: true,
          noImplicitThis: true,
          outDir: "dist",
          rootDir: ".",
        },
        include: ["./", "./**/*.ts", "./**/*.js", "src/**/*.json"],
        exclude: [
          "node_modules/",
          "build/",
          "dist/",
          ".cache/",
          ".tmp/",
          "src/admin/",
          "**/*.test.*",
        ],
      },
      null,
      2,
    )}\n`,
  );

  writeFile(
    join(CMS, "config/database.ts"),
    `export default ({ env }) => ({
  connection: {
    client: "postgres",
    connection: {
      host: env("DATABASE_HOST", "127.0.0.1"),
      port: env.int("DATABASE_PORT", 5432),
      database: env("DATABASE_NAME", "giftset"),
      user: env("DATABASE_USERNAME", "giftset"),
      password: env("DATABASE_PASSWORD", "giftset"),
      ssl: env.bool("DATABASE_SSL", false) && {
        rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", true),
      },
      schema: env("DATABASE_SCHEMA", "public"),
    },
    pool: {
      min: env.int("DATABASE_POOL_MIN", 0),
      max: env.int("DATABASE_POOL_MAX", 10),
    },
    acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
  },
});
`,
  );

  writeFile(
    join(CMS, "config/server.ts"),
    `export default ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  app: {
    keys: env.array("APP_KEYS"),
  },
});
`,
  );

  writeFile(
    join(CMS, "config/admin.ts"),
    `export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT"),
    },
  },
  secrets: {
    encryptionKey: env("ENCRYPTION_KEY"),
  },
  flags: {
    nps: env.bool("FLAG_NPS", true),
    promoteEE: env.bool("FLAG_PROMOTE_EE", true),
  },
});
`,
  );

  writeFile(
    join(CMS, "config/api.ts"),
    `export default {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
};
`,
  );

  writeFile(
    join(CMS, "config/middlewares.ts"),
    `export default ({ env }) => {
  const minio = String(env("MINIO_ENDPOINT", "http://127.0.0.1:9000")).replace(
    /\\/+$/,
    "",
  );

  return [
    "strapi::logger",
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:", "http:"],
            "img-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              minio,
              "http://127.0.0.1:9000",
              "http://localhost:9000",
            ],
            "media-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              minio,
              "http://127.0.0.1:9000",
              "http://localhost:9000",
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    "strapi::cors",
    "strapi::poweredBy",
    "strapi::query",
    "strapi::body",
    "strapi::session",
    "strapi::favicon",
    "strapi::public",
  ];
};
`,
  );

  writeFile(
    join(CMS, "config/plugins.ts"),
    `export default ({ env }) => {
  const minioEndpoint = String(env("MINIO_ENDPOINT", "")).replace(/\\/+$/, "");
  const accessKey = env("MINIO_ACCESS_KEY", "");
  const secretKey = env("MINIO_SECRET_KEY", "");
  const bucket = env("MINIO_BUCKET_PUBLIC", "terabis-public");
  const region = env("MINIO_REGION", "us-east-1");
  const useMinio = Boolean(minioEndpoint && accessKey && secretKey);
  const publicBase =
    env("MINIO_PUBLIC_BASE_URL", "") ||
    (useMinio ? \`\${minioEndpoint}/\${bucket}\` : "");

  return {
    seo: {
      enabled: true,
    },
    ...(useMinio
      ? {
          upload: {
            config: {
              provider: "aws-s3",
              providerOptions: {
                baseUrl: publicBase,
                rootPath: env("MINIO_CMS_ROOT", "cms"),
                s3Options: {
                  credentials: {
                    accessKeyId: accessKey,
                    secretAccessKey: secretKey,
                  },
                  endpoint: minioEndpoint,
                  region,
                  forcePathStyle: true,
                  params: {
                    Bucket: bucket,
                  },
                },
              },
              actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
              },
            },
          },
        }
      : {}),
  };
};
`,
  );

  writeFile(
    join(CMS, "src/index.ts"),
    `export default {
  register() {},
  bootstrap() {},
};
`,
  );

  writeFile(join(CMS, "public/robots.txt"), "User-agent: *\nDisallow: /\n");
  writeFile(join(CMS, "public/uploads/.gitkeep"), "");

  writeFile(
    join(CMS, ".gitignore"),
    `############################
# OS / IDE
############################
.DS_Store
.idea/
.vscode/

############################
# Node
############################
node_modules/
npm-debug.log*
yarn-error.log*
.pnpm-debug.log*

############################
# Strapi
############################
.env
.env.local
.tmp/
.cache/
build/
dist/
.strapi/
.strapi-updater.json
exports/
types/generated/
public/uploads/*
!public/uploads/.gitkeep
*.db
*.sqlite
*.sqlite-*
`,
  );

  writeFile(
    join(CMS, ".env.example"),
    `# Local Strapi — copy to .env (bootstrap does this automatically)
HOST=0.0.0.0
PORT=1337
APP_KEYS=toBeModified1,toBeModified2,toBeModified3,toBeModified4
API_TOKEN_SALT=tobemodified
ADMIN_JWT_SECRET=tobemodified
TRANSFER_TOKEN_SALT=tobemodified
ENCRYPTION_KEY=tobemodified
JWT_SECRET=tobemodified

DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=giftset
DATABASE_USERNAME=giftset
DATABASE_PASSWORD=giftset
DATABASE_SSL=false
DATABASE_POOL_MIN=0

# MinIO — public catalog media (docker compose up -d minio minio-init)
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=giftset-app
MINIO_SECRET_KEY=giftsetAppDevKey1
MINIO_BUCKET_PUBLIC=terabis-public
MINIO_REGION=us-east-1
MINIO_PUBLIC_BASE_URL=http://127.0.0.1:9000/terabis-public
MINIO_CMS_ROOT=cms
`,
  );

  writeFile(
    join(CMS, "README.md"),
    `# Premium Gift Set — local Strapi CMS

Sprint 1 local/dev CMS for P1-CMS-001. Schemas are synced from \`../strapi/\`.

## Quick start

\`\`\`bash
# from repo root
docker compose up -d postgres
npm run cms:bootstrap
cd cms
npm install
npm run develop
\`\`\`

Open http://localhost:1337/admin and create the first admin user.

Media: \`npm run minio:up\` then \`npm run cms:media:minio\` so product photos live in MinIO instead of \`public/uploads\`.

Full guide: [docs/SPRINT1-LOCAL-CMS.md](../docs/SPRINT1-LOCAL-CMS.md)
`,
  );

  for (const uid of CONTENT_TYPES) {
    ensureApiFactories(uid);
  }
}

function ensureApiFactories(uid) {
  const apiRoot = join(CMS, "src/api", uid);
  const uidLiteral = `api::${uid}.${uid}`;

  writeIfMissing(
    join(apiRoot, "controllers", `${uid}.ts`),
    `import { factories } from "@strapi/strapi";

export default factories.createCoreController("${uidLiteral}");
`,
  );

  writeIfMissing(
    join(apiRoot, "services", `${uid}.ts`),
    `import { factories } from "@strapi/strapi";

export default factories.createCoreService("${uidLiteral}");
`,
  );

  writeIfMissing(
    join(apiRoot, "routes", `${uid}.ts`),
    `import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("${uidLiteral}");
`,
  );
}

function syncSchemas() {
  log("\n→ Syncing schemas from strapi/ into cms/src/…");

  const seoSrc = join(BLUEPRINTS, "components/shared/seo.json");
  const seoDest = join(CMS, "src/components/shared/seo.json");
  if (!existsSync(seoSrc)) {
    throw new Error(`Missing blueprint: ${seoSrc}`);
  }
  ensureDir(dirname(seoDest));
  copyFileSync(seoSrc, seoDest);
  log(`  components/shared/seo.json`);

  for (const uid of CONTENT_TYPES) {
    const src = join(BLUEPRINTS, "content-types", uid, "schema.json");
    if (!existsSync(src)) {
      throw new Error(`Missing blueprint: ${src}`);
    }
    const dest = join(
      CMS,
      "src/api",
      uid,
      "content-types",
      uid,
      "schema.json",
    );
    ensureDir(dirname(dest));
    copyFileSync(src, dest);
    ensureApiFactories(uid);
    log(`  api/${uid}/content-types/${uid}/schema.json`);
  }
}

function ensureEnv() {
  const envPath = join(CMS, ".env");
  if (existsSync(envPath)) {
    log("\n→ cms/.env already present (left unchanged)");
    return;
  }
  const keys = [secret(16), secret(16), secret(16), secret(16)].join(",");
  const body = `# Generated by scripts/bootstrap-strapi.mjs — local only, do not commit
HOST=0.0.0.0
PORT=1337
APP_KEYS=${keys}
API_TOKEN_SALT=${secret()}
ADMIN_JWT_SECRET=${secret()}
TRANSFER_TOKEN_SALT=${secret()}
ENCRYPTION_KEY=${secret()}
JWT_SECRET=${secret()}

DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=giftset
DATABASE_USERNAME=giftset
DATABASE_PASSWORD=giftset
DATABASE_SSL=false
DATABASE_POOL_MIN=0

MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=giftset-app
MINIO_SECRET_KEY=giftsetAppDevKey1
MINIO_BUCKET_PUBLIC=terabis-public
MINIO_REGION=us-east-1
MINIO_PUBLIC_BASE_URL=http://127.0.0.1:9000/terabis-public
MINIO_CMS_ROOT=cms
`;
  writeFile(envPath, body);
  log("\n→ Wrote cms/.env with local secrets + postgres giftset credentials");
}

function printNextSteps(postgresOk) {
  log(`
════════════════════════════════════════════════════════════
 Local CMS bootstrap complete
════════════════════════════════════════════════════════════

Postgres: ${postgresOk ? "port 5432 reachable" : "NOT reachable yet"}
${!postgresOk
    ? `
Start Postgres first:
  docker compose up -d postgres
`
    : ""}
Next steps:
  1. cd cms && npm install
  2. npm run develop
  3. Open http://localhost:1337/admin — create the first admin user
  4. RBAC: Public role → find/findOne only on published collections
  5. API Tokens → create Read-only token → set STRAPI_API_TOKEN in Next.js .env.local
  6. Webhooks → POST http://localhost:3000/api/revalidate
     Header: Authorization: Bearer <REVALIDATE_SECRET>
     See strapi/templates/webhook-revalidate.md
  7. Next.js .env.local:
       CMS_MODE=strapi
       STRAPI_URL=http://localhost:1337
       STRAPI_API_TOKEN=...
       REVALIDATE_SECRET=...   # ≥32 chars

Docs: docs/SPRINT1-LOCAL-CMS.md
Lead SQLite backup: npm run backup:leads
Strapi DB dump:     docker compose exec postgres pg_dump -U giftset giftset > .data/backups/strapi-$(date +%Y%m%d).sql
`);
}

async function main() {
  log("Premium Gift Set — Strapi local bootstrap (P1-CMS-001)");
  log(`Repo: ${ROOT}`);

  log("\n→ Checking Postgres on 127.0.0.1:5432 …");
  let postgresOk = await isPostgresUp();
  if (!postgresOk) {
    warn("  Postgres not reachable.");
    warn("  Start it with: docker compose up -d postgres");
    const compose = spawnSync(
      "docker",
      ["compose", "up", "-d", "postgres"],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (compose.status === 0) {
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        postgresOk = await isPostgresUp();
        if (postgresOk) break;
      }
    }
    if (!postgresOk) {
      warn("  Still not up — continue anyway; start Postgres before npm run develop.");
    } else {
      log("  Postgres is up.");
    }
  } else {
    log("  Postgres is up.");
  }

  const hasPackage = existsSync(join(CMS, "package.json"));
  const skipCreate = process.env.SKIP_CREATE_STRAPI === "1";

  if (!hasPackage) {
    let created = false;
    if (!skipCreate) {
      try {
        created = tryCreateStrapiApp();
      } catch (err) {
        warn(`  create-strapi-app failed: ${err?.message || err}`);
      }
    }
    if (!created) {
      writeSkeleton();
    }
  } else {
    log("\n→ ./cms already exists — keeping package/config, syncing schemas");
    // Ensure factories + gitignore exist even on older trees
    for (const uid of CONTENT_TYPES) ensureApiFactories(uid);
    writeIfMissing(
      join(CMS, ".gitignore"),
      `node_modules/\n.tmp/\n.cache/\nbuild/\ndist/\nexports/\n.env\n.strapi/\ntypes/generated/\npublic/uploads/*\n!public/uploads/.gitkeep\n`,
    );
  }

  syncSchemas();
  ensureEnv();

  // List blueprints for sanity
  const listed = readdirSync(join(BLUEPRINTS, "content-types"));
  log(`\nBlueprint content-types: ${listed.join(", ")}`);

  printNextSteps(postgresOk);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
