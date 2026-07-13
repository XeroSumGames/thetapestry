# Playable-Loop Smoke Testplan - 2026-07-10

Runnable core-loop walkthrough. Numbered DO steps with branches. Where a step
asks "did X happen?", just note your answer and keep going - you report the
whole run back at the end and I parse it against what SHOULD happen.

Live site: https://thetapestry.distemperverse.com

Parts A-C are ONE browser (you as GM). Part D needs a SECOND browser window
logged in as your player account.

NOTE: several combat steps below are expected to expose the known Tier 1 bugs
(they aren't fixed yet as of this morning). That's fine - the branches capture
what you see so we confirm the audit against live and get clean repro.

---

## PART A - Character + Story setup (one browser)

1. Go to the live site and make sure you're logged in as your GM/Thriver account.
   1a. If you land on a marketing/landing page, click through to your dashboard.
   1b. Did you reach a dashboard/home with the left sidebar showing? (yes/no)

2. In the left sidebar, click **Random Character**.
   2a. If a character sheet with stats fills in, click whatever button saves/keeps
       it (e.g. Save / Create / Keep).
   2b. Did a finished character with a name, RAPID stats, and at least one weapon
       get created? (yes/no - and note the character's name + its primary weapon)

3. In the sidebar, open your character list (**My Survivors** / **Characters**)
   and find the character from step 2. Note its starting **WP** and **RP** numbers.
   3a. Did the card show WP and RP values? (write them down)

4. In the sidebar click **My Stories** (or **Create a Story** / **New Story**).
   Create a new story: give it any name, pick any starting setting, and confirm.
   4a. If it asks for a map/starting view, accept the default.
   4b. Did a new story get created and open to its lobby page? (yes/no)

5. On the story lobby, find where you add your own character to the game and
   assign the character from step 2 as your survivor.
   5a. Did your character appear in the party/roster for this story? (yes/no)

---

## PART B - Table, session, combat (same browser)

6. From the story, click **Launch** (or open the Table) to enter the table
   full-screen.
   6a. Did the table open with a map and your character's card visible? (yes/no)

7. Start a session (look for **Start Session** or similar - dice/combat are
   locked until a session is open).
   7a. If you see a message that dice/combat need a session, that's the button
       to click.
   7b. Did session controls unlock (you can now start combat / roll)? (yes/no)

8. Add an enemy to fight: open the NPC tools/roster, generate or add one NPC,
   and make sure it's shown/placed on the map.
   8a. Did an NPC appear on the map or in the combatant list? (yes/no - note its name)

9. Start combat (**Into the Moment** / **IN THE MOMENT** - the start-combat
   control). Roll initiative for everyone if prompted.
   9a. Did an initiative/turn bar appear with your character and the NPC in it? (yes/no)

10. Make it YOUR character's turn (advance turns until your PC is active if needed),
    then select your character and click **Attack**, targeting the NPC. Complete
    the roll.
    10a. After the roll resolves, look at the NPC's WP. Did the NPC's WP go DOWN
         by a sensible amount? (yes/no - note the number it dropped by, or "0/no change")
    10b. If the damage was 0 or looked obviously wrong, note that.

11. Now make it the NPC's turn and have the NPC **Attack** your character (as GM
    you drive the NPC's attack). Complete the roll.
    11a. Did YOUR character's WP go down? (yes/no - note the number)
    11b. Look at your character's ammo/clip count on its weapon (if it's a ranged
         weapon). Did the NPC's shot change YOUR character's ammo count? (yes/no)
    11c. Fire the NPC's ranged weapon a few more times. Does the NPC's own ammo
         count ever go down, or does it keep firing forever? (note which)

12. On your character's card, find the weapon panel and click **Reload**.
    12a. Did the clip refill? (yes/no)
    12b. Click Reload again, and again. Does it EVER stop letting you reload
         (run out of spare clips), or can you reload endlessly? (note which)

13. Give your character a combat action again, click **Cover Fire** and target
    the NPC. Complete it.
    13a. Did Cover Fire cost your character an action? (yes/no)
    13b. On the NPC's next turn, when it acts, did it seem to suffer any penalty
         from the Cover Fire, or did nothing change? (note which)

14. Take another attack roll with your character. When the roll result shows and
    you have Insight Dice available, use the green **Spend Insight Dice** option
    to reroll a die.
    14a. Did the reroll change the outcome? (yes/no)
    14b. After the reroll, check the target's WP again. Did the target take
         damage a SECOND time from the same attack (WP dropped twice)? (yes/no)

---

## PART C - Rest and the clock (same browser)

15. End combat (the end-combat control). Then note the current in-game date/clock
    somewhere on the table or campaign sheet (day + hour).
    15a. Did you find a clock/date readout? (write down the day + hour)

16. On your character's card click **Rest**, choose a long rest (e.g. 24 hours),
    and apply it.
    16a. Did your character's WP/RP recover? (yes/no)
    16b. Check the clock again. How many hours/days did it advance by? (write the
         new day + hour)

17. (Only if you have a second character in the party) Rest the SECOND character
    24 hours too, then check the clock once more.
    17a. Did the clock jump AGAIN by another full chunk for the second character?
         (yes/no - note the new day + hour)

---

## PART D - Two-window realtime (needs a SECOND browser)

Open a second browser (or a private/incognito window) logged in as your PLAYER
account. Join the same story with the invite code so you have GM in window 1 and
player in window 2, both at the table.

18. In window 1 (GM), place a NEW pin on the campaign map and set it to
    revealed/shown to players.
    18a. Watch window 2 (player) WITHOUT refreshing. Did the pin appear on the
         player's map on its own within about 30 seconds? (yes/no)
    18b. In window 2, open that pin's popup, and while it's open have window 1
         reveal or move a DIFFERENT pin. Did the open popup in window 2 stay open
         (not slam shut)? (yes/no)

19. In window 1 (GM), move one of your character tokens on the tactical map.
    19a. Did the token move in window 2 within a couple seconds? (yes/no)

20. In window 1, advance the in-game clock/time (the Advance Time control) while
    a character has an active infection or sickness on them, if you can set one up;
    otherwise just advance time normally.
    20a. Did the Advance Time action COMPLETE (the modal closed and the clock moved),
         or did it hang/spin and never finish? (note which)
    20b. Did the table in BOTH windows stay responsive afterward (turns still work,
         nothing frozen)? (yes/no)

21. (If you have a vehicle in the story) Open the vehicle popout in window 1 and
    toggle a mounted weapon's firing arc.
    21a. Did the firing-arc change reflect in the other window / on the map? (yes/no)

---

## Report back

Paste your answers back in one message - just the step numbers and what you saw
(numbers, yes/no, and any "that looked wrong" notes). You don't need to judge
pass/fail; I'll compare it against the expected behavior and tell you which are
real bugs, which are already-known, and which are clean.
