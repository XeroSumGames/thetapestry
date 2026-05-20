// Typed `damage_json` payloads written to roll_log rows.
//
// Spec: tasks/spec-damage-json-payload.md. Phase D1 lands the types
// only; no consumers import these yet. Phase D2 adds `make*` writer
// helpers. Phase D3 migrates writers (one variant per commit). Phase
// D4 migrates readers. Phase D5 drops the catch-all + dead local
// DamageResult interfaces in RollsFeed and table/types.
//
// Why a discriminated union: the `damage_json` column today is `jsonb`
// with no type-level shape. 12+ distinct write patterns share it
// (attack damage, combatants snapshot, recruit result, community
// morale check, vehicle check, etc.). Reading code today either casts
// to `any` (RollsFeed, session-export) or to a stale local interface
// that no longer matches what writers produce (table/types). A
// discriminator (`kind` field) lets readers switch on the shape they
// need with full type safety, and writers must stamp the right kind
// at write time.
//
// Why `kind` instead of relying on `roll_log.outcome`: the outcome
// column does triple duty (roll result / event tag / grapple result)
// and isn't 1:1 with payload shape. An attack roll has outcome
// 'Success' OR 'Failure' OR etc. but payload is always AttackDamage.
// A separate `kind` field on the payload is cleaner AND survives any
// future renaming of the outcome column.

/** Standard weapon-attack damage roll. Covers melee, ranged, thrown,
 *  burst, and explosive variants. Burst trait writes `burstHits`;
 *  explosive writes `blastCells`. */
export interface AttackDamage {
  kind: 'attack'
  rollWP: number              // raw d6+d6 PHY-mod result before DM
  rollRP: number              // raw RP = rollWP scaled by weapon
  weaponName: string
  damageRoll: string          // human-readable "2d6+3" style
  appliedWP: number           // post-DM
  appliedRP: number           // post-DM
  rpPercent: number           // 0-100; informs rpFloor
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

/** Snapshot of who's in initiative at combat_start (written when the
 *  GM clicks Start Combat). RollsFeed's bespoke combat_start banner
 *  reads this to render the side-by-side combatant list. */
export interface CombatantsList {
  kind: 'combatants'
  combatants: { id: string; name: string; isNpc: boolean }[]
  combatRound?: number
}

/** Initiative order snapshot when initiative is rolled / re-rolled.
 *  Used by the bespoke initiative banner. Each entry includes the
 *  rolled total so the feed can show the breakdown. */
export interface InitiativeOrder {
  kind: 'initiative'
  initiative: { id: string; character_name: string; roll: number; isNpc: boolean }[]
}

/** Recruitment Check result (executeRoll's PC recruit branch + the
 *  apprentice path + CommunityProxyRecruitModal). Approach-specific
 *  semantics are locked per the Tier-2 design (cohort / conscript /
 *  convert). Proxy field set when an NPC leader runs the recruit
 *  on behalf of the community. */
export interface RecruitResult {
  kind: 'recruit'
  rollOutcome: string         // canonical OUTCOME constant
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

/** Community weekly check (fed / clothed / morale / retention).
 *  Written by CommunityMoraleModal. The `cmodForNextMorale` field
 *  is the carry-forward CMod from fed + clothed into the next
 *  morale roll. Retention adds mood + departure list. */
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
  slots?: unknown             // morale-only slot breakdown; tighten in a later phase
  departures?: { id: string; reason: string }[]  // morale + retention
}

/** Character Development Point spend (rapid attribute, skill, or
 *  trait). Written when the CharacterEvolution modal commits. */
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

/** Vehicle check (driving / brew / navigate). Attack rolls on
 *  mounted weapons use AttackDamage instead - they're indistinguishable
 *  from PC weapon attacks at the payload level. */
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

/** First Impression roll resolved by lib/first-impression-resolver.ts.
 *  Carries before/after relationship-CMod values + optional GM
 *  whisper hint (2026-05-19 design). */
export interface FirstImpressionResult {
  kind: 'first_impression'
  npcId: string
  npcName: string
  rollOutcome: string
  startingRelationship: number
  newRelationship: number
  whisperHints?: string[]
}

/** Stabilize roll result. `incapRounds` set on success (patient
 *  incapacitated for N rounds). `deathCountdownChange` is the delta
 *  applied to the patient's death_countdown (negative removes it). */
export interface StabilizeResult {
  kind: 'stabilize'
  medicCharacterId: string
  patientName: string
  patientIsNpc: boolean
  rollOutcome: string
  incapRounds?: number
  deathCountdownChange?: number
}

/** Distract roll result. `actionsRemovedFromTarget` is signed: positive
 *  on Success/WS/HI (drain), negative on Dire Failure (Inspired bonus). */
export interface DistractResult {
  kind: 'distract'
  targetInitId: string
  targetName: string
  rollOutcome: string
  actionsRemovedFromTarget: number
}

/** Gut Instinct roll result. The GM whisper-detail modal writes
 *  `whisperDetail` after sending the private message (the feed row
 *  itself has no whisper text - it's just the dice + outcome). */
export interface GutInstinctResult {
  kind: 'gut_instinct'
  rollOutcome: string
  whisperDetail?: string
}

/** Read-time enrichment, NOT a write shape. The
 *  RollsFeed.collapseCoordEffortChains aggregator fuses a chain
 *  lead's existing payload (whichever variant it is) with metadata
 *  about the chain so the bespoke banner has everything in one
 *  place. The lead's own payload stays whatever kind it was;
 *  CoordEffortChainLead is the wrapper consumed only at render
 *  time. */
export interface CoordEffortChainLead {
  lead: DamagePayload
  coordChainSkill: string
  coordChainParticipants: { id: string; name: string; isNpc: boolean }[]
}

/** The discriminated union. Every `damage_json` written to roll_log
 *  should be one of these. Phase D5 will drop the catch-all
 *  `[k: string]: any` in the stale local interfaces. */
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

/** Discriminator literal. Useful for type guards + exhaustive switch
 *  checks in readers. */
export type DamagePayloadKind = DamagePayload['kind']

// ─── Phase D2: per-variant writer helpers ─────────────────────────
//
// Each variant gets a `make*` helper that stamps the `kind` field
// automatically. Callers in Phase D3 replace inline
// `damage_json: { ... }` literals with `damage_json: makeX({ ... })`,
// removing one whole category of writer bugs (forgetting the
// discriminator). Helpers take `Omit<Variant, 'kind'>` so the input
// shape matches the variant exactly minus the discriminator.
//
// All helpers are trivial single-line wrappers, but writing them out
// per-variant pays for itself: each helper signature is the canonical
// proof that a caller passed the right shape, and the Phase D3
// migrations get type errors instead of silent passthroughs.

/** Stamp 'attack' on an AttackDamage payload. Used by executeRoll's
 *  weapon-attack write path. */
export function makeAttackDamage(args: Omit<AttackDamage, 'kind'>): AttackDamage {
  return { kind: 'attack', ...args }
}

/** Stamp 'combatants' on a CombatantsList payload. Used by
 *  confirmStartCombat in the table page. */
export function makeCombatantsList(args: Omit<CombatantsList, 'kind'>): CombatantsList {
  return { kind: 'combatants', ...args }
}

/** Stamp 'initiative' on an InitiativeOrder payload. Used by
 *  rerollInitiative + dropCharacter in the table page. */
export function makeInitiativeOrder(args: Omit<InitiativeOrder, 'kind'>): InitiativeOrder {
  return { kind: 'initiative', ...args }
}

/** Stamp 'recruit' on a RecruitResult payload. Used by executeRoll's
 *  PC recruit + apprentice paths AND by CommunityProxyRecruitModal. */
export function makeRecruitResult(args: Omit<RecruitResult, 'kind'>): RecruitResult {
  return { kind: 'recruit', ...args }
}

/** Stamp 'community_check' on a CommunityWeeklyCheck payload. Used
 *  by CommunityMoraleModal at all 4 weekly-check write sites (fed,
 *  clothed, morale, retention). */
export function makeCommunityWeeklyCheck(args: Omit<CommunityWeeklyCheck, 'kind'>): CommunityWeeklyCheck {
  return { kind: 'community_check', ...args }
}

/** Stamp 'evolution' on a CharacterEvolutionSpend payload. Used by
 *  CharacterEvolution commit handler. */
export function makeCharacterEvolutionSpend(args: Omit<CharacterEvolutionSpend, 'kind'>): CharacterEvolutionSpend {
  return { kind: 'evolution', ...args }
}

/** Stamp 'vehicle_check' on a VehicleCheck payload. Used by the
 *  /vehicle popout's rollCheck function for driving/brew/navigate. */
export function makeVehicleCheck(args: Omit<VehicleCheck, 'kind'>): VehicleCheck {
  return { kind: 'vehicle_check', ...args }
}

/** Stamp 'first_impression' on a FirstImpressionResult payload. Used
 *  by lib/first-impression-resolver.ts. */
export function makeFirstImpressionResult(args: Omit<FirstImpressionResult, 'kind'>): FirstImpressionResult {
  return { kind: 'first_impression', ...args }
}

/** Stamp 'stabilize' on a StabilizeResult payload. Used by the
 *  dedicated Stabilize <RollModal>'s onRoll path. */
export function makeStabilizeResult(args: Omit<StabilizeResult, 'kind'>): StabilizeResult {
  return { kind: 'stabilize', ...args }
}

/** Stamp 'distract' on a DistractResult payload. Used by the
 *  dedicated Distract <RollModal>'s onRoll path. */
export function makeDistractResult(args: Omit<DistractResult, 'kind'>): DistractResult {
  return { kind: 'distract', ...args }
}

/** Stamp 'gut_instinct' on a GutInstinctResult payload. Used by the
 *  dedicated Gut Instinct <RollModal>'s onRoll path. */
export function makeGutInstinctResult(args: Omit<GutInstinctResult, 'kind'>): GutInstinctResult {
  return { kind: 'gut_instinct', ...args }
}
