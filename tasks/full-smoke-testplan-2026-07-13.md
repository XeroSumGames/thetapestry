# Full Smoke Test - 2026-07-13 (everything shipped this session)

Covers all the fixes shipped 2026-07-13: the realtime trio (pins sidebar,
roster, live damage), the combat cluster (attacker damage/ammo, reroll,
upkeep, sickness stress), the ammo canon (fire spends on any outcome; PC
full+1d6, NPC 1d6-1+1d3 loadout; no infinite reload).

Format: numbered DO steps with branches. Where a step asks "did X happen?",
just note the answer and keep going - report the whole run back at the end and
I'll compare against expected behavior.

Live site: https://thetapestry.distemperverse.com

Parts A-C are ONE browser (you as GM). Part D needs a SECOND browser window
logged in as your player account.

---

## PART A - Setup + starting loadout (one browser)

1. Log in as your GM/Thriver account and reach your dashboard.
   1a. Sidebar visible? (yes/no)

2. Sidebar -> **Random Character**. Save/keep the character it rolls.
   2a. Did it create a character with a name + a RANGED weapon (pistol/rifle)?
       (note the character name + the weapon)
   2b. Open the character's sheet/card and find the weapon's ammo + the "Clips"
       (reloads) control. What does the clip show (e.g. 6/6) and how many
       reload pips are filled? (write both numbers)
   2c. **Expected: a FULL clip and 1 to 6 reload pips.** Is the clip full, and
       are the reloads somewhere in 1-6? (yes/no + the numbers)

3. Click **Reload** a few times in a row.
   3a. Does the clip refill and the reload count go DOWN by one each time?
       (yes/no)
   3b. Keep clicking Reload past zero reloads. Does the button eventually stop
       / grey out, or can you reload forever? (note which)

4. Sidebar -> **My Stories** -> create a new Story (any name/setting), then add
   your character from step 2 as your survivor.
   4a. Did the character appear in the party/roster? (yes/no)

---

## PART B - Combat correctness (same browser)

5. Launch the Table, then start a session (so dice/combat unlock).
   5a. Session controls unlocked? (yes/no)

6. Open the NPC tools, generate ONE NPC that has a ranged weapon, and place it
   on the map.
   6a. Did an NPC appear? (note its name)
   6b. Open that NPC's sheet/card and find its weapon ammo. **Expected: an NPC
       starts SCARCE - 0 to 5 loaded rounds (a full clip would be wrong).**
       What does its loaded ammo show? (write the number)

7. Start combat (**Into the Moment**) and roll initiative.
   7a. Turn bar shows your PC + the NPC? (yes/no)

8. On your PC's turn, **Attack** the NPC with your ranged weapon and complete
   the roll (aim for a hit).
   8a. Did the NPC's WP drop by a sensible amount? (note the number)
   8b. Check YOUR PC's ammo. Did firing use exactly ONE round (or the burst
       count for a burst weapon)? (yes/no + new ammo count)

9. Take another shot at the NPC, but this time aim to MISS (or if you can,
   fire with no valid target).
   9a. Did your ammo go DOWN even though it missed / had no target? (yes/no)
   9b. **Expected: yes - firing always spends the round now.**

10. Make it the NPC's turn and have the NPC **Attack** your PC. Fire the NPC's
    weapon a few times across its turn(s).
    10a. Did the NPC's OWN ammo count go down each shot (not stay full forever)?
         (yes/no)
    10b. Did your PC's ammo stay untouched by the NPC's shots? (yes/no)

11. On your PC's turn, take a shot and when the result shows with Insight Dice
    available, use the green **Spend Insight Dice** to reroll a die - and land
    another hit.
    11a. After the reroll, look at the NPC's WP. Did it drop only ONCE more
         (the reroll's damage), or did it take TWO hits' worth? (note the WP
         before the reroll and after)
    11b. **Expected: the reroll REPLACES the first result - only the final
         roll's damage counts, not original + reroll.**

12. (Weapon condition) Do an **Upkeep** check on a weapon that's in **Pristine**
    condition and roll well (Wild Success / a great roll).
    12a. Did the weapon STAY Pristine (not drop to Used)? (yes/no)
    12b. **Expected: a great roll never downgrades a Pristine item.**

---

## PART C - Rest, sickness, clock (same browser)

13. End combat. Note the in-game date/clock (day + hour) somewhere on the table
    or campaign sheet.
    13a. Wrote down the day + hour? (yes)

14. On your PC's card, apply an infection/sickness if you can set one up
    (GM infection tools), then advance the in-game clock forward several days
    (Advance Time) until the sickness reaches its end.
    14a. Did Advance Time COMPLETE (modal closed, clock moved) rather than hang?
         (note which)
    14b. If the sickness dropped your PC to 0 WP (mortally wounded), did a Stress
         pip get added at the same time? (yes/no - check the stress track before
         vs after)

15. On your PC's card, apply a long **Rest** (e.g. 24h).
    15a. Did WP/RP recover? (yes/no)
    15b. Note the clock after the rest (day + hour).

---

## PART D - Two-window realtime (needs a SECOND browser)

Open a second browser (or private window) logged in as your PLAYER account,
join the same Story with the invite code, so window 1 = GM, window 2 = player,
both at the Table.

16. In window 1 (GM), reveal a NEW pin to players.
    16a. In window 2 (player), WITHOUT refreshing, did the pin appear in BOTH
         the map AND the right-side Pins list within ~30 seconds? (yes/no for
         each)
    16b. **Expected: both update on their own now.**

17. In window 2, have the player pick / already have a character selected so
    their sheet/card is showing. In window 1 (GM), deal damage to that player's
    character (attack it, or use a GM damage control).
    17a. In window 2, WITHOUT refreshing, did the character's WP/RP on the
         open card update on its own within a few seconds? (yes/no)

18. Add a SECOND player (or have the player leave and rejoin). In window 1 (GM),
    watch the roster / party list.
    18a. Did the new/returning player appear on their own without you refreshing?
         (yes/no)

19. In window 1, move one of your tokens on the tactical map.
    19a. Did it move in window 2 within a couple seconds? (yes/no)

20. (If you have a vehicle in the Story) Open the vehicle popout in window 1 and
    toggle a mounted weapon's firing arc.
    20a. Did the change reflect in the other window / on the map? (yes/no)

---

## Report back

Paste your answers in one message - step numbers + what you saw (numbers,
yes/no, anything that looked off). No pass/fail judgement needed; I'll compare
against expected behavior and tell you what's clean vs a real bug.
