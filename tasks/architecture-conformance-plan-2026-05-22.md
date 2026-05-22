# Architecture + Conformance Plan (2026-05-22)

**Authored puffer-fish. Answers Xero's two questions:** (1) if starting fresh, how would we architect/engineer this to get to the target, and (2) once done, how do we go back and ensure what we built matches that architecture. This is the executable spine; it supersedes the ordering in `tasks/table-rearchitecture-2026-05-21.md` from Step 3 onward and folds conformance in as a first-class deliverable rather than an afterthought.

---

## 0. Where we are (verified 2026-05-22)

- `app/stories/[id]/table/page.tsx` = **12,565 lines** (down from 13,565; -1,000 via leaf extractions, zero breakage).
- L0 done: `lib/database.types.ts` exists; client is typed.
- L2 partial: `lib/table-roll-context.ts` (+tests) is the model pure-domain module.
- **L1 NOT done:** no `lib/realtime/`, no `lib/table-broadcasts.ts`. The typed realtime seam was skipped.
- Seam leakage today: **1,324 raw `.from(`** repo-wide (277 in table page), **44 raw `.channel(`** (11 in table page).
- Realtime surface of the table page: **23 distinct broadcast events, 67 send sites, 11 `postgres_changes` table subscriptions.**
- Fitness functions today: 4 grep guardrails (`check-font-sizes`, `check-role-literals`, `check-em-dashes`, `check-preview-sync`) on pre-commit + CI. **None enforce architecture.**

**Diagnosis:** the clean-leaf supply is exhausted. Everything left is trunk-coupled (initiative / tactical / roll-engine / realtime). We went top-down (peel UI leaves) - correct for the decoupled 30%, but it hit a wall at the trunk because the trunk has to be rebuilt onto a seam we never poured.

---

## 1. The target (one invariant, six layers)

The invariant the whole design protects:

> **Dependency direction points down, always. Nothing imports upward.**

```
L0  database.types.ts                         compile-time schema truth        [DONE]
L1  lib/realtime/   typed channel + registry  the seam the trunk stands on     [TODO - this plan]
    lib/data/       typed query helpers        (data-access seam; later phase)
L2  lib/*  pure domain, no React/Supabase, tested                              [~70%]
L3  hooks/*  state machines over L1+L2 (useInitiative, useRollResolution, ...) [~5%]
L4  components/*  dumb, props in, no business logic                            [leaves done]
L5  app/.../page.tsx  thin orchestrator < 400 lines                            [12,565 -> target]
```

A god-component is what forms when nothing enforces the invariant. So the plan does two things at once: migrate onto the layers, AND stand up the checks that keep the invariant true after we look away.

---

## 2. The plan (phases; each phase pours foundation, then builds on it, then locks it with a check)

### PHASE 1 - Pour the skipped seam + stand up the first architecture fitness functions
*Pure addition. No behavior change. Fully autonomous.*

- **1a. `lib/table-broadcasts.ts`** - typed event registry. Enumerate the 23 events (combat_started/ended, turn_changed, turn_advance_requested, token_changed, scene_activated, tactical_shared/unshared, pc_damaged, npc_damaged, pc_mortal_wound(+_resolved), infection_check_request, lasting_damage_check_request, gut_instinct_resolved, npcs_revealed, npc_inventory_changed, inventory_transfer, logs_cleared, player_kicked, recorder_start/stop, sync) as a discriminated union with payload shapes. Most payloads are `{}` today (untyped) - typing them is the win.
- **1b. `lib/realtime/useCampaignChannel.ts`** - the primitive: `[campaignId]`-only deps (kills the resubscribe/stale-closure bug class), typed `.send(event, payload)` constrained to the registry, sentry-wrapped handlers folded in (reuses `lib/sentry-realtime.ts`). Nothing consumes it yet.
- **1c. Fitness functions** (the conformance mechanism, started here so it ratchets from day one):
  - `scripts/check-seam-leakage.mjs` - counts raw `.from(` outside `lib/data/**` and raw `.channel(` outside `lib/realtime/**`; reads a committed baseline (`tasks/_baselines/seam-leakage.json`); **fails if any count rises.** Monotonic decrease only.
  - `scripts/check-loc-ceilings.mjs` - per-file LOC ceiling for the 7 god-components; **fails if a file exceeds its ceiling.** Baseline = today's counts; ceilings only ratchet down.
  - Wire both into `.husky` pre-commit + CI alongside the existing 4.
- **Gate:** `npx tsc --noEmit` + 502 suite (unchanged) + the two new scripts pass at baseline. Commit, push.

### PHASE 2 - Migrate the table page's trunk onto the seam
*Each sub-step is its own commit + gate. This is where the LOC collapses and the seam-leakage counters fall.*

- **2a. `useTacticalSync` + `<TacticalRegion>`** - consumes `useCampaignChannel`. Smoke (single client): place/move/remove token, scene switch, grenade cell-click.
- **2b. `useInitiative` + `<InitiativeStrip>`** - ReadyWeapon rides here (it calls `consumeAction`/`clearAimIfActive`). Smoke (single client): start combat, take turns, aim/ready/sprint/charge, end -> wound-infection queue.
- **`useGmTools`** - slot here: absorb the modal `show*` + sub-state currently threaded as props to the 8 extracted modals. Decision baked in: page destructures the hook (call sites unchanged) AND the modals each take one `gm` object (cuts the prop lists). tsc verifies every name.
- **2c. `useRollResolution`** - executeRoll + handleRollRequest + insight + log writes. Rides `lib/table-roll-context.ts` (tested) + the typed events. Pass state via one `RollContext` object, not 40 closure deps. **2-client smoke REQUIRED (Xero).** Full roll matrix per `tasks/decomposition-2client-smoke-testplan.md`.
- **2d. `useTableRealtime` + `useCampaignState` + `useTableAuth`** LAST - the channel wiring fully on the seam, deps `[campaignId]`. **2-client smoke REQUIRED (Xero).**
- **Gate per sub-step:** tsc + suite + the named smoke + seam-leakage counters drop (table page `.channel(` -> ~0 by end of 2d).

### PHASE 3 - Thin the route
- Collapse `page.tsx` to params + data load + compose hooks/components. Target < 400 lines. Delete dead state. LOC ceiling has been ratcheting down the whole time; this is where it hits the floor.
- **Gate:** full single-client smoke + tsc + suite.

### PHASE 4 - Lock the architecture (the conformance backstop)
- **4a. Dependency-direction lint** - add `dependency-cruiser`. Rules: `lib/**` pure domain may not import `react`/`next`/`supabase-browser`; `components/**` may not import route internals; `hooks/**` may not import `components/**`; `.channel(` only in `lib/realtime/**`; (later) `.from(` only in `lib/data/**`. Add only once the table page passes, so it goes in green. Wire to CI.
- **4b. ADR** - promote this doc's section 1 to `tasks/architecture-target.md`: the invariant, the layers, and each rule linked to the fitness function that enforces it. "Does it match?" becomes `npm run arch:check`.
- **4c. Reference-implementation checklist** - short audit (each layer present? route composes hooks only? zero raw `.from`/`.channel`? zero business logic in components?). Run against the table page; it MUST pass. The table page is now the reference implementation.

### PHASE 5 - Propagate to the other six god-components
*TacticalMap 4,314 / CampaignCommunity 3,158 / NpcRoster 2,301 / vehicle 2,110 / MapView 2,041 / moderate 1,726.*
- Each migrates to the same layering, copying the table-page reference. Mechanical, measured in weeks not hours.
- **Conformance is automatic here:** the LOC-ceiling ratchet, the seam-leakage ratchet, and the dep-direction lint enforce the architecture per file as each one migrates. The reference checklist is the human backstop run at the end of each.
- Data-access seam (`lib/data/**`) gets built out in this phase as the 1,324 `.from(` sites migrate behind it, ratchet-enforced.

---

## 3. How "does it match the architecture" gets answered (the deliverable for Xero's question 2)

Not by opinion - by `npm run arch:check`, a suite of executable fitness functions, layered weakest-to-strongest:

| Check | Enforces | Introduced | Mechanism |
|---|---|---|---|
| `check-loc-ceilings` | god-components shrink, never grow | Phase 1c | per-file ceiling, ratchet down |
| `check-seam-leakage` | raw `.from(`/`.channel(` only in seams | Phase 1c | baseline count, fails on rise |
| dep-direction lint | the downward-dependency invariant | Phase 4a | dependency-cruiser rules in CI |
| `any`-budget (optional) | typed seam kills `any` | Phase 2+ | per-file count, ratchet down |
| reference checklist | layers exist, no logic in L4/L5 | Phase 4c | human audit vs table-page spec |

The meta-point: the god-component formed because we had fitness functions for fonts and role literals but none for layering. After Phase 1c/4a, conformance is a property CI maintains, not vigilance that decays.

---

## 4. Rollback posture
Work on `main`, push to live (house rule). Phase 1 is pure addition (revert = delete the new files). Each Phase 2 sub-step is behavior-preserving and reverts cleanly with `git revert <sha>`. No schema change, no API-shape change anywhere in this plan.

## 5. The one decision
On "go", **Phase 1** starts (seam + the two fitness functions - all autonomous, no behavior change). The chain then runs to the first hard stop at **2c**, where 2-client smoke with Xero is the point of stopping. What would change the plan: if Xero wants `useGmTools` done before the trunk hooks (it can slot at the top of Phase 2), or wants the data-access seam (`lib/data/**`) pulled earlier than Phase 5.
