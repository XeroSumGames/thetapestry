# Feature Spec — Communities, Recruitment, Morale

**Source**: XSE SRD v1.1.06 (Distemper Release) + Distemper Core Rules v0.9.2. SRD-canonical where Core is vague.

**Status (last verified 2026-04-30)**: ~96% implemented. Phases A–D fully shipped. Phase E ~95% shipped — World Event CMod propagation (#1), player subscriptions (#3), and the "start near existing community" wizard tile (#4) all landed 2026-04-30. Only one Phase E piece remains open: per-community Campfire feed, which is gated on Phase 4 (Campfire) existing at all. The Lv4 Skill Trait auto-bonuses are locked behind the all-or-nothing Trait list per `project_lv4_traits.md`.

**Strategic weight**: 🚩 **Flagship feature** — one of the biggest, most meaningful, and most differentiating elements of Distemper, and a primary pillar of The Tapestry. Every Community created in a campaign becomes a node in a **shared persistent world** where communities from different tables can meet, trade, war, ally, schism, and migrate. Communities are the bridge between a single GM's campaign and the Distemperverse at large.

This document is **both the design spec and the implementation tracker** — §1–§10 are the rules-extract (canonical from the rulebooks; do not drift) and §11 carries shipping status with file links to the actual code/SQL. When the rules and the code disagree, the rules are canonical and the code gets fixed.

---

## 0. The Tapestry Layer — Persistent World

This is what lifts Communities above a standard tabletop sub-system. Every Community lives in two contexts:

1. **Campaign-local** — what this spec §1–§11 covers: members, morale, resources, weekly checks.
2. **World-facing** — a public face visible to other campaigns running in the Distemperverse. Roughly analogous to how `map_pins` already promote from campaign-private to world-visible.

### 0a. World-facing Community record

- Optional opt-in per community (GM toggles "Publish to Distemperverse"). Private by default.
- Propagates only sanitized, GM-approved data: name, description, Homestead location (world map coords), faction/church/ideology label, approximate size band (Small / Band / Settlement / Enclave / City), current status (Thriving / Holding / Struggling / Dying / Dissolved), Thriver-approved latest public update.
- Internal roster / exact WP / secret properties never leave the campaign.

### 0b. Cross-campaign interactions

- **Contact** — another GM's campaign can flag "my PCs encounter Community X" at their Homestead location. Triggers a GM-to-GM notification; opt-in handshake before anything shared.
- **Trade routes / alliances / feuds** — narrative links between two published communities. Shown on the world map as arcs.
- **Migration** — when a community dissolves (3-failure collapse), survivors can be narratively absorbed into nearby published communities (with consent from those GMs).
- **Schism** — large communities can split into two, one staying, one founding a new Homestead elsewhere.
- **World Events** — setting-wide Tapestry events (Distemper Timeline pins) can apply temporary CMod modifiers or resource pressure to all published communities in a region.

### 0c. The Campfire integration

- Published communities get their own feed in The Campfire (Phase 6 layer). Weekly Morale outcomes, notable recruitments, trade-route events, and dissolutions post as entries.
- GM-curated "state of the community" narrative updates.
- Players who subscribe to a community follow its story even when not at the table.

### 0d. Why this is the differentiator

- No other TTRPG platform treats communities as first-class, cross-table, shared-world entities. Most VTTs scope everything to a single campaign.
- Matches the tonal DNA of the setting: Distemper is about groups trying to survive against the dead and each other — the meaningful unit is the community, not the character.
- Natural onboarding hook for new GMs: pick an existing published community, run a campaign inside its orbit instead of starting from nothing.
- Organic content engine for the Distemperverse: the world grows as tables play, without requiring Thriver-authored scenarios for every region.

### 0e. Implementation phase for the Tapestry layer

Build the campaign-local system first (Phases A–D). Add the Tapestry / Persistent World layer as **Phase E** (see §11). Don't over-engineer before the local loop is solid — but build the DB with `published_at`, `world_visibility`, and `world_community_id` columns from day one so the migration to published entities is additive.

✅ **Done as designed.** Phase A's [`sql/communities-phase-a.sql`](../sql/communities-phase-a.sql) carried the Phase E columns from day one, so the Phase E migration was purely additive — `world_communities` was a new table, not a backfill.

---

## 1. Terminology

| Term | Definition |
|---|---|
| **Group** | Default PC party. No community mechanics. |
| **Community** | A Group grown to 13+ total PCs + NPCs. Requires weekly Morale Checks. |
| **Homestead** | The Community's Base of Operations — a building, town, or territory. Linked to a campaign pin (and optionally a tactical scene). |
| **Member** | An NPC or PC in the community. |
| **Role** | Gatherer / Maintainer / Safety / Unassigned. Drives weekly checks. |
| **Activity Block** | Off-screen time (days → seasons) in which the community operates while PCs are elsewhere. |

## 2. Recruitment Types

| Type | Approach | Commitment |
|---|---|---|
| **Cohort** | Shared interest/goal | Until next Morale Check, then re-evaluated |
| **Conscript** | Coerced (requires credible threat) | Follows orders while coercion holds |
| **Convert** | Shared belief/ideology | Probationary through first Morale Check, then committed |
| **Apprentice** | Direct 1:1 bond, PC-specific | Until PC dies or dismisses; can take actions via proxy |

Only 1 Apprentice per PC. Apprentices are still regular members for Community-Structure purposes.

### 2a. Apprentice creation (per SRD §08 p. 21)

On recruit (triggered by a **Moment of High Insight** only — double-6 on the Recruitment Check. A plain Wild Success does NOT unlock Apprentice per SRD §08 p.21 — the table row reads "Same as Wild Success + may take as Apprentice", meaning the Apprentice option is *additive* to High Insight, not shared with Wild Success):
- PC gives the Apprentice a name (if they don't have one already).
- Roll **2d6** on both the **Motivation** and **Complication** tables (SRD Appendix A).
- PC + GM Fill In The Gaps on background.
- Player spends **3 CDP** on RAPID Range Attributes.
- Player picks one setting-appropriate **Paradigm** (SRD Table 8).
- Player spends **5 CDP** on skills.
- Over **1 month of game time**, PC can train the Apprentice in any single skill the PC has, up to **PC skill level − 1**. (PC with Barter 3 can train to Barter 2.)
- CDP the PC earns later can be spent on the Apprentice.

## 3. Recruitment Check

- **Roll**: 2d6 + AMod + SMod + CMod.
- **Skill** is chosen from Barter, Psychology*, Tactics*, Inspiration, etc. per approach. Convert → usually Inspiration or Psychology*.
- **First Impression** modifier (existing SRD) applies as CMod input.
- **Inspiration skill** (Distemper CRB): every level adds **+1 SMod** to the roll in addition to the primary skill's SMod. Stacks. So a PC rolling Barter 2 with Inspiration 3 gets +5 SMod.
- **Outcomes** (per NPC per attempt):

| Total | Cohort | Conscript | Convert |
|---|---|---|---|
| **Success 9–13** | Joins until next Morale Check | Joins under duress | Probationary Convert |
| **Wild Success 14+** | Joins immediately | Fully resigned | Committed believer |
| **Moment of High Insight (6+6)** | Same as Wild Success + Apprentice option | Same + Apprentice option | Same + Apprentice option |
| **Failure 4–8** | Does not join, retry only if circumstances change | Rejects coercion | Does not join |
| **Dire Failure 0–3** | No interest | Actively hostile | Wary, distances themselves |
| **Moment of Low Insight (1+1)** | Alienated/offended, may escalate | Violent resistance | Hostile |

## 4. Morale Check (weekly, Community-only)

- Made at **start of each week** by acknowledged leader (or Group Check if co-equal).
- Uses leader's AMod/SMod.
- 6 built-in modifiers + ad-hoc GM-added CMods.

### 4a. Morale Outcomes

| Total | Effect | Departures | Next-check CMod |
|---|---|---|---|
| Moment of High Insight (6+6) | Leadership trust high | 0 | +2 |
| Wild Success 14+ | Morale strengthens | 0 | +1 |
| Success 9–13 | Morale holds | 0 | 0 |
| Failure 4–8 | Morale slipping | **25% leave** | −1 |
| Dire Failure 0–3 | Morale collapses | **50% leave** | −2 |
| Moment of Low Insight (1+1) | Infighting, rioting, violence | **75% leave** | −3 |

**3 consecutive Morale Check failures → Community dissolves irrecoverably.**

**Retention check (SRD §08 p. 22)**: a fast-acting leader may attempt an **immediate Morale Check** as part of the dissolution to salvage fragments of the community or specific members. Use the preceding Morale Check's result as the Mood Around the Campfire CMod on this retention check.

### 4b. Morale Modifier Slots

| Slot | Source |
|---|---|
| **Mood Around the Campfire** | Previous week's Morale outcome (+2 / +1 / 0 / −1 / −2 / −3). 0 if no prior check. |
| **Fed** | Result of weekly Fed Check (Gatherers) |
| **Clothed** | Result of weekly Clothed Check (Maintainers) |
| **Enough Hands** | **−1 CMod per role group below its minimum %** (Gatherers 33% / Maintainers 20% / Safety 5%), max −3. Mechanical, not narrative. |
| **A Clear Voice** | 0 if clear leader; −1 if leaderless |
| **Someone to Watch Over Me** | +1 if Safety ≥ 10%; −1 if Safety < 5%; else 0 |
| **Additional CMods** | GM/player Fill In The Gaps for unmodeled events |

**Distemper CRB skill bonuses stack onto Morale Checks:**
- **Inspiration Lv4 "Beacon of Hope"**: +4 CMod if the PC is a member of the community.
- **Psychology\* Lv4 "Insightful Counselor"**: +3 CMod if the PC has **tenure** as a community member (MVP: "is currently a member" suffices; post-MVP: add minimum `joined_week` threshold).

## 5. Community Structure (role minimums)

| Role | Min % | Duty | Weekly check |
|---|---|---|---|
| **Gatherers** | 33% | Hunt / forage / farm / fish for Rations | **Fed Check** |
| **Maintainers** | 20% | Repair, Supplies collection | **Clothed Check** |
| **Safety** | 5–10% | Policing, patrol, fire, emergency | No check; modifies Morale |

(Remaining ~37–42% unassigned; leadership is drawn from Safety per SRD.)

Fed/Clothed sub-check outcomes mirror the Morale scale:
- Moment of High Insight (6+6) → +2 CMod next Morale
- Wild Success (14+) → **+1** CMod next Morale (SRD text here appears OCR-garbled as −1 on the Fed side; narrative clearly intends +1 for a surplus)
- Success (9–13) → 0 CMod
- Failure (4–8) → −1 CMod
- Dire Failure (0–3) → −2 CMod
- Moment of Low Insight (1+1) → −3 CMod

## 6. Distemper Core additions (setting-flavor)

- **Conversion recruitment** uses **Inspiration** or **Psychology\***.
- **Inspiration Lv4 "Beacon of Hope"**: +4 to any Community Morale Check; rousing speeches.
- **Psychology\* Lv4 "Insightful Counselor"**: +3 CMod to weekly Morale if the PC spent time as part of the community.
- **Pressganging** (Conscription) requires explicit threats/coercion/manipulation — reflect in UI as a "this is pressure, not persuasion" confirmation.
- **Homestead / Activity Blocks** terminology.

## 7. Integration with existing Tapestry systems

| Existing | Use |
|---|---|
| `campaign_npcs` | Source of NPCs that can be recruited |
| `npc_relationships.relationship_cmod` | Already captures First Impression — flows into Recruitment CMod |
| `roll_log` | All checks (Recruitment, Morale, Fed, Clothed) logged here with descriptive outcome strings |
| `campaign_pins` | Homestead links via `homestead_pin_id` |
| `tactical_scenes` | Homestead can optionally link to a tactical scene |
| `initiative_order` | No overlap |

## 8. Proposed DB Schema

### `communities`
- `id` uuid PK
- `campaign_id` uuid → campaigns (cascade)
- `name` text
- `description` text
- `homestead_pin_id` uuid → campaign_pins (null allowed)
- `status` text ('forming' | 'active' | 'dissolved')
- `leader_npc_id` uuid → campaign_npcs (nullable; PC leader handled separately)
- `leader_user_id` uuid → auth.users (nullable if PC is leader)
- `consecutive_failures` int default 0
- `created_at` timestamptz
- `dissolved_at` timestamptz (null unless status='dissolved')

### `community_members`
- `id` uuid PK
- `community_id` uuid → communities (cascade)
- `npc_id` uuid → campaign_npcs (nullable)
- `character_id` uuid → characters (nullable)  -- at most one of the two is set
- `role` text ('gatherer' | 'maintainer' | 'safety' | 'unassigned')
- `recruitment_type` text ('cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder')
- `apprentice_of_character_id` uuid → characters (null unless recruitment_type='apprentice')
- `joined_at` timestamptz
- `left_at` timestamptz (null while active)
- `left_reason` text (null, 'morale_25', 'morale_50', 'dissolved', 'manual', 'killed')

### `community_morale_checks`
- `id` uuid PK
- `community_id` uuid → communities
- `week_number` int (monotonically increasing within community)
- `rolled_at` timestamptz
- `rolled_by_user_id` uuid
- `die1`, `die2` int
- `amod`, `smod`, `cmod_total` int
- `total` int
- `outcome` text
- `cmod_for_next` int
- `modifiers_json` jsonb  -- snapshot of all 6 slots + extras
- `members_before` int
- `members_after` int

### `community_resource_checks`
- `id` uuid PK
- `community_id` uuid → communities
- `kind` text ('fed' | 'clothed')
- `week_number` int
- Same dice/outcome columns as above.

### RLS
- Campaign members read everything for their campaign.
- GM inserts/updates/deletes everything.
- Players can insert their own Recruitment Checks (UX = player rolls, GM approves?). Decision flag: `require_gm_approval boolean default false`.

## 9. UI Surfaces

### 9a. New GM Assets tab: **Community**

- Only visible when `communities` has ≥1 row for the campaign (or always for GM with "Create Community" CTA).
- Member list grouped by Role with % bar (e.g. `Gatherers 11 / 15 (33%)` green when ≥ minimum, red when below).
- Status chip: Forming / Active / Dissolved.
- Consecutive-failure counter (2/3 → amber, 3/3 → dissolve confirm).

### 9b. Recruitment modal

- Launched from NPC card "Recruit" button.
- Steps:
  1. Pick approach (Cohort / Conscript / Convert) — cards with flavor text.
  2. Pick skill (auto-suggested per approach).
  3. Review CMods (First Impression from `npc_relationships` auto-applied).
  4. Roll.
  5. Outcome screen with auto-created `community_members` row on success.
- Apprentice toggle: visible only on Wild Success / High Insight.

### 9c. Weekly Morale Check modal

- Button on Community tab "Run weekly check" (GM only).
- Auto-fills all 6 modifier slots from current state; GM can override and add ad-hoc CMods.
- Rolls, logs to `community_morale_checks`, posts a log entry to `roll_log`, applies consequence (remove N random members, set next-week CMod, increment/reset consecutive failures).
- Confirmation modal at 3 consecutive failures: "Community will dissolve if this fails."

### 9d. Resource checks (Fed / Clothed)

- Run before Morale Check, same modal pattern.
- Uses a Gatherer/Maintainer NPC as roller (or PC if they have the role).

### 9e. Community page (`/stories/[id]/community`)

- Full-screen view for GM: member grid, history log, morale graph (weeks × outcome), resource-check log.
- Players get a read-only summary version.

## 10. Edge Cases / Decisions to Make

- **PC as community member**: counts toward 13+ threshold.
- **Apprentice on Cohort recruit**: keep Apprentice flag even if Cohort leaves at next Morale? Rule: Apprentice bond survives Morale-induced departures.
- **Community that splits below 13**: revert to Group, suspend Morale Checks.
- **Who can run a Morale Check**: GM always; leader PC if `leader_user_id = auth.uid()`.
- **Who picks the 25% / 50% that leave**: random — weighted toward Unassigned → Cohort → Convert → Conscript, Apprentices last. (Per-role minimums recalculated after.)
- **Time flow**: `week_number` is manual — GM advances via "End Week" button. No real-time clock.
- **Multiple communities per campaign**: allowed. Each has its own leadership and checks.

## 11. Rollout Phases

> Build-order rationale: local loop first (A→D). Once a single table can run a community week-to-week, the Tapestry layer (E) turns on the world-shared magic that makes this a flagship differentiator. Day-one DB should already carry `published_at`, `world_visibility`, `world_community_id` so Phase E is additive, not a migration.

> **Status legend:** ✅ shipped · 🟡 partial · ❌ not started · 🔒 blocked on external dependency.

### Phase A — Foundation ✅ shipped

- ✅ DB tables + RLS — [`sql/communities-phase-a.sql`](../sql/communities-phase-a.sql) (carries Phase E columns day-one).
- ✅ Create Community modal (name, description, Homestead pin) — [`components/CampaignCommunity.tsx`](../components/CampaignCommunity.tsx) `handleCreate` + via [`components/QuickAddModal.tsx`](../components/QuickAddModal.tsx).
- ✅ Community tab in Assets panel + standalone `/communities` index + `/communities/[id]` detail page.
- ✅ Manual add/remove members — `handleAddMember` / `handleRemoveMember`.
- ✅ Members cache auto-counts toward 13+ threshold (Group → Community status flip).

### Phase B — Recruitment ✅ shipped (2026-04-22)

- ✅ NPC card "Recruit" button.
- ✅ Recruitment modal with approach / skill / CMod / roll — lives inline in [`app/stories/[id]/table/page.tsx`](../app/stories/[id]/table/page.tsx).
- ✅ Auto-INSERT into `community_members` on success per the §3 outcome table.
- ✅ First Impression CMod auto-applied from `npc_relationships.relationship_cmod`.
- ✅ Inspiration skill stacks +1/level on top of the primary SMod (Distemper CRB).
- ✅ Apprentice flag — gated to **Moment of High Insight (double-6) only**, per SRD §08 p.21 (Wild Success alone does NOT unlock).
- ✅ Insight Dice on Recruitment (pre-roll 3d6 / +3 CMod + post-roll reroll with state reconciliation).
- ✅ Custom roll_log card style + community milestone notification when a community first crosses 13 active members.
- 🟡 **§2a Apprentice creation flow** — Motivation/Complication tables, +3 CDP RAPID, Paradigm pick, +5 CDP skills, 1-month training. The Apprentice *flag* exists; the SRD's full Apprentice-creation wizard is not surfaced. GMs improvise this off-platform. Pairs naturally with the future CDP Calculator backlog item.

### Phase C — Morale + Resources ✅ shipped (2026-04-23)

- ✅ Weekly Check modal — Fed → Clothed → Morale rolled together — [`components/CommunityMoraleModal.tsx`](../components/CommunityMoraleModal.tsx).
- ✅ All 6 Morale modifier slots auto-filled (Mood / Fed / Clothed / Enough Hands / Clear Voice / Safety) with GM override on every slot + Additional freeform.
- ✅ Fed / Clothed sub-checks with their own outcome → next-week-CMod mapping per §5.
- ✅ Consequence application: 25% / 50% / 75% departures on Failure / Dire / Low Insight, weighted Unassigned → Cohort → Convert → Conscript → Founder → Apprentice. PCs never auto-removed (per §10).
- ✅ `consecutive_failures` ticks on any failure tier, resets on any success tier; `week_number` increments on finalize.
- ✅ 3-failure dissolution — Result stage flips to red "Finalize — Dissolve" button; all members soft-removed with `left_reason='dissolved'`; community flips `status='dissolved'`.
- ✅ **Retention Check** (SRD §08 p.22 salvage roll) — fast-acting leader gets an immediate Morale Check using the prior cmod_for_next as Mood; success of any tier saves the community (consecutive_failures drops to 2).
- ✅ Custom roll_log cards for `fed_check` / `clothed_check` / `morale_check` / `retention_check`.
- ✅ New `morale_75` left_reason — [`sql/community-members-add-morale-75-reason.sql`](../sql/community-members-add-morale-75-reason.sql).

### Phase D — Activity Blocks + Advanced ✅ mostly shipped (2026-04-23, Lv4 deferred)

- ✅ Skip Week button (advances `week_number` without rolls — Activity Block off-screen time).
- ✅ Pressgang Conscription — red warning banner on pick stage + blocking confirm() on submit.
- ✅ GM Dashboard at `/stories/[id]/community` — Morale history (last 20), resource history (last 40), role distribution with SRD minimums, recruitment stats by approach, member breakdown by recruitment_type.
- ✅ At-a-Glance block in expanded community body — Recent Morale chips (last 5) + "You" row showing viewer's role, Apprentice, recruited NPCs. Visible to everyone.
- ✅ Apprentice task delegation — `community_members.current_task` text + GM-edit ✎ inline + "+ Assign task" affordance — [`sql/community-members-add-current-task.sql`](../sql/community-members-add-current-task.sql).
- 🔒 **§6 Inspiration Lv4 "Beacon of Hope"** auto +4 Morale — *deferred to the broader Lv4 Skill Traits ship-together-or-not-at-all rule.*
- 🔒 **§6 Psychology\* Lv4 "Insightful Counselor"** auto +3 Morale — *same backburner.*
- 🔒 **Generic Lv4 trait surface on the character sheet + auto-application hooks for any Lv4 trait touching Morale/Recruitment/Fed/Clothed/combat** — *same backburner.*

### Phase E — The Tapestry (Persistent World) 🟡 ~70% shipped

- ✅ `world_communities` mirror table — [`sql/world-communities.sql`](../sql/world-communities.sql). Columns: `id`, `source_community_id`, `source_campaign_id`, `published_by`, `name`, `description`, `homestead_lat`, `homestead_lng`, `size_band`, `faction_label`, `community_status`, `moderation_status`, `approved_by`, `approved_at`, `last_public_update_at`. UNIQUE on `source_community_id` so re-publishing UPDATEs in place.
- ✅ GM "Publish to Tapestry" toggle + modal — [`components/CampaignCommunity.tsx:1972`](../components/CampaignCommunity.tsx) → `handlePublish` at :883. Preview, faction label input, public-status compute, homestead resolution.
- ✅ Thriver moderation queue (pending → approved/rejected) — [`app/moderate/page.tsx`](../app/moderate/page.tsx) + [`sql/world-communities-moderation-notify.sql`](../sql/world-communities-moderation-notify.sql).
- ✅ Leader permissions — non-GM PC leader can publish their own community — [`sql/world-communities-leader-permissions.sql`](../sql/world-communities-leader-permissions.sql).
- ✅ **World map overlay** — published communities render in [`components/MapView.tsx`](../components/MapView.tsx) with size-banded icons (radius 20→40px ramp by size band) and click-to-open public card.
- ✅ **GM-to-GM contact handshake** — `community_encounters` table + 🤝 button on world-map cards + opt-in accept/decline + notification metadata jsonb — [`sql/community-encounters.sql`](../sql/community-encounters.sql).
- ✅ **Trade / alliance / feud links** — `world_community_links` table with two-way consent (pending → active/declined), color-coded polylines on the world map (trade=green, alliance=blue, feud=red) — [`sql/world-community-links.sql`](../sql/world-community-links.sql).
- ✅ **Migration on dissolution** — survivors of a 3-failure collapse offered to nearby published communities; receiving GMs choose to absorb — [`sql/community-migrations.sql`](../sql/community-migrations.sql) + [`sql/community-migrations-autocopy.sql`](../sql/community-migrations-autocopy.sql) + Migration modal in `CampaignCommunity.tsx`.
- ✅ **Schism mechanic** — large community splits into two; one keeps the Homestead, the other founds a new one — `handleSchism` in `CampaignCommunity.tsx` + [`sql/community-members-add-schism-reason.sql`](../sql/community-members-add-schism-reason.sql).
- ✅ Size band retaxonomy (Group / Small / Medium / Large / Huge / Nation State) — [`sql/world-communities-size-band-retaxonomy.sql`](../sql/world-communities-size-band-retaxonomy.sql).
- ✅ Sanitized public face — internal roster / WP / secret properties never leave the campaign. Schema enforces this — `world_communities` carries no FK back into private tables.
- ✅ **World Event CMod propagation** (2026-04-30) — Distemper Timeline pins (`map_pins.category='world_event'`) carry `cmod_active`/`cmod_impact`/`cmod_radius_km`/`cmod_label` columns ([`sql/map-pins-world-event-cmod.sql`](../sql/map-pins-world-event-cmod.sql)). When active, every community whose Homestead falls inside the radius picks up the CMod automatically on its Weekly Morale Check via a haversine filter ([`lib/world-events.ts`](../lib/world-events.ts)). New "World Events" slot in [`components/CommunityMoraleModal.tsx`](../components/CommunityMoraleModal.tsx) renders one row per matching event with a per-event opt-out checkbox and distance readout, sums into `cmod_total`, snapshotted into `modifiers_json` with a full audit trail.
- 🔒 **Campfire feed per community** — gated on Phase 4 (Campfire) shipping. Once Campfire exists, this is mostly a feed-adapter that pulls the published community's Morale outcomes, recruitments, schisms, dissolutions, and GM narrative updates.
- ✅ **Community subscription for players** (2026-04-30) — `community_subscriptions` table + RLS ([`sql/community-subscriptions.sql`](../sql/community-subscriptions.sql)). Follow / Unfollow toggle on world-map popups ([`components/MapView.tsx`](../components/MapView.tsx)) + Following section on [`/communities`](../app/communities/page.tsx). Denormalized subscriber count via trigger ([`sql/world-communities-subscriber-count.sql`](../sql/world-communities-subscriber-count.sql)) drives the ★ N chip on world-map popups + Following cards. Subscribers get notifications when their followed community's public face changes ([`sql/world-communities-subscriber-notify.sql`](../sql/world-communities-subscriber-notify.sql)). Weekly Morale Check finalize bumps `world_communities.last_public_update_at` and auto-recomputes `community_status` from the outcome (Thriving/Holding/Struggling/Dying/Dissolved) so subscribers see real activity, not just narrative tweaks.
- ✅ **New-GM onboarding hook** (2026-04-30) — campaign-creation wizard at [`/stories/new`](../app/stories/new/page.tsx) gets a fourth start path: "Or start near an existing community". Lists every approved `world_communities` row the user doesn't own. Picking one stamps the new campaign's `map_center` on the community's homestead coords, drops a single Homestead pin in `campaign_pins` at those coords, and INSERTs a row into `community_encounters` — which the existing `notify_community_encounter` trigger ([`sql/community-encounters.sql`](../sql/community-encounters.sql)) fans out as a notification to the source GM. Mutually exclusive with the setting + module pickers.

## 12. Out of Scope (explicit non-goals)

- Community combat as a single entity (individual members still combat normally — community health is tracked via Morale, not HP).
- Full trade-economy simulation — Phase E supports *narrative* trade/alliance *links* between communities, not a resource-exchange engine.
- Procedural community generation — every community is GM-authored.
- The existing world-map "Community" pin category remains as a lightweight flavor pin. Once Phase E ships, GMs will be nudged to promote such pins into full published communities if they're meant to be real entities.

---

## 13. What's left to ship (2026-04-30)

Two real gaps + one parked-for-good-reason backburner.

| # | Item | Phase | Size | Notes |
|---|---|---|---|---|
| 1 | World Event CMod propagation | E | ~~~half-day~~ | ✅ Shipped 2026-04-30. |
| 2 | Per-community Campfire feed | E | ~1 day after Campfire | Blocked on Phase 4 (Campfire) existing at all. Once it does, mostly a feed-adapter. |
| 3 | Community subscription for players | E | ~~~1-2 days~~ | ✅ Shipped 2026-04-30 (basic Follow/Unfollow + Following section was 2026-04-22; subscriber count chip + subscriber notify trigger + auto-status from Morale outcome added 2026-04-30). |
| 4 | "Start near existing community" wizard option | E | ~~~half-day~~ | ✅ Shipped 2026-04-30. |
| 5 | Apprentice creation flow §2a | B | ~1-2 days | Motivation/Complication tables + 3 CDP RAPID + Paradigm + 5 CDP skills + 1-month training. Pairs with the broader CDP Calculator backlog item. |
| 🔒 | Lv4 Skill Traits (Inspiration "Beacon of Hope" + Psychology* "Insightful Counselor" + generic Lv4 sheet surface + auto-application hooks) | D | — | **Locked on the all-or-nothing Trait list landing.** Per project memory `project_lv4_traits.md`: Lv4 traits ship together or not at all. Until the full Trait list is authored, the GM stuffs Lv4 bonuses into the Morale "Additional" slot manually. |

Total work to fully close the spec (excluding the locked Lv4 backburner and the Campfire-blocked item #2): **~1-2 working days** (Apprentice creation flow is the only remaining open item in the actively-buildable column).

The campaign-local loop is solid and playtested. The Tapestry layer is the only meaningful remaining surface, and the unbuilt pieces are the ones that hook deepest into adjacent unbuilt systems (Campfire, player engagement layer, new-GM onboarding) — not the Communities subsystem itself.
