# Disarm + Looted-Weapon Fix - Test Plan (2026-06-23)

Live (give Vercel ~2 min after push): https://thetapestry.distemperverse.com
Use the EMPTY playtest campaign. You need two browser windows: a GM window and a
player window (a second profile or an incognito player who controls a PC). Both
must be on the same active tactical scene with tokens placed.

## A. Disarm an armed NPC, then loot + use its weapon

1. As GM, put an armed NPC (one with a ranged or melee weapon equipped) onto the
   tactical map, within 5 ft (adjacent cells) of a player's PC token.
2. Start combat / roll initiative so it is the PC's turn.
3. In the PC's action bar, click "Disarm".
4. In the modal, leave the skill on "Unarmed", pick the NPC as the target, click
   "Roll Disarm". (If the roll loses, end the turn, come back to the PC's next
   turn, and Disarm again until it wins.)
5. On a winning roll, look at the map cell where the NPC is standing and at the
   roll feed.
6. As the same player on the PC's next turn (or another PC adjacent to that
   cell), open the dropped weapon token on the map and loot/take the weapon.
7. Open that looter's "Ready Weapon", look at the "Equip from Inventory" list,
   click the looted weapon to equip it, then look at the combat bar.

Report back: what the banner said after the disarm roll, whether a weapon token
appeared on the ground at the NPC's cell, whether the NPC's combat bar lost its
weapon, whether the looted weapon showed up in "Equip from Inventory", and
whether the looter could fire/attack with it after equipping.

## B. Disarm switching the attacker skill to Athletics

1. On a PC's turn with an adjacent armed target, click "Disarm".
2. In the modal, click the "Athletics" button (top row), then pick the target
   and click "Roll Disarm".

Report back: whether the subtitle/formula and the result breakdown line showed
"Athletics" (with that skill's number) instead of "Unarmed".

## C. Disarm an armed PC (GM-driven or NPC attacker)

1. Equip a PC with a primary weapon.
2. Have an adjacent NPC (or another PC) Disarm that PC and win the roll.
3. Open the disarmed PC's sheet / combat bar and the map.

Report back: whether the PC's primary weapon slot went empty, whether the weapon
appeared as a token on the ground, and whether another character could loot and
Ready it.

## D. General looted-weapon fix (regression check, no disarm)

1. As GM, add a destructible object (e.g. a crate) to the map, put a weapon in
   its contents, and either destroy it or mark it lootable.
2. As a player, open that object and take the weapon.
3. Open that PC's "Ready Weapon" and look at "Equip from Inventory".

Report back: whether the weapon you looted from the crate now appears in the
"Equip from Inventory" list and can be equipped (before this fix it vanished
into a slot the combat screen never reads).
