# The Grand Re-Architecture (2026-05-22)

**Mandate (Xero, 2026-05-22):** if there were a time machine, we'd go back to before this started. So instead: audit honestly where we are, define the perfect architecture, measure the gap, and put a no-stop plan in place to make what we have line up with the ideal. Hammer-fixes authorized. No playtest, no forward motion on anything else until this is resolved (Q1 = **B: the whole platform**, all 7 god-components + the data/realtime seams). No-stop, no diversions. Xero playtests/smoke-tests everything at the end.

**This doc supersedes** `tasks/architecture-conformance-plan-2026-05-22.md` (which was table-page-scoped) and absorbs it. It is the single executable spine.

All numbers below are **verified 2026-05-22** (two read-only audit passes + direct grep), not recalled.

---

## PART 1 - The honest audit

### 1.1 Did we get here the right way? No - and the evidence is unambiguous.
The app was built **UI-first**. Logic accreted inside route/component files; the pure `lib/` layer was carved out **reactively, after the fact**. The result is seven god-components that each interleave four concerns - realtime, data access, business logic, and rendering - in one file:

| God-component | Lines | RT | DB | BL | UI | raw `.from(` | realtime setups |
|---|---|---|---|---|---|---|---|
| `app/stories/[id]/table/page.tsx` | 12,565 | y | y | y | y | 277 | 11 ch / 21 bcast / 23 pg |
| `components/TacticalMap.tsx` | 4,314 | y | y | y | y | 28 | 2 ch / 7 bcast / 6 pg |
| `components/CampaignCommunity.tsx` | 3,158 | y | y | y | y | 56 | 1 ch / 1 pg |
| `components/NpcRoster.tsx` | 2,301 | y | y | y | y | 50 | 1 ch / 6 pg |
| `app/vehicle/page.tsx` | 2,110 | y | y | y | y | 19 | 6 ch / 1 bcast |
| `components/MapView.tsx` | 2,041 | y | y | y | y | 36 | 2 ch / 2 pg |
| `app/moderate/page.tsx` | 1,726 | - | y | y | y | 54 | none |

### 1.2 Are there band-aids holding it together? Yes. Cataloged:
- **No data-access layer.** 98 files hand-roll inline `supabase.from(...)`; table names + column shapes are duplicated across dozens of components. The 16 `lib/*` files with `.from(` are feature-scoped domain helpers (logEvent, clock tick, snapshot), NOT repositories. A schema rename ripples through everything and fails silently at runtime.
- **No realtime layer.** 24+ ad-hoc `.channel()` setups, each with its own (inconsistent) lifecycle teardown. `lib/sentry-realtime.ts` exists but is ONLY an error-wrapper (`wrapBroadcast`/`wrapDbChange`), not a channel abstraction - and only the table page uses it; TacticalMap, vehicle, MapView, NpcRoster wire raw handlers with no Sentry guard. This is the source of the recurring stale-closure / resubscribe / desync bug class.
- **Untyped core.** ~1,382 `any` across app/components/lib. The table page alone holds **418** (~30%) - the realtime/initiative/roll core is effectively untyped. **Debt I added this window is in here:** `RestorePickerModal` 23, `FeedColumn` 20 (deliberate loose props, repaid only when the seam + hooks exist).
- **118 unconditional `console.log/warn`** shipped to production (table page 72, incl. all 11 `[playtest-trace]` turn logs; `[crop]` upload logs in CampaignObjects/ObjectImageCropper; scattered elsewhere). No build-time stripping. Leaks internal state to every player console and buries real errors. The `[kickCheck] myState:` warn fires on **every** non-GM load.
- **One explicit "revert before live" flag:** `table/page.tsx:7220` - the session **recorder TEMP WIDENED to all signed-in users** (2026-05-17 for the MINNIE shake-down). Render gate is currently `{gmLike}`; the intended end-state is `isThriver`. Internal QA tool, must be verified/narrowed before paid launch.
- **Shipped non-functional UI:** `app/campaign-sheet/page.tsx:394-404` Eat/Rest/Relax are `alert()` placeholders; Apprentice is `alert('coming soon')` (`table/page.tsx:7361`, `CharacterCard.tsx:457`).
- **13 `react-hooks/exhaustive-deps` suppressions** (of 23 total eslint-disables) - each a deliberate dep-omission that can hide a stale-closure bug (the same bug class as the realtime issues). Zero `@ts-ignore`/`@ts-expect-error` (the one clean axis).
- **Deferred-mechanic scars:** community moderation re-trigger, withdrawal-to-PC, `temporary_expired` enum, an on-entry-stress "workaround" (`page.tsx:2561`), hardcoded pregens "needs a DB decision" (`setting-npcs.ts:696`).

### 1.3 What would we do differently at the planning stage?
1. **Build the seams (L1) FIRST**, before any UI. Data-access + realtime are horizontal layers everything else stands on; we never built them, so every feature re-hand-rolled them.
2. **Enforce dependency direction from commit 1** with fitness functions, the way we already enforce fonts and role-literals. The god-components formed precisely because nothing stopped logic from collapsing into the UI.
3. **Never let a `.from()` or `.channel()` exist outside its seam.** One rule, mechanically enforced, prevents the entire mess.
4. **Type from the schema down** (L0 generated types -> typed seams), so `any` never becomes the path of least resistance.

### 1.4 Does everything work like we want? Mostly functionally, NOT structurally.
Part 0 leaf smoke passed (2026-05-22, two clients) and playtests run. But: non-functional buttons are shipped, an internal recorder is exposed to all users, console noise is everywhere, and the realtime sync bug-class is latent because realtime is ad-hoc and only partially error-wrapped. "Works at the table today" is not "works the way we want to take to the world."

### 1.5 Honest note on the recent leaf extractions
The 4 extractions this window (-417 lines, zero breakage) were correct moves but **top-down**, and they added the loose-`any` prop debt above. They were a down-payment made before the foundation existed. This plan repays that debt when the state moves into typed hooks (Phase 3).

---

## PART 2 - The perfect architecture

One invariant, enforced mechanically:

> **Dependency direction points down. Nothing imports upward. No `.from()` outside the data seam. No `.channel()` outside the realtime seam.**

```
L0  lib/database.types.ts            generated schema truth                         [DONE]
L1  lib/data/*       typed repository/query modules per domain; the ONLY home of .from()
    lib/realtime/*   useCampaignChannel primitive + typed event registry; ONLY home of .channel()
L2  lib/domain/*     pure rules engine: no React, no Supabase, unit-tested
L3  hooks/*          state machines composing L1+L2 (useInitiative, useRollResolution, ...)
L4  components/*     dumb: props in, callbacks out, no business logic, no .from/.channel
L5  app/**/page.tsx  thin route: params + load + compose hooks/components, < 400 lines
```

**Cross-cutting standards (part of "perfect", not optional):**
- **Observability:** every realtime handler and every write flows through the sentry-wrapped seam. 100% adoption, not the current ~14%.
- **No prod console noise:** a `lib/log` wrapper that no-ops in production, or build-time stripping. Zero bare `console.*` in render/handler paths.
- **Type safety:** zero `any` in L1/L2/L3 seams and hooks; component `any` on a ratcheting budget to zero.
- **Testing:** L2 fully unit-tested; L3 hooks tested where logic-heavy; the **2-client smoke** is the realtime acceptance gate (no unit test catches desync).
- **Conformance is executable:** `npm run arch:check` runs the fitness functions; "does it match" is answered by CI, not opinion.

---

## PART 3 - The gap (where we are vs the ideal)

| Layer | Ideal | Today | Gap |
|---|---|---|---|
| L0 types | generated, wired | done | none |
| L1 data | all reads via `lib/data/*` | 0%; 98 files inline `.from(`, 1,324 calls | **entire layer missing** |
| L1 realtime | all channels via `lib/realtime/*` | 0%; 24+ ad-hoc, sentry-wrap ~14% | **entire layer missing** |
| L2 domain | pure, tested | ~70%; modules.ts couples Supabase; 25 untested | decouple + test gaps |
| L3 hooks | state machines own orchestration | ~5%; 3 leaf hooks only | trunk hooks all unbuilt |
| L4 components | dumb | god-components ARE the logic | 7 to gut |
| L5 routes | < 400 lines | routes are god-components | all over ceiling |
| cross-cut | wrapped, typed, quiet | 118 console, 1,382 any, 1 revert flag, dead UI | full cleanup pass |

The leaf extractions moved L4 partially for the table page. Everything else is unstarted, and the two L1 seams - the things everything stands on - are at zero.

---

## PART 4 - The plan (A -> done, no stop, whole platform)

Bottom-up this time. Build the seams, prove them on the table page (the reference), lock them with fitness functions, then propagate. Each step is its own commit, gated by `tsc` + the 502 suite + the new arch checks; push to live. The only human-gated step is the 2-client realtime smoke, which per Xero's mandate batches into the final acceptance run.

### PHASE 1 - Pour both seams + stand up the conformance harness *(pure addition, no behavior change)*
- **1a.** `lib/realtime/events.ts` (typed registry; the 23 table-page events first, expand as others migrate) + `lib/realtime/useCampaignChannel.ts` (`[campaignId]`-stable, sentry-wrapped, manages subscribe/teardown). Folds in `sentry-realtime.ts`.
- **1b.** `lib/data/` pattern + first repositories for the hottest tables (campaigns, characters, character_states, campaign_npcs, scene_tokens, tactical_scenes, initiative_order, map_pins, communities, moderation queues). Typed via L0. Nothing consumes them yet.
- **1c.** Fitness functions wired to pre-commit + CI: `check-seam-leakage.mjs` (`.from(` outside `lib/data/**`, `.channel(` outside `lib/realtime/**`; baseline today; fail on rise), `check-loc-ceilings.mjs` (7 god-components; ratchet down), `check-prod-console.mjs` (no bare `console.*` in app/components render/handler paths; baseline 118; ratchet down), `any`-budget (table page baseline 418; ratchet down). `npm run arch:check` aggregates them.
- **Gate:** tsc + 502 suite + scripts pass at baseline.

### PHASE 2 - Decouple L2 *(make the domain pure + tested)*
- Split `lib/modules.ts` (Supabase-coupled) into pure L2 + L1 data calls. Decouple the other tangled "pure" modules (first-impression-resolver, npc-drag-drop, advantages). Add tests to the 25 untested pure modules (the safety net for Phase 3).
- **Gate:** tsc + expanded suite.

### PHASE 3 - Migrate the table page fully onto the seams (it becomes THE reference implementation)
- **3a.** Replace its 277 `.from(` with `lib/data` calls (seam-leakage counter falls).
- **3b.** Replace its 11 channels / 44 events with `useCampaignChannel` + the typed registry (`[campaignId]` deps; kills the resubscribe bug).
- **3c.** Extract trunk hooks on the seams: `useCampaignState`, `useTacticalSync`, `useInitiative` (ReadyWeapon rides here), `useGmTools` (absorbs the modal prop-threading + repays the loose-`any` debt), `useRollResolution` (on the tested roll core), `useTableRealtime`.
  - **FIX-DO-NOT-PRESERVE list (known bugs that must NOT survive the behavior-preserving rebuild):** (1) **CMod from ANY source (Aim, Cover, Range, manual) is dropped from the roll total AND the breakdown** (found 2026-05-22; confirmed Aim+Cover+Range; Aim case computed `[3+5]+1=9` not 11, log shows no CMod term). The single-`RollContext` design must carry the CMod value end-to-end into both the computed total and the rendered breakdown. Verify against the decomposition smoke Aim + CMod-stacking steps. Add to this list as more smoke failures surface.
- **3d.** Thin `page.tsx` to a < 400-line orchestrator. Strip its 72 console writes, fix/verify the recorder gate, resolve or wire the `alert()` placeholders.
- **Gate per step:** tsc + suite. Realtime/roll steps get their 2-client validation at final acceptance (Phase 7).
- **End:** run the reference checklist against the table page; it MUST pass.

### PHASE 4 - Lock the architecture
- Add `dependency-cruiser` dep-direction lint (L2 no React/Supabase; components no route internals; hooks no components; `.channel(` only in `lib/realtime`; `.from(` only in `lib/data`). Added green once the table page passes. Wire to CI.
- Promote Part 2 of this doc to `tasks/architecture-target.md` (the ADR), each rule linked to its fitness function.
- Codify the reference checklist.

### PHASE 5 - Propagate to the other six god-components (ascending risk)
Order: `moderate` (1,726, no realtime - easiest) -> `MapView` (2,041) -> `vehicle` (2,110) -> `NpcRoster` (2,301) -> `CampaignCommunity` (3,158) -> `TacticalMap` (4,314, hardest). Each: `.from` -> `lib/data`, `.channel` -> `lib/realtime`, extract hooks, gut to a dumb component / thin route, copying the table-page reference. **Conformance is automatic** - the ratchets + dep-lint enforce it per file as each migrates. Reference checklist run at the end of each.

### PHASE 6 - Cross-cutting cleanup *(folded into 3/5, then a final sweep)*
Drive console-in-prod to zero (logger or strip), recorder gate reverted/verified, `alert()` placeholders resolved, `any` to budget across all seams/hooks, 100% realtime sentry-wrap, the 13 exhaustive-deps suppressions reviewed (each is a latent stale-closure bug now that realtime is centralized).

### PHASE 7 - Final acceptance (Xero)
Full 2-client smoke across every surface: the existing `tasks/decomposition-2client-smoke-testplan.md` Parts 1-3 (initiative / roll / realtime) plus a whole-platform pass (communities, vehicle, map, moderation). `npm run arch:check` green. THEN, and only then, playtest / launch.

---

## PART 5 - How "does it match the ideal" is answered (Xero's verification question)

Not by opinion - by `npm run arch:check`:

| Check | Enforces | Phase | Baseline -> target |
|---|---|---|---|
| `check-loc-ceilings` | god-components shrink | 1c | 7 files -> all < ceiling |
| `check-seam-leakage` | `.from`/`.channel` only in seams | 1c | 1,324 / 44 -> 0 outside seams |
| `check-prod-console` | no console noise in prod | 1c | 118 -> 0 |
| `any`-budget | typed seams/hooks | 1c | 418 (table) -> 0 in L1/L2/L3 |
| dep-direction lint | the downward invariant | 4 | enforced in CI |
| reference checklist | layers exist, no logic in L4/L5 | 4, per-component in 5 | each god-component passes |

The god-components formed because we had fitness functions for fonts and role-literals but none for layering. After this, conformance is a property CI maintains, not vigilance that decays.

## PART 6 - Rollback posture
Phases 1-2 are pure addition (revert = delete new files). Every Phase 3/5 step is behavior-preserving and reverts cleanly (`git revert <sha>`). No schema change, no API-shape change anywhere in this plan. "Break what we have to" is authorized; each break is one revert away.

## PART 7 - The one decision
On "go", **Phase 1** starts (both seams + the conformance harness - all autonomous, zero behavior change) and the chain runs end to end with no stops except where a check forces a fix. The 2-client realtime validation batches into Phase 7 (Xero), per the mandate. Nothing else gates.
