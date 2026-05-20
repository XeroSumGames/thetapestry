# Pre-Playtest Monday-Morning 30-Min Focus (2026-05-25)

The tight version. If you only have 30 minutes before the session starts, run THIS. The full testplans below cover depth; this distills "what's most likely to silently regress and would be hardest to recover from mid-session."

Generated 2026-05-20 (puffer-fish lane) by cross-referencing:
- [tasks/preplay-testsmoke-2026-05-25.md](preplay-testsmoke-2026-05-25.md) - the full 2026-05-19 batch testplan
- [tasks/stabilize-migration-phase1-testplan-2026-05-20.md](stabilize-migration-phase1-testplan-2026-05-20.md) - Stabilize Phase 1 ship
- [tasks/distract-migration-phase2-testplan-2026-05-20.md](distract-migration-phase2-testplan-2026-05-20.md) - Distract Phase 2 ship
- 2026-05-20 puffer-fish ships (security + ops docs + Risk Register triage)

Test suite baseline before you start: **411 passing** (was 349 when the original testplan was written; new tests cover stabilize-helpers + distract-helpers + safe-upload + outcomeColor snake_case + supabase-errors).

---

## The 7 things to hit (in priority order)

### 1. STABILIZE button in combat - PC + NPC (Phase 1, today)

**Why first:** the dedicated `<RollModal>` cutover removed the CharacterCard per-card Stabilize button (it had a latent bug since inception - used the PATIENT's stats as the medic's). New entry point is the in-combat dropdown only.

- Start combat with a downed PC and a downed NPC, plus a medic PC in range.
- From the dropdown, fire STABILIZE on the PC. Confirm: roll fires, narrative appears, action consumed, modal closes.
- Fire STABILIZE on the NPC. Same checks.
- **Fast-fail signal:** if the modal opens but action isn't consumed, or if the medic's RSN/Medicine looks wrong on the roll modal, the cascade is broken.

Full coverage: `tasks/stabilize-migration-phase1-testplan-2026-05-20.md` (PC success / PC failure / NPC / edge / network / rollback).

### 2. DISTRACT button in combat (Phase 2, today)

**Why second:** ships in the same hour as Stabilize Phase 1, same migration pattern, but Distract's target-picker is more involved (picks initiative entries, not arbitrary characters).

- In active combat, fire DISTRACT on a target other than the active character.
- Confirm: roll fires, target's `actions_remaining` decrements by 1, `turn_changed` broadcast fires.
- **Fast-fail signal:** target's action count doesn't update visually, or the broadcast doesn't reach a 2-client setup.

Full coverage: `tasks/distract-migration-phase2-testplan-2026-05-20.md`.

### 3. File upload at ALL bucket types (safe-upload, today's H-1)

**Why third:** 7 upload sites were rewritten to use `prepareUpload()` from `lib/safe-upload.ts`. If the helper rejects a legitimate file, the user gets an alert instead of an upload.

Smoke-test ONE upload per bucket type:
- Session attachment (table page, end-session flow): upload a small JPEG to a session. **PASS:** appears in `session_attachments`.
- GM Note attachment (`components/GmNotes.tsx`): drop a PDF on a note. **PASS:** appears in the note's attachments.
- Pin attachment (`components/CampaignMap.tsx` OR `components/MapView.tsx`): add an image to a map pin. **PASS:** appears under the pin.
- War-story attachment (`/campfire/war-stories`): attach an image to a story. **PASS:** renders.
- Module cover (`/rumors/<id>/edit`): upload a cover image. **PASS:** cover updates.

**Fast-fail signal:** an alert reading "file type X not allowed" or "too large (max N MB)" on a normal JPEG/PNG = the whitelist is too narrow. Open `lib/safe-upload.ts` and check the bucket's allowed extensions.

### 4. CAPTCHA on signup (turnstile rate-limit, today's H-2)

**Why fourth:** the rate-limit + body-cap rewrite of `app/api/auth/verify-turnstile/route.ts` should not change legitimate signup behavior.

- Sign up a fresh test account. Complete the CAPTCHA.
- **PASS:** account created, verification email arrives (or skipped per env), redirected to dashboard.
- **Fast-fail signal:** 429 response in network tab on a single signup = rate-limit threshold too aggressive.

(Don't bother trying to hit the 30/min limit live - that's a curl-loop test, not a session-morning test.)

### 5. Cross-client realtime sync ([2-client] required)

**Why fifth:** roll_log writer path is held YELLOW one extra cycle (per today's Risk Register triage) because 2026-05-19/20 added new write paths (Advantages, FI cutover, Stress, Stabilize Phase 1, Distract Phase 2) and the outcomeColor dedup widens the consumer surface.

Two clients (GM + player):
- GM fires a Stabilize on a downed PC. Player sees the new feed row within 2-3s.
- GM fires a Distract. Player sees the target's actions update.
- Player fires their own roll. GM sees it.
- **Fast-fail signal:** feed row appears on one client but not the other; OR feed row color is wrong (community-page colors must match canonical now, modal colors deliberately different).

### 6. Community page outcome colors (today's outcomeColor dedup)

**Why sixth:** `app/stories/[id]/community/page.tsx` deleted its local `outcomeColor` and now imports the canonical from `lib/roll-helpers.ts`. The canonical accepts both display-form (`'Wild Success'`) AND snake_case (`'wild_success'`); the community page passes snake_case from DB rows.

- Open the campaign Community page (`/stories/<id>/community`).
- **PASS:** morale rows + resource rows show the same colors they did before (green / blue / amber / red).
- **Fast-fail signal:** a row shows the default grey (`#d4cfc9`) = the canonical isn't matching the snake_case input.

### 7. Feed narrative parity across modal migrations

**Why last:** every modal migration changes the cascade ordering (action consumption timing, optimistic state updates, DB write order). Visual narrative parity is the easiest regression to catch.

Run side-by-side with the reference visual: open `tasks/roll-feed-log-preview.html` in a browser, then live-fire each of the migrated checks:
- STABILIZE (HI / Success / Failure / LI / Dire / Wild)
- DISTRACT (any outcome)
- HEAL, UNJAM, REPAIR (vehicle attacks via Drive)
- STRESS CHECK (CHECK button)

**PASS:** every live row matches the preview's wording, prefix-CAPS, and post-roll tails exactly.

**Fast-fail signal:** wording diverges from the preview = either a regression OR the preview is stale (per the `check-preview-sync.mjs` guardrail, the preview should be in lockstep).

---

## What's NOT in this 30-min focus (covered elsewhere if you have time)

- Recruit Tier-2 (Phases A/B/C) - run the full testplan if you have +15 min. Locked at 2026-05-19 batch.
- Vehicle fuel-storage drums + brewing-supplies stockpile - parallel-chat track.
- First Impression streamline (Phases 1-3) - parallel-chat track.
- Em-dash sweep across UIs - automated guardrail catches any new ones; not worth manual scan.
- Pre-commit hook smoke (preview-sync, em-dash, role-literal, font-size) - covered by the daily commit cycle.
- HOPED-FOR drift drain in health-pulse - `node scripts/refresh-ledger.mjs` after the session.

---

## After the session

Drain the HOPED-FOR Confidence Ledger:
1. `node scripts/refresh-ledger.mjs` to refresh the test count + per-file inventory.
2. Promote 2026-05-19 + 2026-05-20 batches from HOPED-FOR to PLAYTESTED RECENTLY in `tasks/debug-handoff.md` Sec 3.
3. If any of the 7 priority checks above FAILED, log a bug + file the testplan as the repro (don't write a new testplan from scratch).
4. Re-evaluate the 2 held YELLOW items (roll_log writer + table page) per `tasks/debug-handoff.md` Sec 1.

---

## Maintenance

Discard this file after 2026-05-25 (one-shot for that playtest). The pattern stays useful: write a 30-min-focus alongside any depth testplan when there are 5+ ships' worth of HOPED-FOR work, so the user has a triage path under time pressure.
