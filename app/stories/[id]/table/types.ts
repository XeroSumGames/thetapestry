// Types + module constants extracted from page.tsx as Phase 3.0 step 1
// of the page.tsx decomposition (tasks/page-tsx-decomposition-plan.md).
// Pure mechanical move - no runtime behavior change. These were all
// declared at module scope (top of page.tsx, L62-L214) and are imported
// back by page.tsx via `from './types'`.

import type { LiveState } from '../../../../components/CharacterCard'

export interface Campaign {
  id: string
  name: string
  setting: string
  gm_user_id: string
  session_status: string
  session_count: number
  session_started_at: string | null
  invite_code: string
}

export interface TableEntry {
  stateId: string
  userId: string
  username: string
  character: { id: string; name: string; created_at: string; data: any }
  liveState: LiveState
}

export interface GmInfo {
  userId: string
  username: string
}

export interface RollEntry {
  id: string
  character_name: string
  label: string
  target_name: string | null
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  insight_awarded: boolean
  // null on rows from before the 2026-04-28 schema bump; otherwise
  // '3d6' (pre-rolled keep-all) or '+3cmod' (flat CMod). Drives the
  // green "🎲 Insight Die spent" badge in the extended log card.
  // Older 3d6 rows still get caught by the die2 > 6 fallback in the
  // card; +3cmod rows from before this column simply can't be flagged.
  insight_used: '3d6' | '+3cmod' | null
  created_at: string
  damage_json: DamageResult | null
}

export interface WeaponContext {
  weaponName: string
  damage: string
  rpPercent: number
  conditionCmod: number
  traitCmod?: number
  traitLabel?: string
  traits?: string[]
}

export interface PendingRoll {
  label: string
  amod: number
  smod: number
  weapon?: WeaponContext
  // Initiative-order row id of the character who initiated the roll.
  // Stashed by handleRollRequest so closeRollModal can decide whether to
  // consume an action: consume only if this matches the active combatant.
  // null when out of combat (no action accounting needed).
  rollerInitId?: string | null
}

export interface DamageResult {
  base: number
  diceRoll: number
  diceDesc: string
  phyBonus: number
  totalWP: number
  finalWP: number
  finalRP: number
  mitigated: number
  targetName: string
}

export interface RollResult {
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  label: string
  insightAwarded: boolean
  insightUsed: 'pre' | 'die1' | 'die2' | 'both' | null
  damage?: DamageResult
  weaponJammed?: boolean
  traitNotes?: string[]
  // When an Insight Die is spent for a 3d6 roll, we keep ALL three dice
  // per SRD. `diceRolled` surfaces every individual value so the modal
  // can render three boxes instead of two (die2 would otherwise display
  // as d2+d3 - misleadingly as a single die value). Length 2 for normal
  // rolls, length 3 for Insight-die 3d6 rolls.
  diceRolled?: number[]
}

// Apprentice bond - populated from community_members rows where
// recruitment_type='apprentice' and apprentice_meta is set. Carries
// just enough for NpcCard to render the wizard trigger and for the
// wizard itself to find the right rows on save.
export interface ApprenticeBond {
  communityMemberId: string
  masterCharacterId: string
  apprenticeMeta: {
    motivation: string
    motivation_roll: number
    complication: string
    complication_roll: number
    paradigm?: string
    background?: string
    setup_complete?: boolean
    setup_at?: string
  }
}

export interface InitiativeEntry {
  id: string
  character_name: string
  character_id: string | null
  user_id: string | null
  npc_id: string | null
  portrait_url: string | null
  npc_type: string | null
  roll: number
  is_active: boolean
  is_npc: boolean
  actions_remaining: number
  aim_bonus: number
  defense_bonus: number
  has_cover: boolean
  winded: boolean
  last_attack_target: string | null
  inspired_this_round: boolean
  aim_active: boolean
  coordinate_target: string | null
  coordinate_bonus: number
  grappled_by: string | null
}

export const MAX_PLAYER_SLOTS = 9

export function rollD6() { return Math.floor(Math.random() * 6) + 1 }

export const SOCIAL_SKILLS = ['Manipulation', 'Inspiration', 'Barter', 'Psychology', 'INF Check']
