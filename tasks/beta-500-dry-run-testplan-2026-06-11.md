# Beta-500 dry-run playtest plan - 2026-06-11

> **DO NOT RUN - 2026-06-12.** UI labels in this plan were written
> partly from imagination. Caught when Xero asked "what does 'click
> Charm' mean" - the Recruit modal has no Charm button (actual
> approaches are Cohort / Conscript / Convert). Other sections likely
> have similar fabrications. Puffer is doing a section-by-section UI
> verification pass against the live code + rewriting before this
> plan is safe to run. Until the DO NOT RUN banner is removed, treat
> the plan as a sketch, not a script.

**Format:** numbered actions only. At the end of each section, take a
screenshot (or describe in plain English) and report back. Claude
parses the report-back and decides what passed.

**Setup:**
1. Open a new test campaign called "Drain Drill" (or any fresh
   campaign).
2. Add at least 2 PCs (one yours, one for someone else - the kids
   work).
3. Add 1 community to the campaign + 1 NPC member of that community.
4. Turn the recorder ON via the chrome ⏺ button. Leave it on for the
   whole session.

---

## Section 1: RECRUIT

### 1A. Basic recruit

1. Open the `/campaign-sheet` for "Drain Drill".
2. Open the community panel.
3. Click `Recruit` on a PC's row.
4. In the modal, click `Charm`.
5. Click `Roll`.
6. Wait for the roll result, then close the modal.

**Report back:** screenshot the screen after Step 5 + the screen after
Step 6. If anything errored or didn't open, say what.

### 1B. Poach attempt

1. Add a 2nd community to the same campaign.
2. Move 1 NPC into that 2nd community.
3. Go back to community #1 + try to `Recruit` the NPC from
   community #2 the same way as 1A (Step 3 - Step 5).

**Report back:** screenshot the roll modal during Step 3. Especially
the area where CMods and bonus chips show up.

### 1C. Approach lock

1. In the campaign's community admin, lock community #1 to a single
   approach (Coerce only).
2. Open the Recruit modal again on a PC in community #1.
3. Try to click `Charm`.

**Report back:** screenshot the approach picker + tell me whether
`Charm` was clickable or not.

---

## Section 2: ADVANTAGES

### 2A. Grant

1. Open a PC's character sheet (click the PC name on
   `/campaign-sheet`).
2. Find the Advantages tab/section + open it.
3. Click `Grant Advantage` (or the equivalent).
4. Pick the first item from the list.
5. Confirm the grant.
6. Refresh the browser page.

**Report back:** screenshot the Advantages tab BEFORE granting,
AFTER granting, AND after the refresh. If any step had no button or
no list, tell me which.

### 2B. Use

1. Switch to the player's browser tab (whoever owns the PC), or use
   the GM-override if there's one.
2. Open the same PC's sheet + Advantages tab.
3. Fire a normal skill check from the table page on that PC.
4. In the roll modal, look for any `Use Advantage` button.
5. Click `Use Advantage` if you see it.
6. Click `Roll`.
7. Switch back to the GM screen + reopen the PC's Advantages tab.

**Report back:** screenshot the roll modal at Step 4 (before Use),
the feed row after Step 6, and the GM Advantages tab after Step 7. If
the `Use Advantage` button wasn't visible at all, say so.

---

## Section 3: FIRST IMPRESSION

### 3A. Run the FI flow

1. Open the table page on a campaign with a PC + a fresh NPC the PC
   hasn't introduced themselves to.
2. Click the PC's `First Impression` button (in the action row or
   the special-check picker).
3. Pick the target NPC in the modal.
4. Click `Roll`.
5. Close the modal.

**Report back:** screenshot the modal at Step 3 (the layout) + the
feed row that landed after Step 5. Specifically, tell me whether
Step 1 -> Step 5 was a single modal or had multiple separate windows.

### 3B. Insight Die

1. Repeat 3A Steps 1 - 4, but re-roll until the result is either a
   Low Insight (1+1) or a High Insight (6+6). Up to 3 attempts.
2. When you get LI or HI, look at the modal for any Insight Die
   button/option.
3. If you see it, click `Spend Insight Die`.
4. Close the modal.
5. Note the PC's `Insight Dice` count on their sheet.
6. Repeat 1 - 4 once more, but this time `Decline` the Insight Die.
7. Note the `Insight Dice` count again.

**Report back:** the PC's Insight Dice count at Step 5 + at Step 7,
and a screenshot of the modal at Step 2 showing the Insight Die
offer (if it appeared).

---

## Section 4: STRESS NARRATIVES

For this section, just RUN as many of the 9 actions below as you
can in 1 - 2 rounds of combat plus a couple non-combat checks. After
each one fires, the feed will write a row. **Screenshot the feed**
after the whole sequence (or after each action if easier). Claude
reads the feed text + compares to canon.

Targets: 6+ of the 9 actions. Pick whichever fit the campaign
narrative.

1. **HEAL** - a PC with Medicine* heals a wounded PC.
2. **UNJAM** - a PC fires a firearm + the dice land Dire Failure
   (jams the weapon). Next round, Ready Weapon -> Unjam.
3. **REPAIR** - same shape as UNJAM but with a melee weapon (Dire
   Failure breaks it, then Ready Weapon -> Repair).
4. **Stabilize** - drop a PC to 0 WP (via env damage or GM damage),
   another PC clicks Stabilize.
5. **Gut Instinct** - GM triggers Gut Instinct on a PC (GM Tools or
   action row).
6. **Group Check** - everyone in the party rolls the same skill
   together (Stealth, Athletics, whatever fits).
7. **DRIVE** - drive check from the vehicle popout.
8. **BREW** - brew supplies check from the vehicle popout.
9. **NAVIGATE** - navigate check from the vehicle popout.

**Report back:** screenshot the roll feed at the end of the section
(or paste the feed text). Make sure each row's narrative is visible
in the screenshot.

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
