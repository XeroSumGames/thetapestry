# User Guide Acceptance Test Plan - 2026-06-12

> Built from: 14 chapter guides + 2 standalone guides (C:\TheTapestry\docs\).
> Purpose: verify every claim in the user guides works as described on production.
> Lane: Playwright / E2E.
>
> Legend:
> - GREEN - already covered by an existing spec
> - AUTOMATABLE - no spec yet; can be written as REST/DOM Playwright test
> - MANUAL - requires canvas interaction, dice outcomes, or 2-client visual eyeball
> - EXCLUDED - bright line (auth changes, payments, bulk user ops)

---

## Coverage snapshot (as of 2026-06-12)

| Spec file | Chapters covered |
|---|---|
| `auth.setup.ts` | All (session infrastructure) |
| `role-nav.spec` | Ch1, Ch2 |
| `presence.spec` | Ch1 |
| `account-settings.spec` | Ch1 |
| `console-network.spec` | All routes |
| `rules-deeplinks.spec` | Ch5 |
| `character-create.spec` | Ch4 |
| `char-create-methods.spec` | Ch4 |
| `npc-roster-crud.spec` | Ch10 |
| `inventory-trade.spec` | Ch4, Ch11 |
| `story-lifecycle.spec` | Ch6 |
| `session-lifecycle.spec` | Ch7 |
| `world-pin-to-queue.spec` | Ch2, Ch3 |
| `section-e-pins.spec` | Ch3 |
| `pins-catchup.spec` | Ch3 |
| `section-a1-combat-start.spec` | Ch9 |
| `section-a3-token-move.spec` | Ch8 |
| `combat-flow.spec` (A/B/C) | Ch9 |
| `grapple-family.spec` | Ch9 |
| `hidden-npc-initiative.spec` | Ch8, Ch9, Ch10 |
| `tactical-map-render.spec` | Ch8, Tactical Guide |
| `tactical-cell-px-constraint.spec` | Ch8, Tactical Guide |
| `wall-segment-door-cross-client.spec` | Ch8, Tactical Guide |
| `section-d-stockpile.spec` | Ch12 |
| `communities-lifecycle.spec` | Ch12 |
| `messages-dm.spec` | Ch13 |
| `campfire-social.spec` | Ch13 |
| `campfire-lfg-warstory.spec` | Ch13 |
| `section-e-whispers.spec` | Ch13 |
| `rumors-publish-clone.spec` | Ch14 |
| `vehicle-maintenance-checks.spec` | Ch11 |

---

## Chapter 1 - Navigating the Site

### Claims in the guide
- Sidebar is always visible (except full-screen pages like the Table)
- "Survivors present: N" counter updates when players come online
- Notification red dot appears when there are unread notifications
- All 8+ main nav destinations exist and are accessible
- Thriver-only Tools section visible only to admins (Thriver role)
- Account panel has 4-5 icons (Messages, Notifications, Campfire, Bug Report, Recorder)
- Recorder toggle visible to Thrivers only

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Survivors present counter shows online users | GREEN | `presence.spec` |
| Thriver sees Moderation Queue + Tools; Survivor does not | GREEN | `role-nav.spec` |
| All nav destinations return 200 with no console errors | GREEN | `console-network.spec` |
| Username + avatar change persists | GREEN | `account-settings.spec` |
| Notification red dot clears after mark-all-read | AUTOMATABLE | - |
| Sidebar absent on /stories/[id]/table | AUTOMATABLE | - |
| Recorder toggle absent for non-Thriver | AUTOMATABLE | - |

### Gap specs to write

**`nav-notifications.spec`** (AUTOMATABLE, ~20 min):
- Login as marv, trigger a notification (GM starts session in a shared campaign)
- Assert bell has unread indicator (DOM - red dot class or aria-label count)
- Open bell dropdown, assert at least 1 notification entry renders
- Click "Mark all read", assert indicator gone

---

## Chapter 2 - Pins, Notifications, and Roles

### Claims in the guide
- World-map pins from Survivors go to moderation queue (Rumor category)
- Admin-placed world pins go live immediately
- Campaign pins hidden by default; GM show/hide controls visibility to players
- Pin categories: 16 categories in 8x2 grid
- Folder system for pin organization
- Notifications fire for: player joins, session start, module update, pin approved/rejected
- First Impression CMod permanently attaches to NPC relationship

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Survivor pin enters moderation queue (hidden from others) | GREEN | `world-pin-to-queue.spec` |
| Admin (Thriver) pin goes live immediately; visible on map | GREEN | `world-pin-to-queue.spec` |
| REST insert claiming {gm,approved} forced back to rumor/pending by trigger | GREEN | `world-pin-to-queue.spec` |
| Approved world pin appears on other client's map live | GREEN | `section-e-pins.spec` |
| Notification fires when player joins a Story | AUTOMATABLE | - |
| Campaign pin hidden from players by default, visible after GM shows it | AUTOMATABLE | - |
| First Impression CMod auto-fills on next roll with same NPC | MANUAL | - |

### Gap specs to write

**`story-join-notification.spec`** (AUTOMATABLE, ~25 min):
- GM creates a Story (throwaway), captures invite code
- Player joins by code (marv context)
- Assert GM receives a notification (REST poll `notifications` table for an entry with correct type)

**`campaign-pins-visibility.spec`** (AUTOMATABLE, ~25 min):
- GM creates campaign pin in a throwaway campaign (REST INSERT into `campaign_pins`)
- Player loads the Table page for that campaign
- Assert player cannot see the pin (hidden by default) - REST GET from player creds returns nothing visible
- GM PATCHes `show_to_players=true`
- Assert player's REST query now returns the pin

---

## Chapter 3 - The World Map

### Claims in the guide
- Pan/zoom/search controls work
- 7 map style options (Satellite, Topo, Street, Voyager, Humanitarian, Positron, Dark)
- Pins Panel with PUBLIC/MY PINS/CAMPAIGN tabs
- Route Planner (GM only)
- Vehicle bubble shows party's current position on campaign map
- Campaign pin visibility changes propagate to all players in real-time

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Approved world pin shows cross-client live | GREEN | `section-e-pins.spec` |
| visibilitychange catch-up surfaces pins folder | GREEN | `pins-catchup.spec` |
| Survivor pin enters queue, Thriver sees it | GREEN | `world-pin-to-queue.spec` |
| Map page loads without console errors | GREEN | `console-network.spec` |
| Campaign pin visibility propagates in real-time | AUTOMATABLE | (see Ch2 gap) |
| Map style toggle renders without errors | AUTOMATABLE | - |
| Route planner creates a route | MANUAL | canvas |

---

## Chapter 4 - Creating a Character

### Claims in the guide
- 4 creation methods: Backstory wizard, Paradigm pick, Quick Character, Random Character
- Backstory wizard has 9+ steps with progress dots
- Random Character one-click inserts a persisted row
- WP/RP/Stress trackers on character card are clickable to apply damage/heal
- 0 WP triggers mortal wound modal (spend Insight Dice)
- 0 RP triggers unconscious
- Any 0 track grants +1 Stress automatically
- Portrait upload updates token on tactical maps in real-time
- Insight Dice earned on double 1s or double 6s

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Random Character inserts persisted row, owner can delete | GREEN | `character-create.spec` |
| Quick + Backstory wizards + Paradigm pick -> save -> REST-verified | GREEN | `char-create-methods.spec` |
| PC inventory custom items + catalog items + encumbrance | GREEN | `inventory-trade.spec` |
| PC-to-PC trade moves item atomically | GREEN | `inventory-trade.spec` |
| WP/RP click damage persists (REST verify) | AUTOMATABLE | - |
| Stress pip click persists (REST verify) | AUTOMATABLE | - |
| 0 WP = +1 Stress auto-applied | AUTOMATABLE | - |
| Mortal wound modal fires at 0 WP | MANUAL | dice-gated |
| Portrait upload updates token cross-client | MANUAL | canvas + requires combat |

### Gap specs to write

**`character-card-trackers.spec`** (AUTOMATABLE, ~30 min):
- REST-create a throwaway character for marv
- Click the WP tracker once to decrement (GM applies damage via `gm_apply_damage` RPC is cleaner)
- Assert `character_states.wp_current` decremented via REST poll
- Click Stress pip; assert `character_states.stress` incremented
- Test 0-WP -> stress auto-bump: call `gm_apply_damage` to bring wp to 0; assert stress = min(5, before+1)

---

## Chapter 5 - The Rules

### Claims in the guide
- 8 main sections render content and deep-link correctly
- 4 appendices render and deep-link correctly

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| All 8 sections + 4 appendices render content; deep-links work | GREEN | `rules-deeplinks.spec` |

**Ch5 is fully covered. No gaps.**

---

## Chapter 6 - Creating a Story

### Claims in the guide
- Create Story with name, description, setting, map style, starting location
- Start from a published Rumor module
- Invite code/link is active immediately after creation
- Player join notification fires to GM instantly
- Player appears on GM roster immediately upon joining
- Player can leave the Story
- GM can clone the Story (creates independent copy)
- GM can publish Story as Rumor module
- Snapshots auto-capture on demand; rollback available
- Story deletion requires typing the full name to confirm

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Create Story -> 6-char invite code -> player joins -> roster reflects -> player leaves | GREEN | `story-lifecycle.spec` |
| Publish Story as module -> version history -> subscriber update available | GREEN | `rumors-publish-clone.spec` |
| Story creation page loads without errors | GREEN | `console-network.spec` |
| Clone story creates independent copy | AUTOMATABLE | - |
| Snapshot creates record (REST verify) | AUTOMATABLE | - |
| Delete Story requires full-name confirmation | MANUAL | requires destructive action |

### Gap specs to write

**`story-clone.spec`** (AUTOMATABLE, ~20 min):
- GM creates a Story (throwaway)
- REST POST to the clone endpoint (or use the UI)
- Assert a new Story row exists with different id but same name pattern
- CASCADE-delete both

**`story-snapshot.spec`** (AUTOMATABLE, ~15 min):
- GM creates a throwaway Story, opens its Table
- REST-trigger snapshot creation (or use the UI snapshot button)
- Assert a `campaign_snapshots` row exists for that campaign via REST
- Teardown

---

## Chapter 7 - The Table and Sessions

### Claims in the guide
- Start Session increments counter and notifies all players
- Roll modal: formula display (2d6 + Attribute + Skill + CMod), CMod picker, Insight Die, Roll button
- First Impression flow on NPC meet
- Stress Check flow
- Advantages tab: GM grants, player uses
- End session with summary/notes/cliffhanger modal
- Chat/log feed updates in real-time
- Incoming chat plays ping and flashes CHAT tab 3x
- Snapshot captures entire campaign state
- Export full session log as styled HTML

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Session start/end increments counter | GREEN | `session-lifecycle.spec` |
| GM starts combat -> player sees IN THE MOMENT live | GREEN | `section-a1-combat-start.spec` |
| Roll log entries appear in feed (combat-flow Phase C) | GREEN | `combat-flow.spec` |
| Table page loads without console errors | GREEN | `console-network.spec` |
| Session history persists (REST verify) | AUTOMATABLE | - |
| Advantages grant -> player sees pending -> use -> consumed | AUTOMATABLE | - |
| End session modal saves summary + notes (REST verify) | AUTOMATABLE | - |
| Incoming chat causes CHAT tab flash (3x) | MANUAL | timing-sensitive visual |
| First Impression CMod auto-fill | MANUAL | requires NPC roll interaction |
| Roll modal formula calculation | MANUAL | dice + UI interaction |
| Export session log HTML | MANUAL | download verification |

### Gap specs to write

**`advantages-lifecycle.spec`** (AUTOMATABLE, ~30 min):
- GM in throwaway campaign inserts an Advantage for marv (REST INSERT into `advantages`)
- Assert marv sees a pending Advantage via REST
- GM marks it granted (PATCH)
- Assert marv can "use" it (REST PATCH to consumed=true or equivalent)
- Teardown

**`session-notes.spec`** (AUTOMATABLE, ~20 min):
- GM starts a session in throwaway campaign
- GM ends session with REST PATCH containing summary + notes fields
- Assert the `campaign_sessions` row has the correct text via REST

---

## Chapter 8 - The Tactical Map and Fog of War

### Claims in the guide
- Scene creation asks for Name; first scene defaults to 20x15 cols/rows, 3 ft/cell
- Multiple scenes; switching auto-broadcasts to all players
- Upload JPG/PNG background with corner handles; lock when aligned
- Token types: PC (round, blue), NPC (round, red), Object (square, orange)
- Special objects: Walls (block movement + vision), Doors (block/pass), Windows (pass vision only)
- Range circles: Engaged 5 ft (green), Move 9 ft (blue), Weapon Range (red)
- Fog paint mode: Paint/Rectangle/Erase tools, Fog All/Clear All
- PC Sight slider (0-50 cells) clears fog respecting walls/doors/windows
- Fog persists across reloads/reconnects/session boundaries
- Alt+click pings visible to everyone, fade ~1 second
- GM Share Map -> players see current scene; Share View -> one-shot scroll/zoom snap
- Combat start auto-shares scene to players
- Active combatant shows gold ring + arrow; hidden NPCs show "Waiting..." to players
- cell_px default is 35; valid range 5-300 (DB CHECK constraint)
- Door/window toggle cross-client (player can toggle, propagates to all)

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Cross-client identical render fields (scale, scene id) | GREEN | `tactical-map-render.spec` |
| ZERO setImgScale calls (img_scale out of render) | GREEN | `tactical-map-render.spec` |
| Locked-map "Center" escape hatch: player sees it, GM does not | GREEN | `tactical-map-render.spec` |
| cell_px PATCH outside 5-300 rejected with PG check_violation | GREEN | `tactical-cell-px-constraint.spec` |
| Player door/window toggle persists cross-client (DB + GM refetch) | GREEN | `wall-segment-door-cross-client.spec` |
| Token move triggers scene_tokens refetch on player context | GREEN | `section-a3-token-move.spec` |
| Hidden NPC initiative: player bar omits chip; GM reveals; player sees it | GREEN | `hidden-npc-initiative.spec` |
| 12-check 2-client gate (render + scene propagation + share map + resize + reload + move-follow) | GREEN | manual, gate CLOSED 2026-05-30 |
| Fog persistence across reload | MANUAL | canvas |
| Sight slider clears fog around PC | MANUAL | canvas |
| Walls block vision (fog stays behind wall) | MANUAL | canvas |
| Pings visible to all, fade correctly | MANUAL | canvas |
| Corner-handle map alignment (unlock/lock) | MANUAL | canvas drag |
| Range circles render correctly | MANUAL | canvas |
| Multiple scene switch auto-broadcasts | AUTOMATABLE | - |

### Gap specs to write

**`scene-switch-broadcast.spec`** (AUTOMATABLE, ~25 min):
- Throwaway campaign with 2 scenes (REST INSERT into `tactical_scenes`)
- GM PATCHes the second scene to `is_active=true`
- Assert player's REST poll for `tactical_scenes?is_active=eq.true` returns the new scene within 15s (realtime)

---

## Chapter 9 - Combat

### Claims in the guide
- Start combat (GM): pick NPCs, optional "Drop" character
- Initiative roll: 2d6 + Acumen + Dexterity; sorted highest-to-lowest
- 2 actions per turn; "Next Turn" advance; "Next ->" button
- Active combatant has gold ring + arrow on tactical map
- Initiative bar renders combatants in roll-DESC, name-ASC order
- aria-current="true" on active combatant's initiative-bar row
- Actions: Aim, Attack, Charge, Coordinate, Defend, Grapple, Move, Rapid Fire, Ready Weapon, Reposition, Sprint, Subdue, Take Cover, Unarmed, Stabilize
- Grapple: Grapple (hold), Subdue (choke), Break Free
- Grappled target loses 1 action (consumed now or carried to next turn via pending_action_loss)
- Blast radius: full to Engaged, 50% to Close, 25% to Far
- 0 WP = mortal wound; death countdown 4 + Physicality rounds; Insight Dice modal
- Lasting Wound: post-mortal-wound Physicality roll; Table 12 outcomes
- Infection check: post-combat auto-fires; Low Insight heal roll also fires it
- End Combat clears initiative; grapple states release
- Environmental damage: Falling (3 WP / 3 RP per 10 ft), Drowning (3 WP / 3 RP per round)

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| GM starts "Into the Moment" -> player sees "IN THE MOMENT" live | GREEN | `section-a1-combat-start.spec` |
| Combat Phase A: initiative_order one is_active=true + character_states per PC | GREEN | `combat-flow.spec` |
| Combat Phase B: initiative-bar DOM ordering (roll DESC) + GM turn-advance + aria-current shift cross-client | GREEN | `combat-flow.spec` |
| Combat Phase C v1: gm_apply_damage -> wp=0 + stress+1 + roll_log row + player realtime refetch | GREEN | `combat-flow.spec` |
| Combat Phase C v2: p_infection_risk gates (PC mortal-wound only) | GREEN | `combat-flow.spec` |
| Combat Phase C v3: bridge inserts wound_infection_warning sibling row | GREEN | `combat-flow.spec` |
| Combat Phase C v4: infection banner renders on owner + GM within 15s | GREEN | `combat-flow.spec` |
| Grapple contract: roll_log row with canon outcome + raw label shape | GREEN | `grapple-family.spec` |
| Hidden NPC: player bar omits chip -> GM reveals -> player sees chip + roll_log row | GREEN | `hidden-npc-initiative.spec` |
| Grappled defender loses 1 action (actions_remaining decrement) | AUTOMATABLE | queued |
| Subdue + Release buttons visible in action bar while isGrappling | AUTOMATABLE | queued |
| Break Free: breaker's actions_remaining decrements | AUTOMATABLE | queued |
| Mortal wound modal fires at 0 WP | MANUAL | dice-gated |
| Lasting wound: Physicality roll -> Table 12 result | MANUAL | dice-gated |
| Blast radius auto-applies split damage (50%/25%) | MANUAL | dice + canvas |
| Attack rolls, CMod breakdown, Insight Dice on roll | MANUAL | dice |
| Environmental damage (Falling/Drowning) button applies damage | AUTOMATABLE | - |

### Gap specs to write

**`grapple-subdue-breakfree.spec`** (AUTOMATABLE, ~45 min) - extends `grapple-family.spec`:
- Successful grapple -> REST poll: defender's `initiative_order.actions_remaining` decremented
- While isGrappling: assert Subdue + Release buttons visible in GM action bar (DOM)
- Break Free: player clicks Break Free -> REST poll: breaker's `actions_remaining` decremented

**`env-damage.spec`** (AUTOMATABLE, ~20 min):
- Throwaway campaign + marv PC with character_states
- GM clicks Env Dmg -> Falling (3 WP / 3 RP per 10 ft) for 10 ft
- Assert `character_states` wp decremented by 3 + rp decremented by 3 via REST
- Repeat for Drowning mode

---

## Chapter 10 - NPCs and Recruitment

### Claims in the guide
- Create NPC with name, type, portrait, RAPID, skills, weapons, motivation/complication/personality, GM notes, status
- Generate random NPC of chosen type
- Populate: 1 Antagonist / 2 Foes / 3 Goons / 4 Friendlies
- Clone NPC with auto-numbered name
- Show/Hide reveals/hides NPC to all players immediately
- Hidden NPC auto-reveals on combat start (unless per-combatant Hidden chip used)
- Recruitment modal: COHORT/CONSCRIPT/CONVERT; locked approaches grayed out
- Conscript Morale counter drains weekly
- Apprentice bond: arrives with name, age, motivation, complication, profession; survives morale departures

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| NPC full lifecycle: create -> edit -> clone (auto-numbered) -> delete | GREEN | `npc-roster-crud.spec` |
| Hidden NPC: PATCH hidden=true -> player bar omits chip -> GM reveals -> player sees chip + roll_log | GREEN | `hidden-npc-initiative.spec` |
| NPC roster CRUD (per-card title= controls) REST-verified | GREEN | `npc-roster-crud.spec` |
| Show/Hide propagates to player in real-time | GREEN | `hidden-npc-initiative.spec` |
| Recruitment modal flow (outcome in roll_log) | AUTOMATABLE | - |
| NPC sheet RAPID/skills clickable for rolls | MANUAL | dice + UI |
| Conscript morale drain each weekly check | AUTOMATABLE | - |
| Apprentice bond survives morale departure | MANUAL | complex state machine |

### Gap specs to write

**`npc-recruitment.spec`** (AUTOMATABLE, ~40 min):
- Throwaway campaign, GM seeds an NPC and starts a session
- GM opens Recruit modal for the NPC (REST: session must be active)
- Assert `roll_log` row appears with an NPC recruitment outcome within 15s (realtime)
- Assert the NPC's status changed in DB (member added to `community_members` or similar)

---

## Chapter 11 - Vehicles

### Claims in the guide
- Open Vehicle dropdown in Table header to see campaign vehicles
- Assign crew: Driver (required), Navigator, Brewer, Passengers (up to 6), Shooters
- "MOVE HERE" commits seat assignment and moves token to slot's cell
- Disembark characters (within 30 ft)
- Install 55-gallon fuel drums to extend fuel storage
- Gather Materials + Brew actions (roll checks; narrative banners in feed)
- Cargo management: shared inventory, move items between PC and vehicle
- Vehicle takes damage (WP/RP tracker, Lasting Wounds)
- Vehicle cover auto-grants defense bonus (scales with vehicle size)

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Gather Materials + Brew dice-gated checks appear in roll_log | GREEN | `vehicle-maintenance-checks.spec` |
| PC inventory + vehicle cargo items + encumbrance | GREEN | `inventory-trade.spec` |
| Vehicle page loads without console errors | GREEN | `console-network.spec` |
| Crew seat assignment commits | MANUAL | UI interaction |
| "MOVE HERE" moves token to slot cell | MANUAL | canvas |
| Vehicle damage WP/RP decrement | AUTOMATABLE | - |
| Ranged attack behind vehicle applies defense bonus (CMod breakdown) | MANUAL | dice + canvas |
| Fuel drum install extends fuel (REST verify) | AUTOMATABLE | - |

### Gap specs to write

**`vehicle-damage.spec`** (AUTOMATABLE, ~20 min):
- Use the live Minnie vehicle (campaign `cc766e7f`) or seed a test vehicle
- GM applies vehicle damage (REST PATCH `vehicles.wp_current -= 1`)
- Assert `wp_current` decremented in DB
- Assert `roll_log` vehicle_damage row exists (if the app logs it)

---

## Chapter 12 - Communities

### Claims in the guide
- Group (<13 members) auto-upgrades to Community at 13 members
- Community auto-downgrades to Group below 13
- Role minimums: Gatherers 33%, Maintainers 20%, Safety 5-10%
- Weekly Check runs Fed->Clothed->Morale in sequence; 7 modifier slots
- Departures follow priority ladder: Unassigned->Cohort->Convert->Conscript->Founder->Apprentice
- Dissolution on 3 consecutive failures; Retention Check at failure #3
- Skip Week bumps counter without rolling
- Mood carries through Skip Week from most-recent rolled check
- Community Dashboard (GM): Morale/Resource history, Role Distribution, Recruitment Stats
- At-A-Glance block (all players see): Recent Morale chips, You section

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Create community -> seed 13 NPCs -> "13 members" chip -> Weekly Check -> roll row + checks | GREEN | `communities-lifecycle.spec` |
| Stockpile INSERT propagates live to other panel | GREEN | `section-d-stockpile.spec` |
| Deposit into community created mid-session still propagates | GREEN | `section-d-stockpile.spec` |
| Community page loads without errors | GREEN | `console-network.spec` |
| Group (<13) -> Community (>=13) auto-upgrade (status chip) | AUTOMATABLE | - |
| Role minimum bars turn red when understaffed | AUTOMATABLE | - |
| Dissolution on 3 consecutive failures | AUTOMATABLE | - |
| Skip Week increments week counter without rolling | AUTOMATABLE | - |
| Community Dashboard chart renders with data | MANUAL | chart visualization |
| At-A-Glance block shows correct player data | AUTOMATABLE | - |

### Gap specs to write

**`community-status-upgrade.spec`** (AUTOMATABLE, ~25 min):
- Throwaway community with 12 NPCs (Group status)
- Add 13th NPC member (REST INSERT)
- Assert community status chip = "Community" (DOM or REST `communities.status`)
- Remove one member; assert reverts to Group

**`community-dissolution.spec`** (AUTOMATABLE, ~40 min):
- Throwaway community
- REST PATCH `consecutive_failures = 3` directly (or run 3 weekly checks with rigged rolls)
- Run weekly check to trigger dissolution Retention Check
- Assert on Retention Check failure: community `status = 'dissolved'` via REST

---

## Chapter 13 - The Campfire

### Claims in the guide
- Portal landing with Setting Hubs, Featured Module, Explore cards
- Direct Messages: start new thread, history with timestamps, search by participant
- LFG: post as GM or Player, "I'm Interested" button, DM/Story Invite/Kick/Share
- War Stories: title, body, campaign tag, attach images/PDFs; Survivor posts enter moderation queue; Admin posts live immediately
- Timestamps: date/time/timezone picker with 6 format options, Discord-compatible output
- Setting Hubs: canon pins, communities, recent posts by setting
- Incoming chat pings and flashes CHAT tab 3x

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| DM realtime propagation (player A sends, player B sees live) | GREEN | `messages-dm.spec` |
| Whisper posts in real-time | GREEN | `section-e-whispers.spec` |
| Thriver forum thread auto-approves; Survivor forced to pending | GREEN | `campfire-social.spec` |
| LFG post auto-approves for Thriver; Survivor goes to queue | GREEN | `campfire-lfg-warstory.spec` |
| War Story auto-approves for Thriver | GREEN | `campfire-lfg-warstory.spec` |
| Campfire page loads without console errors | GREEN | `console-network.spec` |
| "I'm Interested" button fires notification to LFG post author | AUTOMATABLE | - |
| Timestamp generator outputs correct Discord format | AUTOMATABLE | - |
| Setting Hubs show canon pins for that setting | AUTOMATABLE | - |
| Chat ping flashes CHAT tab 3x | MANUAL | timing-sensitive animation |

### Gap specs to write

**`lfg-interest-notification.spec`** (AUTOMATABLE, ~25 min):
- GM (gm) posts an LFG ad (REST INSERT or UI)
- Player (marv) clicks "I'm Interested"
- Assert `notifications` row for GM with correct type via REST poll

**`timestamp-generator.spec`** (AUTOMATABLE, ~15 min):
- Navigate to /campfire/timestamps
- Assert page renders with date/time/timezone pickers (no console errors)
- Optionally: fill pickers via DOM, assert output matches expected Unix timestamp format

---

## Chapter 14 - Rumors (Published Content System)

### Claims in the guide
- Marketplace with search/sort/filter (by name, setting, Featured/Newest/Most Subscribed/Highest Rated)
- Subscribe button; update notifications via bell + purple "vX.Y.Z available" button
- Publish Story as module: name, tagline, description, visibility (Private/Unlisted/Listed), content checkboxes
- Publish new version: semver bump, CHANGELOG; subscribers notified
- Version diff: "+2 NPCs, -1 pin, 3 handouts updated"
- Reviews and ratings on Module detail page
- "Rumor" pin category (question mark) on world map

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Publish Story as module -> lists for author -> clone -> content lands | GREEN | `rumors-publish-clone.spec` |
| Publish v2 -> subscriber gets "update available" notice -> version history | GREEN | `rumors-publish-clone.spec` |
| Rumors marketplace loads without errors | GREEN | `console-network.spec` |
| Survivor rumor pin hidden, visible to author, in Thriver queue | GREEN | `world-pin-to-queue.spec` |
| Marketplace search/filter updates results | AUTOMATABLE | - |
| Review/rating on Module detail page | AUTOMATABLE | - |
| Selective merge from version update | MANUAL | complex diff UI |

### Gap specs to write

**`rumors-marketplace-search.spec`** (AUTOMATABLE, ~20 min):
- Navigate to /rumors as GM
- Assert marketplace renders at least one module card (the published Arena or test module)
- Type a search term matching a known module name
- Assert filtered results contain only matching modules (DOM assertion on card titles)

---

## Tactical Map Guide (Standalone)

### Claims in the guide
- Map Setup floating panel repositions via titlebar drag; position remembered
- First scene auto-opens "New Scene" modal asking for Name only; defaults 20x15, 3 ft/cell
- Reuse Map copies background from another scene without re-upload
- Corner handles resize/align image; Lock when aligned
- Grid: 7 colors, 5-100% opacity; can be toggled off
- Place Tokens auto-places combatants on grid after combat starts
- Zoom 25%-400% is personal (your view only, not shared)
- Share View is one-shot scroll+zoom snap; players can still pan after
- Fog Edit: Paint/Rectangle/Erase, Fog All/Clear All; persists across reloads
- Sight slider (0-50 cells, default 30) on token info panel; fog respects walls/closed doors/windows
- Pings: Alt+click; orange = GM, green = player; fade ~1 second
- Combat auto-shares current scene; scene switch auto-broadcasts

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Cross-client identical render fields + ZERO setImgScale calls | GREEN | `tactical-map-render.spec` |
| cell_px DB constraint 5-300 | GREEN | `tactical-cell-px-constraint.spec` |
| Door/window toggle cross-client | GREEN | `wall-segment-door-cross-client.spec` |
| Scene switch broadcasts to players | AUTOMATABLE | (see Ch8 gap) |
| Fog persistence across reload | MANUAL | canvas |
| Sight slider clears fog around PC | MANUAL | canvas |
| Pings visible to all, fade correctly | MANUAL | canvas |
| Corner-handle alignment | MANUAL | canvas drag |

---

## GM Guide: Tactical Scene Setup (Standalone)

### Claims in the guide
- Map Setup opens as floating panel via header button; position remembered
- Setup flow: + New Map -> Upload/Reuse -> Unlock -> Align -> Lock -> Cols/Rows -> Cell (ft) -> Grid -> Fit to Map
- Scene Name saves on blur or Enter
- Cell (ft) is the only rules-affecting setting (range calculations)
- All other settings (Cols, Rows, Cell (px), zoom, color, opacity) are presentation only
- Delete Map removes background only; Delete Scene removes scene + tokens + asks confirmation
- Everything in panel saves to scene; scene persists across sessions

### Test coverage

| Claim | Status | Spec |
|---|---|---|
| Tactical scene scene_name saves (REST verify) | AUTOMATABLE | - |
| Delete scene removes scene + all tokens | AUTOMATABLE | - |
| Scene state persists across session boundary | AUTOMATABLE | - |

### Gap specs to write

**`scene-crud.spec`** (AUTOMATABLE, ~30 min):
- GM creates a throwaway tactical scene (REST INSERT into `tactical_scenes`)
- PATCH the scene name
- Assert REST GET returns the updated name
- DELETE the scene
- Assert scene no longer exists (REST GET returns empty array)

---

## Priority queue for new specs

Ordered by: coverage gap size + alignment with 9/1 KS goal (Beta-500 core flows first).

### P1 - Core loop gaps (Beta-500 blocker)

1. **`grapple-subdue-breakfree.spec`** (45 min) - extends grapple-family; completes Ch9 combat contract
2. **`character-card-trackers.spec`** (30 min) - WP/RP/Stress click persists; 0 WP -> stress auto-bump
3. **`env-damage.spec`** (20 min) - Falling + Drowning buttons apply correct damage via gm_apply_damage

### P2 - Story creation + social flows

4. **`story-clone.spec`** (20 min) - Story clone creates independent copy
5. **`story-snapshot.spec`** (15 min) - Snapshot creates DB row
6. **`story-join-notification.spec`** (25 min) - Player join fires notification to GM
7. **`campaign-pins-visibility.spec`** (25 min) - GM show/hide propagates to players cross-client
8. **`session-notes.spec`** (20 min) - End session saves summary + notes (REST verify)

### P3 - Community + NPC extended flows

9. **`community-status-upgrade.spec`** (25 min) - Group -> Community at 13 members + back
10. **`npc-recruitment.spec`** (40 min) - Recruitment modal roll -> outcome in roll_log + DB state change
11. **`advantages-lifecycle.spec`** (30 min) - GM grants Advantage -> player sees it -> player uses it

### P4 - Marketplace + Campfire gaps

12. **`rumors-marketplace-search.spec`** (20 min) - Search filter updates module list
13. **`lfg-interest-notification.spec`** (25 min) - "I'm Interested" fires notification to LFG post author
14. **`timestamp-generator.spec`** (15 min) - Campfire timestamps page renders pickers

### P5 - Scene + infra

15. **`scene-switch-broadcast.spec`** (25 min) - GM scene PATCH propagates to player via realtime
16. **`scene-crud.spec`** (30 min) - Tactical scene create/rename/delete (REST verify)
17. **`nav-notifications.spec`** (20 min) - Notification red dot appears + clears on mark-all-read

---

## Manual-only items (not automatable headlessly)

These are verified in playtests and the 2-client gate runs. Document each in the dashboard as MANUAL.

| Feature | Why manual |
|---|---|
| Fog paint, clear, erase tools | canvas pixel interaction |
| Sight slider clears fog respecting walls | canvas LoS calculation |
| Pings (Alt+click) visible to all, fade correctly | canvas animation |
| Map corner-handle alignment | canvas drag |
| Range circles render correctly | canvas |
| Mortal wound modal (spend Insight Dice) | dice-gated (only at 0 WP) |
| Lasting wound Table 12 roll | dice-gated |
| Blast radius 50%/25% auto-damage | dice + canvas targeting |
| Attack rolls, CMod breakdown full flow | dice + UI interaction |
| First Impression CMod auto-fill on future rolls | requires NPC roll history |
| Roll modal formula display (2d6 + mods) | dice |
| Vehicle "MOVE HERE" token snap to slot cell | canvas + token move |
| Vehicle cover defense bonus in CMod breakdown | dice + canvas position |
| Chat tab flash 3x animation | animation timing |
| Export session log as HTML download | file download |
| Community Dashboard charts | chart visualization |
| Module version diff visualization | complex UI |
| Portrait upload -> token updates cross-client | canvas + upload |

---

## How to use this plan

1. Pick a spec from the Priority Queue above
2. Look at the existing closest spec (e.g. `combat-flow.spec` for Phase B patterns) as the fixture template
3. Write the spec using throwaway campaigns where possible; CASCADE-delete in `finally`
4. Run standalone: `npx playwright test e2e/<spec-name>.spec.ts`
5. Add a row to `tasks/e2e-results.html` in the Standing Specs table
6. Run full re-cert: `npm run test:e2e`
7. Update the banner + cards + changelog in `tasks/e2e-results.html` in place

The P1 items (grapple-subdue-breakfree + character-card-trackers + env-damage) are the right next batch - they close the remaining Ch9 combat contract and prove the character health mechanics the guides describe.
