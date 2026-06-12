# Beta-500 dry-run playtest plan - 2026-06-11

**Format:** numbered actions only. At the end of each section, take a
screenshot (or describe in plain English) and report back. Claude
parses the report-back and decides what passed.

**Setup:**
1. Open a fresh test campaign (any name - "Drain Drill" works).
2. Add at least 2 PCs (one yours, one for someone else).
3. Add at least 2 NPCs to the campaign NPC pool.
4. Turn the recorder ON via the chrome circle button (top bar). Leave
   it on for the whole session.

---

## Section 1: RECRUIT

Recruit lives entirely on the **table page** (`/stories/[id]/table`),
not the campaign sheet. The entry point is the **Checks** dropdown in
the top header bar.

### 1A. Basic recruit

1. Open the table page for your test campaign.
2. In the top header, click the purple **Checks** button.
3. Click **Recruit** in the dropdown.
4. The Recruit modal opens. In the **Target NPC** dropdown, pick any
   NPC from the list. (If the list is empty, close the modal, make
   sure at least one NPC is visible on the map or in the sidebar, then
   re-open.)
5. In the **Community** field: if this is the first recruit, you will
   see a green "First recruit - starts a new group" message with no
   dropdown. That is correct. If a dropdown appears, leave it as-is
   for now.
6. In the **Approach** row, click **COHORT**.
7. In the **Skill** dropdown, pick any option from the Suggested list
   at the top.
8. Click **Roll**.
9. Wait for the result, then close the modal.

**Report back:** screenshot the modal at Step 4 (showing the NPC
dropdown and approach buttons), and screenshot the roll feed row that
appeared after Step 9. If anything errored or the modal didn't open,
say what.

### 1B. Poach attempt

This tests poaching an NPC that is already in a group.

1. Repeat Steps 2-3 from 1A (Checks → Recruit).
2. In the **Target NPC** dropdown, pick the SAME NPC you just
   recruited in 1A.
3. Look below the NPC dropdown. A yellow warning banner should appear
   reading "Poaching: [name] is already in [group] (-3 CMod)".
4. In the **Approach** row, click **COHORT**.
5. Pick any Skill, then click **Roll**.

**Report back:** screenshot the modal at Step 3 showing the yellow
warning, and screenshot the roll result after Step 5.

### 1C. Conscript gate

This tests that Conscript requires an acknowledgment before rolling.

1. Repeat Steps 2-4 from 1A (Checks → Recruit, pick any NPC).
2. In the **Approach** row, click **CONSCRIPT**.
3. A red banner should appear below the approach buttons.
4. Pick any Skill, then click **Roll**.
5. A confirmation dialog should appear before the dice fire. Dismiss
   it (click Cancel or OK - either is fine for this test).

**Report back:** screenshot the modal at Step 3 showing the red
Conscript banner, and whether the confirmation dialog appeared at
Step 4.

---

## Section 2: ADVANTAGES

Advantages are GM-granted bonuses tied to specific PC roll moments,
then "used" by the player to add CMod / re-roll-flavor to a later
roll. The flow lives entirely on the table page (`/stories/[id]/table`),
NOT on the character sheet or campaign sheet.

### 2A. Grant (you do this as GM)

1. Open the table page for the campaign you're testing.
2. Make sure a PC has rolled something in the feed - any skill check,
   attack, or weapon roll. If the feed is empty of rolls, run a roll
   first (e.g., have a PC do a Perception check).
3. Look at any dice-roll row in the roll feed (right column). Each
   row has a small gold ⭐ in the bottom-right corner. Hover or look
   carefully - it's small.
4. Click the gold ⭐ on any dice row.
5. A modal opens. Fill in skill / CMod / description.
6. Submit.

**Report back:** screenshot the feed row with the ⭐ visible (step 3),
screenshot the modal that opened (step 4), and screenshot whatever
appears in the feed after step 6. If you can't find the ⭐ on any
row, say so + tell me what view you're on.

### 2B. Use (you do this as the player)

1. Stay on the same table page, in a player-controlled browser tab
   (whichever browser/account owns the PC that received the
   Advantage in 2A).
2. Open the GM Tools sidebar (or whatever sidebar / tab area is
   visible). Click the **Notes** tab.
3. At the TOP of the Notes panel - above the notes themselves - there
   should be an "⭐ Advantages" panel listing any pending Advantages
   on this PC.
4. Click `✓ Use` on the Advantage card.

**Report back:** screenshot the Notes tab BEFORE clicking Use
(showing the Advantage card), screenshot the feed afterwards
(should have a new row reflecting the Use), and screenshot the Notes
tab AFTER (the Advantage card should be gone, or marked consumed).
If there's no ⭐ Advantages panel above the notes, say so.

---

## Section 3: FIRST IMPRESSION

First Impression lives in the **Checks** dropdown, same header bar as
Recruit.

### 3A. Run the FI flow

1. On the table page, click the purple **Checks** button in the top
   header.
2. Click **First Impression** in the dropdown.
3. The FI modal opens. At the top, there is a row of 4 chip buttons:
   **BEST**, **MANIPULATION**, **STREETWISE**, **PSYCHOLOGY**. Click
   any one of them.
4. In the **Target NPC** dropdown (below the chips), pick an NPC.
5. Click **Roll First Impression**.
6. Wait for the result screen. Close the modal.

**Report back:** screenshot the modal at Step 3 (showing the 4 chip
buttons), screenshot the result screen at Step 6, and screenshot the
feed row that appeared. Tell me whether it all happened in one modal
or separate windows.

### 3B. Insight Die

1. Repeat 3A Steps 1-5. After the roll, look at the result screen for
   a pair of green boxes. If they appear, they will look like:
   - "Roll 3d6 / Keep all 3"
   - "+3 CMod / Added to roll"
2. If the green boxes appear, click one of them.
3. Close the modal.
4. Open the PC's character sheet and note their **Insight Dice** count.

If the green boxes do NOT appear on the first attempt, try up to 2
more times. They only appear on Low Insight (both dice show 1) or
High Insight (both dice show 6) results.

**Report back:** the PC's Insight Dice count after Step 4. If the
green boxes never appeared after 3 attempts, say so.

---

## Section 4: STRESS NARRATIVES

For this section, run as many of the 9 actions below as you can.
After each fires, the feed writes a row. Screenshot the feed at the
end (or after each action if easier). Target: 6+ of 9. Pick
whichever fit the session narrative.

All of these are on the **table page** unless noted otherwise. The
entry points are the **Checks** dropdown in the top header and the
**Ready Weapon** button in the action row.

### Actions and exact paths:

1. **HEAL** - Checks dropdown → **Heal**. Picks a wounded target and
   fires a Medicine check.

2. **UNJAM** - A PC fires a ranged weapon and the dice land on Dire
   Failure (the feed row will say "Dire Failure" - the weapon jams).
   On the next turn for that PC, click the **Ready Weapon** button in
   the action row. In the modal that opens, click **UNJAM**. The roll
   fires automatically.

3. **REPAIR** - Same as UNJAM but with a melee weapon. Dire Failure
   on an attack breaks the weapon. Ready Weapon → **REPAIR** (the
   button shows "Repair" instead of "Unjam" for melee weapons).

4. **Stabilize** - Drop a PC to 0 WP using GM damage (GM Tools →
   Env Damage, or ask someone to land a killing blow). Once a PC is
   at 0 WP, a **Stabilize** dropdown button will appear in the action
   row for whoever has Medicine. Click it, pick the mortal target from
   the dropdown, and the roll fires.

5. **Gut Instinct** - Checks dropdown → **Gut Instinct**.

6. **Group Check** - Checks dropdown → **Group Check**. Pick a skill
   from the list (Stealth, Athletics, Perception - anything works).

7. **DRIVE** - Open the vehicle popout for any vehicle in the
   campaign. In the **Crew & Checks** section, find the Driver row
   and click **Driving Check**.

8. **BREW** - Same vehicle popout. If the vehicle has a still, the
   Brewer row shows **Brew Check**.

9. **NAVIGATE** - Same vehicle popout. Navigator row → **Navigate**.

**Report back:** screenshot the roll feed showing the narrative rows
from whichever actions you ran (one screenshot at the end is fine).
List which of the 9 you actually hit. If any step had no button
where expected, say so.

---

## After the session

1. Stop the recorder. All clients dump to Downloads.
2. Send Claude:
   - All recorder JSON dumps from Downloads.
   - All section screenshots described above.
   - One line per section: "ran sections 1A/1B/2A/3A/4" (whichever
     you actually hit).
   - Anything that LOOKED weird, errored, or didn't behave like you
     expected - describe in plain English. No need to know what's
     "right." Just say what happened.

Claude parses the dumps + screenshots + your weirdness notes, and
either:
- Demotes the 4 HOPED-FOR items in the Confidence Ledger if the
  evidence supports it.
- Files findings against any sections that misbehaved + routes them
  to the right lane (HP / E2E / Puffer).
