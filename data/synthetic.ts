// Synthetic data — Plan.md §1.4 flat model + §2.3 seed. Deterministic; no randomness.

export type PlanId =
  | "aetna-ppo"
  | "aetna-hmo"
  | "uhc-choice-plus"
  | "cigna-open-access";

export type ConflictType = "site-of-care" | "step-therapy";

export type ConflictStatus = "open" | "resolved";

export interface Plan {
  id: PlanId;
  payer: string;
  plan_name: string;
}

export interface Account {
  id: string;
  name: string;
  territory: string;
  plan_id: PlanId;
  zip: string;
}

export interface PolicyRecord {
  account_id: string;
  source: string;
  value: string;
  effective_date: string;
  status: "active" | "superseded";
}

export interface SourceUpdate {
  source: string;
  field: ConflictType;
  old_value: string;
  new_value: string;
  timestamp: string;
  effective_date: string;
  plan_id: PlanId;
}

export interface Material {
  id: string;
  title: string;
  category: "Clinical" | "Coding" | "Patient" | "Policy";
  owner: string;
  date: string;
  compliance_reviewed: boolean;
}

export interface Conflict {
  id: string;
  conflictType: ConflictType;
  plan: Plan;
  old_value: string;
  new_value: string;
  source: string;
  source_updated: string;
  effective_date: string;
  accounts: Account[];
  status: ConflictStatus;
  resolved_by?: string;
  resolved_at?: string;
  materials: Material[];
  notified_offices?: number;
}

export const PRODUCT = "Onvexa";
export const PRODUCT_SUB = "(pharmagenic) capsules";
export const TERRITORY = "Territory 14 — Great Lakes";
export const FRM_NAME = "Jordan Lee";
export const FRM_TITLE = "Field Reimbursement Manager";
export const SOURCE = "MMIT";
export const SOURCE_UPDATED = "26 Aug 2026";

export const PLANS: Plan[] = [
  { id: "aetna-ppo", payer: "Commercial", plan_name: "Aetna PPO" },
  { id: "aetna-hmo", payer: "Commercial", plan_name: "Aetna HMO" },
  {
    id: "uhc-choice-plus",
    payer: "Managed Medicare",
    plan_name: "UnitedHealthcare Choice Plus",
  },
  {
    id: "cigna-open-access",
    payer: "Medicare Part D",
    plan_name: "Cigna Open Access",
  },
];

export const ACCOUNTS: Account[] = [
  { id: "acc-01", name: "Midwest Cancer Associates", territory: TERRITORY, plan_id: "aetna-hmo", zip: "48201" },
  { id: "acc-02", name: "Metro Oncology Services", territory: TERRITORY, plan_id: "aetna-hmo", zip: "55401" },
  { id: "acc-03", name: "Lakeshore Hematology Clinic", territory: TERRITORY, plan_id: "aetna-ppo", zip: "60601" },
  { id: "acc-04", name: "Grand River Infusion Center", territory: TERRITORY, plan_id: "aetna-ppo", zip: "49503" },
  { id: "acc-05", name: "Northshore Cancer Care", territory: TERRITORY, plan_id: "aetna-ppo", zip: "53202" },
  { id: "acc-06", name: "Summit Oncology Group", territory: TERRITORY, plan_id: "uhc-choice-plus", zip: "43215" },
  { id: "acc-07", name: "Buckeye Infusion Partners", territory: TERRITORY, plan_id: "uhc-choice-plus", zip: "45202" },
  { id: "acc-08", name: "Cardinal Health Oncology Clinic", territory: TERRITORY, plan_id: "uhc-choice-plus", zip: "43004" },
  { id: "acc-09", name: "Riverfront Cancer Institute", territory: TERRITORY, plan_id: "cigna-open-access", zip: "46204" },
  { id: "acc-10", name: "Hoosier Hematology Associates", territory: TERRITORY, plan_id: "cigna-open-access", zip: "46240" },
  { id: "acc-11", name: "Prairie Oncology Network", territory: TERRITORY, plan_id: "cigna-open-access", zip: "60614" },
  { id: "acc-12", name: "Great Lakes Cancer Center", territory: TERRITORY, plan_id: "uhc-choice-plus", zip: "48226" },
];

export const MATERIALS: Material[] = [
  {
    id: "mat-01",
    title: "Onvexa Site-of-Care Guidance Sheet (HOPD)",
    category: "Clinical",
    owner: "Medical Affairs",
    date: "2026-08-15",
    compliance_reviewed: true,
  },
  {
    id: "mat-02",
    title: "Onvexa HOPD Coding Quick Reference",
    category: "Coding",
    owner: "Market Access",
    date: "2026-08-10",
    compliance_reviewed: true,
  },
  {
    id: "mat-03",
    title: "Patient Support Enrollment — HOPD Site Update",
    category: "Patient",
    owner: "Patient Services",
    date: "2026-08-20",
    compliance_reviewed: true,
  },
  {
    id: "mat-04",
    title: "Prior Authorization Requirements — Onvexa (Aug 2026)",
    category: "Policy",
    owner: "MMIT",
    date: "2026-08-26",
    compliance_reviewed: true,
  },
];

const SITE_OF_CARE_OLD = "Office-based infusion permitted";
const SITE_OF_CARE_NEW = "Hospital Outpatient Department (HOPD) required";
const STEP_THERAPY_OLD = "No step therapy required prior to PA approval";

function accountsFor(planId: PlanId, count: number): Account[] {
  return ACCOUNTS.filter((a) => a.plan_id === planId).slice(0, count);
}

// Seed: 5 plan conflicts — 1 resolved (Aetna PPO), 4 open. Plan.md §2.3.
export const SEED_CONFLICTS: Conflict[] = [
  {
    id: "conf-aetna-ppo-soc",
    conflictType: "site-of-care",
    plan: PLANS[0],
    old_value: SITE_OF_CARE_OLD,
    new_value: SITE_OF_CARE_NEW,
    source: SOURCE,
    source_updated: SOURCE_UPDATED,
    effective_date: "2026-09-01",
    accounts: accountsFor("aetna-ppo", 3),
    status: "resolved",
    resolved_by: FRM_NAME,
    resolved_at: "Aug 26, 2026, 21:36",
    materials: MATERIALS,
    notified_offices: 3,
  },
  {
    id: "conf-aetna-hmo-soc",
    conflictType: "site-of-care",
    plan: PLANS[1],
    old_value: SITE_OF_CARE_OLD,
    new_value: SITE_OF_CARE_NEW,
    source: SOURCE,
    source_updated: SOURCE_UPDATED,
    effective_date: "2026-09-01",
    accounts: accountsFor("aetna-hmo", 2),
    status: "open",
    materials: MATERIALS,
  },
  {
    id: "conf-uhc-soc",
    conflictType: "site-of-care",
    plan: PLANS[2],
    old_value: SITE_OF_CARE_OLD,
    new_value:
      "HOPD or 340B hospital outpatient pharmacy — prior authorization required for site selection",
    source: SOURCE,
    source_updated: SOURCE_UPDATED,
    effective_date: "2026-09-15",
    accounts: accountsFor("uhc-choice-plus", 3),
    status: "open",
    materials: MATERIALS,
  },
  {
    id: "conf-cigna-st",
    conflictType: "step-therapy",
    plan: PLANS[3],
    old_value: STEP_THERAPY_OLD,
    new_value: "2-line step therapy required before PA approval",
    source: SOURCE,
    source_updated: SOURCE_UPDATED,
    effective_date: "2026-09-15",
    accounts: accountsFor("cigna-open-access", 3),
    status: "open",
    materials: MATERIALS,
  },
  {
    id: "conf-uhc-st",
    conflictType: "step-therapy",
    plan: PLANS[2],
    old_value: STEP_THERAPY_OLD,
    new_value:
      "1-line step therapy required; waiver available with documented contraindication",
    source: SOURCE,
    source_updated: SOURCE_UPDATED,
    effective_date: "2026-10-01",
    accounts: accountsFor("uhc-choice-plus", 4),
    status: "open",
    materials: MATERIALS,
  },
];

export const SEED_SOURCE_UPDATES: SourceUpdate[] = [
  {
    source: SOURCE,
    field: "site-of-care",
    old_value: SITE_OF_CARE_OLD,
    new_value: SITE_OF_CARE_NEW,
    timestamp: "Aug 26, 2026, 06:00",
    effective_date: "2026-09-01",
    plan_id: "aetna-ppo",
  },
  {
    source: SOURCE,
    field: "site-of-care",
    old_value: SITE_OF_CARE_OLD,
    new_value: SITE_OF_CARE_NEW,
    timestamp: "Aug 26, 2026, 06:00",
    effective_date: "2026-09-01",
    plan_id: "aetna-hmo",
  },
  {
    source: SOURCE,
    field: "site-of-care",
    old_value: SITE_OF_CARE_OLD,
    new_value:
      "HOPD or 340B hospital outpatient pharmacy — prior authorization required for site selection",
    timestamp: "Aug 26, 2026, 06:00",
    effective_date: "2026-09-15",
    plan_id: "uhc-choice-plus",
  },
  {
    source: SOURCE,
    field: "step-therapy",
    old_value: STEP_THERAPY_OLD,
    new_value: "2-line step therapy required before PA approval",
    timestamp: "Aug 26, 2026, 06:00",
    effective_date: "2026-09-15",
    plan_id: "cigna-open-access",
  },
  {
    source: SOURCE,
    field: "step-therapy",
    old_value: STEP_THERAPY_OLD,
    new_value:
      "1-line step therapy required; waiver available with documented contraindication",
    timestamp: "Aug 26, 2026, 06:00",
    effective_date: "2026-10-01",
    plan_id: "uhc-choice-plus",
  },
];

export const CONFLICT_TYPE_LABEL: Record<ConflictType, string> = {
  "site-of-care": "Site-of-care requirement",
  "step-therapy": "PA step therapy requirement",
};
