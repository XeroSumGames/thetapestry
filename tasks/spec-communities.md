# Feature Spec — Communities, Recruitment, Morale

**Source**: XSE SRD v1.1.06 (Distemper Release) + Distemper Core Rules v0.9.2. SRD-canonical where Core is vague.

**Status**: Spec — not yet implemented.

**Strategic weight**: 🚩 **Flagship feature** — one of the biggest, most meaningful, and most differentiating elements of Distemper, and a primary pillar of The Tapestry. Every Community created in a campaign becomes a node in a **shared persistent world** where communities from different tables can meet, trade, war, ally, schism, and migrate. Communities are the bridge between a single GM's campaign and the Distemperverse at large.

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

## 3. Recruitment Check

- **Roll**: 2d6 + AMod + SMod + CMod.
- **Skill** is chosen from Barter, Psychology*, Tactics*, Inspiration, etc. per approach. Convert → usually Inspiration or Psychology*.
- **First Impression** modifier (existing SRD) applies as CMod input.
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

| Total | Effect | Next-check CMod |
|---|---|---|
| Success 9–13 | Morale holds | 0 |
| Wild Success 14+ | Morale strengthens | +1 |
| Moment of High Insight (6+6) | Leadership trust high | +2 |
| Failure 4–8 | 25% leave | −1 |
| Dire Failure 0–3 | 50% leave | −2 |
| Moment of Low Insight (1+1) | Catastrophe (GM fills gap) | −3 |

**3 consecutive Failures → Community dissolves irrecoverably.**

### 4b. Morale Modifier Slots

| Slot | Source |
|---|---|
| **Fed** | Result of weekly Fed Check (Gatherers) |
| **Clothed** | Result of weekly Clothed Check (Maintainers) |
| **Mood Around the Campfire** | GM-narrative CMod |
| **Enough Space** | GM-narrative CMod |
| **A Clear Voice** | 0 if clear leader; −1 if leaderless |
| **Someone to Watch Over Me** | +1 if Safety ≥ 10%; −1 if Safety < 5%; else 0 |
| **Additional CMods** | GM/player Fill in the Gaps |

## 5. Community Structure (role minimums)

| Role | Min % | Duty | Weekly check |
|---|---|---|---|
| **Gatherers** | 33% | Hunt / forage / farm / fish for Rations | **Fed Check** |
| **Maintainers** | 20% | Repair, Supplies collection | **Clothed Check** |
| **Safety** | 5–10% | Policing, patrol, fire, emergency | No check; modifies Morale |

(Remaining ~37–42% unassigned; leadership is drawn from Safety per SRD.)

Fed/Clothed sub-check outcomes mirror the Morale scale:
- Wild Success → +1 CMod next Morale
- Success → 0
- Failure → −1 Morale CMod
- Dire Failure → −2
- Moment of Low Insight → −3

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


### Phase A — Foundation
- DB tables + RLS.
- Create Community modal (name, description, Homestead pin).
- Community tab in Assets panel — member list, role assignment (drag-drop or dropdown).
- Manual add/remove members (no recruitment mechanic yet).
- Members cache auto-count toward 13+ threshold.

### Phase B — Recruitment
- NPC card "Recruit" button.
- Recruitment modal with approach / skill / CMod / roll.
- Auto-add on success per SRD outcome table.
- First Impression integration.
- Apprentice flag and bond tracking.

### Phase C — Morale + Resources
- Fed / Clothed check modals (sub-rolls).
- Weekly Morale Check modal with modifier auto-fill.
- Consequence application: remove % members, cmod_for_next, consecutive_failures counter.
- 3-failure dissolution flow with confirmation.
- Roll log entries for all community checks (custom card style like `combat_start`).

### Phase D — Activity Blocks + Advanced
- End Week button advances `week_number`; optionally prompts for off-screen activity outcomes.
- Inspiration Lv4 / Psychology* Lv4 auto-CMod bonuses.
- GM dashboard: morale history graph, role health over time, recruitment success rate.
- Player-facing read-only Community summary.
- Apprentice task delegation UI.

### Phase E — The Tapestry (Persistent World)
- `world_communities` mirror table — sanitized, public-facing row per published community. Columns: `id`, `source_campaign_id`, `source_community_id`, `name`, `description`, `homestead_lat`, `homestead_lng`, `size_band`, `status`, `faction_label`, `last_public_update_at`, `published_by`, `thriver_approved`.
- GM "Publish to Distemperverse" toggle on the Community panel — requires Thriver moderation queue approval (reuse existing `map_pins` promotion pattern).
- **World map overlay** — published communities render on the world map with size-banded icons, status colors, and click-to-open public card.
- **Community contact handshake** — "My campaign encounters Community X" from another table fires a GM-to-GM notification; both GMs opt in before any private data crosses.
- **Trade / alliance / feud links** — narrative edges between two published communities, drawn as colored arcs on the world map.
- **Migration on dissolution** — when a community collapses (3-failure), survivors offered to nearby published communities; receiving GMs choose to absorb.
- **Schism mechanic** — large community can split into two; one keeps the Homestead, the other founds a new one elsewhere (may be instantly published or remain campaign-private).
- **World Event CMod propagation** — Distemper Timeline pins in a region can apply temporary CMods to Morale Checks for every published community inside that region.
- **Campfire feed per community** — Phase 6 Campfire shows a public timeline for each community: weekly outcomes, notable recruitments, schisms, dissolutions. GM-curated narrative updates.
- **Community subscription** — players follow published communities across sessions and platforms.
- **New-GM onboarding hook** — campaign-creation wizard offers "Start inside/around an existing published community" as an alternative to blank-slate.

## 12. Out of Scope (explicit non-goals)

- Community combat as a single entity (individual members still combat normally — community health is tracked via Morale, not HP).
- Full trade-economy simulation — Phase E supports *narrative* trade/alliance *links* between communities, not a resource-exchange engine.
- Procedural community generation — every community is GM-authored.
- The existing world-map "Community" pin category remains as a lightweight flavor pin. Once Phase E ships, GMs will be nudged to promote such pins into full published communities if they're meant to be real entities.
