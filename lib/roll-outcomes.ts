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
