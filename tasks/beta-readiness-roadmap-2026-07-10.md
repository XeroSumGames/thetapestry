# Beta-Readiness Roadmap - run-with-it list for 2026-07-10

Goal for the day: TheTapestry solid + playable enough to put in front of
reviewers and beta testers. Bug fixes, polish, finalizing features. Nothing
about infra tiers or legal - pure "make the platform not break at the table."

Source of the bug items: the 2026-07-09 full-codebase audit
([stability-audit-2026-07-09.md](stability-audit-2026-07-09.md)). Puffer already
shipped the CRITICAL + the read-swallow cluster + the realtime channel-reuse
cluster. Everything below is STILL OPEN as of this morning (verified against git
- no combat fixes landed overnight).

Ordered so you can go top-down. Each item has the file:line so a coding chat
can act immediately.

---

## TIER 1 - CORE TABLE LOOP (fix FIRST; these break a live session turn one)

These are the bugs a playtester hits in the first fight. Do this tier before
anything else.

- [x] **[SHIPPED 2026-07-13] Combat damage used the WRONG character's Physicality + NPCs had infinite ammo (H1/H2, one root fix).** `useRollResolution.ts` resolved damage-PHY, ammo spend, weapon jam, and kill-credit from `myEntry` (the viewer) instead of the attacker - so a GM rolling for an NPC used the GM's own PC (or zero), NPCs never spent ammo, and an NPC's shot could mangle the GM viewer's PC clip/condition. Fixed by resolving the attacker once (`attackerEntry` PC / `attackerNpc` NPC from the roll's `characterName`) and using it at all four sites; NPC ammo + weapon condition now decrement (via `updateCampaignNpc`). tsc + 917 tests + gates green. **2-client combat verify owed.**
  - [x] **[SHIPPED 2026-07-13, Xero canon] Fire now spends ammo on ANY outcome + no target.** "If a weapon is fired, it uses ammo regardless of the outcome." Moved the decrement to a standalone block before the hit block (playtest step 12 closed).
- [x] **[SHIPPED 2026-07-13, Xero canon opt.1 - H3] Insight reroll now REPLACES the original outcome (no double damage).** The original hit snapshots the target's pre-hit state (`DamageResult.rerollBaseline`); the reroll restores it and reapplies, so the net is the reroll's outcome alone (incl. reversing a downing a weaker reroll undoes). Baseline carried through 2nd rerolls. 2-client combat verify owed.
- [ ] **[H4 - UNBLOCKED 2026-07-13, needs a live migration + wiring; NEXT FOCUSED PASS] Cover Fire does nothing but still costs an action.** `page.tsx:4574` writes -2 to the target's `aim_bonus`, which `activateUpdate` (:2423) zeroes when the target's turn starts. **Xero ruling: (a) the -2 must stick to the target's next action, (b) Cover Fire spends a round of ammo.** SPEC (no reusable initiative_order field survives activation, so a new column is needed): (1) `ALTER TABLE initiative_order ADD COLUMN incoming_cmod integer NOT NULL DEFAULT 0` (apply live + mirror in `sql/_baseline/schema.sql` + `lib/database.types.ts`); (2) Cover Fire writes `incoming_cmod = existing - 2` on the target AND decrements the actor's weapon ammo (mirror the fire-spends-ammo block); (3) do NOT add `incoming_cmod` to `activateUpdate`'s reset list (so it survives to the target's turn); (4) `computeAttackCmod` (`lib/table-roll-context.ts:240`, next to the `aim` term) adds `activeEntry.incoming_cmod` as a labeled "Cover Fire" term; (5) clear it at turn-end in `nextTurn` for the entry whose turn is ending. Live schema change = bright line; deliberate careful pass.
- [x] **[SHIPPED 2026-07-13] Upkeep no longer DEGRADES a Pristine item on a great roll (H5).** `lib/upkeep.ts` clamped Wild Success / High Insight with `min(safeIdx, ...)` so the result is never worse than the current condition; the two tests that pinned the bug were flipped + a High-Insight Pristine case added. 918 tests green.
- [x] **[SHIPPED 2026-07-13] Reload no longer = infinite free ammo + full-clip/1d3 loadout (Xero canon).** `CharacterCard.tsx` normalizes `reloads ?? 0` at the render binding (unset = disabled, not infinite). All ranged weapons (PC via `xse-engine`, NPC via `npc-generator`) now start with a FULL clip + 1d3 reloads; `npc-generator` d3() zero-bug fixed. **NOTE: this reversed the 2026-06-23 "looted NPC guns have scarce ammo (1d6-1)" call - NPCs now spawn with a full clip, so looted guns come loaded.** Existing characters keep their data (unset reloads read as 0; no bulk migration).
- [ ] **[H10 - UNBLOCKED 2026-07-13, needs a rest-flow redesign; NEXT FOCUSED PASS] Resting the party multiplies the campaign clock by party size.** `CharacterCard.tsx:1293` (Rest) + `:680` (Travel) each call `advanceClock` per PC, so a 4-PC overnight rest jumps the world 96h + burns 4x rations/infection. **Xero ruling: "moving time affects everyone" - time is global.** So a rest should advance the clock ONCE and recover the WHOLE party for that span, not per-character. This is a flow redesign (per-character Rest -> a single party-rest that advances time once + applies rest recovery to all living party PCs, with the clock drainers already covering rations/infection for everyone). Decide the UX (a party-rest action vs per-char rest that heals-only-the-char without touching the shared clock, leaving Advance Time as the only world-clock mover). Careful pass - it touches the survival economy.
- [x] **[SHIPPED 2026-07-13] Sickness Day-0 mortal drop now applies the +1 Stress pip (H8).** `lib/campaign-clock.ts` adds the on-entry pip (PC-only, guarded on prior wp>0), matching every other mortal-wound site.

## TIER 2 - PROVE IT (needs you at two browser windows; ~45 min)

You can't call it stable without these. Grab two browsers (or a helper).

- [ ] **Consolidated mechanics 2-client verify** - the real Beta-500 gate, ~8 owed live-verifies. Plan: [mechanics-verify-consolidated-testplan-2026-07-06.md](mechanics-verify-consolidated-testplan-2026-07-06.md). Also drains the 3 stale HOPED-FOR items (FI Insight Die award, Stress 12-string narratives, vehicle popout broadcasts).
- [ ] **Yesterday's realtime channel fixes** - clock-advance-while-infected (must NOT hang the table), pin reveal to players, vehicle firing-arc toggle cross-window. Plan: [realtime-cluster-verify-testplan-2026-07-09.md](realtime-cluster-verify-testplan-2026-07-09.md).

## TIER 3 - SECONDARY CORRECTNESS (playability, less catastrophic than Tier 1)

- [x] **[SHIPPED 2026-07-13 - H9] Community 13-member deadlock fixed (Xero: PCs ARE members, "4 players + 9 members = 13").** Weekly Check eligibility now uses `combinedMemberCount(pcCount, members.length)` - the same total as promotion; the modal takes `pcCount`. Departures/morale math stay NPC-only (a dice roll never removes a player's character). 2-client verify owed.
- [ ] **A saved community loses the members it should keep.** `CommunityMoraleModal.tsx:405,438,548` - a successful Retention Check cancels the failed Morale's departures AND records `members_after:0` for a community that kept everyone.
- [ ] **Recruit "Current group" always makes a NEW group.** `page.tsx:3970` - the default dropdown option is labeled "Current group" but maps to `__new__`, so every default recruit spawns a duplicate one-member group instead of growing the party.
- [ ] **CDP spend can vanish with no raise.** `CharacterEvolution.tsx:221` - deduct-then-apply with no rollback; a failed raise write eats the CDP.
- [ ] **Giving items to an NPC can destroy them.** `InventoryPanel.tsx:171` - receiver write is fire-and-forget, giver is decremented regardless. Needs an atomic path like PC->PC already has.
- [ ] **Mortal/incap transition can be missed or double-fired across clients.** `useRollResolution.ts:655,689` - mixes fresh DB damage with stale local state for the "was alive" check.
- [ ] **Barter trade can half-apply (dup + loss) and Dire Failures can be re-rolled free.** `page.tsx:10849` + `TradeNegotiationModal.tsx:365`.
- [ ] **Stuck-observer joins.** `app/stories/join/page.tsx:56` + `app/join/[code]/page.tsx:45` - an existing observer who re-joins with a normal invite stays invisible forever.
- [ ] **Bulk Upload tab has no Thriver gate.** `app/tools/token-creator/page.tsx:618` - any signed-in user can inject images into the shared portrait pool (RLS does not backstop it).

## TIER 4 - POLISH & TLC (the "feels finished" pass)

- [ ] **Kill the browser `alert()`/`confirm()` popups.** 339 call sites across ~20 files (incl. the broken-weapon attack gate, `page.tsx:5994`). These read as unfinished and violate the no-browser-dialogs rule. Replace with in-app toasts / inline messages. Do the table-page + combat ones first (most player-visible), sweep the rest as capacity allows.
- [ ] **Jargon tooltips for first-timers** (CDP / RAPID / AMod / SMod / CMod) - inline hover explanations so a new player isn't lost. (todo T3-6.)
- [ ] **Two contradictory Env-Damage buttons on the character card.** `CharacterCard.tsx:531` vs `:619` give opposite Drowning math and break the locked single-slot button order. Collapse to one correct button.
- [ ] **Weapons catalog pass** - add the Revolver (+ any missing common weapons), then a damage-consistency review across the catalog. Damage numbers are your canon call.
- [ ] **David Battersby pregen bio** is the Chased-era backstory but the character ships to EMPTY (pre-Chased). Needs your corrected text, then a one-line data update.

## TIER 5 - DEFER IF TIME RUNS OUT (real, but not table-blockers)

- [ ] Hidden-NPC fog occlusion (token shows only when a player can see the cell) - rides on per-player vision.
- [ ] Recorder observability spec (network/RPC failure capture) - makes future bug reports actionable; doesn't affect play.
- [ ] Module snapshot 1000-row truncation, module-update index/ilike edge cases, character-delete dangling scene_tokens, cross-campaign refetch storms - the audit's LOW/MED tail. Fine to leave for post-beta.

---

## Suggested shape of the day

1. **Morning: Tier 1** - one focused coding session on the combat hook + character
   card. Most of Tier 1 is 3-4 root fixes (the two `myEntry` bugs are one fix).
   This is where "playable" is won or lost.
2. **Midday: Tier 2** - grab two windows, run the verify plans, drain the stale items.
3. **Afternoon: Tier 3 then Tier 4** - secondary correctness, then the alert()
   sweep + tooltips for the finished feel.
4. Tier 5 only if you're flying.

Do Tier 1 + Tier 2 and the platform is genuinely playable for reviewers. Tier 3
+ 4 make it feel solid rather than beta-rough.
