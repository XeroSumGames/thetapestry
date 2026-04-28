# Handoff — 2026-04-28

Drop this file into a fresh Claude chat as your first message. It's
self-contained; the new agent doesn't need any prior conversation.

## Who you are working with

Xero (`xerosumgames@gmail.com`). Designer, NOT a programmer — picks
goals and ergonomics, leaves technical decisions to you. Read these
short feedback files in `C:\Users\tony_\.claude\projects\C--TheTapestry\memory\`
before anything substantive:

- `feedback_git_ownership.md` — you handle ALL git/merge/push, don't
  ask permission, the user is technically incompetent on git.
- `feedback_working_directory.md` — user only ever looks at
  `C:\TheTapestry`. After every push from a worktree, run
  `git -C C:/TheTapestry pull origin main` so files you cite exist.
- `feedback_push_to_live.md` — ship everything straight to main,
  Vercel deploy = dev env, user is the only real user.
- `feedback_long_term_fix.md` — root-cause path always wins, surface
  latent bugs even when off-request.
- `feedback_handoff.md` — handoff = file (`tasks/handoff.md`) + chat
  summary, one shot, don't make the user ask twice.
- `feedback_testplan_naming.md` — testplans use descriptive names,
  not generic `testplan.md`.

## Project state — 2026-04-28

- **Live commit:** `b3042ee` (`refactor(table): extract chat into
  TableChat module`).
- **Live URL:** `https://thetapestry.distemperverse.com`.
- **Next playtest:** Mon 2026-05-04. ~1 week of runway.

## What I just shipped (load-times campaign)

Eight commits, all on `main` and live. Full table in
[tasks/loadtimes-roadmap.md](loadtimes-roadmap.md):

1. Soft-nav fixes (`router.push` instead of `window.location.href`).
2. LayoutShell auth check no longer re-runs on every nav.
3. Sidebar `<a href>` → `<Link>` (the missing piece that made #2 actually visible).
4. Table-route `loading.tsx` skeleton.
5. Six gated panels/modals lazy-loaded via `next/dynamic`.
6. NPC popout — `&gm=1|0` URL hint cuts 2 round-trips.
7. Chat extraction (b3042ee, the most recent) — pulled chat code out of
   the 9342-line table page into `components/TableChat.tsx` with hook +
   message-row + list + composer.

The chat extraction was a code-organization win, not a bundle win.
Composer is always visible (default `feedTab='both'`), so dynamic-loading
chat wouldn't help. Don't waste time trying.

## Other shipped today (parallel-session work, all on `main`)

Not part of the load-times campaign — these are feature/polish commits
the new agent should know exist:

- `f9b59dc` — Insight Die spend tracking. New `roll_log.insight_used`
  column ('3d6'/'+3cmod'/null). Extended log card surfaces both
  banners. **Requires `sql/roll-log-insight-used.sql` to run.**
- `03de984` — Bow/Crossbow ammo gate. Attack button disabled when
  `ammoCurrent <= 0` on clip-tracked ranged weapons.
- `32d03d1` — Module cover image upload (publish wizard) + `/modules`
  Import button. **Requires `sql/module-covers-bucket.sql` to run.**
- `9ee175d`, `2f6f9ac`, `03d8c1e` — scene-controls popout layout
  iterations (final: 250×600, 2×2 stepper grid Cols/Rows | Cell ft/Cell px).
- `a9b8a8c` — sidebar rename "Welcome to the Tapestry" → "A Guide to the Tapestry".
- `58eeace` — inline 130-px GM scene-controls strip removed; replaced
  by `Map Setup` header button on the table page that opens a popout.
- `8277be2` — scene-controls popout itself + `lib/scene-controls-bus.ts`
  for popout↔main BroadcastChannel sync.
- `6625a07` — Phase C marketplace: `/modules` browse + `/modules/[id]`
  detail + `/campaigns/new?module=<id>` pre-select.
- `c51b0c0` — `/modules/import` for publishing from a campaign-snapshot
  JSON. Closes the Arena migration loop. **Tested end-to-end and
  confirmed working** on 2026-04-28.
- `173956e`, `150df2b` — neutral disposition recolor: grey → goldenrod/
  yellow palette across picker, roster, and map tokens.
- `990cbce` — Perception/Gut/First Impression log lines read as
  sentences ("Cree successfully uses Perception").
- `078c95b` — Perception/Gut Instinct PC list filtered to player-self
  (mirrors First Impression's existing filter).

## Run-Me SQL (queued — confirm if applied in Supabase)

```
notepad C:\TheTapestry\sql\module-covers-bucket.sql
notepad C:\TheTapestry\sql\roll-log-insight-used.sql
```

Both are idempotent. Without #1 the cover-image upload errors with
"bucket not found". Without #2 inserts silently drop the new column
and the +3cmod Insight Die banner stays invisible (the legacy
`die2 > 6` heuristic still surfaces 3d6 spends).

## Scheduled remote agent

Routine `trig_01DgrfRt5ymUuU4fUf2jzq8N` fires **2026-04-30T16:00:00Z**
(Thu 10am MT). Sweeps three combat-correctness items from the
2026-04-27 playtest: Distract action decrement (silent RLS suspected),
Stabilize action consume verification, post-Stabilize Cree-revival
state. Don't touch those three manually unless something blocks
playtest before Thursday — the agent has the diagnostic context.

## What's next on the roadmap

See [tasks/loadtimes-roadmap.md](loadtimes-roadmap.md) for the
full picture. Recommended order:

1. **A1** — finish the remaining ~28 plain `<a href="/...">` → `<Link>`
   conversions (skip `target="_blank"` and `<a href="#">`). 30 minutes.
2. **A2** — cache `VisitLogger`'s `getUser`/`getSession` so it doesn't
   round-trip on every navigation. 20 minutes.
3. **B2** — rolls feed extraction, mirroring the chat-panel shape. 2-3
   hours. Watch out for `loadRolls(id)` being called from cross-component
   spots (combat events, sprint resolution).
4. **C1** — parallelize the mount-time fetch waterfall (~15 sequential
   queries in the table page's `load()`). 1 day.

## Critical workflow lessons from this session

1. **NO SIDE BRANCHES.** Multiple Claude sessions running simultaneously
   on the same codebase caused chaos when one chat tried a `perf/local-test`
   branch while another shipped equivalent work to main. The side branch
   leaked into other chats and confused the user. Going forward: every
   change goes straight to main per the existing memory.
   If something is genuinely too risky, use a feature flag — flags don't
   fork the working tree.

2. **The user is a novice and trusts you to make technical decisions.**
   Don't ask "do you prefer the hook approach or the component approach?"
   Pick one, explain in plain language what you did, and ship it.

3. **The 9342-line `app/stories/[id]/table/page.tsx` has scar tissue.**
   `nextTurnInFlightRef`, `consumeActionInFlightRef`, `sprintAthleticsPendingRef`,
   stress-threshold detection, the 11-event broadcast switchboard, the
   seq-ref guards on `loadEntries`/`loadInitiative` — these all exist
   because someone paid for a race they hit. Respect them. Don't refactor
   the combat/damage cluster (Tier D) without a regression test or a
   quiet weekend.

## Files to read before starting

- `tasks/todo.md` — the full project backlog (bugs, UX, content, long-term).
- `tasks/loadtimes-roadmap.md` — the perf-campaign plan with shipped + remaining.
- `tasks/PLAYTEST_TODO.md` — items captured during recent playtests.
- `tasks/long-term-fixes.md` — the genuinely-deferred bucket (e.g. tactical-map mouse-drag pan).
- `CLAUDE.md` + `AGENTS.md` — project conventions. Note the 13px minimum
  inline `fontSize` and the banned `13px + #3a3a3a` color combo.

## Don't break

- The combat/initiative invariants (Tier D in the roadmap).
- The notification position (`feedback_notification_position.md`: locked at left:10px).
- Token spawn position (always 1,1 top-left).
- `cell_px = 35` default for `tactical_scenes` (NOT 70 — user caught this twice).
- Stress = 5 modal triggering on WP=0 / RP=0 transitions.

## Open question for the user

None right now. They asked for this handoff because parallel-session
confusion was getting bad. A fresh chat with this file should reset
the agent's context cleanly.
