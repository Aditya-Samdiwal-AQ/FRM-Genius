import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import { FIELD_LABEL } from "@/lib/constants.mjs";
import { ASSISTANT_API_KEY } from "@/lib/assistantConfig";
import { formatDate, formatTimestamp } from "@/lib/format";
import { buildAgentBriefing } from "@/lib/agentBriefing";
import { llmChat } from "@/lib/llm";
import { comparePriorityDesc, computePriority } from "@/lib/priority";
import type { PrioritySortable } from "@/lib/priority";
import type {
  Account,
  AuditEvent,
  ChangePriority,
  FormularySnapshot,
  InternalUpdate,
  Material,
  MedPolicySnapshot,
  Notification,
  PayerChange,
  Plan,
} from "@/lib/types";

/**
 * POST /api/assistant — FRM Assistant agent endpoint (Plan.md §11.1, §11.9).
 *
 * Agentic path: builds a live data briefing from the data folder (real-time
 * DB state) and has the LLM gateway compose a grounded answer. If the LLM is
 * unreachable or fails, falls back to the deterministic rule-based composer
 * so the assistant never breaks. Requires the team API key
 * (Authorization: Bearer <key> or x-api-key).
 */

export const dynamic = "force-dynamic";

/** Generic tokens that must never act as match aliases on their own. */
const GENERIC_WORDS = new Set([
  "health", "care", "wellness", "plan", "insurance", "mutual", "alliance",
  "benefit", "ppo", "hmo", "pos", "select", "choice", "complete",
  "preferred", "advantage", "ma", "state",
  "oncology", "hematology", "cancer", "center", "infusion", "associates",
  "group", "institute", "suite", "clinic",
]);

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return norm(text).split(" ").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Topic-awareness — classify the question before composing an answer.
// FRM-topic questions are answered from the live DB; meaningful but
// off-topic messages (greetings, thanks, small talk) get a brief, appropriate
// reply that steers back to FRM topics; gibberish gets a polite
// "not able to understand" reply.
// ---------------------------------------------------------------------------

/** Words that signal a substantive FRM-domain question. */
const TOPIC_WORDS = new Set([
  "payer", "payor", "plan", "plans", "conflict", "conflicts", "account",
  "accounts", "office", "offices", "territory", "policy", "policies",
  "formulary", "mmit", "prior", "authorization", "auth", "step", "therapy",
  "site", "care", "effective", "material", "materials", "audit", "trail",
  "notification", "notifications", "notify", "notified", "resolved",
  "resolve", "resolution", "corrected", "path", "guidance", "change",
  "changes", "update", "updates", "affected", "open", "status", "provenance",
  "source", "compliance", "onvexa", "drug", "medication", "coverage",
  "criteria", "requirement", "requirements", "summary", "summaries",
  "email", "communicate", "communication", "alert", "alerts", "payer",
  "priority", "priorities", "rank", "ranking", "ranked", "urgent", "critical",
  "intel", "notes", "snapshot", "diff", "lives", "tier", "restrictions",
]);

/** Greeting / small-talk / thanks phrases (meaningful, but not FRM topics). */
const GREETING_RE =
  /\b(hi|hello|hey|howdy|good\s+(morning|afternoon|evening)|greetings|thanks|thank\s+you|thx|ty|bye|goodbye|see\s+you|nice|great|cool|ok(ay)?|sure|help|what'?s\s+up|sup|yo)\b/;

/** A message is "gibberish" when it has no real words at all. */
function isGibberish(text: string): boolean {
  const tokens = words(text);
  if (tokens.length === 0) return true;
  // Every token is a short non-word (no vowels or all-consonant noise).
  return tokens.every(
    (t) =>
      t.length <= 3 ||
      !/[aeiouy]/.test(t) ||
      !/^[a-z]+$/.test(t),
  );
}

type Intent = "topic" | "smalltalk" | "gibberish";

function classifyIntent(question: string): Intent {
  const q = ` ${norm(question)} `;
  // Standalone greetings are short by design — check them before the
  // gibberish heuristic, which rejects short tokens like "hi".
  if (
    /^(hi|hello|hey|howdy|greetings|good (morning|afternoon|evening))( there|!)?$/.test(
      norm(question).trim(),
    )
  ) {
    return "smalltalk";
  }
  if (isGibberish(question)) return "gibberish";
  for (const word of TOPIC_WORDS) {
    if (q.includes(` ${word} `)) return "topic";
  }
  // Multi-word FRM phrases that single-token matching would miss.
  if (
    /\b(payer|plan|policy|formulary|coverage|material|audit|notification|conflict|account)\b/.test(
      q,
    )
  ) {
    return "topic";
  }
  if (GREETING_RE.test(q)) return "smalltalk";
  // A real question mark with several words is treated as a topic attempt.
  if (question.includes("?") && words(question).length >= 3) return "topic";
  return "smalltalk";
}

/** Off-topic but meaningful — greet and steer back to FRM topics. */
function smallTalkReply(question: string): string {
  const q = norm(question);
  if (/\b(thanks|thank you|thx|ty)\b/.test(q)) {
    return "You're welcome. If you need anything else about payer changes, affected accounts, materials, or audit trails, just ask.";
  }
  if (/\b(bye|goodbye|see you)\b/.test(q)) {
    return "Goodbye! I'm here whenever you need live answers about Territory 14 payer conflicts.";
  }
  if (/\b(help|what'?s up|sup)\b/.test(q)) {
    return "I can answer questions about payer-policy conflicts, affected accounts, corrected paths, notifications, materials, and audit trails. What would you like to know?";
  }
  return "Hello! I'm the FRM Assistant for Territory 14 — Great Lakes. I can answer questions about payer-policy conflicts, affected accounts, corrected paths, notifications, materials, and audit trails. What would you like to know?";
}

function isUnintelligible(text: string): boolean {
  const tokens = words(text);
  return tokens.length === 1 && tokens[0].length >= 4 && !/[aeiou]/.test(tokens[0]);
}

/** Distinctive aliases for one payer change (payer + plan name tokens). */
function changeAliases(change: PayerChange): string[] {
  const aliases = new Set<string>();
  aliases.add(norm(change.payer_name));
  aliases.add(norm(change.plan_name));
  for (const token of [...words(change.payer_name), ...words(change.plan_name)]) {
    if (token.length >= 5 && !GENERIC_WORDS.has(token)) aliases.add(token);
  }
  return [...aliases];
}

/** Distinctive aliases for one account ("lakeside", "ironwood", …). */
function accountAliases(account: Account): string[] {
  return words(account.name).filter(
    (token) => token.length >= 5 && !GENERIC_WORDS.has(token),
  );
}

/** Distinctive aliases for one internal update (payer + plan name tokens). */
function updateAliases(update: InternalUpdate): string[] {
  const aliases = new Set<string>();
  aliases.add(norm(update.payer_name));
  aliases.add(norm(update.plan_name));
  for (const token of [...words(update.payer_name), ...words(update.plan_name)]) {
    if (token.length >= 5 && !GENERIC_WORDS.has(token)) aliases.add(token);
  }
  return [...aliases];
}

/** A change ranked by §5.5 priority, sortable with comparePriorityDesc. */
type RankedChange = PrioritySortable & { change: PayerChange };

/** Number words accepted in count phrases ("top two", "first three"). */
const COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

interface ComposeContext {
  accounts: Account[];
  notifications: Notification[];
  events: AuditEvent[];
  materials: Material[];
  wantAudit: boolean;
  wantMaterials: boolean;
  priority: ChangePriority | null;
}

/** Full factual briefing for one conflict — live DB values only. */
function describeChange(change: PayerChange, ctx: ComposeContext): string {
  const affected = ctx.accounts.filter((a) =>
    change.affected_account_ids.includes(a.id),
  );
  const fieldLabel = FIELD_LABEL[change.field] ?? change.field;
  const notification =
    ctx.notifications.find((n) => n.payer_change_id === change.id) ?? null;

  const parts: string[] = [
    `**${change.payer_name} — ${change.plan_name}** (${change.change_type_group}): ` +
      (change.status === "resolved" ? "resolved conflict" : "open conflict") +
      ".",
    `${fieldLabel} changed from "${change.previous.value}" to ` +
      `"${change.authoritative.value}" (source: ${change.authoritative.source} · ` +
      `${change.authoritative.source_date}), effective ${formatDate(change.effective_date)}.`,
    `${change.affected_account_ids.length} territory account` +
      `${change.affected_account_ids.length === 1 ? "" : "s"} affected` +
      (affected.length > 0 ? `: ${affected.map((a) => a.name).join(", ")}` : "") +
      ".",
  ];

  if (ctx.priority) {
    parts.push(
      `Priority ${ctx.priority.score}/100 ` +
        `(${ctx.priority.lives.toLocaleString()} lives affected).`,
    );
  }

  if (change.status === "resolved") {
    parts.push(
      `Resolved by ${change.resolved_by ?? "—"}` +
        (change.resolved_at ? ` on ${formatTimestamp(change.resolved_at)}` : "") +
        `; corrected path: "${change.corrected_path_value ?? "not recorded"}" ` +
        `(source: ${change.corrected_path_source ?? "—"}).`,
    );
    if (notification) {
      const notifiedNames = affected
        .filter((a) => notification.recipient_account_ids.includes(a.id))
        .map((a) => a.name);
      const count = notification.recipient_account_ids.length;
      parts.push(
        `${count} office${count === 1 ? "" : "s"} notified` +
          (notifiedNames.length > 0 ? ` (${notifiedNames.join(", ")})` : "") +
          ` on ${formatTimestamp(notification.sent_at)}; materials sent: ` +
          `${notification.message.materials.join("; ")}.`,
      );
    } else {
      parts.push(
        "Not yet notified — no notification has been sent for this conflict.",
      );
    }
  }

  if (ctx.wantMaterials) {
    const suggested = ctx.materials.filter((m) =>
      m.applicable_change_types.includes(change.change_type),
    );
    parts.push(
      suggested.length > 0
        ? `Compliance-reviewed materials for this change type: ${suggested
            .map((m) => m.title)
            .join("; ")}.`
        : "No compliance-reviewed materials are mapped to this change type.",
    );
  }

  if (ctx.wantAudit) {
    const changeEvents = ctx.events
      .filter((e) => e.payer_change_id === change.id)
      .sort((a, b) => a.at.localeCompare(b.at));
    parts.push(
      changeEvents.length > 0
        ? `Audit trail (${changeEvents.length} event${
            changeEvents.length === 1 ? "" : "s"
          }): ${changeEvents.map((e) => e.description).join(" · ")}.`
        : "No audit events recorded for this conflict yet.",
    );
  }

  return parts.join("\n");
}

/**
 * Agentic answer: ground the LLM in an ADAPTIVE live briefing built from
 * the data folder and let it compose the reply. The gateway generates only
 * ~23 tokens/s, so an LLM-composed answer fits the 2.8 s budget only when
 * both the briefing and the answer are tiny:
 * - plan/aggregate modes: micro-briefing (~150-200 tokens) in, one-sentence
 *   answer out — completes in ~2.3 s (measured).
 * - conflict/rich modes: a composed answer would need far more output than
 *   the budget allows, so the deterministic snapshot composer answers
 *   instantly instead of burning 2.8 s on a guaranteed timeout.
 * Throws LlmError on any failure (including timeout) — the caller falls
 * back to the snapshot composer, capping worst-case latency at ~3 s.
 */
async function agentAnswer(question: string): Promise<string> {
  const briefing = buildAgentBriefing(question);
  if (briefing.mode === "conflict" || briefing.mode === "rich") {
    return buildSnapshotAnswer(question);
  }
  return llmChat(
    [
      { role: "system", content: briefing.systemPrompt },
      { role: "user", content: briefing.userPrompt },
    ],
    { maxTokens: 80, timeoutMs: 2_800 },
  );
}

/**
 * Deterministic snapshot fallback — reads the live DB directly and answers
 * without the LLM. Caps worst-case latency at ~3 s when the gateway is slow
 * or unreachable. Covers the same ground as the agent: conflicts, accounts,
 * notifications, materials, audit trails, and per-plan formulary/policy rows.
 */
function buildSnapshotAnswer(question: string): string {
  const changes = db.payerChanges() as PayerChange[];
  const accounts = db.accounts() as Account[];
  const notifications = db.notifications() as Notification[];
  const events = db.auditEvents() as AuditEvent[];
  const materials = db.materials() as Material[];
  const internalUpdates = db.internalUpdates() as InternalUpdate[];
  const plans = db.plans() as Plan[];
  const medPolicyAll = db.medPolicySnapshots() as MedPolicySnapshot[];
  const formularyAll = db.formularySnapshots() as FormularySnapshot[];
  const q = ` ${norm(question)} `;

  // §5.5 priority per conflict — the same read-time computation as
  // GET /api/payer-changes: plan lives (plans.json) + affected-account
  // count, equal weight, 0–100. Nothing is persisted.
  const livesByPlan = new Map<string, number>(
    plans.map((p) => [p.id, Number(p.lives) || 0]),
  );
  const priorityByChangeId = new Map<string, ChangePriority>(
    changes.map((change) => [
      change.id,
      computePriority(
        livesByPlan.get(change.plan_id) ?? 0,
        change.affected_account_ids.length,
      ),
    ]),
  );
  const composeCtx = (change: PayerChange): ComposeContext => ({
    accounts,
    notifications,
    events,
    materials,
    wantAudit: /audit|history|trail|log|happened/.test(q),
    wantMaterials: /material|attach|document|sheet|guide|leaflet/.test(q),
    priority: priorityByChangeId.get(change.id) ?? null,
  });

  // Latest snapshot rows (one per plan).
  const latestDate = medPolicyAll.reduce(
    (max, row) => (row.as_of_date > max ? row.as_of_date : max),
    "",
  );
  const medPolicy = medPolicyAll.filter((r) => r.as_of_date === latestDate);
  const formularyDate = formularyAll.reduce(
    (max, row) => (row.as_of_date > max ? row.as_of_date : max),
    "",
  );
  const formulary = formularyAll.filter((r) => r.as_of_date === formularyDate);

  // Per-plan row lookup: match by payer/plan name tokens in the question.
  const planHit = medPolicy.find((r) => {
    const payerLower = r.payer_name.toLowerCase();
    const planLower = r.plan_name.toLowerCase();
    return q.includes(` ${payerLower} `) || q.includes(` ${planLower} `);
  });
  // Formulary rows are named "<Plan Name> Formulary" — match on the plan-name
  // prefix so "Meridian Choice PPO" finds "Meridian Choice PPO Formulary".
  const formularyHit = formulary.find((r) => {
    const payerLower = r.payer_name.toLowerCase();
    const planPrefix = r.formulary_name
      .toLowerCase()
      .replace(/\s+formulary$/, "");
    return q.includes(` ${payerLower} `) || q.includes(` ${planPrefix} `);
  });

  // 1c. Internal updates / field intel / snapshot-diff questions — answered
  // from data/internalUpdates.json (rep-entered intel + auto-detected MMIT
  // snapshot diffs between the July and August snapshots), never from the
  // canned FAQ deck. Multi-line, human-readable.
  const internalUpdateIntent =
    /\bupdates?\b|\bfield intel\b|\brep notes?\b|\bpayer calls?\b|\bintel\b|\bwhat.?s new\b/.test(
      q,
    );
  const snapshotDiffIntent =
    /\bjuly\b|\baugust\b/.test(q) &&
    /\bchange|\bdiff|\bupdate|\bsnapshot|\bversus|\bvs\b/.test(q);
  if (internalUpdateIntent || snapshotDiffIntent) {
    const all = internalUpdates
      .slice()
      .sort((a, b) => b.update_date.localeCompare(a.update_date));
    let rows = all;
    if (snapshotDiffIntent && !internalUpdateIntent) {
      rows = all.filter((u) => u.source === "MMIT" || u.detection_id !== "");
    }
    const named = rows.filter((u) =>
      updateAliases(u).some((alias) => q.includes(` ${alias} `)),
    );
    if (named.length > 0) rows = named;
    if (rows.length === 0) {
      return "No internal updates have been recorded for that plan yet.";
    }
    const header =
      snapshotDiffIntent && !internalUpdateIntent
        ? "August 1, 2026 snapshot vs July 1, 2026 — changes auto-detected by snapshot diff:"
        : `Internal updates (${rows.length} record${rows.length === 1 ? "" : "s"}, newest first):`;
    const bullets = rows.map((u) => {
      const labels = FIELD_LABEL as Record<string, string>;
      const label =
        labels[u.field.toLowerCase()] ??
        u.field.replace(/_/g, " ").toLowerCase();
      const change =
        u.prior_value === ""
          ? `${label} set to: "${u.new_value}"`
          : u.new_value === ""
            ? `${label} cleared (was "${u.prior_value}")`
            : `${label}: "${u.prior_value}" → "${u.new_value}"`;
      return (
        `• ${formatDate(u.update_date)} · **${u.payer_name} — ${u.plan_name}** · source: ${u.source}\n` +
        `  ${change}\n` +
        `  Note: ${u.note} · entered by ${u.entered_by}`
      );
    });
    return `${header}\n\n${bullets.join("\n\n")}`;
  }

  // 1d. Priority questions — conflicts ranked by the lives-based score
  // (plan lives normalized 0–100), the same numbers the Home dashboard's
  // "Major Policy Changes" list is sorted by.
  const priorityIntent =
    /\bpriorit(y|ies)\b|\brank(?:ed|ing)?\b|\bmost urgent\b|\bmost critical\b/.test(
      q,
    ) ||
    ((/\bhighest\b|\btop\b|\bbiggest\b/.test(q)) &&
      /\bconflicts?\b|\balerts?\b/.test(q));
  if (priorityIntent) {
    const ranked: RankedChange[] = changes
      .map((change) => ({
        change,
        id: change.id,
        detected_at: change.detected_at,
        priority:
          priorityByChangeId.get(change.id) ??
          computePriority(0, change.affected_account_ids.length),
      }))
      .sort(comparePriorityDesc);
    const named = ranked.filter(({ change }) =>
      changeAliases(change).some((alias) => q.includes(` ${alias} `)),
    );
    if (named.length > 0) {
      const openCount = ranked.filter((r) => r.change.status !== "resolved").length;
      return named
        .map(({ change, priority }) => {
          const rank = ranked.findIndex((r) => r.id === change.id) + 1;
          const head =
            `Priority: **${priority.score}/100** — #${rank} of ${openCount} open conflicts ` +
            `(${priority.lives.toLocaleString()} lives affected, ${priority.accounts} accounts).`;
          return `${head}\n${describeChange(change, composeCtx(change))}`;
        })
        .join("\n\n");
    }
    // "top two conflicts that need to get updated" → the 2 highest-priority
    // open conflicts; "top 3" / "five conflicts" parse the same way.
    const countMatch =
      /\b(?:top|first)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/.exec(q) ??
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:highest-priority\s+|highest\s+|most\s+urgent\s+)?(?:open\s+)?(?:conflicts?|alerts?)\b/.exec(
        q,
      );
    const requestedCount = countMatch
      ? (COUNT_WORDS[countMatch[1]] ?? Number.parseInt(countMatch[1], 10))
      : undefined;
    // "conflicts that need to get updated" → open conflicts only.
    const openOnly =
      /\bneeds?\b|\boutstanding\b|\baction\b|\battention\b|\bget updated\b|\bto fix\b|\baddress\b/.test(
        q,
      );
    const pool = openOnly
      ? ranked.filter((r) => r.change.status !== "resolved")
      : ranked;
    const shown =
      requestedCount !== undefined && requestedCount > 0
        ? pool.slice(0, requestedCount)
        : pool;
    if (shown.length === 0) {
      return "There are no open conflicts right now — everything has been resolved.";
    }
    const lines = shown.map(({ change, priority }, index) => {
      const fieldLabel = FIELD_LABEL[change.field] ?? change.field;
      return (
        `${index + 1}. **${change.payer_name} — ${change.plan_name}** — ${priority.score}/100\n` +
        `   ${priority.lives.toLocaleString()} lives affected · ${priority.accounts} accounts affected · ` +
        `${fieldLabel}: "${change.previous.value}" → "${change.authoritative.value}"` +
        ` (effective ${formatDate(change.effective_date)})` +
        (change.status === "resolved" ? " · resolved" : "")
      );
    });
    const scope = openOnly ? "open conflicts" : "conflicts";
    const header = requestedCount
      ? `Top ${shown.length} ${scope} by priority (0–100 score based on lives affected):`
      : `${openOnly ? "Open conflicts ranked" : "Conflicts ranked"} by priority (0–100 score based on lives affected):`;
    return `${header}\n\n${lines.join("\n")}`;
  }

  // 1. Specific plan asked about — answer straight from its live rows.
  // When the question asks about a CONFLICT, conflict detail is the richer
  // answer — lead with it and append the plan's policy/formulary rows.
  const conflictIntent = /conflict|alert|issue|problem|change\b/.test(q);
  if (planHit || formularyHit) {
    const parts: string[] = [];
    if (conflictIntent) {
      const mentioned: PayerChange[] = [];
      for (const change of changes) {
        if (changeAliases(change).some((alias) => q.includes(` ${alias} `))) {
          mentioned.push(change);
        }
      }
      if (mentioned.length > 0) {
        parts.push(
          mentioned
            .map((change) => describeChange(change, composeCtx(change)))
            .join("  |  "),
        );
      }
    }
    if (planHit) {
      parts.push(
        `${planHit.payer_name} — ${planHit.plan_name} (${planHit.channel}, ${Number(planHit.lives || 0).toLocaleString()} lives): coverage ${planHit.coverage_status}, prior auth ${planHit.pa_required === "Y" ? "required" : "not required"}, step therapy ${planHit.step_therapy_required === "Y" ? "required" : "not required"}, site-of-care ${planHit.site_of_care_restriction || "none"}, quantity limit ${planHit.quantity_limit || "none"} (medical policy as of ${planHit.as_of_date}).`,
      );
    }
    if (formularyHit) {
      parts.push(
        `Formulary: ${formularyHit.payer_name} — ${formularyHit.formulary_name} is ${formularyHit.formulary_status} on tier ${formularyHit.tier}, restriction ${formularyHit.restriction || "none"} (as of ${formularyHit.as_of_date}).`,
      );
    }
    return parts.join("\n\n");
  }

  // 1b. Broad aggregate questions — answer from precomputed counts (the
  // same numbers the agent briefing embeds), no LLM needed.
  const medPolicyCount = medPolicy.length;
  const coveredNoPa = medPolicy.filter(
    (r) => r.coverage_status === "Covered" && r.pa_required === "N",
  );
  const totalLives = medPolicy.reduce(
    (sum, r) => sum + Number(r.lives || 0),
    0,
  );
  if (/\bhow many\b|\btotal\b|\bcount\b|\boverall\b/.test(q)) {
    if (/prior|auth/.test(q) && /cover/.test(q)) {
      return `${coveredNoPa.length} plans cover Onvexa with no prior auth (medical policy as of ${latestDate}).`;
    }
    if (/step/.test(q) && /cover/.test(q)) {
      const stepYes = medPolicy.filter(
        (r) => r.coverage_status === "Covered" && r.step_therapy_required === "Y",
      ).length;
      return `${stepYes} plans cover Onvexa with step therapy required (medical policy as of ${latestDate}).`;
    }
    if (/cover/.test(q)) {
      const covered = medPolicy.filter(
        (r) => r.coverage_status === "Covered",
      ).length;
      return `${covered} of ${medPolicyCount} plans cover Onvexa (medical policy as of ${latestDate}).`;
    }
    if (/lives/.test(q)) {
      return `Total covered lives across all plans is ${totalLives.toLocaleString()} (medical policy as of ${latestDate}).`;
    }
  }

  // 2. Conflicts mentioned by payer/plan alias or affected account.
  // (Checked after the per-plan rows so a question naming a conflicted plan
  // gets the conflict detail, which is the richer answer.)
  const mentioned: PayerChange[] = [];
  for (const change of changes) {
    if (changeAliases(change).some((alias) => q.includes(` ${alias} `))) {
      mentioned.push(change);
    }
  }
  for (const account of accounts) {
    if (!accountAliases(account).some((alias) => q.includes(` ${alias} `))) {
      continue;
    }
    for (const change of changes) {
      if (
        change.affected_account_ids.includes(account.id) &&
        !mentioned.includes(change)
      ) {
        mentioned.push(change);
      }
    }
  }
  if (mentioned.length > 0) {
    return mentioned
      .map((change) => describeChange(change, composeCtx(change)))
      .join("\n\n");
  }

  const open = changes.filter((c) => c.status === "open");
  const resolved = changes.filter((c) => c.status === "resolved");

  // 3. Notifications.
  if (/notif|informed|communicat|email/.test(q)) {
    if (notifications.length === 0) {
      return "No notifications have been sent yet. Resolve a conflict and send the corrected path to its offices, and the notification records will show here.";
    }
    return notifications
      .map((notification) => {
        const change = changes.find(
          (c) => c.id === notification.payer_change_id,
        );
        const names = accounts
          .filter((a) => notification.recipient_account_ids.includes(a.id))
          .map((a) => a.name);
        const count = notification.recipient_account_ids.length;
        return (
          `• **${change ? `${change.payer_name} — ${change.plan_name}` : notification.payer_change_id}** — ` +
          `${count} office${count === 1 ? "" : "s"} notified on ${formatTimestamp(notification.sent_at)}` +
          (names.length > 0 ? ` (${names.join(", ")})` : "") +
          `.\n  Materials sent: ${notification.message.materials.join("; ")}.`
        );
      })
      .join("\n\n");
  }

  // 4. Materials catalog.
  if (/material|attach|document|sheet|guide|leaflet/.test(q)) {
    return materials.length === 0
      ? "No compliance-reviewed materials are available right now."
      : `There are ${materials.length} compliance-reviewed materials:\n\n${materials
          .map((m) => `• **${m.title}** (${m.category} · ${m.owner})`)
          .join("\n")}`;
  }

  // 5. Accounts affected by open conflicts.
  if (/account|office/.test(q)) {
    const perChange = open.map((change) => {
      const names = accounts
        .filter((a) => change.affected_account_ids.includes(a.id))
        .map((a) => a.name);
      return `${change.plan_name}: ${names.join(", ")}`;
    });
    return (
      `There are ${accounts.length} accounts in Territory 14 — Great Lakes.` +
      (perChange.length > 0
        ? `\n\nAccounts affected by open conflicts:\n${perChange
            .map((line) => `• ${line}`)
            .join("\n")}`
        : "\nNo accounts are currently affected by open conflicts.")
    );
  }

  // 6. Audit overview.
  if (/audit|history|trail|log|happened/.test(q)) {
    const withEvents = changes
      .map((change) => ({
        change,
        count: events.filter((e) => e.payer_change_id === change.id).length,
      }))
      .filter((x) => x.count > 0);
    return withEvents.length === 0
      ? "The audit trail is empty — no conflicts have been resolved yet."
      : `Audit trail so far:\n${withEvents
          .map(
            (x) =>
              `• **${x.change.payer_name} — ${x.change.plan_name}** (${x.count} event${x.count === 1 ? "" : "s"})`,
          )
          .join("\n")}\n\nAsk about a specific plan for the full trail.`;
  }

  // 7. Resolved summary.
  if (/resolv|cleared|complete|done/.test(q)) {
    if (resolved.length === 0) {
      return `No conflicts have been resolved yet — ${open.length} plan conflict${
        open.length === 1 ? " remains" : "s remain"
      } open.`;
    }
    return (
      `${resolved.length} of ${changes.length} plan conflicts ` +
      `${resolved.length === 1 ? "is" : "are"} resolved:\n\n` +
      resolved
        .map((change) =>
          describeChange(change, {
            ...composeCtx(change),
            wantAudit: false,
            wantMaterials: false,
          }),
        )
        .join("\n\n")
    );
  }

  // 8. Open conflicts.
  if (/\bopen\b|outstanding|pending|unresolved|conflict|alert/.test(q)) {
    if (open.length === 0) {
      return "There are no open plan conflicts right now.";
    }
    const lines = open.map((change, index) => {
      const fieldLabel = FIELD_LABEL[change.field] ?? change.field;
      return (
        `${index + 1}. **${change.payer_name} — ${change.plan_name}**\n` +
        `   ${fieldLabel}: "${change.previous.value}" → "${change.authoritative.value}" · ` +
        `${change.affected_account_ids.length} accounts affected · ` +
        `effective ${formatDate(change.effective_date)}`
      );
    });
    return (
      `There are ${open.length} open plan conflict${open.length === 1 ? "" : "s"}:\n\n` +
      lines.join("\n")
    );
  }

  // 8. Standalone greetings receive a welcome without exposing territory data.
  if (/^(hi|hello|hey|greetings|good (morning|afternoon|evening))( there)?$/.test(norm(question))) {
    return "Hello! Welcome to FRM Genius. I can help with payer-policy changes, plans, accounts, notifications, materials, and audit trails.";
  }

  // 9. Clearly malformed input receives a clarification request.
  if (isUnintelligible(question)) {
    return "I did not understand your question. Please rephrase it or ask an FRM-related question.";
  }

  // 10. Fallback — live territory snapshot.
  // 8b. Plan-attribute question that matched no plan row, conflict, or
  // catalog topic — asking for a specific plan beats dumping the generic
  // territory snapshot, which read as a non-answer to "what is the tier
  // for a plan that doesn't exist?" style questions. Broad count questions
  // are excluded — Section 1b and the LLM aggregate path own those.
  if (
    /\b(tiers?|coverage|covered|prior\s+auth(orization)?|pa|step\s+therapy|site\s+of\s+care|quantity|formular(y|ies)|restrictions?)\b/.test(
      q,
    ) &&
    !/\bhow many\b|\btotal\b|\bcount\b|\boverall\b|\bacross all\b|\bin total\b|\bsum\b/.test(q)
  ) {
    return (
      "I don't have a matching plan in the territory data. Name a specific plan — for example Meridian Choice PPO, Cascade Select HMO, Granite MA Complete, Harborview Preferred PPO, or Summit Advantage HMO — and I'll pull its live tier, coverage, prior-auth, and site-of-care details."
    );
  }

  // 9. Fallback — live territory snapshot.
  const openList = open
    .map((c) => `${c.payer_name} — ${c.plan_name}`)
    .join("; ");
  return (
    `FRM Genius watches payer-policy changes for Territory 14 — Great Lakes. ` +
    `Right now: ${open.length} open plan conflict${open.length === 1 ? "" : "s"}` +
    (open.length > 0 ? ` (${openList})` : "") +
    `, ${resolved.length} resolved. Ask about a specific payer (Meridian, Cascade, Granite, Harborview, Summit), plan, account, notification, or audit trail for live answers.`
  );
}

export async function POST(request: NextRequest) {
  const headerKey = request.headers.get("x-api-key") ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== ASSISTANT_API_KEY && headerKey !== ASSISTANT_API_KEY) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const question =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { question?: unknown }).question === "string"
      ? (body as { question: string }).question.trim()
      : "";
  if (question.length === 0) {
    return Response.json({ error: "question is required." }, { status: 400 });
  }

  try {
    // Topic-awareness: FRM-topic questions go to the LLM agent grounded in
    // an adaptive live briefing — micro-briefings (plan rows, aggregates)
    // get LLM-composed answers inside the 2.8 s budget; rich questions
    // (conflicts, notifications, materials, audit) are answered instantly by
    // the rule-based snapshot composer. Greetings/small talk get a brief
    // reply; gibberish asks for a rephrase. Any LLM failure falls back to
    // the snapshot composer so the assistant never breaks.
    const intent = classifyIntent(question);
    if (intent === "gibberish") {
      return Response.json({
        answer:
          "I'm not able to understand that. Could you rephrase your question? I can help with payer changes, affected accounts, materials, notifications, and audit trails.",
      });
    }
    if (intent === "smalltalk") {
      return Response.json({ answer: smallTalkReply(question) });
    }
    try {
      const answer = await agentAnswer(question);
      return Response.json({ answer });
    } catch (error) {
      console.error(
        "[assistant] LLM agent failed, using snapshot fallback:",
        error instanceof Error ? error.message : error,
      );
      return Response.json({ answer: buildSnapshotAnswer(question) });
    }
  } catch {
    return Response.json(
      { error: "The assistant could not compose an answer." },
      { status: 500 },
    );
  }
}
