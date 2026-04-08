# The Tapestry — Complete Feature List

Everything built, in progress, and planned across all phases.

---

## Phase 1 — Foundation (Complete)

### Auth & User Management
- [x] Supabase Auth — signup, login, logout
- [x] Role system — Survivor, Thriver, Moderator, Admin (CHECK constraint)
- [x] Profile creation trigger on auth.users (handle_new_user with EXCEPTION handler)
- [x] Client-side profile creation fallback (belt-and-suspenders)
- [x] Signup error visibility — console logging, user-facing error messages
- [x] Login error visibility — console logging
- [x] Firsttimers page error handling — no more blank page on missing profile
- [x] User suspension and unsuspension
- [x] User deletion
- [x] Make Thriver / Make Survivor role promotion with error feedback
- [x] Moderation page — Users tab with role management
- [x] Styled login and signup pages matching Distemper branding
- [x] Auto-clear stale refresh tokens on auth error
- [x] Onboarding welcome page with Distemper logo and feature overview
- [x] Welcome page dual-mode — first-time full-screen vs returning with nav

### Character System
- [x] 10-step backstory wizard (Steps Xero through Nine)
- [x] Quick Character Creator (20 CDP spend)
- [x] Random Character Generator
- [x] Unified CharacterCard component
- [x] Portrait upload with auto-resize to 256x256 JPEG
- [x] Clickable steps, concept display, photo resize
- [x] Character list with duplicate, print, delete
- [x] Skill math, attribute pickers, professions, paradigms
- [x] Step 9 backstory formatting — grouped paragraphs, consistent styling
- [x] CDP exploit fix in skill step-down
- [x] WP formula corrected (10 + PHY + DEX)
- [ ] CDP tracker boxes (partially fixed)

### Print Sheet
- [x] Print character sheet — dark theme matching in-game card
- [x] White background, black text for printer
- [x] Fixed: all black, single page only, blank render
- [ ] Print sheet missing data — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated

---

## Phase 2 — World Map & Campaigns (Complete)

### World Map
- [x] Leaflet.js map with tile layers
- [x] Pin placement with click-to-place
- [x] Pin categories with emoji icons (16+ categories)
- [x] Rumor submission system (pending/approved/rejected)
- [x] Pin moderation queue — approve/reject with notifications
- [x] Pin RLS — visibility rules per status
- [x] Map sidebar with pin list, fly-to, delete
- [x] Map autocomplete search bar (Nominatim)
- [x] File attachments on pins
- [x] Layer switcher (7 tile providers: Satellite, Topo, Street, Voyager, Humanitarian, Positron, Dark)
- [x] Resizable forms, attachment display
- [x] Role-based pin behaviour — Survivor vs Thriver
- [x] Pin edit functionality
- [x] Map emoji icons restored after encoding corruption

### Campaign System
- [x] Campaign create, join, invite code
- [x] My Stories page — Running as GM / Playing In
- [x] Campaign detail — GM and Player views unified
- [x] Launch, Leave, Share buttons
- [x] Campaign clone
- [x] Campaign setting selector (District Zero, Chased, Mongrels, Empty, The Rock, Custom)

### Dashboard & Navigation
- [x] Global sidebar with Distemper branding
- [x] Sidebar links open in new tabs
- [x] Dashboard landing page
- [x] Navbar removed, sidebar branding with Distemper logo

---

## Phase 3 — The Table (Mostly Complete)

### Live Play Surface
- [x] The Table — campaign play surface
- [x] character_states — WP/RP/Stress/Insight/CDP/Morality live tracking
- [x] Optimistic stat updates — instant response
- [x] Portrait strip — bottom of Table, click to open sheet
- [x] Players can only open own sheet; GM can open all
- [x] Overlay mode 30% opacity — map visible behind sheet
- [x] Inline mode: full-screen sheet; Overlay mode: draggable floating window
- [x] Progressive table loading — shell renders before data loads
- [x] Parallelised Supabase queries

### Dice Roller
- [x] XSE Dice Roller — 2d6 + AMod + SMod + CMod
- [x] Roll Feed — live broadcast via Realtime
- [x] Moments of Insight — auto-detected on 1+1 or 6+6
- [x] Attack Roll label for weapon attacks, Rolling for skill checks
- [x] Conditional Modifier label and input
- [x] Pre-roll Insight Die spend — Roll 3d6 (keep best 2) or +3 CMod
- [x] Post-roll Insight Die re-roll (Die 1, Die 2, or Both)
- [x] Pre-roll and post-roll spends don't conflict
- [x] Automatic Burst toggle in roll modal (opt-in)

### Session Management
- [x] Session open/close with session counter
- [x] Session history table in Supabase
- [x] Lobby state when session is idle
- [x] End session modal with summary, cliffhanger, next-session notes, file attachments
- [x] Session history page with grid layout, deactivate, delete
- [x] Previous Sessions button in table header
- [x] Cliffhanger field displayed in session history
- [x] Table auto-refreshes when player joins (Realtime on campaign_members)
- [x] End session modal drop zone text size bumped
- [ ] War Stories — players post memorable moments from sessions

### Combat System
- [x] Initiative system — 2d6 + ACU + DEX, sorted descending
- [x] Initiative tracker UI — active indicator, NPC portraits, type badges
- [x] Defer mechanic — swap with next in order
- [x] All NPCs pre-selected when starting combat
- [x] NPCs sorted first in target dropdown
- [x] Auto-advance initiative on roll complete
- [x] Action slots — 2 per turn with green/orange pips
- [x] All 15 combat actions alphabetical: Aim, Attack, Charge, Coordinate, Cover Fire, Defend, Distract, Inspire, Move, Rapid Fire, Ready Weapon, Reload, Sprint, Subdue, Take Cover
- [x] 1-action buttons (Move, Defend, etc.) consume 1 action
- [x] 2-action buttons (Charge, Rapid Fire, Sprint) consume 2, greyed when unavailable
- [x] Aim — +1 CMod on next attack, stacks
- [x] Ready Weapon + Tracking trait — +1 CMod on next attack
- [x] Rapid Fire — opens roll with burst pre-enabled
- [x] Charge — melee attack with +1 CMod
- [x] Actions logged to game feed
- [x] Unified header buttons (hdrBtn helper, 28px uniform)
- [ ] Pass 3 — Social/contested actions (Coordinate, Cover Fire, Distract, Inspire — cross-player CMod effects)
- [ ] Getting The Drop
- [ ] Range Bands — Engaged, Close, Medium, Long, Extreme
- [ ] Initiative re-roll each round
- [ ] Delayed Actions
- [ ] Resolution Phase

### Damage & Health
- [x] Auto-damage on successful attacks with DMM/DMR defense
- [x] Damage breakdown in roll modal
- [x] Stress bar tracker (5 segments, color-coded)
- [x] Stress Check button triggers roll using Stress Modifier
- [x] Breaking Point auto-triggers at stress 5 — rolls Table 13
- [x] Breaking Point modal shows result, resets stress to 0
- [x] Lasting Wounds — roll Table 12 when WP reaches 0
- [x] Insight, CDP, Morality bar trackers (10/10/7 blocks)
- [x] Stress Check with CMod — success drops to 4, failure triggers Breaking Point
- [x] Breaking Point modal shows on whichever screen has sheet open
- [ ] RP reaches 0 → unconscious state
- [ ] WP reaches 0 → Mortally Wounded with death countdown
- [ ] Stabilize mechanic
- [ ] Healing rates
- [ ] Death prevention via Insight Die
- [ ] Status badges on character cards and initiative tracker

### Weapons & Equipment
- [x] Full weapon database (38 weapons across melee, ranged, explosive, heavy)
- [x] Weapon dropdowns, ammo pips, reload system, condition tracking
- [x] Attack buttons per weapon with auto-damage
- [x] Weapon jam/degrade on Moment of Low Insight
- [x] Weapon condition CMod (Pristine +1, Used 0, Worn -1, Damaged -2, Broken unusable)
- [x] Trait: Cumbersome (X) — PHY AMod penalty
- [x] Trait: Unwieldy (X) — DEX AMod penalty
- [x] Trait: Stun — zeroes WP damage, incapacitation on Wild Success/High Insight
- [x] Trait: Automatic Burst (X) — multi-roll damage, opt-in toggle
- [x] Trait: Blast Radius — range damage tiers (display)
- [x] Trait: Burning (X) — DoT info with d3 duration (display)
- [x] Trait: Close-Up / Cone-Up — bystander damage note (display)
- [x] Trait labels shown separately in roll modal
- [ ] Trait: Tracking — +1 CMod after Ready Weapon (partially wired)
- [ ] Upkeep Checks
- [ ] Encumbrance

### NPC System
- [x] NPC Roster — 5 passes complete + random generator + form overhaul
- [x] NPC types: Bystander, Goon, Foe, Antagonist (renamed from Friendly)
- [x] Show/Hide/Fight buttons, stackable NPC cards
- [x] NPC Card — clickable RAPID/skills, weapon attack button
- [x] NPC WP/RP health trackers with dot trackers
- [x] NPC weapon auto-assignment by type tier
- [x] Weapon dropdown on NPC edit form
- [x] Viewed NPCs highlighted in roster
- [x] NPC card 3-column grid layout over campaign map
- [x] Compact NPC card — RAPID + WP/RP side-by-side, smaller fonts
- [x] Compact NPC form — portrait/bank/status on one row, name/type on one row
- [x] Publish to Library button on NPC card (GM only)
- [x] NPC card Edit button opens edit modal (switches to NPCs tab)
- [ ] NPCs linked to world map pins
- [ ] NPC browsing/filtering

### Campaign Pins & Maps
- [x] campaign_pins table with reveal/hide per pin
- [x] Setting seed pins (Mongrels 24, Chased 14, District Zero 31)
- [x] All setting pins campaign-scoped only
- [x] Assets tab with pin management
- [x] Campaign map with search bar + autocomplete
- [x] Realtime sync — GM reveals pin, player sees instantly
- [x] GM can add new campaign pins from the map
- [x] Campaign map auto-centers on setting (District Zero, Chased, Mongrels)
- [x] Custom location search for New Setting campaigns
- [x] Campaign map style selector on creation
- [x] GM map style dropdown in table header
- [x] CampaignMap search + layer buttons match MapView layout

### Setting Seeds
- [x] District Zero — 31 pins, 18 NPCs with full stat blocks
- [x] Chased — 14 pins, 21 NPCs, 5 pregens
- [x] Mongrels — 24 pins
- [x] campaign_npcs table with RLS + Realtime
- [x] Campaign creation auto-seeds pins and NPCs
- [x] Renamed district0 → district_zero across codebase
- [x] Extracted SETTINGS to shared lib/settings.ts
- [ ] Pregen storage decision — setting_pregens table or is_pregen flag

### Game Feed
- [x] Rolls/Chat/Both tabs with Realtime chat
- [x] Chat messages with character names
- [x] Roll log with outcome display
- [x] Action log entries (Move, Defend, Aim, etc.)
- [ ] GM private notes
- [ ] Player kick, CDP awards
- [ ] Character progression log
- [ ] Allow characters in multiple campaigns
- [ ] Transfer GM role, Session scheduling

### Additional Check Types
- [ ] Group Checks, Opposed Checks, Perception Checks
- [ ] Gut Instinct Checks, First Impressions as rolls

---

## Phase 3 — Map (Mostly Complete)

- [x] Map autocomplete on search bar (Nominatim)
- [x] Pin clustering (leaflet.markercluster, both world + campaign maps)
- [x] 7 map tile styles (Satellite, Topo, Street, Voyager, Humanitarian, Positron, Dark)
- [x] World map default view with ocean background color
- [x] Filter chips replace sidebar tabs — All, Public, Mine, Canon, Rumors, Timeline with counts
- [x] Timeline filter — world_event pins in chronological order, overrides sort, date labels
- [x] Sort control — Newest, Oldest, By Category, Nearest
- [x] Ghost default — Timeline active for unauthenticated visitors
- [x] Ghost CTA in Timeline view — "Sign up to add your own story to this world."
- [x] Filter state persisted in localStorage for authenticated users
- [x] World event pins — 16 Dog Flu timeline + settlement pins
- [x] New pin categories: world_event and settlement
- [x] Sidebar X close + reopen button
- [x] Dashboard and /map use identical MapView (unified sidebar)
- [ ] Pin cards — richer click experience, related pins, visit count, campaign context
- [ ] Setting regions — zoom to District Zero, Chased, etc.
- [ ] Pin hierarchy — visual weight: Landmark / Location / Event / Personal
- [ ] Pin search — keyword search highlights matching pins
- [ ] Parent/child pin structure — rumor about a specific building within a landmark
- [ ] Immutable canon layer — Thriver-set pins only

---

## Phase 3 — Ghost Mode (Complete)

- [x] Public pages: /, /map, /dashboard, /campaigns, /characters, /creating-a-character, character builders
- [x] Sidebar with "Ghost — You Don't Exist" label, navigation, Sign In / Create Account
- [x] Map read-only for ghosts
- [x] Dashboard landing page for ghosts with Distemper branding
- [x] Character builders bounce to login on Advance/Back/step clicks
- [x] Ghost-to-Survivor conversion tracking
- [x] Soft wall modal instead of hard redirect
- [x] Ghost wall copy — "you don't exist if you don't sign up", "go back to stalking"
- [x] Timeline default for Ghost visitors

---

## Phase 3 — Logging & Notifications (Mostly Complete)

- [x] 5-pass logging system + consolidated /logging page
- [x] Player joined notification to all campaign members with character name
- [x] Player left notification
- [x] Pin rejection notification
- [x] Notification bell with unread count
- [x] Notification individual delete (X) and Delete All buttons
- [x] Mark All Read auto-closes notification panel
- [x] Notification panel positioned below bell
- [x] Colorized notification bodies (player names, campaign names)
- [x] Visitor email alerts — New Visitor / Survivor Active with location + visit count
- [x] Visitor geo-location — country, region, city, lat/lng from Vercel headers
- [x] IP hash tracking — SHA-256, no PII stored
- [x] Visual visitor map on /logging — dark tiles, green/red dots, popup with details
- [x] Visitor email throttle — one per unique session_id
- [x] Edge Function log-visit with --no-verify-jwt for Ghost access
- [ ] Remaining event instrumentation (9 items)

---

## Phase 3 — Infrastructure & Tech Debt

- [x] Auto-resize uploaded photos to 256x256 JPEG
- [x] Supabase Pro plan (upgraded from Free)
- [x] Middleware for Vercel geo headers → cookies
- [x] Shared SETTINGS constant (lib/settings.ts) — eliminated 5 duplicates
- [x] Pin/NPC seed inserts with error handling + eliminated extra DB round-trip
- [x] Muted text brightened from #b0aaa4 to #d4cfc9 site-wide
- [x] Minimum font size 13px enforced
- [x] hdrBtn style helper for uniform header buttons
- [ ] Migrate character photos from base64 to Supabase Storage (low priority)
- [ ] Embed Distemper videos on landing page

---

## Phase 4 — The Living World

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
- [ ] Campaign creation option — Run in District Zero pre-populates setting content

### Tactical Map
- [ ] GM uploads scene image for a session location
- [ ] Auto-generated player tokens from portrait photos or initials
- [ ] NPC tokens placed and managed by GM
- [ ] Drag to move tokens, Realtime sync to all players
- [ ] Zoom and pan for everyone simultaneously
- [ ] Click token to open character sheet or NPC card
- [ ] WP and stress visible beneath each token
- [ ] Range ruler — click and drag shows Engaged/Close/Medium/Long/Distant
- [ ] Token status badges — Wounded, Stressed, Incapacitated, Dead
- [ ] GM ping — click to flash a location on everyone's screen
- [ ] Hidden tokens — GM places, reveals when discovered by players
- [ ] Multiple scene slots per campaign — switch between scenes mid-session
- [ ] Initiative order shown as numbered badges on tokens

---

## Phase 5 — Module System

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

## Phase 6 — Community & Retention

- [ ] LFG system — GMs post open campaigns, players post availability, matching by setting and playstyle
- [ ] Session scheduling — GM proposes times, players confirm, calendar view
- [ ] The Gazette — auto-generated campaign newsletter after each session pulling from roll log highlights, session summary, GM notes. Shareable link for non-members.
- [ ] Between-session experience — something to do on the platform outside of active sessions
- [ ] Subscriber tiers — Free, Paid, Premium with defined feature gates
- [ ] Graffiti — reactions on War Stories and Campfire posts (Distemper-branded reactions)

---

## Phase 7 — Ghost Mode Advanced

- [ ] Ghost-to-Survivor funnel analytics — track where conversions happen
- [ ] A/B test soft wall messaging
- [ ] Onboarding flow for physical product QR scanners — different from standard signup

---

## Phase 8 — Physical Products

- [ ] Chased QR code integration — fold-out map codes deep-link into Tapestry at Delaware setting
- [ ] Anonymous preview for QR scanners without accounts — show setting content before signup prompt
- [ ] Chased module — pre-populated with Delaware setting content, linked to physical product
- [ ] Minnie & The Magnificent Mongrels setting — sourcebook upload, seed pins and NPCs
- [ ] Physical product landing pages — one per product, branded, drives to signup

---

## Phase 9 — Maturity

- [ ] Rules reference — full XSE SRD v1.1 searchable and browsable within The Tapestry
- [ ] Contextual rules links — from character sheet and dice roller to relevant SRD sections
- [ ] GM quick-reference panel — outcomes table, CMod table, range bands, combat actions at a glance
- [ ] Mobile optimization pass — dashboard, map, character wizard, table view all responsive
- [ ] Mobile dice roller — optimized for rolling at a physical table on your phone
- [ ] Global search — find characters, campaigns, pins, NPCs, Campfire posts

---

## Phase 10 — Future Platforms

- [ ] Displaced — space setting, separate platform, custom star map
- [ ] Extract shared XSE engine into @xse/core monorepo — character system, campaign system, table surface shared across platforms
- [ ] Each setting gets own domain, branding, and map layer built on shared core
- [ ] Long-term: Tapestry becomes the proof of concept for the XSE platform family

---

## Database Tables

| Table | Purpose |
|-------|---------|
| profiles | User accounts with role, username, email |
| campaigns | Campaign settings, GM, invite codes, map style, center lat/lng |
| campaign_members | User-campaign membership |
| campaign_pins | Per-campaign pins with reveal/hide |
| campaign_npcs | Per-campaign NPCs with full stat blocks |
| characters | Character data (backstory wizard state) |
| character_states | Live WP/RP/Stress/Insight/CDP/Morality per campaign |
| map_pins | World map pins with categories, status, geo |
| world_npcs | Published NPC library |
| npc_relationships | NPC-to-character relationship CMods |
| roll_log | Dice roll history per campaign |
| initiative_order | Combat initiative with actions_remaining, aim_bonus |
| notifications | In-app notifications per user |
| user_events | Analytics events (signup, login, campaign_created, etc.) |
| visitor_logs | Page visits with session_id, geo, ip_hash |
| session_history | Completed session summaries |

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| log-visit | Visitor logging with IP capture, email alerts, geo storage |
| notify-thriver | Email notifications to Thriver users via Resend |

## Key Libraries

| Package | Purpose |
|---------|---------|
| next 14 | App Router framework |
| @supabase/supabase-js | Database, auth, realtime |
| leaflet + react-leaflet | Maps (world, campaign, visitor) |
| leaflet.markercluster | Pin clustering |
| Resend API | Email alerts |

## Deployment

- **Frontend:** Vercel (auto-deploy from GitHub main branch)
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions, Storage)
- **Domain:** thetapestry.distemperverse.com
