# Table Re-Architecture: target state, the gap, and the migration

**Authored 2026-05-21 (puffer-fish). Mandate from Xero: stop everything else, get to the right architecture, break what we have to, continuous execution, absolute-critical testing only, shake out in playtest.** This doc is the executable spine. The deep per-unit code-read lives in [tasks/page-tsx-decomposition-plan.md](page-tsx-decomposition-plan.md) (layer-1 detail); this doc reframes that work inside the from-scratch ideal so we build the foundation it was missing.

---

## 1. Where we actually are (verified 2026-05-21)

| Symptom | Reality |
|---|---|
| Table god-component | `app/stories/[id]/table/page.tsx` = **13,565 lines**, one React function. `executeRoll` alone is ~1,850 LOC. |
| Six more god-components | TacticalMap 4,314 / CampaignCommunity 3,158 / NpcRoster 2,301 / vehicle 2,110 / MapView 2,041 / moderate 1,726. |
| Data access | **1,215 inline `.from()` calls across 62 tables. Zero repository/query layer. No generated DB types - every query result is `any`.** Schema renames break silently at runtime. |
| Realtime | **42 ad-hoc `.channel()` setups; 20+ broadcast event names in the table page alone; all payloads `any`.** `lib/sentry-realtime.ts` catches handler exceptions but cannot validate event shape. This is the source of the recurring stale-closure / sync bug class (the smoke bugs, the landmines). |
| Hooks | No app-wide hook layer. `useHeaderMenus` + `useBellDropdown` are the only extractions. |
| Pure domain lib | Actually decent: ~41 pure modules, 16 tested. But `modules.ts` (1.4k) imports Supabase, and several "pure" modules (first-impression-resolver, npc-drag-drop, advantages) are tangled. 25 pure modules untested. |
| Supabase client | Clean: single canonical `lib/supabase-browser.ts`. (The one thing that was done right.) |

**Honest diagnosis:** the app was built UI-first. Logic accreted inside page/component files; the pure `lib/` layer was carved out *reactively, after the fact*. The table page is the worst case, but the same inversion runs through all seven god-components.

---

## 2. How we should have planned it (the ideal, bottom-up)

If we restarted with full knowledge, we'd build the layers in dependency order, bottom first:

```
L0  Generated DB types (database.types.ts)        <- compile-time truth about the schema
L1  Typed seams:
      lib/realtime/   typed channel + event registry, [campaignId]-stable, sentry-wrapped
      data-access     typed query helpers / per-domain query modules
L2  Pure domain lib (no React/Supabase) - tested  <- mostly exists; fill gaps, decouple
L3  Domain hooks (state machines over L1+L2)       <- useInitiative, useRollResolution, ...
L4  Dumb presentational components                 <- props in, no business logic
L5  Thin route components                          <- page.tsx = orchestrator < 400 lines
```

**The point:** logic lives in L2/L3 (testable), the Supabase boundary is typed once at L0/L1, and components/routes (L4/L5) just compose. A change to a query is type-checked everywhere; a realtime event has a known shape; a new feature adds a tested helper + a thin hook, not 400 lines to a god-component.

---

## 3. The gap (what's missing, by layer)

- **L0 - missing entirely.** No generated types. This is the root enabler of the data-access and realtime fragility.
- **L1 - missing entirely.** No typed realtime layer, no data-access seam. 1,215 raw `.from()` calls and 42 raw channels.
- **L2 - ~70% there.** Good pure lib, but gaps + a few coupled modules.
- **L3 - ~5%.** Two leaf hooks. The state machines (initiative, rolls, tactical, realtime) live inside the god-components.
- **L4/L5 - inverted.** The "components" ARE the logic. Routes are 13k-line god-components, not orchestrators.

The table page collapses L1-L5 into one file. **That is why extracting it has felt terrifying: there's no foundation under it to extract onto.** Pull a hook out today and it still hand-rolls untyped queries and ad-hoc channels - you've reorganized the fragility, not removed it.

---

## 4. The migration (one continuous chain; each step unlocks the next)

Build the missing foundation FIRST, then migrate the worst offender onto it, then the table page becomes the reference implementation the other six god-components copy.

### STEP 0 - Foundation (de-risks everything after; pure addition, no behavior change)
- **0a. Generate `lib/database.types.ts`** via `supabase gen types`. Wire `lib/supabase-browser.ts` to it (`createBrowserClient<Database>`). Now `.from()` is typed everywhere; schema drift fails `tsc` instead of prod. *(If the CLI can't gen against the linked project, fall back to a hand-authored types file covering the ~18 tables the table page touches - still the bulk of the win.)*
- **0b. `lib/realtime/` typed channel layer.** A `useCampaignChannel` primitive: `[campaignId]`-only deps (kills the resubscribe bug), typed broadcast event union, sentry-wrapped handlers folded in. This is the thing `useTableRealtime` needs to exist anyway.
- **0c. `lib/table-broadcasts.ts`** - the typed event registry 0b consumes; 15 distinct events with payload shapes.
- **Gate:** `tsc` + 476 suite. Zero behavior change.

### STEP 1 - Pure roll core + tests (the safety net for the scary part)
- Extract `executeRoll`'s pure math into `lib/table-roll-context.ts` (auto-target picker, range/CMod stacker, mortal-wound math, infection ladder, blast-cell enumeration), **with unit tests**. `executeRoll` stays in place but calls the helpers. -300 LOC and a net.
- **This is the one place we deliberately ADD tests** - it's the critical-testing investment that makes the Step-3 roll-hook extraction mechanical instead of a leap.
- **Gate:** `tsc` + the new tests.

### STEP 2 - Leaf extractions (the ~60% LOC cut; low risk, fast)
Batched, in this order, each `tsc` + suite + a single-client click-through:
- types/constants -> expand `types.ts`; `useRecorderToggle`.
- `useGmTools` + `<GmModalStack>` (Loot/Cdp/Populate/AdvanceTime/Restore/Reload/EndSession).
- `<SpecialCheckModal>` + `useSpecialChecks` (7 trigger fns).
- `<RecruitWizard>` + `useRecruitFlow`; `useTradeTarget` + trade/apprentice mounts.
- `<TableHeader>`, `<FeedColumn>` (keep `useChatPanel` at page level), `<GmSidebar>` (4 tabs), compose `<TableMainGrid>`.
- **Net:** ~13,565 -> roughly 5,500 lines. ~75% of the surface gone, all behavior-preserving.

### STEP 3 - Trunk hooks on the new seams (each ALONE; critical smoke each)
Built on Step 0's typed realtime + Step 1's tested pure core:
- **3a. `useTacticalSync` + `<TacticalRegion>`.** Smoke: place/move/remove token, scene switch, grenade cell-click.
- **3b. `useInitiative` + `<InitiativeStrip>`** (ship alone). Smoke: start combat, take turns, aim/ready/sprint/charge, end -> wound-infection queue.
- **3c. `useRollResolution`** (executeRoll + handleRollRequest + insight + log writes). The big one - rides on 1's pure core + 0's typed events. Pass state via a single `RollContext` object, not 40 closure deps. **2-client smoke REQUIRED.** Full roll matrix (normal / insight / +3 CMod insight / burst / grenade vs cell / vs friendlies / vehicle / PC mortal-wound + save / NPC infection queue / recruit / grapple / heal / coord-effort lead+follow+withdraw+end).
- **3d. `useTableRealtime` + `useCampaignState` + `useTableAuth`** LAST (every prior step finalizes its callback surface). Deps array MUST be `[campaignId]`. **2-client smoke REQUIRED.**

### STEP 4 - Thin orchestrator
- Collapse `page.tsx` to params + data load + compose hooks/components. Target < 400 lines. Delete dead state.
- **Gate:** full single-client smoke + `tsc` + suite. Then -> Monday playtest.

---

## 5. Test posture (Xero: "absolute critical testing only")
- **Every commit (free):** `tsc` + the 476-test suite (pre-commit + CI enforce). Non-negotiable.
- **Added tests, exactly once:** Step 1 pure roll core. The safety net for the riskiest move.
- **Leaf gates (Step 2):** one single-client click-through per batch (mount GM, mount player, open every modal, every tab, every header button).
- **Trunk gates (Step 3):** 2-client smoke per trunk hook, per [tasks/decomposition-2client-smoke-testplan.md](decomposition-2client-smoke-testplan.md).
- **Everything else:** shaken out in the Monday 2026-05-25 playtest. We accept that breakage surfaces there.

## 6. Rollback posture
- Work on `main`, push to live (no staging - house rule). Each step is its own commit (or tight cluster). All changes are behavior-preserving refactor + typing - **no schema change, no API-shape change** - so any commit reverts cleanly with `git revert <sha> --no-edit && git push`.
- "Break what we have to" is authorized; each break is a single revert away.

## 7. Honest scope boundary (do NOT bluff this)
- **The 12-24h target is STEPS 0-4 for the TABLE PAGE only.** Ambitious but reachable: Step 0 is pure addition, Step 2 is the fast 60% leaf cut, the risk concentrates in Step 3's three trunk hooks.
- **NOT in this window:** the 1,215-site data-access migration across the whole app, and the other six god-components (TacticalMap, CampaignCommunity, NpcRoster, vehicle, MapView, moderate). Those migrate to the SAME pattern the table page establishes - that's the continuation, measured in weeks, not hours. The table page becomes the reference implementation; copying it outward is mechanical.
- L0 (generated types) is the one Step-0 item with an external dependency (supabase CLI linked). Fallback (hand-authored types for the table's tables) keeps the chain moving if the CLI balks.

## 8. Lane coordination
This lane (puffer-fish) now owns the table page exclusively for this window. **Hunt-and-peck is paused on anything touching `app/stories/[id]/table/**` and the table's hooks/components.** Recorded at the top of `tasks/todo.md` so the other chat sees the freeze.

---

## 9. The one decision point
This is the plan. On "go", Step 0 starts and the chain runs without further check-ins except at the two 2-client trunk gates (3c, 3d), where a real bug is the *point* of stopping. What would change the plan: if the supabase CLI can't gen types AND you don't want the hand-authored fallback, Step 0a drops and we lose the compile-time-safety win (the rest still stands).
