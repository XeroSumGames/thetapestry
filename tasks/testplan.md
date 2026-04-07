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
