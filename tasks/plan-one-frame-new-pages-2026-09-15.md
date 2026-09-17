# Plan: TheTapestry in the one frame - built and evaluated LOCALLY, nothing live until Xero says so

**Written:** 2026-09-15 by the Puffer Fish hub. **REVISED 2026-09-16** after Xero changed the shipping approach.
**Status:** PLAN, waiting for Xero's go on Phase 0.
**Design (locked):** `tasks/decisions.md` 2026-09-15 entry. **Mockup:** https://claude.ai/artifact/BDavy5FhVgQPUTtJzJwckf, local copy `D:\ClaudeOutput\tapestry-frame.html`.
**Standard:** `D:\Coding\VTTs\TheTable\tasks\vtt-frame-standard.md` (TheTapestry exception in section 4b: the DASHBOARD tab swaps both rails).

## What Xero asked for

Original ask, 2026-09-15:

> "write the plan. and ideally i would want this on the live site on new pages while the old ones remain active."

REVISED ask, 2026-09-16, which supersedes it:

> "ok, i like the plan, but think we should go another way. let's make the changes locally and evaluate there before pushing live. let's not change anything to the live site till we have thoroughly tested it"

So the frame is built and evaluated on the LOCAL dev server. Nothing reaches the live site until Xero has tested it and explicitly says to ship. The new pages still live at their own addresses alongside the old ones; that part of the design is unchanged. What changed is where they exist: localhost only, until he decides otherwise.

## How it works, in plain terms

- Every page today is wrapped by one component, `components/LayoutShell.tsx`, which draws the old left sidebar. It already has a rule letting certain pages skip that sidebar and draw their own layout (the table and the popouts use it).
- The new pages live under their own address prefix, proposed `/v2` (for example `/v2/dashboard`, `/v2/stories/<id>/table`). Next.js does not allow two pages at the same address, so a prefix is required (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`).
- `/v2` pages skip the old sidebar and draw the new frame, showing the SAME contents as today by reusing the same components. There is no second copy of the site to keep in sync.
- Old pages do not change, apart from the behind-the-scenes preparation in Phase 0, which must leave them looking and behaving identically.
- **All of this is evaluated on the local dev server on Xero's machine.** Work accumulates on branches and in the primary checkout, unpushed. `main` stays as it is, so the live site stays as it is.

## The one thing local testing cannot avoid: there is only ONE database

`.env.local` and the linked Supabase project are the same live project (`jbudzglgtxeoaufpejrv`). There is no staging database. Consequences:

- Any change needing a new column or policy needs it in that one live database before it can be tested anywhere, localhost included.
- Additive, nullable columns are invisible in practice: no existing data changes, and nothing reads the column until app code that selects it runs. But it is still technically a live database change, so it needs Xero's explicit go each time, named in advance.
- Local testing writes REAL data (rolls, tokens, folders, scenes) into the live database, because it is the same one his playtesters use. Use a throwaway campaign for anything that would matter.

## The hard constraint: the big files cannot grow

`tasks/_baselines/arch.json` caps the largest files, and the pre-commit gate blocks growth:

| File | Cap (lines) |
|---|---|
| `app/stories/[id]/table/page.tsx` | 11221 |
| `components/TacticalMap.tsx` | 4506 |
| `components/NpcRoster.tsx` | 2367 |
| `components/MapView.tsx` | 2137 |

All four sit at their caps. The new frame cannot be built by adding "if new layout" branches inside them. The pieces it needs are pulled OUT into their own components first (which shrinks those files), then both layouts use those pieces. That is Phase 0, and it is the riskiest part because it touches pages in use today.

## Phases

Lowest risk first. Each phase is evaluated on localhost and signed off by Xero before the next begins. **No phase pushes to `main`.**

### Phase 0 - Preparation. Nothing looks different anywhere.

- [ ] **0.1 Let `/v2` pages skip the old sidebar.** One rule in `components/LayoutShell.tsx` beside `FULL_WIDTH_PATTERN`, plus `/v2` equivalents of the guest-visible pages (`PUBLIC_PAGES`, `PUBLIC_PREFIXES`). This file is the login gate, so the hub reviews it line by line. Owner: HP builds, hub reviews.
- [ ] **0.2 Pull the site menu out of `components/Sidebar.tsx`** into its own component: every link as today, including the Thriver-only admin links (Moderation Queue, Logs, the tools) and the "You are a Ghost" state. Also pull out the identity block (logo, The Tapestry v0.5, Survivors present, the user with bell / chat / campfire / bug / presence icons). The old sidebar renders both unchanged. Owner: HP.
- [ ] **0.3 Pull the PINS panel out of `components/MapView.tsx`** (today it draws inside the map when `showSidebar` is on) into its own component, so the new frame can put it in a rail. The old Dashboard keeps showing it exactly where it is. Owner: HP.
- [ ] **0.4 Pull the story table's layout blocks out of `app/stories/[id]/table/page.tsx`** into components, with no behaviour change: header (~5529), left feed (~6813), centre maps (~6849-7470), right panel (~7471), bottom portrait strip (~8031). Table state stays shared, so both layouts run the same logic and the same realtime channels. Owner: HP, one reviewable commit per block.
- [ ] **0.5 Gate before Phase 1:** full E2E suite green, architecture gate green (the table page shrinks), and Xero runs one normal session on the OLD table on localhost and sees nothing different.

**Timing:** 0.4 must not start while other table-page work is in flight. HP currently holds unpushed local work (route tool, Eat / Rest / Relax, dice roller) plus two reviewed-but-unshipped fixes on `hp/player-bugs`.

### Phase 1 - The new frame, the Dashboard and the site pages, on localhost

- [ ] **1.1 Build the frame once, as shared components,** to the standard: one full-height column; 45px title bar that stays one line (item gap 8px, the story session name is the one item that shortens with an ellipsis, minimum 60px); 34px section strip that grows if a name wraps, first tab 280px over the left rail and last 260px over the right; rails 280px and 260px with 14px padding; centre with no padding; 1px dividers; 28px rail tab strips; rails never scroll (long lists scroll in their own box); one column below 820px. Owner: HP.
- [ ] **1.2 `/v2` and `/v2/dashboard`: the landing page.** DASHBOARD tab; left rail = the site menu from 0.2; centre = the world map; right rail = the PINS panel from 0.3; map controls stay on the map (decision 4A). Welcome and first-story screens render in the centre as today. Owner: HP.
- [ ] **1.3 The other section tabs:** MY SURVIVORS, MY STORIES, MY COMMUNITIES, THE CAMPFIRE, THE RULES open `/v2` pages rendering today's page components in the centre, unchanged. Internal links point at the `/v2` version where one exists. Owner: HP.
- [ ] **1.4 Measurement test** (like Mothership's `scripts/test-frame.ts`): every `/v2` view at 1920x1080, 1280x800 and 1024x768 asserts the standard's numbers and that no rail or page scrolls. Owner: E2E lane, run against localhost. The Table hub re-measures independently, as it did for the mockup.
- [ ] **1.5 Xero evaluates on localhost** with a smoke-test workbook tab from Comms. Nothing is pushed.

### Phase 2 - The story table in the frame, on localhost

- [ ] **2.1 Put the table pieces from 0.4 into the frame.** Strip: DASHBOARD | TACTICAL MAP | COMMUNITY | CAMPAIGN | GM TOOLS. Left rail: Logs / Chat / Both / Map. Right rail: NPCs / Assets / Pins / GM Notes (3A). On DASHBOARD both rails swap to the site menu and PINS panel (the approved exception). Owner: HP.
- [ ] **2.2 Player avatars in the title bar (2C),** replacing the bottom bar. Clicking an avatar opens an in-page popover with the character and player name and the same MAP and POPOUT controls. A counter avatar opens the observer list, keeping the "click a name to whisper" behaviour. A "+N" avatar holds the overflow when the party is larger than fits. Owner: HP.
- [ ] **2.3 Mixed-layout sessions work.** A GM on the old table and a player on the new one, in the same session, see each other's rolls, moves, reveals and whispers. Two browsers, both directions, on localhost. Owner: E2E lane where automatable, plus Xero by hand.
- [ ] **2.4 Tests:** the measurement test covers the table; existing table E2E specs run against the `/v2` table as well as the old one. Owner: E2E lane.
- [ ] **2.5 Xero evaluates on localhost,** including one real playtest session on the new table if he wants it before shipping.

### Phase 3 - First live deployment (a separate decision, NOT part of this approval)

When Xero has tested Phases 1 and 2 locally and says to ship, the hub pushes them. Only then does anything reach the live site. Making `/v2` the default and retiring the old layout is a further decision after that.

## Decisions Xero needs to make

1. **Go on Phase 0.**
2. **The address prefix.** Recommended: `/v2`. Alternative: `/beta`.
3. **The `shared_scene_id` column** for the already-reviewed fog fix (`sql/add-campaigns-shared-scene-id-2026-09-15.sql`): additive, nullable, no data change, nothing reads it until the code runs, but it must exist in the one live database before the fog fix can be tested even on localhost. Recommended: apply it, then both reviewed fixes go on localhost for him.

## Risks and how the plan handles them

- **Phase 0 touches the live table's code.** Behaviour-identical extraction, one commit per block, full E2E suite and a real session on the old table on localhost before moving on. Nothing is live, so a mistake costs a rebase, not an outage.
- **Unpushed work piles up.** Everything stays branch-backed (never only in a working tree), and the primary checkout is treated as a disposable composition of those branches, rebased onto `main` as needed. The hub tracks what is composed there.
- **Two layouts to keep working until the switch.** Both use the same extracted components and state, so a table fix lands once. E2E specs run against both.
- **The login gate.** `/v2` pages must follow exactly the same guest and logged-in rules as today. The hub reviews 0.1.
- **The onboarding tour and welcome flow** point at the old sidebar's links, so the tour stays on the old pages until the switch.
- **Popouts and sheets** (`-sheet`, `-popout`) are untouched.
- **Local testing writes to the live database.** Use a throwaway campaign for anything destructive.

## Owners

- **Hub (Puffer Fish):** this plan; review of every commit, especially 0.1 and 0.4; independent verification; the pre-ship check whenever Xero does decide to ship; applying any live SQL, only on his explicit go.
- **Hunt & Peck:** builds 0.1 to 2.2, on branches, unpushed.
- **E2E lane:** measurement tests, mixed-layout checks, existing specs against both layouts, run locally.
- **Comms:** a smoke-test workbook tab for Xero at each evaluation point, and any questions for him.
- **Table hub:** independent measurement against the standard.

## Recommended sequencing

HP's current queue is bugs players hit today (NPC folders, fog of war, hand-raise, dice roller, Campaign Sheet Party Status). Those get finished and evaluated locally first. A dependable table matters more for the Kickstarter than the new layout, and Phase 0.4 is safest when nobody else is editing the table page.

---

## As built: Phase 1 decisions worth keeping (recorded 2026-09-16 by the hub)

Phase 1 is navigable on localhost. These are the decisions taken during the
build that are NOT inferable from reading the resulting files, which is the only
reason they are written down.

### The six routes, and why one label does not match its path

| Section strip label | Route |
|---|---|
| DASHBOARD | `/v2/dashboard` |
| MY SURVIVORS | `/v2/characters` |
| MY STORIES | `/v2/stories` |
| MY COMMUNITIES | `/v2/communities` |
| THE CAMPFIRE | `/v2/campfire` |
| THE RULES | `/v2/rules` |

`/v2` redirects to `/v2/dashboard`. Source of truth is `V2_SECTIONS` in
`components/V2Shell.tsx`.

**MY SURVIVORS deliberately maps to `/v2/characters`, not `/v2/survivors`, and
this is load-bearing on the login gate.** `PUBLIC_PAGES_ALL` in
`lib/auth/public-pages.ts` is DERIVED by prefixing each old public path with
`/v2`. So `/characters` being public makes `/v2/characters` public in the same
edit, permanently, with nobody remembering to do it. Spelling it
`/v2/survivors` would have required a hand-written entry and reintroduced
exactly the drift the derivation exists to prevent - on the guest gate, where
drift is most expensive. The same derivation is why `/v2/communities` correctly
stays behind the login: `/communities` was never public.

The general rule: the user-facing LABEL and the security-relevant IDENTIFIER
have different owners. Rename the label freely; the path mirrors the original.

**Consequence for anyone testing:** logged out, five of the six render the real
frame (dashboard, characters, stories, campfire, rules). `/v2/communities`
serves a LOGIN FORM with `?redirect=%2Fv2%2Fcommunities`. That is correct. A
sweep that measures it logged out will find no rails and report a frame failure
that does not exist.

### Server components reach the frame as a prop, not an import

`app/rules/page.tsx` is a SERVER component; the other four sections are client
ones. A server component cannot be imported INTO a client component, but it can
be passed into one as a prop. So each `/v2` page is a thin server wrapper that
hands its existing page in as the `centre` of `components/V2Shell.tsx`.
`/v2/dashboard` is the single client exception, because the map is a dynamic
import with `ssr: false` (Leaflet touches `window` on import).

This constrains anyone who touches these pages and is the first thing they will
trip over.

### The onboarding tour entry is deliberately NOT mapped

"A Guide to the Tapestry" still points at `/dashboard?tour=1` even though
`/v2/dashboard` exists. The tour targets the OLD sidebar's links BY SELECTOR, so
pointing it into the frame would break it SILENTLY - no error, no exception, at
the exact moment a new user first meets the product. It stays on the old pages
until the switch. This is trap-avoidance, not a missing page.

### Left rail links that still leave the frame

Deliberate, because no `/v2` page exists for them yet, and a dead link is worse
than an ejecting one: Join a Story, Rumors, Quick Reference, and the Survivors
group (Creating a Survivor, Backstory Generation, Quick Character, Random
Character, Paradigms). The DistemperVerse link is external and correctly leaves.
Implemented as a lookup through `navHref()`, which is the identity function in
`sidebar` mode, so the old sidebar is untouched.

**The whole THRIVER TOOLS section also leaves the frame**, and it is called out
separately because only Xero and other Thrivers can see it - which makes him the
ONLY person who will ever hit it, and therefore the likeliest source of a "the
new layout is broken" report. Every item: Moderation Queue, Logs, Ape Generator
Log, Feature Manifest, Create Tokens, Character Photos, Publish from Snapshot,
Rescale Tactical Scenes, Reseed Campaign, Campaign Explorer, Copy Map Position.

`Copy Map Position` is not a link at all - it dispatches a `window` event that
`MapView` listens for, so it only does anything on a page where the map is
mounted. That was true before `/v2` and is unchanged by it. Worth knowing before
someone "fixes" it into a route.

### Precedence: the standard governs geometry, the mockup governs the rest

The house VTT frame standard governs frame GEOMETRY - rails 280/260, title bar
45, section strip 34 growing on wrap, rail tabs 28, the 820px stack. It is
SILENT on Tapestry cosmetics, so for anything it does not cover, the approved
mockup (`D:\ClaudeOutput\tapestry-frame.html`) wins: menu type at 14px with a
2px accent border, the red selected-tab underline, tab padding and tracking.
Do not split the difference toward the old sidebar's 15px/3px.

### Colour handoffs name the role and the value, never a range

`--line` and `--divider` shipped SWAPPED because the hub's handoff quoted them
as the range "#2a2a2a to #2e2e2e" without saying which was which. The mockup's
own `:root` settled it: the grid gap is the darker `#2e2e2e`, hairlines are
`#2a2a2a`. Invisible in a screenshot, wrong against what Xero approved, and the
class of error that survives review because nobody diffs two greys.

The Table hub's stronger form, from Mothership where the same pair INVERTS in
lightness between the Terminal and Zine identities while the roles stay fixed:
name the role, name the value, and never let a token's name imply a shade.
There is no stable "darker one" to point at, so a range-based handoff is not
merely underspecified - it is unspecifiable.

### Still open at the end of Phase 1

**1.2b is DONE on `/v2/dashboard`, and it was NOT the lift this plan
described.** Measured at 1280x800, independently by both lanes: grid
`280px 738px 260px`, `frame--noright` gone, leaflet widened to 738 with 16
tiles, map controls back to a 6px offset.

**The plan was wrong about the approach and the correction is worth keeping.**
This section previously specified lifting MapView's panel state into a shared
container - roughly 25 props plus three documented couplings. Instead `MapView`
KEEPS ownership and renders the panel through `createPortal` into an element the
rail supplies. The old Dashboard and `/map` are untouched because the prop is
simply ABSENT there, which means "nothing else moved" is provable rather than
argued - worth more than the smaller diff, and much more next to a 456-line
extraction. Prefer this shape for the remaining panels.

The portal target is STATE, not a ref. That is load-bearing twice over: a ref
would not re-render the map with its target, so the panel would never mount at
all; and keying the mount on the target rather than on `sidebarOpen` is what
stops the panel's close button emptying the rail (see below).

All three couplings recorded in 0.3 came true, which is what made this routine:
the canvas is `flex:1` beside a fixed-width sibling so it widened by itself; the
hardcoded `right: sidebarOpen ? '306px' : '6px'` would have left the zoom and
layer buttons floating 300px inside the canvas edge over open map; and
`invalidateSize` keyed only on `sidebarOpen` would have left Leaflet drawing at
pre-portal dimensions, which presents as a rendering bug rather than a missing
call.

`PinsPanel` gained `inRail` for its ROOT BOX ONLY - inline it is 300px with a
left border because it sits beside the canvas; a rail is 260px and draws its own
edge.

**Open defect:** the panel's `✕` at `components/PinsPanel.tsx:101` is rendered
unconditionally rather than gated on `inRail`, and calls `setSidebarOpen(false)`.
In the rail it is INERT - clicked, measured, the rail stays at 260px with all its
children - because the mount follows the portal target. But it hovers to
`#f5a89a`, so it looks live and does nothing. Gate it on `!inRail`: in the rail
the panel IS the rail and there is nothing to close. Had the portal been keyed on
`sidebarOpen`, this would have been an empty 260px dead column with no way to
restore the panel.

**RULED 2026-09-16 by the hub: all six sections get the right rail.** The
mockup's `rightRail()` branches on the world view, not on the DASHBOARD tab, so
three-column everywhere is what Xero approved; both the hub and HP have told the
E2E lane that six three-column pages are the end state; and it is coherent on the
merits, because the standard makes the right rail the PLAYER's panel and World
Events / My Pins / Whispers are no more map-specific than a notes panel. A rail
that appears on one page and vanishes on the next five reads as a bug whatever
the CSS permits. Until that follow-up lands, the other five stay two-column and
must be treated as EXPECTED-ABSENT-FOR-NOW - do NOT invert them into asserted
two-column, which is the same trap one page later.

**Rail tabs need a session.** The rail tab strip (World Events / My Pins /
Whispers) only renders for a logged-in user; `PinsPanel` gates it on `userId`, as
on the live site. Logged out the rail shows its header, count and pin rows but no
tab strip. A logged-out spec asserting three rail tabs at 28px fails on correct
pre-`/v2` behaviour, not on the frame.

**Ratchets stay untouched.** `components/MapView.tsx` is at 1705 against a 2137
ceiling and `app/vehicle/page.tsx` at 1458 against 1459. Both must be ratcheted
from `main` only, never from the composed tree, or the baseline records numbers
that do not exist on main.
