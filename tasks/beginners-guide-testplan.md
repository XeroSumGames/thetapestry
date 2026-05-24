# Beginners-Guide Test Plan - complete coverage map

The canonical E2E coverage plan, organized **chapter-by-chapter against
`docs/Beginners-Guide/`** (the 14-chapter folder). Every user-facing feature in
the guide is a numbered test item. This is the "does the suite cover everything
in the guide?" answer. (The engineering-lens companion - Gate-0 tiers, seeding
mechanics, fragility ratings - lives in `e2e-systems-coverage-testplan-2026-05-24.md`.)

**Status legend:** `[x]` done + green on main · `[~]` in flight · `[ ]` planned
**Automatability:** (DOM) pure DOM/text · (RT) realtime 2-context · (CANVAS) needs the tactical-map JS bridge · (RANDOM) dice - assert outcome-class/flow not exact values · (MANUAL) excluded, see bottom

Items tagged **[Gate 0: X]** are the phase7 A-F critical-path subset.

---

## Ch 1 - Navigating the Site
1. [x] (DOM) Sidebar renders every nav destination; the global-route sweep loads each clean.
2. [x] (DOM) Thriver sees the Tools section + Moderation Queue; Survivor does not. `role-nav.spec`
3. [x] (RT) "Survivors present: N" reflects how many accounts are online; Thriver hover-list shows who. `presence.spec` (3 live sessions -> count `>= 3`; Thriver hover-list names marv + percy. Usernames resolved via the GM's Thriver creds: a player's REST self-read of profiles is empty under RLS.)
4. [ ] (DOM) Full-width / popout / `-sheet` routes hide the sidebar.

## Ch 2 - Pins, Notifications, and Roles
1. [x] (DOM) Survivor rumor pin (pin_type='rumor', status='pending') is hidden from other players (RLS), visible to its author, and surfaced in the Thriver moderation Rumor Queue (asserted queued; never approved). `world-pin-to-queue.spec` -- SECURITY NOTE: map_pins status is CLIENT-set only (no enforce trigger like campfire's), so this mirrors the Survivor client rather than proving a server gate. Flagged: a crafted REST insert can self-approve a world pin (same bypass campfire's trigger closes).
2. [~] (DOM) Thriver world-pin goes live immediately - status is client-set ('approved'); covered indirectly (the queue test inserts the Survivor variant). No server enforcement to assert. See SECURITY NOTE on 2.1.
3. [ ] (RT) Notifications fire + render: player joined, session opened, pin approved/rejected.
4. [x] (DOM) Role badges + GM-vs-player gating (covered by 1.2 + per-feature reveal tests).

## Ch 3 - The World Map
1. [x] (DOM) `/map` loads; pins render; category folders populate (sweep).
2. [ ] (RT) GM drops a campaign pin -> appears for a player after reveal `[Gate 0: E]`.
3. [ ] (RT) Whisper posted in one context -> shows in the other's feed `[Gate 0: E]`.
4. [ ] (DOM) Pin categories/icons; eye-toggle hides/shows a category.
5. [ ] (DOM) Pin -> tactical-scene link (double-click opens); promote pin to world map.
6. [ ] (DOM) Route Planner (GM) draws a route with distance/time. (low priority)

## Ch 4 - Creating a Character
1. [x] (DOM) Random Character creates + persists + owner can delete. `character-create.spec`
2. [x] (DOM) Quick Character (6-step) saves and appears in the list. `char-create-methods.spec`
3. [x] (DOM) Paradigm pick -> final review -> save. `char-create-methods.spec`
4. [x] (DOM) Backstory wizard (10 steps) -> save. `char-create-methods.spec`
5. [ ] (DOM) Health trackers (WP/RP/Stress) click -> value persists on reload. DEFERRED out of char-create: trackers write to `character_states`, which only exists once a char is IN a campaign - a standalone newly-created char has none. Belongs with live-state/combat coverage (needs an in-campaign char + the character-sheet/table), not the creation funnels.
6. [~] (RANDOM) 0-WP death countdown + Insight-trade modal (folded into combat).

## Ch 5 - The Rules
1. [x] (DOM) `/rules` + all sub-routes render clean (in the route sweep).
2. [x] (DOM) The 8 sections + 4 appendices each render their `<h1>` title (real content, not just an error-free shell); deep links (`/rules/combat/damage`, `/rules/equipment/item-traits`, `/rules/communities/activity-blocks`) render. `rules-deeplinks.spec`

## Ch 6 - Creating a Story
1. [x] (DOM) GM creates a story (setting picker -> Custom) -> appears in My Stories with a 6-char invite code. `story-lifecycle.spec`
2. [x] (DOM) Player joins via code -> persists in `campaign_members` + GM roster reflects it ON RELOAD. `story-lifecycle.spec` (NB: roster is refetch-based, NOT realtime - app/stories/[id]/page.tsx:49; "GM notified on join" is a SEPARATE untested claim, no notification asserted.)
3. [x] (DOM) Player leaves a story -> drops off `campaign_members`. `story-lifecycle.spec`
4. [ ] (DOM) Start a story from a Rumor/module (clone) - see Ch 14.
5. [ ] (DOM) Story-page actions render: Launch / Edit / Clone / Snapshots / Sessions / Publish.

## Ch 7 - The Table and Sessions
1. [ ] (RT) GM Start Session -> counter increments + players notified; dice enabled `[Gate 0: A3]`.
2. [ ] (RT) Chat message from one side shows on the other `[Gate 0: A3]`.
3. [ ] (DOM) End-session modal (summary/cliffhanger) -> appears in Sessions history.
4. [ ] (RT/CANVAS) Tactical/Campaign toggle + Share Map pushes the map to players `[Gate 0: A3]`.
5. [ ] (DOM) GM vs player right-panel tabs (NPCs / Assets / Notes) show the right scope.

## Ch 8 - The Tactical Map and Fog of War
1. [x] (DOM) Scene + tokens render on `/table` (sweep).
2. [ ] (CANVAS) GM moves a token -> moves on the player's map `[Gate 0: A3/B]`.
3. [ ] (CANVAS) Fog paint / rectangle / erase + Fog All / Clear All persist across reload.
4. [ ] (CANVAS/RT) A PC token clears a 6-cell fog circle that travels with it + respects walls/doors.
5. [ ] (RT) Scene activate / share / zoom / ping / door-open propagate to players `[Gate 0: A3]`.
6. [ ] (CANVAS) Range circles (Engaged 5ft / Move 9ft / Weapon) render for the selected token.

## Ch 9 - Combat
1. [~] (RT) Start Combat -> initiative bar populates on GM + all players ("IN COMBAT") `[Gate 0: A1]`.
2. [~] (RANDOM) Attack -> Roll modal -> a result lands in the log; actor actions 2->1->0; auto nextTurn `[Gate 0: A2]`.
3. [~] (RT) Damage applies and propagates to the target owner's context `[Gate 0: A3]`.
4. [~] (RANDOM) CMod stack (Aim + Cover + Range) shows as itemized terms in the breakdown `[Gate 0: A2]`.
5. [~] (RANDOM) Blast radius (grenade) applies per-target lines on the tactical map.
6. [~] (RANDOM) Mortal wound -> +1 Stress + Insight-trade prompt on the owner's window.
7. [~] (RT) End Combat -> wound-infection modal fires on the wounded PC owner's window `[Gate 0: F]`.

## Ch 10 - NPCs and Recruitment
1. [ ] (DOM) Create / Generate / Clone / Edit / Delete an NPC.
2. [x] (RT) GM reveals a hidden NPC -> player's roster shows it live `[Gate 0: C]`. `section-c-npc-reveal.spec`
3. [ ] (RT) Apply damage from the table -> roster WP/RP updates live for the player.
4. [ ] (DOM) Populate generates a 1A:2F:3G:4B roster.
5. [ ] (DOM) Publish an NPC to the World Library.
6. [ ] (DOM) Recruit modal: Conscript shows the credible-threat gate; Apprentice unlocks ONLY on a double-6.

## Ch 11 - Vehicles
1. [ ] (CANVAS/RT) Seat assign (Driver/Navigator/Brewer/Passenger) with the 30ft gate + MOVE HERE auto-confirm `[Gate 0: B]`.
2. [ ] (RT) Board / disembark -> tokens + the aboard-count badge update across windows `[Gate 0: B]`.
3. [ ] (RT) Show Arc toggles the firing cone on the other window's tactical map `[Gate 0: B]`.
4. [ ] (DOM) Fuel drums install / transfer / refill; fuel bar updates.
5. [ ] (DOM) Brewing: Gather Materials -> brew banner.
6. [ ] (RT) Shared cargo edit propagates PC <-> vehicle.
7. [~] (RANDOM) Vehicle WP/RP damage + Lasting Wounds chip.
8. [~] (RANDOM) Driver DRIVE / Navigate combat actions; passengers fire from windows.

## Ch 12 - Communities
1. [ ] (DOM) Create a community; the Group->Community 13-member threshold chip (green/amber/red).
2. [ ] (DOM) Add/remove members; assign roles (Gatherer/Maintainer/Safety).
3. [~] (RANDOM) Run Weekly Check (Fed -> Clothed -> Morale); GM slot overrides make outcomes assertable.
4. [x] (RT) Stockpile deposit shows live in the other open panel `[Gate 0: D-1]`. `section-d-stockpile.spec`
5. [~] (RT) Stockpile qty update propagates `[Gate 0: D-2]`.
6. [~] (RT) Create a community while the panel's open -> a deposit into it still propagates (resubscribe) `[Gate 0: D-3]`.
7. [ ] (DOM) Re-balance Roles; Skip Week; Retention Check on 3rd failure.
8. [x] (DOM) `/stories/<id>/community` dashboard renders (sweep).

## Ch 13 - The Campfire
1. [x] (DOM) Portal renders (Setting Hubs, Featured Module, Explore) (sweep).
2. [x] (DOM) New forum thread (Thriver, via composer) + reply persists (forums2 voting EXCLUDED - experimental). `campfire-social.spec`
3. [ ] (DOM) LFG post + "I'm Interested" from another context.
4. [x] (DOM) Moderation role-gate: a Thriver post auto-approves; a Survivor global/setting post is FORCED to `pending` by the DB trigger even if it claims `approved` (unbypassable). Covered for forum_threads (the trigger is shared across forum_threads/war_stories/lfg_posts, so it generalises; war-story + LFG composers themselves still untested). `campfire-social.spec`
5. [ ] (DOM) Timestamps tool returns a Discord token.

## Ch 14 - Rumors
1. [x] (DOM) Browse / filter / sort the marketplace (sweep).
2. [ ] (DOM) Publish a PRIVATE module from a story.
3. [ ] (DOM) Create a story from that module (clone) -> content lands; teardown removes both.
4. [ ] (DOM) Version history: "update available" button + "Your clone" chip + diff.
5. [ ] (DOM) Ratings / reviews.

---

## EXCLUDED (bright lines + genuinely fragile - never automated)
- Account signup / login automation (Turnstile + passwords; sessions human-captured), payments/Stripe, email/password change on `/account`. (The REVERSIBLE half of `/account` IS covered by `account-settings.spec`: username change through the real form + an `avatar_url` round-trip both persist across reload. The avatar file-UPLOAD bytes path stays manual - storage upsert at a fixed path is irreversible on prod.)
- Sending messages/emails to REAL users; any all-user broadcast.
- Moderation ACTIONS at scale (ban/suspend/lock/hide); deleting pre-existing user content; bulk ops on real data.
- `/campfire/forums2` voting (self-labelled experimental).
- Exact dice values (the 548 vitest unit tests own the math; E2E asserts flow/outcome-class).

## Coverage snapshot (2026-05-24)
Green on main: Ch1.1-1.3, Ch2.1, Ch3.1, Ch4.1-4.4, Ch5.1-5.2, Ch6.1-6.3, Ch10.2, Ch12.4, Ch12.8, Ch13.1-13.2, Ch13.4, Ch14.1, account-settings (Sys P, reversible half) + the infra (sweep, auto-login, seeding, role-nav). In flight: Ch12.5-12.6 (D-2/D-3). The Gate-0 critical path is Ch7.1-7.4, Ch8.2-8.5, Ch9 (all), Ch11.1-11.3, Ch12.4-12.6, Ch3.2-3.3, Ch10.2 - i.e. the [Gate 0] tags above.
