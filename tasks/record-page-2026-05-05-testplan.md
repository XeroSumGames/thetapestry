# /record Page — Test Plan (2026-05-05)

## What changed

- New `/record` admin page (thriver-gated) with an ON/OFF toggle and
  a per-player allowlist.
- New `playtest_recorder_config` singleton table (id=1) holding
  `enabled` + `target_user_ids[]`. RLS: any authenticated user
  reads; thriver-role only writes.
- `lib/playtest-recorder.ts` — added an `enabled` flag on the
  global recorder state + a `setEnabled()` helper that wipes the
  buffer when transitioning to disabled.
- `components/PlaytestRecorder.tsx` — fetches config at mount,
  decides whether this tab should record, and hides the corner
  dot when out-of-scope. Re-evaluates on auth-state changes so a
  fresh sign-in flips into recording if the new user is on the
  allowlist.
- SQL applied to live DB via
  `npx supabase db query --linked -f sql/playtest-recorder-config.sql`.

## How the gate decides

| Config state                           | Result                            |
|----------------------------------------|-----------------------------------|
| `enabled = false`                      | Nobody records                    |
| `enabled = true`, allowlist empty      | All authenticated users record    |
| `enabled = true`, allowlist has my id  | I record                          |
| `enabled = true`, allowlist excludes me| I don't record                    |
| Config fetch fails                     | I don't record (fail closed)      |

Open tabs apply the new config on **next page load** (the gate
runs on mount). The save bar tells you that explicitly.

## Pre-test setup

1. Confirm the SQL ran:
   ```
   npx supabase db query --linked -e "SELECT * FROM playtest_recorder_config;"
   ```
   Should show one row with `id=1, enabled=false, target_user_ids={}`.
2. You should already have `role='thriver'` on your `profiles` row
   (you've been using /moderate). If not, set it in the Supabase
   table editor before testing.

## Smoke tests (≤15 min)

### Test 1 — Page loads, auth gates correctly

1. As a thriver, visit `https://thetapestry.distemperverse.com/record`.
2. ✓ Page renders with the heading "Recording Configuration",
   ON/OFF toggle (currently OFF), Scope radios, and the player
   list.
3. Sign out, then visit `/record` again.
4. ✓ Shows "Not authorized" with a Home button.
5. Sign in as a non-thriver test account (or temporarily flip your
   own role to 'survivor' in the profiles table — remember to flip
   back).
6. ✓ Same "Not authorized" view.
7. Flip your role back to 'thriver'.

### Test 2 — Default state: nobody records

1. With config still at default (enabled=false), open any tab on
   the live site.
2. ✓ No corner red dot.
3. Open DevTools console, run `window.__tapestryRecorder?.enabled`.
4. ✓ Returns `false`.
5. Press Ctrl+Shift+M, type "test", OK.
6. Run `window.__tapestryRecorder?.buffer.length`.
7. ✓ Returns `0` (the mark was discarded by the gate).

### Test 3 — Enable for everyone

1. Go to `/record`. Click ON. Leave scope at "Everyone". Save.
2. ✓ "Saved at HH:MM:SS" green confirmation appears.
3. Reload any other page (tactical, dashboard, anything).
4. ✓ Red corner dot reappears.
5. Click around. Press Ctrl+Shift+P.
6. ✓ Console shows recent events.
7. Run `window.__tapestryRecorder?.enabled` → ✓ `true`.

### Test 4 — Switch to selected players

1. Back to `/record`. Toggle Scope → "Selected players only".
2. ✓ Player list expands. Searchable. Your row shows "(you)".
3. Pick yourself + 1 other player. Save.
4. Reload the site as yourself.
5. ✓ Dot still visible, recording still on.
6. (If you can test as the other player) — they should also see
   the dot. A third user NOT in the list reloads → ✓ no dot,
   `enabled = false`.

### Test 5 — Turn it off

1. `/record` → click ON to flip it OFF. Save.
2. Reload any other tab.
3. ✓ Dot disappears.
4. ✓ `window.__tapestryRecorder?.enabled` is `false`.
5. ✓ `window.__tapestryRecorder?.buffer.length` is `0`
   (setEnabled wipes on the off-transition; reload restarts the
   buffer at 0 anyway).
6. ✓ `localStorage.getItem('tapestry_playtest_buffer')` is `null`
   on this tab.

### Test 6 — Sign-in flips the gate live

1. Configure: enabled=true, allowlist contains a specific test
   user (NOT you).
2. As a *different* signed-out browser, visit any page → ✓ no dot
   (gate denies).
3. Sign in as the allowlisted test user → ✓ dot appears within a
   second (auth state change re-runs the gate).
4. Sign out → ✓ dot disappears next page-load.

### Test 7 — Filter and select-all-visible

1. `/record` → Selected mode. Type a few letters in the filter
   box.
2. ✓ List narrows to matching usernames/emails/characters.
3. Click "Select all visible".
4. ✓ Just the visible rows get checked, hidden rows untouched.
5. Click "Clear all".
6. ✓ All checkboxes clear.

## Regression smoke (the 5/4 recorder still works)

1. Enable for yourself. Open the table page on your live
   campaign.
2. Click around. Ctrl+Shift+M "regression test". Ctrl+Shift+L.
3. ✓ Dump file downloads. File name is
   `playtest-<your-email-prefix>-...json` (auth-attach fix
   from yesterday still working).
4. Open the JSON. ✓ `meta.user_email` is your email,
   `meta.event_count` ≥ 5, the mark is in there.

## Rollback

If anything breaks:
1. **Quickest**: go to `/record`, toggle OFF, save. Recorder stops
   for everyone on next page load.
2. **Full revert**: `git revert <sha>` for this commit. The SQL
   table can stay; it's harmless when nothing reads it.
3. **DB rollback (rarely needed)**:
   ```sql
   DROP TABLE IF EXISTS public.playtest_recorder_config;
   ```

## Follow-ups (not in this commit)

- Realtime push: when config changes, broadcast on a channel so
  open tabs apply immediately instead of needing a reload.
- Audit log: record `updated_by` and history of changes (the
  column exists, we're just not surfacing history in UI).
- Per-campaign scoping (record only for users in campaign X).
- Sidebar link to `/record` for thrivers (currently you have to
  type the URL).
