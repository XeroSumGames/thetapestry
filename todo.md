# The Tapestry — TODO List
Last updated: April 2026

---

## 🔴 Bugs & Immediate Fixes

- [ ] Print character sheet printing blank — @page CSS added but sheet renders empty, likely hydration issue
- [ ] Distemper font not applying in navbar on mobile
- [ ] Remove Insight Dice cap — hardcoded to 9 in CharacterCard (max={9}) and executeRoll (Math.min(..., 9))

---

## 🟠 Phase 3 — Table Completion

### Insight Dice
- [ ] Insight Dice spend UI on dice roller — after a roll, if player has Insight Dice, show: Re-roll Die 1 / Re-roll Die 2 / Re-roll Both (costs 2)
- [ ] Re-roll awards Insight Die if result is 1+1 or 6+6 even after spending one
- [ ] Add "How to use Insight Dice" info to dice roller UI

### Combat System (requires SRD — now read)
- [ ] Initiative Tracker — GM rolls 2d6 + ACU + DEX AMods for all; turn order displayed; GM advances turn; current actor highlighted via Realtime
- [ ] Combat roll types in dice roller:
  - [ ] Attack (Unarmed/Ranged/Melee) — links to equipped weapon skill
  - [ ] Aim — +2 CMod, next action must be Attack
  - [ ] Charge — Move + Melee/Unarmed Attack
  - [ ] Coordinate — Tactics* check; +2 bonus to nearby allies
  - [ ] Cover Fire — separate Attack per target; -2 CMod to target's next action
  - [ ] Defend — +2 Defensive Modifier, one round only
  - [ ] Distract — Intimidation/Psychology*/Tactics* check; target loses next Combat Action
  - [ ] Fire from Cover — both actions; fire without losing Defensive Modifier
  - [ ] Grappling — Opposed Check using Unarmed Combat
  - [ ] Inspire — Inspiration check; target at Close range gains extra Combat Action
  - [ ] Rapid Fire — two shots; -1/-3 CMod or -2/-4 if both actions used
  - [ ] Sprint — both actions; Athletics check or Winded
  - [ ] Subdue — RP damage only at 50% WP; Unarmed/Melee only
  - [ ] Stress Check — 2d6 + RSN + ACU AMods; failure raises Stress Level
  - [ ] Breaking Point — 2d6 roll on Table 13 when Stress hits 5
- [ ] Get The Drop — pre-combat single action before Initiative
- [ ] Session open/close with session counter — GM explicitly opens/closes sessions
- [ ] Supabase table: initiative_order (campaign_id, name, roll, is_active)

### NPC Roster
- [ ] GM creates NPCs with RAPID, skills, portrait, notes
- [ ] NPCs linked to world map pins
- [ ] GM reveals NPC card to players after successful First Impressions check
- [ ] Relationship CMod tracking per NPC per character — feeds into dice roller

### Campaign Management
- [ ] GM private notes area (visible to GM only)
- [ ] Player kick and management
- [ ] CDP award system per session — GM awards, players see history
- [ ] Character progression log
- [ ] Handouts — GM pushes text/image to specific players mid-session
- [ ] Transfer GM role to another player
- [ ] Thriver Console — Examine user page (characters, campaigns, hours logged)

### Session History & Roll Log
- [ ] All rolls auto-saved per session with timestamp, character, skill, dice, mods, outcome
- [ ] GM session summary — written after session, pinned to world map
- [ ] Session log browsable after the fact
- [ ] War Stories — players post memorable moments

---

## 🟡 Phase 3 — Map Overhaul

- [ ] Pin clustering — markercluster plugin; nearby pins collapse at low zoom
- [ ] Layer toggles — Canon / Community / Campaign / Mine
- [ ] Temporal filter — show pins from last week / month / all time
- [ ] Pin cards — richer click experience; related pins, visit count, campaign context
- [ ] Pin hierarchy — visual weight: Landmark / Location / Event / Personal
- [ ] Search — keyword search highlights matching pins
- [ ] Setting regions — zoom to District Zero, Chased, etc.
- [ ] Parent/child pin structure — rumor about specific building within a landmark
- [ ] Immutable canon layer — Thriver-set pins only, cannot be edited by anyone else

---

## 🟡 Phase 4 — The Living World

### The Campfire
- [ ] Three levels — Global, Setting (District Zero etc.), Campaign (private)
- [ ] Approved Rumors feed from world map
- [ ] World Events — Thriver authored
- [ ] Session summaries
- [ ] War Stories
- [ ] LFG posts
- [ ] Filter by setting, campaign, date
- [ ] Promotion flow — Campaign → Setting → Global
- [ ] Featured items — Thriver promoted
- [ ] Reactions and comments

### District Zero
- [ ] Pre-populate with canonical landmarks (immutable)
- [ ] Canon layer locked to Thrivers
- [ ] Community layer for player Rumors
- [ ] District Zero Campfire feed
- [ ] District Zero timeline
- [ ] Setting region on world map
- [ ] Campaign creation option: Run in District Zero

### Tactical Map
- [ ] GM uploads scene image (Supabase Storage)
- [ ] Supabase tables: scenes, scene_tokens
- [ ] Auto-generated player tokens — portrait or initials
- [ ] NPC tokens — GM placed and managed
- [ ] Drag to move with Realtime sync
- [ ] Zoom and pan
- [ ] Click token → opens character sheet
- [ ] WP and stress visible under each token
- [ ] Range ruler — shows Engaged/Close/Medium/Long/Distant
- [ ] Token status badges — Wounded, Stressed, Down
- [ ] GM ping — flash a location for all players
- [ ] Hidden tokens — GM reveals when discovered
- [ ] Multiple scene slots per campaign
- [ ] Initiative order shown as numbered badges on tokens

---

## 🔵 Phase 5 — Module System

- [ ] Module data structure — scenes, NPCs, pins, handouts, roll tables
- [ ] Module builder UI — Thriver only
- [ ] Three permission tiers: Module Creator, Licensed GM, Player
- [ ] Campaign creation three-way picker: Custom / Setting / Module
- [ ] GM toolkit — scene switcher, NPC roster, handouts panel, roll tables, GM screen
- [ ] Empty (first module) — single scene, NPCs, player briefing, GM notes, resolution paths
- [ ] Module library browser

---

## 🔵 Phase 6 — Community & Retention

- [ ] Looking for Group — listings, GM posts, player posts, session scheduling
- [ ] Notifications — session starting, Rumor approved, CDP awarded, another group found your pin (email + in-app)
- [ ] Between sessions — CDP spending, War Story submission, "what happened since you were last here" feed
- [ ] The Gazette — auto-generated campaign newsletter, shareable link
- [ ] Subscriber tiers — Free / Paid / Premium (separate from Thriver platform role)

---

## 🔵 Phase 7 — Physical Product Integration

- [ ] Chased (Delaware) — QR codes deep-link into platform at correct region
- [ ] Anonymous preview for non-account holders
- [ ] Dedicated onboarding flow for physical product purchasers
- [ ] Chased module in module library
- [ ] Minnie & The Magnificent Mongrels setting

---

## 🔵 Phase 8 — Platform Maturity

- [ ] Rules Reference — full XSE SRD searchable in-platform
- [ ] Contextual links from character sheet and dice roller to rules
- [ ] GM quick-reference panel — outcomes, CMods, range bands, combat actions
- [ ] Mobile optimization — responsive layout, mobile dice roller
- [ ] Global search — pins, Campfire, characters, campaigns
- [ ] Displaced — future platform, space setting, same XSE engine

---

## 📝 Technical Debt

- [ ] Migrate character photos from base64 in data JSON to Supabase Storage — fixes 12MB table payload permanently
- [ ] Embed Distemper video(s) on landing/welcome page
- [ ] Welcome page dual-mode — first-time full-screen vs returning with nav

---

## ✅ Completed

- [x] Auth, signup, login, roles, suspension
- [x] Character creator — 10-step backstory wizard
- [x] Quick Character Creator
- [x] Random Character Generator
- [x] Unified CharacterCard component
- [x] Optimistic stat updates — instant WP/RP/Stress/Insight response
- [x] World map — Leaflet.js, 3 layer switcher, pin categories with emoji icons
- [x] Pin moderation queue
- [x] Pin RLS — pending/approved/rejected visibility rules
- [x] Campaign system — create, join, invite code
- [x] My Stories page — Running as GM / Playing In
- [x] Campaign detail — GM and Player views unified
- [x] The Table — live play surface
- [x] character_states — WP/RP/Stress/Insight/CDP/Morality live tracking
- [x] WP/RP dot toggle persisting (await fix)
- [x] XSE Dice Roller — 2d6 + AMod + SMod + CMod
- [x] Roll Feed — live broadcast to all campaign members via Realtime
- [x] Moments of Insight — auto-detected, Insight Die awarded on 1+1 or 6+6
- [x] Portrait strip — bottom of Table, click to open character sheet overlay
- [x] Players can only open own sheet; GM can open all
- [x] Progressive table loading — page shell renders before data loads
- [x] Deferred photo load — portraits appear fast, photos load after
- [x] Parallelised Supabase queries throughout table page
- [x] Muted text brightened from #b0aaa4 to #d4cfc9 site-wide
- [x] Map emoji icons restored after encoding corruption
- [x] Role case-sensitivity bug fixed (lowercase in DB)
- [x] CDP exploit fix
- [x] WP formula corrected (10 + PHY + DEX)
- [x] Table height fixed to 74px navbar
- [x] z-index raised so character sheet overlay is clickable above sidebar
- [x] Only currently assigned character shown per player in table
