/**
 * Seed normalizer — Plan.md §5, §9 Phase 2.
 *
 * Plain ESM (.mjs) so it runs on system `node` with no native binaries.
 *
 * Reads the source CSVs from `csv/` and writes flat JSON stores:
 *   - `data/`  → the writable "DB" used by the app at runtime
 *   - `seeds/` → pristine copies restored by `POST /api/dev/reset`
 *
 * Usage: npm run seed
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CSV_DIR = join(ROOT, "csv");
const DATA_DIR = join(ROOT, "data");
const SEEDS_DIR = join(ROOT, "seeds");

// ---------------------------------------------------------------------------
// Minimal CSV parser (RFC-4180 subset: quoted fields, escaped quotes, CRLF).
// The source CSVs are quote-free, but we parse defensively anyway.
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // flush last field/row (skip trailing empty line)
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function readCsv(name) {
  const raw = readFileSync(join(CSV_DIR, name), "utf8");
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec = {};
    header.forEach((h, idx) => {
      rec[h] = (r[idx] ?? "").trim();
    });
    return rec;
  });
}

// ---------------------------------------------------------------------------
// Column mapping helpers — CSV headers are PascalCase; stores use snake_case.
// ---------------------------------------------------------------------------

const FORMULARY_COLS = {
  Data_Date: "data_date",
  Formulary_ID: "formulary_id",
  Formulary_Name: "formulary_name",
  Payer_Name: "payer_name",
  Channel: "channel",
  Lives: "lives",
  NDC: "ndc",
  Product_Name: "product_name",
  Formulary_Status: "formulary_status",
  Restriction: "restriction",
  Tier: "tier",
  Effective_Date: "effective_date",
  As_Of_Date: "as_of_date",
};

const MED_POLICY_COLS = {
  Data_Date: "data_date",
  Payer_ID: "payer_id",
  Payer_Name: "payer_name",
  Plan_ID: "plan_id",
  Plan_Name: "plan_name",
  Channel: "channel",
  Lives: "lives",
  HCPCS_Code: "hcpcs_code",
  Product_Name: "product_name",
  Medical_Policy_Number: "medical_policy_number",
  Policy_Effective_Date: "policy_effective_date",
  Coverage_Status: "coverage_status",
  PA_Required: "pa_required",
  Step_Therapy_Required: "step_therapy_required",
  Site_of_Care_Restriction: "site_of_care_restriction",
  Quantity_Limit: "quantity_limit",
  Bulletin_URL: "bulletin_url",
  As_Of_Date: "as_of_date",
};

const INTERNAL_UPDATE_COLS = {
  Update_Date: "update_date",
  Source: "source",
  Payer_Name: "payer_name",
  Plan_Name: "plan_name",
  HCPCS_Code: "hcpcs_code",
  Product_Name: "product_name",
  Field: "field",
  Prior_Value: "prior_value",
  New_Value: "new_value",
  Note: "note",
  Entered_By: "entered_by",
};

function mapKeys(rows, cols) {
  return rows.map((r) => {
    const out = {};
    for (const [csvKey, jsonKey] of Object.entries(cols)) {
      out[jsonKey] = r[csvKey] ?? "";
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Dummy email generation — Plan.md §4.6 / §5.2.
// firstword.lastword@<slug>.example.com
// ---------------------------------------------------------------------------

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function accountEmail(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0] ?? "office";
  const last = words[words.length - 1] ?? "group";
  return `${slugify(first)}.${slugify(last)}@${slugify(name)}.example.com`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function writeStore(name, value, dir) {
  writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
}

function main() {
  console.log("Seeding FRM Genius stores from csv/ …");

  // 1. Snapshot tables (union of Jul + Aug + Sep)
  const formularySnapshots = [
    ...mapKeys(readCsv("FormularyJul.csv"), FORMULARY_COLS),
    ...mapKeys(readCsv("FormularyAugy.csv"), FORMULARY_COLS),
    ...mapKeys(readCsv("FormularySep.csv"), FORMULARY_COLS),
  ];
  const medPolicySnapshots = [
    ...mapKeys(readCsv("MedPolicyJul.csv"), MED_POLICY_COLS),
    ...mapKeys(readCsv("MedPolicyaug.csv"), MED_POLICY_COLS),
    ...mapKeys(readCsv("MedPolicySep.csv"), MED_POLICY_COLS),
  ];

  // 2. Accounts (+ dummy email column)
  const accounts = readCsv("AccountsTerritories.csv").map((r) => ({
    id: r.Account_ID,
    name: r.Account_Name,
    territory: r.Territory,
    hcp_specialty: r.HCP_Specialty,
    primary_plan_id: r.Primary_Plan_ID,
    primary_plan_name: r.Primary_Plan_Name,
    payer_name: r.Payer_Name,
    channel: r.Channel,
    email: accountEmail(r.Account_Name),
  }));

  // 3. Plans — derived from the med-policy snapshots (one row per plan).
  //    Includes every plan seen in snapshots so joins never miss; the UI
  //    filters to Territory 14 via accounts.
  const planSeen = new Map();
  for (const r of medPolicySnapshots) {
    if (!planSeen.has(r.plan_id)) planSeen.set(r.plan_id, r);
  }
  const plans = [...planSeen.values()].map((r) => ({
    id: r.plan_id,
    payer_id: r.payer_id,
    payer_name: r.payer_name,
    plan_name: r.plan_name,
    channel: r.channel,
    lives: r.lives,
  }));

  // 4. Product — Plan.md §4.4: Onvexa (HCPCS J9345, NDC 00078-0912-01).
  //    CSV's "Onvantra" is renamed at the seed boundary.
  const product = {
    id: "onvexa",
    name: "Onvexa",
    hcpcs: "J9345",
    ndc: "00078-0912-01",
    csv_name: "Onvantra",
  };

  // 5. Materials — MLR-approved assets (Plan.md §5.2). Static reference set.
  const materials = [
    {
      id: "mat-01",
      title: "Onvexa Site-of-Care Guidance Sheet",
      category: "Clinical",
      owner: "Medical Affairs",
      reviewed_at: "2026-08-15",
      applicable_change_types: ["site_of_care_restriction"],
    },
    {
      id: "mat-02",
      title: "Onvexa Coding Quick Reference (J9345)",
      category: "Coding",
      owner: "Market Access",
      reviewed_at: "2026-08-10",
      applicable_change_types: [
        "coverage_status",
        "pa_required",
        "step_therapy_required",
        "quantity_limit",
        "formulary_status",
        "restriction",
        "tier",
      ],
    },
    {
      id: "mat-03",
      title: "Prior Authorization Requirements — Onvexa (Aug 2026)",
      category: "Policy",
      owner: "MMIT",
      reviewed_at: "2026-08-26",
      applicable_change_types: ["pa_required", "step_therapy_required"],
    },
    {
      id: "mat-04",
      title: "Patient Support Enrollment — Site Update",
      category: "Patient",
      owner: "Patient Services",
      reviewed_at: "2026-08-20",
      applicable_change_types: ["site_of_care_restriction", "coverage_status"],
    },
    {
      id: "mat-05",
      title: "Quantity Limit & Billing Guidance — Onvexa",
      category: "Coding",
      owner: "Market Access",
      reviewed_at: "2026-08-22",
      applicable_change_types: ["quantity_limit"],
    },
    {
      id: "mat-06",
      title: "Formulary Tier Placement Overview — Onvexa",
      category: "Policy",
      owner: "MMIT",
      reviewed_at: "2026-08-24",
      applicable_change_types: ["formulary_status", "restriction", "tier"],
    },
  ];

  // 6. Internal updates — rep intel from CSV (diff engine appends later).
  const internalUpdates = mapKeys(readCsv("InternalUpdates.csv"), INTERNAL_UPDATE_COLS).map(
    (r) => ({
      ...r,
      plan_id: "", // resolved by diff engine via payer+plan name join
      detection_id: "", // rep intel rows are not diff-engine detections
    }),
  );

  // 7. App-state tables start empty; the diff engine populates them.
  const payerChanges = [];
  const notifications = [];
  const auditEvents = [];

  // Write to both data/ (runtime) and seeds/ (reset source).
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(SEEDS_DIR, { recursive: true });

  const stores = {
    "formularySnapshots.json": formularySnapshots,
    "medPolicySnapshots.json": medPolicySnapshots,
    "accounts.json": accounts,
    "plans.json": plans,
    "product.json": product,
    "materials.json": materials,
    "internalUpdates.json": internalUpdates,
    "payerChanges.json": payerChanges,
    "notifications.json": notifications,
    "auditEvents.json": auditEvents,
  };

  for (const [name, value] of Object.entries(stores)) {
    writeStore(name, value, DATA_DIR);
    writeStore(name, value, SEEDS_DIR);
  }

  // Clear the mock outbox.
  const outbox = join(DATA_DIR, "outbox");
  if (existsSync(outbox)) {
    rmSync(outbox, { recursive: true, force: true });
  }
  mkdirSync(outbox, { recursive: true });

  console.log(
    `Seeded ${formularySnapshots.length} formulary rows, ` +
      `${medPolicySnapshots.length} med-policy rows, ` +
      `${accounts.length} accounts, ${plans.length} plans, ` +
      `${internalUpdates.length} internal updates.`,
  );
}

main();
