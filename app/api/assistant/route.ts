import { NextRequest } from "next/server";
import { db } from "@/lib/db.mjs";
import { FIELD_LABEL } from "@/lib/constants.mjs";
import { ASSISTANT_API_KEY } from "@/lib/assistantConfig";
import { formatDate, formatTimestamp } from "@/lib/format";
import { buildAgentBriefing } from "@/lib/agentBriefing";
import { llmChat } from "@/lib/llm";
import type {
  Account,
  AuditEvent,
  FormularySnapshot,
  Material,
  MedPolicySnapshot,
  Notification,
  PayerChange,
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

interface ComposeContext {
  accounts: Account[];
  notifications: Notification[];
  events: AuditEvent[];
  materials: Material[];
  wantAudit: boolean;
  wantMaterials: boolean;
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
    `${change.payer_name} — ${change.plan_name} (${change.change_type_group}): ` +
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

  return parts.join(" ");
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
  const medPolicyAll = db.medPolicySnapshots() as MedPolicySnapshot[];
  const formularyAll = db.formularySnapshots() as FormularySnapshot[];
  const q = ` ${norm(question)} `;

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
            .map((change) =>
              describeChange(change, {
                accounts,
                notifications,
                events,
                materials,
                wantAudit: /audit|history|trail|log|happened/.test(q),
                wantMaterials: /material|attach|document|sheet|guide|leaflet/.test(q),
              }),
            )
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
    return parts.join(" ");
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
    return mentioned.map((change) => describeChange(change, {
      accounts,
      notifications,
      events,
      materials,
      wantAudit: /audit|history|trail|log|happened/.test(q),
      wantMaterials: /material|attach|document|sheet|guide|leaflet/.test(q),
    })).join("  |  ");
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
          `${change ? `${change.payer_name} — ${change.plan_name}` : notification.payer_change_id}: ` +
          `${count} office${count === 1 ? "" : "s"} notified on ${formatTimestamp(notification.sent_at)}` +
          (names.length > 0 ? ` (${names.join(", ")})` : "") +
          `; materials sent: ${notification.message.materials.join("; ")}.`
        );
      })
      .join("  |  ");
  }

  // 4. Materials catalog.
  if (/material|attach|document|sheet|guide|leaflet/.test(q)) {
    return materials.length === 0
      ? "No compliance-reviewed materials are available right now."
      : `There are ${materials.length} compliance-reviewed materials: ${materials
          .map((m) => `${m.title} (${m.category} · ${m.owner})`)
          .join("; ")}.`;
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
        ? ` Accounts affected by open conflicts — ${perChange.join("; ")}.`
        : " No accounts are currently affected by open conflicts.")
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
      : `Audit trail so far: ${withEvents
          .map(
            (x) =>
              `${x.change.plan_name} (${x.count} event${x.count === 1 ? "" : "s"})`,
          )
          .join("; ")}. Ask about a specific plan for the full trail.`;
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
      `${resolved.length === 1 ? "is" : "are"} resolved: ` +
      resolved
        .map((change) =>
          describeChange(change, {
            accounts,
            notifications,
            events,
            materials,
            wantAudit: false,
            wantMaterials: false,
          }),
        )
        .join("  |  ")
    );
  }

  // 8. Open conflicts.
  if (/\bopen\b|outstanding|pending|unresolved|conflict|alert/.test(q)) {
    if (open.length === 0) {
      return "There are no open plan conflicts right now.";
    }
    return (
      `There are ${open.length} open plan conflicts: ` +
      open
        .map(
          (change) =>
            `${change.payer_name} — ${change.plan_name} (` +
            `${FIELD_LABEL[change.field] ?? change.field} ` +
            `"${change.previous.value}" → "${change.authoritative.value}", ` +
            `${change.affected_account_ids.length} accounts affected, ` +
            `effective ${formatDate(change.effective_date)})`,
        )
        .join("; ") +
      "."
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
