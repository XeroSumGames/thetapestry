# Puffer Fish handoff - 2026-08-01

State at write time: **on `main`, clean, HEAD `13384a12`, 934 unit tests
green**, all gates (tsc/arch/font/role/em-dash) green. Derive every fact
below from git/disk before acting - treat this as hypothesis, per the
Handoff accuracy contract.

## Who you are

Puffer Fish lane: architecture/risk/audit/security/SQL/observability.
Read `CLAUDE.md` + `AGENTS.md` + `tasks/operating-mode.md` first if this
is a fresh context. North star: TheTapestry stable/polished/fun for the
9/1 Kickstarter; Beta-500 proves it. You are the ADVISOR - set direction,
drive, validate the path, never ask "what's next."

## THE BIG THING: everything moved off C:\ tonight

**New home: `D:\coding\VTTs\TheTapestry`** (main checkout, branch `main`).
**`C:\TheTapestry` no longer exists** - deleted after full verification.
This applies to all three of Xero's properties:

- `D:\coding\VTTs\TheTapestry` (+ `-e2e`, `-puffer` lane worktrees)
- `D:\coding\VTTs\TheTableau` (+ 10 lane worktrees: banking, character,
  combat, cosmetic, crew, interface, main, operations, puffer, ships)
- `D:\coding\VTTs\TheTable`

All git worktree links were repaired bidirectionally (`git worktree
repair`) and verified live. Atlas roots re-registered
(`thetapestry`/`thetableau`/`thetable` -> the new `D:\` paths). Harness
memory pre-seeded for the two heaviest sessions (this one: 99 files;
TheTableau hub: 33 files) to the guessed new project-slug path.

**Every other lane chat was already sent a hand-off message** telling it
about the move and to open its next session at the new path:
- Hunt & Peck -> `D:\coding\VTTs\TheTapestry` (same main checkout you're
  in - HP and Puffer share this branch, coordinate via commits)
- Playwright/E2E -> `D:\coding\VTTs\TheTapestry-e2e`
- Puffer Fish Hub (a separate chat on `lane/puffer`) ->
  `D:\coding\VTTs\TheTapestry-puffer`
- Puffer Fish | The Table -> `D:\coding\VTTs\TheTable`
- TheTableau hub + its 10 lane chats -> their respective new paths

**If you need to coordinate with HP or E2E and get a response that
still references `C:\TheTapestry`, that chat hasn't picked up the move
yet** - resend the relevant hand-off block (below) rather than assuming
it's stale info.

### Hand-off block template (if you need to re-send to a lane that missed it)

```
[LANE NAME] lane - TheTapestry moved off C:\ tonight (2026-08-01).
New home: D:\coding\VTTs\TheTapestry[-e2e|-puffer if that's your worktree].
C:\TheTapestry no longer exists. If you have anything referencing the old
path, switch now. Full detail: tasks/handoff-puffer-2026-08-01.md.
```

## What happened this session (chronological)

1. **Consolidated C:\ -> D:\coding\VTTs** for all three properties (see
   above). Verified via `git status`/`git log -1`/`git worktree list`
   before AND after every move - zero data loss, all local-only commits
   (character/cosmetic/interface lanes on TheTableau) preserved.
2. **Checked Beta-500 readiness** against actual code (not the stale
   doc) - found Hunt & Peck had already shipped Gate 6.1 (alert() ->
   toast conversion, `ca83fd4b`) while the migration was in flight. Gate
   2 (H4 Cover Fire, H10 party rest) already confirmed shipped from
   earlier in this session (not covered again here).
3. **Ran a full-codebase bug audit** - 4 parallel Explore agents, each
   independently verified by reading the actual code (not trusted
   blind):
   - Combat resolution + initiative (`useRollResolution.ts`,
     `table-roll-context.ts`, `initiative-actions.ts`)
   - Economy/inventory/trade (`InventoryPanel.tsx`, `NpcCard.tsx`,
     `CharacterEvolution.tsx`, `CampaignCommunity.tsx` stockpile)
   - RLS/SQL/realtime security (`schema.sql`, `publication.sql`, RPCs)
   - Vehicles + communities (`app/vehicle/*`, `TacticalMap.tsx`,
     `CommunityMoraleModal.tsx`)
4. **Xero said "yes, fix everything."** All 21 findings fixed, each with
   its own tests-pass + arch-gate-pass + individual commit + push. See
   the full list below.

## The 21 fixes (all shipped, `7c8def3e`..`13384a12`)

**CRITICAL security (live migrations, verified in `pg_proc`/`pg_policy`):**
1. `campaign_members` INSERT had no invite-code check - any authenticated
   user could join any private campaign by enumerating its UUID. Fixed
   via a new `join_campaign_by_invite_code` SECURITY DEFINER RPC.
2. `chat_messages` INSERT had no campaign-membership check.
3. `sessions`/`session_attachments` had wide-open policies coexisting
   with correctly-scoped ones (RLS OR-together problem).
4. `campaign_members` UPDATE let a player hijack any character's token
   via `character_id` (no ownership check).
5. `get_visitor_map_data` (both the 0-arg and `p_site` overloads - the
   second one wasn't in the original audit finding, found while
   verifying the fix) leaked visitor geolocation, never revoked from
   PUBLIC/anon.

**Economy (new atomic RPCs, `sql/atomic-give-item-rpcs-2026-08-01.sql`,
`sql/atomic-barter-trade-rpc-2026-08-01.sql`):**
6. NPC-loot-to-PC (`NpcCard.tsx` onGiveTo) was a **deterministic** free
   item duplication, not a race - it never decremented the NPC's side.
7. PC-give-to-NPC/community/vehicle had no atomicity between the
   receiver write and the giver decrement (Gate 3.1 / H12, was already
   tracked in `todo.md:43` - now checked off).
8. Community stockpile withdraw computed off stale React state, not a
   fresh read (Gate 3.3 stockpile half).
9. Barter trade (`TradeNegotiationModal`/`page.tsx` onApply) wrote the
   PC side first, target side second, no rollback (Gate 3.3 / M11).
10. Dire Failure / Low Insight re-rolls were never capped - added a
    permanent per-modal lockout.
11. CDP spend (`CharacterEvolution.tsx`) and GM Award CDP
    (`CdpModal.tsx`) both raced on a stale balance snapshot - fixed with
    compare-and-set + retry (same pattern as `campaign-clock.ts`).

**Combat:**
12. NPC damage never re-fetched fresh state before writing (PC side had
    this fix already - M7 - NPC side never got it).
13. Insight-die reroll had the same gap in its no-baseline fallback.
14. Action-economy decrement (`consumeAction`/`decrementInitiativeAction`)
    had no cross-client guard, only a per-tab in-flight ref.
15. Coordinated Effort's CMod bonus read a stale-by-one-tick `pendingRoll`
    label, mis-gating the bonus depending on roll sequencing.
16. Insight-Trade save (spend Insight to survive at 1 WP) never zeroed
    actions/advanced the turn, unlike the direct mortal-wound path.
17. Blast/AoE damage skipped the Insight-Trade save entirely.

**Vehicles/Communities:**
18. Vehicle writes (`update_vehicle_in_campaign` RPC) fully replaced the
    vehicle object instead of merging - lost-update race on concurrent
    seat/fuel/cargo edits. Fixed with a real jsonb merge + client-side
    diffing so only genuinely-changed fields are sent.
19. Vehicle popout button from the tactical map used the wrong URL query
    params (`?campaign=&vehicle=` instead of `?c=&v=`) - broke every time.
20. Community leader seat was never cleared on automatic
    Morale/Retention departure or dissolution (only the manual
    Remove/Leave button had this - the L6 fix).
21. Community `memberCount` double-counted self-founded PCs (unfiltered
    member list instead of NPC-only).
22. Firing-arc toggle was local-only from the in-map button; only the
    popout's toggle broadcast. (Known remaining gap: arc state still
    isn't DB-persisted - a client that refreshes mid-session starts
    empty regardless. Flagged, not fixed - would need a schema change.)
23. No debounce on vehicle roll/damage buttons - fast double-click could
    fire twice before React re-rendered the disabled state.

(Yes, that's 23 numbered items above for "21 findings" - a few fixes
bundled 2 findings each, e.g. #6+#7 share one commit, #8+#11 share the
CAS pattern. The task list tracked exactly 21 discrete tasks; see git log
`7c8def3e`..`13384a12` for the 11 commits.)

## What Xero wants next

**Continue auditing before returning to normal development.** The 4
areas above are NOT the whole app. Areas NOT yet audited this pass -
recommend picking up here, in roughly this priority order:

1. **Module/GM-kit import-export** (`lib/modules.ts`, `lib/gm-kit.ts`) -
   large jsonb blobs, cross-campaign copying, a known pagination-truncation
   fix already shipped (5.5/M17) but worth a fresh look given the pattern
   of "atomicity gaps" found everywhere else tonight.
2. **Chat/whisper/DM system** beyond the INSERT policy fix - the SELECT
   side (whisper privacy - `sql/chat-whisper-rls.sql` was drafted but
   never verified to actually be scoped correctly; not touched tonight).
3. **World map / pins / world_communities** - the public-facing
   cross-campaign surface, higher blast radius if something's wrong.
4. **Notifications + campaign_invitations** - the OTHER invite mechanism
   (distinct from invite-code) - only spot-checked for the SECURITY
   DEFINER trigger, not for its own logic bugs.
5. **Character creation / character-sheet** - untouched by any of
   tonight's 4 audit areas.
6. **Tactical map beyond vehicles** - fog/LOS, walls, scene tokens - note
   `tasks/todo.md` already has an OPEN, ROUTED-TO-PUFFER item on exactly
   this (line ~461, "player can't see through OPEN windows") that
   predates tonight and was never picked up.

Use the same pattern that worked well tonight: parallel Explore agents
per area, each independently verified against real code before reporting,
not just trusted. Get Xero's "fix everything" (or scoped) go-ahead before
starting the fix pass, same as tonight.

## Known carry-over debt (be honest about this, don't hide it)

- **`tasks/todo.md` substrate hygiene is still not fully reconciled.**
  This was flagged as "do first" at the START of this session's original
  hand-off and never got done (the file migration + audit consumed the
  whole session instead). I checked off exactly ONE item (line 43, Gate
  3.1) because I had it open in front of me while writing this handoff.
  **The other ~20 items from tonight's audit-fix pass are NOT reflected
  in todo.md at all** (most were net-new findings, not pre-existing
  todo.md entries) - either add fresh SHIPPED entries for them or fold a
  reference to this handoff doc into the file. Also still open from
  before tonight: H3/H5/H8/H11/H14/H16 stale-`[ ]` items the health-pulse
  has been flagging for a long time (check git log against the actual
  beta500-readiness doc before touching - some may be genuinely done,
  some may not - don't trust the labels).
- **Two chronic HOPED-FOR items from Gate 1** (FI Insight Die award,
  Stress 12-string narratives, vehicle popout broadcasts) still need
  Xero's 2-browser GM+player verify pass - `tasks/The Tapestry Smoke
  Testing.xlsx`, Mechanics Verify tab. Not blocked by anything from
  tonight, just never got run.
- **Firing-arc DB persistence** (see #22 above) - deliberately deferred,
  needs a schema change, not urgent.

## Bright lines (unchanged)

- Live SQL migrations: confirm intent with Xero, then I run the CLI +
  verify in `pg_proc`/`pg_policy`. I apply, not Xero.
- ASCII hyphens only, no em/en-dash, anywhere.
- Every change ships straight to `main` (Vercel = live).
- Checklists/testplans as **.xlsx** (openpyxl), not markdown.
- Test-per-fix; run the arch/font/role/em-dash gates before every commit.
- Destructive actions (deletes, force-push, history rewrite) need
  explicit go-ahead - even with broad "fix everything" authorization,
  re-confirm before anything irreversible.

## Key docs

- `CLAUDE.md` / `AGENTS.md` / `tasks/operating-mode.md` - read first.
- `tasks/beta500-readiness-2026-07-13.md` - the master gate list (now
  stale in places given tonight's fixes closed several Gate 2/3 items -
  verify against code, don't trust the checkboxes blindly).
- `tasks/The Tapestry Smoke Testing.xlsx` - the ONE living test workbook
  (START HERE tab). Every future test ask is a new tab in this same
  file, never a new file.
- This doc (`tasks/handoff-puffer-2026-08-01.md`) - tonight's full record.
