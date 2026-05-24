// Conditions subsystem - the unified apply/clear math for the five status
// conditions (infection, stress, mortal wound, incapacitation, lasting wounds).
// See tasks/stage-b-conditions-design.md.
//
// PHASE 1 (this file, additive, behavior-NEUTRAL): the PURE helpers + the
// cleared-fields builder, mirroring the formulas currently inlined at ~9 combat
// sites VERBATIM so the Phase-2 routing is genuinely behavior-preserving:
//   - incap_rounds  = Math.max(1, 4 - phyMod)        (useRollResolution 659/730/1057/1081, page 4990/5012)
//   - stress (+1)   = Math.min(5, (cur ?? 0) + 1)    (useRollResolution 626/660/1053/... , page 4460/4986)
//   - death_countdown = mortalWoundCountdown(phyMod) (re-exported from table-roll-context)
//   - cleared fields = the RestorePickerModal reset block
//
// PHASE 2 (later, in an isolated worktree, gated by the 2-client conditions
// smoke before merge): route those inlined writes + Restore through thin
// writer fns over a ConditionTarget (PC = character_states + characters.data;
// NPC = campaign_npcs). NOT done here - this file changes no behavior until a
// call site adopts it.
//
// CANON (Xero 2026-05-24, decisions.md): stress is PC-ONLY. NPCs have no stress
// column and no stress mechanic - so the cleared-fields builder omits stress for
// NPC targets, and there is deliberately no NPC addStress path.

export { mortalWoundCountdown } from './table-roll-context'

/** Hard cap on the stress track (pips). */
export const STRESS_CAP = 5

/**
 * Incapacitation duration on entering RP=0. Mirrors the inlined
 * `Math.max(1, 4 - PHY)` at every current site.
 */
export function incapRounds(phyMod: number | null | undefined): number {
  return Math.max(1, 4 - (phyMod ?? 0))
}

/**
 * Stress after a +1 application (on mortal-wound / incap entry, stress-check
 * fail, etc.), capped at STRESS_CAP. Mirrors `Math.min(5, (cur ?? 0) + 1)`.
 * PC-only by canon - do not call for NPCs.
 */
export function nextStress(current: number | null | undefined): number {
  return Math.min(STRESS_CAP, (current ?? 0) + 1)
}

/** The 7 infection columns, in their canonical "no infection" state. */
export interface ClearedInfectionFields {
  infection_state: null
  infection_days_left: number
  infection_lasting_risk: boolean
  infection_severity: null
  infection_started_at: null
  infection_infected_by: null
  infection_pending_lasting_check: boolean
}

/** The infection block reset to "clean", exactly as RestorePickerModal writes it. */
export function clearedInfectionFields(): ClearedInfectionFields {
  return {
    infection_state: null,
    infection_days_left: 0,
    infection_lasting_risk: false,
    infection_severity: null,
    infection_started_at: null,
    infection_infected_by: null,
    infection_pending_lasting_check: false,
  }
}

/**
 * The full set of `character_states` / `campaign_npcs` fields a Restore clears.
 * Mirrors RestorePickerModal VERBATIM: mortal-wound + incap nulled, the
 * infection block cleared, and (PC only) stress zeroed. NPC targets omit
 * stress (no column). Lasting wounds are NOT in this object - they live in a
 * different table (`characters.data.lastingWounds` / `campaign_npcs.lasting_wounds`)
 * and are cleared by a separate write the Phase-2 writer owns (the one
 * intended behavior CHANGE #5 introduces; until then Restore does not clear them).
 */
export function clearedConditionFields(opts: { includeStress: boolean }): Record<string, unknown> {
  const base: Record<string, unknown> = {
    death_countdown: null,
    incap_rounds: null,
    ...clearedInfectionFields(),
  }
  if (opts.includeStress) base.stress = 0
  return base
}
