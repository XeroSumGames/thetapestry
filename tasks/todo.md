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
- [ ] NPC action pips not consuming on use — likely fixed by consumeAction DB write + loadInitiative, needs live testing to confirm
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
- [ ] **Player-facing NPC card on Show All click** — clicking a revealed NPC in the player's NPCs tab opens a read-only card (currently opens the same editable view as GM). Design question: should the player card just show Name, First Impression role, and description? Or more?
- [ ] **Player NPC notes + first impressions** — clicking an NPC name in the player's Assets NPCs tab should open a space where the player can write personal notes about that NPC, and show their First Impression results
- [ ] **Insight Dice pre-roll CMod** — rethink whether spending an Insight Die pre-roll should give +3 or +2 CMod
- [ ] **Insight Dice sequential reroll** — if rerolling die 1 doesn't improve the result, allow spending a second Insight Die to reroll die 2 (currently locked out after first spend)
- [x] **Whisper chat** — click a player's portrait → private whisper between you two (GM + other players do not see it). Chat tab auto-switches when a whisper arrives addressed to you. Purple styling distinguishes whispers from group chat.
- [ ] **NPC health as narrative feeling** — player-facing NPC cards should show WP/RP as a descriptive state (Healthy, Ragged, Beaten, Dying, etc.) instead of exact numbers — GM still sees the dots

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

### Combat Actions (SRD Table 10 — all 18 + Unarmed + Stabilize)
- [x] **Aim** — +2 CMod (SRD-correct), aim_active flag enforces "must Attack next or lost"
- [x] **Attack** — +1 CMod auto-applied when attacking same target twice in one turn (last_attack_target tracking)
- [x] **Attack Roll** auto-populates last-targeted character — target dropdown, CMod, range band all pre-applied when a second attack happens in the same turn
- [x] **Charge** — both actions, melee/unarmed attack, targets within 20ft, skips weapon range filter
- [x] **Charge** fix — actually costs 2 actions now (was silently costing 1 because actionCostRef wasn't set)
- [x] **Coordinate** — dedicated modal: dropdown picks enemy → Tactics* roll → allies within Close range get +2 CMod vs that target. Log entry announces recipients.
- [x] **Cover Fire** — target picker modal → -2 CMod to enemy's next action
- [x] **Defend** — +2 defense_bonus applied to damage calc, clears after one hit (unless has_cover)
- [x] **Distract** — target picker modal → steals 1 action from target
- [x] **Fire from Cover** — both actions, only appears when has_cover, fire weapon + keep defense
- [x] **Grapple** — full opposed check system, auto-roll both sides, grappled/grappling states, Break Free/Release actions
- [x] **Inspire** — target picker modal → grants +1 action to ally, once per round (inspired_this_round)
- [x] **Move** — grid highlight + click to move token, 10ft Chebyshev
- [x] **Rapid Fire** — -1 CMod first shot, costs 2 actions, ranged only
- [x] **Ready Weapon** — modal with Switch/Reload/Unjam, Tracking +1, weapon swap updates entries state
- [x] Unjam threshold lowered to Worn (was Damaged/Broken) — jammed melee weapons can be unjammed after one Low-Insight degrade
- [x] **Charge** — pick destination cell (20ft) on tactical map before attack roll, no pre-consume on cancel
- [x] **Take Cover** — once per round, no stacking
- [x] **Reposition** — end-of-round positioning action
- [x] **Sprint** — both actions, Athletics check, winded flag (1 action next round)
- [x] **Subdue** — full RP, attack via melee/unarmed
- [x] **Take Cover** — +2 defense_bonus for all attacks this round, sets has_cover, enables Fire from Cover
- [x] **Unarmed** — PHY + Unarmed Combat, 1d3 damage
- [x] **Stabilize** — Medicine roll on dying target
- [x] Social action modals show all combatants (no faction filter — NPCs can be allies)
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
- [x] Getting The Drop — solo round before initiative: drop character acts alone with 1 action, then full initiative rolls for everyone. "⚡ Gets the Drop!" log entry.
- [x] Range Bands — fully automatic from token positions, no manual selector. Per-weapon CMod profiles.
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
- [x] Mortally Wounded → +1 Stress at end of combat
- [x] Mortally wounded NPCs excluded from combat picker (WP=0 filter)
- [x] Defend/Take Cover defense_bonus applied to damage calculation
- [x] Winded combatants get 1 action instead of 2 on next turn
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
- [x] Traits: Blast Radius (auto AoE damage), Burning, Close-Up, Cone-Up
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
- [x] **Author Mongrels NPCs** — 4 NPCs (Frankie, Kincaid, Justice Morse, soldiers), 2 scenes (Minnie interior, Barn), 3 handouts (Session Zero, Vehicle Sheet, Route), equipment in DB column

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
- [x] GM Notes share toggle — players see shared notes as read-only handouts
- [x] NPC card click-to-enlarge portrait (lightbox)
- [x] NPC edit form "Library" button — pick from portrait bank
- [x] Pin coordinates shown on New Pin modal and Edit Pin form
- [ ] Maps & Objects — scene images, tactical map assets, tokens
- [ ] Handouts, Communities, Roll Tables
- [x] NPC card 3-column grid layout over campaign map
- [x] Publish to Library button on NPC card (GM only)
- [x] NPC form + card compacted (portrait/bank/status on one row)
- [x] Renamed Friendly → Bystander NPC type
- [ ] NPC browsing/filtering
- [ ] GM screen, GM quick-reference panel

### Player Inventory System
- [x] InventoryPanel component — item list, catalog search (33 SRD items), custom items, qty tracking
- [x] Inventory button (orange) on CharacterCard
- [x] Encumbrance updated — counts weapons + all inventory items
- [x] Backpack / Military Backpack adds +2 to encumbrance limit
- [x] OVERLOADED warning when over limit
- [x] Custom item creation — name, enc, notes
- [x] Give/Trade — give items to other characters at the table via broadcast
- [x] Real-time sync — receiving player's inventory refreshes on transfer
- [ ] GM loot distribution modal — bulk give items to multiple characters
- [ ] Inventory migration — auto-convert old string equipment to structured items on load
- [ ] **Player-initiated loot from ObjectCard** — currently GM-only. Decide policy: always allowed, only on destroyed crates, or requires "unlocked" flag on the object.
- [ ] **Surface Give loot UI in the GM Assets → Objects panel too** — mirror the per-item Give controls that now live on ObjectCard so GM can loot without placing the object on the map first (current panel loot still requires crate to be destroyed).

### Campaign Management
- [x] Launch, Leave, Share buttons
- [x] Game Feed with Rolls/Chat/Both tabs and Realtime chat
- [x] Campaign edit page (`/stories/[id]/edit`) — name, description, map style, map center location
- [x] "Custom Setting" label (was "New Setting")
- [x] Players get Tactical Map / Campaign Map toggle button in header
- [x] Combat end stays on tactical map for both GM and players
- [x] Start Combat auto-shares tactical map to all players
- [x] NotificationBell on table page header
- [x] Session join race condition fix (await ensureCharacterStates before loadEntries)
- [x] GM private notes
- [x] Player kick from session (kicked flag on character_states, persists on refresh, resets on new session start)
- [ ] CDP awards
- [x] Mortal wound insight save — player acts, GM sees read-only
- [x] Character delete confirmation dialog
- [x] Mortally wounded characters excluded from target list
- [x] Stabilize range check — within 20ft, engaged warning if >5ft
- [x] NPC remove button (red ×) on roster cards
- [x] NPC clone button (+) — duplicates below source with auto-numbered name
- [x] NPC secondary weapon (Foe/Antagonist only)
- [x] NPC portrait bank reduced to 3 (Enemy/Ally/Neutral)
- [x] NPC portrait library z-index fix (appears above edit modal)
- [x] NPC edit modal widened to 430px
- [x] NPC card layout — × under drag handle, larger portrait, wrapping names
- [x] Floating NPC card widened to 420px, drag offset fixed
- [x] Combat action button font increased to 12px
- [x] Combat round counter replaces action pips
- [x] Dashboard button moved to right side of header
- [x] Notification text left-aligned, dropdown positioned below bell (locked)
- [x] Default map cell size 35px
- [x] Map image consistent between GM/player screens (scales from grid width)
- [x] Map popup no longer covers pin icon
- [x] World map default center [8.2316, 13.5352] zoom 3
- [x] World map sidebar tabs — Public / My Pins / Campaign
- [x] Rumor pins show ❓ on map regardless of category
- [x] Copy Map Position button (Thriver only, sidebar)
- [x] Ghost landing shows world map directly (no splash page)
- [x] Launch button on Edit Story page
- [x] Profiles email column + backfill from auth.users
- [x] User guide at docs/user-guide.txt
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
- [x] Zoom and pan — +/- buttons, Ctrl+scroll wheel zoom, spacebar+drag to pan, scrollable at >100%
- [x] Tactical Map toggle button in header bar (GM can set up scenes before combat)
- [x] GM controls strip — Scene Name, Upload Map, Place Tokens, zoom, grid on/off, grid color picker, opacity slider, Fit to Map, cols/rows/cell-feet adjusters, Lock/Unlock Map, Delete Map, Delete Scene, Fit to Screen
- [x] Scene dropdown with + New Scene option
- [x] Corner resize handles for map image (independent of zoom)
- [x] Map always fits to container width, scroll vertically for tall maps
- [x] Grid anchored to top-left, adjustable cols/rows/cell size in feet (default 3ft)
- [x] WP bar beneath each token (color-graded green/yellow/red)
- [x] Token death visuals — red X for mortal wound, 50% opacity for dead
- [x] Initiative order numbered badges on tokens (green for active)
- [x] GM + player ping — double-click empty cell, two consecutive pulses (GM=orange, player=green)
- [x] Range band auto-select from token positions in attack modal (hidden, fully automatic)
- [x] Range enforcement — targets filtered by range (all weapons), "Out of range" blocks Roll button
- [x] Range circle shows PRIMARY weapon range (not best-of-all). Melee capped at 5/10ft
- [x] Per-weapon range CMod profile tables (`lib/range-profiles.ts`) — Shotgun falloff, hunting rifle point-blank penalty, sniper bonuses, etc.
- [x] New range band thresholds — Engaged ≤5ft, Close ≤30ft, Medium ≤100ft, Long ≤300ft, Distant >300ft
- [x] Color-coded range overlay — GM "Show Ranges" toggle; each grid cell colored by band
- [x] NPC cards as draggable floating windows over tactical map during combat
- [x] Move action highlights reachable cells (10ft Chebyshev) on tactical map, click to move
- [x] Players can drag their own token on the tactical map
- [x] Token place/remove broadcasts to all clients for real-time sync
- [x] Tokens spawn at top-left of grid (0,0)
- [x] Smooth token dragging — tokens follow cursor during drag, snap to grid on release
- [x] Zoom slider for all users (GM + players), controls zoom not cell size
- [x] Spacebar pan scrolls the container correctly
- [x] Fit to Screen resets zoom and scale
- [x] Double-click Cols/Rows to type value directly
- [x] Auto-activate most recent scene when switching to tactical map (no empty screen)
- [x] Pin-to-tactical-scene linking — edit pin, select scene, double-click to open
- [x] Blast Radius AoE — grenades/RPGs auto-damage nearby tokens (Engaged=full, Close=50%, Far=25%)
- [x] Map button toggles token on/off (was "already on map" alert)
- [x] Zoom slider moved to top-right, compact (0%/100% labels, white text)
- [x] Resize handles fixed (zoom-corrected hit-test coordinates)
- [x] "Select a target or damage will not be applied" warning in attack roll modal
- [x] Unarmed Attack button on combat action bar
- [x] Token death visuals — red X for mortal wound, 50% opacity for dead
- [x] NPC cards show all equipment weapons as attack buttons
- [x] GM Notes share toggle — players see shared notes as read-only handouts
- [x] NotificationBell on table page header
- [x] Start Combat auto-shares tactical map to all players
- [x] Session join race condition fix (await ensureCharacterStates before loadEntries)
- [x] Sticky-drag fix — handleMouseUp is synchronous; drag state clears before DB write, failures no longer orphan drag
- [x] Click-without-move skips the DB write (token stayed in same cell — avoids wasted round trip)
- [x] **Object tokens targetable in attacks** — weapons crates/barrels/doors with WP appear in Attack Roll target dropdown; damage decrements `scene_tokens.wp_current`; no defensive mod, no RP, no death countdown. Works in primary + reroll damage paths.
- [x] **ObjectCard on double-click** — GM + players double-click an object token to open an inline draggable card: name, WP bar, portrait, properties (GM sees hidden ones). Live WP sync.
- [x] **Map selection pre-populates attack target** — single-click a token, open Attack modal, target dropdown is pre-filled (overrides `last_attack_target` if both exist)
- [x] **Edit Object modal** — font sizes bumped for readability (10→12, 11→12, 12→13, 13→14)
- [x] **Range circles restored** — clicking any token auto-draws 3 circles: green Engaged, blue 9ft Move, red primary-weapon range. Drawn under tokens so sprites stay crisp. Show/Hide Ranges button still toggles visibility.
- [x] **Range band circles REMOVED from tokens** — overlay drawing, Show/Hide Ranges button, `showRangeOverlay` state, and related constants all deleted from `TacticalMap.tsx`. Attack modal's auto range-band logic (`getAutoRangeBand` in page.tsx) still drives CMod + target filtering — just no canvas painting.
- [x] **ObjectCard loot (GM)** — Contents section shows per-item `Give to [PC]` dropdown + green `Give` button. Transfers one-at-a-time to the chosen character's equipment, decrements (or removes) the crate's quantity in `scene_tokens.contents`, logs `🎒 [name] looted [item] from [crate]` to roll_log. Works on intact crates — no need to destroy first.

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
- [ ] **GM Kit Export** — compile all assets for a campaign/adventure into a downloadable package: NPCs (with portraits + stats), map pins, tactical scenes + battle maps, handouts, object tokens, route tables, session notes. Include GM instructions/playbook. Export as PDF, ZIP, or shareable link. Could serve as the distribution format for published modules.

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

## 🛠 Tools
- [x] **Portrait Resizer** (`/tools/portrait-resizer`) — drag-drop image → 256×256 JPEG with center-crop, quality slider (0.5-1.0), live previews at 256/56/32px, optional dashed circle overlay showing token clip area, live file size display, download button

### Future enhancements for the tools suite
- [ ] **Batch mode** — multi-file upload, process and download as zip
- [ ] **Manual crop control** — drag-to-select crop area instead of auto center-crop (useful for off-center subjects)
- [ ] **Upload to Supabase Storage** — shared portrait bank across campaigns; random assignment during NPC creation
- [ ] **Auth gating** — currently `/tools/*` is public; may want to restrict to signed-in Survivors
- [ ] **More tools** — handout generator, token template maker, roll table randomizer

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256
- [ ] Migrate character photos from base64 to Supabase Storage (low priority — already compressed to 256x256 JPEG)
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode
- [x] Thriver Console
