// Repository: combat damage application.
//
// Centralizes the WP/RP write + the mortal/incap/Stress feed rows so combat
// handlers (Subdue today; the executeRoll attack path is the planned follow-up
// consolidation) stay thin and every damage source funnels the SAME canon
// transition (lib/combat-damage applyDamageTransition). Keeps inline
// `supabase.from(...)` out of the table god-component (arch gate) and gives the
// emission one home (SMOKE-1: don't duplicate follow-on logic per path).
//
// Each fn does the DB write + feed-row emission and RETURNS the patch (for the
// caller's optimistic setState) + the transition flags (so the caller decides
// nextTurn / action-zeroing, which need React state it doesn't own).

import { updateCharacterState } from './character-states'
import { updateCampaignNpc } from './campaign-npcs'
import { insertRollLog } from './roll-log'
import { applyDamageTransition, type DamageInput, type DamageTransition } from '../combat-damage'
import { OUTCOME } from '../roll-outcomes'

export interface DamageContext {
  campaignId: string
  userId: string | null
  attackerName: string
  defenderName: string
}

function emitTransitionLogs(t: DamageTransition, ctx: DamageContext, isPc: boolean) {
  const base = { campaign_id: ctx.campaignId, user_id: ctx.userId, die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0 }
  const jobs: any[] = []
  if (t.becameMortal) jobs.push(insertRollLog({ ...base, character_name: 'Death is in the air', label: `${ctx.defenderName} has been mortally wounded by ${ctx.attackerName}, and will die if not stabilized in ${t.deathCountdown} rounds.`, outcome: OUTCOME.death }))
  if (t.becameIncap) jobs.push(insertRollLog({ ...base, character_name: 'Lights Out', label: `${ctx.defenderName} has been Incapacitated by ${ctx.attackerName}.`, outcome: OUTCOME.incap }))
  // NPCs don't track Stress, so the Stress pip row is PC-only.
  if (isPc && t.stressReason) jobs.push(insertRollLog({ ...base, character_name: 'System', label: `😰 ${ctx.defenderName} gains a Stress from being ${t.stressReason}`, outcome: OUTCOME.stress }))
  return Promise.all(jobs)
}

/** Apply WP/RP damage to a PC's character_states row (+ mortal/incap/Stress
 *  feed rows). Returns the patch for optimistic setState + the transition. */
export async function applyDamageToPc(
  stateId: string,
  current: { wp_current: number; rp_current: number; stress: number; phyMod: number },
  dmg: DamageInput,
  ctx: DamageContext,
): Promise<{ patch: Record<string, any>; transition: DamageTransition }> {
  const t = applyDamageTransition(current, dmg)
  const patch: Record<string, any> = { wp_current: t.newWP, rp_current: t.newRP, stress: t.newStress, updated_at: new Date().toISOString() }
  if (t.deathCountdown != null) patch.death_countdown = t.deathCountdown
  if (t.incapRounds != null) patch.incap_rounds = t.incapRounds
  await updateCharacterState(stateId, patch)
  await emitTransitionLogs(t, ctx, true)
  return { patch, transition: t }
}

/** Apply WP/RP damage to an NPC's campaign_npcs row (+ mortal/incap feed rows). */
export async function applyDamageToNpc(
  npcId: string,
  current: { wp_current: number; rp_current: number; phyMod: number },
  dmg: DamageInput,
  ctx: DamageContext,
): Promise<{ patch: Record<string, any>; transition: DamageTransition }> {
  const t = applyDamageTransition({ ...current, stress: 0 }, dmg)
  const patch: Record<string, any> = { wp_current: t.newWP, rp_current: t.newRP }
  if (t.deathCountdown != null) patch.death_countdown = t.deathCountdown
  if (t.incapRounds != null) patch.incap_rounds = t.incapRounds
  await updateCampaignNpc(npcId, patch)
  await emitTransitionLogs(t, ctx, false)
  return { patch, transition: t }
}
