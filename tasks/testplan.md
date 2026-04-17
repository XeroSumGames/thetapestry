# Test Plan — Ready Weapon Modal

## Modal Opens
- [ ] Start combat, click Ready Weapon → modal appears
- [ ] Shows active combatant name, primary weapon info (condition, ammo, reloads)
- [ ] Shows secondary weapon if equipped
- [ ] Cancel button closes modal, backdrop click closes modal

## Switch
- [ ] With secondary weapon: button active, click swaps primary/secondary
- [ ] Action consumed, log shows "Switch to [weapon]"
- [ ] Without secondary: button disabled with "no secondary" note

## Reload
- [ ] Ranged weapon with reloads > 0: click refills ammo, decrements reloads
- [ ] Action consumed, log shows "Reload [weapon]"
- [ ] No reloads left: button disabled
- [ ] Melee weapon: button disabled with "melee weapon" note

## Unjam
- [ ] Weapon at Damaged/Broken: button active, opens roll modal
- [ ] Roll uses best of Tinkerer/Weaponsmith/Ranged or Melee Combat
- [ ] Success: condition improves
- [ ] Failure: no change
- [ ] Dire/Low Insight: breaks (+ 1 WP damage on Low Insight)
- [ ] Weapon at Used/Pristine: button disabled with "not damaged" note

## Tracking Weapons
- [ ] Tracking weapon shows aim bonus note in modal
