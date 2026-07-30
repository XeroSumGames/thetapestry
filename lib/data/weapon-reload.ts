// Weapon reload writes for the Ready Weapon modal. Extracted from the table
// page so the DB writes live behind the lib/data seam (not inline .from in an
// 11k-line component) and so PC + NPC reload share one code path.
//
// PCs store their weapon on characters.data.weaponPrimary; NPCs store it on
// campaign_npcs.skills.weapon. The caller computes the reloaded weapon object
// and passes the surrounding container so we can splice it back correctly.

import { createClient } from '../supabase-browser'

/** Reload a PC's primary weapon. Returns the new data blob + any error. */
export async function reloadPcWeapon(
  characterId: string,
  charData: any,
  reloadedWeapon: any,
): Promise<{ newData: any; error: string | null }> {
  const newData = { ...charData, weaponPrimary: reloadedWeapon }
  const { error } = await createClient()
    .from('characters')
    .update({ data: newData })
    .eq('id', characterId)
  return { newData, error: error?.message ?? null }
}

/** Reload an NPC's weapon (campaign_npcs.skills.weapon). */
export async function reloadNpcWeapon(
  npcId: string,
  npcSkills: any,
  reloadedWeapon: any,
): Promise<{ newSkills: any; error: string | null }> {
  const newSkills = { ...(npcSkills ?? {}), weapon: { ...(npcSkills?.weapon ?? {}), ...reloadedWeapon } }
  const { error } = await createClient()
    .from('campaign_npcs')
    .update({ skills: newSkills })
    .eq('id', npcId)
  return { newSkills, error: error?.message ?? null }
}
