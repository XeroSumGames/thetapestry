# Outstanding Work — 2026-05-01

Single-file export of every open item across the project. Organized by status (active → planned → backburner → roadmap) so anything actionable is at the top, anything aspirational is at the bottom.

Source-of-truth files this consolidates: [tasks/todo.md](todo.md), [tasks/handoff.md](handoff.md), and the per-feature testplans authored this session.

---

## 0. Just-shipped this session (verify on prod)

All four shipped to `main`. SQL migrations applied per Xero confirmation. Testing planned later this morning.

| Phase | Title | Commit | SQL |
|---|---|---|---|
| **4A** | Per-setting feed layer | `db6586a` | `sql/campfire-setting-discriminator.sql` ✅ applied |
| **4A.5** | Forum-thread campaign scope | `6704c56` | `sql/forum-threads-campaign-id.sql` ✅ applied |
| **4B** | Promotion + moderation flow | `f9609e4` | `sql/campfire-moderation.sql` ✅ applied |
| **4C** | Setting hubs (DZ + Kings Crossroads) | `3ba25a8` | (none — UX-only) |

Testplans:
- [tasks/campfire-setting-discriminator-testplan.md](campfire-setting-discriminator-testplan.md) — covers 4A + 4A.5 + 4B (sections 1-16).
- [tasks/setting-hubs-testplan.md](setting-hubs-testplan.md) — covers 4C (sections 1-9).

**Open follow-ups surfaced in those testplans (not yet acted on):**
- [ ] **Tighten RLS on campaign-tagged threads + War Stories.** Today `campaign_id` is purely a tag — non-members can still SELECT campaign-tagged threads. If "campaign-private" should mean truly private, both `forum_threads` and `war_stories` need RLS that filters by campaign membership when `campaign_id` is set.
- [ ] **Backfill of old LFG freetext setting rows.** Pre-Phase-4A LFG posts have `setting` values like "Distemper", "Homebrew", "Chased". They only show under the "All" chip. Skip unless it bites.
- [ ] **Pre-existing font-size guardrail offenders** (predate Phase 4A; not blocking):
    - `components/TradeNegotiationModal.tsx:217` — `fontSize: '11px'` (auto-fixable via `node scripts/check-font-sizes.mjs --fix`)
    - `components/CampaignCommunity.tsx:2200` — `fontSize: '13px'` + `color: '#3a3a3a'` (manual fix to `#cce0f5`)

---

## 1. Phase 4D — Per-community Campfire feed (NEXT, paused mid-exploration)

~1 day estimate. Closes spec-communities §2. Started exploration this session, paused for this export.

**What it is:** every community gets an event feed. Auto-posts on Morale Check finalize, Schism, Migration, Dissolution. Manual GM "Post community update" for free-form. Surface on community detail page + /communities Following card (latest 5-10 events).

### Hook points (pre-mapped during exploration)

| Event | File | Line | Function |
|---|---|---|---|
| Morale finalize | `components/CommunityMoraleModal.tsx` | 488-592 (after :592) | `finalizeAndSave()` |
| Dissolution | `components/CommunityMoraleModal.tsx` | 488-592 (same path, gated by `reallyDissolves`) | `finalizeAndSave()` |
| Schism | `components/CampaignCommunity.tsx` | 858-933 (after :907) | `handleSchism()` |
| Migration | `components/CampaignCommunity.tsx` | 771-826 (after :826) | `handleMigration()` |

### To-build checklist
- [ ] **DB:** new `community_events` table with `community_id` FK + `event_type` enum (morale_outcome / schism / migration / dissolution / manual) + `payload jsonb` + `author_user_id` (null for system) + `created_at` + RLS (campaign members read; system + GM write).
- [ ] **Hooks:** insert one `community_events` row at each of the four pre-mapped points.
- [ ] **Manual GM "Post community update"** — small composer modal launched from a button in `CampaignCommunity.tsx` (insert a Feed section between At-a-Glance and Homestead, or after Weekly Check).
- [ ] **Community detail page rendering** — Feed section inside the expanded `CampaignCommunity` accordion body, rendering the latest events with type-specific styling.
- [ ] **/communities Following card rendering** — chip-style row with the 3-5 most recent event types per community card.
- [ ] **Testplan** — `tasks/community-events-feed-testplan.md` covering the four auto-post triggers + manual post + RLS sanity.

---

## 2. Phase 4E — Polish wave (opportunistic, ~1 day each)

Each item is independent; pick off as needed. None are blocking.

- [ ] **Pagination on every feed** (currently unbounded `.select('*')` on Forums / War Stories / LFG). Standard `range(from, to)` cursor with a "Load more" button.
- [ ] **Full-text search** across Forums / War Stories / LFG. Probably Postgres `tsvector` + GIN index per table, with a search bar on `/campfire/<surface>`.
- [ ] **Reactions on War Stories + LFG** — persist Forums B votes as the canonical pattern, extend across the other two surfaces.
- [ ] **Comment threading on War Stories + LFG** — Forums has it via `forum_replies`; the others are flat. Add reply tables + nested rendering.
- [ ] **Notifications UI for LFG interest pings** — the rows already exist (`lfg_interests`), no read/dismiss view yet.
- [ ] **Inline `<t:UNIX:f>` token rendering in body text.** The Timestamp tool at `/campfire/timestamp` outputs Discord-style tokens; build a content-renderer utility that detects them and replaces with a `<time>` element formatted in the viewer's local timezone. Hook into LFG / Forums / War Stories / Messages / Notes.
- [ ] **Formal `campaign_invitations` accept/reject flow** — replaces today's DM-with-link pattern.
- [ ] **LFG filters** by setting + schedule.

**Phase 4 explicit non-goals (don't build):**
- ❌ Forum redesign (parked — both A and B disliked, no rework yet)
- ❌ Hubs for Mongrels / Chased / Custom / Arena (deferred)
- ❌ Homebrew tab (placeholder stays placeholder until design)
- ❌ User profiles / reputation

---

## 3. Active backlog — friction items + small bugs

Ready to pick up; each is self-contained.

### From 2026-04-29 chat — roll-log clarity + modal unification
- [x] **Empty-adventure module clone fails on null pin name.** ✅ Already shipped — `lib/modules.ts:316` does `resolvedName = p.name ?? p.title` with a warn-and-skip fallback for rows missing both. Audit confirmed 2026-05-01.
- [ ] **Gut Instinct results presentation rework.** Current Gut Instinct rolls land in the standard roll modal but the *result framing* doesn't communicate what the player learned. Needs design discussion: narrative card in the feed? Overlay on the rolling PC's sheet? GM-only insight via DM? Mechanics fine; comprehension issue.
- [ ] **First Impression → straight to roll modal.** Today First Impression has a separate pre-roll picker (target NPC + skill). Skip the picker and dump straight into the main Attack Roll modal pre-populated with `INF + Manipulation/Streetwise/Psychology` and the NPC pre-targeted. Saves ~3-4 clicks.
- [ ] **Modal unification — Attack Roll is the gold standard.** Every roll modal should match its shape (roll breakdown, target dropdown, CMod input, Insight Dice pre-roll + post-roll reroll). Modals to normalize: Stress Check, Breaking Point, Lasting Wound, Recruit, Stabilize, Distract, Coordinate, Group Check, Gut Instinct, First Impression. Multi-commit refactor; needs a shared `<RollModal>` shell.

### From 2026-04-27 Mongrels playtest
- [ ] **Lag on initiative — needs solo validation.** User to playtest alone with multiple combatants and confirm lag. Look for: sequential awaits in `nextTurn` not yet in `Promise.all`, missed indexes on `initiative_order`, postgres_changes subscription firing extra `loadInitiative()` rounds. Don't action until Xero confirms symptom.
- [ ] **Hide NPCs reveal UX streamlining.** Data layer ✓ (`hidden_from_players` boolean + auto-reveal triggers). But for a typical "ambush of 5 NPCs" the GM clicks N+ times. Streamline ideas: folder-level "Reveal all in this folder", "Reveal selected" multi-select bar, auto-reveal everyone selected in Start Combat, panic-button "Reveal entire campaign roster". Discuss workflow before picking.
- [ ] **Streamline logging into missions.** `/login` → `/stories` → click campaign → "Join Session" → `/stories/[id]/table` is too many steps. Possible: deep-link straight to active session, auto-redirect from `/stories/[id]` to `/table` when GM has a session active, "Resume last session" tile on `/stories`. Discuss before shipping.

### From 2026-04-30 close-out (Inventory followups)
- [ ] **Apprentice CDP transfer** — master PC's earned CDP can flow to Apprentice.
- [ ] **PC ↔ Vehicle item transfer.**
- [ ] **Withdrawal-to-PC on community stockpile** — today GM removes + manually adds.
- [ ] **Realtime sub on `community_stockpile_items`.**
- [ ] **Multi-round haggling** (Barter currently single-roll).
- [ ] **Barter Lv4 cheat-doubling** (locked behind Lv4 Trait list).
- [ ] **Auto-relationship-penalty on Dire/Low Insight Barter outcome.**

### From 2026-04-30 Mongrels Mall content prep
- [ ] **King's Crossroads Mall — tactical scenes** — author battle maps for the mall complex (motel courtyard, Costco interior, gas station, Belvedere's, etc.) and wire into `SETTING_SCENES.kings_crossroads_mall` in `lib/setting-scenes.ts` using the same filter-from-CHASED_SCENES pattern as the pins + NPCs.
- [ ] **King's Crossroads Mall — handouts** — port any in-world broadcasts, journal pages, or ham-radio transcripts into `SETTING_HANDOUTS.kings_crossroads_mall` in `lib/setting-handouts.ts`. Mirror the filter-from-CHASED_HANDOUTS approach.
- [ ] **Re-seed an existing campaign with a setting's content** — currently seeding fires once at campaign creation. Build a Thriver/GM tool (`/tools/reseed-campaign?id=…`) that re-runs `SETTING_PINS` / `SETTING_NPCS` / `SETTING_SCENES` / `SETTING_HANDOUTS` against an existing campaign id with name-collision skipping (idempotent). Workaround today is "create a new campaign" or hand-write SQL.

### From 2026-04-29 (combat correctness + perf)
- [ ] **Insight Die spend tracked on roll_log.** Add an `insight_used text` column (NULL / '3d6' / '+3cmod'), populate from `executeRoll` (and reroll path), surface in the extended-log card. Migration is non-destructive (NULL default), code path needs to thread `insightUsed` arg through `saveRollToLog`. Today only ~83% of 3d6 rolls are detectable from die2 packing; +3 CMod is indistinguishable from organic CMod.
- [ ] **GM Tools → Restore to Full Health is slow.** With 11+ targets the handler fires N sequential UPDATEs (character_states for PCs, campaign_npcs for NPCs, scene_tokens for Objects). Batch the UPDATEs by table — one per table with `.in('id', ids)`, run all three concurrently via `Promise.all`. Add a "Restoring…" disabled state.

### Other small items
- [ ] **Destroyed-object portrait swap** — object tokens with WP should optionally carry a `destroyed_portrait_url`; render that image instead of the intact one when WP hits 0. Falls back to current shatter-crack overlay.
- [ ] **CMod Stack reusable component** — extract from the Recruit modal, reuse in Grapple, First Impression, main Attack modals.
- [ ] **GM force-push view to players** — when GM switches view (campaign world map ↔ tactical, scene A ↔ scene B), push that view change to every connected player. Today there's `tactical_shared` / `tactical_unshared` broadcasts but no general "switch to scene X" or "switch to campaign view" push. Likely shape: extend the broadcast to carry `{ view: 'campaign' | 'tactical', sceneId?: string }`. GM-side "Sync to players" toggle (or always-on) + auto-fire on scene-switch.
- [ ] **Tapestry-side `<t:UNIX:format>` renderer** — same as 4E "Inline `<t:UNIX:f>` token rendering" above. Format codes are `t / T / d / D / f / F / R` per Discord spec; replicate the same `Intl.DateTimeFormat` options used in the generator's preview column.
- [ ] **Print sheet missing data** — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated from character data.
- [ ] **Player-facing NPC card on Show All click** — clicking a revealed NPC in the player's NPCs tab opens a read-only card. Today opens the same editable view as GM. Design question: Name, First Impression role, description? Or more?
- [ ] **Player NPC notes + first impressions** — clicking an NPC name in the player's Assets NPCs tab should open a space where the player can write personal notes about that NPC, and show their First Impression results.
- [ ] **Surface Give loot UI in the GM Assets → Objects panel** — mirror the per-item Give controls now on ObjectCard so GM can loot without placing the object on the map first.
- [ ] **Add Katana to weapon database** — differentiate from Sword (higher damage or different traits, e.g. lighter/faster with lower Cumbersome, or unique trait like Precise).
- [ ] **Map search predictive results — prioritize US locations.** Currently Nominatim returns global results in arbitrary order; bias autocomplete to US first (`countrycodes=us`), fall back to global if no matches.
- [ ] **Players can drop pins on the /table campaign map.** Currently `+ Pin` button in `CampaignMap.tsx` is gated on `isGM`; let players place own pins (probably starts as `revealed=false` until GM approves, or as separate "player-suggested" category).
- [ ] **Switch email FROM address back to `noreply@distemperverse.com`** once domain verified on Resend (using `onboarding@resend.dev` workaround due to Wix MX limitation).

### Character creation gaps
- [ ] **Tooltips throughout character creation** — hover/tap explanations on skills, attributes (RAPID), and other game terms so new players understand what each thing does without leaving the page.
- [ ] **Overhaul "What They Have" / Weapons + Equipment step.** Current layout is unwieldy AND only includes Melee + Ranged. Missing Heavy Weapons, Demolitions, Explosives, future categories. Redesign:
  - Tabbed or filtered category picker covering ALL weapon families (Melee / Ranged / Heavy / Explosives / etc.)
  - Search across the full weapon catalog
  - Compact card / row layout — fewer dense fields per item, cleaner secondary stats
  - Equipment side gets the same treatment (categorized, searchable)
  - Stays compatible with Paradigm + Random flows that pre-seed weapons
  - Every character creator hits this surface
- [ ] **Clean up Weapons/Equipment page** — superseded by overhaul above; keep until overhaul ships.
- [ ] **Weapon dropdowns on Final Touch screen** — let players swap their seeded/picked weapons via a dropdown selector instead of being locked into the default loadout.
- [ ] **CDP tracker boxes** (partially fixed; finish).

### Map / pins
- [ ] **Parent/child pin structure** — rumor about a specific building within a landmark.
- [ ] **Immutable canon layer** — Thriver-set pins only, cannot be edited by others.

### Logging
- [ ] **Remaining event instrumentation** (9 items).

---

## 4. Big features unstarted

### CDP Calculator / Character Evolution
- [x] **Shipped.** The Evolution button on every CharacterCard opens the [`<CharacterEvolution>` modal](components/CharacterEvolution.tsx) — the spec's "or modal on the character sheet" path. SRD-canonical costs (1 CDP to learn a skill, 2N+1 per skill step, 3×(N+1) per RAPID step), one-step-at-a-time, Lv 4 narrative gate (12-char minimum), apprentice raises log to the master PC's progression_log. Audit closed 2026-05-01; the missing `roll_log` insert with `outcome='evolution'` was added in a follow-up commit so the table feed surfaces the spend.

### Tactical map — long-term big lifts
- [ ] **Dynamic lighting on tactical map.** Player vision limited by light sources (torches, lanterns, sun); areas outside lit radius render fogged. Lights layer on `tactical_scenes` (`{ x, y, radius, color }[]`), per-token visibility computed against light sources, fog-of-war canvas pass on the player side.
- [ ] **Doors on tactical maps.** Door tokens with open/closed state, blocking movement and (with line-of-sight) blocking vision when closed. New `door` token_type on scene_tokens with `is_open boolean` field. GM toggles by clicking; player movement pathfinding respects closed doors.
- [ ] **Line of sight on tactical maps.** Visibility blocking (walls, large objects, closed doors) hides tokens beyond from player view. Polygon vision mask per token, recalculated on token move. Pairs with dynamic lighting (shared visibility pipeline).

### Communities Phase E remaining
- [ ] **World Event CMod propagation.** [✅ shipped 2026-04-30] — Distemper Timeline pins in a region apply temporary CMods to all published communities in that region. Now landed via `map_pins.cmod_*` columns + Weekly Morale slot with per-event opt-out.
- [ ] **Per-community Campfire feed** — see Phase 4D above.
- [ ] **Community subscription for players** — [✅ shipped 2026-04-30] — `community_subscriptions` table + denormalized `subscriber_count` + ★ chip + subscriber-notify trigger.
- [ ] **Campaign-creation wizard "Start near existing community"** — [✅ shipped 2026-04-30] — fourth tile on `/stories/new`.

### Lv4 Skill Traits (full backburner — ships together or not at all)
- [ ] Inspiration Lv4 "Beacon of Hope" auto +4 to Morale (awaiting full list)
- [ ] Psychology* Lv4 "Insightful Counselor" auto +3 to Morale (awaiting full list)
- [ ] Generic Lv4 Trait surface on the character sheet
- [ ] Auto-application hooks for any other Lv4 Trait that touches Morale / Recruitment / Fed / Clothed / combat

---

## 5. Phase 5 — Module System (largely shipped; remaining)

Phase A (MVP) ✅, Phase B (versioning) ✅, Phase B+ (lifecycle) ✅. Open:

### Phase A leftover
- [x] Migrate existing Arena seed (`setting_seed_*` tables) into a `modules` row. ✅ Already shipped — the Thriver tool at `/tools/migrate-settings-to-modules` publishes all 5 deprecated settings (Empty / Chased / Minnie / Basement / Arena) as Modules. Audit confirmed 2026-05-01.

### Phase C — Marketplace
- [ ] `/modules` browse + search + filters (setting, tags, rating, subscriber count)
- [ ] `/modules/[id]` detail page with version history, reviews
- [ ] Listed-module Thriver moderation queue (note: shipped 2026-04-24 in Phase B+ — might already be covered)
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

### Phase F — GM Adventure Authoring Toolkit (added 2026-04-30)
- [ ] **Story Arc form** — guided 4-question creation surface ("What is this about?" / "Where do they start?" / "What happens along the way?" / "Where do they end?"). Persists to a new `adventures` table or as `metadata.adventure_arc` jsonb on `campaigns`.
- [ ] **NPC quick-build inline forms** — popover from inside the Story Arc form ("add an NPC to this beat"). Pre-fills NPC role from beat (antagonist for climax, bystander for opening, etc.).
- [ ] **Map quick-build** — drop a new tactical scene from inside a beat. Image upload + grid + cell_px + "place opening tokens" affordance.
- [ ] **Handout quick-build** — title + rich text + optional image; persists to `campaign_notes` with `share=true`.
- [ ] **Encounter quick-build** — pre-rolled stat block for a fight (initiative line-up, recommended weapons, terrain notes).
- [ ] **Route tables** — for travel-arc adventures (Mongrels-style road trip), leg-by-leg encounters with roll-target each. New `route_legs` table linking to existing pins.
- [ ] **Adventure preview** — "play test mode" runs the GM through the arc beat-by-beat in a dry-run UI.
- [ ] **Publish Adventure** — terminal step on the Story Arc form. Bundles arc + linked assets into Module snapshot via existing `buildModuleSnapshot`.

---

## 6. Communities Phase B (Recruitment) — drafted, not shipped

Full plan in `tasks/todo.md` lines 1139-1297. Shipped 2026-04-22 actually (per todo.md — "Recruitment Insight Dice", "Community milestone notification", etc.). The drafted plan in todo.md is a stale design doc; the items have largely landed.

**Polish + Phase D candidates from this doc:**
- [ ] **Polish** Deeper approach tooltip — "Why this approach?" with rules context (commitment duration, SRD references, when to pick each).
- [ ] **Phase D candidate** NPC-proxy recruitment — GM rolls on behalf of a Community's Leader NPC to recruit other NPCs. Needed if a community grows itself off-screen while PCs are elsewhere. Design dependency: Activity Blocks (Phase D).

---

## 7. Backburner — don't touch unless trigger fires

### Campaign calendar
**Why deferred:** none of the friction points actually bite yet. Manual Skip Week + manual world-event toggle + manual encumbrance tick all work in current play.

**Revisit triggers** (any one flips back to active):
- [ ] Forgetting Skip Week → community frozen for 4+ sessions
- [ ] World events that should've ended weeks ago still applying CMod in play
- [ ] Wanting "X days passed" → automatic ration consumption / weather change / community drift
- [ ] Encumbrance tick feels like it should auto-fire on time advancement

When picked back up:
- [ ] DB: `campaign_clock` table or jsonb on `campaigns` (start_date + ticks_per_day + current_tick)
- [ ] Helper `lib/campaign-clock.ts` exposing `advance(campaignId, hours)` that fans out to every time-aware subsystem (encumbrance ticks, community Morale due-dates, world event activation, ration decay)
- [ ] UI surface: probably a small clock widget in the table page header showing "Day N · Hour H" with +/- stepper. GM-only.
- [ ] Migrate the `Time` button from Inventory #1 to use the unified clock instead of its standalone tick.

### Thriver godmode UI sweep
**Status:** DB-level done. UI deferred. Pilot (commit `fd5db34`) widened 3 components but was rolled back — Xero wants the whole surface done in one pass.

When picked back up:
- [ ] UI sweep: every `isGM && <button ...>` widens to `(isGM || isThriver) && <button ...>`. Candidates:
  - Table page header: Start/End Session, Start/End Combat, Tactical Map toggle, Share Map, GM Tools dropdown
  - NpcRoster (add/edit/delete NPCs, folders, objects, place-on-map)
  - TacticalMap (scene picker, setup, token placement)
  - CampaignCommunity (delete community, approve pending, set leader)
  - CampaignPins / CampaignObjects / VehicleCard
  - Character sheet edits for non-owned PCs (GM-only today)
- [ ] Pattern: prefer widening at the caller (`isGM={isGM || isThriver}`) over rewriting every internal reference.
- [ ] Verify after sweep: log in as Xero on a campaign they don't GM, confirm every admin affordance is visible and works (RLS + UI both honor it).

### NPC health as narrative feeling
*Deferred 2026-04-26.* User decided not to ship as currently scoped (narrative state strings replacing pip numbers for non-GM). Re-open if a different framing comes up.

### `/firsttimers` auto-redirect
- [ ] **Drop the auto-redirect** from `/firsttimers` to `/dashboard` when user has `profiles.onboarded = true`. Page should be visitable as reference / re-onboarding surface, not a one-time gate. Likely fix: small banner "You've already seen this — back to your [Dashboard]" with a link, or make redirect opt-in via `?firsttime=1`. **Do NOT touch until Xero gives go-ahead.**

### GM Kit v1 (paused 2026-04-19, direction uncertain)
- [~] **GM Kit v1 — export + seed-import loop.** Shipped end-to-end but image URLs in seeds still point to source campaign's bucket — delete that campaign and seed images 404. Scene tokens round-trip through kit but neither seed schema nor create flow ingests them. Three possible directions: (a) re-upload kit images to "shared seed assets" bucket on import, (b) treat seeds as live-linked to source campaign, (c) abandon seed approach and lean on real Module data structure (Phase 5). Revisit before promoting any setting beyond personal beta.

### Code audit deferrals
- [ ] **DEFERRED:** Split table page (5,365 lines) into subcomponents — high risk before game.
- [ ] **DEFERRED:** Debounce realtime callbacks — works fine, optimization only.
- [ ] **DEFERRED:** Sequence guards on `loadRolls` / `loadChat` — low impact.

---

## 8. Forward roadmap (Phase 5+)

These are aspirational; not actively planned for the next sprint.

### Phase 4 (Living World) — older items not yet absorbed by 4A-4E
- [ ] Campfire global feed — approved Rumors, World Events, session summaries, War Stories, LFG posts visible to all
- [ ] Campfire setting feed — filtered view per setting
- [ ] Campfire campaign feed — private feed per campaign, GM session summaries, player War Stories
- [ ] Promotion flow — campaign post → setting feed → global feed, Thriver approval at each level *(largely covered by Phase 4B)*
- [ ] World Events — Thriver-authored announcements that shape the living world, permanently pinned
- [ ] Reactions and comments on Campfire posts *(in 4E)*
- [ ] Filtering by setting, date, post type *(largely covered by 4A)*
- [ ] Featured items — Thriver can promote any post to featured status
- [ ] LFG posts — GMs and players post availability, setting preference, playstyle, experience level *(shipped)*

### District Zero hub deepening
- [ ] District Zero canon layer — immutable pins set by Thriver only
- [ ] District Zero community layer — approved player Rumors visible to all DZ campaigns
- [ ] District Zero timeline — chronological history of events in the setting
- [ ] Timeline sort_order management — UI for Thrivers to reorder timeline pins (drag-and-drop or number field)

### Phase 6 — Community & Retention
> Depends on Phase 4b Phase E shipping — Campfire feeds, subscription, and cross-community features hang off the `world_communities` layer.

- [ ] LFG system — GMs post open campaigns, players post availability, matching by setting and playstyle *(shipped)*
- [ ] Session scheduling — GM proposes times, players confirm, calendar view
- [ ] The Gazette — auto-generated campaign newsletter after each session pulling from roll log highlights, session summary, GM notes. Shareable link for non-members.
- [ ] Between-session experience — something to do on the platform outside of active sessions
- [ ] Subscriber tiers — Free, Paid, Premium with defined feature gates
- [ ] Graffiti — reactions on War Stories and Campfire posts (Distemper-branded reactions)

### Phase 7 — Ghost Mode Advanced
- [ ] Ghost-to-Survivor funnel analytics — track where conversions happen
- [ ] A/B test soft wall messaging
- [ ] Onboarding flow for physical product QR scanners — different from standard signup
- [ ] **Reactivate `/firsttimers` onboarding page** — file exists at `app/firsttimers/page.tsx` and remains reachable, but signup no longer auto-redirects new users to it. When ready: change signup's fallback from `/dashboard` back to `/firsttimers`, and re-enable `/dashboard` → `/welcome` redirect.

### Phase 8 — Physical Products
- [ ] Chased QR code integration — fold-out map codes deep-link into Tapestry at Delaware setting
- [ ] Anonymous preview for QR scanners without accounts — show setting content before signup prompt
- [ ] Chased module — pre-populated with Delaware setting content, linked to physical product
- [ ] Minnie & The Magnificent Mongrels setting — sourcebook upload, seed pins and NPCs
- [ ] Physical product landing pages — one per product, branded, drives to signup

### Phase 9 — Maturity
- [ ] Rules reference — full XSE SRD v1.1 searchable and browsable within The Tapestry
- [ ] Contextual rules links — from character sheet and dice roller to relevant SRD sections
- [ ] Mobile optimization pass — dashboard, map, character wizard, table view all responsive
- [ ] Mobile dice roller — optimized for rolling at a physical table on your phone
- [ ] Global search — find characters, campaigns, pins, NPCs, Campfire posts

### Phase 10 — Future Platforms
- [ ] Displaced — space setting, separate platform, custom star map
- [ ] Extract shared XSE engine into @xse/core monorepo — character system, campaign system, table surface shared across platforms
- [ ] Each setting gets own domain, branding, and map layer built on shared core
- [ ] Long-term: Tapestry becomes the proof of concept for the XSE platform family

### Phase 11 — Cross-Platform Parity
- [ ] **Campaign Calendar** — date-gated lore events, GM-controlled include/ignore/pending states. Build for Displaced first, backport to Tapestry using same schema pattern if player demand exists.
- [ ] **Roll20 Export** — one-way migration for GMs/players who want to take a campaign to Roll20. Three parts: (1) minimal Distemper Roll20 character sheet HTML/CSS/JS, (2) per-campaign ZIP exporter (characters JSON, NPCs JSON, handouts, manifest), (3) ingest paths (Character Vault drag, API script, manual paste). Scope: sheet ~2-4 days, exporter ~1 day, API import ~half day.

---

## 9. Tools & technical debt

### Tools enhancements (future)
- [ ] **Batch mode** — multi-file upload, process and download as zip
- [ ] **Manual crop control** — drag-to-select crop area (useful for off-center subjects)
- [ ] **Upload to Supabase Storage** — shared portrait bank across campaigns; random assignment during NPC creation
- [ ] **Auth gating** — currently `/tools/*` is public; may want to restrict to signed-in Survivors
- [ ] **More tools** — handout generator, token template maker, roll table randomizer

### Technical debt
- [ ] Migrate character photos from base64 to Supabase Storage (low priority — already compressed to 256x256 JPEG)
- [ ] Embed Distemper videos on landing page

---

## 10. Memory rules in play (quick checklist)

These aren't tasks — they're durable behavior rules. Listed here because they constrain HOW any of the above work gets done.

- Carlito font default (Barlow Condensed killed 2026-04-29)
- Min inline `fontSize = 13px` (guardrail at `scripts/check-font-sizes.mjs`)
- Header buttons = 28px height, use `hdrBtn()` helper
- Carlito + `#cce0f5` as the safe text-on-dark combo (NEVER `#3a3a3a`)
- Push to live, test on live (Vercel = dev env, user is only real user)
- After every push from worktree: `git -C C:/TheTapestry pull origin main`
- User does NO git ops — Claude does ALL of them end-to-end
- Don't ask "want to break?" — user finds it patronizing
- Long-term fix > quick fix; surface latent bugs even when off-request
- Communities flagship = treat Phase E items as priority
- Lv4 Skill Traits ship together or not at all — don't piecemeal
- Token spawn position: always top-left (1,1)
- `cell_px` default is 35
- Notification position locked: `left:10px`, below bell
- Live URL: `thetapestry.distemperverse.com`
- Testplan naming: by topic (`<feature>testplan.md`), never overwrite generic
- Progression Log = journey markers only (no tick noise)
- The Arena campaign id `35ed2133-498a-43d2-bbd6-21da05233af2` is The Arena (stand-alone), NOT Mongrels

---

## Summary counts

| Bucket | Items |
|---|---|
| Just-shipped (verify) | 4 phases (4A / 4A.5 / 4B / 4C) + 3 open follow-ups |
| Phase 4 remaining | 4D (1 day) + 4E (8 polish items, ~1 day each) |
| Active backlog | ~30 self-contained items |
| Big features unstarted | CDP Calculator + 3 tactical-map lifts (doors/LoS/lighting) + Lv4 Traits |
| Phase 5 remaining | 1 leftover + Phase C/D/E/F (~25 items) |
| Backburner | 5 categories (calendar / godmode / NPC narrative / firsttimers / GM Kit v1) |
| Roadmap (Phase 6-11) | ~30 aspirational items |

**Most actionable thing tomorrow:** Phase 4D (per-community Campfire feed). Hook points pre-mapped in §1; ~1 day to ship.

**Biggest deferred lever:** the Lv4 Skill Traits list. Until that lands, no per-skill Lv4 bonuses can ship — currently blocking Inspiration "Beacon of Hope" (+4 Morale), Psychology "Insightful Counselor" (+3 Morale), Barter cheat-doubling, and the generic Lv4 Trait surface on every character sheet.
