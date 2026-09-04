// Typed fetch wrappers over the backend API — Plan.md §7 wire format.
// Every function matches the exact envelope the route handlers return.

import type {
  Account,
  AuditEvent,
  ChangeSource,
  ChangeType,
  ChangeTypeGroup,
  Material,
  Notification,
  PayerChange,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Envelope types — mirror the route handlers 1:1.
// ---------------------------------------------------------------------------

export interface PayerChangeListResponse {
  status: "open" | "resolved" | "all";
  total: number;
  open_count: number;
  resolved_count: number;
  groups: { group: ChangeTypeGroup; changes: PayerChange[] }[];
}

/** Detail accounts are a projection of Account (no hcp_specialty). */
export interface DetailAccount {
  id: string;
  name: string;
  email: string;
  plan_id: string;
  plan_name: string;
  payer_name: string;
  channel: string;
  territory: string;
}

export interface PayerChangeDetailResponse {
  change: PayerChange;
  accounts: DetailAccount[];
  suggested_materials: Material[];
}

export interface ResolutionSummary {
  status: "open" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  corrected_path_source: ChangeSource | null;
  corrected_path_value: string | null;
  accounts_notified: string[];
  materials_sent: { id: string; title: string }[];
}

export interface PayerChangeAuditResponse {
  change: PayerChange;
  audit_events: AuditEvent[];
  notification: Notification | null;
  resolution_summary: ResolutionSummary;
}

export interface ResolveResponse {
  change: PayerChange;
}

export interface NotifyResponse {
  ok: true;
  notification: Notification;
}

export interface MaterialsResponse {
  materials: Material[];
  total: number;
}

export interface AccountsResponse {
  accounts: Account[];
  total: number;
}

export interface DevResetResponse {
  ok: true;
  total_changes: number;
  open_changes: number;
  resolved_changes: number;
}

/** POST /api/dev/diff — re-run the MMIT diff engine against the live DB. */
export interface DevDiffResponse {
  ok: true;
  total_changes: number;
  open_changes: number;
  resolved_changes: number;
}

// ---------------------------------------------------------------------------
// Fetch helpers.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body — fall through to status handling
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

function post<T>(url: string, json?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json ?? {}),
  });
}

// ---------------------------------------------------------------------------
// API surface.
// ---------------------------------------------------------------------------

export type ListStatus = "open" | "resolved" | "all";

export function getPayerChanges(
  status: ListStatus = "open",
): Promise<PayerChangeListResponse> {
  return request<PayerChangeListResponse>(
    `/api/payer-changes?status=${encodeURIComponent(status)}`,
  );
}

export function getPayerChangeDetail(
  id: string,
): Promise<PayerChangeDetailResponse> {
  return request<PayerChangeDetailResponse>(
    `/api/payer-changes/${encodeURIComponent(id)}`,
  );
}

export function getPayerChangeAudit(
  id: string,
): Promise<PayerChangeAuditResponse> {
  return request<PayerChangeAuditResponse>(
    `/api/payer-changes/${encodeURIComponent(id)}/audit`,
  );
}

export function resolvePayerChange(
  id: string,
  body: { corrected_path_source: ChangeSource; corrected_path_value: string },
): Promise<ResolveResponse> {
  return post<ResolveResponse>(
    `/api/payer-changes/${encodeURIComponent(id)}/resolve`,
    body,
  );
}

export function notifyPayerChange(
  id: string,
  materialIds: string[],
): Promise<NotifyResponse> {
  return post<NotifyResponse>(
    `/api/payer-changes/${encodeURIComponent(id)}/notify`,
    { material_ids: materialIds },
  );
}

export function getMaterials(changeType?: ChangeType): Promise<MaterialsResponse> {
  const qs = changeType ? `?change_type=${encodeURIComponent(changeType)}` : "";
  return request<MaterialsResponse>(`/api/materials${qs}`);
}

export function getAccounts(): Promise<AccountsResponse> {
  return request<AccountsResponse>("/api/accounts");
}

export function resetDemoData(): Promise<DevResetResponse> {
  return post<DevResetResponse>("/api/dev/reset");
}

/** POST /api/dev/diff — simulate a fresh MMIT data drop (dev/demo only). */
export function simulateMmitUpdate(): Promise<DevDiffResponse> {
  return post<DevDiffResponse>("/api/dev/diff");
}
