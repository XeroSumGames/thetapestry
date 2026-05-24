# Lane Protocol - three parallel Claude chats (2026-05-24)

How the three always-on chats stay harmonious. Drafted by the Playwright/E2E
lane after a session that hit every coordination failure mode first-hand
(shared-working-tree clobbers, a duplicated todo section, repeated rebases).
Routed to Puffer Fish (owns `operating-mode.md` + coordination scaffolding) -
the "Proposed operating-mode.md edit" at the bottom is the diff to apply.

Companion to `tasks/operating-mode.md` ("Multi-chat lanes" section, which still
describes only TWO lanes and should be updated - see bottom).

---

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
git worktree add C:\TheTapestry-e2e main
git worktree add C:\TheTapestry-puffer main
# Hunt & Peck keeps the primary C:\TheTapestry
```

- Lanes then collide ONLY at push time (a normal `git pull --rebase`), never in
  the working tree.
- All worktrees share one `.git`, so every commit/branch is visible across lanes
  immediately.
- Run `npm install` once per worktree (node_modules is not shared by default).
  The E2E worktree does not need a dev server (it targets prod); Hunt & Peck's
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

## What this protocol CANNOT do

Be honest: these chats are separate Claude instances that cannot message each
other. Harmony depends on ALL THREE being given the same kickoff instructions
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
