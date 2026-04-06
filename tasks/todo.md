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
- [ ] Weapon traits — Automatic Burst, Blast Radius, Bulky, Cumbersome, Compact, Stun, Tracking, Unwieldy
- [ ] Item Condition tracking — Pristine (+1 CMod), Used (0), Worn (-1), Damaged (-2), Broken (unusable)
- [ ] Upkeep Checks — Mechanic/Tinkerer/weapon skill checks to maintain condition
- [ ] Ammo tracking — weapons start with 1d3 reloads, decrement on use
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

### GM Assets Panel — Tab Structure
- [x] NPC Roster tab
- [x] GM Notes tab (placeholder)
- [ ] Maps & Objects — scene images, tactical map assets, tokens, props
- [ ] Handouts — documents and images GM can push to players mid-session
- [ ] Communities — Morale tracker, Gatherers/Maintainers/Safety, weekly Morale Check roller
- [ ] Roll Tables — custom tables GM can roll on during play (loot, encounters, complications)
- [ ] Notes — GM private scratchpad, session prep, secrets (full implementation)
- [ ] NPC browsing/filtering — search by name, filter by type/status/role, sort, card grid vs list toggle

### Campaign Management
- [x] Launch button on campaign cards (direct to table, new tab)
- [x] Leave button on player campaign cards
- [x] Share button on campaign cards (copies invite link)
- [ ] Roll Feed tabs — Rolls only, Chat only, All (requires chat_messages table + Realtime)
- [ ] GM private notes (full implementation)
- [ ] Player kick/management
- [ ] CDP award system per session
- [ ] Character progression log
- [ ] Transfer GM role to another player

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
- [x] Navbar buttons uniform height (32px)
- [x] Header buttons match campaign name text height
- [x] Dynamic player strip sizing for 6+ players
- [x] Green border on player's own character in portrait strip
- [x] Notification bell SVG with dynamic color (orange/gray)
- [x] Notification body colorized (names green, campaigns red, characters blue)
- [x] Mark All Read closes notification dropdown
- [x] Welcome page split — /firsttimers for onboarding, /welcome for returning users
- [x] Welcome page broken emojis fixed

---

## 🟠 Phase 3 — Map
- [ ] Pin clustering (markercluster plugin)
- [ ] Layer toggles — Canon / Community / Campaign / Mine
- [ ] Temporal filter
- [ ] Pin cards — richer click experience
- [ ] Setting regions

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
- [ ] The Campfire — three levels (Global / Setting / Campaign)
- [ ] Promotion flow — Campaign → Setting → Global
- [ ] District Zero canonical content + canon layer
- [ ] Tactical Map — scene image upload, draggable tokens, Realtime sync
- [ ] Token status badges, range ruler, GM ping

---

## 🔵 Phase 5 — Module System
- [ ] Module data structure
- [ ] Module builder (Thriver only)
- [ ] Campaign creation picker — Custom / Setting / Module
- [ ] GM toolkit — scene switcher, handouts panel, roll tables
- [ ] Empty (first module)
- [ ] Module library — browsable by GMs

---

## 🔵 Phase 6 — Community
- [ ] LFG system
- [ ] The Gazette
- [ ] Subscriber tiers (Free / Paid / Premium)

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
- [ ] Chased QR integration
- [ ] Anonymous preview for non-account holders
- [ ] Minnie & The Magnificent Mongrels setting

---

## 🔵 Phase 9 — Maturity
- [ ] Rules reference (XSE SRD in-platform)
- [ ] Mobile optimization
- [ ] Global search

---

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256 (fixes save timeout)
- [ ] Migrate character photos from base64 to Supabase Storage (full migration)
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode (first-time vs returning)
- [x] Thriver Console — examine user page
