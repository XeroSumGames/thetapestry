# Rules extract — Communities, Recruitment, Morale

**Source**: `docs/Rules/XSE SRD v1.1.17 (Small).pdf` §08 Communities (pp. 21–24), cross-referenced with `Distemper CRB v0.9.2.pdf`. Precedence per `CLAUDE.md`: SRD > CRB > Quickstart > Chased > District Zero.

This is the canonical system rules for the Communities feature. When `tasks/spec-communities.md` disagrees with this file, **update the spec** — don't code the wrong thing.

---

## 1. Scope — Group vs Community

- A **Group** is a PC party. No community mechanics; no weekly checks required.
- A **Group** becomes a **Community** when combined PCs + NPCs reach **13 or more members**.
- Communities must make a **Morale Check** on a regular cadence (usually weekly; GM discretion).
- Groups skip Morale Checks entirely until they cross the 13+ threshold.

## 2. Recruitment Check

### Roll mechanic
- **2d6 + AMod + SMod + CMod** (standard outcome table; see §3 below).
- Skill chosen to align with approach. Common picks: **Barter**, **Psychology\***, **Tactics\***, **Inspiration**.
- **First Impression** CMod applies — per-PC, per-NPC, stored in `npc_relationships.relationship_cmod`.

### Approaches

Three recruitment approaches. The choice sets commitment duration and shifts flavor.

| Approach | Basis | Commitment |
|---|---|---|
| **Cohort** | Shared interest or goal with the PC | Joins until next Morale Check, then re-evaluated |
| **Conscript** | Coerced — requires a **credible threat** | Follows orders while the coercion holds |
| **Convert** | Shared belief, ideology, or vision | Probationary through first Morale Check, then committed |

### Outcome tables per approach

**Cohort**
| Roll | Effect |
|---|---|
| Success (9–13) | NPC joins until next Morale Check |
| Wild Success (14+) | NPC becomes a Cohort immediately (no probation) |
| Moment of High Insight (6+6) | Same as Wild Success + may take the NPC as **Apprentice** |
| Failure (4–8) | Does not join. Retry only if circumstances materially change |
| Dire Failure (0–3) | No interest in joining |
| Moment of Low Insight (1+1) | NPC is alienated/offended. Possible escalation → violent rejection |

**Conscript**
| Roll | Effect |
|---|---|
| Success (9–13) | Complies under duress. Will follow orders until next Morale Check |
| Wild Success (14+) | Joins willingly — fully committed, loyal follower |
| Moment of High Insight (6+6) | Wild Success + Apprentice option |
| Failure (4–8) | Appears to comply but will attempt to escape at first opportunity |
| Dire Failure (0–3) | Steadfastly refuses to join |
| Moment of Low Insight (1+1) | Refuses + hostile / violent response possible |

**Convert**
| Roll | Effect |
|---|---|
| Success (9–13) | Joins as probationary Convert. Commits after first Morale Check passes |
| Wild Success (14+) | Committed believer and follower |
| Moment of High Insight (6+6) | Wild Success + Apprentice option |
| Failure (4–8) | No interest. Retry allowed if PCs Fill In The Gaps on a different approach |
| Dire Failure (0–3) | Becomes wary and distances themselves from the PC |
| Moment of Low Insight (1+1) | So unwilling to join they may become hostile / violent |

### Apprentices

Apprentice is an **option** triggered by Wild Success or Moment of High Insight on any Recruitment Check. A player may also seek out a specific NPC and make a deliberate recruitment attempt aimed at Apprenticeship.

**Rules** (SRD §08, p. 21):

- **1 Apprentice per PC at any time.**
- Apprentice can undertake tasks / activities on behalf of OR act as **proxy** for their PC.
- On recruit, the player:
  - Gives the Apprentice a name (if they don't have one)
  - Rolls **2d6 on both the Motivation and Complication tables** (SRD Appendix A has those)
  - Works with GM to **Fill In The Gaps** on the Apprentice's background
- **CDP spends on creation**:
  - **3 CDP** to raise RAPID Range Attributes
  - **5 CDP** to raise skills
  - Pick one setting-appropriate **Paradigm** (SRD Table 8: Paradigms & Vibe Shifts)
- **Training**: Over **1 month game-time**, the PC can train the Apprentice in any single skill the PC has, up to **(PC skill level − 1)**. So a PC with Barter 3 can train Apprentice to Barter 2.
- **Progression**: If the PC earns CDP later, they may choose to spend it on the Apprentice instead of themselves.

## 3. Morale Check (weekly, Community-only)

Made at the **start of each week** by an acknowledged community leader (PC or NPC). If leaders are of equal standing, they make a **Group Check**.

Roll is **2d6 + leader AMod + leader SMod + 6 modifier slots**:

| Slot | Source |
|---|---|
| **Mood Around The Campfire** | From the previous Morale Check result (see table below). If no prior check: 0. |
| **Fed** | From the weekly Fed Check (Gatherers). |
| **Clothed** | From the weekly Clothed Check (Maintainers). |
| **Enough Hands** | **+1** if all three role groups meet their minimums (Gatherers 33%, Maintainers 20%, Safety 5%); else **−1 per group short**, max −3. (Page 23 only states the negative side; page 24 adds the +1 when fully staffed. Implementation combines both.) |
| **A Clear Voice** | 0 if clear leader; −1 if community is leaderless. |
| **Someone To Watch Over Me** | −1 if Safety < 5% of community; +1 if Safety ≥ 10%. Otherwise 0. |
| **Additional CMods** | GM/player Fill-In-The-Gaps for unmodeled events (raids, crises, miracles, etc.). |

### Morale Check outcomes

| Roll | Effect | Mood (next week's Mood Around The Campfire CMod) |
|---|---|---|
| Wild Success (14+) | Morale stays strong or improves | +1 |
| Moment of High Insight (6+6) | Belief in leadership is high | +2 |
| Success (9–13) | Morale remains steady | 0 |
| Failure (4–8) | Morale slipping. **25%** of community leaves | −1 |
| Dire Failure (0–3) | Morale collapses. **50%** of community leaves | −2 |
| Moment of Low Insight (1+1) | Infighting, rioting, violence. **75%** leaves | −3 |

### Dissolution
- **3 consecutive Morale Check failures → community dissolves irrecoverably.**
- A fast-acting leader may attempt to retain fragments / specific members via an **immediate Morale Check** using the previous check's result as the Mood CMod.

## 4. Community Structure — role minimums

| Role | Minimum % | Responsibility | Weekly check |
|---|---|---|---|
| **Gatherers** | 33% (round down) | Hunt, forage, farm, fish, scavenge → **Rations** | **Fed Check** |
| **Maintainers** | 20% (round down) | Collect **Supplies** (clothing, tools, batteries), repair and maintain buildings/equipment/vehicles | **Clothed Check** |
| **Safety** | 5–10% | Policing, patrol, firefighting, emergency services. Community leadership drawn from here. | No weekly check — drives Morale modifiers only |

Remaining ~37–42% are unassigned. Missing any group below minimum → −1 "Enough Hands" CMod per group, max −3.

### Fed Check (Gatherers, weekly, before Morale)

| Roll | Effect | CMod to next Morale Check |
|---|---|---|
| Wild Success (14+) | Rations surplus | **+1** (PDF OCR garbled this as −1; narrative clearly intends +1) |
| Moment of High Insight (6+6) | Luxury items boost mood | +2 |
| Success (9–13) | Baseline needs met | 0 |
| Failure (4–8) | Shortfall — 1 meal/day | −1 |
| Dire Failure (0–3) | Continuous hunger, days between rations | −2 |
| Moment of Low Insight (1+1) | Food contamination / famine onset | −3 |

### Clothed Check (Maintainers, weekly, before Morale)

| Roll | Effect | CMod to next Morale Check |
|---|---|---|
| Wild Success (14+) | Buildings / equipment repaired + improved | +1 |
| Moment of High Insight (6+6) | Perfect working order + project success | +2 |
| Success (9–13) | Adequate maintenance | 0 |
| Failure (4–8) | Minor breakdowns or Supplies deficit | −1 |
| Dire Failure (0–3) | Continued breakdowns impacting community | −2 |
| Moment of Low Insight (1+1) | Critical infrastructure damaged | −3 |

### Player contribution to Fed / Clothed

- Fed and Clothed are "assumed to be rolled by NPCs of reasonable proficiency" by default.
- A PC **may choose to spend their time** contributing to these tasks and use their own AMods/SMods **if they can Fill In The Gaps on how they contributed**.
- No separate mechanic — just substitute the PC roller for the NPC's.

## 5. Distemper CRB additions (confirmed 2026-04-22 after CRB re-upload)

Source: `docs/Rules/Distemper CRB v0.9.2.pdf`, Skills chapter.

### Inspiration skill — every level gives +1 SMod to Recruitment

> "For each level in Inspiration, a PC gets a +1 SMod to any attempt to get NPCs behind an idea or to any NPC recruitment attempts."

**Implementation**: When a PC rolls a Recruitment Check, their Inspiration level adds to SMod in addition to whatever core skill they're using (Barter / Psychology\* / Tactics\* / etc.). UI should show this as a distinct CMod line item in the Recruitment modal's review step.

### Inspiration Lv4 "Beacon of Hope" — +4 to Morale + risk-everything narrative

> "Level 4 'Beacon of Hope': At level 4, the character adds +4 to any Community Morale checks. Additionally, they can make rousing speeches that can convince any Community they are a part of to risk everything — including their own lives — for the good of the larger group."

**Implementation**: +4 CMod to every Community Morale Check the PC participates in (auto-applied if the PC is a member). The "risk-everything" speech is a GM-narrative hook, not a mechanical trigger.

### Psychology* Lv4 "Insightful Counselor" — +3 Morale if PC has tenure

> "Level 4: 'Insightful Counselor': At level 4, a character who has spent time as part of a community is able to understand them and help the community leaders see what they need, and may add a +3 CMod to the community's weekly Morale checks."

**Implementation**: +3 CMod to Morale Checks, **gated on the PC having spent time as a community member**. We'll need to track something like `community_members.joined_week` and gate the bonus on (current week − joined_week ≥ N) where N is GM-negotiated. For MVP, treat "is currently a member" as sufficient tenure.

### Apprentice Paradigm pick (confirmed)

> "Some players may recruit an Apprentice… and if they do, they get to choose a Paradigm for that apprentice."

Matches SRD §08 creation rules. No new mechanics — just confirms the PC (not the GM) picks the Paradigm.

### Activity Blocks (Phase D forward reference)

CRB mentions a "Community Workbook" at DistemperVerse.com for managing Activity Blocks. Out of scope for Phase B — flagged here for the Phase D implementation to pull in.

### CRB status note

CRB v0.9.2 explicitly uses page-number placeholders ("see page xx") for Community rules — it defers to the SRD §08 as canonical. Nothing in the CRB contradicts the SRD on Community mechanics; it only adds the flavor above.

## 6. Data model implications (cross-check with spec)

- `communities` row → one per named community, campaign-scoped (Phase A-D) / world-scoped (Phase E).
- `community_members` → one row per (community, PC or NPC). Columns needed: `recruitment_type` (cohort/conscript/convert/apprentice), `role` (gatherer/maintainer/safety/unassigned/leader), `apprentice_of_character_id` (nullable PK to characters.id), `joined_at`, `joined_week`, `left_at` (for the 25/50/75% drop consequence).
- `community_morale_checks` → one row per weekly check. Columns: `week_number`, `roll`, `amod`, `smod`, each of the 6 CMod slots, `outcome`, `departed_count`, `cmod_for_next_morale`.
- `community_resource_checks` → one row per Fed/Clothed check. Columns: `kind` ('fed'|'clothed'), `week_number`, `roll`, `outcome`, `cmod_for_next_morale`.
- **Apprentices need `apprentice_of_character_id` to enforce the "1 per PC" rule + keep the bond visible in UI.**

## 7. Diff against `tasks/spec-communities.md` (as of 2026-04-22)

| Topic | Spec says | SRD says | Status |
|---|---|---|---|
| §4b Morale slot name | "Enough Space" (GM-narrative CMod) | **"Enough Hands"** — mechanical, −1 per role group short, max −3 | ❌ Spec wrong |
| §4b Morale slot count | 6 slots with TWO GM-narrative slots (Mood + Space) | 6 slots, **one** GM-narrative (Mood) + Enough Hands is mechanical | ❌ Spec wrong |
| §2 Apprentice creation | Mentioned but no CDP/skill detail | **3 CDP RAPID, 5 CDP skills, 1 Paradigm, train to PC-level−1 over 1 month** | ⚠️ Spec incomplete |
| §3 Recruitment skills | "Barter, Psychology\*, Tactics\*, Inspiration, etc." | SRD confirms Barter / Psychology\* / Tactics\*; Inspiration is CRB-flavor | ✓ Matches |
| §3 First Impression CMod | Flows from `npc_relationships.relationship_cmod` | Confirmed: SRD p. 21 "Recruitment Checks can be influenced by the First Impression a player made on them" | ✓ Matches |
| §4 Morale cadence | "Weekly" | SRD: "usually weekly, but the exact cadence is up to the GM" | ⚠️ Spec should note cadence is GM-configurable |
| §4 3-consecutive-failure dissolution | "Dissolves irrecoverably" | SRD adds: **immediate retention Morale Check is allowed**, using previous result as Mood CMod, for "fast-acting leaders" | ⚠️ Spec missing retention check |
| §5 Leadership | Says leadership drawn from Safety | SRD confirms: "This group is also made up of Community leadership" | ✓ Matches |
| §10 Who runs Morale | "GM always; leader PC if leader_user_id = auth.uid()" | SRD: acknowledged leader (PC or NPC); Group Check if co-equal leaders | ✓ Matches (spec is stricter — OK for MVP) |
| Morale outcome 75% leave | Not in spec | SRD: Moment of Low Insight = **75% leave** (spec only has 25/50) | ❌ Spec missing 75% / Low Insight tier |

**Spec updates to make before Phase B coding:**
1. Rename "Enough Space" → "Enough Hands" in §4b, with mechanical definition (−1 per role group short, max −3).
2. Expand §2 Apprentice with full creation rules (3/5 CDP, Paradigm, 1-month training).
3. Add Moment of Low Insight = 75% leave + −3 Mood in §4a Morale Outcomes.
4. Add retention-check mechanic to §10 dissolution.
5. Note Fed Check Wild Success is +1 (narrative clearly intends +1 despite PDF OCR showing −1).
6. CRB additions confirmed (§5 of this extract): Inspiration +1 SMod per level to Recruitment, Inspiration Lv4 "Beacon of Hope" +4 to Morale, Psychology\* Lv4 "Insightful Counselor" +3 to Morale for tenured members.
