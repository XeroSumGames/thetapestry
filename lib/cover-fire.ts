// H4 Cover Fire (Beta-500 Gate 2.1). Extracted from the table page so the
// god-component does not grow and the DB writes live outside the component.
//
// Behavior (Xero canon 2026-07-20): Cover Fire lays a -2 CMod on the target's
// next action AND spends a round of the shooter's ammo. The -2 lives on the
// target's initiative_order.incoming_cmod - it survives the target's activation
// (activateUpdate leaves it alone) so it actually bites, then nextTurn clears
// it at the target's turn end. It was previously written to aim_bonus, which
// activation reset to 0 -> a guaranteed no-op that still cost an action.

import { getWeaponByName } from './weapons'
import { updateCharacterDataField } from './data/characters'
import { updateCampaignNpc } from './data/campaign-npcs'

interface WeaponMeta { category?: string; clip?: number | null }
interface ShooterPc { character: { id: string; name: string; data?: any } }
interface ShooterNpc { id: string; name: string; skills?: any }
type ListSetter = (updater: (prev: any[]) => any[]) => void

export interface CoverFireShooter {
  shooterPc: ShooterPc | null
  shooterNpc: ShooterNpc | null
  weapon: WeaponMeta | null
  ammoCurrent: number | null
}

/** A ranged, clip-fed weapon with ammo can lay down Cover Fire (it spends a
 *  round). Empty clip / melee / explosive / no weapon cannot. A legacy weapon
 *  with a null ammoCurrent counts as unlimited (allowed, spends nothing). */
export function canCoverFire(weapon: WeaponMeta | null | undefined, ammoCurrent: number | null): boolean {
  return !!weapon && weapon.category !== 'melee' && weapon.category !== 'explosive'
    && !!weapon.clip && weapon.clip > 0 && !(ammoCurrent !== null && ammoCurrent <= 0)
}

/** Resolve the active combatant's (shooter's) primary weapon + current ammo,
 *  mirroring the Attack-button gate. Works for a PC or an NPC combatant. */
export function resolveCoverFireShooter(
  activeEntry: { character_id?: string | null; character_name: string; is_npc?: boolean },
  entries: readonly ShooterPc[],
  campaignNpcs: readonly ShooterNpc[],
): CoverFireShooter {
  const shooterPc = entries.find(e => activeEntry.character_id
    ? e.character.id === activeEntry.character_id
    : e.character.name === activeEntry.character_name) ?? null
  const shooterNpc = activeEntry.is_npc
    ? (campaignNpcs.find(n => n.name === activeEntry.character_name) ?? null)
    : null
  const weaponName = shooterPc?.character.data?.weaponPrimary?.weaponName ?? shooterNpc?.skills?.weapon?.weaponName ?? null
  const weapon = weaponName ? (getWeaponByName(weaponName) as WeaponMeta | null) : null
  const ammoCurrent: number | null =
    shooterPc?.character.data?.weaponPrimary?.ammoCurrent ??
    shooterNpc?.skills?.weapon?.ammoCurrent ??
    null
  return { shooterPc, shooterNpc, weapon, ammoCurrent }
}

export interface ApplyCoverFireDeps {
  supabase: any
  targetEntryId: string
  targetIncoming: number
  shooter: CoverFireShooter
  setInitiativeOrder: ListSetter
  setEntries: ListSetter
  setCampaignNpcs: ListSetter
  setRosterNpcs: ListSetter
  onError: (err: any, ctx: string) => void
  broadcast: () => void
}

/** Write the -2 to the target's incoming_cmod and spend one round of the
 *  shooter's ammo, applying optimistic state + a realtime broadcast. Ammo
 *  writes route through lib/data (read-verify merge), never a raw component
 *  .from. The incoming_cmod value converges for everyone via loadInitiative
 *  in consumeAction; the optimistic setInitiativeOrder + broadcast just make
 *  it instant. A null shooter ammo (legacy unlimited) spends nothing. */
export async function applyCoverFire(d: ApplyCoverFireDeps): Promise<void> {
  const newIncoming = d.targetIncoming - 2
  const { data: cfRows, error } = await d.supabase.from('initiative_order')
    .update({ incoming_cmod: newIncoming }).eq('id', d.targetEntryId).select('id, incoming_cmod')
  if (error) { d.onError(error, 'applySocialAction:cover-fire'); return }
  if (!cfRows || cfRows.length === 0) {
    console.error('[applyCoverFire] SILENT RLS FAIL - incoming_cmod not written. Run sql/initiative-order-rls-members-write.sql.')
    return
  }
  d.setInitiativeOrder(prev => prev.map(e => e.id === d.targetEntryId ? { ...e, incoming_cmod: newIncoming } : e))

  const { shooterPc, shooterNpc, ammoCurrent } = d.shooter
  if (ammoCurrent !== null && ammoCurrent > 0) {
    if (shooterPc) {
      const cd: any = shooterPc.character.data ?? {}
      const newPrimary = { ...cd.weaponPrimary, ammoCurrent: Math.max(0, (cd.weaponPrimary?.ammoCurrent ?? 0) - 1) }
      await updateCharacterDataField(shooterPc.character.id, { weaponPrimary: newPrimary })
      d.setEntries(prev => prev.map(e => e.character.id === shooterPc.character.id
        ? { ...e, character: { ...e.character, data: { ...(e.character.data ?? {}), weaponPrimary: newPrimary } } } : e))
    } else if (shooterNpc) {
      const sk: any = shooterNpc.skills ?? {}
      const newSkills = { ...sk, weapon: { ...sk.weapon, ammoCurrent: Math.max(0, (sk.weapon?.ammoCurrent ?? 0) - 1) } }
      await updateCampaignNpc(shooterNpc.id, { skills: newSkills })
      d.setCampaignNpcs(prev => prev.map(n => n.id === shooterNpc.id ? { ...n, skills: newSkills } : n))
      d.setRosterNpcs(prev => prev.map(n => n.id === shooterNpc.id ? { ...n, skills: newSkills } : n))
    }
  }
  d.broadcast()
}
