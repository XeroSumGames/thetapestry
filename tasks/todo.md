# Tapestry — To Do & Backlog

## 🔴 Bugs (Fix First)
- [x] Print character sheet renders blank
- [x] Distemper font not applying on mobile navbar
- [ ] Print sheet missing data — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated from character data
- [x] Combat actions bar not visible to Survivor-role players — fixed with user_id match
- [x] Initiative breakdown not appearing in Logs tab — startCombat/nextTurn/broadcast handlers now call loadRolls()
- [x] Players show as "Unknown" — initiative now fetches fresh character data from DB
- [x] Signup error fixed — handle_new_user trigger had wrong role casing + no EXCEPTION handler + RLS blocking
- [x] NPC damage not applying — rosterNpcs loaded on init, target lookup uses character_id fallback
- [x] Dead NPCs still attackable — filtered from target dropdown
- [x] Auto-advance not working after 2 actions — nextTurn uses fresh DB data, closeRollModal uses user_id match
- [x] Session end now auto-ends combat
- [x] Combat start broadcast to players — no refresh needed
- [x] Player X button to end own turn on initiative bar
- [x] NPC Insight Dice — only Antagonists get them per SRD
- [x] Clips limit increased to 10 with dynamic pip display
- [x] Renamed Rolls tab to Logs
- [x] Combat Start/End messages in Logs tab
- [x] Attack button on action bar no longer double-consumes actions
- [x] Visitor email suppression for bot cities (San Jose, Ashburn, etc.)

### Known Issues (needs testing)
- [ ] NPC action pips not consuming on use — may need fresh DB fetch in NPC action flow
- [ ] PC damage from NPC attacks — needs verification with latest character_id fallback
- [ ] Manipulation rolls should auto-include First Impression CMod
- [ ] Add to Combat modal should filter NPCs already in initiative
- [ ] Self-attack should apply damage to self
- [x] **Stafford → Staff** — typo in weapon database, renamed
- [x] **NPC card HP not updating on damage** — root cause: player deals damage from their browser, setState only updates player's React state. GM is a different client and never received the update. Fixed by broadcasting `npc_damaged` event through the initiative channel (same pattern as turn_changed). Also: NpcCard reads HP from props only (no useState), card grid merges latest campaignNpcs at render, realtime callback suppressed during manual updates to prevent race condition
- [x] **General Knowledge → Specific Knowledge** — renamed in all NPC seed data (setting-npcs.ts), DB backfill via jsonb_set query
- [x] **Stabilize button blocked during combat** — consumeAction was called before handleRollRequest, which triggered nextTurn and changed the active combatant before the roll gate ran. Fixed: open roll first, then consume action. Same fix for Charge and Rapid Fire
- [x] **Dead NPCs appearing in Start Combat** — rosterNpcs filter missed the combat picker re-fetch path; also NPC death now sets status='dead' so the existing status filter catches them
- [x] **Initiative bar shows all combatants with color coding** — green (active), yellow (waiting), red (acted); rotates so active is always leftmost
- [x] **NPC cards auto-open/close with combat** — open all selected NPCs on combat start, close all on combat end
- [x] **Death log entries** — "Death is in the air" header, custom red card rendering, no dice display
- [x] **NPC card shows derived status** — dead/mortally wounded/unconscious from HP, not stale DB status field
- [x] **Restore button on dead/mortally wounded NPC cards** — resets to full HP + active status
- [x] **Out-of-combat stabilize on NPC cards** — Medicine roll from NPC card when mortally wounded
- [x] **Auto-advance after 2 actions** — root causes: (1) consumeAction didn't write actions_remaining=0 to DB before calling nextTurn, (2) closeRollModal used rollResult state (subject to React batching/stale closures) — switched to rollExecutedRef, (3) Charge/Rapid Fire/Stabilize double-consumed via closeRollModal — added actionPreConsumedRef flag, (4) nextTurn had no fallback when no active entry found in DB
- [x] **NPC HP display lags until refresh** — NpcRoster had no realtime subscription on campaign_npcs; added Supabase realtime channel that calls loadNpcs() on any change
- [ ] **Roll modal stuck "Rolling..." for 55s** + **roll result delayed 30s into Logs** — still to investigate. Previously thought it was the same root cause as damage; now that damage is fixed, may be independent. Re-test after HP display fix.
- [x] **Damage bidirectional** — PC→NPC and NPC→PC both work. Root cause was silent RLS rejection on `character_states` and `campaign_npcs` UPDATE policies. Fixed via `sql/character-states-rls-fix.sql` and `sql/campaign-npcs-rls-fix.sql` plus explicit `.select()` on both updates to detect 0-row cases. Biggest diagnostic unlock: `next.config.ts` `compiler.removeConsole` was stripping every `console.log` from production — switched diagnostic logs to `console.warn` to survive the build.
- [x] Player join 20s → 1-2s — RLS index fix (`sql/campaign-members-indexes.sql`) and `log-visit` edge function unblock
- [x] Combat start 15s → fast (verified by user)
- [x] PCs showing "Unknown" — characters/profiles cross-user RLS (`sql/character-profile-rls-fix.sql`)
- [x] Combat Started + Initiative boxes missing in Logs — `user_id: userId` on system roll_log inserts (RLS) and explicit timestamps for ordering
- [x] Combat Started above Initiative
- [x] Initiative box uses combined Init mod (DEX + ACU) instead of separate ACU/DEX, PC names in blue
- [x] End Combat blue button + `combat_end` log entry box
- [x] Show All / Hide All toggle on NPCs tab (always visible, disabled with tooltip when no players)
- [x] Select All / Deselect All toggle in Start Combat NPC picker
- [x] NPC tab reorders during combat — active combatant on top, rotating in turn order
- [x] Players see right-side asset panel with revealed NPCs + any NPCs in combat (auto-merged, "In Combat" label)
- [x] Players have own Notes tab with "Add to Session Summary" — appended notes prefix with character name in GM's End Session modal
- [x] Player bar reorders so each viewer sees their own character next to GM portrait
- [x] Open NpcCard refreshes when underlying NPC HP changes
- [ ] **Player-facing NPC card on Show All click** — clicking a revealed NPC in the player's NPCs tab opens a read-only card (currently opens the same editable view as GM)

---

## 🟠 Phase 3 — Table Completion

### Insight Dice
- [x] Pre-roll spend UI — Roll 3d6 button and +3 CMod button
- [x] Pre-roll and post-roll spends don't conflict

### Session Management
- [x] Session open/close with session counter
- [x] Session history table in Supabase
- [x] Lobby state when session is idle
- [x] End session modal with summary, cliffhanger, next-session notes, and file attachments
- [x] End session modal closes instantly (UI updates immediately, DB writes fire-and-forget in background)
- [x] Exit button in table header — navigates to /stories for GM and players
- [x] Start session clears rolls/chat from DB + local state (clean slate each session)
- [x] Realtime subscriptions listen to all events (INSERT + DELETE) for log clearing propagation
- [x] Session history page with grid layout, deactivate, delete
- [x] Previous Sessions button in table header
- [x] Cliffhanger field displayed in session history
- [x] Table auto-refreshes when player joins (Realtime on campaign_members)
- [ ] War Stories — players post memorable moments from sessions

### Stress & Breaking Point (SRD Core Mechanic)
- [x] Stress bar tracker on character card (5 segments, color-coded green→yellow→red)
- [x] Stress Check button triggers roll using Stress Modifier (RSN + ACU AMods)
- [x] Breaking Point auto-triggers when stress reaches 5 — rolls 2d6 on Table 13
- [x] Breaking Point modal shows result name, effect, and resets stress to 0
- [x] Lasting Wounds — "Roll Lasting Wound" button when WP reaches 0, rolls Table 12
- [x] Insight, CDP, Morality converted to bar trackers (10/10/7 blocks)
- [x] Stress Check with CMod when stress hits 5 — success drops to 4, failure triggers Breaking Point
- [x] Breaking Point modal shows on whichever screen has the sheet open

### Combat Actions
- [x] Pass 1 — Action slots (2 per turn), simple actions, auto-advance
- [x] Pass 2 — Aim (+1 CMod carry), Rapid Fire, Charge/Sprint, Ready Weapon + Tracking
- [x] Pass 3 — Social/contested actions (Coordinate, Cover Fire, Distract, Inspire — cross-player CMod)
- [x] All 15 combat actions listed alphabetically, greyed when unavailable
- [x] Action pips on all initiative entries (green active, orange waiting, grey spent)

### Combat UI
- [x] Defer button on initiative tracker
- [x] All NPCs pre-selected when starting combat
- [x] NPCs sorted first in target dropdown
- [x] Attack Roll / Rolling labels
- [x] Conditional Modifier label
- [x] 4 combat skill buttons on PC card
- [x] Weapon jam/degrade on Moment of Low Insight
- [x] Aim/social bonus badges on initiative tracker (+1/-1)
- [x] Status badges: 💀 Dead, 🩸 Mortally Wounded, 💤 Unconscious, ⚡ Stressed (PCs + NPCs)
- [x] Instant combat end broadcast to players
- [x] Instant turn change broadcast to players (turn_changed event)
- [x] Initiative bar hides combatants who already acted — only shows active + waiting until next round
- [x] All combat rolls (weapon + skill) gated on active combatant with actions remaining
- [x] PC weapon attack labels include character name (consistent with NPC format)
- [x] NPC target dropdown — fix false-dead filter for NPCs with null wp_current
- [x] Default feed tab opens on Logs (not Both)
- [x] Both tab merges rolls + chat chronologically (was sequential blocks)
- [x] "Open My Sheet to Roll" button toggles sheet closed if already open

### Combat Rules — Advanced (SRD)
- [x] Getting The Drop — GM selects in Start Combat modal, 1 action, -2 init
- [x] Range Bands — 5-button selector in roll modal with auto CMod
- [x] Initiative re-roll each round (PCs beat NPCs on ties)
- [x] Delayed Actions — handled by Defer button (same mechanic)
- [x] Resolution Phase — narrative, handled by GM with existing mechanics
- [x] Initiative fetches fresh character data from DB (fixes "Unknown" name bug)
- [x] Initiative results logged to Rolls tab in chat feed
- [x] Combat start parallelized — cut from 8 sequential DB calls to 3 rounds (set active in insert, skip re-fetch)

### Damage & Health Automation (SRD)
- [x] Auto-damage on successful attacks with DMM/DMR defense
- [x] Damage breakdown in roll modal
- [x] NPC damage applies to campaign_npcs table
- [x] RP reaches 0 → Incapacitated for 4-PHY rounds, then regain 1 RP
- [x] RP auto-recovery: 1 per round for conscious characters below max
- [x] WP reaches 0 → Mortally Wounded with death countdown (4+PHY rounds per SRD)
- [x] Death countdown decrements each round, reaches 0 → Dead
- [x] Stabilize mechanic — Medicine roll, success → incapacitated 1d6-PHY rounds, then 1 WP + 1 RP (PCs + NPCs)
- [x] NPC mortal wounds — death_countdown (4+PHY), incap_rounds, badges, turn skip, stabilize button
- [x] Death prevention via Insight Die — trade ALL dice, regain 1 WP + 1 RP (per SRD)
- [x] Lasting Wounds — PHY check first, Table 12 only on failure (per SRD)
- [x] Healing rates — Rest button with hours/days/weeks, SRD rates (1 WP/day, 1 WP/2 days mortally wounded, 1 RP/hour)
- [x] Auto-decrement ammo on ranged attacks (burst count for Automatic Burst)
- [x] Environmental Damage buttons — Falling (3 per 10ft), Drowning (3+3), Subsistence (1 RP)
- [x] Reduce Stress button — 8+ hours narrative downtime
- [x] Breaking Point shows 1d6 hours duration

### Weapons & Equipment (SRD)
- [x] Full weapon database (38 weapons)
- [x] Weapon dropdowns, ammo pips, reload system, condition tracking
- [x] Attack buttons per weapon with auto-damage
- [x] Weapon jam on Low Insight
- [x] Traits: Cumbersome, Unwieldy (CMod penalties)
- [x] Traits: Stun, Automatic Burst (mechanical)
- [x] Traits: Blast Radius, Burning, Close-Up, Cone-Up (display)
- [x] Tracking +1 CMod via Ready Weapon action
- [x] Upkeep Checks (Mechanic/Tinkerer/weapon skill, full SRD outcomes)
- [x] Encumbrance tracker (6 + PHY AMod, OVERLOADED warning)
- [ ] **Add Katana to weapon database** — differentiate from Sword (higher damage or different traits, e.g. lighter/faster with lower Cumbersome, or a unique trait like Precise)

### Additional Check Types (SRD)
- [x] Perception Check (RSN + ACU)
- [x] Gut Instinct (Perception + Psychology/Streetwise/Tactics)
- [x] First Impression (INF + Manipulation/Streetwise/Psychology)
- [x] Group Check (skill picker, participant selector, combined SMods)
- [x] Opposed Check (instructions for GM)

### NPC Roster
- [x] All 5 passes complete + random generator + form overhaul
- [x] Show/Hide/Fight buttons, stackable NPC cards
- [x] NPC Card with clickable RAPID/skills, weapon attack button
- [x] NPC WP/RP health trackers with dot trackers
- [x] NPC weapon auto-assignment by type tier (Goon/Foe/Antagonist)
- [x] Weapon dropdown on NPC edit form
- [x] Viewed NPCs highlighted in roster, Show All / Hide All toggle
- [x] NPCs linked to campaign map pins — `campaign_npcs.campaign_pin_id` wired in seed, backfill SQL for existing campaigns, pin popup shows `ALSO HERE` list of linked NPCs (player view filtered by `revealedNpcIds`, dead NPCs struck through, realtime via `campaign_npcs` channel)
- [x] Click pin name in Assets tab → map flies to it and opens popup (uses `clusterGroup.zoomToShowLayer`)
- [x] Click NPC card in NPCs tab again → closes (toggle behavior)
- [x] `sort_order` column on `campaign_pins` and `campaign_npcs` — seeded campaigns get story-order from array index, manual additions append at max+1, drag the ⠿ handle to reorder
- [x] NPC seed schema fix — migrated `lib/setting-npcs.ts` off legacy `rapid_range`/`wp`/`rp`/`dmm`/`dmr`/`init`/`per`/`enc`/`pt` to live RAPID columns; resurrected silently-broken NPC seeding (was inserting 0 rows on every create)
- [x] Show All / Hide All button on NPCs tab — always visible when NPCs exist (disabled with tooltip when no players have joined), bulk-batched DB ops
- [x] Select All / Deselect All toggle in Start Combat NPC picker
- [x] Start Session is perceived-instant — fire-and-forget DB writes, mirrors endSession pattern
- [x] Leaflet popup base font bumped site-wide for table readability; latent XSS in pin popup fixed
- [x] Share button in table header — copies invite link to clipboard
- [x] GM Notes attachments — jsonb `attachments` column on `campaign_notes`, `note-attachments` storage bucket with RLS, file picker in add form and on each expanded note, image thumbnails inline
- [x] Campaign creation surfaces seed errors — no more silent swallowing on schema mismatch
- [ ] **Author Mongrels NPCs** — `lib/setting-npcs.ts` has no `mongrels` entry, so Mongrels campaigns get 0 NPCs even though they have 28 pins seeded

### Campaign Pins
- [x] campaign_pins table with reveal/hide per pin
- [x] Setting seed pins (Mongrels 28, Chased 14, District Zero 31) insert into campaign_pins
- [x] Assets tab with pin management — show/hide, edit, delete, promote to world
- [x] Campaign map in center panel with campaign pins
- [x] Campaign map search bar with autocomplete + layer switcher (Street/Satellite/Dark)
- [x] Realtime sync — GM reveals pin, player sees it on map instantly
- [x] GM can add new campaign pins from the map (click to place)

### GM Assets Panel
- [x] NPCs tab (renamed from NPC Roster)
- [x] Assets tab with campaign pins
- [x] GM Notes tab — campaign_notes table, GmNotes component, add/delete/expand notes
- [ ] Maps & Objects — scene images, tactical map assets, tokens
- [ ] Handouts, Communities, Roll Tables
- [x] NPC card 3-column grid layout over campaign map
- [x] Publish to Library button on NPC card (GM only)
- [x] NPC form + card compacted (portrait/bank/status on one row)
- [x] Renamed Friendly → Bystander NPC type
- [ ] NPC browsing/filtering
- [ ] GM screen, GM quick-reference panel

### Campaign Management
- [x] Launch, Leave, Share buttons
- [x] Game Feed with Rolls/Chat/Both tabs and Realtime chat
- [ ] GM private notes, Player kick, CDP awards
- [ ] Character progression log
- [ ] Allow characters in multiple campaigns
- [ ] Transfer GM role, Session scheduling

### Setting Seeds
- [x] District Zero — 31 pins seeded to world map, 18 NPCs in setting-npcs.ts
- [x] Chased — 14 pins (campaign-scoped), 21 NPCs + 5 pregens in setting-npcs.ts
- [x] Renamed district0 → district_zero across entire codebase
- [x] campaign_npcs table created with RLS + Realtime
- [x] Campaign creation auto-seeds NPCs for District Zero and Chased
- [x] Mongrels — 28 pins (campaign-scoped, 14 waypoints + 14 landmarks/encounters) with notes, landmark (🗿) and encounter (⚡) categories added
- [x] Pregen system — PregenSeed with full character data, buildCharacterFromPregen() builder, pregen selection UI on campaign page
- [x] Chased pregens — 5 fully statted pregens (David, Carly, Morgan, Marv, Victor) with skills, weapons, equipment, relationships
- [x] Chased NPC skill name fixes — "Ranged Weapons" → "Ranged Combat" (Ray, Jackie, Maddy)
- [x] Chased Georgetown pin updated — coords, category → settlement, description
- [x] Tactical scene seeding — SETTING_SCENES in lib/setting-scenes.ts, auto-seeds during campaign creation (Chased: Connor Boys Farmhouse)
- [x] Empty campaign package — Gus pregen, Dylan & Becky NPCs, Battersby Farm + Gas Station pins, gas station scene, Session Zero handout
- [x] Empty pregens — 4 shared Chased pregens (David, Carly, Morgan, Marv) + Gus González (Empty-exclusive)
- [x] GM handout seeding — SETTING_HANDOUTS in lib/setting-handouts.ts, auto-seeds during campaign creation
- [x] Chased pins updated — 16 total (14 original + Battersby Farm + Stansfield's Gas Station)
- [x] Empty maps to Chased content — shares pins, NPCs, scenes via setting slug mapping
- [x] End session modal drop zone text size bumped (11/10px → 13/12px)
- [x] All setting pins campaign-scoped only (District Zero, Chased, Mongrels)
- [x] Make Thriver button — error feedback on failure
- [x] Extracted SETTINGS to shared lib/settings.ts (was duplicated in 5 files)
- [x] Pin/NPC seed inserts now have error handling + eliminated extra DB round-trip

### Character Creation
- [x] Clickable steps, portrait upload, concept display, photo resize, test character
- [ ] CDP tracker boxes (partially fixed)
- [ ] **Tooltips throughout character creation** — hover/tap explanations on skills, attributes (RAPID), and other game terms so new players understand what each thing does without leaving the page
- [ ] **Clean up Weapons/Equipment page** — current layout is too messy; redesign for clarity (categories, search, fewer dense rows)
- [ ] **Weapon dropdowns on Final Touch screen** — let players swap their seeded/picked weapons via a dropdown selector instead of being locked into the default loadout

### Ghost Mode
- [x] Public pages: /, /map, /dashboard, /campaigns, /characters, /creating-a-character, character builders
- [x] Sidebar with "Ghost — You Don't Exist" label, navigation, Sign In / Create Account
- [x] Map read-only for ghosts (no pin placement)
- [x] Dashboard landing page for ghosts with Distemper branding
- [x] Character builders bounce to login on Advance/Back/step clicks
- [x] Ghost-to-Survivor conversion tracking
- [x] Soft wall modal instead of hard redirect

### UI Polish
- [x] All items from previous sessions complete
- [x] Navbar removed, sidebar branding with Distemper logo
- [x] Sidebar links open in new tabs
- [x] Overlay mode 30% opacity — map visible behind character sheet
- [x] Inline mode: full-screen sheet; Overlay mode: draggable floating window
- [x] NPC card: Melee/Ranged/Demolitions green skill buttons (no duplicates)
- [x] PC card: single centered Unarmed Attack button with damage info
- [x] Creating-a-character page — all 6 builder links open in new tab

---

## 🟠 Phase 3 — Map
- [x] Map autocomplete on search bar (Nominatim)
- [x] Pin clustering (leaflet.markercluster, both world + campaign maps)
- [x] 10 map tile styles on both world map and campaign map (unified layout)
- [x] World map default view: center [-25, 15] zoom 3, no gray space, maxBounds locked
- [x] Campaign map style selector on New Campaign page
- [x] Custom location search for New Setting campaigns (Nominatim, saves center lat/lng)
- [x] Unified header button styling (hdrBtn helper, 28px uniform)
- [x] Filter chips replace sidebar tabs — All, Public, Mine, Canon, Rumors, Timeline with counts
- [x] Timeline filter — world_event pins in chronological order, overrides sort, date labels
- [x] Sort control — Newest, Oldest, By Category, Nearest
- [x] Ghost default — Timeline active for unauthenticated visitors
- [x] Ghost CTA in Timeline view — "Sign up to add your own story to this world."
- [x] Filter state persisted in localStorage for authenticated users
- [x] World event pins — 16 Dog Flu timeline + settlement pins on world map
- [x] New pin categories: world_event (🌍) and settlement (🏚️)
- [x] Setting regions — fly-to buttons for District Zero, Chased, Mongrels
- [x] Pin search — keyword filter on title, notes, category
- [x] Pin cards — expandable sidebar, enhanced popup, view count, nearby pins, campaign context, username
- [x] Pin hierarchy — visual weight: Landmark / Location / Event / Personal
- [x] Pin card attachments — images inline, documents as download links, public bucket
- [ ] Parent/child pin structure — rumor about a specific building within a landmark
- [ ] Immutable canon layer — Thriver-set pins only, cannot be edited by others
- [ ] **Map search predictive results — prioritize US locations** — currently Nominatim returns global results in arbitrary order; bias the autocomplete to US first (use `countrycodes=us` as a primary query, fall back to global if no matches)
- [ ] **Players can drop pins on the /table campaign map** — currently the "+ Pin" button in `CampaignMap.tsx` is gated on `isGM`; let players place their own pins (probably starts as `revealed=false` from the GM's POV until the GM approves, or as a separate "player-suggested" category)

---

## 🟠 Logging & Notifications
- [x] All 5 passes + consolidated /logging page
- [x] Player joined notification to all campaign members with character name
- [x] Player left notification
- [x] Pin rejection notification
- [x] Visitor email alerts — New Visitor / Survivor Active with location + visit count
- [x] Visitor geo-location — country, region, city, lat/lng from Vercel headers
- [x] IP hash tracking — SHA-256, no PII stored
- [x] Visual visitor map on /logging — dark tiles, green/red dots, popup with details
- [x] Visitor log filter — search by user/IP/page, multi-exclude with chips (type + Enter to exclude, click chip to remove)
- [x] Visitor log timestamp column — exact time alongside relative "When"
- [x] Thriver user deletion — edge function with admin API, prevents self-delete
- [x] Renamed /campaigns → /stories — URLs, text, redirects for backwards compat
- [x] Singleton Supabase client — fixes auth lock race condition
- [x] Performance pass — duplicate font removal, next.config, query parallelization, lazy images, unused deps removed
- [ ] Remaining event instrumentation (9 items)
- [ ] Switch email FROM address back to `noreply@distemperverse.com` once domain is verified on Resend (currently using `onboarding@resend.dev` workaround due to Wix MX limitation)

---

## 🟡 Phase 4 — The Living World

### The Campfire
- [ ] Campfire global feed — approved Rumors, World Events, session summaries, War Stories, LFG posts visible to all
- [ ] Campfire setting feed — filtered view per setting (District Zero, Chased, Mongrels)
- [ ] Campfire campaign feed — private feed per campaign, GM session summaries, player War Stories
- [ ] Promotion flow — campaign post → setting feed → global feed, Thriver approval at each level
- [ ] World Events — Thriver-authored announcements that shape the living world, permanently pinned
- [ ] War Stories — players post memorable moments from sessions, visible on campaign and setting feeds
- [ ] Reactions and comments on Campfire posts
- [ ] Filtering by setting, date, post type
- [ ] Featured items — Thriver can promote any post to featured status
- [ ] LFG posts — GMs and players post availability, setting preference, playstyle, experience level

### District Zero
- [ ] District Zero setting page — canonical hub for the setting
- [ ] Canon layer — immutable pins set by Thriver only
- [ ] Community layer — approved player Rumors visible to all District Zero campaigns
- [ ] District Zero Campfire feed — setting-scoped posts
- [ ] District Zero timeline — chronological history of events in the setting
- [ ] Timeline sort_order management — UI for Thrivers to reorder timeline pins (drag-and-drop or number field), GMs can set sort_order on campaign-scoped world_event pins. Currently hardcoded via SQL.
- [ ] Campaign creation option — Run in District Zero pre-populates setting content

### Tactical Map
- [x] Canvas-based tactical map replaces campaign map during combat
- [x] GM uploads battle map image (tactical-maps storage bucket)
- [x] Grid overlay with column/row labels (A1, B2, etc.)
- [x] Token rendering — circles with initials, color-coded (blue PC, red NPC)
- [x] GM drags tokens to move, saved to DB
- [x] Realtime sync — token moves broadcast via Supabase Realtime
- [x] Auto-populate tokens from initiative order (Place Tokens button)
- [x] Active combatant glow (green) on token
- [x] Range band visualization on selected token (Engaged/Close/Medium/Long)
- [x] Hidden tokens — GM can hide/reveal (ambushes)
- [x] Token info panel — name, type, position, Hide/Remove buttons
- [x] Scene management — create, name, set grid dimensions
- [x] Multiple scenes per campaign with dropdown switcher
- [x] Double-click token opens NPC card
- [x] Reverts to campaign map when combat ends
- [ ] Zoom and pan
- [ ] WP and stress visible beneath each token
- [ ] Token status badges — Wounded, Stressed, Incapacitated, Dead
- [ ] GM ping — flash a location on everyone's screen
- [ ] Initiative order numbered badges on tokens
- [ ] Range band auto-select from token positions in attack modal

---

## 🔵 Phase 5 — Module System
- [ ] Module data structure — scenes, NPCs, pins, handouts, roll tables as linked Supabase tables
- [ ] Module builder UI — Thriver only, create and publish modules
- [ ] Three permission tiers — Module Creator, Licensed GM, Player
- [ ] Campaign to Module link on creation — GM picks a module when creating campaign
- [ ] Module versioning — campaigns notified when source module updates
- [ ] Play stats — how many groups ran it, average session count
- [ ] Campaign creation overhaul — three-way picker: Custom, Setting, Module
- [ ] GM toolkit — in-session scene switcher, module NPC roster, handouts panel, roll tables linked to dice roller
- [ ] Empty — first module, single scene, fully playable, linked to Chased/Delaware setting

---

## 🔵 Phase 6 — Community & Retention
- [ ] LFG system — GMs post open campaigns, players post availability, matching by setting and playstyle
- [ ] Session scheduling — GM proposes times, players confirm, calendar view
- [ ] The Gazette — auto-generated campaign newsletter after each session pulling from roll log highlights, session summary, GM notes. Shareable link for non-members.
- [ ] Between-session experience — something to do on the platform outside of active sessions
- [ ] Subscriber tiers — Free, Paid, Premium with defined feature gates
- [ ] Graffiti — reactions on War Stories and Campfire posts (Distemper-branded reactions)

---

## 🔵 Phase 7 — Ghost Mode Advanced
- [ ] Ghost-to-Survivor funnel analytics — track where conversions happen
- [ ] A/B test soft wall messaging
- [ ] Onboarding flow for physical product QR scanners — different from standard signup

---

## 🔵 Phase 8 — Physical Products
- [ ] Chased QR code integration — fold-out map codes deep-link into Tapestry at Delaware setting
- [ ] Anonymous preview for QR scanners without accounts — show setting content before signup prompt
- [ ] Chased module — pre-populated with Delaware setting content, linked to physical product
- [ ] Minnie & The Magnificent Mongrels setting — sourcebook upload, seed pins and NPCs
- [ ] Physical product landing pages — one per product, branded, drives to signup

---

## 🔵 Phase 9 — Maturity
- [ ] Rules reference — full XSE SRD v1.1 searchable and browsable within The Tapestry
- [ ] Contextual rules links — from character sheet and dice roller to relevant SRD sections
- [ ] GM quick-reference panel — outcomes table, CMod table, range bands, combat actions at a glance
- [ ] Mobile optimization pass — dashboard, map, character wizard, table view all responsive
- [ ] Mobile dice roller — optimized for rolling at a physical table on your phone
- [ ] Global search — find characters, campaigns, pins, NPCs, Campfire posts

---

## 🔵 Phase 10 — Future Platforms
- [ ] Displaced — space setting, separate platform, custom star map
- [ ] Extract shared XSE engine into @xse/core monorepo — character system, campaign system, table surface shared across platforms
- [ ] Each setting gets own domain, branding, and map layer built on shared core
- [ ] Long-term: Tapestry becomes the proof of concept for the XSE platform family

---

## 🔵 Phase 11 — Cross-Platform Parity
- [ ] **Campaign Calendar** — date-gated lore events, GM-controlled include/ignore/pending states. Build for Displaced first, backport to Tapestry using same schema pattern if player demand exists. Potential Distemper uses: seasonal/anniversary events tied to collapse timeline, campaign duration tracking, faction state changes over time. Schema: `campaign_date timestamptz` on campaigns table (default year TBD — confirm canonical Distemper present year).

---

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256
- [ ] Migrate character photos from base64 to Supabase Storage (low priority — already compressed to 256x256 JPEG)
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode
- [x] Thriver Console
