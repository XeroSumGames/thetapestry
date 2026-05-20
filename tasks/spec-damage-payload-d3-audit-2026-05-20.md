# DamagePayload D3 Writer-Shape Audit (2026-05-20)

Spec amendment doc for `tasks/spec-damage-json-payload.md`. Surfaces the gap between the spec's prescribed interfaces in Section 2 and the actual shapes live writer sites produce.

**Lane**: surfaced by the hunt-and-peck chat during D3 step 1 (CharacterEvolution); spec ownership is puffer-fish. The hunt-and-peck chat will adopt whichever shape puffer-fish locks before resuming D3 steps 2-11.

**Status**: incomplete - only 2 of 11 variants audited. Continue per-variant before each migration commit.

---

## Pattern observed

The spec prescribed camelCase fields and a clean per-variant shape. Live writer sites use snake_case for multi-word fields and sometimes mix fields from multiple "kinds" into one row (e.g., the Vehicle write carries attack fields when the check is a mounted-weapon attack). Per "verify before quoting scope" - each migration follows reality, not the spec, until the spec is amended.

---

## 1. CharacterEvolutionSpend - AUDITED + MIGRATED (commit `aada631`)

**Live write site**: `components/CharacterEvolution.tsx:343-353`.

**Spec said**:
```ts
{
  kind: 'evolution',
  spendKind: 'rapid' | 'skill' | 'trait',
  key: string,
  fromLevel: number,
  toLevel: number,
  cost: number,
  target: 'self' | 'apprentice',
  apprenticeNpcId?: string,
  narrative?: string,
}
```

**Reality**:
```ts
{
  // (no top-level kind - the helper adds it now)
  kind: 'rapid' | 'skill',           // collides with the spec's top-level discriminator
  key: string,
  from_level: number,                // snake_case
  to_level: number,                  // snake_case
  cost: number,
  target: 'self' | 'apprentice',
  apprentice_npc_id: string | null,  // snake_case + null (not optional)
  narrative: string | null,          // null (not optional)
  new_cdp_balance: number,           // spec omitted
}
```

**Resolution**: interface reshaped to match reality. Inner classification renamed `spendKind` to free the top-level discriminator. `new_cdp_balance` added. Field names switched to snake_case. Nullable instead of optional for `apprentice_npc_id` + `narrative`. Spec needs amending.

---

## 2. VehicleCheck + mounted-weapon attack - AUDITED, NOT MIGRATED (architectural Q)

**Live write site**: `app/vehicle/page.tsx:1119-1135`. **A single write site handles all four check kinds (drive / brew / navigate / attack).**

**Spec said** (separating into two variants):
```ts
VehicleCheck { kind: 'vehicle_check', checkKind: 'drive' | 'brew' | 'navigate', ... }
AttackDamage { kind: 'attack', weaponName, appliedWP, appliedRP, ... }
```

**Reality** (one mixed shape with null fields for the kind that doesn't apply):
```ts
{
  vehicleId, vehicleName, checkKind, skillLabel, crewId, crewKind,
  fuelDelta, fuelBefore, fuelAfter,
  weaponName, weaponDamage, weaponRpPercent, targetNpcId, targetName,
  ...damageJsonExtras  // attack damage extras (rollWP / rollRP / appliedWP / etc.)
}
```

**Architectural choice for puffer-fish**:

- **Option A (branch the writer)**: At write time, if `check.kind === 'attack'`, build an `AttackDamage` payload. Otherwise build a `VehicleCheck` payload (which carries vehicle-check fields only - no `weaponName`, `targetNpcId`, etc.). Cleaner types; reader switches on `kind` and gets exactly the fields valid for that kind.
- **Option B (preserve mixed shape)**: Define a `VehicleCheckOrAttack` variant that includes all fields from both shapes, with the attack-related ones marked `string | null`. Smaller writer change but readers must defensively check `checkKind` against fields.
- **Option C (introduce a `VehicleAttackDamage` variant)**: Like Option A, but the attack branch writes to a distinct `kind: 'vehicle_attack'` variant rather than reusing `AttackDamage` (which is PC weapon attacks). Distinguishes the two attack flavors for readers that care.

**Recommendation from the hunt-and-peck audit**: Option A. Cleanest types, smallest reader surface, and the existing readers (RollsFeed casts to `any`; session-export same) don't break. Writer branch is ~5 lines.

**Not migrating until puffer-fish picks one.**

---

## 3-11. Remaining variants (TBD per migration)

Audit per write site, then migrate. Suggested order matches the spec (smallest blast radius first):

3. CommunityWeeklyCheck - 4 write sites in CommunityMoraleModal (audit each)
4. RecruitResult - 3 sites (executeRoll PC + apprentice + CommunityProxyRecruitModal)
5. FirstImpressionResult - lib/first-impression-resolver.ts:131-148
6. StabilizeResult - integrated into runStabilizeCascade (the dedicated modal's onRoll path)
7. DistractResult - same shape as Stabilize, via runDistractCascade
8. GutInstinctResult - the Gut Instinct modal's onRoll
9. CombatantsList - confirmStartCombat
10. InitiativeOrder - rerollInitiative + dropCharacter
11. AttackDamage - executeRoll (the giant one; LAST per spec)

---

## Pattern to apply going forward

For each remaining variant before its D3 commit:

1. Grep the actual write site(s): `grep -nP "damage_json[:\s]" path/to/writer.tsx`
2. Read the literal shape (~20-line block).
3. Compare to the interface in `lib/damage-payload.ts`.
4. If mismatch: reshape the interface to match the live shape, update tests, ship interface fix in the same commit as the writer migration (or in a separate prep commit, doc-only).
5. Migrate the writer to call the helper.
6. Test + ship.

The reshaping cost averages ~30% of each migration step's effort, based on CharacterEvolution. Plan accordingly.

---

## Spec amendment items for puffer-fish

- [ ] Section 2 of `tasks/spec-damage-json-payload.md`: re-derive each interface from the live write site, not the prescriptive shape. Audit findings 1-2 above are starter material.
- [ ] Decide architectural Option A / B / C for VehicleCheck + mounted-weapon attack (see section 2 of this doc).
- [ ] Section 3 (discriminator strategy): inner discriminator fields (like the original `kind` in CharacterEvolution) collide with the spec's top-level `kind`. Add a renaming convention rule.
- [ ] Section 6 (tests required): add "per-writer reality check" as a precondition to each D3 commit.
