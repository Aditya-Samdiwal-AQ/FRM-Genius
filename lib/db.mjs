/**
 * File-backed "DB" — Plan.md §5, §9 Phase 2.
 *
 * Plain ESM (.mjs) so scripts run on system `node` with no native binaries.
 * JSON stores live in `data/`. All reads go through `readStore`; all writes
 * through `writeStore` (temp file + rename). Mutations serialize behind a
 * single mutex via `withWriteLock` so concurrent route handlers can't
 * interleave read-modify-write cycles.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const SEEDS_DIR = join(process.cwd(), "seeds");

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
  const raw = readFileSync(join(dir, name), "utf8");
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
