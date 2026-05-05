# Playtest 5/4/26 — Bugs from Session Marks

Three bugs flagged via `Ctrl+Shift+M` during the session. Source: localStorage
recovery of `tapestry_playtest_buffer` on `thetapestry.distemperverse.com`
post-session (the in-tab dump was never triggered, but localStorage persistence
on each `mark` saved them). All three are tactical-table issues on the
`/stories/cc766e7f-04de-4d09-a497-ce6c8e21b53d/table` route.

GM session: 2026-05-05T01:12 → 01:56 UTC (Tapestry time), ~44 min.
GM user_id: `5806fd27-fcac-4163-b8a8-61476150962c`.
Combat ran end-to-end with 15 NPCs.

---

## BUG-1 — Perception check has a redundant first modal

**Reported (mark):** 01:37:01 UTC
> "the perception check modal initially shouldn't exist, it should go straight
> to the next modal"

**Repro inferred from buffer:**

1. Click the **Perception** child header button (`hdr-btn hdr-btn--child`).
2. A picker modal appears listing all 4 PCs with their PER values:
   "Enya (PER 3) · Juno Lask (PER 3) · Mikey Banachek (PER 1) · Shimmy Paint (PER 1)".
3. Click a PC (e.g. "Juno Lask (PER 3)") → roll modal opens.
4. Cancel → console shows `[closeRollModal] didRoll: false, combatActive: false, preConsumed: false, cost: 1`.

**Expected:** clicking Perception should go straight to the roll modal — the
PC-picker step is friction. Either:
- Auto-pick the active PC if one is selected/active.
- If multiple, fold picker + roll into one combined modal.
- Or roll Perception once for *all* PCs in a single panel (since the existing
  picker shows everyone's PER inline anyway).

**Files likely involved:** the Perception header button handler. Search for
`Perception` button click handler + the modal that lists PCs by PER.

**Priority:** medium — friction, not blocking.

---

## BUG-2 — PCs riding Minnie don't move with her

**Reported (mark):** 01:52:55 UTC
> "if a pc is 'on' Minnie, they should be 'sticky' and move with the token"

**Context:** Minnie is a vehicle/mount token. During combat, when Minnie's
position changed, PCs whose grid cell was on/inside her did NOT follow.

**Expected:** when a token moves and another token's grid cell is inside its
footprint (or marked as a passenger), those passenger tokens move along with
the carrier — preserving their relative offset.

**Design questions for Xero before implementing:**
- Is this purely positional ("any PC standing in Minnie's footprint follows")
  or does it require an explicit "mount/disembark" action?
- Does it apply to all multi-cell tokens, or just vehicles?
- What happens if Minnie moves to terrain a PC can't enter?

**Files likely involved:** tactical token-move handler — search for the
`tactical_tokens` update path. The carrier needs to either (a) push passenger
deltas in the same transaction, or (b) the move handler needs to detect
overlap and cascade.

**Priority:** medium — affects every vehicle/mount scene from now on.

---

## BUG-3 — Firing Minnie's mounted weapon doesn't cost an action

**Reported (mark):** 01:56:12 UTC
> "reading Minnie's weapon and firing it should use actions"

**Repro inferred from buffer:**

- 01:55:17 — Enya posted attack: "🎯 M60 (Mounted) attack → Justice Morse · Minnie · Enya · Ranged Com..."
- The attack went through (Justice Morse ended up "mortally wounded").
- **No `[consumeAction]` warn fired** for that shot in the recorder buffer.
- Compare to Frank Wallace's grenade earlier (01:44–01:45): aim → attack(Grenade)
  → roll → `[damage] cell-throw` → `[consumeAction] entryId, ... cost: 1` →
  `[consumeAction] newRemaining: 0` → auto `nextTurn`. That's the correct path.

**Expected:** firing a mounted/vehicle weapon should call the same
`consumeAction` flow as any other attack, decrementing `actions_remaining` on
the active initiative entry.

**Files likely involved:** the M60 / mounted-weapon attack handler. It's
bypassing the central `consumeAction` call. Search for "Mounted" in the
attack-flow code to find where the path diverges from regular ranged attacks.

**Priority:** high — unlimited free actions per turn for any PC riding a
vehicle is a balance break.

---

## Buffer findings (not flagged as marks but worth noting)

- **`Realtime send() is automatically falling back to REST API`** warns are
  still being recorded by the playtest recorder (1× on initial load,
  occasionally on map-switch). The head-script filter in `app/layout.tsx`
  drops them from the console UI but our recorder runs before that filter.
  **Fix shipped alongside this doc** — recorder now skips known-benign warns.
- **All combat `[nextTurn]` and `[consumeAction]` warns are firing cleanly.**
  No errors or unhandled rejections in the entire 44-minute session — the
  table held up well.
- **Auth-attach bug:** all dumps showed `user_email: null` because the
  recorder resolved auth at mount time, before login. **Fix shipped
  alongside this doc** — recorder now subscribes to Supabase auth state
  changes, so future dumps will be tagged with the GM's email.

---

## Next steps

1. Spec-check BUG-1 and BUG-2 with Xero (UX preferences for the picker, mount
   semantics).
2. Fix BUG-3 first since it's a balance break.
3. Then BUG-1 (small UX win), then BUG-2 (bigger feature).
