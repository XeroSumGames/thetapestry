# Weapon Traits Pass 1 — Test Plan

## Cumbersome (requires PHY AMod ≥ X)

### Test 1: Sledgehammer (Cumbersome 2) — penalty applies
1. Start a campaign, open a character with PHY AMod 0
2. Equip Sledgehammer as primary weapon
3. Click the attack button
4. Verify the CMod breakdown shows -2 penalty from Cumbersome

### Test 2: Sledgehammer (Cumbersome 2) — no penalty
1. Use a character with PHY AMod 2 or higher
2. Equip Sledgehammer
3. Click the attack button
4. Verify no Cumbersome penalty in the CMod

### Test 3: Cleaver (Cumbersome 1) — partial penalty
1. Use a character with PHY AMod 0
2. Equip Cleaver
3. Click the attack button
4. Verify -1 CMod penalty from Cumbersome

## Unwieldy (requires DEX AMod ≥ X)

### Test 4: Crossbow (Unwieldy 1) — penalty applies
1. Use a character with DEX AMod 0
2. Equip Crossbow
3. Click the attack button
4. Verify -1 CMod penalty from Unwieldy

### Test 5: Machete (Unwieldy 2) — penalty applies
1. Use a character with DEX AMod 0
2. Equip Machete
3. Click the attack button
4. Verify -2 CMod penalty from Unwieldy

### Test 6: Machete (Unwieldy 2) — no penalty
1. Use a character with DEX AMod 2 or higher
2. Equip Machete
3. Click the attack button
4. Verify no Unwieldy penalty

## NPC

### Test 7: NPC with Cumbersome/Unwieldy weapon
1. Create or edit an NPC, assign a Sledgehammer
2. Click the NPC's attack button
3. Verify penalty applies based on NPC's PHY AMod

## No Regression

### Test 8: Unarmed attack unaffected
1. Click Unarmed Attack on any character
2. Verify no trait penalties applied

### Test 9: Normal weapon unaffected
1. Equip a Heavy Pistol (no traits)
2. Click the attack button
3. Verify no trait penalties applied

### Test 10: Weapon condition still stacks
1. Equip a Worn Sledgehammer on a PHY 0 character
2. Click the attack button
3. Verify CMod shows both condition penalty (-1) and Cumbersome penalty (-2) = -3 total

---

# Weapon Traits Pass 2 — Test Plan

## Stun (Taser, Shiv-Grenade, Flash-Bang)

### Test 11: Taser — Stun zeroes WP
1. Equip a Taser on a character
2. Attack a target, get a Success
3. Verify 0 WP damage dealt, RP damage applies (rpPercent: 400)
4. Verify amber "Stun — no WP damage dealt" note in result

### Test 12: Taser — Stun incapacitation on Wild Success
1. Equip a Taser, attack until Wild Success or High Insight
2. Verify stun duration shown: "Target incapacitated for N rounds"

### Test 13: Flash-Bang — Stun with no damage
1. Equip Flash-Bang Grenade (damage: 0, rpPercent: 0)
2. Attack a target, get a Success
3. Verify 0 WP and 0 RP damage
4. Verify Stun note appears

## Automatic Burst (Assault Rifle, Carbine, Mounted Turret)

### Test 14: Assault Rifle — 3-round burst
1. Equip Assault Rifle (Automatic Burst 3)
2. Attack a target, get a Success
3. Verify damage is rolled 3 times (higher than single roll)
4. Verify "Automatic Burst — 3 rounds fired" note

### Test 15: Mounted Turret — 5-round burst
1. Assign Mounted Turret to an NPC
2. Attack a target
3. Verify "Automatic Burst — 5 rounds fired" note
4. Verify damage is rolled 5 times

## Blast Radius (Grenade, Molotov, RPG)

### Test 16: Grenade — Blast Radius display
1. Equip Grenade, attack a target, get a Success
2. Verify Blast Radius note shows damage at each range:
   "Engaged: X WP | Close: Y WP | Further: Z WP"
3. Verify full damage applied to selected target

## Burning (Flamethrower)

### Test 17: Flamethrower — Burning display
1. Equip Flamethrower, attack a target, get a Success
2. Verify Burning note: "Burning — 3 WP/RP per round for N rounds"
3. Verify N is between 1-3 (1d3 roll)

## Close-Up (Pump-Action Shotgun, Sawed-Off)

### Test 18: Pump-Action Shotgun — Close-Up display
1. Equip Pump-Action Shotgun, attack a target
2. Verify Close-Up note: "at Engaged range, 50% damage to bystanders"

## No Regression

### Test 19: Heavy Pistol — no trait notes
1. Equip Heavy Pistol (no traits)
2. Attack a target, get a Success
3. Verify no amber trait notes box appears

### Test 20: Pass 1 traits still work
1. Equip Sledgehammer (Cumbersome 2) on PHY 0 character
2. Verify Cumbersome (-2 CMod) still shows in pre-roll info
