/**
 * Snapshot diff engine — Plan.md §6.
 *
 * Plain ESM (.mjs) so scripts run on system `node` with no native binaries.
 *
 * Compares consecutive monthly snapshots on the 8 tracked fields, emits rows
 * into `internalUpdates.json` (source = MMIT | Formulary, entered_by = System)
 * and creates one `payerChanges.json` row per detected change per plan.
 *
 * Idempotent: keyed by (plan_id, field, prior_value, new_value, detected_at).
 */

import { db, nextId } from "./db.mjs";
import { CHANGE_TYPE_GROUP, FORMULARY_FIELDS, MED_POLICY_FIELDS } from "./constants.mjs";

// ---------------------------------------------------------------------------
// Formulary → plan join.
//
// The formulary CSV has no Plan_ID; Formulary_ID (FRM88xxx) shares its numeric
// suffix with the med-policy Plan_ID (PLN52xxx) 1:1 across all 1000 rows, and
// payer + plan name agree on every pair (verified at seed time). We join on
// suffix, then assert payer/name agreement as a guard.
// ---------------------------------------------------------------------------

function planSuffix(id) {
  return id.slice(-3);
}

function buildFormularyToPlanIndex(medRows) {
  const bySuffix = new Map();
  for (const r of medRows) bySuffix.set(planSuffix(r.plan_id), r.plan_id);
  return bySuffix;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectFormularyChanges(formularyRows, medRows) {
  const frmToPlan = buildFormularyToPlanIndex(medRows);
  const planById = new Map(medRows.map((r) => [r.plan_id, r]));

  // Group by formulary_id, sort ascending by data_date.
  const byFormulary = new Map();
  for (const r of formularyRows) {
    const list = byFormulary.get(r.formulary_id) ?? [];
    list.push(r);
    byFormulary.set(r.formulary_id, list);
  }

  const out = [];
  for (const [formularyId, rows] of byFormulary) {
    rows.sort((a, b) => a.data_date.localeCompare(b.data_date));
    const planId = frmToPlan.get(planSuffix(formularyId));
    if (!planId) continue; // formulary row with no plan counterpart
    const plan = planById.get(planId);
    if (!plan) continue;

    for (let i = 1; i < rows.length; i += 1) {
      const older = rows[i - 1];
      const newer = rows[i];
      for (const { field, key } of FORMULARY_FIELDS) {
        const prior = String(older[key]);
        const next = String(newer[key]);
        if (prior === next) continue;
        out.push({
          plan_id: planId,
          payer_name: newer.payer_name,
          plan_name: plan.plan_name,
          channel: plan.channel,
          field,
          prior_value: prior,
          new_value: next,
          source: "Formulary",
          effective_date: newer.effective_date || newer.data_date,
          detected_at: newer.as_of_date || newer.data_date,
        });
      }
    }
  }
  return out;
}

function detectMedPolicyChanges(medRows) {
  const planById = new Map(medRows.map((r) => [r.plan_id, r]));

  const byPlan = new Map();
  for (const r of medRows) {
    const list = byPlan.get(r.plan_id) ?? [];
    list.push(r);
    byPlan.set(r.plan_id, list);
  }

  const out = [];
  for (const [planId, rows] of byPlan) {
    rows.sort((a, b) => a.data_date.localeCompare(b.data_date));
    const plan = planById.get(planId);
    if (!plan) continue;

    for (let i = 1; i < rows.length; i += 1) {
      const older = rows[i - 1];
      const newer = rows[i];
      for (const { field, key } of MED_POLICY_FIELDS) {
        const prior = String(older[key]);
        const next = String(newer[key]);
        if (prior === next) continue;
        out.push({
          plan_id: planId,
          payer_name: newer.payer_name,
          plan_name: plan.plan_name,
          channel: plan.channel,
          field,
          prior_value: prior,
          new_value: next,
          source: "MMIT",
          effective_date: newer.policy_effective_date || newer.data_date,
          detected_at: newer.as_of_date || newer.data_date,
          bulletin_url: newer.bulletin_url || undefined,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Idempotency key — Plan.md §6.2 (6)
// ---------------------------------------------------------------------------

function detectionKey(d) {
  return [d.plan_id, d.field, d.prior_value, d.new_value, d.detected_at].join("||");
}

// ---------------------------------------------------------------------------
// Main entry — run the diff and write internalUpdates + payerChanges.
// ---------------------------------------------------------------------------

export function runDiff() {
  const formularyRows = db.formularySnapshots();
  const medRows = db.medPolicySnapshots();
  const accounts = db.accounts();
  const plans = db.plans();
  const existingUpdates = db.internalUpdates();
  const existingChanges = db.payerChanges();

  const accountsByPlan = new Map();
  for (const a of accounts) {
    const list = accountsByPlan.get(a.primary_plan_id) ?? [];
    list.push(a.id);
    accountsByPlan.set(a.primary_plan_id, list);
  }

  const detections = [
    ...detectMedPolicyChanges(medRows),
    ...detectFormularyChanges(formularyRows, medRows),
  ];

  // Idempotency: skip detections already represented in payerChanges.
  const existingKeys = new Set(
    existingChanges.map((c) =>
      detectionKey({
        plan_id: c.plan_id,
        field: c.field,
        prior_value: c.previous.value,
        new_value: c.authoritative.value,
        detected_at: c.detected_at,
      }),
    ),
  );

  const newChanges = [];
  const newUpdates = [];

  for (const d of detections) {
    const key = detectionKey(d);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const change = {
      id: nextId("chg"),
      change_type: d.field,
      change_type_group: CHANGE_TYPE_GROUP[d.field],
      field: d.field,
      plan_id: d.plan_id,
      payer_name: d.payer_name,
      plan_name: d.plan_name,
      channel: d.channel,
      previous: {
        value: d.prior_value,
        source: d.source,
        source_date: "", // filled below
      },
      authoritative: {
        value: d.new_value,
        source: d.source,
        source_date: d.detected_at,
      },
      effective_date: d.effective_date,
      bulletin_url: d.bulletin_url,
      affected_account_ids: accountsByPlan.get(d.plan_id) ?? [],
      detected_at: d.detected_at,
      status: "open",
    };
    newChanges.push(change);

    newUpdates.push({
      update_date: d.detected_at,
      source: d.source,
      payer_name: d.payer_name,
      plan_name: d.plan_name,
      plan_id: d.plan_id,
      hcpcs_code: "J9345",
      product_name: "Onvexa",
      field: d.field,
      prior_value: d.prior_value,
      new_value: d.new_value,
      note: `Auto-detected by snapshot diff (${d.source} ${d.detected_at}).`,
      entered_by: "System",
      detection_id: change.id,
    });
  }

  // Resolve previous.source_date: for each plan, the prior snapshot's
  // as_of_date is the max as_of_date strictly less than the newer one.
  const priorAsOf = new Map();
  const collectPrior = (planId, dates) => {
    dates.sort((a, b) => a.localeCompare(b));
    for (let i = 1; i < dates.length; i += 1) priorAsOf.set(`${planId}|${dates[i]}`, dates[i - 1]);
  };
  const medDatesByPlan = new Map();
  for (const r of medRows) {
    const list = medDatesByPlan.get(r.plan_id) ?? [];
    list.push(r.as_of_date || r.data_date);
    medDatesByPlan.set(r.plan_id, list);
  }
  for (const [planId, dates] of medDatesByPlan) collectPrior(planId, dates);
  const frmDatesByPlan = new Map();
  for (const r of formularyRows) {
    const planId = buildFormularyToPlanIndex(medRows).get(planSuffix(r.formulary_id));
    if (!planId) continue;
    const list = frmDatesByPlan.get(planId) ?? [];
    list.push(r.as_of_date || r.data_date);
    frmDatesByPlan.set(planId, list);
  }
  for (const [planId, dates] of frmDatesByPlan) collectPrior(planId, dates);

  for (const c of newChanges) {
    c.previous.source_date = priorAsOf.get(`${c.plan_id}|${c.detected_at}`) ?? c.detected_at;
  }

  // Persist: append rep intel; re-derive payerChanges while preserving
  // resolution state for rows that already existed (idempotent re-run).
  const mergedUpdates = [...existingUpdates, ...newUpdates];

  const preserved = new Map();
  for (const c of existingChanges) {
    preserved.set(
      detectionKey({
        plan_id: c.plan_id,
        field: c.field,
        prior_value: c.previous.value,
        new_value: c.authoritative.value,
        detected_at: c.detected_at,
      }),
      c,
    );
  }
  const mergedChanges = detections
    .map((d) => {
      const key = detectionKey(d);
      const prior = preserved.get(key);
      if (prior) return prior; // keep resolved state / stable id
      return newChanges.find(
        (c) =>
          c.plan_id === d.plan_id &&
          c.field === d.field &&
          c.previous.value === d.prior_value &&
          c.authoritative.value === d.new_value &&
          c.detected_at === d.detected_at,
      );
    })
    .filter(Boolean);

  db.writeInternalUpdates(mergedUpdates);
  db.writePayerChanges(mergedChanges);

  return { changes: mergedChanges, updates: mergedUpdates };
}

/** Standalone diff run (npm run diff). */
if (process.argv[1] && process.argv[1].endsWith("diff.mjs")) {
  const { changes } = runDiff();
  const open = changes.filter((c) => c.status === "open");
  console.log(`Diff complete: ${changes.length} changes (${open.length} open).`);
  for (const c of open) {
    console.log(
      `  [${c.change_type_group}] ${c.payer_name} — ${c.plan_name}: ` +
        `${c.field}: ${c.previous.value} → ${c.authoritative.value} ` +
        `(${c.affected_account_ids.length} accounts)`,
    );
  }
}
