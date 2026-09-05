# Chatbot Test Script — Questions + How to Verify

> Use this during your presentation (or before it) to demo the chatbot and prove
> the answers are right. Every "expected answer" below was checked against the
> live data on **Sep 5, 2026**. If the data is reset or changed, re-check the
> numbers first (see the last section).

**How to read this guide:** each question tells you (a) what to type, (b) what a
correct answer must contain, (c) which "brain" should answer — the **AI** (slower,
~2s, natural phrasing) or the **rule composer** (instant, detailed) — and (d) how
to double-check the fact yourself in the app.

---

## A. Plan questions (AI brain, ~2s, short natural answer)

### A1. "What is the formulary tier for Meridian Choice PPO?"
- **Correct answer must say:** `Specialty`
- **Who answers:** AI (you'll see it phrased naturally, e.g. just "Specialty")
- **Verify yourself:** open the Formulary Snapshot table in the app, find
  "Meridian Choice PPO Formulary" → Tier = Specialty.

### A2. "Does Cascade Select HMO require prior auth?"
- **Correct answer must say:** prior auth **required** (it changed from N to Y —
  that's the open conflict)
- **Who answers:** AI
- **Verify yourself:** Payer Changes panel → Cascade Care — Cascade Select HMO →
  field "Prior auth required" changed N → Y.

### A3. "Is Onvexa covered under Granite MA Complete?"
- **Correct answer must say:** **Not Covered** (this is the dramatic one —
  coverage flipped from Covered to Not Covered)
- **Who answers:** AI
- **Verify yourself:** Medical Policy Snapshot → Granite MA Complete →
  Coverage = Not Covered.

### A4. "What is the site-of-care restriction for Harborview Preferred PPO?"
- **Correct answer must say:** **Physician Office** (restricted from three
  settings down to just this one)
- **Who answers:** AI
- **Verify yourself:** Medical Policy Snapshot → Harborview Preferred PPO →
  Site of care = Physician Office.

### A5. "Does Summit Advantage HMO have a quantity limit?"
- **Correct answer must say:** quantity limit **Y / yes**
- **Who answers:** AI
- **Verify yourself:** Medical Policy Snapshot → Summit Advantage HMO →
  Quantity limit = Y.

---

## B. Count questions (AI brain, ~2s, one sentence with a number)

### B1. "How many plans cover Onvexa with no prior auth?"
- **Correct answer must say:** **222 plans**
- **Who answers:** AI
- **Verify yourself:** this is pre-computed in code from the medical-policy
  table (Covered + PA = N). Ask the same question twice — the number must be
  identical both times.

### B2. "How many plans require step therapy?"
- **Correct answer must say:** **284 plans**
- **Who answers:** AI
- **Verify yourself:** filter the Medical Policy Snapshot on
  Step therapy = Y → 284 rows.

### B3. "How many plans cover Onvexa in total?"
- **Correct answer must say:** **999 of 1000 plans**
- **Who answers:** AI
- **Verify yourself:** Medical Policy Snapshot → Coverage = Covered → 999 rows.

---

## C. Conflict questions (rule composer, instant, detailed)

### C1. "Tell me about the Meridian Choice PPO conflict."
- **Correct answer must contain ALL of:**
  - the field: **step therapy** changed from **N to Y**
  - the source: **MMIT** and the date **Aug 1, 2026**
  - the 3 affected offices: **Lakeside Oncology Associates, Harbor Cancer
    Center, Fairview Infusion Suite**
  - status: **open**
- **Who answers:** rule composer (instant — under 0.1s)
- **Verify yourself:** Payer Changes panel → open the Meridian Choice PPO row →
  compare each fact.

### C2. "Which accounts are affected by the Granite State conflict?"
- **Correct answer must name:** **Beacon Hill Oncology, Cedar Valley Cancer
  Care, Meadowbrook Infusion**
- **Who answers:** rule composer
- **Verify yourself:** open the Granite MA Complete conflict → affected
  accounts list.

### C3. "What changed for Harborview Preferred PPO?"
- **Correct answer must say:** site-of-care restriction narrowed from
  **"Outpatient Hospital; Physician Office; Home Infusion"** to
  **"Physician Office"**
- **Who answers:** rule composer
- **Verify yourself:** the conflict card shows the before → after values.

### C4. "How many open conflicts are there right now?"
- **Correct answer must say:** **5 open conflicts** and ideally list all five
  plans: Meridian Choice PPO, Cascade Select HMO, Granite MA Complete,
  Harborview Preferred PPO, Summit Advantage HMO
- **Who answers:** rule composer
- **Verify yourself:** Payer Changes panel → count the open rows (5).

---

## D. Catalog questions (rule composer, instant)

### D1. "What compliance-reviewed materials are available?"
- **Correct answer must list all 6 titles**, including:
  - Onvexa Site-of-Care Guidance Sheet
  - Onvexa Coding Quick Reference (J9345)
  - Prior Authorization Requirements — Onvexa (Aug 2026)
  - Formulary Tier Placement Overview
- **Who answers:** rule composer
- **Verify yourself:** Materials panel → same 6 items.

### D2. "Have any notifications been sent?"
- **Correct answer must say:** none sent yet (the outbox is empty until you
  resolve a conflict and notify offices)
- **Who answers:** rule composer
- **Verify yourself:** Notifications panel → empty state.

---

## E. Edge cases (proves the chatbot is safe)

### E1. "Hi" or "What can you help me with?"
- **Correct answer:** a friendly intro listing topics (payer conflicts,
  accounts, coverage, materials, audit trails). Instant, no AI call.

### E2. "asdfgh jkl" (gibberish)
- **Correct answer:** "I'm not able to understand that. Could you rephrase…"
  — it must NOT try to answer or invent something.

### E3. "What is the formulary tier for Meridian Choice PPO?" asked twice
- **Correct behavior:** both answers say Specialty, and both arrive in about
  2 seconds. Consistency proves the answer comes from data, not imagination.

### E4. "What is the formulary tier for Aurora PPO?" (a plan that does not exist)
- **Correct behavior:** it says "I don't have that plan in the territory data"
  — it must NOT invent a tier. (Note: "Zephyr PPO" is actually a real plan in
  the data — Zephyr Care — Zephyr PPO, Specialty tier — so it gives a real
  answer; use Aurora PPO for the missing-plan case.)

### E4b. "What is the tier for a plan that doesn't exist?" (no plan named)
- **Correct behavior:** it asks you to name a specific plan (it suggests
  Meridian Choice PPO, Cascade Select HMO, Granite MA Complete, Harborview
  Preferred PPO, Summit Advantage HMO) — it must NOT dump the territory
  status message or invent a tier.
- **Who answers:** rule composer (instant, under 0.1s).

---

## F. The 3 checks that matter most (if you only demo 3)

1. **A1 (tier = Specialty)** — proves fast, natural AI answers (~2s).
2. **C1 (full conflict detail)** — proves instant, detailed, sourced answers.
3. **E2 (gibberish)** — proves it never makes things up.

---

## G. If the numbers don't match

The expected values above were read from the live data on Sep 5, 2026. If
someone reset or edited the data, re-check before presenting:

- Open the **Payer Changes** panel for conflict facts (fields, offices, status).
- Open the **Medical Policy / Formulary Snapshot** tables for plan facts
  (tier, coverage, PA, step therapy, quantity limit).
- Conflict IDs and statuses can change after a reset — always re-read the
  panel before quoting a fact on stage.
