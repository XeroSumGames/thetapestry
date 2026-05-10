# Rules Extract — Recruitment / First Impression / Inspiration / Apprentice

**Date:** 2026-05-10
**Sources (in precedence order):**
- XSE SRD Export v1.1.17, §07 First Impressions / Gut Checks / §08 Communities (canonical)
- Distemper CRB v0.9.2, ch. 9 (Skills — Inspiration p.59) + ch. 10 (Hell is Other People — Recruitment p.168, Apprentices p.172, First Impressions p.176)
- Distemper Quickstart — derivative; not used for rules calls.

**Why this exists:** the platform conflates four adjacent social mechanics that have distinct mechanical roles. This document pins each one down, points at the current implementation, and flags every place where the code diverges from canon so we can fix or accept-with-rationale.

---

## TL;DR — the four mechanics

| Mechanic | What it is | How it modifies | When it fires | Persists? |
|---|---|---|---|---|
| **First Impression** | One-shot social opener vs. a specific NPC | Records a **CMod** on the PC↔NPC relationship | First meeting (or deliberate re-try after circumstances change) | Yes — written to `npc_relationships.relationship_cmod`, clamped ±3 |
| **Inspiration** (skill) | Levels in the Inspiration skill | **+1 SMod per level** on any roll to "get NPCs behind an idea" — Recruitment, Conversion sermons, rallying, etc. | Any qualifying social/recruit roll where the PC has the skill | No — re-computed per roll from the character sheet |
| **Recruitment** | Add an NPC to a Community via one of three approaches | A dice check with outcome → membership status; outcomes branch by approach (Cohort / Conscript / Convert) | When PCs try to win over an NPC | Yes — writes `community_members.recruitment_type` |
| **Apprentice** | Special bonded NPC owned by a single PC | Surfaces an "Take as Apprentice" picker on the recruit roll | **Only on Moment of High Insight (6+6) of a Recruitment check.** CRB also allows plain Wild Success; Xero house-rule is HI-only | Yes — `community_members.recruitment_type = 'apprentice'` + `apprentice_of_character_id` |

The platform implements all four. Most surfaces are right. The pieces that diverge from canon are flagged below as 🐛.

---

## 1. First Impression (SRD §07, CRB ch.10 p.176)

### Canon

> When encountering an NPC for the first time, the character can make a First Impression check to influence how they are perceived.

- **Skill:** Influence (the attribute) + any appropriate skill — Manipulation, Streetwise, Psychology*, Barter, Inspiration, Intimidation per CRB.
- **Result is recorded as a CMod on that PC ↔ NPC relationship.** It applies to **all future social checks** between them. Range: SRD says **-3 to +2**; CRB says -3 to +1 (older). SRD wins per precedence.

### SRD outcome table (canonical)

| Roll outcome | CMod applied | Other |
|---|---|---|
| Moment of High Insight (6+6) | **+2** | + Insight Die awarded |
| Wild Success (14+) | **+1** | — |
| Success (9-13) | **0** | — |
| Failure (4-8) | **-1** | — |
| Dire Failure (0-3) | **-2** | — |
| Moment of Low Insight (1+1) | **-3** | + Insight Die awarded (penalty die) |

### Re-trying

CRB explicitly allows a fresh First Impression check later "after a number of interactions" once the player Fills In The Gaps about how they're approaching the NPC differently. SRD doesn't restate this; we should honor it.

### Current platform state

- **Where it lives:** `app/stories/[id]/table/page.tsx:5491-5546` — `firstImpression` block in `executeRoll`. Writes via `bump_npc_relationship_cmod` RPC (atomic add-with-clamp), trigger: `triggerFirstImpression(...)` from `NpcRoster` / `PlayerNpcCard`. Stored on `npc_relationships.relationship_cmod`, clamped ±3 by the RPC.
- **CMod mapping (current code, lines 5505-5510):**
  ```
  HI / Wild Success → +2
  Success           → +1
  Failure           →  0
  Dire Failure      → -1
  Low Insight       → -2
  ```

### 🐛 Divergences from canon

1. **Outcome ladder is shifted off-canon by +1.** Every step is one notch too generous. Per SRD:
   - Wild Success should be **+1**, not +2.
   - Success should be **0**, not +1.
   - Failure should be **-1**, not 0.
   - Dire Failure should be **-2**, not -1.
   - Low Insight should be **-3**, not -2.
   - High Insight stays at +2.
   The net effect: PCs are getting better First Impressions than canon allows at every tier except HI. Fix is a one-block edit in `executeRoll`.

2. **No Insight Die award on HI / Low.** SRD: "+1 / -3 CMod **as well as an Insight Die**" on HI/LI. We compute and store the CMod but don't grant the bonus die. Need to check whether `executeRoll`'s generic HI/LI handling already awards an Insight Die — if so, no work; if not, hook in here.

3. **Re-roll behavior is "accumulate, clamped ±3"**, which is right for stacking small interactions, but CRB's "after a number of interactions, attempt another First Impression" implies a discrete re-do that **overwrites** the prior reading. Today's behavior is closer to "ongoing relationship CMod" (acceptable design), but if Xero wants strict CRB, we'd need an explicit "Re-do First Impression" affordance that resets rather than adds.

---

## 2. Inspiration (CRB ch.9 p.59 — the **skill**, not the +1 SMod system)

### Canon

> Inspiration is the ability to motivate and uplift. For each level in Inspiration, a PC gets a **+1 SMod** to any attempt to get NPCs behind an idea or to **any NPC recruitment attempts.**
>
> Level 4 "Beacon of Hope": +4 to any Community Morale check; rallying speeches.

Key points:

- **It's a +1 SMod per level.** Not a CMod. Stacks with whatever skill is being rolled. The roll-time skill itself (Inspiration, Manipulation, etc.) provides its own SMod; the +1/level bonus is **on top** of that.
- **Applies to:** "any attempt to get NPCs behind an idea" + "any NPC recruitment attempts." Generous reading covers Recruitment (all three approaches), Conversion sermons, rallying speeches, persuading a holdout. Narrow reading is just the Recruitment dice check itself.
- **Level 4 trait** ("Beacon of Hope") is part of the Lv4 trait surface that's Xero-blocked and ships with the full Lv4 wave.

### Current platform state

- **Recruitment roll picks it up:** `app/stories/[id]/table/page.tsx:3414-3441` — `computeRecruitCmods` reads the roller's Inspiration skill level and adds it to the totaled modifier shown in the UI.
- **UI labels it "CMod" but the comment says it's added to SMod on the actual roll** (line 3423-3424: *"Treated as CMod here (in the UI total) for clarity; the actual roll adds it to SMod."*).

### 🐛 Divergences / open questions

1. **UI label is misleading.** It's an SMod per canon — the UI calls it a CMod in the breakdown. Either rename to SMod or add a footnote. Minor.

2. **Potential double-count when the skill rolled IS Inspiration.** If the player picks Inspiration as their recruit skill, the base roll already adds Inspiration's skill SMod. Then `computeRecruitCmods` adds **another** +1/level on top. Need to verify the roll-construction code path doesn't double-dip. If it does, the +1/level bonus from `computeRecruitCmods` should be suppressed when the chosen skill IS Inspiration. (Alternative reading: canon's +1/level IS the SMod and the skill's level *is* the bonus — in which case the recruit-roll add-on is the bug.)

3. **Does Inspiration bonus apply outside Recruitment?** Today only the recruit modal reads it. The CRB phrasing "any attempt to get NPCs behind an idea" suggests it should also apply to:
   - Conversion sermons within an existing Community (probably already covered because conversions go through the recruit path).
   - Standalone rallying speeches (not currently a wired surface).
   - Morale Check (only via the Lv4 trait — gated to Lv4 anyway).
   Decision: scope to Recruitment for now; revisit when other surfaces exist.

---

## 3. Recruitment (SRD §08, CRB ch.10 p.168)

### Canon — three approaches

| Approach | Skills | What it means | Outcome flavor |
|---|---|---|---|
| **Cohort** | Influence + Inspiration / Manipulation | Shared interest / goal. NPCs work with the PCs because it benefits them. | Success = temporary till next Morale Check; Wild Success / HI = immediate commit |
| **Conscript** | Influence + Inspiration / Manipulation / **Intimidation / Psychology*** | Pressgang — coercion under credible threat. Requires a real threat to even attempt. | Success = will follow under duress till next Morale Check; Failure = appears to comply, escapes first chance |
| **Convert** | Influence + Inspiration / Psychology* (or **Intimidation** for fire-and-brimstone) | Belief / ideology. NPCs join because they buy into the message. | Success = joins as a Cohort, waits for first Morale Check; Wild Success / HI = becomes a committed believer |

### Universal rules

- **All three branches grant an Apprentice unlock on Moment of High Insight.** SRD says "Not only does the NPC join but the PC may choose to take them as an Apprentice." (See §4 Apprentice below for the gate decision.)
- **First Impression CMod stacks into the recruit roll.** SRD: "Recruitment Checks can be influenced by the First Impression a player made on them."
- **Group Recruitment Checks** are allowed (combined effort).
- **CMods commonly applied** (CRB suggestions, GM discretion):
  - Conscript: +1 reputation; +1 NPC has something to lose; -2 similar group size; +2 PCs heavily outnumber NPCs.
  - Convert: +1 matching beliefs; +1 reputation; -1 no religious inclination; -3 aversion to religion; +3 significantly better living standard + matching beliefs.

### Outcome ladder per approach (SRD §08)

**Cohort:**
- Success → joins until next Morale Check
- Wild Success → becomes a Cohort immediately
- HI → joins + Apprentice option
- Failure → no interest; may try again if circumstances change
- Dire Failure → no interest, possible alienation
- Low Insight → alienated/offended; possible escalation to violence

**Conscript:**
- Success → conscripted under duress; follows orders till next Morale Check
- Wild Success → joins willingly, becomes a committed follower
- HI → joins + Apprentice option
- Failure → appears to comply, escapes at first opportunity
- Dire Failure → refuses; potential loss-of-face problem for the PC
- Low Insight → so unwilling they may turn hostile/violent

**Convert:**
- Success → joins as Cohort but waits for first Morale Check before committing
- Wild Success → becomes a committed believer & follower
- HI → joins + Apprentice option
- Failure → no interest; can retry unless Intimidation was used (then permanently fails)
- Dire Failure → wary, will distance themselves
- Low Insight → so unwilling they may turn hostile

### Current platform state

- **Modals:** `CommunityProxyRecruitModal.tsx` (community-roster path), in-table recruit flow at `app/stories/[id]/table/page.tsx:3443+` (NPC-card path).
- **Approach picker:** Cohort / Conscript / Convert. Conscript has a credibility gate (`confirm` dialog at line 3455-3461) — good.
- **DB:** `community_members.recruitment_type` enum: `cohort | conscript | convert | apprentice | founder`. `npc_communities.recruitment_role` tracked separately.
- **CMod stack:** `computeRecruitCmods` aggregates First Impression CMod + Inspiration level + Poaching (-3 if NPC already in another community) + manual GM CMod.

### 🐛 Divergences / open questions

1. **Outcome → membership mapping needs verification per approach.** Each approach has different "what does Success mean" semantics in canon. Today the platform likely treats all three approaches identically at the success level (just writes `recruitment_type`). Need to audit:
   - On Success, does Cohort write a "temporary till next Morale Check" flag? (Probably not.)
   - On Wild Success, does the membership state differ from Success? (Should be "immediate commit" for Cohort.)
   - On Failure, do we record the attempt so the player can't spam re-rolls? (Cohort allows retry only "if circumstances change"; Conscript is more punitive; Convert with Intimidation is permanent fail.)
2. **Poaching -3 CMod is a platform invention, not canon.** It's a reasonable house-rule (prevents PCs from sniping each other's recruits) but should be documented as a Tapestry-specific rule, not SRD canon. Decision: keep, but label.
3. **Group Recruitment Check** — is the combined-effort path wired? Worth verifying as a separate task; not blocking.

---

## 4. Apprentice (CRB ch.10 p.172)

### Canon

> To convince an NPC to align with another character in such a meaningful way requires a **Wild Success (or a Moment of High Insight) on a Recruitment check.**

Key points:

- **Unlock gate:** Wild Success OR Moment of High Insight on any Recruitment check (CRB).
- **One Apprentice per PC at any time.** Player picks Paradigm, rolls Motivation + Complication, Fills in the Gaps.
- **3 CDP for RAPID Range bumps + 5 CDP for skills** at creation (SRD wording; CRB phrases as "Monthly Activity Block of training, one skill, one level lower than the PC").
- **Training:** over a Monthly Activity Block, the PC can train the Apprentice in any single skill the PC has, **to one level lower** than the PC's level.
- **CDP from progression** can be spent on the Apprentice instead of the main PC.
- **Death rules:** if the Apprentice dies, find/train another. If the PC dies, the player may promote the Apprentice to main PC, who can then take their own Apprentice. No Apprentice may take their own Apprentice.

### Xero house-rule (2026-05-09)

> Apprentice: the picker / unlock surface fires **only on a Moment of High Insight (6+6)** during a Recruit roll — not on Wild Success or any other outcome.

This is **stricter than CRB**, which allows plain Wild Success too. Documented here as a deliberate house-rule.

### Current platform state

- **Gate:** `app/stories/[id]/table/page.tsx:3532` — `unlocksApprentice = outcome === 'High Insight'`. Matches Xero house-rule. ✅
- **Creation wizard:** `components/ApprenticeCreationWizard.tsx` — Paradigm + Motivation + Complication + skill seeding.
- **Membership:** stored as `community_members.recruitment_type = 'apprentice'` with `apprentice_of_character_id` foreign key. ✅
- **One-per-PC enforcement:** TBD — need to verify whether the wizard prevents a second concurrent Apprentice for the same PC.

### 🐛 Divergences / open questions

1. **CRB allows Wild Success.** Platform is stricter (HI-only). Documented choice. If Xero ever wants to relax to CRB-strict, single-line change at `:3532`.
2. **One-per-PC enforcement** needs verification. The community spec already constrains this; should be a DB unique constraint on `(apprentice_of_character_id)` filtered to `recruitment_type = 'apprentice'`.
3. **Apprentice CDP allocation surface** — verify the 3 RAPID + 5 skill CDP allocation per SRD is correctly wired in the wizard. CRB's "Monthly Activity Block, one skill, one level lower" path is the **training-after-creation** flow, not initial creation.
4. **Promote-Apprentice-to-PC on PC death** — verify this flow exists. SRD/CRB both call it out.

---

## Implementation backlog (proposed)

These all flow from the canon audit above. Sizes are rough.

### Tier 1 — canon bugs (ship before next playtest)

- ✅ **First Impression outcome ladder fix.** SHIPPED 2026-05-10. `app/stories/[id]/table/page.tsx:5505-5510` now matches SRD §07: HI=+2, Wild=+1, Success=0, Failure=-1, Dire=-2, LI=-3. Vibe labels and progression-log copy updated. RPC clamp ±3 already supports the -3 floor.
- ✅ **First Impression Insight Die award on HI / LI.** No additional work needed — the generic HI/LI handler at `app/stories/[id]/table/page.tsx:4176-4181` already awards an Insight Die on any HI/LI roll for PCs, regardless of label.

### Tier 2 — disambiguation (clear up player confusion)

- **Rename "Inspiration" line in `computeRecruitCmods` UI breakdown from CMod → SMod.** ~5 minutes.
- **Suppress Inspiration +1/level bonus when the rolled skill IS Inspiration** (avoid double-count). Audit first, then ~15 minutes.
- **Approach-specific Success semantics for Recruitment.** Cohort Success → temporary-till-next-morale flag; Wild Success → permanent. Conscript Failure → escape-flag. Convert + Intimidation Failure → permanent-fail flag (no retry). Each touches the recruit-result-handler. ~1-2 hours.

### Tier 3 — verification (might already be done)

- Audit `bump_npc_relationship_cmod` RPC: is the clamp ±3 (SRD range -3 to +2)? Or ±2? If ±3, we accidentally support an out-of-range -3 floor. Probably fine since SRD does allow -3 via LI.
- Verify Group Recruitment Check path.
- Verify Apprentice one-per-PC DB constraint.
- Verify Apprentice CDP allocation matches SRD 3 + 5 split.
- Verify promote-Apprentice-on-PC-death flow.

### Tier 4 — Xero design calls (parked)

- **Inspiration outside Recruitment** — apply +1/level on any "rally NPCs to an idea" surface? Today only recruit-roll picks it up. Decide if/when other surfaces appear.
- **First Impression re-do vs. stack** — current behavior is stack-with-clamp; CRB implies discrete re-do. Either is defensible; pin a decision.
- **Apprentice gate strict vs. CRB** — keep HI-only or relax to "HI or Wild Success" per CRB? Currently HI-only by your call; just confirming it's deliberate.

---

## Canon citations

- **First Impression outcome ladder:** SRD v1.1.17, §07 ("First Impressions" subsection, ~p.6 of layout).
- **Inspiration +1 SMod/level:** Distemper CRB v0.9.2, ch. 9 — Skills, p.59.
- **Recruitment three approaches:** SRD v1.1.17 §08 (Communities → Recruit Check); CRB v0.9.2 ch. 10 — Recruiting NPCs, p.168-171 (Cohort / Conscription / Conversion subsections).
- **Apprentice gate (Wild Success or HI):** CRB v0.9.2 ch. 10 — Apprentices, p.172. SRD §08 also references the Apprentice unlock from each Recruitment outcome table.

*End of extract.*
