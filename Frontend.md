# Plan.md — FRM Conflict Watch · Frontend Build Plan (Agent-Ready)

> **Feed this file to the coding agent.** The agent builds the ENTIRE frontend for the
> FRM Conflict Watch hackathon project by running the **4-Part Loop** (Context →
> Execution Protocol → Built-in Critic → Exit Condition) for every work unit below.
>
> Reference assets (do not modify):
> - Source of truth: `../FRM genius resources/FRM_Conflict_Watch_Hackathon_Brief Source OF Truth.docx`
> - Expected pages: `../FRM genius resources/Expected Frontend/PAGE 1.png` … `PAGE 4.png`
> - Loop framework: `../FRM genius resources/Loop for model  .png`

---

## 0. HOW THE AGENT MUST WORK — THE 4-PART LOOP

You are a frontend engineer agent. You do **not** decide scope — this plan does.
For **every Work Unit (WU)** in Section 3, run this loop **in order**:

```
┌──────────────────────────────────────────────────────────────────┐
│  1. CONTEXT            Read the WU spec + design tokens + data.  │
│                        Restate the boundary in one sentence      │
│                        before writing code.                      │
│  2. EXECUTION PROTOCOL Build exactly what the spec says, in the  │
│                        order given. No extra features.           │
│  3. BUILT-IN CRITIC    Score your own output against the WU      │
│                        rubric (1–10 per dimension). List the 2   │
│                        biggest gaps. Fix them.                   │
│  4. EXIT CONDITION     Repeat 2→3 until EVERY rubric dimension   │
│                        scores ≥ 9/10 and every checklist item    │
│                        passes. Then, and only then, move to the  │
│                        next WU.                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Loop rules (non-negotiable):**

1. **One WU at a time.** Never start WU n+1 before WU n has exited.
2. **Critic report is mandatory.** After each build pass, output a table:
   `| Dimension | Score /10 | Gap | Fix applied |`. If you cannot score a
   dimension, you have not finished the pass.
3. **Iteration cap:** max **3** critique→improve cycles per WU. If a dimension
   is still < 9 after 3 cycles, log the residual gap in `CRITIC-LOG.md` and
   continue — never loop forever, never silently skip.
4. **Copy is verbatim.** All on-screen strings come from the specs in Section 4.
   Do not paraphrase compliance language, provenance metadata, or labels.
5. **Scope fence.** If a task is not in this plan, it does not get built.
   Out-of-scope list is in Section 1.5.
6. **Visual check.** After each page WU, open the running app and compare
   against the corresponding PNG. Fix the top-2 visual deltas before exiting.

---

## 1. PART 1 — CONTEXT (background & boundaries)

### 1.1 The product in one paragraph

**FRM Conflict Watch** is a thin vertical slice of the FRM (Field Reimbursement
Manager) tool. Jordan Lee, FRM for oncology & rare disease (Territory 14 — Great
Lakes), opens the app and is warned that **MMIT** (a payer-policy data source)
changed overnight, creating conflicts with existing account guidance. Jordan sees
exactly which accounts are impacted, clears the conflict **once at territory
level**, and communicates the corrected path to every impacted office **in the
same motion** — with source, date, and plan visible on every claim. Compliance
and provenance are **visible on screen**, not enforced by an engine.

### 1.2 The one demo scenario (= definition of done)

The frontend must make this exact sequence clickable, end to end:

1. **Open** → conflict warning is the first thing on screen (MMIT update, conflict created, count of affected accounts).
2. **See impact** → territory view lists affected plans/accounts with old vs. new value, source, last-updated date.
3. **Resolve once** → one control clears the conflict across all affected accounts (confirm step; Jordan confirms the true authoritative path). No per-account drill-in.
4. **Communicate** → one action notifies all impacted accounts with the corrected path, carrying source + effective date. Templated, MLR-safe. No free text.
5. **Confirm** → conflict clears, accounts return to resolved state, notification recorded, provenance + audit trail visible.

### 1.3 Persona & tone

- Persona: **Jordan Lee**, Field Reimbursement Manager, Oncology & Rare Disease, Territory 14 — Great Lakes.
- Jordan thinks in **barriers**, not policies. Tone: calm, factual, evidence-first.
- Speed has no value if the answer is wrong → **trust before efficiency**. Every
  value on screen must answer: *where did this come from, when, for which plan?*

### 1.4 Product & data facts (synthetic only)

- Product: **Onvexa** ((pharmagenic) capsules) — synthetic infused oncology product.
- Territory: **Territory 14 — Great Lakes**. User: **Jordan Lee**.
- Payers/plans (synthetic): Commercial — Aetna PPO · Commercial — Aetna HMO ·
  Managed Medicare — UnitedHealthcare Choice Plus · Medicare Part D — Cigna Open Access.
- Conflict source: **MMIT**, updated **26 Aug 2026**, effective dates 2026-09-01 / 2026-09-15 / 2026-10-01.
- Accounts (subset shown in UI): Midwest Cancer Associates (Commercial · Aetna HMO · 48201),
  Metro Oncology Services (Commercial · Aetna HMO · 55401), plus ~8–13 more synthetic
  accounts across the 4 plans (total territory ≈ 10–15 accounts).
- Flat data model (mirror it in TypeScript types):
  - `Account (id, name, territory, plan_id)`
  - `Plan (id, payer, plan_name)`
  - `PolicyRecord (account_id, source, value, effective_date, status)`
  - `SourceUpdate (source, field, old_value, new_value, timestamp)`
  - Conflict = any account whose current `PolicyRecord` disagrees with the latest `SourceUpdate`.

### 1.5 Scope fence

| ✅ IN SCOPE (build) | ❌ OUT OF SCOPE (never build) |
|---|---|
| Conflict alert on open (MMIT update) | Login, user management, roles/permissions |
| Territory-level impact view | Real payer/policy data or live integrations |
| One-action, territory-level resolve | Account-by-account editing workflows |
| Territory-level communicate to accounts | Real email/SMS/hub delivery integrations |
| Templated, MLR-safe notification message | Free-text or promotional messaging (no free-text inputs anywhere) |
| Visible provenance & compliance markers | A real MLR/compliance approval engine |
| Synthetic data: 1 product, 4 plans, ~12 accounts | Prior auth, appeals, denials workflows |
| The 5 demo states, working | Search, dashboards, analytics, reporting |

### 1.6 Design system (extracted from PAGE 1–4 — use these tokens)

**Colors**

| Token | Value | Usage |
|---|---|---|
| `--nav-bg` | `#161616` | Top navigation bar |
| `--magenta` | `#C40D7E` | Banner, active tab underline, "N PLANS OPEN", accents |
| `--magenta-soft` | `#D6258F` | "4 open" pill background on banner |
| `--page-bg` | `#F4F4F5` | App background |
| `--surface` | `#FFFFFF` | Cards, drawer |
| `--ink` | `#1A1A1A` | Primary text |
| `--muted` | `#6B7280` | Secondary text, strikethrough old values |
| `--green` | `#0E7A3D` | RESOLVED pill text/border, authoritative value text, check icons |
| `--green-bg` | `#F0FDF4` | Authoritative card bg, green info boxes |
| `--green-border` | `#16A34A` | Authoritative card border |
| `--indigo` | `#2F3AA0` | "Review →" outline buttons, active stepper, checked checkboxes |
| `--indigo-dark` | `#1F2A7A` | Filled primary CTAs ("Select materials →", "Preview message →", "Send to 2 offices →") |
| `--indigo-bg` | `#EEF2FF` | "UPDATED GUIDANCE" box in message preview |
| `--border` | `#E5E7EB` | Row/card dividers |

**Typography**

- Sans: **Inter** (400/600/700) — headings, body, buttons.
- Mono: **JetBrains Mono** or `ui-monospace` — ALL provenance metadata
  (source · date · plan · account counts · effective dates · chips).
- Eyebrow labels: 11–12px, uppercase, letter-spacing 0.08em, muted color.

**Recurring components** (build once in WU2, reuse everywhere)

- `ComplianceBadge` — green outline pill, shield icon, text `COMPLIANCE-REVIEWED`.
- `StatusPill` — `RESOLVED` (green outline) / `4 open` (magenta soft).
- `ValueTransition` — old value (gray, **strikethrough**) → `→` arrow → new value
  (green when resolved/authoritative, ink when open).
- `ProvenanceMeta` — mono string, e.g. `3 accounts resolved · Eff. 2026-09-01 · by Jordan Lee · Aug 26, 2026, 21:36`.
- `Accordion` — chevron + bold title, right-aligned magenta `N PLANS OPEN`.
- `CheckboxCard` — rounded card, indigo filled checkbox, bold name + mono sub-line.
- `Stepper` — 3 steps: filled indigo circle = active, green check circle = done,
  gray circle = upcoming; connecting lines; label text colored accordingly.
- `Drawer` — right slide-over (~55% width, min 720px), magenta header with title +
  open-count pill + close ✕, scrollable body, sticky footer (left: Cancel/Back,
  right: primary CTA).
- `InfoBox` — rounded box: green variant (action summary) / gray variant (notes).
- `FloatingHelp` — circular `?` button, bottom-right, all screens. **Superseded by
  the FRM Assistant chatbot (§11): same position/size, magenta launcher + chat
  panel (FAQ mode + AI-agent ask mode).**

**Layout**

- Desktop-first, design width 1440px. Top nav (~88px) → thin magenta rule →
  white logo header → gray page area with white rounded cards (radius 12px,
  subtle shadow).

---

## 2. PART 2 — EXECUTION PROTOCOL (how to do the work)

### 2.1 Stack (fixed — do not substitute)

- **Next.js (App Router) + TypeScript**, **Tailwind CSS**, `lucide-react` icons.
  No `react-router-dom` — routing is file-based under `app/`.
- Interactive components (store, drawer, dev panel, accordions) are client
  components (`'use client'`); pages render client trees.
- No backend required for the demo. All state is client-side from seeded
  synthetic data.
- Create a thin `services/api.ts` interface (`getConflicts`, `resolveConflict`,
  `notifyAccounts`, `sendNotificationEmail`) backed by the mock store, so the
  backend teammate can swap implementations later without touching UI code.
  `sendNotificationEmail(payload)` is the real email-dispatch call: on
  `Confirm & send` the frontend invokes it and the backend teammate's endpoint
  sends the email to the recipients. Until that endpoint is ready, the function
  resolves against a local mock (simulated latency, no network).

### 2.2 File structure to create

```
app/
  layout.tsx                   # root layout: fonts, tokens.css import
  page.tsx                     # Home (stub for now; WU10 builds it)
  payer-changes/page.tsx       # PAGE 1
  accounts/page.tsx            # stub (WU11 builds it)
styles/tokens.css              # design tokens from §1.6
data/synthetic.ts              # accounts, plans, policyRecords, sourceUpdates, materials
store/ConflictStore.tsx        # 'use client' Context + useReducer; actions below
services/api.ts                # swappable API surface over the store + sendNotificationEmail
components/
  layout/TopNav.tsx  layout/LogoHeader.tsx
  ui/{ComplianceBadge,StatusPill,ValueTransition,ProvenanceMeta,
      Accordion,CheckboxCard,Stepper,Drawer,InfoBox,FloatingHelp}.tsx
features/payer-change/
  PayerChangeDrawer.tsx        # drawer shell + stepper + step routing
  steps/Step1ReviewConfirm.tsx     # PAGE 2
  steps/Step2Materials.tsx         # PAGE 3
  steps/Step3Communicate.tsx       # PAGE 4
  ConfirmSendDialog.tsx            # PAGE 4b — confirm & send popup
  ResolutionSummaryAuditTrail.tsx
features/assistant/            # FRM Assistant chatbot — full spec in §11
  AssistantLauncher.tsx        # magenta floating launcher (replaces FloatingHelp)
  AssistantPanel.tsx           # chat panel shell: header, scrollable body, input
  FaqList.tsx                  # FAQ mode: expandable Q rows (+ toggles answer)
  FaqItem.tsx                  # one FAQ row: question + plus/close + answer
  ChatMessage.tsx              # one message bubble (user / assistant)
  AssistantInput.tsx           # bottom ask bar (the ONLY free-text input allowed)
  useAssistant.ts              # mode/message state machine + send orchestration
lib/faq.ts                     # FAQ loader + keyword matcher (index.hbs.json)
services/assistant.ts          # askAgent() — swappable AI-agent API surface
data/faq.json                  # FAQ knowledge base (seeded from index.hbs.json)
```

### 2.3 Store contract (implement exactly)

State: `conflicts[]` (one per plan-level conflict), each with
`{ id, conflictType, plan, old_value, new_value, source, source_updated,
effective_date, accounts[], status: 'open' | 'resolved', resolved_by?, resolved_at?,
materials[], notified_offices? }`.

Actions:
- `RESOLVE_CONFLICT(conflictId, accountIds[], materialIds[], message)` → sets
  status `resolved`, stamps `resolved_by: 'Jordan Lee'`, `resolved_at: now`,
  attaches materials, marks selected accounts resolved + notified.
- `RESET_DEMO()` → restores seeded "4 open / 1 of 5 resolved" state.
- `SIMULATE_MMIT_UPDATE()` → flips seeded resolved rows back to open (demo trigger).

Seed on load: **5 total plan conflicts, 1 resolved (Aetna PPO), 4 open** → banner
reads `4 open` · `1 of 5 plan conflicts resolved today`. Deterministic — no random.

### 2.4 Work units & build order

Build in this order. Each WU gets its own loop (§0).

---

#### **WU0 — App shell & tokens**
**Context:** Layout only; no feature logic.
**Protocol:**
1. Scaffold Next.js (App Router) app; install deps; wire Tailwind + `tokens.css`.
2. `TopNav`: dark bar. Left tabs: `Home` · `Payer Changes` (active: white text +
   3px magenta underline) · `Accounts` (inactive: gray). Right: small mono gray
   `Field Reimbursement Manager` above white `Jordan Lee`.
3. Thin magenta rule under nav; `LogoHeader`: gem/diamond icon + `Pharma` (ink) +
   `RX` (magenta), tiny sub `(pharmagenic) capsules`.
4. Routes: `/payer-changes` default redirect from `/`; Home & Accounts = stubs
   ("Stub — out of scope for demo").
**Critic rubric:** visual fidelity · token usage (no hardcoded colors) · routing.
**Exit:** nav/logo match PAGE 1 top region; zero hardcoded hex outside tokens.

---

#### **WU1 — Synthetic data & store**
**Context:** Deterministic seeded dataset powering every screen.
**Protocol:** Implement §1.4 model + §2.3 contract. Seed exactly:
- 5 plan conflicts: Aetna PPO (resolved), Aetna HMO (open, 2 accounts),
  UnitedHealthcare Choice Plus site-of-care (open, 3 accounts, eff. 2026-09-15),
  Cigna Open Access step therapy (open, 3 accounts, eff. 2026-09-15),
  UnitedHealthcare Choice Plus step therapy (open, 4 accounts, eff. 2026-10-01).
- 4 MLR materials (§WU5 list) tagged `compliance_reviewed: true`.
- ~12 accounts incl. Midwest Cancer Associates & Metro Oncology Services.
**Critic rubric:** type fidelity to §1.4 · seed determinism · store actions pure.
**Exit:** banner derived from state renders `4 open` / `1 of 5 plan conflicts resolved today`.

---

#### **WU2 — UI primitives**
**Context:** Every recurring component from §1.6, built once.
**Protocol:** Build all 10 components with typed props + Storybook-free visual
test page (temporary route `/_kit`).
**Critic rubric:** API ergonomics · token compliance · accessibility (focus
states, checkbox keyboard, aria on accordion/stepper).
**Exit:** all primitives render correctly in `/_kit`; no feature code yet.

---

#### **WU3 — PAGE 1: Payer Changes landing**
**Context:** The conflict alert IS the landing. Conflict is the hero — flagged, not buried.
**Protocol (top→bottom):**
1. Magenta banner card-top: bold `Payer Change` + soft pill `4 open` +
   `· 1 of 5 plan conflicts resolved today`.
2. Accordion `Site-of-care requirement` — right: `2 PLANS OPEN` (magenta, small caps). Rows:
   - `Commercial — Aetna PPO` + `RESOLVED` pill · ValueTransition: ~~Office-based
     infusion permitted~~ → `Hospital Outpatient Department (HOPD) required` (green) ·
     mono `3 accounts resolved · Eff. 2026-09-01 · by Jordan Lee · Aug 26, 2026, 21:36` · no button.
   - `Commercial — Aetna HMO` · ~~Office-based infusion permitted~~ → `Hospital
     Outpatient Department (HOPD) required` · mono `2 accounts affected · Eff. 2026-09-01` · `Review →` (indigo outline).
   - `Managed Medicare — UnitedHealthcare Choice Plus` · ~~Office-based infusion
     permitted~~ → `HOPD or 340B hospital outpatient pharmacy — prior authorization
     required for site selection` · mono `3 accounts affected · Eff. 2026-09-15` · `Review →`.
3. Accordion `PA step therapy requirement` — `2 PLANS OPEN`. Rows:
   - `Medicare Part D — Cigna Open Access` · ~~No step therapy required prior to PA
     approval~~ → `2-line step therapy required before PA approval` · mono
     `3 accounts affected · Eff. 2026-09-15` · `Review →`.
   - `Managed Medicare — UnitedHealthcare Choice Plus` · ~~No step therapy required
     prior to PA approval~~ → `1-line step therapy required; waiver available with
     documented contraindication` · mono `4 accounts affected · Eff. 2026-10-01` · `Review →`.
4. `ResolutionSummaryAuditTrail` card (see WU7) below the accordions.
5. `Review →` opens the Drawer (WU4) scoped to that conflict.
**Critic rubric:** visual fidelity vs PAGE 1 · copy verbatim · provenance on every
row · banner count derived from store.
**Exit:** pixel-compare top-2 deltas fixed; every value shows source/date/plan.

---

#### **WU4 — Drawer shell + STEP 1: Review & Confirm (PAGE 2)**
**Context:** Territory-level resolve lives here. System informs; **Jordan clicks**.
**Protocol:**
1. `Drawer`: magenta header `Payer Change` + `4 open` pill + ✕ (closes, resets step).
2. Body: eyebrow `SITE-OF-CARE REQUIREMENT`; H1 `Commercial — Aetna HMO`; mono
   `Onvexa · Territory 14 · Eff. 2026-09-01 · Source: MMIT`.
3. `Stepper` — step 1 active: `1 Review & Confirm` (indigo) · `2 Materials` · `3 Communicate`.
4. `POLICY CHANGE` section:
   - Card A (gray, unselected radio): label `PREVIOUS — SUPERSEDED`; strikethrough
     `Office-based infusion permitted`; mono chips `Internal · Jan 2026 · Aetna HMO`.
   - Card B (green border, selected radio + green check): label
     `AUTHORITATIVE — COMMERCIAL · AETNA HMO` + `COMPLIANCE-REVIEWED` badge;
     bold `Hospital Outpatient Department (HOPD) required`; mono
     `Eff. 2026-09-01 · Source: MMIT`.
5. `ACCOUNTS TO RESOLVE (2 OF 2 SELECTED)` + right link `Show detail`
   (toggles an inline detail list of the affected accounts).
6. CheckboxCards (all selected by default): `Midwest Cancer Associates` /
   mono `Commercial · Aetna HMO · 48201`; `Metro Oncology Services` /
   mono `Commercial · Aetna HMO · 55401`.
7. Green InfoBox: bold `2 accounts will be updated to: Hospital Outpatient
   Department (HOPD) required` + `System-generated from MMIT data. Jordan Lee
   remains the decision-maker.` (count updates live with checkboxes).
8. Footer: `Cancel` (outline) · `Select materials →` (indigo-dark filled; disabled
   if 0 accounts selected).
**Critic rubric:** visual fidelity vs PAGE 2 · human-in-the-loop visible ·
live count correctness · radio toggle behavior.
**Exit:** selecting/deselecting accounts updates the InfoBox count; Cancel/✕ work.

---

#### **WU5 — STEP 2: Materials (PAGE 3)**
**Context:** Only MLR-approved, compliance-reviewed assets are selectable. Pre-selected.
**Protocol:**
1. Stepper: 1 = green check `Review & Confirm`; 2 = active indigo `Materials`; 3 = gray.
2. Eyebrow `MLR-APPROVED MATERIALS — SITE-OF-CARE REQUIREMENT`; copy:
   `All relevant materials are pre-selected. Deselect any you wish to exclude.
   Only compliance-reviewed assets are available.`
3. Four CheckboxCards (checked by default), each: title · category · mono chip
   `owner · date` · right `COMPLIANCE-REVIEWED` badge:
   1. `Onvexa Site-of-Care Guidance Sheet (HOPD)` — `Clinical` — `Medical Affairs · 2026-08-15`
   2. `Onvexa HOPD Coding Quick Reference` — `Coding` — `Market Access · 2026-08-10`
   3. `Patient Support Enrollment — HOPD Site Update` — `Patient` — `Patient Services · 2026-08-20`
   4. `Prior Authorization Requirements — Onvexa (Aug 2026)` — `Policy` — `MMIT · 2026-08-26`
4. Gray InfoBox: `4 materials will be attached. No promotional or non-approved
   content is selectable.` (live count).
5. Footer: `← Back` (outline) · `Preview message →` (filled).
**Critic rubric:** visual fidelity vs PAGE 3 · pre-selection default · live count.
**Exit:** Back returns to step 1 with state intact; count tracks selections.

---

#### **WU6 — STEP 3: Communicate (PAGE 4)**
**Context:** One motion notifies every impacted office. Templated, MLR-safe, provenance embedded.
**Protocol:**
1. Stepper: 1 ✓, 2 ✓ green; 3 = active indigo `Communicate`.
2. `RECIPIENTS (2 OFFICES)` + gray chips: `Midwest Cancer Associates · Aetna HMO`,
   `Metro Oncology Services · Aetna HMO` (derived from step-1 selection).
3. `MESSAGE PREVIEW` — email card:
   - Header block: `To: 2 selected offices — Territory 14` · `Re: Onvexa
     Site-of-care requirement Update — Corrected Path` · `From: Jordan Lee, FRM ·
     Territory 14 — Great Lakes` + `COMPLIANCE-REVIEWED` badge.
   - Body: `Dear Office,` / `This message confirms an update to the
     **Site-of-care requirement** guidance for **Onvexa** administered through your plan.`
   - Indigo InfoBox: label `UPDATED GUIDANCE`; indigo bold `Hospital Outpatient
     Department (HOPD) required`; mono chips `MMIT · 26 Aug 2026 · Aetna HMO` +
     `Effective: 2026-09-01`.
   - `This update reflects the latest authoritative payer policy from **MMIT**,
     effective **2026-09-01**. Please update your office workflows accordingly.`
   - `ATTACHED MATERIALS` — 4 rows (name + `COMPLIANCE-REVIEWED` badge), from step 2.
   - Signature: `Jordan Lee — Field Reimbursement Manager, Oncology & Rare Disease`
     / `Territory 14 — Great Lakes · August 26, 2026`.
4. Gray InfoBox: `Generated from a compliance-reviewed, MLR-approved template. No
   free-text promotional content included. Source provenance (MMIT · 26 Aug 2026)
   is embedded throughout.`
5. Footer: `← Back` · `Send to 2 offices →` (filled; label shows live recipient count).
6. **On `Send to N offices →`:** open `ConfirmSendDialog` (PAGE 4b, per Figma node
   2:1502) — inline confirmation panel in the drawer footer area:
   - Heading `Send to 2 offices?` (live count).
   - Body: `This will notify 2 offices of the corrected Site-of-care requirement
     guidance. The email is generated from the compliance-reviewed template above.`
   - Buttons side by side: `Cancel` (outline, returns to step 3 unchanged) ·
     `Confirm & send` (filled indigo-dark).
7. **On `Confirm & send`:**
   1. Call `services/api.ts` → `sendNotificationEmail({ recipients, subject,
      messageHtml, materials, conflict })` — the backend teammate's endpoint
      dispatches the email to each recipient office. Until the endpoint is ready,
      the mock resolves locally (simulated latency, logged payload).
   2. On success: dispatch `RESOLVE_CONFLICT` → close drawer → PAGE 1 updates:
      row becomes `RESOLVED` (green new value, mono `2 accounts resolved · Eff.
      2026-09-01 · by Jordan Lee · <timestamp>`), banner decrements (`3 open` ·
      `2 of 5 plan conflicts resolved today`), audit trail gains the entry.
   3. On failure: keep drawer open on step 3, show inline error InfoBox, allow
      retry. Never resolve the conflict if the email dispatch failed.
**Critic rubric:** visual fidelity vs PAGE 4 · template has zero free-text inputs ·
confirm-popup → email dispatch → resolved-state transition correctness.
**Exit:** full scenario clickable: open → review → materials → send → confirm →
email dispatched → resolved.

---

#### **WU7 — Resolution Summary & Audit Trail (PAGE 1 bottom)**
**Context:** Post-action confirmation with visible provenance. Judges audit everything.
**Protocol:**
1. Card titled `Resolution Summary & Audit Trail`; sub `1 conflict resolved by Jordan Lee` (live count).
2. Per resolved conflict, an entry: green check circle · `Commercial — Aetna PPO ·
   Site-of-care requirement` · `Resolved by Jordan Lee · Aug 26, 2026, 21:36` ·
   label `CORRECTED PATH` · green box `Hospital Outpatient Department (HOPD)
   required` · mono `MMIT · 26 Aug 2026 · Aetna PPO` + `Effective: 2026-09-01` ·
   label `AUDIT TRAIL` with event lines (`Resolved — Jordan Lee · <ts>`,
   `Notified — 2 offices · <ts>`, `Materials attached — 4 · <ts>`).
3. New entries prepend when WU6 send completes.
**Critic rubric:** provenance completeness · live updates after send.
**Exit:** judge can point at any value and see source, date, and plan.

---

#### **WU8 — Demo determinism & stubs**
**Context:** The demo must run deterministically, twice, without crashes.
**Protocol:**
1. Seed state on load (no randomness, no dates derived from "now" except
   `resolved_at` stamps).
2. Dev-only controls (small floating panel, hidden on print): `Reset demo`,
   `Simulate MMIT update`.
3. Edge-case hardening: 0 accounts selected, 0 materials selected, double-send,
   rapid open/close — none may crash or dead-end the UI.
4. Home & Accounts stubs finalized.
**Critic rubric:** determinism · edge cases · reset fidelity.
**Exit:** 10 consecutive reset→full-scenario runs with zero errors.

---

#### **WU9 — Final critic pass & freeze**
**Protocol:** Run the FULL critic (Section 4) across all pages; fix every <9;
rehearse the demo script clicks in order; freeze code.
**Exit:** Section 4 global exit condition met.

---

## 3. PART 3 — BUILT-IN CRITIC (standards to self-evaluate against)

Score every WU on these dimensions (1–10). **9+ required to exit.**

| # | Dimension | What 10 looks like |
|---|---|---|
| 1 | **Visual fidelity** | Side-by-side with the PNG: layout, spacing, hierarchy, colors match; top-2 deltas fixed |
| 2 | **Copy fidelity** | Every label, value, metadata string matches Section 2 verbatim — zero paraphrasing |
| 3 | **Provenance visibility** | Every value on screen shows source + date + plan (mono metadata); judge-test passes |
| 4 | **Compliance made visible** | `COMPLIANCE-REVIEWED` badges, MLR-safe template, "Jordan remains the decision-maker", no free-text inputs |
| 5 | **Conflict as hero** | Old vs. new side-by-side with strikethrough → arrow; banner unmissable on open |
| 6 | **Interaction correctness** | All transitions work: drawer open/close, stepper back/forward, live counts, send → resolved |
| 7 | **Human-in-the-loop** | Resolve & communicate are deliberate clicks; system-generated content is labeled as such |
| 8 | **Code quality** | Typed props, components reused (not duplicated), tokens only (no stray hex), no dead code |
| 9 | **Demo determinism** | Seeded state, reset works, edge cases can't crash the run |

**Per-WU critic output format (mandatory):**

```
### CRITIC REPORT — WU<n> (iteration <k>)
| Dimension | Score | Gap | Fix applied |
|---|---|---|---|
| 1 Visual fidelity | 7 | Banner pill spacing off | padding fix |
...
Top-2 gaps → fixed? Y/N
EXIT? Y/N  (all ≥9 AND checklist clean)
```

**Hard checklist (any ❌ = no exit):**
- [ ] No login, no roles, no real integrations, no analytics.
- [ ] Zero free-text `<input>`/`<textarea>` in user-facing flows.
- [ ] Every monetary/policy value carries `source · date · plan`.
- [ ] `COMPLIANCE-REVIEWED` badge on: authoritative policy card, all 4 materials,
      message preview header, all attached-material rows.
- [ ] Strikethrough old value → arrow → new value on every conflict row.
- [ ] Banner counts derived from store, not hardcoded.
- [ ] TypeScript: no `any` in feature code; build passes with zero errors.
- [ ] Assistant (§11): FAQ answers render verbatim from `data/faq.json` — never
      LLM-paraphrased; agent answers carry the `AI-GENERATED` label; the ask input
      is the only free-text control in the app and lives inside the assistant panel.

---

## 4. PART 4 — EXIT CONDITION (the measurable bar that ends the loop)

### Per-work-unit exit
Every rubric dimension **≥ 9/10** AND hard checklist all ✅ AND visual
top-2 deltas vs the PNG fixed. Max 3 iterations, then log & move on.

### Global exit (project done only when ALL are true)

1. **Demo scenario runs live, end to end, clickable:**
   open → alert (`4 open`) → `Review →` → Step 1 (accounts selected, authoritative
   path confirmed) → Step 2 (4 materials) → Step 3 (message preview) →
   `Send to 2 offices →` → confirm popup (`Send to 2 offices?` / `Confirm & send`)
   → email dispatched via `sendNotificationEmail()` → drawer closes → row shows
   `RESOLVED` → banner `3 open` · `2 of 5 plan conflicts resolved today` →
   audit trail entry present.
2. **All 4 expected pages visually match** `PAGE 1.png`–`PAGE 4.png` (layout,
   copy, tokens) at 1440px.
3. **Judge test passes:** pointing at ANY value on screen immediately shows
   where it came from, when, and for which plan.
4. **Compliance story lands:** system-generated vs. sourced facts visually
   distinguished; resolve + communicate are explicit human decisions; message is
   templated and MLR-safe with provenance embedded.
5. **Determinism:** 10 consecutive clean runs of the scenario (reset between)
   with zero crashes or dead ends.
6. **Code frozen:** `npm run build` passes with zero errors; no console errors
   during the full scenario.

**When the global exit condition is met: stop. Deliver. Do not add features.**

---

## 5. Appendix — Demo script the UI must support (rehearse order)

1. **Set stakes (15s):** Jordan manages a territory; overnight MMIT changed a policy.
2. **Open (20s):** conflict warning first on screen; names the source; count visible.
3. **Show impact (30s):** territory view — old value, new value, source, date all visible.
4. **Resolve once (25s):** single territory-level resolve + confirm true path.
5. **Communicate (25s):** territory-level notification with source + effective date.
6. **Land compliance (20s):** resolved-and-notified state; provenance; markers.
7. **Close (20s):** "Reactive denial resolution became proactive barrier prevention."

---

## 6. COMPONENTS & FUNCTIONALITY — PAYER CHANGES PAGE (360° INVENTORY)

> **Source of truth for this section:** `Expected Frontend/PAGE 1.png` (landing),
> `PAGE 2.png` (drawer step 1), `PAGE 3.png` (drawer step 2), `PAGE 4.png` (drawer
> step 3). **Functionality reference:** Figma file `UEzMHS0lK6fzncHKjlZ7IT`
> (nodes 1:2, 2:231, 2:642, 2:1064, 2:1502, 2:1949) — Figma defines the click
> flows and interaction logic (stepper done/active states, confirm & send popup,
> post-send resolved state, audit-trail composition); the PNGs + §1.6 tokens
> define the visual design and copy. Every component below is inventoried with
> its props, behavior, states, and data dependencies. Build these in WU2
> (primitives) + WU3–WU7 (features).

### 6.1 Screen map (how the 4 PNGs compose into one page)

```
TopNav ─ LogoHeader
└── PayerChangesPage (/payer-changes)
    ├── PayerChangeBanner            ← PAGE 1 top
    ├── ChangeAccordion ×2           ← PAGE 1 middle (site-of-care, PA step therapy)
    │   └── ChangeRow ×2 each        ← plan rows (RESOLVED row has no button)
    ├── ResolutionSummaryAuditTrail  ← PAGE 1 bottom
    └── PayerChangeDrawer (slide-over, opened by any "Review →")
        ├── DrawerHeader (magenta)   ← shared across PAGE 2–4
        ├── Stepper (3 steps)
        ├── Step 1: ReviewConfirm    ← PAGE 2
        ├── Step 2: Materials        ← PAGE 3
        ├── Step 3: Communicate      ← PAGE 4
        └── ConfirmSendDialog        ← PAGE 4b (Figma 2:1502)
FloatingHelp (?) — global, bottom-right, all screens
```

### 6.2 Component inventory (360°)

| # | Component | From | Props (typed) | Functionality / behavior | States | Data dependency |
|---|---|---|---|---|---|---|
| 1 | `TopNav` | PAGE 1 | `activeTab` | Tabs `Home · Payer Changes · Accounts`; active = white text + 3px magenta underline; right side mono gray `Field Reimbursement Manager` over white `Jordan Lee` | active/inactive tab | route |
| 2 | `LogoHeader` | PAGE 1 | — | Gem icon + `Pharma`(ink)`RX`(magenta) + sub `(pharmagenic) capsules`; thin magenta rule above | — | static |
| 3 | `PayerChangeBanner` | PAGE 1 | `openCount`, `totalConflicts`, `resolvedToday` | Magenta card-top; bold `Payer Change` + soft pill `4 open` + `· 1 of 5 plan conflicts resolved today`; counts **derived from store**, never hardcoded | open / decrementing / calm(0) | `conflicts[]` |
| 4 | `ChangeAccordion` | PAGE 1 | `title`, `openPlansCount`, `rows`, `defaultOpen` | Chevron + bold title; right-aligned magenta small-caps `N PLANS OPEN`; expand/collapse (both default open) | expanded/collapsed | `conflicts[]` grouped by `conflictType` |
| 5 | `ChangeRow` | PAGE 1 | `plan`, `oldValue`, `newValue`, `effectiveDate`, `accountsAffected`, `status`, `resolvedMeta?` | Plan name + `StatusPill`; `ValueTransition` old→new; mono provenance line; `Review →` button **only when open** (RESOLVED rows render no button) | open / resolved | `conflict` record |
| 6 | `StatusPill` | PAGE 1 | `variant: 'resolved'\|'open'`, `count?` | `RESOLVED` green outline / `4 open` magenta soft | 2 variants | conflict status |
| 7 | `ValueTransition` | PAGE 1–4 | `old`, `current`, `tone: 'open'\|'resolved'` | Old value gray **strikethrough** → `→` arrow → new value (green when resolved/authoritative, ink when open) | 2 tones | conflict old/new |
| 8 | `ProvenanceMeta` | PAGE 1, 4 | `parts: string[]` | Mono muted line, e.g. `3 accounts resolved · Eff. 2026-09-01 · by Jordan Lee · Aug 26, 2026, 21:36` | — | conflict meta |
| 9 | `ReviewButton` | PAGE 1 | `conflictId` | Indigo outline `Review →`; opens drawer scoped to that conflict | — | conflict id |
| 10 | `ResolutionSummaryAuditTrail` | PAGE 1 | `resolvedConflicts[]` | Card `Resolution Summary & Audit Trail`; sub `1 conflict resolved by Jordan Lee` (live); per entry: green check circle, conflict title, `Resolved by … · <ts>`, label `CORRECTED PATH` + green box value, mono `MMIT · 26 Aug 2026 · <plan>` + `Effective: …`, label `AUDIT TRAIL` + event lines (`Resolved — Jordan Lee · <ts>`, `Notified — 2 offices · <ts>`, `Materials attached — 4 · <ts>`); new entries **prepend** on send | grows after each send | resolved conflicts + audit events |
| 11 | `FloatingHelp` | all | — | Circular `?` bottom-right; opens static help popover (no routing) | open/closed | static |
| 12 | `Drawer` | PAGE 2–4 | `conflictId`, `open`, `onClose` | Right slide-over ~55% width (min 720px); magenta header `Payer Change` + `4 open` pill + ✕; scrollable body; sticky footer; ✕/Cancel closes and **resets step to 1** | open/closed, step 1–3 | selected conflict |
| 13 | `Stepper` | PAGE 2–4 | `current: 1\|2\|3` | 3 steps `Review & Confirm · Materials · Communicate`; filled indigo circle = active, green check circle = done, gray = upcoming; connecting lines; label color follows state | step 1/2/3 | drawer step |
| 14 | `PolicyChangeCards` | PAGE 2 | `oldValue`, `newValue`, `authoritative` | Section label `POLICY CHANGE`; two radio cards: A gray unselected `PREVIOUS — SUPERSEDED` + strikethrough value + mono chips `Internal · Jan 2026 · Aetna HMO`; B green border, selected radio + green check, label `AUTHORITATIVE — COMMERCIAL · AETNA HMO` + `COMPLIANCE-REVIEWED` badge, bold new value, mono `Eff. 2026-09-01 · Source: MMIT`. Radio toggles selection (B default) | A/B selected | conflict + provenance |
| 15 | `AccountsToResolve` | PAGE 2 | `accounts[]`, `selectedIds`, `onToggle` | Label `ACCOUNTS TO RESOLVE (N OF M SELECTED)` (live) + right link `Show detail` (toggles inline detail list); `CheckboxCard` per account: bold name + mono `Commercial · Aetna HMO · 48201`; indigo filled checkbox; **all selected by default** | selection set | conflict.accounts |
| 16 | `ActionSummaryInfoBox` | PAGE 2 | `count`, `newValue` | Green box: bold `N accounts will be updated to: <new value>` + `System-generated from MMIT data. Jordan Lee remains the decision-maker.`; count updates **live** with checkboxes | count 0–M | selection |
| 17 | `MaterialsList` | PAGE 3 | `materials[]`, `selectedIds`, `onToggle` | Eyebrow `MLR-APPROVED MATERIALS — SITE-OF-CARE REQUIREMENT`; intro copy (verbatim §WU5); 4 `CheckboxCard`s **pre-selected**, each: title · category · mono `owner · date` · right `COMPLIANCE-REVIEWED` badge | selection set | materials[] |
| 18 | `MaterialsSummaryInfoBox` | PAGE 3 | `count` | Gray box: `N materials will be attached. No promotional or non-approved content is selectable.` (live count) | count 0–4 | selection |
| 19 | `RecipientsChips` | PAGE 4 | `offices[]` | Label `RECIPIENTS (N OFFICES)` + gray chips `<account> · <plan>` derived from step-1 selection | — | selection |
| 20 | `MessagePreview` | PAGE 4 | `conflict`, `materials`, `recipients` | Email card: header (`To: N selected offices — Territory 14` · `Re: Onvexa Site-of-care requirement Update — Corrected Path` · `From: Jordan Lee, FRM · Territory 14 — Great Lakes` + `COMPLIANCE-REVIEWED` badge); body `Dear Office,` + confirmation line; indigo box `UPDATED GUIDANCE` (bold new value + mono chips `MMIT · 26 Aug 2026 · <plan>` + `Effective: …`); provenance sentence; `ATTACHED MATERIALS` rows (name + badge); signature block. **Zero free-text inputs** | reflects selections | conflict + materials + selection |
| 21 | `TemplateNoticeInfoBox` | PAGE 4 | — | Gray box: `Generated from a compliance-reviewed, MLR-approved template. No free-text promotional content included. Source provenance (MMIT · 26 Aug 2026) is embedded throughout.` | — | static |
| 22 | `DrawerFooter` | PAGE 2–4 | `step`, `primaryDisabled`, `onPrimary`, `onBack`, `onCancel` | Sticky; left `Cancel`(step1)/`← Back`(step2–3) outline; right filled indigo-dark CTA: `Select materials →` / `Preview message →` / `Send to N offices →` (live count); disabled when 0 accounts (step1) or 0 materials (step3 guard) | per step | step + selections |
| 23 | `ConfirmSendDialog` | PAGE 4b (Figma 2:1502) | `recipientsCount`, `conflictType`, `onConfirm`, `onCancel`, `sending`, `error?` | Inline confirmation panel replacing the drawer footer: heading `Send to N offices?`; body `This will notify N offices of the corrected <conflictType> guidance. The email is generated from the compliance-reviewed template above.`; buttons `Cancel` (outline) · `Confirm & send` (filled indigo-dark). While `sending`: button shows `Sending…` + disabled. On error: inline red InfoBox + retry. Confirm triggers `sendNotificationEmail()` then `RESOLVE_CONFLICT` | idle / sending / error | recipients + conflict |

### 6.3 Functionality map (state & interactions)

- **Entry:** any `Review →` on PAGE 1 opens `Drawer` scoped to that conflict, step 1.
- **Stepper flow:** 1 → (`Select materials →`) → 2 → (`Preview message →`) → 3 →
  (`Send to N offices →`) → `ConfirmSendDialog` (`Cancel` / `Confirm & send`) →
  `Confirm & send` calls `sendNotificationEmail()` (services/api.ts; backend
  dispatches the email) → on success dispatch `RESOLVE_CONFLICT` → drawer closes →
  PAGE 1 updates (row → `RESOLVED`, banner decrements, audit entry prepends).
  `← Back` preserves selections. `Cancel` in the dialog returns to step 3 unchanged.
- **Live counts:** accounts-selected (step 1 InfoBox + label), materials-attached (step 2 InfoBox), recipients (step 3 CTA label) — all derived, never hardcoded.
- **Demo triggers (dev panel):** `RESET_DEMO()` restores seeded `4 open · 1 of 5`; `SIMULATE_MMIT_UPDATE()` flips resolved rows back to open.
- **Guard rails:** no free-text inputs anywhere; double-send protected; 0-selection disables primary CTA.

### 6.4 Page states (must all render from store)

| State | Trigger | PAGE 1 shows | Drawer |
|---|---|---|---|
| `SEEDED` | on load / reset | `4 open` · `1 of 5 resolved`; 1 RESOLVED row + 4 open rows | step 1, all accounts pre-selected |
| `MID-DEMO` | after 1 send | `3 open` · `2 of 5`; Aetna HMO row RESOLVED with resolved-by meta | next conflict opens at step 1 |
| `CALM` | all 5 resolved | `0 open` · `5 of 5`; all rows RESOLVED; no `Review →` buttons | not reachable (nothing to review) |

---

## 7. COMPONENTS & FUNCTIONALITY — HOME PAGE

> **Concept: "Territory Morning Briefing."** Home is the first screen Jordan sees.
> It answers, in priority order: **Is anything on fire? → What changed overnight? →
> Is my territory healthy?** It is a *briefing, not a dashboard* — narrative cards
> stacked in one column (max-width 1120px, centered), no KPI grids, no charts
> (dashboards/analytics are out of scope per §1.5). It reuses the PAGE 1 design
> language 1:1 and every number traces to the store (judge test applies here too).

### 7.1 Component inventory

| # | Component | New/Reused | Props (typed) | Functionality / behavior | States |
|---|---|---|---|---|---|
| 1 | `GreetingHeader` | New | `territory`, `dateLabel` | White card: mono eyebrow `TERRITORY 14 — GREAT LAKES · FRIDAY, SEP 4, 2026`; H1 `Good morning, Jordan`; sub `Here is the state of your territory's payer guidance.` | static |
| 2 | `TerritoryHealthCard` | **New** | `openConflicts`, `totalConflicts`, `accountsAffected`, `accountsTotal`, `resolvedToday`, `state` | **Hero card.** Top rule magenta when open / green when calm. Left: giant count (`4` → magenta, `0` → green, 64px) + label `open plan conflicts` + mono provenance `Across 4 plans · Source: MMIT · Updated Aug 26, 2026`. Right: 3 mini-stats with hairlines — `12` accounts in territory · `9` accounts affected · `1 of 5` conflicts resolved today (mono sub `by Jordan Lee`). Bottom strip (`--page-bg` box) flips: ⚠ magenta `9 accounts are currently guided by superseded policy. Resolving at territory level takes one action.` ↔ ✓ green `All plan conflicts resolved. Every account is guided by authoritative policy. Calm waters.` | open / calm |
| 3 | `OvernightChangesCard` | New (reuses `ValueTransition`, `ProvenanceMeta`) | `sourceUpdates[]` | Header: eyebrow `OVERNIGHT CHANGES — AUG 26, 2026` + right mono `Source: MMIT · Retrieved 06:00`. One row per `SourceUpdate`: strikethrough old → arrow → new + mono `Site-of-care requirement · Aetna HMO · Eff. 2026-09-01`. Footer indigo-outline `Review →` deep-links to `/payer-changes` with drawer pre-opened on first open conflict. Calm state: single green line `No source changes pending review.` | populated / empty |
| 4 | `TodaysPathCard` | New | `steps[]` | The demo script as UI: 3 numbered indigo circles, one per line, right-aligned action link — `1 Review the MMIT change and confirm the authoritative path` → `Open Payer Changes →`; `2 Resolve once at territory level` → `Resolve →`; `3 Communicate the corrected path to impacted offices` → `Communicate →` (all deep-link into the drawer flow). Mono footer: `Estimated time: under 3 minutes · All actions recorded in audit trail`. Calm state: `All clear — nothing to action today.` | open / calm |
| 5 | `RecentActivityStrip` | New (reuses audit event lines) | `events[]` (max 3) | White card; rows = green check circle + `Resolved — Commercial — Aetna PPO · Site-of-care requirement` + mono `Jordan Lee · Aug 26, 2026, 21:36`; header link `View full audit trail →` → `/payer-changes` (scrolls to audit card). Read-only, max 3 rows — a briefing, not a log | grows after sends |
| 6 | `ConflictLink` | **New** | `conflictId`, `label` | Magenta text-button; navigates to `/payer-changes` and opens the drawer scoped to the conflict (the Home→flow bridge) | — |

### 7.2 Functionality

- Renders purely from two selectors: `selectTerritorySummary()` (hero + strip) and `selectSourceUpdates()` (overnight card). No new store actions.
- **Deep-link contract:** `Open Payer Changes →` / `Resolve →` / `Communicate →` all route to `/payer-changes` and open the drawer on the first open conflict (same entry point as PAGE 1's `Review →`), so the demo can start from Home.
- **State flips:** `SEEDED` (magenta hero `4`, ⚠ strip, populated overnight card) → `MID-DEMO` (hero `3`, activity shows new resolution) → `CALM` (green hero `0`, ✓ calm-waters strip, empty overnight card, path card all-clear). "Calm waters." (italic) is the emotional payoff quoting the FRM Team Lead research line.

### 7.3 Verbatim copy deck (Home)

- `TERRITORY 14 — GREAT LAKES · FRIDAY, SEP 4, 2026` · `Good morning, Jordan` ·
  `Here is the state of your territory's payer guidance.`
- `open plan conflicts` · `accounts in territory` · `accounts affected` ·
  `conflicts resolved today` · `by Jordan Lee`
- `Across 4 plans · Source: MMIT · Updated Aug 26, 2026`
- `⚠ 9 accounts are currently guided by superseded policy. Resolving at territory level takes one action.`
- `✓ All plan conflicts resolved. Every account is guided by authoritative policy. Calm waters.`
- `OVERNIGHT CHANGES — AUG 26, 2026` · `Source: MMIT · Retrieved 06:00` ·
  `No source changes pending review.`
- `Estimated time: under 3 minutes · All actions recorded in audit trail` ·
  `View full audit trail →`

---

## 8. COMPONENTS & FUNCTIONALITY — ACCOUNT PAGE

> **Concept: "Territory Roster & Barrier Map."** Jordan thinks in **accounts and
> barriers**, not policies. This page is the whole-territory roster: every account,
> its plan, and which **barrier state** its guidance is in. It generalizes the
> "See impact" view beyond the 4–6 demo accounts (proves the **Reusability**
> judging criterion) — and it stays strictly **group-level**: conflicts are
> resolved once per plan, never account-by-account (scope fence §1.5).

### 8.1 Component inventory

| # | Component | New/Reused | Props (typed) | Functionality / behavior | States |
|---|---|---|---|---|---|
| 1 | `RosterHeader` | New | `accountsTotal`, `plansTotal` | White card: mono eyebrow `TERRITORY 14 — GREAT LAKES · 12 ACCOUNTS · 4 PLANS`; H1 `Accounts`; sub `Guidance status by account. Conflicts are flagged at the plan level and resolved once for the whole territory.`; right: read-only visual chips `All plans`(indigo filled) · `Commercial` · `Managed Medicare` · `Part D` (gray outline — **no filter logic**) | static |
| 2 | `BarrierSummaryBand` | New | `inConflict`, `resolvedToday`, `openPlanLine`, `uncontacted` | 4 inline stats with hairline separators, counts derived from store, mono provenance under each: `9` accounts in conflict (magenta when >0) · `2` accounts resolved today (green) · `1` plan conflict open + mono example line `Site-of-care · Aetna HMO` · `0` accounts uncontacted after resolve (green when 0). Echoes the PAGE 1 banner semantics (magenta/green) so the product reads as one system | derived |
| 3 | `PlanGroupHeader` | New | `plan`, `accountsCount`, `conflictCount`, `conflictId?` | Gray sticky band, mono: `COMMERCIAL — AETNA HMO · 3 ACCOUNTS · 2 IN CONFLICT` (magenta count when >0). When conflictCount > 0, renders `ConflictLink` `Resolve for 2 accounts →` — the **only** interactive element; opens the drawer scoped to that plan conflict | per group |
| 4 | `AccountRow` | **New** | `account`, `plan`, `barrierState`, `guidance` | 4-col grid: (1) bold name `Midwest Cancer Associates` + mono `48201 · Detroit, MI`; (2) plan chip gray outline mono `Aetna HMO`; (3) `BarrierStatePill`; (4) guidance value + `MiniProvenance` — conflict rows show compact `ValueTransition` (~~old~~ → new), resolved/aligned show green current value + mono `MMIT · Aug 26, 2026 · Aetna HMO`. **No row-level actions** | per account |
| 5 | `BarrierStatePill` | **New** | `state: 'conflict'\|'resolved'\|'aligned'` | `IN CONFLICT` magenta soft bg/text · `RESOLVED` green outline · `ALIGNED` gray outline | 3 variants |
| 6 | `MiniProvenance` | **New** | `source`, `updated`, `plan`, `effective?` | One-line mono muted string — the judge-test primitive reused across all three pages | — |
| 7 | `RosterFooterNote` | New (reuses `InfoBox` + `ComplianceBadge`) | — | Full-width gray InfoBox: `Guidance shown is system-generated from payer policy sources (MMIT). Conflicts are resolved at the territory level by the FRM — never account by account.` + `COMPLIANCE-REVIEWED` badge (system-generated labeling mandate) | static |

### 8.2 Functionality

- Renders from `selectAccountsByPlan()` (grouped roster) + `selectTerritorySummary()` (band). No new actions; `RESET_DEMO()` restores seeded roster.
- **Group-level resolve only:** the sole clickable path is `PlanGroupHeader`'s `ConflictLink` → drawer scoped to that plan conflict (identical flow to PAGE 1). Zero per-account editing, zero per-account notify — verified by the hard checklist.
- **State flips:** `SEEDED` (Aetna HMO group: 2 `IN CONFLICT` rows with strikethrough→new + `Resolve for 2 accounts →`; others `ALIGNED`) → `MID-DEMO` (resolved rows flip to green `RESOLVED` + corrected path + resolved-by provenance; group count drops to 0, its ConflictLink disappears) → `CALM` (every row `RESOLVED`/`ALIGNED`, zero magenta on the page).

### 8.3 Verbatim copy deck (Accounts)

- `TERRITORY 14 — GREAT LAKES · 12 ACCOUNTS · 4 PLANS` · `Accounts` ·
  `Guidance status by account. Conflicts are flagged at the plan level and resolved once for the whole territory.`
- `All plans` · `Commercial` · `Managed Medicare` · `Part D`
- `accounts in conflict` · `accounts resolved today` · `plan conflict open` ·
  `accounts uncontacted after resolve`
- `IN CONFLICT` · `RESOLVED` · `ALIGNED`
- `Resolve for N accounts →`
- `Guidance shown is system-generated from payer policy sources (MMIT). Conflicts are resolved at the territory level by the FRM — never account by account.`

---

## 9. SECTION 6–8 BUILD ORDER & EXIT (extends Section 2.4)

Run the same 4-Part Loop (§0) for each new work unit. WU0/WU8 "stub" wording is
superseded by WU10–WU12 below.

#### **WU10 — Home page (Section 7)**
**Protocol:** Build §7.1 components top→bottom; add `selectTerritorySummary()` +
`selectSourceUpdates()` selectors; wire 3 deep-links per §7.2; implement all
three states (`SEEDED`/`MID-DEMO`/`CALM`).
**Exit:** all states render from store; every number traces to data; hard checklist clean.

#### **WU11 — Account page (Section 8)**
**Protocol:** Build §8.1 components; grouped roster via `selectAccountsByPlan()`;
`BarrierStatePill` + `MiniProvenance`; group-level `ConflictLink` only; footer note.
**Exit:** every guidance value traces to source/date/plan; zero per-account actions; hard checklist clean.

#### **WU12 — Cross-page consistency & final freeze (extends WU9)**
**Protocol:** Judge-test on ALL pages; verify Home ↔ Payer Changes ↔ Accounts
counts agree via `selectTerritorySummary()`; run full demo **starting from Home**
(Home → deep-link → drawer flow → send → back to Home) ; 10 deterministic runs; freeze.
**Exit:** Global exit (Section 4) + §7/§8 exits met + zero per-account actions anywhere.

### Updated global exit additions (append to Section 4 list)

7. Demo scenario runs end to end **starting from Home**: hero `4 open` → deep-link
   → full drawer flow → send → Home shows `3 open` → calm state after all resolves.
8. Home & Account pages match §7/§8 specs and the PAGE 1–4 design language
   (tokens, components, mono provenance) at 1440px.
9. Scope fence verified on new pages: no charts/analytics on Home, no filter
   logic/search/sorting on Accounts, no per-account actions anywhere.

---

## 10. FUNCTIONALITY REFERENCE — FIGMA CLICK-FLOW MAP (nodes 1:2 → 2:1949)

> **Purpose:** Figma file `UEzMHS0lK6fzncHKjlZ7IT` is the FUNCTIONALITY reference
> (what happens when you click); the PNGs + §1.6 remain the DESIGN reference
> (what it looks like). Where Figma mockups show an all-open state (`5 open`,
> Aetna PPO unresolved), that is mockup staging only — the seeded store state
> (§2.3: `4 open · 1 of 5 resolved`) governs the demo. Node 2:1949's resolved
> banner (`4 open · 1 of 5 plan conflicts resolved today`) matches the seed.

### 10.1 Node map (6 pages, one continuous flow)

| Node | Screen | Functionality captured |
|---|---|---|
| `1:2` | PAGE 1 — conflict queue (all-open staging) | Banner `Payer Change` + `N open` pill; 2 `SourceGroupBlock` accordions (`Site-of-care requirement` / `PA step therapy requirement`) each with right-aligned `N plans open`; `PlanConflictCard` rows: plan title, strikethrough→arrow→new value, mono `N accounts affected · Eff. <date>`, `Review →` button; ChatBot floating icon bottom-right |
| `2:231` | PAGE 2 — drawer step 1 | Magenta drawer header `Payer Change` + `N open` pill + ✕; eyebrow `Site-of-care requirement`; H1 plan name; mono `Onvexa · Territory 14 · Eff. … · Source: MMIT`; Stepper (1 active = number circle, 2/3 upcoming); policy-change cards (A superseded strikethrough + provenance chip, B authoritative + `Compliance-reviewed` marker); `Accounts to resolve (N of M selected)` + `Show detail`; CheckboxCards; green summary InfoBox; footer `Cancel` / `Select materials →` |
| `2:642` | PAGE 3 — drawer step 2 | Stepper step 1 = check icon (done); eyebrow `MLR-approved materials — …`; copy `All relevant materials are pre-selected. Deselect …`; 4 CheckboxCards each with `Compliance-reviewed` marker; gray InfoBox `4 materials will be attached. …`; footer `← Back` / `Preview message →` |
| `2:1064` | PAGE 4 — drawer step 3 | Stepper steps 1+2 = check icons; `Recipients (N offices)` chips `<account> · <plan>`; `Message preview` email card (To/Re/From + `Compliance-reviewed` marker, `Dear Office,`, indigo `Updated guidance` box + ProvenanceChip + `Effective: …`, `Attached materials` rows each with marker, signature); gray template InfoBox; footer `← Back` / `Send to N offices →` |
| `2:1502` | PAGE 4b — confirm & send | Same drawer, footer replaced by inline confirmation panel: heading `Send to N offices?`; body `This will notify N offices of the corrected <type> …`; buttons `Cancel` / `Confirm & send` side by side. Confirming dispatches the email (backend) then resolves |
| `2:1949` | PAGE 1 — resolved state | Banner `4 open` + `· 1 of 5 plan conflicts resolved today`; resolved row: green `Resolved` tag, mono `N accounts resolved · Eff. … · by Jordan Lee · <ts>`, NO Review button; `Resolution Summary & Audit Trail` panel below queue (see 10.2) |

### 10.2 Resolution Summary & Audit Trail — composition (from node 2:1949)

Enriches WU7 (design/copy still per §WU7 + PNGs):

- Card header: `Resolution Summary & Audit Trail` + sub `1 conflict resolved by
  Jordan Lee` (live) + `Compliance-reviewed` marker top-right.
- Per resolved conflict, an entry: green check icon in a circle · title
  `Commercial — Aetna PPO · Site-of-care requirement` · mono `Resolved by Jordan
  Lee · <ts>`.
- **Two-column layout:**
  - LEFT — `Corrected path` label + green box with the new value + ProvenanceChip
    `MMIT · 26 Aug 2026 · <plan>` + `Effective: <date>`; then `Audit trail`
    label + vertical timeline (dots + connector lines) with events, each
    `<event> / <actor> · <ts>`:
    1. `MMIT policy update detected` — System
    2. `Conflict flagged: N accounts in Territory 14` — System
    3. `Corrected path selected: "<new value>"` — Jordan Lee
    4. `N accounts resolved at territory level` — Jordan Lee
    5. `N compliance-reviewed materials attached` — Jordan Lee
    6. `Corrected path communicated to N offices` — Jordan Lee
    7. `Resolution recorded in audit log` — System (last entry, no connector)
  - RIGHT — `Accounts notified (N)`: rows `<account>` + plan chip + green
    `Resolved` tag; `Materials sent (4)`: rows with `Compliance-reviewed` marker.
- New entries prepend when a send completes (WU6 step 7).

### 10.3 Interaction rules distilled from Figma

- Stepper state machine: upcoming = gray number circle; active = indigo number
  circle; done = green check circle. Steps 1–2 show checks on step 3.
- `Show detail` toggles the inline account detail list on step 1.
- All counts (`N open`, `N of M selected`, `N offices`, `N materials`) are live
  and derived from store/selections — never hardcoded.
- `Review →` is only rendered on open conflicts; resolved rows show the
  resolved-by provenance line instead.
- ChatBot floating icon (56×56, bottom-right) appears on every screen — build as
  `FloatingHelp` per §1.6 (static popover, no routing). **Superseded by §11: the
  icon is the magenta FRM Assistant launcher; the popover is the chat panel
  (FAQ mode + AI-agent ask mode).**

---

## 11. FRM ASSISTANT — CHATBOT (FAQ + AI AGENT)

> **What this is:** the pink circular message icon (bottom-right, every screen) is
> the **FRM Assistant** — a chatbot that answers FAQs from a JSON knowledge base
> and hands anything else to an AI agent. The agent's real-time answers will come
> from a database that is **not yet implemented**; until then the agent runs
> against a **dummy key** and a **deterministic mock**. The icon, panel, and
> interaction model follow the reference design (image 3: dark header `FRM
> Assistant` + `Clear` + ✕, blue user bubble right, gray assistant bubble left,
> `SUGGESTED` question chips, magenta launcher with ✕ while open).
>
> **Reference repo (architecture inspiration only — do not port Ruby):**
> `https://github.com/merefield/discourse-chatbot`. Steal its *shape*: search the
> knowledge base FIRST, call the LLM only when local search fails; canned
> pre-LLM matching for known questions; hard iteration caps; graceful fallback
> when the provider is down; a floating launcher that flips to a close button.
>
> **Scope fence:** the assistant is an overlay. It never mutates the
> `ConflictStore`, never navigates, never renders conflict data it was not given,
> and adds no new pages. The ask input is the ONLY free-text control in the whole
> app and it lives inside the assistant panel (hard-checklist amendment §3).

### 11.0 The loop applies to §11 too

Run the 4-Part Loop (§0) for each WU below. Critic dimensions: §3's 9 dimensions
plus the §11.6 rubric. Same iteration cap (3), same exit rule (all ≥9).

### 11.1 Data contract

**FAQ knowledge base — `data/faq.json`** (seeded verbatim from the existing
`index.hbs.json`; that file stays untouched as the team's handoff artifact):

```json
{
  "faqs": [
    {
      "id": "website-purpose",
      "question": "Hi, what can FRM Genius help me do?",
      "answer": "FRM Genius helps Field Reimbursement Managers detect a payer-policy change, see the territory accounts affected by the resulting conflict, resolve the conflict once at the territory level, and notify the impacted offices of the corrected path.",
      "keywords": ["FRM Genius", "purpose", "field reimbursement manager", "workflow", "conflict resolution"],
      "category": "General",
      "url": "/",
      "status": "published",
      "locale": "en-US"
    }
  ]
}
```

Rules:
- `status: "published"` only — unpublished entries are filtered at load.
- `keywords[]` drive the local matcher (§11.3). Keep them lowercase-comparable.
- `category` groups the FAQ list (General · Alerts · Conflicts · Compliance ·
  Resolution · Communication · Status · Support).
- The FAQ list is **static and deterministic** — it never depends on store state,
  time, or randomness (demo-determinism rule §WU8 applies here too).

**Agent config — `services/assistant.ts`:**

```ts
// Dummy key until the real database + agent endpoint exist. Replace BOTH
// constants in one place when the backend lands — no UI code changes.
const ASSISTANT_API_KEY = "sk-8yl6-kBLpIyMOzLy2QyvtA"; // dummy — provided by team
const ASSISTANT_ENDPOINT = "/api/assistant";           // not yet implemented

export interface AgentAnswer {
  ok: boolean;
  answer?: string;   // agent's reply text
  error?: string;    // user-facing error string
  source: "agent" | "mock";
}

export async function askAgent(question: string): Promise<AgentAnswer>;
```

Behavior until the backend exists (`source: "mock"`): `askAgent` waits ~900 ms
(mirrors `sendNotificationEmail` latency), then returns a deterministic canned
reply — never a random or time-based string. Canned reply (verbatim):

> `I'm the FRM Assistant agent. Live answers will come from the FRM database once
> it is connected. For now, try one of the suggested questions — they're answered
> from the FAQ knowledge base.`

If `ASSISTANT_ENDPOINT` is unreachable or returns non-OK, return
`{ ok: false, error: "The assistant can't reach its knowledge base right now.
Please try again in a moment." }` — the panel renders it as an assistant bubble
with a `Retry` chip. **Never throw across the UI boundary.**

### 11.2 Component inventory (typed props)

| # | Component | Props (typed) | Behavior | States |
|---|---|---|---|---|
| 1 | `AssistantLauncher` | `open`, `onToggle` | Fixed `bottom-6 right-6 z-50`; 56×56 magenta (`--magenta`) circle, white chat-message glyph (lucide `MessageCircle`), `shadow-lg`, `hover:scale-105`; `aria-label` `Open FRM Assistant` / `Close FRM Assistant`; `aria-expanded` mirrors `open` | open / closed |
| 2 | `AssistantPanel` | `open`, `onClose`, `onClear` | Anchored above the launcher (`bottom-24 right-6`), width `380px`, max-height `min(560px, calc(100vh - 120px))`, white card (radius 12px, §1.6 shadow), flex column: header / scrollable body / input. Closes on ✕, on `Escape`, and on outside click. While closed it renders nothing (no hidden DOM) | open / closed |
| 3 | Panel header | `onClear`, `onClose` | Dark bar (`--nav-bg`), white text: sparkle glyph + `FRM Assistant` (bold, 14px) · right: `Clear` text button (muted → white on hover) + ✕ icon button. `Clear` wipes the conversation back to FAQ mode (§11.4) | — |
| 4 | `FaqList` | `faqs: FaqEntry[]`, `openId`, `onToggle` | Scrollable body content in FAQ mode: eyebrow `SUGGESTED` + one `FaqItem` per entry, grouped under its `category` label (mono, muted). Scroll reveals later FAQs (§11.3 ordering) | all collapsed / one open |
| 5 | `FaqItem` | `faq`, `open`, `onToggle` | Row: question text (13px, ink, medium) + right **plus** glyph (lucide `Plus`, muted). Click anywhere on the row (or Enter/Space when focused) toggles: plus → ✕, answer slides open below the question (13px, muted, `leading-relaxed`). Only one item open at a time (accordion) — opening another closes the first | collapsed / expanded |
| 6 | `ChatMessage` | `msg: ChatMsg` | User bubble: `--accent` blue bg, white text, right-aligned, rounded-2xl (rounded-br-sm). Assistant bubble: `--page-bg` gray bg, ink text, left-aligned, rounded-2xl (rounded-bl-sm). Assistant messages that came from the agent carry a mono `AI-GENERATED` tag above the bubble (§11.5). Error replies render in a red-tinted bubble with a `Retry` chip | user / assistant / error |
| 7 | `AssistantInput` | `onSend`, `disabled`, `sending` | Bottom bar, border-t: text input (placeholder `Ask a question…`, 13px) + send icon button (lucide `Send`, disabled while `sending` or empty). Enter sends; Shift+Enter inserts a newline. Autofocus when the panel opens. **This is the only free-text input in the app** | idle / sending |
| 8 | `useAssistant` | — (hook) | Owns: `mode: 'faq' \| 'chat'`, `messages: ChatMsg[]`, `openFaqId`, `sending`, `error`. Exposes `toggleFaq`, `ask`, `clear`, `retry`. See §11.4 | — |

Shared types (`features/assistant/types.ts`):

```ts
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  kind: "faq" | "agent" | "error";
  text: string;
  faqId?: string;   // set when kind === "faq"
}
```

### 11.3 Interaction model (exact)

1. **Launcher click** → panel opens in **FAQ mode**: header + `SUGGESTED` eyebrow
   + the FAQ list (all collapsed) + input bar at the bottom. Launcher glyph flips
   to ✕ while open (image 3).
2. **FAQ expand:** click a question's plus → the answer expands inline under that
   question (accordion, one open at a time). This is a *reading* interaction — it
   does NOT post a chat message and does NOT switch mode.
3. **Scroll:** the body is `overflow-y-auto`; the FAQ list is long enough to
   scroll (12 entries across 8 categories). Later FAQs are reachable by scrolling
   — nothing is paginated or hidden behind tabs.
4. **Ask a question:** typing in the input and sending switches the panel to
   **chat mode** and appends the user bubble. The pipeline (§11.5) resolves an
   answer, which appends as an assistant bubble. The FAQ list is replaced by the
   transcript; `Clear` in the header returns to FAQ mode with an empty
   transcript.
5. **Suggested chips:** in chat mode, after an assistant reply, render up to 3
   `SUGGESTED` chips under the last reply — the 3 highest-ranked unanswered FAQ
   questions from the matcher (§11.5 step 2). Clicking a chip asks that question
   through the same pipeline as typing it (it appends as a user bubble and
   resolves like any ask — chips are a shortcut, not a special path).
6. **Escape / outside click / ✕** close the panel; state (mode, transcript,
   open FAQ) is preserved while the session lives — reopening resumes where the
   user left off. `Clear` is the only reset.
7. **Sending state:** while awaiting the agent, the input is disabled and the
   send button shows a spinner; the pending assistant bubble renders with a
   typing indicator (three pulsing dots). FAQ-mode answers are instant (local
   JSON) — no spinner.

### 11.4 State machine (`useAssistant`)

```
mode: 'faq' | 'chat'
messages: ChatMsg[]            // empty in faq mode
openFaqId: string | null       // accordion state in faq mode
sending: boolean
error: string | null           // last agent error, if any

toggleFaq(id)     // faq mode only; opens id, closes others; null collapses
ask(text)         // mode → 'chat'; push user msg; resolve via §11.5; push reply
clear()           // mode → 'faq'; messages → []; openFaqId → null; error → null
retry()           // re-runs the last failed ask (same text)
```

Invariants:
- `messages` is append-only except via `clear()` (no edits, no deletes).
- `sending` is true for at most one in-flight ask; a second send while sending is
  ignored (double-send guard, mirrors §WU8).
- FAQ answers never enter `messages` — they render only in the accordion.
- The transcript survives panel close/open but not page reload (no persistence —
  demo determinism; a reload reseeds FAQ mode).

### 11.5 Answer pipeline (search first, agent second)

```
ask(text)
  ├─ 1. normalize(text)                      // trim, lowercase, collapse spaces
  ├─ 2. matchFaq(text) → FaqEntry | null     // lib/faq.ts keyword matcher:
  │      score = count of faq.keywords appearing in the normalized question
  │      (word-boundary match); return the highest-scoring entry if score ≥ 1,
  │      ties broken by more keywords matched, then list order; else null
  ├─ 3a. match found → assistant bubble = faq.answer (VERBATIM from JSON),
  │        kind: 'faq' — the LLM/agent is NOT called
  ├─ 3b. no match → set sending; askAgent(text) (§11.1)
  │        ├─ ok  → assistant bubble = answer, kind: 'agent' (AI-GENERATED tag)
  │        └─ err → assistant bubble = error, kind: 'error' + Retry chip
  └─ 4. update suggested chips (3 best unanswered FAQ matches for the transcript)
```

Why this order (from the reference repo): local search is free, instant, and
deterministic — the agent is only billed/latency-ed for questions the knowledge
base cannot answer. When the real database lands, only `askAgent`'s internals
change; the pipeline, UI, and FAQ path stay untouched.

### 11.6 Critic rubric (§11-specific, in addition to §3)

| Dimension | What 10 looks like |
|---|---|
| Launcher fidelity | 56×56 magenta circle bottom-right on every screen; glyph flips to ✕ while open; matches image 3 |
| Panel fidelity | 380px card above the launcher; dark header `FRM Assistant` + `Clear` + ✕; blue user bubbles right, gray assistant bubbles left; `SUGGESTED` chips; input pinned at bottom |
| FAQ correctness | Answers render verbatim from `data/faq.json`; accordion plus/✕ toggle; one open at a time; list scrolls to reach all 12 FAQs |
| Pipeline correctness | FAQ match → instant verbatim answer, agent never called; no match → agent (mock) with typing indicator; failure → error bubble + Retry, no crash |
| Overlay discipline | Assistant never mutates the store, never navigates, closes on Escape/outside click, and the ask input is the app's only free-text control |

### 11.7 Work units

#### **WU13 — Assistant data & matching layer**
**Protocol:** Create `data/faq.json` (seed verbatim from `index.hbs.json` — all
12 entries), `lib/faq.ts` (`loadFaqs()` filters `status: "published"`;
`matchFaq(text)` per §11.5 step 2), and `services/assistant.ts` (`askAgent` mock
per §11.1, dummy key constant included). Unit-check the matcher: every FAQ's own
question text must match itself (score ≥ 1); gibberish must return null.
**Exit:** matcher deterministic; no UI built yet; `npm run build` zero errors.

#### **WU14 — Assistant UI (launcher, panel, FAQ mode)**
**Protocol:** Build `AssistantLauncher`, `AssistantPanel`, `FaqList`, `FaqItem`,
`AssistantInput`, `useAssistant` per §11.2/§11.3; mount in `AppShell` in place of
`FloatingHelp` (delete `FloatingHelp.tsx` and its import — no dead code). FAQ
mode fully working: expand/collapse accordion, scrollable list, input present.
**Exit:** image-3 visual match at 1440px (launcher, header, bubbles, chips,
input); hard checklist clean; no store coupling.

#### **WU15 — Agent mode & pipeline wiring**
**Protocol:** Wire the §11.5 pipeline in `useAssistant.ask`: FAQ match → verbatim
bubble; else `askAgent` mock → agent bubble with `AI-GENERATED` tag; failure →
error bubble + `Retry`. Add suggested chips (§11.3 step 5), `Clear` reset,
Escape/outside-click close, sending/typing states, double-send guard.
**Exit:** full §11.3 script runs clean twice; §11.6 rubric all ≥9; build zero
errors; `CRITIC-LOG.md` entry appended.

### 11.8 Verbatim copy deck (Assistant)

- `FRM Assistant` · `Clear` · `SUGGESTED`
- `Ask a question…` (input placeholder)
- `AI-GENERATED` (mono tag on agent bubbles)
- `Retry` (chip on error bubbles)
- Mock agent reply (§11.1) and error reply (§11.1) — verbatim.
- Launcher `aria-label`s: `Open FRM Assistant` / `Close FRM Assistant`.

### 11.9 When the real backend lands (handoff note)

Replace, in one commit, `ASSISTANT_API_KEY` + `ASSISTANT_ENDPOINT` in
`services/assistant.ts` and the mock body of `askAgent` with the real POST
(`{ question }` → `{ answer }`). Nothing in `features/assistant/*`, `lib/faq.ts`,
or the pipeline changes. The FAQ path keeps working with zero backend.
