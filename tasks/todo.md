# Tapestry — To Do & Backlog

## 🔴 Bugs (Fix First)
- [x] Print character sheet renders blank
- [x] Distemper font not applying on mobile navbar
- [ ] Print sheet missing data — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated from character data
- [x] Signup error fixed — handle_new_user trigger had wrong role casing + no EXCEPTION handler + RLS blocking. Added client-side fallback + error visibility
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
- [x] End session modal with summary, cliffhanger, next-session notes, and file attachments
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

### Combat Actions — 5 Passes
- [ ] Pass 1 — Action slots UI (2 actions per turn, auto-advance after both used)
- [ ] Pass 2 — Attack action + target dropdown
- [ ] Pass 3 — Simple CMod actions (Aim, Defend, Take Cover, Rapid Fire, Subdue)
- [ ] Pass 4 — Two-action actions (Charge, Sprint)
- [ ] Pass 5 — Social and contested actions (Coordinate, Cover Fire, Distract, Inspire)

### Combat UI
- [x] Defer button on initiative tracker — GM can defer anyone, players can defer their own
- [x] All NPCs pre-selected when starting combat
- [x] NPCs sorted first in target dropdown
- [x] Attack Roll label for weapon attacks, Rolling for skill checks
- [x] Conditional Modifier label
- [x] 4 combat skill buttons on PC card (Unarmed, Melee, Ranged, Demolitions)
- [x] Weapon jam/degrade on Moment of Low Insight

### Combat Rules — Advanced (SRD)
- [ ] Getting The Drop
- [ ] Range Bands — Engaged, Close, Medium, Long, Extreme
- [ ] Initiative re-roll each round
- [ ] Delayed Actions
- [ ] Resolution Phase

### Damage & Health Automation (SRD)
- [x] Auto-damage on successful attacks with DMM/DMR defense
- [x] Damage breakdown in roll modal
- [ ] RP reaches 0 → unconscious state
- [ ] WP reaches 0 → Mortally Wounded with death countdown
- [ ] Stabilize mechanic
- [ ] Healing rates
- [ ] Death prevention via Insight Die
- [ ] Status badges on character cards and initiative tracker

### Weapons & Equipment (SRD)
- [x] Full weapon database (35+ weapons)
- [x] Weapon dropdowns, ammo pips, reload system, condition tracking
- [x] Attack buttons per weapon with auto-damage
- [x] Weapon jam on Low Insight
- [ ] Weapon trait mechanical effects — Pass 2 (Automatic Burst, Blast Radius, Stun, Burning, Close-Up, Cone-Up)
- [x] Weapon trait mechanical effects — Pass 1 (Cumbersome, Unwieldy CMod penalties)
- [ ] Upkeep Checks
- [ ] Encumbrance

### Additional Check Types (SRD)
- [ ] Group Checks, Opposed Checks, Perception Checks
- [ ] Gut Instinct Checks, First Impressions as rolls

### NPC Roster
- [x] All 5 passes complete + random generator + form overhaul
- [x] Show/Hide/Fight buttons, stackable NPC cards
- [x] NPC Card with clickable RAPID/skills, weapon attack button
- [x] NPC WP/RP health trackers with dot trackers
- [x] NPC weapon auto-assignment by type tier (Goon/Foe/Antagonist)
- [x] Weapon dropdown on NPC edit form
- [x] Viewed NPCs highlighted in roster, Show All / Hide All toggle
- [ ] NPCs linked to world map pins

### Campaign Pins
- [x] campaign_pins table with reveal/hide per pin
- [x] Setting seed pins (Mongrels 24, Chased 14, District Zero 31) insert into campaign_pins
- [x] Assets tab with pin management — show/hide, edit, delete, promote to world
- [x] Campaign map in center panel with campaign pins
- [x] Campaign map search bar with autocomplete + layer switcher (Street/Satellite/Dark)
- [x] Realtime sync — GM reveals pin, player sees it on map instantly
- [x] GM can add new campaign pins from the map (click to place)

### GM Assets Panel
- [x] NPCs tab (renamed from NPC Roster)
- [x] Assets tab with campaign pins
- [x] GM Notes tab (placeholder)
- [ ] Maps & Objects — scene images, tactical map assets, tokens
- [ ] Handouts, Communities, Roll Tables
- [ ] Notes — full implementation
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
- [ ] Pregen storage decision — setting_pregens table or is_pregen flag on campaign_npcs
- [x] End session modal drop zone text size bumped (11/10px → 13/12px)
- [x] All setting pins campaign-scoped only (District Zero, Chased, Mongrels)
- [x] Make Thriver button — error feedback on failure
- [x] Extracted SETTINGS to shared lib/settings.ts (was duplicated in 5 files)
- [x] Pin/NPC seed inserts now have error handling + eliminated extra DB round-trip

### Character Creation
- [x] Clickable steps, portrait upload, concept display, photo resize, test character
- [ ] CDP tracker boxes (partially fixed)

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

---

## 🟠 Phase 3 — Map
- [x] Map autocomplete on search bar (Nominatim)
- [x] Pin clustering (leaflet.markercluster, both world + campaign maps)
- [ ] Layer toggles, Temporal filter
- [ ] Pin cards, Setting regions, Pin hierarchy
- [ ] Pin search, Parent/child structure, Canon layer

---

## 🟠 Logging & Notifications
- [x] All 5 passes + consolidated /logging page
- [x] Player joined notification to all campaign members with character name
- [x] Player left notification
- [x] Pin rejection notification
- [ ] Remaining event instrumentation (9 items)

---

## 🟡 Phase 4 — The Living World
- [ ] The Campfire (3 levels), District Zero, Tactical Map (13 items each)

## 🔵 Phase 5 — Module System (9 items)
## 🔵 Phase 6 — Community & Retention (LFG, Gazette, Tiers, Between Sessions)
## 🔵 Phase 7 — Ghost Mode advanced (conversion tracking, soft walls)
## 🔵 Phase 8 — Physical Products (Chased, Mongrels, QR integration)
## 🔵 Phase 9 — Maturity (Rules Reference, Mobile, Search)
## 🔵 Phase 10 — Future Platforms (Displaced, @xse/core monorepo)

---

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256
- [ ] Migrate character photos from base64 to Supabase Storage (low priority — already compressed to 256x256 JPEG)
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode
- [x] Thriver Console
