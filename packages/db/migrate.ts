#!/usr/bin/env node
/**
 * Substrate DB migration runner — Sprint substrate-db-migration-runner-001 (2026-05-21).
 *
 * Reads all `*_DDL` / `*_SCHEMA_SQL` constants from `packages/db/company/*.ts`
 * and executes them in sequence against `DATABASE_URL`.
 *
 * Runs as a turbo `migrate` task BEFORE `web#build` (per root turbo.json
 * dependsOn chain) so the database has its tables before Next.js's static
 * generation or any server-component pre-render queries the DB.
 *
 * Idempotent: relies on CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
 * in the DDL constants. Safe to re-run on every build.
 *
 * Failure modes:
 *   - DATABASE_URL not set, VERCEL_ENV=production → exit 1, build fails LOUD
 *     (provisioning-database-url-injection-fix-001: an unmigrated production
 *     DB must surface at deploy time, not via a post-deploy audit)
 *   - DATABASE_URL not set, preview/dev          → warn + exit 0 (no DB is OK)
 *   - DB connection fails     → exit 1, build fails (Vercel surfaces error)
 *   - DDL SQL error           → exit 1, build fails
 *   - No DDL constants found  → exit 0 (substrate without per-company tables)
 *
 * Live evidence (Verifolio, 2026-05-21): pre-fix the substrate's packages/db/
 * index.ts was a stub. Verifolio's Neon DB had ZERO tables. F1-003's /templates
 * page queried coi_compliance_templates → asyncpg.UndefinedColumnError → HTTP
 * 500. This script closes that gap by running the DDL at build time.
 */

import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";

interface DdlEntry {
  file: string;
  constant: string;
  sql: string;
}

interface LegoSchemaEntry {
  lego: string;
  file: string;
  sql: string;
}

/**
 * Collect every `legos/<lego>/schema/*.sql` file bundled with the substrate.
 *
 * Sprint buildspec-auth-fix-001 (2026-06-01). Pre-fix this runner applied ONLY
 * `packages/db/company/*.ts` DDL constants — the bundled legos' own schema
 * (users / sessions / billing_* / etc.) was never created in the company DB.
 * Live evidence (Buildspec): POST /api/auth/login → 500 because `users` did
 * not exist; the auth-gated pages then redirected to a non-existent login page
 * → 405. This closes the schema half of that gap.
 *
 * Returned sorted by (lego, file) so per-lego filename order (001 → 002 → 003)
 * is preserved — within-lego FKs depend on it. No cross-lego FKs exist, so
 * lego order itself is irrelevant. Every schema file is idempotent
 * (CREATE TABLE/INDEX IF NOT EXISTS), so this is safe to run on every build.
 */
function collectLegoSchemas(): LegoSchemaEntry[] {
  const legosDir = resolve(__dirname, "..", "..", "legos");
  let legoNames: string[];
  try {
    legoNames = readdirSync(legosDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    console.log(`[db/migrate] No legos/ directory at ${legosDir} — skipping lego schemas`);
    return [];
  }

  const entries: LegoSchemaEntry[] = [];
  for (const lego of legoNames) {
    const schemaDir = join(legosDir, lego, "schema");
    let sqlFiles: string[];
    try {
      sqlFiles = readdirSync(schemaDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      continue; // lego has no schema/ dir
    }
    for (const file of sqlFiles) {
      const sql = readFileSync(join(schemaDir, file), "utf8");
      if (sql.trim().length > 0) {
        entries.push({ lego, file, sql });
      }
    }
  }
  return entries;
}

// ── build-time table-reference check ───────────────────────────────────────
//
// Catches the class where a generated feature queries a base table the build
// never CREATEs. Live evidence (CondoCentral, 2026-06-23): apps/web/lib/hoa/
// violations.ts queried `hoa_violations` but no DDL constant ever created it →
// "relation hoa_violations does not exist" → /violations HTTP 500. Static check:
// collect every table created by a lego schema or a company *_DDL/_SCHEMA_SQL
// constant, scan apps/web for `FROM|JOIN|INTO|UPDATE <table>` references, and
// FAIL the build LOUD on any reference with no creating DDL — so the gap
// surfaces at deploy time, not via a post-deploy 500.
//
// Conservative by design (false positives would block deploys): only UPPERCASE
// SQL keywords are matched (so `Array.from`, prose, lowercase ≠ table refs);
// schema-qualified refs (information_schema.* / pg_*), CTE names (`WITH x AS (`),
// and dynamic `${...}` identifiers are all ignored. Escape hatch:
// DB_TABLE_CHECK=warn|off (default "error"); DB_TABLE_CHECK_ALLOW=comma,list
// adds known-safe identifiers.

const CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/gi;
// Uppercase keywords only — matches the codebase's SQL convention, avoids
// `Array.from(` / prose "from" false positives. `\s+<identifier>` so `FROM (`
// (subquery) and `FROM ${...}` (dynamic) never match.
const TABLE_REF_RE = /\b(FROM|JOIN|INTO|UPDATE)\s+("?[A-Za-z_][\w.]*"?)/g;
const CTE_RE = /(?:\bWITH|,)\s+("?[A-Za-z_]\w*"?)\s+AS\s*\(/gi;
// SQL keywords that can immediately follow FROM/JOIN/INTO/UPDATE but are NOT
// tables — chiefly `SET` from `... ON CONFLICT ... DO UPDATE SET`.
const REF_RESERVED = new Set<string>([
  "set", "select", "values", "where", "on", "using", "as", "returning",
  "and", "or", "not", "null", "do", "nothing", "default", "from", "join",
  "into", "update", "lateral", "only", "distinct", "with", "union", "all",
  "group", "order", "limit", "offset",
]);

function normalizeTable(raw: string): string {
  let t = raw.replace(/"/g, "").toLowerCase();
  if (t.includes(".")) t = t.split(".").pop() as string; // strip schema qualifier
  return t;
}

function tablesInSql(sql: string, re: RegExp): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return out;
}

/** Every table created by a bundled lego schema or a company *_DDL constant. */
function collectCreatedTables(): Set<string> {
  const created = new Set<string>();
  for (const s of collectLegoSchemas()) {
    for (const raw of tablesInSql(s.sql, CREATE_TABLE_RE)) created.add(normalizeTable(raw));
  }
  const companyDir = resolve(__dirname, "company");
  let tsFiles: string[] = [];
  try {
    tsFiles = readdirSync(companyDir).filter((f) => f.endsWith(".ts"));
  } catch {
    /* no company/ dir */
  }
  for (const file of tsFiles) {
    // Read as TEXT and regex CREATE TABLE out of the DDL template strings —
    // no import/exec needed (and avoids running company modules twice).
    const text = readFileSync(join(companyDir, file), "utf8");
    for (const raw of tablesInSql(text, CREATE_TABLE_RE)) created.add(normalizeTable(raw));
  }
  return created;
}

function walkSourceFiles(dir: string, acc: string[]): void {
  let entries: ReturnType<typeof readdirSync> & { name: string; isDirectory: () => boolean }[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as never;
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walkSourceFiles(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) acc.push(full);
  }
}

interface RefScan {
  refs: Map<string, Set<string>>; // table → files referencing it
  ctes: Set<string>; // CTE names (per-build, treated as known)
}

/** Scan apps/web source for table references in raw SQL. */
function scanAppReferences(appDir: string): RefScan {
  const files: string[] = [];
  walkSourceFiles(appDir, files);
  const refs = new Map<string, Set<string>>();
  const ctes = new Set<string>();
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const raw of tablesInSql(text, CTE_RE)) ctes.add(normalizeTable(raw));
    TABLE_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TABLE_REF_RE.exec(text)) !== null) {
      const kw = m[1].toUpperCase();
      const raw = m[2];
      const lower = raw.replace(/"/g, "").toLowerCase();
      if (lower.startsWith("information_schema") || lower.startsWith("pg_")) continue;
      // Table-valued function, not a table: identifier followed by "(" — e.g.
      // FROM now(), FROM unnest(...), FROM generate_series(...). Applies ONLY to
      // FROM/JOIN: after INTO a "(" is an INSERT column list (a real table), and
      // UPDATE is never followed by "(".
      if (
        (kw === "FROM" || kw === "JOIN") &&
        /^\s*\(/.test(text.slice(m.index + m[0].length))
      ) {
        continue;
      }
      const t = normalizeTable(raw);
      if (!t || REF_RESERVED.has(t) || t.startsWith("pg_")) continue;
      if (!refs.has(t)) refs.set(t, new Set());
      refs.get(t)!.add(f.replace(appDir, "apps/web"));
    }
  }
  return { refs, ctes };
}

/**
 * FAIL the build if apps/web references a base table that no lego schema or
 * company DDL constant creates. Runs on every build (before the DB step) so the
 * gap is caught in preview/dev/prod alike. Never throws on its own internal
 * errors — only a genuine missing-table violation can fail the build.
 */
function verifyTableReferences(): void {
  const mode = (process.env.DB_TABLE_CHECK || "error").toLowerCase();
  if (mode === "off") {
    console.log("[db/migrate] table-reference check disabled (DB_TABLE_CHECK=off)");
    return;
  }
  try {
    const appDir = resolve(__dirname, "..", "..", "apps", "web");
    const created = collectCreatedTables();
    if (created.size === 0) {
      console.log("[db/migrate] table-reference check: no created tables discovered — skipping");
      return;
    }
    const allow = new Set(
      (process.env.DB_TABLE_CHECK_ALLOW || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const { refs, ctes } = scanAppReferences(appDir);
    const violations: Array<{ table: string; files: string[] }> = [];
    for (const [table, fileSet] of refs) {
      if (created.has(table) || ctes.has(table) || allow.has(table)) continue;
      violations.push({ table, files: [...fileSet].sort() });
    }
    if (violations.length === 0) {
      console.log(
        `[db/migrate] table-reference check OK — ${refs.size} referenced table(s) all have creating DDL (${created.size} known)`,
      );
      return;
    }
    violations.sort((a, b) => a.table.localeCompare(b.table));
    const lines = violations
      .map((v) => `  - "${v.table}" referenced in: ${v.files.join(", ")}`)
      .join("\n");
    const msg =
      `[db/migrate] table-reference check FAILED: ${violations.length} table(s) are queried by ` +
      `apps/web but created by NO lego schema or company *_DDL constant. A page that queries ` +
      `one of these will 500 with "relation ... does not exist" (see CondoCentral /violations, ` +
      `2026-06-23). Add the missing CREATE TABLE to packages/db/company/*.ts (a *_DDL constant), ` +
      `or fix the table name in the query:\n${lines}`;
    if (mode === "warn") {
      console.warn(msg + "\n[db/migrate] (DB_TABLE_CHECK=warn — not failing the build)");
      return;
    }
    console.error(msg);
    process.exit(1);
  } catch (err) {
    // The check must never break a build on its OWN bug — only on a real
    // missing-table finding (which exits above). Degrade to a warning.
    console.warn(`[db/migrate] table-reference check skipped (internal error, non-fatal): ${err}`);
  }
}

interface SeedClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

/**
 * Seed the admin-console nav sections so AdminShell's nav lists the bundled
 * admin pages (the lego ships the tables but seeds no sections). Idempotent
 * via UNIQUE (lego_name, section_name). Best-effort — never throws.
 *
 * Sprint substrate-admin-surface-001 (2026-06-01).
 */
async function seedAdminSections(client: SeedClient): Promise<void> {
  const sections: Array<{ name: string; order: number; routes: string[] }> = [
    { name: "Feature Flags", order: 10, routes: ["/admin/feature-flags"] },
    { name: "System Config", order: 20, routes: ["/admin/system-config"] },
    { name: "Audit Log", order: 30, routes: ["/admin/audit-log"] },
  ];
  for (const s of sections) {
    try {
      await client.query(
        `INSERT INTO admin_sections (lego_name, section_name, section_order, permissions, routes)
         VALUES ('admin-console', $1, $2, $3, $4)
         ON CONFLICT (lego_name, section_name)
         DO UPDATE SET section_order = EXCLUDED.section_order, routes = EXCLUDED.routes`,
        [s.name, s.order, ["admin"], s.routes],
      );
      console.log(`[db/migrate]   seeded admin section "${s.name}"`);
    } catch (err) {
      console.warn(`[db/migrate]   WARN seed admin section "${s.name}" (non-fatal): ${err}`);
    }
  }
}

/**
 * Seed two fixed test accounts into EVERY build for testing:
 *   - testuser@nexusaiholdings.com  (regular user)
 *   - admintest@nexusaiholdings.com (admin — must be in ADMIN_EMAILS to reach /admin)
 *
 * Passwords default to TestUser!2026 / AdminTest!2026 (override via
 * TEST_USER_PASSWORD / ADMIN_TEST_PASSWORD). Hashing reuses the identity
 * lego's scrypt hashPassword so the seeded hash verifies on login. Idempotent
 * (ON CONFLICT (email) DO NOTHING). Best-effort — never throws.
 *
 * Gated by SEED_TEST_USERS (default "true"). SECURITY: set SEED_TEST_USERS=false
 * before any real customer launch — these are incubation-phase test accounts.
 *
 * Sprint substrate-admin-surface-001 (2026-06-01).
 */
async function seedTestUsers(client: SeedClient): Promise<void> {
  if ((process.env.SEED_TEST_USERS || "true").toLowerCase() === "false") {
    console.log("[db/migrate] SEED_TEST_USERS=false — skipping test-user seed");
    return;
  }

  const cryptoPath = resolve(
    __dirname,
    "..",
    "..",
    "legos",
    "identity-and-access",
    "api",
    "_lib",
    "crypto.ts",
  );
  let hashPassword: (plain: string) => string;
  try {
    const mod = (await import(pathToFileURL(cryptoPath).href)) as {
      hashPassword: (plain: string) => string;
    };
    hashPassword = mod.hashPassword;
  } catch (err) {
    console.warn(`[db/migrate] WARN cannot import hashPassword — skipping test-user seed: ${err}`);
    return;
  }

  const accounts: Array<{ email: string; password: string }> = [
    {
      email: "testuser@nexusaiholdings.com",
      password: process.env.TEST_USER_PASSWORD || "TestUser!2026",
    },
    {
      email: "admintest@nexusaiholdings.com",
      password: process.env.ADMIN_TEST_PASSWORD || "AdminTest!2026",
    },
  ];
  for (const a of accounts) {
    try {
      await client.query(
        `INSERT INTO users (email, password_hash, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (email) DO NOTHING`,
        [a.email, hashPassword(a.password)],
      );
      console.log(`[db/migrate]   seeded test user ${a.email}`);
    } catch (err) {
      console.warn(`[db/migrate]   WARN seed test user ${a.email} (non-fatal): ${err}`);
    }
  }
}

async function main(): Promise<void> {
  // Static build-time guard (no DB needed): fail loud if apps/web queries a
  // table that no schema/DDL creates. Runs FIRST so the gap surfaces on every
  // build target before any DB work. (admin-data-001 follow-up / CondoCentral
  // /violations 500.)
  verifyTableReferences();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    // provisioning-database-url-injection-fix-001 (2026-06-09): a missing
    // DATABASE_URL on a PRODUCTION build is a deploy-blocking error, not a
    // silent skip. The Verifolio incident shipped a live company with an empty
    // DB because this path exited 0 silently — the unmigrated DB was caught
    // only by a post-deploy audit. On production targets we now FAIL the build
    // loud so a provisioning env-injection gap surfaces at deploy time.
    // Preview/dev deploys legitimately have no DB → loud warning, exit 0.
    if (process.env.VERCEL_ENV === "production") {
      console.error(
        "[db/migrate] FATAL: DATABASE_URL is not set on a PRODUCTION build. " +
          "The company database cannot be migrated and the app would ship with " +
          "an empty DB (broken /dashboard, analytics, and every DB-backed page). " +
          "This almost always means provisioning failed to inject DATABASE_URL " +
          "(see provisioning-database-url-injection-fix-001). Failing the build.",
      );
      process.exit(1);
    }
    console.warn(
      "[db/migrate] WARNING: DATABASE_URL not set — skipping migration. " +
        "Expected in local dev / Vercel preview without a DB; this would be " +
        "FATAL on a production target.",
    );
    return;
  }

  // Bundled lego schemas (users / sessions / billing_* / etc.) — applied
  // BEFORE company DDL so company tables can reference lego tables.
  const legoSchemas = collectLegoSchemas();

  // Per-company DDL constants from packages/db/company/*.ts.
  const companyDir = resolve(__dirname, "company");
  const ddls: DdlEntry[] = [];
  let tsFiles: string[] = [];
  try {
    tsFiles = readdirSync(companyDir).filter((f) => f.endsWith(".ts"));
  } catch {
    console.log(`[db/migrate] No company/ directory at ${companyDir} — company DDL skipped`);
  }
  for (const file of tsFiles) {
    const fullPath = join(companyDir, file);
    let mod: Record<string, unknown>;
    try {
      mod = await import(pathToFileURL(fullPath).href);
    } catch (err) {
      console.error(`[db/migrate] Failed to import ${file}: ${err}`);
      throw err;
    }
    for (const [name, value] of Object.entries(mod)) {
      if (
        typeof value === "string" &&
        (name.endsWith("_DDL") || name.endsWith("_SCHEMA_SQL"))
      ) {
        ddls.push({ file, constant: name, sql: value });
      }
    }
  }

  if (legoSchemas.length === 0 && ddls.length === 0) {
    console.log(
      "[db/migrate] No lego schemas and no *_DDL / *_SCHEMA_SQL constants — nothing to migrate",
    );
    return;
  }

  console.log(
    `[db/migrate] Found ${legoSchemas.length} lego schema file(s) + ${ddls.length} company DDL constant(s)`,
  );
  for (const s of legoSchemas) {
    console.log(`  - lego ${s.lego}/${s.file} (${s.sql.length} chars)`);
  }
  for (const d of ddls) {
    console.log(`  - company ${d.file}::${d.constant} (${d.sql.length} chars)`);
  }

  // Dynamic require for `pg` so tsx doesn't try to bundle Node-built-ins.
  // Same pattern apps/web uses (per compliance-evaluator.ts).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require("pg") as {
    Client: new (config: { connectionString: string }) => {
      connect: () => Promise<void>;
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
      end: () => Promise<void>;
    };
  };
  const client = new Client({ connectionString: dbUrl });

  await client.connect();
  console.log("[db/migrate] Connected to DATABASE_URL");

  let legoSucceeded = 0;
  let ddlSucceeded = 0;
  const legoFailed: string[] = [];
  try {
    // Lego schemas are best-effort: applied with continue-on-error. The 16
    // bundled legos are heterogeneous — most create their own tables (users,
    // sessions, billing_*), but some ALTER Nexus-platform tables that do not
    // exist in a company DB (e.g. memory-and-knowledge ALTERs memory_items).
    // A platform-dependent lego must NOT fail the company build, so we warn
    // and continue. Company DDL below stays fatal.
    for (const s of legoSchemas) {
      console.log(`[db/migrate] Executing lego ${s.lego}/${s.file} ...`);
      try {
        await client.query(s.sql);
        legoSucceeded += 1;
        console.log(`[db/migrate]   OK lego ${s.lego}/${s.file}`);
      } catch (err) {
        legoFailed.push(`${s.lego}/${s.file}`);
        console.warn(
          `[db/migrate]   WARN skipping lego ${s.lego}/${s.file} (non-fatal): ${err}`,
        );
      }
    }
    for (const d of ddls) {
      console.log(`[db/migrate] Executing company ${d.file}::${d.constant} ...`);
      try {
        await client.query(d.sql);
        ddlSucceeded += 1;
        console.log(`[db/migrate]   OK company ${d.file}::${d.constant}`);
      } catch (err) {
        console.error(
          `[db/migrate]   FAILED company ${d.file}::${d.constant}: ${err}`,
        );
        throw err;
      }
    }

    // Best-effort seeds (admin nav sections + test users). Never fatal.
    await seedAdminSections(client);
    await seedTestUsers(client);
  } finally {
    await client.end();
  }

  console.log(
    `[db/migrate] Complete — ${legoSucceeded}/${legoSchemas.length} lego schema(s) + ${ddlSucceeded}/${ddls.length} company DDL constant(s) applied`,
  );
  if (legoFailed.length > 0) {
    console.warn(
      `[db/migrate] ${legoFailed.length} lego schema(s) skipped (non-fatal, likely platform-table dependencies): ${legoFailed.join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error("[db/migrate] FATAL:", err);
  process.exit(1);
});
