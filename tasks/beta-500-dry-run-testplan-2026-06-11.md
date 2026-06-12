# Beta-500 dry-run playtest plan - 2026-06-11

**Purpose:** exercise the 4 HOPED-FOR systems (Recruit / Advantages /
First Impression / Stress narratives) with concrete step-by-step
actions before Beta-500 opens 2026-07-01.

**Format:** every step is DO + OBSERVE + PASS/FAIL. No prose, no
"options," no debug pointers. Findings get routed in separate docs.

**Setup before starting:**
1. Open a NEW test campaign called "Drain Drill" (or reuse an
   existing fresh campaign).
2. Add at least 2 PCs (one Xero-controlled, one any other).
3. Add 1 community + 1 NPC member of that community (for the Recruit
   test).
4. Turn the playtest recorder ON via the chrome ⏺ button. Keep it on
   for the full session.

---

## 1. TIER-2 RECRUIT

### 1A. Basic recruit + approach gates

Step 1. Open the campaign's `/campaign-sheet`.
Step 2. Open the community panel for the test community.
Step 3. Click `Recruit` on a PC roster entry.
   - **OBSERVE:** the Recruit modal opens.
   - **PASS** if the modal opens within 1 second.
   - **FAIL** if no modal, or a different modal.

Step 4. Inside the modal, look at the Approach row.
   - **OBSERVE:** all 4 approach buttons (Charm / Coerce / Negotiate /
     Inspire) render.
   - **PASS** if all 4 are clickable.
   - **FAIL** if any are missing or disabled without explanation.

Step 5. Click the `Charm` approach button.
   - **OBSERVE:** the modal updates - the picked approach highlights,
     the skill row shows the Charm-mapped skill, the CMod chips
     update.
   - **PASS** if the highlight + skill + CMod all visibly update.
   - **FAIL** if any one of those three does not respond to the click.

Step 6. Click `Roll`.
   - **OBSERVE:** a roll modal fires with the recruit label
     ("Recruiting <name> via Charm" or similar).
   - **PASS** if the roll fires + a roll_log row writes (visible in
     the feed).
   - **FAIL** if no roll, no feed row, or the feed row says something
     other than the recruit label.

Step 7. On Success outcome only: look at the community roster.
   - **OBSERVE:** the recruited member appears in the roster within 3
     seconds of the roll resolving.
   - **PASS** if member appears.
   - **FAIL** if no member, OR member appears in the wrong community.

### 1B. Poaching penalty

Step 8. Open a different community in the same campaign (or add one).
   Move at least 1 NPC member into it.
Step 9. Return to the original community and try to Recruit the NPC
   from the new community via the same flow as above (1A Step 3 - Step 6).
   - **OBSERVE:** in the roll modal's CMod chip strip, a "-2 Poaching"
     chip (or equivalent label) appears.
   - **PASS** if the poaching chip is visible.
   - **FAIL** if no chip, or the modal just gives the normal roll
     without the penalty.

### 1C. Approach-lock gate

Step 10. Open the campaign's community admin.
Step 11. Lock the test community to a SINGLE approach (e.g.,
   "Coerce only").
Step 12. Try to recruit via `Charm` per 1A Step 3 - Step 5.
   - **OBSERVE:** the Charm button is either disabled, hidden, or
     shows an explicit "locked" affordance.
   - **PASS** if the disallowed approach cannot be picked.
   - **FAIL** if Charm is still clickable and produces a roll.

**Coverage box:** [ ] 1A pass [ ] 1B pass [ ] 1C pass

---

## 2. ADVANTAGES (P3 Q4-b)

### 2A. Grant an Advantage

Step 1. Open the GM's view of any PC's character sheet (e.g., from
   `/campaign-sheet` -> click PC name).
Step 2. Find the Advantages tab or section.
   - **OBSERVE:** the tab exists + is clickable.
   - **PASS** if it opens.
   - **FAIL** if no tab visible at all.

Step 3. Click `Grant Advantage` (or equivalent).
   - **OBSERVE:** a picker opens listing the Advantage library
     (multiple categories + named entries).
   - **PASS** if the picker opens + lists at least 5 grantable
     Advantages.
   - **FAIL** if no picker, or an empty library.

Step 4. Pick the FIRST Advantage in the list and confirm the grant.
   - **OBSERVE:** the picker closes; the granted Advantage appears in
     the PC's Advantages tab.
   - **PASS** if it appears.
   - **FAIL** if it doesn't.

Step 5. Refresh the browser page on the PC's sheet.
   - **OBSERVE:** the granted Advantage is STILL there.
   - **PASS** if persistent across refresh.
   - **FAIL** if it vanished (local-state-only bug).

### 2B. Use the Advantage on a roll

Step 6. Switch to the PC's owning player's browser (or use the GM
   override).
Step 7. Open the PC's sheet, navigate to the Advantages tab.
   - **OBSERVE:** the player sees the granted Advantage in their tab.
   - **PASS** if visible.
   - **FAIL** if not visible to the player.

Step 8. Fire any standard roll (e.g., a skill check the Advantage
   applies to).
Step 9. In the roll modal's preRoll extras, find the `Use Advantage`
   button.
   - **OBSERVE:** the button is visible + clickable.
   - **PASS** if visible.
   - **FAIL** if no button - the Advantage doesn't surface at roll
     time.

Step 10. Click `Use Advantage`. Then click `Roll`.
   - **OBSERVE:** the roll fires; in the feed an "Advantage used:
     <name>" line writes (or the roll-row mentions the Advantage).
   - **PASS** if feed shows the Advantage was used.
   - **FAIL** if no feed line OR the Advantage is silently consumed.

Step 11. Return to GM screen.
   - **OBSERVE:** the GM sees the Advantage marked as used on the PC's
     sheet within 3 seconds (C3 broadcast).
   - **PASS** if GM sees it consumed in realtime.
   - **FAIL** if GM still sees it as available.

**Coverage box:** [ ] 2A pass [ ] 2B pass

---

## 3. FIRST IMPRESSION (single-modal + Insight Die)

Step 1. Have a PC in a room with an NPC they have NOT introduced
   themselves to yet (new NPC or fresh campaign).
Step 2. From the table page, click the PC's `First Impression` button
   (in the social action row or the special-check picker).
   - **OBSERVE:** a SINGLE modal opens (one panel, not a multi-step
     wizard).
   - **PASS** if exactly one modal is on screen.
   - **FAIL** if a multi-step flow opens, or no modal.

Step 3. Pick the target NPC from the dropdown in the modal.
Step 4. Click `Roll`.
   - **OBSERVE:** the dice roll resolves in the same modal (no second
     popup, no separate result view).
   - **PASS** if the result appears in the same modal.
   - **FAIL** if a separate modal opens for the result.

### 3A. Insight Die offer on Low Insight or High Insight

Step 5. Repeat Step 2 - Step 4 until the result is Low Insight (1+1)
   OR High Insight (6+6). Re-roll up to 3 times if needed.
   - **OBSERVE:** when LI or HI fires, an `Insight Die` offer appears
     within the modal.
   - **PASS** if the offer appears on LI/HI.
   - **FAIL** if no offer fires.

Step 6. Click `Spend Insight Die` (or the equivalent affirmative).
   - **OBSERVE:** the PC's `insight_dice` count decrements by 1 on the
     sheet, AND the roll result updates with the bonus.
   - **PASS** if both happen.
   - **FAIL** if either doesn't (decrement missing OR bonus not
     applied).

Step 7. Click `Done` to close the modal.
   - **OBSERVE:** the FI roll lands in the feed with a roll_log row.
   - **PASS** if feed row visible.
   - **FAIL** if no feed row.

### 3B. Insight Die decline

Step 8. Repeat Step 2 - Step 5 until another LI/HI fires.
Step 9. Click `Decline` (or close without spending).
   - **OBSERVE:** the PC's `insight_dice` count is UNCHANGED.
   - **PASS** if no change.
   - **FAIL** if the decrement still happens.

**Coverage box:** [ ] 3A pass [ ] 3B pass

---

## 4. STRESS 12-STRING NARRATIVES

The goal here is to hit AT LEAST 6 of the 12 narrative surfaces. Each
surface should produce a unique-feeling roll-feed line. Same outcome
(e.g., Success) on DIFFERENT surfaces should produce DIFFERENT
narrative strings - that's the canon promise the 12-string lock
delivers.

For each surface below, perform the action + read the resulting feed
row text.

### 4A. HEAL

Step 1. From the table page during combat, click `Heal` on a PC who
   has Medicine* skill, target another PC who has lost some WP.
Step 2. Click `Roll`.
   - **OBSERVE:** the resulting feed row contains HEAL-specific
     narrative (mentions stitching, bandage, surgery, or similar -
     NOT a generic "rolled X").
   - **PASS** if the row mentions Medicine/healing-flavored language.
   - **FAIL** if the row is generic.

### 4B. UNJAM

Step 3. Force a firearm jam: have a PC fire a firearm and target a
   Dire Failure (re-roll until it happens).
Step 4. The next round, click `Ready Weapon` -> `Unjam` on that PC.
Step 5. Roll the Unjam check.
   - **OBSERVE:** feed row contains Unjam-specific narrative
     (mentions clearing, jam, slide, action).
   - **PASS** if specific.
   - **FAIL** if generic.

### 4C. REPAIR

Step 6. Same shape as 4B but with a MELEE weapon (Dire Failure ->
   weapon goes broken-state).
Step 7. Click `Ready Weapon` -> `Repair`.
Step 8. Roll.
   - **OBSERVE:** Repair-specific narrative (mentions hammer,
     re-haft, sharpen, etc.).
   - **PASS** if specific.
   - **FAIL** if generic.

### 4D. Stabilize

Step 9. Drop one PC to 0 WP (via GM damage or env damage).
Step 10. Another PC clicks `Stabilize`.
Step 11. Roll.
   - **OBSERVE:** Stabilize-specific narrative (mentions pulse,
     pressure, breathing).
   - **PASS** if specific.
   - **FAIL** if generic.

### 4E. Gut Instinct

Step 12. GM triggers Gut Instinct on any PC (GM Tools or the action
   row).
Step 13. Roll.
   - **OBSERVE:** Gut Instinct-specific narrative (intuition, hunch,
     feeling).
   - **PASS** if specific.
   - **FAIL** if generic.

### 4F. Group Check

Step 14. Trigger a group skill check (e.g., everyone rolls Stealth at
   the same time).
Step 15. Roll.
   - **OBSERVE:** Group Check narrative for each participant (or one
     summarizing row).
   - **PASS** if the group dynamic is reflected in the rows.
   - **FAIL** if just N copies of a generic single-PC row.

### Optional remaining surfaces (any 0-4 of these to hit 10 total):

- 4G. DRIVE - vehicle drive check.
- 4H. BREW - vehicle brew supplies check.
- 4I. NAVIGATE - vehicle navigate check.

For each: drive/brew/navigate from the vehicle popout, roll, observe
that the feed row is surface-specific.

**Coverage box:** [ ] 4A [ ] 4B [ ] 4C [ ] 4D [ ] 4E [ ] 4F
[ ] 4G [ ] 4H [ ] 4I

Need 6+ checked for this section to pass.

---

## After the session

1. **Stop the recorder.** All clients dump to Downloads.
2. **Report to Puffer:** which `[ ]` boxes hit PASS, which hit FAIL.
3. **For each FAIL:** describe what you saw + what you expected, in
   the chat. Puffer routes findings to lanes.
4. **If 100% of the marked boxes pass:** the 4 HOPED-FOR items demote
   from HOPED-FOR to PLAYTESTED RECENTLY in
   [tasks/debug-handoff.md](debug-handoff.md) Section 3.

That demotion is the substrate signal that Beta-500 readiness is
complete on the mechanics axis.
