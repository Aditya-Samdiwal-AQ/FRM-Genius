/**
 * File-backed "DB" — Plan.md §5, §9 Phase 2.
 *
 * Plain ESM (.mjs) so scripts run on system `node` with no native binaries.
 * JSON stores live in `data/`. All reads go through `readStore`; all writes
 * through `writeStore` (temp file + rename). Mutations serialize behind a
 * single mutex via `withWriteLock` so concurrent route handlers can't
 * interleave read-modify-write cycles.
 *
 * Serverless (Netlify/Vercel): the function filesystem is read-only except
 * `/tmp`. When the bundled `data/` isn't writable we redirect writes to a
 * per-instance `/tmp/frm-genius-data`, hydrated once from `seeds/`.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  existsSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CWD = process.cwd();
const REPO_DATA_DIR = join(CWD, "data");
const SEEDS_DIR = join(CWD, "seeds");

function isWritable(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".write-probe");
    writeFileSync(probe, "");
    rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

const DATA_DIR = isWritable(REPO_DATA_DIR)
  ? REPO_DATA_DIR
  : join(tmpdir(), "frm-genius-data");

export { DATA_DIR };

// On serverless, hydrate the writable data dir from the bundled `data/`
// (populated at build time by `npm run reset`) so first-request users see
// the full demo state. Falls back to `seeds/` for any file missing there.
function hydrateFromSeedsIfEmpty() {
  if (DATA_DIR === REPO_DATA_DIR) return;
  mkdirSync(DATA_DIR, { recursive: true });
  const sources = [REPO_DATA_DIR, SEEDS_DIR].filter((d) => existsSync(d));
  const seen = new Set();
  for (const src of sources) {
    for (const name of readdirSync(src)) {
      if (!name.endsWith(".json") || seen.has(name)) continue;
      seen.add(name);
      const dst = join(DATA_DIR, name);
      if (!existsSync(dst)) copyFileSync(join(src, name), dst);
    }
  }
}
hydrateFromSeedsIfEmpty();

// ---------------------------------------------------------------------------
// Write mutex — a single promise chain; every write appends to it.
// ---------------------------------------------------------------------------

let writeQueue = Promise.resolve();

/** Serialize a mutation. All read-modify-write cycles must run inside `fn`. */
export function withWriteLock(fn) {
  const run = writeQueue.then(fn);
  // Keep the chain alive even if a mutation throws.
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ---------------------------------------------------------------------------
// Raw store IO
// ---------------------------------------------------------------------------

export function readStore(name, dir = DATA_DIR) {
  const primary = join(dir, name);
  if (dir === DATA_DIR && !existsSync(primary)) {
    for (const fallback of [REPO_DATA_DIR, SEEDS_DIR]) {
      const candidate = join(fallback, name);
      if (existsSync(candidate)) {
        return JSON.parse(readFileSync(candidate, "utf8"));
      }
    }
  }
  const raw = readFileSync(primary, "utf8");
  return JSON.parse(raw);
}

export function writeStore(name, value, dir = DATA_DIR) {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${name}.tmp`);
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  // Atomic-ish swap: write temp then rename.
  renameSync(tmp, join(dir, name));
}

/** Read-modify-write under the mutex. Returns the value `fn` produced. */
export function mutateStore(name, fn) {
  return withWriteLock(() => {
    const current = readStore(name);
    const next = fn(current);
    writeStore(name, next);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Typed accessors
// ---------------------------------------------------------------------------

export const db = {
  formularySnapshots: () => readStore("formularySnapshots.json"),
  medPolicySnapshots: () => readStore("medPolicySnapshots.json"),
  accounts: () => readStore("accounts.json"),
  plans: () => readStore("plans.json"),
  product: () => readStore("product.json"),
  materials: () => readStore("materials.json"),
  internalUpdates: () => readStore("internalUpdates.json"),
  payerChanges: () => readStore("payerChanges.json"),
  notifications: () => readStore("notifications.json"),
  auditEvents: () => readStore("auditEvents.json"),

  writeFormularySnapshots: (v) => writeStore("formularySnapshots.json", v),
  writeMedPolicySnapshots: (v) => writeStore("medPolicySnapshots.json", v),
  writeAccounts: (v) => writeStore("accounts.json", v),
  writePlans: (v) => writeStore("plans.json", v),
  writeProduct: (v) => writeStore("product.json", v),
  writeMaterials: (v) => writeStore("materials.json", v),
  writeInternalUpdates: (v) => writeStore("internalUpdates.json", v),
  writePayerChanges: (v) => writeStore("payerChanges.json", v),
  writeNotifications: (v) => writeStore("notifications.json", v),
  writeAuditEvents: (v) => writeStore("auditEvents.json", v),
};

// ---------------------------------------------------------------------------
// ID generation — deterministic, monotonic per process.
// ---------------------------------------------------------------------------

let idCounter = 0;
export function nextId(prefix) {
  idCounter += 1;
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${idCounter.toString(36).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Reset — restore every store from seeds/ and clear the outbox (Plan.md §7).
// ---------------------------------------------------------------------------

export async function resetFromSeeds() {
  return withWriteLock(() => {
    const stores = [
      "formularySnapshots.json",
      "medPolicySnapshots.json",
      "accounts.json",
      "plans.json",
      "product.json",
      "materials.json",
      "internalUpdates.json",
      "payerChanges.json",
      "notifications.json",
      "auditEvents.json",
    ];
    for (const name of stores) {
      writeStore(name, readStore(name, SEEDS_DIR));
    }
    // Clear mock outbox.
    const outbox = join(DATA_DIR, "outbox");
    rmSync(outbox, { recursive: true, force: true });
    mkdirSync(outbox, { recursive: true });
  });
}
