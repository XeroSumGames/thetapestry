# Recorder 3-Hour Hardening — Test Plan (2026-05-11)

## What changed

For the 5/11 playtest workflow ("toggle on at start, leave running 3h,
toggle off at end"):

- **`lib/playtest-recorder.ts`**
  - `MAX_EVENTS` 2000 → 20,000. Sized for a 3-hour session at ~50 ev/min.
  - localStorage backup window 500 → 5,000 trailing events.
  - **Split** `setEnabled()` from `wipeBuffer()`. Toggle OFF mid-session
    no longer destroys the buffer.
  - New `startPeriodicFlush()` — auto-persists trailing buffer to
    localStorage every 60s. Crash recovery loses ≤1 min instead of
    everything since the last error/mark.

- **`components/PlaytestRecorder.tsx`**
  - First gate eval still wipes on fail-closed (so an out-of-scope tab
    doesn't surface its optimistic-capture window).
  - Later gate flips (e.g., GM toggles OFF mid-session) preserve the
    buffer.
  - Subscribes to realtime `postgres_changes` UPDATE on
    `playtest_recorder_config` — /record toggles propagate to every
    open tab within ~1 second.
  - Kicks off the periodic flush.

- **`lib/damage.ts`** — added `[playtest-trace] [damage] calculateDamage`
  log inside the function so the math is captured for every caller
  (table page, vehicle popout, etc.). Complements the existing call-site
  trace at table/page.tsx ~line 4390.

- **`sql/playtest-recorder-config-realtime.sql`** — added the config
  table to the `supabase_realtime` publication. Applied to live DB.

- **`/record` help text** — updated to describe the 3-hour workflow,
  new 20,000-event cap, 60s flush, and that the buffer survives a
  mid-session OFF toggle.

## Existing diagnostic traces (from commit `aaa29af`, not in this change)

All three of the 5/11 known-flaky bugs already have
`[playtest-trace]`-prefixed instrumentation:

1. **Initiative lag** — `[nextTurn] done { total_ms, deactivate_ms, activate_ms, reload_ms, broadcast_ms, activated_name }`
2. **Damage calc 8 → 7/7** — call-site dump at table/page.tsx ~line 4390 + my new
   in-lib `[damage] calculateDamage` trace
3. **Failed skill checks leaving 2 actions** — `[closeRollModal]` gate
   decision + `[consumeAction] CALLED` / `WROTE` with before→after.

## Pre-session smoke test (~15 min, do ~30 min before playtest)

### Test 1 — Buffer cap survives load

1. /record → toggle ON, Everyone, Save.
2. Open the live site, log in, navigate around for ~2 min (many clicks).
3. DevTools console: `window.__tapestryRecorder?.buffer.length`
4. ✓ Returns a number > 50 and < 20,000.
5. `window.__tapestryRecorder?.buffer.slice(-1)` — ✓ shows recent click.

### Test 2 — Toggle OFF preserves buffer mid-session

1. With recording ON and at least ~50 events captured, go to /record.
2. Toggle OFF. Save. Wait 2 seconds.
3. Back in the captured-events tab:
   - `window.__tapestryRecorder?.enabled` → ✓ `false` (realtime took effect)
   - `window.__tapestryRecorder?.buffer.length` → ✓ unchanged from before
4. Press Ctrl+Shift+L → ✓ dump downloads with all the pre-OFF events
   intact and `meta.event_count` matches the buffer length.
5. Click around more → ✓ buffer length stays the same (capture is off).

### Test 3 — Realtime ON propagation (no reload needed)

1. /record → toggle OFF, Save. Reload the captured-events tab so it
   starts fresh in "off" state.
2. Confirm `window.__tapestryRecorder?.enabled` is `false` and no red dot.
3. /record → toggle ON, Save.
4. Within ~1 second on the other tab:
   - ✓ Red dot appears (the gate re-evaluated and flipped on).
   - `window.__tapestryRecorder?.enabled` → ✓ `true`.
5. Click around — buffer length grows.

### Test 4 — Periodic flush every 60s

1. With recording ON, click around to put a few events in the buffer.
2. DevTools → Application → Local Storage → site origin.
3. Note the `tapestry_playtest_buffer` value's length (or absence).
4. Wait ~70 seconds without triggering any error/rejection/mark.
5. Refresh the local-storage panel. ✓ `tapestry_playtest_buffer` now
   present with up to PERSIST_BACKUP_COUNT recent events.

### Test 5 — Diagnostic traces fire

In the live combat playthrough (any campaign with active combat):
1. End a turn (`⊘` button or end-combat).
2. ✓ Console shows `[playtest-trace] [nextTurn] done { total_ms: ..., ... }`.
3. Make an attack that does damage.
4. ✓ Console shows `[playtest-trace] [damage] calculateDamage { rawWP, ... finalWP, finalRP }`.
5. Roll any skill check, cancel without rolling.
6. ✓ Console shows `[playtest-trace] [closeRollModal]` with `didRoll: false`
   and the gate decision.
7. Press Ctrl+Shift+L → ✓ dump includes all three traces under
   `kind: 'console-warn'` events.

### Test 6 — Per-player allowlist still works after realtime change

1. /record → toggle ON, Selected only, pick just yourself, Save.
2. ✓ Your tab's recorder stays on / activates.
3. (If you have a test tab signed in as another non-listed user) ✓ Their
   recorder flips OFF within 1s and red dot disappears.

## Worst-case worry: 20,000 events is too few

If a 3-hour session somehow generates more than 20,000 events (very
click-heavy combat), the OLDEST events get dropped. The localStorage
flush captures the last 5,000 so the most recent context is always
safe. If a session genuinely needs more, bump `MAX_EVENTS` in
`lib/playtest-recorder.ts`.

## Rollback

1. **Stop capture immediately**: /record → toggle OFF, save.
2. **Full revert**: this commit can be reverted cleanly. The SQL
   addition (`playtest-recorder-config-realtime`) is idempotent and
   safe to leave even if the code reverts.

## Follow-ups after this session

- Restore-from-localStorage on mount (so a mid-session reload doesn't
  lose context). Skipped tonight to keep scope tight.
- Per-event compression once buffer regularly exceeds 10,000.
