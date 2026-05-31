// Canonical set of values for the `outcome` column on roll_log rows.
//
// The column does triple duty:
//
//   1. Roll result labels (capital-case): the dice-result categorisation
//      written by getOutcome() for skill checks, attacks, social rolls.
//      Read by outcomeColor / colorClass to drive the per-row color.
//
//   2. Event tags (lowercase snake_case): the "row category" used by
//      event-only rows that have no dice roll (combat_start, death,
//      loot, etc.). Read by compactRollSummary / renderBespokeBanner
//      to drive bespoke per-event rendering.
//
//   3. Grapple-specific results (custom strings): bespoke ladder
//      written by executeGrapple; grapple has its own outcome shape
//      distinct from the generic roll-result one.
//
// Insert sites should use OUTCOME.X to get compile-time typo safety.
// Read sites (switch/case, equality checks) should annotate the outcome
// variable as RollOutcome so the case literals get checked against the
// union. The two layers together close the loop: typo a tag at the
// write side -> editor red squiggle. Typo a tag at the read side ->
// editor red squiggle.

export const OUTCOME = {
  // Roll result labels (capital-case)
  Success: 'Success',
  Failure: 'Failure',
  WildSuccess: 'Wild Success',
  DireFailure: 'Dire Failure',
  HighInsight: 'High Insight',
  LowInsight: 'Low Insight',

  // Grapple-specific results
  Grappled: 'Grappled!',
  GrappleFailed: 'Failed - 1 RP',
  GrappleNoVictor: 'No clear victor',

  // Event tags (lowercase snake_case) - key matches value for grep
  action: 'action',
  barter: 'barter',
  cdp: 'cdp',
  clothed_check: 'clothed_check',
  combat_end: 'combat_end',
  combat_start: 'combat_start',
  coordinate: 'coordinate',
  death: 'death',
  defer: 'defer',
  drop: 'drop',
  encumbrance: 'encumbrance',
  evolution: 'evolution',
  fed_check: 'fed_check',
  incap: 'incap',
  initiative: 'initiative',
  loot: 'loot',
  morale_check: 'morale_check',
  pending_heal: 'pending_heal',
  // PC rested for some duration: WP/RP recover per canon (never-MW = 1 WP/day;
  // was-MW = 1 WP / 2 days; 1 RP/hour). damage_json carries hours + heal totals.
  rest: 'rest',
  // Environmental damage one-shots (CRB Ch. 07 pp. 116-117). GM-button driven.
  // damage_json carries { feetFallen, wpDealt, rpDealt } / { submergedRounds, wpDealt, rpDealt }.
  falling: 'falling',
  drowning: 'drowning',
  rations: 'rations',
  recruit: 'recruit',
  retention_check: 'retention_check',
  revive: 'revive',
  sprint: 'sprint',
  stress: 'stress',
  subsistence: 'subsistence',
  // First-wound-of-combat reminder. Fires once per character per
  // combat when they take a shot/stab/cut wound (WP damage from an
  // attack). GM cue to remember the post-combat Wound Infection
  // check per canon (CRB p.114-115).
  wound_infection_warning: 'wound_infection_warning',
  // Weapon malfunction (Low Insight on a non-Unarmed weapon roll).
  // Emitted alongside the condition-degrade + jammed-flag write so
  // the feed surfaces the malfunction as a discrete event. Reader
  // sees: attack row → malfunction row.
  weapon_malfunction: 'weapon_malfunction',
  // Lasting Wound acquired - announcement row inserted right after a
  // Lasting Damage Check resolves to Failure / Dire Failure (and the
  // 2d6 on Table 12 has been applied to the patient's
  // data.lastingWounds). Reader sees: dice roll row -> announcement
  // row "X has picked up a Lasting Wound and is now <wound> (<effect>)".
  lasting_wound_acquired: 'lasting_wound_acquired',
  // Advantage consumed - feed broadcast for the whole party (C3 share).
  // Inserted alongside the consumeAdvantage update so the rolls feed
  // shows the redemption: "X used their +N <skill> advantage (<desc>)".
  // Label is the full sentence; renderer returns it verbatim.
  advantage_used: 'advantage_used',
  // Brewing materials gathered (Q4-d, 2026-05-19). Fires when a player
  // clicks Gather Materials on a vehicle's brewing-supplies panel.
  // Passive 1-day action (no dice, no failure mode per Q4-d spec).
  // Label is the full sentence; renderer returns it verbatim:
  // "<vehicle> stockpile updated - gathered 1 day of brewing materials
  // (now N/M)". (Comment refreshed 2026-05-20 per skill+combat narrative
  // audit; earlier text described a draft format that never shipped.)
  gather_materials: 'gather_materials',
} as const

export type RollOutcome = typeof OUTCOME[keyof typeof OUTCOME]

// Subset returned by getOutcome() - the dice-result categorisation
// applied to a generic 2d6 + mods roll. Doesn't include event tags or
// grapple-specific results (those are written by other code paths).
export type RollResult =
  | typeof OUTCOME.Success
  | typeof OUTCOME.Failure
  | typeof OUTCOME.WildSuccess
  | typeof OUTCOME.DireFailure
  | typeof OUTCOME.HighInsight
  | typeof OUTCOME.LowInsight

// Grapple-result subset - bespoke ladder written by executeGrapple.
// Distinct from RollResult because grapple has its own outcome shape
// (Grappled vs Failed - 1 RP vs No clear victor), unrelated to the
// 6-tier Success/Failure ladder.
export type GrappleResult =
  | typeof OUTCOME.Grappled
  | typeof OUTCOME.GrappleFailed
  | typeof OUTCOME.GrappleNoVictor

// Event-tag subset - the 30 snake_case row-category values used for
// event-only rows that have no dice roll (combat_start, death, loot,
// morale_check, wound_infection_warning, etc.).
export type EventTag =
  | typeof OUTCOME.action
  | typeof OUTCOME.barter
  | typeof OUTCOME.cdp
  | typeof OUTCOME.clothed_check
  | typeof OUTCOME.combat_end
  | typeof OUTCOME.combat_start
  | typeof OUTCOME.coordinate
  | typeof OUTCOME.death
  | typeof OUTCOME.defer
  | typeof OUTCOME.drop
  | typeof OUTCOME.encumbrance
  | typeof OUTCOME.evolution
  | typeof OUTCOME.fed_check
  | typeof OUTCOME.incap
  | typeof OUTCOME.initiative
  | typeof OUTCOME.loot
  | typeof OUTCOME.morale_check
  | typeof OUTCOME.pending_heal
  | typeof OUTCOME.rest
  | typeof OUTCOME.falling
  | typeof OUTCOME.drowning
  | typeof OUTCOME.rations
  | typeof OUTCOME.recruit
  | typeof OUTCOME.retention_check
  | typeof OUTCOME.revive
  | typeof OUTCOME.sprint
  | typeof OUTCOME.stress
  | typeof OUTCOME.subsistence
  | typeof OUTCOME.wound_infection_warning
  | typeof OUTCOME.weapon_malfunction
  | typeof OUTCOME.lasting_wound_acquired
  | typeof OUTCOME.advantage_used
  | typeof OUTCOME.gather_materials

// Discriminator for the three kinds the `outcome` column can carry.
// Used by readers that want to branch on kind first, then narrow on
// the specific value within that kind (e.g. compactRollSummary
// switches on kind, then on the narrowed sub-union).
export type OutcomeKind = 'roll' | 'grapple' | 'event'

// Type guard: is this outcome one of the 6 dice-result labels?
// Narrows the input from RollOutcome to RollResult so downstream
// switch cases get exhaustive checking on the 6 values.
export function isRollResult(o: RollOutcome): o is RollResult {
  return o === OUTCOME.Success
      || o === OUTCOME.Failure
      || o === OUTCOME.WildSuccess
      || o === OUTCOME.DireFailure
      || o === OUTCOME.HighInsight
      || o === OUTCOME.LowInsight
}

// Type guard: is this outcome one of the 3 grapple-result labels?
export function isGrappleResult(o: RollOutcome): o is GrappleResult {
  return o === OUTCOME.Grappled
      || o === OUTCOME.GrappleFailed
      || o === OUTCOME.GrappleNoVictor
}

// Type guard: is this outcome an event tag (everything that isn't a
// roll result or a grapple result)? Implemented as
// "not roll, not grapple" rather than enumerating the 30 tags so
// adding a new tag to OUTCOME automatically gets picked up here. The
// EventTag union itself must be extended manually - the exhaustiveness
// test in tests/lib/roll-outcomes.test.ts catches the omission.
export function isEventTag(o: RollOutcome): o is EventTag {
  return !isRollResult(o) && !isGrappleResult(o)
}

// Deterministic kind discriminator. Reads use this when they need to
// branch on kind first (e.g. "is this a row I can color via
// outcomeColor, or one of the bespoke renderers?"), then narrow on
// the specific value via the corresponding type guard.
export function outcomeKind(o: RollOutcome): OutcomeKind {
  if (isRollResult(o)) return 'roll'
  if (isGrappleResult(o)) return 'grapple'
  return 'event'
}
