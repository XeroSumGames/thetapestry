# Architecture Review - 2026-05-24 (puffer-fish, post-re-arch)

**North-star question (Xero):** *knowing where we are now, if we were designing a platform to reach this point again, would we use the current architecture? If not, what would have to change?*

**Honest boundary first:** this is Claude reasoning as an architect from the code as it stands. At a 50k-user commercial trajectory touching payments + PII, a real third-party architecture/security review is still warranted before scale. This is the in-house pass, not a substitute for that.

**Method:** read the module layout (app routes, `lib/data`, `lib/realtime`, `lib/` domain, the table hooks/components), the LOC distribution, the dependency rules, the data model as exposed by this session's bugs, and the test strategy. HEAD at review: derive (`git rev-parse --short HEAD`).

---

## One-line verdict

**The layering instinct is right; the layering stops too early.** You would reach this same point and KEEP most of it - but you would add the two layers the current design lacks: a **client-state layer** (so orchestration leaves the route components) and a **schema/conditions-as-code layer** (so the data model is one designed thing, not an accretion). Almost every structural pain this session - the god-components, the realtime publication gap, scattered conditions (infection vs lasting-wound vs stress vs MW), schema drift - traces to one of those two absences.

The Grand Re-Arch was the correct *first* move (you cannot bolt a state layer onto inline `.from` calls - the seams had to come first). It is not the *last* move.

---

## What you'd KEEP (the architecture got these right)

1. **The layered seams.** `lib/data/*` (10 repos) + `lib/realtime/*` (4 primitives: `useCampaignChannel`, `usePostgresSubscription`, `broadcastOnce`, `events.ts` registry). A repository layer for DB + composable realtime primitives is exactly the right shape for a Supabase app. Keep verbatim.
2. **Fitness-function ratchets + dependency-cruiser.** `scripts/check-arch.mjs` (seam-leakage / LOC / console, monotonic) + `.dependency-cruiser.cjs` (no-circular, lib-no-upward, components-no-route-internals) on pre-commit + CI. Very few solo projects enforce architecture mechanically. This is the single best thing in the codebase and is why the re-arch can't silently rot. Keep + extend.
3. **Pure-domain `lib/` modules + unit tests.** 67 `lib/` modules, 548 Vitest tests over the rules engine (roll-helpers, damage, community-logic, campaign-clock, encumbrance, cdp-costs, xse-engine...). The TTRPG rules belong in tested pure functions, and they are. Keep.
4. **Supabase as the backbone** (Postgres + RLS-as-authz + realtime + edge functions). Correct platform call for a two-of-us team: RLS pushes authorization into the DB so the client can't be the only gate. Keep.
5. **Observability for a small team** - `trace()` -> recorder buffer, Sentry with PII scrub + sample rate, `/api/health`. Right-sized. Keep.

## What you'd CHANGE if designing from scratch

### 1. Introduce a client-state layer (the big one)
**Symptom:** `page.tsx` 10,557 LOC, TacticalMap 4,301, CampaignCommunity 3,059, NpcRoster 2,295, vehicle 2,076, MapView 2,022. The re-arch seamed data *access* but state *orchestration* still has nowhere to live except the route component.

**Root cause:** there is **no client-state architecture** - zero React Context, no React Query / SWR / Zustand / Redux. State is module-level caches (`auth-cache.ts`) + per-component fetches + local `useState` in the route. So the route component is forced to own fetch + cache + realtime-wiring + orchestration + render for its entire surface. That is *why* the god-components exist; extracting hooks (useGmTools, useRollResolution) helped but the page is still 10.5k because the orchestration has no home.

**From scratch:** a server-state cache (TanStack Query) so components declaratively subscribe to seam queries without the route owning fetch+invalidation, OR per-feature stores/state-machines (Zustand slices: combat, initiative, realtime, table-view) that own their state and the route just composes them. Either gets the route under ~500 lines *structurally*, not by willpower against a ratchet.

### 2. Make the data model one designed thing, not an accretion
**Symptoms (all seen this session or in the pre-launch audit):**
- 234 `sql/` migration files, **15 orphan tables** with no canonical CREATE TABLE.
- `roll_log.outcome` overloaded for 3 purposes (roll result / event tag / grapple).
- `damage_json ... as any` (untyped payload; 574 `as any` total).
- roll narrative *parsed back out of label text via regex* (`compactRollSummary`).
- the **realtime publication gap** we fixed today: 6 tables were subscribed in code but never `ALTER PUBLICATION`-ed, silently dead, and that membership was not in version control.

**From scratch:** one declarative schema as the source of truth; typed JSON payloads (`DamagePayload`); structured columns instead of label-regex; and **all Supabase config (publication membership, RLS policies, triggers) in versioned migrations applied by CI** - never hand-toggled in the dashboard. The orphan tables, the dashboard-only triggers, and the publication gap are one class of bug: *infra that isn't code.*

### 3. Conditions/status as a unified subsystem
**Symptom (this session's whole saga):** infection is `character_states` columns, lasting wounds are roll_log-feed-parsed, stress is a column, mortal-wound is a `death_countdown` column. **Four conditions, four different models, four lifecycles.** That scattering directly caused: Restore-didn't-clear-infection, the invisible-infection confusion, and the lasting-wound chip being a "fast-follow" because it has no column to read.

**From scratch:** one conditions model (or table) with a consistent lifecycle (apply / clear / expire-via-clock), one render path (the status chips), one reset path (Restore clears the set). The chips component we shipped today is the right *shape*; it should sit on a uniform conditions source, not four ad-hoc fields.

### 4. Build the test pyramid, not just the base
**Symptom:** 548 unit tests, but every failure that actually bit a player this session - realtime desync, the publication gap, the stale in-memory read - is invisible to unit tests. The detector has been a human with two browser windows.

**From scratch:** the integration/E2E layer (the Playwright "final test" suite, now being built) exists from early, plus contract tests on the seams (a repo function's shape, a channel's payload). Keep the strong unit base; add the layers above it.

---

## Why it ended up this way (not a criticism - context)

This is an **organically-grown app being retrofitted toward a designed one**, by a solo dev + AI, shipping straight to prod the whole time. That path produces exactly this signature: strong domain logic (the fun part, well-tested), accreted schema (each feature added its columns), god-components (no state layer was ever chosen, so the route absorbed everything), and infra-by-dashboard (fastest to ship). The re-arch is the first deliberate correction. The fact that there is now a seam + a ratchet to *hold* the correction is what makes the next moves possible.

---

## The sequenced answer to the north star

Would we use the current architecture to get here again? **Yes for the bottom (seams, ratchets, pure domain, Supabase) - that's the load-bearing 60% and it's sound.** No for the top: we'd add the client-state layer and design the data model + conditions as code from the start. In priority order, the moves that "design it right" from here:

1. **Client-state layer** (TanStack Query or feature stores) - dissolves the god-components structurally. Highest leverage; unblocks everything else. Do it behind the seams that already exist.
2. **Conditions subsystem** - unify infection / lasting-wound / stress / MW into one model + one render + one reset. Medium effort, kills a recurring bug class.
3. **Infra-as-code** - publication, RLS, triggers, orphan-table schemas into versioned CI-applied migrations. Closes the silent-config-bug class (the one that cost an hour today).
4. **Typed payloads + de-regex the feed** - `DamagePayload`, structured roll_log columns. Pays down the `as any` + label-parsing debt.
5. **E2E + seam-contract tests** - the layer that catches what unit tests can't. Already in motion.

None of these are emergencies; the platform works and the re-arch made it defensible. They are the difference between "retrofitted" and "designed." Recommend tackling #1 as the next big puffer-fish initiative once Phase 7 acceptance closes - and it should get a real design doc + (eventually) a human architect's eyes before a big client-state migration, since that touches every surface.
