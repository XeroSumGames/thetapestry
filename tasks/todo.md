# Tapestry — To Do & Backlog

## 🎯 Next up (post-combat sprint)
- [ ] **Destroyed-object portrait swap** — object tokens with WP should optionally carry a `destroyed_portrait_url`; when the token hits 0 WP, the canvas renders that image instead of the intact one. Falls back to the current shatter-crack overlay if no destroyed art exists. Upload UX lives on the object add/edit form in NpcRoster → Objects.
- [ ] **NPC popup → First Impression display + Recruit button** — when a player clicks an NPC in the NPCs tab, surface their First Impression result + `relationship_cmod` for that PC, and add a Recruit button right of the Active badge (queued from Phase B Communities work).
- [ ] **CMod Stack reusable component** — user loved the itemized CMod Stack on the Recruit modal; extract into `<CmodStack>` and use in Grapple, First Impression, main Attack modals.
- [ ] **Phase C Communities** — weekly Morale Check + Resource Checks (Fed/Clothed) + Activity Blocks (Phase D).

*Inventory migration removed 2026-04-21 — DB audit confirmed every character's `data.inventory` is already an array. Nothing to migrate.*

## ✅ Shipped 2026-04-22 (Communities Phase B wrap + header nest)
- **Recruitment Insight Dice** — pre-roll 3d6 / +3 CMod picker on the Recruit modal pick step (gated on roller having ≥1 Insight Die) + post-roll reroll buttons on the result step. Reroll reconciles `community_members` state if outcome crosses the success line, patches `roll_log` in place via captured row id. Handles 3d6 threshold math (14+/9+/4+/<4).
- **Community milestone notification** — new Postgres trigger on `community_members` INSERT/UPDATE: when active count crosses 13 for the first time, notifies `leader_user_id` with `type='community_milestone'`, back-fills `notified_community_milestone=true` on existing ≥13 communities so they don't retro-fire. Colorized in `NotificationBell.tsx`. SQL: `sql/community-milestone-trigger.sql`.
- **Community roster row redesign** — NPC name renders bold/prominent; recruitment type moves to subtle subtext; Apprentice rows show `Apprentice ⇐ <PC name>` inline so masters are visible. Roles bars now compute percentages over **NPCs only**. New "Player Characters (N)" block sits between role bars and NPC roster.
- **Recruit copy fix** — `"X joined Y as a Cohort."` / `"as an Apprentice to Z"` (articles added everywhere — modal + roll_log label).
- **Log trimming** — failure recruit labels compact to narrative `"Ada tried to recruit Jess but it didn't go well"` / `"it went badly"` (Dire Failure / Low Insight).
- **Header bar nesting** — flat 12+ buttons → 4 dropdowns: `Checks ▾` / `Community ▾` / `Campaign ▾` (Share, Sessions, Stories) / `GM Tools ▾` (Restore, Loot, CDP, GM Screen). Custom dropdown replaces native `<select>` on Checks so option text center-aligns across browsers. ESC + outside-click close; chevron flips `▾`↔`▴` when open.
- **Canvas token z-order** — tactical map sorts tokens so objects render first (bottom), then NPCs, then PCs on top. Barrels no longer cover PC name plates.
- **`consumeAction` race guard** — per-entry `Set<string>` in-flight ref. A double-clicked Aim (or any action button) no longer decrements `actions_remaining` twice and skips the turn.

## ✅ Shipped 2026-04-20 (pre-Mongrels game sprint)
- `f2e708f` Insight Dice sequential reroll — second spend on the OTHER die after first fails
- `ce50927` Sprint no longer burns actions on silent click-fail — consumeAction deferred to onMoveComplete
- `46cee3a` Object WP defaults to 3 + explicit "Indestructible (decorative only)" toggle on add/edit
- `e2c3b7d` Initiative no longer reactivates a combatant mid-round after a kill — skip-walk now detects wrap-past-end and fires new-round
- `cdcedef` Move button anchors on GM's selected token (not active combatant) + guards consumeAction on non-active move
- `deccf40` Deleting an NPC auto-cleans orphan scene_tokens + initiative_order rows
- `875c8d7` NPC folder tree shows during combat too
- `8b8c347` Initiative bar — fixed roll-descending order (no rotation); pre-selected target range-band no longer clobbered by unconditional medium reset

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
- [x] NPC action pips consuming on use (confirmed working, will readdress if not)
- [x] PC damage from NPC attacks (confirmed fixed)
- [x] Manipulation rolls auto-include First Impression CMod — "Interacting with NPC?" dropdown on social skill rolls auto-sets CMod from relationship_cmod
- [x] Add to Combat modal filters NPCs already in initiative (was already working via initiativeNpcIds prop)
- [x] Self-attack applies damage to self (confirmed working)
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
- [x] **Roll modal stuck "Rolling..."** — confirmed resolved, will readdress if it recurs
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
- [x] **Insight Dice pre-roll CMod** — confirmed +3 CMod (per SRD)
- [x] **Insight Dice sequential reroll** — `f2e708f` `spent` boolean → `insightUsed: 'pre' | 'die1' | 'die2' | 'both' | null`. After rerolling one die, only the OTHER die's button remains; second spend locks the panel. Pre-roll 3d6 still locks post-roll rerolls.
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
- [x] Session delete renumbers remaining and updates campaign count
- [x] Session delete RLS fix — GM DELETE/UPDATE policies on sessions table
- [x] Timeline pins: event_date field, sort_order in Edit Pin UI
- [x] Character sheet pop-out (/character-sheet) with realtime sync + session notes
- [x] Vehicle system — VehicleCard, pop-out (/vehicle), WP/stress/fuel/cargo, floorplan, realtime sync
- [x] Handout pop-out (/handout) for GM Notes + player-side GM Handouts
- [x] All pop-outs use full-width layout (no sidebar)
- [x] Pop-out buttons on: character cards, bottom portrait bar, vehicle cards, GM notes, player handouts
- [x] PC damage broadcasts include optimistic patch for instant client-side updates
- [x] Object tokens show 2-line names, Edit button in info panel, draggable in Assets sidebar with persistent sort_order
- [x] Previous Sessions button in table header
- [x] Cliffhanger field displayed in session history
- [x] Table auto-refreshes when player joins (Realtime on campaign_members)
- [x] War Stories — moved to Phase 4 (Campfire)

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
- [x] **Weapon range realism pass** — nominal bands recalibrated to real-world effective combat range (Heavy Pistol Close→Medium, Carbine Medium→Long, Compact Bow Long→Medium, Molotov Distant→Close, RPG Distant→Long, Mounted Turret Medium→Long). Profile CMods tuned: Assault Rifle gains Distant (-3), Heavy Mounted gains Distant (-4), Flamethrower gains Medium (-4), Heavy Pistol Medium -1→0, Bow Long -2→-3.
- [x] **Taser split** — old melee Taser renamed **Cattle Prod** (contact stun unchanged); new **Taser** is projectile darts (Close range, clip 1, Rare ammo, Stun). SQL migration `sql/weapon-taser-rename.sql` auto-converts existing characters/NPCs.
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
- [ ] Handouts, Roll Tables *(Communities moved to its own Phase — see below)*
- [x] NPC card 3-column grid layout over campaign map
- [x] Publish to Library button on NPC card (GM only)
- [x] NPC form + card compacted (portrait/bank/status on one row)
- [x] Renamed Friendly → Bystander NPC type
- [x] NPC folder tree — collapsible folders, drag NPCs between, drag to reorder, double-click rename, folder field on edit form
- [x] NPC Show/Hide syncs token visibility on tactical map
- [x] NPC browsing/filtering — search bar + type/status filter chips
- [x] GM Screen — pop-out /gm-screen page for second monitor (outcomes, combat actions, range bands, conditions, CMods, healing, skills→attrs)

### Player Inventory System
- [x] InventoryPanel component — item list, catalog search (33 SRD items + **all 50+ weapons**), custom items, qty tracking
- [x] Inventory button (orange) on CharacterCard
- [x] Encumbrance updated — counts weapons + all inventory items
- [x] Backpack / Military Backpack adds +2 to encumbrance limit
- [x] OVERLOADED warning when over limit
- [x] Custom item creation — name, enc, notes
- [x] Give/Trade — give items to other characters at the table via broadcast
- [x] Real-time sync — receiving player's inventory refreshes on transfer
- [x] **+ From Catalog now sticks** — InventoryPanel was prop-driven from `c.data?.inventory`, but the parent's `entries` state was never patched on add/remove, so the item only existed in the DB and the UI showed stale data. Fix: `CharacterCard` now keeps a local `inventoryState` mirror (updates optimistically, rolls back on DB error) and fires a new `onInventoryChange` callback that the table page uses to patch `entries` so the change survives close/reopen without a `loadEntries` round-trip.
- [x] GM loot distribution modal — bulk give items to multiple players + auto-loot on crate destruction
- [x] NPC click opens pop-out window (not overlay), Edit button (✎) on roster card
- [x] NPC card always shows weapon info (name, damage, range) even without active session
- [x] Tab order: NPCs > Assets > Pins > Notes in tactical map mode
- [x] Katana added to weapon database (4+3d3, Rare, Unwieldy 1)
- [ ] Inventory migration — auto-convert old string equipment to structured items on load

### Vehicle System
- [x] VehicleCard component — WP bar, stress, fuel reserves, cargo manifest, operator notes
- [x] Vehicle pop-out page (/vehicle) — full two-column layout for second monitor
- [x] Realtime sync via Supabase postgres_changes
- [x] Editable by all campaign members (not just GM)
- [x] Cargo add/remove with quantity and notes
- [x] Operator notes editable
- [x] Floorplan image support
- [x] Vehicles folder in Assets tab
- [x] Pop-out hides sidebar (full-width layout)
- [x] SQL: campaigns.vehicles jsonb column + Minnie seed data

### Code Audit (2026-04-18)
- [x] CRITICAL: Grapple consumeAction awaited
- [x] CRITICAL: Charge validates active combatant before roll
- [x] CRITICAL: loadInitiative sequence guard (prevents stale turn order)
- [x] HIGH: Blast radius primary target check includes position fallback
- [x] HIGH: Canvas draw dependency array trimmed (5 volatile deps removed)
- [x] MEDIUM: Sprint/Stabilize/Unjam consumeAction awaited
- [x] MEDIUM: Custom item encumbrance clamped >= 0, null-safe calc
- [x] LOW: Animation frame cleanup on TacticalMap unmount
- [x] LOW: Portrait cache capped at 100 entries (LRU)
- [ ] DEFERRED: Split table page (5,365 lines) into subcomponents — high risk before game
- [ ] DEFERRED: Debounce realtime callbacks — works fine, optimization only
- [ ] DEFERRED: Sequence guards on loadRolls/loadChat — low impact

### Combat Audit (2026-04-20)
- [x] CRITICAL: Winded mechanic — activateUpdate() now used at all activation points (was hardcoded actions_remaining: 2)
- [x] CRITICAL: Sprint winded — finds combatant by name, not stale active entry
- [x] HIGH: PC turn skip — re-fetches fresh state from DB instead of stale entries closure
- [x] MEDIUM: Aim active warning — prominent "Aimed — Attack or lose it" badge
- [x] VERIFIED: Coordinate bonus persists through round, clears on re-roll (correct)
- [x] VERIFIED: Ready Weapon switch updates entries state correctly
- [x] VERIFIED: Stabilize consumes action on failure (correct per SRD)
- [x] VERIFIED: Charge cancel — token stays, no action cost (GM discretion)
- [x] **Player-initiated loot from ObjectCard (destroyed-only v1)** — players can open an ObjectCard for a destroyed crate (`wp_max > 0 && wp_current <= 0`) and click a per-item **Take** button; item lands in their own `character.data.equipment`, crate contents decrement, loot log entry written. Matches the existing CampaignObjects policy exactly. Follow-ups: `lootable` flag for pre-destroyed unlock, always-allowed policy, inventory-vs-equipment reconciliation (loot currently appends to legacy string[] equipment, not the new InventoryItem[] inventory).
- [x] **Lootable flag (GM-controlled unlock)** — new `scene_tokens.lootable boolean` column (`sql/scene-tokens-lootable.sql`). ObjectCard header for GM gets a 🔒 Locked / 🔓 Unlocked toggle (hidden when destroyed since destruction already opens contents). Players can Take items when `destroyed || lootable` is true; Contents header reflects state (Destroyed / Unlocked / Locked for GM, Loot for player). Remaining follow-ups: always-allowed policy, inventory/equipment reconciliation.
- [x] **GM Note image handouts — inline preview + lightbox** — shared GM notes already supported image attachments, but they rendered as 32×32 thumbnails with a filename link, useless for storytelling pages. New shared `NoteAttachmentsView` component renders images inline at full panel width (capped at 600px height), click-to-zoom lightbox at native resolution, non-image files stay as compact chips. Used by both `GmNotes` and `PlayerNotes`. Also added a realtime `campaign_notes` subscription to `PlayerNotes` so a GM toggling Share pushes the handout (or its updates) to players without a page refresh.
- [x] **Object Duplicate button** — new `Dup` button next to Edit in the GM's Assets → Objects panel. Clones the source `scene_token` row including portrait, color, WP (resets `wp_current` to full), `is_visible`, properties, contents, and `lootable`. Auto-suffixes name as `… (copy)`, `(copy 2)`, etc. so collisions can't happen. Spawns at top-left (1,1) per the token spawn rule. Broadcasts `token_changed` so the map and other clients see it.
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
- [x] **Kicked players no longer auto-rejoin on session restart** — removed the silent `UPDATE character_states SET kicked=false` in `startSession()`. Kick now persists indefinitely. Kicked player sees a red "Removed from Session" banner + green **Rejoin Session** button on the story overview page — clicking it clears their own `kicked` flag. Kick UPDATE now uses `(campaign_id, user_id)` + `.select()` so silent RLS failures surface as an alert instead of appearing to succeed.
- [x] **Kicked players excluded from initiative on combat start** — `confirmStartCombat` pulled combatants straight from `campaign_members` and bypassed the `character_states.kicked` filter that `loadEntries` applies. Fix: fetch kicked `user_id`s up front and filter `rawMembers` before rolling initiative so kicked PCs are never inserted into `initiative_order`.
- [x] **CDP awards** — GM bulk-award modal, selected players get CDP with a log entry
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
- [x] **Character progression log** — automatic events + manual journal entries per character
- [x] **Campaign snapshots** — GM save-point system. Capture full campaign state (NPCs, pins, scenes, tokens, notes, optional party states) into `campaign_snapshots` jsonb, restore in-place (same campaign id, same invite, same players). `lib/campaign-snapshot.ts` + `components/CampaignSnapshots.tsx` on edit page. Shares shape with Module System snapshot — Phase 5A reuse planned. Run `sql/campaign-snapshots.sql`.
- [x] **Default Assets tab = NPCs** (was Pins)
- [x] **Tab order in tactical map mode** — NPCs > Assets > Pins > Notes
- [x] **Edit button (✎) on NPC roster card** — accessible without the overlay
- [x] **NPC pop-out window from roster** — clicking NPC card opens pop-out instead of floating overlay
- [x] **NPC pop-out size standardized** — 607×357 with overflow:auto
- [x] **NPC card shows weapon inline** — name, damage, range, condition always visible
- [x] **Sprint log entry uses SPRINT header** (was "System")
- [x] **Move log attributes to mover**, not stale active combatant
- [x] **NPC damage realtime propagation** — broadcast fires, other clients converge (diagnostic logs retained)
- [x] **Custom GM icon** on player bar — `public/gm-icon.png`, fallback to GM text if missing
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
- [x] **Range circles on selected token** — clicking a PC/NPC auto-draws 3 circles: green Engaged, blue 9ft Move, red primary-weapon range. Object tokens (crates, cars, doors) never show range bands. Drawn under tokens so sprites stay crisp. Show/Hide Ranges toggle in GM strip.
- [x] **Range band circles REMOVED from tokens** — overlay drawing, Show/Hide Ranges button, `showRangeOverlay` state, and related constants all deleted from `TacticalMap.tsx`. Attack modal's auto range-band logic (`getAutoRangeBand` in page.tsx) still drives CMod + target filtering — just no canvas painting.
- [x] **ObjectCard loot (GM)** — Contents section shows per-item `Give to [PC]` dropdown + green `Give` button. Transfers one-at-a-time to the chosen character's equipment, decrements (or removes) the crate's quantity in `scene_tokens.contents`, logs `🎒 [name] looted [item] from [crate]` to roll_log. Works on intact crates — no need to destroy first.
- [x] **Object-token image library** — every uploaded image is saved to `object_token_library` (campaign-scoped, RLS: members read, GM insert/delete). Add + Edit object flows show "Or pick from library (N)" thumbnail strip for reuse. Run `sql/object-token-library.sql`.
- [x] **Image crop modal on upload** — new `ObjectImageCropper` component: drag-to-move + corner-resize (aspect-locked square). Output is 512×512 JPEG. Tokens render square, so pre-cropping prevents the old stretch.
- [x] **GM/player map alignment fix** — image size now derives from `image.naturalWidth × img_scale` (viewer-independent) instead of `container.clientWidth × img_scale` (viewer-dependent). Everyone sees pixel-identical positioning.
- [x] **Cols/Rows changes no longer resize the image** — grid and image are fully decoupled; Cols+ only moves the grid.
- [x] **Rescale Tactical Scenes tool** (`/tools/rescale-tactical-scenes`, Thriver only) — one-time migration that probes each scene's image naturalWidth and converts legacy container-based `img_scale` to the new baseline. Per-row + bulk rescale.
- [x] **Order box on Assets → Map Pins edit form** — parity with /map sidebar. GM sets explicit numeric `sort_order`; list resorts immediately on save.

---

## 🟡 Phase 4b — Communities, Recruitment, Morale (SRD §08)

**Full spec: `tasks/spec-communities.md`.** Implements XSE SRD v1.1 Community Resource & Morale Rules with Distemper Core overlay. Four-phase rollout — A is the foundation, each next phase adds a mechanic layer.

### Phase A — Foundation (DB + manual management) ✅
- [x] `communities` + `community_members` + `community_morale_checks` + `community_resource_checks` tables with RLS (`sql/communities-phase-a.sql`) — includes day-one Phase E columns (`published_at`, `world_visibility`, `world_community_id`) so the persistent-world migration is additive
- [x] `components/CampaignCommunity.tsx` — reusable panel with Create flow, member list grouped by role, % bars with SRD min/max thresholds, add/remove/role-change, soft-remove via `left_at`
- [x] **Sidebar: "My Communities" link** under "My Stories"
- [x] `/communities` index — grid grouped by campaign with status chip (Group / Community / Dissolved), member count, "N to Community" progress, GM badge
- [x] `/communities/[id]` detail page — mounts the CampaignCommunity panel scoped to the community's campaign
- [x] 13+ threshold auto-detection (Group → Community status badge)

### Phase B — Recruitment mechanic
- [ ] `Recruit` button on NPC card (GM + player)
- [ ] Recruitment modal — approach picker (Cohort / Conscript / Convert), skill auto-suggest, CMod preview
- [ ] First Impression integration (`npc_relationships.relationship_cmod` flows into Recruitment CMod)
- [ ] Outcome resolution → auto-insert `community_members` row per SRD table (Success / Wild Success / High Insight / Failure / Dire Failure / Low Insight)
- [ ] Apprentice toggle on Wild Success / High Insight — one Apprentice per PC, persistent bond
- [ ] Recruitment log entry in `roll_log` with custom card style

### Phase C — Morale + Resource checks (weekly loop)
- [ ] `community_morale_checks` table + `community_resource_checks` table + RLS
- [ ] Fed Check modal (Gatherers roll; outcome → CMod on next Morale)
- [ ] Clothed Check modal (Maintainers roll; same pattern)
- [ ] Weekly Morale Check modal — auto-fills 6 modifier slots (Fed, Clothed, Mood, Space, Clear Voice, Someone to Watch Over Me) + ad-hoc GM CMods
- [ ] Consequence application: Failure removes 25% members (weighted Unassigned → Cohort → Convert → Conscript, Apprentices last), Dire Failure 50%, cmod_for_next accumulates, consecutive_failures counter increments on failure / resets on success
- [ ] 3-failure dissolution flow with confirm modal + `status='dissolved'`
- [ ] Log cards for all three check types in `roll_log`

### Phase D — Activity Blocks + Level 4 skills + dashboard
- [ ] End Week button advances `week_number` (per-community)
- [ ] Inspiration Lv4 "Beacon of Hope" auto-applies +4 CMod to Morale Check when the rolling character has it
- [ ] Psychology* Lv4 "Insightful Counselor" auto-applies +3 CMod when the rolling PC has spent time in the community
- [ ] Conscription pressgang confirmation modal ("this is coercion, requires credible threat")
- [ ] `/stories/[id]/community` full-screen dashboard (GM): morale history graph, role health over time, recruitment success rate, members-by-recruitment-type breakdown
- [ ] Player-facing read-only Community summary (members count, current morale trend, their recruitment/apprentice bonds)
- [ ] Apprentice task delegation UI — GM assigns off-screen tasks during Activity Blocks

### Phase E — The Tapestry (Persistent World) 🚩 flagship differentiator
Communities become first-class entities in the Distemperverse. Every published community from every table shares one world.
- [ ] Day-one schema carries `published_at`, `world_visibility`, `world_community_id` on `communities` so Phase E is additive
- [ ] `world_communities` mirror table (sanitized public row: name, description, homestead lat/lng, size band, status, faction label, thriver_approved)
- [ ] Community "Publish to Distemperverse" toggle + Thriver moderation queue (reuse `map_pins` promotion pattern)
- [ ] World map overlay — published communities render with size-banded icons, status colors, click-to-open public card
- [ ] GM-to-GM contact handshake — "My campaign encounters Community X" notification + opt-in private-data reveal
- [ ] Trade / alliance / feud links (narrative edges between two published communities, drawn as colored arcs)
- [ ] Migration on dissolution — 3-failure collapse offers survivors to nearby published communities
- [ ] Schism — large communities split; one stays, one founds a new Homestead
- [ ] World Event CMod propagation — Distemper Timeline pins in a region apply CMods to all published communities in that region
- [ ] Per-community Campfire feed (weekly outcomes, schisms, dissolutions, GM-curated updates)
- [ ] Community subscription for players
- [ ] Campaign-creation wizard "Start inside/around an existing published community"

### Out of scope (see spec §12)
- Community-as-single-combat-entity (members still combat individually)
- Full trade-economy simulation (Phase E has narrative links only)
- Procedural community generation (GM-authored only)

---

## 🔵 Phase 5 — Module System 🚩 flagship content engine

**Full spec: `tasks/spec-modules.md`.** Supersedes the paused GM Kit v1 seed-table plumbing — unifies authoring (in-campaign), publishing (as a versioned jsonb snapshot), subscribing (campaign creation picks a module), and updates (opt-in diff/merge). Pairs with Phase 4b Communities (modules ship with pre-authored communities).

### Phase A — MVP publish + subscribe loop
- [ ] `modules` + `module_versions` + `module_subscriptions` tables with jsonb snapshots + RLS
- [ ] Publish wizard on campaign edit page — metadata, include/exclude content types, visibility (Private / Unlisted / Listed)
- [ ] Campaign creation third option: **Module** picker alongside Custom + Setting
- [ ] `cloneModuleIntoCampaign(version, campaign)` — transactional clone of snapshot into campaign_npcs/pins/scenes/tokens/notes
- [ ] Record `source_module_id` + `source_module_version_id` on cloned rows for Phase B update tracking
- [ ] Migrate existing Arena seed (`setting_seed_*` tables) into a `modules` row; deprecate seed tables

### Phase B — Versioning + updates
- [ ] Semver bump on publish (patch/minor/major), changelog field
- [ ] `/stories/[id]/modules/[id]/versions` history UI with diff summary
- [ ] Update notifications on subscriber dashboards
- [ ] Review modal — per-asset accept/reject diff, fork option, conflict resolver for locally-edited rows
- [ ] `edited_since_clone` flag on cloned content so updates skip customized assets

### Phase C — Marketplace
- [ ] `/modules` browse + search + filters (setting, tags, rating, subscriber count)
- [ ] `/modules/[id]` detail page with version history, reviews
- [ ] Listed-module Thriver moderation queue
- [ ] Cover image upload, featured-module surface on dashboard
- [ ] Play stats per module (subscriber count, session count, avg player count)

### Phase D — Monetization + tiers
- [ ] Free / Paid / Premium module pricing
- [ ] Licensed GM permission unlocks paid modules
- [ ] Author payout flow, referral tracking

### Phase E — Ecosystem
- [ ] GM Kit Export v2 = printable PDF + module zip from a module snapshot
- [ ] Module + Community cross-publish (depends on Phase 4b Phase E)
- [ ] In-session GM toolkit — scene switcher, NPC roster, handouts panel, roll tables linked to dice roller
- [ ] Third-party module import (Roll20 / Foundry → Tapestry module — stretch)

### Legacy GM Kit v1 (for reference)
- [ ] **GM Kit Export** — compile all assets for a campaign/adventure into a downloadable package: NPCs (with portraits + stats), map pins, tactical scenes + battle maps, handouts, object tokens, route tables, session notes. Include GM instructions/playbook. Export as PDF, ZIP, or shareable link. Could serve as the distribution format for published modules.
- [~] **GM Kit v1 — export + seed-import loop (DIRECTION UNCERTAIN, paused 2026-04-19)** — Shipped end-to-end: green `GM Kit` button on `/stories/[id]` (`lib/gm-kit.ts`, jszip) downloads a `gm-kit-<slug>-<date>.zip` with manifest, pins/npcs/scenes/tokens/handouts JSON, and an `images/` folder pulled from Supabase. `/tools/import-gm-kit` reads any kit zip and upserts into `setting_seed_*` tables; `/stories/new` and `/campaigns/new` then seed new campaigns with backgrounds + portraits + handout attachments intact (`sql/setting-seeds-extend.sql`). Wired to The Arena story option (`arena` setting key in `lib/settings.ts`). **Why paused:** image URLs in seeds still point to the source campaign's bucket — delete that campaign and seed images 404. Scene `tokens.json` round-trips through the kit but neither the seed schema nor the create flow ingests it (objects placed on tactical maps don't carry to new campaigns). Not yet clear whether the right answer is (a) re-upload kit images to a "shared seed assets" bucket on import, (b) treat seeds as live-linked to the source campaign, (c) abandon the seed approach and lean on a real Module data structure (Phase 5 line 1). **How to apply:** revisit before promoting any setting beyond personal beta use.

---

## 🔵 Phase 6 — Community & Retention

> Depends on Phase 4b Phase E shipping — Campfire feeds, subscription, and cross-community features hang off the `world_communities` layer.

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
- [ ] **Reactivate `/firsttimers` onboarding page** — file exists at `app/firsttimers/page.tsx` and remains reachable, but signup no longer auto-redirects new users to it (see `app/signup/page.tsx`, was disabled alongside the `/welcome` forced redirect in 2026-04-20 playtest fix #12). When the site is ready to onboard new users: change signup's fallback from `/dashboard` back to `/firsttimers`, and re-enable the `/dashboard` → `/welcome` redirect in `app/dashboard/page.tsx` (also commented-out under playtest #12).

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
- [x] GM quick-reference panel — pop-out /gm-screen with outcomes, CMod, range bands, combat actions, healing, skills→attrs
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
- [ ] **Roll20 Export** — one-way migration for GMs/players who want to take a campaign to Roll20. Accepts loss of Tapestry-specific features (tactical ranges, realtime, insight/stress automation). Three parts:
  1. **Minimal "Distemper" Roll20 character sheet** (HTML/CSS/sheet-worker JS): Rapid attrs → amod, skill table, weapons, WP/RP, one roll button per skill/weapon (`2d6 + @{amod} + @{skill_level} + @{weapon_cmod}`). Hosted in a Pro game or submitted to Roll20's public sheet repo.
  2. **Exporter in Tapestry** (GM-only): per-campaign ZIP download — `characters/<name>.json` (Roll20 Character Vault format: name, bio, avatar, attribs[], abilities[]), `npcs/<name>.json`, `handouts/` (scenes, pins, GM/player notes, cliffhangers), `manifest.json`.
  3. **Ingest paths**: Pro GMs drag JSONs into the Character Vault or run a small API script that batch-creates characters + handouts from the manifest; free-tier GMs paste bios into handouts and manually click "Create Character." Scope estimate: sheet ~2–4 days, exporter ~1 day, API import script ~half a day; add calendar time if submitting the sheet to Roll20's public library.

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
# Plan: Communities, NPCs, and Recruitment (Phase B)

**Status**: Drafted, awaiting review. Do NOT start implementing until user signs off.

**Source spec**: `tasks/spec-communities.md` §2 (Recruitment Types), §3 (Recruitment Check), §9a/9b (UI), §11 Phase B.

---

## Context summary (from codebase audit)

- **Phase A DB + UI shipped.** Tables (`communities`, `community_members`, `community_morale_checks`, `community_resource_checks`) + RLS + `CampaignCommunity.tsx` with create/manage/role-assignment UI all live.
- **Gap found**: `CampaignCommunity` is mounted at `/communities/[id]` only — NOT as a tab in the GM Assets panel on the table page. GMs have to leave the table to manage their community. This blocks mid-session recruitment UX.
- **Gap found**: `npc_relationships` table is used in code (First Impression CMod, reveal level) but has no SQL definition in `sql/`. Likely exists in Supabase from an untracked migration. Must confirm before Phase B leans on `relationship_cmod`.
- **Recruitment is wholly unbuilt.** `community_members.recruitment_type` column exists with type enum, but nothing writes the recruitment flow. NPC card has no "Recruit" button.
- **First Impression already writes `relationship_cmod`** via `npc_relationships` — the primary input Recruitment needs is already flowing.

---

## Plan phases

### Step 0 — Pre-work (unblockers) — ~30 min

- [ ] **0.1** Write `sql/npc-relationships-schema.sql` to formalize the existing table (check + reveal + add IF NOT EXISTS). Columns confirmed from code: `id`, `campaign_id`, `npc_id`, `character_id`, `relationship_cmod int`, `revealed bool`, `reveal_level text`, `created_at`, `updated_at`. Includes RLS: campaign members read, GM writes, player writes their own relationship rows.
- [ ] **0.2** Mount `CampaignCommunity` as a new tab in the table page's GM Assets panel. Add `'community'` to the `gmTab` union in `app/stories/[id]/table/page.tsx`. Add tab button next to Pins/NPCs/Assets/Notes. Render `<CampaignCommunity campaignId={id} isGM={isGM} />` when tab is active. Don't break the existing `/communities/[id]` standalone route — both should work.
- [ ] **0.3** Verify Phase A UI still works with the new mount point. Manual smoke test: create a community, add an NPC manually, remove, rename.

**Ship gate**: commit `chore: mount Community tab in Assets panel + formalize npc_relationships schema` before starting Step 1.

---

### Step 1 — NPC card "Recruit" button — ~45 min

- [ ] **1.1** Add `onRecruit?: () => void` prop to `NpcCard.tsx`. Button renders in the header row next to Edit/Close. Green outline styling. Only visible when `onRecruit` is provided (GM view, campaign has at least one community).
- [ ] **1.2** Wire the callback in `app/stories/[id]/table/page.tsx` (and wherever NpcCard is mounted — scan for all render sites). Clicking opens a new `<RecruitmentModal />`.
- [ ] **1.3** Gate the button: only shown when (a) the NPC is revealed to at least one PC AND (b) the NPC is not already in a `community_members` row (no duplicate membership). Query on modal mount; cache in `campaignNpcs` state if it already loads relationships.
- [ ] **1.4** Hide the button for PCs in `PlayerNpcCard.tsx` — recruitment is a GM action (for Phase B; spec §10 "Who can recruit" says GM-only in MVP).

**Ship gate**: commit `feat: NPC card 'Recruit' button — opens recruitment modal (empty shell)`.

---

### Step 2 — Recruitment modal: approach + skill picker — ~1 hour

- [ ] **2.1** New file `components/RecruitmentModal.tsx`. Props: `npc`, `campaignId`, `communities[]` (if multiple; modal starts with community picker if >1), `onClose`, `onRecruited`.
- [ ] **2.2** Step 1 UI: three approach cards (Cohort / Conscript / Convert) with flavor text from spec §2. Apprentice picked later as a toggle — it's not an approach, it's a modifier.
- [ ] **2.3** Step 2 UI: skill picker auto-suggests per approach (Cohort → Barter/Tactics, Conscript → Intimidation/Tactics, Convert → Inspiration/Psychology). Free-pick fallback for house-rule flex. SMod pulls from the roller PC's skills; AMod pulls from the PC's relevant RAPID (INF for most social).
- [ ] **2.4** Step 3 UI: CMod review. Auto-fills:
    - First Impression bonus = `npc_relationships.relationship_cmod` for the rolling PC vs this NPC (may be null/0 if never rolled First Impression).
    - GM freeform +/- CMod input.
  - Show running total below dice line.
- [ ] **2.5** Roller selection: defaults to the active combatant PC (if combat) or a PC dropdown (otherwise). GM can override.

**Ship gate**: commit `feat: Recruitment modal steps 1-3 — approach + skill + CMod preview`. Roll step still a stub.

---

### Step 3 — Recruitment roll + outcome table — ~1 hour

- [ ] **3.1** Add roll logic to the modal: 2d6 + AMod + SMod + CMod. Reuse `executeRoll`'s dice-rolling patterns; do NOT route through the main attack flow (Recruitment is a pre-combat / out-of-combat social check). A lighter standalone resolver inside the modal is fine.
- [ ] **3.2** Outcome mapping per spec §3:
    - 14+: Wild Success
    - 6+6: Moment of High Insight (overlay; still treat as Wild Success for join logic, unlocks Apprentice option)
    - 9–13: Success
    - 4–8: Failure
    - 0–3: Dire Failure
    - 1+1: Moment of Low Insight (overlay; dire-failure + escalation flavor)
  - Per-approach copy for each bucket (cohort/conscript/convert have different flavor strings — spec §3 table).
- [ ] **3.3** Outcome screen: dice animation → result banner (green/red/amber) → "Confirm" button that commits the outcome.
- [ ] **3.4** Commit success → INSERT `community_members` row:
    - `community_id` (selected community)
    - `npc_id` (the NPC being recruited)
    - `character_id` null (NPC member)
    - `recruitment_type` = 'cohort' | 'conscript' | 'convert' | 'apprentice' if toggle enabled
    - `apprentice_of_character_id` = roller PC if apprentice toggled
    - `role` = 'unassigned' (GM assigns later)
    - `joined_at` now, `joined_week` = community.week_number
- [ ] **3.5** Commit failure / dire failure → no DB write other than roll_log. Show flavor + "Close" button.

**Ship gate**: commit `feat: Recruitment roll + outcome + community_members insert`.

---

### Step 4 — Apprentice toggle + constraints — ~30 min

- [ ] **4.1** Apprentice toggle only rendered on Wild Success / High Insight outcomes. Spec §2: "Only 1 Apprentice per PC."
- [ ] **4.2** On toggle, INSERT sets `recruitment_type = 'apprentice'` + `apprentice_of_character_id = rollerPcId`.
- [ ] **4.3** Validation: query `community_members WHERE apprentice_of_character_id = <rollerPcId>`. If any exist, toggle is disabled with tooltip "PC already has an apprentice (<name>)".

**Ship gate**: commit `feat: Apprentice flag on Wild Success recruits — 1 per PC constraint`.

---

### Step 5 — Roll log integration — ~30 min

- [ ] **5.1** Write a `roll_log` row for every recruitment attempt. Outcome string examples:
    - Success: `Vera Oakes recruited Nolan Penn as Cohort`
    - Failure: `Vera Oakes failed to recruit Nolan Penn`
    - Dire: `Vera Oakes alienated Nolan Penn`
  - `outcome` column = `'recruit'` (new category; add to feed renderer styling).
  - `damage_json` carries `{ npc_id, community_id, recruitment_type, approach, skill_name }` for future auditing / Phase C recoverability.
- [ ] **5.2** Feed renderer: recruitment rows get a custom style card (green border for success, amber for failure, red for dire). Similar to `sprint` / `defer` / `loot` existing patterns.
- [ ] **5.3** compactRollSummary branch: narrative one-liner per approach. `Vera Oakes inspired Nolan Penn to join the Greenhouse` / `Vera Oakes failed to win Nolan Penn over`.

**Ship gate**: commit `feat: recruitment log entries + feed card styling`.

---

### Step 6 — First Impression integration polish — ~20 min

- [ ] **6.1** Verify Step 2.4 actually pulls `relationship_cmod`. If `npc_relationships` row doesn't exist for this PC+NPC pair, show a hint: "No First Impression yet — roll one from the NPC card for a CMod input."
- [ ] **6.2** If PC rolled First Impression *in this session* (no prior relationship row), cache it locally so the modal picks it up without a DB re-fetch.

**Ship gate**: commit `feat: Recruitment modal surfaces First Impression CMod prominently`.

---

## Testing plan (to `tasks/testplan.md` on implementation day)

1. **Happy path Cohort**: Revealed NPC → GM clicks Recruit → Cohort/Barter/+0 CMod → Success → NPC appears in community member list with "Cohort" label.
2. **Apprentice path**: Same but Wild Success → toggle Apprentice ON → insert sets apprentice_of_character_id.
3. **Apprentice cap**: PC already has an apprentice → toggle disabled with tooltip.
4. **Convert flavor**: Pick Convert → skill list narrows to Inspiration/Psychology → win the roll → recruitment_type = 'convert', not 'cohort'.
5. **Dire Failure**: Bad CMod → 1+1 → Moment of Low Insight card shown, no membership written, roll_log entry reads alienation.
6. **Multi-community selector**: Create 2 communities → open Recruit → step 0 shows picker.
7. **No community case**: Campaign with zero communities → Recruit button hidden on NPC card OR modal shows "Create a community first" CTA.
8. **Already-member guard**: Recruit a recruited NPC → button disabled OR modal shows "already a member".
9. **RLS**: Non-GM player tries to open Recruit → button not rendered; direct API call rejected by campaign_members policy.
10. **Feed log**: All outcomes land in roll_log with custom styling, compact line reads narratively.

---

## Decisions — locked by user

- **DECISION 1 — Community tab location**: BOTH. New tab in the GM Assets panel on the table page AND keep the standalone `/communities/[id]` route.
- **DECISION 2 — Who rolls Recruitment**: Always a PC. Roller picker in the modal lists all alive PCs in the campaign (not just the active combatant). No NPC rollers, no GM-side roll. (NPCs might recruit for their community later via GM proxy — that's a Phase D concern.)
- **DECISION 3 — Combat action cost**: No. Recruitment is out-of-combat only. Modal may open during combat but the roll does NOT advance the turn or decrement `actions_remaining`.
- **DECISION 4 — Manual Add kept**: Yes. Existing "+ Add Member" stays on `CampaignCommunity` for Founders and GM retcon.
- **DECISION 5 — Approach tooltips**: Single-sentence flavor for now. Revisit with deeper tooltip in a future polish pass (logged below).

### Follow-ups logged from these decisions

- [ ] **Polish** Deeper approach tooltip — "Why this approach?" with rules context (commitment duration, SRD references, when to pick each). Part of a future Communities UX pass, not Phase B MVP.
- [ ] **Phase D candidate** NPC-proxy recruitment — GM rolls on behalf of a Community's Leader NPC to recruit other NPCs. Needed if a community grows itself off-screen while PCs are elsewhere. Design dependency: Activity Blocks (Phase D).

---

## Out of scope (explicit non-goals for this round)

- Morale Checks (Phase C).
- Resource Checks — Fed / Clothed (Phase C).
- Activity Blocks + End Week flow (Phase D).
- Cross-campaign / Tapestry Layer publishing (Phase E).
- Apprentice task delegation (PC-via-proxy actions; Phase D).
- World map overlay for communities (Phase E).

---

## Review section — filled in AFTER implementation

*Not yet started.*
