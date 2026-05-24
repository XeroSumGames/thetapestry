# Stage C - Client-state layer: design

**Status: DESIGN (puffer-fish, 2026-05-24). The tool-split + sequencing calls are mine and LOCKED; the BUILD is gated on Phase 7 GREEN. This is the move flagged for a human-architect second opinion before C3 (bulk propagation) - the design is written now so that review has something concrete.** Grounded in a verified read-only audit of all 6 god-components (cross-component prop-drill finding spot-checked against `page.tsx`).

## Why Stage C exists
The seams (`lib/data/*`, `lib/realtime/*`) are done - all 6 god-components use them. What's missing is a **client-state layer**: state lives as per-component `useState` + load-on-mount effects, so route components own fetch+cache+realtime-wiring+orchestration+render. That's why `page.tsx` is 10,529 LOC. Stage C gives orchestration a home so the components shrink STRUCTURALLY, not by willpower against the LOC ratchet.

## Verified groundwork (the numbers that drive the design)

| Component | LOC | useState | server-derived | orchestration | fully seamed? |
|---|---|---|---|---|---|
| table/page.tsx | 10,529 | ~135 | ~30 | ~105 | partial (211 raw supabase refs remain) |
| TacticalMap | 4,301 | 40 | ~5 | ~35 | yes |
| CampaignCommunity | 3,083 | 63 | ~14 | ~49 | yes |
| NpcRoster | 2,295 | 44 | ~6 | ~38 | yes |
| vehicle/page.tsx | 2,079 | 22 | ~7 | ~15 | yes (fully) |
| MapView | 2,022 | 53 | ~16 | ~37 | yes |

**Ratio: ~22% server-state / ~78% orchestration.** Confirms the "both tools" call - and tells us **Zustand is the bigger lever, TanStack Query the cleaner-but-smaller win.**

## LOCKED decisions

1. **Tool split (confirmed by the ratio):** TanStack Query owns server-state (the `lib/data` repos become queries; realtime `postgres_changes` handlers call `invalidateQueries`); Zustand slices own orchestration state (combat flow, modals, view toggles, selection/drag). Not either/or - they solve the two different halves.
2. **Pilot = `vehicle/page.tsx`** (confirmed over MapView): smallest (2,079), zero combat-criticality, only 22 useState / 2 effects, the ONE fully-seamed component, and its server-state (`vehicle`/`crew`/`sceneInfo`/`check`) maps cleanly to one query + a small Zustand slice. **MapView is the second pilot** - it exercises the multi-query case (16 server-derived states across pins/communities/whispers) before we touch combat code.
3. **Two shared stores exist and must be modeled as stores, not props:**
   - **Combat/initiative slice** - THE true cross-component state. `page.tsx` holds `combatActive` + `initiativeOrder` in local `useState` (verified, line 370) and **prop-drills them into `<NpcRoster>` and `<TacticalMap>`**. This is the most combat-critical, realtime-broadcast path in the app.
   - **Session/campaign slice** - `campaign`, `userId`, `isGM`/`gmLike` are independently re-derived (re-running `auth.getUser` + `from('campaigns')`) in nearly every component. One shared store dedupes that everywhere.

## The sequencing refinement (the key call the audit forced)

The roadmap says "table page migrates LAST" - and for the page's FULL dissolution that still holds (it's the biggest, most combat-critical surface). **BUT the shared combat/initiative slice canNOT wait for the page.** If `NpcRoster`/`TacticalMap` move onto a Zustand combat slice during their own migration while `page.tsx` still owns `initiativeOrder` in local `useState` and prop-drills it, you get **two sources of truth for combat order** - the slice and the prop - and they WILL desync mid-combat.

**So:** the combat/initiative slice is **lifted into the shared store as part of the FIRST child migration that touches it** (NpcRoster or TacticalMap), and from that point `page.tsx` READS/WRITES the slice instead of prop-drilling - even though the page's full migration comes last. The shared slice extraction is decoupled from (and earlier than) the page's dissolution.

## Build order (gated on Phase 7 GREEN)
1. **C1** - this design + the human-architect second opinion (the tool-split + the shared-slice-early call are what to sanity-check).
2. **C2 pilot** - `vehicle` end-to-end onto Query + a Zustand slice. Validate (2-client + E2E). Then **MapView** (multi-query). Neither touches combat.
3. **Lift the session/campaign slice** (low-risk, dedupes auth/campaign everywhere).
4. **C3 combat-coupled trio** - `NpcRoster` -> `TacticalMap` -> `CampaignCommunity`. **The combat/initiative slice lands with the first of these**, and `page.tsx` is repointed to read it (no more prop-drill) at the same time.
5. **Table page** full dissolution LAST - by now it already reads the shared slices, so "last" is the remaining local orchestration, not the combat state.

## Risks
- **Two-sources-of-truth for combat order** (above) - mitigated by lifting the slice early. This is the single biggest Stage-C risk and the reason the naive "page last" reading is wrong.
- Each migration is behavior-preserving, ratchet-locked, 2-client-smoke-gated, one revert away - same posture as the re-arch + Stage B.
- The LOC ratchet finally ratchets DOWN (toward the <400 route target) instead of just holding.
