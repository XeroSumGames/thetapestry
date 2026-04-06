# Tapestry — To Do & Backlog

## 🔴 Bugs (Fix First)
- [x] Print character sheet renders blank
- [x] Distemper font not applying on mobile navbar
- [ ] Print sheet missing data — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated from character data
- [x] Signup page shows hardcoded "check your email" message — confirmed not a bug

---

## 🟠 Phase 3 — Table Completion

### Insight Dice
- [x] Pre-roll spend UI — Roll 3d6 button and +3 CMod button
- [x] Pre-roll and post-roll spends don't conflict

### Session Management
- [x] Session open/close with session counter
- [x] Session history table in Supabase
- [x] Lobby state when session is idle
- [x] End session modal with summary, next-session notes, and file attachments
- [x] Session history page with grid layout, deactivate, delete
- [x] Previous Sessions button in table header
- [ ] War Stories — players post memorable moments from sessions

### Stress & Breaking Point (SRD Core Mechanic)
- [x] Stress bar tracker on character card (5 segments, color-coded green→yellow→red)
- [x] Stress Check button triggers roll using Stress Modifier (RSN + ACU AMods)
- [x] Breaking Point auto-triggers when stress reaches 5 — rolls 2d6 on Table 13
- [x] Breaking Point modal shows result name, effect, and resets stress to 0
- [x] Lasting Wounds — "Roll Lasting Wound" button when WP reaches 0, rolls Table 12
- [x] Insight, CDP, Morality converted to bar trackers (10/10/7 blocks)

### Combat Actions — 5 Passes
- [ ] Pass 1 — Action slots UI only (actions_used, action_log on initiative_order, 2 slot UI, full action list, Rapid Fire/Sprint/Charge auto-fill both slots, Done state, reset on Next)
- [ ] Pass 2 — Attack action + target dropdown (dice roller pre-loaded, skill selector, target dropdown from initiative_order, result in Roll Feed, +1 CMod on second attack same target)
- [ ] Pass 3 — Simple CMod actions (Aim +2 CMod on next Attack, Defend +2 defensive_modifier, Take Cover +2, Rapid Fire -1/-3 or -2/-4, Subdue WP 50%/RP full)
- [ ] Pass 4 — Two-action actions (Charge both slots forces Melee/Unarmed, Sprint both slots Athletics check at round end fail = Winded)
- [ ] Pass 5 — Social and contested actions (Coordinate, Cover Fire, Distract, Inspire — chained rolls, target selection, pending_cmod, inspired flag)

### Combat UI
- [x] Defer button on initiative tracker — GM can defer anyone, players can defer their own
- [x] All NPCs pre-selected when starting combat
- [x] NPCs sorted first in target dropdown
- [x] Attack Roll label for weapon attacks, Rolling for skill checks
- [x] Conditional Modifier label (was CMod Relationship/Situational)

### Combat Rules — Advanced (SRD)
- [ ] Getting The Drop — one character acts before initiative, single action, -2 CMod on next initiative roll
- [ ] Range Bands — Engaged, Close, Medium, Long, Extreme tracking per combatant pair
- [ ] Initiative re-roll each round (SRD rule: fresh initiative every round, +1 for non-participants)
- [ ] Delayed Actions — hold action until later in the round
- [ ] Resolution Phase — delayed effects (grenades, etc.) at end of round

### Damage & Health Automation (SRD)
- [ ] RP reaches 0 → character goes unconscious, visual indicator, recovers 1 RP/round out of combat
- [ ] WP reaches 0 → Mortally Wounded state, dies in 4 + PHY AMod rounds unless Stabilized
- [ ] Stabilize mechanic — Medicine* check or Wild Success Reason check
- [ ] Healing rates — 1 WP/day resting, 1 WP/2 days if mortally wounded
- [ ] Death prevention — spend Insight Die to survive with 1 WP/1 RP
- [ ] Unconscious/Mortally Wounded/Dead status badges on character cards and initiative tracker

### Weapons & Equipment (SRD)
- [x] Full weapon database — 35+ weapons from SRD (Melee, Ranged, Explosive, Heavy)
- [x] Weapon dropdowns on character card — select primary/secondary from all SRD weapons
- [x] Item Condition tracking — Pristine (+1 CMod), Used (0), Worn (-1), Damaged (-2), Broken (unusable)
- [x] Ammo pip tracker — clickable pips matching clip size per weapon
- [x] Reload system — 5-pip clip tracker with +/- buttons, Reload button
- [x] Weapon traits displayed as badges (Automatic Burst, Blast Radius, etc.)
- [x] Attack button per weapon — opens dice roller with correct skill/AMod/SMod
- [x] Unarmed Attack button — 1d3 + PHY + Unarmed Combat, 100% RP
- [x] Weapon condition CMod auto-applied to attack rolls
- [x] Auto-damage on successful attacks — rolls weapon damage, applies DMM/DMR defense, auto-deducts WP/RP from target
- [x] Target defensive modifier (DMM/DMR) auto-applied to attack CMod when target selected
- [x] Damage breakdown in roll modal — raw WP, defense mitigation, final WP/RP
- [ ] Weapon trait mechanical effects (Automatic Burst fire, Blast Radius area, Stun incapacitate, etc.)
- [ ] Upkeep Checks — Mechanic/Tinkerer/weapon skill checks to maintain condition
- [ ] Encumbrance — carrying capacity (6 + PHY), warn when exceeded

### Additional Check Types (SRD)
- [ ] Group Checks — multiple characters rolling together
- [ ] Opposed Checks — attacker vs defender rolls with contested outcomes
- [ ] Perception Checks — RSN + ACU modifier, distinct roll type
- [ ] Gut Instinct Checks — reading NPCs, uses Perception modifier or Psychology/Streetwise/Tactics
- [ ] First Impressions as actual rolls — player rolls to determine relationship CMod rather than GM-set only

### NPC Roster
- [x] Pass 1 — Basic NPC creation (campaign_npcs table, GM roster panel, CRUD)
- [x] Pass 2 — NPC Type & Recruitment Role (auto-populate RAPID, type/role badges)
- [x] Pass 3 — Combat integration (NPCs in initiative tracker, auto-roll, Add to Combat mid-fight)
- [x] Pass 4 — Relationship CMods & GM Reveal (First Impressions, social skill auto-load, player NPC cards)
- [x] Pass 5 — World NPC Library (Publish, Browse, Import, moderation tab)
- [x] Random NPC Generator (Quick/Guided Generate, type picker, skill dropdowns)
- [x] Quick Reveal/Hide button on roster list with Realtime sync to players
- [x] NPC form overhaul — portrait bank, structured skills, motivation/complication/words fields
- [x] Show/Hide button renamed, Fight button to add NPC to combat from roster
- [ ] NPC card view — abbreviated character card for NPCs (RAPID, skills, weapons, notes)
- [ ] NPCs linked to world map pins

### Campaign Pins (separate from world map)
- [ ] campaign_pins table — id, campaign_id, name, lat, lng, notes, category, revealed (bool), created_at
- [ ] Setting seed pins insert into campaign_pins (not map_pins)
- [ ] GM sees all campaign pins in Assets tab — list with Reveal/Hide per pin
- [ ] GM can edit pin name, notes, category
- [ ] Revealed pins show on a campaign-specific map layer at the table
- [ ] GM can promote a campaign pin to the world map (copies to map_pins as approved)
- [ ] Players only see revealed campaign pins

### GM Assets Panel — Tab Structure
- [x] NPC Roster tab
- [x] GM Notes tab (placeholder)
- [ ] Maps & Objects — scene images, tactical map assets, tokens, props
- [ ] Handouts — documents and images GM can push to players mid-session
- [ ] Communities — Morale tracker, Gatherers/Maintainers/Safety, weekly Morale Check roller
- [ ] Roll Tables — custom tables GM can roll on during play (loot, encounters, complications)
- [ ] Notes — GM private scratchpad, session prep, secrets (full implementation)
- [ ] NPC browsing/filtering — search by name, filter by type/status/role, sort, card grid vs list toggle
- [ ] GM screen — GM sees all stats and hidden notes, players see only what is revealed
- [ ] GM quick-reference panel — outcomes table, CMod table, range bands, combat actions

### Campaign Management
- [x] Launch button on campaign cards (direct to table, new tab)
- [x] Leave button on player campaign cards
- [x] Share button on campaign cards (copies invite link)
- [ ] Roll Feed tabs — Rolls only, Chat only, All (requires chat_messages table + Realtime)
- [ ] GM private notes (full implementation)
- [ ] Player kick/management
- [ ] CDP award system per session
- [ ] CDP spending between sessions
- [ ] Character progression log — what was earned, when, what was spent
- [ ] Transfer GM role to another player
- [ ] Allow characters to be in multiple campaigns simultaneously
- [ ] Session scheduling — GM proposes times, players confirm
- [ ] Real-time calendar of upcoming sessions

### Character Creation
- [x] Clickable step indicators on all character creation pages
- [x] Portrait on Final Review (clickable to upload)
- [x] Character concept shown in Final Review header
- [x] Auto-resize uploaded photos to 256x256
- [x] Test character button for Thrivers
- [ ] CDP tracker boxes match actual CDP budget (partially fixed — attribute box done)

### UI Polish (Completed)
- [x] Global color change #5a5550 → #cce0f5
- [x] 13px minimum font size enforced across NPC Roster
- [x] Roll feed font sizes bumped +2px
- [x] Roll modal font sizes bumped +2px
- [x] Navbar removed — all navigation moved to sidebar
- [x] Sidebar branding — Distemper logo, The Tapestry title, Log Out button
- [x] Header buttons match campaign name text height
- [x] Dynamic player strip sizing for 6+ players
- [x] Green top border on player's own character in portrait strip
- [x] Portrait strip names on one line: "Character Name (Player)"
- [x] Table page uses full viewport height (removed navbar offset)
- [x] Notification bell SVG with dynamic color (orange/gray)
- [x] Notification body colorized (names green, campaigns red, characters blue)
- [x] Mark All Read closes notification dropdown
- [x] Welcome page split — /firsttimers for onboarding, /welcome for returning users
- [x] Welcome page broken emojis fixed
- [x] Character card: concept/complication/motivation/words moved above RAPID
- [x] Weapon stats layout — aligned side-by-side with consistent rows
- [x] Auto-resize uploaded photos to 256x256

---

## 🟠 Phase 3 — Map
- [ ] Pin clustering — nearby pins collapse into numbered badge at low zoom
- [ ] Layer toggles — Canon / Community / Campaign / Mine
- [ ] Temporal filter — show pins from last week/month/all time
- [ ] Pin cards — richer click experience with related pins, visit count
- [ ] Setting regions — zoom to District Zero, Chased, etc.
- [ ] Pin hierarchy — visual weight by type (Landmark/Location/Event/Personal)
- [ ] Pin search — keyword search highlights matching pins on map
- [ ] Parent/child pin structure — rumor about a specific building within a location
- [ ] Immutable canon layer — Thriver-set pins only

---

## 🟠 Logging & Notifications
- [x] Pass 1 — Database & event logging
- [x] Pass 2 — Notification creation via DB triggers (+ pin rejection trigger)
- [x] Pass 3 — Notification bell UI
- [x] Pass 4 — Thriver dashboard & email alerts
- [x] Pass 5 — IP capture via Edge Function, /logging page with stat cards + top pages
- [x] Core event logging — login, logout, roll, session start/end, character delete/duplicate, campaign create
- [x] Consolidated /logging page (replaced /admin/dashboard)
- [x] Player joined notification includes character name

### Remaining Event Instrumentation
- [ ] Character edited/saved
- [ ] Campaign left by player
- [ ] Campaign deleted by GM
- [ ] NPC created/edited/deleted
- [ ] Map pin edited/deleted
- [ ] Profile updated
- [ ] Password changed
- [ ] Combat started/ended
- [ ] Initiative actions logged

---

## 🟡 Phase 4 — The Living World

### The Campfire
- [ ] Three levels — Global, Setting (District Zero etc.), Campaign (private)
- [ ] Approved Rumors feed from world map
- [ ] World Events — Thriver authored announcements
- [ ] Session summaries posted by GMs
- [ ] War Stories from players
- [ ] LFG posts — players and GMs finding each other
- [ ] Filtering by setting, campaign, date
- [ ] Promotion flow — Campaign feed → Setting feed → Global feed
- [ ] Featured items — Thriver promoted
- [ ] Reactions and comments
- [ ] "What happened since you were last here" feed on dashboard

### District Zero
- [ ] Pre-populate with canonical landmarks (immutable)
- [ ] Canon layer — only Thrivers can edit
- [ ] Community layer — approved player Rumors
- [ ] District Zero Campfire feed
- [ ] District Zero timeline — chronological view of events
- [ ] Setting region on world map
- [ ] Campaign creation option — Run in District Zero

### Tactical Map
- [ ] GM uploads scene image (stored in Supabase Storage)
- [ ] Auto-generated player tokens — portrait photo or initials
- [ ] NPC tokens — GM placed and managed
- [ ] Drag to move, Realtime sync across all clients
- [ ] Zoom and pan for everyone
- [ ] Click token → opens character sheet
- [ ] WP and stress visible under each token
- [ ] Range ruler — click and drag, shows Engaged/Close/Medium/Long/Distant
- [ ] Token status badges — Wounded, Stressed, Down
- [ ] GM ping — click to flash a location for all players
- [ ] Hidden tokens — GM reveals NPC tokens when discovered
- [ ] Multiple scene slots per campaign
- [ ] Initiative order shown as numbered badges on tokens

---

## 🔵 Phase 5 — Module System
- [ ] Module data structure — scenes, NPCs, pins, handouts, roll tables
- [ ] Module builder UI (Thriver only)
- [ ] Three permission tiers: Module Creator, Licensed GM, Player
- [ ] Campaign creation picker — Custom / Setting / Module
- [ ] Module versioning — campaigns notified when module updates
- [ ] Module play stats — how many groups ran it, average session count
- [ ] GM toolkit — in-session scene switcher, handouts panel, roll tables
- [ ] Empty (first module) — single scene, pre-placed NPCs, player briefing, GM notes
- [ ] Module library — browsable by GMs

---

## 🔵 Phase 6 — Community & Retention

### Looking for Group
- [ ] LFG listings with availability, playstyle, experience level, setting preference
- [ ] GM posts open campaigns with session log visible
- [ ] Players post looking for game
- [ ] Integrates with campaign creation flow

### The Gazette
- [ ] Auto-generated campaign newsletter after each session
- [ ] Pulls from roll log highlights, session summary, GM notes
- [ ] Shareable public link — non-members can read
- [ ] Feeds into Global Campfire as a World Event

### Subscriber Tiers
- [ ] Free — core features, limited campaigns
- [ ] Paid — full access, priority LFG
- [ ] Premium — early access, module library, exclusive content

### Between Sessions
- [ ] CDP spending between sessions
- [ ] Character development log
- [ ] War Story submission
- [ ] Session prep tools for GMs
- [ ] World map browsing with setting context

---

## 🔵 Phase 7 — Ghost Mode (Public Read-Only)
- [ ] Middleware audit — map every route to Ghost / Survivor / Thriver access level
- [ ] Open world map to unauthenticated Ghosts (read-only)
- [ ] Open Campfire Global and Setting feeds to Ghosts (read-only)
- [ ] Ghost UI layer — locked elements show signup prompt instead of redirect
- [ ] Landing page redesign — map and Campfire front and center, "Join the World" CTA
- [ ] Soft wall modal — "You'll need a free account to do that"
- [ ] Ghost-to-Survivor conversion tracking

---

## 🔵 Phase 8 — Physical Products
- [ ] Chased QR integration — fold-out map QR codes deep-link to correct map region
- [ ] Anonymous preview for non-account holders — scan, see the world, prompted to sign up
- [ ] Dedicated onboarding flow for physical product purchasers
- [ ] Chased setting region on world map with canonical pins
- [ ] Chased module in module library
- [ ] Minnie & The Magnificent Mongrels setting
- [ ] Each physical product gets own setting region, module, and QR integration

---

## 🔵 Phase 9 — Maturity

### Rules Reference
- [ ] Full XSE SRD searchable and browsable within The Tapestry
- [ ] Contextual links from character sheet and dice roller to relevant rules
- [ ] GM quick-reference panel — outcomes table, CMod table, range bands, combat actions

### Mobile
- [ ] Responsive layout — dashboard, map, character wizard, table view
- [ ] Mobile dice roller for rolling at a physical table
- [ ] Distemper font on mobile navbar

### Search
- [ ] Global search across pins, Campfire, characters, campaigns
- [ ] Setting-scoped search
- [ ] Full text on session logs and War Stories

---

## 🔵 Phase 10 — Future Platforms
- [ ] Displaced — space setting, separate platform, same XSE engine
- [ ] Extract shared pieces into @xse/core monorepo library
- [ ] Each setting gets own domain, branding, and map layer

---

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256 (fixes save timeout)
- [ ] Migrate character photos from base64 to Supabase Storage (full migration)
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode (first-time vs returning)
- [x] Thriver Console — examine user page
