# Audit: Stale-Closure Landmines in Realtime Handlers

Closes Phase P2 / A2.2 of `tasks/puffer-fish-platform-plan.md`. Companion to [tasks/audit-reentry-guards.md](audit-reentry-guards.md) (A2.4). Audits the realtime handlers registered inside the `[id]`-deps useEffect for stale-closure bugs - handlers that read React state at handler-definition time instead of via `.current` refs.

**Audience:** the hunt-and-peck chat (for fix candidates) + future puffer-fish chats during decomposition Phase 3.5 (`useTableRealtime` extraction).

**Status:** AUDIT 2026-05-20. **One real landmine found.** Two known landmines already fixed via documented commits. Sweep methodology in section 4 enables future spot-checks.

---

## 1. The bug class

The realtime channel registers inside a `useEffect(() => { ... }, [id])` block. Handlers are defined at mount time. Any React state value they reference (`userId`, `gmLike`, `entries`, `campaignNpcs`, `tacticalShared`, etc.) is captured BY VALUE at the moment the handler closure forms. When the state later updates, the handler still sees the old value.

Symptom: a handler that checks `if (data.targetUserId === userId)` against the post-load user ID will silently fail every broadcast because the closure captured `userId` when it was still `null`.

Mitigation pattern: a separate `useEffect(() => { userIdRef.current = userId }, [userId])` keeps a ref in sync with the state. Handlers read `userIdRef.current` instead of raw `userId` to get the always-fresh value.

The codebase has 7 such mirror-refs (`tasks/audit-reentry-guards.md` Category F): `userIdRef`, `gmLikeRef`, `entriesRef`, `campaignNpcsRef`, `myCharIdRef`, `tacticalSharedRef`, `prevStressByStateIdRef`.

---

## 2. Documented past fixes

Two landmines have been found + patched in production. Their inline comments are the canonical reference.

### F1: `infection_check_request` handler (L1534, fixed 2026-05-15 commit `56c0534`)

**Symptom:** "this handler was defined inside the [id]-deps useEffect, so the React state `userId` was captured at mount when it was still null. Result: `null !== <actual-user-id>` was always true, dropping every broadcast on both tabs."

**Fix:** read `userIdRef.current` + `gmLikeRef.current` instead of raw `userId` / `gmLike`. Also reads `entriesRef.current` and `campaignNpcsRef.current` for PC vs NPC PHY lookup.

**Comment quality:** Excellent. Names the bug class explicitly, dates the fix, names the commit, explains the fix pattern.

### F2: `lasting_damage_check_request` handler (L1499, fixed in same era)

**Symptom:** "Uses userIdRef.current to dodge the stale-closure trap that bit infection_check_request earlier today (56c0534)."

**Fix:** same pattern. Reads `userIdRef.current`, `gmLikeRef.current`, `entriesRef.current`, `campaignNpcsRef.current`.

**Comment quality:** Excellent; explicitly references the prior fix.

---

## 3. Sweep findings (2026-05-20)

Walked the realtime channel registration (broadcast + postgres_changes handlers, L1300-L1610 area) reading every callback body. Looked for any reference to a React state name that has a corresponding mirror-ref.

### 🚨 LANDMINE: `pc_mortal_wound` handler (L1487-L1493)

```ts
.on('broadcast', { event: 'pc_mortal_wound' }, wrapBroadcast('pc_mortal_wound', (msg: any) => {
  // Show insight save modal on the player's screen or GM's screen
  const data = msg.payload
  if (data && (data.targetUserId === userId || gmLike)) {  // ← STALE: reads raw userId + gmLike
    setInsightSavePrompt(data)
  }
}))
```

**Bug class:** identical to the L1534 infection_check_request fix. Reads raw `userId` and `gmLike` instead of `userIdRef.current` and `gmLikeRef.current`. At mount time both are at their initial values (null + false). When the broadcast arrives:
- The targeted PC's tab: `data.targetUserId === null` is always false. The `setInsightSavePrompt(data)` never fires for the target.
- The GM's tab: `gmLike === false` is always true at the captured-mount value, but the GM might or might not be a GM-like (Thriver) at mount time. Behavior depends on auth race.

**Severity:** silent drop of mortal-wound prompts. The PC wouldn't see their Insight save modal; the GM might or might not see it.

**Why hasn't it bitten in production:** unclear. Possibilities:
- The auth load completes before any combat starts, so by the time `pc_mortal_wound` fires, `userId` and `gmLike` have been set BEFORE the channel registers. (But the channel registers inside `load()` AFTER auth, so this is plausible.)
- The handler is rarely exercised - mortal wounds in combat require specific damage thresholds + the right outcome.
- Some other layer catches the failure mode (`pc_mortal_wound_resolved` re-broadcast?).

**Recommended fix:** change to `userIdRef.current` + `gmLikeRef.current`. One-line change. Lift the inline comment from the L1534 fix as the rationale.

**Hunt-and-peck task:** add a follow-up. Suggested commit: `fix(realtime): pc_mortal_wound handler reads refs to dodge stale-closure`.

### Clean handlers (verified safe)

The following handlers were spot-checked and read either via refs OR don't reference closure-frozen state at all:

| Handler | Line | Status |
|---|---|---|
| `recorder_start` / `recorder_stop` | 1357 / 1367 | Reads `setRecorderEnabled` setter (state setter is stable, not closure-frozen). SAFE. |
| `combat_ended` | 1379 | Calls setters only. SAFE. |
| `player_kicked` | 1380 | Reads `msg.payload`. SAFE. |
| `combat_started` | 1392 | Calls loadInitiative + rollsFeed.refetch. SAFE. |
| `tactical_shared` / `tactical_unshared` | 1393 / 1394 | Setters only. SAFE. |
| `scene_activated` | 1403 | Calls setters + rollsFeed.refetch. SAFE. |
| `gut_instinct_resolved` | 1412 | Reads `msg.payload`. SAFE. |
| `token_changed` | 1420 | Setter only. SAFE. |
| `turn_changed` | 1421 | Calls loaders. SAFE. |
| `logs_cleared` | 1431 | Calls setters. SAFE. |
| `npc_damaged` | 1439 | Reads `msg.payload`; updates state via loader call. SAFE. |
| `pc_damaged` | 1475 | Reads `msg.payload`. SAFE. |
| `inventory_transfer` | 1483 | Reads `msg.payload`. SAFE. |
| **`pc_mortal_wound`** | **1487** | **🚨 LANDMINE** (see above). |
| `pc_mortal_wound_resolved` | 1494 | Calls setters + loadEntries. SAFE. |
| `lasting_damage_check_request` | 1499 | Documented fix; reads refs. SAFE. |
| `infection_check_request` | 1534 | Documented fix; reads refs. SAFE. |
| `npcs_revealed` | 1558 | Calls loader. SAFE. |

### postgres_changes handlers

| Handler | Line | Status |
|---|---|---|
| `scene_tokens:UPDATE` / `INSERT` | 467 / 470 | Lives in a separate `[id, ...]`-deps useEffect (L464). Setter only. SAFE. |
| `tactical_scenes:UPDATE` | 473 | Same effect; setter only. SAFE. |
| `npc_relationships:*` (x2) | 1300 / 1311 | Calls `loadRevealedNpcs`. Reads `myCharIdRef.current` via the loader. SAFE. |
| `community_members:*` | 1322 | Calls loaders. SAFE. |
| `character_states:*` | 1329 | Calls loadEntries. SAFE. |
| `campaign_members:*` | 1334 | Async fetch + setters. SAFE. |
| `initiative_order:*` | 1356 | Calls loadInitiative. SAFE. |
| `notifications:INSERT` | 1386 | Reads `payload`. SAFE. |
| `campaigns:UPDATE` | 1575 | Reads `payload`. SAFE. |
| `campaign_npcs:*` | 1598 | Reads `payload` + updates state. SAFE. |
| `advantages:*` | 1769 | Calls `void load()`. SAFE. |

---

## 4. Sweep methodology (re-runnable)

To re-audit during/after Phase 3.5 (`useTableRealtime` extraction) or any major realtime handler addition:

1. **Grep for handler registrations:** `grep -nE "\.on\('broadcast'\|\.on\('postgres_changes'" app/stories/\[id\]/table/page.tsx`
2. **For each handler, identify the deps array** of the enclosing useEffect. If it's `[id]` only, all closures are mount-frozen.
3. **Read the handler body.** Look for references to state names (not setters). State names in the closure-freeze risk list (per A2.4 Category F):
   - `userId`, `gmLike`, `entries`, `campaignNpcs`, `tacticalShared`, `myCharId`
   - Any other state declared via `useState` at the top of the component.
4. **Verify each state reference uses `.current` on the corresponding ref:**
   - `userId` -> `userIdRef.current`
   - `gmLike` -> `gmLikeRef.current`
   - `entries` -> `entriesRef.current`
   - `campaignNpcs` -> `campaignNpcsRef.current`
   - `tacticalShared` -> `tacticalSharedRef.current`
   - `myCharId` -> `myCharIdRef.current`
5. **Flag any handler reading raw state.** That's a landmine candidate.

The methodology generalizes to any long-lived `[]`-deps useEffect with callbacks that fire after mount.

---

## 5. Why the existing mirror-refs aren't enough by themselves

The mirror-ref pattern only protects state values explicitly mirrored. If a future feature adds:
- New React state, AND
- A new realtime handler that reads it,

and forgets to add a mirror-ref + sync effect, the new handler is born with the same stale-closure bug.

**Mitigation candidates** (recommend hunt-and-peck consider during Phase 3.5):

1. **TypeScript helper that requires refs.** Wrap channel registration in `registerHandler(channelRef, event, deps: { userId: Ref<string>, ... }, fn)` where `deps` is typed as a record of refs. Removes the ability to accidentally close over raw state.
2. **ESLint rule:** custom rule that flags `state-name` reads inside `.on('broadcast' ...)` callbacks. Catches at lint time.
3. **Move to a hook abstraction (Phase 3.5 of decomposition).** `useTableRealtime({ userId, gmLike, entries, campaignNpcs, ...callbacks })` takes the state values as arguments, freezes them as refs internally, and exposes only stable callback APIs. The hook's contract eliminates the bug class entirely.

Option 3 is what the decomposition plan recommends. Worth doing #1 or #2 as belt-and-suspenders only if Phase 3.5 is significantly deferred.

---

## 6. Hunt-and-peck follow-up summary

One concrete fix queued from this audit:

- **[ ] Fix `pc_mortal_wound` handler stale-closure (L1487-L1493).** Change raw `userId` and `gmLike` references to `userIdRef.current` and `gmLikeRef.current`. Lift the L1534 inline comment as the rationale. Single-line change. Add a regression test if a cross-client test harness lands (per Phase P5 of the platform plan).

Optional, larger:

- **[ ] Phase 3.5 extraction:** `useTableRealtime` hook with typed-ref-deps contract per section 5 option 3. Closes this bug class structurally.

---

## 7. Maintenance

Update this audit when:
- A new realtime handler is added to the table page - re-run the section 4 methodology on the new handler.
- A new piece of React state becomes referenced inside a realtime handler - verify a mirror-ref exists OR add one.
- The handler list moves to `useTableRealtime` per the decomposition - mark this audit superseded; the hook's typed-ref-deps contract subsumes the per-handler check.

Archive when: Phase 3.5 ships AND the typed-ref-deps pattern is enforced by the hook signature AND the pc_mortal_wound fix lands.
