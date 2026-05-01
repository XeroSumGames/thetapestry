# Modal Unification — Pass 1 testplan

Verifies the shared `<RollModal>` shell + the three CharacterCard modals (Stress Check, Breaking Point, Lasting Wound) migrated to it.

**No SQL migration required** — UI-only refactor.

---

## Scope decision

The original spec listed 10 target modals. Survey turned up that 6 of them (Stabilize, Distract, Coordinate, Group Check, Gut Instinct, First Impression) **already funnel through the universal `pendingRoll` modal** in [app/stories/[id]/table/page.tsx:7350-7833](app/stories/%5Bid%5D/table/page.tsx) — which IS the Attack Roll modal. Those are already unified by construction.

**This pass migrates the 4 true outliers:**
1. **Stress Check** (CharacterCard.tsx) — was: bespoke modal with CMod input + outcome banner.
2. **Breaking Point** (CharacterCard.tsx) — was: TWO modals (CMod prompt + result). Collapsed to ONE.
3. **Lasting Wound** (CharacterCard.tsx) — was: result-only display, NO CMod input. Now has CMod input.
4. **Recruit** (table/page.tsx) — DEFERRED to a follow-up sprint. It has a 3-step setup flow (PC → community → approach → skill picker → roll); the roll step alone could swap to RollModal but the setup needs care. Tracked as Pass 2.

The new shared component lives at `components/RollModal.tsx` and is the canonical shell going forward.

---

## 0. Smoke test the shared shell renders

1. Visit any campaign with a PC at stress 4. Bump stress to 5 (e.g. via the player damage path or GM Tools).
2. The Stress Check modal should auto-open. Visually confirm:
   - Header reads **STRESS CHECK** with × close.
   - Subtitle: `<character name> — Stress at maximum`.
   - Roll formula card: `2d6 + RSN + ACU + CMod` with AMod / CMod values inline.
   - CMod numeric input (defaults to 0).
   - Warning: "Success ≥ 7 → drop to 4 stress · Failure → Breaking Point" in orange.
   - Roll button labeled **ROLL STRESS CHECK** + Cancel.

## 1. Stress Check — full flow

1. Type a CMod (try +2 first), click Roll Stress Check.
2. Modal flips to post-roll state:
   - Two dice tiles displayed top.
   - Standard dice math line: `<d1> + <d2> + <amod> (AMod) + <cmod> (CMod) = <total>` with the total bolded.
   - Outcome banner: green **Success — Held It Together** OR red **Failure — Breaking Point**.
   - Close button at bottom labeled either **Continue** (success) or **Roll on Breaking Point Table** (failure).
3. On success → click Continue → modal closes, character stress drops to 4. Confirm in `roll_log`: `outcome='Success'`, label='<name> — Stress Check'.
4. On failure → click "Roll on Breaking Point Table" → Stress Check modal closes AND Breaking Point modal opens automatically (cascade preserved).

## 2. Breaking Point — full flow

**Prereq:** open via Stress Check failure cascade, OR set up a state where `breakingPointPending=true` directly (rare in normal play; the cascade is the canonical entry).

1. Modal renders with header **BREAKING POINT**, subtitle `<character name> has broken`.
2. Roll formula: `2d6 + CMod (Table 13)` — note no AMod / SMod (the Breaking Point roll isn't skill-based).
3. CMod input defaults to 0; can be edited.
4. Click **Roll Breaking Point**.
5. Post-roll state shows:
   - Two dice tiles.
   - Custom outcome card: **<TABLE NAME>** in big uppercase Carlito (e.g. "PANIC SURGE"), the rolled total + CMod, the effect text in an orange-bordered box, plus "Stress has been reset to 0" + duration "X hours".
6. Click **Acknowledge** → modal closes.
7. **DB sanity:** character's stress is now 0. A progression-log entry exists: `⚡ Breaking Point: <name> (Xh)`.
8. **CMod adjustment test:** repeat with CMod=+3. The roll's table lookup should shift accordingly (e.g. a raw d6+d6=8 with +3 CMod = 11, looking up "Self-Destructive Urges" instead of "Fatalism"). Result card shows the adjusted total.

## 3. Lasting Wound — full flow

1. Find a character at WP=0 (mortally wounded). The character card has a **LASTING WOUND CHECK** button.
2. Click it. PHY check fires under the hood:
   - On success (≥9) → alert dialog + no modal.
   - On failure (<9) → the new Lasting Wound modal opens.
3. Modal renders with header **LASTING WOUND CHECK**, subtitle `<character name> — Physicality check failed`.
4. Roll formula: `2d6 + CMod (Table 12)`.
5. CMod input defaults to 0; rare in practice, but available.
6. Click **Roll Lasting Wound**.
7. Post-roll state shows:
   - Two dice tiles.
   - Custom outcome card: table name in big uppercase, rolled total + CMod, effect text in red-bordered box, "This wound is permanent and cannot be healed."
8. Click **Acknowledge** → modal closes. Progression log: `🩸 Lasting Wound: <name>`.

## 4. Cancel paths

1. Stress Check pending state — click × or Cancel → modal closes. Character stress unchanged. No log entry.
2. Breaking Point pending state — × or Cancel → modal closes. Stress NOT reset (since the roll never fired). The cascade can be re-triggered if stress is still 5.
3. Lasting Wound pending state — × or Cancel → modal closes. PHY check already happened before the modal opened, so cancelling doesn't undo that gate; the wound is simply not registered. Player can re-click the button to retry.

## 5. Visual consistency check

Compare side-by-side with the universal Attack Roll modal (open the table page, fire any attack):
- Header bar layout matches (title + × close)
- Roll formula card has the same dark-outlined background
- CMod input has the same shape/styling
- Dice tiles in the post-roll state are identical 52×52 boxes
- Roll / Cancel button row uses the same teal-outline / gray pattern

Any visual discrepancy = bug. Report file/line.

## 6. Insight Dice support (deferred)

The shared shell HAS Insight Dice pre-roll + post-roll reroll plumbing wired in (props `userInsightDice`, `preRollInsight`, `setPreRollInsight`, `onRerollDie1/2/Both`). The three CharacterCard modals don't use them — Stress Check / Breaking Point / Lasting Wound aren't Insight-Die-eligible per SRD (only Attack-style + opposed checks are). This is intentional. Confirm the pre-roll Insight buttons do NOT render on these three modals.

## 7. TypeScript / guardrails

- `npx tsc --noEmit` clean ✅
- `node scripts/check-font-sizes.mjs` — only the two pre-Phase-4 offenders flag (TradeNegotiationModal:217, CampaignCommunity:2415); no new violations from this pass.

---

## Open follow-ups (NOT in pass 1)

- **Pass 2: Recruit modal migration.** The 3-step Recruit modal at `app/stories/[id]/table/page.tsx:9566-9930` (PC + NPC + community + approach + skill setup, then roll, then Apprentice toggle) needs care. The setup phase is bespoke and stays. Only the actual roll step (lines ~9751-9930) should swap to `<RollModal>`. ~half day.

- **Pass 3 (optional): unify the universal `pendingRoll` modal** in `app/stories/[id]/table/page.tsx:7350-7833` to use `<RollModal>` too. Would reduce table/page from 10,189 lines by ~480. Mostly a code-organization win — the visual UX is already canonical there. ~half day.

- **Pass 4 (optional): Stress Check Insight Die support.** SRD doesn't currently allow Insight Dice on Stress Checks, but if Lv4 Trait list ever opens that path, the shell already supports it — just pass `userInsightDice` + handlers.

---

## Rollback

`git revert <commit>`. The shared shell at `components/RollModal.tsx` is independent of the rest of the app; reverting the migration restores the three legacy bespoke modals in CharacterCard.tsx.
