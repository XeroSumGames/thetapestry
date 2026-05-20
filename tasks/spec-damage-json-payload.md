# Spec: `damage_json` Typed Payload

Closes Tech Debt Ledger item: `damage_json: { ... } as any` casts in load-bearing combat code. Closes Phase P2 / A1.2 of `tasks/puffer-fish-platform-plan.md`.

**Audience:** the hunt-and-peck chat that will execute this migration over multiple sessions. Puffer-fish wrote this; puffer-fish updates it as findings surface during execution.

**Status:** SPEC. No code shipped yet.

---

## 1. The problem

`roll_log.damage_json` is a `jsonb` column carrying at least 12 distinct payload shapes:

| Variant | Written by | Sample fields |
|---|---|---|
| Attack damage | `executeRoll` (table page) | `base, diceRoll, totalWP, finalWP, finalRP, mitigated, targetName` |
| Combatants list | `confirmStartCombat`, `dropCharacter` (table page) | `combatants: [...]` |
| Initiative roll | `confirmStartCombat`, `rerollInitiative` (table page) | `initiative: [...]` |
| Recruit (PC) | `executeRoll` recruit branch | `rollOutcome, approach, recruitmentType, apprentice fields` |
| Recruit (proxy) | `CommunityProxyRecruitModal` | adds `proxy, leaderNpcId, leaderNpcName, communityId, communityName` |
| Community Fed check | `CommunityMoraleModal` | `communityId, weekNumber, rollOutcome, cmodForNextMorale` |
| Community Clothed check | `CommunityMoraleModal` | same shape as Fed |
| Community Morale check | `CommunityMoraleModal` | `communityId, weekNumber, rollOutcome, leaderName, skillUsed, slots, ...` |
| Community Retention check | `CommunityMoraleModal` | adds `moodCmod, ...` |
| Character evolution (CDP) | `CharacterEvolution` | `kind, key, from_level, to_level, cost, target, narrative` |
| Vehicle check (drive/brew/navigate) | `app/vehicle/page.tsx` | `vehicleId, checkKind, skillLabel, crewId, fuelDelta` |
| First Impression | `lib/first-impression-resolver.ts` | structured FI result |
| Stabilize | `lib/stabilize-helpers.ts` (2026-05-20) | medic + patient + outcome shape |
| Distract | `lib/distract-helpers.ts` (2026-05-20) | target + actions delta |
| Gut Instinct | `lib/gut-instinct-helpers.ts` (2026-05-20) | per the 2026-05-19 GM whisper-detail design |
| Coord Effort (render-enriched) | `RollsFeed.collapseCoordEffortChains` | adds `coordChainSkill, coordChainParticipants` to the lead's existing payload |

Plus the `[k: string]: any` catch-all in `components/RollsFeed.tsx:62` admits more variants the spec doesn't list.

### The two competing interfaces

There are **two `DamageResult` interface definitions in the codebase** with non-matching field names:

| Interface | Location | Key fields |
|---|---|---|
| `DamageResult` (RollsFeed read shape) | `components/RollsFeed.tsx:32` | `rollWP, appliedWP, rollRP, appliedRP, rpPercent, rpFloor, weaponName, damageRoll, ...` |
| `DamageResult` (executeRoll write shape) | `app/stories/[id]/table/types.ts:78` | `base, diceRoll, diceDesc, phyBonus, totalWP, finalWP, finalRP, mitigated, targetName` |

These describe the SAME row from different sides and don't share field names. `lib/roll-helpers.ts:55-58` already has a comment acknowledging the drift. The two `as any` casts in load-bearing combat code (Tech Debt Ledger entry) are the symptom of this mismatch.

---

## 2. The canonical shape

Define a discriminated union in `lib/damage-payload.ts`. Each variant has a `kind` discriminator (snake_case to match DB convention) so reading code branches via a switch:

```ts
// lib/damage-payload.ts (NEW FILE)

export type DamagePayload =
  | AttackDamage
  | CombatantsList
  | InitiativeOrder
  | RecruitResult
  | CommunityWeeklyCheck
  | CharacterEvolutionSpend
  | VehicleCheck
  | FirstImpressionResult
  | StabilizeResult
  | DistractResult
  | GutInstinctResult
  | CoordEffortChainLead  // not a separate WRITE, but a READ enrichment

export interface AttackDamage {
  kind: 'attack'
  rollWP: number          // raw d6+d6 PHY-mod result before DM
  rollRP: number          // raw RP = rollWP scaled by weapon
  weaponName: string
  damageRoll: string      // human-readable "2d6+3" style
  appliedWP: number       // post-DM
  appliedRP: number       // post-DM
  rpPercent: number       // 0-100; informs rpFloor
  rpFloor: 'A' | 'B' | 'C' | 'F'
  targetName: string
  // Burst / blast extras (optional)
  burstHits?: number
  blastCells?: { x: number; y: number }[]
  // Insight Die spent for 3d6 (optional)
  dieSpent?: 'pre' | 'die1' | 'die2' | 'both'
  diceRolled?: number[]
  // Combat narrative bits
  weaponJammed?: boolean
  notes?: string
}

export interface CombatantsList {
  kind: 'combatants'
  combatants: { id: string; name: string; isNpc: boolean }[]
  combatRound?: number
}

export interface InitiativeOrder {
  kind: 'initiative'
  initiative: { id: string; character_name: string; roll: number; isNpc: boolean }[]
}

export interface RecruitResult {
  kind: 'recruit'
  rollOutcome: string         // canonical OUTCOME constant (Wild Success / Success / etc.)
  approach: 'cohort' | 'conscript' | 'convert'
  recruitmentType: string
  apprentice?: boolean
  apprenticeBondNpcId?: string
  // Proxy-recruit extras (NPC leader running the recruit)
  proxy?: true
  leaderNpcId?: string
  leaderNpcName?: string
  // Common community-context
  communityId?: string
  communityName?: string
}

export interface CommunityWeeklyCheck {
  kind: 'community_check'
  checkType: 'fed' | 'clothed' | 'morale' | 'retention'
  communityId: string
  communityName: string
  weekNumber: number
  rollOutcome: string         // canonical OUTCOME constant
  cmodForNextMorale?: number  // fed + clothed feed into the next morale roll
  leaderName?: string
  leaderKind?: 'pc' | 'npc' | null
  skillUsed?: string
  moodCmod?: number           // retention only
  slots?: unknown             // morale-only slot breakdown; tighten later
  departures?: { id: string; reason: string }[]  // morale + retention
}

export interface CharacterEvolutionSpend {
  kind: 'evolution'
  spendKind: 'rapid' | 'skill' | 'trait'
  key: string                 // attribute name OR skill name OR trait name
  fromLevel: number
  toLevel: number
  cost: number                // CDP cost
  target: 'self' | 'apprentice'
  apprenticeNpcId?: string
  narrative?: string          // optional GM-supplied narrative
}

export interface VehicleCheck {
  kind: 'vehicle_check'
  vehicleId: string
  vehicleName: string
  checkKind: 'drive' | 'brew' | 'navigate'
  skillLabel: string
  crewId: string
  crewKind: 'pc' | 'npc'
  fuelDelta: number
  fuelBefore: number
  fuelAfter?: number
  suppliesDelta?: number      // brew check consumes brewing supplies
  rollOutcome: string
}

export interface FirstImpressionResult {
  kind: 'first_impression'
  npcId: string
  npcName: string
  rollOutcome: string
  startingRelationship: number
  newRelationship: number
  // optional GM whisper detail (2026-05-19 design)
  whisperHints?: string[]
}

export interface StabilizeResult {
  kind: 'stabilize'
  medicCharacterId: string
  patientName: string
  patientIsNpc: boolean
  rollOutcome: string
  incapRounds?: number        // patient incapacitated for N rounds on success
  deathCountdownChange?: number  // on success, removes death countdown
}

export interface DistractResult {
  kind: 'distract'
  targetInitId: string
  targetName: string
  rollOutcome: string
  actionsRemovedFromTarget: number
}

export interface GutInstinctResult {
  kind: 'gut_instinct'
  rollOutcome: string
  whisperDetail?: string      // GM-supplied hint visible only to roller
}

// Read-time enrichment - not a write shape. RollsFeed.collapseCoordEffortChains
// fuses the lead's existing payload (whatever kind it was) with chain
// metadata so the bespoke banner has everything in one place.
export interface CoordEffortChainLead {
  // The lead's underlying damage (could be any of the above kinds)
  lead: DamagePayload
  coordChainSkill: string
  coordChainParticipants: { id: string; name: string; isNpc: boolean }[]
}
```

---

## 3. Discriminator strategy

**Two discriminators are available:**

1. `roll_log.outcome` (the existing column). Already a discriminated union per `lib/roll-outcomes.ts`. Some payload variants align cleanly with outcome constants (`OUTCOME.combat_start` <-> `CombatantsList`); others don't (an attack roll has outcome `'Success' | 'Failure' | ...` but the payload is always `AttackDamage`).

2. **New `kind` field inside `damage_json` (RECOMMENDED).** Add a `kind` discriminator to every payload at write time. Reading code switches on `payload.kind` directly. This is cleaner because:
   - It survives renaming the `outcome` column (which we may still want to do per Tech Debt Ledger).
   - It survives future event types that don't fit the OUTCOME union.
   - It makes the TypeScript discriminated-union pattern work natively (no cross-column inference).

**Decision: use `kind`.** All writers stamp it; all readers `switch (payload.kind)`.

---

## 4. Migration plan

Phased so each phase is independently shippable + verifiable. Hunt-and-peck owns execution.

### Phase D1: Define the types (no code change)

1. Create `lib/damage-payload.ts` with the union + every variant interface from section 2.
2. Add unit tests at `tests/lib/damage-payload.test.ts`:
   - Type-only tests (no runtime assertions; just `const x: DamagePayload = { kind: 'attack', ... }` to verify the type compiles).
   - One per variant.
3. Ship as a no-op. The file is added but nothing imports it yet.

**Gate:** tsc clean. `npm test` green.

### Phase D2: Add writer helpers (per-variant)

Each variant gets a helper that returns a `DamagePayload` of the right shape:

```ts
// lib/damage-payload.ts (additions)
export function makeAttackDamage(args: Omit<AttackDamage, 'kind'>): AttackDamage {
  return { kind: 'attack', ...args }
}
export function makeCombatants(args: Omit<CombatantsList, 'kind'>): CombatantsList {
  return { kind: 'combatants', ...args }
}
// ... one per variant
```

Helpers stamp the `kind` automatically so callers can't forget.

**Gate:** tsc clean. All helpers have tests asserting the `kind` field.

### Phase D3: Migrate writers one variant at a time

Suggested order (smallest blast radius first):

1. **CharacterEvolution** (1 write site, leaf). Replace inline `damage_json: { ... }` with `damage_json: makeCharacterEvolutionSpend({ ... })`.
2. **VehicleCheck** (1 write site).
3. **CommunityWeeklyCheck** (4 write sites in `CommunityMoraleModal`; share helper).
4. **RecruitResult** (3 sites: executeRoll PC path, executeRoll apprentice path, `CommunityProxyRecruitModal`).
5. **FirstImpressionResult** (`lib/first-impression-resolver.ts`).
6. **StabilizeResult**, **DistractResult**, **GutInstinctResult** - each has a lib helper file; migrate one at a time.
7. **CombatantsList + InitiativeOrder** (in `confirmStartCombat`, `dropCharacter`, `rerollInitiative` - all in the table page).
8. **AttackDamage** (in `executeRoll`, the giant function). **LAST.** Hardest; touches the most state. Two `as any` casts to remove.

Each writer migration is one commit. After each, the previous reader code still works (the helper just stamps `kind`; field names match the existing shape).

**Gate per migration:** tsc clean, manual smoke of the affected feature, playtest verification before moving to the next.

### Phase D4: Migrate readers to switch on `kind`

Two main readers:

1. **`components/RollsFeed.tsx`** - the feed renderer. Currently reads from a stale local `DamageResult` interface (the rollWP/appliedWP shape). Switch to importing `DamagePayload` + branching on `kind`:

   ```tsx
   const payload = row.damage_json as DamagePayload | null
   if (!payload) return null
   switch (payload.kind) {
     case 'attack': return <AttackFeedRow payload={payload} />
     case 'recruit': return <RecruitFeedRow payload={payload} />
     // ... etc
   }
   ```

   Each `*FeedRow` sub-component takes the typed payload, eliminating field-name guessing.

2. **`lib/session-export.ts`** - the JSON export. Currently uses `damage_json: any`. Switch to `DamagePayload | null`.

3. **`lib/roll-helpers.ts:compactRollSummary`** - currently typed as `damage_json?: unknown`. Tighten to `DamagePayload | null`. The function reads only a few fields (combatants, recruit context, etc.); each branch narrows on `kind`.

4. **`app/stories/[id]/community/page.tsx`** - reads `damage_json` for community-event display. Switch to `DamagePayload | null` + branch on `kind === 'community_check'`.

**Gate per reader migration:** tsc clean, manual smoke of the feed / community page / export, playtest verification.

### Phase D5: Drop the catch-all + dead local types

1. Delete `[k: string]: any` from `components/RollsFeed.tsx:62`'s `DamageResult` interface.
2. Delete the duplicate `DamageResult` interface in `app/stories/[id]/table/types.ts:78`. Update its lone consumer (`RollResult.damage?: DamageResult`) to use `DamagePayload`.
3. Delete the two `as any` casts in combat code (Tech Debt Ledger item closes).
4. Update `compactRollSummary` signature - drop the `damage_json?: unknown` and use `DamagePayload | null`.

**Gate:** tsc clean. Full playtest. After 1 clean playtest, the Tech Debt Ledger entry closes. After 2 clean playtests, the Risk Register `roll_log` writer YELLOW demotes.

---

## 5. Rollback strategy

Each phase is independently revertable. If a Phase D3 writer migration breaks a feature:

1. `git revert <sha>` of just that writer migration. Previous writer code returns. No other code changed because helpers were no-ops on top of the inline shape.

If a Phase D4 reader migration breaks the feed:

1. `git revert <sha>` of just that reader migration. Readers fall back to the prior any-shape behavior. Writers continue to stamp `kind` (harmless).

If multiple phases compound a regression:

1. `git revert --no-edit <oldest-bad-sha>..HEAD` rolls back the chain.

The migration order (writers before readers, smallest before biggest) ensures any single revert only loses one variant's typing.

---

## 6. Tests required at each phase

| Phase | Test type | Coverage target |
|---|---|---|
| D1 | Type-only (compile check) | One per variant interface |
| D2 | Unit (writer helpers) | One per `make*` helper asserting `kind` + structural shape |
| D3 (per writer) | Unit + smoke | Existing tests still green; new test asserting the writer outputs a valid `DamagePayload` |
| D4 (per reader) | Unit + smoke | Switch-on-kind exhaustiveness check (TypeScript catches forgotten cases via `never` exhaustion); reader-specific tests for narration / rendering / export |
| D5 | Unit + smoke + playtest | The two `as any` casts are gone (grep should return zero); compactRollSummary tests all green; feed-render visual parity with the preview HTML |

---

## 7. Estimated session count

- Phase D1: 1 session (~2 hours: write types, write type-only tests, ship).
- Phase D2: 1 session (~2 hours: write helpers, write helper tests, ship).
- Phase D3: 4-5 sessions (one per variant cluster; smallest variants first; last variant - AttackDamage - is its own session).
- Phase D4: 2 sessions (RollsFeed reader is the big one; community page + session export + compactRollSummary are smaller).
- Phase D5: 1 session.

**Total: 9-10 sessions across hunt-and-peck.**

Sequencing constraint: D5 cannot ship until Phase 3.4 of `tasks/page-tsx-decomposition-plan.md` is done OR is being worked on in the same session. Reason: `executeRoll` is the largest AttackDamage writer; touching its damage payload during decomposition compounds risk. **Recommend D1, D2, D3a-D3g run anytime; D3h (AttackDamage) + D4 + D5 wait until Phase 3.4 is in flight.**

---

## 8. Risk register

### DJ-R1: Field-name mismatch creates write/read divergence during D3

If a writer migration stamps `kind: 'attack'` + uses the canonical field names (`appliedWP`), but a reader hasn't migrated yet and still reads the old field names (`finalWP`), the feed row will render blank.

**Mitigation:** D3 migrations must preserve the original field-name shape EXACTLY. The helper only adds `kind`; nothing else changes. The field-name reconciliation happens in D4 (readers move to the canonical shape) and D5 (the local read interface gets deleted).

Translation: in D3a-D3h, helpers look like `{ kind: 'attack', rollWP, appliedWP, ... }` with BOTH the new and the old field shapes if needed. By D5, the old shape is gone.

### DJ-R2: Coord Effort enrichment is at READ time, not WRITE time

`RollsFeed.collapseCoordEffortChains` mutates the lead row's `damage_json` to fuse in chain metadata. This means the same row has DIFFERENT `damage_json` shapes depending on whether you read it from the DB or from the in-memory feed.

**Mitigation:** `CoordEffortChainLead` is explicitly a READ-only enrichment type. The DB never stores a `kind: 'coord_effort_chain'` row; only the renderer constructs that shape. Document this in the type's JSDoc.

### DJ-R3: `[k: string]: any` catch-all may be hiding variants we missed

The current `DamageResult` interface in `RollsFeed.tsx` has a `[k: string]: any` index signature. There might be payload variants in production data that this spec doesn't enumerate.

**Mitigation:** before deleting the catch-all in D5, run a SQL audit:
```sql
-- Returns all distinct top-level keys across damage_json rows. Run before D5.
SELECT DISTINCT jsonb_object_keys(damage_json) AS key
FROM roll_log
WHERE damage_json IS NOT NULL
ORDER BY key;
```
If any keys aren't covered by a variant in section 2, add the variant + a writer helper + a migration step BEFORE shipping D5.

### DJ-R4: `executeRoll` is decomposing in parallel

The `AttackDamage` writer lives in `executeRoll`, which Phase 3.4 of the decomposition plan will extract. Doing D3h (the AttackDamage migration) in a session where Phase 3.4 is also being extracted = double the regression surface for a single playtest.

**Mitigation:** sequence D3h to land EITHER before Phase 3.4 starts (clean extraction working) OR as part of Phase 3.4's session (extract executeRoll AND migrate AttackDamage in the same change, since touching both = touching once). Hunt-and-peck decides at execution time.

---

## 9. Maintenance

Update this spec when:
- A new variant surfaces during D5's SQL audit - add it to section 2 + 4 + adjust totals.
- A phase ships - mark the phase `[x]` in section 4 + cross-ref the commit.
- A writer is identified that wasn't in section 1's table - add it.
- The catch-all `[k: string]: any` is dropped - delete this maintenance note about it.

When all 5 phases ship + the Tech Debt Ledger entry closes + the Risk Register `roll_log` writer YELLOW demotes, archive to `tasks/spec-damage-json-payload-archived.md` with a postmortem (what surprises did the SQL audit reveal? how long did it actually take?).
