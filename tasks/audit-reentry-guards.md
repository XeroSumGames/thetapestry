# Audit: Re-Entry Guard Refs in the Table Page

Closes Phase P2 / A2.4 of `tasks/puffer-fish-platform-plan.md`. Read-only audit of the re-entry guard refs scattered across `app/stories/[id]/table/page.tsx`. Lists each guard, its scope, its reset condition, and the failure mode if it leaks. Companion to the decomposition plan's R1 risk (stale-closure landmines).

**Audience:** the hunt-and-peck chat (for context when working on the table page) + puffer-fish chats running future stability audits.

**Status:** AUDIT 2026-05-20. Read-only - no code changes proposed here. Findings drive future hunt-and-peck work IF action is needed.

---

## 1. Why this audit matters

The table page coordinates: realtime echoes, optimistic local updates, React batching, user double-clicks, browser-tab focus reentry, and cross-tab broadcasts. Each can race the others. Re-entry guards (refs that hold an "in-flight" or "already-fired" flag) are the protection layer.

If a guard's reset condition is wrong:
- **Never resets (sticky true):** the feature it protects stops working. Combat advance hangs, action consumption stops decrementing, etc.
- **Resets too eagerly:** races slip through. Double-decrement, double-fire, missed combatants.
- **Wrong scope:** guards meant per-combat live too long; guards meant per-roll live too short.

Documented incidents that drove the existing guards (per inline comments):
- Aim button hit twice fast burning two actions instead of one (`consumeActionInFlightRef`).
- Realtime turn-changed echo + optimistic `nextTurn()` both fired, silently skipping a combatant (`nextTurnInFlightRef`).
- Lasting Damage modal re-spammed every `loadEntries` refresh while DB flag stayed pending (`firedLastingChecksRef`).
- Wound Infection warning duplicated across reload mid-combat (`woundInfectionLoggedRef` + DB cross-check).

These are real bugs that real users hit. The audit's purpose is to make sure the guards are documented + sound enough to survive the upcoming decomposition.

---

## 2. Inventory

19 guard-like refs in the table page. Categorized by purpose.

### Category A: "In-flight" locks (prevent double-fire)

| # | Ref | Line | Type | Prevents |
|---|---|---|---|---|
| A1 | `npcFetchInFlightRef` | 118 | `useRef(false)` | Suppress realtime callback during manual NPC re-fetch (avoid feedback loop). |
| A2 | `rollExecutedRef` | 290 | `useRef(false)` | `executeRoll` vs `closeRollModal` coordination - refs survive React batching. |
| A3 | `nextTurnInFlightRef` | 291 | `useRef(false)` | Re-entry guard for `nextTurn` - prevents races where realtime echo + optimistic call both advance, silently skipping a combatant. |
| A4 | `consumeActionInFlightRef` | 292 | `useRef<Set<string>>(new Set())` | **Per-entry** lock for `consumeAction` - prevents double-click races from decrementing `actions_remaining` twice. Set holds initiative entry IDs. |

### Category B: Sequence guards (newest-wins for async loaders)

| # | Ref | Line | Type | Prevents |
|---|---|---|---|---|
| B1 | `loadEntriesSeqRef` | 123 | `useRef(0)` | Sequence guard - newer `loadEntries` call wins if results return out of order. |
| B2 | `loadInitSeqRef` | 124 | `useRef(0)` | Same pattern for `loadInitiative`. |

### Category C: Dedup Sets (fire-once-per-key flags)

| # | Ref | Line | Type | Prevents |
|---|---|---|---|---|
| C1 | `woundInfectionLoggedRef` | 328 | `useRef<Set<string>>(new Set())` | First-wound-of-combat reminder fires once per character per combat. Cross-checked against rollsFeed at emit time to also dedup across reload-mid-combat. |
| C2 | `firedLastingChecksRef` | 352 | `useRef<Set<string>>(new Set())` | Tracks character_states / campaign_npc rows whose Lasting Damage Check modal has already auto-opened. Prevents `loadEntries` refresh from re-firing the modal while DB pending flag stays true. |

### Category D: Pending-work queues (drain at known points)

| # | Ref | Line | Type | Drained when |
|---|---|---|---|---|
| D1 | `pendingWoundInfectionRef` | 334 | `useRef<Set<string>>(new Set())` | Per-roll queue of target names that took a wound. Drained AFTER `saveRollToLog` finishes the attack row, so the warning's `created_at` strictly follows the attack's. |
| D2 | `pendingInfectionChecksRef` | 340 | `useRef<Array<{name, amod}>>([])` | End-of-combat queue of Infection Check rolls. Drained by `closeRollModal` as each roll resolves. |
| D3 | `pendingJamLogRef` | 345 | `useRef<string \| null>(null)` | Per-roll weapon-malfunction log. Drained AFTER `saveRollToLog`. |
| D4 | `pendingChargeRef` | 289 | `useRef<{...} \| null>(null)` | Mid-flight Charge action's roll context. |
| D5 | `pendingCombatantsRef` | 509 | `useRef<any[]>([])` | Mid-flight combat-start combatant list (used during drop phase). |
| D6 | `groupCheckPayloadRef` | 754 | `useRef<{...} \| null>(null)` | Group Check participants + skill, set when the modal opens, read when each participant's roll fires. |
| D7 | `healPendingRef` | 789 | `useRef<{...} \| null>(null)` | Heal modal's target + kit context. |
| D8 | `coordEffortRef` | 801 | `useRef<{...} \| null>(null)` | Active Coordinated Effort chain state (participants, leadCmod, chainId, isActive flag). |

### Category E: Phase / mode flags

| # | Ref | Line | Type | Purpose |
|---|---|---|---|---|
| E1 | `actionPreConsumedRef` | 287 | `useRef(false)` | Set when Sprint/Unjam pre-consumes action BEFORE the roll modal opens. Read on modal close to skip double-consume. **Note: Stabilize + Distract migrated off this pattern on 2026-05-20 (cleaner: consume action in onRoll synchronously).** |
| E2 | `actionCostRef` | 288 | `useRef(1)` | Action cost for the current roll (2 for Charge / Rapid Fire). |
| E3 | `dropPhaseRef` | 508 | `useRef(false)` | Set during the combat-start "drop" sub-phase. |
| E4 | `sprintPendingRef` | 513 | `useRef(false)` | Sprint roll's initiative re-roll deferral flag. |
| E5 | `sprintAthleticsPendingRef` | 521 | `useRef(false)` | Sprint-Athletics-after-Sprint deferral. |
| E6 | `sprintAthleticsRoundDeferredRef` | 522 | `useRef(false)` | Sprint Athletics rolled THIS round; deferred to next round. |
| E7 | `stressWatchPrimedRef` | 218 | `useRef(false)` | Watcher for stress 4 -> 5 threshold; primed once the prev-stress map is loaded. |
| E8 | `tacticalSharedRef` | 499 | `useRef(false)` | Mirror of `showTacticalMap` state, for use inside realtime handlers (state-from-closure-freeze guard). |
| E9 | `coordinateTargetRef` | 510 | `useRef<string \| null>(null)` | Selected target during the Coordinate special action. |
| E10 | `playerFolderStateLoadedRef` | 3674 | `useRef(false)` | One-shot flag for the player NPC folder state localStorage load. |
| E11 | `playerFolderOrderLoadedRef` | 3703 | `useRef(false)` | One-shot flag for the player NPC folder order localStorage load. |

### Category F: State-from-closure-freeze refs (not strictly re-entry guards)

These exist because the realtime channel registers once on `[id]` and the closures freeze at mount. They're mutated alongside state so the latest value is available inside the long-lived handlers.

| # | Ref | Line | Mirrors |
|---|---|---|---|
| F1 | `userIdRef` | 128 | `userId` state |
| F2 | `gmLikeRef` | 136 | `gmLike` state |
| F3 | `entriesRef` | 137 | `entries` state |
| F4 | `campaignNpcsRef` | 138 | `campaignNpcs` state |
| F5 | `myCharIdRef` | 121 | computed: PC's character ID |
| F6 | `tacticalSharedRef` | 499 | `showTacticalMap` state (also listed in E8) |
| F7 | `prevStressByStateIdRef` | 214 | derived: stress values by state ID, for threshold detection |

These are NOT re-entry guards in the strict sense, but they're closure-related refs and are flagged here because the decomposition plan's R1 risk includes "stale-closure landmines." Confirming their reset conditions (i.e., their mutation discipline alongside state) is part of any hook extraction.

---

## 3. Reset-condition risk assessment

The guards above are categorized by reset-condition health. **Healthy** = clear documentation + clear reset point; **Watch** = reset condition is implicit or scattered; **Risk** = reset condition is fragile or undocumented.

### Healthy (no action needed)

- **A4 `consumeActionInFlightRef`** - Set-based per-entry lock. Reset by removing the entry's ID from the Set in the `finally` of `consumeAction`. Inline comment is clear. Pattern is correct.
- **B1 / B2 `loadEntriesSeqRef` / `loadInitSeqRef`** - sequence numbers, incremented at call start, compared at result merge. Standard newest-wins pattern. Inline comment present.
- **C1 `woundInfectionLoggedRef`** - reset on `combatActive` flipping true (L356-L358). Comment explains. Plus a cross-check against rollsFeed for the reload-mid-combat case. Tight.
- **C2 `firedLastingChecksRef`** - "Cleared on page navigation away (the ref dies with the component)." Lifecycle-bound. Correct.
- **D1 / D3 `pendingWoundInfectionRef` / `pendingJamLogRef`** - drained AFTER `saveRollToLog`. Inline comment names the drain point. Pattern is correct.
- **D2 `pendingInfectionChecksRef`** - populated by `endCombat`, drained by `closeRollModal`. Two endpoints, both documented.

### Watch (reset condition correct but scattered; document or co-locate)

- **A3 `nextTurnInFlightRef`** - inline comment names the failure mode but not the reset point. Verify: where does it flip back to false? Likely a `finally` in `nextTurn` itself. **Recommended action:** add a comment on the reset line confirming "flipped to false in nextTurn's finally" so the next reader doesn't have to grep.
- **A2 `rollExecutedRef`** - "Set in executeRoll, read in closeRollModal." Two endpoints but the reset point isn't named in the comment. Verify reset happens at modal open OR roll initiation, not just modal close.
- **E1 `actionPreConsumedRef`** - shipped years ago with multiple users (Sprint, Unjam pre-consume). Note: Stabilize + Distract MOVED OFF this pattern 2026-05-20 (commits `2255ced`, `54dec35`). **Recommended action:** verify Sprint + Unjam are the only remaining consumers; if so, document the migration path for them in a follow-up Tech Debt entry.
- **E4 / E5 / E6 sprint refs** - three closely-related refs for sprint mechanics. The decomposition plan's R3 risk explicitly calls out "sprintAthleticsPendingRef / sprintAthleticsRoundDeferredRef are load-bearing for log ordering." Reset conditions are within `nextTurn`'s sprint branch. **Recommended action:** at Phase 3.3 extraction time, co-locate all sprint refs inside `useInitiative` with shared comment documenting the round-flow.

### Risk (reset condition fragile, undocumented, or surfaced bugs in the past)

None today. The 2 documented past-bug refs (C1 / C2) both have explicit fix comments and have not regressed in months.

The closest "almost-risk" is the cluster of **D6 / D7 / D8** (group check / heal / coord effort). Each is a single-pending-context ref (only one active at a time). If two such flows could overlap (e.g., a heal modal opens during an active Coord Effort chain), the latter-arriving payload would clobber the earlier. **Recommended action:** confirm via inline comment that these flows are mutually exclusive by design + the modal-open guards prevent overlap.

---

## 4. Recommended actions (none are launch-blockers)

Priority order:

1. **(Low) Document the reset point for A3 / A2 inline.** 30-second comment additions. No semantic change.
2. **(Low) Confirm D6 / D7 / D8 are mutually exclusive by design.** Add an inline comment noting "only one X active at a time, modal-open guard prevents overlap."
3. **(Medium) When E1 `actionPreConsumedRef` migrates off Sprint + Unjam (same pattern as Stabilize + Distract), retire the ref entirely.** Tech Debt Ledger follow-up. Same hunt-and-peck session that does Sprint migration to dedicated `<RollModal>`.
4. **(Medium) When Phase 3.3 of the decomposition extracts `useInitiative`, co-locate ALL sprint refs (E4 / E5 / E6 + nextTurnInFlightRef A3) inside the hook.** Per the plan's R3 mitigation: "keep all turn-flow refs co-located in the hook; expose only setter functions, never the refs themselves." This is the audit's reinforcement of that.
5. **(Medium) When Phase 3.5 extracts `useTableRealtime`, the closure-state-mirror refs (F1-F7) need an audit pass.** The hook's dep array must be `[id]` only; mirrors are written via `useEffect` outside the realtime hook. The plan's R2 mitigation names this.

---

## 5. Test coverage

Today none of the re-entry guards are unit-tested directly. Component tests + integration tests don't exist (covered by axis A6 in the platform plan).

When component-test infrastructure lands (per Phase P7 of the platform plan), the high-value targets for re-entry-guard testing are:

- A4 `consumeActionInFlightRef` (the Set-based per-entry lock) - test that 10 simultaneous `consumeAction` calls for the same entry result in exactly 1 decrement.
- A3 `nextTurnInFlightRef` - test that simultaneous `nextTurn()` calls advance exactly once.
- C1 `woundInfectionLoggedRef` - test that the warning fires once even on reload-mid-combat.

Until then, these guards rely on the playtest cadence for regression detection.

---

## 6. Maintenance

Update this audit when:
- A new re-entry guard is added to the table page - append a row to section 2.
- A guard's reset condition changes - update section 3.
- A documented incident exposes a guard bug - log the incident + update the risk assessment.
- The table-page decomposition extracts guards into hooks - update line numbers (or note they've moved out of the file).

Archive when: ALL guards have inline-documented reset conditions + corresponding unit tests, OR the table page decomposes to the point that the guards live in their typed hooks (`useInitiative`, `useRolls`, etc.) and the audit is no longer file-scoped.
