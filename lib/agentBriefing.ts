import { db } from "@/lib/db.mjs";
import { loadFaqs } from "@/lib/faq";
import { FIELD_LABEL } from "@/lib/constants.mjs";
import { formatDate, formatTimestamp } from "@/lib/format";
import type {
  Account,
  AuditEvent,
  FormularySnapshot,
  InternalUpdate,
  Material,
  MedPolicySnapshot,
  Notification,
  PayerChange,
  Plan,
  Product,
} from "@/lib/types";

/**
 * Builds the live data briefing that grounds the agentic assistant.
 *
 * Everything is read from the data folder (via lib/db.mjs) at request time,
 * so the agent always answers from real-time state. The briefing is FOCUSED:
 * only the rows relevant to the question are serialized, and every aggregate
 * (counts, group-bys, per-status stats) is PRECOMPUTED here — the gateway
 * model cannot reliably count across 1000 rows, so it must never have to.
 *
 * Latency contract: the gateway spends ~1.75 s on a tiny prompt and ~2.3 s on
 * a 200-token prompt, but ~40 s reading a 100 KB briefing. Keeping the
 * serialized payload small is what makes sub-2-second answers possible.
 */

function countBy<T>(rows: T[], key: (row: T) => string): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`);
}

/** Latest as_of_date rows from a snapshot store (one row per plan). */
function latestRows<T extends { as_of_date: string }>(rows: T[]): T[] {
  const latest = rows.reduce(
    (max, row) => (row.as_of_date > max ? row.as_of_date : max),
    "",
  );
  return rows.filter((row) => row.as_of_date === latest);
}

function medPolicyRow(r: MedPolicySnapshot): string {
  return [
    r.plan_id,
    r.payer_name,
    r.plan_name,
    r.channel,
    r.lives,
    r.hcpcs_code,
    r.product_name,
    r.coverage_status,
    r.pa_required,
    r.step_therapy_required,
    r.site_of_care_restriction,
    r.quantity_limit,
    r.policy_effective_date,
  ].join("|");
}

function formularyRow(r: FormularySnapshot): string {
  return [
    r.formulary_id,
    r.payer_name,
    r.formulary_name,
    r.channel,
    r.lives,
    r.ndc,
    r.product_name,
    r.formulary_status,
    r.restriction,
    r.tier,
    r.effective_date,
  ].join("|");
}

/** Distinctive tokens from a text (≥5 chars, not generic payer/plan words). */
function distinctiveTokens(text: string, generic: Set<string>): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 5 && !generic.has(t));
}

/** Generic payer/plan words that must never match on their own. */
const GENERIC_WORDS = new Set([
  "health", "care", "wellness", "plan", "insurance", "mutual", "alliance",
  "benefit", "ppo", "hmo", "pos", "select", "choice", "complete",
  "preferred", "advantage", "ma", "state",
  "oncology", "hematology", "cancer", "center", "infusion", "associates",
  "group", "institute", "suite", "clinic",
]);

export interface AgentBriefing {
  systemPrompt: string;
  userPrompt: string;
  stats: {
    briefingBytes: number;
    medPolicyRows: number;
    formularyRows: number;
  };
}

export function buildAgentBriefing(question: string): AgentBriefing {
  const changes = db.payerChanges() as PayerChange[];
  const accounts = db.accounts() as Account[];
  const notifications = db.notifications() as Notification[];
  const events = db.auditEvents() as AuditEvent[];
  const materials = db.materials() as Material[];
  const internalUpdates = db.internalUpdates() as InternalUpdate[];
  const plans = db.plans() as Plan[];
  const product = db.product() as Product;
  const medPolicyAll = db.medPolicySnapshots() as MedPolicySnapshot[];
  const formularyAll = db.formularySnapshots() as FormularySnapshot[];

  const medPolicy = latestRows(medPolicyAll);
  const formulary = latestRows(formularyAll);
  const asOf = medPolicy[0]?.as_of_date ?? "unknown";

  const open = changes.filter((c) => c.status === "open");
  const resolved = changes.filter((c) => c.status === "resolved");

  // ---- Question tokens for focused row selection ----
  const qLower = question.toLowerCase();
  const qTokens = new Set(
    qLower
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  const qHas = (token: string) => qTokens.has(token);
  const qIncludes = (needle: string) => qLower.includes(needle);

  // ---- Precomputed aggregates (the model must never count raw rows) ----
  const coverageCounts = countBy(medPolicy, (r) => r.coverage_status);
  const paCounts = countBy(medPolicy, (r) => r.pa_required);
  const stepCounts = countBy(medPolicy, (r) => r.step_therapy_required);
  const channelCounts = countBy(medPolicy, (r) => r.channel);
  const payerCounts = countBy(medPolicy, (r) => r.payer_name);
  const coveredNoPa = medPolicy.filter(
    (r) => r.coverage_status === "Covered" && r.pa_required === "N",
  );
  const coveredNoPaNames = [...new Set(coveredNoPa.map((r) => r.plan_name))];
  const notCovered = medPolicy.filter(
    (r) => r.coverage_status !== "Covered",
  );
  const socRestricted = medPolicy.filter(
    (r) => r.site_of_care_restriction && r.site_of_care_restriction !== "None",
  );
  const totalLives = medPolicy.reduce(
    (sum, r) => sum + Number(r.lives || 0),
    0,
  );

  // ---- Conflict sections (small stores, fully serialized) ----
  const conflictLines = changes.map((c) => {
    const affected = accounts
      .filter((a) => c.affected_account_ids.includes(a.id))
      .map((a) => a.name);
    const fieldLabel = FIELD_LABEL[c.field] ?? c.field;
    const notification = notifications.find(
      (n) => n.payer_change_id === c.id,
    );
    const changeEvents = events
      .filter((e) => e.payer_change_id === c.id)
      .sort((a, b) => a.at.localeCompare(b.at));
    const lines = [
      `ID: ${c.id} | ${c.payer_name} — ${c.plan_name} (${c.change_type_group}, ${c.change_type}) | status: ${c.status}`,
      `  field: ${fieldLabel} changed from "${c.previous.value}" to "${c.authoritative.value}" (source: ${c.authoritative.source} · ${c.authoritative.source_date}), effective ${formatDate(c.effective_date)}`,
      `  affected accounts (${c.affected_account_ids.length}): ${affected.join(", ") || "—"}`,
    ];
    if (c.status === "resolved") {
      lines.push(
        `  resolved by ${c.resolved_by ?? "—"}${c.resolved_at ? ` on ${formatTimestamp(c.resolved_at)}` : ""}; corrected path: "${c.corrected_path_value ?? "not recorded"}" (source: ${c.corrected_path_source ?? "—"})`,
      );
      lines.push(
        notification
          ? `  notified ${notification.recipient_account_ids.length} office(s) on ${formatTimestamp(notification.sent_at)}; materials: ${notification.message.materials.join("; ")}`
          : "  not yet notified",
      );
    }
    if (changeEvents.length > 0) {
      lines.push(
        `  audit trail (${changeEvents.length}): ${changeEvents.map((e) => e.description).join(" · ")}`,
      );
    }
    return lines.join("\n");
  });

  const materialLines = materials.map(
    (m) =>
      `${m.id}: ${m.title} (${m.category}, owner ${m.owner}, reviewed ${formatDate(m.reviewed_at)}, applies to: ${m.applicable_change_types.join(", ")})`,
  );

  const internalLines = internalUpdates.map(
    (u) =>
      `${u.update_date} | ${u.source} | ${u.payer_name} — ${u.plan_name} (${u.plan_id}) | HCPCS ${u.hcpcs_code} | ${u.product_name} | ${u.field}: "${u.prior_value}" → "${u.new_value}" | note: ${u.note} | entered by ${u.entered_by}`,
  );

  const notificationLines = notifications.map((n) => {
    const change = changes.find((c) => c.id === n.payer_change_id);
    const names = accounts
      .filter((a) => n.recipient_account_ids.includes(a.id))
      .map((a) => a.name);
    return `${change ? `${change.payer_name} — ${change.plan_name}` : n.payer_change_id} | sent ${formatTimestamp(n.sent_at)} by ${n.sent_by} | ${n.recipient_account_ids.length} office(s): ${names.join(", ")} | materials: ${n.message.materials.join("; ")} | transport: ${n.transport}`;
  });

  const accountLines = accounts.map(
    (a) =>
      `${a.id}: ${a.name} | ${a.territory} | ${a.hcp_specialty} | primary plan ${a.primary_plan_name} (${a.payer_name}, ${a.channel}) | ${a.email}`,
  );

  const faqs = loadFaqs();
  const faqLines = faqs.map((f) => `Q: ${f.question}`);

  // ---- Focused snapshot selection: only rows the question can be about ----
  // A row is included when the question names its payer, plan, formulary,
  // or a distinctive token of either. Broad aggregate questions (counts,
  // totals, "how many") get no raw rows — the precomputed aggregates answer
  // them, and serializing 1000 rows would blow the latency budget.
  const wantsRawRows =
    qHas("tier") ||
    qHas("tiers") ||
    qHas("restriction") ||
    qHas("restrictions") ||
    qHas("quantity") ||
    qHas("limit") ||
    qHas("coverage") ||
    qHas("covered") ||
    qHas("criteria") ||
    qHas("policy") ||
    qHas("policies") ||
    qHas("formulary") ||
    qHas("status") ||
    qHas("lives") ||
    qHas("channel");
  const broadQuestion =
    /\b(how many|total|count|overall|across all|in total|sum)\b/.test(qLower);
  const includeSnapshots = wantsRawRows && !broadQuestion;

  const rowMatchesQuestion = (
    payerName: string,
    planName: string,
  ): boolean => {
    const payerTokens = distinctiveTokens(payerName, GENERIC_WORDS);
    const planTokens = distinctiveTokens(planName, GENERIC_WORDS);
    const payerLower = payerName.toLowerCase();
    const planLower = planName.toLowerCase();
    return (
      qIncludes(payerLower) ||
      qIncludes(planLower) ||
      payerTokens.some((t) => qTokens.has(t)) ||
      planTokens.some((t) => qTokens.has(t))
    );
  };

  const focusedMedPolicy = includeSnapshots
    ? medPolicy.filter((r) => rowMatchesQuestion(r.payer_name, r.plan_name))
    : [];
  const focusedFormulary = includeSnapshots
    ? formulary.filter((r) => rowMatchesQuestion(r.payer_name, r.formulary_name))
    : [];

  const systemPrompt = [
    "You are the FRM Assistant, an AI agent for Jordan Lee, a Field Reimbursement Manager for Onvexa (HCPCS J9345) covering Territory 14 — Great Lakes.",
    "You answer ONLY from the LIVE DATA BRIEFING provided in the user message. It is real-time data read moments ago from the FRM database.",
    "Rules:",
    "- Ground every factual claim in the briefing. Never invent plans, payers, accounts, counts, dates, or values.",
    "- Counts and totals are precomputed in the briefing — use them as-is; do not recount rows.",
    "- Cite concrete names (payer, plan, account) and dates from the briefing.",
    "- Be concise and professional: short paragraphs or tight bullet lists, no markdown headers.",
    "- If the briefing does not contain the answer, say so plainly and suggest what to ask instead.",
    "- Greetings and small talk: reply briefly and warmly, then offer FRM topics (payer conflicts, accounts, coverage, materials, audit trails).",
    "- You may rephrase and synthesize freely, but every fact must come from the briefing.",
    "",
    "PRECOMPUTED TERRITORY SNAPSHOT:",
    `As-of date for coverage data: ${asOf}. Product: ${product.name} (HCPCS ${product.hcpcs}, NDC ${product.ndc}).`,
    `Plans tracked: ${plans.length} (${medPolicy.length} medical-policy rows, ${formulary.length} formulary rows as of ${asOf}). Total covered lives: ${totalLives.toLocaleString()}.`,
    `Payer changes: ${changes.length} total — ${open.length} open, ${resolved.length} resolved.`,
    `Accounts in territory: ${accounts.length}. Notifications sent: ${notifications.length}. Audit events: ${events.length}. Compliance-reviewed materials: ${materials.length}. Internal updates: ${internalUpdates.length}.`,
    "",
    "MEDICAL-POLICY AGGREGATES (precomputed — trust these numbers):",
    `- Coverage status counts: ${coverageCounts.join("; ")}`,
    `- Prior-auth required (Y): ${paCounts.filter((c) => c.startsWith("Y:")).join("; ") || "0"} of ${medPolicy.length} plans`,
    `- Step therapy required (Y): ${stepCounts.filter((c) => c.startsWith("Y:")).join("; ") || "0"} of ${medPolicy.length} plans`,
    `- Covered with NO prior auth: ${coveredNoPa.length} rows across ${coveredNoPaNames.length} distinct plan names`,
    `- Not Covered rows: ${notCovered.length}`,
    `- Site-of-care restricted rows: ${socRestricted.length}`,
    `- Plans by channel: ${channelCounts.join("; ")}`,
    `- Rows by payer: ${payerCounts.join("; ")}`,
  ].join("\n");

  const userPrompt = [
    "LIVE DATA BRIEFING (read from the FRM database just now):",
    "",
    "=== OPEN/RESOLVED PAYER CHANGES ===",
    conflictLines.length > 0 ? conflictLines.join("\n\n") : "(none)",
    "",
    "=== TERRITORY ACCOUNTS ===",
    accountLines.join("\n"),
    "",
    "=== NOTIFICATIONS SENT ===",
    notificationLines.length > 0 ? notificationLines.join("\n") : "(none yet)",
    "",
    "=== COMPLIANCE-REVIEWED MATERIALS ===",
    materialLines.length > 0 ? materialLines.join("\n") : "(none)",
    "",
    "=== INTERNAL UPDATES ===",
    internalLines.length > 0 ? internalLines.join("\n") : "(none)",
    "",
    includeSnapshots
      ? `=== MEDICAL POLICY SNAPSHOT (as of ${asOf}; rows matching the question; plan_id|payer|plan|channel|lives|hcpcs|product|coverage|pa|step_therapy|site_of_care|qty_limit|policy_effective) ===`
      : `=== MEDICAL POLICY SNAPSHOT (as of ${asOf}; aggregates above cover counts; ask about a specific plan for its row) ===`,
    focusedMedPolicy.length > 0
      ? focusedMedPolicy.map(medPolicyRow).join("\n")
      : "(no specific rows selected — use the precomputed aggregates)",
    "",
    includeSnapshots
      ? `=== FORMULARY SNAPSHOT (as of ${formulary[0]?.as_of_date ?? asOf}; rows matching the question; formulary_id|payer|formulary|channel|lives|ndc|product|status|restriction|tier|effective) ===`
      : `=== FORMULARY SNAPSHOT (as of ${formulary[0]?.as_of_date ?? asOf}; aggregates above cover counts; ask about a specific plan for its row) ===`,
    focusedFormulary.length > 0
      ? focusedFormulary.map(formularyRow).join("\n")
      : "(no specific rows selected — use the precomputed aggregates)",
    "",
    "=== PUBLISHED FAQ TOPICS (for awareness; do not quote verbatim) ===",
    faqLines.join("\n"),
    "",
    `QUESTION: ${question}`,
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    stats: {
      briefingBytes: userPrompt.length,
      medPolicyRows: focusedMedPolicy.length,
      formularyRows: focusedFormulary.length,
    },
  };
}
