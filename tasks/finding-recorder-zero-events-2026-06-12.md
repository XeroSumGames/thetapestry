# Finding: Two player recorders captured 0 events in Session 63

**Date:** 2026-06-12
**Route:** HP lane
**Severity:** UX / LOW (affects post-session analysis; no in-session impact)
**Evidence:** Session 63 recorder dumps

---

## Symptom

Percy Bent (`playtest-percy_bent-2026-06-12T20-08-00-889Z.json`) and Pesky Larue
(`playtest-pesky_larue-2026-06-12T20-08-00-883Z.json`) both produced dumps with
`event_count: 0` despite being on the table page for ~38 minutes each:

```json
{
  "meta": {
    "started_at": "2026-06-12T19:29:45.457Z",
    "duration_ms": 2295426,   // 38 minutes
    "event_count": 0
  },
  "events": []
}
```

Tony Bushell (Mikey Shevik) produced 206 events and Xero 729 events. Both recorders
were clearly working. The 0-event dumps are player-side.

## Likely cause

The recorder auto-dumps on `beforeunload` (tab close / page unload) regardless of
whether recording was active. If the recording was NOT turned on (chrome circle button
not clicked), the dump still fires but `events` is empty.

This is the most likely cause: Percy and Pesky were new to the playtest setup and
did not turn the recorder ON, or turned it on after the session ended.

A secondary possibility is a recorder bug affecting non-GM tabs when the GM is the
session owner. The existing `finding-recorder-chrome-button-2026-05-31.md` documents
a separate recorder UI issue.

## Not a blocker

The recorder is a diagnostic tool for the developer, not a game feature. Players
are not harmed by a 0-event dump. However it means we cannot audit player-side
behavior for those participants.

## Suggested fix

1. **UX: Add a visible recording status indicator** beyond the chrome circle button.
   When recording is OFF, show a clearly inactive state (e.g. grey label "NOT
   RECORDING" below the button, or a pulsing red dot when ON). Players should not
   need to remember to turn it on - it should be obvious whether it's active.

2. **Optional: Auto-start recording when the player joins an active session.** If
   the session is already running (start-session event has fired), auto-enable the
   recorder for all new tab joins. Currently it is OFF by default and requires a
   manual click.

## Test

1. Join an active session as a player (non-GM).
2. Do NOT click the recorder chrome circle.
3. Perform 3 actions.
4. Close the tab.
5. Open the dump file - it should either be empty (current behavior, not a bug) or
   the auto-start fix should have captured the events (if fix is applied).
