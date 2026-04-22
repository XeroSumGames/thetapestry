# Test Plan — Recruitment Insight Dice + Community Screen + Milestone Notification

## Change 1: "as a Cohort" copy

**What changed:** Recruitment success copy reads `"Jesse Hayes joined The Schoolers as a Cohort."` (article added). Applies to both the Recruit result modal and the roll_log feed entry. `Apprentice` uses `"an Apprentice"`.

**Files touched:**
- `app/stories/[id]/table/page.tsx` lines 2540 (roll_log label) + 8080 (result modal)

**Steps:**
1. Roll a successful Recruit vs any NPC. Confirm result modal and feed both read `"as a Cohort"` (or `"as an Apprentice"` on Wild Success + toggle).

---

## Change 2: Group → Community milestone notification

**What changed:** When active membership crosses into 13+ for the first time, the `leader_user_id` gets a one-shot notification.

**Files touched:**
- `sql/community-milestone-trigger.sql` — **new migration, must be run in Supabase SQL Editor**
- `components/NotificationBell.tsx` — colorized renderer for the new `community_milestone` type

**SQL to run:** `C:\TheTapestry\sql\community-milestone-trigger.sql`

**Steps after migration:**
1. Back-fill check: `SELECT c.name, c.notified_community_milestone, (SELECT count(*) FROM community_members m WHERE m.community_id=c.id AND m.left_at IS NULL AND COALESCE(m.status,'active')='active') FROM communities c;` — any already ≥13 should have `notified_community_milestone = true`.
2. Cross the threshold via Recruit/Invite/approve until active count hits 13. Expect bell notification **"Your group is now a Community"** linking to `/communities`.
3. Bell colorization: community name red, `13` amber, `Community` green.
4. Remove a member and re-add. Expect **no** second notification.

---

## Change 3: Insight Dice on Recruitment modal

**What changed:** The Recruitment flow now supports both pre-roll Insight Die spends (3d6 / +3 CMod) AND post-roll reroll (pick any single die to reroll). Reroll flips `community_members` state if the outcome crosses the success line.

**Files touched:**
- `app/stories/[id]/table/page.tsx` — `executeRecruitRoll` pre-roll branch, `rerollRecruitDie`, pick-step picker UI, result-step reroll buttons, result modal renders `die3` when `mode3d6`.

**Preconditions:**
- PC with ≥2 Insight Dice available (one for pre-roll, another for a reroll test).
- At least one NPC map-revealed, alive, not already in the target community.

### 3.1 Pre-roll: baseline (None)
1. Open `/stories/[id]/table`, CHECKS → Recruit.
2. Pick target NPC, approach, skill, community.
3. Leave Insight Die = **None**. Click Roll.
4. Expect: standard 2d6 + mods. Insight Dice count unchanged.

### 3.2 Pre-roll: Roll 3d6
1. Same setup but pick **Roll 3d6** in the Insight Die section.
2. Click Roll.
3. Expect: 3 dice render in the result modal. Sum of (d1+d2+d3) + AMod + SMod + CMod shown in the breakdown. Outcome uses thresholds 14+/9+/4+/<4 (Wild/Success/Failure/Dire). Insight Dice count decremented by 1.

### 3.3 Pre-roll: +3 CMod
1. Same setup but pick **+3 CMod**.
2. Click Roll.
3. Expect: 2 dice render. Breakdown's CMod cell is 3 higher than the plain CMod stack. Insight Dice count decremented by 1.

### 3.4 Post-roll reroll: Die 2 (2d6)
1. After a 2d6 roll, expect a purple "Spend Insight to Reroll" panel listing `Re-roll Die 1` and `Re-roll Die 2`.
2. Click **Re-roll Die 2**.
3. Expect: Die 2 value changes, total recomputes, outcome recomputes, Insight Dice count drops by 1. Apprentice toggle re-evaluates for the new outcome.
4. Spam reroll again to confirm the button still works and count drops again (no reroll lockout — each press costs 1 die).

### 3.5 Post-roll reroll: Die 3 (3d6)
1. Start a 3d6 recruit (spends 1 die).
2. In result step, expect `Re-roll Die 1`, `Re-roll Die 2`, `Re-roll Die 3` all visible.
3. Click **Re-roll Die 3**. Confirm only Die 3 changes; total/outcome recompute.

### 3.6 Outcome flip reconciliation
1. Force a Failure on a recruit attempt (low dice). Confirm no `community_members` row inserted (result modal shows "attempt failed").
2. Reroll Die 1 until you flip to Success.
3. Expect: `community_members` row now present for that NPC in the chosen community. Feed log label updates from `"tried to recruit ... — Failure"` → `"recruited ... as a Cohort to <community>"`.
4. Reverse: on a Success, reroll to push back below the success line. Expect: membership row deleted, label reverts.

### 3.7 Exhausted Insight
1. PC with 0 Insight Dice: open Recruit pick step → no Insight Die picker renders. Result step → no reroll panel.

---

## Change 4: Community screen — names, role counts, PC block

**What changed:** The in-campaign community management panel now:
- Shows each NPC's **name** bold/prominent at the front of each row (with recruitment type as a subdued suffix).
- Auto-calculates Gatherer / Maintainer / Safety percentages from **NPCs only**. PCs are excluded from role workforce math.
- Renders a dedicated "Player Characters (N)" block between the role bars and the NPC-by-role roster.
- PCs still have a role dropdown but default to Unassigned.

**Files touched:** `components/CampaignCommunity.tsx`

### Steps:
1. Open a campaign with a community that has both PCs (founders) and NPCs recruited in.
2. Expect role bars: `count / total NPCs` (e.g. "1 (8%)" — should be counting NPC workforce only, so if 1/12 NPCs are Gatherers: 8%).
3. PC rows show up in a blue-bordered "Player Characters" block beneath the Safety bar, above the first NPC role header.
4. NPC rows display name (bold uppercase, left), recruitment type (subdued, right of name), role dropdown, ✕.
5. Change a PC's role via the dropdown → confirm the role bars do **not** shift (they're npc-only).
6. Change an NPC's role → confirm the role bars update immediately.
7. New joiners default to Unassigned (both founder auto-enroll and add-member form).
