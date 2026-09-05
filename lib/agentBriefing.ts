import { db } from "@/lib/db.mjs";
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
 * so the agent always answers from real-time state. The briefing is ADAPTIVE:
 * it is sized to what the question needs, because the gateway generates only
 * ~23 tokens/s — the LLM can compose an answer inside the 2.8 s budget only
 * when both the briefing and the expected answer are tiny. Modes:
 * - "plan":      the matched medical-policy/formulary rows (~150 tokens).
 * - "aggregate": precomputed counts only (~200 tokens).
 * - "conflict":  the matched conflict records (rich — the route answers
 *                from the deterministic snapshot composer, not the LLM).
 * - "rich":      everything else (rich — same, snapshot composer answers).
 * Every aggregate is PRECOMPUTED here — the model must never count rows.
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

export type BriefingMode = "plan" | "aggregate" | "conflict" | "rich";

export interface AgentBriefing {
  mode: BriefingMode;
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

  const accountLines = accounts.map(
    (a) =>
      `${a.id}: ${a.name} | ${a.territory} | ${a.hcp_specialty} | primary plan ${a.primary_plan_name} (${a.payer_name}, ${a.channel}) | ${a.email}`,
  );

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

  // Exact plan-name matches win: when the question contains a full plan or
  // formulary name, serialize ONLY those rows — a token match would pull
  // every plan the payer owns and blow the micro-briefing budget. Otherwise
  // fall back to token matches, capped so the briefing stays tiny.
  const MAX_FOCUS_ROWS = 8;
  const exactMed = includeSnapshots
    ? medPolicy.filter((r) => qIncludes(r.plan_name.toLowerCase()))
    : [];
  const focusedMedPolicy =
    exactMed.length > 0
      ? exactMed.slice(0, MAX_FOCUS_ROWS)
      : includeSnapshots
        ? medPolicy
            .filter((r) => rowMatchesQuestion(r.payer_name, r.plan_name))
            .slice(0, MAX_FOCUS_ROWS)
        : [];
  const exactForm = includeSnapshots
    ? formulary.filter(
        (r) =>
          qIncludes(r.formulary_name.toLowerCase()) ||
          qIncludes(
            r.formulary_name.toLowerCase().replace(/\s+formulary$/, ""),
          ),
      )
    : [];
  const focusedFormulary =
    exactForm.length > 0
      ? exactForm.slice(0, MAX_FOCUS_ROWS)
      : includeSnapshots
        ? formulary
            .filter((r) => rowMatchesQuestion(r.payer_name, r.formulary_name))
            .slice(0, MAX_FOCUS_ROWS)
        : [];

  // ---- Mode selection: size the briefing to what the question needs ----
  // The gateway generates only ~23 tokens/s, so an LLM-composed answer fits
  // the 2.8 s budget only when BOTH the briefing and the expected answer are
  // tiny. Single-fact questions (plan rows, counts) get a micro-briefing;
  // rich multi-part questions (conflict detail, notifications, materials,
  // audit) are answered by the deterministic snapshot composer in route.ts.
  const mentionedAccountIds = new Set(
    accounts
      .filter(
        (a) =>
          rowMatchesQuestion(a.name, a.name) || qIncludes(a.id.toLowerCase()),
      )
      .map((a) => a.id),
  );
  const matchedConflicts = changes.filter(
    (c) =>
      rowMatchesQuestion(c.payer_name, c.plan_name) ||
      c.affected_account_ids.some((id) => mentionedAccountIds.has(id)),
  );
  const matchedConflictText = changes
    .map((change, i) =>
      matchedConflicts.includes(change) ? conflictLines[i] : null,
    )
    .filter((text): text is string => text !== null);

  const mode: BriefingMode = (() => {
    if (matchedConflicts.length > 0 && !wantsRawRows) return "conflict";
    if (broadQuestion) return "aggregate";
    if (
      includeSnapshots &&
      (focusedMedPolicy.length > 0 || focusedFormulary.length > 0)
    ) {
      return "plan";
    }
    if (matchedConflicts.length > 0) return "conflict";
    return "rich";
  })();

  const minimalSystem = [
    "You are the FRM Assistant for Jordan Lee, Field Reimbursement Manager for Onvexa (HCPCS J9345), Territory 14 — Great Lakes.",
    "Answer ONLY from the data below — it was read live from the FRM database moments ago. Never invent values.",
    "If the data below has no row for what was asked, say you don't have that plan in the territory data — never guess.",
    "Answer in one or two short sentences. No markdown, no preamble.",
  ].join("\n");

  const fullSystem = [
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

  const planUser = [
    `LIVE ROWS (medical policy as of ${asOf}; formulary as of ${formulary[0]?.as_of_date ?? asOf}).`,
    "Medical policy (plan_id|payer|plan|channel|lives|hcpcs|product|coverage|pa|step_therapy|site_of_care|qty_limit|policy_effective):",
    focusedMedPolicy.length > 0
      ? focusedMedPolicy.map(medPolicyRow).join("\n")
      : "(no medical-policy row matched the question)",
    "Formulary (formulary_id|payer|formulary|channel|lives|ndc|product|status|restriction|tier|effective):",
    focusedFormulary.length > 0
      ? focusedFormulary.map(formularyRow).join("\n")
      : "(no formulary row matched the question)",
    `QUESTION: ${question}`,
  ].join("\n");

  const aggregateUser = [
    `PRECOMPUTED AGGREGATES (medical policy as of ${asOf}; ${medPolicy.length} plans tracked):`,
    `- Coverage status counts: ${coverageCounts.join("; ")}`,
    `- Prior auth required: ${medPolicy.filter((r) => r.pa_required === "Y").length} of ${medPolicy.length} plans`,
    `- Step therapy required: ${medPolicy.filter((r) => r.step_therapy_required === "Y").length} of ${medPolicy.length} plans`,
    `- Covered with NO prior auth: ${coveredNoPa.length} rows across ${coveredNoPaNames.length} distinct plan names`,
    `- Not Covered rows: ${notCovered.length}`,
    `- Total covered lives: ${totalLives.toLocaleString()}`,
    `QUESTION: ${question}`,
  ].join("\n");

  const conflictUser = [
    "LIVE CONFLICT RECORDS (read from the FRM database just now):",
    matchedConflictText.length > 0
      ? matchedConflictText.join("\n\n")
      : "(none matched)",
    `QUESTION: ${question}`,
  ].join("\n");

  const richUser = [
    "LIVE DATA BRIEFING (read from the FRM database just now):",
    "",
    "=== OPEN/RESOLVED PAYER CHANGES ===",
    conflictLines.length > 0 ? conflictLines.join("\n\n") : "(none)",
    "",
    "=== TERRITORY ACCOUNTS ===",
    accountLines.join("\n"),
    "",
    "=== AGGREGATES ===",
    `- Coverage status counts: ${coverageCounts.join("; ")}`,
    `- Covered with NO prior auth: ${coveredNoPa.length} rows across ${coveredNoPaNames.length} distinct plan names`,
    `- Total covered lives: ${totalLives.toLocaleString()}`,
    "",
    `QUESTION: ${question}`,
  ].join("\n");

  const systemPrompt =
    mode === "plan" || mode === "aggregate" ? minimalSystem : fullSystem;
  const userPrompt =
    mode === "plan"
      ? planUser
      : mode === "aggregate"
        ? aggregateUser
        : mode === "conflict"
          ? conflictUser
          : richUser;

  return {
    mode,
    systemPrompt,
    userPrompt,
    stats: {
      briefingBytes: userPrompt.length,
      medPolicyRows: focusedMedPolicy.length,
      formularyRows: focusedFormulary.length,
    },
  };
}
