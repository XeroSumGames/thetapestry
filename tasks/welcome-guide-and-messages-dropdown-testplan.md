# Test plan — A Guide to the Tapestry redesign + Messages dropdown

## What changed
1. `/welcome` is now "A Guide to the Tapestry" — the reference hub for **returning** users (not new users).
   - Removed the centered top button bar.
   - Re-titled to "A Guide to the Tapestry".
   - Standard left sidebar now shows on this page.
   - New layout: hero + section-header + card grid (destinations, survivor-creation paths, off-platform links).
2. Messages bell (💬 in the sidebar header) now opens a **dropdown** like the notification bell.
   - One row per recent conversation (up to 10), unread + read.
   - Unread rows: red left border, dark `#111` background, **bold headline**, full opacity.
   - Read rows: no border, transparent background, normal weight, dim opacity.
   - Headline format (latest from someone else): `Marv sent you a message at 08.43pm on 4/28/2026`.
   - Headline format (latest sent by me): `You sent Marv a message at 08.43pm on 4/28/2026`.
   - Per-row **OPEN** button → opens `/messages?conv=<id>` in a new tab and selects that thread.
   - Header **VIEW ALL** button → opens `/messages` in a new tab (no auto-select).

## How to verify

### A. Welcome page is now the Guide
1. Go to `https://thetapestry.distemperverse.com/welcome` (or `/welcome` locally).
2. **Sidebar** — confirm the standard left sidebar is visible (same one as on `/dashboard`, `/map`, etc.).
3. **No top bar** — the previous `Dashboard / Characters / The World / My Stories` row at the top is gone.
4. **Title** — page header reads `A GUIDE TO THE TAPESTRY` in big Barlow Condensed, with a small red eyebrow `REFERENCE & HELP` above it.
5. **Subtitle** — short paragraph explaining this is the returning-user hub, plus a "New here? Start with [Welcome to the DistemperVerse]" link to `/firsttimers`.
6. **Card grid — The Tapestry** — six cards (The World, My Survivors, My Stories, My Communities, Modules, The Campfire). Click each card's button → confirm it goes to the matching destination.
7. **Card grid — Building a Survivor** — four cards (Creating a Survivor, Backstory Generation, Quick Character, Random Character). Click each → confirm correct destination.
8. **Quick Reference** — placeholder card visible (we'll fill this in next).
9. **Off-platform** — three external link buttons (DistemperVerse, XeroSumGames, XeroSumStudio). Each opens in a new tab.
10. **Sidebar link** — click `A Guide to the Tapestry` in the sidebar → it lands on this page.
11. **Firsttimers separation** — visit `/firsttimers` and confirm it still has NO sidebar (unchanged behavior — that page is still the new-user landing).

### B. Messages dropdown
1. **No conversations** — brand-new account: click 💬 → dropdown shows `NO MESSAGES YET` and a `VIEW ALL` link in the header.
2. **Account with read history but no unread** — bell is dim; click it → dropdown shows recent conversations as **read rows** (no red border, dimmer text, normal weight).
3. **With unread** — have someone send you a message (or send yourself one from a second account):
   - Badge appears on the bell with red `1` (or `9+`).
   - Bell goes bright + colored.
   - Click the bell → dropdown lists conversations newest-first.
   - **Unread row** at top: red left border, dark background, **bolded** headline `<sender> sent you a message at HH.MMam/pm on M/D/YYYY`.
   - Time format: zero-padded hour, period (not colon), lowercase am/pm — e.g. `08.43pm` not `8:43 PM`.
4. **Latest message from me** — find a conv where you sent the last message. Headline reads `You sent <other> a message at HH.MMam/pm on M/D/YYYY` (rendered as a read row).
5. **OPEN deep-link** — click the per-row `OPEN`:
   - New tab opens at `/messages?conv=<id>`.
   - The messages page lands with that conversation already selected (active in the right pane).
6. **VIEW ALL** — click the `VIEW ALL` link in the dropdown header → new tab opens at `/messages` with the conversation list visible, no specific thread selected.
7. **Clear unread** — open `/messages` and click into the unread conversation. Wait a beat (the realtime update on `conversation_participants.last_read_at` propagates), then return to the dropdown:
   - Bell goes dim again.
   - The previously-unread row drops the red border + bold and becomes a read row in place.
8. **Realtime arrival** — leave the dropdown open; have someone send you a message. The new row should appear at the top without a manual refresh.
9. **Multiple unread** — with 2+ unread conversations, all unread items render bolded with the red border, sorted newest-first.
10. **Outside-click closes** — open dropdown, click anywhere outside it → it closes.

### C. Regression checks
- `/dashboard`, `/map`, `/characters`, `/stories`, `/communities`, `/modules` — sidebar visible, nothing else changed.
- `/login`, `/signup`, `/firsttimers` — sidebar still hidden.
- Story-table page (`/stories/<id>/table`) — message bell + notification bell both still render at the top (the table page renders its own copy of these in `app/stories/[id]/table/page.tsx`).
- TypeScript `npx tsc --noEmit -p .` — clean.
- Font-size guardrail `node scripts/check-font-sizes.mjs` — clean.

## Known follow-ups (not in this change)
- The "Quick Reference" card on the guide is a placeholder — needs cheat-sheet content (CDP, WP, RP, Stress, Inspiration, etc.) per Xero's direction.
