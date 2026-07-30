// Pure skill-selection for the Unjam / Repair action (Ready Weapon modal).
// Extracted from the table page so the god-component shrinks and the choice
// logic is unit-testable. Picks the best of Tinkerer / Weaponsmith / the
// weapon's combat skill (Melee or Ranged), returning the skill + its AMod +
// level so the caller can fire the roll request.

interface SkillEntry { skillName?: string; name?: string; level?: number }

export interface UnjamSkillChoice {
  skill: string
  amod: number
  level: number
}

/**
 * @param isMelee     weapon is melee (Repair) vs ranged (Unjam)
 * @param pcSkills    PC skills array (data.skills), or null for an NPC
 * @param pcRapid     PC RAPID map (data.rapid), or null for an NPC
 * @param npc         NPC row (campaign_npcs) when resolving an NPC, else null
 */
export function chooseUnjamSkill(
  isMelee: boolean,
  pcSkills: SkillEntry[] | null,
  pcRapid: Record<string, number> | null,
  npc: any | null,
): UnjamSkillChoice {
  const combatSkill = isMelee ? 'Melee Combat' : 'Ranged Combat'
  const attrForCombat = isMelee ? 'PHY' : 'DEX'

  const getLevel = (skillName: string): number => {
    if (pcSkills) return pcSkills.find(s => s.skillName === skillName)?.level ?? 0
    if (npc) {
      const entries: SkillEntry[] = Array.isArray(npc.skills?.entries) ? npc.skills.entries : []
      return entries.find(s => s.name === skillName)?.level ?? 0
    }
    return 0
  }

  const rapid: Record<string, number> = pcRapid ?? {
    RSN: npc?.reason ?? 0, ACU: npc?.acumen ?? 0, PHY: npc?.physicality ?? 0,
    INF: npc?.influence ?? 0, DEX: npc?.dexterity ?? 0,
  }

  let bestSkill = combatSkill
  let bestAttr = attrForCombat
  let bestLevel = 0
  for (const c of [
    { skill: 'Tinkerer', attr: 'DEX' },
    { skill: 'Weaponsmith', attr: 'DEX' },
    { skill: combatSkill, attr: attrForCombat },
  ]) {
    const lvl = getLevel(c.skill)
    if (lvl > bestLevel) { bestLevel = lvl; bestSkill = c.skill; bestAttr = c.attr }
  }

  return { skill: bestSkill, amod: rapid[bestAttr] ?? 0, level: bestLevel }
}
