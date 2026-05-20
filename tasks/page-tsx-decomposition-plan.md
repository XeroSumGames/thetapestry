# `app/stories/[id]/table/page.tsx` Decomposition Plan

> Planning artifact for Phase 3 of the pre-launch audit (see [tasks/pre-launch-audit-2026-05-17.md](pre-launch-audit-2026-05-17.md)). Produced 2026-05-17 by a Plan-subagent code-read of the 12,429-line file. This is the spec future sessions execute against. No code lands today.

**Target:** `app/stories/[id]/table/page.tsx` (12,429 lines, single React component)
**End state of Phase 3:** thin orchestrator under 500 lines composing hooks + sub-components.
**Branch baseline:** d2ba6b6. Pre-commit gates: tsc, 141+ Vitest tests, guardrails.

---

## 1. Inventory of Responsibilities

The file is one default-exported React component (`TablePage`, L215-L12413) followed by one styling helper (`hdrBtn`, L12422). Everything else lives inside that single function body. Concerns grouped by ownership with anchor line ranges.

### A. Module-scope (L1-L214)
- 24 imports (next, supabase-browser, components, lib helpers).
- 9 dynamic imports of gated modals/panels (L25-L36).
- 7 TS interfaces: `Campaign`, `TableEntry`, `GmInfo`, `RollEntry`, `WeaponContext`, `PendingRoll`, `DamageResult`, `RollResult`, `ApprenticeBond`, `InitiativeEntry`.
- 2 module constants (`MAX_PLAYER_SLOTS`, `SOCIAL_SKILLS`), 1 helper (`rollD6`).
- **~210 LOC.** Pure types + constants. Pre-extraction trivial move.

### B. Auth + session resolution + role detection (~L1183-L1326)
Inline `load()` async IIFE inside the mega-useEffect starting L1170. Calls `getCachedAuth`, resolves `myUsername`, sets `isGM` / `isThriver` (via `roleIsThriver`), loads campaign row, fires presence channel setup, kicks off `loadEntries` / `loadInitiative` / `loadRevealedNpcs` / `loadPlayerNpcCommunityMap` / `ensureCharacterStates`. Connects to `getCachedAuth` (`lib/auth-cache.ts`) for Sentry user-id attach. **~200 LOC tangled with realtime subscription wiring in the same effect.**

### C. Data loaders (L933-L1142)
- `loadEntries` (L933, ~110 LOC) - joined query for `character_states + characters + campaign_members`; sequence-guarded via `loadEntriesSeqRef`; primes `prevStressByStateIdRef`.
- `loadPlayerNpcCommunityMap` (L1046, ~35 LOC) - npc -> community-name lookup.
- `loadRevealedNpcs` (L1082, ~25 LOC) - visibility filter for non-GM viewers.
- `loadInitiative` (L1108, ~12 LOC).
- `ensureCharacterStates` (L1121, ~22 LOC) - bootstrap missing `character_states` rows.

Talks to: `character_states`, `characters`, `campaign_members`, `campaign_npcs`, `npc_relationships`, `community_members`, `initiative_order`.

### D. Realtime channel setup + handler dispatch (L1170-L1680)
The single largest concern. One `useEffect` keyed on `[id]` holds two channels: `channelRef` (main) and `initChannelRef` (broadcast bus), plus presence (L1732), npcs (L1586), members (L1357), community-members (L1345).

**30 handlers total**, already wrapped via `wrapBroadcast` / `wrapDbChange` per commit `313aa94` (`lib/sentry-realtime.ts`).

- **Broadcast events received (18):** `combat_ended`, `player_kicked`, `combat_started`, `tactical_shared`, `tactical_unshared`, `scene_activated`, `token_changed`, `turn_changed`, `turn_advance_requested`, `logs_cleared`, `npc_damaged`, `pc_damaged`, `inventory_transfer`, `pc_mortal_wound`, `pc_mortal_wound_resolved`, `lasting_damage_check_request`, `infection_check_request`, `npcs_revealed`.
- **postgres_changes (12):** `notifications` (user filter), `campaigns` (id filter), `campaign_npcs` (campaign filter), `character_states`, `campaign_members`, `initiative_order`, `npc_relationships` x2, `community_members`, `scene_tokens` x2, `tactical_scenes`.
- **Broadcast events emitted (60+ sites)** - 15 distinct event types.

Risk surface: stale-closure history L1498-L1500 (lasting_damage), L1530-L1537 (infection). `userIdRef`, `gmLikeRef`, `entriesRef`, `campaignNpcsRef`, `tacticalSharedRef` exist precisely because this effect is keyed `[id]` and the closures freeze at mount.

**~510 LOC for this effect alone.**

### E. State slices declared at top (L241-L900)
~100+ `useState` + ~40 `useRef` calls. Slice them:

- **Auth/session view-state** (L241-L357): `campaign`, `userId/Ref`, `myUsername`, `isGM`, `isThriver`, `gmLike`/`gmLikeRef`, `gmInfo`, `loading`, `entriesLoading`.
- **Entries / GM data** (L355-L630): `entries/Ref`, `selectedEntry`, `selectedVehicleId`, `rosterNpcs`, `selectedNpcIds`, restore pickers.
- **Initiative + combat** (L409-L611): `initiativeOrder`, `combatActive`, `combatRound`, `startingCombat`, plus 16 refs (`woundInfectionLoggedRef`, `pendingWoundInfectionRef`, `pendingInfectionChecksRef`, `pendingJamLogRef`, `firedLastingChecksRef`, `nextTurnInFlightRef`, `consumeActionInFlightRef`, `sprintPendingRef`, `sprintAthleticsPendingRef`, `sprintAthleticsRoundDeferredRef`, `pendingChargeRef`, `actionPreConsumedRef`, `actionCostRef`).
- **Tactical map** (L583-L626): `tacticalShared/Ref`, `showTacticalMap`, `tokenRefreshKey`, `mapTokens`, `mapTokenNpcIds`, `mapCellFeet`, `moveMode`, `throwMode`, `grenadeTargetCell`, `dropPhaseRef`, `pendingCombatantsRef`.
- **Header menus** (L259-L333): `openHeaderMenu`, `isMenuPinned` + outside-click effect.
- **Modal mount points** (L644-L850): 13 boolean flags + per-modal field state.
- **Roll pipeline** (L375-L869): `pendingRoll`, `rollResult`, `cmod`, `rolling`, `targetName`, `insightSavePrompt`, plus first-impression / group-check / grapple / coord-effort / heal refs.
- **Recruitment** (L716-L740): step machine + result.
- **Trade** (L753-L795): `tradeTarget`, `tradeCommunityData` (+ async fetch effect L759).
- **Community + apprentice** (L745-L820): membership + bond maps.
- **Feed / chat UI** (L883-L900): `feedTab`, `feedScrollEl`, `setFeedScrollContainer`, chat hook `useChatPanel` lifted here for cross-tab read.
- **Presence** (L663-L668): `presenceCount`, `onlineUserIds`.
- **Session lifecycle** (L682-L879): `sessionStatus`, `sessionCount`, `submittedPlayerNotes`, `sessionSummary`, `nextSessionNotes`, `sessionCliffhanger`, `sessionFiles`, `sessionActing`.
- **Recorder** (L678): `recorderEnabled`, `recorderToggling`, `toggleRecorder` (L290).

### F. Combat / initiative / turn management (L1777-L3146)
- `startCombat` / `confirmStartCombat` (L1777, L1795 - ~230 LOC).
- **`nextTurn` (L2023 - ~398 LOC, huge).** Owns turn-advance, round-rollover, sprint deferral, wound-infection / lasting-damage cascades intertwined.
- `consumeAction` (L2425), `handleAim` (L2502), `activateUpdate`, `clearAimIfActive`, `handleReadyWeapon`, `endCombat` (L2542), `queueWoundInfectionChecks` (L2598), `addNPC` / `addPCToCombat` / `addNpcsToCombat` / `removeFromInitiative` / `handleGrantAction` / `handleSkipTurn` / `handleInitiativeBarRemove` / `deferInitiative` (L3374).

**~1300 LOC.**

### G. Tactical map orchestration + token sync (L2700-L3270 + L9015 mutators in JSX)
- `refreshMapTokenIds`, `removeTokenFromMap`, `placeFolderOnMap`, `unmapFolderFromMap`, `placeTokenOnMap` (L2700-L2946 ~250 LOC).
- Move-mode resolver (L3148, around L3261).
- Scene tags effect (L481-L546) and refresh-key effect (L553-L567).

**~470 LOC.**

### H. Session lifecycle (L3433-L3559)
- `startSession` (L3433) - flips `session_status`, broadcasts `logs_cleared` + `combat_ended`, clears chat.
- `endSession` (L3471) - submits notes, archives, writes session summary.

**~125 LOC.**

### I. Roll resolution + cmod stacks + outcome computation (L4386-L6781)
The heaviest single block.
- Range helpers `getAutoRangeBand`, `isInRange`, `getRangeCMod` (L4386-L4416).
- `handleInsightSave` (L4417) - mortal-wound prompt resolution.
- `applySocialAction` (L4450) - Manipulation / Inspiration debuff application.
- `handleRollRequest` (L4508) - entry point. Auto-target picker (L4590-L4665).
- `maybeLogWoundInfection` (L4705).
- `saveRollToLog` (L4740).
- **`executeRoll` (L4793 - ~1850 LOC, the worst single function in the codebase).** Branches by: PC vs NPC roller, attack vs check, burst, grenade/blast, vehicle target, mortal-wound, Insight Die, infection ladder, jam ladder, sprint deferral, coordinated-effort chain logging, recruit-roll branch, grapple branch, heal branch.
- `spendInsightDie` (L6646) - reroll path; rebuilds most of executeRoll's damage/save lookups (DRY candidate).
- `closeRollModal` (L6781) - drains `pendingInfectionChecksRef`, fires pending lasting-damage modal, consumes action if combat.

**~2400 LOC across the roll pipeline.**

### J. Healing / infection / lasting damage cascades
Threaded through (F) and (I), not contiguous. Pieces: `maybeLogWoundInfection` (L4705), end-of-combat queue (L2598), broadcast handler (L1522-L1545); lasting damage broadcast handler (L1487-L1521), `firedLastingChecksRef` dedup (L441); heal modal `triggerHeal` (L4254) + post-roll application inside `executeRoll`.

### K. Vehicles + passenger system
Mostly delegated to `VehicleCard`. Page-level: `selectedVehicleId` + effect (L367-L374), vehicle target branch inside `executeRoll` (~L5424), passenger inventory-give plumbing buried in `executeRoll`.

### L. Modal mount points + their local handlers (L7000-L12410)
- **Header** (L6979-L7100): session controls, recorder toggle, tactical/campaign toggle, dropdown menus via `renderHeaderMenu` (L6903).
- **Center grid** (L7100-L9700): InitiativeBar (L7358), tactical/campaign map switch (L8155, L8180), NPC roster panel, GM sidebar tabs, character sheet inline overlay.
- **Right rail** (L9700-L10000): rolls + chat feed.
- **Modal stack** (L10000-L12410, ~2400 LOC of JSX): LootModal (L10042), CdpModal (L10325), PopulateModal / AdvanceTimeModal / ReadyWeaponModal (L10500-L10900), QuickAddModal mount (L10772), CampaignCommunity overlay (L10801), EndSession modal, RestorePicker / ReloadPicker (L11150-L11500), GrappleModal (L11329 with equip/unequip/reload/unjam handlers L11151-L11328 inside), SpecialCheck modal (L11500-L11960), Recruit wizard (L11960-L12150), ApprenticeCreationWizard mount (L12146), TradeNegotiationModal mount (L12197), InsightSavePrompt modal (L12350).

### M. Misc effects
- Tab-visibility refetch (L1681-L1730).
- BroadcastChannel for cross-tab (L1732-L1742).
- ESC key handler (L1744-L1755).
- localStorage sync for `showTacticalMap` (L471-L474).
- Mode-aware sidebar default (L575-L582).
- `prevStressByStateIdRef` 5-WP threshold detector.

### N. Misc render helpers
- `getInitials`, `getCharPhoto` (L6883-L6889).
- `renderHeaderMenu` IIFE (L6903).
- Inline `playerEntries` IIFE (L6963).

---

## 2. Proposed Extraction Boundaries

Naming convention: hooks under `app/stories/[id]/table/hooks/`; sub-components under `app/stories/[id]/table/components/`; pure logic into `lib/`.

### Hooks

- **`useTableAuth(campaignId)`** -> `{ userId, myUsername, isGM, isThriver, gmLike, campaign, loading }`. Wraps load() IIFE's auth + campaign fetch. Owns `userIdRef` + `gmLikeRef` internally; exposes them via getter so realtime hook can pass them in.

- **`useCampaignState(campaignId, userId, gmLike)`** -> `{ entries, gmInfo, entriesLoading, campaignNpcs, rosterNpcs, revealedNpcs, pcCommunityMemberships, apprenticeBondsByNpcId, playerNpcCommunityMap, refetch }`. Owns `loadEntries`, `loadRevealedNpcs`, `loadPlayerNpcCommunityMap`, `ensureCharacterStates`, the prev-stress threshold map, and the sequence guard. Returns refs for entries / campaignNpcs so handlers can read fresh.

- **`useTableRealtime(campaignId, deps)`** -> mostly side-effect, exposing channel refs and presence state:
  ```ts
  useTableRealtime({
    campaignId, userIdRef, gmLikeRef, entriesRef, campaignNpcsRef,
    tacticalSharedRef, onTurnChanged, onCombatStarted, onCombatEnded,
    onTokenChanged, onLogsCleared, onPcDamaged, onNpcDamaged,
    onPcMortalWound, onLastingDamageCheck, onInfectionCheck, ...
  }) => { channelRef, initChannelRef, presenceCount, onlineUserIds }
  ```
  Single highest-LOC extraction (~510 LOC). All 30 handlers move in, still wrapped via `wrapBroadcast` / `wrapDbChange`. Each `on...` callback prop wrapped via `useStableCallback` so subscription stays stable.

- **`useInitiative(campaignId, deps)`** -> initiative + combat surface: `{ initiativeOrder, combatActive, combatRound, startCombat, confirmStartCombat, nextTurn, endCombat, addNPC, addPCToCombat, addNpcsToCombat, removeFromInitiative, handleGrantAction, handleSkipTurn, handleInitiativeBarRemove, deferInitiative, consumeAction, handleAim, handleReadyWeapon, clearAimIfActive }` plus round-state refs (`nextTurnInFlightRef`, `sprint*Ref`, `pendingChargeRef`). Fat (~1300 LOC). Pulls in `initChannelRef.send` as a `broadcast(event, payload)` callback.

- **`useTacticalSync(campaignId, deps)`** -> `{ mapTokens, mapTokenNpcIds, mapCellFeet, tokenRefreshKey, refreshMapTokenIds, placeTokenOnMap, removeTokenFromMap, placeFolderOnMap, unmapFolderFromMap, throwMode, setThrowMode, grenadeTargetCell, moveMode, setMoveMode, entrySceneTags, showTacticalMap, setShowTacticalMap, tacticalShared, setTacticalShared }`.

- **`useRollResolution(deps)`** -> `{ pendingRoll, rollResult, cmod, rolling, targetName, insightSavePrompt, handleRollRequest, executeRoll, spendInsightDie, closeRollModal, handleInsightSave, saveRollToLog }`. **Riskiest extraction** - `executeRoll` reads dozens of state values. Strategy: pass the giant slice via a single `RollContext` arg object rather than 40 closure deps.

- **`useSessionLifecycle(campaignId, deps)`** -> `{ sessionStatus, sessionCount, startSession, endSession, sessionSummary, setSessionSummary, ... }`.

- **`useHeaderMenus()`** -> `{ openHeaderMenu, setOpenHeaderMenu, isMenuPinned, setIsMenuPinned }` + outside-click effect. Smallest, fully leaf.

- **`useRecorderToggle()`** -> `{ recorderEnabled, recorderToggling, toggleRecorder }`. Leaf.

- **`useRecruitFlow(deps)`** -> all recruit step state + flow functions.

- **`useTradeTarget(supabase, id)`** -> `{ tradeTarget, setTradeTarget, tradeCommunityData }`. Wraps the L759 fetch effect.

- **`useSpecialChecks(deps)`** -> `triggerPerceptionCheck`, `triggerGutInstinct`, `triggerFirstImpression`, `triggerGroupCheck`, `triggerHeal`, `triggerCoordinatedEffort`, `endCoordinatedEffort`, `withdrawFromCoordinatedEffort`, `startSpecialCheck*`, `shortCircuitForSpecialCheck`.

- **`useGmTools(deps)`** -> loot, cdp, populate, advance-time, reload-snapshot, restore-picker handlers + state.

### Sub-components

- **`<TableHeader>`** - header bar + recorder + session/tactical toggles. L6979-L7100.
- **`<TableHeaderMenu>`** - generic dropdown extracted from `renderHeaderMenu` (L6903).
- **`<InitiativeStrip>`** - wraps existing `<InitiativeBar/>` mount + surrounding Stabilize / Treat / action buttons (L7400-L8100).
- **`<TacticalRegion>`** - switches between `<TacticalMap/>` and `<CampaignMap/>` on `showTacticalMap`; throwMode / moveMode plumbing.
- **`<GmSidebar>`** - four-tab GM sidebar (Pins / NPCs / Assets / Notes), L7950-L9500. Big-but-leafy.
- **`<FeedColumn>`** - right-rail feed: tab selector + virtualized chat + rolls.
- **`<RollResolverModals>`** - wraps `<RollModal/>` + GrappleModal + InsightSavePrompt + ReadyWeaponModal.
- **`<SpecialCheckModal>`** - all 7 special-check variants currently as one inline switch.
- **`<RecruitWizard>`** - L11960-L12150.
- **`<GmModalStack>`** - Loot, Cdp, Populate, AdvanceTime, RestorePicker, ReloadPicker, EndSession. L10042-L10900. Wires to `useGmTools`.
- **`<TableMainGrid>`** - composes `<InitiativeStrip>`, `<TacticalRegion>`, `<GmSidebar>`, `<FeedColumn>`, character-sheet inline overlay.

### Lib modules

- **`lib/table-roll-context.ts`** - pure helpers extracted from `executeRoll`'s 1850 LOC: auto-target picker, range/CMod stacker, mortal-wound math, infection ladder math, blast-radius cell enumeration, vehicle-target branch logic. Goal: shrink `executeRoll` body by inlining calls to pure helpers.
- **`lib/initiative-engine.ts`** - pure: turn-advance order computation, round-rollover detection, sprint deferral logic, action-cost arithmetic. Hook stays side-effect site; engine is testable.
- **`lib/table-broadcasts.ts`** - typed event union + helper `broadcast(channel, event, payload)`. Centralizes 60+ emission sites.
- **`lib/table-loaders.ts`** - pure-ish supabase loaders.

### Providers (optional, only if hook fan-out gets ugly)

- **`<TableSessionContext>`** - `{ campaign, userId, gmLike, supabase, channelRefs, broadcast }`. Used by leaf modals to avoid drilling 8 props deep. Add only if a real prop-drill problem emerges around step 6. **Default: don't add it yet.**

---

## 3. Sequencing Plan

Ordering principle: leaves first (low coupling × high LOC removed), trunk last. Each step lands as one PR; file shrinks monotonically. Pre-commit hook (tsc + tests) is the floor gate.

### Phase 3.0 - Prep (1 session)
1. **Move types + module constants** to `app/stories/[id]/table/types.ts`. -200 LOC. Zero risk.
2. **Extract `<TableHeaderMenu>`** and outside-click effect into `useHeaderMenus`. -90 LOC. Pure leaf.
3. **Extract `useRecorderToggle`.** -30 LOC. Pure leaf.
4. **Centralize broadcast emissions** through `lib/table-broadcasts.ts` (mechanical rename of 60+ sites). 0 net LOC but unlocks the realtime hook's typed callback surface.

Gate: tsc + tests + manual click of recorder toggle + header menus.

### Phase 3.1 - Leaf modal extractions (2 sessions)
5. **Extract `useGmTools` + `<GmModalStack>`** (Loot, Cdp, Populate, AdvanceTime, RestorePicker, ReloadPicker, EndSession). -1500 LOC.
6. **Extract `<SpecialCheckModal>`** + seven `trigger*` functions into `useSpecialChecks`. -600 LOC. Couples to `handleRollRequest` via callback prop.
7. **Extract `<RecruitWizard>` + `useRecruitFlow`.** -400 LOC.
8. **Extract `useTradeTarget` + push `<TradeNegotiationModal>` + apprentice wizard mounts into `<TableMainGrid>`.** -150 LOC.

Gate per step: tsc + tests + manual: open modal, run happy path, confirm cross-tab broadcast still fires.

### Phase 3.2 - Render extractions (2 sessions)
9. **Extract `<TableHeader>`.** -250 LOC.
10. **Extract `<FeedColumn>`** (rolls + chat + virtualization). -350 LOC. **Keep `useChatPanel` at page level** (the Both-tab merged feed needs it); pass `chat` down as prop.
11. **Extract `<GmSidebar>` (4 tabs).** -1800 LOC. Biggest single render extraction. Internally each tab can be its own sub-component.

Gate per step: tsc + tests + manual: click every tab, every header button, every right-rail tab. Re-run a session with chat + rolls + feed clear.

### Phase 3.3 - Tactical + initiative (2 sessions)
12. **Extract `useTacticalSync` + `<TacticalRegion>`.** -700 LOC. Trickier: throwMode/moveMode/grenadeTargetCell cross-cut into `handleRollRequest`. Strategy: pass as a `tacticalIntent` object the roll hook reads.
13. **Extract `useInitiative` + `<InitiativeStrip>`.** -1300 LOC. `nextTurn`'s sprint deferral interacts with rolls - pass `sprintAthleticsPendingRef` / `sprintAthleticsRoundDeferredRef` via deps object. **Ship alone.**

Gate per step: full combat smoke - start combat, take a turn each (PC + NPC), aim, ready weapon, sprint, charge, grenade, mortal-wound a PC, end combat, verify wound-infection queue fires.

### Phase 3.4 - Roll pipeline (2 sessions, riskiest)
14. **Extract pure helpers from `executeRoll` into `lib/table-roll-context.ts`** WITHOUT moving the function. Tests added for: auto-target picker, range CMod stacker, infection ladder math, blast-cell enumeration, mortal-wound math. -300 LOC and a safety net.
15. **Extract `useRollResolution`** (executeRoll + spendInsightDie + closeRollModal + handleRollRequest + handleInsightSave + saveRollToLog). -2400 LOC. **Single biggest move + highest regression risk.** See Risk Register.

Gate: full roll smokes - normal attack, attack with Insight Die (3d6), attack with +3 CMod Insight, burst, grenade against cell, grenade against cell with friendlies, vehicle target, PC mortal wound + Insight save accept, PC mortal wound decline, NPC infection-check end-of-combat queue, recruit roll with reroll, grapple with insight, heal with kit, coordinated-effort lead + follow + withdraw + end.

### Phase 3.5 - Data + auth + realtime (1 session)
16. **Extract `useTableAuth` and `useCampaignState`.** -600 LOC.
17. **Extract `useTableRealtime`** (the 510-LOC mega-effect). **Last** because every prior step has been tightening the callback surface so this hook's prop list is final.

Gate: full session smoke (start, multi-player join, combat round, end). Cross-tab broadcast smoke. Verify Sentry traces still tag user-id.

### Phase 3.6 - Polish (0.5 session)
18. **Compose `<TableMainGrid>`**, prune now-unused state at page level, verify final page.tsx is the orchestrator.

**End state shape:**
```tsx
export default function TablePage() {
  const { id } = useParams() as { id: string }
  const auth = useTableAuth(id)
  const data = useCampaignState(id, auth)
  const realtime = useTableRealtime(id, { auth, data, ... })
  const tactical = useTacticalSync(id, ...)
  const initiative = useInitiative(id, ...)
  const rolls = useRollResolution({ auth, data, tactical, initiative, realtime })
  const session = useSessionLifecycle(id, ...)
  const recruit = useRecruitFlow(...)
  const specials = useSpecialChecks({ rolls, ... })
  const gmTools = useGmTools(...)

  if (auth.loading) return <Spinner/>
  return (
    <div className="table-shell">
      <TableHeader {...} />
      <TableMainGrid {...} />
      <GmModalStack {...} />
      <RecruitWizard {...} />
      <SpecialCheckModal {...} />
      <RollResolverModals {...} />
      <TradeNegotiationModal ... />
      <ApprenticeCreationWizard ... />
    </div>
  )
}
```

### Leaf vs trunk classification

| Extraction | Class | Note |
|---|---|---|
| Types/constants | leaf | - |
| useHeaderMenus | leaf | - |
| useRecorderToggle | leaf | - |
| broadcasts helper | leaf | unlocks useTableRealtime |
| useGmTools / GmModalStack | leaf | needs broadcasts |
| Special checks | leaf | needs handleRollRequest as prop |
| Recruit / Trade / Apprentice | leaf | - |
| TableHeader | leaf | - |
| FeedColumn | leaf | - |
| GmSidebar | leaf | - |
| TacticalRegion | trunk | feeds rolls (throwMode) |
| Initiative | trunk | feeds rolls (sprint refs) |
| RollResolution | trunk | depends on tactical + initiative |
| TableAuth / CampaignState | trunk | feeds everything |
| TableRealtime | trunk | last - depends on all callback consumers being stable |

---

## 4. Safety Gates Per Extraction

**Universal gates (all extractions):**
- `npx tsc --noEmit` clean.
- Pre-commit hook passes (guardrails + tsc + Vitest).
- Page builds without console error on mount.
- `git diff --stat` shows page.tsx LOC shrinking by expected amount ± 10 LOC.

**Per-extraction manual smoke matrix:**

| Step | Smoke |
|---|---|
| 1 (types) | Mount as GM. Mount as player. |
| 2 (header menus) | Click each header dropdown. Click outside; ESC. Hover-then-click pin behavior. |
| 3 (recorder) | Toggle ON: buffer wipe. Toggle OFF: auto-download. Refresh mid-recording, stays ON. |
| 4 (broadcasts) | Two tabs as GM + player. Toggle tactical share → both flip. Clear logs → both clear. |
| 5 (GM modals) | Open each. Loot grant updates recipients. CDP grant updates XP. Populate 5 NPCs updates roster. Advance Time 1h on encumbered PC: RP -1. Restore picker: damaged tokens visible. Reload snapshot: state restored. End Session: archives + summary written. |
| 6 (special checks) | Run each of 7 special checks. Group check with 3 PCs: all rolls fire. Coord effort lead → follow → withdraw → cmod retcon on chained rows. |
| 7 (recruit) | Cohort approach success: community_members inserted. Reroll a die: log row patched. Apprentice toggle on success: bond row inserted. |
| 8 (trade) | Trade with NPC: inventory exchanges. Trade with community: stockpile updates + leader Barter applied. |
| 9 (TableHeader) | Start/end session. Tactical/Campaign toggle. Header height unchanged. |
| 10 (FeedColumn) | Switch tabs Rolls / Chat / Both. Send chat. Scroll to top → load older. Clear logs → feed empties. Virtuoso position survives a roll. |
| 11 (GmSidebar) | Each tab loads. Drag-resize sidebar works. Notes editor saves. Assets folder open/close persists. |
| 12 (TacticalSync) | Place token. Move token. Switch scenes. Throw grenade → cell-click → blast resolves. Cross-scene chip on initiative bar updates when token moves between scenes. |
| 13 (Initiative) | Full combat round PC + NPC. Aim → +2 CMod next attack. Ready Weapon. Sprint → 2 actions + Athletics roll + initiative reroll order. Charge. Defer initiative. End combat → wound-infection queue end-to-end. |
| 14 (roll helpers) | All step-15 smokes pass - dress rehearsal. |
| 15 (RollResolution) | **Full roll smoke matrix above.** Highest-risk gate. |
| 16 (Auth + CampaignState) | Login as GM, Thriver, player, kicked player. Stress threshold modal fires on <5→5 transition. |
| 17 (TableRealtime) | Two tabs cross-tab smoke: every event from the emit list. Sentry breadcrumbs still tag user_id. Tab visibility refetch on background-return. |

---

## 5. Risk Register

Ranked highest to lowest regression risk.

### R1 - `useRollResolution` extraction (Phase 3.4)
- `executeRoll` is 1850 LOC, branches on ~12 dimensions, reads 30+ state values, writes to 8 tables, emits 7 different broadcasts.
- **Stale-closure landmines:** L1498-L1500 (lasting_damage) and L1530-L1537 (infection) document past bugs. Both went stale because the listener captured pre-load state. ANY hook extraction that re-creates closures has the same risk if `useStableCallback` discipline slips.
- **Re-entry guards** (`nextTurnInFlightRef`, `consumeActionInFlightRef`, `rollExecutedRef`) survive React batching by being refs. Moving them into hooks is fine ONLY if the ref identity is created once at hook mount - confirm via `useRef`-in-the-hook, never `useState`.
- **Mitigation:** step 14 (extract pure helpers + add unit tests) MUST land before step 15. At minimum:
  - auto-target picker tests
  - mortal-wound branch tests
  - infection ladder math tests
  - sprint deferral order tests
  - coordinated-effort retcon math tests

### R2 - `useTableRealtime` extraction (Phase 3.5)
- 30 handlers, all closure-sensitive.
- `userIdRef` / `gmLikeRef` / `entriesRef` / `campaignNpcsRef` / `tacticalSharedRef` exist BECAUSE the channel is registered once. If the hook resubscribes on dep change (e.g. accidentally adding `entries` to its deps array), channel will repeatedly tear down + recreate, breaking `tactical_shared` open-state and double-firing `turn_changed` echoes.
- **Mitigation:** hook deps array MUST be `[campaignId]` only. All other consumers pass via stable refs or stable callbacks. Add a console.warn in cleanup for duration of step 17 to catch surprise resubscriptions.

### R3 - `useInitiative` extraction (Phase 3.3 step 13)
- `nextTurn`'s sprint deferral + new-round detection is the second-most tangled function. `sprintAthleticsPendingRef` / `sprintAthleticsRoundDeferredRef` (L610-L611) load-bearing for log ordering.
- `consumeActionInFlightRef` Set-based per-entry lock (L381) prevents double-decrement races. If extracted incorrectly (e.g. one ref shared across hook instances), Aim spam will burn 2 actions.
- **Mitigation:** keep all turn-flow refs co-located in the hook; expose only setter functions, never the refs themselves.

### R4 - `useTacticalSync` extraction (Phase 3.3 step 12)
- `throwMode` / `grenadeTargetCell` are read by `executeRoll`; `moveMode` is read by the click-handler that fires on tactical cell click. Dependency direction is tactical → rolls, but click handler bridges them.
- Active-combatant cell-reset effect (L623-L626) has explicit `EXCEPTION` carve-out for sprint/charge. Easy to drop on extraction.
- **Mitigation:** preserve the carve-out comment verbatim. Add a guard test.

### R5 - Broadcast centralization (Phase 3.0 step 4)
- 60+ rename sites. A single missed site won't typecheck (the new helper has a typed event union), but a refactor that silently changes payload shape will.
- **Mitigation:** pre-step grep audit: list every distinct event + payload shape. The helper type-unions cover all 15 distinct events.

### R6 - `firedLastingChecksRef` lifetime (Phase 3.3)
- Documented at L436-L441: prevents re-firing the lasting-damage modal on every `loadEntries` refresh while DB flag stays true. If moved to a hook that remounts (key change), modal will re-spam.
- **Mitigation:** keep in hook with `[]` mount-deps, never `[id]`.

### R7 - `useChatPanel` lifting (Phase 3.2 step 10)
- Currently lifted to page level (L897) so Both-tab can read merged `chat.messages` alongside rolls. If pushed inside `<FeedColumn>` naively, merged-feed path breaks.
- **Mitigation:** keep `useChatPanel` at the page level and pass `chat` into FeedColumn as a prop.

### R8 - `presence` channel teardown (Phase 3.5)
- Presence channel is separate from broadcast channel. Cleanup is in the same useEffect at L1655. Moving them to different hooks means cleanup order changes - verify presence-leave still fires before broadcast channel close.

---

## 6. Estimated Session Count

| Phase | Sessions |
|---|---|
| 3.0 Prep (types, header menus, recorder, broadcasts helper) | 1 |
| 3.1 Leaf modal extractions (GmTools, Specials, Recruit, Trade) | 2 |
| 3.2 Render extractions (Header, Feed, GmSidebar) | 2 |
| 3.3 Tactical + Initiative | 2 |
| 3.4 Roll pipeline (helpers + tests, then hook) | 2 |
| 3.5 Auth + CampaignState + TableRealtime | 1 |
| 3.6 Compose + polish | 0.5 |
| **Total** | **~10.5 sessions** |

Add a 30% buffer for the roll-pipeline and realtime extractions (R1, R2) - call it **12-14 sessions** end-to-end, with two of those sessions reserved as "no-new-extraction, only fix regressions surfaced by the matrix smokes."

---

## Critical Files for Implementation

- `app/stories/[id]/table/page.tsx`
- `lib/sentry-realtime.ts`
- `lib/auth-cache.ts`
- `lib/useStableCallback.ts`
- `components/RollModal.tsx`
