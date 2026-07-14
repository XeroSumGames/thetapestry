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
import { updateCharacterDataField } from './characters'
import { insertTokens } from './tactical'
import { insertRollLog } from './roll-log'
import { applyDamageTransition, type DamageInput, type DamageTransition } from '../combat-damage'
import { routeLootedItem } from '../loot'
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
  // Confirm the write BEFORE announcing the outcome - otherwise a rejected
  // update still emitted "X is mortally wounded" to the feed and returned an
  // optimistic patch, so players saw a death that never hit the DB (M4).
  const { error } = await updateCharacterState(stateId, patch)
  if (error) throw new Error(`applyDamageToPc: ${error.message}`)
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
  const { error } = await updateCampaignNpc(npcId, patch)
  if (error) throw new Error(`applyDamageToNpc: ${error.message}`)
  await emitTransitionLogs(t, ctx, false)
  return { patch, transition: t }
}

export interface DisarmOutcome {
  /** Name of the weapon knocked loose, or null if the defender was unarmed. */
  weaponName: string | null
  /** true = a lootable ground token was spawned; false = no map, so the weapon
   *  fell back into the defender's own inventory (recoverable, just unreadied). */
  droppedToGround: boolean
  /** New characters.data for the PC's optimistic setState (slot cleared). */
  pcData?: Record<string, any>
  /** New skills blob for the NPC's optimistic setState (weapon cleared). */
  npcSkills?: Record<string, any>
  error: any
}

/**
 * Disarm: knock the defender's equipped weapon loose. Clears their slot
 * (PC weaponPrimary / NPC skills.weapon) and, when a tactical scene + cell are
 * given, spawns a lootable ground token at that cell holding the weapon so any
 * combatant can loot + Ready it (loot routing sends weapons to inventory[]).
 * With no map, the weapon falls back into the defender's own inventory so it is
 * never destroyed - they just lose the tempo of having it readied.
 *
 * Does the DB writes only; the caller owns its optimistic React setState (it
 * holds state this module can't touch) and reads weaponName/pcData/npcSkills
 * back to apply it. Returns weaponName=null (no writes) if nothing was equipped.
 */
export async function disarmAndDrop(opts: {
  scene?: { id: string; gridX: number; gridY: number } | null
  pc?: { charId: string; data: Record<string, any> } | null
  npc?: { id: string; skills: Record<string, any> } | null
}): Promise<DisarmOutcome> {
  const onMap = !!opts.scene
  const lootRow = (name: string) => [{ type: 'weapon' as const, name, quantity: 1 }]

  if (opts.pc) {
    const weaponName: string | null = opts.pc.data?.weaponPrimary?.weaponName ?? null
    if (!weaponName) return { weaponName: null, droppedToGround: false, error: null }
    // On a map the weapon leaves the PC entirely (becomes a ground token);
    // with no map it drops into their own inventory.
    const fallbackInv = onMap ? {} : routeLootedItem(opts.pc.data, { type: 'weapon', name: weaponName, quantity: 1 })
    const pcData = { ...opts.pc.data, weaponPrimary: null, ...fallbackInv }
    const { error } = await updateCharacterDataField(opts.pc.charId, { weaponPrimary: null, ...fallbackInv })
    if (error) return { weaponName, droppedToGround: false, pcData, error }
    if (!onMap) return { weaponName, droppedToGround: false, pcData, error: null }
    const { error: tokErr } = await insertTokens(groundToken(opts.scene!, weaponName, lootRow(weaponName)))
    return { weaponName, droppedToGround: true, pcData, error: tokErr }
  }

  if (opts.npc) {
    const weaponName: string | null = opts.npc.skills?.weapon?.weaponName ?? null
    if (!weaponName) return { weaponName: null, droppedToGround: false, error: null }
    // Clear the NPC's single weapon slot. Off-map (no ground token to spawn)
    // the weapon is just unequipped - the GM can re-arm via Ready Weapon.
    const npcSkills = { ...opts.npc.skills, weapon: null }
    const { error } = await updateCampaignNpc(opts.npc.id, { skills: npcSkills } as any)
    if (error) return { weaponName, droppedToGround: false, npcSkills, error }
    if (!onMap) return { weaponName, droppedToGround: false, npcSkills, error: null }
    const { error: tokErr } = await insertTokens(groundToken(opts.scene!, weaponName, lootRow(weaponName)))
    return { weaponName, droppedToGround: true, npcSkills, error: tokErr }
  }

  return { weaponName: null, droppedToGround: false, error: null }
}

/** Shape a lootable object token for a dropped weapon at a grid cell. */
function groundToken(scene: { id: string; gridX: number; gridY: number }, name: string, contents: any[]) {
  return {
    scene_id: scene.id,
    name,
    token_type: 'object',
    grid_x: scene.gridX,
    grid_y: scene.gridY,
    is_visible: true,
    color: '#EF9F27',
    wp_max: null,
    wp_current: null,
    lootable: true,
    contents,
  } as any
}
