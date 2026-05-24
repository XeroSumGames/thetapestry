# Architecture Path - foundation laid -> ready for the world

**Status: AUTHORITATIVE (puffer-fish, locked 2026-05-24). This is the plan the architecture lane drives - no per-step sign-off required.** Xero owns vision + priorities + the bright-line gates (below); the technical sequencing and the engineering calls are owned here and are LOCKED (mirrored in `decisions.md`). Xero can re-prioritize or veto at any time, but the default is: this runs, stage to stage, and I report progress - I do not ask which task to do next.

This is the executable sequel to two docs:
- `tasks/grand-rearchitecture-2026-05-22.md` - the re-arch spine (Phases 1-7). Built the seams. Phases 1-6 code-complete; Phase 7 (validation) pending.
- `tasks/architecture-review-2026-05-24.md` - the north-star retrospective. Verdict: the layering is right but stops one layer too early; named 5 moves to finish it.

This doc turns those 5 moves into a sequenced, gated, de-risked path.

---

## The destination (what "there" means)

**Xero's words (2026-05-22 mandate):** *"define the perfect architecture, measure the gap, put a no-stop plan in place to make what we have line up with the ideal."* **North-star question:** *"if we were designing a platform to reach this point again, would we use the current architecture? If not, what would have to change?"*

So "there" = **the platform structurally matches the ideal, so it is sound enough to take to the world (paid launch / 50k users), not just functionally working at the table today.** The architecture moves are not vanity - each one kills a bug class that would burn paying users and erode trust:

| Move | Bug class it kills | Commercial stake |
|---|---|---|
| Client-state layer | god-component fragility (every change risks the table) | velocity + reliability of every future feature |
| Conditions subsystem | the Restore/infection/MW saga that ate this whole session | players hit these AT THE TABLE; wrong = trust |
| Infra-as-code | silent-config bugs (the publication gap, cost an hour today; triaged a 2nd today) | invisible breakage that only surfaces in prod |
| Typed payloads | `561 as any` + label-regex parsing of the feed | data-integrity bugs that corrupt the record |
| Test pyramid | realtime desync invisible to unit tests | the detector is currently a human with 2 browsers |

The ideal itself (from the spine doc PART 2, plus the review's additions) is the L0-L5 layering with dependency-direction enforced, PLUS the three layers the re-arch did not reach: a client-state layer, conditions-as-code, and infra-as-code, all sitting under a real test pyramid.

**This destination is LOCKED** (it is Xero's own mandate, restated). If the commercial priority shifts (e.g. "ship feature X before hardening"), Xero changes the PRIORITY; the technical path to the destination does not change.

---

## The gating reality (three things that constrain the path)

1. **Phase 7 closes FIRST. It is the foundation gate.** You cannot build a client-state layer on top of seams whose behavior-preservation is still HOPED-FOR. The re-arch's 6 migrations are asserted-correct, not yet proven across 2 clients. Phase 7 (the batched 2-client acceptance, `tasks/phase7-acceptance-2client-testplan.md`) is now being AUTOMATED by the Playwright lane (fixture seeding done + verified 6/6 on the live Arena 2026-05-24; Sections C/D in build) - so it is no longer calendar-blocked on the 2026-05-25 Minnie playtest. **Until Phase 7 is GREEN, no Stage-C work starts.** Stages A/B begin in parallel now because they do not depend on the seam validation.

2. **The risk posture has FLIPPED, and the plan must respect it.** The re-arch ran under "break-things-OK, no playtest until done" (Xero, 2026-05-22). That window is closed - there is now a live playtester group. New posture for everything below: **behavior-preserving, one `git revert` away, ratchet-locked, validated per slice with the 2-client smoke. No big-bang. The combat-critical table page migrates LAST.** Name this explicitly so we do not carry the old posture forward by habit.

3. **The big migration (Stage C) deserves a human architect's eyes** (the review said so, and I agree - it is the one move where a wrong foundational call is expensive to unwind). The plan handles this with a **design-doc + pilot-on-one-component** gate before any bulk propagation, so the technology choice is validated on a small surface before it touches the table page.

---

## The sequenced path

Execution order is NOT the review's priority-by-leverage order. It is sequenced by dependency, risk, and "stop the bleeding first." Cheap-and-safe groundwork goes early precisely because it de-risks the big move.

### Gate 0 - Close Phase 7 (validate what exists)
**Not new work - finish the re-arch.** The Playwright lane automates Sections C/D/E (propagation) + the console sweep against the seeded Arena; the residual manual checks (combat math A2, infection modal F) ride the 2026-05-25 Minnie playtest as final real-world confirmation. When Phase 7 is GREEN, the architecture lane closes the books: demote Realtime YELLOW -> GREEN (`debug-handoff.md` Sec 1), promote the re-arch HOPED-FOR -> PLAYTESTED, archive the decomposition sheet, log "Phase 7 closed / re-arch validated" in `decisions.md`. **This is the precondition for Stage C** (Stages A/B do not wait on it).

### Stage A - Infra-as-code + typed payloads (cheap, safe, de-risks everything)
Can start NOW, in parallel with the Phase 7 close. Lowest risk, highest "stop the silent bleeding" value.

- **A1. Infra-as-code (review move #3). DONE 2026-05-24** (`tasks/stage-a-infra-as-code-scope.md`). Captured the live config that was dashboard/live-only into versioned baselines via the `db query --linked` API (Docker not installed, so no `supabase db dump`): `sql/_baseline/publication.sql` (21 tables) + `scripts/check-publication-drift.mjs` (`npm run check:publication`), and `sql/_baseline/schema.sql` (69 tables incl. all 15 orphans, 286 policies, 56 triggers, 72 functions) via the re-runnable `scripts/capture-schema.mjs`. Discipline rule in `AGENTS.md`. Already paid off: killed the false "whispers not published" blocker without a DB change. Remaining: Tier 3 (CI drift-check) needs a read-only DB secret - an OPERATOR action for Xero, not blocking.
- **A2. Typed payloads + de-regex the feed (review move #4). NEXT.** `DamagePayload` and friends for the realtime/roll JSON; structured `roll_log` columns to replace label-text regex parsing (`compactRollSummary`). Incremental, compile-time-safe. Drives down the `561 as any` and removes a data-integrity foot-gun. Pairs naturally with the typed seams.
- **Gate:** tsc + full vitest suite + arch ratchets. Any live-DB application is dry-run first (bright-line: live-DB migration = confirm intent).

### Stage B - Conditions subsystem (review move #2)
After A1 (so the schema change is a proper migration). Independent of the Stage-C technology choice, so it can run in parallel with Stage C's design phase.

- Unify infection / lasting-wound / stress / mortal-wound into **one model, one lifecycle (apply / clear / expire-via-clock), one render path (the status chips - already shipped this session as the right SHAPE), one reset path (Restore clears the set).** Today these are four different models in four places (`infection_*` columns, `death_countdown` column, `stress` column, lasting-wounds parsed from the feed) - which directly caused the Restore-didn't-clear bug, the invisible-infection confusion, and the lasting-wound chip being a fast-follow.
- **Risk:** touches combat state -> the 2-client smoke is its acceptance gate. Behavior-preserving migration of the existing conditions onto the unified model; chips re-point at the new source.
- **Gate:** tsc + suite + a focused 2-client conditions smoke.

### Stage C - Client-state layer (review move #1 - THE big one)
The structural dissolution. This is what actually shrinks `page.tsx` (still 10,557 LOC) and the other god-components, because it gives orchestration state a home OTHER than the route component. Starts only after Gate 0.

- **C1. Design doc + technology decision** (puffer-fish drafts; the one place a human architect's review is worth buying before the bulk work). My recommended call, with reasoning, is in the next section.
- **C2. Pilot on ONE already-seamed, NON-combat-critical god-component** - `MapView` (2,022) or `vehicle` (2,076), NOT the table page. Migrate it fully onto the chosen state layer as the reference implementation. Validate (2-client + the E2E net from Stage D). This proves the pattern on a small surface before it touches anything load-bearing.
- **C3. Propagate** to the remaining god-components in ascending risk, **table page LAST** (combat-critical, 10.5k LOC, the hardest and the one a regression hurts most). Each migration: behavior-preserving, ratchet-locked (the LOC ceilings finally ratchet DOWN toward the <400 target instead of just holding), one revert away, smoke-validated.
- **Gate per component:** tsc + suite + arch ratchet drop + 2-client smoke + E2E where the suite covers it.

### Stage D - Test pyramid (review move #5) - runs PARALLEL throughout
Not a final phase - the automated net that lets Stages B/C move safely. The Playwright "final test" suite is already in motion (`tasks/e2e-final-test-handoff-2026-05-24.md`). Mature it alongside the migrations: **seam-contract tests** (repo function shape, channel payload shape) as each layer stabilizes, and **E2E coverage of the golden combat path** (the desync class no unit test can catch). Goal: replace "a human with two browser windows" as the detector. Each Stage-C component should have an automated net before its migration, not after.

---

## The one big architectural decision (Stage C technology)

The review framed it as "TanStack Query OR feature stores." That is a false either/or - the god-components conflate two DIFFERENT kinds of state, and each kind wants a different tool:

- **Server-state -> TanStack Query.** The `lib/data/*` repos become query/mutation functions; components subscribe declaratively; **realtime pushes become cache invalidations** (the seam's `postgres_changes` handler calls `queryClient.invalidateQueries`). This directly kills "the route owns fetch + cache + invalidation + realtime-wiring." It is the standard, well-trodden answer for a Supabase app and sits cleanly on top of the seams we already built.
- **Client/orchestration state -> lightweight Zustand slices.** Combat flow, modal open/close, tactical view toggle, selection - the ephemeral state that is NOT server data but currently sprawls as `useState` in the route. Zustand slices (combat, initiative, table-view) own it; the route just composes them.

**Why both:** TanStack Query is the wrong tool for pure UI/orchestration state; Zustand is the wrong tool for a server-cache with invalidation. The clean cut - server-state to Query, client-state to Zustand - is exactly the separation the god-components are missing. **This is the call I would want a human architect to sanity-check before C3** (the bulk propagation), which is why C1+C2 exist as a validate-on-a-pilot gate rather than a commit-and-pray.

**What would change my mind:** if the pilot (C2) shows the orchestration state is thinner than it looks and Query alone gets a component under ceiling, drop Zustand and stay single-tool. If realtime-as-invalidation proves too coarse for the combat path (over-fetching on every tick), keep the targeted-broadcast pattern for the hot path and use Query only for the cold reads.

---

## LOCKED decisions (no further sign-off - these are mine to own)

1. **Destination** = structurally ready for the world / paid launch (Xero's mandate, restated).
2. **Risk posture** = behavior-preserving, one revert away, ratchet-locked, validated per slice, table page LAST. (The re-arch's "break-things-OK" is retired - playtesters are live.)
3. **Stage C technology** = TanStack Query (server-state) + Zustand slices (orchestration state). Validated on a non-combat pilot before the table page. Reasoning + revisit-triggers below.
4. **Sequence** = A1(done) -> A2 -> B -> C(design -> pilot -> propagate, table last) -> D in parallel throughout. Stages A/B run now; Stage C waits for Phase 7 GREEN.

## Execution order - what happens next, automatically (no "which do you want?")

I proceed down this list without asking. Each item: behavior-preserving, gated by tsc + the vitest suite + the arch ratchets, committed and pushed, one `git revert` away. When one finishes I start the next and report progress.

1. **A2 - typed payloads** (in progress next). 
2. **Stage B - conditions subsystem** (after A2; can overlap Stage C's design doc).
3. **Stage C1 - client-state design doc**, then **C2 pilot** (MapView or vehicle), then **C3 propagate** (table page last) - C-anything starts only after Phase 7 is GREEN.
4. **Stage D** - seam-contract + golden-path E2E - matures alongside, coordinated with the Playwright lane.

## The ONLY things that need you (Xero) - and they are not technical decisions

These are bright-line / external actions I will NOT do autonomously. When I hit one I will say exactly what I need; otherwise assume I am proceeding.

- **Applying any schema/config change to the live DB** (Stage B's conditions migration; any RLS/trigger change). I write + dry-run it, then ask you to confirm before it touches live.
- **Operator actions only you can do:** set the read-only DB secret in CI (Tier 3 drift-check), the Upstash KV env vars, etc. I cannot reach the dashboard.
- **A second-opinion review of the Stage C foundation** before C3 bulk propagation. Advisory, not blocking - I will flag when we are there and you decide whether to pull in a human architect. The pilot (C2) is the real de-risker either way.
- **Re-prioritizing** (e.g. "pause hardening, ship feature X"). That is your call; the technical path itself is not.

Nothing in Stages A/B/C touches payments, auth, or public API shape. None of it requires you to choose between engineering options - that is what this document is for.
