# Consolidated mechanics verify - 2026-07-06 (the pre-launch gate)

One sitting closes the ~8 owed live-verifies. Two browser windows on the same
campaign table: **GM window** (you as GM) and **PLAYER window** (a second login
that owns a PC at that table). Work top to bottom. After each numbered block,
tell me what you saw in plain words - I'll check it against what should happen.
If a button isn't where I said, just say so; that's useful too.

Table: `https://thetapestry.distemperverse.com/stories/<your-campaign>/table`
The "roll feed" = the Logs panel on the table.

---

## Block 1 - Checks menu (no combat needed)

Do these from the header **Checks** menu. Have at least one PC at the table and
one NPC revealed or on the map.

1. **First Impression.** In the PLAYER window: Checks -> First Impression. Pick a
   skill, pick the NPC, click Roll First Impression. Do NOT click the green
   "spend an Insight" boxes. Before rolling, glance at that PC's Insight row on
   their card (the row of up-to-10 blocks) and count the filled green ones. Roll.
   If the feed says "Moment of Insight", re-count the filled green Insight blocks.
   Roll a few times if needed to get a "Moment of Insight" result. Tell me the
   green-block count before and after that result.
2. **Heal.** Checks -> Heal. Pick a target PC, pick a kit, roll. Tell me the line
   that appears in the roll feed.
3. **Gut Instinct.** Checks -> Gut Instinct, click a PC. Tell me the feed line.
4. **Group Check.** Checks -> Group Check, run it. Tell me the feed line.

## Block 2 - Combat (roll initiative first)

Set up a fight: GM places an armed NPC next to a player's PC, start combat.

5. **Disarm -> loot -> fire.** On the PC's turn (PLAYER window): action bar ->
   Disarm, target the NPC, roll (repeat on later turns until it lands). When it
   lands, tell me what appears on the NPC's cell and what the NPC's combat bar
   looks like. Then on a PC's turn, open the dropped weapon on the map, take it,
   open Ready Weapon -> Equip from Inventory, equip it, and tell me whether that
   PC can then attack with it.
6. **Grapple.** On a PC's turn, action bar -> Grapple, target an adjacent enemy,
   roll. Tell me the feed line and whether the target shows a grappled state.
7. **Unjam / Repair.** On a PC's turn with a readied weapon, open Ready Weapon.
   For a gun you'll see Unjam; for a melee weapon you'll see Repair. Click it,
   roll. Tell me the feed line.
8. **End-of-combat infection.** Have the armed NPC wound a player's PC during the
   fight, then GM ends combat. Watch the PLAYER window (not yours). Tell me
   whether an "Infection Check (Wound)" roll window pops up on the player's own
   screen.

> Broken-weapon gate (optional, fiddly): to see it you first need a weapon at
> Broken condition. If you have one, on that PC's turn click Attack and tell me
> what message appears. If not, skip it - the unit tests cover it.

## Block 3 - Vehicle popout (2 windows)

GM places a vehicle token on the map. Click it -> Popout (opens a tall window).

9. **Seat propagation.** In the popout, seat a crew member in the Driver seat and
   confirm. Watch the vehicle token in the OTHER window. Tell me what changed on
   that token (a seat/passenger badge, a token disappearing into the seat).
10. **Vehicle checks.** In the popout, run the Driving Check, the Navigate check,
    and the Brew check (each needs its seat filled; Brew needs a still + supplies).
    Tell me the feed line each produces, or which button was greyed out.

## Block 4 - Tactical canvas scale (2 windows)

Open the same tactical scene in both windows, GM on a wide window, player on a
narrow one.

11. Tell me whether the background art lines up with the grid the same way in both
    windows (pick a landmark and say whether it's on the same grid cell for both),
    and whether every token sits on the art rather than in black empty space.
12. GM: drag a corner handle to resize the background, then reload both windows.
    Tell me whether the resized art persisted and whether both windows show the
    same size.

## Block 5 - Other surfaces

13. **Stockpile deposit.** PLAYER window: open the PC's Inventory, pick an item,
    deposit it to a community stockpile (a purple community recipient). Tell me
    whether it left the inventory, and whether it shows up in that community's
    stockpile in the other window without a refresh.
14. **World-map pin.** Both windows open the world map. Add a pin in one window.
    Tell me whether it appears in the other window on its own. (If you can't find
    the Add-a-Pin control, tell me - I'm not certain of its exact label.)

## Block 6 - Rest (anytime)

15. On a PC's card click Rest, enter some hours/days, apply. Tell me whether the
    card's Wound / Resolve / Stress pips changed and whether the campaign clock
    moved.
