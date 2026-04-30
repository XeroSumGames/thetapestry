# Tapestry — To Do & Backlog

## ✅ Shipped 2026-04-29 (UI Streamline + Modules curation + portrait/community polish)

- **Persistent GM nav across all sub-pages** — new `<StoryToolsNav>`
  shared button row (Launch / GM Tools / Edit / Snapshot / Sessions /
  Community / Share) mounted on `/stories/[id]/edit`, `/snapshots`,
  `/sessions`, `/community`. Active page is highlighted via
  `usePathname()`. Hub `/stories/[id]` keeps its richer button row
  (GM Kit, Publish Module, Archive, Delete) since those carry heavy
  modal state. Commit `af15ca1`.
- **Survivors portrait gallery rebalanced** — `/characters` tile
  container flipped from fixed-88px flex-wrap to CSS grid
  `auto-fill 1fr` so tiles stretch to fill each row. Kills the dead
  block on the right. Commit `af15ca1`.
- **Character sheet — Evolution button** — purple button between
  Inventory and Apprentice on every CharacterCard. For now it
  smooth-scrolls to the existing Progression Log block on the same
  card; will wire up to the real CDP Calculator when that ships.
  Commit `af15ca1`.
- **Auto-expand single community on /communities/[id]** — clicking a
  community in My Communities now drops you into the expanded
  accordion (Homestead / Leader / Roles / Members) instead of a
  collapsed header. New `initialOpenId` prop on `CampaignCommunity`.
  Commit `af15ca1`.
- **/modules sort_order curation** — `modules` table gets `sort_order`
  int column + index. Marketplace + Edit page query in `lib/modules.ts`
  now sort by `sort_order ASC NULLS LAST, created_at DESC`. Edit page
  exposes a numeric sort-order field. SQL: `sql/modules-sort-order.sql`
  pins the 5 setting modules in Xero's order
  (Empty=1, Chased=2, Minnie=3, Basement=4, Arena=5). Commit `d8eeb23`.
- **/modules EDIT button + cover upload** — Thrivers and module authors
  see EDIT alongside DELETE on each card. New page
  `app/modules/[id]/edit/page.tsx` lets the author upload a cover image
  to the `module-covers` Supabase Storage bucket and edit name /
  tagline / description / content_tags. Commit `8951b0f`.
- **MY STORIES streamline** — Enter renamed to **GM Tools**, dropped
  `target="_blank"` so it opens in the same tab, removed the **Clone**
  button entirely (publish-as-Module is the canonical clone path),
  pulled Snapshot management out of the Edit page into its own
  `/stories/[id]/snapshots`. Commits `84b831d`, this commit's prep work.
- **Settings list trimmed to 3** on `/stories/new` —
  Custom · District Zero · Kings Crossroads (Mall). The 5 deprecated
  setting slugs (Empty / Chased / Minnie / Basement / Arena) live on as
  published modules via the new Thriver migration tool
  `/tools/migrate-settings-to-modules`. Commits `70fa32f`, `b310ccd`,
  `197491d`.
- **Kings Crossing → Kings Crossroads rename** — real Delaware location
  is "Kings Crossroads" (Sussex County, near Greenwood). Full code
  rename across `lib/settings.ts`, `lib/setting-npcs.ts`,
  `lib/setting-pins.ts`, plus DB migration
  `sql/setting-rename-kings-crossroads.sql` (applied). Commit `b5f5602`.
- **Font swap — Barlow Condensed → Carlito (legibility)** —
  playtesters reported the narrow Barlow Condensed at 13px (the
  project's minimum inline font-size) was hard to read on UI labels,
  chips, and buttons. Carlito is the open-source metric-compatible
  clone of Calibri: wider letterforms, far more legible at small sizes.
  1,583 inline `font-family` references swapped across 91 files —
  inline JSX styles, Leaflet popup HTML strings, canvas `ctx.font`,
  double-quoted variants, and escaped-quote innerHTML. Body text keeps
  regular `Barlow`. Carlito now loaded via Google Fonts in
  `app/layout.tsx` (`Barlow+Condensed` removed from URL). Commit
  `0baea8c`.

## ✅ Shipped 2026-04-29 (combat correctness + perf + C2 extraction)
- **Grapple opposed-check tiers** — opposed checks now resolve by
  outcome tier ordering (Wild Success > Success, Failure > Dire
  Failure) instead of binary success-vs-success = tie. Fix per Xero's
  CRB read. Commit `4ebd57f`.
- **Player-side loot — Search Remains** — `🎒 Search Remains` button on
  `PlayerNpcCard` when displayStatus is dead/mortally wounded/uncon.
  New SECURITY DEFINER RPC `loot_npc_item` does atomic transfer +
  audit row in roll_log. SQL: `sql/loot-npc-item-rpc.sql`. Commit `11ddf77`.
- **Weapon jam persists** — Low-Insight jam now sets a `jammed: true`
  flag on the weapon slot so the Unjam (Ready Weapon) button stays
  available across renders. Commit `42291ba`.
- **Snapshot RESTORE auto-launches** — after a successful snapshot
  restore, the page jumps to `/stories/[id]/table` so the GM doesn't
  land on a blank screen. Commit `7c26a9d`.
- **Render-perf sweep** — `React.memo` on `TacticalMap`,
  `CharacterCard`, `NpcRoster` + new `useStableCallback` for the 11
  inline TacticalMap callbacks lifted out of the table page. Caveat:
  parent's call-site props for CharacterCard/NpcRoster still pass
  inline objects on every render — memo will fully kick in once those
  call sites are stabilized. Commit `743fa75`.
- **Mount-fetch parallelization** — 5 sequential await pairs
  (loadEntries, rollsFeed) collapsed into Promise.all. Commit `7930e3b`.
- **C2 InitiativeBar extracted** — 406-line component pulled out of the
  9300-line table page. Lives at `components/InitiativeBar.tsx`.
- **Auth Web-Lock contention** — codemod across 44 files migrating
  `supabase.auth.getUser()` → `getCachedAuth()`. Commit `67989ce`.
- **Distract redesign** — unified ATTACK ROLL modal + 30 ft Close-range
  gate + outcome scaling (Wild=both, Success=1, Dire Failure=Inspired+1)
  + object filter + auto-select pre-selected target + log line trim.
  Commits `c04650c`, `9218f86`, `2e15258`, `dea681d`, `931de35`.

## 🎯 From 2026-04-29 chat — roll-log clarity + modal unification + new-campaign bug

- [ ] **Empty-adventure module clone fails on null pin name.** Creating a new Empty (Chased-content) campaign currently throws `Campaign created but module clone failed: pins: null value in column "name" of relation "campaign_pins" violates not-null constraint`. Lives in `cloneModuleIntoCampaign` in `lib/modules.ts` — one pin row in the Empty/Chased module snapshot is missing `name`. Likely either (a) clone mapper expects `title` while DB column is `name` (or vice versa), or (b) the Thriver migration tool that published the Empty setting captured one source pin with `name: null`. Fix shape: defensive coalesce on the mapper + audit the published Empty module's snapshot for the offending row. Repro: `/stories/new` → Empty setting → Save. Recovery in the meantime: delete the half-seeded campaign.
- [ ] **Gut Instinct results presentation needs rework.** Tied to "how info is shared in roll logs" — current Gut Instinct rolls land in the standard roll modal + roll_log feed, but the *result framing* doesn't communicate what the player learned (or didn't) clearly. Needs design discussion: what's the canonical surface for "your gut says X" — narrative card in the feed? An overlay on the rolling PC's sheet? GM-only insight delivered via DM? This is about player comprehension, not mechanics — the formula (`Perception + Psychology/Streetwise/Tactics`) is fine.
- [ ] **First Impression → straight to roll modal.** Today First Impression has a separate pre-roll picker (target NPC + skill). Xero wants clicking First Impression on a revealed NPC card to **skip the picker** and dump straight into the main Attack Roll modal pre-populated with `INF + Manipulation/Streetwise/Psychology` and the NPC pre-targeted. Save: ~3-4 clicks per use. Same "roll-log clarity" theme as Gut Instinct.
- [ ] **Modal unification — Attack Roll modal is the gold standard.** Xero locked the canonical: every roll modal across the app should match the Attack Roll modal's shape (roll breakdown, target dropdown, CMod input, Insight Dice pre-roll + post-roll reroll). Modals to normalize: Stress Check, Breaking Point, Lasting Wound, Recruit, Stabilize, Distract, Coordinate, Group Check, Gut Instinct, First Impression. Likely needs a shared `<RollModal>` shell with slots for skill-specific bits (target type, outcome surface). High-value but invasive; scope as a multi-commit refactor before starting.

## 🎯 From 2026-04-27 Mongrels playtest (Xero's batch handoff)

Xero captured the following items mid-/post-playtest. Bugs first, then UX, then content, then long-term map features. Each is self-contained so an agent can pick one up cold.

> **Scheduled sweep:** the three combat-correctness items marked 🤖 below are queued for a one-shot remote agent on **2026-04-30T16:00:00Z** (Thursday 10am MT) — routine `trig_01DgrfRt5ymUuU4fUf2jzq8N`. The agent will triage what's already fixed, ship the rest, and check the items off itself. Don't grab them manually unless something blocks the playtest before then.

### Bugs (combat correctness)
- [ ] 🤖 **Distract didn't remove an action for the next round on Cree.** During playtest the Distract action fired and the log claimed `(lost 1 action)`, but Cree's `actions_remaining` did not decrement on his next round. `applySocialAction` ([app/stories/[id]/table/page.tsx:3320-3324](app/stories/[id]/table/page.tsx:3320)) does `supabase.from('initiative_order').update({ actions_remaining: newActions }).eq('id', targetEntryId)` with no `.select()` — silent RLS rejection plausible. Also no `turn_changed` broadcast is fired, so the change relies entirely on postgres_changes (which can lag and won't fire at all if the UPDATE was rejected). Fix shape: add `.select('id, actions_remaining')`, log a `SILENT RLS FAIL` warning when 0 rows return (mirror the `consumeAction` pattern at [:2009](app/stories/[id]/table/page.tsx:2009)), and broadcast `turn_changed` after the update so all clients refresh immediately. Likely RLS gap on `initiative_order` for non-owner updates — probably needs the equivalent of `sql/character-states-rls-fix.sql` for `initiative_order` so a GM can decrement another combatant's actions.
- [ ] 🤖 **Stabilize should consume an action.** Today the Stabilize button at [app/stories/[id]/table/page.tsx:5737-5757](app/stories/[id]/table/page.tsx:5737) calls `consumeAction(activeEntry.id)` *only after* the roll resolves, gated by the roll modal flow. Need to verify it actually decrements during a real Stabilize in playtest — user says it doesn't. The `actionPreConsumedRef.current = true` flag is set before `consumeAction` is awaited; check whether closeRollModal is bailing on the consume because of that flag. Fix the path so a Stabilize attempt always burns 1 action whether the roll succeeds or fails.
- [x] **Stabilize button should pick from ALL mortally-wounded characters in range, not just the first.** Shipped 2026-04-28 as `476989e` — `find` → `filter`, every wounded combatant within 20ft gets its own button, each with its own engaged check. Single-target case looks identical to before. Testplan: tasks/stabilize-multi-target-testplan.md.
- [ ] 🤖 **What happens to a character after Stabilize is used?** Cree didn't come back to life despite a successful Stabilize. The Stabilize success branch at [:4359-4360](app/stories/[id]/table/page.tsx:4359) sets `death_countdown: null` and `incap_rounds: <number>`, leaves `wp_current = 0`. Per SRD a stabilized character is unconscious-but-no-longer-dying, regains 1 WP when their incap timer expires (per the round-tick logic at [:1799](app/stories/[id]/table/page.tsx:1799)) — meaning Cree should wake up to 1 WP after `incap_rounds` of game time. Verify: (a) the Stabilize update actually persisted (no silent RLS fail), (b) `incap_rounds` was set to a sensible value, (c) the round-tick correctly bumped Cree's WP=0 to 1 when the timer expired (the recent Warren-bug fix [1e10d6f](https://github.com/XeroSumGames/thetapestry/commit/1e10d6f) added a guard that *blocks* WP=1 bump when `death_countdown > 0` — confirm that guard isn't now incorrectly blocking it for stabilized chars where `death_countdown` is null). Probable: this all works but Cree's player saw a stale view. Could also be a real regression from the Warren fix.
- [ ] **Lag on initiative — needs solo validation.** User will playtest alone with multiple combatants and confirm the perceived lag on turn advance. Earlier work shipped batched fetches in `nextTurn` (see [PLAYTEST_TODO.md:81](tasks/PLAYTEST_TODO.md:81) #32) but a long initiative chain may still feel slow. Look for: sequential awaits in `nextTurn` that aren't yet in `Promise.all`, missed indexes on initiative_order, the postgres_changes subscription firing extra unnecessary `loadInitiative()` rounds. Don't action until Xero confirms the symptom on his own machine.

### Bugs (visibility / permissions)
- [ ] **Hide NPCs — visibility data layer ✓, but reveal UX needs streamlining.** Shipped 2026-04-28 as `6da94e5` + `sql/campaign-npcs-hidden-from-players.sql`: `hidden_from_players` boolean column, replacement SELECT RLS, AFTER INSERT triggers on `scene_tokens` and `initiative_order` to auto-reveal on place / start-combat. Xero confirmed 2026-04-29 the data layer works as designed — but the reveal/hide flow has too many clicks during a live game. Three reveal paths today: (a) Place on Map button on a per-NPC roster row, (b) Fight (Add to Combat) button, (c) per-row Show button via NpcRoster.quickReveal. For a typical "ambush of 5 NPCs reveals as combat starts" the GM is clicking N+ times. Streamline ideas to discuss: a folder-level "Reveal all in this folder" button (NpcRoster already supports folder ops); a "Reveal selected" multi-select bar; making Start Combat's NPC picker auto-reveal everyone selected; or a single "Reveal entire campaign roster" panic button for sessions where hidden-by-default isn't worth the friction. Don't pick one without discussing — the right cut depends on how the GM workflow looks at the table.

### Rules / mechanics gaps
- [x] **Crossbow + bow should require a Reload / Ready Weapon between shots.** Shipped 2026-04-28 (earlier) as `03de984` — Attack button disabled when `ammoCurrent <= 0` on clip-tracked ranged weapons.
- [x] **Weapon DB SRD audit — confirm everything is there (Club is missing).** Shipped 2026-04-28 (Path A: rename + add + fix) as `179f883` + `769e3e4` + DB migration `sql/weapons-srd-rename.sql`. Findings: 5 entries had stats matching CRB weapons but wrong names (Bayonet/Bowie→Baseball Bat, Bat/Stick→Bullwhip, Cleaver→Club, Makeshift Cleaver→Makeshift Club, Compact Bow→Compound Bow). Plus 3 stat fixes (Machete range, Compound Bow range/rarity, Katana parens) and 3 new weapons (Black Powder Rifle, Mortar, Tranquilizer Gun). Audit: tasks/srd-weapons-audit.md. Cattle Prod 400% confirmed correct; RPG Launcher → Rocket Launcher rename + Flamethrower clip discrepancy still flagged in audit doc as open follow-ups.

### UX / friction
- [ ] **Streamline logging into missions.** Xero says login → join campaign → land in table is too many steps for players. Audit the player side of the flow today: `/login` → `/stories` → click campaign → click "Join Session" → `/stories/[id]/table`. Possible streamlines: deep-link straight to the active session if there's one running; auto-redirect from `/stories/[id]` to `/table` when the GM has a session active; preserve the last campaign in localStorage and offer a "Resume last session" tile on `/stories`. Discuss with Xero before shipping — the right cut depends on what specifically felt slow.
- [x] **Drag-to-bottom-left is blocked by a popup.** Shipped 2026-04-28 as `cf175f8` — TacticalMap toggles `body.dragging-token` while a token drag is in progress; globals.css disables pointer-events on `.drag-blocker` overlays. Both NotificationBell + MessagesBell dropdowns now carry the className. Notification position stayed locked at `left:10px` per the feedback memory.
- [x] **Map pinging is too clunky — make it easier.** Shipped 2026-04-29 — **Alt + left-click on an empty cell** fires a ping. Replaces both the press-and-hold (~600ms) and the Alt+double-click gestures, both of which felt clunky. Modifier keeps it deliberate — no accidental clicks fire pings. Token interactions on the cell still win.

### Long-term (map features, not for next sprint)
- [ ] **Dynamic lighting on the tactical map.** Player vision limited by light sources (torches, lanterns, sun) — areas outside the lit radius render fogged. Will need a lights layer on `tactical_scenes` (`{ x, y, radius, color }[]`), per-token visibility computed against light sources, fog-of-war canvas pass on the player side. Big feature; design separately when prioritized.
- [ ] **Doors on tactical maps.** Door tokens with open/closed state, blocking movement and (with line-of-sight) blocking vision when closed. New `door` token_type on scene_tokens with a `is_open boolean` field. GM toggles by clicking the token; player movement pathfinding respects closed doors.
- [ ] **Line of sight on tactical maps.** Visibility blocking (walls, large objects, closed doors) hides tokens beyond the wall from the player's view. Probably implemented as a polygon vision mask per token, recalculated on token move. Heavy lift — pairs naturally with dynamic lighting since they share the visibility pipeline.

## 🎯 Next up (post-combat sprint)
- [x] **NPC inventory — primary & secondary weapons should count toward encumbrance.** Shipped 2026-04-28 as `e6199bc` — NpcCard was passing empty strings to InventoryPanel for the weapon names; now pulls them off `npc.skills.weapon.weaponName` / `npc.skills.weapon2.weaponName`. InventoryPanel + computeEncumbrance were already correct, just being fed nulls.
- [x] **Player-side loot — Search Remains button on the NPC popout.** Shipped 2026-04-29 as `11ddf77` — `PlayerNpcCard` shows "🎒 Search Remains" when `displayStatus !== 'active'`; new SECURITY DEFINER RPC `loot_npc_item` does atomic transfer + audit row in roll_log. SQL: `sql/loot-npc-item-rpc.sql`.
- [ ] **Insight Die spend — track on roll_log for full extended-log fidelity.** Shipped 2026-04-27 a partial callout: extended log shows "🎲 Insight Die spent — pre-rolled 3d6 (kept all three)" when `die2 > 6` (the 3d6 path packs d2+d3 into die2; sum > 6 is unambiguous). Two gaps: (1) 3d6 rolls where d2+d3 ≤ 6 (~17% of cases) escape detection, (2) the `+3 CMod` Insight Die spend can't be distinguished from organic CMod at all. Long-term fix: add an `insight_used text` column to `roll_log` (NULL / '3d6' / '+3cmod'), populate from `executeRoll` (and reroll path), surface in the extended-log card. Migration is non-destructive (NULL default), code path needs to thread `insightUsed` arg through `saveRollToLog`. (Parked 2026-04-27 mid-playtest; ship the schema + reliable detection after the session.)
- [x] **Stale realtime subscriptions — table tab needs manual refresh after backgrounding.** Shipped 2026-04-28 as `607342d` — visibilitychange listener on the table page + useChatPanel + useRollsFeed re-runs the load functions on hidden→visible. State refetch only in v1; channel rebuild deferred until/if state-only proves insufficient (supabase-js handles socket reconnection internally on health checks). Testplan: tasks/realtime-visibility-refetch-testplan.md. Also covered later by useRollsFeed extraction (B2.2) which carries the same handler.
- [x] **SRD wording sweep — replace user-visible "SRD" with "the rules"** — shipped 2026-04-28 as `84027d4`. 8 user-visible hits swapped: CommunityMoraleModal leader-not-set banner + 4 tooltips, CampaignCommunity Assigned-NPCs hint + Re-balance Roles tooltip, stories/[id]/community quota-tick tooltip. gm-screen `XSE SRD v1.1` header left as a system-version banner pending Xero's call. Code comments referencing SRD as a source remain (authoring notes).
- [ ] **King's Crossing Mall — tactical scenes** — author battle maps for the mall complex (motel courtyard, Costco interior, gas station, Belvedere's etc.) and wire into `SETTING_SCENES.kings_crossing_mall` in `lib/setting-scenes.ts` using the same filter-from-CHASED_SCENES pattern as the pins + NPCs.
- [ ] **King's Crossing Mall — handouts** — port any in-world broadcasts, journal pages, or ham-radio transcripts that fit the persistent mall setting into `SETTING_HANDOUTS.kings_crossing_mall` in `lib/setting-handouts.ts`. Mirror the filter-from-CHASED_HANDOUTS approach.
- [ ] **Re-seed an existing campaign with a setting's content** — currently seeding fires once at campaign creation, so any campaign created before a setting's pins/NPCs land has nothing. Build a Thriver/GM tool (`/tools/reseed-campaign?id=…`) that re-runs `SETTING_PINS` / `SETTING_NPCS` / `SETTING_SCENES` / `SETTING_HANDOUTS` against an existing campaign id, with name-collision skipping so it's idempotent. Until this lands, the workaround is "create a new campaign" or hand-write SQL.
- [x] **Community leader "step down" mechanism** — shipped 2026-04-23. PC leader or GM sees a "Step Down" button next to the Leader dropdown; picker offers Auto (next founder → longest-tenured), Leave Leaderless, or any specific member. `handleRemoveMember` now auto-promotes the same way when the outgoing member was the leader, so leaving the community also triggers succession.
- [x] **"Assigned" role — mission/task linkage** — shipped 2026-04-23. Schema: `assignment_pc_id uuid` on community_members (FK to characters, ON DELETE SET NULL) + reuses `current_task` from the Apprentice migration. UI: picking "Assigned" on the role dropdown opens a modal for director PC + task text; save writes all three fields in one update; cancel leaves the role unchanged. Display: assigned rows mirror Apprentice rows — `<NPC> ⇐ <PC>` name + "Task: <text>" line with GM-edit ✎. Flipping role OUT of 'assigned' auto-clears assignment_pc_id + current_task. PC-deletion silently clears via FK. SQL: `sql/community-members-add-assignment-pc.sql`.
- [ ] **Destroyed-object portrait swap** — object tokens with WP should optionally carry a `destroyed_portrait_url`; when the token hits 0 WP, the canvas renders that image instead of the intact one. Falls back to the current shatter-crack overlay if no destroyed art exists. Upload UX lives on the object add/edit form in NpcRoster → Objects.
- [ ] **CMod Stack reusable component** — user loved the itemized CMod Stack on the Recruit modal; extract into `<CmodStack>` and use in Grapple, First Impression, main Attack modals.
- [ ] **GM force-push view to players** — when the GM switches view (campaign world map ↔ tactical map, or scene A ↔ scene B), they should be able to push that view change to every connected player so everyone follows along automatically. Today there's `tactical_shared` / `tactical_unshared` broadcasts on `init_${id}` that toggle the tactical-map pane on the player side, but no general "switch to scene X" or "switch to campaign view" push. Likely shape: extend the `tactical_shared` broadcast (or add a new `view_changed` event) carrying `{ view: 'campaign' | 'tactical', sceneId?: string }`; player TacticalMap activates the matching scene + opens/closes the pane to match. GM side: a "Sync to players" toggle (or always-on) + auto-fire on scene-switch in TacticalMap setup.
- [ ] **Tapestry-side `<t:UNIX:format>` renderer** — the Timestamps tool at `/campfire/timestamp` outputs Discord-style `<t:UNIX:format>` tokens that work natively on Discord. To make them auto-localize on Tapestry posts (LFG, Forums, War Stories, Messages, Notes), build a small content-renderer utility that detects the token pattern and replaces it with a `<time>` element formatted in the viewer's local timezone. Hook it into every surface that displays user-typed content. Format codes are `t / T / d / D / f / F / R` per Discord spec — replicate the same `Intl.DateTimeFormat` options used in the generator's preview column for consistency.
- [ ] **Character Evolution / CDP Calculator** — post-creation character growth tool. Characters earn CDP (Character Development Points) over time (per-session awards, session arcs, milestones) and spend them to raise RAPID attributes, raise/acquire skills, take Traits, etc. Today the character creation funnel (`/characters/new` Backstory, `/characters/quick`, `/characters/random`) handles the CDP spend at character-creation time only; there's no surface for spending earned CDP afterward. Build a `/characters/[id]/evolve` (or modal on the character sheet) that: (1) shows the character's current CDP balance from `data.cdp` (already tracked), (2) lists buyable upgrades per the rules — attribute raises (cost = current value × multiplier), skill raises (cost = next-level cost), new trait picks (cost depends on tier), (3) previews the cost before commit, (4) applies the spend in one transaction (decrement `data.cdp`, write the changes, append a `roll_log` entry with `outcome='evolution'` so the table feed surfaces it). Reuse the wizard's CDP cost tables — they're already in `lib/xse-engine.ts` / wizard step components; extract into a shared helper if needed. Player-facing tool, GM doesn't need to approve (CDP is GM-awarded already, spend is the player's call). Audit log entry covers the GM oversight surface.
- [ ] **GM Tools → Restore to Full Health is slow** — clicking RESTORE on the multi-target Restore modal (with 11+ targets selected — PCs + NPCs + Objects) takes "FOREVER" per Xero's 2026-04-29 playtest. The handler likely fires N sequential UPDATEs (one per target — character_states for PCs, campaign_npcs for NPCs, scene_tokens for Objects) and awaits each. With 11 targets that's 11 round-trips serialised. Fix shape: batch the UPDATEs by table — one UPDATE per table with `.in('id', ids)` for each kind, run all three concurrently via Promise.all. Same RLS guarantees, ~10× fewer round-trips. Probably lives in `app/stories/[id]/table/page.tsx` near the GM Tools restore handler — search for the Restore modal callback. Add a "Restoring…" disabled state + spinner on the button so the GM gets feedback during the await.
- [x] **Restore from snapshot auto-launches into that snapshot** — shipped 2026-04-29 as `7c26a9d` — `CampaignSnapshots.tsx` now `window.location.href`'s to `/stories/<id>/table` after a successful restore so the GM lands directly on the scene.
- [x] **`/modules` Thriver-delete + clear test modules** — shipped 2026-04-29: Thriver-only DELETE chip on each `/modules` card (also gated to module author); confirmation modal in place. Test-module bulk-clear handled by Xero via the new chip.
- [x] **Phase C Communities** — weekly Morale Check + Resource Checks (Fed/Clothed) shipped 2026-04-23. Activity Blocks + Lv4 skill auto-CMods deferred to Phase D.

## 🔒 Backburner — Thriver godmode UI sweep
**Status:** DB-level done, UI deferred. Xero's `profiles.role = 'Thriver'` + the policies in `sql/thriver-godmode-policies.sql` + `sql/campaign-pins-rls-thriver-bypass.sql` give superuser access at the database layer. The UI still hides admin affordances (add/edit/delete/scene-setup/session-control) behind `isGM` checks, so Thrivers can only see those buttons on campaigns they actually GM. Pilot (commit fd5db34) widened 3 components (NpcRoster / TacticalMap / CampaignCommunity) but was rolled back — user wants to hold until the whole surface is done in one pass.

When picking this back up:
- [ ] UI sweep: every `isGM && <button ...>` in the app widens to `(isGM || isThriver) && <button ...>`. Candidates:
  - Table page header: Start/End Session, Start/End Combat, Tactical Map toggle, Share Map, GM Tools dropdown
  - NpcRoster (add/edit/delete NPCs, folders, objects, place-on-map)
  - TacticalMap (scene picker, setup, token placement)
  - CampaignCommunity (delete community, approve pending, set leader)
  - CampaignPins / CampaignObjects / VehicleCard
  - Character sheet edits for non-owned PCs (GM-only today)
- [ ] Pattern: prefer widening at the caller (`isGM={isGM || isThriver}`) over rewriting every internal reference — faster and keeps child components prop-clean.
- [ ] Verify after the sweep: log in as Xero on a campaign they don't GM, confirm every admin affordance is visible and actually works (RLS + UI both honor it).

*Inventory migration removed 2026-04-21 — DB audit confirmed every character's `data.inventory` is already an array. Nothing to migrate.*

## ✅ Shipped 2026-04-25/26 (player UX polish)
- **Tactical map view persists across page refresh** — per-campaign `localStorage` key `tactical_map_view_<id>`. `useState` function initializer reads it on mount; a `useEffect` writes the latest value, so every transition path stays in sync (GM share broadcast, combat_ended, GM toggle, player going back to campaign map). Players who refresh during the tactical view stay there instead of snapping back to the world map. Commit 6214a33.
- **DM messages auto-linkify URLs** — the campaign-invite DM body said "Tap to join: https://…" but the URL was rendered as plain text — uncopyable on mobile, unclickable everywhere. Added `linkifyBody()` helper in `app/messages/page.tsx` that splits on http(s) URL boundaries and emits `<a target="_blank" rel="noreferrer">` for each chunk. Applies to every DM, not just invites. Commit e541fa5.
- **Player NPC popout is 140×140** — GM keeps the 571×257 default (full NpcCard is dense). Player popout opens the read-only PlayerNpcCard (portrait + name + 2 badges + close), so 257px height was mostly empty. Two reachable-by-player paths pass `{ w: 140, h: 140 }` when `!isGM`. **Plus** a `window.resizeTo()` on mount inside `app/npc-sheet/page.tsx` because Chrome remembers per-window-name geometry — without it, a popout that was ever opened at the larger size stays large. Commits 100f738, this commit.
- **Retention Check — drop SRD reference + skill picker** — copy now reads "to salvage fragments" (no rule citation). Leader sees an inline skill picker + SMod field next to the Attempt button on the Result stage; defaults to whatever drove the failed Morale roll, swappable. Commit 6007832.
- **`/campfire` warmer tagline** — "The meta layer — connect with players, GMs, and visitors across campaigns." → "Take a seat. Here you can connect with players, GMs, and visitors outside of campaigns." Commit f3703c3.
- **Copy nits** — "Roles are already at SRD minimums" → "their minimums" (commit 492fede). `/creating-a-character`: "the SRD does not allow banking" → "the rules do not allow banking" (commit 7a4d5d7).

## ✅ Shipped 2026-04-24 (Tapestry rebrand + Communities polish)
- **Brand taxonomy enforced** — every user-visible "Distemperverse" reference in CampaignCommunity rewritten to "Tapestry" (publish strip, button, modal copy, unpublish confirm, sub-headings, recruit-offer count). Memory `project_brand_taxonomy.md` records the rule: DistemperVerse = umbrella IP (game + comics + platform), Tapestry = the platform itself; cross-campaign features always = Tapestry. Code comments scrubbed too — zero `Distemperverse` strings left in any .ts/.tsx (commits 141ac1c, af6bd29).
- **Player self-leave Communities** — red-bordered "Leave" button on a player's own PC row, distinct from the GM's "Remove" ×. Soft-leaves via `community_members.left_at` with `left_reason='self'`. New RLS policy `Player leaves own community row` (`sql/community-members-self-leave.sql`) lets a campaign member soft-delete only their own PC's row. Commit bc997c8.
- **delete-user edge function — full table + storage sweep** — fixed npc_relationships bug (was keying on user_id instead of character_id, always a no-op); added explicit cleanup for newer campaign-scoped tables (player_notes, campaign_notes, campaign_snapshots, object_token_library, tactical_scenes, communities); recursive storage-bucket sweep across pin-attachments, note-attachments, object-tokens, campaign-npcs, tactical-maps, session-attachments per owned campaign. Auth deletion last so partial failures don't strand orphan auth rows. Needs `npx supabase functions deploy delete-user --project-ref jbudzglgtxeoaufpejrv`. Commit 842b9f3.
- **Pin date dropped from expanded card** — `By <username> · Apr 7, 2026` → just `By <username>`. world_event pins still show `event_date` (in-world date, useful). Commit 8e50cc6.
- **"Published Communities" → "Player Communities"** — synthetic folder label in the MapView pins panel reads better for a ghost reader. Commit 612cc7b.
- **Community size_band retaxonomy** — old Small/Band/Settlement/Enclave/City scale → new Group/Small/Medium/Large/Huge/Nation State (Group <13, Small 13–50, Medium 51–150, Large 151–500, Huge 501–1000, Nation State 1000+). Updated `computeSizeBand`, MapView marker dot ramp (20→40px), and the world_communities CHECK constraint. One-shot migration `sql/world-communities-size-band-retaxonomy.sql` recomputes each row from live member count, falls back to label-swap when source is gone. Default bumped to 'Group'. Commit 0cbeb8e.
- **`notify_world_community_public_update()` array_append fix** — latent bug: trigger used `text[] || 'literal'` which Postgres parses ambiguously and fails with `22P02 malformed array literal`. The retaxonomy was the first UPDATE to ever change `size_band` on existing rows, surfacing it. Replaced with `array_append`. Inline fix in `sql/world-communities-update-notify.sql`; live-environment patch in `sql/world-communities-update-notify-fix.sql`. Commit f459e72.
- **Sidebar version chip v1.0 → v0.5** — aligns with the actual phase coverage. User will step it forward as Phase milestones complete. Commit e969aca.
- **Copy polish** — "Roles are already at SRD minimums" → "their minimums" (commit 492fede). `/creating-a-character` step copy: "the SRD does not allow banking" → "the rules do not allow banking" (this commit).

## ✅ Shipped 2026-04-23 (Mall setting wiring + small polish)
- **King's Crossing Mall — NPC seed wired** — added `KINGS_CROSSING_MALL_NPCS` as a filtered subset of CHASED_NPCS (12 names: Robertsons, Ortizes, Pastor Nick, Eric, Macy, Mikey, Art Buchanan) plus Maddy Bell + Troy & Mark Bell as post-Chased survivors. Wired into `SETTING_NPCS.kings_crossing_mall`. Single source of truth, so Chased stat tweaks propagate. Connors intentionally excluded — Chased-only antagonists. Commits c5b62f3, 4de722e.
- **King's Crossing Mall — pin seed wired** — `KINGS_CROSSING_MALL_PINS` filters CHASED_PINS by title for the 7 mall complex pins (Best Nite Motel, Belvedere's, Drop By, Costco, Tri-State Firearms, Swiss Tony's, RoadCo) plus Georgetown reference pin. NPC pin_title references resolve correctly in the Mall setting now. Commit ca28029.
- **NPC auto-file to "Community Members" folder** — Postgres trigger on `community_members` INSERT moves `campaign_npcs.folder` to 'Community Members' if currently unfiled (preserves custom folders). Backfill at the bottom files currently-recruited unfiled NPCs immediately. Apply `sql/npc-folder-auto-community-members.sql`. Commit 7c650bc.
- **Minnie floorplan replaced** — hand-drawn PNG (2 MB) swapped in for the small reference photo. `sql/minnie-floorplan-update.sql` updated to `.png` and re-run-safe. Commit 885230a.
- **Mall scenes/handouts/reseed-campaign tool added to TODO** — currently in the Next-up list (Phase E preparation work). Commit c231c11.

## ✅ Shipped 2026-04-23 (Communities Phase D — Activity Blocks + Dashboard)
**NOTE:** The Lv4 Morale auto-CMods that originally shipped in this batch (Inspiration "Beacon of Hope" +4, Psychology\* "Insightful Counselor" +3) were reverted on the same day — Xero's ruling is Lv4 Traits ship together with the full list or not at all. See `memory:project_lv4_traits.md`. The entries below are what remains live.
- **Skip Week button** — secondary "Skip Week" on the Weekly Check strip advances `week_number` without rolling. Pure clock bump, no consequences; Mood still carries from the last actual check.
- **Pressgang confirmation** — Conscript approach on the Recruit modal now shows a red "pressure, not persuasion" warning banner at pick stage, plus a blocking confirm() at submit. Cancel returns to pick without burning Insight Dice.
- **Community Dashboard** — new GM-only route `/stories/[id]/community`. Community picker + Morale history (last 20 weeks) + resource history (last 40 rolls) + current role distribution with SRD-minimum threshold markers + recruitment stats by approach + member-type breakdown. Community ▾ → Dashboard entry links to it.
- **At-a-Glance block** — inside each expanded community body: Recent Morale trend chips (W/H/S/F/D/L letters, last 5 weeks) + "You" row showing the viewer's role, Apprentice bond, and NPCs they recruited. Visible to everyone; primary view for non-GMs.
- **Apprentice task delegation** — `community_members.current_task` text column. Apprentice rows render a "Task: <text>" line with GM-edit ✎; no task + GM → "+ Assign task" dashed button. Edit-in-place with Enter/Escape keyboard handling. SQL: `sql/community-members-add-current-task.sql`.

## ✅ Shipped 2026-04-23 (Communities Phase C — Weekly Morale loop)
- **Weekly Check modal** — `components/CommunityMoraleModal.tsx`. Single-button rolls Fed → Clothed → Morale in sequence. GM sees per-roll AMod/SMod/CMod inputs + 6 auto-filled Morale slots with override inputs (Mood from prior check's cmod_for_next; Enough Hands / Clear Voice / Safety computed mechanically; Fed + Clothed snap to actual rolled outcomes; Additional freeform). Result stage shows each roll, slot breakdown, departures / dissolution, then "Finalize & Save" commits everything in a single batch (cancel leaves DB untouched).
- **Community logic extracted** — `lib/community-logic.ts` — pure helpers for CMod slot math, outcome → next-Morale CMod, outcome → departure %, weighted NPC departure picker (Unassigned → Cohort → Convert → Conscript → Founder → Apprentice), roll classification.
- **Consequence engine** — Failure 25% / Dire Failure 50% / Low Insight 75% leave; PCs never auto-removed. `consecutive_failures` ticks on any failure tier, resets to 0 on any success tier. `week_number` bumps on finalize. 3rd consecutive failure flips community to `status='dissolved'` + `dissolved_at=now`, all members soft-removed with reason='dissolved'.
- **New left_reason 'morale_75'** — `sql/community-members-add-morale-75-reason.sql` widens the CHECK constraint. Modal falls back to 'manual' if the migration hasn't been applied yet.
- **Roll-log custom cards** — `fed_check` / `clothed_check` / `morale_check` render as colored cards in the Logs tab with slot breakdowns, departure names, consecutive-failure counter, and a red dissolved variant. compactRollSummary narrative falls back to the stored label for the Both tab.
- **"Run Weekly Check" gate** — button only renders for the GM on `status='active'` communities with ≥13 members. Shows week number + consecutive-failure count; flashes red "one more failure dissolves" warning at 2/3.

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
- [~] **NPC health as narrative feeling** — *DEFERRED 2026-04-26 → long-term review list. User decided not to ship as currently scoped (narrative state strings replacing pip numbers for non-GM). Re-open if a different framing comes up.*

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
- [ ] **Overhaul "What They Have" / Weapons + Equipment step** — current layout is unwieldy AND only includes Melee + Ranged. Missing Heavy Weapons, Demolitions, Explosives, and any future weapon categories. Redesign:
  - Tabbed or filtered category picker covering ALL weapon families (Melee / Ranged / Heavy / Explosives / etc.)
  - Search across the full weapon catalog
  - Compact card / row layout — fewer dense fields per item, cleaner secondary stats
  - Equipment side gets the same treatment (categorized, searchable)
  - Stays compatible with Paradigm + Random flows that pre-seed weapons
  - QoL captured 2026-04-30; not blocking anything but every character creator hits this surface
- [ ] **Clean up Weapons/Equipment page** — superseded by the overhaul above; keep the entry until the overhaul ships then collapse
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

### Phase C — Morale + Resource checks (weekly loop) ✅ 2026-04-23
- [x] `community_morale_checks` table + `community_resource_checks` table + RLS (already landed in Phase A migration)
- [x] Fed / Clothed / Morale rolled together in a single **Weekly Check modal** (`components/CommunityMoraleModal.tsx`) — NPCs assumed reasonable proficiency, GM adjusts A/S/CMod per roll, single "Run Weekly Check" fires all three rolls sequentially
- [x] Morale auto-fills all 6 SRD slots — Mood (from prior week's cmod_for_next), Fed + Clothed (snap to actual rolled outcomes), Enough Hands (mechanical − 1 per understaffed role group, max −3), A Clear Voice (0 with leader, −1 leaderless), Someone To Watch Over Me (+1 ≥10% Safety, −1 <5%); GM override on any slot + Additional freeform CMod
- [x] Consequence application: Failure 25% / Dire Failure 50% / Low Insight 75% leave, weighted priority Unassigned → Cohort → Convert → Conscript → Founder → Apprentice, PCs never auto-removed; `consecutive_failures` +1 on failure / reset to 0 on success; `week_number` increments on finalize
- [x] 3-consecutive-failure dissolution — Result stage flips to a red "Finalize — Dissolve Community" button, all members soft-removed with reason='dissolved', community flips to status='dissolved'
- [x] Custom roll_log cards for `fed_check` / `clothed_check` / `morale_check` with slot breakdown + departure list + dissolve warning; compactRollSummary narrative for the Both tab
- [x] New SQL migration `sql/community-members-add-morale-75-reason.sql` widens left_reason CHECK to include 'morale_75' for the Low Insight drop
- [x] Retention Check on 3rd failure (SRD §08 p.22) — fast-acting leader gets an immediate salvage Morale Check using the failed Morale's cmod_for_next as the Mood CMod. Inline on the Result stage: "🙏 Attempt Retention Check" button appears when willDissolve=true, uses the leader's current AMod/SMod + skill pick. Success of any tier saves the community (consecutive_failures drops to 2); failure tiers let dissolution proceed. Custom `retention_check` roll-log card.

### Phase D — Activity Blocks + dashboard ✅ 2026-04-23 (Lv4 items deferred)
- [x] "Skip Week" button on the Weekly Check strip advances `week_number` without rolls (Activity Block off-screen time)
- [x] Conscription pressgang — red warning banner on pick stage + blocking confirm() on submit ("this is coercion, requires credible threat")
- [x] `/stories/[id]/community` full-screen GM dashboard: Morale history (last 20), resource history (last 40), role distribution with SRD minimum markers, recruitment stats by approach, member breakdown by recruitment_type. Community ▾ → Dashboard links to it.
- [x] At-a-Glance block inside each expanded community body: Recent Morale trend chips (last 5) + "You" row showing viewer's role, Apprentice, and their recruited NPCs. Visible to everyone.
- [x] Apprentice task delegation — `community_members.current_task` freeform text, GM-editable inline on apprentice rows. Display: "Task: <text>" with ✎ edit. No task + GM → "+ Assign task" affordance. SQL: `sql/community-members-add-current-task.sql`.

**🔒 Lv4 Skill Traits system — FULLY BACKBURNER (Xero 2026-04-23, reinforced)**
Every skill gets a Trait at Level 4, but the full list isn't written. Xero's ruling: **ships together or not at all — no piecemeal.** The two CRB-defined Morale bonuses (Inspiration "Beacon of Hope" +4, Psychology\* "Insightful Counselor" +3) were shipped in `03d8767` and then reverted on the same day to enforce this rule. Until the authoritative list lands, the GM stuffs any Lv4 bonus into the Morale "Additional" slot manually. Pending:
- [ ] Inspiration Lv4 "Beacon of Hope" auto +4 to Morale (awaiting full list)
- [ ] Psychology\* Lv4 "Insightful Counselor" auto +3 to Morale (awaiting full list)
- [ ] Generic Lv4 Trait surface on the character sheet
- [ ] Auto-application hooks for any other Lv4 Trait that touches Morale / Recruitment / Fed / Clothed / combat

### Phase E — The Tapestry (Persistent World) 🚩 flagship differentiator
Communities become first-class entities in the Distemperverse. Every published community from every table shares one world.
- [x] Day-one schema carries `published_at`, `world_visibility`, `world_community_id` on `communities` (`sql/communities-phase-a.sql`)
- [x] `world_communities` mirror table (`sql/world-communities.sql`) — sanitized public row with size band, public status, faction label, moderation_status
- [x] Community "Publish to Tapestry" toggle on `CampaignCommunity.tsx` (line 1972) + handlePublish at :883 + Thriver moderation queue at `app/moderate/page.tsx` (`sql/world-communities-moderation-notify.sql`)
- [x] World map overlay — published communities render via `MapView.tsx` with size-banded icons (radius 20→40px on size band)
- [x] GM-to-GM contact handshake — `community_encounters` table + 🤝-button on world-map community cards + notification metadata jsonb (`sql/community-encounters.sql`)
- [x] Trade / alliance / feud links — `world_community_links` with two-way consent, color-coded polylines on world map (`sql/world-community-links.sql`)
- [x] Migration on dissolution — `community-migrations` table + autocopy migration tooling lets survivors land in nearby published communities (`sql/community-migrations.sql` + `sql/community-migrations-autocopy.sql`); modal in `CampaignCommunity.tsx`
- [x] Schism — large communities split; `handleSchism` in `CampaignCommunity.tsx` + `sql/community-members-add-schism-reason.sql` widens left_reason CHECK
- [x] Leader permissions — non-GM PC leader can publish own community (`sql/world-communities-leader-permissions.sql`)
- [ ] **World Event CMod propagation** — Distemper Timeline pins in a region apply temporary CMods to all published communities in that region. No code path yet; needs a regional bounding-box query + `morale_check` modifier slot wired to active world events.
- [ ] **Per-community Campfire feed** — gated on Phase 4 (Campfire) shipping. Once Campfire exists, each `world_communities` row gets its own feed showing weekly Morale outcomes, recruitments, schisms, dissolutions.
- [ ] **Community subscription for players** — no `community_subscriptions` table or follow UI. Lets players follow a published community across sessions; surfaces updates in their feed.
- [ ] **Campaign-creation wizard "Start inside/around an existing published community"** — `/stories/new` currently picks Custom / Setting / Module; needs a fourth option that seeds the new campaign adjacent to a published community (autopopulates Homestead pin + invites the new GM into the encounter handshake).

### Out of scope (see spec §12)
- Community-as-single-combat-entity (members still combat individually)
- Full trade-economy simulation (Phase E has narrative links only)
- Procedural community generation (GM-authored only)

---

## 🔵 Phase 5 — Module System 🚩 flagship content engine

**Full spec: `tasks/spec-modules.md`.** Supersedes the paused GM Kit v1 seed-table plumbing — unifies authoring (in-campaign), publishing (as a versioned jsonb snapshot), subscribing (campaign creation picks a module), and updates (opt-in diff/merge). Pairs with Phase 4b Communities (modules ship with pre-authored communities).

### Phase A — MVP publish + subscribe loop ✅ shipped
- [x] `modules` + `module_versions` + `module_subscriptions` tables with jsonb snapshots + RLS
- [x] Publish wizard on campaign edit page — metadata, include/exclude content types, visibility (Private / Unlisted / Listed)
- [x] Campaign creation third option: **Module** picker alongside Custom + Setting
- [x] `cloneModuleIntoCampaign(version, campaign)` — transactional clone of snapshot into campaign_npcs/pins/scenes/tokens/notes
- [x] Record `source_module_id` + `source_module_version_id` on cloned rows for Phase B update tracking
- [ ] Migrate existing Arena seed (`setting_seed_*` tables) into a `modules` row; deprecate seed tables

### Phase B — Versioning + updates ✅ shipped
- [x] Semver bump on publish (patch/minor/major), changelog field
- [x] `/stories/[id]/modules/[id]/versions` history UI with diff summary
- [x] Update notifications on subscriber dashboards
- [x] Review modal — per-asset accept/reject diff, fork option, conflict resolver for locally-edited rows
- [x] `edited_since_clone` flag on cloned content so updates skip customized assets

### Phase B+ — Lifecycle (shipped 2026-04-24)
- [x] Listed modules enter Thriver moderation queue on publish/re-publish
- [x] Thriver approve/reject notifies author; approval stamps `platform_locked_at` on all versions
- [x] Author can archive module (soft-delete); hard-delete only when 0 subscribers
- [x] Subscribers notified on archive; their campaign content untouched
- [x] Archived modules hidden from campaign-creation picker

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

### Phase F — GM Adventure Authoring Toolkit 🚩 (added 2026-04-30)

The current authoring path is "run a campaign for months, then click Publish Module." That works for Xero personally but assumes the GM has already done the work in their head + populated the campaign before Publish exists as a button. New GMs need scaffolding that helps them go from blank-page idea → playable adventure WITHOUT a long live-campaign on-ramp first.

**Vision:** opinionated, guided forms that walk the GM through the bones of an adventure (the "story arc" form), plus on-the-fly creation tools for everything an adventure needs (NPCs, maps, handouts, encounters, route tables). Output of the authoring tools feeds straight into the Module Publish flow — adventures authored with this toolkit ship as Modules end-to-end.

- [ ] **Story Arc form** — guided 4-question creation surface:
  - "What is this about?" (the premise — one-paragraph hook + thematic tags)
  - "Where do they start?" (opening scene + starting pin/Homestead)
  - "What happens along the way?" (3–5 beat outline; each beat carries an optional encounter / scene / handout reference)
  - "Where do they end?" (resolution scenes — branching outcomes Wild / Success / Failure / Dire)
  - Persists to a new `adventures` table or as a structured `metadata.adventure_arc` blob on the existing `campaigns` row. Same data exports into the published module's manifest so subscribers see the arc.
- [ ] **NPC quick-build inline forms** — surface the existing generateRandomNpc + manual-edit flow as a popover from inside the Story Arc form ("add an NPC to this beat"). Pre-fills the NPC's role from the beat (antagonist for the climax, bystander for the opening, etc.). Pairs with the new GM Tools → Populate flow.
- [ ] **Map quick-build** — drop a new tactical scene from inside a beat. Image upload + grid + cell_px + a "place opening tokens" affordance. Wires straight into `tactical_scenes`.
- [ ] **Handout quick-build** — title + rich text + optional image; persists to `campaign_notes` with `share=true`. Surfaces as the player handout when its beat fires.
- [ ] **Encounter quick-build** — pre-rolled stat block for a fight (initiative line-up, recommended weapons, terrain notes). Drops into a beat as "what happens here." Could mature into a roll-table + outcome-tier reference once Lv 4 traits land.
- [ ] **Route tables** — for travel-arc adventures (Mongrels-style road trip), a list of leg-by-leg encounters with a roll-target each. Probably a new `route_legs` table linking to existing pins.
- [ ] **Adventure preview** — a "play test mode" that runs the GM through the arc beat-by-beat in a dry-run UI, surfacing each linked NPC / scene / handout / encounter so they can audit the adventure before publishing.
- [ ] **Publish Adventure** — terminal step on the Story Arc form. Bundles the arc + every linked asset into a Module snapshot via the existing `buildModuleSnapshot` path. Skips the "run a campaign first" friction.

**Out of scope for v1:** branching narratives (the arc is linear with multiple endings), procedural adventure generation (every adventure is GM-authored), shared authoring (one GM owns the arc; collaborator support is a Phase 6/7 ask).

**Why this is its own phase:** the existing Module System assumes you've already played the adventure in a real campaign before publishing. This toolkit is the missing front-end — it lets you AUTHOR an adventure without playing it first. Pairs naturally with Phase 5 Phase D monetization (paid module authors need authoring scaffolding to produce content at quality + speed).

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

---

## 🎯 From 2026-04-28 chat (Welcome page + Messages bell session)

- [ ] **`/firsttimers` auto-redirects to `/dashboard` for already-onboarded users — backburner.** When a returning user (with `profiles.onboarded = true`) hits `/firsttimers`, the page silently redirects to `/dashboard` ([app/firsttimers/page.tsx:30](app/firsttimers/page.tsx:30)). Xero noticed this and wants it parked — the page is meant to be visitable as a reference / re-onboarding surface, not a one-time gate. Likely fix: drop the auto-redirect and instead show a small banner "You've already seen this — back to your [Dashboard]" with a link, or make the redirect opt-in via `?firsttime=1`. Do NOT touch until Xero gives the go-ahead.
- [x] **Run `sql/messages-realtime-publication.sql` on prod database** — applied 2026-04-28; Xero confirmed chat in `/messages` now refreshes live without reload. Adds `public.messages` and `public.conversation_participants` to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL` on `conversation_participants` so the bell's `user_id=eq.<uid>` filter survives UPDATE payloads.
- [ ] **Welcome page → Quick Reference card content TBD.** [app/welcome/page.tsx](app/welcome/page.tsx) has a `Quick Reference` placeholder card. Needs cheat-sheet content per Xero's direction: CDP, WP/RP, Stress, Inspiration, links into the SRD/CRB. Wait for Xero to specify what to surface first, then wire it in.
