/**
 * Shared domain types — Plan.md §5 data model.
 */

export type ChangeType =
  | "site_of_care_restriction"
  | "pa_required"
  | "step_therapy_required"
  | "coverage_status"
  | "quantity_limit"
  | "formulary_status"
  | "restriction"
  | "tier";

/** UI-friendly change-type groupings — Plan.md §6.2 (3). */
export type ChangeTypeGroup =
  | "Site-of-care requirement"
  | "PA / step-therapy requirement"
  | "Coverage status change"
  | "Quantity limit change"
  | "Formulary change";

export const CHANGE_TYPE_GROUP: Record<ChangeType, ChangeTypeGroup> = {
  site_of_care_restriction: "Site-of-care requirement",
  pa_required: "PA / step-therapy requirement",
  step_therapy_required: "PA / step-therapy requirement",
  coverage_status: "Coverage status change",
  quantity_limit: "Quantity limit change",
  formulary_status: "Formulary change",
  restriction: "Formulary change",
  tier: "Formulary change",
};

export const GROUP_ORDER: ChangeTypeGroup[] = [
  "Site-of-care requirement",
  "PA / step-therapy requirement",
  "Coverage status change",
  "Quantity limit change",
  "Formulary change",
];

/** Human labels for tracked fields (used in rows and emails). */
export const FIELD_LABEL: Record<ChangeType, string> = {
  site_of_care_restriction: "Site-of-care restriction",
  pa_required: "Prior authorization required",
  step_therapy_required: "Step therapy required",
  coverage_status: "Coverage status",
  quantity_limit: "Quantity limit",
  formulary_status: "Formulary status",
  restriction: "Formulary restriction",
  tier: "Formulary tier",
};

export type ChangeSource = "MMIT" | "Formulary" | "Internal";

export interface Provenance {
  value: string;
  source: ChangeSource;
  source_date: string; // as_of_date of the snapshot the value came from
}

export interface PayerChange {
  id: string;
  change_type: ChangeType;
  change_type_group: ChangeTypeGroup;
  field: ChangeType;
  plan_id: string;
  payer_name: string;
  plan_name: string;
  channel: string;
  previous: Provenance;
  authoritative: Provenance;
  effective_date: string;
  bulletin_url?: string;
  affected_account_ids: string[];
  detected_at: string;
  status: "open" | "resolved";
  resolved_at?: string;
  resolved_by?: string;
  corrected_path_source?: ChangeSource;
  corrected_path_value?: string;
  // Accounts the FRM actually resolved/notified (subset of
  // affected_account_ids). Absent when the whole territory was resolved.
  resolved_account_ids?: string[];
}

export interface InternalUpdate {
  update_date: string;
  source: string;
  payer_name: string;
  plan_name: string;
  plan_id: string;
  hcpcs_code: string;
  product_name: string;
  field: string;
  prior_value: string;
  new_value: string;
  note: string;
  entered_by: string;
  detection_id: string;
}

export interface Account {
  id: string;
  name: string;
  territory: string;
  hcp_specialty: string;
  primary_plan_id: string;
  primary_plan_name: string;
  payer_name: string;
  channel: string;
  email: string;
}

export interface Plan {
  id: string;
  payer_id: string;
  payer_name: string;
  plan_name: string;
  channel: string;
  lives: string;
}

export interface Product {
  id: string;
  name: string;
  hcpcs: string;
  ndc: string;
  csv_name: string;
}

export interface Material {
  id: string;
  title: string;
  category: string;
  owner: string;
  reviewed_at: string;
  applicable_change_types: ChangeType[];
}

export interface FormularySnapshot {
  data_date: string;
  formulary_id: string;
  formulary_name: string;
  payer_name: string;
  channel: string;
  lives: string;
  ndc: string;
  product_name: string;
  formulary_status: string;
  restriction: string;
  tier: string;
  effective_date: string;
  as_of_date: string;
}

export interface MedPolicySnapshot {
  data_date: string;
  payer_id: string;
  payer_name: string;
  plan_id: string;
  plan_name: string;
  channel: string;
  lives: string;
  hcpcs_code: string;
  product_name: string;
  medical_policy_number: string;
  policy_effective_date: string;
  coverage_status: string;
  pa_required: string;
  step_therapy_required: string;
  site_of_care_restriction: string;
  quantity_limit: string;
  bulletin_url: string;
  as_of_date: string;
}

export interface NotificationMessage {
  to: string;
  re: string;
  from: string;
  corrected_path: string;
  source: string;
  effective_date: string;
  materials: string[];
}

export interface Notification {
  id: string;
  payer_change_id: string;
  sent_at: string;
  sent_by: string;
  recipient_account_ids: string[];
  recipient_emails: string[];
  message: NotificationMessage;
  transport: "smtp" | "mock";
  message_id: string;
}

export type AuditEventType =
  | "mmit_update_detected"
  | "formulary_update_detected"
  | "conflict_flagged"
  | "corrected_path_selected"
  | "accounts_resolved"
  | "materials_attached"
  | "path_communicated"
  | "resolution_recorded";

export interface AuditEvent {
  id: string;
  payer_change_id: string;
  actor: "System" | "Jordan Lee";
  event_type: AuditEventType;
  description: string;
  at: string;
}
