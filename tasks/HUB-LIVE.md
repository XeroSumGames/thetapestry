# HUB-LIVE.md - the live Puffer Fish hub claim

**Current hub: Puffer Fish Hub chat, branch `lane/puffer`, worktree `D:\coding\VTTs\TheTapestry-puffer`.**
**Claimed: 2026-08-02.**

## What "hub" means here

Puffer Fish is now the ONLY chat that reviews, merges, and pushes to `main`.
It owns integration, SQL/RLS review, and cross-file reconciliation - every
other kind of work gets dispatched to a spoke.

- **Hub (Puffer Fish):** reviews the actual diff (not just the spoke's
  summary) before merging - especially anything SECURITY DEFINER, RLS, or
  touching a shared/hot file. Applies anything that touches the live
  database itself, after its own review pass. Cherry-picks a spoke's
  reviewed SHA into `main`, confirms gates passed, THEN tells the spoke
  it's merged.
- **Spokes (Hunt & Peck, Playwright/E2E):** each works in its own
  worktree/branch (already true per `tasks/lane-protocol.md`), authors +
  gates its own work locally (tsc/tests/arch/font/role/em-dash - the
  existing pre-commit suite), then hands the hub ONE commit SHA to review.
  **Spokes do not push to `main` directly anymore** - that's the actual
  protocol change from the pre-hub model. A spoke reproduces an issue for
  real (not just by reading code) before claiming it's fixed.

Coordination substrate: this file (who's hub), `tasks/COMMS.md` (open
questions / decisions / test-plan routing - owned by the dedicated Comms
channel, `tasks/lane-protocol.md` "Comms channel" section),
`tasks/active-lanes.md` (live status board), commits, `todo.md`,
`lessons.md` - same shared-doc discipline as before, see
`tasks/lane-protocol.md`.

## Retirement rule

**Writing a handoff = immediate retirement.** The next chat that claims hub
status MUST overwrite this file with its own claim (which chat, worktree,
branch, claim timestamp), push it, then ping EVERY lane - not just the
currently-active one - to re-point their handoff/SHA traffic at the new
hub. Never infer "who's the live hub" from "which chat spoke most
recently" - always read this file fresh; that inference caused real
double-hub divergence on TheTableau.

## History

- **2026-08-02:** Puffer Fish Hub claims the hub role, adapting the
  pattern Xero validated on TheTableau's Puffer Fish hub. First claim
  under this model for TheTapestry - all three lanes previously pushed to
  `main` directly with no review gate (see `tasks/lane-protocol.md`'s
  "Committing on the shared remote" section, now superseded for
  spoke-authored work).
