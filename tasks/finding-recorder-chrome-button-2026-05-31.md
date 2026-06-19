# Finding - Move Record button into the sidebar chrome (post-playtest lesson)

**Lane:** routed to **Hunt & Peck**.
**Severity:** product gap surfaced by the 2026-05-31 playtest. NOT a
blocker; combat works without it. But the **whole point** of the recorder
is captured-by-default GM notes through a full session, and the current
placement guarantees the failure mode we just hit.

## What happened

2026-05-31 playtest (campaign "Empty", 59 min). GM ran a full kids'
session with combat + Aim/Auto-Burst + grapple + 2 NPC drops + the new
infection bridge firing. GM hit Ctrl+Shift+M four to five times to
mark moments during play. **Zero marks captured.** Recorder buffer on
the GM tab was never initialised (started_at 22:12:35, dumped 22:13:23,
event_count 1). The Ctrl+Shift+M presses ran `record('mark', {label})`
which hit the `if (!r.enabled) return` early-return in
[lib/playtest-recorder.ts:186](lib/playtest-recorder.ts:186) and were
silently dropped.

Root cause: the **Record button only exists at
`app/stories/[id]/table/page.tsx:5266-5273`** (GM-gated, lives in the
table toolbar). The GM was on the dashboard / NPCs / GM tools for the
whole session - never on /table, so never had the button in sight,
never armed the recorder. Hotkeys fire regardless of route, but they're
silently no-ops when the tab's recorder isn't on.

## What Xero wants (2026-05-31 directive)

> "move the RECORDER button to the dashboard so that from the minute I
> hit it, it's perpetually recording, it should go next to the XERO
> (THRIVER)"

Place the toggle in the **sidebar user-header chip**, alongside the
existing icon row (NotificationBell / MessagesBell / Campfire / Bug).
Visible on every route. One click at session start = full session
captured no matter where the GM navigates.

## Where

- **Mount surface:** [components/Sidebar.tsx:185](components/Sidebar.tsx:185) -
  the `<div style={{ display: 'flex', alignItems: 'center', ... }}>` row
  inside the `!isGuest` branch (lines 168-202). It's a 4-cell flex row
  today: NotificationBell, MessagesBell, Campfire emoji, BugReportButton.
  Add a 5th flex cell with the Record ⏺ toggle.
- **Gate:** `isThriver(userRole)` from [lib/auth/roles.ts](lib/auth/roles.ts)
  (existing import path - per AGENTS.md role-comparison rule). Recorder
  is a Thriver-only diagnostic, not a player tool.
- **Hook to extend or fork:**
  [app/stories/[id]/table/hooks/useRecorderToggle.ts](app/stories/[id]/table/hooks/useRecorderToggle.ts).
  The current hook scopes by `campaignId`. Chrome doesn't know about
  a campaign, so the persistence key needs a different scope (suggested:
  user_id). Either:
    (a) Generalise the existing hook to take a scope key + add
        `readScopeEnabled`/`writeScopeEnabled` to the lib that accept a
        scope label, or
    (b) Add a sibling `useChromeRecorderToggle(userId)` hook that calls
        new `readUserEnabled`/`writeUserEnabled` lib helpers. Cleaner;
        keeps the campaign-scoped table hook untouched.
  Recommend (b) for the smallest blast radius.
- **Lib additions (new exports, do NOT break existing keys):**
    `lib/playtest-recorder.ts`:
      `const USER_ENABLED_KEY_PREFIX = 'tapestry_recorder_user_enabled_'`
      `export function readUserEnabled(userId)` / `writeUserEnabled(userId, enabled)`
  These mirror the existing campaign helpers exactly. Keep both key
  prefixes; a Thriver may legitimately have a chrome toggle AND an
  in-flight per-campaign toggle. (The lib's actual capture is still
  controlled by one `r.enabled` flag - both UIs read/write the same
  flag, they just persist independently.)
- **New component:** `components/RecorderToggleButton.tsx`. Tiny.
  Consumes the new hook, renders a ⏺ glyph button matching the existing
  icon-row visual language. See "Visual spec" below.

## Cascade question

The current `/table` button broadcasts `recorder_start` / `recorder_stop`
on the campaign realtime channel so every connected player tab arms in
lockstep. The chrome button doesn't have a campaign channel.

**Phase A (recommended):** chrome button is single-tab. The cascade
behaviour stays on the `/table` button for multi-client playtests.
Keeps the chrome button trivially simple. The chrome button's *purpose*
is the GM's solo capture across all-routes; the `/table` cascade is for
the player tabs.

**Phase B (later, optional):** unify - retire the `/table` button, have
the chrome button auto-detect an active campaign channel and broadcast
when present. Don't do this in the first commit; it's a separate, larger
change with its own risk surface.

## Bonus fix (1 line, do it in the same commit)

Ctrl+Shift+M silently dropping marks when the recorder is off is the
proximate cause of today's lost notes. Even with the chrome button in
place, this should never silently fail. In
[components/PlaytestRecorder.tsx](components/PlaytestRecorder.tsx) at
the `if (k === 'm')` block, when `getRecorder()?.enabled === false`,
either:
  (a) show an inline toast / alert: "Recorder is off - mark not saved.
      Click the ⏺ button to start." (cheap, ~5 lines), or
  (b) auto-start the recorder, push the mark, and continue capturing.

Recommend (a) - silent state changes are a bigger UX bug than the silent
drop. Surfacing "recorder is off" turns a 60-minute loss into a 1-second
correction.

## Visual spec

Match the existing icon-row pattern at
[Sidebar.tsx:185-202](components/Sidebar.tsx:185). New 5th flex cell:

```tsx
<div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
  <RecorderToggleButton />
</div>
```

Button itself (inside `RecorderToggleButton.tsx`):
- Inactive: `fontSize: '16px'`, `color: '#f5f2ee'`, `opacity: 0.65`,
  Carlito, plain ⏺ glyph, transparent bg.
- Active: same size, `color: '#c0392b'` (the project's "recording" red),
  `opacity: 1`, no border.
- `title`:
    enabled  -> 'Stop recording (downloads JSON)'
    disabled -> 'Start recording'
- 13px min inline rule: not a worry, we're at 16px for icon parity with
  the row.
- Carlito (per the readability rule, even on a glyph button).

## Acceptance

- Sidebar user-header shows the ⏺ button after the BugReportButton,
  Thriver-only.
- Click toggles capture; first click wipes + sets `r.enabled = true` +
  writes `tapestry_recorder_user_enabled_<userId> = '1'` to localStorage.
- Refreshing any route while the toggle is on restores capture without
  user action.
- Second click downloads the JSON dump and clears the localStorage key.
- Hotkey Ctrl+Shift+M, while the recorder is OFF, now warns the user
  instead of silently dropping the mark.
- The existing `/table` Record button still works unchanged (Phase A
  keeps both surfaces). No regression in the GM-cascade behaviour.
- Build + unit tests + font/role/em-dash/arch gates green.

## Reference (already exists, do not duplicate)

- [lib/playtest-recorder.ts](lib/playtest-recorder.ts) - 260 lines, pure
  logic, the ring-buffer + redaction lives here. Add the user-scope
  helpers alongside the existing campaign-scope ones.
- [components/PlaytestRecorder.tsx](components/PlaytestRecorder.tsx) -
  the mount-once chrome component. Already wires the hotkeys + the
  always-on click listener + the console.error monkey-patch. Nothing
  here changes except possibly the Ctrl+Shift+M warn.
- [app/stories/[id]/table/hooks/useRecorderToggle.ts](app/stories/[id]/table/hooks/useRecorderToggle.ts) -
  the existing campaign-scoped hook to mirror.

## Tracking

Add to `tasks/todo.md` CURRENT OPEN, beneath the modal-redesign block,
as:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31] move Record button to sidebar chrome (post-playtest lesson)** - Phase A: chrome ⏺ in `components/Sidebar.tsx:185` icon row, Thriver-gated, user-scoped localStorage key; new `components/RecorderToggleButton.tsx` + `useChromeRecorderToggle` hook; Ctrl+Shift+M warn when recorder off. Keep the `/table` cascade button untouched. Finding: `tasks/finding-recorder-chrome-button-2026-05-31.md`.
```
