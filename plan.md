# FRM Genius — Conflict Watch Implementation Plan

## 1. Problem & goal

Build a POC that demonstrates **territory-level payer-policy conflict resolution** for a Field Reimbursement Manager (Jordan Lee). When formulary or medical-policy snapshots for a new month reveal changes on any of the eight tracked fields, the system:

1. Detects the changes automatically by diffing snapshots.
2. Records each change as a row in a unified `InternalUpdates` change log.
3. Surfaces open changes to the FRM grouped by change type.
4. Lets the FRM confirm the authoritative path, attach MLR-approved materials, and email all affected offices in one action.
5. Persists a full audit trail and shows a resolved-state summary.

The judging test: the whole flow works live end-to-end, and every value on screen can be traced to a source, date, and plan.

## 2. Delivery priority

**DB and backend first, frontend later.** Concretely:

1. Schema + seed data (from CSVs) + snapshot diff engine
2. Backend APIs (all 7 endpoints, exercisable via curl/Postman)
3. Only then, frontend

## 3. Stack

- **Next.js 14+ App Router** (JavaScript, no TypeScript)
- **Tailwind CSS** with a magenta primary palette matching the design (configured via `tailwind.config.js` theme extension)
- **shadcn/ui** components (JS variant); the wizard uses the **Sheet** primitive (right-side slide-in panel), not Dialog
- **Zod** for API request validation
- **File-based "DB"**: JSON files in `data/`, read/written via `lib/db.js`
- **Node ≥ 18** (already installed)
- Single-process Next.js app; `next dev` for build, `next start` for the demo
- **Nodemailer** for the email demo (SMTP creds via `.env.local`; falls back to console-log transport when creds absent so the demo never breaks)

## 4. Assumptions (please challenge before implementation)

1. **Project name**: **FRM Genius** (top-nav brand and page title).
2. **Persona**: Jordan Lee, Field Reimbursement Manager. Hard-coded; no auth.
3. **Payer names**: keep the CSV synthetic names (Meridian, Cascade, Granite, Harborview, Summit). Figma's Aetna/Cigna/UHC are treated as design placeholders — brief mandates synthetic data.
4. **Product**: **Onvexa** (HCPCS `J9345`, NDC `00078-0912-01`). CSV's "Onvantra" is renamed.
5. **Territory**: **Territory 14** (from Figma) instead of `T-NE-04`.
6. **Accounts**: 18 rows from `AccountsTerritories.csv` + a new **`email`** column with dummy addresses (see §5). Accounts ACC016–018 have no MedPolicy/Formulary rows on file → shown as background with a "source unavailable" chip.
7. **UI shape**: the 3-step resolution flow is a **right-side slide-in Sheet**, not a modal dialog.
8. **Email demo**: uses Nodemailer. If no SMTP config is present, a mock transport writes the RFC-822 message to `data/outbox/*.eml` and the API returns the same success payload — the UI shows "Sent" either way.
9. **Change detection is automatic**: a diff engine compares Jul and Aug snapshots on the 8 fields specified in §6 and writes rows into `InternalUpdates`. Manually entered rep intel already in the CSV is preserved.
10. **Bonus scraper**: OUT of the core plan. If pursued in Phase B, it produces new snapshot rows that the same diff engine consumes — no parallel code path.
11. **Persistence**: JSON files under `data/` are the writable store. `POST /api/dev/reset` restores seed state for demo re-runs.

## 5. Data model (flat, JSON-file backed)

Files under `data/`. Each JSON is an array of records.

### 5.1 Snapshot tables (raw source data, monthly)

- **`formularySnapshots.json`** — union of `FormularyJul.csv` + `FormularyAugy.csv`.
  Columns: `data_date, formulary_id, formulary_name, payer_name, channel, lives, ndc, product_name, formulary_status, restriction, tier, effective_date, as_of_date`.
- **`medPolicySnapshots.json`** — union of `MedPolicyJul.csv` + `MedPolicyaug.csv`.
  Columns: `data_date, payer_id, payer_name, plan_id, plan_name, channel, lives, hcpcs_code, product_name, medical_policy_number, policy_effective_date, coverage_status, pa_required, step_therapy_required, site_of_care_restriction, quantity_limit, bulletin_url, as_of_date`.

### 5.2 Reference tables

- **`product.json`** — single record.
  `{ id, name: "Onvexa", hcpcs: "J9345", ndc: "00078-0912-01" }`
- **`plans.json`** — 8 plans.
  `{ id, payer_id, payer_name, plan_name, channel }`
- **`accounts.json`** — 18 accounts. **New `email` field added.**
  `{ id, name, territory, hcp_specialty, primary_plan_id, email }`
  Dummy emails follow `firstword.lastword@<slug>.example.com` — e.g., `intake@lakeside-oncology.example.com`.
- **`materials.json`** — 6–8 MLR-approved assets.
  `{ id, title, category, owner, reviewed_at, applicable_change_types: [] }`

### 5.3 Change log

- **`internalUpdates.json`** — the unified change feed. Seeded from `InternalUpdates.csv` (rep intel) **and** appended to by the diff engine.
  Columns: `update_date, source, payer_name, plan_name, plan_id, hcpcs_code, product_name, field, prior_value, new_value, note, entered_by, effective_date, detection_id`.
  For diff-engine rows: `source` is `"MMIT"` (medical policy) or `"Formulary"`, `entered_by` is `"System"`, `detection_id` links to `payerChanges`.

### 5.4 App state tables

- **`payerChanges.json`** — one row per detected change per plan; drives the UI list. Generated by the diff engine. *(As built, rows also carry `change_type_group`, `payer_name`, `plan_name`, `channel`, and optional `bulletin_url` so the API can serve grouped lists without joins.)*
  `{ id, change_type, change_type_group, field, plan_id, payer_name, plan_name, channel, previous: { value, source, source_date }, authoritative: { value, source, source_date }, effective_date, bulletin_url?, affected_account_ids: [], detected_at, status: "open" | "resolved", resolved_at, resolved_by, corrected_path_source, corrected_path_value }`
  **This is the table where a resolution is recorded**: `POST /api/payer-changes/:id/resolve` flips `status` to `"resolved"` and stamps `resolved_at`, `resolved_by`, `corrected_path_source`, `corrected_path_value` on the row. Supporting records land in `auditEvents.json` (timeline) and `notifications.json` (email record).
- **`notifications.json`** — populated by user actions.
  `{ id, payer_change_id, sent_at, sent_by, recipient_account_ids, recipient_emails, message: { to, re, from, corrected_path, source, effective_date, materials: [] }, transport: "smtp" | "mock", message_id }`
- **`auditEvents.json`** — timeline. `{ id, payer_change_id, actor: "System" | "Jordan Lee", event_type, description, at }` *(As built, events also carry `payer_change_id`-scoped ids `evt-…` and are appended under the write lock in `lib/audit.mjs`.)*

## 6. Change detection (diff engine)

Runs once at seed time and can be re-run via `POST /api/dev/reset`. Located in `lib/diff.js`.

### 6.1 Fields tracked

- **Formulary changes** (join key: `formulary_id`): `formulary_status`, `restriction`, `tier`
- **Medical policy changes** (join key: `plan_id`): `coverage_status`, `pa_required`, `step_therapy_required`, `site_of_care_restriction`, `quantity_limit`

### 6.2 Algorithm

1. Sort snapshots ascending by `data_date`.
2. For each consecutive pair (older → newer), for each join key present in both:
   - For each tracked field: if the value differs, emit a **Change** record with `prior_value`, `new_value`, source (`MMIT` or `Formulary`), plan and payer identifiers, `effective_date` (from the newer snapshot's `policy_effective_date` or `effective_date`), and `detected_at = as_of_date` of the newer snapshot.
3. **Group changes into UI-friendly change types** using a small map:
   - `site_of_care_restriction` → "Site-of-care requirement"
   - `pa_required`, `step_therapy_required` → "PA / step-therapy requirement"
   - `coverage_status` → "Coverage status change"
   - `quantity_limit` → "Quantity limit change"
   - `formulary_status`, `restriction`, `tier` → "Formulary change"
4. For each Change: create/append to `internalUpdates.json` (source = `MMIT` or `Formulary`, entered_by = `System`) and create a row in `payerChanges.json` with `status = "open"`.
5. Populate `affected_account_ids` by joining on `plan_id`.
6. Idempotent: keyed by `(plan_id, field, prior_value, new_value, detected_at)` so re-running does not duplicate.

### 6.3 Seed expectations (from the Jul → Aug CSVs)

Non-trivial deltas visible in the sample data (spot-checked on the first 5 plans and expected across all 1000 rows):

- `PLN52000` Meridian: `step_therapy_required` N→Y
- `PLN52001` Cascade: `pa_required` N→Y
- `PLN52002` Granite: `coverage_status` Covered → Not Covered
- `PLN52003` Harborview: `site_of_care_restriction` narrowed to "Physician Office"
- `PLN52004` Summit: `quantity_limit` N→Y

The diff engine will emit all such changes automatically; the UI list length reflects whatever the engine finds. We are **not** hard-coding "5 open" — the number reflects the data.

## 7. Backend APIs

All under `app/api/`. Read/write through `lib/db.js`. Validation via Zod in `lib/schemas.js`.

- `GET  /api/payer-changes` — list, grouped by `change_type`. Query params: `status=open|resolved|all` (default `open`). *(As built: returns `{ status, total, open_count, resolved_count, groups: [{ group, changes }] }` with groups ordered by the canonical `GROUP_ORDER` and each change carrying its `change_type_group`.)*
- `GET  /api/payer-changes/:id` — detail: `previous`, `authoritative`, affected account list (id, name, email, plan), suggested materials.
- `GET  /api/materials?change_type=…` — MLR-approved materials for a change type.
- `POST /api/payer-changes/:id/resolve` — body: `{ corrected_path_source: "MMIT" | "Formulary" | "Internal", corrected_path_value }`. Sets `status=resolved`, appends audit events, does **not** send email. *(As built: idempotent — re-resolving returns the existing state without duplicate audit events; returns `{ change }`.)*
- `POST /api/payer-changes/:id/notify` — body: `{ material_ids: [] }`. Sends email via Nodemailer to each affected account's `email`. Persists a Notification record + audit event. In mock mode, writes `.eml` files to `data/outbox/`. *(As built: notifies ALL `affected_account_ids` — territory-level by design; UI account selection is informational only. Returns `{ ok: true, notification }`.)*
- `GET  /api/payer-changes/:id/audit` — full audit trail + resolution summary + notification record. *(As built: returns `{ change, audit_events (ascending by time), notification | null, resolution_summary: { status, resolved_at, resolved_by, corrected_path_source, corrected_path_value, accounts_notified (account IDs), materials_sent: [{ id, title }] } }`.)*
- `GET  /api/accounts` — read-only account list (id, name, plan, payer, channel, email).
- `POST /api/dev/reset` — reload snapshots, re-run diff engine, restore reference tables from `seeds/`, clear `notifications`, `auditEvents`, `data/outbox/`. *(As built: returns `{ ok, total_changes, open_changes, resolved_changes }`. The in-app Demo Controls panel was removed once the demo flow was stable; the endpoint remains for CLI/demo re-runs via `npm run reset`.)*

Audit event types emitted: `mmit_update_detected`, `formulary_update_detected`, `conflict_flagged`, `corrected_path_selected`, `accounts_resolved`, `materials_attached`, `path_communicated`, `resolution_recorded`.

## 8. Frontend routes & components (later phase)

Routes:

- `/` — Home stub (FRM Genius brand + FRM greeting).
- `/payer-changes` — Landing (Screen 1) and post-resolution (Screen 6).
- `/accounts` — read-only accounts table.

Key components (all in `components/`):

- `TopNav` — Home / Payer Changes / Accounts + FRM name.
- `PayerChangeBanner` — magenta banner with counts and "X of N plan conflicts resolved today".
- `ChangeTypeSection` — expandable section per change type.
- `PayerChangeRow` — one plan's delta with strikethrough old, arrow, new, meta.
- **`ResolutionSheet`** — client component right-side slide-in Sheet (shadcn `Sheet` primitive with Tailwind styling), width ~560px, wraps the three steps.
  - `Step1ReviewConfirm` — previous vs authoritative radio + COMPLIANCE-REVIEWED badge.
  - `Step2Materials` — pre-selected material checkboxes.
  - `Step3Communicate` — recipient chips (name + email preview on hover) + templated message preview + send button.
  - `ConfirmSendSheet` — small nested confirm section inside the same Sheet ("Send to N offices?" Cancel / Confirm & send).
- `ResolutionSummaryPanel` — Screen 6 summary with corrected path, audit trail, notified accounts, materials sent.
- `Provenance` — reusable pill `source · date · plan`.
- `ComplianceBadge` — green pill.

## 9. Phased delivery (drives the SQL todos)

**Baseline (do first so teammates can branch):**

- **Phase 0 — Baseline Next.js install**: run `create-next-app` (JavaScript, App Router, ESLint, **Tailwind yes**, no TypeScript, no `src/` dir), commit the vanilla scaffold plus a `.gitignore`, an updated `README.md` explaining how to clone/install/run, and push to `main`. **No app-specific customisation in this step.** Once merged, other engineers cut their own branches from `main` and work in parallel on subsequent phases.

**Backend track (in order):**

- **Phase 1 — Foundation customisation**: extend `tailwind.config.js` with a magenta primary palette matching Figma, init shadcn/ui (JS variant) including the Sheet primitive (also Button, Badge, Card, Checkbox, RadioGroup), base `app/layout.js` with FRM Genius branding placeholder and TopNav (Home | Payer Changes | Accounts), `.env.local` template documenting SMTP vars for the email demo, npm scripts (`seed`, `diff`, `reset`), and README section with curl examples for the APIs to be built.
- **Phase 2 — Snapshot & reference seeds**: CSV → JSON normalisation for `formularySnapshots`, `medPolicySnapshots`, `plans`, `accounts` (with dummy `email`), `product`, `materials`. Snapshot files stored under `data/`; a duplicate under `seeds/` for reset. Implement `lib/db.js` with read/write helpers + single-write mutex.
- **Phase 3 — Diff engine**: `lib/diff.js`, tracked fields exactly per §6.1, groupings per §6.2 (3), produces `internalUpdates.json` (appending to CSV-seeded rep intel) and `payerChanges.json`. Idempotency test.
- **Phase 4 — API endpoints**: implement all 8 endpoints in §7 with Zod validation. Nodemailer with fallback mock transport. Verify each endpoint end-to-end via curl scripts stored under `scripts/api-smoke.sh`.

**Frontend track (only after backend track is exercised via curl):**

- **Phase 5 — Landing page (Screen 1)**: `/payer-changes` grouped list + banner + row layout + provenance chips.
- **Phase 6 — Resolution Sheet (Screens 2–5)**: right-side Sheet with 3 steps, wired to detail/materials/resolve/notify APIs; nested confirm block; success state closes the Sheet.
- **Phase 7 — Resolved state (Screen 6)**: resolved-row rendering, `ResolutionSummaryPanel`, banner counter update.
- **Phase 8 — Stub tabs & polish**: Home + Accounts stubs, empty/loading states, "source unavailable" chip for orphan accounts, dev-reset button + shortcut. *(As built: dev-reset shipped as a Demo Controls panel, then removed once the flow was stable — reset remains available via `npm run reset` / `POST /api/dev/reset`.)*
- **Phase 9 — Demo dry-run**: rehearse brief §14 sequence twice; fix rough edges only.

## 9.1 As-built status (2026-09-04)

All phases above are implemented and verified end-to-end. Deviations from the original plan text:

- **TypeScript, not JavaScript.** The app was built in TS strict mode (`.ts`/`.tsx` + `.mjs` for lib internals); `tailwind.config.js` was replaced by Tailwind v4 CSS-first theming (`styles/tokens.css` with `@theme inline`).
- **No shadcn/ui.** Hand-rolled components in `components/ui/` (Drawer instead of Sheet, Accordion, CheckboxCard, StatusPill, Stepper, ValueTransition, ProvenanceMeta, ComplianceBadge, InfoBox, FloatingHelp).
- **Resolution flow** lives in `features/payer-change/` (`PayerChangeDrawer` + `steps/Step1–3` + `ConfirmSendDialog`), wired to the real APIs through `services/api.ts` and `store/ConflictStore.tsx`.
- **Resolved-state UI**: `ResolutionSummaryAuditTrail` (per-change audit card) plus a `ResolvedSummariesTable` added beyond the original plan.
- **Demo Controls panel removed** from the UI after the flow was verified; `POST /api/dev/reset` and `npm run reset` remain.
- **Verification**: `npm run smoke` (25/25 checks), `npx tsc --noEmit` clean, `npx eslint .` clean (2 pre-existing backend warnings), full resolve flow exercised live in the browser.

## 10. In scope (v1)

- Conflict detection driven by snapshot diff engine on the 8 tracked fields
- Unified `InternalUpdates` change log (rep intel + auto-generated)
- Territory-level impact view (grouped by change type)
- One-action territory-level resolution and email notification
- Real Nodemailer email path (with safe mock fallback)
- Templated, MLR-safe notification content
- Visible provenance + compliance markers everywhere
- Synthetic data covering one product + multiple plans across multiple payers
- Read-only Accounts view showing the dummy emails used for the send demo
- `POST /api/dev/reset` for demo re-runs

## 11. Out of scope (v1)

- Login, user management, roles/permissions
- Real payer/policy data, live integrations
- Account-by-account editing (all territory-level)
- Real SMS/hub delivery (email only)
- Free-text communication, promotional content
- Real MLR/compliance engine (badges visual only)
- PA / appeals / denials workflows
- Search, dashboards, analytics, reporting
- Bonus payer-policy scraper (Phase B stretch — if built, must produce a snapshot the diff engine ingests)

## 12. Risks & mitigations

- **Diff engine noise on 1000-row CSVs** — many rows may have no plans in Territory 14. Mitigation: the engine emits changes for all rows, but the UI only shows changes where `affected_account_ids.length > 0` (join on `plans.json` filtered by territory).
- **Email fails during demo** — Mitigation: mock transport fallback writes to `data/outbox/*.eml` and the API returns success regardless. UI is agnostic.
- **JSON write concurrency** — Mitigation: `lib/db.js` uses a single write mutex; all mutations go through typed helpers.
- **Design/copy vs data mismatch** — Figma uses real payer names/different territory/different product. Documented in Assumptions §4; seed data is the single source of truth.
- **Time overrun on Sheet UX** — right-side Sheet with steps is more layout work than a modal. Mitigation: build Step 1 first end-to-end (API + Sheet + close), then layer Steps 2 and 3.

## 13. Success criteria for the plan

- Every API endpoint returns valid data on the seed set, exercisable via `scripts/api-smoke.sh` before any frontend work begins.
- The diff engine's output for the sample CSVs matches the known deltas in §6.3 (used as an implicit test).
- Live demo runs the full Figma flow without a code change, ends with a real email in the recipient inbox (or `.eml` in `data/outbox/`).
- Every value on any screen shows source + date + plan.
- Resetting the demo is one action.

---

## 14. Progress log

- **Phase 0 — DONE** (2026-09-04). Vanilla `create-next-app` scaffold committed on branch `agents/web-dashboard-nextjs-setup`: Next.js 16.3.4, React 19, Tailwind v4, App Router, JavaScript, no `src/`. `package.json` renamed to `frm-genius`. `.gitignore` extended with `/data/outbox/`. README replaced with FRM Genius overview, branching model, phased plan, and stubbed curl examples. `AGENTS.md` / `CLAUDE.md` were auto-generated by Next 16 (`next dev`) and are committed as-is. Dev-server smoke: `npm run dev` returned HTTP 200 on `/`. Commit + push handled manually by the user.
- **Next up**: Phase 1 — foundation customisation on a fresh branch off `main` (magenta Tailwind theme, shadcn/ui init with Sheet/Button/Badge/Card/Checkbox/RadioGroup, `app/layout.js` with FRM Genius brand + TopNav, `.env.local.example` with SMTP vars, npm scripts `seed`/`diff`/`reset`).
- **Phases 1–9 — DONE** (2026-09-04). Backend (schema, seeds, diff engine, all 8 endpoints, Nodemailer with mock fallback, `scripts/api-smoke.sh` 25/25) and frontend (landing page, resolution drawer with 3 steps + confirm dialog, resolved-state summary + audit trail, resolved-summaries table, accounts view) are complete and verified live end-to-end. Stack deviations captured in §9.1. Demo Controls panel removed from the UI once the flow was stable (reset still available via `npm run reset` / `POST /api/dev/reset`).
