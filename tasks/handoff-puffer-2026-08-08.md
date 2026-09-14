# Puffer Fish handoff - 2026-08-08 (context-limit handoff)

Written because this session hit its context limit mid-task. Every fact below was
verified against git/disk at write time - **still treat it as a claim to
re-check, per the Handoff accuracy contract**, especially the uncommitted state
since it's actively being edited by two people (Xero + Claude) in real time.

The full, authoritative version of this handoff is the chat message pasted into
the new session - this file is a durable backup in case that gets lost.

## Where things stand

- **You are Puffer Fish, hub.** Worktree `D:\Coding\VTTs\TheTapestry-puffer`,
  branch `lane/puffer`. It is BEHIND `origin/main` by a pile of automated
  health-pulse/security-audit commits (nothing real) - `git pull` before doing
  anything there.
- **BUT: tonight's live work is happening in the PRIMARY checkout**,
  `D:\Coding\VTTs\TheTapestry` (branch `main`), NOT this worktree. Xero
  established a new rule this session (see below) that UI/visual work gets
  edited directly on whatever checkout the running dev server serves, verified
  on localhost, then shipped - and tonight that's been the primary checkout.
  Check `git status` there FIRST before assuming anything about repo state.
- The dev server (`npm run dev`, Next.js/Turbopack) has been running for
  hours straight and periodically hits memory pressure - either a soft
  "approaching threshold, restarting" (self-heals in ~6s, harmless) or a hard
  V8 "JavaScript heap out of memory" crash (needs Xero to manually restart
  `npm run dev`). Both are confirmed benign / not code bugs - do not chase
  either as a real problem, just explain and move on if Xero pastes one.

## CRITICAL: uncommitted work sitting in the primary checkout right now

`D:\Coding\VTTs\TheTapestry` has a large, coherent, HOT-RELOAD-VERIFIED but
**NOT YET COMMITTED** batch: a full onboarding-tour redesign + a big polish
pass on top of it, all done live with Xero watching on `localhost:3000`. As of
this handoff:

```
 M app/dashboard/page.tsx
 M app/rules/page.tsx
 M app/welcome/guide/page.tsx
 D  app/welcome/page.tsx
 M components/LayoutShell.tsx
 M components/MapView.tsx
 M components/Sidebar.tsx
 M components/WelcomeModal.tsx
 M tasks/lessons.md
 D  lib/onboarding-sections.ts
?? app/quick-reference/
?? lib/onboarding-tour.ts
```

**Do not `git add .` when this ships** - HP already flagged this explicitly:
add files by name. There should be NO stray files riding along (a stray
`sql/add-a24-state-2026-08-06.sql` DID sneak in earlier tonight from an
unrelated session - see "Stray file incident" below - already removed once,
watch for it or similar mistakes recurring).

### What this batch actually is (read `lib/onboarding-tour.ts`'s own header
comment first - it explains the whole system)

A stepped, replayable "welcome tour" modal (`components/WelcomeModal.tsx`),
content-driven entirely from `lib/onboarding-tour.ts` (the ONE file to edit
for step order/text/position - HP consolidated everything there specifically
so future edits don't need to touch the component). Shows automatically to
new users on `/dashboard` (`profiles.onboarded = false`), and is replayable
any time via the sidebar's "A Guide to the Tapestry" link
(`/dashboard?tour=1`). Each content step can point an animated arrow+box at a
real sidebar element (tagged `data-tour="..."` in `Sidebar.tsx`) and the whole
modal is draggable. `/firsttimers` and the old static `/welcome` page are both
DELETED (Xero's explicit go) - their content moved to a new `/quick-reference`
page.

Calibration mode: `/dashboard?tour=1&cal=1` shows a live x/y readout + "copy"
button on the drag handle, so a step's fixed screen position can be captured
by dragging and pasting `pos: { x, y }` into its `TourStep` block. This is
THE mechanism Xero uses to iterate on positioning - if he pastes a
`pos: { x: N, y: N }` line without saying which step, ASK which step (this
came up once already, don't assume).

### Everything done in this batch tonight, in order

1. Stepped tour built (arrow/box anchors per step, draggable modal,
   `cal=1` calibration mode) - `8a290e17`, already committed/shipped earlier.
2. `/welcome` repointed to launch the tour over `/dashboard` instead of its
   own static page; `/firsttimers` deleted - `c1125340`, already shipped.
3. **This currently-uncommitted batch** (Xero's live polish pass, item by
   item, all applied and hot-reload-verified, tsc/font/em-dash clean):
   - Moved the "Good luck, `<username>`" greeting to render AFTER the welcome
     pitch paragraphs, not before (`WelcomeModal.tsx`).
   - Section step titles now render in the Distemper font (applied to ALL
     7 content-section titles, not just a subset - Xero's instruction said
     "steps 2-6 of 6" but there are actually 9 total steps; I applied it
     universally as the one-coherent-rule reading and FLAGGED this to him,
     no confirmation received yet before context ran out - check if he wants
     it narrower).
   - First tour video now points at `0L86NMSh7uw` (Xero's chosen YouTube ID).
   - `VIDEO_HEADING` changed from "Watch & Learn" to "Watch to Learn More".
   - Added a tiny inline markup parser (`renderInline()` in
     `WelcomeModal.tsx`) supporting `**bold**` and `*italic*` in any body/list
     string in `lib/onboarding-tour.ts` - this is the answer to Xero's "how do
     I italicize text" question, and it's what's used for the next item.
   - Bolded "Backstory Generation" / "The Quick Character Generator" / "The
     Random Character Generator" / "Paradigms" in the Your Characters step's
     body text (also fixed a pre-existing "Pardigms" typo -> "Paradigms"
     while in there).
   - The Dashboard's `data-tour="dashboard"` box/arrow now also covers the
     "Quick Reference" sidebar link (that link had no `data-tour` tag before -
     added it in `Sidebar.tsx`).
   - Reordered the sidebar's Survivors links: was Creating a Survivor / Random
     / Quick / Backstory / Paradigms -> now Creating a Survivor / **Backstory**
     / Quick / Random / Paradigms (Xero's explicit new order - I updated a
     stale code comment that documented the OLD "Random first" onboarding
     rationale from a past decision, since the new order + the tour text's own
     "[Recommended]" label on Backstory Generation are now consistent with
     each other, not with the old comment).
   - Moved the "Rumors" tour step from its old position (7th of 7 content
     steps, right before Your Pins) to right after "My Communities" - it's now
     the 4th content step (immediately before The Campfire).
   - **Left-aligned 5 steps' modal position** at a shared `x: 259` (Dashboard,
     Your Characters, My Stories, My Communities, Rumors), each keeping its
     own calibrated `y`. Xero handed me all 5 coordinates via the `cal=1`
     workflow; I normalized "Your Characters"' x from his earlier-captured 266
     down to 259 to match his stated "same left edge" intent, and FLAGGED that
     normalization to him - no pushback received before context ran out, but
     it was never explicitly confirmed either.

### What's NOT resolved / needs the next session's attention first

1. **Ship it.** Nothing in this batch has been committed. Once Xero says it
   looks right on localhost, commit with files named explicitly (not `.`),
   run tsc/font/role/em-dash/arch/tests, push straight to `main` (per the
   established "push to live" norm for everything except the localhost-first
   UI-verify step itself), then sync `lane/puffer` too if convenient.
2. **Confirm the Distemper-font scope** ("all 7 section titles" vs. a
   narrower "steps 2-6" reading) and whether the "Your Characters" x=266->259
   normalization was correct - both flagged to Xero, neither explicitly
   confirmed.
3. Xero's title-list message earlier (while requesting the Distemper font
   change) listed step titles with some appearing twice (Campfire, Your Pins)
   - I read this as him just listing what he was seeing, NOT a rename
   instruction, and made NO title renames. If he actually wanted specific
   titles changed, that's still open.

## Standing rules established or reinforced THIS session (read these)

- **UI/visual changes verify on localhost before shipping to prod** - new
  this session, narrows the old "push to live, test on live" default. Applies
  to every lane, not just Puffer. Memory: `feedback_ui_changes_localhost_first`.
  Backend/SQL/logic-only changes with nothing to eyeball are unaffected, still
  push straight to live as before.
- **Every question for Xero routes through Comms, no exceptions** - even a
  quick clarifying question, even when he's live in your chat. Corrected THIS
  session after I asked him a couple of direct questions early on; both
  `tasks/lane-protocol.md` and `tasks/operating-mode.md` had a stale
  "day-to-day questions are fine to ask directly" carve-out that's now
  removed. Memory: `feedback_all_questions_via_comms`. **Caveat found by
  practice, not yet written into the doc**: this clearly does NOT cover tight,
  real-time back-and-forth Xero himself initiates (e.g. him handing over
  calibration coordinates one at a time and me asking "which step is this
  for?") - that's normal conversation, not a "buried question." Use judgment;
  when in doubt on a genuine decision/open question, route it through Comms.
- **Dev-server crashes tonight are a known, benign pattern** - long Turbopack
  session + heavy HMR churn = climbing memory, eventually a soft
  self-recovering restart or a hard OOM crash needing a manual `npm run dev`
  restart. Not a code bug either time it happened tonight. Explain and move
  on if it recurs.
- **`git push origin lane/puffer:main` needs the explicit refspec** - `git
  push origin main` alone tries to push a literal local branch named `main`
  (which may not exist/be current in this worktree) and fails non-fast-forward.
  Always use `<local-branch>:main`.

## Stray file incident (resolved, just context)

A file `sql/add-a24-state-2026-08-06.sql` appeared untracked in the primary
Tapestry checkout mid-session - confirmed (by content) to be a migration for
**TheTable's** `/a24` page, not Tapestry, almost certainly written there by a
different session pointed at the wrong working directory. Per AGENTS.md's
commercial-repo-mixing rule it does not belong here. It was never committed;
moved (not deleted) to this session's scratchpad to avoid losing whatever
work it represented:
`C:\Users\tony_\AppData\Local\Temp\claude\D--Coding-VTTs-TheTapestry-puffer\9770c07e-328f-46a1-8351-7adcfb64f9df\scratchpad\add-a24-state-2026-08-06.sql`.
TheTable's actual repo is at `D:\Coding\VTTs\TheTable` (confirmed via
`list_sessions` - there's a live "Table | Puffer Fish" session rooted there)
if it's worth relocating there properly.

## The four-session model (unchanged)

- **Puffer Fish (you) = hub.** SQL/RLS/hot-file review+merge+push to `main`.
- **Hunt & Peck = spoke.** `local_768fb632-be00-4533-8515-6b35bd0e7402`,
  worktree `D:\Coding\VTTs\TheTapestry` (branch `main`) - same checkout the
  uncommitted onboarding batch above lives in. Self-ships app-code/UI.
- **Playwright/E2E = spoke.** `local_164a2ea8-1b2f-414a-89af-f523ad3fb795`,
  worktree `D:\Coding\VTTs\TheTapestry-e2e`.
- **Comms.** `local_06d29c36-1657-448e-a310-9546d6559161`, worktree
  `D:\Coding\VTTs\TheTapestry-comms`. Owns `tasks/COMMS.md` + the smoke
  testing workbook. ALL questions for Xero route here now, see above.
- Coordinate via `mcp__ccd_session_mgmt__send_message` /
  `list_sessions` directly - Xero never relays between sessions.

## Everything shipped and closed out earlier tonight (before the onboarding
work), already committed - full detail in `tasks/todo.md` and
`tasks/decisions.md`, not repeated here:

- `campaign_members` <-> `characters` circular RLS recursion (blocked a
  player from assigning an existing character mid-playtest) - fixed, verified.
- `world_npcs` moderation RLS - Thrivers couldn't approve/reject another
  user's submission - fixed, verified.
- Realtime reconcile-net gaps on 5 of 6 table-page channels (root cause for
  NPC-reveal-toggle friction reported after the 2026-08-03 playtest) - fixed
  by HP, verified live.
- portrait-bank confidentiality (separate private bucket + signed URLs),
  account-deletion anonymize (schema+UI, all 7 tables), Observer mode
  (button + primary invite-link option, GM-of-own-campaign excluded),
  District Zero "BB's" wallet (two-row pip counter, gated to
  `district_zero` setting), My Stories two-column layout (+ width fix,
  720px->1100px page / 300px->420px column basis) - all shipped, all
  verified live, all in git log if detail is needed.
- Observability sweep Batch 1 (green-lit by Xero via Comms) - HP shipped,
  surfaces ~12 previously-silent write failures.
- `CommunityMoraleModal.finalizeAndSave()` has no transaction across 7+
  writes - real bug, logged in `todo.md`, NOT yet fixed, Puffer's lane
  (needs an RPC), not urgent.

## Immediate next step for the new session

1. `git status` in `D:\Coding\VTTs\TheTapestry` to confirm the uncommitted
   batch above is still there and matches this description.
2. Pick up the conversation where Xero left off - he was mid-iteration on
   the onboarding tour polish. Expect him to keep handing over small
   adjustments (positions, wording, more markup) the same way he has been -
   this is a live, fast, direct back-and-forth, not a slow formal review.
3. Once he says it's ready, ship the batch (see "Ship it" above).
4. `git pull` in the `lane/puffer` worktree before doing any SQL/RLS work -
   it's behind on nothing but automated commits, but stay current.
