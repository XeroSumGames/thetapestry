# Playtest Recorder — 2026-05-04

A "tivo" for the third playtest. Captures the last ~2000 UI events
(clicks, route changes, errors, console.error/warn, manual marks) in an
in-memory ring buffer that you can dump to JSON when something goes weird.

## What got built

- `lib/playtest-recorder.ts` — pure ring buffer + redaction + dump helpers.
- `components/PlaytestRecorder.tsx` — client component that wires DOM
  listeners + hotkeys + the corner indicator.
- `app/layout.tsx` — mounts `<PlaytestRecorder />` once, site-wide.

It's **always on for everyone** — no flag, no opt-in, no URL param. Cost
is one click listener and a 2000-entry array (~400KB worst case). Players
don't have to do anything special; the GM (you) just tells them the hotkeys.

## Hotkeys (memorize these three)

| Keys             | Does                                                      |
|------------------|-----------------------------------------------------------|
| `Ctrl+Shift+L`   | **Dump** — downloads `playtest-<you>-<timestamp>.json`    |
| `Ctrl+Shift+M`   | **Mark** — prompts for a label, inserts a marker event    |
| `Ctrl+Shift+P`   | **Peek** — prints last 20 events to the browser console   |

There is also a tiny dim red dot in the bottom-right corner of every page —
hover for a tooltip that lists the hotkeys. If you don't see it, the
recorder didn't load.

## Pre-session smoke test (do this before players join)

1. `npm run dev` (or load whichever Vercel preview URL you're using).
2. Open the site, log in as yourself.
3. **Confirm the dot**: red dot bottom-right of viewport. Hover → tooltip says "Playtest recorder…".
4. **Confirm capture**: open DevTools console, hit `Ctrl+Shift+P`. You
   should see `[playtest] last 20: [...]` with at least a `route` entry
   and your login click.
5. **Confirm dump**: hit `Ctrl+Shift+L`. A JSON file should download.
   Open it — verify:
   - `meta.user_email` is your email.
   - `meta.event_count` ≥ 5.
   - `events[]` has `kind: 'click'` entries with sensible `text` /
     `button_text` fields.
   - No password / token / cookie strings appear anywhere.
6. **Confirm mark**: hit `Ctrl+Shift+M`, type "smoke test", OK.
   Then `Ctrl+Shift+L` again. Open the new dump — last event should be
   `{ kind: 'mark', data: { label: 'smoke test', ... } }`.
7. **Confirm error capture**: in DevTools, run `throw new Error('test')`.
   Then `Ctrl+Shift+L`. Last events should include a `kind: 'error'`
   entry with `message: 'Uncaught Error: test'`.
8. **Confirm route capture**: navigate from `/` to `/communities` to
   `/rumors`. Dump. You should see two `kind: 'route'` entries.

If all 8 pass, you're ready.

## During the session — for YOU (GM)

- **Run a screen recorder** on your machine (OBS, Loom, even Win+G
  Game Bar). The JSON timeline + the video timeline let you cross-
  reference when something goes wrong.
- **Note the wall-clock start time** at session open. The dump's
  `meta.started_at` is the recorder boot, but you'll cross-reference
  against your video timestamps too.
- **Mark moments as they happen.** `Ctrl+Shift+M` → "Aria's token
  warped to wrong cell". Takes 4 seconds, saves you 20 minutes
  later.
- **Don't dump until end of session** unless something catastrophic
  happens. The buffer holds 2000 events — that's enough for a
  ~3-hour session of moderate activity. (Also: the buffer auto-saves
  the last 500 to localStorage on every error and mark, so a refresh
  won't wipe interesting context.)
- **At session end**: hit `Ctrl+Shift+L`, save the JSON to
  `C:\TheTapestry\tasks\playtest-dumps\` (create the folder if you
  haven't).

## During the session — for PLAYERS

Send them this exact message before you start:

> Tonight we're recording UI events to help me catch bugs. Two
> things I need you to do:
>
> 1. **If anything looks weird** — token snaps to wrong cell, button
>    doesn't respond, layout breaks — press **Ctrl+Shift+M**, type a
>    one-line description ("my HP didn't update after eating"), hit
>    OK. Takes 3 seconds. Then keep playing.
>
> 2. **At the end of the session** — press **Ctrl+Shift+L**.
>    A JSON file will download. Send it to me however (Discord DM,
>    email, whatever).
>
> No screen recording on your end unless you want to. We're not
> capturing input values, passwords, or anything you type — just
> clicks, route changes, and errors.

## After the session — debugging from a dump

The dump structure:

```json
{
  "meta": {
    "dumped_at": "2026-05-05T03:14:22.123Z",
    "started_at": "2026-05-05T00:01:08.456Z",
    "duration_ms": 11593667,
    "session_id": "abc-123",
    "user_id": "uuid",
    "user_email": "player@example.com",
    "user_agent": "...",
    "viewport": { "w": 1920, "h": 1080 },
    "pathname": "/rumors/play/...",
    "event_count": 1847,
    "app_version": "playtest-2026-05-04"
  },
  "events": [
    { "t": "2026-05-05T00:01:09.000Z", "ms": 544, "kind": "route", "data": { "from": "/", "to": "/login" } },
    { "t": "2026-05-05T00:01:14.211Z", "ms": 5755, "kind": "click", "data": { "tag": "button", "button_text": "Sign in", ... } }
    // ...
  ]
}
```

Workflow:
1. Player says "the bug happened around 8:42pm".
2. Convert that to ms-since-start using `meta.started_at`, then grep
   the `events` array for entries near that `ms` value (or just open
   in a JSON viewer and scroll).
3. Look for the nearest `mark` events — those are the player's own
   bookmarks.
4. Look for `error` / `rejection` / `console-error` events in the
   surrounding window — those are usually the smoking gun.
5. Cross-reference your screen recording at the same wall-clock time
   to see what the UI looked like.

## What's intentionally NOT captured (privacy)

- Input field values (text, textarea contents, password fields).
- Cookies, localStorage contents (only the session id is included
  in meta).
- Authorization headers, tokens, password fields. The redaction
  pass strips any object key matching `/password|token|authorization|cookie/i`.

## Risk / rollback

- If the recorder breaks the site for some reason, comment out the
  `<PlaytestRecorder />` line in `app/layout.tsx` and redeploy.
  Everything else (LayoutShell, VisitLogger) is independent.
- The console.error / console.warn wrappers are pass-through — they
  always call the original after recording, so existing log behavior
  is preserved. (Already-existing head-script wrappers from the spam
  filter still run first; ours run on top of those.)
- The `auth-cache` import resolves user identity in the background.
  If it fails, the recorder still works — events just won't be
  tagged with user_id.

## Follow-ups for after tonight (don't do tonight)

- Server-side ingest to a Supabase `playtest_events` table so we
  don't depend on players remembering to dump.
- A simple replay UI: paste a JSON dump, scrub through events.
- Auto-flush buffer to a Supabase function on every error.
- Capture network failures (failed fetch responses).
