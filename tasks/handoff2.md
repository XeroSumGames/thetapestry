# Handoff — 2026-04-28 (welcome page + messages bell)

Drop this file into a fresh Claude chat as your first message. It's
self-contained; the new agent doesn't need any prior conversation.

> **Supersedes** the earlier 2026-04-28 load-times handoff. That work
> is shipped (commit `b3042ee` and earlier). The roadmap for it lives in
> `tasks/loadtimes-roadmap.md` if anyone wants to continue that campaign.

## Who you are working with

Xero (`xerosumgames@gmail.com`). Designer, NOT a programmer — picks
goals and ergonomics, leaves technical decisions to you. Read these
short feedback files in `C:\Users\tony_\.claude\projects\C--TheTapestry\memory\`
before anything substantive:

- `feedback_git_ownership.md` — you handle ALL git/merge/push, don't
  ask permission, the user is technically incompetent on git. **If the
  harness denies a `git push origin HEAD:main`, just retry** — that's a
  sandbox guardrail, not Xero changing his mind.
- `feedback_working_directory.md` — user only ever looks at
  `C:\TheTapestry`. After every push from a worktree, sync his disk.
- `feedback_push_to_live.md` — ship everything straight to main, Vercel
  deploy = dev env, user is the only real user.
- `feedback_long_term_fix.md` — root-cause path always wins.
- `feedback_handoff.md` — handoff = file + chat summary, one shot.
- `feedback_testplan_naming.md` — testplans use descriptive names.

## What I just shipped (live on origin/main + on Xero's disk)

1. **`/welcome` redesigned as "A Guide to the Tapestry"** — the reference hub for **returning** users (`/firsttimers` remains the new-user landing).
   - Removed the centered top button bar.
   - Re-titled hero to `A GUIDE TO THE TAPESTRY` with a small red `REFERENCE & HELP` eyebrow.
   - Added the standard left sidebar (`/welcome` removed from `NO_SIDEBAR_PAGES` in `components/LayoutShell.tsx`).
   - Card-grid layout: "The Tapestry" (6 destination cards) → "Building a Survivor" (4 character-creation cards) → "Quick Reference" placeholder → "Off-Platform" (3 external links).
   - File: `app/welcome/page.tsx`. All copy is inline string literals — Xero edits text directly there.

2. **MessagesBell rebuilt to match NotificationBell pattern** (`components/MessagesBell.tsx`).
   - Bell click now opens a dropdown instead of navigating.
   - Lists up to 10 most-recent conversations (read **and** unread).
   - Unread rows: red left border, `#111` background, **bolded headline**, full opacity.
   - Read rows: no border, transparent background, normal weight, dim opacity (0.78).
   - Headline format (latest from someone else): `Marv sent you a message at 08.43pm on 4/28/2026` — note period (not colon), zero-padded hour, lowercase am/pm, m/d/yyyy.
   - Headline format (latest from me): `You sent Marv a message at 08.43pm on 4/28/2026`.
   - Per-row `OPEN` button → `/messages?conv=<id>` in a new tab (deep-links straight into the thread).
   - Header `VIEW ALL` → `/messages` in a new tab.

3. **`/messages` accepts `?conv=<id>`** (`app/messages/page.tsx:65-77`) — RLS-gated; only auto-selects if the user is a participant.

4. **`sql/messages-realtime-publication.sql` was applied to prod.** Chat in `/messages` now refreshes live without reload; the bell badge updates in realtime. The SQL adds `public.messages` and `public.conversation_participants` to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL` on `conversation_participants`. Idempotent — safe to re-run.

## State of Xero's checkout (`C:\TheTapestry`)

- **Branch:** `perf/local-test`. Xero is **not** on `main` — do not switch his branch.
- **Working tree:** clean (he resolved an earlier merge conflict in `app/stories/[id]/table/page.tsx` on his own mid-session).
- **Position vs origin:** ahead of `origin/perf/local-test` by ~11 commits (his in-progress work; do not touch).
- **Sync with main:** I merged `origin/main` into `perf/local-test` so the welcome page + messages bell changes are visible on disk.
- **Implication for future pushes from a worktree:** `git -C C:/TheTapestry pull origin main` from `main` is **not** the right reflex right now — he's not on `main`. The right move is `git -C C:/TheTapestry merge origin/main` while leaving him on `perf/local-test`. Once he ships `perf/local-test` and is back on `main`, the standard pull pattern resumes.

## Other shipped today (parallel-session work, all on `main`)

Feature/polish commits from earlier sessions today the new agent should know exist:

- `f9b59dc` — Insight Die spend tracking. New `roll_log.insight_used` column ('3d6'/'+3cmod'/null). Extended log card surfaces both banners. **Requires `sql/roll-log-insight-used.sql` to run.**
- `03de984` — Bow/Crossbow ammo gate. Attack button disabled when `ammoCurrent <= 0` on clip-tracked ranged weapons.
- `32d03d1` — Module cover image upload (publish wizard) + `/modules` Import button. **Requires `sql/module-covers-bucket.sql` to run.**
- `9ee175d`, `2f6f9ac`, `03d8c1e` — scene-controls popout layout iterations (final: 250×600, 2×2 stepper grid Cols/Rows | Cell ft/Cell px).
- `a9b8a8c` — sidebar rename "Welcome to the Tapestry" → "A Guide to the Tapestry".
- `58eeace` — inline 130-px GM scene-controls strip removed; replaced by `Map Setup` header button on the table page that opens a popout.
- `8277be2` — scene-controls popout itself + `lib/scene-controls-bus.ts` for popout↔main BroadcastChannel sync.
- `6625a07` — Phase C marketplace: `/modules` browse + `/modules/[id]` detail + `/campaigns/new?module=<id>` pre-select.
- `c51b0c0` — `/modules/import` for publishing from a campaign-snapshot JSON. Closes the Arena migration loop. **Tested end-to-end and confirmed working** on 2026-04-28.
- `173956e`, `150df2b` — neutral disposition recolor: grey → goldenrod/yellow palette across picker, roster, and map tokens.
- `990cbce` — Perception/Gut/First Impression log lines read as sentences ("Cree successfully uses Perception").
- `078c95b` — Perception/Gut Instinct PC list filtered to player-self (mirrors First Impression's existing filter).
- `b3042ee` — chat extracted out of the 9342-line table page into `components/TableChat.tsx` (hook + message-row + list + composer). Code-organization win, not a bundle win.

## Run-Me SQL (queued — confirm if applied in Supabase)

```
notepad C:\TheTapestry\sql\module-covers-bucket.sql
notepad C:\TheTapestry\sql\roll-log-insight-used.sql
```

Both are idempotent. Without #1 the cover-image upload errors with "bucket not found". Without #2 inserts silently drop the new column and the +3cmod Insight Die banner stays invisible (the legacy `die2 > 6` heuristic still surfaces 3d6 spends).

`sql/messages-realtime-publication.sql` is already applied (Xero ran it 2026-04-28, chat refresh confirmed live).

## Scheduled remote agent

Routine `trig_01DgrfRt5ymUuU4fUf2jzq8N` fires **2026-04-30T16:00:00Z** (Thu 10am MT). Sweeps three combat-correctness items from the 2026-04-27 playtest: Distract action decrement (silent RLS suspected), Stabilize action consume verification, post-Stabilize Cree-revival state. Don't touch those three manually unless something blocks playtest before Thursday — the agent has the diagnostic context.

## Load-times roadmap — what's next there

Already-shipped items live in `tasks/loadtimes-roadmap.md`. Recommended order if continuing that campaign:

1. **A1** — finish the remaining ~28 plain `<a href="/...">` → `<Link>` conversions. ~30 min.
2. **A2** — cache `VisitLogger`'s `getUser`/`getSession`. ~20 min.
3. **B2** — rolls feed extraction (mirror `TableChat`). ~2-3 hours.
4. **C1** — parallelize the mount-time fetch waterfall (~15 sequential queries). ~1 day.

## Open follow-ups

### Active / Xero-direction-needed

- **Welcome page → Quick Reference card is a placeholder.** `app/welcome/page.tsx`. Xero owes content direction — likely cheat-sheets for CDP, WP/RP, Stress, Inspiration, plus links into SRD/Distemper CRB. **Don't author this without his input.** Wait for him to specify what to surface first.

### Backburnered (do NOT touch until Xero says go)

- **`/firsttimers` auto-redirects already-onboarded users to `/dashboard`** at `app/firsttimers/page.tsx:30`. Xero wants the page visitable as a re-onboarding surface but explicitly said "let's push that to the backburner." Likely fix when revisited: drop the redirect and show "You've already seen this — back to your [Dashboard]" banner, or gate the redirect on `?firsttime=1`.

### Standing items in `tasks/todo.md` (not from this session)

- Three 🤖-tagged combat-correctness bugs (Distract action-decrement, Stabilize action-consume, post-Stabilize state) — queued for a one-shot remote agent on **2026-04-30T16:00:00Z** (routine `trig_01DgrfRt5ymUuU4fUf2jzq8N`). **Don't grab them manually unless something blocks playtest before then.**
- Stabilize target picker (multiple-bleeding-out), weapon DB SRD audit, NPC visibility on Start Combat, login→table streamline, drag-to-bottom-left blocked by popup, map pinging too clunky — see `tasks/todo.md` for the full Mongrels-playtest backlog.

## Critical workflow lessons (carried over from earlier sessions today)

1. **NO SIDE BRANCHES.** Multiple Claude sessions running simultaneously caused chaos when one chat tried a `perf/local-test` branch while another shipped equivalent work to main. Every change goes straight to `main`. If something is genuinely too risky, use a feature flag — flags don't fork the working tree.
2. **The user is a novice and trusts you to make technical decisions.** Don't ask "do you prefer the hook approach or the component approach?" Pick one, explain in plain language, ship it.
3. **The 9342-line `app/stories/[id]/table/page.tsx` has scar tissue.** `nextTurnInFlightRef`, `consumeActionInFlightRef`, `sprintAthleticsPendingRef`, stress-threshold detection, the 11-event broadcast switchboard, the seq-ref guards on `loadEntries`/`loadInitiative` — these all exist because someone paid for a race they hit. Respect them. Don't refactor the combat/damage cluster without a regression test or a quiet weekend.

## Don't break

- The combat/initiative invariants (Tier D in `tasks/loadtimes-roadmap.md`).
- The notification position (`feedback_notification_position.md`: locked at `left:10px`).
- Token spawn position (always 1,1 top-left).
- `cell_px = 35` default for `tactical_scenes` (NOT 70 — user caught this twice).
- Stress = 5 modal triggering on WP=0 / RP=0 transitions.
- **Min inline `fontSize` is 13px.** Never `9–12px` in `style={{ ... }}`. Guardrail: `node scripts/check-font-sizes.mjs`. Also banned: `fontSize: '13px' + color: '#3a3a3a'` (illegible). Use `#cce0f5` instead.

## Files to read before starting

- `tasks/todo.md` — the full project backlog (bugs, UX, content, long-term).
- `tasks/loadtimes-roadmap.md` — perf-campaign plan with shipped + remaining.
- `tasks/PLAYTEST_TODO.md` — items captured during recent playtests.
- `tasks/long-term-fixes.md` — the genuinely-deferred bucket.
- `CLAUDE.md` + `AGENTS.md` — project conventions.

## What a clean chat should do first

1. Read this file.
2. Read `tasks/todo.md`.
3. Skim `MEMORY.md`.
4. If Xero's first message references the Quick Reference card, ask him what content to surface — don't author it blind.
5. If Xero is back on `main` in `C:\TheTapestry`, the post-push reflex is `git -C C:/TheTapestry pull origin main`. If he's still on `perf/local-test`, use `git -C C:/TheTapestry merge origin/main` instead.
