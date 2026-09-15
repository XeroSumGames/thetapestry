# Plan: TheTapestry in the one frame, on new pages alongside the old ones

**Written:** 2026-09-15 by the Puffer Fish hub. **Status:** PLAN, waiting for Xero's go. No code until he approves.
**Design (locked):** `tasks/decisions.md` 2026-09-15 entry. **Mockup:** https://claude.ai/artifact/BDavy5FhVgQPUTtJzJwckf, local copy `D:\ClaudeOutput\tapestry-frame.html`.
**Standard:** `D:\Coding\VTTs\TheTable\tasks\vtt-frame-standard.md` (TheTapestry exception in section 4b: the DASHBOARD tab swaps both rails).

## What Xero asked for

> "write the plan. and ideally i would want this on the live site on new pages while the old ones remain active."

So the new frame ships on the **live site**, at **new addresses**, and every page people use today **keeps working exactly as it does now**. Nobody is moved over until Xero decides to switch (a later, separate decision).

## How it works, in plain terms

- Every page on the site today is wrapped by one component, `components/LayoutShell.tsx`, which draws the old left sidebar. It already has a rule that lets certain pages skip that sidebar and draw their own layout (the table and the popouts use it).
- The new pages live under a new address prefix, proposed `/v2` (for example `/v2/dashboard`, `/v2/stories/<id>/table`). Next.js does not allow two pages at the same address, so a prefix is required (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`).
- `/v2` pages skip the old sidebar and draw the new frame instead. Inside the frame they show **the same contents** as today, reusing the same components, so there is no second copy of the site to keep in sync.
- Old pages are not linked to the new ones and do not change, apart from the behind-the-scenes preparation in Phase 0, which must leave them looking and behaving identically.

## The hard constraint: the big files cannot grow

`tasks/_baselines/arch.json` caps the largest files, and the pre-commit gate blocks any growth:

| File | Cap (lines) |
|---|---|
| `app/stories/[id]/table/page.tsx` | 11221 |
| `components/TacticalMap.tsx` | 4506 |
| `components/NpcRoster.tsx` | 2367 |
| `components/MapView.tsx` | 2137 |

The table page, the map and the NPC roster are all at their caps. So the new frame cannot be built by adding "if new layout" branches inside them. The pieces the new frame needs are first pulled **out** of those files into their own components (which shrinks the files), and then both the old and the new layouts use those pieces. That extraction is Phase 0, and it is the riskiest part of the job because it touches pages people use today.

## Phases

Lowest risk first. Each phase ships on its own, can be undone on its own, and does not start until the previous one is verified.

### Phase 0 - Preparation. Nothing looks different anywhere.

- [ ] **0.1 Let `/v2` pages skip the old sidebar.** One rule in `components/LayoutShell.tsx` next to `FULL_WIDTH_PATTERN`, plus `/v2` versions of the pages guests can already see without logging in (`PUBLIC_PAGES`, `PUBLIC_PREFIXES`). This file is the site's login gate, so the hub reviews it line by line. Owner: HP builds, hub reviews.
- [ ] **0.2 Pull the site menu out of `components/Sidebar.tsx`** into its own component: every link as today, including the Thriver-only admin links (Moderation Queue, Logs, the tools) and the "You are a Ghost" state for guests. Also pull out the identity block (logo, The Tapestry v0.5, Survivors present, the user with the bell / chat / campfire / bug / presence icons). The old sidebar renders both pieces unchanged. Owner: HP.
- [ ] **0.3 Pull the PINS panel out of `components/MapView.tsx`** (today it draws inside the map when `showSidebar` is on) into its own component, so the new frame can put it in the right rail. The old Dashboard keeps showing it exactly where it is. Owner: HP.
- [ ] **0.4 Pull the story table's layout blocks out of `app/stories/[id]/table/page.tsx`** into components, with no change in behaviour: the header (starts ~line 5529), the left feed (~6813), the centre maps (~6849 to ~7470), the right panel (~7471) and the bottom portrait strip (~8031). The table's state stays shared, so the old and new tables run the same logic and the same realtime channels. Owner: HP, one reviewable, revertable commit per block.
- [ ] **0.5 Gate before Phase 1:** full E2E suite green against the old pages (currently 177 passing), architecture gate green (the table page gets smaller), and Xero or a playtester runs one normal session on the OLD table and sees nothing different.

**Timing:** 0.4 must not start while Hunt & Peck has unpushed work on the table or maps. Right now HP has two local commits not yet on `main` (`aa10f6c8` route tool on the campaign map, `da8fad50` Eat / Rest / Relax on the Campaign Sheet), and the table page has changed several times this week (observers features). Those land first.

### Phase 1 - The new frame, the Dashboard and the site pages, live at `/v2`

- [ ] **1.1 Build the frame once, as shared components** to the standard: one full-height column; 45px title bar that stays one line (gap 8px, the story session name is the one item that shortens with an ellipsis, minimum 60px); 34px section strip that grows if a name wraps, first tab 280px over the left rail and last tab 260px over the right rail; rails 280px and 260px with 14px padding; centre with no padding; 1px dividers; 28px rail tab strips; rails never scroll (long lists scroll inside their own box); one column below 820px. Owner: HP.
- [ ] **1.2 `/v2` and `/v2/dashboard`: the landing page.** DASHBOARD tab; left rail = the site menu from 0.2; centre = the world map; right rail = the PINS panel from 0.3; map controls stay on the map (decision 4A). Welcome and first-story screens for new users render in the centre as today. Owner: HP.
- [ ] **1.3 The other section tabs:** MY SURVIVORS, MY STORIES, MY COMMUNITIES, THE CAMPFIRE, THE RULES open `/v2` pages that render today's page components in the centre, unchanged. Links inside those pages point at the `/v2` version where one exists, so people stay in the new layout. Owner: HP.
- [ ] **1.4 Measurement test** (like Mothership's `scripts/test-frame.ts`): every `/v2` view at 1920x1080, 1280x800 and 1024x768 asserts the standard's numbers and that no rail or page scrolls. Owner: E2E lane. The Table hub re-measures independently, as it did for the mockup.
- [ ] **1.5 Ship:** push live at `/v2`, not linked from the old site. Xero reviews on the live site using a smoke-test workbook tab from Comms.

### Phase 2 - The story table in the frame, live at `/v2/stories/<id>/table`

- [ ] **2.1 Put the table pieces from 0.4 into the frame.** Strip: DASHBOARD | TACTICAL MAP | COMMUNITY | CAMPAIGN | GM TOOLS. Left rail: Logs / Chat / Both / Map. Right rail: NPCs / Assets / Pins / GM Notes (decision 3A). On the DASHBOARD tab both rails swap to the site menu and PINS panel (the approved exception). Owner: HP.
- [ ] **2.2 Player avatars in the title bar (decision 2C),** replacing the bottom bar. Clicking an avatar opens an in-page popover with the character and player name and the same MAP and POPOUT controls. A counter avatar opens the observer list, keeping this week's "click a name to whisper" behaviour. When the party is larger than fits, a "+N" avatar holds the rest. Owner: HP.
- [ ] **2.3 Mixed-layout sessions work.** A GM on the old table and a player on the new one, in the same session, see each other's rolls, moves, reveals and whispers. Two-browser check, both directions. Owner: E2E lane (automated where possible) and Xero (by hand).
- [ ] **2.4 Tests:** the measurement test from 1.4 covers the table; the existing table E2E specs run against the `/v2` table as well as the old one. Owner: E2E lane.
- [ ] **2.5 Ship:** push live at `/v2`. Xero reviews, then one real playtest session runs on the new table before anyone relies on it.

### Phase 3 - Switch over (NOT part of this approval)

Making `/v2` the default, sending old addresses to the new pages, and eventually removing the old layout code is a separate decision for Xero after Phases 1 and 2 have been used for real.

## Decisions Xero needs to make before Phase 1 ships

1. **The address prefix.** Recommended: `/v2`. Alternative: `/beta` (reads friendlier, but suggests "unstable").
2. **How people find the new pages.** Recommended for now: only through a link Xero shares, so nothing changes for anyone else. Alternative: a small "Try the new layout" link on the old pages, which is visible to every user.

## Risks and how the plan handles them

- **Phase 0 touches the live table.** Behaviour-identical extraction, one commit per block, full E2E suite and a real session on the old table before moving on; every commit can be reverted on its own.
- **Two layouts to keep working until the switch.** Both use the same extracted components and the same state, so a table fix lands once, not twice. The E2E specs run against both.
- **The login gate.** `/v2` pages must follow exactly the same guest and logged-in rules as today. The hub reviews 0.1.
- **The onboarding tour and welcome flow** point at the old sidebar's links, so the tour stays on the old pages until the switch.
- **Popouts and sheets** (`-sheet`, `-popout` routes) are not touched.
- **Usage data:** visits to `/v2` pages are logged under their own addresses, so Xero can see who is using the new layout.
- **No database changes** are needed for any phase.

## Owners

- **Hub (Puffer Fish):** this plan; review of every commit, especially 0.1 and 0.4; independent verification; pre-ship check at every ship.
- **Hunt & Peck:** builds 0.1 to 2.2.
- **E2E lane:** measurement tests, mixed-layout checks, running existing specs against both layouts.
- **Comms:** a smoke-test workbook tab for Xero at each ship, and any questions for him.
- **Table hub:** independent measurement against the standard.

## Recommended sequencing against current work

Hunt & Peck's current queue has bugs players hit today (NPC card First Impressions, fog-of-war banner, player NPC folders, hand-raise, dice roller, Campaign Sheet Party Status). Recommended: HP clears those and pushes its two unpushed commits, then starts Phase 0. A dependable table matters more for the Kickstarter than the new layout, and Phase 0.4 is safest when nobody else is editing the table page.
