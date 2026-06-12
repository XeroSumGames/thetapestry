# Stability Audit - 2026-06-12

**Triggered by:** Pre-Beta-500 check (19 days out). Last audit: 2026-05-30 (13 days ago). Heavy shipping interval: Grapple rework, Token Library Phase 2, AUDIT M3 console sweep, Session 63 polish batch.

**HEAD at audit time:** `c0694b8` | Tests: 875 / 48 | All gates green

---

## Live gates (verified this session)

| Gate | Result |
|---|---|
| `npm test` | 875 / 48 PASS |
| `npx tsc --noEmit` | CLEAN |
| `node scripts/check-font-sizes.mjs` | OK |
| `node scripts/check-role-literals.mjs` | OK |
| `node scripts/check-em-dashes.mjs` | OK |
| `node scripts/check-arch.mjs` | OK - all metrics at baseline |
| `npm run check:publication` | OK - live publication matches baseline (21 tables) |
| `npm run check:db-emdashes` | FINDING - `public.loot_npc_item` (see MEDIUM #2) |
| `npm audit` | 0 high / 0 critical (postcss moderate carry-over, build-time only) |

---

## BLOCKER (0)

None.

---

## HIGH (0)

None.

---

## MEDIUM (2)

### M1 - `sql/_baseline/schema.sql` drift from live DB

**What:** The baseline schema has not been updated to reflect 6 live DB changes applied since the last baseline sync:

| Column / Change | Applied by | Baseline state |
|---|---|---|
| `initiative_order.pending_action_loss boolean DEFAULT false` | `sql/initiative-pending-action-loss-2026-06-11.sql` (commit `2737511`) | **MISSING** |
| `portrait_bank.is_private boolean NOT NULL DEFAULT false` | `sql/add-portrait-bank-is-private-2026-06-12.sql` | **MISSING** |
| `portrait_bank.name text` | `sql/token-library-phase2-schema-2026-06-12.sql` | **MISSING** |
| `portrait_bank.number` - was NOT NULL, now nullable | same | **WRONG** |
| `portrait_bank.gender` - was NOT NULL, now nullable | same | **WRONG** |
| `portrait_bank_gender_check` CHECK constraint | same | **SHOULD BE DROPPED** |

**Confirmed via:** `lib/database.types.ts` regenerated from live shows all changes (nullable number/gender, is_private, name). Baseline comparison shows 0 of these.

**Risk:** No production risk (live DB is correct; types were regenerated). If someone tries to rebuild from baseline they get wrong schema. Compliance with AGENTS.md infra-as-code discipline breaks here. Growing gap = harder to fix later.

**Fix:** Add the 6 changes to `sql/_baseline/schema.sql`. Straightforward text edits; no DB action needed. Route to Puffer next session.

**New todo:** `[PUFFER][MEDIUM] sync sql/_baseline/schema.sql - 6 portrait_bank + initiative_order drifts`

### M2 - `public.loot_npc_item` live function has em/en-dashes in SQL comments

**What:** `npm run check:db-emdashes` flags em-dashes inside the live `loot_npc_item` function body. The dashes are in SQL comment lines (`--`), not in any `RAISE`, `RETURN`, or string emitted to users. Not a user-visible output issue; violates the no-em-dash rule by letter.

**Risk:** Low - comments only. The rule targets text "emitted to users" but the guardrail is conservative. Baseline `sql/_baseline/schema.sql` has ZERO em-dashes (clean), meaning the drift is purely in the live `pg_proc` body.

**Fix:** `CREATE OR REPLACE` the function from the clean baseline version (which already lacks the em-dashes). Low-risk since the baseline version's logic is correct and the only change is removing dashes from comments. Route to Puffer next session alongside M1.

**New todo:** `[PUFFER][MEDIUM] fix loot_npc_item em-dashes: CREATE OR REPLACE from baseline`

---

## LOW (4)

### L1 - Confidence Ledger stale in debug-handoff §3

**What:** §3 shows 738 tests / 41 files. Actual after `scripts/refresh-ledger.mjs` (run this session): **875 / 48**. Also the HOPED-FOR list still includes P3 Q4-b Advantages which was drained to PLAYTESTED in Session 63.

**Fix:** Update debug-handoff.md §3 (done in this commit).

### L2 - Security audit top-2 findings stale-as-done

**What:** `tasks/security-audit.md` 2026-06-09 entry lists as open:
- #1 `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML XSS trap
- #2 `app/account/page.tsx:102` avatar upload missing pre-flight

Both were **FIXED by `03453dd` (2026-06-10)**. Next weekly audit (2026-06-16) will pick this up; noted here for the record.

**Fix:** Mark in security-audit.md (done in this commit).

### L3 - `characters` parent todo needs ticking

**What:** In todo.md, the `characters cross-user writes` parent item is `[ ]` but all sub-items are `[x]` and Risk Register shows GREEN/CLOSED. Health-pulse flagged this repeatedly.

**Fix:** Tick the parent (done in this commit).

### L4 - `@supabase/ssr` dependency drift (advisory, carry-over)

**What:** `package.json` pins `@supabase/ssr: ^0.9.0`; latest is 0.12.0 (3 minor versions). No breaking auth changes observed; advisory only.

**Action:** Review changelog before next non-trivial auth-adjacent ship. Bump in a low-traffic window. Not urgent pre-Beta-500.

---

## Risk Register updates

### `roll_log` writer path: YELLOW -> **GREEN-ish (demoted 2026-06-12)**

**Demote rationale:** YELLOW was held for "one more playtest cycle (2026-05-25)" after the 2026-05-19 batch added new write paths. It has now survived **3+ full sessions** including the 38-minute Session 63 (2026-06-12) where the following write paths all fired cleanly with zero feed reports:
- `advantage_used` outcome (Advantages grant->use->consume loop confirmed live)
- FI single-modal cutover (Tony's FI roll at 19:38:35 rendered correctly)
- Stabilize cascade (2x Stabilize by Mikey Shevik, action counts verified)
- Tier-2 Recruit (2x recruit rolls, feed rendered correctly)
- AUDIT M3 console sweep (`077f169`) - `reportSupabaseError` replaces bare `console.error` at 97 sites; no behavior change to feed writes

The YELLOW's own condition ("hold one more playtest cycle") has been met three times over.

**Residual risk:** Stress Check 12-string narrative - 8 of 12 strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) not yet captured in any recorder dump. Those specific code paths remain HOPED-FOR. A bug there would show as a wrong or missing narrative string on the Stress feed row - visible but not session-breaking. Note this in the new GREEN-ish entry.

### TacticalMap 14-day watch note: **DROPPED (2026-06-12)**

**Why drop:** Watch note was set 2026-05-30 through 2026-06-13. Session 63 (2026-06-12) had active combat with 6 NPCs going mortal, token moves, and tactical-map usage - zero tactical-map reports. Watch period is clean; expires tomorrow. Dropping the note today.

---

## Confidence Ledger updates (applied to debug-handoff §3)

- **TESTED (automated):** 875 / 48 files (was 738/41; refreshed via `scripts/refresh-ledger.mjs`)
- **PLAYTESTED RECENTLY (additions from Session 63 + post-63 live test 2026-06-12):**
  - Tier-2 Recruit - 2 clean rolls, action consumed correctly
  - FI single-modal flow - dedicated modal opened, result rendered
  - Stabilize cascade - 2x action consume + nextTurn verified clean
  - P3 Q4-b Advantages - grant->use->consume loop confirmed (live test post-Session-63)
- **HOPED-FOR (drain):** P3 Q4-b Advantages removed (DRAINED). Remaining 2:
  - FI Insight Die EARN path (rolling doubles -> `useRollResolution.ts:264` `insight_dice +1`, never fired)
  - Stress Check 12-string narrative (8 strings uncaptured: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)

---

## Beta-500 readiness assessment (7/1, 19 days out)

| Area | Status | Notes |
|---|---|---|
| Core table loop | GREEN | Session 63 38-min session clean; E2E 142/0 |
| Tactical map | GREEN | 14-day watch clean; 12-check gate passed |
| Realtime channels | GREEN-ish | Grand Re-Arch complete; 2-client validated |
| Initiative state machine | GREEN-ish | Grapple Phase 3 column applied; pending_action_loss working |
| roll_log feed | GREEN-ish (demoted today) | 3+ sessions clean |
| Beta-safety floor | LIVE | Better Stack uptime monitor + Sentry alert routing |
| Supabase backup | CONFIRMED | Pro tier = 7-day PITR |
| Schema baseline | MEDIUM DRIFT | 6 columns; no prod risk; fix before launch |
| Remaining HOPED-FOR | 2 items | Need live session with doubles (FI) + specific action types (Stress strings) |

**Verdict:** No BLOCKERs or HIGHs. Two MEDIUM items are infra-discipline (schema baseline) and a cosmetic rule violation (DB em-dashes). Neither threatens Beta-500 functionality. The table loop is clean. Recommended: fix the baseline drift (M1) this session while the context is hot; M2 (em-dashes) can follow after.

---

## New todos added

- `[PUFFER][MEDIUM] sync sql/_baseline/schema.sql - 6 portrait_bank + initiative_order drifts (audit 2026-06-12)`
- `[PUFFER][MEDIUM] fix loot_npc_item em-dashes: CREATE OR REPLACE from baseline (audit 2026-06-12)`
