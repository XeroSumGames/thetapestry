# HP Fix: Recorder Mark Prompt - Replace `window.prompt()` with In-App Input

**Origin:** Session 24 playtest, 2026-06-16. Tony's mark at `00:20:57 UTC`: "when recruiting there was a browser level warning."  
**Puffer diagnosis:** The native browser prompt dialog from the recorder's mark feature (Ctrl+Shift+M -> `window.prompt()`), NOT a Recruit/Apprentice path bug.  
**Confirmed clean:** "Take as Apprentice" handler at `page.tsx:10181-10215` (Supabase update + state + progression log + custom event only). `closeRecruitModal` at `page.tsx:4123-4129` (state resets only). No `window.confirm/alert/location` in either path.

---

## Root cause

`components/PlaytestRecorder.tsx:244`:
```js
const label = window.prompt('Mark this moment - what happened?')
```

This fires on Ctrl+Shift+M when the recorder is active. The native browser `prompt()` dialog is visually indistinguishable from a security warning or unexpected system dialog to a casual user. Tony described it as a "browser level warning" because he didn't recognize the native dialog as part of the app.

---

## Fix

Replace the `window.prompt()` call in `PlaytestRecorder.tsx` with an in-app floating input overlay.

**Approach:** Add a `markPending` boolean state + a `<dialog>` or fixed-position `<div>` in the recorder's render. On Ctrl+Shift+M:
1. Set `markPending = true` (renders the overlay)
2. User types in `<input>` and presses Enter (or a "Mark" button)
3. Save the mark + set `markPending = false`
4. On Escape or click-outside: cancel without saving

The overlay should:
- Appear in the top-right corner or bottom-left (away from the recorder button)
- Show a short prompt label: "Mark this moment"
- Auto-focus the input on open
- Be visually consistent with app style (dark background, Carlito font, 13px minimum)

If a lighter approach is preferred: a styled `<input>` injected temporarily into the recorder component's DOM that floats above the page with `position: fixed`.

---

## Files to touch

- `components/PlaytestRecorder.tsx:244` - replace `window.prompt()` with state + overlay approach
- No other files required (the recorder is self-contained)

---

## Verification steps (HP runs)

1. Ensure recorder is ON (Thriver account, ⏺ button active)
2. Navigate to any table page
3. Press Ctrl+Shift+M
4. Confirm: an IN-APP input overlay appears (not a native browser dialog)
5. Type "test mark" and press Enter
6. Confirm: overlay disappears; no native dialog
7. Export recorder data and confirm the mark appears in the events array with the typed label
8. Press Ctrl+Shift+M again and press Escape
9. Confirm: overlay dismisses with no mark saved

---

## Not a unit test candidate

The fix is UI-level (replacing a native API call with a DOM element). No pure-function logic to test. Manual verification per steps above is sufficient.

---

**Priority:** LOW - recorder is Thriver-only, doesn't affect core table experience. Can ship any time before Beta-500 dry-run.  
**Routed by:** Puffer Fish, 2026-06-16.
