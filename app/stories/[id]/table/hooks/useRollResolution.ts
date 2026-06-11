'use client'
// useRollResolution - owns executeRoll, the combat/skill roll resolution engine
// extracted verbatim from the table page (grand re-architecture Phase 3, 3c-B3).
//
// APPROACH (same as useGmTools): the page destructures executeRoll out of this
// hook and the modal call sites are UNCHANGED. The body is moved byte-for-byte;
// every external identifier it used is now a destructured dep, so behavior is
// identical and tsc verifies completeness (a missed name fails to resolve). The
// pure roll math already lives in lib/table-roll-context.ts; this hook is the
// orchestration layer (DB writes, optimistic state, broadcasts) on top of it.
// Deeper pure/effect separation is a deliberate follow-up, NOT done here, so a
// 2-client smoke failure stays localizable.
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import { createClient } from '../../../../../lib/supabase-browser'
import { useRollsFeed } from '../../../../../components/RollsFeed'
import { OUTCOME } from '../../../../../lib/roll-outcomes'
import { getOutcome, outcomeColor, compactRollSummary } from '../../../../../lib/roll-helpers'
import { upkeepTransition, type UpkeepOutcome } from '../../../../../lib/upkeep'
import type { ItemCondition } from '../../../../../lib/xse-schema'
import { getWeaponByName, getTraitValue, CONDITION_CMOD, weaponCausesWoundInfection } from '../../../../../lib/weapons'
import { rollDamage, calculateDamage, type ArmorPiece, type AttackerCategory } from '../../../../../lib/damage'
import { computeBlastSplash, mortalWoundCountdown, buildCmodBreakdown, computeAttackCmod, type CmodSources, type AttackCmodCtx } from '../../../../../lib/table-roll-context'
import { insertRollLog } from '../../../../../lib/data/roll-log'
import { trace } from '../../../../../lib/playtest-recorder'
import { queuePendingHeal } from '../../../../../lib/campaign-clock'
import { resolveFirstImpression } from '../../../../../lib/first-impression-resolver'
import { ARMOR, LASTING_WOUNDS, LASTING_WOUND_NARRATIVE } from '../../../../../lib/xse-schema'
import type { CampaignNpc } from '../../../../../components/NpcRoster'
import type { InventoryItem } from '../../../../../components/InventoryPanel'
import { rollD6, type TableEntry, type InitiativeEntry, type PendingRoll, type RollResult, type Campaign, type DamageResult, type WeaponContext } from '../types'

type MapToken = { id: string; name: string; token_type: string; character_id: string | null; npc_id: string | null; grid_x: number; grid_y: number; wp_max: number | null; wp_current: number | null; controlled_by_character_ids?: string[] | null; rotation?: number }
type GrenadeCell = { gx: number; gy: number } | null
type InsightSavePromptVal = { stateId: string; targetName: string; newWP: number; newRP: number; phyAmod: number; insightDice: number } | null
type CoordEffortRefVal = { participantIds: string[]; totalParticipants: number; leadCmod: number; isActive: boolean; leadRollPending: boolean; chainId: string } | null
type HealPendingVal = { targetCharId: string; targetName: string; kit: 'none' | 'first_aid' | 'doctors_bag' } | null
type SupaClient = ReturnType<typeof createClient>
type RollsFeedApi = ReturnType<typeof useRollsFeed>

export interface RollResolutionDeps {
  id: string
  userId: string | null
  supabase: SupaClient
  entries: TableEntry[]
  campaign: Campaign | null
  campaignNpcs: any[]
  rosterNpcs: any[]
  initiativeOrder: InitiativeEntry[]
  combatActive: boolean
  mapTokens: MapToken[]
  mapCellFeet: number
  pendingRoll: PendingRoll | null
  cmod: string
  targetName: string
  grenadeTargetCell: GrenadeCell
  preRollInsight: 'none' | '3d6' | '+3cmod'
  useBurst: boolean
  syncedSelectedEntry: TableEntry | null
  rollsFeed: RollsFeedApi
  setEntries: Dispatch<SetStateAction<TableEntry[]>>
  setCampaignNpcs: Dispatch<SetStateAction<any[]>>
  setRosterNpcs: Dispatch<SetStateAction<any[]>>
  setViewingNpcs: Dispatch<SetStateAction<CampaignNpc[]>>
  setMapTokens: Dispatch<SetStateAction<MapToken[]>>
  setRollResult: Dispatch<SetStateAction<RollResult | null>>
  setRolling: Dispatch<SetStateAction<boolean>>
  setGrenadeTargetCell: Dispatch<SetStateAction<GrenadeCell>>
  setInsightSavePrompt: Dispatch<SetStateAction<InsightSavePromptVal>>
  setCoordEffortTick: Dispatch<SetStateAction<number>>
  cmodSourcesRef: MutableRefObject<CmodSources>
  coordEffortRef: MutableRefObject<CoordEffortRefVal>
  coordinateTargetRef: MutableRefObject<string | null>
  firedLastingChecksRef: MutableRefObject<Set<string>>
  healPendingRef: MutableRefObject<HealPendingVal>
  initChannelRef: MutableRefObject<any>
  npcFetchInFlightRef: MutableRefObject<boolean>
  pendingInfectionChecksRef: MutableRefObject<Array<{ name: string; amod: number }>>
  pendingJamLogRef: MutableRefObject<string | null>
  pendingWoundInfectionRef: MutableRefObject<Set<string>>
  groupCheckPayloadRef: MutableRefObject<{ participants: string[]; skill: string } | null>
  rollExecutedRef: MutableRefObject<boolean>
  sprintAthleticsPendingRef: MutableRefObject<boolean>
  sprintAthleticsRoundDeferredRef: MutableRefObject<boolean>
  userIdRef: MutableRefObject<string | null>
  appendProgressionLog: (characterId: string, type: any, text: string) => Promise<void>
  getRangeCMod: () => number
  handleRollRequest: (label: string, amod: number, smod: number, weapon?: WeaponContext, bypassTurnGate?: boolean) => void
  loadEntries: (campaignId: string) => Promise<void>
  loadInitiative: (campaignId: string) => Promise<void>
  maybeLogWoundInfection: (targetName: string | null | undefined) => Promise<void>
  nextTurn: () => Promise<void>
  saveRollToLog: (die1: number, die2: number, amod: number, smod: number, cmodVal: number, label: string, characterName: string, isReroll?: boolean, target?: string | null, damageData?: DamageResult, insightUsed?: '3d6' | '+3cmod' | null, die3?: number | null, cmodBreakdown?: Array<{ label: string; value: number }> | null) => Promise<{ total: number; outcome: any; insightAwarded: boolean }>
}

export function useRollResolution(deps: RollResolutionDeps) {
  const {
    id, userId, supabase, entries, campaign, campaignNpcs, rosterNpcs, initiativeOrder,
    combatActive, mapTokens, mapCellFeet, pendingRoll, cmod, targetName, grenadeTargetCell,
    preRollInsight, useBurst, syncedSelectedEntry, rollsFeed,
    setEntries, setCampaignNpcs, setRosterNpcs, setViewingNpcs, setMapTokens, setRollResult,
    setRolling, setGrenadeTargetCell, setInsightSavePrompt, setCoordEffortTick,
    cmodSourcesRef, coordEffortRef, coordinateTargetRef, firedLastingChecksRef, healPendingRef,
    initChannelRef, npcFetchInFlightRef, pendingInfectionChecksRef, pendingJamLogRef,
    pendingWoundInfectionRef, groupCheckPayloadRef, rollExecutedRef, sprintAthleticsPendingRef, sprintAthleticsRoundDeferredRef,
    userIdRef, appendProgressionLog, getRangeCMod, handleRollRequest, loadEntries, loadInitiative,
    maybeLogWoundInfection, nextTurn, saveRollToLog,
  } = deps

  async function executeRoll() {
    if (!pendingRoll || !userId) return
    // Self-attack confirmation
    if (pendingRoll.weapon && targetName) {
      const activeEntry = initiativeOrder.find(e => e.is_active)
      if (activeEntry && activeEntry.character_name === targetName) {
        if (!confirm(`${targetName} is about to attack themselves. Are you sure?`)) return
      }
    }
    rollExecutedRef.current = true
    setRolling(true)
    // Determine character name. Most labels containing " - " put the attacker
    // name first (e.g. "Goon 1 - Attack (Pistol)", "David Battersby - Aim"),
    // but the PC weapon-attack button builds its label as "Attack - <weapon>"
    // which previously made the code write the literal string "Attack" into
    // roll_log.character_name. Guard against that by only trusting the first
    // split-part when it actually matches a known PC or NPC name.
    const labelParts = pendingRoll.label.split(' - ')
    const myEntry = entries.find(e => e.userId === userId)
    const firstPart = labelParts[0]
    const firstPartIsKnownName = labelParts.length > 1 && (
      entries.some(e => e.character.name === firstPart) ||
      campaignNpcs.some((n: any) => n.name === firstPart)
    )
    const characterName = firstPartIsKnownName
      ? firstPart
      : (syncedSelectedEntry?.character.name ?? myEntry?.character.name ?? 'Unknown')
    // Insight Dice belong to the ROLLER (the character the roll is attributed
    // to - the active combatant on an attack), not the viewer. Without this, a
    // GM rolling an attack FOR a PC spent/showed the GM's own (often zero)
    // pool, so the Insight option vanished (Xero, live 2026-06-01: Cree had no
    // insight option on a GM-rolled unarmed attack). Falls back to myEntry for
    // self-rolls, where roller == viewer anyway.
    const insightHolder = entries.find(e => e.character.name === characterName) ?? myEntry
    // CMod is itemized by source (3c). The modal field holds the auto-computed
    // net (from computeAttackCmod) plus any manual GM tweak; range / sick /
    // insight are layered on here. Each non-zero source becomes its own labeled
    // term so Aim is never silently netted away by target defense.
    const fieldCmod = parseInt(cmod, 10) || 0
    const rangeCmod = pendingRoll.weapon ? getRangeCMod() : 0
    // Infection - sick characters take -2 CMod on physical checks
    // (Athletics / Melee Combat / Ranged Combat / Stealth / Survival
    // / Unarmed Combat) per locked canon. Detect by both:
    //   (a) skill name in the label (e.g. "Cree - Athletics")
    //   (b) combat action that ALWAYS uses a physical skill behind
    //       the scenes (Attack / Charge / Subdue / Sprint / Grapple
    //       / Unarmed / Fire from Cover / Rapid Fire).
    // Logged via infectionSickCmodNote so the player sees the -2
    // appear in the roll-feed traitNotes alongside the result.
    let infectionSickCmodNote = ''
    let sickCmod = 0
    {
      const rollerEntry = entries.find(e => e.character.name === characterName)
      const rollerNpc = campaignNpcs.find((n: any) => n.name === characterName)
      const rollerInfection = rollerEntry?.liveState?.infection_state
        ?? (rollerNpc as any)?.infection_state
      if (rollerInfection) {
        const PHYSICAL_LABEL_RE = /\b(Athletics|Melee Combat|Ranged Combat|Stealth|Survival|Unarmed Combat|Attack|Charge|Subdue|Sprint|Grapple|Unarmed|Fire from Cover|Rapid Fire)\b/i
        if (PHYSICAL_LABEL_RE.test(pendingRoll.label)) {
          sickCmod = -2
          infectionSickCmodNote = `🤒 Sick (${rollerInfection === 'wound' ? 'Wound Infection' : 'Sickness & Disease'}) - -2 CMod on physical check.`
        }
      }
    }
    let die1: number, die2: number
    let preRollSpent = false
    // d3 raw value when a 3d6 Insight Die is spent - passed to saveRollToLog
    // so it lands in damage_json.die3 for the expanded-math renderer.
    let insightDie3: number | null = null
    // Populated only on 3d6 Insight rolls - carries all three dice so the
    // modal render can show three boxes instead of two (die2 would
    // otherwise read as d2+d3, misleadingly as one die).
    let insightDiceRolled: number[] | undefined

    if (preRollInsight === '3d6' && insightHolder?.liveState && insightHolder.liveState.insight_dice >= 1) {
      // Per SRD: roll 3d6 and KEEP ALL THREE dice (playtest #6 - do NOT
      // drop lowest). Fit into the existing die1/die2 storage columns by
      // putting the first die in die1 and the sum of the other two in
      // die2; total = die1+die2+mods = d1+d2+d3+mods. die2 is always ≥2
      // so the Low-Insight pair check can't fire here, and we pass the
      // skipInsightPair flag to getOutcome so a coincidental d1=6, d2+d3=6
      // doesn't trigger High Insight on a roll that already spent one.
      // d3 is ALSO stored separately on damage_json so the renderer can split
      // die2 back into raw d2 (die2 - die3) for [d1+d2+d3 (insight die)].
      const d1 = rollD6(), d2 = rollD6(), d3 = rollD6()
      die1 = d1
      die2 = d2 + d3
      insightDie3 = d3
      insightDiceRolled = [d1, d2, d3]  // surfaced in rollResult so the modal shows all 3 dice boxes
      const newInsight = insightHolder.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', insightHolder.stateId)
      preRollSpent = true
    } else if (preRollInsight === '+3cmod' && insightHolder?.liveState && insightHolder.liveState.insight_dice >= 1) {
      die1 = rollD6()
      die2 = rollD6()
      const newInsight = insightHolder.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', insightHolder.stateId)
      preRollSpent = true
    } else {
      die1 = rollD6()
      die2 = rollD6()
    }

    // Assemble the itemized CMod. autoNet = the target-dependent sources
    // captured at prefill; whatever the field holds beyond that is a manual GM
    // tweak (its own term). insight +3 only when a die was actually spent.
    // cmodVal reconciles exactly to the old field + range + sick + insight sum.
    const autoSources = cmodSourcesRef.current || {}
    const autoNet = (autoSources.weaponCondition ?? 0) + (autoSources.aim ?? 0)
      + (autoSources.coordinate ?? 0) + (autoSources.coordinatedEffort ?? 0)
      + (autoSources.sameTarget ?? 0) + (autoSources.targetDefense ?? 0)
    const insightCmod = (preRollInsight === '+3cmod' && preRollSpent) ? 3 : 0
    const { terms: cmodBreakdown, total: cmodVal } = buildCmodBreakdown({
      ...autoSources,
      range: rangeCmod,
      sick: sickCmod,
      insight: insightCmod,
      manual: fieldCmod - autoNet,
    })

    const total = die1 + die2 + pendingRoll.amod + pendingRoll.smod + cmodVal
    const outcome = getOutcome(total, die1, die2, preRollInsight === '3d6' && preRollSpent)
    // Coordinated Effort lead-roll resolution: if this roll's label is
    // the lead roll and the chain's leadRollPending flag is set, map the
    // outcome to a leadCmod (per the ladder in spec-coordinated-effort.md)
    // and activate the chain. Low Insight = chain collapses immediately.
    if (pendingRoll.label.startsWith('Coordinated Effort - ') && coordEffortRef.current?.leadRollPending) {
      const cef = coordEffortRef.current
      if (outcome === 'Low Insight') {
        // Chain collapses; clear the ref so subsequent rolls don't get any bonus.
        coordEffortRef.current = null
      } else {
        const leadCmod =
          outcome === 'High Insight' ? 3
          : outcome === 'Wild Success' ? 2
          : outcome === 'Success' ? 1
          : outcome === 'Failure' ? -1
          : outcome === 'Dire Failure' ? -3
          : 0
        coordEffortRef.current = { ...cef, leadCmod, isActive: true, leadRollPending: false }
      }
      setCoordEffortTick(t => t + 1)
    }
    // Award Insight Die - only to PCs, or Antagonist NPCs (Bystanders/Goons/Foes never get Insight Dice)
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPCRoll = isHighLow && pendingRoll.label.includes(' - ') && !entries.some(e => pendingRoll.label.startsWith(e.character.name))
    const npcType = isNPCRoll ? (rosterNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? campaignNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPCRoll && npcType !== 'antagonist')
    if (insightAwarded && insightHolder?.liveState) {
      const currentInsight = preRollSpent ? insightHolder.liveState.insight_dice - 1 : insightHolder.liveState.insight_dice
      const newInsight = currentInsight + 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', insightHolder.stateId)
    }

    // Throw-time consumable decrement. Explosives (Grenade, Molotov,
    // Flash-Bang, Mortar, Rocket Launcher) are one-use thrown items whose
    // carry count lives on the weapon slot (PC: data.weaponPrimary/Secondary.qty,
    // NPC: skills.weapon/weapon2.qty). Spend one on ANY throw at a target or
    // cell regardless of outcome - the pin is pulled / the bottle is lit
    // whether or not it lands true. Gated on category 'explosive' (NOT the
    // Blast Radius trait) to match where qty is seeded, so Molotov + Flash-Bang
    // (no Blast trait, so they never hit the grenade-fumble path) decrement too.
    if (pendingRoll.weapon && targetName) {
      const thrownW = getWeaponByName(pendingRoll.weapon.weaponName)
      if (thrownW?.category === 'explosive') {
        const active = initiativeOrder.find(ie => ie.is_active)
        const throwerEntry = (active ? entries.find(e => e.character.id === active.character_id) : null)
          ?? entries.find(e => e.userId === userId)
        const throwerNpc: CampaignNpc | null = active && !throwerEntry && active.npc_id
          ? (rosterNpcs.find(n => n.id === active.npc_id) ?? campaignNpcs.find((n: any) => n.id === active.npc_id))
          : null
        const wname = pendingRoll.weapon.weaponName
        if (throwerEntry) {
          const cd = throwerEntry.character.data ?? {}
          for (const slot of ['weaponPrimary', 'weaponSecondary'] as const) {
            if (cd[slot]?.weaponName === wname) {
              const cur = typeof cd[slot].qty === 'number' ? cd[slot].qty : 1
              const newData = { ...cd, [slot]: { ...cd[slot], qty: Math.max(0, cur - 1) } }
              await supabase.from('characters').update({ data: newData }).eq('id', throwerEntry.character.id)
              setEntries(prev => prev.map(e => e.character.id === throwerEntry.character.id
                ? { ...e, character: { ...e.character, data: newData } } : e))
              break
            }
          }
        } else if (throwerNpc) {
          const sk = throwerNpc.skills ?? {}
          for (const slot of ['weapon', 'weapon2'] as const) {
            if (sk[slot]?.weaponName === wname) {
              const cur = typeof sk[slot].qty === 'number' ? sk[slot].qty : 1
              const newSkills = { ...sk, [slot]: { ...sk[slot], qty: Math.max(0, cur - 1) } }
              await supabase.from('campaign_npcs').update({ skills: newSkills }).eq('id', throwerNpc.id)
              setCampaignNpcs(prev => prev.map(n => n.id === throwerNpc.id ? { ...n, skills: newSkills } : n))
              setRosterNpcs(prev => prev.map(n => n.id === throwerNpc.id ? { ...n, skills: newSkills } as any : n))
              break
            }
          }
        }
      }
    }

    // Calculate and apply damage for successful weapon attacks
    let damageResult: DamageResult | undefined
    let traitNotes: string[] = []
    // Consolidated per-victim blast line, hoisted out of the blast block so it
    // can ride damage_json into the persistent feed (traitNotes only reaches
    // the transient result modal, so AoE victims were under-reported - 3c-A4).
    let blastFeedSummary: string | null = null
    // Auto-loot log rows are COLLECTED here during damage processing and
    // inserted AFTER saveRollToLog so the attack row ("used Unarmed Combat
    // on Crate 2") shows up in the feed BEFORE the loot row ("looked through
    // the remains of Crate 2 and found something"). Previously the loot row
    // inserted inline and landed ahead of the attack in the feed, reading
    // as a time-travel paradox to players.
    const pendingLootLogs: any[] = []

    // Grenade fumbles - once the pin is pulled, the grenade detonates no
    // matter how the throwing roll lands. Failure/Dire scatter the impact
    // point in a random direction (like a fumbled shot); Low Insight has
    // the grenade going off in the thrower's own hand. The clean-throw
    // outcomes (Success / Wild / High Insight) fall through to the normal
    // damage path below. Restricted to weapons with the Blast Radius trait
    // so a missed melee swing doesn't trigger any of this.
    const isGrenadeFumble = !!pendingRoll.weapon &&
      getTraitValue(pendingRoll.weapon.traits ?? [], 'Blast Radius') !== null &&
      (outcome === 'Failure' || outcome === 'Dire Failure' || outcome === 'Low Insight')

    if (pendingRoll.weapon && targetName && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight' || isGrenadeFumble)) {
      const weapon = pendingRoll.weapon
      const w = getWeaponByName(weapon.weaponName)
      // 'Unarmed' is a pseudo-weapon fabricated inline by the CharacterCard
      // Unarmed Attack button - it has no entry in getWeaponByName, so we
      // have to recognize it explicitly as melee. Without this, PHY AMod is
      // never added to damage (rollDamage skips phyBonus) and the defensive
      // mod uses DEX instead of PHY, easily producing 0 damage.
      const isMelee = w?.category === 'melee' || weapon.weaponName === 'Unarmed'
      const attackerPhy = myEntry?.character.data?.rapid?.PHY ?? 0
      const traits = weapon.traits ?? []
      const isStun = getTraitValue(traits, 'Stun') !== null
      const burstCount = getTraitValue(traits, 'Automatic Burst')
      const hasBlast = getTraitValue(traits, 'Blast Radius') !== null
      const burningVal = getTraitValue(traits, 'Burning')
      const hasCloseUp = getTraitValue(traits, 'Close-Up') !== null
      const hasConeUp = getTraitValue(traits, 'Cone-Up') !== null

      // Grenade fumble - compute the actual blast center now so it can
      // override the normal cell/token lookup in the AoE block below.
      // Push a descriptive log line into traitNotes so the expanded chat
      // entry shows what happened ("scattered NE 3 cells" etc.).
      let blastCenterOverride: { gx: number; gy: number } | null = null
      if (isGrenadeFumble) {
        const FUMBLE_DIRS: { dx: number; dy: number; name: string }[] = [
          { dx: 0,  dy: -1, name: 'N'  },
          { dx: 1,  dy: -1, name: 'NE' },
          { dx: 1,  dy: 0,  name: 'E'  },
          { dx: 1,  dy: 1,  name: 'SE' },
          { dx: 0,  dy: 1,  name: 'S'  },
          { dx: -1, dy: 1,  name: 'SW' },
          { dx: -1, dy: 0,  name: 'W'  },
          { dx: -1, dy: -1, name: 'NW' },
        ]
        const activeIE = initiativeOrder.find(ie => ie.is_active)
        const throwerTok = activeIE
          ? mapTokens.find(t =>
              (activeIE.character_id && t.character_id === activeIE.character_id) ||
              (activeIE.npc_id && t.npc_id === activeIE.npc_id)
            )
          : null
        if (outcome === 'Low Insight') {
          if (throwerTok) {
            blastCenterOverride = { gx: throwerTok.grid_x, gy: throwerTok.grid_y }
            traitNotes.push(`💥 Moment of Low Insight - grenade detonates in hand at thrower's cell (${throwerTok.grid_x},${throwerTok.grid_y}).`)
          } else {
            traitNotes.push(`💥 Moment of Low Insight - grenade detonates, but the thrower has no map token, so no AoE applied.`)
          }
        } else {
          // Failure / Dire Failure - find the intended cell, then scatter.
          let intended: { gx: number; gy: number } | null = null
          if (grenadeTargetCell) {
            intended = { gx: grenadeTargetCell.gx, gy: grenadeTargetCell.gy }
          } else {
            const tok = mapTokens.find(mt => {
              const pe = entries.find(e => e.character.name === targetName)
              if (pe && mt.character_id === pe.character.id) return true
              const npc = campaignNpcs.find((n: any) => n.name === targetName)
              if (npc && mt.npc_id === npc.id) return true
              return false
            })
            if (tok) intended = { gx: tok.grid_x, gy: tok.grid_y }
          }
          if (intended) {
            const dir = FUMBLE_DIRS[Math.floor(Math.random() * 8)]
            // Failure: 1d4 cells. Dire Failure: 2d4 cells.
            const distRoll = outcome === 'Dire Failure'
              ? (Math.floor(Math.random() * 4) + 1) + (Math.floor(Math.random() * 4) + 1)
              : (Math.floor(Math.random() * 4) + 1)
            const newGx = Math.max(1, intended.gx + dir.dx * distRoll)
            const newGy = Math.max(1, intended.gy + dir.dy * distRoll)
            blastCenterOverride = { gx: newGx, gy: newGy }
            const ft = mapCellFeet || 3
            const tier = outcome === 'Dire Failure' ? '⚠️ Dire Failure' : '🎲 Wild throw'
            traitNotes.push(`${tier} - scattered ${dir.name} ${distRoll} cell${distRoll !== 1 ? 's' : ''} (${distRoll * ft} ft). Impact: (${newGx},${newGy}).`)
          } else {
            traitNotes.push(`🎲 Wild throw - but no valid origin cell, blast not resolved.`)
          }
        }
      }

      // Automatic Burst: roll damage multiple times (only if player opted in)
      const rolls = (useBurst && burstCount !== null && burstCount > 0) ? burstCount : 1
      let totalBase = 0, totalDice = 0, totalPhy = 0
      let diceDesc = ''
      for (let i = 0; i < rolls; i++) {
        const dmg = rollDamage(weapon.damage, attackerPhy, !!isMelee)
        totalBase += dmg.base
        totalDice += dmg.diceRoll
        totalPhy += dmg.phyBonus
        if (i === 0) diceDesc = dmg.diceDesc
      }
      const totalWP = totalBase + totalDice + totalPhy

      // Unarmed adds SMod to damage
      const unarmedBonus = weapon.weaponName === 'Unarmed' ? pendingRoll.smod : 0

      // Find target - could be PC (in entries), NPC (in initiativeOrder + rosterNpcs), a non-combat NPC on the map, or object token (mapTokens with WP)
      const targetInitEntry = initiativeOrder.find(e => e.character_name === targetName)
      const targetEntry = entries.find(e => e.character.name === targetName) ?? (targetInitEntry?.character_id ? entries.find(e => e.character.id === targetInitEntry.character_id) : undefined)
      let targetNpc: CampaignNpc | null = !targetEntry
        ? (targetInitEntry?.is_npc
            ? (rosterNpcs.find(n => n.id === targetInitEntry.npc_id) ?? campaignNpcs.find((n: any) => n.id === targetInitEntry.npc_id))
            : (campaignNpcs.find((n: any) => n.name === targetName) ?? rosterNpcs.find(n => n.name === targetName)))
        : null
      // RLS-hidden NPC fallback: a player attacking an NPC who hasn't been
      // revealed to them gets `targetNpc === null` from the local-state
      // lookup above, because campaign_npcs / rosterNpcs RLS hides
      // unrevealed rows. Without this fallback the damage path falls
      // through every if/else branch and silently no-ops (playtest:
      // "Cruz Zwick used an Assault Rifle to Successfully Attack Frankie
      // Gibblets" - but Frankie took no damage). Server fetch by id
      // bypasses the local cache; if RLS still blocks at the DB level,
      // we surface it loudly so the GM knows to reveal the NPC or check
      // the policy.
      if (!targetEntry && !targetNpc && targetInitEntry?.is_npc && targetInitEntry.npc_id) {
        const { data: freshNpc, error: npcFetchErr } = await supabase
          .from('campaign_npcs').select('*').eq('id', targetInitEntry.npc_id).maybeSingle()
        if (npcFetchErr) console.error('[damage] NPC fallback fetch error:', npcFetchErr.message)
        if (freshNpc) {
          targetNpc = freshNpc as unknown as CampaignNpc
          trace('damage', { npcResolvedViaServerFallback: freshNpc.name, note: 'local cache missed - likely RLS' })
        } else {
          console.error('[damage] NPC fallback fetch returned null - RLS is blocking server access too. Reveal the NPC or fix the campaign_npcs RLS policy.')
        }
      }
      const targetObject = (!targetEntry && !targetNpc) ? mapTokens.find(t => t.token_type === 'object' && t.name === targetName && (t.wp_max ?? 0) > 0) : null
      const targetRapid = targetEntry?.character.data?.rapid ?? (targetNpc ? { PHY: targetNpc.physicality ?? 0, DEX: targetNpc.dexterity ?? 0 } : {})
      const targetDefBonus = targetInitEntry?.defense_bonus ?? 0
      const defensiveMod = targetObject ? 0 : ((isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)) + targetDefBonus)

      // Armor pull - defender's worn armor pieces contribute their DM
      // to mitigation. Reactive (melee-only) pieces filter out when the
      // attacker isn't melee/unarmed. Source data: defender's
      // inventory[] with worn===true; armor catalog lives in
      // lib/xse-schema.ts:ARMOR. Object targets and unrevealed NPC
      // fallbacks have empty inventory so this is a no-op for them.
      const armorPieces: ArmorPiece[] = []
      if (!targetObject) {
        const defenderInv: any[] = targetEntry
          ? (targetEntry.character.data?.inventory ?? [])
          : (targetNpc?.inventory ?? [])
        for (const inv of defenderInv) {
          if (!inv?.worn) continue
          const armorRow = ARMOR.find(a => a.name === inv.name)
          if (!armorRow) continue
          armorPieces.push({
            dm: armorRow.dm,
            reactive_melee_only: armorRow.traits.includes('reactive_melee_only'),
          })
        }
      }
      const attackerCategory: AttackerCategory | undefined =
        weapon.weaponName === 'Unarmed' ? 'unarmed'
        : isMelee ? 'melee'
        : (getWeaponByName(weapon.weaponName)?.category as AttackerCategory | undefined)

      let { finalWP, finalRP, mitigated } = calculateDamage(totalWP + unarmedBonus, weapon.rpPercent, defensiveMod, {
        rpFromRaw: isStun,
        armor: armorPieces,
        attackerCategory,
      })
      trace('damage-calc', {
        weapon: weapon.weaponName,
        damageExpr: weapon.damage,
        totalBase,
        totalDice,
        totalPhy,
        unarmedBonus,
        totalWP_raw: totalWP + unarmedBonus,
        rpPercent: weapon.rpPercent,
        isStun,
        defensiveMod,
        armorPieces_count: armorPieces.length,
        attackerCategory,
        finalWP_after_calc: finalWP,
        finalRP_after_calc: finalRP,
        mitigated,
      })
      // Subdue: full RP but 50% WP
      if (pendingRoll.label.includes('Subdue')) {
        finalWP = Math.max(1, Math.floor(finalWP / 2))
        traitNotes.push(`Subdue - WP halved to ${finalWP}`)
      }
      // After taking a hit, clear Defend bonus (one-time) but keep Take Cover bonus
      if (targetInitEntry && targetDefBonus > 0 && !targetInitEntry.has_cover) {
        supabase.from('initiative_order').update({ defense_bonus: 0 }).eq('id', targetInitEntry.id)
      }

      // Stun: zero WP damage
      if (isStun) {
        finalWP = 0
        traitNotes.push('Stun - no WP damage dealt')
        if (outcome === 'Wild Success' || outcome === 'High Insight') {
          const targetPhy = targetRapid.PHY ?? 0
          const stunRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - targetPhy)
          traitNotes.push(`Target incapacitated for ${stunRounds} round${stunRounds !== 1 ? 's' : ''}`)
        }
      }

      // Burst note
      if (useBurst && rolls > 1) {
        traitNotes.push(`Automatic Burst - ${rolls} rounds fired`)
      }

      // Blast Radius note + splash baseline
      // Per CRB p.71-72: "The damage is calculated once for the
      // explosion and the same amount is dealt to each person caught
      // in the blast." Splash uses the RAW rolled WP (before primary's
      // mitigation) - splash victims don't inherit the primary's
      // PHY/DEX defense. Primary is still mitigated as the named
      // attack recipient (handled separately above via calculateDamage).
      const blastRawWP = totalWP + unarmedBonus
      const blastRawRP = Math.floor(blastRawWP * (weapon.rpPercent / 100))
      if (hasBlast) {
        const halfWP = Math.floor(blastRawWP / 2)
        traitNotes.push(`Blast Radius - Engaged: ${blastRawWP} WP | Close: ${halfWP} WP`)
      }

      // Burning note
      if (burningVal !== null && burningVal > 0) {
        const burnRounds = Math.floor(Math.random() * 3) + 1
        traitNotes.push(`Burning - ${burningVal} WP/RP per round for ${burnRounds} round${burnRounds !== 1 ? 's' : ''}`)
      }

      // Close-Up / Cone-Up note
      if (hasCloseUp) traitNotes.push('Close-Up - at Engaged range, 50% damage to bystanders')
      if (hasConeUp) traitNotes.push('Cone-Up - at Engaged range, 50% damage to bystanders')

      damageResult = { base: totalBase, diceRoll: totalDice, diceDesc: rolls > 1 ? `${rolls}x ${diceDesc}` : diceDesc, phyBonus: totalPhy, totalWP: totalWP + unarmedBonus, finalWP, finalRP, mitigated, targetName }

      // Auto-decrement ammo for ranged attacks. Explosives are excluded -
      // they carry clip:1 but are consumables tracked by qty (decremented
      // above), not by the clip/reload system.
      if (w && !isMelee && w.clip && w.category !== 'explosive' && myEntry) {
        const charData = myEntry.character.data ?? {}
        const slots = ['weaponPrimary', 'weaponSecondary'] as const
        for (const slot of slots) {
          if (charData[slot]?.weaponName === weapon.weaponName && charData[slot]?.ammoCurrent > 0) {
            const ammoUsed = rolls > 1 ? rolls : 1
            const newAmmo = Math.max(0, charData[slot].ammoCurrent - ammoUsed)
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], ammoCurrent: newAmmo } }
            }).eq('id', myEntry.character.id)
            break
          }
        }
      }

      // Auto-apply damage to target (PC or NPC)
      trace('damage', { targetLookup: true, targetName, targetEntry: !!targetEntry, hasLiveState: !!targetEntry?.liveState, targetNpc: !!targetNpc, finalWP, finalRP })
      if (isGrenadeFumble) {
        // Grenade fumbles skip the named-target damage path entirely -
        // there's no "primary" hit because the throw missed. Damage is
        // applied through the blast AoE below using blastCenterOverride.
        trace('damage', { note: 'grenade fumble - primary skipped, blast AoE will resolve from override center', blastCenterOverride })
      } else if (targetEntry?.liveState) {
        // PC target - use character_states
        // Re-fetch fresh HP from DB to avoid stale closure values
        const { data: freshState } = await supabase.from('character_states').select('*').eq('id', targetEntry.stateId).single()
        const currentWP = freshState?.wp_current ?? targetEntry.liveState.wp_current
        const currentRP = freshState?.rp_current ?? targetEntry.liveState.rp_current
        const currentInsight = freshState?.insight_dice ?? targetEntry.liveState.insight_dice ?? 0
        const newWP = Math.max(0, currentWP - finalWP)
        const newRP = Math.max(0, currentRP - finalRP)
        trace('damage', { pcTarget: targetEntry.character.name, wp: { from: currentWP, to: newWP }, rp: { from: currentRP, to: newRP } })
        // Queue a wound-infection warning. Drained AFTER saveRollToLog
        // so the warning row's created_at follows the attack row's,
        // keeping feed order: attack first, warning below.
        if (finalWP > 0 && weaponCausesWoundInfection(weapon.weaponName)) pendingWoundInfectionRef.current.add(targetEntry.character.name)

        if (newWP === 0 && currentWP > 0 && currentInsight > 0) {
          const { error: csErr, data: csData } = await supabase.from('character_states').update({ rp_current: newRP, updated_at: new Date().toISOString() }).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else trace('damage', { pcCharacterStatesUpdateRows: csData?.length })
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, rp_current: newRP } } : e))
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: { stateId: targetEntry.stateId, patch: { rp_current: newRP } } })
          const insightData = {
            stateId: targetEntry.stateId,
            targetName: targetEntry.character.name,
            targetUserId: targetEntry.userId,
            newWP, newRP,
            phyAmod: targetEntry.character.data?.rapid?.PHY ?? 0,
            insightDice: currentInsight,
          }
          // Show modal on the PLAYER's screen - they decide whether to trade insight
          if (targetEntry.userId === userId) {
            setInsightSavePrompt(insightData)
          }
          // Broadcast so the player's client shows the modal
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound', payload: insightData })
        } else {
          const update: any = { wp_current: newWP, rp_current: newRP, updated_at: new Date().toISOString() }
          // Stress on entry to mortal-wound or incap. Per playtest rule
          // 2026-04-27 - entering either state automatically fills a Stress
          // pip (capped at 5). Mortal preempts incap when both transitions
          // would fire on the same hit, so only one pip per event.
          let stressReason: string | null = null
          if (newWP === 0 && targetEntry.liveState.wp_current > 0) {
            update.death_countdown = mortalWoundCountdown(targetEntry.character.data?.rapid?.PHY ?? 0)
            update.stress = Math.min(5, (targetEntry.liveState.stress ?? 0) + 1)
            stressReason = 'Mortally Wounded'
            await insertRollLog({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `${targetEntry.character.name} has been mortally wounded by ${characterName}, and will die if not stabilized in ${update.death_countdown} rounds.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.death,
            })
            // Auto-log mortal wound to progression log
            const tCharData = targetEntry.character.data ?? {}
            const tProgLog = tCharData.progression_log ?? []
            await supabase.from('characters').update({ data: { ...tCharData, progression_log: [{ date: new Date().toISOString(), type: 'wound', text: `Mortally wounded by ${characterName}` }, ...tProgLog] } }).eq('id', targetEntry.character.id)
            // Show modal on the player's screen if they're the one executing
            if (targetEntry.userId === userId) {
              setInsightSavePrompt({
                stateId: targetEntry.stateId,
                targetName: targetEntry.character.name,
                newWP, newRP,
                phyAmod: targetEntry.character.data?.rapid?.PHY ?? 0,
                insightDice: 0,
              })
            }
            initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound', payload: {
              stateId: targetEntry.stateId,
              targetName: targetEntry.character.name,
              targetUserId: targetEntry.userId,
              newWP, newRP,
              phyAmod: targetEntry.character.data?.rapid?.PHY ?? 0,
              insightDice: 0,
            } })
          }
          // Set incapacitation when RP first hits 0
          if (newRP === 0 && targetEntry.liveState.rp_current > 0 && newWP > 0) {
            update.incap_rounds = Math.max(1, 4 - (targetEntry.character.data?.rapid?.PHY ?? 0))
            update.stress = Math.min(5, (targetEntry.liveState.stress ?? 0) + 1)
            stressReason = 'Incapacitated'
            await insertRollLog({
              campaign_id: id, user_id: userId,
              character_name: 'Lights Out',
              label: `${targetEntry.character.name} has been Incapacitated by ${characterName}.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.incap,
            })
          }
          if (stressReason) {
            await insertRollLog({
              campaign_id: id, user_id: userId, character_name: 'System',
              label: `😰 ${targetEntry.character.name} gains a Stress from being ${stressReason}`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
            })
          }
          const { error: csErr, data: csData } = await supabase.from('character_states').update(update).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else trace('damage', { pcCharacterStatesUpdateRows: csData?.length })
          // Silent RLS failure pattern: no error, 0 rows affected. The
          // optimistic patch paints damage locally for a frame, then
          // loadEntries at the end of executeRoll re-fetches the DB's
          // unchanged value and the bar snaps back to full - user sees
          // "zero damage applied" with no diagnostic. Make it loud.
          if (!csErr && (!csData || csData.length === 0)) {
            console.error('[damage] SILENT RLS FAIL - PC wp_current not updated. Run sql/character-states-rls-fix.sql in Supabase. stateId:', targetEntry.stateId)
            alert(`Damage to ${targetEntry.character.name} was silently rejected by RLS - the row did not update.\n\nThe GM needs to run sql/character-states-rls-fix.sql in Supabase to allow GMs + campaign members to apply damage to PCs they don't own.\n\nUntil then, damage rolls against PCs will succeed visually but not persist.`)
          }
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: { stateId: targetEntry.stateId, patch: update } })
          // Mortally wounded / incapacitated - zero their actions and auto-advance if active
          if (combatActive && (newWP === 0 || newRP === 0)) {
            const initEntry = initiativeOrder.find(e => e.character_id === targetEntry.character.id)
            if (initEntry) {
              await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', initEntry.id)
              if (initEntry.is_active) {
                await nextTurn()
              }
              await loadInitiative(id)
              initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
            }
          }
        }
      } else if (targetNpc) {
        // NPC target - use campaign_npcs
        const npcWP = targetNpc.wp_current ?? targetNpc.wp_max ?? 10
        const npcRP = targetNpc.rp_current ?? targetNpc.rp_max ?? 6
        const newWP = Math.max(0, npcWP - finalWP)
        const newRP = Math.max(0, npcRP - finalRP)
        trace('damage', { npcTarget: targetNpc.name, id: targetNpc.id, wp: { from: npcWP, to: newWP }, rp: { from: npcRP, to: newRP } })
        // Queue a wound-infection warning. Drained after saveRollToLog.
        if (finalWP > 0 && weaponCausesWoundInfection(weapon.weaponName)) pendingWoundInfectionRef.current.add(targetNpc.name)
        const npcUpdate: any = { wp_current: newWP, rp_current: newRP }
        // Mortal wound - NPC enters death countdown when WP first hits 0
        if (newWP === 0 && npcWP > 0) {
          npcUpdate.death_countdown = mortalWoundCountdown(targetNpc.physicality ?? 0)
          // Log the mortal wound to the game feed
          await insertRollLog({
            campaign_id: id, user_id: userId,
            character_name: 'Death is in the air',
            label: `${targetNpc.name} has been mortally wounded by ${characterName}, and will die if not stabilized in ${npcUpdate.death_countdown} rounds.`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.death,
          })
          // Kill log entry on the attacker's progression log (PCs only).
          if (myEntry?.character?.id) {
            void appendProgressionLog(myEntry.character.id, 'kill', `Mortally wounded ${targetNpc.name} with ${weapon.weaponName}`)
          }
        }
        // Incapacitation - NPC loses consciousness when RP first hits 0
        if (newRP === 0 && npcRP > 0 && newWP > 0) {
          npcUpdate.incap_rounds = Math.max(1, 4 - (targetNpc.physicality ?? 0))
          await insertRollLog({
            campaign_id: id, user_id: userId,
            character_name: 'Lights Out',
            label: `${targetNpc.name} has been Incapacitated by ${characterName}.`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.incap,
          })
        }
        const { error: npcUpdErr, data: npcUpdData } = await supabase
          .from('campaign_npcs')
          .update(npcUpdate)
          .eq('id', targetNpc.id)
          .select()
        if (npcUpdErr) console.error('[damage] campaign_npcs update error:', npcUpdErr.message)
        else trace('damage', { campaignNpcsUpdateRows: npcUpdData?.length })
        // Direct state update for THIS client (the roller).
        const npcId = targetNpc.id
        const patch = { ...npcUpdate }
        npcFetchInFlightRef.current = true  // suppress realtime overwrite
        setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
        setTimeout(() => { npcFetchInFlightRef.current = false }, 500)
        // Broadcast to OTHER clients (GM) so they re-fetch NPC data.
        // Without this, a player dealing damage only updates their own state.
        trace('npc_damaged', { sendPrimary: true, npcId, patch, channel: initChannelRef.current ? 'ready' : 'null' })
        initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId, patch } })
        // Mortally wounded / incapacitated - zero their actions and auto-advance if active
        if (combatActive && (newWP === 0 || newRP === 0)) {
          const initEntry = initiativeOrder.find(e => e.npc_id === npcId)
          if (initEntry) {
            await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', initEntry.id)
            if (initEntry.is_active) {
              await nextTurn()
            }
            await loadInitiative(id)
            initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
          }
        }
      } else if (targetObject) {
        // Object token - update scene_tokens.wp_current. No RP, no death countdown, no initiative update.
        const curWP = targetObject.wp_current ?? targetObject.wp_max ?? 0
        const newWP = Math.max(0, curWP - finalWP)
        trace('damage', { objectTarget: targetObject.name, id: targetObject.id, wp: { from: curWP, to: newWP } })
        // .select() so a silent RLS rejection (0 rows affected, no error) is
        // distinguishable from a real update. Without this, players attacking
        // object tokens used to see the dice roll succeed but the barrel/crate
        // would never actually lose WP. Fixed by sql/scene-tokens-player-update-objects.sql.
        const { error: objErr, data: objData } = await supabase.from('scene_tokens').update({ wp_current: newWP }).eq('id', targetObject.id).select('id, wp_current')
        if (objErr) console.error('[damage] scene_tokens update error:', objErr.message)
        // Silent RLS failure: no error, 0 rows affected. Without this
        // alert the barrel's wp_current never reaches 0 in the DB, the
        // object wouldn't render as destroyed, the auto-loot `.update`
        // on scene_tokens.contents also fails silently, and the
        // attacker's `characters.update` for the loot inventory may
        // commit against a stale state. Surface it loudly so the GM
        // knows to run the SQL and re-attack.
        if (!objErr && (!objData || objData.length === 0)) {
          console.error('[damage] SILENT RLS FAIL - scene_tokens.wp_current not updated. Run sql/scene-tokens-player-update-objects.sql. tokenId:', targetObject.id, 'tokenName:', targetObject.name)
          alert(`Damage to "${targetObject.name}" was silently rejected by RLS - the token's WP did not update, so it won't show as destroyed and any loot inside won't drop.\n\nRun sql/scene-tokens-player-update-objects.sql in Supabase to allow players to damage object tokens in scenes they're part of.\n\nUntil then, players attacking barrels/crates will see damage in the log but the object stays full-health.`)
        }
        setMapTokens(prev => prev.map(t => t.id === targetObject.id ? { ...t, wp_current: newWP } : t))
        // If this object token corresponds to a campaign vehicle (matched
        // by name within campaigns.vehicles JSONB), sync that vehicle's
        // wp_current so the /vehicle popout sheet reflects damage taken
        // on the map. Map and sheet were previously two disconnected
        // sources of truth - Minnie would soak hits on the canvas but
        // her sheet still showed full WP.
        //
        // Vehicles aren't a separate table; they're a JSONB array on
        // campaigns.vehicles, so the sync is "fetch array → mutate the
        // matched entry → write array back". The /vehicle popout has a
        // postgres_changes subscription on campaigns UPDATE so the live
        // sheet refreshes automatically without close/reopen.
        void (async () => {
          const { data: camp } = await supabase
            .from('campaigns')
            .select('vehicles')
            .eq('id', id)
            .maybeSingle()
          const list = ((camp as any)?.vehicles ?? []) as any[]
          const idx = list.findIndex(v => v?.name === targetObject.name)
          if (idx < 0) return
          const next = list.map((v, i) => i === idx ? { ...v, wp_current: newWP } : v)
          const { error: vehErr } = await supabase
            .from('campaigns')
            .update({ vehicles: next })
            .eq('id', id)
          if (vehErr) console.error('[damage] vehicle sync error:', vehErr.message)
        })()

        // Auto-loot: when object is destroyed, give its contents to the attacker (PC or NPC)
        if (newWP === 0 && curWP > 0) {
          const { data: fullToken } = await supabase.from('scene_tokens').select('contents').eq('id', targetObject.id).single()
          const contents: { type: string; name: string; quantity: number }[] = fullToken?.contents ?? []
          trace('auto-loot', { crateDestroyed: targetObject.name, contents: contents.length })
          const active = initiativeOrder.find(ie => ie.is_active)
          const attackerEntry = (active ? entries.find(e => e.character.id === active.character_id) : null)
            ?? entries.find(e => e.userId === userId)
          const attackerNpc: CampaignNpc | null = active && !attackerEntry && active.npc_id
            ? (rosterNpcs.find(n => n.id === active.npc_id) ?? campaignNpcs.find((n: any) => n.id === active.npc_id))
            : null
          trace('auto-loot', { attackerEntry: attackerEntry?.character?.name, attackerNpc: attackerNpc?.name })
          if (contents.length > 0) {
            if (attackerEntry) {
              const charData = attackerEntry.character.data ?? {}
              const inv: InventoryItem[] = charData.inventory ?? []
              let newInv = [...inv]
              const lootedNames: string[] = []
              for (const item of contents) {
                const existing = newInv.find(i => i.name === item.name)
                if (existing) {
                  newInv = newInv.map(i => i === existing ? { ...i, qty: i.qty + item.quantity } : i)
                } else {
                  // If the loot matches a known weapon/gear, copy its enc +
                  // rarity and set custom=false so the Ready Weapon modal and
                  // the character sheet treat it as a real weapon, not a
                  // home-brew string. Previously every loot drop was marked
                  // custom=true and stripped of its stats.
                  const knownW = getWeaponByName(item.name)
                  newInv.push({
                    name: item.name,
                    enc: knownW?.enc ?? 0,
                    rarity: knownW?.rarity ?? 'Common',
                    notes: '',
                    qty: item.quantity,
                    custom: !knownW,
                  })
                }
                lootedNames.push(`${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
              }
              const newCharData = { ...charData, inventory: newInv }
              await supabase.from('characters').update({ data: newCharData }).eq('id', attackerEntry.character.id)
              // Optimistic patch to local entries so the Ready Weapon modal
              // (and any open character sheet) sees the loot immediately
              // instead of waiting on the realtime echo.
              setEntries(prev => prev.map(e => e.character.id === attackerEntry.character.id
                ? { ...e, character: { ...e.character, data: newCharData } }
                : e))
              // Clear contents from the destroyed object
              await supabase.from('scene_tokens').update({ contents: [] }).eq('id', targetObject.id)
              // Defer log - inserted after saveRollToLog so feed order reads
              // attack → loot instead of loot → attack (see pendingLootLogs).
              pendingLootLogs.push({
                campaign_id: id, user_id: userId, character_name: attackerEntry.character.name,
                label: `🎒 ${attackerEntry.character.name} looted ${lootedNames.join(', ')} from ${targetObject.name}`,
                die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
              })
              initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
              traitNotes.push(`Destroyed ${targetObject.name} - looted: ${lootedNames.join(', ')}`)
            } else if (attackerNpc) {
              const npcInv: InventoryItem[] = (attackerNpc.inventory ?? []) as InventoryItem[]
              let newInv = [...npcInv]
              const lootedNames: string[] = []
              for (const item of contents) {
                const existing = newInv.find(i => i.name === item.name)
                if (existing) {
                  newInv = newInv.map(i => i === existing ? { ...i, qty: i.qty + item.quantity } : i)
                } else {
                  newInv.push({ name: item.name, enc: 0, rarity: 'Common', notes: '', qty: item.quantity, custom: true })
                }
                lootedNames.push(`${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
              }
              await supabase.from('campaign_npcs').update({ inventory: newInv }).eq('id', attackerNpc.id)
              await supabase.from('scene_tokens').update({ contents: [] }).eq('id', targetObject.id)
              // Defer log - see pendingLootLogs declaration.
              pendingLootLogs.push({
                campaign_id: id, user_id: userId, character_name: attackerNpc.name,
                label: `🎒 ${attackerNpc.name} looted ${lootedNames.join(', ')} from ${targetObject.name}`,
                die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
              })
              // Reflect the updated inventory in local state so the NPC card shows it without refetch
              setCampaignNpcs(prev => prev.map(n => n.id === attackerNpc.id ? { ...n, inventory: newInv } : n))
              setRosterNpcs(prev => prev.map(n => n.id === attackerNpc.id ? { ...n, inventory: newInv } as CampaignNpc : n))
              initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
              traitNotes.push(`Destroyed ${targetObject.name} - ${attackerNpc.name} looted: ${lootedNames.join(', ')}`)
            }
          } else {
            // Container was empty - write a "found nothing" row so the feed
            // records the search even when there's nothing to take.
            const searcher = attackerEntry?.character?.name ?? attackerNpc?.name ?? 'Someone'
            pendingLootLogs.push({
              campaign_id: id, user_id: userId, character_name: searcher,
              label: `🎒 ${searcher} looked through the remains of ${targetObject.name} and found nothing`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
            })
          }
        }
      } else if (grenadeTargetCell) {
        // Grenade thrown at an empty cell - no "primary target" to damage,
        // the blast block below picks up the cell coords and splashes
        // everyone in range. Intentional that damageResult still shows
        // the rolled WP/RP so the UI's damage card reads correctly.
        trace('damage', { note: 'cell-throw - primary damage skipped, blast AoE will handle tokens', grenadeTargetCell })
      } else {
        console.error('[damage] no target resolved - damage NOT applied. targetName was:', targetName)
      }

      // Blast Radius AoE - apply scaled damage to nearby tokens on the
      // tactical map. Center is the target token by default, or the
      // cell the player clicked when it's a grenade throw-to-cell.
      if (hasBlast && mapTokens.length > 0 && (targetName || grenadeTargetCell || blastCenterOverride)) {
        // Resolve blast center. Order of precedence:
        //   1. Fumble override (Low Insight = thrower, Failure/Dire = scatter)
        //   2. Explicit cell-throw target (grenadeTargetCell)
        //   3. Token-name lookup (clean throw at a named target)
        const center = blastCenterOverride
          ? { gx: blastCenterOverride.gx, gy: blastCenterOverride.gy }
          : grenadeTargetCell
            ? { gx: grenadeTargetCell.gx, gy: grenadeTargetCell.gy }
            : (() => {
                const t = mapTokens.find(mt => {
                  const pe = entries.find(e => e.character.name === targetName)
                  if (pe && mt.character_id === pe.character.id) return true
                  const npc = campaignNpcs.find((n: any) => n.name === targetName)
                  if (npc && mt.npc_id === npc.id) return true
                  return false
                })
                return t ? { gx: t.grid_x, gy: t.grid_y } : null
              })()
        const targetTok = center ? { grid_x: center.gx, grid_y: center.gy } : null
        if (targetTok) {
          const ft = mapCellFeet || 3
          // ── BATCHED BLAST APPLICATION ──
          // Was: per-target sequential awaits - fresh-state SELECT + UPDATE
          // + stress-log INSERT for each PC, plus per-NPC and per-object
          // UPDATEs. With 4 PCs + 2 NPCs + 1 object in the blast that's
          // ~12 stacked round-trips. At 150ms RTT under 4-browser network
          // contention this routinely climbed to 30-60s of dead air; the
          // dice modal would close LONG after the log row was already in
          // the feed (playtest #14), and damage propagation lagged enough
          // that other clients had to refresh to see updates (#11), and
          // the initiative bar mid-flight saw partial liveState that
          // briefly looked like combatants vanished (#12).
          // Now: pre-fetch all PC fresh states in one bulk query, build
          // per-target update arrays, fire one Promise.all wave for the
          // table writes + a coalesced log insert + a single broadcast.
          const blastTargets: string[] = []
          // Pass 1 - collect candidate tokens + compute splash damage per token
          type BlastJob =
            | { kind: 'pc'; tok: typeof mapTokens[number]; pc: NonNullable<ReturnType<typeof entries.find>>; splashWP: number; splashRP: number; rangeBand: string }
            | { kind: 'npc'; tok: typeof mapTokens[number]; npc: any; splashWP: number; splashRP: number; rangeBand: string }
            | { kind: 'obj'; tok: typeof mapTokens[number]; splashWP: number; rangeBand: string }
          const jobs: BlastJob[] = []
          for (const tok of mapTokens) {
            // Include PC/NPC tokens AND destructible objects (wp_max != null)
            // per playtest #17 - grenades should hit barrels/crates in the
            // blast area too, not just combatants. Indestructible tokens
            // (wp_max=null, decorative) are still skipped.
            const isCombatant = !!tok.character_id || !!tok.npc_id
            const isDestructibleObject = tok.token_type === 'object' && tok.wp_max != null && tok.wp_max > 0
            if (!isCombatant && !isDestructibleObject) continue
            // Skip primary target (already damaged via token path) and
            // attacker. For cell-throws (grenadeTargetCell) and grenade
            // fumbles, there IS no primary - the impact is just empty
            // ground - so tokens AT the center cell should take full
            // blast damage instead of being skipped. isPrimary only
            // fires for clean token-targeted attacks.
            const isPrimary = !grenadeTargetCell && !isGrenadeFumble && (
              (targetEntry && tok.character_id && tok.character_id === targetEntry.character.id) ||
              (targetNpc && tok.npc_id && tok.npc_id === targetNpc.id) ||
              (targetObject && tok.id === targetObject.id) ||
              (tok.grid_x === targetTok.grid_x && tok.grid_y === targetTok.grid_y)
            )
            // Per CRB p.71-72: the blast damages everyone in radius -
            // no carve-out for the thrower. Standing in your own blast
            // is intentionally brutal (the throw modal warns first via
            // the friendly-fire confirm in TacticalMap). Only the
            // primary target is skipped here because they take damage
            // through the named-attack path above.
            if (isPrimary) continue
            // Blast radius + scaled splash math lives in lib/table-roll-context
            // (tested). Per playtest 2026-04-27: Engaged (<=5ft) full, Close
            // (<=30ft) half, beyond Close nothing. Splash uses raw blast WP/RP -
            // splash victims don't inherit the primary's mitigation.
            const splash = computeBlastSplash(tok.grid_x, tok.grid_y, targetTok.grid_x, targetTok.grid_y, ft, blastRawWP, blastRawRP)
            if (!splash) continue
            const { splashWP, splashRP, band: rangeBand } = splash
            const splashPC = entries.find(e => e.character.id === tok.character_id)
            if (splashPC?.liveState) { jobs.push({ kind: 'pc', tok, pc: splashPC, splashWP, splashRP, rangeBand }); continue }
            const splashNpc = campaignNpcs.find((n: any) => n.id === tok.npc_id)
            if (splashNpc) { jobs.push({ kind: 'npc', tok, npc: splashNpc, splashWP, splashRP, rangeBand }); continue }
            if (tok.token_type === 'object' && tok.wp_max != null) {
              jobs.push({ kind: 'obj', tok, splashWP, rangeBand })
            }
          }

          // Pass 2 - bulk-fetch fresh PC states (was: 1 SELECT per PC)
          const pcStateIds = jobs.filter(j => j.kind === 'pc').map(j => (j as any).pc.stateId as string)
          const stateById = new Map<string, any>()
          if (pcStateIds.length > 0) {
            const { data: freshStates } = await supabase.from('character_states').select('*').in('id', pcStateIds)
            for (const s of freshStates ?? []) stateById.set(s.id, s)
          }

          // Pass 3 - build update operations + local patches + stress log rows
          const tableUpdates: Promise<any>[] = []
          const stressLogRows: any[] = []
          const pcLocalPatches = new Map<string, any>()      // stateId → patch
          const npcLocalPatches = new Map<string, any>()     // npcId → patch
          const objLocalPatches = new Map<string, number>()  // tokenId → newWP
          const nowIso = new Date().toISOString()
          // SMOKE-1: a thrower standing in their own grenade radius is a
          // SPLASH victim, not the primary target - so the per-target
          // auto-advance in the named-damage branches above never sees them.
          // If the active combatant downs themselves here, combat stalls on a
          // downed-but-still-active thrower (GM has to manually click NEXT).
          // Track it and fire nextTurn once the blast writes have landed.
          const activeInit = combatActive ? initiativeOrder.find(e => e.is_active) : null
          let activeDownedByBlast = false

          for (const job of jobs) {
            if (job.kind === 'pc') {
              const fresh = stateById.get(job.pc.stateId)
              const curWP = fresh?.wp_current ?? job.pc.liveState.wp_current
              const curRP = fresh?.rp_current ?? job.pc.liveState.rp_current
              const curStress = fresh?.stress ?? job.pc.liveState.stress ?? 0
              const nWP = Math.max(0, curWP - job.splashWP)
              const nRP = Math.max(0, curRP - job.splashRP)
              const update: any = { wp_current: nWP, rp_current: nRP, updated_at: nowIso }
              let splashStressReason: string | null = null
              if (nWP === 0 && curWP > 0) {
                update.death_countdown = mortalWoundCountdown(job.pc.character.data?.rapid?.PHY ?? 0)
                update.stress = Math.min(5, curStress + 1)
                splashStressReason = 'Mortally Wounded'
              }
              if (nRP === 0 && curRP > 0 && nWP > 0) {
                update.incap_rounds = Math.max(1, 4 - (job.pc.character.data?.rapid?.PHY ?? 0))
                update.stress = Math.min(5, curStress + 1)
                splashStressReason = 'Incapacitated'
              }
              tableUpdates.push(supabase.from('character_states').update(update).eq('id', job.pc.stateId))
              pcLocalPatches.set(job.pc.stateId, update)
              if ((nWP === 0 || nRP === 0) && activeInit && !activeInit.is_npc && activeInit.character_id === job.pc.character.id) {
                activeDownedByBlast = true
              }
              if (splashStressReason) {
                stressLogRows.push({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `😰 ${job.pc.character.name} gains a Stress from being ${splashStressReason}`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
                })
              }
              blastTargets.push(`${job.pc.character.name} (${job.rangeBand}): ${job.splashWP} WP, ${job.splashRP} RP`)
            } else if (job.kind === 'npc') {
              const curWP = job.npc.wp_current ?? job.npc.wp_max ?? 10
              const curRP = job.npc.rp_current ?? job.npc.rp_max ?? 6
              const nWP = Math.max(0, curWP - job.splashWP)
              const nRP = Math.max(0, curRP - job.splashRP)
              const npcUpd: any = { wp_current: nWP, rp_current: nRP }
              if (nWP === 0 && curWP > 0) npcUpd.death_countdown = mortalWoundCountdown(job.npc.physicality ?? 0)
              if (nRP === 0 && curRP > 0 && nWP > 0) npcUpd.incap_rounds = Math.max(1, 4 - (job.npc.physicality ?? 0))
              tableUpdates.push(supabase.from('campaign_npcs').update(npcUpd).eq('id', job.npc.id))
              npcLocalPatches.set(job.npc.id, npcUpd)
              if ((nWP === 0 || nRP === 0) && activeInit && activeInit.is_npc && activeInit.npc_id === job.npc.id) {
                activeDownedByBlast = true
              }
              blastTargets.push(`${job.npc.name} (${job.rangeBand}): ${job.splashWP} WP, ${job.splashRP} RP`)
            } else {
              // Object splash - barrels, crates, etc. get scaled WP damage
              // same as combatants. No RP (objects only track integrity).
              // Per playtest #17.
              const curWP = job.tok.wp_current ?? job.tok.wp_max ?? 0
              const nWP = Math.max(0, curWP - job.splashWP)
              tableUpdates.push(supabase.from('scene_tokens').update({ wp_current: nWP }).eq('id', job.tok.id))
              objLocalPatches.set(job.tok.id, nWP)
              blastTargets.push(`${job.tok.name} (${job.rangeBand}): ${job.splashWP} WP`)
            }
          }

          // Single parallel wave - table updates + coalesced stress log insert.
          const stressLogInsert = stressLogRows.length > 0
            ? insertRollLog(stressLogRows)
            : Promise.resolve(null)
          await Promise.all([...tableUpdates, stressLogInsert])

          // Apply local patches in one setState per slice (was: setState
          // inside the loop, N re-renders).
          if (pcLocalPatches.size > 0) {
            setEntries(prev => prev.map(e => {
              const patch = pcLocalPatches.get(e.stateId)
              return patch ? { ...e, liveState: { ...e.liveState, ...patch } } : e
            }))
          }
          if (npcLocalPatches.size > 0) {
            setCampaignNpcs(prev => prev.map(n => npcLocalPatches.has(n.id) ? { ...n, ...npcLocalPatches.get(n.id) } : n))
            setRosterNpcs(prev => prev.map(n => npcLocalPatches.has(n.id) ? { ...n, ...npcLocalPatches.get(n.id) } : n))
          }
          if (objLocalPatches.size > 0) {
            setMapTokens(prev => prev.map(t => objLocalPatches.has(t.id) ? { ...t, wp_current: objLocalPatches.get(t.id)! } : t))
          }

          // Coalesced broadcasts - one event per affected table instead
          // of one per affected token. Other clients re-fetch on receipt.
          if (pcLocalPatches.size > 0) {
            initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
          }
          if (npcLocalPatches.size > 0) {
            initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: {} })
          }
          if (objLocalPatches.size > 0) {
            initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
          }

          if (blastTargets.length > 0) {
            blastFeedSummary = blastTargets.join(' | ')
            traitNotes.push(`Blast hit: ${blastFeedSummary}`)
          }

          // SMOKE-1: the active thrower just downed themselves in their own
          // blast. Zero their actions and advance the turn so combat doesn't
          // stall. Mortally-wounded PCs STAY in the initiative list (still
          // stabilizable) - they're just no longer the active combatant.
          // nextTurn() re-fetches initiative_order from the DB, so the
          // actions_remaining=0 write below is visible to its skip-walk.
          if (activeDownedByBlast && activeInit) {
            await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', activeInit.id)
            await nextTurn()
            await loadInitiative(id)
            initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
          }
        }
      }
    }

    // Weapon jam/break on Low Insight. Persists a `jammed: true` flag
    // on the weapon slot (in addition to degrading condition) so the
    // Ready Weapon modal can offer Unjam/Repair regardless of whether
    // the new condition is "Worn" or worse. Earlier the modal gated on
    // condIdx >= 2 only, which meant a Pristine→Used degrade left the
    // weapon "jammed in spirit" but ungrayedoutable for Unjam - playtest
    // caught: Cree had a jam after a Low Insight roll on a Pristine
    // weapon, condition went to Used, Unjam button stayed grey.
    let weaponJammed = false
    if (pendingRoll.weapon && pendingRoll.weapon.weaponName !== 'Unarmed' && outcome === 'Low Insight') {
      weaponJammed = true
      // Queue the malfunction log row. Drained after saveRollToLog
      // so the malfunction row's created_at follows the attack row's
      // (feed order: attack first, malfunction below). characterName
      // is in scope from earlier in executeRoll.
      pendingJamLogRef.current = characterName
      if (myEntry) {
        const charData = myEntry.character.data ?? {}
        const slots = ['weaponPrimary', 'weaponSecondary'] as const
        for (const slot of slots) {
          if (charData[slot]?.weaponName === pendingRoll.weapon.weaponName) {
            const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
            const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
            const newCondition = conditions[Math.min(currentIdx + 1, conditions.length - 1)]
            const nextSlotData = { ...charData[slot], condition: newCondition, jammed: true }
            const newData = { ...charData, [slot]: nextSlotData }
            await supabase.from('characters').update({ data: newData }).eq('id', myEntry.character.id)
            // Local optimistic patch - without this the Ready Weapon
            // modal that opens on the next round would still see the
            // pre-Low-Insight slot data until the next loadEntries.
            setEntries(prev => prev.map(e => e.character.id === myEntry.character.id
              ? { ...e, character: { ...e.character, data: newData } }
              : e))
            break
          }
        }
      }
    }

    // Heal result - queue pending heal on Success+, apply -1 WP immediate
    // on Dire Failure, surface Wound Infection prompt on Low Insight.
    let healResult = ''
    if (healPendingRef.current && myEntry && pendingRoll.label.includes(' - Heal ')) {
      const hp = healPendingRef.current
      const medSmod = (myEntry.character.data?.skills ?? []).find((s: any) => s.skillName === 'Medicine*')?.level ?? 0
      const kitLabel = hp.kit === 'doctors_bag' ? "Doctor's Bag" : hp.kit === 'first_aid' ? 'First Aid Kit' : 'naked Medicine*'
      const rollD3 = () => Math.floor(Math.random() * 3) + 1
      // Per spec table: heal amount by outcome × kit.
      let healAmount = 0
      let immediateDmg = 0
      let infectionPrompt = false
      if (outcome === 'Wild Success') {
        const base = hp.kit === 'doctors_bag' ? (1 + rollD3() + rollD3()) : hp.kit === 'first_aid' ? (1 + rollD3()) : medSmod
        healAmount = base + 1
      } else if (outcome === 'High Insight') {
        const base = hp.kit === 'doctors_bag' ? (1 + rollD3() + rollD3()) : hp.kit === 'first_aid' ? (1 + rollD3()) : medSmod
        healAmount = base + 2
      } else if (outcome === 'Success') {
        healAmount = hp.kit === 'doctors_bag' ? (1 + rollD3() + rollD3()) : hp.kit === 'first_aid' ? (1 + rollD3()) : medSmod
      } else if (outcome === 'Dire Failure') {
        immediateDmg = 1
      } else if (outcome === 'Low Insight') {
        infectionPrompt = true
      }
      // Queue the pending heal (50% at +12h, 50% at +24h).
      if (healAmount > 0) {
        await queuePendingHeal({
          campaignId: id as string,
          targetCharacterId: hp.targetCharId,
          totalWp: healAmount,
          healerName: myEntry.character.name,
          source: kitLabel,
        })
        healResult = `Queued +${healAmount} WP over 24h (50% at +12h, 50% at +24h).`
      } else if (immediateDmg > 0) {
        // Dire Failure: target loses 1 WP immediately. Mortal-wound flow
        // will fire on its own via the standard WP=0 path if applicable.
        const { data: targetState } = await supabase
          .from('character_states')
          .select('id, wp_current, stress, death_countdown')
          .eq('character_id', hp.targetCharId)
          .eq('campaign_id', id)
          .maybeSingle()
        if (targetState) {
          const ts: any = targetState
          const newWp = Math.max(0, (ts.wp_current ?? 0) - immediateDmg)
          const update: any = { wp_current: newWp, updated_at: new Date().toISOString() }
          if (newWp === 0 && (ts.wp_current ?? 0) > 0) {
            update.death_countdown = mortalWoundCountdown(myEntry.character.data?.rapid?.PHY ?? 0)
            update.stress = Math.min(5, (ts.stress ?? 0) + 1)
          }
          await supabase.from('character_states').update(update).eq('id', ts.id)
        }
        healResult = `Botched treatment - ${hp.targetName} loses 1 WP.`
      } else if (infectionPrompt) {
        // Heal-LI cascade (canon §06): the medic botched in a way that
        // infects the wound. Patient owes a PHY Infection Check. Route
        // it through the same broadcast pipeline the end-of-combat
        // sweep uses (init channel + 'infection_check_request' event,
        // listener at L1522).
        //   - PC patient with a different owning user: broadcast,
        //     scoped to their userId; the owning client opens the
        //     standard roll modal so the player rolls their own check.
        //   - PC patient who is the medic themselves (self-heal LI):
        //     open locally - no point round-tripping a broadcast back.
        //   - NPC patient: GM rolls. Push onto pendingInfectionChecksRef
        //     so it drains through closeRollModal's queue like the
        //     end-of-combat case; if no modal is open right now, fire
        //     the first one immediately.
        const targetEntry = entries.find(e => e.character.id === hp.targetCharId)
        const targetNpc: CampaignNpc | null = !targetEntry ? campaignNpcs.find((n: any) => n.name === hp.targetName) : null
        if (targetEntry) {
          const targetPhy = targetEntry.character.data?.rapid?.PHY ?? 0
          if (targetEntry.userId && targetEntry.userId !== userIdRef.current) {
            initChannelRef.current?.send({
              type: 'broadcast',
              event: 'infection_check_request',
              payload: { targetUserId: targetEntry.userId, name: hp.targetName, amod: targetPhy },
            })
          } else {
            // Self-heal LI, or owning user is the current client - just open.
            handleRollRequest(`${hp.targetName} - Infection Check (Wound)`, targetPhy, 0)
          }
        } else if (targetNpc) {
          const npcPhy = targetNpc.physicality ?? 0
          // If the post-resolve flow has another modal still active
          // (rare - this branch runs at modal close), queue; otherwise
          // open the check modal now.
          if (pendingRoll) {
            pendingInfectionChecksRef.current.push({ name: hp.targetName, amod: npcPhy })
          } else {
            handleRollRequest(`${hp.targetName} - Infection Check (Wound)`, npcPhy, 0)
          }
        }
        healResult = `Botched treatment - ${hp.targetName} must make a Wound Infection check.`
      } else {
        healResult = 'Treatment failed - no effect.'
      }
      healPendingRef.current = null
    }

    // Upkeep Check result - canon state machine extracted to lib/upkeep.ts
    // and unit-tested across all 6 outcomes x 5 conditions. The inline logic
    // here just calls the helper, persists the new condition, and handles
    // the Low-Insight WP-damage side effect.
    let upkeepResult = ''
    if (pendingRoll.label.startsWith('Upkeep - ') && myEntry) {
      const weaponName = pendingRoll.label.replace('Upkeep - ', '')
      const charData = myEntry.character.data ?? {}
      const slots = ['weaponPrimary', 'weaponSecondary'] as const
      for (const slot of slots) {
        if (charData[slot]?.weaponName === weaponName) {
          const transition = upkeepTransition((charData[slot].condition ?? 'Used') as ItemCondition, outcome as UpkeepOutcome)
          upkeepResult = transition.message
          if (transition.breakWP > 0 && myEntry.liveState) {
            const newWP = Math.max(0, myEntry.liveState.wp_current - transition.breakWP)
            const upkeepUpdate: any = { wp_current: newWP }
            if (newWP === 0 && myEntry.liveState.wp_current > 0) {
              upkeepUpdate.death_countdown = mortalWoundCountdown(myEntry.character.data?.rapid?.PHY ?? 0)
              upkeepUpdate.stress = Math.min(5, (myEntry.liveState.stress ?? 0) + 1)
            }
            await supabase.from('character_states').update(upkeepUpdate).eq('id', myEntry.stateId)
            if (newWP === 0 && myEntry.liveState.wp_current > 0) {
              await insertRollLog({
                campaign_id: id, user_id: userId, character_name: 'System',
                label: `😰 ${myEntry.character.name} gains a Stress from being Mortally Wounded`,
                die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
              })
            }
          }
          if (transition.next !== charData[slot].condition) {
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: transition.next } }
            }).eq('id', myEntry.character.id)
          }
          break
        }
      }
    }

    // Unjam (firearm) / Repair (melee) result - adjust weapon condition (same logic as Upkeep)
    let unjamResult = ''
    const isUnjamLabel = pendingRoll.label.startsWith('Unjam - ')
    const isRepairLabel = pendingRoll.label.startsWith('Repair - ')
    if ((isUnjamLabel || isRepairLabel) && myEntry) {
      const verbPrefix = isUnjamLabel ? 'Unjam' : 'Repair'
      const weaponName = pendingRoll.label.replace(new RegExp(`^${verbPrefix} - (.+?) \\(.+\\)$`), '$1')
      const pastVerb = isUnjamLabel ? 'Unjammed' : 'Repaired'
      const failVerb = isUnjamLabel ? 'unjam' : 'repair'
      const charData = myEntry.character.data ?? {}
      const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
      const slots = ['weaponPrimary', 'weaponSecondary'] as const
      for (const slot of slots) {
        if (charData[slot]?.weaponName === weaponName) {
          const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
          let newIdx = currentIdx
          if (outcome === 'Wild Success') { newIdx = Math.max(1, currentIdx - 1); unjamResult = 'Condition improved by 1 level' }
          else if (outcome === 'High Insight') { newIdx = Math.max(1, currentIdx - 2); unjamResult = 'Condition improved by 2 levels' }
          else if (outcome === 'Success') { newIdx = Math.max(currentIdx - 1, 2); unjamResult = currentIdx > 2 ? `${pastVerb} - condition partially restored` : 'No change' }
          else if (outcome === 'Failure') { unjamResult = `Failed to ${failVerb} - no change` }
          else if (outcome === 'Dire Failure') { newIdx = 4; unjamResult = 'Weapon breaks!' }
          else if (outcome === 'Low Insight') {
            newIdx = 4; unjamResult = 'Weapon breaks! 1 WP damage.'
            if (myEntry.liveState) {
              const newWP = Math.max(0, myEntry.liveState.wp_current - 1)
              const unjamUpdate: any = { wp_current: newWP }
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                unjamUpdate.death_countdown = mortalWoundCountdown(myEntry.character.data?.rapid?.PHY ?? 0)
                unjamUpdate.stress = Math.min(5, (myEntry.liveState.stress ?? 0) + 1)
              }
              await supabase.from('character_states').update(unjamUpdate).eq('id', myEntry.stateId)
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                await insertRollLog({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `😰 ${myEntry.character.name} gains a Stress from being Mortally Wounded`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
                })
              }
            }
          }
          else { unjamResult = 'No change' }
          // Clear the persistent jammed flag on any non-failure outcome
          // (Wild Success / High Insight / Success / no-change paths
          // that didn't break the weapon further). Failure / Dire / Low
          // leave the jam in place - the weapon's still mechanically
          // gunked up. condIdx update handled below; the jammed flag
          // clears even when condIdx didn't change so a "Success - no
          // change" still removes the JAMMED chip.
          const clearJam = outcome === 'Wild Success' || outcome === 'High Insight' || outcome === 'Success'
          if (newIdx !== currentIdx || (clearJam && charData[slot]?.jammed)) {
            const updatedSlot: any = { ...charData[slot], condition: conditions[newIdx] }
            if (clearJam) updatedSlot.jammed = false
            const newData = { ...charData, [slot]: updatedSlot }
            await supabase.from('characters').update({ data: newData }).eq('id', myEntry.character.id)
            // Local optimistic patch - Ready Weapon modal that's still
            // open on this screen sees the cleared jam immediately.
            setEntries(prev => prev.map(e => e.character.id === myEntry.character.id
              ? { ...e, character: { ...e.character, data: newData } }
              : e))
          }
          break
        }
      }
    }

    // Distract + Stabilize legacy executeRoll branches retired 2026-05-23
    // (3c-B1). Both migrated to dedicated <RollModal>s on 2026-05-20
    // (runDistractCascade / runStabilizeCascade own the cascades). Verified
    // unreachable: no handleRollRequest caller produces a ' - Distract' or
    // 'Stabilize ' label, so pendingRoll never carries one.

    // Infection result - write infection_state, days_left, lasting_risk
    // based on the outcome. Two label shapes:
    //   "<name> - Infection Check (Wound)"     post-combat wound infection
    //   "<name> - Infection Check (Sickness)"  environmental progression
    // See /rules/combat/infection + memory/project_infection_canon.md.
    let infectionResult = ''
    // Stashed onto saveRollToLog's damage_json so compactRollSummary can
    // render "sick for N days" with the actual rolled number instead of
    // "1d3 days" / "1d6 days". Set inside the infection branch when the
    // check resolves to a Failure or Dire Failure.
    let infectionDamageJson: { infection_days: number; infection_severity: 'check' | 'auto'; kind: 'wound' | 'sickness' } | null = null
    if (pendingRoll.label.includes('Infection Check (')) {
      const infName = pendingRoll.label.split(' - ')[0]
      const isWound = pendingRoll.label.includes('(Wound)')
      const kind: 'wound' | 'sickness' = isWound ? 'wound' : 'sickness'
      const targetEntry = entries.find(e => e.character.name === infName)
      const targetNpcInf = !targetEntry ? campaignNpcs.find((n: any) => n.name === infName) : null
      // Outcome → state. Low Insight = Dire Failure, High Insight = Wild
      // Success per locked canon.
      const isFail = outcome === 'Failure'
      const isDire = outcome === 'Dire Failure' || outcome === 'Low Insight'
      let infectionState: 'wound' | 'sickness' | null = null
      let daysLeft = 0
      let lastingRisk = false
      // 'check' = PHY check required at Day 0 (Failure path).
      // 'auto'  = Lasting Damage applies automatically at Day 0 (Dire path).
      // null    = no infection / shrugged off.
      let severity: 'check' | 'auto' | null = null
      let summary = ''
      if (isFail) {
        infectionState = kind
        // Failure: 1d3 days for both branches.
        daysLeft = Math.floor(Math.random() * 3) + 1
        lastingRisk = true
        severity = 'check'
        summary = `${infName} failed the Infection check - sick for ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Lasting Damage risk.`
      } else if (isDire) {
        infectionState = kind
        // Dire Failure: 1d6 days. For Wound, Lasting Damage applies
        // automatically on Day 0 (no risk gate, the wound's already in).
        // For Sickness, the Day-0 mortal-wound drop is the worst part -
        // Lasting Damage check still fires on top.
        daysLeft = Math.floor(Math.random() * 6) + 1
        lastingRisk = true
        severity = 'auto'
        summary = `${infName} dire-failed the Infection check - sick for ${daysLeft} days. ${kind === 'wound' ? 'Auto Lasting Damage on Day 0.' : 'Will progress to Mortally Wounded on Day 0.'}`
      } else {
        summary = `${infName} shrugged off the Infection check.`
      }
      // Stash days + severity onto the roll_log row's damage_json so the
      // compact feed line can show the actual days instead of "1d3"/"1d6".
      if (infectionState && severity) {
        infectionDamageJson = { infection_days: daysLeft, infection_severity: severity, kind }
      }
      // Apply to the patient's row (PC or NPC). Sick state also caps
      // RP at half-max (round down) per locked canon - clamp here.
      if (infectionState && targetEntry) {
        const ls: any = targetEntry.liveState
        const rpMax: number = ls?.rp_max ?? 6
        const cappedRp = Math.min(ls?.rp_current ?? rpMax, Math.floor(rpMax / 2))
        const updates: any = {
          infection_state: infectionState,
          infection_days_left: daysLeft,
          infection_lasting_risk: lastingRisk,
          infection_severity: severity,
          infection_started_at: new Date().toISOString(),
          rp_current: cappedRp,
        }
        const { error: infErr } = await supabase.from('character_states').update(updates).eq('id', targetEntry.stateId)
        if (infErr) console.error('[infection] PC update error:', infErr.message)
        setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...updates } } : e))
      } else if (infectionState && targetNpcInf) {
        const npcRpMax: number = targetNpcInf.rp_max ?? 6
        const npcCappedRp = Math.min(targetNpcInf.rp_current ?? npcRpMax, Math.floor(npcRpMax / 2))
        const updates: any = {
          infection_state: infectionState,
          infection_days_left: daysLeft,
          infection_lasting_risk: lastingRisk,
          infection_severity: severity,
          infection_started_at: new Date().toISOString(),
          rp_current: npcCappedRp,
        }
        const { error: infErr } = await supabase.from('campaign_npcs').update(updates).eq('id', targetNpcInf.id)
        if (infErr) console.error('[infection] NPC update error:', infErr.message)
        setCampaignNpcs(prev => prev.map(n => n.id === targetNpcInf.id ? { ...n, ...updates } : n))
        setRosterNpcs(prev => prev.map(n => n.id === targetNpcInf.id ? { ...n, ...updates } : n))
        setViewingNpcs(prev => prev.map(n => n.id === targetNpcInf.id ? { ...n, ...updates } as CampaignNpc : n))
      }
      infectionResult = summary
    }

    // Lasting Damage Check result - canon §06.lasting-damage. The patient
    // rolls a Physicality check on Day 0 of their sick period (when
    // infection_severity was 'check'; the 'auto' path skips this and
    // applies a Lasting Wound at drain time). Outcome:
    //   Wild Success / High Insight / Success - no wound.
    //   Failure                                - roll 2d6 on Table 12,
    //                                            append to lastingWounds.
    //   Dire Failure / Low Insight             - roll 2d6 on Table 12.
    // Table 12 = LASTING_WOUNDS in lib/xse-schema.ts.
    let lastingDamageResult = ''
    // Stashed onto saveRollToLog's damage_json so the compact feed
    // line can name the specific wound rolled (Skittish / Lost Eye /
    // etc.) instead of just saying "suffered a Lasting Wound from
    // infection". Set inside the Lasting Damage Check branch when
    // a 2d6 Table 12 roll fires.
    let lastingDamageJson: { wound_name: string; wound_effect: string; wound_roll: number } | null = null
    if (pendingRoll.label.includes('Lasting Damage Check')) {
      const ldName = pendingRoll.label.replace(/^.* - /, '').replace(/^Lasting Damage Check\b.*$/, '').trim()
      // Label shape is "<name> - Lasting Damage Check" so split on " - ".
      const ldPatientName = pendingRoll.label.split(' - ')[0]
      const ldTargetEntry = entries.find(e => e.character.name === ldPatientName)
      const ldTargetNpc: CampaignNpc | null = !ldTargetEntry ? campaignNpcs.find((n: any) => n.name === ldPatientName) : null
      const ldShrug = outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight'
      if (ldShrug) {
        lastingDamageResult = `${ldPatientName} shrugged off the Lasting Damage.`
      } else {
        // Failure or Dire Failure (or Low Insight) - roll 2d6 on Table 12.
        const ld1 = Math.floor(Math.random() * 6) + 1
        const ld2 = Math.floor(Math.random() * 6) + 1
        const ldSum = ld1 + ld2
        const wound = LASTING_WOUNDS[ldSum]
        if (ldTargetEntry) {
          const charData: any = ldTargetEntry.character.data ?? {}
          const nextLW = [...(charData.lastingWounds ?? []), wound.name]
          const { error: lwErr } = await supabase
            .from('characters')
            .update({ data: { ...charData, lastingWounds: nextLW } })
            .eq('id', ldTargetEntry.character.id)
          if (lwErr) console.error('[lasting-damage] PC update error:', lwErr.message)
          setEntries(prev => prev.map(e => e.character.id === ldTargetEntry.character.id
            ? { ...e, character: { ...e.character, data: { ...charData, lastingWounds: nextLW } } }
            : e))
        } else if (ldTargetNpc) {
          // NPC path - campaign_npcs.lasting_wounds added 2026-05-15.
          const cur: string[] = Array.isArray(ldTargetNpc.lasting_wounds)
            ? ldTargetNpc.lasting_wounds
            : []
          const nextLW = [...cur, wound.name]
          const { error: lwNpcErr } = await supabase
            .from('campaign_npcs')
            .update({ lasting_wounds: nextLW })
            .eq('id', ldTargetNpc.id)
          if (lwNpcErr) console.error('[lasting-damage] NPC update error:', lwNpcErr.message)
          setCampaignNpcs(prev => prev.map(n => n.id === ldTargetNpc.id ? { ...n, lasting_wounds: nextLW } : n))
        }
        lastingDamageResult = `${ldPatientName} suffers a Lasting Wound: ${wound.name} [2d6=${ldSum}] (${wound.effect})`
        // Stash the wound on damage_json so future feed renders can
        // name the wound instead of just saying "from infection".
        lastingDamageJson = { wound_name: wound.name, wound_effect: wound.effect, wound_roll: ldSum }
      }
      // Clear the persistent pending flag now that the check resolved.
      // The auto-open useEffect's firedLastingChecksRef will also drop
      // this id when entries refresh - the DB write is the source of
      // truth, the ref is just per-session dedup.
      if (ldTargetEntry) {
        await supabase.from('character_states').update({ infection_pending_lasting_check: false }).eq('id', ldTargetEntry.stateId)
        setEntries(prev => prev.map(e => e.stateId === ldTargetEntry.stateId
          ? { ...e, liveState: { ...e.liveState, infection_pending_lasting_check: false } as any }
          : e))
      } else if (ldTargetNpc) {
        await supabase.from('campaign_npcs').update({ infection_pending_lasting_check: false }).eq('id', ldTargetNpc.id)
        setCampaignNpcs(prev => prev.map(n => n.id === ldTargetNpc.id ? { ...n, infection_pending_lasting_check: false } : n))
      }
      // Suppress unused-var warnings (ldName was a leftover from an
      // earlier regex attempt).
      void ldName
    }

    // Treat Infection result - medic's Medicine* check on a sick patient.
    // Wild Success: half remaining days (round up) + clear lasting risk.
    // Success:     clear lasting risk only.
    // Failure:     no-op (patient cannot be re-treated this incident; we
    //              leave that gate to the GM since the schema doesn't
    //              currently track an "already treated" flag).
    // Dire Failure: +1 to days_left.
    // Insight: standard mapping (Low = Dire, High = Wild Success).
    let treatInfectionResult = ''
    if (pendingRoll.label.includes('Treat Infection ')) {
      const tiTargetName = pendingRoll.label.split('Treat Infection ')[1]
      const tiTargetEntry = entries.find(e => e.character.name === tiTargetName)
      const tiTargetNpc = !tiTargetEntry ? campaignNpcs.find((n: any) => n.name === tiTargetName) : null
      const sourceLs: any = tiTargetEntry?.liveState ?? tiTargetNpc
      if (!sourceLs?.infection_state) {
        treatInfectionResult = `${tiTargetName} isn't sick - Treat Infection is a no-op.`
      } else {
        const days = sourceLs.infection_days_left ?? 0
        const updates: any = {}
        if (outcome === 'Wild Success' || outcome === 'High Insight') {
          updates.infection_days_left = Math.max(1, Math.ceil(days / 2))
          updates.infection_lasting_risk = false
          treatInfectionResult = `${tiTargetName} treated - ${days} day${days === 1 ? '' : 's'} cut to ${updates.infection_days_left}, Lasting Damage risk cleared.`
        } else if (outcome === 'Success') {
          updates.infection_lasting_risk = false
          treatInfectionResult = `${tiTargetName} treated - Lasting Damage risk cleared.`
        } else if (outcome === 'Dire Failure' || outcome === 'Low Insight') {
          updates.infection_days_left = days + 1
          treatInfectionResult = `${tiTargetName} botched care - ${days} day${days === 1 ? '' : 's'} extended to ${updates.infection_days_left}.`
        } else {
          treatInfectionResult = `${tiTargetName} got no help from the treatment.`
        }
        if (Object.keys(updates).length > 0) {
          if (tiTargetEntry) {
            const { error: tiErr } = await supabase.from('character_states').update(updates).eq('id', tiTargetEntry.stateId)
            if (tiErr) console.error('[treat-infection] PC update error:', tiErr.message)
            setEntries(prev => prev.map(e => e.stateId === tiTargetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...updates } } : e))
          } else if (tiTargetNpc) {
            const { error: tiErr } = await supabase.from('campaign_npcs').update(updates).eq('id', tiTargetNpc.id)
            if (tiErr) console.error('[treat-infection] NPC update error:', tiErr.message)
            setCampaignNpcs(prev => prev.map(n => n.id === tiTargetNpc.id ? { ...n, ...updates } : n))
            setRosterNpcs(prev => prev.map(n => n.id === tiTargetNpc.id ? { ...n, ...updates } : n))
            setViewingNpcs(prev => prev.map(n => n.id === tiTargetNpc.id ? { ...n, ...updates } as CampaignNpc : n))
          }
        }
        // Low Insight: medic earns 1 Stress pip per locked canon.
        if (outcome === 'Low Insight') {
          const medicEntry = entries.find(e => e.character.name === pendingRoll.label.split(' - ')[0])
          if (medicEntry?.liveState) {
            const newStress = Math.min(5, (medicEntry.liveState.stress ?? 0) + 1)
            await supabase.from('character_states').update({ stress: newStress }).eq('id', medicEntry.stateId)
            setEntries(prev => prev.map(e => e.stateId === medicEntry.stateId ? { ...e, liveState: { ...e.liveState, stress: newStress } } : e))
            treatInfectionResult += ' Medic gains 1 Stress pip.'
          }
        }
      }
    }

    // Sprint result - failure = winded next round
    // Log trimming: we embed the raw Athletics-roll dice/mods into the
    // sprint outcome entry's damage_json as a `trimmedRoll` blob, and
    // skip the normal saveRollToLog write (see `skipSaveRollToLog` flag
    // below). Renderers show the banner as the default view with a
    // "more info" expand toggle that unpacks trimmedRoll into the full
    // breakdown. This is the prototype for the log-trimming pattern -
    // Stabilize / Coordinate / Unjam / etc. can reuse the same shape.
    let sprintResult = ''
    if (pendingRoll.label.includes('Sprint')) {
      // Find the sprinting combatant by name (not active entry - turn may have advanced after pre-consume)
      const sprintName = pendingRoll.label.split(' - ')[0]
      const sprintInit = initiativeOrder.find(e => e.character_name === sprintName)
      const trimmedRoll = {
        die1, die2,
        // Carry the full 3d6 breakdown when an Insight Die was spent -
        // die2 stores d2+d3 as a sum, which reads wrong in the expand
        // view (e.g. "[6+10]" instead of "[6+6+4]"). Renderers pick
        // diceRolled over die1/die2 whenever it's present.
        diceRolled: insightDiceRolled,
        amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
        total, rollOutcome: outcome, rollLabel: pendingRoll.label,
      }
      if (outcome === 'Failure' || outcome === 'Dire Failure') {
        if (sprintInit) await supabase.from('initiative_order').update({ winded: true }).eq('id', sprintInit.id)
        sprintResult = `${characterName} seems to be out of breath.`
        await insertRollLog({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `🏃 ${characterName} sprints and looks winded`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.sprint,
          damage_json: { trimmedRoll, winded: true } as any,
        })
      } else {
        sprintResult = `${characterName} does not seem to be winded.`
        await insertRollLog({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `🏃 ${characterName} sprints and does not look winded`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.sprint,
          damage_json: { trimmedRoll, winded: false } as any,
        })
      }
      // Sprint log written - release the pending-Athletics gate. If
      // nextTurn was holding a round reroll back because this check was
      // still open, fire it now so the Initiative log lands AFTER the
      // sprint outcome instead of before it.
      sprintAthleticsPendingRef.current = false
      if (sprintAthleticsRoundDeferredRef.current) {
        sprintAthleticsRoundDeferredRef.current = false
        // Invoked without awaiting the full chain: executeRoll still has
        // state to flush (damage, trait notes, etc.). nextTurn's own
        // in-flight guard prevents overlapping advances.
        void nextTurn()
      }
    }

    // Coordinate result - apply +2 to allies within Close range when attacking that target
    let coordinateResult = ''
    if (coordinateTargetRef.current && pendingRoll.label.includes('Coordinate')) {
      const coordTarget = coordinateTargetRef.current
      if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
        // Find allies within Close range (≤30ft) of the coordinator.
        // Pre-build token lookup map so the per-ally range check is O(1) instead
        // of O(n) (was: mapTokens.find() inside the ally loop, agent flagged as
        // O(n²) on large rosters).
        const activeInit = initiativeOrder.find(e => e.is_active)
        const tokenByOwner = new Map<string, typeof mapTokens[number]>()
        for (const t of mapTokens) {
          if (t.character_id) tokenByOwner.set(`c:${t.character_id}`, t)
          if (t.npc_id) tokenByOwner.set(`n:${t.npc_id}`, t)
        }
        const coordTok = activeInit?.character_id
          ? tokenByOwner.get(`c:${activeInit.character_id}`)
          : activeInit?.npc_id ? tokenByOwner.get(`n:${activeInit.npc_id}`) : undefined
        const bonus = 2
        const appliedTo: string[] = []
        const appliedAllyIds: string[] = []
        for (const ally of initiativeOrder) {
          if (ally.id === activeInit?.id) continue // skip self
          if (ally.character_name === coordTarget) continue // skip the target
          // Check range if tokens exist
          if (coordTok && mapTokens.length > 0) {
            const allyTok = ally.character_id
              ? tokenByOwner.get(`c:${ally.character_id}`)
              : ally.npc_id ? tokenByOwner.get(`n:${ally.npc_id}`) : undefined
            if (allyTok) {
              const dist = Math.max(Math.abs(coordTok.grid_x - allyTok.grid_x), Math.abs(coordTok.grid_y - allyTok.grid_y))
              const feet = dist * mapCellFeet
              if (feet > 30) continue // not within Close range
            }
          }
          appliedTo.push(ally.character_name)
          appliedAllyIds.push(ally.id)
        }
        if (appliedAllyIds.length > 0) {
          coordinateResult = `${appliedTo.join(', ')} get${appliedTo.length === 1 ? 's' : ''} +${bonus} CMod when attacking ${coordTarget}${outcome === 'Wild Success' ? ' (carries +1 next round)' : ''}.`
          // UNIFIED COORDINATE ROW (post-2026-05-10).
          //
          // Pattern: when a single mechanical event has both a dice-roll
          // and a downstream effect-broadcast, write ONE row that
          // carries both. The row's character_name is the actor, the
          // label is the narrative outcome, the dice/AMod/SMod/CMod
          // are the real roll, and the outcome is the real roll
          // outcome. compactRollSummary trims to the narrative; ▸
          // expands to the dice breakdown. NO separate "effect" row.
          //
          // Why this matters: the prior implementation wrote two rows
          // (player Coordinate roll + System effect-broadcast). The
          // System row had 0+0 dice, no expandable detail, and read
          // as a duplicate. One row tells the whole story.
          //
          // Applied here for Coordinate; reuse this pattern for any
          // future "actor rolls then propagates effect" mechanic.
          const coordCmod = parseInt(cmod, 10) || 0
          // Effect-row only writes on Success/Wild/HI, so only HI here.
          const insightAwardedCoord = outcome === 'High Insight' && !!myEntry
          await Promise.all([
            supabase.from('initiative_order').update({ coordinate_target: coordTarget, coordinate_bonus: bonus }).in('id', appliedAllyIds),
            insertRollLog({
              campaign_id: id, user_id: userId,
              character_name: activeInit?.character_name ?? 'A coordinator',
              label: `🎯 ${activeInit?.character_name ?? 'A coordinator'} Successfully coordinated an attack against ${coordTarget} with ${appliedTo.join(', ')}`,
              die1, die2,
              amod: pendingRoll.amod,
              smod: pendingRoll.smod,
              cmod: coordCmod,
              total,
              outcome,
              insight_awarded: insightAwardedCoord,
            }),
          ])
        } else {
          coordinateResult = 'No allies within Close range to receive the bonus.'
        }
      } else {
        coordinateResult = 'Coordination failed - no bonus applied.'
      }
      coordinateTargetRef.current = null
    }

    // Log trimming (see Sprint block above): some actions consolidate their
    // dice breakdown INTO the outcome banner's damage_json instead of writing
    // a separate roll_log row. If this is one of those rolls, skip the
    // standalone saveRollToLog write - otherwise the feed would show both
    // the raw Athletics check AND the sprint banner.
    // isTrimmedRoll: skip the standalone saveRollToLog write because
    // the row was already written as part of the side-effect (Sprint
    // banner / unified Coordinate row). See the UNIFIED ROW pattern
    // comment in the Coordinate branch above.
    const isCoordinateSuccess = pendingRoll.label.includes('Coordinate')
      && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')
    const isTrimmedRoll = pendingRoll.label.includes('Sprint') || isCoordinateSuccess
    // Capture the Insight Die spend kind (if any) so the extended log
    // card can render the right "🎲 Insight Die spent" banner reliably.
    // preRollSpent is true only when the spend actually fired; preRollInsight
    // is the user's pre-roll selection. Both must align.
    const insightUsedValue: '3d6' | '+3cmod' | null = preRollSpent
      ? (preRollInsight === '3d6' ? '3d6' : preRollInsight === '+3cmod' ? '+3cmod' : null)
      : null
    if (!isTrimmedRoll) {
      // Label is saved verbatim. The expanded log render appends
      // " → <target_name>" when target_name is set, so for Distract
      // (label "<X> - Distract", target stored on r.target_name) the
      // expanded line auto-formats as "Distract → <target>". Don't
      // mutate the label here or the target gets duplicated:
      // "Distract → <target> → <target>" (caught 2026-04-29).
      // Group Check - fold the stashed participant list into damage_json
      // so the bespoke banner can render the multi-name body. The
      // damageResult slot is otherwise unused for these rolls; sharing
      // it avoids a parallel column. Ref is cleared after the write.
      let augmentedDamage: any = damageResult
      if (pendingRoll.label.includes('Group Check -') && groupCheckPayloadRef.current) {
        augmentedDamage = {
          ...(damageResult ?? {}),
          groupCheckParticipants: groupCheckPayloadRef.current.participants,
          groupCheckSkill: groupCheckPayloadRef.current.skill,
        }
        groupCheckPayloadRef.current = null
      }
      // Merge infection-roll metadata into damage_json so the compact
      // feed renderer can show the actual rolled days. Pure additive -
      // damageResult is null for non-attack rolls, so augmentedDamage
      // becomes just the infection block in those cases.
      if (infectionDamageJson) {
        augmentedDamage = { ...(augmentedDamage ?? damageResult ?? {}), ...infectionDamageJson }
      }
      // Same pattern for Lasting Damage rolls - stash the wound name +
      // effect so historical feed entries can name the wound instead
      // of generic "suffered a Lasting Wound from infection".
      if (lastingDamageJson) {
        augmentedDamage = { ...(augmentedDamage ?? damageResult ?? {}), ...lastingDamageJson }
      }
      // Carry the consolidated blast line into the feed (Q3a) so AoE victims
      // show in the persistent log, not just the transient result modal.
      if (blastFeedSummary) {
        augmentedDamage = { ...(augmentedDamage ?? damageResult ?? {}), blastSummary: blastFeedSummary }
      }
      await saveRollToLog(die1, die2, pendingRoll.amod, pendingRoll.smod, cmodVal, pendingRoll.label, characterName, false, targetName || null, augmentedDamage, insightUsedValue, insightDie3, cmodBreakdown)
      // Gut Instinct legacy broadcast retired 2026-05-23 (3c-B1) - migrated
      // to the dedicated <RollModal>'s onRoll on 2026-05-20; pendingRoll
      // never carries a 'Gut Instinct' label anymore.
    }
    // Now that the attack row is in, drain any auto-loot log rows queued
    // during damage processing. Awaiting this serializes after the attack
    // insert so the attack row's created_at strictly precedes the loot's,
    // keeping "used X on Y → looked through the remains of Y" feed order.
    if (pendingLootLogs.length > 0) {
      const { error: lootErr } = await insertRollLog(pendingLootLogs)
      if (lootErr) console.error('[auto-loot] log insert error:', lootErr.message)
    }
    // Drain queued wound-infection warnings. Same pattern as auto-loot:
    // emit AFTER saveRollToLog so the attack row appears above the
    // warning in the feed (oldest-first). maybeLogWoundInfection's
    // internal dedup handles the cross-target / cross-combat checks.
    if (pendingWoundInfectionRef.current.size > 0) {
      const names = Array.from(pendingWoundInfectionRef.current)
      pendingWoundInfectionRef.current.clear()
      for (const n of names) await maybeLogWoundInfection(n)
    }
    // Lasting Wound announcement row. Mirrors the wound-infection
    // warning + weapon-malfunction pattern: emit AFTER saveRollToLog
    // so the dice roll row appears above the announcement in the feed
    // (oldest-first). Uses the player-friendly narrative override from
    // LASTING_WOUND_NARRATIVE when available, falling back to the
    // canon effect string for wounds that don't have an override yet.
    if (lastingDamageJson) {
      const wRoll = lastingDamageJson.wound_roll
      const wName = lastingDamageJson.wound_name
      const wEffect = LASTING_WOUND_NARRATIVE[wRoll] ?? lastingDamageJson.wound_effect
      // Use the patient's name, not the dice-roller's. They're the
      // same on a PC self-roll but distinct if the GM rolled for an
      // NPC ("Vera Oakes" should announce Vera's wound, not the GM's
      // character).
      const patientName = pendingRoll.label.split(' - ')[0]
      const { error: lwLogErr } = await insertRollLog({
        campaign_id: id, user_id: userId,
        character_name: patientName,
        label: `${patientName} has picked up a Lasting Wound and is now ${wName} (${wEffect})`,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: OUTCOME.lasting_wound_acquired,
        damage_json: { wound_name: wName, wound_effect: wEffect, wound_roll: wRoll } as any,
      })
      if (lwLogErr) console.error('[lasting-wound] roll_log insert error:', lwLogErr.message)
    }
    // Drain queued weapon-malfunction row. Same after-attack ordering
    // applies - malfunction is a consequence of the attack roll, so
    // its created_at must follow the attack row's.
    if (pendingJamLogRef.current) {
      const attackerName = pendingJamLogRef.current
      pendingJamLogRef.current = null
      const { error: jamErr } = await insertRollLog({
        campaign_id: id, user_id: userId,
        character_name: attackerName,
        label: `${attackerName}'s weapon malfunctions and they must ready it for use again!`,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: OUTCOME.weapon_malfunction,
      })
      if (jamErr) console.error('[weapon-malfunction] roll_log insert error:', jamErr.message)
    }

    // First Impression branch deleted 2026-05-19 (FI streamline Phase 3).
    // The FI flow now runs entirely inside <FirstImpressionModal>:
    //   - Pick + roll + dice render: in the modal.
    //   - roll_log insert + bump_npc_relationship_cmod + progression_log:
    //     resolveFirstImpression() in lib/first-impression-resolver.ts.
    // executeRoll no longer needs to peek at firstImpressionTargetRef or
    // bump relationships; that ref is gone too (was at L686 pre-cleanup).

    setRollResult({
      die1, die2, amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, label: pendingRoll.label, insightAwarded, insightUsed: preRollSpent ? 'pre' : null,
      damage: damageResult, weaponJammed, traitNotes: [...(infectionSickCmodNote ? [infectionSickCmodNote] : []), ...traitNotes, ...(upkeepResult ? [upkeepResult] : []), ...(unjamResult ? [unjamResult] : []), ...(infectionResult ? [infectionResult] : []), ...(lastingDamageResult ? [lastingDamageResult] : []), ...(treatInfectionResult ? [treatInfectionResult] : []), ...(sprintResult ? [sprintResult] : []), ...(coordinateResult ? [coordinateResult] : []), ...(healResult ? [healResult] : [])],
      diceRolled: insightDiceRolled,
    } as any)

    setRolling(false)
    // Clear the cell target AFTER the damage pass has consumed it - the
    // next attack (even with the same grenade) starts fresh and the
    // player has to pick a new cell.
    setGrenadeTargetCell(null)
    await Promise.all([loadEntries(id), rollsFeed.refetch()])
  }
  return { executeRoll }
}
