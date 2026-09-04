/**
 * Shared domain constants — Plan.md §5, §6.
 *
 * Plain ESM (.mjs) so scripts run on system `node` with no native binaries
 * (IT blocks unsigned executables like esbuild). lib/types.ts re-exports
 * these for the TypeScript app code.
 */

/** UI-friendly change-type groupings — Plan.md §6.2 (3). */
export const CHANGE_TYPE_GROUP = {
  site_of_care_restriction: "Site-of-care requirement",
  pa_required: "PA / step-therapy requirement",
  step_therapy_required: "PA / step-therapy requirement",
  coverage_status: "Coverage status change",
  quantity_limit: "Quantity limit change",
  formulary_status: "Formulary change",
  restriction: "Formulary change",
  tier: "Formulary change",
};

export const GROUP_ORDER = [
  "Site-of-care requirement",
  "PA / step-therapy requirement",
  "Coverage status change",
  "Quantity limit change",
  "Formulary change",
];

/** Human labels for tracked fields (used in rows and emails). */
export const FIELD_LABEL = {
  site_of_care_restriction: "Site-of-care restriction",
  pa_required: "Prior authorization required",
  step_therapy_required: "Step therapy required",
  coverage_status: "Coverage status",
  quantity_limit: "Quantity limit",
  formulary_status: "Formulary status",
  restriction: "Formulary restriction",
  tier: "Formulary tier",
};

/** Tracked fields — Plan.md §6.1. */
export const FORMULARY_FIELDS = [
  { field: "formulary_status", key: "formulary_status" },
  { field: "restriction", key: "restriction" },
  { field: "tier", key: "tier" },
];

export const MED_POLICY_FIELDS = [
  { field: "coverage_status", key: "coverage_status" },
  { field: "pa_required", key: "pa_required" },
  { field: "step_therapy_required", key: "step_therapy_required" },
  { field: "site_of_care_restriction", key: "site_of_care_restriction" },
  { field: "quantity_limit", key: "quantity_limit" },
];
