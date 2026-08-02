# Lane Protocol - three parallel Claude chats (2026-05-24, hub/spoke model added 2026-08-02)

How the three always-on chats stay harmonious. Drafted by the Playwright/E2E
lane after a session that hit every coordination failure mode first-hand
(shared-working-tree clobbers, a duplicated todo section, repeated rebases).
Routed to Puffer Fish (owns `operating-mode.md` + coordination scaffolding) -
the "Proposed operating-mode.md edit" at the bottom is the diff to apply.

Companion to `tasks/operating-mode.md` ("Multi-chat lanes" section, which still
describes only TWO lanes and should be updated - see bottom).

---

## Hub & Spoke model (2026-08-02) - governs everything below

Adapted from the pattern Xero validated running TheTableau's Puffer Fish hub.
**Puffer Fish is the hub; Hunt & Peck and Playwright/E2E are spokes.**
Live claim + retirement rule: `tasks/HUB-LIVE.md`. Open questions / decisions
in flight: `tasks/COMMS.md`.

- **Hub (Puffer Fish) is the only chat that reviews, merges, and pushes
  SQL/RLS/shared-hot-file work to `main`.** It owns integration and
  cross-file reconciliation for that category of change, and applies
  anything touching the live database after its own review pass.
- **Graduated gate, not a blanket one.** Pure UI/feature work in Hunt &
  Peck's own files can still self-ship straight to `main` exactly like
  before - the hub gate is specifically for SQL/RLS/`sql/`-touching work
  and anything in a file the hub has flagged as hot/shared. E2E's spec
  work is almost purely additive and stays self-ship too. When in doubt,
  a spoke hands off a SHA rather than assuming self-ship is fine - **the
  hub reviews the actual diff, not just the spoke's summary**, before
  confirming a merge, especially for anything SECURITY DEFINER or RLS.
- **Cross-session coordination is direct, not manually relayed.** Verified
  2026-08-02 (corrects the "these chats cannot message each other" claim
  in the original "What this protocol CANNOT do" section below, written
  2026-05-24 before this tool was in use): the hub uses
  `mcp__ccd_session_mgmt__send_message` to deliver directly into a spoke's
  session (arrives as a labeled turn, processed once that session's
  in-flight work finishes), and a spoke replies the same way back to the
  hub's session id. `list_sessions` finds a lane's live session id by
  title/cwd. **Xero does not relay between sessions, ever, unless he
  explicitly says to** (confirmed 2026-08-02, after he redirected a lane
  that asked him to pass something along back to using this channel
  directly) - always use `send_message` yourself, never write "or have
  Xero relay it" as a fallback in a hand-off message.
- **Why graduated, not everything through the hub:** even with direct
  session messaging, hub review of every commit has a real cost
  independent of how the SHA gets there - reading a diff carefully takes
  time regardless of transport. Gating EVERYTHING would slow Hunt & Peck's
  high-frequency day-to-day shipping in proportion to volume, not risk (a
  button color change doesn't carry the same risk as an RLS policy).
  Gating the risky category (SQL/RLS/hot-files) captures the real value -
  the 2026-08-01 audit found ~40 bugs shipped with zero review, several
  CRITICAL, one bug shape (moderation self-approval) recurring across 7
  unrelated tables - without slowing routine UI shipping proportionally
  more than the risk warrants.
- **Reproduce before claiming fixed.** A spoke reproduces an issue for
  real (not just by reading code) before handing the hub a SHA. Gate
  locally first (tsc/tests/arch/font/role/em-dash - the existing
  pre-commit suite already does this).
- **Never infer who's hub from who spoke most recently** - always read
  `tasks/HUB-LIVE.md`. Writing a handoff = immediate retirement; the next
  hub claim overwrites that file and pings every lane, not just the
  active one.

---

> **All three lanes align to ONE anchor: [tasks/north-star.md](north-star.md)** - the validated vision. Its whole purpose is to keep the lanes moving the SAME direction with no contradictions or overlaps. Read it, prioritize against it, and lead every handoff with it. (Goal now: TheTapestry stable/polished/fun for the 9/1 Kickstarter; billing ~10/1 post-KS.)

## The three lanes

| Lane | Owns / decides | Edits (hot files) | Collision profile |
|---|---|---|---|
| **Hunt & Peck** | Tactical bug fixes, feature ships, narrative, modal migrations, day-to-day shipping. | `app/`, `components/`, `lib/` - incl. the table page. The ONLY lane that edits app code. | Sole owner of app code, so low CROSS-lane collision there; high churn within. |
| **Puffer Fish** | Architecture, risk, security, audits, observability, SQL/RLS/triggers, Risk Register, the operating docs (`operating-mode.md`, `debug-handoff.md`, `handoff.md`), lessons/decisions infra. | `tasks/*.md` (owned docs), `sql/`. | Owns the meta-docs; others propose-don't-edit them. |
| **Playwright / E2E** | The automated suite + its plans: `e2e/`, `playwright.config.ts`, coverage map, test plans, the results dashboard. Surfaces regressions + findings to the right lane. | `e2e/` (almost purely additive - new spec files), `tasks/*testplan*.md`. READS app code, rarely edits it. | Lowest collision. Runs against PROD - no local dev server needed. |

## Tiebreaker (when it's unclear which lane owns a thing)

1. New/changed **test or coverage** -> E2E.
2. **Structure / risk / security / SQL / the operating docs** -> Puffer Fish.
3. A specific **user-facing fix or feature** -> Hunt & Peck.
4. Still ambiguous, or it belongs to another lane: the chat that noticed it
   **writes a `todo.md` line and lets the owning lane pick it up** - do NOT
   cross-edit another lane's hot files (that is how stomps happen). (This is
   exactly how the E2E lane routed the map_pins security finding to Puffer Fish:
   `tasks/security-finding-map-pins-moderation-2026-05-24.md` + a todo pointer.)

---

## Setup: ONE git worktree per lane (the highest-leverage change)

Today all three chats share the single `C:\TheTapestry` checkout - same working
tree, same branch pointer. That is the root of most coordination pain: one
lane's commit moves `HEAD` under another mid-edit; foreign untracked files
appear in your `git status`; the careful "re-apply my edit, never cp my stale
copy" dance is needed on every shared-doc commit; a worktree+rebase+reset slip
duplicated a `todo.md` section this session.

**Give each chat its own checkout** (a real git worktree off `main`):

```
# Hunt & Peck keeps the primary C:\TheTapestry (stays on main).
# The other two get their OWN branch off origin/main - git forbids checking out
# `main` in two worktrees at once, so each lane works on its own branch and
# rebase-pushes to main (git push origin HEAD:main).
git worktree add -b lane/puffer C:\TheTapestry-puffer origin/main
git worktree add -b lane/e2e    C:\TheTapestry-e2e    origin/main
```

- Lanes then collide ONLY at push time (a normal rebase: `git pull --rebase`, or
  `git push origin HEAD:main` then rebase on non-ff), never in the working tree.
- Each lane lives on its own branch (`lane/puffer`, `lane/e2e`) and pushes to
  `main`; Hunt & Peck commits to `main` directly from the primary checkout.
- All worktrees share one `.git`, so every commit/branch is visible across lanes
  immediately.
- Run `npm install` once per worktree - **mandatory, not optional**: a SIBLING
  worktree (e.g. `C:\TheTapestry-e2e`) has no `node_modules`, and module
  resolution does NOT walk into the primary checkout's, so the pre-commit hook's
  tools (depcruise, tsc, vitest) aren't found and EVERY commit fails until you
  install. (Worktrees NESTED under `C:\TheTapestry\.claude\worktrees\` inherit
  the primary's `node_modules` by parent-dir resolution - that is why the
  ephemeral commit-worktrees work without install; siblings do not.) The E2E
  worktree does not need a dev server (it targets prod); Playwright's chromium is
  a shared system cache, so only `node_modules` needs installing. Hunt & Peck's
  primary checkout keeps the local dev server.

If keeping a single shared checkout for now: each lane MUST commit via an
isolated throwaway worktree off `origin/main` (cp/re-apply only its own files,
push, rebase on non-ff, then `git reset --mixed origin/main` to resync the
pointer WITHOUT touching others' uncommitted WIP). That is what the E2E lane
does today - it works but is fiddly; per-lane worktrees retire the fiddliness.

## Committing on the shared remote (all lanes)

- Small, frequent commits shrink the divergence window.
- Non-fast-forward on push is NORMAL (another lane pushed) - rebase and re-push,
  don't panic. Never force-push `main`. Never `--no-verify`.
- The pre-commit hook + gates (tsc, font, role-literal, em-dash, preview-sync,
  arch ratchet, unit tests) run regardless of lane and catch cross-lane breakage.
- **Under the hub model (above):** this section still describes how EACH
  chat pushes its own commits (the hub pushes its own reviewed work AND
  a spoke's cherry-picked SHA the same way). What changed is who's
  authorized to push SQL/RLS/hot-file spoke work directly - that now
  routes through the hub first rather than a spoke self-pushing it.

## Shared-doc discipline (`todo.md`, `lessons.md` - the only files all 3 write)

- Each lane writes to its OWN clearly-headed section (lane-prefixed).
- APPEND; do not rewrite neighbouring content. When committing a shared doc,
  re-apply your edit onto the LATEST version - never cp your stale working copy
  over it (that reverts another lane's work).
- **Proposal (Puffer Fish to decide, owns the doc infra):** split the backlog
  into `todo-huntpeck.md` / `todo-puffer.md` / `todo-e2e.md` + a thin shared
  index. Removes the merge-stomp class entirely.

## Live status board: `tasks/active-lanes.md`

Each chat updates its row at the START and END of a work batch: lane / current
focus / files touching now / HEAD. Lets the other two steer clear of the same
area - the one thing the substrate can't otherwise show (no chat sees another's
in-flight thinking). `scripts/start-session.sh` already flags doc staleness;
this adds "who is hot on what, right now."

## Cross-lane safety net: the E2E suite

After a batch of cross-lane commits (or before any "is it stable?" call), run
`npm run test:e2e` (E2E lane, against prod). It validates the INTEGRATED result
of all three lanes' work - not just one lane's slice. `retries: 2` absorb prod
transients; a real regression fails every attempt. This is the shared green
light. (It is how this session's section-c regression would have been caught no
matter which lane introduced it.)

## E2E results dashboard - ONE persistent living file (Xero, 2026-05-27)

The E2E lane keeps a SINGLE canonical results record at **`tasks/e2e-results.html`**.
It is a LIVING file: after every full `npm run test:e2e` re-cert, update it IN
PLACE - refresh the status banner + summary cards, append a dated CHANGELOG entry
(newest first, never delete history), and add/flip the spec rows + coverage
matrix. **Never spin a new dated copy** (the old `e2e-results-YYYY-MM-DD.html`
snapshots were consolidated into it and removed). This file is both the current
dashboard AND the complete history of what the lane has shipped, so "is this
logged anywhere?" never has to be asked again. (Playwright's own
`playwright-report/index.html` is gitignored + overwritten each run - a throwaway
view of the last run only, NOT the record.) Mirrored in memory
`reference_e2e_results_dashboard`.

## Hard-earned rules (adapted from TheTableau's hub, 2026-08-02)

General principles that held up running a hub there - not TheTableau's
specific bugs, which don't transfer. Cross-referenced against what
Tapestry has already independently learned the hard way, where it applies:

- **A silent refusal is a bug.** Every guard that blocks an action (an RLS
  policy, a disabled button, a trigger that no-ops) must surface WHY, or
  it just looks broken. Tapestry's own version of this: the 2026-08-01
  audit found several places where a write silently affected 0 rows with
  no error surfaced to the caller (`tasks/lessons.md`, duplicate-policy
  entries) - the fix pattern is the same, make the block loud.
- **Verify second-hand claims by reading the live thing yourself before
  repeating them - including your own past inferences.** Don't let a
  plausible-sounding pattern-match stand in for evidence. This is already
  a standing Tapestry rule (`feedback_accuracy_over_confidence` /
  `feedback_check_before_quoting_scope` in memory) - the hub model just
  raises the stakes, since the hub is now vouching for a spoke's diff
  before merge, not just its own work.
- **Shared checkout hazard, if it ever comes up:** if multiple sessions
  share one working directory (not the current worktree-per-lane setup,
  but worth remembering if that ever changes), stash-dance before every
  commit and never assume a "stale" reading proves anything without
  checking the actual mechanism - Tapestry already has its own worktree
  freshness lesson for this (`tasks/lessons.md`, "Worktree freshness -
  check the gap before claiming synced").
- **Don't fight a working pipeline that isn't actually broken.**
  Cross-check via multiple independent signals (Vercel dashboard, a fresh
  `curl -sI`, actual deploy logs) before concluding infra is down - a
  misread cache header or a stale local assumption reads identically to a
  real outage and wastes a long detour either way.
- **File ownership is explicit and defensible.** A lane that finds a bug
  outside its own files flags it (with a ready patch if the fix is small)
  rather than editing blind - the hub or the real owner takes it. This is
  the existing tiebreaker rule above, restated for the hub context: a
  spoke that spots something hub-owned (SQL/RLS/operating docs) writes it
  up for the hub instead of touching it directly.
- **Don't pick the first/only-known element of a set when more than one
  could legitimately exist - resolve by an actual key, not by assuming
  cardinality.** TheTableau hit this twice from the same root cause
  (picking `array[0]` when a set could have multiple live members).
  Tapestry's nearest miss: the audit's repeated finding that a single
  UPDATE policy assumed "the caller editing their own row" when RLS
  actually let ANY campaign member match - same class of "assumed a
  narrower set than what's actually reachable."

## What this protocol CANNOT do

**Correction (2026-08-02):** the line below originally said these chats
"cannot message each other" - that was wrong, or at least became wrong.
`mcp__ccd_session_mgmt__send_message` delivers directly into another
session (see "Cross-session coordination" above); `list_sessions` finds
the target by title/cwd. Kept the original text below for the history -
the remaining point (harmony still depends on every lane actually reading
this file, and ceremony has a real cost for a solo dev) still holds
regardless of transport mechanism.

Be honest: harmony depends on ALL THREE being given the same kickoff instructions
pointing at this file. A convention only one lane follows is not a convention.
And for a solo dev, more ceremony than the above is overhead you have to maintain
x3 - the worktree split (top) and the 2->3 doc update (below) are the real wins;
the rest is "just enough."

---

## Proposed operating-mode.md edit ("Multi-chat lanes" section)

Replace the current TWO-lane block in `tasks/operating-mode.md` with this
THREE-lane version (Puffer Fish / Xero to apply - it is their owned doc):

> ## Multi-chat lanes
>
> Tapestry runs across THREE always-on Claude chats by deliberate split:
>
> - **Hunt & Peck** - tactical bug fixes, feature ships, narrative tweaks, modal migrations, day-to-day shipping. The only lane that edits app code (`app/`, `components/`, `lib/`, incl. the table page).
> - **Puffer Fish** - architecture, risk, audit, security, observability, scaffolding. Owns stability/security audits, the operating docs (operating-mode / debug-handoff / handoff), Risk Register triage, SQL/RLS/trigger changes, lessons + decisions infrastructure. Doc-first; load-bearing refactors only when explicitly assigned.
> - **Playwright / E2E** - the automated acceptance suite and its plans (`e2e/`, `playwright.config.ts`, coverage map, test plans, results dashboard). Almost purely additive; reads app code, rarely edits it; runs against prod. Surfaces regressions + findings and ROUTES them to the owning lane rather than fixing cross-lane.
>
> Coordination is via the shared substrate (commits, `todo.md`, `lessons.md`, `debug-handoff.md`, `handoff.md`, and the live board `active-lanes.md`) - never direct messages; no chat sees another's in-flight thinking. Setup + conventions live in `tasks/lane-protocol.md` (worktree-per-lane, shared-doc discipline, tiebreaker, the E2E safety net). Rebase conflicts on push are the accepted cost of parallel work; each lane handles its own rebase. Both the Handoff accuracy contract and `scripts/start-session.sh` staleness reporting still apply.
>
> **Tiebreaker when unsure which lane owns a request:** test/coverage -> E2E; structure/risk/security/SQL/operating-docs -> Puffer Fish; specific user-facing fix/feature -> Hunt & Peck; if it belongs to another lane, write a `todo.md` line and let that lane pick it up rather than cross-editing its hot files.
