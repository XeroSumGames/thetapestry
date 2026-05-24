# Platform Hardening Roadmap - 2026-05-24

Turns the architecture review (`tasks/architecture-review-2026-05-24.md`) into an execution plan, sequenced for **Xero's actual goal: get back to content + polish without the platform fighting him.**

## The reframe (read this first)

"Perfect" is the wrong target - it's unbounded and never lets you step away. The right target is **"de-risked enough to go heads-down on content."** Critically: the 5 architecture moves split into two very different buckets:

- **INSURANCE** (cheap, removes recurring pain + catches regressions while you're away) - do these before stepping back.
- **RENOVATION** (expensive, improves long-term velocity/scale, touches everything) - a deliberate initiative, NOT a prerequisite for content.

The platform is ALREADY in a "you can do content" state - the re-arch made the god-components defensible (seams + ratchets). Everything below is about *how much insurance you want* before stepping away, plus one renovation you schedule for later.

---

## Recommended sequence

### 0. Close Phase 7 (in flight, ~1 session of Xero smoke-time)
Finish the re-arch acceptance: Section B (vehicle) at the 2026-05-25 Minnie playtest + D/E re-test (publication fix is already live). Then demote Realtime YELLOW, promote re-arch -> PLAYTESTED, archive the decomposition sheet. **This must close before starting any architecture move** - don't stack renovation on an unverified foundation.

### 1. Infra-as-code (INSURANCE - do first) - HIGH value, LOW risk, ~3-5 sessions
**Why first:** the silent-config bug class is what cost an hour today (the realtime publication gap) and is the scariest "step away and it breaks with no warning" risk. Closing it is pure insurance.
- Capture the `supabase_realtime` publication membership in a versioned migration (started today: `sql/realtime-publication-fix-2026-05-24.sql`) + add the 3 held tables after triage (`characters`, `war_story_replies`, `forum_thread_reactions`).
- Reverse-engineer the **15 orphan tables** into canonical CREATE TABLE files in `sql/` (pattern exists: `sql/000-initiative-order-canonical-2026-05-17.sql`).
- Capture dashboard-only RLS policies + triggers into versioned `sql/` files.
- Add a schema-drift check (compare live `information_schema` to `sql/`) - even a manual `scripts/check-schema-drift` you run pre-playtest.
- **Decision needed from Xero:** none - this is documenting existing state. Just time.

### 2. E2E + seam-contract tests (INSURANCE - parallel, already in motion) - HIGH value, ongoing
**Why:** the regression net. Unit tests (548) can't catch realtime desync / the publication gap / stale reads - exactly the bugs that bit this session. With an E2E net, content changes that break a surface fail CI instead of failing at the table.
- The hunt/e2e lane is building the Playwright "final test" suite (Tier 1 multi-context shipped). Puffer-fish role: make CI run it, and add **seam-contract tests** (a repo fn's shape, a channel's payload type) so the seams can't drift silently.
- **Decision needed:** none - support the lane already doing it.

### 3. Conditions subsystem (INSURANCE-ish - do if you want the bug class gone) - HIGH value, MEDIUM risk, ~1-2 weeks
**Why:** this session WAS this bug, four times (Restore-not-clearing-infection, invisible-infection, lasting-wound-has-no-column, the stale read). Infection/stress/MW/incap/lasting-wound are modeled four different ways. Unifying them kills the recurring class AND makes future content (new conditions, status display) trivial - which is exactly the content work you want to get back to.
- **Decision needed from Xero (data model):** one `conditions` table (character_id, kind, severity, expires_at, meta) vs. consolidating onto `character_states` columns + a `lasting_wounds` column. Needs a short design doc first.
- One model -> one render (the chips, already built) -> one reset (Restore, already clears most) -> one lifecycle (apply/clear/expire-via-clock).
- Schema-touching = bright-line, confirm before migrating.

### 4. Client-state layer (RENOVATION - DEFER, schedule deliberately) - the big one, HIGH risk, multi-week
**Why it's NOT a content prerequisite:** the god-components are ugly but they WORK and are now defensible. This move is about long-term dev-velocity + scale (50k users), not stepping-away stability. Doing it now would DELAY content, not enable it.
- When you do schedule it: pick the lib (recommend **TanStack Query** as the server-state cache wrapping the existing seams, realtime invalidates the cache; optionally Zustand for ephemeral UI state), write a design doc, migrate ONE small god-component first (moderate or vehicle), prove the pattern, then roll outward behind the seams.
- **Decision needed:** lib choice + a real design doc + (recommended) a human architect's eyes before committing, since it touches every surface. Not now.

### 5. Typed payloads + de-regex the feed (DEBT - opportunistic) - MEDIUM value, LOW risk
`DamagePayload` interface + structured `roll_log` columns to replace label-regex parsing. Pays down the `as any` (574) + brittle-label debt. Do opportunistically when touching those files; not a scheduled blocker.

---

## The minimum bar to get back to content

**Close Phase 7 + do #1 (infra-as-code) + #2 (E2E net).** That's the insurance: no silent-config surprises, and regressions fail CI instead of at the table. **#3 (conditions)** is strongly recommended because it directly removes the bug class that keeps interrupting content work - but it's a judgment call on whether to spend the 1-2 weeks now or live with the scattered model.

**#4 (client-state) and #5 (typed payloads) are explicitly NOT required to step away.** #4 is a future renovation you schedule when velocity/scale demands it; #5 is opportunistic.

So: **3 insurance moves (0, 1, 2) are the real "ready for content" gate; #3 is the high-value optional; #4-#5 wait.** That is the difference between "I chased perfect and never shipped content" and "I de-risked the scary parts and got back to the fun."
