# HammerTime Renderer — Test Plan

**Goal:** Discord `<t:UNIX>` and `<t:UNIX:FORMAT>` tokens render as formatted dates/times across all message surfaces in The Tapestry.

## Quick reference — sample tokens to paste

Copy these into any of the surfaces below and verify they render as a styled blue-tinted chip (not literal angle-bracket text):

- `<t:1762416000>` — short date+time (default `f`) → "November 6, 2025 at 12:00 AM" or your locale equivalent
- `<t:1762416000:t>` — short time → "12:00 AM"
- `<t:1762416000:T>` — long time → "12:00:00 AM"
- `<t:1762416000:d>` — short date → "11/6/2025"
- `<t:1762416000:D>` — long date → "November 6, 2025"
- `<t:1762416000:F>` — long date+time → "Thursday, November 6, 2025 at 12:00 AM"
- `<t:1762416000:R>` — relative → "in 6 months" / "6 months ago" (depending on current date)

Hover any chip → tooltip should show the full long-format absolute date.

## Surfaces to test

### 1. DMs (`/messages`)
- Open any conversation, send a message containing all 7 tokens above
- Verify each renders as a chip
- Verify URLs in the same message still linkify (paste `https://example.com`)
- **Edge:** mix HammerTime + URL in one message: `Game starts <t:1762416000:F> at https://discord.gg/foo`

### 2. Table chat (`/stories/[id]/table` → Chat tab)
- Type a chat message with `<t:1762416000:R>` and Send
- Verify chip renders in the Chat tab and the Both tab
- Whisper a message with a token — verify it renders inside the whisper box too

### 3. Forums (`/campfire/forums/[id]`)
- Create a thread with body: `Session is <t:1762416000:F>. RSVP at https://example.com`
- Verify thread body renders chip + link
- Reply to the thread with `<t:1762416000:R>` — verify reply chip renders

### 4. LFG (`/campfire/lfg`)
- Create an LFG post with `<t:1762416000:F>` in the body
- Verify chip renders in the post detail view

### 5. GM Notes (table page → GM Notes panel)
- Add a note with content containing `<t:1762416000:F>`
- Expand the note — verify chip renders inside the `<pre>` block
- Verify whitespace (newlines) still preserved

### 6. Player Notes (table page → Player Notes panel)
- Same as GM Notes but as a player

### 7. Progression Log (character sheet)
- Add a manual note entry containing a token (only `note`-type entries are user-authored)
- Verify it renders inline

## Edge cases

- **Invalid Unix:** `<t:abc>` → should render literally as `<t:abc>` (no chip)
- **Unknown format:** `<t:1762416000:Z>` → falls back to default `f` format (renders as chip)
- **Negative timestamp:** `<t:-1>` → should render as Dec 31, 1969 (epoch -1s)
- **Empty body:** posting an empty message shouldn't error
- **Token at start/end of message:** `<t:1762416000>` alone, or surrounded by other text — both work

## What "looks right"

- Chip has subtle blue-tinted background (`rgba(122, 179, 212, 0.15)`)
- Inline-block, doesn't break the line layout
- Matches surrounding font size (`fontSize: 'inherit'`)
- Cursor goes to `help` on hover, tooltip appears
- Color is `#cce0f5` (legible on the dark backgrounds across all surfaces — never the banned `#3a3a3a`)

## Smoke for typecheck

`npx tsc --noEmit` should return clean (verified pre-commit).
`node scripts/check-font-sizes.mjs` should return clean (verified pre-commit).
