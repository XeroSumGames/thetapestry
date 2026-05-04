# Testplan — Perf sweep 2026-04-29

**Commits on main this sweep:**
- `13c4866` — perf(table): batch round-tick + Restore + Coordinate DB round-trips

**Earlier in this session (already in main, also exercised by this plan):**
- `e7f611d` — fix(combat): GM drag of active combatant burns an action
- `230402d` — feat(initiative-bar): GM ⊘ Skip-this-round button
- `21529f7` — fix(initiative-bar): tooltip on the × button
- `3e2beab` — feat(character-sheet): one-click Unequip on PRIMARY/SECONDARY

## Why these are the perf wins worth testing

Three sequential `for...await` loops in the table page were each doing N back-to-back UPDATEs (one per combatant / target / ally). At ~150ms RTT a 6-combatant round-tick was ~2.7s of dead air. Each fires every round (or every action), so the user experience benefit compounds.

The agent also flagged `useCallback`/`useMemo` opportunities on TacticalMap & CharacterCard inline handlers, and the full **C2 Initiative Bar extraction**. Both deferred — they're architectural changes that risk subtle behavior breaks during a focused test phase. We'll re-pick those up after this round of testing confirms the DB-roundtrip wins work.

---

## Section 1 — New-round round-tick perf

### Steps
1. Hard-refresh the table as the GM. Start combat with **at least 4 PCs and 2 NPCs**, ideally with at least one combatant who has a death countdown and one who has incap rounds (use GM Tools → damage to set up).
2. Open DevTools → Network tab. Filter to `supabase.co`.
3. Run combat through one full round (everyone takes their action via Next or `×`).
4. When the round wraps and "New Round — Initiative" appears in the feed, watch the network tab.

### Expected
- All `character_states` UPDATEs, `campaign_npcs` UPDATEs, and `initiative_order` UPDATEs fire **simultaneously** (their bars overlap on the timeline) instead of one after another.
- The `roll_log` insert for "New Round — Initiative" + any death-log inserts fire in the same wave.
- The two follow-up SELECTs (`initiative_order` reroll fetch + `campaign_npcs` fetch) also overlap.
- Time from "last combatant ends turn" to "first combatant of new round is highlighted" should be **noticeably faster** than before — single round-trip wave instead of N stacked.
- No console errors. Specifically watch for any `silent RLS` or `[nextTurn]` warnings that didn't appear before.

### Regression checks
- Death countdown ticks: a PC at WP=0 with `death_countdown=2` should drop to 1 (and to "💀 has died" log when it expires).
- Incap recovery: a PC at `incap_rounds=1` should regain 1 RP (and 1 WP if WP=0 and no death_countdown active) when the timer runs out.
- RP recovery: a conscious PC below max RP should recover 1 RP per round.
- Same regression checks for NPCs.
- Initiative reroll values look reasonable (2d6 + ACU + DEX, descending sort).
- `winded` flag on a combatant who failed Sprint last round should still reduce their next-turn budget to 1 action (this was unchanged but worth confirming since the reroll path was rewritten).

---

## Section 2 — Restore to Full Health perf

### Steps
1. Damage **at least 5 mixed targets** (mix of PCs / NPCs / map objects). Easy way: take a few WP off everyone you can reach with attacks, plus destroy 1–2 map objects.
2. GM Tools → Restore to Full Health.
3. Select **all** damaged targets in the picker (use the "All" toggle).
4. Click RESTORE. **Click time it.**

### Expected
- Restore completes in **~1 round-trip's worth of time** (~150–300ms), instead of the previous ~Nx that.
- All selected targets visually return to full WP/RP after one tick.
- Roster panel + initiative bar reflect the changes immediately.
- Map objects regain integrity — destroyed sprites flip back to intact.

### Regression checks
- Looted objects: if a player looted a crate before it was destroyed, restoring the crate should NOT bring back the looted contents. (Comment at [page.tsx:7727](app/stories/[id]/table/page.tsx:7727) explicitly preserves this.)
- Mixed selections: restoring only NPCs should leave PCs and objects untouched. Same for the other combinations.
- Death-status NPCs: an NPC with `status='dead'` should flip back to `status='active'` after restore.
- Empty selection: the Restore button should still be disabled when nothing is selected.

---

## Section 3 — Coordinate batch + range check

### Steps
1. Combat with 4+ combatants positioned on a tactical map. Place 2–3 allies within 30ft of the coordinator and 1 ally outside that range.
2. The active combatant uses Coordinate, picking an enemy as target.
3. Roll succeeds.

### Expected
- Single `🎯 X, Y, Z get +N CMod when attacking <target>` log row (not per-ally rows).
- Out-of-range ally is **not** in the names list and does **not** receive the bonus.
- Allies in-range have their `coordinate_target` and `coordinate_bonus` fields updated (visible by checking that on their next attack the +2 CMod is applied).
- The DB UPDATE fires as a single `.in('id', allyIds)` — one network request, not N. Visible in the Network tab as a single row.

### Regression checks
- Wild Success: copy still says `(carries +1 next round)`.
- Failed Coordinate: feed reads "Coordination failed — no bonus applied." No DB updates fire.
- No allies in range (all out of 30ft): feed reads "No allies within Close range to receive the bonus." No DB updates.
- Coordinator's own row is skipped (no self-bonus).
- The named target's row is skipped (target doesn't help themselves get hit).

---

## Section 4 — Earlier-this-session smoke checks

These are quick re-verifies of features shipped earlier today; they touch the same code paths as the perf changes so they're worth a sanity pass:

5. **GM ⊘ Skip-this-round** — click on the active combatant's row. Verify they zero out, turn advances, and if they were the last unacted combatant, "New Round" fires. Round-tick perf path #1 should benefit this exact case.
6. **GM drag of active combatant** — drag Frankie's token while he's active. Verify 1 action consumed per drag.
7. **Character sheet UNEQUIP** — open a PC sheet, click UNEQUIP on a weapon block. Slot clears.
8. **Initiative `×` tooltips** — GM hover reads "Remove from combat"; player on own turn reads "End turn".

---

## What's NOT in this sweep (deferred)

- **C2 — Initiative Bar component extraction.** Architectural cleanup, no user-visible behavior change. Better to do as its own focused commit after this test round confirms perf wins are clean.
- **`useCallback`/`useMemo` sweep on TacticalMap & CharacterCard inline handlers.** Would reduce re-render churn on heavy children, but the wins are subtle and a botched memoization causes stale-closure bugs that are hard to find during a feature-focused test.
- **Sequential awaits inside Stabilize, Distract** — the auto-agent at 2026-04-30 10am MT is slated to triage these. Hold unless playtest forces a sooner fix.

## Pass criteria

- All Section 1–3 expected behaviors visible.
- No regressions in any of the listed regression checks.
- Network tab confirms parallel waves on the three batched paths.
- `node scripts/check-font-sizes.mjs` → OK.
- `npx tsc --noEmit` → clean.

## Rollback

`git revert 13c4866` reverts the perf sweep cleanly. Single-file change. The earlier session-ago commits (Skip button, GM drag, Unequip, × tooltip) are independent and don't need to be touched.
