'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../../../components/CharacterCard'
import type { InventoryItem } from '../../../../components/InventoryPanel'
import NpcRoster, { getNpcRingColor, getNpcTokenBorderColor } from '../../../../components/NpcRoster'
import NpcCard from '../../../../components/NpcCard'
import PlayerNpcCard from '../../../../components/PlayerNpcCard'
import ObjectCard from '../../../../components/ObjectCard'
import VehicleCard, { Vehicle } from '../../../../components/VehicleCard'
import NotificationBell from '../../../../components/NotificationBell'
import MessagesBell from '../../../../components/MessagesBell'
import { useChatPanel, ChatMessageRow, ChatMessageList, ChatComposer } from '../../../../components/TableChat'
import { useRollsFeed, RollEntry as RollEntryCard } from '../../../../components/RollsFeed'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { SETTINGS } from '../../../../lib/settings'
import dynamic from 'next/dynamic'
const CampaignMap = dynamic(() => import('../../../../components/CampaignMap'), { ssr: false })
const TacticalMap = dynamic(() => import('../../../../components/TacticalMap'), { ssr: false })
// Lazy: gated behind tabs / modals / GM toggle. None render on initial paint,
// so chunking them out shrinks the first-load bundle without changing UX.
// `loading: () => null` keeps the gate's outer container empty during the
// chunk fetch instead of showing a Next.js default placeholder.
const QuickAddModal = dynamic(() => import('../../../../components/QuickAddModal'), { ssr: false, loading: () => null })
const CampaignCommunity = dynamic(() => import('../../../../components/CampaignCommunity'), { ssr: false, loading: () => null })
const GmNotes = dynamic(() => import('../../../../components/GmNotes'), { ssr: false, loading: () => null })
const PlayerNotes = dynamic(() => import('../../../../components/PlayerNotes'), { ssr: false, loading: () => null })
const CampaignPins = dynamic(() => import('../../../../components/CampaignPins'), { ssr: false, loading: () => null })
const CampaignObjects = dynamic(() => import('../../../../components/CampaignObjects'), { ssr: false, loading: () => null })
import type { CampaignNpc } from '../../../../components/NpcRoster'
import { logEvent } from '../../../../lib/events'
import { openPopout } from '../../../../lib/popout'
import { renderRichText } from '../../../../lib/rich-text'
import { rollDamage, calculateDamage } from '../../../../lib/damage'
import { getWeaponByName, getTraitValue, CONDITION_CMOD } from '../../../../lib/weapons'
import { getOutcome, outcomeColor, compactRollSummary, formatTime } from '../../../../lib/roll-helpers'
import { getRangeBand as getRangeBandFromFeet, getWeaponRangeCMod, canHitAtRange } from '../../../../lib/range-profiles'
import { SKILLS } from '../../../../lib/xse-schema'

interface Campaign {
  id: string
  name: string
  setting: string
  gm_user_id: string
  session_status: string
  session_count: number
  session_started_at: string | null
  invite_code: string
}

interface TableEntry {
  stateId: string
  userId: string
  username: string
  character: { id: string; name: string; created_at: string; data: any }
  liveState: LiveState
}

interface GmInfo {
  userId: string
  username: string
}

interface RollEntry {
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

interface WeaponContext {
  weaponName: string
  damage: string
  rpPercent: number
  conditionCmod: number
  traitCmod?: number
  traitLabel?: string
  traits?: string[]
}

interface PendingRoll {
  label: string
  amod: number
  smod: number
  weapon?: WeaponContext
}

interface DamageResult {
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

interface RollResult {
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
  // as d2+d3 — misleadingly as a single die value). Length 2 for normal
  // rolls, length 3 for Insight-die 3d6 rolls.
  diceRolled?: number[]
}

interface InitiativeEntry {
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


const MAX_PLAYER_SLOTS = 9


function rollD6() { return Math.floor(Math.random() * 6) + 1 }

const SOCIAL_SKILLS = ['Manipulation', 'Inspiration', 'Barter', 'Psychology', 'INF Check']

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const rollsFeed = useRollsFeed({ campaignId: id })
  const channelRef = useRef<any>(null)
  const initChannelRef = useRef<any>(null)
  const membersChannelRef = useRef<any>(null)
  const npcsChannelRef = useRef<any>(null)
  const npcFetchInFlightRef = useRef(false)  // Suppress realtime callback during manual NPC re-fetch
  const revealChannelRef = useRef<any>(null)
  const communityMembersChannelRef = useRef<any>(null)
  const myCharIdRef = useRef<string | null>(null)
  // loadEntries sequence guard — see definition below.
  const loadEntriesSeqRef = useRef(0)
  const loadInitSeqRef = useRef(0)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Header-bar nested dropdowns (Checks / Community / GM Tools). Only
  // one menu opens at a time — clicking another closes the previous;
  // clicking outside closes whatever's open. Declared up here so the
  // outside-click useEffect below can reference it.
  const [openHeaderMenu, setOpenHeaderMenu] = useState<string | null>(null)
  // Pinned = user clicked the trigger (as opposed to just hovering).
  // When pinned, mouse-leave does NOT collapse the menu — you have to
  // click the trigger again or click outside. Fixes the "I'm chasing
  // the buttons" jitter where moving toward a child accidentally
  // crossed a dead zone and collapsed the menu.
  const [isMenuPinned, setIsMenuPinned] = useState(false)

  // Close any open header-bar dropdown on outside click or ESC. The
  // click target is checked against `[data-header-menu]` containers;
  // anything outside that closes the menu.
  useEffect(() => {
    if (!openHeaderMenu) return
    function handleClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (!t.closest('[data-header-menu]')) {
        setOpenHeaderMenu(null)
        setIsMenuPinned(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenHeaderMenu(null)
        setIsMenuPinned(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openHeaderMenu])
  // Per-PC stress memory — used to detect the <5 → 5 transition at the
  // table-page level so the Stress Check modal fires even when the target's
  // CharacterCard sheet isn't mounted.
  const prevStressByStateIdRef = useRef<Map<string, number>>(new Map())
  // Set on load to skip threshold triggers on the initial entries snapshot
  // (otherwise a PC who's ALREADY at 5 from a previous session would pop the
  // modal again on every page load).
  const stressWatchPrimedRef = useRef(false)
  const [myUsername, setMyUsername] = useState<string>('')
  const [isGM, setIsGM] = useState(false)
  // Thriver = app-level admin role. Gets pin management parity with
  // GMs (delete, edit with lat/lng + address search) so they can
  // clean up / relocate pins across any campaign, not just their own.
  const [isThriver, setIsThriver] = useState(false)
  const [entries, setEntries] = useState<TableEntry[]>([])
  const [gmInfo, setGmInfo] = useState<GmInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<TableEntry | null>(null)
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null)
  const actionPreConsumedRef = useRef(false)  // Set when Stabilize pre-consumes before the roll modal
  const actionCostRef = useRef(1)             // Action cost for the current roll (2 for Charge/Rapid Fire)
  const pendingChargeRef = useRef<{ label: string; amod: number; smod: number; weapon: any; activeId?: string; moved?: boolean } | null>(null)
  const rollExecutedRef = useRef(false)       // Set in executeRoll, read in closeRollModal — refs survive React batching
  const nextTurnInFlightRef = useRef(false)   // Re-entry guard for nextTurn — prevents races where realtime echo + optimistic call both advance, silently skipping a combatant
  const consumeActionInFlightRef = useRef<Set<string>>(new Set())   // Per-entry lock for consumeAction — prevents double-click races from decrementing actions_remaining twice (e.g. Aim button hit twice fast burning both actions instead of one)
  const [insightSavePrompt, setInsightSavePrompt] = useState<{ stateId: string; targetName: string; newWP: number; newRP: number; phyAmod: number; insightDice: number } | null>(null)
  const [rollResult, setRollResult] = useState<RollResult | null>(null)
  const [cmod, setCmod] = useState('0')
  const [rolling, setRolling] = useState(false)
  const [targetName, setTargetName] = useState<string>('')
  // Grenade / thrown-explosive cell targeting. When the attacker clicks
  // Attack with a weapon of category='explosive', we enter `throwMode`:
  // the TacticalMap paints every cell within weapon range orange, and
  // the player clicks a CELL (not a token) to place the blast. On click
  // we stash the cell coords in `grenadeTargetCell` and open the roll
  // modal with a synthetic "Cell (x,y)" target. executeRoll detects the
  // cell target and applies blast damage centered on it. Both states
  // clear on roll-close / cancel so a second attack starts fresh.
  const [throwMode, setThrowMode] = useState<{
    attackerCharId: string | null
    attackerNpcId: string | null
    weapon: WeaponContext
    amod: number
    smod: number
    rangeFeet: number
    label: string
    hasBlast?: boolean
    friendlyCharacterIds?: string[]
  } | null>(null)
  const [grenadeTargetCell, setGrenadeTargetCell] = useState<{ gx: number; gy: number } | null>(null)

  // Initiative
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [combatActive, setCombatActive] = useState(false)
  const [combatRound, setCombatRound] = useState(1)
  const [showAddNPC, setShowAddNPC] = useState(false)
  const [showAddPC, setShowAddPC] = useState(false)
  const [npcName, setNpcName] = useState('')
  const [startingCombat, setStartingCombat] = useState(false)
  // Persist per-campaign so a refresh keeps players on the tactical view
  // they were watching. Default false on first visit; flipped true by the
  // GM share broadcast, the combat_ended broadcast, the GM's own toggle
  // button, etc. — every transition writes back to localStorage via the
  // effect below.
  const [showTacticalMap, setShowTacticalMap] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`tactical_map_view_${id}`) === '1'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`tactical_map_view_${id}`, showTacticalMap ? '1' : '0')
  }, [showTacticalMap, id])
  const [tacticalShared, setTacticalShared] = useState(false)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)
  const [moveMode, setMoveMode] = useState<{ characterId?: string; npcId?: string; objectTokenId?: string; feet: number } | null>(null)
  const [mapTokens, setMapTokens] = useState<{ id: string; name: string; token_type: string; character_id: string | null; npc_id: string | null; grid_x: number; grid_y: number; wp_max: number | null; wp_current: number | null; controlled_by_character_ids?: string[] | null; rotation?: number }[]>([])
  const [mapCellFeet, setMapCellFeet] = useState(3)
  const [mapTokenNpcIds, setMapTokenNpcIds] = useState<Set<string>>(new Set())
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const [dropCharacter, setDropCharacter] = useState<string>('')
  const dropPhaseRef = useRef(false)
  const pendingCombatantsRef = useRef<any[]>([])
  const coordinateTargetRef = useRef<string | null>(null)
  const [showCoordinateModal, setShowCoordinateModal] = useState(false)
  const [coordinateSelection, setCoordinateSelection] = useState('')
  const sprintPendingRef = useRef(false)
  // Set true between Sprint pre-consume and the Athletics roll resolving.
  // While true, nextTurn's new-round branch holds back — if Frankie is the
  // last combatant and his 2-action pre-consume would trigger a new round,
  // we want the Athletics check (and its log entry) to resolve FIRST so
  // the feed reads "sprinted … / Initiative reroll" instead of the reroll
  // landing ahead of the sprint outcome. See closeRollModal cleanup + the
  // executeRoll sprint block for the matching clear / deferred-catchup.
  const sprintAthleticsPendingRef = useRef(false)
  const sprintAthleticsRoundDeferredRef = useRef(false)
  // When the active combatant changes, drop any in-flight move-mode intent.
  // Without this, a Move set up during a previous turn (waiting on a
  // target-cell click) can fire long after auto-advance, attributing a token
  // move to a former active and silently failing to consume actions.
  //
  // EXCEPTION: Sprint pre-consumes 2 actions BEFORE the user clicks the
  // target cell — which advances the turn immediately. Sprint then needs
  // its target-cell click to commit the visible token move on the (now
  // former) active. Charge can in theory be mid-flight too. So skip the
  // clear if either ref is set.
  const activeIdForReset = initiativeOrder.find(e => e.is_active)?.id ?? null
  useEffect(() => {
    if (sprintPendingRef.current || pendingChargeRef.current) return
    setMoveMode(null)
  }, [activeIdForReset])
  const [selectedNpcIds, setSelectedNpcIds] = useState<Set<string>>(new Set())
  const [rosterNpcs, setRosterNpcs] = useState<any[]>([])
  const [showRestorePicker, setShowRestorePicker] = useState(false)
  const [restoreNpcIds, setRestoreNpcIds] = useState<Set<string>>(new Set())
  // Snapshot of damaged destructible scene_tokens at the moment Restore opens.
  // We can't rely on mapTokens because it's only populated while TacticalMap
  // is mounted, so opening Restore from the campaign-map view silently lost
  // every crate/barrel/vehicle.
  const [restoreObjects, setRestoreObjects] = useState<{ id: string; name: string; wp_max: number }[]>([])
  const [showLootModal, setShowLootModal] = useState(false)
  const [lootItems, setLootItems] = useState<{ name: string; qty: number; notes: string }[]>([])
  const [lootRecipients, setLootRecipients] = useState<Set<string>>(new Set())
  const [showCdpModal, setShowCdpModal] = useState(false)
  const [cdpAmount, setCdpAmount] = useState(1)
  const [cdpRecipients, setCdpRecipients] = useState<Set<string>>(new Set())
  const [presenceCount, setPresenceCount] = useState(0)
  const presenceChannelRef = useRef<any>(null)

  // Session
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [sessionCount, setSessionCount] = useState(0)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  const [submittedPlayerNotes, setSubmittedPlayerNotes] = useState<{ id: string; user_id: string; title: string | null; content: string; submitted_at: string | null; character_name: string }[]>([])
  const [showSpecialCheck, setShowSpecialCheck] = useState<'group' | 'opposed' | 'perception' | 'gut' | 'first_impression' | null>(null)
  // Quick Add modal state — all pin/community form state now lives
  // inside <QuickAddModal>. The table page only tracks open/close
  // plus the pin-only flag + seed lat/lng.
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [qaHideCommunity, setQaHideCommunity] = useState(false)
  // Community Status modal — opens the full CampaignCommunity management
  // view (pending requests, member roles, PC/NPC roster, founder flows)
  // as an overlay on the table. Triggered via the Community ▾ → Status
  // dropdown item so players don't have to leave /table to inspect the
  // current state of their community. `communityModalMode` tells
  // CampaignCommunity which panel to auto-expand on open (status →
  // first community unfolded; create → the create form open).
  const [showCommunityModal, setShowCommunityModal] = useState(false)
  const [communityModalMode, setCommunityModalMode] = useState<'status' | 'create'>('status')
  const [communityModalToken, setCommunityModalToken] = useState(0)
  function openCommunityModal(mode: 'status' | 'create') {
    setCommunityModalMode(mode)
    setCommunityModalToken(t => t + 1)
    setShowCommunityModal(true)
  }
  const [qaPinLat, setQaPinLat] = useState<string>('')
  const [qaPinLng, setQaPinLng] = useState<string>('')

  // Recruitment state lives separately from the Special Check modal
  // because its UI doesn't fit the 380px wrapper — multi-step wizard.
  // Opened by picking "Recruit" in the CHECKS dropdown (which dispatches
  // to setShowRecruit(true), not setShowSpecialCheck).
  type RecruitStep = 'pick' | 'roll' | 'result'
  type RecruitApproach = 'cohort' | 'conscript' | 'convert'
  const [showRecruit, setShowRecruit] = useState(false)
  const [recruitStep, setRecruitStep] = useState<RecruitStep>('pick')
  const [recruitRollerId, setRecruitRollerId] = useState<string>('') // PC character id
  const [recruitNpcId, setRecruitNpcId] = useState<string>('')
  const [recruitCommunityId, setRecruitCommunityId] = useState<string>('') // community.id, '__new__', or ''
  const [recruitNewCommunityName, setRecruitNewCommunityName] = useState('')
  const [recruitNewCommunityPublic, setRecruitNewCommunityPublic] = useState(false)
  const [recruitApproach, setRecruitApproach] = useState<RecruitApproach>('cohort')
  const [recruitSkill, setRecruitSkill] = useState<string>('')
  const [recruitGmCmod, setRecruitGmCmod] = useState<number>(0)
  const [recruitApprenticeToggle, setRecruitApprenticeToggle] = useState(false)
  const [recruitPreInsight, setRecruitPreInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  const [recruitResult, setRecruitResult] = useState<{
    die1: number; die2: number; die3?: number; total: number; outcome: string
    amod: number; smod: number; cmod: number
    approach: RecruitApproach; npcName: string; rollerName: string
    communityId: string | null; communityName: string
    inserted: boolean; apprenticeApplied: boolean
    // Full metadata for post-roll reroll math. logRowId so the log
    // entry can be patched when the outcome changes via reroll.
    logRowId?: string
    mode3d6?: boolean
  } | null>(null)
  // recruitment_type table for enforcing 1-Apprentice-per-PC on the UI side
  const [apprenticeByCharacter, setApprenticeByCharacter] = useState<Record<string, { id: string; npcName: string } | undefined>>({})
  // Communities available to recruit into (loaded when modal opens).
  const [recruitCommunityList, setRecruitCommunityList] = useState<{ id: string; name: string; member_count: number }[]>([])
  // NPC memberships — which community (if any) each NPC is already in.
  const [npcCommunityMap, setNpcCommunityMap] = useState<Record<string, { id: string; name: string; recruitment_type: string }>>({})
  // Lightweight community name map for all users (players + GM). Maps npc_id → community name.
  // Loaded at startup so the player NPC list shows "Community — {name}" buckets.
  const [playerNpcCommunityMap, setPlayerNpcCommunityMap] = useState<Record<string, string>>({})
  // First Impression NPC picker: which NPC the check is TARGETED at.
  // Cleared when the modal closes. On roll-time the npcId is copied
  // into firstImpressionTargetRef so executeRoll can write the
  // relationship CMod post-outcome.
  const [firstImpressionNpcId, setFirstImpressionNpcId] = useState<string>('')
  const firstImpressionTargetRef = useRef<{ characterId: string; npcId: string; npcName: string } | null>(null)
  const [showReadyWeaponModal, setShowReadyWeaponModal] = useState(false)
  const [showGrappleModal, setShowGrappleModal] = useState(false)
  // Two-step grapple flow: click a target → confirm + optionally spend
  // an Insight Die (3d6 or +3 CMod) → roll. Previously the click rolled
  // instantly which meant there was no window to spend insight — all
  // other attack flows get that option at the pre-roll modal.
  const [grappleTarget, setGrappleTarget] = useState<InitiativeEntry | null>(null)
  const [grappleInsight, setGrappleInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  const [grappleResult, setGrappleResult] = useState<{
    attackerName: string; defenderName: string
    aDie1: number; aDie2: number; aTotal: number; aOutcome: string
    aDiceRolled?: number[]  // populated when attacker spent a 3d6 Insight Die — surfaces all three dice in the result card
    dDie1: number; dDie2: number; dTotal: number; dOutcome: string
    result: 'grappled' | 'failed' | 'no_victor'
    rpTarget: string | null
    insightSpent?: boolean
  } | null>(null)
  const [groupCheckParticipants, setGroupCheckParticipants] = useState<Set<string>>(new Set())
  const [groupCheckSkill, setGroupCheckSkill] = useState('')
  const [opposedTarget, setOpposedTarget] = useState('')
  const [sessionSummary, setSessionSummary] = useState('')
  const [nextSessionNotes, setNextSessionNotes] = useState('')
  const [sessionCliffhanger, setSessionCliffhanger] = useState('')
  const [sessionFiles, setSessionFiles] = useState<File[]>([])
  const [sessionActing, setSessionActing] = useState(false)
  const [gmTab, setGmTab] = useState<'pins' | 'npcs' | 'assets' | 'notes'>('npcs')
  const [assetsFolderState, setAssetsFolderState] = useState<Set<string>>(new Set())
  const [sheetMode, setSheetMode] = useState<'inline' | 'overlay'>('inline')
  const [feedTab, setFeedTab] = useState<'rolls' | 'chat' | 'both'>('both')
  // Chat state (messages, channel, refetch, clear) lives in the
  // useChatPanel hook in components/TableChat.tsx — this is just the
  // call-site. We keep the hook here (not inside <TableChat>) so the
  // parent can read `chat.messages` for the Both-tab merged feed and
  // call `chat.clear()` from session start/end. See that file's
  // header comment for the full split.
  const chat = useChatPanel({
    campaignId: id,
    userIdRef,
    setFeedTab,
    scrollFeedToBottom: () => { rollsFeed.rollFeedRef.current?.scrollTo(0, rollsFeed.rollFeedRef.current.scrollHeight) },
  })
  const [whisperTarget, setWhisperTarget] = useState<{ userId: string; characterName: string } | null>(null)
  const [viewingNpcs, setViewingNpcs] = useState<CampaignNpc[]>([])
  const [viewingObjects, setViewingObjects] = useState<{ tokenId: string; name: string; color: string; portraitUrl: string | null }[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null)
  const objectDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [objectPositions, setObjectPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [selectedMapTargetName, setSelectedMapTargetName] = useState<string | null>(null)
  const [publishedNpcIds, setPublishedNpcIds] = useState<Set<string>>(new Set())
  const [pendingEditNpcId, setPendingEditNpcId] = useState<string | null>(null)
  const [sheetPos, setSheetPos] = useState<{ x: number; y: number } | null>(null)
  const sheetDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [npcPositions, setNpcPositions] = useState<Record<string, { x: number; y: number }>>({})
  const npcDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  // Per-card width/height overrides for the bottom-right resize handle.
  // Session-only — not persisted across reloads. Default width is 250 px
  // (see card wrapper); height tracks content unless the user resizes.
  const [npcCardSizes, setNpcCardSizes] = useState<Record<string, { w: number; h: number }>>({})
  const npcResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)
  // Roll modal position — null means "use default centered placement". Once
  // the user drags the roll panel, its position persists across re-opens so
  // attacks don't keep snapping back over the map.
  const [rollModalPos, setRollModalPos] = useState<{ x: number; y: number } | null>(null)
  const rollModalDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const campaignChannelRef = useRef<any>(null)

  async function loadEntries(campaignId: string) {
    // Sequence guard — multiple realtime callbacks fire in quick succession
    // (character_states + campaign_members + others) and a slower earlier
    // call can finish AFTER a faster later one, overwriting good state with
    // stale data. Each call gets a sequence number; only the latest one
    // commits to React state.
    const seq = ++loadEntriesSeqRef.current
    const isLatest = () => seq === loadEntriesSeqRef.current

    const [{ data: members }, { data: rawStates }] = await Promise.all([
      supabase.from('campaign_members').select('user_id, character_id').eq('campaign_id', campaignId).not('character_id', 'is', null),
      supabase.from('character_states').select('*').eq('campaign_id', campaignId),
    ])

    if (!members || members.length === 0 || !rawStates || rawStates.length === 0) {
      if (isLatest()) { setEntries([]); setEntriesLoading(false) }
      return
    }

    const currentAssignment: Record<string, string> = {}
    for (const m of members) currentAssignment[m.user_id] = m.character_id

    const filteredStates = rawStates.filter((s: any) => currentAssignment[s.user_id] === s.character_id && !s.kicked)
    if (filteredStates.length === 0) { if (isLatest()) { setEntries([]); setEntriesLoading(false) } return }

    const charIds = filteredStates.map((s: any) => s.character_id)
    const userIds = filteredStates.map((s: any) => s.user_id)

    const [{ data: chars, error: charsErr }, { data: profiles, error: profilesErr }] = await Promise.all([
      supabase.from('characters').select('id, name, created_at, data').in('id', charIds),
      supabase.from('profiles').select('id, username').in('id', userIds),
    ])
    if (charsErr) console.error('[loadEntries] characters query error:', charsErr.message)
    if (profilesErr) console.error('[loadEntries] profiles query error:', profilesErr.message)

    const charMap = Object.fromEntries((chars ?? []).map((c: any) => {
      const { photoDataUrl, ...dataWithoutPhoto } = c.data ?? {}
      return [c.id, { ...c, data: dataWithoutPhoto }]
    }))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))
    const missingChars = charIds.filter((cid: string) => !(cid in charMap))
    if (missingChars.length > 0) {
      console.warn('[loadEntries] missing chars for ids — likely RLS blocking cross-user reads:', missingChars, 'returned chars:', chars?.map((c: any) => c.id))
    }

    const newEntries: TableEntry[] = filteredStates.map((s: any) => ({
      stateId: s.id,
      userId: s.user_id,
      username: profileMap[s.user_id] ?? 'Unknown',
      character: charMap[s.character_id] ?? { id: s.character_id, name: 'Unknown', created_at: '', data: {} },
      liveState: {
        id: s.id,
        wp_current: s.wp_current, wp_max: s.wp_max,
        rp_current: s.rp_current, rp_max: s.rp_max,
        stress: s.stress, insight_dice: s.insight_dice, morality: s.morality, cdp: s.cdp ?? 0,
        // death_countdown / incap_rounds — without these the
        // mortally-wounded banner reads "Stabilize within ? rounds"
        // because every loadEntries call (which fires on turn_changed,
        // pc_damaged broadcast, etc.) wipes the countdown back to
        // undefined.
        death_countdown: s.death_countdown ?? null,
        incap_rounds: s.incap_rounds ?? null,
      },
    }))

    if (!isLatest()) return
    setEntries(newEntries)
    setEntriesLoading(false)

    const { data: photoRows } = await supabase
      .from('characters')
      .select('id, data->photoDataUrl')
      .in('id', charIds)

    if (!isLatest()) return
    if (photoRows && photoRows.length > 0) {
      const photoMap: Record<string, string> = {}
      for (const row of photoRows as any[]) {
        if (row.photoDataUrl) photoMap[row.id] = row.photoDataUrl
      }
      setEntries(prev => prev.map(e => ({
        ...e,
        character: {
          ...e.character,
          data: { ...e.character.data, photoDataUrl: photoMap[e.character.id] ?? null },
        },
      })))
    }
  }

  // loadChat / sendChat moved to components/TableChat.tsx — accessed
  // via `chat.refetch()` and the <ChatComposer>'s internal send.

  async function loadPlayerNpcCommunityMap(campaignId: string) {
    const { data } = await supabase
      .from('community_members')
      .select('npc_id, communities!inner(name, campaign_id)')
      .is('left_at', null)
      .eq('communities.campaign_id', campaignId)
    const map: Record<string, string> = {}
    for (const row of (data ?? []) as any[]) {
      if (row.npc_id) map[row.npc_id] = row.communities?.name ?? '?'
    }
    setPlayerNpcCommunityMap(map)
  }

  async function loadRevealedNpcs(characterId: string | null, cnpcs: any[]) {
    const query = characterId
      ? supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('character_id', characterId).eq('revealed', true)
      : supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('revealed', true)
    const { data: rels } = await query
    if (rels && rels.length > 0 && cnpcs.length > 0) {
      const seen = new Set<string>()
      const revealed = rels.map((r: any) => {
        if (seen.has(r.npc_id)) return null
        seen.add(r.npc_id)
        const npc = cnpcs.find((n: any) => n.id === r.npc_id)
        return npc ? { ...npc, relationship_cmod: r.relationship_cmod, reveal_level: r.reveal_level } : null
      }).filter(Boolean)
      setRevealedNpcs(revealed)
    } else {
      setRevealedNpcs([])
    }
  }

  async function loadInitiative(campaignId: string) {
    const seq = ++loadInitSeqRef.current
    const { data } = await supabase
      .from('initiative_order')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('roll', { ascending: false }).order('character_name', { ascending: true })
    if (seq !== loadInitSeqRef.current) return // stale — a newer call is in flight
    const order = data ?? []
    setInitiativeOrder(order)
    setCombatActive(order.length > 0)
  }

  async function ensureCharacterStates(campaignId: string, members: any[]) {
    const charIds = members.map((m: any) => m.character_id).filter(Boolean)
    if (charIds.length === 0) return
    const { data: existingStates } = await supabase
      .from('character_states').select('character_id')
      .eq('campaign_id', campaignId).in('character_id', charIds)
    const existingCharIds = new Set((existingStates ?? []).map((s: any) => s.character_id))
    const toInsert = members
      .filter((m: any) => m.character_id && !existingCharIds.has(m.character_id))
      .map((m: any) => {
        const rapid = m.characters?.data?.rapid ?? {}
        const wp = 10 + (rapid.PHY ?? 0) + (rapid.DEX ?? 0)
        const rp = 6 + (rapid.RSN ?? 0)
        return { campaign_id: campaignId, character_id: m.character_id, user_id: m.user_id, wp_current: wp, wp_max: wp, rp_current: rp, rp_max: rp, stress: 0, insight_dice: 2, morality: 3 }
      })
    if (toInsert.length > 0) await supabase.from('character_states').insert(toInsert)
  }

  // Watch entries for any PC whose stress transitions <5 → 5. The Stress Check
  // modal lives inside CharacterCard and only fires when the sheet is mounted;
  // this guarantees the trigger by auto-opening the affected player's sheet
  // (their client) or logging a toast for the GM.
  useEffect(() => {
    if (!entries || entries.length === 0) return
    const prev = prevStressByStateIdRef.current
    const primed = stressWatchPrimedRef.current
    for (const e of entries) {
      const stateId = e.stateId
      const curStress = e.liveState?.stress ?? 0
      const lastSeen = prev.get(stateId)
      // Only fire on an actual transition, never on the initial snapshot.
      if (primed && lastSeen != null && lastSeen < 5 && curStress >= 5) {
        const ownerUserId = e.userId
        if (ownerUserId && ownerUserId === userIdRef.current) {
          // It's my PC — open the sheet so CharacterCard's effect fires the modal.
          setSelectedEntry(e)
          setViewingNpcs([])
        } else if (isGM) {
          // GM-side notice. Player will see the modal on their own client.
          console.warn(`[stress] ${e.character.name} hit 5 — Stress Check triggered for player`)
        }
        // Log to the affected PC's progression log. Fires once per transition.
        if (e.character?.id) void appendProgressionLog(e.character.id, 'stress', 'Stress reached 5 — Stress Check triggered')
      }
      prev.set(stateId, curStress)
    }
    stressWatchPrimedRef.current = true
  }, [entries, isGM])

  useEffect(() => {
    async function load() {
      // ── Wave 1 ──────────────────────────────────────────────────
      // auth + campaign load in parallel — neither depends on the
      // other, the prior sequential pair was paying ~one cold round-
      // trip per mount unnecessarily.
      //
      // 2026-04-29 — switched the auth read from supabase.auth.getUser()
      // to getCachedAuth(). The former takes the gotrue-js Web Lock
      // and round-trips GET /auth/v1/user; if any other tab is mid-
      // mount and holding the lock, this whole Promise.all hangs
      // (because Promise.all awaits ALL its inputs even if one is
      // stuck). The "Loading The Table..." screen sat indefinitely.
      // getCachedAuth() reads from getSession() which is a localStorage
      // hit — no lock contention, no network call.
      const [authSnapshot, campResult] = await Promise.all([
        getCachedAuth(),
        supabase.from('campaigns').select('*').eq('id', id).single(),
      ])
      const user = authSnapshot.user
      const camp = campResult.data
      if (!user) {
        // Preserve the current path + query so a session-expired reload on
        // the tactical map returns the player here after re-login instead
        // of dumping them at /dashboard. Matches LayoutShell's redirect shape.
        const search = typeof window !== 'undefined' ? window.location.search : ''
        const fullPath = `/stories/${id}/table${search}`
        router.push(`/login?redirect=${encodeURIComponent(fullPath)}`)
        return
      }
      if (!camp) { router.push('/stories'); return }

      setUserId(user.id)
      userIdRef.current = user.id  // Sync immediately so chat refetch sees the freshest viewer id
      setCampaign(camp)
      // Bump last_accessed_at so the My Stories list can sort by
      // most-recently-touched and surface "Last Run: <date>". Fire-and-
      // forget — failure here doesn't block the table view.
      supabase.from('campaigns').update({ last_accessed_at: new Date().toISOString() }).eq('id', id)
        .then(({ error }: any) => { if (error) console.warn('[table] last_accessed_at bump failed:', error.message) })
      setVehicles(camp.vehicles ?? [])
      const amGM = camp.gm_user_id === user.id
      setIsGM(amGM)
      setSessionStatus(camp.session_status === 'active' ? 'active' : 'idle')
      setSessionCount(camp.session_count ?? 0)
      setLoading(false)
      // Seed the Quick Add pin lat/lng from the campaign's map center
      // so if the player opens Quick Add via some non-dblclick route
      // the coords aren't zero. Double-click replaces them with the
      // clicked location.
      if (camp.map_center_lat != null) setQaPinLat(String(camp.map_center_lat))
      if (camp.map_center_lng != null) setQaPinLng(String(camp.map_center_lng))

      // ── Wave 2 ──────────────────────────────────────────────────
      // Everything that only needs id, user, or camp.gm_user_id —
      // fired together. Previously this was three sequential awaits:
      //   profiles.select(user.id) → Promise.all(gmProfile, members) →
      //   character_states kick check → Promise.all(loads + cnpcs +
      //   world_npcs + refreshMapTokenIds) → loadPlayerNpcCommunityMap.
      // Combining them into a single Promise.all collapses ~3 round-
      // trips of waterfall into one. Trade-off: a kicked player still
      // pays for the unused fetches before being redirected, but
      // kick is a rare path — accepting that cost for the common-path
      // win.
      const kickCheckPromise = amGM
        ? Promise.resolve({ data: null as { kicked: boolean | null } | null })
        : supabase.from('character_states').select('kicked').eq('campaign_id', id).eq('user_id', user.id).maybeSingle()

      const [
        myProfileRes,
        gmProfileRes,
        membersRes,
        _entriesResult,
        _rollsResult,
        _initResult,
        cnpcsResult,
        pubDataResult,
        _mapTokenResult,
        _commMapResult,
        kickRes,
      ] = await Promise.all([
        supabase.from('profiles').select('username, role').eq('id', user.id).single(),
        supabase.from('profiles').select('id, username').eq('id', camp.gm_user_id).single(),
        supabase.from('campaign_members')
          .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
          .eq('campaign_id', id)
          .not('character_id', 'is', null),
        loadEntries(id),
        rollsFeed.refetch(),
        loadInitiative(id),
        supabase.from('campaign_npcs').select('*').eq('campaign_id', id),
        supabase.from('world_npcs').select('source_campaign_npc_id').not('source_campaign_npc_id', 'is', null),
        // Hydrate the "which NPCs already have a token in the active
        // scene?" set on initial load so the folder MAP/UNMAP button
        // shows the correct state from the start. Without this, the
        // set stays empty until the user opens the tactical map view
        // and the button stays "MAP" even when everything is already
        // placed from a prior session.
        refreshMapTokenIds(),
        // Community-membership map for the player NPC list ("Community
        // — <name>" buckets vs "Unfiled"). Independent of cnpcs.
        loadPlayerNpcCommunityMap(id),
        kickCheckPromise,
      ])

      const myProfile = myProfileRes.data
      const gmProfile = gmProfileRes.data
      const members = membersRes.data
      setMyUsername(myProfile?.username ?? '')
      setIsThriver(myProfile?.role === 'Thriver')
      setGmInfo({ userId: camp.gm_user_id, username: (gmProfile as any)?.username ?? 'GM' })

      // Kick gate — handled after the parallel batch instead of mid-
      // waterfall. Diagnostic log preserved for the silent-RLS pattern
      // that bit us before.
      if (!amGM) {
        const myState = (kickRes as any).data
        console.warn('[kickCheck] myState:', myState)
        if (myState?.kicked) {
          alert('You have been removed from this session by the GM.')
          window.location.href = `/stories/${id}`
          return
        }
      }

      if (members && members.length > 0) await ensureCharacterStates(id, members as any[])

      const cnpcs = cnpcsResult.data ?? []
      setCampaignNpcs(cnpcs)
      setRosterNpcs(cnpcs.filter((n: any) => {
          if (n.status !== 'active') return false
          const wp = n.wp_current ?? n.wp_max ?? 10
          return wp > 0
        }))
      if (pubDataResult.data) setPublishedNpcIds(new Set(pubDataResult.data.map((d: any) => d.source_campaign_npc_id!)))

      // Load revealed NPCs — GM sees all, players see their own
      if (camp.gm_user_id === user.id) {
        await loadRevealedNpcs(null, cnpcs)
        revealChannelRef.current = supabase.channel(`reveals_${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'npc_relationships' }, () => {
            loadRevealedNpcs(null, cnpcs)
          })
          .subscribe()
      } else {
        const myMember = (members ?? []).find((m: any) => m.user_id === user.id)
        if (myMember?.character_id) {
          myCharIdRef.current = myMember.character_id
          await loadRevealedNpcs(myMember.character_id, cnpcs)
          revealChannelRef.current = supabase.channel(`reveals_${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'npc_relationships' }, () => {
              if (myCharIdRef.current) loadRevealedNpcs(myCharIdRef.current, cnpcs)
            })
            .subscribe()
        }
      }

      // Keep the community map fresh — when an NPC is recruited, the
      // player roster should immediately show the community bucket.
      communityMembersChannelRef.current = supabase.channel(`community_members_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members' }, () => {
          loadPlayerNpcCommunityMap(id)
        })
        .subscribe()

      channelRef.current = supabase.channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()

      membersChannelRef.current = supabase.channel(`members_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${id}` }, async () => {
          // Refetch members with character data, ensure their character_state exists,
          // then refresh entries. Without ensureCharacterStates here, a player who
          // picks a character won't appear in the GM's table until they navigate to
          // /table themselves and trigger state creation on their own browser.
          const { data: refreshedMembers } = await supabase
            .from('campaign_members')
            .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
            .eq('campaign_id', id)
            .not('character_id', 'is', null)
          if (refreshedMembers && refreshedMembers.length > 0) {
            await ensureCharacterStates(id, refreshedMembers as any[])
          }
          await loadEntries(id)
        })
        .subscribe()

      // Chat realtime channel now lives inside useChatPanel — no
      // separate subscription needed here.

      initChannelRef.current = supabase.channel(`initiative_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'initiative_order', filter: `campaign_id=eq.${id}` }, () => loadInitiative(id))
        .on('broadcast', { event: 'combat_ended' }, () => { setInitiativeOrder([]); setCombatActive(false); setViewingNpcs([]); setShowTacticalMap(true) })
        .on('broadcast', { event: 'player_kicked' }, (msg: any) => {
          if (msg.payload?.userId === user.id) {
            alert('You have been removed from this session by the GM.')
            window.location.href = `/stories/${id}`
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
          if (payload.new?.type === 'session_kick') {
            alert('You have been removed from this session by the GM.')
            window.location.href = `/stories/${id}`
          }
        })
        .on('broadcast', { event: 'combat_started' }, () => { loadInitiative(id); rollsFeed.refetch() })
        .on('broadcast', { event: 'tactical_shared' }, (msg: any) => { setTacticalShared(msg.payload?.shared ?? false); setShowTacticalMap(msg.payload?.shared ?? false) })
        .on('broadcast', { event: 'tactical_unshared' }, () => { setTacticalShared(false); setShowTacticalMap(false) })
        .on('broadcast', { event: 'token_changed' }, () => { setTokenRefreshKey(k => k + 1) })
        .on('broadcast', { event: 'turn_changed' }, () => { loadInitiative(id); loadEntries(id); rollsFeed.refetch() })
        .on('broadcast', { event: 'logs_cleared' }, () => {
          // GM started/ended a session — clear local chat + roll state, then
          // refetch from DB so every client converges to the post-clear state.
          rollsFeed.clear()
          chat.clear()
          rollsFeed.refetch()
          chat.refetch()
        })
        .on('broadcast', { event: 'npc_damaged' }, (msg: any) => {
          // Another client dealt damage to an NPC — apply the patch locally
          const { npcId, patch } = msg.payload ?? {}
          console.warn('[npc_damaged] RECV', { npcId, patch })
          if (npcId && patch) {
            setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
            setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
            setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
          }
        })
        .on('broadcast', { event: 'pc_damaged' }, (msg: any) => {
          // Another client dealt damage to a PC — apply optimistic patch then refresh
          const { stateId: sid, patch } = msg.payload ?? {}
          if (sid && patch) {
            setEntries(prev => prev.map(e => e.stateId === sid ? { ...e, liveState: { ...e.liveState, ...patch } } : e))
          }
          loadEntries(id)
        })
        .on('broadcast', { event: 'inventory_transfer' }, () => {
          // Another player gave an item — refresh entries to see updated inventory
          loadEntries(id)
        })
        .on('broadcast', { event: 'pc_mortal_wound' }, (msg: any) => {
          // Show insight save modal on the player's screen or GM's screen
          const data = msg.payload
          if (data && (data.targetUserId === userId || isGM)) {
            setInsightSavePrompt(data)
          }
        })
        .on('broadcast', { event: 'pc_mortal_wound_resolved' }, () => {
          // Another client resolved the insight save — close our modal and refresh
          setInsightSavePrompt(null)
          loadEntries(id)
        })
        // Players' postgres_changes subscription on npc_relationships is
        // unreliable (RLS / publication), so mid-combat reveals go over this
        // broadcast channel instead. Refetch cnpcs fresh so newly-added roster
        // NPCs aren't missed due to a stale closure.
        .on('broadcast', { event: 'npcs_revealed' }, async () => {
          const { data: fresh } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
          const freshList = fresh ?? []
          if (freshList.length > 0) {
            setCampaignNpcs(freshList)
            setRosterNpcs(freshList.filter((n: any) => {
              if (n.status !== 'active') return false
              const wp = n.wp_current ?? n.wp_max ?? 10
              return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
            }))
          }
          loadRevealedNpcs(myCharIdRef.current, freshList)
        })
        .subscribe()

      campaignChannelRef.current = supabase.channel(`campaign_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${id}` }, (payload: any) => {
          const row = payload.new
          setSessionStatus(row.session_status === 'active' ? 'active' : 'idle')
          setSessionCount(row.session_count ?? 0)
          setCampaign((prev: Campaign | null) => prev ? { ...prev, session_status: row.session_status, session_count: row.session_count, session_started_at: row.session_started_at } : prev)
        })
        .subscribe()

      // NPC roster realtime — without this, damage applied to an NPC updates
      // the DB but the GM (and players) keep seeing the old HP because
      // rosterNpcs/campaignNpcs only refresh on combat-start or page reload.
      npcsChannelRef.current = supabase.channel(`campaign_npcs_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${id}` }, (payload: any) => {
          // For UPDATEs, apply the row from the payload directly — no round trip,
          // no race with the in-flight-ref guard. INSERT/DELETE fall through to
          // a full refetch since payload.new may be incomplete/absent.
          if (payload.eventType === 'UPDATE' && payload.new) {
            const row = payload.new
            // Upsert (not just patch) — when hidden_from_players flips false,
            // a player's RLS now exposes a row their local state never had,
            // and the UPDATE event is the only signal it exists. Plain
            // .map() would silently drop it.
            setCampaignNpcs(prev => prev.some(n => n.id === row.id)
              ? prev.map(n => n.id === row.id ? { ...n, ...row } : n)
              : [...prev, row])
            setRosterNpcs(prev => {
              const alive = (n: any) => {
                const wp = n.wp_current ?? n.wp_max ?? 10
                return n.status === 'active' && !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
              }
              const merged = prev.some(n => n.id === row.id)
                ? prev.map(n => n.id === row.id ? { ...n, ...row } : n)
                : [...prev, row]
              // Drop if the update killed them, or if the row is hidden.
              return merged.filter(alive)
            })
            setViewingNpcs(prev => prev.map(n => n.id === row.id ? { ...n, ...row } as CampaignNpc : n))
            return
          }
          // INSERT/DELETE: full refetch.
          void (async () => {
            const { data: cnpcs } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
            if (cnpcs) {
              setCampaignNpcs(cnpcs)
              setRosterNpcs(cnpcs.filter((n: any) => {
                if (n.status !== 'active') return false
                const wp = n.wp_current ?? n.wp_max ?? 10
                return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
              }))
            }
          })()
        })
        .subscribe()

      // Presence — track how many users are on this table page
      try {
        const presChannel = supabase.channel(`presence_table_${id}_${Date.now()}`, { config: { presence: { key: user.id } } })
        presChannel.on('presence', { event: 'sync' }, () => {
          const state = presChannel.presenceState()
          setPresenceCount(Object.keys(state).length)
        })
        presChannel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await presChannel.track({ user_id: user.id })
          }
        })
        presenceChannelRef.current = presChannel
      } catch (e) {
        console.warn('[presence] setup error:', e)
      }
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (membersChannelRef.current) supabase.removeChannel(membersChannelRef.current)
      if (npcsChannelRef.current) supabase.removeChannel(npcsChannelRef.current)
      // chat channel teardown is handled by useChatPanel's own cleanup.
      if (initChannelRef.current) supabase.removeChannel(initChannelRef.current)
      if (campaignChannelRef.current) supabase.removeChannel(campaignChannelRef.current)
      if (revealChannelRef.current) supabase.removeChannel(revealChannelRef.current)
      if (communityMembersChannelRef.current) supabase.removeChannel(communityMembersChannelRef.current)
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current)
    }
  }, [id])

  // Tab-backgrounding refetch. Chrome throttles inactive tabs; websockets
  // can pause without a clean close, so postgres_changes events stop
  // arriving while the tab "looks" connected. On hidden→visible we
  // re-pull the state the mount effect originally hydrated, so the
  // moment the user returns the feed is in sync with the DB even if a
  // few realtime events were dropped during the background window.
  // Channel rebuild is intentionally NOT done here — supabase-js
  // reconnects internally on socket health checks. If staleness
  // persists for users after this, expand to a teardown+resubscribe.
  useEffect(() => {
    if (!id) return
    function handleVisibility() {
      if (document.hidden) return
      void (async () => {
        loadEntries(id)
        rollsFeed.refetch()
        loadInitiative(id)
        loadPlayerNpcCommunityMap(id)
        const { data: cnpcs } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
        if (cnpcs) {
          setCampaignNpcs(cnpcs)
          setRosterNpcs(cnpcs.filter((n: any) => {
            if (n.status !== 'active') return false
            const wp = n.wp_current ?? n.wp_max ?? 10
            return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
          }))
          const charId = isGM ? null : myCharIdRef.current
          if (isGM || charId) loadRevealedNpcs(charId, cnpcs)
        }
      })()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [id, isGM])

  // Roll requests broadcast from the /character-sheet popout window. The
  // popout doesn't own the roll modal / initiative gates / CMod stack —
  // it just posts {label, amod, smod, weapon} on a same-origin same-browser
  // BroadcastChannel and the table tab calls handleRollRequest as if the
  // user had clicked the in-table card. We use a ref to avoid tearing down
  // the channel on every parent re-render.
  const rollRequestRef = useRef<typeof handleRollRequest | null>(null)
  rollRequestRef.current = handleRollRequest
  useEffect(() => {
    if (!id) return
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(`roll-requests-${id}`)
    ch.onmessage = (e: MessageEvent) => {
      const { label, amod, smod, weapon } = (e.data ?? {}) as { label?: string; amod?: number; smod?: number; weapon?: any }
      if (!label || typeof amod !== 'number' || typeof smod !== 'number') return
      rollRequestRef.current?.(label, amod, smod, weapon)
    }
    return () => { ch.close() }
  }, [id])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingRoll) { closeRollModal(); return }
        if (selectedEntry) { setSelectedEntry(null); return }
        if (showEndSessionModal) { setShowEndSessionModal(false); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [pendingRoll, selectedEntry, showEndSessionModal])

  async function handleStatUpdate(stateId: string, field: string, value: number) {
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    // Update the entries in-place so the value persists immediately
    setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, [field]: value } } : e))
  }

  // ── Initiative functions ──

  async function startCombat() {
    if (!isGM) return
    // Load roster NPCs for picker
    const { data: roster } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'active')
      .order('name')
    const aliveRoster = (roster ?? []).filter((n: any) => {
      const wp = n.wp_current ?? n.wp_max ?? 10
      return wp > 0
    })
    setRosterNpcs(aliveRoster)
    setSelectedNpcIds(new Set(aliveRoster.map((n: any) => n.id)))
    setShowNpcPicker(true)
  }

  async function confirmStartCombat() {
    // Sanity check — no players present AND no NPCs selected = nothing
    // to roll initiative for. Bail with a friendly alert instead of
    // silently inserting zero combatants. (entries.length-zero guard
    // moved here from the Start Combat button so a GM can solo-test
    // with NPCs only — the per-button gate was blocking that intent.)
    if (entries.length === 0 && selectedNpcIds.size === 0) {
      alert('Pick at least one NPC to start combat (no players are present).')
      return
    }
    setStartingCombat(true)
    setShowNpcPicker(false)

    // Getting The Drop: selected character gets -2 on initiative but acts first with 1 action
    const dropPenalty = -2

    // Refetch members + characters fresh from DB rather than reading `entries`,
    // because `entries` only includes PCs that already have a character_states
    // row — a player who joined moments ago may not be in entries yet, but they
    // still belong in combat. Also ensure their state row exists so damage can
    // be applied to them later.
    const [, { data: rawMembers }] = await Promise.all([
      supabase.from('initiative_order').delete().eq('campaign_id', id),
      supabase.from('campaign_members')
        .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
        .eq('campaign_id', id)
        .not('character_id', 'is', null),
    ])
    if (rawMembers && rawMembers.length > 0) {
      await ensureCharacterStates(id, rawMembers as any[])
    }
    // Filter out kicked players so they don't get re-added to initiative.
    const { data: kickedStates } = await supabase
      .from('character_states')
      .select('user_id')
      .eq('campaign_id', id)
      .eq('kicked', true)
    const kickedUserIds = new Set((kickedStates ?? []).map((k: any) => k.user_id))
    const freshMembers = (rawMembers ?? []).filter((m: any) => !kickedUserIds.has(m.user_id))
    const charIds = freshMembers.map((m: any) => m.character_id)
    const { data: freshChars } = charIds.length > 0
      ? await supabase.from('characters').select('id, name, data').in('id', charIds)
      : { data: [] }
    const charMap = Object.fromEntries((freshChars ?? []).map((c: any) => [c.id, c]))

    // Roll initiative for all PCs: 2d6 + ACU AMod + DEX AMod
    const initDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
    const pcRows = (freshMembers ?? []).map((m: any) => {
      const char = charMap[m.character_id]
      const rapid = char?.data?.rapid ?? {}
      const acu = rapid.ACU ?? 0
      const dex = rapid.DEX ?? 0
      const charName = char?.name ?? 'Unknown'
      const isDropChar = dropCharacter === charName
      const d1 = rollD6(), d2 = rollD6()
      const drop = isDropChar ? dropPenalty : 0
      const roll = d1 + d2 + acu + dex + drop
      initDetails.push({ name: charName, d1, d2, acu, dex, drop, total: roll, is_npc: false })
      return {
        campaign_id: id,
        character_name: charName,
        character_id: m.character_id,
        user_id: m.user_id,
        npc_id: null,
        portrait_url: null,
        npc_type: null,
        roll,
        is_active: false,
        is_npc: false,
        actions_remaining: 2,
      }
    })

    // Roll initiative for selected NPCs: 2d6 + ACU AMod + DEX AMod
    const npcRows = rosterNpcs
      .filter(n => selectedNpcIds.has(n.id))
      .map(n => {
        const isDropChar = dropCharacter === n.name
        const d1 = rollD6(), d2 = rollD6()
        const acu = n.acumen ?? 0
        const dex = n.dexterity ?? 0
        const drop = isDropChar ? dropPenalty : 0
        const roll = d1 + d2 + acu + dex + drop
        initDetails.push({ name: n.name, d1, d2, acu, dex, drop, total: roll, is_npc: true })
        return {
          campaign_id: id,
          character_name: n.name,
          character_id: null,
          user_id: null,
          npc_id: n.id,
          portrait_url: n.portrait_url,
          npc_type: n.npc_type,
          roll,
          is_active: false,
          is_npc: true,
          actions_remaining: 2,
        }
      })

    // Sort client-side to determine first active combatant (avoids a re-fetch)
    const allRows = [...pcRows, ...npcRows]
    // Secondary tiebreak on name so this log ordering matches the initiative
    // bar's ordering (both now use roll desc, name asc for same-roll ties).
    const sorted = [...initDetails].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

    const combatants = sorted.map(s => s.name)
    const now = Date.now()

    // ── Getting the Drop: solo mini-round BEFORE initiative ──
    if (dropCharacter) {
      const dropRow = allRows.find(r => r.character_name === dropCharacter)
      if (dropRow) {
        // Insert ALL combatants — drop character gets 1 action, everyone else gets 0 (frozen)
        pendingCombatantsRef.current = allRows
        dropPhaseRef.current = true

        const dropInsertRows = allRows.map(r =>
          r.character_name === dropCharacter
            ? { ...r, is_active: true, actions_remaining: 1 }
            : { ...r, is_active: false, actions_remaining: 0 }
        )
        const [{ data: insertedDrop, error: dropInsertErr }, { error: dropLogErr }] = await Promise.all([
          supabase.from('initiative_order').insert(dropInsertRows).select(),
          supabase.from('roll_log').insert([
            { campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Started',
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'combat_start',
              damage_json: { combatants } as any, created_at: new Date(now).toISOString() },
            { campaign_id: id, user_id: userId, character_name: 'System',
              label: `⚡ ${dropCharacter} Gets the Drop!`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'drop',
              created_at: new Date(now + 1).toISOString() },
          ]),
        ])
        if (dropInsertErr) console.error('[confirmStartCombat] drop insert error:', dropInsertErr.message)
        if (dropLogErr) console.error('[confirmStartCombat] drop log error:', dropLogErr.message)
        const sortedDrop = (insertedDrop ?? []).slice().sort((a: any, b: any) => b.roll - a.roll || String(a.character_name).localeCompare(String(b.character_name)))
        setInitiativeOrder(sortedDrop)
        setCombatActive(sortedDrop.length > 0)
        setDropCharacter('')
        setStartingCombat(false)
        if (!tacticalShared) {
          setTacticalShared(true); setShowTacticalMap(true)
          initChannelRef.current?.send({ type: 'broadcast', event: 'tactical_shared', payload: { shared: true } })
        }
        await rollsFeed.refetch()
        initChannelRef.current?.send({ type: 'broadcast', event: 'combat_started', payload: {} })
        return // Phase 2 happens in nextTurn when the drop action is consumed
      }
    }

    // ── Normal start (no drop) ──
    let firstCharName = sorted[0]?.name
    const toInsert = allRows.map(r => r.character_name === firstCharName
      ? { ...r, is_active: true, actions_remaining: 2 }
      : r
    )

    // Insert initiative rows + log combat start in parallel.
    if (toInsert.length > 0) {
      const [{ data: insertedInit, error: initInsertErr }, { error: rollInsertErr }] = await Promise.all([
        supabase.from('initiative_order').insert(toInsert).select(),
        supabase.from('roll_log').insert([
          { campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Started',
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'combat_start',
            damage_json: { combatants } as any, created_at: new Date(now).toISOString() },
          { campaign_id: id, user_id: userId, character_name: 'System', label: 'Initiative',
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'initiative',
            damage_json: { initiative: sorted } as any, created_at: new Date(now + 1).toISOString() },
        ]),
      ])
      if (initInsertErr) console.error('[confirmStartCombat] initiative insert error:', initInsertErr.message)
      if (rollInsertErr) console.error('[confirmStartCombat] roll_log insert error:', rollInsertErr.message)
      // Optimistic local state — sorted by roll desc to match loadInitiative behavior.
      const sortedInit = (insertedInit ?? []).slice().sort((a: any, b: any) => b.roll - a.roll || String(a.character_name).localeCompare(String(b.character_name)))
      setInitiativeOrder(sortedInit)
      setCombatActive(sortedInit.length > 0)
      setCombatRound(1)
    }
    setDropCharacter('')

    // Auto-open NPC cards for all NPCs in combat (skip if tactical map is showing — cards block the map)
    if (!showTacticalMap) {
      const combatNpcObjs = rosterNpcs.filter(n => selectedNpcIds.has(n.id))
      if (combatNpcObjs.length > 0) {
        setViewingNpcs(combatNpcObjs as CampaignNpc[])
        setSelectedEntry(null)
      }
    }

    setStartingCombat(false)
    // Auto-share tactical map so all players see it
    if (!tacticalShared) {
      setTacticalShared(true)
      setShowTacticalMap(true)
      initChannelRef.current?.send({ type: 'broadcast', event: 'tactical_shared', payload: { shared: true } })
    }
    // Refresh the GM's log feed so the new entries appear immediately, then
    // broadcast combat start so players also reload their state. We rely on
    // postgres_changes for the player log refresh; broadcast is the trigger
    // for loadInitiative on the player side.
    await rollsFeed.refetch()
    initChannelRef.current?.send({ type: 'broadcast', event: 'combat_started', payload: {} })
  }

  async function nextTurn() {
    console.warn('[nextTurn] called')

    // Re-entry guard: a rapid-fire consumeAction + realtime echo can fire two
    // nextTurn calls back-to-back. Without this guard, call #2 reads active
    // state that call #1 hasn't finished writing yet, then advances the turn
    // a second time — silently skipping whoever call #1 just activated.
    if (nextTurnInFlightRef.current) {
      console.warn('[nextTurn] already in flight — bailing to avoid double-advance')
      return
    }
    nextTurnInFlightRef.current = true
    try {

    // ── Drop phase transition: drop round is over, start full combat ──
    if (dropPhaseRef.current) {
      dropPhaseRef.current = false
      pendingCombatantsRef.current = []

      // Fetch ALL combatants already in initiative_order (inserted during drop phase)
      const { data: dropEntries } = await supabase.from('initiative_order').select('*').eq('campaign_id', id)
      const allEntries = dropEntries ?? []
      if (allEntries.length === 0) return

      // Re-roll initiative for everyone
      const rerollDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
      for (const entry of allEntries) {
        const d1 = rollD6(), d2 = rollD6()
        const acu = entry.is_npc ? (rosterNpcs.find((n: any) => n.id === entry.npc_id)?.acumen ?? 0) : (entries.find(e => e.character.id === entry.character_id)?.character.data?.rapid?.ACU ?? 0)
        const dex = entry.is_npc ? (rosterNpcs.find((n: any) => n.id === entry.npc_id)?.dexterity ?? 0) : (entries.find(e => e.character.id === entry.character_id)?.character.data?.rapid?.DEX ?? 0)
        const roll = d1 + d2 + acu + dex
        rerollDetails.push({ name: entry.character_name, d1, d2, acu, dex, drop: 0, total: roll, is_npc: !!entry.is_npc })
        await supabase.from('initiative_order').update({ roll, is_active: false, actions_remaining: 2, aim_bonus: 0, aim_active: false, defense_bonus: 0, has_cover: false, winded: false, inspired_this_round: false }).eq('id', entry.id)
      }
      const sortedReroll = [...rerollDetails].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

      // Activate the highest roller
      const firstCharName = sortedReroll[0]?.name
      const firstEntry = allEntries.find((e: any) => e.character_name === firstCharName)
      if (firstEntry) {
        await supabase.from('initiative_order').update({ is_active: true }).eq('id', firstEntry.id)
      }

      // Log Initiative
      await supabase.from('roll_log').insert({
        campaign_id: id, user_id: userId, character_name: 'System', label: 'Initiative',
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'initiative',
        damage_json: { initiative: sortedReroll } as any,
      })

      await Promise.all([loadInitiative(id), rollsFeed.refetch()])
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Fetch fresh initiative order from DB to avoid stale state
    const { data: freshOrder, error: orderErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false }).order('character_name', { ascending: true })
    if (orderErr) console.warn('[nextTurn] order fetch error:', orderErr.message)
    const order = freshOrder ?? initiativeOrder
    if (order.length === 0) { console.warn('[nextTurn] empty order, bailing'); return }
    const currentIdx = order.findIndex((e: any) => e.is_active)
    console.warn('[nextTurn] currentIdx:', currentIdx, 'order length:', order.length, 'active name:', order[currentIdx]?.character_name)

    // Guard: if no active entry found, forcibly activate the first alive combatant
    if (currentIdx < 0) {
      console.warn('[nextTurn] no active entry found — activating first combatant as fallback')
      await supabase.from('initiative_order').update(activateUpdate(order[0])).eq('id', order[0].id)
      await loadInitiative(id)
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Find next combatant who can act — skip dead, mortally wounded, and incapacitated.
    // Done BEFORE the new-round check so the skip walk's wrap-around is detectable:
    // if the active combatant isn't the last in the order but every remaining entry
    // in this round is dead (e.g. Jules kills the tail-end NPC), the walk wraps via
    // `%` onto a combatant who already acted. Without detecting that, we would
    // reactivate them mid-round with fresh actions. See `wrappedPastEnd` below.
    //
    // Performance note (playtest #32): NPC + PC state fetches are BATCHED
    // up front via two bulk queries instead of one `.maybeSingle()` per PC
    // inside the loop. Before this change, a campaign with several PCs and a
    // long skip chain triggered a sequential round trip for each PC — often
    // ~200-500ms of perceived delay between turns on ordinary latency.
    // Two parallel bulk queries is one network wait regardless of combatant
    // count.
    const pcCharIdsInInit = order.filter((e: any) => !e.is_npc && e.character_id).map((e: any) => e.character_id)
    const [{ data: freshNpcsForSkip }, { data: freshPcStatesForSkip }] = await Promise.all([
      supabase.from('campaign_npcs').select('*').eq('campaign_id', id),
      pcCharIdsInInit.length > 0
        ? supabase.from('character_states').select('character_id, wp_current, rp_current').eq('campaign_id', id).in('character_id', pcCharIdsInInit)
        : Promise.resolve({ data: [] as any[] }),
    ])
    const skipNpcMap = new Map<string, any>((freshNpcsForSkip ?? []).map((n: any) => [n.id, n]))
    const skipPcStateMap = new Map<string, any>((freshPcStatesForSkip ?? []).map((s: any) => [s.character_id, s]))
    let nextIdx = (currentIdx + 1) % order.length
    let wrappedPastEnd = false
    let attempts = 0
    while (attempts < order.length) {
      const nextEntry = order[nextIdx]
      let skipTurn = false
      // Skip anyone who has already acted this round (actions_remaining===0).
      // This is what makes multi-defer work: a combatant who deferred to the
      // tail of the sorted order still has actions_remaining>0, so the walk
      // stops on them instead of wrapping and firing a spurious new round.
      if ((nextEntry.actions_remaining ?? 0) <= 0) {
        skipTurn = true
      } else if (nextEntry.is_npc && nextEntry.npc_id) {
        const npc = skipNpcMap.get(nextEntry.npc_id)
        if (npc) {
          const npcWP = npc.wp_current ?? npc.wp_max ?? 10
          const npcRP = npc.rp_current ?? npc.rp_max ?? 6
          skipTurn = npcWP === 0 || npcRP === 0 || npc.status === 'dead'
        }
      } else if (nextEntry.character_id) {
        // Look up in the pre-batched PC state map (no per-iteration DB call).
        const freshPcState = skipPcStateMap.get(nextEntry.character_id)
        if (freshPcState) {
          skipTurn = freshPcState.wp_current === 0 || freshPcState.rp_current === 0
        }
      }
      if (!skipTurn) break
      const prev = nextIdx
      nextIdx = (nextIdx + 1) % order.length
      // If the increment crossed the end boundary, mark that we lapped around.
      if (nextIdx <= prev) wrappedPastEnd = true
      attempts++
    }

    // New round only when the skip-walk FULLY lapped without finding a
    // valid combatant — i.e. `attempts` hit `order.length`. The previous
    // `wrappedPastEnd` trigger also fired when the walk wrapped and THEN
    // found someone with actions left (common after a defer-to-tied-roll
    // or multi-defer), silently stranding that combatant's remaining
    // action into a new round. We only want new-round when nobody was
    // found — `wrappedPastEnd && attempts >= order.length` collapses to
    // `attempts >= order.length` since the walk can only run out of
    // attempts by wrapping. Using `attempts` directly reads cleaner.
    const everyoneSkipped = attempts >= order.length
    // Keep wrappedPastEnd referenced so the old comment context stays
    // anchored in diffs / git blame — cheap no-op.
    void wrappedPastEnd
    // Sprint-Athletics race: if the active combatant was the last one
    // to act AND they did so via Sprint's 2-action pre-consume, their
    // Athletics check is still outstanding (pending the dice roll in
    // the modal). Firing the new-round reroll NOW would put the
    // Initiative log ahead of the Sprint outcome in the feed — visible
    // to players as "new round started before I finished sprinting".
    // Defer: mark the pending-transition and return. The Sprint block
    // in executeRoll will re-invoke nextTurn after its log entry lands.
    if (everyoneSkipped && sprintAthleticsPendingRef.current) {
      console.warn('[nextTurn] new round deferred — Sprint Athletics roll still pending')
      sprintAthleticsRoundDeferredRef.current = true
      return
    }
    if (everyoneSkipped) {
      // Decrement death countdown + incapacitation + RP recovery
      for (const e of entries) {
        if (!e.liveState) continue
        const ls = e.liveState as any
        const updates: any = {}
        // Death countdown
        if (ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown > 0) {
          updates.death_countdown = ls.death_countdown - 1
          if (ls.death_countdown - 1 <= 0) {
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${e.character.name} has died.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
            })
          }
        }
        // Incapacitation countdown
        if (ls.incap_rounds != null && ls.incap_rounds > 0) {
          updates.incap_rounds = ls.incap_rounds - 1
          if (ls.incap_rounds - 1 <= 0) {
            // Regain consciousness: 1 RP, and 1 WP if was stabilized (WP=0).
            // Guard: do NOT bump WP if a death_countdown is still ticking —
            // that would silently un-mortal-wound a PC who happens to also
            // be incapacitated, no stabilize roll required (Warren bug
            // 2026-04-27).
            updates.rp_current = Math.max(1, ls.rp_current)
            const dcActive = (ls as any).death_countdown != null && (ls as any).death_countdown > 0
            if (ls.wp_current === 0 && !dcActive) updates.wp_current = 1
            updates.incap_rounds = null
          }
        }
        // RP recovery: conscious characters below max RP recover 1 per round
        if (ls.rp_current > 0 && ls.rp_current < e.liveState.rp_max && ls.wp_current > 0 && (ls.incap_rounds == null || ls.incap_rounds <= 0)) {
          updates.rp_current = Math.min(e.liveState.rp_max, (updates.rp_current ?? ls.rp_current) + 1)
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('character_states').update(updates).eq('id', e.stateId)
        }
      }

      // NPC death countdown + incapacitation + RP recovery (mirrors PC logic above)
      const combatNpcIds = order.filter((e: any) => e.npc_id).map((e: any) => e.npc_id)
      for (const npcId of combatNpcIds) {
        const npc = campaignNpcs.find((n: any) => n.id === npcId)
        if (!npc) continue
        const updates: any = {}
        // Death countdown
        if ((npc.wp_current ?? npc.wp_max ?? 10) === 0 && npc.death_countdown != null && npc.death_countdown > 0) {
          updates.death_countdown = npc.death_countdown - 1
          // NPC dies when countdown expires — mark status and log
          if (npc.death_countdown - 1 <= 0) {
            updates.status = 'dead'
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${npc.name} has died.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
            })
          }
        }
        // Incapacitation countdown
        if (npc.incap_rounds != null && npc.incap_rounds > 0) {
          updates.incap_rounds = npc.incap_rounds - 1
          if (npc.incap_rounds - 1 <= 0) {
            updates.rp_current = Math.max(1, npc.rp_current ?? 0)
            // Guard against silently un-mortal-wounding an NPC whose
            // death_countdown is still active — same Warren-bug fix as
            // the PC branch above.
            const npcDcActive = npc.death_countdown != null && npc.death_countdown > 0
            if ((npc.wp_current ?? 0) === 0 && !npcDcActive) updates.wp_current = 1
            updates.incap_rounds = null
          }
        }
        // RP recovery
        const npcWP = npc.wp_current ?? npc.wp_max ?? 10
        const npcRP = npc.rp_current ?? npc.rp_max ?? 6
        const npcRPMax = npc.rp_max ?? 6
        if (npcRP > 0 && npcRP < npcRPMax && npcWP > 0 && (npc.incap_rounds == null || npc.incap_rounds <= 0)) {
          updates.rp_current = Math.min(npcRPMax, (updates.rp_current ?? npcRP) + 1)
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('campaign_npcs').update(updates).eq('id', npcId)
          setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...updates } : n))
          setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...updates } : n))
        }
      }

      // Re-roll initiative for all combatants
      const rerollDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
      for (const entry of order) {
        const charEntry = entries.find((e: any) => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
        const rapid = charEntry?.character.data?.rapid ?? {}
        const acu = entry.is_npc ? (rosterNpcs.find(n => n.id === entry.npc_id)?.acumen ?? 0) : (rapid.ACU ?? 0)
        const dex = entry.is_npc ? (rosterNpcs.find(n => n.id === entry.npc_id)?.dexterity ?? 0) : (rapid.DEX ?? 0)
        const d1 = rollD6(), d2 = rollD6()
        const newRoll = d1 + d2 + acu + dex
        rerollDetails.push({ name: entry.character_name, d1, d2, acu, dex, drop: 0, total: newRoll, is_npc: !!entry.is_npc })
        // NOTE: `winded` is intentionally NOT reset here. A combatant who
        // failed their Sprint Athletics check in the previous round had
        // `winded: true` written to their row. Wiping it at new-round start
        // would erase the penalty before `activateUpdate` (which gives
        // winded combatants 1 action instead of 2) could read it. The flag
        // is cleared correctly inside `activateUpdate` when the combatant's
        // turn actually arrives.
        await supabase.from('initiative_order').update({ roll: newRoll, actions_remaining: 2, aim_bonus: 0, aim_active: false, defense_bonus: 0, has_cover: false, inspired_this_round: false, coordinate_target: null, coordinate_bonus: 0, is_active: false }).eq('id', entry.id)
      }

      setCombatRound(prev => prev + 1)
      // Log new round initiative
      const sortedReroll = [...rerollDetails].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      await supabase.from('roll_log').insert({
        campaign_id: id, user_id: userId, character_name: 'System', label: 'New Round — Initiative',
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'initiative',
        damage_json: { initiative: sortedReroll } as any,
      })

      // Re-sort and set first ALIVE combatant as active (PCs beat NPCs on ties)
      const { data: rerolled } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false }).order('character_name', { ascending: true })
      const { data: freshNpcsForRound } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
      const freshNpcMap = new Map<string, any>((freshNpcsForRound ?? []).map((n: any) => [n.id, n]))
      if (rerolled && rerolled.length > 0) {
        rerolled.sort((a: any, b: any) => b.roll - a.roll || (a.is_npc ? 1 : 0) - (b.is_npc ? 1 : 0) || String(a.character_name).localeCompare(String(b.character_name)))
        // Find first combatant who can act (skip dead/mortally wounded/incapacitated)
        const firstAlive = rerolled.find((e: any) => {
          if (e.is_npc && e.npc_id) {
            const npc = freshNpcMap.get(e.npc_id)
            if (npc) return (npc.wp_current ?? npc.wp_max ?? 10) > 0 && (npc.rp_current ?? npc.rp_max ?? 6) > 0 && npc.status !== 'dead'
          } else {
            const ce = entries.find((c: any) => e.character_id ? c.character.id === e.character_id : c.character.name === e.character_name)
            if (ce?.liveState) return (ce.liveState as any).wp_current > 0 && (ce.liveState as any).rp_current > 0
          }
          return true
        })
        if (firstAlive) {
          await supabase.from('initiative_order').update(activateUpdate(firstAlive)).eq('id', firstAlive.id)
        }
      }
      await Promise.all([loadInitiative(id), loadEntries(id), rollsFeed.refetch()])
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Deactivate current + activate next (nextIdx was computed above, before the
    // new-round check, so we can detect the skip-walk wrap cleanly).
    const currentEntry = order.find((e: any) => e.is_active)
    console.warn('[nextTurn] deactivating:', currentEntry?.character_name, '→ activating:', order[nextIdx]?.character_name)
    // Defense: if the skip-walk landed on the same combatant we're trying to
    // advance from (can happen if state is stale or every other combatant is
    // dead), don't no-op advance — trigger a new round instead. Prevents an
    // infinite "same combatant reactivates" loop.
    if (currentEntry && order[nextIdx] && currentEntry.id === order[nextIdx].id) {
      console.warn('[nextTurn] nextIdx resolves to self — no-op (finally will release lock)')
      return
    }
    // Deactivate every row currently flagged active EXCEPT the one we're
    // about to activate. Normally there's exactly one, but a race between
    // two clients (or a missed realtime broadcast) can leave two rows with
    // is_active=true, which then confuses findIndex and the turn walk.
    // Broad-clearing here is idempotent and self-healing.
    const { error: deactErr } = await supabase.from('initiative_order')
      .update({ is_active: false, actions_remaining: 0, aim_bonus: 0 })
      .eq('campaign_id', id)
      .eq('is_active', true)
      .neq('id', order[nextIdx].id)
    if (deactErr) console.warn('[nextTurn] bulk deactivate error:', deactErr.message)
    const { error: actErr } = await supabase.from('initiative_order').update(activateUpdate(order[nextIdx])).eq('id', order[nextIdx].id)
    if (actErr) console.warn('[nextTurn] activate error:', actErr.message)
    await Promise.all([loadInitiative(id), loadEntries(id)])
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
    } finally {
      nextTurnInFlightRef.current = false
    }
  }

  /** Append an entry to a character's progression_log jsonb. Read-modify-write
   *  pattern — matches the existing CDP-award and mortal-wound callers. Races
   *  between concurrent appends are rare (events are user-driven) and the
   *  worst outcome is one missed entry. Fire-and-forget; errors log to console. */
  async function appendProgressionLog(characterId: string, type: string, text: string) {
    try {
      const { data } = await supabase.from('characters').select('data').eq('id', characterId).single()
      const base: any = data?.data ?? {}
      const prev = Array.isArray(base.progression_log) ? base.progression_log : []
      const entry = { date: new Date().toISOString(), type, text }
      await supabase.from('characters').update({
        data: { ...base, progression_log: [entry, ...prev] },
      }).eq('id', characterId)
    } catch (err: any) {
      console.warn('[progression_log] append failed:', err?.message ?? err)
    }
  }

  async function consumeAction(entryId: string, actionLabel?: string, cost = 1) {
    // Per-entry re-entry guard. A rapid double-click on Aim (or any action
    // button) previously raced two consumeAction calls that both read
    // actions_remaining=2 before either wrote, then both wrote a
    // decrement — burning BOTH actions on a single click. The lock is
    // scoped per entryId so other combatants aren't blocked.
    if (consumeActionInFlightRef.current.has(entryId)) {
      console.warn('[consumeAction] already in flight for', entryId, '— ignoring duplicate call')
      return
    }
    consumeActionInFlightRef.current.add(entryId)
    try {
    // Re-fetch from DB to avoid stale state
    const { data: freshEntry, error: freshErr } = await supabase.from('initiative_order').select('*').eq('id', entryId).single()
    if (freshErr) console.warn('[consumeAction] fetch error:', freshErr.message)
    const entry = freshEntry ?? initiativeOrder.find(e => e.id === entryId)
    console.warn('[consumeAction] entryId:', entryId, 'entry:', entry, 'cost:', cost, 'label:', actionLabel)
    if (!entry) { console.warn('[consumeAction] no entry found, bailing'); return }
    if ((entry.actions_remaining ?? 0) < cost) { console.warn('[consumeAction] actions_remaining', entry.actions_remaining, '< cost', cost, '— bailing'); return }
    const newRemaining = (entry.actions_remaining ?? 0) - cost
    console.warn('[consumeAction] newRemaining:', newRemaining)

    // Log the action to game feed
    if (actionLabel) {
      const { error: actionLogErr } = await supabase.from('roll_log').insert({
        campaign_id: id,
        user_id: userId,
        character_name: entry.character_name,
        label: actionLabel,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: 'action',
      })
      if (actionLogErr) console.error('[consumeAction] action log insert error:', actionLogErr.message)
    }

    // Clear aim bonus after a roll (no actionLabel = called from closeRollModal).
    // Clear BOTH aim_bonus (the numeric +N CMod) and aim_active (the "Aimed —
    // Attack or lose it" badge). Previously only aim_bonus was cleared, so
    // the badge lingered after the attack even though the bonus was already
    // consumed — visually misleading.
    const clearAim = !actionLabel && entry.aim_bonus > 0

    // Always persist the new action count to DB first — if nextTurn fails or
    // races, the DB is at least consistent with "this combatant is spent".
    // `.select()` so a silent RLS rejection (0 rows affected, no error) is
    // distinguishable from a real update.
    const { error: updErr, data: updData } = await supabase.from('initiative_order')
      .update({ actions_remaining: newRemaining, ...(clearAim ? { aim_bonus: 0, aim_active: false } : {}) })
      .eq('id', entryId)
      .select('id, actions_remaining')
    console.warn('[consumeAction] update', { entryId, newRemaining, rowsAffected: updData?.length ?? 0, error: updErr?.message ?? 'none', returned: updData })
    if (updErr) console.warn('[consumeAction] update error:', updErr.message)
    if (!updErr && (!updData || updData.length === 0)) {
      console.warn('[consumeAction] SILENT RLS FAIL — 0 rows updated, no error. entryId:', entryId)
    }

    if (newRemaining <= 0) {
      console.warn('[consumeAction] newRemaining<=0 → calling nextTurn')
      await nextTurn()
      // Safety: ensure local state reflects the advance even if nextTurn's
      // internal loadInitiative raced with something else.
      await loadInitiative(id)
    } else {
      await loadInitiative(id)
    }
    } finally {
      consumeActionInFlightRef.current.delete(entryId)
    }
  }

  async function handleAim(entryId: string) {
    const entry = initiativeOrder.find(e => e.id === entryId)
    if (!entry || entry.actions_remaining <= 0) return
    const newAim = (entry.aim_bonus ?? 0) + 2
    await supabase.from('initiative_order').update({ aim_bonus: newAim, aim_active: true }).eq('id', entryId)
    await consumeAction(entryId, `${entry.character_name} — Aim (+${newAim} CMod). Must Attack next or Aim is lost.`)
  }

  // Activate a combatant — handles winded (1 action instead of 2)
  function activateUpdate(entry: InitiativeEntry) {
    const actions = entry.winded ? 1 : 2
    return { is_active: true, actions_remaining: actions, aim_bonus: 0, aim_active: false, defense_bonus: 0, has_cover: false, winded: false, last_attack_target: null, coordinate_target: entry.coordinate_target, coordinate_bonus: entry.coordinate_bonus }
  }

  // Clear aim if next action isn't Attack (called before non-attack actions)
  async function clearAimIfActive(entryId: string) {
    const entry = initiativeOrder.find(e => e.id === entryId)
    if (entry?.aim_active) {
      await supabase.from('initiative_order').update({ aim_bonus: 0, aim_active: false }).eq('id', entryId)
      setInitiativeOrder(prev => prev.map(e => e.id === entryId ? { ...e, aim_bonus: 0, aim_active: false } : e))
    }
  }

  async function handleReadyWeapon(entryId: string) {
    const entry = initiativeOrder.find(e => e.id === entryId)
    if (!entry) return
    // Check if combatant has a Tracking weapon
    const charEntry = entries.find(e => e.character.name === entry.character_name)
    const weaponData = charEntry?.character.data?.weaponPrimary ?? null
    const w = weaponData ? getWeaponByName(weaponData.weaponName) : null
    const hasTracking = w ? getTraitValue(w.traits, 'Tracking') !== null : false
    if (hasTracking) {
      const newAim = (entry.aim_bonus ?? 0) + 1
      await supabase.from('initiative_order').update({ aim_bonus: newAim }).eq('id', entryId)
      await consumeAction(entryId, `${entry.character_name} — Ready Weapon (Tracking +${newAim} CMod)`)
    } else {
      await consumeAction(entryId, `${entry.character_name} — Ready Weapon`)
    }
  }

  async function endCombat() {
    if (!isGM) return
    // Snapshot the combatants for the log entry before clearing initiative.
    const combatants = initiativeOrder.map(e => e.character_name)
    const { error: endLogErr } = await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended',
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
      outcome: 'combat_end',
      damage_json: { combatants } as any,
    })
    if (endLogErr) console.error('[endCombat] roll_log insert error:', endLogErr.message)
    // Stress for mortal/incap is now applied on-entry to those states (see
    // the damage paths in executeRoll + handleInsightSave). The old combat-end
    // sweep was a workaround for the absence of on-entry stress; removing
    // it avoids double-stressing anyone who entered mortal mid-combat.
    await supabase.from('initiative_order').delete().eq('campaign_id', id)
    setInitiativeOrder([])
    setCombatActive(false)
    setViewingNpcs([])
    // Stay on tactical map after combat ends
    setShowTacticalMap(true)
    await rollsFeed.refetch()
    await loadEntries(id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'combat_ended', payload: {} })
  }

  async function addNPC() {
    if (!isGM || !npcName.trim()) return
    const roll = rollD6() + rollD6()
    await supabase.from('initiative_order').insert({
      campaign_id: id,
      character_name: npcName.trim(),
      character_id: null,
      user_id: null,
      roll,
      is_active: false,
      is_npc: true,
      actions_remaining: 2,
    })
    setNpcName('')
    setShowAddNPC(false)
    await loadInitiative(id)
  }

  // Add a PC to the initiative mid-combat (playtest #23). Used when a player
  // joins the table after combat started and needs to be slotted in. Rolls
  // their initiative with ACU+DEX modifiers same as combat-start, inserts
  // an initiative_order row, broadcasts turn_changed so every client sees
  // them on the bar. The PC is inactive by default — GM advances to them
  // when their turn comes up in sort order.
  async function addPCToCombat(charEntry: TableEntry) {
    if (!isGM) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const acu = rapid.ACU ?? 0
    const dex = rapid.DEX ?? 0
    const roll = rollD6() + rollD6() + acu + dex
    await supabase.from('initiative_order').insert({
      campaign_id: id,
      character_name: charEntry.character.name,
      character_id: charEntry.character.id,
      user_id: charEntry.userId,
      roll,
      is_active: false,
      is_npc: false,
      actions_remaining: 2,
    })
    setShowAddPC(false)
    await loadInitiative(id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  async function refreshMapTokenIds() {
    const { data: activeScene } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id).eq('is_active', true).single()
    if (!activeScene) return
    // Only count tokens that are actually ON the map. Archived (soft-
    // deleted) rows preserve position for a future remap but shouldn't
    // make the folder button read UNMAP.
    const { data: tokens } = await supabase.from('scene_tokens').select('npc_id').eq('scene_id', activeScene.id).not('npc_id', 'is', null).is('archived_at', null)
    setMapTokenNpcIds(new Set((tokens ?? []).map((t: any) => t.npc_id)))
  }

  async function removeTokenFromMap(name: string) {
    const { data: activeScene } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id).eq('is_active', true).single()
    if (!activeScene) return
    // Soft-delete (stamp archived_at) instead of hard-delete so the
    // token's grid_x / grid_y / scale / rotation persist for the next
    // SHOW. Hard-delete loses position and the token reappears at
    // (0,0) — what the playtest hit. Mirrors the pattern already used
    // by unmapFolderFromMap.
    await supabase.from('scene_tokens')
      .update({ archived_at: new Date().toISOString() })
      .eq('scene_id', activeScene.id)
      .eq('name', name)
      .is('archived_at', null)
    setTokenRefreshKey(k => k + 1)
    await refreshMapTokenIds()
    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
  }

  // Bulk-place a folder of NPCs onto the active scene in a tidy NxN
  // cluster anchored at top-left. Skips NPCs that already have a token
  // so it's safe to click after partial placement. Single broadcast at
  // the end so all clients refetch once instead of N times.
  async function placeFolderOnMap(npcsToPlace: { id: string; name: string; portrait_url?: string | null; disposition?: string | null; npc_type?: string | null }[]) {
    if (npcsToPlace.length === 0) { alert('No NPCs to place.'); return }
    const { data: activeScene, error: sceneErr } = await supabase.from('tactical_scenes').select('id, grid_cols').eq('campaign_id', id).eq('is_active', true).single()
    if (sceneErr || !activeScene) {
      alert('No active tactical scene. Open the Tactical Map and create or activate a scene first.')
      return
    }
    // Three groups now exist for each NPC in the folder:
    //   1. Live token (archived_at IS NULL) — already on map; skip.
    //   2. Archived token (archived_at NOT NULL) — un-archive in place
    //      to restore the GM's previous positioning.
    //   3. No token at all — insert fresh at cluster position.
    const npcIds = npcsToPlace.map(n => n.id)
    const { data: existing, error: existingErr } = await supabase
      .from('scene_tokens')
      .select('id, npc_id, archived_at')
      .eq('scene_id', activeScene.id)
      .in('npc_id', npcIds)
    if (existingErr) {
      console.error('[placeFolderOnMap] select error:', existingErr.message)
      // If the archived_at column doesn't exist yet, the SELECT fails
      // with a "column does not exist" message. Surface that clearly so
      // the GM knows to run the migration instead of seeing nothing.
      if (existingErr.message?.toLowerCase().includes('archived_at') || existingErr.code === '42703') {
        alert('Database is missing the archived_at column. Run sql/scene-tokens-archived-at.sql in Supabase, then hard-refresh.')
      } else {
        alert('Failed to look up existing tokens: ' + existingErr.message)
      }
      return
    }
    const live = new Set<string>(((existing ?? []) as any[]).filter(r => !r.archived_at).map(r => r.npc_id))
    const archivedByNpc = new Map<string, string>()
    for (const r of (existing ?? []) as any[]) {
      if (r.archived_at) archivedByNpc.set(r.npc_id, r.id)
    }
    const fresh = npcsToPlace.filter(n => !live.has(n.id) && !archivedByNpc.has(n.id))

    // 2. Un-archive (restore position) for everyone who has a soft-
    //    deleted row in this scene.
    const archivedIds = Array.from(archivedByNpc.values())
    if (archivedIds.length > 0) {
      const { error: unErr } = await supabase
        .from('scene_tokens')
        .update({ archived_at: null })
        .in('id', archivedIds)
      if (unErr) { console.error('[placeFolderOnMap] unarchive error:', unErr.message); alert('Failed to restore tokens: ' + unErr.message); return }
    }

    // Nothing left to insert (everything was either live already or
    // restored from archive)? Done — no top-left cluster needed.
    if (fresh.length === 0) {
      setTokenRefreshKey(k => k + 1)
      await refreshMapTokenIds()
      initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
      if (archivedIds.length > 0 && !showTacticalMap) {
        alert(`Restored ${archivedIds.length} token${archivedIds.length === 1 ? '' : 's'} to their previous positions.`)
      }
      return
    }
    // Scan the active scene for unoccupied cells so fresh tokens don't
    // pile on top of tokens already placed there (e.g. Frank/Hayden at
    // 0,0 from another folder). Walk the grid row-by-row from top-left
    // and pick the first N empty cells. Includes archived rows in the
    // occupancy check so a future un-archive doesn't snap an old token
    // back to a now-occupied spot.
    const { data: occTokens } = await supabase
      .from('scene_tokens')
      .select('grid_x, grid_y, grid_w, grid_h')
      .eq('scene_id', activeScene.id)
    const occupied = new Set<string>()
    for (const t of ((occTokens ?? []) as any[])) {
      const w = Math.max(1, t.grid_w ?? 1)
      const h = Math.max(1, t.grid_h ?? 1)
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          occupied.add(`${t.grid_x + dx},${t.grid_y + dy}`)
        }
      }
    }
    const sceneCols = Math.max(1, (activeScene as any).grid_cols ?? 30)
    const positions: { x: number; y: number }[] = []
    for (let i = 0; positions.length < fresh.length && i < sceneCols * 200; i++) {
      const x = i % sceneCols
      const y = Math.floor(i / sceneCols)
      const key = `${x},${y}`
      if (!occupied.has(key)) {
        positions.push({ x, y })
        occupied.add(key)
      }
    }
    const rows = fresh.map((n, i) => ({
      scene_id: activeScene.id,
      name: n.name,
      token_type: 'npc' as const,
      character_id: null,
      npc_id: n.id,
      portrait_url: n.portrait_url ?? null,
      grid_x: positions[i]?.x ?? 0,
      grid_y: positions[i]?.y ?? 0,
      // Placed-but-hidden by default if the NPC isn't yet revealed in the
      // roster. Matches the prep workflow: GM places the gang invisibly,
      // clicks Show on the folder when the time is right.
      is_visible: revealedNpcIds.has(n.id),
      // Token ring color follows the NPC's disposition; falls back to
      // npc_type when disposition is unset (so legacy Foe/Goon NPCs
      // stay red instead of regressing to neutral gray).
      color: getNpcTokenBorderColor({ disposition: n.disposition, npc_type: n.npc_type }),
    }))
    const { error } = await supabase.from('scene_tokens').insert(rows)
    if (error) { console.error('[placeFolderOnMap] error:', error.message); alert('Failed to place tokens: ' + error.message); return }
    console.log('[placeFolderOnMap] inserted', rows.length, 'tokens')
    setTokenRefreshKey(k => k + 1)
    await refreshMapTokenIds()
    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
    // If the GM doesn't have the tactical map view open, they'd get no
    // visual confirmation that the placement worked. Surface a brief
    // alert so the click never feels silent.
    if (!showTacticalMap) {
      alert(`Placed ${rows.length} token${rows.length === 1 ? '' : 's'} on the active scene. Open the Tactical Map to see them.`)
    }
  }

  // Bulk-remove every token for the given NPC ids from the active scene.
  // Mirrors placeFolderOnMap so the per-folder Map/Unmap toggle is
  // perfectly symmetric. Single broadcast at the end.
  async function unmapFolderFromMap(npcsToRemove: { id: string }[]) {
    if (npcsToRemove.length === 0) return
    const { data: activeScene, error: sceneErr } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id).eq('is_active', true).single()
    if (sceneErr || !activeScene) { alert('No active tactical scene.'); return }
    const npcIds = npcsToRemove.map(n => n.id)
    // Soft-delete: stamp archived_at = now() on the live tokens. This
    // preserves grid_x / grid_y / scale / rotation / grid_w / grid_h
    // so a subsequent Map click can un-archive the row and put each
    // token back exactly where the GM had it. Filter on archived_at
    // IS NULL so we don't keep poking already-archived rows.
    const { error } = await supabase
      .from('scene_tokens')
      .update({ archived_at: new Date().toISOString() })
      .eq('scene_id', activeScene.id)
      .in('npc_id', npcIds)
      .is('archived_at', null)
    if (error) {
      console.error('[unmapFolder] error:', error.message)
      if (error.message?.toLowerCase().includes('archived_at') || error.code === '42703') {
        alert('Database is missing the archived_at column. Run sql/scene-tokens-archived-at.sql in Supabase, then hard-refresh.')
      } else {
        alert('Failed to unmap: ' + error.message)
      }
      return
    }
    setTokenRefreshKey(k => k + 1)
    await refreshMapTokenIds()
    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
  }

  async function placeTokenOnMap(name: string, type: 'pc' | 'npc', characterId?: string, npcId?: string, portraitUrl?: string) {
    const { data: activeScene } = await supabase.from('tactical_scenes').select('id, grid_cols').eq('campaign_id', id).eq('is_active', true).single()
    if (!activeScene) { alert('No active tactical scene. Create a scene first.'); return }
    // Three-way toggle: live → archive (off-map, position preserved);
    // archived → un-archive (back on map at original cell);
    // no row → insert fresh at (0,0). Hard-delete used to be the off
    // path here, which wiped grid_x/y so the token came back at
    // top-left after re-placement. Mirrors placeFolderOnMap.
    const { data: existing } = await supabase
      .from('scene_tokens')
      .select('id, archived_at')
      .eq('scene_id', activeScene.id)
      .eq('name', name)
      .limit(1)
    if (existing && existing.length > 0) {
      const row = existing[0] as { id: string; archived_at: string | null }
      if (row.archived_at) {
        // Archived → un-archive in place to restore the GM's prior position.
        await supabase.from('scene_tokens')
          .update({ archived_at: null })
          .eq('id', row.id)
      } else {
        // Live → archive (off-map) but keep grid_x/y for the next show.
        await supabase.from('scene_tokens')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', row.id)
      }
      setTokenRefreshKey(k => k + 1)
      await refreshMapTokenIds()
      initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
      return
    }
    // Token ring color: PCs get the standard blue; NPCs use their
    // disposition (friendly → green, hostile → red), falling back to
    // npc_type when disposition is unset (foe/goon/antagonist → red,
    // bystander → green) so legacy NPCs without an explicit disposition
    // don't all regress to neutral gray.
    const npcRow = npcId ? campaignNpcs.find(n => n.id === npcId) : null
    const tokenColor = type === 'pc'
      ? '#7ab3d4'
      : getNpcTokenBorderColor({ disposition: npcRow?.disposition, npc_type: (npcRow as any)?.npc_type })
    // Place at top-left of the grid
    const { error: tokenErr } = await supabase.from('scene_tokens').insert({
      scene_id: activeScene.id,
      name,
      token_type: type,
      character_id: characterId || null,
      npc_id: npcId || null,
      portrait_url: portraitUrl || null,
      grid_x: 0,
      grid_y: 0,
      is_visible: type === 'pc' || (npcId ? revealedNpcIds.has(npcId) : true),
      color: tokenColor,
    })
    if (tokenErr) { console.error('[placeToken] error:', tokenErr.message); alert('Failed to place token: ' + tokenErr.message); return }
    setTokenRefreshKey(k => k + 1)
    await refreshMapTokenIds()
    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
  }

  async function addNpcsToCombat(npcsToAdd: any[]) {
    const rows = npcsToAdd.map(n => ({
      campaign_id: id,
      character_name: n.name,
      character_id: null,
      user_id: null,
      npc_id: n.id,
      portrait_url: n.portrait_url,
      npc_type: n.npc_type,
      roll: rollD6() + rollD6() + (n.acumen ?? 0) + (n.dexterity ?? 0),
      is_active: false,
      is_npc: true,
      actions_remaining: 2,
    }))
    if (rows.length > 0) {
      await supabase.from('initiative_order').insert(rows)
      await loadInitiative(id)
      // Open NPC cards in the center for the newly added NPCs (skip if tactical map showing)
      if (!showTacticalMap && !combatActive) {
        setViewingNpcs(prev => {
          const existingIds = new Set(prev.map(n => n.id))
          const newCards = npcsToAdd.filter(n => !existingIds.has(n.id))
          return newCards.length > 0 ? [...prev, ...newCards as CampaignNpc[]] : prev
        })
      }
    }

    // If combat is already underway, offer to reveal the newly-added NPC(s) to
    // the players so they appear in the player-side NPC window. Mirrors the
    // reveal logic in NpcRoster.revealAllNpcs: one npc_relationships row per
    // (npc × pc) with revealed=true, reveal_level='name_portrait'. The realtime
    // subscription on npc_relationships (see loadRevealedNpcs channel above)
    // auto-refreshes player views when these rows land.
    if (!combatActive || npcsToAdd.length === 0) return
    const pcCharIds = entries
      .filter(e => e.character?.id && e.userId !== campaign?.gm_user_id)
      .map(e => e.character.id)
    if (pcCharIds.length === 0) return

    const npcIds = npcsToAdd.map(n => n.id)
    const { data: existingRels } = await supabase
      .from('npc_relationships')
      .select('id, npc_id, character_id, revealed')
      .in('npc_id', npcIds)

    // If every added NPC is already fully revealed to every PC, skip the prompt.
    const allFullyRevealed = npcIds.every(nid =>
      pcCharIds.every(pcId => (existingRels ?? []).some((r: any) =>
        r.npc_id === nid && r.character_id === pcId && r.revealed))
    )
    if (allFullyRevealed) return

    const label = npcsToAdd.length === 1 ? npcsToAdd[0].name : `${npcsToAdd.length} NPCs`
    if (!confirm(`Show ${label} to the players?`)) return

    const existing = existingRels ?? []
    const seen = new Set<string>(existing.map((r: any) => `${r.npc_id}|${r.character_id}`))
    const updateIds = existing.map((r: any) => r.id)
    const inserts: any[] = []
    for (const npc of npcsToAdd) {
      for (const pcId of pcCharIds) {
        if (!seen.has(`${npc.id}|${pcId}`)) {
          inserts.push({
            npc_id: npc.id,
            character_id: pcId,
            relationship_cmod: 0,
            revealed: true,
            reveal_level: 'name_portrait',
          })
        }
      }
    }
    if (updateIds.length > 0) {
      await supabase.from('npc_relationships')
        .update({ revealed: true, reveal_level: 'name_portrait' })
        .in('id', updateIds)
    }
    if (inserts.length > 0) {
      await supabase.from('npc_relationships').insert(inserts)
    }
    // Nudge the player clients to refetch — their postgres_changes subscription
    // on npc_relationships doesn't reliably fire (see handler in initChannelRef
    // setup). Broadcast bypasses RLS/publication and always lands.
    initChannelRef.current?.send({ type: 'broadcast', event: 'npcs_revealed', payload: {} })
  }

  async function removeFromInitiative(entryId: string) {
    if (!isGM) return
    await supabase.from('initiative_order').delete().eq('id', entryId)
    await loadInitiative(id)
  }

  async function deferInitiative(entryId: string) {
    const idx = initiativeOrder.findIndex(e => e.id === entryId)
    if (idx < 0 || idx >= initiativeOrder.length - 1) return
    const current = initiativeOrder[idx]
    const next = initiativeOrder[idx + 1]
    const wasActive = !!current.is_active
    // Figure out the new roll values. Plain swap is correct when rolls
    // differ, but if current.roll === next.roll (tied to begin with),
    // the swap is numerically a no-op and the character_name tiebreaker
    // would keep the deferrer AHEAD of the target in the sort order.
    // Decrement current's new roll by 1 in that case so the deferrer
    // sorts strictly AFTER the target. If that would then tie with yet
    // another combatant, decrement again (cascaded chains are rare but
    // cheap to handle defensively).
    let newCurrentRoll = next.roll
    const newNextRoll = current.roll
    if (newCurrentRoll === newNextRoll) {
      newCurrentRoll = Math.max(0, newNextRoll - 1)
      while (initiativeOrder.some(e => e.id !== current.id && e.id !== next.id && e.roll === newCurrentRoll) && newCurrentRoll > 0) {
        newCurrentRoll -= 1
      }
    }
    // Optimistic local swap — the initiative bar repaints instantly instead
    // of waiting for the DB round-trip + realtime fanout. Without this, a
    // slow network makes defer feel broken (the icon stays put for seconds).
    const activation = activateUpdate(next)
    setInitiativeOrder(prev => prev.map(e => {
      if (e.id === current.id) return { ...e, roll: newCurrentRoll, ...(wasActive ? { is_active: false, actions_remaining: current.actions_remaining ?? 2, aim_bonus: 0 } : {}) }
      if (e.id === next.id) return { ...e, roll: newNextRoll, ...(wasActive ? activation : {}) }
      return e
    }).sort((a, b) => b.roll - a.roll || a.character_name.localeCompare(b.character_name)))
    // Persist the new roll values to the DB — playtest #7 fix: direct
    // value writes avoid manufacturing collisions with other combatants.
    const updates: Promise<any>[] = [
      supabase.from('initiative_order').update({ roll: newCurrentRoll }).eq('id', current.id),
      supabase.from('initiative_order').update({ roll: newNextRoll }).eq('id', next.id),
    ]
    if (wasActive) {
      updates.push(
        supabase.from('initiative_order').update({ is_active: false, actions_remaining: current.actions_remaining ?? 2, aim_bonus: 0 }).eq('id', current.id),
        supabase.from('initiative_order').update(activation).eq('id', next.id),
      )
    }
    await Promise.all(updates)
    // Log the defer so the table feed reflects player intent.
    await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: 'System',
      label: `↓ ${current.character_name} deferred their turn to after ${next.character_name}`,
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'defer',
    })
    await Promise.all([loadInitiative(id), rollsFeed.refetch()])
    // Always broadcast so other clients refresh whether or not the deferrer
    // was active — previously non-active defers silently stranded other
    // viewers on the old order.
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  // ── Session functions ──

  async function startSession() {
    if (!isGM) return
    // UI updates instantly; DB writes fire in the background (mirrors endSession).
    const newCount = sessionCount + 1
    const startedAt = new Date().toISOString()
    rollsFeed.clear()
    chat.clear()
    setSessionStatus('active')
    setSessionCount(newCount)
    logEvent('session_started', { campaign_id: id, session_number: newCount })
    console.warn('[startSession] kick-preserve build — kicks persist across sessions')
    // Fire all four DB calls in parallel — none depend on each other.
    // Log delete errors explicitly so we notice if RLS silently blocks a cleanup.
    void Promise.all([
      supabase.from('campaigns').update({
        session_status: 'active',
        session_count: newCount,
        session_started_at: startedAt,
      }).eq('id', id),
      supabase.from('sessions').insert({
        campaign_id: id,
        session_number: newCount,
        started_at: startedAt,
      }),
      supabase.from('roll_log').delete().eq('campaign_id', id).then(({ error }: any) => {
        if (error) console.warn('[startSession] roll_log delete failed:', error.message)
      }),
      supabase.from('chat_messages').delete().eq('campaign_id', id).then(({ error }: any) => {
        if (error) console.warn('[startSession] chat_messages delete failed:', error.message)
      }),
      // NOTE: no mass kicked=false reset — kick persists across sessions.
      // Kicked players must manually Rejoin from the story overview page.
    ]).catch(err => console.error('[startSession] background error:', err))
    // Broadcast to every client so local chat/log state is force-cleared even
    // if a DELETE realtime event gets dropped or RLS blocks the write.
    initChannelRef.current?.send({ type: 'broadcast', event: 'logs_cleared', payload: {} })
    // Progression log: session-start marker on every PC's log.
    for (const e of entries) {
      if (e.character?.id) void appendProgressionLog(e.character.id, 'session', `Session ${newCount} began`)
    }
  }

  async function endSession() {
    if (!isGM) return
    // Close modal & update local state instantly
    setShowEndSessionModal(false)
    setSessionActing(true)
    if (combatActive) {
      setInitiativeOrder([])
      setCombatActive(false)
      initChannelRef.current?.send({ type: 'broadcast', event: 'combat_ended', payload: {} })
    }
    rollsFeed.clear()
    chat.clear()
    setSessionStatus('idle')
    // Force-clear every other client's chat + log state immediately.
    initChannelRef.current?.send({ type: 'broadcast', event: 'logs_cleared', payload: {} })
    const endedCount = sessionCount
    setSessionSummary('')
    setNextSessionNotes('')
    setSessionCliffhanger('')
    const filesToUpload = [...sessionFiles]
    setSessionFiles([])
    setSessionActing(false)
    logEvent('session_ended', { campaign_id: id, session_number: endedCount })
    // Progression log: session-end marker on every PC's log.
    for (const e of entries) {
      if (e.character?.id) void appendProgressionLog(e.character.id, 'session', `Session ${endedCount} ended`)
    }

    // Fire all DB work in the background — UI is already updated
    const now = new Date().toISOString()
    const bgWork = async () => {
      try {
        await Promise.all([
          supabase.from('campaigns').update({ session_status: 'idle', session_started_at: null }).eq('id', id),
          supabase.from('roll_log').delete().eq('campaign_id', id).then(({ error }: any) => {
            if (error) console.warn('[endSession] roll_log delete failed:', error.message)
          }),
          supabase.from('chat_messages').delete().eq('campaign_id', id).then(({ error }: any) => {
            if (error) console.warn('[endSession] chat_messages delete failed:', error.message)
          }),
          combatActive ? Promise.all([
            supabase.from('roll_log').insert({ campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended', die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'action' }),
            supabase.from('initiative_order').delete().eq('campaign_id', id),
          ]) : Promise.resolve(),
        ])

        const { data: sessionRow } = await supabase.from('sessions')
          .select('id')
          .eq('campaign_id', id).eq('session_number', endedCount).is('ended_at', null)
          .single()

        if (sessionRow) {
          await supabase.from('sessions').update({
            ended_at: now,
            gm_summary: sessionSummary.trim() || null,
            next_session_notes: nextSessionNotes.trim() || null,
            cliffhanger: sessionCliffhanger.trim() || null,
          }).eq('id', sessionRow.id)

          if (filesToUpload.length > 0 && userId) {
            for (const file of filesToUpload) {
              const path = `${sessionRow.id}/${file.name}`
              const { error: upErr } = await supabase.storage.from('session-attachments').upload(path, file)
              if (!upErr) {
                const { data: urlData } = supabase.storage.from('session-attachments').getPublicUrl(path)
                await supabase.from('session_attachments').insert({
                  session_id: sessionRow.id,
                  file_url: urlData.publicUrl,
                  file_name: file.name,
                  file_type: file.type,
                  uploaded_by: userId,
                })
              }
            }
          }
        }
      } catch (err) {
        console.error('[EndSession] background save error:', err)
      }
    }
    bgWork()
  }

  // ── Roll functions ──

  const [preRollInsight, setPreRollInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  const [useBurst, setUseBurst] = useState(false)
  const [rangeBand, setRangeBand] = useState<'engaged' | 'close' | 'medium' | 'long' | 'distant'>('medium')
  const [socialTarget, setSocialTarget] = useState<{ action: string } | null>(null)
  const [socialNpcId, setSocialNpcId] = useState<string>('')
  const [socialCmod, setSocialCmod] = useState<{ npcName: string; cmod: number } | null>(null)
  const [campaignNpcs, setCampaignNpcs] = useState<any[]>([])
  const [revealedNpcs, setRevealedNpcs] = useState<any[]>([])
  const revealedNpcIds = useMemo(() => new Set<string>(revealedNpcs.map((n: any) => n.id)), [revealedNpcs])
  // Player-side NPC folder expand state. Mirrors the GM's NpcRoster
  // folder grouping so players see the same organization the GM set up.
  // localStorage-backed per (campaign, user) so each player can have
  // their own collapse state without stepping on others. Defaults to
  // everything OPEN on first load so players see their NPCs up-front.
  const [playerFolderOpen, setPlayerFolderOpen] = useState<Set<string>>(new Set())
  const playerFolderStateLoadedRef = useRef(false)
  useEffect(() => {
    // Load once per campaign mount. Guarded by the ref so the load
    // doesn't clobber in-flight toggles from a later re-render.
    if (playerFolderStateLoadedRef.current || !id) return
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(`npc_player_folders_${id}`)
      if (saved) setPlayerFolderOpen(new Set(JSON.parse(saved)))
    } catch { /* ignore quota / parse errors */ }
    playerFolderStateLoadedRef.current = true
  }, [id])
  function togglePlayerFolder(name: string) {
    setPlayerFolderOpen(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(`npc_player_folders_${id}`, JSON.stringify([...next])) } catch {}
      }
      return next
    })
  }
  const [focusPin, setFocusPin] = useState<{ id: string; lat: number; lng: number } | null>(null)

  // Re-sync any open NpcCards (centered "viewing" cards) whenever the underlying
  // campaignNpcs list refreshes from realtime — without this, an open card keeps
  // showing the snapshot HP from when it was first opened, even after damage lands.
  useEffect(() => {
    if (campaignNpcs.length === 0) return
    setViewingNpcs(prev => {
      if (prev.length === 0) return prev
      let changed = false
      const next = prev.map(vn => {
        const fresh = campaignNpcs.find((c: any) => c.id === vn.id)
        if (fresh && fresh !== vn) { changed = true; return fresh as CampaignNpc }
        return vn
      })
      return changed ? next : prev
    })
  }, [campaignNpcs])

  async function handlePublishNpc(npc: CampaignNpc) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('world_npcs').insert({
      source_campaign_npc_id: npc.id,
      created_by: user.id,
      name: npc.name,
      portrait_url: npc.portrait_url,
      reason: npc.reason, acumen: npc.acumen, physicality: npc.physicality,
      influence: npc.influence, dexterity: npc.dexterity,
      skills: npc.skills,
      notes: npc.notes,
      npc_type: npc.npc_type,
      status: 'pending',
    })
    if (error) { alert(`Publish failed: ${error.message}`); return }
    setPublishedNpcIds(prev => new Set([...prev, npc.id]))
  }

  // Special check handlers
  function triggerPerceptionCheck(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const perMod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
    handleRollRequest(`${characterName} — Perception Check`, perMod, 0)
    setShowSpecialCheck(null)
  }

  function triggerGutInstinct(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const perMod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
    // Can substitute Psychology, Streetwise, or Tactics
    const skills = charEntry.character.data?.skills ?? []
    const subSkills = ['Psychology', 'Streetwise', 'Tactics']
    const bestSub = skills.filter((s: any) => subSkills.includes(s.skillName)).sort((a: any, b: any) => b.level - a.level)[0]
    const smod = bestSub?.level ?? 0
    handleRollRequest(`${characterName} — Gut Instinct`, perMod, smod)
    setShowSpecialCheck(null)
  }

  // First Impression — rolled by a PC against a specific NPC. On outcome,
  // writes `npc_relationships.relationship_cmod` so future Recruitment
  // Checks (and other social interactions) have the right CMod baked in.
  // See SRD §02 First Impressions + §08 Communities Recruitment Check.
  function triggerFirstImpression(characterName: string, npcId: string, npcName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const infMod = rapid.INF ?? 0
    const skills = charEntry.character.data?.skills ?? []
    const socialSkills = ['Manipulation', 'Streetwise', 'Psychology']
    const bestSkill = skills.filter((s: any) => socialSkills.includes(s.skillName)).sort((a: any, b: any) => b.level - a.level)[0]
    const smod = bestSkill?.level ?? 0
    // Stash the NPC target so executeRoll can write the relationship
    // CMod when the outcome lands. Ref not state — executeRoll runs
    // inside a state update chain and would miss a re-render.
    firstImpressionTargetRef.current = { characterId: charEntry.character.id, npcId, npcName }
    handleRollRequest(`${characterName} — First Impression (${npcName})`, infMod, smod)
    setShowSpecialCheck(null)
  }

  // ── Recruitment Check (Communities Phase B) ─────────────────────────
  // Flow: openRecruitModal() preps state + loads dependencies, then the
  // inline modal walks the player through pick → roll → result.
  // executeRecruitRoll() resolves the roll inside the modal (not via the
  // standard handleRollRequest/executeRoll path — Recruitment is out-
  // of-combat, has its own CMod stack and custom outcome application).
  // ── Quick Add helpers (state + entry points only; forms live inside
  //    the <QuickAddModal> component) ─────────────────────────────────
  function openQuickAddPin(lat: number, lng: number) {
    setQaPinLat(lat.toFixed(6))
    setQaPinLng(lng.toFixed(6))
    setQaHideCommunity(true)
    setShowQuickAdd(true)
  }
  function openQuickAddFull() {
    setQaHideCommunity(false)
    setShowQuickAdd(true)
  }
  function closeQuickAdd() {
    setShowQuickAdd(false)
  }

  async function openRecruitModal(preselectedNpcId?: string) {
    // Roller defaults to the current user's PC. GMs get the roller
    // picker because they may be orchestrating on behalf of the player
    // at the table. Player default = their own PC; if they have multiple
    // they pick in the modal (edge case: GM running multiple PCs).
    //
    // `preselectedNpcId` lets callers (e.g. the Recruit button on the
    // player-facing NPC card) open the modal with the target already
    // picked, skipping the NPC dropdown step.
    const myEntry = entries.find(e => e.userId === userId)
    setRecruitRollerId(myEntry?.character.id ?? '')
    setRecruitNpcId(preselectedNpcId ?? '')
    setRecruitCommunityId('')
    setRecruitNewCommunityName('')
    setRecruitNewCommunityPublic(false)
    setRecruitApproach('cohort')
    setRecruitSkill('')
    setRecruitGmCmod(0)
    setRecruitApprenticeToggle(false)
    setRecruitPreInsight('none')
    setRecruitResult(null)
    setRecruitStep('pick')
    // Load this campaign's communities (pick/auto/empty state), NPC
    // memberships (for poaching detection), and each PC's current
    // Apprentice (for 1-per-PC enforcement). Parallel.
    const [{ data: comms }, { data: memberships }] = await Promise.all([
      supabase.from('communities').select('id, name').eq('campaign_id', id).order('created_at', { ascending: true }),
      supabase.from('community_members')
        .select('id, community_id, npc_id, character_id, recruitment_type, apprentice_of_character_id, communities!inner(name)')
        .is('left_at', null)
        .eq('communities.campaign_id', id),
    ])
    const commRows = (comms ?? []) as { id: string; name: string }[]
    const mems = (memberships ?? []) as any[]
    const byCommId: Record<string, number> = {}
    const nextNpcMap: Record<string, { id: string; name: string; recruitment_type: string }> = {}
    const nextApprenticeMap: Record<string, { id: string; npcName: string }> = {}
    for (const m of mems) {
      if (m.community_id) byCommId[m.community_id] = (byCommId[m.community_id] ?? 0) + 1
      if (m.npc_id) {
        const npcName = campaignNpcs.find((n: any) => n.id === m.npc_id)?.name ?? '?'
        nextNpcMap[m.npc_id] = { id: m.community_id, name: m.communities?.name ?? '?', recruitment_type: m.recruitment_type }
        if (m.recruitment_type === 'apprentice' && m.apprentice_of_character_id) {
          nextApprenticeMap[m.apprentice_of_character_id] = { id: m.id, npcName }
        }
      }
    }
    setRecruitCommunityList(commRows.map(c => ({ ...c, member_count: byCommId[c.id] ?? 0 })))
    setNpcCommunityMap(nextNpcMap)
    setApprenticeByCharacter(nextApprenticeMap)
    // Auto-pick community if exactly one exists, else blank (user picks
    // or starts the "Found a new community" branch).
    if (commRows.length === 1) setRecruitCommunityId(commRows[0].id)
    setShowRecruit(true)
  }

  // Eligible-target NPCs for Recruitment: alive + either on the active
  // tactical map OR revealed to any PC. Same rule as First Impression.
  function getRecruitEligibleNpcs(): any[] {
    const byId = new Map<string, any>()
    for (const n of revealedNpcs) byId.set(n.id, n)
    for (const t of mapTokens) {
      if (t.token_type === 'object' || !t.npc_id || byId.has(t.npc_id)) continue
      const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
      if (npc) byId.set(npc.id, npc)
    }
    return [...byId.values()].filter((n: any) => {
      const wp = n.wp_current ?? n.wp_max ?? 10
      return wp > 0 && n.status !== 'dead'
    }).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
  }

  // Skill auto-suggest per approach. Fallback social skills for free-pick.
  function suggestedSkillsForApproach(ap: RecruitApproach): string[] {
    if (ap === 'cohort') return ['Barter', 'Tactics', 'Inspiration']
    if (ap === 'conscript') return ['Intimidation', 'Tactics']
    // convert
    return ['Inspiration', 'Psychology']
  }
  const RECRUITMENT_ALL_SKILLS = ['Barter', 'Inspiration', 'Manipulation', 'Psychology', 'Streetwise', 'Tactics', 'Intimidation']

  // Compute the CMod breakdown for the currently-selected recruit
  // state. Returns the pieces so the modal can display them line-by-
  // line, and the total for the roll.
  function computeRecruitCmods(): { firstImpression: number; inspiration: number; poaching: number; gm: number; total: number } {
    let firstImpression = 0
    let inspiration = 0
    let poaching = 0
    if (recruitRollerId && recruitNpcId) {
      const rollerEntry = entries.find(e => e.character.id === recruitRollerId)
      if (rollerEntry) {
        // Inspiration skill: every level = +1 SMod to recruitment
        // attempts per Distemper CRB. Stored as SMod on top of the
        // chosen-skill SMod. Treated as CMod here (in the UI total)
        // for clarity; the actual roll adds it to SMod.
        const insp = (rollerEntry.character.data?.skills ?? []).find((s: any) => s.skillName === 'Inspiration')
        inspiration = insp?.level ?? 0
      }
    }
    // First Impression CMod — needs a fetch from npc_relationships;
    // we don't eagerly sync this into state. The UI preview just
    // falls through to 0 until the player rolls First Impression
    // separately (which writes the row). Future enhancement: fetch
    // on NPC pick. MVP: inline hint if it's null.
    // For now, read from revealedNpcs which carries relationship_cmod.
    const revealed = revealedNpcs.find((n: any) => n.id === recruitNpcId)
    if (revealed && typeof revealed.relationship_cmod === 'number') firstImpression = revealed.relationship_cmod
    // Poaching — if NPC is already in another community, apply -3.
    if (recruitNpcId && npcCommunityMap[recruitNpcId]) poaching = -3
    const total = firstImpression + inspiration + poaching + recruitGmCmod
    return { firstImpression, inspiration, poaching, gm: recruitGmCmod, total }
  }

  async function executeRecruitRoll() {
    if (!recruitRollerId || !recruitNpcId) return
    if (!recruitSkill) return
    const rollerEntry = entries.find(e => e.character.id === recruitRollerId)
    if (!rollerEntry) return
    const npc = campaignNpcs.find((n: any) => n.id === recruitNpcId)
    if (!npc) return
    // Conscription pressgang gate (CRB). Conscription explicitly
    // requires a credible threat — coercion, leverage, weapons drawn,
    // hostage, etc. Surface this at roll time so it can't be a
    // half-accidental click. SRD: "The PCs must present a credible
    // threat for Conscription to work."
    if (recruitApproach === 'conscript') {
      const ack = confirm(
        `Conscription — pressgang.\n\n` +
        `This is coercion, not persuasion. The PC must have established a credible threat (weapons drawn, leverage held, escape cut off, etc.) before this roll can proceed.\n\n` +
        `Confirm the threat is credible and roll?`
      )
      if (!ack) return
    }
    // Resolve community: either existing id, or inline-create.
    let finalCommunityId = recruitCommunityId
    let finalCommunityName = ''
    if (recruitCommunityId === '__new__') {
      if (!recruitNewCommunityName.trim()) return
      const { data: newComm, error: commErr } = await supabase
        .from('communities')
        .insert({
          campaign_id: id,
          name: recruitNewCommunityName.trim(),
          status: 'forming',
          world_visibility: recruitNewCommunityPublic ? 'published' : 'private',
        })
        .select('id, name')
        .single()
      if (commErr || !newComm) {
        alert(`Failed to create community: ${commErr?.message ?? 'unknown error'}`)
        return
      }
      finalCommunityId = newComm.id
      finalCommunityName = newComm.name
    } else if (finalCommunityId) {
      finalCommunityName = recruitCommunityList.find(c => c.id === finalCommunityId)?.name ?? ''
    } else {
      return // nothing to do
    }

    // AMod: PC's INF (social approaches) regardless of specific skill.
    const rapid = rollerEntry.character.data?.rapid ?? {}
    const amod = rapid.INF ?? 0
    // SMod: level in the picked skill.
    const smod = (rollerEntry.character.data?.skills ?? []).find((s: any) => s.skillName === recruitSkill)?.level ?? 0
    // CMod: sum of First Impression + Inspiration + Poaching + GM.
    const cmods = computeRecruitCmods()
    // Insight Die pre-roll — 3d6 keep-all, or +3 CMod flat. Deducts 1
    // from the roller PC's insight_dice. Gracefully no-ops if the PC
    // has 0 (UI should already have hidden the option).
    let die1: number, die2: number
    let die3: number | undefined = undefined
    let bonusCmod = 0
    let mode3d6 = false
    if (recruitPreInsight === '3d6' && rollerEntry.liveState && rollerEntry.liveState.insight_dice > 0) {
      die1 = Math.floor(Math.random() * 6) + 1
      die2 = Math.floor(Math.random() * 6) + 1
      die3 = Math.floor(Math.random() * 6) + 1
      mode3d6 = true
      const newInsight = rollerEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', rollerEntry.stateId)
      setEntries(prev => prev.map(e => e.stateId === rollerEntry.stateId ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } } : e))
    } else if (recruitPreInsight === '+3cmod' && rollerEntry.liveState && rollerEntry.liveState.insight_dice > 0) {
      die1 = Math.floor(Math.random() * 6) + 1
      die2 = Math.floor(Math.random() * 6) + 1
      bonusCmod = 3
      const newInsight = rollerEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', rollerEntry.stateId)
      setEntries(prev => prev.map(e => e.stateId === rollerEntry.stateId ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } } : e))
    } else {
      die1 = Math.floor(Math.random() * 6) + 1
      die2 = Math.floor(Math.random() * 6) + 1
    }
    const total = die1 + die2 + (die3 ?? 0) + amod + smod + cmods.total + bonusCmod
    const outcome = mode3d6
      ? (total >= 14 ? 'Wild Success' : total >= 9 ? 'Success' : total >= 4 ? 'Failure' : 'Dire Failure')
      : getOutcome(total, die1, die2)
    const isSuccess = outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight'
    // Per XSE SRD §08 p.21 (+ tasks/rules-extract-communities.md table
    // rows on High Insight): Apprentice is unlocked ONLY on a Moment
    // of High Insight (double-6). A plain Wild Success (total ≥14
    // without matching faces) does NOT grant the Apprentice option.
    const unlocksApprentice = outcome === 'High Insight'
    const applyApprentice = unlocksApprentice && recruitApprenticeToggle && !apprenticeByCharacter[recruitRollerId]
    const recruitmentType: RecruitApproach | 'apprentice' = applyApprentice ? 'apprentice' : recruitApproach

    // On success, INSERT community_members. If the NPC is currently in
    // another community (poaching), leave that row alone — narratively
    // the NPC is switching allegiance but the GM may want to retain
    // history. MVP behavior: just insert the new membership; GM can
    // manually remove old one if desired.
    let inserted = false
    if (isSuccess) {
      const { error: memErr } = await supabase.from('community_members').insert({
        community_id: finalCommunityId,
        npc_id: recruitNpcId,
        character_id: null,
        role: 'unassigned',
        recruitment_type: recruitmentType,
        apprentice_of_character_id: applyApprentice ? recruitRollerId : null,
        joined_at: new Date().toISOString(),
      })
      if (memErr) {
        alert(`Failed to add member: ${memErr.message}`)
      } else {
        inserted = true
      }
    }

    // Log to roll_log with outcome='recruit' for the feed. damage_json
    // carries the metadata so the feed renderer can show structured
    // flavor: approach, community, apprentice flag, poaching, etc.
    const logLabel = isSuccess
      ? `🤝 ${rollerEntry.character.name} recruited ${npc.name}${applyApprentice ? ' as an Apprentice' : ` as a ${recruitmentType.charAt(0).toUpperCase() + recruitmentType.slice(1)}`} to ${finalCommunityName}`
      : `🤝 ${rollerEntry.character.name} tried to recruit ${npc.name} — ${outcome}`
    const { data: logRow } = await supabase.from('roll_log').insert({
      campaign_id: id,
      user_id: userId,
      character_name: rollerEntry.character.name,
      label: logLabel,
      die1, die2, amod, smod, cmod: cmods.total + bonusCmod,
      total,
      outcome: 'recruit',
      damage_json: {
        rollOutcome: outcome,
        approach: recruitApproach,
        recruitmentType,
        apprentice: applyApprentice,
        firstImpression: cmods.firstImpression,
        inspiration: cmods.inspiration,
        poaching: cmods.poaching,
        gmCmod: cmods.gm,
        bonusCmod,
        die3,
        mode3d6,
        communityId: finalCommunityId,
        communityName: finalCommunityName,
        npcId: recruitNpcId,
        npcName: npc.name,
      } as any,
    }).select('id').single()

    setRecruitResult({
      die1, die2, die3, total, outcome,
      amod, smod, cmod: cmods.total + bonusCmod,
      approach: recruitApproach, npcName: npc.name, rollerName: rollerEntry.character.name,
      communityId: finalCommunityId, communityName: finalCommunityName,
      inserted, apprenticeApplied: applyApprentice,
      logRowId: logRow?.id,
      mode3d6,
    })
    setRecruitStep('result')
    // Reload feed so the new log row appears immediately.
    await rollsFeed.refetch()
    // Broadcast so any open PlayerNpcCard for this NPC re-fetches its
    // recruit state chip without a page refresh. Success or failure,
    // either outcome changes what the chip should display.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tapestry:recruit-updated', { detail: { npcId: npc.id } }))
    }
  }

  function closeRecruitModal() {
    setShowRecruit(false)
    setRecruitResult(null)
    setRecruitStep('pick')
    setRecruitPreInsight('none')
    setRecruitApprenticeToggle(false)
  }

  // Post-roll Insight Die reroll on the Recruitment outcome modal. One
  // die at a time (1, 2, or 3 if 3d6 mode). Deducts 1 insight die,
  // rerolls that die, recomputes outcome + total, patches the existing
  // roll_log row and any community_members side-effect, and updates
  // the in-modal result state.
  async function rerollRecruitDie(which: 1 | 2 | 3) {
    const r = recruitResult
    if (!r) return
    const rollerEntry = entries.find(e => e.character.name === r.rollerName)
    if (!rollerEntry || !rollerEntry.liveState || rollerEntry.liveState.insight_dice < 1) return
    if (which === 3 && !r.mode3d6) return

    // Spend the die.
    const newInsight = rollerEntry.liveState.insight_dice - 1
    await supabase.from('character_states')
      .update({ insight_dice: newInsight, updated_at: new Date().toISOString() })
      .eq('id', rollerEntry.stateId)
    setEntries(prev => prev.map(e => e.stateId === rollerEntry.stateId
      ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } }
      : e))

    // Reroll the chosen die.
    const newDie = Math.floor(Math.random() * 6) + 1
    const die1 = which === 1 ? newDie : r.die1
    const die2 = which === 2 ? newDie : r.die2
    const die3 = which === 3 ? newDie : r.die3

    const total = die1 + die2 + (die3 ?? 0) + r.amod + r.smod + r.cmod
    const outcome = r.mode3d6
      ? (total >= 14 ? 'Wild Success' : total >= 9 ? 'Success' : total >= 4 ? 'Failure' : 'Dire Failure')
      : getOutcome(total, die1, die2)
    const wasSuccess = r.inserted
    const nowSuccess = outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight'

    // Reconcile community_members side-effect if outcome flipped.
    let inserted = r.inserted
    let apprenticeApplied = r.apprenticeApplied
    if (wasSuccess && !nowSuccess && r.communityId) {
      // Withdraw membership — the recruit no longer happened.
      await supabase.from('community_members')
        .delete()
        .eq('community_id', r.communityId)
        .eq('npc_id', recruitNpcId)
      inserted = false
      apprenticeApplied = false
    } else if (!wasSuccess && nowSuccess && r.communityId) {
      // Late-insert the member. Apprentice flag defers to the
      // post-roll Apprentice toggle (user clicks "Take as Apprentice"
      // if they want it) — here we just land them as the normal
      // recruitment type.
      const { error: memErr } = await supabase.from('community_members').insert({
        community_id: r.communityId,
        npc_id: recruitNpcId,
        character_id: null,
        role: 'unassigned',
        recruitment_type: r.approach,
        apprentice_of_character_id: null,
        joined_at: new Date().toISOString(),
      })
      if (!memErr) inserted = true
    }

    // Patch the existing roll_log row.
    const newLabel = nowSuccess
      ? `🤝 ${r.rollerName} recruited ${r.npcName}${apprenticeApplied ? ' as an Apprentice' : ` as a ${r.approach.charAt(0).toUpperCase() + r.approach.slice(1)}`} to ${r.communityName}`
      : `🤝 ${r.rollerName} tried to recruit ${r.npcName} — ${outcome}`
    if (r.logRowId) {
      await supabase.from('roll_log')
        .update({
          die1, die2, total, label: newLabel,
          damage_json: {
            rollOutcome: outcome,
            approach: r.approach,
            recruitmentType: apprenticeApplied ? 'apprentice' : r.approach,
            apprentice: apprenticeApplied,
            die3,
            mode3d6: r.mode3d6,
            communityId: r.communityId,
            communityName: r.communityName,
            npcId: recruitNpcId,
            npcName: r.npcName,
            rerolled: which,
          } as any,
        })
        .eq('id', r.logRowId)
    }

    setRecruitResult({
      ...r,
      die1, die2, die3,
      total, outcome,
      inserted, apprenticeApplied,
    })
    await rollsFeed.refetch()
    // Broadcast — reroll can flip membership state (added or removed)
    // or just change the logged outcome; either way the chip needs a
    // refresh.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tapestry:recruit-updated', { detail: { npcId: recruitNpcId } }))
    }
  }

  function triggerGroupCheck() {
    if (groupCheckParticipants.size === 0 || !groupCheckSkill) return
    const participants = entries.filter(e => groupCheckParticipants.has(e.character.id))
    if (participants.length === 0) return
    // Find the attribute for this skill
    const skillDef = SKILLS.find(s => s.name === groupCheckSkill)
    const attrKey = skillDef?.attribute ?? 'RSN'
    // Leader = highest AMod + SMod
    const scored = participants.map(p => {
      const amod = p.character.data?.rapid?.[attrKey] ?? 0
      const smod = (p.character.data?.skills ?? []).find((s: any) => s.skillName === groupCheckSkill)?.level ?? 0
      return { ...p, amod, smod, total: amod + smod }
    }).sort((a, b) => b.total - a.total)
    const leader = scored[0]
    // Others contribute their AMod or SMod (whichever is used)
    const bonusMods = scored.slice(1).reduce((sum, p) => sum + p.smod, 0)
    handleRollRequest(`Group Check — ${groupCheckSkill} (led by ${leader.character.name})`, leader.amod, leader.smod + bonusMods)
    setShowSpecialCheck(null)
    setGroupCheckParticipants(new Set())
    setGroupCheckSkill('')
  }

  function getAutoRangeBand(attackerCharId?: string, attackerNpcId?: string, targetName?: string): 'engaged' | 'close' | 'medium' | 'long' | 'distant' | null {
    if (!targetName || mapTokens.length === 0) return null
    const aTok = mapTokens.find(t =>
      (attackerCharId && t.character_id === attackerCharId) ||
      (attackerNpcId && t.npc_id === attackerNpcId)
    )
    if (!aTok) return null
    const tTok = mapTokens.find(t => {
      const entry = entries.find(e => e.character.name === targetName)
      if (entry && t.character_id === entry.character.id) return true
      const npc = campaignNpcs.find((n: any) => n.name === targetName)
      if (npc && t.npc_id === npc.id) return true
      if (t.token_type === 'object' && t.name === targetName) return true
      return false
    })
    if (!tTok) return null
    const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
    const feet = dist * mapCellFeet
    return getRangeBandFromFeet(feet)
  }

  function isInRange(weaponName: string, currentRangeBand: string): boolean {
    return canHitAtRange(weaponName, currentRangeBand as any)
  }

  function getRangeCMod(): number {
    if (!pendingRoll?.weapon) return 0
    const cmod = getWeaponRangeCMod(pendingRoll.weapon.weaponName, rangeBand as any)
    return cmod ?? 0
  }

  async function handleInsightSave(spend: boolean) {
    if (!insightSavePrompt) return
    const { stateId, phyAmod, insightDice } = insightSavePrompt
    if (spend) {
      // Trade ALL Insight Dice per SRD, regain 1 WP and 1 RP
      await supabase.from('character_states').update({
        wp_current: 1, rp_current: 1, insight_dice: 0, updated_at: new Date().toISOString(),
      }).eq('id', stateId)
      setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, wp_current: 1, rp_current: 1, insight_dice: 0 } } : e))
    } else {
      // Apply full damage — WP=0 with death countdown + Stress pip on entry
      // to mortal-wound (rule: any mortal/incap transition fills one pip).
      const deathCountdown = Math.max(1, 4 + phyAmod)
      const targetEntry = entries.find(e => e.stateId === stateId)
      const newStress = Math.min(5, (targetEntry?.liveState.stress ?? 0) + 1)
      await supabase.from('character_states').update({
        wp_current: 0, death_countdown: deathCountdown, stress: newStress, updated_at: new Date().toISOString(),
      }).eq('id', stateId)
      setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, wp_current: 0, death_countdown: deathCountdown, stress: newStress } as any } : e))
      if (targetEntry) {
        await supabase.from('roll_log').insert({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `😰 ${targetEntry.character.name} gains a Stress from being Mortally Wounded`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
        })
      }
    }
    setInsightSavePrompt(null)
    // Broadcast resolution so other clients close their modal and refresh
    initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound_resolved', payload: {} })
    await loadEntries(id)
  }

  async function applySocialAction(action: string, targetEntryId: string) {
    const activeEntry = initiativeOrder.find(e => e.is_active)
    if (!activeEntry) return
    const targetEntry = initiativeOrder.find(e => e.id === targetEntryId)
    if (!targetEntry) return
    await clearAimIfActive(activeEntry.id)

    if (action === 'Cover Fire') {
      // SRD: Successful attack → -2 CMod to target's next action
      const newBonus = (targetEntry.aim_bonus ?? 0) - 2
      await supabase.from('initiative_order').update({ aim_bonus: newBonus }).eq('id', targetEntryId)
      await consumeAction(activeEntry.id, `${activeEntry.character_name} — Cover Fire → ${targetEntry.character_name} (-2 CMod)`)
    } else if (action === 'Distract') {
      // SRD: Intimidation/Psychology*/Tactics* check → target loses next
      // Combat Action on success. Auto-apply replaced with a real roll
      // 2026-04-29 so the modal matches the standard ATTACK ROLL shape +
      // failures don't punish the target. Active combatant burns one
      // action either way (the attempt cost) — pre-consumed via the
      // actionPreConsumedRef gate, mirroring Stabilize.
      let amod = 0, smod = 0
      const distractCharEntry = entries.find(e => e.character.name === activeEntry.character_name)
      if (distractCharEntry) {
        amod = distractCharEntry.character.data?.rapid?.INF ?? 0
        const sk: any[] = Array.isArray(distractCharEntry.character.data?.skills) ? distractCharEntry.character.data.skills : []
        const skLevel = (n: string) => (sk.find((s: any) => s.skillName === n)?.level ?? 0)
        smod = Math.max(skLevel('Intimidation'), skLevel('Psychology*'), skLevel('Tactics*'))
      } else {
        const npcRoller = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
        if (npcRoller) {
          amod = (npcRoller as any).influence ?? 0
          const npcSkills: any[] = Array.isArray(npcRoller.skills?.entries) ? npcRoller.skills.entries : []
          const skLevel = (n: string) => (npcSkills.find((s: any) => s.name === n)?.level ?? 0)
          smod = Math.max(skLevel('Intimidation'), skLevel('Psychology*'), skLevel('Tactics*'))
        }
      }
      // Open roll modal FIRST (before consumeAction changes the active combatant)
      handleRollRequest(`${activeEntry.character_name} — Distract → ${targetEntry.character_name}`, amod, smod)
      actionPreConsumedRef.current = true
      await consumeAction(activeEntry.id)
    } else if (action === 'Inspire') {
      // SRD: Inspiration check → target gains +1 Combat Action. Once per round.
      if (targetEntry.inspired_this_round) {
        alert(`${targetEntry.character_name} has already been Inspired this round.`)
        return
      }
      const newActions = (targetEntry.actions_remaining ?? 0) + 1
      await supabase.from('initiative_order').update({ actions_remaining: newActions, inspired_this_round: true }).eq('id', targetEntryId)
      await consumeAction(activeEntry.id, `${activeEntry.character_name} — Inspire → ${targetEntry.character_name} (+1 action)`)
    }
    setSocialTarget(null)
  }

  function handleRollRequest(label: string, amod: number, smod: number, weapon?: WeaponContext, bypassTurnGate = false) {
    // During active combat, ALL rolls (weapon + skill) are gated to the active
    // combatant with actions remaining.  Without this, a player whose turn ended
    // could still open a skill check, and closeRollModal would then consume an
    // action from whichever OTHER combatant is now active — corrupting the turn.
    //
    // Bypass when:
    //   - bypassTurnGate=true (explicit, e.g. Sprint Athletics deferred roll), OR
    //   - actionPreConsumedRef.current=true (Sprint / Stabilize / any flow that
    //     already consumed actions before requesting the roll — the turn may
    //     have auto-advanced, so the gate would block the legitimate deferred
    //     roll. closeRollModal won't double-consume because the same ref tells
    //     it to skip the post-roll consume).
    if (combatActive && !bypassTurnGate && !actionPreConsumedRef.current) {
      const active = initiativeOrder.find(e => e.is_active)
      if (!active || (active.actions_remaining ?? 0) <= 0) {
        alert('No actions remaining — wait for your next turn.')
        return
      }

      // Determine the roller's identity so we can verify it matches the active
      // combatant.  Weapon attacks: inferred from label prefix or selected sheet.
      // Skill/other rolls: inferred from the roller's PC or GM-controlled NPC.
      let rollerName: string | null
      if (weapon) {
        const firstPart = label.split(' — ')[0]
        const firstPartIsKnownName =
          campaignNpcs.some((n: any) => n.name === firstPart) ||
          entries.some(e => e.character.name === firstPart)
        if (firstPartIsKnownName) {
          rollerName = firstPart
        } else if (isGM && selectedEntry) {
          rollerName = selectedEntry.character.name
        } else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      } else {
        // Non-weapon roll — figure out who is rolling.
        // Label may start with "CharName — Skill" (NPC rolls from NpcCard).
        const firstPart = label.split(' — ')[0]
        const firstPartIsKnownName =
          campaignNpcs.some((n: any) => n.name === firstPart) ||
          entries.some(e => e.character.name === firstPart)
        if (firstPartIsKnownName) {
          rollerName = firstPart
        } else if (isGM && active.is_npc) {
          // GM rolling a skill for the active NPC — allow it
          rollerName = active.character_name
        } else if (isGM && selectedEntry) {
          rollerName = selectedEntry.character.name
        } else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      }

      if (!rollerName || active.character_name !== rollerName) {
        alert(`It's not ${rollerName ?? 'that character'}'s turn.`)
        return
      }
    }
    rollExecutedRef.current = false
    setPendingRoll({ label, amod, smod, weapon })
    setRollResult(null)
    // Include aim bonus from Aim action or Tracking trait
    const activeEntry = combatActive ? initiativeOrder.find(e => e.is_active) : null
    const aimBonus = activeEntry?.aim_bonus ?? 0
    const baseCmod = (weapon?.conditionCmod ?? 0) + aimBonus
    setCmod(baseCmod ? String(baseCmod) : '0')
    // Auto-populate target dropdown.  Priority:
    //   1) Token the attacker selected on the map (explicit user action)
    //   2) last_attack_target this turn (short-term memory)
    //   3) Closest valid target by Chebyshev distance from the attacker's
    //      token on the tactical map (prefers in-range if weapon is present,
    //      falls back to absolute closest so the user still sees a target
    //      with an "out of range" warning they can swap from)
    function isNameValidLiveTarget(name: string | null | undefined): boolean {
      if (!name) return false
      // Attacker can't target themselves
      if (activeEntry && name === activeEntry.character_name) return false
      const inInit = initiativeOrder.some(ie => {
        if (ie.character_name !== name) return false
        if (ie.is_npc) {
          const npc = campaignNpcs.find((n: any) => n.id === ie.npc_id)
          if (npc && npc.wp_current != null && npc.wp_current <= 0) return false
        } else {
          const tEntry = entries.find(en => en.character.name === ie.character_name)
          if (tEntry && (tEntry.liveState.wp_current ?? tEntry.liveState.wp_max ?? 1) <= 0) return false
        }
        return true
      })
      if (inInit) return true
      return mapTokens.some(t => t.token_type === 'object' && t.name === name && (t.wp_current ?? t.wp_max ?? 0) > 0)
    }
    function getClosestValidTargetName(): string | null {
      if (!activeEntry || mapTokens.length === 0) return null
      const attackerTok = mapTokens.find(t =>
        (activeEntry.character_id && t.character_id === activeEntry.character_id) ||
        (activeEntry.npc_id && t.npc_id === activeEntry.npc_id)
      )
      if (!attackerTok) return null
      // Score every other token: distance, plus whether the weapon can hit it.
      let bestInRange: { name: string; dist: number } | null = null
      let bestAny: { name: string; dist: number } | null = null
      for (const t of mapTokens) {
        if (t.id === attackerTok.id) continue
        if (!isNameValidLiveTarget(t.name)) continue
        const dist = Math.max(Math.abs(t.grid_x - attackerTok.grid_x), Math.abs(t.grid_y - attackerTok.grid_y))
        if (!bestAny || dist < bestAny.dist) bestAny = { name: t.name, dist }
        if (weapon) {
          const band = getAutoRangeBand(activeEntry.character_id || undefined, activeEntry.npc_id || undefined, t.name)
          if (band && isInRange(weapon.weaponName, band)) {
            if (!bestInRange || dist < bestInRange.dist) bestInRange = { name: t.name, dist }
          }
        }
      }
      return (bestInRange ?? bestAny)?.name ?? null
    }
    const prevTarget = weapon ? activeEntry?.last_attack_target : null
    const mapSelection = weapon ? selectedMapTargetName : null
    const autoClosest = weapon ? getClosestValidTargetName() : null
    const chosenTarget = isNameValidLiveTarget(mapSelection)
      ? mapSelection
      : (isNameValidLiveTarget(prevTarget) ? prevTarget : (isNameValidLiveTarget(autoClosest) ? autoClosest : null))
    if (chosenTarget && weapon && activeEntry) {
      setTargetName(chosenTarget)
      const w = getWeaponByName(weapon.weaponName)
      const isMelee = w?.category === 'melee'
      const targetEntry = entries.find(en => en.character.name === chosenTarget)
      const isObjectTarget = !targetEntry && !initiativeOrder.some(ie => ie.character_name === chosenTarget) && mapTokens.some(t => t.token_type === 'object' && t.name === chosenTarget)
      const targetRapid = targetEntry?.character.data?.rapid ?? {}
      const defensiveMod = isObjectTarget ? 0 : (isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0))
      const myInitEntry = initiativeOrder.find(ie =>
        (activeEntry.character_id && ie.character_id === activeEntry.character_id) ||
        (activeEntry.npc_id && ie.npc_id === activeEntry.npc_id) ||
        ie.character_name === activeEntry.character_name
      )
      const coordBonus = (myInitEntry?.coordinate_target === chosenTarget) ? (myInitEntry?.coordinate_bonus ?? 0) : 0
      // +1 same-target bonus only when this matches last_attack_target
      const sameTargetBonus = chosenTarget === prevTarget ? 1 : 0
      setCmod(String(baseCmod - defensiveMod + sameTargetBonus + coordBonus))
      const autoRange = getAutoRangeBand(activeEntry.character_id || undefined, activeEntry.npc_id || undefined, chosenTarget)
      if (autoRange) setRangeBand(autoRange)
    } else {
      setTargetName('')
      // Only reset to 'medium' when there's no pre-selected target. Previously
      // this fired unconditionally and clobbered the autoRange just set above,
      // causing pre-selected map targets (e.g. adjacent Barrel) to show as
      // "out of range" on the first modal open.
      setRangeBand('medium')
    }
    setPreRollInsight('none')
    setUseBurst(false)
    setSocialTarget(null)
    setSocialNpcId('')
    setSocialCmod(null)
  }

  async function saveRollToLog(die1: number, die2: number, amod: number, smod: number, cmodVal: number, label: string, characterName: string, isReroll = false, target: string | null = null, damageData?: DamageResult, insightUsed: '3d6' | '+3cmod' | null = null) {
    const total = die1 + die2 + amod + smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    // Non-antagonist NPCs never get Insight Dice
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPC = isHighLow && !entries.some(e => e.character.name === characterName)
    const npcTypeForLog = isNPC ? (rosterNpcs.find((n: any) => n.name === characterName)?.npc_type ?? campaignNpcs.find((n: any) => n.name === characterName)?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPC && npcTypeForLog !== 'antagonist')

    await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: characterName,
      label: isReroll ? `${label} (Re-roll)` : label,
      die1, die2, amod, smod, cmod: cmodVal, total, outcome, insight_awarded: insightAwarded,
      target_name: target || null,
      damage_json: damageData || null,
      // Recorded so the extended log can call out +3 CMod spends
      // (which are otherwise indistinguishable from organic CMod
      // stacks) and 3d6 spends where d2+d3 ≤ 6 (the legacy heuristic
      // misses ~17% of those).
      insight_used: insightUsed,
    })
    logEvent('roll', { campaign_id: id, label, total, outcome, target, character: characterName })

    return { total, outcome, insightAwarded }
  }

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
    // Determine character name. Most labels containing " — " put the attacker
    // name first (e.g. "Goon 1 — Attack (Pistol)", "David Battersby — Aim"),
    // but the PC weapon-attack button builds its label as "Attack — <weapon>"
    // which previously made the code write the literal string "Attack" into
    // roll_log.character_name. Guard against that by only trusting the first
    // split-part when it actually matches a known PC or NPC name.
    const labelParts = pendingRoll.label.split(' — ')
    const myEntry = entries.find(e => e.userId === userId)
    const firstPart = labelParts[0]
    const firstPartIsKnownName = labelParts.length > 1 && (
      entries.some(e => e.character.name === firstPart) ||
      campaignNpcs.some((n: any) => n.name === firstPart)
    )
    const characterName = firstPartIsKnownName
      ? firstPart
      : (syncedSelectedEntry?.character.name ?? myEntry?.character.name ?? 'Unknown')
    let cmodVal = parseInt(cmod) || 0
    // Add range band CMod for weapon attacks
    if (pendingRoll.weapon) cmodVal += getRangeCMod()
    let die1: number, die2: number
    let preRollSpent = false
    // Populated only on 3d6 Insight rolls — carries all three dice so the
    // modal render can show three boxes instead of two (die2 would
    // otherwise read as d2+d3, misleadingly as one die).
    let insightDiceRolled: number[] | undefined

    if (preRollInsight === '3d6' && myEntry?.liveState && myEntry.liveState.insight_dice >= 1) {
      // Per SRD: roll 3d6 and KEEP ALL THREE dice (playtest #6 — do NOT
      // drop lowest). Fit into the existing die1/die2 storage columns by
      // putting the first die in die1 and the sum of the other two in
      // die2; total = die1+die2+mods = d1+d2+d3+mods. die2 is always ≥2
      // so the Low-Insight pair check can't fire here, and we pass the
      // skipInsightPair flag to getOutcome so a coincidental d1=6, d2+d3=6
      // doesn't trigger High Insight on a roll that already spent one.
      const d1 = rollD6(), d2 = rollD6(), d3 = rollD6()
      die1 = d1
      die2 = d2 + d3
      insightDiceRolled = [d1, d2, d3]  // surfaced in rollResult so the modal shows all 3 dice boxes
      const newInsight = myEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
      preRollSpent = true
      void appendProgressionLog(myEntry.character.id, 'insight', `Spent 1 Insight Die — rolled 3d6 (${d1}+${d2}+${d3}) on ${pendingRoll.label}`)
    } else if (preRollInsight === '+3cmod' && myEntry?.liveState && myEntry.liveState.insight_dice >= 1) {
      die1 = rollD6()
      die2 = rollD6()
      cmodVal += 3
      const newInsight = myEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
      preRollSpent = true
      void appendProgressionLog(myEntry.character.id, 'insight', `Spent 1 Insight Die — +3 CMod on ${pendingRoll.label}`)
    } else {
      die1 = rollD6()
      die2 = rollD6()
    }

    const total = die1 + die2 + pendingRoll.amod + pendingRoll.smod + cmodVal
    const outcome = getOutcome(total, die1, die2, preRollInsight === '3d6' && preRollSpent)
    // Award Insight Die — only to PCs, or Antagonist NPCs (Bystanders/Goons/Foes never get Insight Dice)
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPCRoll = isHighLow && pendingRoll.label.includes(' — ') && !entries.some(e => pendingRoll.label.startsWith(e.character.name))
    const npcType = isNPCRoll ? (rosterNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? campaignNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPCRoll && npcType !== 'antagonist')
    if (insightAwarded && myEntry?.liveState) {
      const currentInsight = preRollSpent ? myEntry.liveState.insight_dice - 1 : myEntry.liveState.insight_dice
      const newInsight = currentInsight + 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
      void appendProgressionLog(myEntry.character.id, 'insight', `Gained 1 Insight Die from Moment of ${outcome === 'High Insight' ? 'High' : 'Low'} Insight`)
    }

    // Calculate and apply damage for successful weapon attacks
    let damageResult: DamageResult | undefined
    let traitNotes: string[] = []
    // Auto-loot log rows are COLLECTED here during damage processing and
    // inserted AFTER saveRollToLog so the attack row ("used Unarmed Combat
    // on Crate 2") shows up in the feed BEFORE the loot row ("looked through
    // the remains of Crate 2 and found something"). Previously the loot row
    // inserted inline and landed ahead of the attack in the feed, reading
    // as a time-travel paradox to players.
    const pendingLootLogs: any[] = []

    // Grenade fumbles — once the pin is pulled, the grenade detonates no
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
      // Unarmed Attack button — it has no entry in getWeaponByName, so we
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

      // Grenade fumble — compute the actual blast center now so it can
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
            traitNotes.push(`💥 Moment of Low Insight — grenade detonates in hand at thrower's cell (${throwerTok.grid_x},${throwerTok.grid_y}).`)
          } else {
            traitNotes.push(`💥 Moment of Low Insight — grenade detonates, but the thrower has no map token, so no AoE applied.`)
          }
        } else {
          // Failure / Dire Failure — find the intended cell, then scatter.
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
            traitNotes.push(`${tier} — scattered ${dir.name} ${distRoll} cell${distRoll !== 1 ? 's' : ''} (${distRoll * ft} ft). Impact: (${newGx},${newGy}).`)
          } else {
            traitNotes.push(`🎲 Wild throw — but no valid origin cell, blast not resolved.`)
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

      // Find target — could be PC (in entries), NPC (in initiativeOrder + rosterNpcs), a non-combat NPC on the map, or object token (mapTokens with WP)
      const targetInitEntry = initiativeOrder.find(e => e.character_name === targetName)
      const targetEntry = entries.find(e => e.character.name === targetName) ?? (targetInitEntry?.character_id ? entries.find(e => e.character.id === targetInitEntry.character_id) : undefined)
      const targetNpc = !targetEntry
        ? (targetInitEntry?.is_npc
            ? (rosterNpcs.find(n => n.id === targetInitEntry.npc_id) ?? campaignNpcs.find((n: any) => n.id === targetInitEntry.npc_id))
            : (campaignNpcs.find((n: any) => n.name === targetName) ?? rosterNpcs.find(n => n.name === targetName)))
        : null
      const targetObject = (!targetEntry && !targetNpc) ? mapTokens.find(t => t.token_type === 'object' && t.name === targetName && (t.wp_max ?? 0) > 0) : null
      const targetRapid = targetEntry?.character.data?.rapid ?? (targetNpc ? { PHY: targetNpc.physicality ?? 0, DEX: targetNpc.dexterity ?? 0 } : {})
      const targetDefBonus = targetInitEntry?.defense_bonus ?? 0
      const defensiveMod = targetObject ? 0 : ((isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)) + targetDefBonus)

      let { finalWP, finalRP, mitigated } = calculateDamage(totalWP + unarmedBonus, weapon.rpPercent, defensiveMod)
      // Subdue: full RP but 50% WP
      if (pendingRoll.label.includes('Subdue')) {
        finalWP = Math.max(1, Math.floor(finalWP / 2))
        traitNotes.push(`Subdue — WP halved to ${finalWP}`)
      }
      // After taking a hit, clear Defend bonus (one-time) but keep Take Cover bonus
      if (targetInitEntry && targetDefBonus > 0 && !targetInitEntry.has_cover) {
        supabase.from('initiative_order').update({ defense_bonus: 0 }).eq('id', targetInitEntry.id)
      }

      // Stun: zero WP damage
      if (isStun) {
        finalWP = 0
        traitNotes.push('Stun — no WP damage dealt')
        if (outcome === 'Wild Success' || outcome === 'High Insight') {
          const targetPhy = targetRapid.PHY ?? 0
          const stunRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - targetPhy)
          traitNotes.push(`Target incapacitated for ${stunRounds} round${stunRounds !== 1 ? 's' : ''}`)
        }
      }

      // Burst note
      if (useBurst && rolls > 1) {
        traitNotes.push(`Automatic Burst — ${rolls} rounds fired`)
      }

      // Blast Radius note + splash baseline
      // Per CRB p.71-72: "The damage is calculated once for the
      // explosion and the same amount is dealt to each person caught
      // in the blast." Splash uses the RAW rolled WP (before primary's
      // mitigation) — splash victims don't inherit the primary's
      // PHY/DEX defense. Primary is still mitigated as the named
      // attack recipient (handled separately above via calculateDamage).
      const blastRawWP = totalWP + unarmedBonus
      const blastRawRP = Math.floor(blastRawWP * (weapon.rpPercent / 100))
      if (hasBlast) {
        const halfWP = Math.floor(blastRawWP / 2)
        traitNotes.push(`Blast Radius — Engaged: ${blastRawWP} WP | Close: ${halfWP} WP`)
      }

      // Burning note
      if (burningVal !== null && burningVal > 0) {
        const burnRounds = Math.floor(Math.random() * 3) + 1
        traitNotes.push(`Burning — ${burningVal} WP/RP per round for ${burnRounds} round${burnRounds !== 1 ? 's' : ''}`)
      }

      // Close-Up / Cone-Up note
      if (hasCloseUp) traitNotes.push('Close-Up — at Engaged range, 50% damage to bystanders')
      if (hasConeUp) traitNotes.push('Cone-Up — at Engaged range, 50% damage to bystanders')

      damageResult = { base: totalBase, diceRoll: totalDice, diceDesc: rolls > 1 ? `${rolls}x ${diceDesc}` : diceDesc, phyBonus: totalPhy, totalWP: totalWP + unarmedBonus, finalWP, finalRP, mitigated, targetName }

      // Auto-decrement ammo for ranged attacks
      if (w && !isMelee && w.clip && myEntry) {
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
      console.warn('[damage] target lookup:', { targetName, targetEntry: !!targetEntry, hasLiveState: !!targetEntry?.liveState, targetNpc: !!targetNpc, finalWP, finalRP })
      if (isGrenadeFumble) {
        // Grenade fumbles skip the named-target damage path entirely —
        // there's no "primary" hit because the throw missed. Damage is
        // applied through the blast AoE below using blastCenterOverride.
        console.warn('[damage] grenade fumble — primary skipped, blast AoE will resolve from override center', blastCenterOverride)
      } else if (targetEntry?.liveState) {
        // PC target — use character_states
        // Re-fetch fresh HP from DB to avoid stale closure values
        const { data: freshState } = await supabase.from('character_states').select('*').eq('id', targetEntry.stateId).single()
        const currentWP = freshState?.wp_current ?? targetEntry.liveState.wp_current
        const currentRP = freshState?.rp_current ?? targetEntry.liveState.rp_current
        const currentInsight = freshState?.insight_dice ?? targetEntry.liveState.insight_dice ?? 0
        const newWP = Math.max(0, currentWP - finalWP)
        const newRP = Math.max(0, currentRP - finalRP)
        console.warn('[damage] PC target', targetEntry.character.name, 'WP:', currentWP, '→', newWP, 'RP:', currentRP, '→', newRP)

        if (newWP === 0 && currentWP > 0 && currentInsight > 0) {
          const { error: csErr, data: csData } = await supabase.from('character_states').update({ rp_current: newRP, updated_at: new Date().toISOString() }).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else console.warn('[damage] PC character_states update returned', csData?.length, 'rows')
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
          // Show modal on the PLAYER's screen — they decide whether to trade insight
          if (targetEntry.userId === userId) {
            setInsightSavePrompt(insightData)
          }
          // Broadcast so the player's client shows the modal
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound', payload: insightData })
        } else {
          const update: any = { wp_current: newWP, rp_current: newRP, updated_at: new Date().toISOString() }
          // Stress on entry to mortal-wound or incap. Per playtest rule
          // 2026-04-27 — entering either state automatically fills a Stress
          // pip (capped at 5). Mortal preempts incap when both transitions
          // would fire on the same hit, so only one pip per event.
          let stressReason: string | null = null
          if (newWP === 0 && targetEntry.liveState.wp_current > 0) {
            update.death_countdown = Math.max(1, 4 + (targetEntry.character.data?.rapid?.PHY ?? 0))
            update.stress = Math.min(5, (targetEntry.liveState.stress ?? 0) + 1)
            stressReason = 'Mortally Wounded'
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `${targetEntry.character.name} is mortally wounded by ${characterName} and will die if not stabilized in ${update.death_countdown} rounds.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
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
          }
          if (stressReason) {
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId, character_name: 'System',
              label: `😰 ${targetEntry.character.name} gains a Stress from being ${stressReason}`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
            })
          }
          const { error: csErr, data: csData } = await supabase.from('character_states').update(update).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else console.warn('[damage] PC character_states update returned', csData?.length, 'rows')
          // Silent RLS failure pattern: no error, 0 rows affected. The
          // optimistic patch paints damage locally for a frame, then
          // loadEntries at the end of executeRoll re-fetches the DB's
          // unchanged value and the bar snaps back to full — user sees
          // "zero damage applied" with no diagnostic. Make it loud.
          if (!csErr && (!csData || csData.length === 0)) {
            console.error('[damage] SILENT RLS FAIL — PC wp_current not updated. Run sql/character-states-rls-fix.sql in Supabase. stateId:', targetEntry.stateId)
            alert(`Damage to ${targetEntry.character.name} was silently rejected by RLS — the row did not update.\n\nThe GM needs to run sql/character-states-rls-fix.sql in Supabase to allow GMs + campaign members to apply damage to PCs they don't own.\n\nUntil then, damage rolls against PCs will succeed visually but not persist.`)
          }
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: { stateId: targetEntry.stateId, patch: update } })
          // Mortally wounded / incapacitated — zero their actions and auto-advance if active
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
        // NPC target — use campaign_npcs
        const npcWP = targetNpc.wp_current ?? targetNpc.wp_max ?? 10
        const npcRP = targetNpc.rp_current ?? targetNpc.rp_max ?? 6
        const newWP = Math.max(0, npcWP - finalWP)
        const newRP = Math.max(0, npcRP - finalRP)
        console.warn('[damage] NPC target', targetNpc.name, 'id:', targetNpc.id, 'WP:', npcWP, '→', newWP, 'RP:', npcRP, '→', newRP)
        const npcUpdate: any = { wp_current: newWP, rp_current: newRP }
        // Mortal wound — NPC enters death countdown when WP first hits 0
        if (newWP === 0 && npcWP > 0) {
          npcUpdate.death_countdown = Math.max(1, 4 + (targetNpc.physicality ?? 0))
          // Log the mortal wound to the game feed
          await supabase.from('roll_log').insert({
            campaign_id: id, user_id: userId,
            character_name: 'Death is in the air',
            label: `${targetNpc.name} is mortally wounded by ${characterName} and will die if not stabilized in ${npcUpdate.death_countdown} rounds.`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
          })
          // Kill log entry on the attacker's progression log (PCs only).
          if (myEntry?.character?.id) {
            void appendProgressionLog(myEntry.character.id, 'kill', `Mortally wounded ${targetNpc.name} with ${weapon.weaponName}`)
          }
        }
        // Incapacitation — NPC loses consciousness when RP first hits 0
        if (newRP === 0 && npcRP > 0 && newWP > 0) {
          npcUpdate.incap_rounds = Math.max(1, 4 - (targetNpc.physicality ?? 0))
        }
        const { error: npcUpdErr, data: npcUpdData } = await supabase
          .from('campaign_npcs')
          .update(npcUpdate)
          .eq('id', targetNpc.id)
          .select()
        if (npcUpdErr) console.error('[damage] campaign_npcs update error:', npcUpdErr.message)
        else console.warn('[damage] campaign_npcs update returned', npcUpdData?.length, 'rows')
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
        console.warn('[npc_damaged] SEND primary', { npcId, patch, channel: initChannelRef.current ? 'ready' : 'null' })
        initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId, patch } })
        // Mortally wounded / incapacitated — zero their actions and auto-advance if active
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
        // Object token — update scene_tokens.wp_current. No RP, no death countdown, no initiative update.
        const curWP = targetObject.wp_current ?? targetObject.wp_max ?? 0
        const newWP = Math.max(0, curWP - finalWP)
        console.warn('[damage] object target', targetObject.name, 'id:', targetObject.id, 'WP:', curWP, '→', newWP)
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
          console.error('[damage] SILENT RLS FAIL — scene_tokens.wp_current not updated. Run sql/scene-tokens-player-update-objects.sql. tokenId:', targetObject.id, 'tokenName:', targetObject.name)
          alert(`Damage to "${targetObject.name}" was silently rejected by RLS — the token's WP did not update, so it won't show as destroyed and any loot inside won't drop.\n\nRun sql/scene-tokens-player-update-objects.sql in Supabase to allow players to damage object tokens in scenes they're part of.\n\nUntil then, players attacking barrels/crates will see damage in the log but the object stays full-health.`)
        }
        setMapTokens(prev => prev.map(t => t.id === targetObject.id ? { ...t, wp_current: newWP } : t))

        // Auto-loot: when object is destroyed, give its contents to the attacker (PC or NPC)
        if (newWP === 0 && curWP > 0) {
          const { data: fullToken } = await supabase.from('scene_tokens').select('contents').eq('id', targetObject.id).single()
          const contents: { type: string; name: string; quantity: number }[] = fullToken?.contents ?? []
          console.warn('[auto-loot] crate destroyed', targetObject.name, 'contents:', contents.length)
          if (contents.length > 0) {
            const active = initiativeOrder.find(ie => ie.is_active)
            // Prefer the active combatant; fall back to the current user's PC
            // so out-of-combat attacks (no initiative running) still route
            // loot into the right inventory instead of dropping it.
            const attackerEntry = (active ? entries.find(e => e.character.id === active.character_id) : null)
              ?? entries.find(e => e.userId === userId)
            const attackerNpc = active && !attackerEntry && active.npc_id
              ? (rosterNpcs.find(n => n.id === active.npc_id) ?? campaignNpcs.find((n: any) => n.id === active.npc_id))
              : null
            console.warn('[auto-loot] attackerEntry:', attackerEntry?.character?.name, 'attackerNpc:', (attackerNpc as any)?.name)
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
              // Defer log — inserted after saveRollToLog so feed order reads
              // attack → loot instead of loot → attack (see pendingLootLogs).
              pendingLootLogs.push({
                campaign_id: id, user_id: userId, character_name: attackerEntry.character.name,
                label: `🎒 ${attackerEntry.character.name} looted ${lootedNames.join(', ')} from ${targetObject.name}`,
                die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'loot',
              })
              initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
              traitNotes.push(`Destroyed ${targetObject.name} — looted: ${lootedNames.join(', ')}`)
            } else if (attackerNpc) {
              const npcInv: InventoryItem[] = (attackerNpc as any).inventory ?? []
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
              // Defer log — see pendingLootLogs declaration.
              pendingLootLogs.push({
                campaign_id: id, user_id: userId, character_name: attackerNpc.name,
                label: `🎒 ${attackerNpc.name} looted ${lootedNames.join(', ')} from ${targetObject.name}`,
                die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'loot',
              })
              // Reflect the updated inventory in local state so the NPC card shows it without refetch
              setCampaignNpcs(prev => prev.map(n => n.id === attackerNpc.id ? { ...n, inventory: newInv } : n))
              setRosterNpcs(prev => prev.map(n => n.id === attackerNpc.id ? { ...n, inventory: newInv } as CampaignNpc : n))
              initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
              traitNotes.push(`Destroyed ${targetObject.name} — ${attackerNpc.name} looted: ${lootedNames.join(', ')}`)
            }
          }
        }
      } else if (grenadeTargetCell) {
        // Grenade thrown at an empty cell — no "primary target" to damage,
        // the blast block below picks up the cell coords and splashes
        // everyone in range. Intentional that damageResult still shows
        // the rolled WP/RP so the UI's damage card reads correctly.
        console.warn('[damage] cell-throw — primary damage skipped, blast AoE will handle tokens around', grenadeTargetCell)
      } else {
        console.warn('[damage] no target resolved — damage NOT applied. targetName was:', targetName)
      }

      // Blast Radius AoE — apply scaled damage to nearby tokens on the
      // tactical map. Center is the target token by default, or the
      // cell the player clicked when it's a grenade throw-to-cell.
      if (hasBlast && mapTokens.length > 0 && (targetName || grenadeTargetCell || blastCenterOverride)) {
        const active = initiativeOrder.find(ie => ie.is_active)
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
          const blastTargets: string[] = []
          for (const tok of mapTokens) {
            // Include PC/NPC tokens AND destructible objects (wp_max != null)
            // per playtest #17 — grenades should hit barrels/crates in the
            // blast area too, not just combatants. Indestructible tokens
            // (wp_max=null, decorative) are still skipped.
            const isCombatant = !!tok.character_id || !!tok.npc_id
            const isDestructibleObject = tok.token_type === 'object' && tok.wp_max != null && tok.wp_max > 0
            if (!isCombatant && !isDestructibleObject) continue
            // Skip primary target (already damaged via token path) and
            // attacker. For cell-throws (grenadeTargetCell) and grenade
            // fumbles, there IS no primary — the impact is just empty
            // ground — so tokens AT the center cell should take full
            // blast damage instead of being skipped. isPrimary only
            // fires for clean token-targeted attacks.
            const isPrimary = !grenadeTargetCell && !isGrenadeFumble && (
              (targetEntry && tok.character_id && tok.character_id === targetEntry.character.id) ||
              (targetNpc && tok.npc_id && tok.npc_id === targetNpc.id) ||
              (targetObject && tok.id === targetObject.id) ||
              (tok.grid_x === targetTok.grid_x && tok.grid_y === targetTok.grid_y)
            )
            // Per CRB p.71-72: the blast damages everyone in radius —
            // no carve-out for the thrower. Standing in your own blast
            // is intentionally brutal (the throw modal warns first via
            // the friendly-fire confirm in TacticalMap). Only the
            // primary target is skipped here because they take damage
            // through the named-attack path above.
            if (isPrimary) continue
            const dist = Math.max(Math.abs(tok.grid_x - targetTok.grid_x), Math.abs(tok.grid_y - targetTok.grid_y))
            const feet = dist * ft
            // Per playtest 2026-04-27: drop the Medium 25% tier. Grenades
            // stay dangerous to throwers but stop killing bystanders 50ft+
            // away through walls. Engaged = full, Close = half, beyond
            // Close = nothing. The Medium tier may come back later if
            // larger explosives (RPG, mortar) need it.
            if (feet > 30) continue
            const scale = feet <= 5 ? 1.0 : 0.5
            // Splash uses raw blast WP/RP — see CRB note where blastRawWP
            // is computed. Splash victims don't inherit primary's mitigation.
            const splashWP = Math.max(1, Math.floor(blastRawWP * scale))
            const splashRP = Math.max(0, Math.floor(blastRawRP * scale))
            const splashPC = entries.find(e => e.character.id === tok.character_id)
            const splashNpc = campaignNpcs.find((n: any) => n.id === tok.npc_id)
            const splashName = splashPC?.character.name ?? splashNpc?.name ?? tok.name
            const rangeBandLabel = feet <= 5 ? 'Engaged' : feet <= 30 ? 'Close' : 'Far'
            if (splashPC?.liveState) {
              const { data: freshState } = await supabase.from('character_states').select('*').eq('id', splashPC.stateId).single()
              const curWP = freshState?.wp_current ?? splashPC.liveState.wp_current
              const curRP = freshState?.rp_current ?? splashPC.liveState.rp_current
              const curStress = freshState?.stress ?? splashPC.liveState.stress ?? 0
              const nWP = Math.max(0, curWP - splashWP)
              const nRP = Math.max(0, curRP - splashRP)
              const update: any = { wp_current: nWP, rp_current: nRP, updated_at: new Date().toISOString() }
              let splashStressReason: string | null = null
              if (nWP === 0 && curWP > 0) {
                update.death_countdown = Math.max(1, 4 + (splashPC.character.data?.rapid?.PHY ?? 0))
                update.stress = Math.min(5, curStress + 1)
                splashStressReason = 'Mortally Wounded'
              }
              if (nRP === 0 && curRP > 0 && nWP > 0) {
                update.incap_rounds = Math.max(1, 4 - (splashPC.character.data?.rapid?.PHY ?? 0))
                update.stress = Math.min(5, curStress + 1)
                splashStressReason = 'Incapacitated'
              }
              await supabase.from('character_states').update(update).eq('id', splashPC.stateId)
              setEntries(prev => prev.map(e => e.stateId === splashPC.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
              initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: { stateId: splashPC.stateId, patch: update } })
              if (splashStressReason) {
                await supabase.from('roll_log').insert({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `😰 ${splashName} gains a Stress from being ${splashStressReason}`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
                })
              }
              blastTargets.push(`${splashName} (${rangeBandLabel}): ${splashWP} WP, ${splashRP} RP`)
            } else if (splashNpc) {
              const curWP = splashNpc.wp_current ?? splashNpc.wp_max ?? 10
              const curRP = splashNpc.rp_current ?? splashNpc.rp_max ?? 6
              const nWP = Math.max(0, curWP - splashWP)
              const nRP = Math.max(0, curRP - splashRP)
              const npcUpd: any = { wp_current: nWP, rp_current: nRP }
              if (nWP === 0 && curWP > 0) npcUpd.death_countdown = Math.max(1, 4 + (splashNpc.physicality ?? 0))
              if (nRP === 0 && curRP > 0 && nWP > 0) npcUpd.incap_rounds = Math.max(1, 4 - (splashNpc.physicality ?? 0))
              await supabase.from('campaign_npcs').update(npcUpd).eq('id', splashNpc.id)
              setCampaignNpcs(prev => prev.map(n => n.id === splashNpc.id ? { ...n, ...npcUpd } : n))
              initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId: splashNpc.id, patch: npcUpd } })
              blastTargets.push(`${splashName} (${rangeBandLabel}): ${splashWP} WP, ${splashRP} RP`)
            } else if (tok.token_type === 'object' && tok.wp_max != null) {
              // Object splash — barrels, crates, etc. get scaled WP damage
              // same as combatants. No RP (objects only track integrity).
              // Per playtest #17.
              const curWP = tok.wp_current ?? tok.wp_max
              const nWP = Math.max(0, curWP - splashWP)
              await supabase.from('scene_tokens').update({ wp_current: nWP }).eq('id', tok.id).select('id')
              setMapTokens(prev => prev.map(t => t.id === tok.id ? { ...t, wp_current: nWP } : t))
              initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
              blastTargets.push(`${tok.name} (${rangeBandLabel}): ${splashWP} WP`)
            }
          }
          if (blastTargets.length > 0) {
            traitNotes.push(`Blast hit: ${blastTargets.join(' | ')}`)
          }
        }
      }
    }

    // Weapon jam/break on Low Insight
    let weaponJammed = false
    if (pendingRoll.weapon && pendingRoll.weapon.weaponName !== 'Unarmed' && outcome === 'Low Insight') {
      weaponJammed = true
      // Degrade the weapon condition on the character's data
      if (myEntry) {
        const charData = myEntry.character.data ?? {}
        const slots = ['weaponPrimary', 'weaponSecondary'] as const
        for (const slot of slots) {
          if (charData[slot]?.weaponName === pendingRoll.weapon.weaponName) {
            const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
            const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
            const newCondition = conditions[Math.min(currentIdx + 1, conditions.length - 1)]
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: newCondition } }
            }).eq('id', myEntry.character.id)
            break
          }
        }
      }
    }

    // Upkeep Check result — adjust weapon condition
    let upkeepResult = ''
    if (pendingRoll.label.startsWith('Upkeep — ') && myEntry) {
      const weaponName = pendingRoll.label.replace('Upkeep — ', '')
      const charData = myEntry.character.data ?? {}
      const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
      const slots = ['weaponPrimary', 'weaponSecondary'] as const
      for (const slot of slots) {
        if (charData[slot]?.weaponName === weaponName) {
          const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
          let newIdx = currentIdx
          if (outcome === 'Wild Success') { newIdx = Math.max(1, currentIdx - 1); upkeepResult = 'Condition improved by 1 level' }
          else if (outcome === 'High Insight') { newIdx = Math.max(1, currentIdx - 2); upkeepResult = 'Condition improved by 2 levels' }
          else if (outcome === 'Failure') { newIdx = Math.min(4, currentIdx + 1); upkeepResult = 'Condition degraded by 1 level' }
          else if (outcome === 'Dire Failure') { newIdx = 4; upkeepResult = 'Item breaks immediately!' }
          else if (outcome === 'Low Insight') {
            newIdx = 4; upkeepResult = 'Item breaks immediately! 1 WP damage.'
            if (myEntry.liveState) {
              const newWP = Math.max(0, myEntry.liveState.wp_current - 1)
              const upkeepUpdate: any = { wp_current: newWP }
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                upkeepUpdate.death_countdown = Math.max(1, 4 + (myEntry.character.data?.rapid?.PHY ?? 0))
                upkeepUpdate.stress = Math.min(5, (myEntry.liveState.stress ?? 0) + 1)
              }
              await supabase.from('character_states').update(upkeepUpdate).eq('id', myEntry.stateId)
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                await supabase.from('roll_log').insert({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `😰 ${myEntry.character.name} gains a Stress from being Mortally Wounded`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
                })
              }
            }
          }
          else { upkeepResult = 'No change to condition' }
          if (newIdx !== currentIdx) {
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: conditions[newIdx] } }
            }).eq('id', myEntry.character.id)
          }
          break
        }
      }
    }

    // Unjam result — adjust weapon condition (same logic as Upkeep)
    let unjamResult = ''
    if (pendingRoll.label.startsWith('Unjam — ') && myEntry) {
      const weaponName = pendingRoll.label.replace(/^Unjam — (.+?) \(.+\)$/, '$1')
      const charData = myEntry.character.data ?? {}
      const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
      const slots = ['weaponPrimary', 'weaponSecondary'] as const
      for (const slot of slots) {
        if (charData[slot]?.weaponName === weaponName) {
          const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
          let newIdx = currentIdx
          if (outcome === 'Wild Success') { newIdx = Math.max(1, currentIdx - 1); unjamResult = 'Condition improved by 1 level' }
          else if (outcome === 'High Insight') { newIdx = Math.max(1, currentIdx - 2); unjamResult = 'Condition improved by 2 levels' }
          else if (outcome === 'Success') { newIdx = Math.max(currentIdx - 1, 2); unjamResult = currentIdx > 2 ? 'Unjammed — condition partially restored' : 'No change' }
          else if (outcome === 'Failure') { unjamResult = 'Failed to unjam — no change' }
          else if (outcome === 'Dire Failure') { newIdx = 4; unjamResult = 'Weapon breaks!' }
          else if (outcome === 'Low Insight') {
            newIdx = 4; unjamResult = 'Weapon breaks! 1 WP damage.'
            if (myEntry.liveState) {
              const newWP = Math.max(0, myEntry.liveState.wp_current - 1)
              const unjamUpdate: any = { wp_current: newWP }
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                unjamUpdate.death_countdown = Math.max(1, 4 + (myEntry.character.data?.rapid?.PHY ?? 0))
                unjamUpdate.stress = Math.min(5, (myEntry.liveState.stress ?? 0) + 1)
              }
              await supabase.from('character_states').update(unjamUpdate).eq('id', myEntry.stateId)
              if (newWP === 0 && myEntry.liveState.wp_current > 0) {
                await supabase.from('roll_log').insert({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `😰 ${myEntry.character.name} gains a Stress from being Mortally Wounded`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
                })
              }
            }
          }
          else { unjamResult = 'No change' }
          if (newIdx !== currentIdx) {
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: conditions[newIdx] } }
            }).eq('id', myEntry.character.id)
          }
          break
        }
      }
    }

    // Distract result — outcome scaling per CRB §06 Combat Actions:
    //   Success                    → target loses 1 Combat Action
    //   Wild Success / High Insight → target loses BOTH Combat Actions
    //   Failure / Low Insight       → no effect (active still pays the
    //                                 attempt's action cost)
    //   Dire Failure                → target gains 1 action ("becomes
    //                                 Inspired", per CRB)
    //
    // Target comes from the modal's targetName state (dropdown selection),
    // not from the label.
    let distractResult = ''
    if (pendingRoll.label.endsWith(' — Distract')) {
      const dtTargetName = targetName
      const dtTargetEntry = dtTargetName ? initiativeOrder.find(e => e.character_name === dtTargetName) : null
      if (dtTargetEntry) {
        const cur = dtTargetEntry.actions_remaining ?? 0
        let delta = 0
        if (outcome === 'Wild Success' || outcome === 'High Insight') delta = -2
        else if (outcome === 'Success') delta = -1
        else if (outcome === 'Dire Failure') delta = 1
        if (delta !== 0) {
          const newActions = Math.max(0, cur + delta)
          // .select() echo so we can detect a silent RLS rejection — same
          // pattern as consumeAction. Without this, an RLS gap on
          // initiative_order silently drops the update and Distract
          // looks like it did nothing.
          const { data: distractRows, error: distractErr } = await supabase
            .from('initiative_order')
            .update({ actions_remaining: newActions })
            .eq('id', dtTargetEntry.id)
            .select('id, actions_remaining')
          if (distractErr) console.error('[distract] update error:', distractErr.message)
          else if (!distractRows || distractRows.length === 0) console.warn('[distract] SILENT RLS FAIL — target actions_remaining not updated. Run sql/initiative-order-rls-members-write.sql.')
          else {
            // Broadcast turn_changed so all clients refresh immediately
            // even if the postgres_changes UPDATE is delayed.
            initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
            if (delta === -2) distractResult = `${dtTargetName} loses BOTH actions this turn.`
            else if (delta === -1) distractResult = `${dtTargetName} loses 1 action.`
            else distractResult = `${dtTargetName} shrugs it off and gains an action — Inspired!`
          }
        } else {
          distractResult = `${dtTargetName} shrugged off the distraction.`
        }
      }
    }

    // Stabilize result — stop death countdown on success (PC or NPC)
    let stabilizeResult = ''
    if (pendingRoll.label.includes('Stabilize ')) {
      const stTargetName = pendingRoll.label.split('Stabilize ')[1]
      const targetEntry = entries.find(e => e.character.name === stTargetName)
      const targetNpcStab = campaignNpcs.find((n: any) => n.name === stTargetName)
      if (targetEntry?.liveState && targetEntry.liveState.wp_current === 0) {
        // PC stabilization
        if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
          const phyAmod = targetEntry.character.data?.rapid?.PHY ?? 0
          const incapRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - phyAmod)
          await supabase.from('character_states').update({ death_countdown: null, incap_rounds: incapRounds, updated_at: new Date().toISOString() }).eq('id', targetEntry.stateId)
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, death_countdown: null, incap_rounds: incapRounds } as any } : e))
          stabilizeResult = `${stTargetName} stabilized! Incapacitated for ${incapRounds} round${incapRounds !== 1 ? 's' : ''}, then regains 1 WP + 1 RP.`
        } else {
          stabilizeResult = `Failed to stabilize ${stTargetName}.`
        }
      } else if (targetNpcStab && (targetNpcStab.wp_current ?? targetNpcStab.wp_max ?? 10) === 0) {
        // NPC stabilization
        if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
          const phyAmod = targetNpcStab.physicality ?? 0
          const incapRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - phyAmod)
          await supabase.from('campaign_npcs').update({ death_countdown: null, incap_rounds: incapRounds }).eq('id', targetNpcStab.id)
          const npcPatch = { death_countdown: null, incap_rounds: incapRounds }
          setCampaignNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } : n))
          setRosterNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } : n))
          setViewingNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } as CampaignNpc : n))
          stabilizeResult = `${stTargetName} stabilized! Incapacitated for ${incapRounds} round${incapRounds !== 1 ? 's' : ''}, then regains 1 WP + 1 RP.`
        } else {
          stabilizeResult = `Failed to stabilize ${stTargetName}.`
        }
      }
    }

    // Sprint result — failure = winded next round
    // Log trimming: we embed the raw Athletics-roll dice/mods into the
    // sprint outcome entry's damage_json as a `trimmedRoll` blob, and
    // skip the normal saveRollToLog write (see `skipSaveRollToLog` flag
    // below). Renderers show the banner as the default view with a
    // "more info" expand toggle that unpacks trimmedRoll into the full
    // breakdown. This is the prototype for the log-trimming pattern —
    // Stabilize / Coordinate / Unjam / etc. can reuse the same shape.
    let sprintResult = ''
    if (pendingRoll.label.includes('Sprint')) {
      // Find the sprinting combatant by name (not active entry — turn may have advanced after pre-consume)
      const sprintName = pendingRoll.label.split(' — ')[0]
      const sprintInit = initiativeOrder.find(e => e.character_name === sprintName)
      const trimmedRoll = {
        die1, die2,
        // Carry the full 3d6 breakdown when an Insight Die was spent —
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
        await supabase.from('roll_log').insert({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `🏃 ${characterName} sprinted and seems to be out of breath.`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'sprint',
          damage_json: { trimmedRoll, winded: outcome === 'Failure' || outcome === 'Dire Failure' } as any,
        })
      } else {
        sprintResult = `${characterName} does not seem to be winded.`
        await supabase.from('roll_log').insert({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `🏃 ${characterName} sprinted and does not seem to be winded.`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'sprint',
          damage_json: { trimmedRoll, winded: outcome === 'Failure' || outcome === 'Dire Failure' } as any,
        })
      }
      // Sprint log written — release the pending-Athletics gate. If
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

    // Coordinate result — apply +2 to allies within Close range when attacking that target
    let coordinateResult = ''
    if (coordinateTargetRef.current && pendingRoll.label.includes('Coordinate')) {
      const coordTarget = coordinateTargetRef.current
      if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
        // Find allies within Close range (≤30ft) of the coordinator
        const activeInit = initiativeOrder.find(e => e.is_active)
        const coordTok = mapTokens.find(t =>
          (activeInit?.character_id && t.character_id === activeInit.character_id) ||
          (activeInit?.npc_id && t.npc_id === activeInit.npc_id)
        )
        const bonus = 2
        let appliedTo: string[] = []
        for (const ally of initiativeOrder) {
          if (ally.id === activeInit?.id) continue // skip self
          if (ally.character_name === coordTarget) continue // skip the target
          // Check range if tokens exist
          if (coordTok && mapTokens.length > 0) {
            const allyTok = mapTokens.find(t =>
              (ally.character_id && t.character_id === ally.character_id) ||
              (ally.npc_id && t.npc_id === ally.npc_id)
            )
            if (allyTok) {
              const dist = Math.max(Math.abs(coordTok.grid_x - allyTok.grid_x), Math.abs(coordTok.grid_y - allyTok.grid_y))
              const feet = dist * mapCellFeet
              if (feet > 30) continue // not within Close range
            }
          }
          await supabase.from('initiative_order').update({ coordinate_target: coordTarget, coordinate_bonus: bonus }).eq('id', ally.id)
          appliedTo.push(ally.character_name)
        }
        if (appliedTo.length > 0) {
          coordinateResult = `${appliedTo.join(', ')} get${appliedTo.length === 1 ? 's' : ''} +${bonus} CMod when attacking ${coordTarget}${outcome === 'Wild Success' ? ' (carries +1 next round)' : ''}.`
          // Log trimming: one summary row instead of one row per ally
          // (used to write N rows for N allies, which cluttered the
          // feed). Names are joined into a single banner; the underlying
          // initiative_order.coordinate_bonus update is what actually
          // grants the CMod, so dropping the per-ally rows is purely
          // cosmetic.
          await supabase.from('roll_log').insert({
            campaign_id: id, user_id: userId, character_name: 'System',
            label: `🎯 ${appliedTo.join(', ')} get${appliedTo.length === 1 ? 's' : ''} +${bonus} CMod when attacking ${coordTarget}`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'coordinate',
          })
        } else {
          coordinateResult = 'No allies within Close range to receive the bonus.'
        }
      } else {
        coordinateResult = 'Coordination failed — no bonus applied.'
      }
      coordinateTargetRef.current = null
    }

    // Log trimming (see Sprint block above): some actions consolidate their
    // dice breakdown INTO the outcome banner's damage_json instead of writing
    // a separate roll_log row. If this is one of those rolls, skip the
    // standalone saveRollToLog write — otherwise the feed would show both
    // the raw Athletics check AND the sprint banner.
    const isTrimmedRoll = pendingRoll.label.includes('Sprint')
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
      // (label "<X> — Distract", target stored on r.target_name) the
      // expanded line auto-formats as "Distract → <target>". Don't
      // mutate the label here or the target gets duplicated:
      // "Distract → <target> → <target>" (caught 2026-04-29).
      await saveRollToLog(die1, die2, pendingRoll.amod, pendingRoll.smod, cmodVal, pendingRoll.label, characterName, false, targetName || null, damageResult, insightUsedValue)
    }
    // Now that the attack row is in, drain any auto-loot log rows queued
    // during damage processing. Awaiting this serializes after the attack
    // insert so the attack row's created_at strictly precedes the loot's,
    // keeping "used X on Y → looked through the remains of Y" feed order.
    if (pendingLootLogs.length > 0) {
      const { error: lootErr } = await supabase.from('roll_log').insert(pendingLootLogs)
      if (lootErr) console.error('[auto-loot] log insert error:', lootErr.message)
    }

    // First Impression — write outcome to npc_relationships.relationship_cmod.
    // Outcome → CMod mapping:
    //   Moment of High Insight / Wild Success → +2
    //   Success                              → +1
    //   Failure                              →  0 (no change recorded, but
    //     we still upsert revealed=true so the NPC appears in the PC's
    //     sidebar going forward)
    //   Dire Failure                         → -1
    //   Moment of Low Insight                → -2
    // Overwrites any existing row for (npc, character) — First Impression
    // is the opening-scene vibe; a re-roll replaces. GM can hand-edit
    // later via NpcRoster if they need to tune.
    const firstImpressionTarget = firstImpressionTargetRef.current
    if (firstImpressionTarget && pendingRoll.label.includes('First Impression')) {
      const cmodDelta = (outcome === 'High Insight' || outcome === 'Wild Success') ? 2
        : outcome === 'Success' ? 1
        : outcome === 'Failure' ? 0
        : outcome === 'Dire Failure' ? -1
        : outcome === 'Low Insight' ? -2
        : 0
      try {
        const { data: existing } = await supabase
          .from('npc_relationships')
          .select('id, revealed, reveal_level')
          .eq('npc_id', firstImpressionTarget.npcId)
          .eq('character_id', firstImpressionTarget.characterId)
          .maybeSingle()
        if (existing) {
          await supabase.from('npc_relationships')
            .update({
              relationship_cmod: cmodDelta,
              revealed: true,
              reveal_level: existing.reveal_level || 'name_portrait',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('npc_relationships').insert({
            npc_id: firstImpressionTarget.npcId,
            character_id: firstImpressionTarget.characterId,
            relationship_cmod: cmodDelta,
            revealed: true,
            reveal_level: 'name_portrait',
          })
        }
        // Local refresh so the sidebar + cards pick up the new CMod
        // without waiting on a realtime broadcast.
        if (myCharIdRef.current) {
          void loadRevealedNpcs(myCharIdRef.current, campaignNpcs)
        }
      } catch (err) {
        console.error('[first-impression] relationship upsert failed:', err)
      }
      firstImpressionTargetRef.current = null
    }

    setRollResult({
      die1, die2, amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, label: pendingRoll.label, insightAwarded, insightUsed: preRollSpent ? 'pre' : null,
      damage: damageResult, weaponJammed, traitNotes: [...traitNotes, ...(upkeepResult ? [upkeepResult] : []), ...(unjamResult ? [unjamResult] : []), ...(stabilizeResult ? [stabilizeResult] : []), ...(distractResult ? [distractResult] : []), ...(sprintResult ? [sprintResult] : []), ...(coordinateResult ? [coordinateResult] : [])],
      diceRolled: insightDiceRolled,
    } as any)

    setRolling(false)
    // Clear the cell target AFTER the damage pass has consumed it — the
    // next attack (even with the same grenade) starts fresh and the
    // player has to pick a new cell.
    setGrenadeTargetCell(null)
    await Promise.all([loadEntries(id), rollsFeed.refetch()])
  }

  async function spendInsightDie(rerollDie: 'die1' | 'die2' | 'both') {
    if (!rollResult || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    if (!myEntry?.liveState) return

    const cost = rerollDie === 'both' ? 2 : 1
    if (myEntry.liveState.insight_dice < cost) return

    setRolling(true)

    const newInsight = myEntry.liveState.insight_dice - cost
    await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    void appendProgressionLog(myEntry.character.id, 'insight', `Spent ${cost} Insight Die${cost > 1 ? 's' : ''} — reroll ${rerollDie === 'both' ? 'both dice' : rerollDie === 'die1' ? 'die 1' : 'die 2'}`)

    const newDie1 = rerollDie === 'die2' ? rollResult.die1 : rollD6()
    const newDie2 = rerollDie === 'die1' ? rollResult.die2 : rollD6()
    const rerollLabelParts = rollResult.label.split(' — ')
    const characterName = rerollLabelParts.length > 1 ? rerollLabelParts[0] : (myEntry.character.name ?? 'Unknown')

    const { total, outcome, insightAwarded } = await saveRollToLog(newDie1, newDie2, rollResult.amod, rollResult.smod, rollResult.cmod, rollResult.label, characterName, true, targetName || null)

    if (insightAwarded) {
      await supabase.from('character_states').update({ insight_dice: newInsight + 1, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    // Calculate and apply damage if the reroll turned a failure into a hit
    let rerollDamage: DamageResult | undefined
    if (pendingRoll?.weapon && targetName && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')) {
      const weapon = pendingRoll.weapon
      const w = getWeaponByName(weapon.weaponName)
      const isMelee = w?.category === 'melee' || weapon.weaponName === 'Unarmed'
      const targetInitEntry = initiativeOrder.find(e => e.character_name === targetName)
      const targetEntry = entries.find(e => e.character.name === targetName) ?? (targetInitEntry?.character_id ? entries.find(e => e.character.id === targetInitEntry.character_id) : undefined)
      const targetNpcObj = !targetEntry
        ? (targetInitEntry?.is_npc
            ? (rosterNpcs.find(n => n.id === targetInitEntry.npc_id) ?? campaignNpcs.find((n: any) => n.id === targetInitEntry.npc_id))
            : (campaignNpcs.find((n: any) => n.name === targetName) ?? rosterNpcs.find(n => n.name === targetName)))
        : null
      const targetObjectReroll = (!targetEntry && !targetNpcObj) ? mapTokens.find(t => t.token_type === 'object' && t.name === targetName && (t.wp_max ?? 0) > 0) : null
      const targetRapid = targetEntry?.character.data?.rapid ?? (targetNpcObj ? { PHY: targetNpcObj.physicality ?? 0, DEX: targetNpcObj.dexterity ?? 0 } : {})
      const targetDefBonus2 = targetInitEntry?.defense_bonus ?? 0
      const defensiveMod = targetObjectReroll ? 0 : ((isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)) + targetDefBonus2)

      const attackerPhy = myEntry.character.data?.rapid?.PHY ?? 0
      const dmg = rollDamage(weapon.damage, attackerPhy, !!isMelee)
      const unarmedBonus = weapon.weaponName === 'Unarmed' ? rollResult.smod : 0
      const { finalWP, finalRP, mitigated } = calculateDamage(dmg.totalWP + unarmedBonus, weapon.rpPercent, defensiveMod)

      rerollDamage = { base: dmg.base, diceRoll: dmg.diceRoll, diceDesc: dmg.diceDesc, phyBonus: dmg.phyBonus, totalWP: dmg.totalWP + unarmedBonus, finalWP, finalRP, mitigated, targetName }

      // Apply damage to target
      if (targetEntry?.liveState) {
        const tNewWP = Math.max(0, targetEntry.liveState.wp_current - finalWP)
        const tNewRP = Math.max(0, targetEntry.liveState.rp_current - finalRP)
        const update: any = { wp_current: tNewWP, rp_current: tNewRP, updated_at: new Date().toISOString() }
        let rerollStressReason: string | null = null
        if (tNewWP === 0 && targetEntry.liveState.wp_current > 0) {
          update.death_countdown = Math.max(1, 4 + (targetEntry.character.data?.rapid?.PHY ?? 0))
          update.stress = Math.min(5, (targetEntry.liveState.stress ?? 0) + 1)
          rerollStressReason = 'Mortally Wounded'
        }
        if (tNewRP === 0 && targetEntry.liveState.rp_current > 0 && tNewWP > 0) {
          update.incap_rounds = Math.max(1, 4 - (targetEntry.character.data?.rapid?.PHY ?? 0))
          update.stress = Math.min(5, (targetEntry.liveState.stress ?? 0) + 1)
          rerollStressReason = 'Incapacitated'
        }
        await supabase.from('character_states').update(update).eq('id', targetEntry.stateId)
        setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
        initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: { stateId: targetEntry.stateId, patch: update } })
        if (rerollStressReason) {
          await supabase.from('roll_log').insert({
            campaign_id: id, user_id: userId, character_name: 'System',
            label: `😰 ${targetEntry.character.name} gains a Stress from being ${rerollStressReason}`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'stress',
          })
        }
      } else if (targetNpcObj) {
        const tNpcWP = targetNpcObj.wp_current ?? targetNpcObj.wp_max ?? 10
        const tNpcRP = targetNpcObj.rp_current ?? targetNpcObj.rp_max ?? 6
        const tNewWP = Math.max(0, tNpcWP - finalWP)
        const tNewRP = Math.max(0, tNpcRP - finalRP)
        const npcUpdate: any = { wp_current: tNewWP, rp_current: tNewRP }
        if (tNewWP === 0 && tNpcWP > 0) npcUpdate.death_countdown = Math.max(1, 4 + (targetNpcObj.physicality ?? 0))
        if (tNewRP === 0 && tNpcRP > 0 && tNewWP > 0) npcUpdate.incap_rounds = Math.max(1, 4 - (targetNpcObj.physicality ?? 0))
        await supabase.from('campaign_npcs').update(npcUpdate).eq('id', targetNpcObj.id)
        const npcId = targetNpcObj.id
        const patch = { ...npcUpdate }
        npcFetchInFlightRef.current = true
        setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
        setTimeout(() => { npcFetchInFlightRef.current = false }, 500)
        initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId, patch } })
      } else if (targetObjectReroll) {
        const curWP = targetObjectReroll.wp_current ?? targetObjectReroll.wp_max ?? 0
        const newWP = Math.max(0, curWP - finalWP)
        await supabase.from('scene_tokens').update({ wp_current: newWP }).eq('id', targetObjectReroll.id)
        setMapTokens(prev => prev.map(t => t.id === targetObjectReroll.id ? { ...t, wp_current: newWP } : t))
      }

      // Save damage to log
      await saveRollToLog(newDie1, newDie2, rollResult.amod, rollResult.smod, rollResult.cmod, rollResult.label, characterName, true, targetName, rerollDamage)
    }

    const prev = (rollResult as any).insightUsed as RollResult['insightUsed']
    let nextInsightUsed: RollResult['insightUsed']
    if (rerollDie === 'both') nextInsightUsed = 'both'
    else if (prev === 'die1' || prev === 'die2') nextInsightUsed = 'both'
    else nextInsightUsed = rerollDie
    setRollResult({ ...rollResult, die1: newDie1, die2: newDie2, total, outcome, insightAwarded, insightUsed: nextInsightUsed, damage: rerollDamage ?? (rollResult as any).damage })
    setRolling(false)
    await Promise.all([loadEntries(id), rollsFeed.refetch()])
  }

  async function closeRollModal() {
    // Use ref (synchronous, immune to React batching) to determine if a roll
    // was actually executed — rollResult state can be stale in closures.
    const didRoll = rollExecutedRef.current
    const preConsumed = actionPreConsumedRef.current
    const cost = actionCostRef.current
    rollExecutedRef.current = false
    actionPreConsumedRef.current = false
    actionCostRef.current = 1
    // Modal close is the ultimate backstop for clearing Sprint-Athletics
    // pending flags. Normally the sprint branch inside executeRoll clears
    // them itself, but if the player cancels the modal without rolling
    // we'd otherwise leak `true` into the next round's nextTurn and block
    // the reroll forever.
    if (sprintAthleticsPendingRef.current) {
      sprintAthleticsPendingRef.current = false
      if (sprintAthleticsRoundDeferredRef.current) {
        sprintAthleticsRoundDeferredRef.current = false
        void nextTurn()
      }
    }
    // If the player cancels a grenade throw-to-cell from the modal,
    // clear the cell target so a retry doesn't auto-roll at the same
    // coords. executeRoll also clears this on success; this is the
    // cancel path.
    setGrenadeTargetCell(null)
    setPendingRoll(null)
    setRollResult(null)

    console.warn('[closeRollModal] didRoll:', didRoll, 'combatActive:', combatActive, 'preConsumed:', preConsumed, 'cost:', cost)
    // Consume action(s) if a roll was actually executed.
    // Skip if the action was already pre-consumed (Stabilize/Unjam).
    if (didRoll && combatActive && !preConsumed) {
      // Re-fetch active entry from DB to avoid stale closure state
      const { data: freshOrder, error: foErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).eq('is_active', true).limit(1)
      if (foErr) console.warn('[closeRollModal] active fetch error:', foErr.message)
      const activeEntry = freshOrder?.[0]
      console.warn('[closeRollModal] activeEntry:', activeEntry?.character_name, 'user_id:', activeEntry?.user_id, 'me:', userId, 'isGM:', isGM, 'is_npc:', activeEntry?.is_npc)
      if (activeEntry) {
        const isMyTurn = activeEntry.user_id === userId
        const isGMRollingNPC = isGM && activeEntry.is_npc
        const isGMRollingPC = isGM && !activeEntry.is_npc
        if (isMyTurn || isGMRollingNPC || isGMRollingPC) {
          // Track last attack target for same-target +1 CMod bonus AND
          // for pre-selecting the same target on the next Attack modal
          // (playtest: "the next time they attack the Attack Modal should
          // automatically select the same target a second time").
          if (pendingRoll?.weapon && targetName) {
            await supabase.from('initiative_order').update({ last_attack_target: targetName }).eq('id', activeEntry.id)
            // Clear any stale map-click target so the next Attack modal
            // open falls through to `last_attack_target` (the just-
            // attacked target) instead of re-using whatever token the
            // player happened to click on the map before rolling. The
            // map-selection priority was pre-empting same-target recall
            // across consecutive attacks.
            setSelectedMapTargetName(null)
          }
          await consumeAction(activeEntry.id, undefined, cost)
        } else {
          console.warn('[closeRollModal] not consuming — not my turn / not GM authority')
        }
      } else {
        console.warn('[closeRollModal] no active entry found')
      }
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function getCharPhoto(entry: TableEntry): string | null {
    return entry.character?.data?.photoDataUrl ?? null
  }

  if (loading || !campaign) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif', color: '#cce0f5', background: '#0f0f0f' }}>
      Loading The Table...
    </div>
  )

  // Header cascade renderer. Hover the trigger → sub-items unfold
  // inline to the right as sibling pill buttons. Click the trigger
  // also toggles (for touch/keyboard). Each sub-item keeps the same
  // pill style with its own text color; only the trigger has the
  // chevron. No dropdown panel — feels like the buttons are physically
  // extending out of the trigger.
  const renderHeaderMenu = (
    id: string,
    label: string,
    items: Array<{ label: string; onClick: () => void; color?: string; hidden?: boolean }>,
    btnStyle: React.CSSProperties,
  ) => {
    const isOpen = openHeaderMenu === id
    const visibleItems = items.filter(i => !i.hidden)
    if (visibleItems.length === 0) return null
    return (
      <div data-header-menu={id}
        onMouseEnter={() => { if (!isMenuPinned) setOpenHeaderMenu(id) }}
        onMouseLeave={() => { if (!isMenuPinned) setOpenHeaderMenu(prev => prev === id ? null : prev) }}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button onClick={() => {
          // Clicking the trigger toggles a pinned state — stays open
          // even when the mouse wanders off, until clicked again or
          // clicked outside.
          if (openHeaderMenu === id && isMenuPinned) {
            setIsMenuPinned(false)
            setOpenHeaderMenu(null)
          } else {
            setIsMenuPinned(true)
            setOpenHeaderMenu(id)
          }
        }}
          className={`hdr-btn${isOpen ? ' hdr-btn--active' : ''}`}
          style={btnStyle}>
          {label} ▾
        </button>
        {isOpen && (
          <div style={{
            // `top: 100%` + `paddingTop: 4px` closes the hover gap —
            // the wrapper's hover descendants now include the 4px
            // visual gap, so cursor travel trigger→child never exits
            // the hover zone.
            position: 'absolute', top: '100%', left: 0,
            paddingTop: '4px',
            display: 'flex', flexDirection: 'column', gap: '4px',
            zIndex: 10050,
          }}>
            {visibleItems.map((it, i) => (
              <button key={i}
                onClick={() => {
                  setOpenHeaderMenu(null)
                  setIsMenuPinned(false)
                  it.onClick()
                }}
                className="hdr-btn hdr-btn--child"
                style={{ ...btnStyle, color: it.color ?? btnStyle.color, animationDelay: `${i * 0.03}s` }}>
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const gmEntry = entries.find(e => e.userId === campaign.gm_user_id) ?? null
  const playerEntries = (() => {
    const filtered = entries.filter(e => e.userId !== campaign.gm_user_id)
    // Float the current viewer's own character to position 0 (right next to GM).
    if (!userId) return filtered
    const meIdx = filtered.findIndex(e => e.userId === userId)
    if (meIdx <= 0) return filtered
    return [filtered[meIdx], ...filtered.slice(0, meIdx), ...filtered.slice(meIdx + 1)]
  })()
  const syncedSelectedEntry = selectedEntry ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry : null
  const myEntry = entries.find(e => e.userId === userId) ?? null
  const myInsightDice = myEntry?.liveState?.insight_dice ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, background: '#0f0f0f', position: 'relative', zIndex: 10001 }}>
        <div>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'GM View' : 'Player View'}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}>
            {campaign.name}
          </div>
        </div>
        {isGM && sessionStatus === 'idle' && (
          <button onClick={startSession} disabled={sessionActing}
            className="hdr-btn"
            style={{ ...hdrBtn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: sessionActing ? 0.5 : 1, cursor: sessionActing ? 'not-allowed' : 'pointer' }}>
            {sessionActing ? 'Starting...' : 'Start Session'}
          </button>
        )}
        {isGM && sessionStatus === 'active' && (
          <button onClick={async () => {
            // Fetch any submitted player notes so the GM sees them in the modal.
            // Only pull notes that were written DURING this session — notes from
            // prior sessions must not carry forward (see sql/player-notes-session-tag.sql).
            const { data } = await supabase
              .from('player_notes')
              .select('id, user_id, title, content, submitted_at')
              .eq('campaign_id', id)
              .eq('submitted_to_summary', true)
              .eq('session_number', sessionCount)
              .order('submitted_at', { ascending: true })
            // Resolve character name for each note via the entries table snapshot.
            const enriched = (data ?? []).map((n: any) => {
              const entry = entries.find(e => e.userId === n.user_id)
              return { ...n, character_name: entry?.character.name ?? 'Unknown' }
            })
            setSubmittedPlayerNotes(enriched)
            setShowEndSessionModal(true)
          }}
            className="hdr-btn"
            style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>
            End Session
          </button>
        )}
        {sessionStatus === 'active' && (
          <div style={hdrBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
            Session {sessionCount}
          </div>
        )}
        {isGM && !combatActive && (
          <button onClick={() => { setShowTacticalMap(prev => !prev); refreshMapTokenIds() }}
            className={`hdr-btn${showTacticalMap ? ' hdr-btn--active' : ''}`}
            style={hdrBtn(showTacticalMap ? '#2a1210' : '#242424', showTacticalMap ? '#f5a89a' : '#d4cfc9', showTacticalMap ? '#c0392b' : '#3a3a3a')}>
            {showTacticalMap ? 'Campaign Map' : 'Tactical Map'}
          </button>
        )}
        {!isGM && !combatActive && (
          <button onClick={() => { setShowTacticalMap(prev => !prev); if (tacticalShared) setTacticalShared(false) }}
            className={`hdr-btn${showTacticalMap ? ' hdr-btn--active' : ''}`}
            style={hdrBtn(showTacticalMap ? '#2a1210' : '#242424', showTacticalMap ? '#f5a89a' : '#d4cfc9', showTacticalMap ? '#c0392b' : '#3a3a3a')}>
            {showTacticalMap ? 'Campaign Map' : 'Tactical Map'}
          </button>
        )}
        {isGM && showTacticalMap && !combatActive && (
          <button onClick={() => {
            const newShared = !tacticalShared
            setTacticalShared(newShared)
            initChannelRef.current?.send({ type: 'broadcast', event: newShared ? 'tactical_shared' : 'tactical_unshared', payload: { shared: newShared } })
          }}
            className={`hdr-btn${tacticalShared ? ' hdr-btn--active' : ''}`}
            style={hdrBtn(tacticalShared ? '#1a2e10' : '#242424', tacticalShared ? '#7fc458' : '#d4cfc9', tacticalShared ? '#2d5a1b' : '#3a3a3a')}>
            {tacticalShared ? 'Unshare Map' : 'Share Map'}
          </button>
        )}
        {isGM && showTacticalMap && (
          // Map Setup — replaces the old inline 130px scene-controls
          // sidebar. Pops out the controls panel into its own browser
          // window so the GM can park it on a 2nd monitor and let the
          // tactical map fill the full table-page width. State syncs
          // between popout and main window via BroadcastChannel —
          // see lib/scene-controls-bus.ts.
          <button onClick={() => openPopout(`/scene-controls-popout?c=${id}`, `scene-controls-${id}`, { w: 250, h: 600 })}
            className="hdr-btn"
            style={hdrBtn('#2a1a3e', '#c4a7f0', '#5a2e5a')}>
            Map Setup
          </button>
        )}
        {isGM && sessionStatus === 'active' && !combatActive && (
          <button onClick={startCombat} disabled={startingCombat}
            className="hdr-btn"
            style={{ ...hdrBtn('#7a1f16', '#f5a89a', '#c0392b'), opacity: startingCombat ? 0.5 : 1, cursor: startingCombat ? 'not-allowed' : 'pointer' }}>
            {startingCombat ? 'Rolling...' : '⚔️ Start Combat'}
          </button>
        )}
        {isGM && combatActive && (
          <button onClick={endCombat}
            className="hdr-btn"
            style={hdrBtn('#0f2035', '#7ab3d4', '#1a3a5c')}>
            End Combat
          </button>
        )}
        {combatActive && (
          <div style={hdrBtn('#2a1210', '#f5a89a', '#c0392b')}>
            In Combat
          </div>
        )}
        <div style={{ flex: 1 }} />
        {/* Order per user spec: Checks → Community → Campaign → GM Tools →
            (utility/nav standalone). Single top-level for each grouping,
            leaving only Overlay, Dashboard, Exit as standalone. */}
        {sessionStatus === 'active' && renderHeaderMenu(
          'checks',
          'Checks',
          [
            { label: 'Perception', onClick: () => setShowSpecialCheck('perception' as any) },
            { label: 'Gut Instinct', onClick: () => setShowSpecialCheck('gut' as any) },
            { label: 'First Impression', onClick: () => setShowSpecialCheck('first_impression' as any) },
            { label: 'Recruit', onClick: () => openRecruitModal() },
            { label: 'Group Check', onClick: () => setShowSpecialCheck('group' as any) },
            { label: 'Opposed Check', onClick: () => setShowSpecialCheck('opposed' as any) },
          ],
          hdrBtn('#2a102a', '#d48bd4', '#8b2e8b'),
        )}
        {renderHeaderMenu(
          'community',
          'Community',
          [
            { label: 'Status', onClick: () => openCommunityModal('status') },
            { label: 'New Community', onClick: () => openCommunityModal('create') },
            { label: 'Recruit', onClick: () => openRecruitModal(), hidden: sessionStatus !== 'active' },
            // Apprentice placeholder — the apprentice card / picker UI isn't
            // wired yet. Menu entry reserved so the nav slot lands now and
            // the feature can drop in without a menu reshuffle later.
            { label: 'Apprentice', onClick: () => alert('Apprentice view coming soon — for now, see the Apprentice NPC inside the Community roster (look for ⇐ <your PC name>).') },
            // Dashboard — full-screen GM view with Morale history,
            // resource log, role distribution, recruitment stats.
            // Route: /stories/<id>/community. GM-only gated inside
            // the page itself (non-GMs see an access-denied block).
            { label: 'Dashboard', onClick: () => window.open(`/stories/${id}/community`, '_blank', 'noopener,noreferrer'), hidden: !isGM },
          ],
          hdrBtn('#1a2e10', '#7fc458', '#2d5a1b'),
        )}
        {renderHeaderMenu(
          'campaign',
          'Campaign',
          [
            {
              label: 'Share',
              hidden: !campaign?.invite_code,
              onClick: () => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${campaign.invite_code}`)
                alert('Invite link copied to clipboard!')
              },
            },
            {
              label: 'Sessions',
              hidden: sessionCount <= 0,
              onClick: () => router.push(`/stories/${id}/sessions`),
            },
            {
              label: 'Stories',
              onClick: () => router.push(`/stories/${id}`),
            },
          ],
          hdrBtn('#1a1a2e', '#7ab3d4', '#2e2e5a'),
        )}
        {isGM && renderHeaderMenu(
          'gm_tools',
          'GM Tools',
          [
            {
              label: 'Restore',
              onClick: async () => {
                // Pre-select everyone who's damaged, dead, or wounded
                const damagedNpcs = campaignNpcs.filter((n: any) => {
                  const wp = n.wp_current ?? n.wp_max ?? 10
                  const wpMax = n.wp_max ?? 10
                  const rp = n.rp_current ?? n.rp_max ?? 6
                  const rpMax = n.rp_max ?? 6
                  return n.status === 'dead' || wp < wpMax || rp < rpMax
                }).map(n => `npc:${n.id}`)
                const damagedPCs = entries.filter(e => e.liveState && (e.liveState.wp_current < e.liveState.wp_max || e.liveState.rp_current < e.liveState.rp_max))
                  .map(e => `pc:${e.stateId}`)
                // Fetch destructible scene_tokens from the DB directly — mapTokens
                // only exists when TacticalMap is mounted, so we can't read it
                // from any other view. This scans ALL scenes in the campaign so
                // a crate on an inactive scene still shows up.
                const { data: scenes } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id)
                const sceneIds = (scenes ?? []).map((s: any) => s.id)
                const damagedObjRows = sceneIds.length > 0
                  ? (await supabase.from('scene_tokens').select('id, name, wp_max, wp_current').in('scene_id', sceneIds).eq('token_type', 'object').not('wp_max', 'is', null)).data ?? []
                  : []
                const damagedObjs = damagedObjRows
                  .filter((t: any) => (t.wp_current ?? t.wp_max) < t.wp_max)
                  .map((t: any) => ({ id: t.id as string, name: t.name as string, wp_max: t.wp_max as number }))
                setRestoreObjects(damagedObjs)
                const damagedObjectKeys = damagedObjs.map((t: { id: string }) => `obj:${t.id}`)
                setRestoreNpcIds(new Set([...damagedNpcs, ...damagedPCs, ...damagedObjectKeys]))
                setShowRestorePicker(true)
              },
            },
            {
              label: 'Loot',
              onClick: () => { setLootItems([]); setLootRecipients(new Set(entries.map(e => e.character.id))); setShowLootModal(true) },
            },
            {
              label: 'CDP',
              onClick: () => { setCdpAmount(1); setCdpRecipients(new Set(entries.map(e => e.stateId))); setShowCdpModal(true) },
            },
            {
              label: 'GM Screen',
              onClick: () => openPopout('/gm-screen', 'gm-screen', { w: 900, h: 700 }),
            },
          ],
          hdrBtn('#2a2010', '#EF9F27', '#5a4a1b'),
        )}
        <a href="/dashboard" target="_blank" rel="noreferrer"
          className="hdr-btn"
          style={{ ...hdrBtn('#1a1a2e', '#7ab3d4', '#2e2e5a'), textDecoration: 'none' }}>
          Dashboard
        </a>
        <a href="/stories"
          className="hdr-btn"
          style={{ ...hdrBtn('#7a1f16', '#f5a89a', '#c0392b'), textDecoration: 'none' }}>
          Exit
        </a>
      </div>

      {/* Incapacitation banner — playtest #21.
          Shown to a PLAYER (not GM) when their own PC is mortally wounded
          (wp=0 with a countdown) or incapacitated (rp=0 while wp>0). Tells
          them plainly what happened, what they can still do (watch the
          map, whisper the GM, wait for stabilization / revival), and
          what they CAN'T do (take actions). Banner is dismissible only
          by restoring the PC. Hidden when the PC is fully dead (countdown
          expired) since that's a different ending. */}
      {!isGM && combatActive && (() => {
        const myEntry = entries.find(e => e.userId === userId)
        if (!myEntry?.liveState) return null
        const ls = myEntry.liveState as any
        const isDead = ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown <= 0
        const isMortal = ls.wp_current === 0 && !isDead
        const isUnconscious = ls.rp_current === 0 && ls.wp_current > 0
        if (isDead || (!isMortal && !isUnconscious)) return null
        const title = isMortal ? 'Mortally Wounded' : 'Incapacitated'
        const subtitle = isMortal
          ? `You're bleeding out — someone needs to Stabilize you within ${ls.death_countdown ?? '?'} round${ls.death_countdown === 1 ? '' : 's'} or you die.`
          : 'You\'re unconscious — you can\'t take actions until you come to (rest, first aid, or an ally\'s Medicine check).'
        return (
          <div style={{ background: '#2a1210', borderBottom: '1px solid #c0392b', padding: '8px 16px', fontFamily: 'Barlow Condensed, sans-serif', color: '#f5a89a', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a' }}>🩸 {title}</div>
            <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>{subtitle}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>You can still watch the map, whisper the GM, and read the log.</div>
          </div>
        )
      })()}

      {/* Initiative Tracker — shown when combat is active */}
      {combatActive && (
        <div style={{ borderBottom: '1px solid #2e2e2e', background: '#0d0d0d', padding: '8px 12px', flexShrink: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
            {/* Sticky left pane — "⚔️ Initiative" label + a "→ Current:
                <active>" pill that stays pinned when the list scrolls, so
                the GM can always see whose turn it is even if the active
                combatant's entry has scrolled off-screen to the right. */}
            <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0d0d0d', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px', borderRight: '1px solid #2e2e2e', marginRight: '4px', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
                ⚔️ Initiative
              </div>
              {(() => {
                const active = initiativeOrder.find(e => e.is_active)
                if (!active) return null
                const parts = active.character_name.trim().split(/\s+/)
                const shortName = parts.length < 2 ? active.character_name : `${parts[0]} ${parts[parts.length - 1][0]}.`
                // Check if the active combatant is dead / mortally wounded /
                // incapacitated (they'll be filtered from the bar, so the GM
                // loses their usual row-level advance button). Clicking the
                // pill always advances — fastest escape hatch from a "stuck
                // on a dead combatant" state. Non-GMs see a normal pill.
                let stuck = false
                if (active.is_npc && active.npc_id) {
                  const npc = campaignNpcs.find((n: any) => n.id === active.npc_id)
                  if (npc) {
                    const wp = npc.wp_current ?? npc.wp_max ?? 10
                    const rp = npc.rp_current ?? npc.rp_max ?? 6
                    stuck = wp === 0 || rp === 0 || npc.status === 'dead'
                  }
                } else {
                  const ce = entries.find(e => active.character_id ? e.character.id === active.character_id : e.character.name === active.character_name)
                  if (ce?.liveState) stuck = ce.liveState.wp_current === 0 || ce.liveState.rp_current === 0
                }
                const clickable = isGM
                const title = clickable
                  ? (stuck ? `${active.character_name} can't act — click to advance past them` : `Click to advance past ${active.character_name}`)
                  : `Current turn: ${active.character_name}`
                return (
                  <div
                    onClick={clickable ? () => nextTurn() : undefined}
                    title={title}
                    style={{
                      fontSize: '13px',
                      padding: '2px 8px',
                      background: stuck ? '#2a1210' : '#1a2e10',
                      border: `1px solid ${stuck ? '#c0392b' : '#7fc458'}`,
                      borderRadius: '3px',
                      color: stuck ? '#f5a89a' : '#7fc458',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: clickable ? 'pointer' : 'default',
                    }}>
                    → {shortName}{stuck ? ' ⚠' : ''}
                  </div>
                )
              })()}
            </div>

            {(() => {
              // Filter out combatants who can't act: dead, mortally wounded (WP=0), incapacitated (RP=0)
              const alive = initiativeOrder.filter(entry => {
                if (entry.is_npc && entry.npc_id) {
                  const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                  if (npc) {
                    const wp = npc.wp_current ?? npc.wp_max ?? 10
                    const rp = npc.rp_current ?? npc.rp_max ?? 6
                    if (wp === 0 || rp === 0 || npc.status === 'dead') return false
                  }
                } else {
                  const ce = entries.find(e => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
                  if (ce?.liveState) {
                    if (ce.liveState.wp_current === 0 || ce.liveState.rp_current === 0) return false
                  }
                }
                return true
              })
              // Fixed roll-descending order — active combatant keeps their
              // slot and is identified by the green border. Previous rotation
              // (active leftmost, rest wrapped) made it unclear why already-
              // acted combatants could appear to the RIGHT of upcoming ones.
              return alive
            })().map((entry, idx) => {
              // Green = active (has initiative), Yellow = waiting (hasn't gone yet), Red = already acted
              const hasActed = !entry.is_active && entry.actions_remaining != null && entry.actions_remaining <= 0
              const borderColor = entry.is_active ? '#7fc458' : hasActed ? '#c0392b' : '#EF9F27'
              const bgColor = entry.is_active ? '#1a2e10' : hasActed ? '#1a1010' : '#1a1a1a'
              return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '3px',
                flexShrink: 0,
                position: 'relative',
              }}>
                {entry.is_npc && (
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {entry.portrait_url ? (
                      <img src={entry.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.character_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                )}
                <span title={entry.character_name} style={{ fontSize: '13px', fontWeight: entry.is_active ? 700 : 400, color: entry.is_active ? '#f5f2ee' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {(() => {
                    // Compact name in the initiative bar — "Frankie G."
                    // instead of "Frankie Gibblets" — to fit more combatants
                    // on-screen without horizontal scroll. Single-word names
                    // (common for NPC goons like "Goon 1") render unchanged.
                    // Full name still visible on hover via the title attribute.
                    const parts = entry.character_name.trim().split(/\s+/)
                    if (parts.length < 2) return entry.character_name
                    return `${parts[0]} ${parts[parts.length - 1][0]}.`
                  })()}
                </span>
                {entry.is_npc && entry.npc_type && (
                  <span style={{ fontSize: '13px', color: entry.npc_type === 'bystander' ? '#7fc458' : entry.npc_type === 'antagonist' ? '#d48bd4' : entry.npc_type === 'foe' ? '#f5a89a' : '#EF9F27', background: entry.npc_type === 'bystander' ? '#1a2e10' : entry.npc_type === 'antagonist' ? '#2a102a' : entry.npc_type === 'foe' ? '#2a1210' : '#2a2010', border: `1px solid ${entry.npc_type === 'bystander' ? '#2d5a1b' : entry.npc_type === 'antagonist' ? '#8b2e8b' : entry.npc_type === 'foe' ? '#c0392b' : '#5a4a1b'}`, padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.npc_type}</span>
                )}
                {entry.is_npc && !entry.npc_type && (
                  <span style={{ fontSize: '13px', color: '#EF9F27', background: '#2a2010', border: '1px solid #EF9F27', padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>NPC</span>
                )}
                <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
                <span style={{ fontSize: '13px', letterSpacing: '2px' }}>
                  {Array.from({ length: 2 }).map((_, i) => {
                    const remaining = entry.actions_remaining ?? 0
                    const hasActions = i < remaining
                    const color = hasActions ? '#7fc458' : '#3a3a3a'
                    return <span key={i} style={{ color }}>●</span>
                  })}
                </span>
                {/* Aim/social bonus badge — hidden for NPCs from non-GM viewers
                    (playtest #20: don't expose NPC conditions to players). */}
                {(entry.aim_bonus ?? 0) !== 0 && (isGM || !entry.is_npc) && (
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: entry.aim_bonus > 0 ? '#7fc458' : '#c0392b' }}>
                    {entry.aim_bonus > 0 ? '+' : ''}{entry.aim_bonus}
                  </span>
                )}
                {/* Status badges — PCs and NPCs */}
                {(() => {
                  if (entry.is_npc && entry.npc_id) {
                    // Wound-state icons (💀 / 🩸 / 💤) are GM-only per playtest
                    // #20 — players shouldn't see NPC WP/RP state or conditions.
                    // Non-GM viewers get no status badge on NPC rows.
                    if (!isGM) return null
                    const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                    if (!npc) return null
                    const npcWP = npc.wp_current ?? npc.wp_max ?? 10
                    const npcRP = npc.rp_current ?? npc.rp_max ?? 6
                    const isDead = npcWP === 0 && npc.death_countdown != null && npc.death_countdown <= 0
                    const isMortal = npcWP === 0 && !isDead
                    const isUnconscious = npcRP === 0 && npcWP > 0
                    return <>
                      {isDead && <span style={{ fontSize: '13px' }} title="Dead">💀</span>}
                      {isMortal && <span style={{ fontSize: '13px' }} title={`Death in ${npc.death_countdown ?? '?'} rounds`}>🩸</span>}
                      {isUnconscious && <span style={{ fontSize: '13px' }} title="Unconscious">💤</span>}
                    </>
                  }
                  const charEntry = entries.find(e => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
                  if (!charEntry?.liveState) return null
                  const ls = charEntry.liveState
                  const isDead = ls.wp_current === 0 && (ls as any).death_countdown != null && (ls as any).death_countdown <= 0
                  const isMortal = ls.wp_current === 0 && !isDead
                  const isUnconscious = ls.rp_current === 0 && ls.wp_current > 0
                  const isStressed = ls.stress >= 3
                  return <>
                    {isDead && <span style={{ fontSize: '13px' }} title="Dead">💀</span>}
                    {isMortal && <span style={{ fontSize: '13px' }} title={`Death in ${(ls as any).death_countdown ?? '?'} rounds`}>🩸</span>}
                    {isUnconscious && <span style={{ fontSize: '13px' }} title="Unconscious">💤</span>}
                    {isStressed && !isDead && !isMortal && <span style={{ fontSize: '13px' }} title="Stressed">⚡</span>}
                  </>
                })()}
                {/* Defer — GM can defer anyone, players can defer their own */}
                {(isGM || entry.user_id === userId) && idx < initiativeOrder.length - 1 && (
                  <button onClick={() => deferInitiative(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }} title="Defer">↓</button>
                )}
                {/* GM-only: grant +1 action to this combatant (playtest #22).
                    Caps at 2 (max action budget) so it can't stack endlessly. */}
                {isGM && (entry.actions_remaining ?? 0) < 2 && (
                  <button onClick={async () => {
                    const nextCount = Math.min(2, (entry.actions_remaining ?? 0) + 1)
                    await supabase.from('initiative_order').update({ actions_remaining: nextCount }).eq('id', entry.id)
                    await loadInitiative(id)
                    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
                  }}
                    style={{ background: 'none', border: 'none', color: '#7fc458', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }} title="Grant +1 action">+</button>
                )}
                {/* GM-only: skip this combatant for the rest of the round
                    without removing them from initiative. Zeroes
                    actions_remaining so the skip-walk in nextTurn passes
                    over them; their slot rerolls fresh next round. Use case:
                    NPC is incapacitated by a non-damage effect, GM wants
                    them stunned-out for a round but back next round. */}
                {isGM && (entry.actions_remaining ?? 0) > 0 && (
                  <button onClick={async () => {
                    await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', entry.id)
                    if (entry.is_active) {
                      // Active combatant: let nextTurn handle the advance —
                      // it already skips actions_remaining<=0 entries and
                      // fires "New Round" if this was the last unacted
                      // combatant.
                      await nextTurn()
                    } else {
                      // Non-active: just refresh local state so the bar
                      // gates them out (`hasActed` greys them at line 4990).
                      await loadInitiative(id)
                      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
                    }
                  }}
                    style={{ background: 'none', border: 'none', color: '#EF9F27', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }} title="Skip this round (burn remaining actions)">⊘</button>
                )}
                {/* × — GM always removes (active or not). Players only see
                    this on their own active turn and it ends the turn. */}
                {(isGM || (entry.user_id === userId && entry.is_active)) && (
                  <button onClick={async () => {
                    if (isGM) {
                      // If removing the active combatant, hand activity to the
                      // next combatant in the current round (sorted by roll
                      // desc) WITHOUT calling nextTurn — that wraps past the
                      // end and fires "New Round" which isn't what the GM
                      // wants when they're just removing someone.
                      if (entry.is_active) {
                        const sorted = [...initiativeOrder].sort((a, b) => b.roll - a.roll || a.character_name.localeCompare(b.character_name))
                        const idx = sorted.findIndex(e => e.id === entry.id)
                        const successor = idx >= 0 ? sorted.slice(idx + 1).concat(sorted.slice(0, idx)).find(e => e.id !== entry.id) : null
                        if (successor) {
                          await supabase.from('initiative_order').update({ is_active: true }).eq('id', successor.id)
                        }
                      }
                      await removeFromInitiative(entry.id)
                      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
                      return
                    }
                    // Player ending their own turn
                    await nextTurn()
                  }}
                    title={isGM ? 'Remove from combat' : 'End turn'}
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '13px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                )}
              </div>
            )})}

            {isGM && (
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
                {(() => {
                  // PCs that are NOT already in the initiative (playtest #23 —
                  // add a PC to combat mid-session, e.g. a player joins late).
                  const inInitCharIds = new Set(initiativeOrder.filter(e => e.character_id).map(e => e.character_id))
                  const addable = entries.filter(e => !inInitCharIds.has(e.character.id))
                  if (addable.length === 0) return null
                  return !showAddPC ? (
                    <button onClick={() => setShowAddPC(true)}
                      style={{ padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                      title="Add a player to initiative mid-combat">
                      + PC
                    </button>
                  ) : (
                    <div style={{ position: 'absolute', top: '32px', left: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '6px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Add PC to Combat</div>
                      {addable.map(e => (
                        <button key={e.character.id} onClick={() => addPCToCombat(e)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '3px' }}>
                          {e.character.name}
                        </button>
                      ))}
                      <button onClick={() => setShowAddPC(false)}
                        style={{ display: 'block', width: '100%', padding: '3px 8px', background: 'none', border: '1px solid #2e2e2e', borderRadius: '2px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '2px' }}>
                        Cancel
                      </button>
                    </div>
                  )
                })()}
                {!showAddNPC ? (
                  <button onClick={() => setShowAddNPC(true)}
                    style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    + NPC
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={npcName}
                      onChange={e => setNpcName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addNPC(); if (e.key === 'Escape') { setShowAddNPC(false); setNpcName('') } }}
                      placeholder="NPC name..."
                      style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '120px' }}
                    />
                    <button onClick={addNPC} style={{ padding: '4px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => { setShowAddNPC(false); setNpcName('') }} style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <button onClick={nextTurn}
                  style={{ padding: '4px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Next →
                </button>
              </div>
            )}
          </div>
          {/* Action buttons — shown for active combatant or GM */}
          {(() => {
            const activeEntry = initiativeOrder.find(e => e.is_active)
            if (!activeEntry || (activeEntry.actions_remaining ?? 0) <= 0) return null
            const myChar = entries.find(e => e.userId === userId)
            const isMyTurn = !!(activeEntry.character_id && myChar && activeEntry.character_id === myChar.character.id)
            const canAct = isMyTurn || isGM
            if (!canAct) return null

            // Determine combatant's weapon for conditional buttons
            const charEntry = entries.find(e => e.character.name === activeEntry.character_name)
            const npcForWeapon = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
            const weaponData = charEntry?.character.data?.weaponPrimary ?? (npcForWeapon?.skills?.weapon ? { weaponName: npcForWeapon.skills.weapon.weaponName, condition: 'Used' } : null)
            const w = weaponData ? getWeaponByName(weaponData.weaponName) : null
            const hasBurst = w ? getTraitValue(w.traits, 'Automatic Burst') !== null : false
            const isMelee = w?.category === 'melee'
            // Ammo gate — block the Attack button on ranged weapons
            // when ammoCurrent has hit 0. Bow/Crossbow/Compact Bow (and
            // any other clip:1 weapon) effectively need a Reload action
            // between every shot once they're empty. PCs track ammo on
            // weaponPrimary.ammoCurrent; NPCs on skills.weapon.ammoCurrent.
            // Legacy NPCs without ammoCurrent set get null → unlimited
            // ammo (no gate) so we don't break older campaigns.
            const ammoCurrent: number | null =
              charEntry?.character.data?.weaponPrimary?.ammoCurrent ??
              npcForWeapon?.skills?.weapon?.ammoCurrent ??
              null
            const outOfAmmo = !!w && !isMelee && !!w.clip && w.clip > 0 && ammoCurrent !== null && ammoCurrent <= 0
            const has2Actions = (activeEntry.actions_remaining ?? 0) >= 2
            const isGrappled = !!activeEntry.grappled_by
            const isGrappling = initiativeOrder.some(e => e.grappled_by === activeEntry.character_name)
            const grappledTarget = isGrappling ? initiativeOrder.find(e => e.grappled_by === activeEntry.character_name) : null

            const actBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              padding: '2px 8px', background: bg, border: `1px solid ${border}`, borderRadius: '3px',
              color, fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer',
            })

            const disabledBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              ...actBtn(bg, color, border), opacity: 0.3, cursor: 'not-allowed',
            })

            return (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '2px', lineHeight: 1 }}>
                  Round {combatRound}
                </span>
                {/* ── GRAPPLED STATE: only Break Free available ── */}
                {isGrappled && (
                  <>
                    <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '3px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                      Grappled by {activeEntry.grappled_by}
                    </span>
                    <button onClick={() => { setGrappleResult(null); setShowGrappleModal(true) }}
                      style={actBtn('#2a2010', '#EF9F27', '#5a4a1b')}>Break Free</button>
                  </>
                )}
                {/* ── GRAPPLING STATE: only Release available ── */}
                {isGrappling && grappledTarget && (
                  <>
                    <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                      Grappling {grappledTarget.character_name}
                    </span>
                    <button onClick={async () => {
                      await supabase.from('initiative_order').update({ grappled_by: null }).eq('id', grappledTarget.id)
                      await supabase.from('roll_log').insert({
                        campaign_id: id, user_id: userId, character_name: activeEntry.character_name,
                        label: `${activeEntry.character_name} released ${grappledTarget.character_name}`,
                        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'action',
                      })
                      await loadInitiative(id)
                    }}
                      style={actBtn('#1a1a2e', '#7ab3d4', '#2e2e5a')}>Release</button>
                  </>
                )}
                {/* ── Normal combat actions (hidden when grappled/grappling) ── */}
                {!isGrappled && !isGrappling && <>
                {/* ── AIM: +2 CMod, must Attack next or lost ── */}
                <button onClick={() => handleAim(activeEntry.id)}
                  style={actBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
                  Aim{(activeEntry.aim_bonus ?? 0) > 0 ? ` (+${activeEntry.aim_bonus})` : ''}
                </button>
                {activeEntry.aim_active && <span style={{ fontSize: '13px', padding: '1px 6px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '2px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>Aimed — Attack or lose it</span>}

                {/* ── ATTACK: weapon attack, +1 CMod if same target as last attack ── */}
                <button onClick={() => {
                  if (!w || !weaponData) { alert('No weapon readied.'); return }
                  if (outOfAmmo) { alert(`${w.name} is empty. Reload via Ready Weapon before firing again.`); return }
                  const rapid = charEntry?.character.data?.rapid ?? {}
                  const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                  const attrKey = isMelee ? 'PHY' : (w.skill === 'Ranged Combat' ? 'DEX' : 'ACU')
                  const amod = npcAttacker ? (isMelee ? npcAttacker.physicality : npcAttacker.dexterity) ?? 0 : rapid[attrKey] ?? 0
                  const smod = npcAttacker
                    ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === w.skill)?.level ?? 0 : 0)
                    : charEntry?.character.data?.skills?.find((s: any) => s.skillName === w.skill)?.level ?? 0
                  const condCmod = weaponData.condition ? (CONDITION_CMOD as any)[weaponData.condition] ?? 0 : 0
                  const weaponCtx: WeaponContext = { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: condCmod !== -99 ? condCmod : 0, traits: w.traits }
                  // Explosive weapons skip the direct target-dropdown flow and
                  // enter cell-throw mode on the tactical map. Player picks a
                  // cell within range → we store it in grenadeTargetCell and
                  // open the roll modal with that cell as the blast center.
                  if (w.category === 'explosive') {
                    const rangeFeetMap: Record<string, number> = { Engaged: 5, Close: 30, Medium: 100, Long: 300, Distant: 1000 }
                    const rangeFeet = rangeFeetMap[w.range] ?? 30
                    // Friendly list = every other PC currently on the
                    // initiative roster. Used by TacticalMap to prompt
                    // the player before lobbing a grenade onto their
                    // own teammates. Attacker themselves is excluded
                    // (their own PHY-mitigated splash is their problem
                    // alone — no warning).
                    const hasBlast = (w.traits ?? []).some((t: string) => t.startsWith('Blast Radius'))
                    const friendlyCharacterIds = entries
                      .map(e => e.character.id)
                      .filter(cid => cid !== activeEntry.character_id)
                    setThrowMode({
                      attackerCharId: activeEntry.character_id,
                      attackerNpcId: activeEntry.npc_id,
                      weapon: weaponCtx,
                      amod, smod, rangeFeet,
                      label: `${activeEntry.character_name} — Attack (${w.name})`,
                      hasBlast,
                      friendlyCharacterIds,
                    })
                    return
                  }
                  handleRollRequest(`${activeEntry.character_name} — Attack (${w.name})`, amod, smod, weaponCtx)
                }}
                  style={(w && !outOfAmmo) ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}
                  disabled={!w || outOfAmmo}
                  title={outOfAmmo ? `${w?.name ?? 'Weapon'} is empty — Reload via Ready Weapon` : undefined}>
                  Attack{w ? ` (${w.name})` : ''}{outOfAmmo ? ' — empty, Reload' : ''}
                </button>

                {/* ── CHARGE: both actions, melee/unarmed attack (always available) ── */}
                {(() => {
                  const chargeW = isMelee ? w : null // ranged weapon = charge unarmed
                  const chargeSkill = chargeW ? 'Melee Combat' : 'Unarmed Combat'
                  const chargeWName = chargeW?.name ?? 'Unarmed'
                  const chargeWDmg = chargeW?.damage ?? '1d3'
                  const chargeWRp = chargeW?.rpPercent ?? 100
                  return (
                    <button onClick={has2Actions ? () => {
                      clearAimIfActive(activeEntry.id)
                      const rapid = charEntry?.character.data?.rapid ?? {}
                      const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                      const amod = npcAttacker ? (npcAttacker.physicality ?? 0) : (rapid.PHY ?? 0)
                      const smod = npcAttacker
                        ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === chargeSkill)?.level ?? 0 : 0)
                        : charEntry?.character.data?.skills?.find((s: any) => s.skillName === chargeSkill)?.level ?? 0
                      // Store charge roll params and enter move mode (20ft = 2 moves)
                      pendingChargeRef.current = { label: `${activeEntry.character_name} — Charge (${chargeWName})`, amod, smod, weapon: { weaponName: chargeWName, damage: chargeWDmg, rpPercent: chargeWRp, conditionCmod: 0, traits: chargeW?.traits ?? [] }, activeId: activeEntry.id }
                      setMoveMode({ characterId: activeEntry.character_id || undefined, npcId: activeEntry.npc_id || undefined, feet: 20 })
                    } : undefined} disabled={!has2Actions}
                      style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Charge</button>
                  )
                })()}

                {/* ── COORDINATE ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); setShowCoordinateModal(true); setCoordinateSelection('') }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Coordinate</button>

                {/* ── COVER FIRE, DISTRACT, INSPIRE ── */}
                {/* Distract opens the standard roll modal directly — the
                    modal already includes a Target dropdown when combat
                    is active, so the prior 2-step picker → modal flow
                    collapses into one. Cover Fire and Inspire still use
                    the picker because they don't fire a roll (they
                    auto-apply effects). */}
                <button onClick={() => {
                  clearAimIfActive(activeEntry.id)
                  // Compute Distract roll mods from the active combatant.
                  // Per CRB: Intimidation / Inspiration / Tactics* /
                  // Psychology* — take the highest level. ("Tactical*"
                  // in the CRB is a typo per Xero; engine uses Tactics*.)
                  let amod = 0, smod = 0
                  const distractCharEntry = entries.find(e => e.character.name === activeEntry.character_name)
                  if (distractCharEntry) {
                    amod = distractCharEntry.character.data?.rapid?.INF ?? 0
                    const sk: any[] = Array.isArray(distractCharEntry.character.data?.skills) ? distractCharEntry.character.data.skills : []
                    const skLevel = (n: string) => (sk.find((s: any) => s.skillName === n)?.level ?? 0)
                    smod = Math.max(skLevel('Intimidation'), skLevel('Inspiration'), skLevel('Psychology*'), skLevel('Tactics*'))
                  } else {
                    const npcRoller = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
                    if (npcRoller) {
                      amod = (npcRoller as any).influence ?? 0
                      const npcSkills: any[] = Array.isArray(npcRoller.skills?.entries) ? npcRoller.skills.entries : []
                      const skLevel = (n: string) => (npcSkills.find((s: any) => s.name === n)?.level ?? 0)
                      smod = Math.max(skLevel('Intimidation'), skLevel('Inspiration'), skLevel('Psychology*'), skLevel('Tactics*'))
                    }
                  }
                  // Per CRB §06 Combat Actions: "Choose an enemy at Close
                  // Range." Close = ≤30ft. Compute the active combatant's
                  // map token, then enumerate combatants within 30ft and
                  // alive. Pre-select the closest (or the GM's
                  // selectedMapTargetName if it's in range).
                  const aTok = mapTokens.find(t => (activeEntry.character_id && t.character_id === activeEntry.character_id) || (activeEntry.npc_id && t.npc_id === activeEntry.npc_id))
                  const distInFeet = (entry: any): number | null => {
                    if (!aTok) return null
                    const tTok = mapTokens.find(t => {
                      const pe = entries.find(e => e.character.id === entry.character_id)
                      if (pe && t.character_id === pe.character.id) return true
                      const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                      if (npc && t.npc_id === npc.id) return true
                      return false
                    })
                    if (!tTok) return null
                    return Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y)) * mapCellFeet
                  }
                  const isAliveTarget = (entry: any): boolean => {
                    if (entry.id === activeEntry.id) return false
                    if (entry.is_npc) {
                      const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                      return !(npc && npc.wp_current != null && npc.wp_current <= 0)
                    }
                    const pc = entries.find(en => en.character.id === entry.character_id)
                    return !(pc?.liveState && pc.liveState.wp_current === 0)
                  }
                  // No tokens on the map at all → keep behaviour permissive
                  // (no range filter), per the existing Stabilize / Charge
                  // pattern of distInFeet === null falling through.
                  const candidates = initiativeOrder
                    .filter(isAliveTarget)
                    .map(e => ({ entry: e, dist: distInFeet(e) }))
                    .filter(x => x.dist === null || x.dist <= 30)
                  if (candidates.length === 0) {
                    alert('No valid Distract targets within Close range (30 ft).')
                    return
                  }
                  // Pre-select: GM's map selection if it's in the
                  // candidate list; otherwise the closest by distance.
                  // Treat null distance (no map) as 0 for closest pick.
                  let preselect: string | null = null
                  if (selectedMapTargetName && candidates.some(c => c.entry.character_name === selectedMapTargetName)) {
                    preselect = selectedMapTargetName
                  } else {
                    const closest = [...candidates].sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))[0]
                    preselect = closest?.entry.character_name ?? null
                  }
                  // Open the standard roll modal. Action is NOT pre-
                  // consumed — closeRollModal handles the consume only
                  // when the user actually clicks ROLL (didRoll=true).
                  // Cancel = no roll fired = no action consumed.
                  handleRollRequest(`${activeEntry.character_name} — Distract`, amod, smod)
                  if (preselect) setTargetName(preselect)
                }} style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Distract</button>
                {['Cover Fire', 'Inspire'].map(action => {
                  const isOpen = socialTarget?.action === action
                  return (
                    <button key={action} onClick={() => { clearAimIfActive(activeEntry.id); setSocialTarget(isOpen ? null : { action }) }}
                      style={actBtn(isOpen ? '#1a2e10' : '#242424', isOpen ? '#7fc458' : '#d4cfc9', isOpen ? '#2d5a1b' : '#3a3a3a')}>{action}</button>
                  )
                })}
                {socialTarget && (() => {
                  // Show all other combatants — GM/player picks the correct target.
                  // NPCs can be allies or enemies, so we can't filter by is_npc.
                  // Filter out dead / mortally wounded combatants — they have
                  // no actions to lose (Distract) and no attacks to interfere
                  // with (Cover Fire / Inspire), so showing them is just
                  // visual noise and can lead to wasted clicks.
                  const targets = initiativeOrder.filter(e => {
                    if (e.id === activeEntry.id) return false
                    if (e.is_npc) {
                      const npc = campaignNpcs.find((n: any) => n.id === e.npc_id)
                      if (npc) {
                        if (npc.status === 'dead') return false
                        if (npc.wp_current != null && npc.wp_current <= 0) return false
                      }
                    } else {
                      const pc = entries.find(en => en.character.id === e.character_id)
                      if (pc?.liveState && pc.liveState.wp_current === 0) return false
                    }
                    return true
                  })
                  return (
                    <div onClick={() => setSocialTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', minWidth: '220px', maxWidth: '320px' }}>
                        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>{socialTarget.action} — Select Target</div>
                        {targets.length === 0 ? (
                          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', padding: '1rem 0', textAlign: 'center' }}>No valid targets</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {targets.map(t => (
                              <button key={t.id} onClick={() => applySocialAction(socialTarget.action, t.id)}
                                style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#2a1210')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#242424')}>
                                {t.character_name}{t.is_npc ? ' (NPC)' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                        <button onClick={() => setSocialTarget(null)}
                          style={{ marginTop: '10px', width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )
                })()}

                {/* ── COORDINATE MODAL ── */}
                {showCoordinateModal && (() => {
                  // Same dead/mortal filter as the social-action picker —
                  // coordinating against a corpse buys no one a CMod.
                  const allTargets = initiativeOrder.filter(e => {
                    if (e.id === activeEntry.id) return false
                    if (e.is_npc) {
                      const npc = campaignNpcs.find((n: any) => n.id === e.npc_id)
                      if (npc) {
                        if (npc.status === 'dead') return false
                        if (npc.wp_current != null && npc.wp_current <= 0) return false
                      }
                    } else {
                      const pc = entries.find(en => en.character.id === e.character_id)
                      if (pc?.liveState && pc.liveState.wp_current === 0) return false
                    }
                    return true
                  })
                  return (
                    <div onClick={() => setShowCoordinateModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
                        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Coordinate</div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5, marginBottom: '12px' }}>
                          Select the enemy to coordinate against. On a successful Tactics* check, allies within Close range get +2 CMod when attacking that target.
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Coordinate Against</div>
                        <select value={coordinateSelection} onChange={e => setCoordinateSelection(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none', marginBottom: '12px' }}>
                          <option value="">Select target...</option>
                          {allTargets.map(t => (
                            <option key={t.id} value={t.character_name}>{t.character_name}{t.is_npc ? ' (NPC)' : ''}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setShowCoordinateModal(false)}
                            style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                          <button disabled={!coordinateSelection} onClick={() => {
                            // Find the target entry and trigger Tactics* roll
                            const targetEntry = initiativeOrder.find(e => e.character_name === coordinateSelection)
                            if (!targetEntry) return
                            coordinateTargetRef.current = coordinateSelection
                            const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                            const amod = npcAttacker ? (npcAttacker.reason ?? 0) : (charEntry?.character.data?.rapid?.RSN ?? 0)
                            const smod = npcAttacker
                              ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === 'Tactics')?.level ?? 0 : 0)
                              : charEntry?.character.data?.skills?.find((s: any) => s.skillName === 'Tactics')?.level ?? 0
                            handleRollRequest(`${activeEntry.character_name} — Coordinate (vs ${coordinateSelection})`, amod, smod)
                            setShowCoordinateModal(false)
                          }}
                            style={{ flex: 2, padding: '8px', background: coordinateSelection ? '#c0392b' : '#242424', border: `1px solid ${coordinateSelection ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: coordinateSelection ? '#fff' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: coordinateSelection ? 'pointer' : 'not-allowed' }}>Roll Tactics*</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* ── DEFEND: +2 defensive modifier for next incoming attack ── */}
                <button onClick={async () => {
                  clearAimIfActive(activeEntry.id)
                  await supabase.from('initiative_order').update({ defense_bonus: (activeEntry.defense_bonus ?? 0) + 2 }).eq('id', activeEntry.id)
                  await consumeAction(activeEntry.id, `${activeEntry.character_name} — Defend (+2 Defensive Modifier, next attack only)`)
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Defend{(activeEntry.defense_bonus ?? 0) > 0 ? ` (+${activeEntry.defense_bonus})` : ''}</button>

                {/* ── FIRE FROM COVER: both actions, fire weapon + keep cover defense ── */}
                {activeEntry.has_cover && w ? (
                  <button onClick={has2Actions ? () => {
                    const rapid = charEntry?.character.data?.rapid ?? {}
                    const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                    const attrKey = isMelee ? 'PHY' : 'DEX'
                    const amod = npcAttacker ? (npcAttacker[attrKey.toLowerCase() === 'phy' ? 'physicality' : 'dexterity'] ?? 0) : (rapid[attrKey] ?? 0)
                    const smod = npcAttacker
                      ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === w.skill)?.level ?? 0 : 0)
                      : charEntry?.character.data?.skills?.find((s: any) => s.skillName === w.skill)?.level ?? 0
                    const condCmod = weaponData?.condition ? (CONDITION_CMOD as any)[weaponData.condition] ?? 0 : 0
                    actionCostRef.current = 2
                    handleRollRequest(`${activeEntry.character_name} — Fire from Cover (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: condCmod !== -99 ? condCmod : 0, traits: w.traits })
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Fire from Cover</button>
                ) : null}

                {/* ── GRAPPLING: Opposed Unarmed Combat check ── */}
                <button onClick={() => { setGrappleResult(null); setShowGrappleModal(true) }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Grapple</button>

                {/* ── MOVE: highlight cells + click to move ── */}
                {/* GM-selected-token override: if the GM has clicked a different   */}
                {/* token on the map (e.g. an NPC not yet in initiative), anchor    */}
                {/* moveMode on THAT token instead of the active combatant. Lets    */}
                {/* the GM reposition any NPC without having to drag on the map.   */}
                {/* Players always move the active combatant (their own PC).       */}
                <button onClick={() => {
                  clearAimIfActive(activeEntry.id)
                  if (moveMode) { setMoveMode(null); return }
                  const active = initiativeOrder.find(e => e.is_active)
                  let moverCharId: string | undefined
                  let moverNpcId: string | undefined
                  if (isGM && selectedMapTargetName) {
                    const selTok = mapTokens.find(t => t.name === selectedMapTargetName && t.token_type !== 'object')
                    if (selTok) {
                      moverCharId = selTok.character_id ?? undefined
                      moverNpcId = selTok.npc_id ?? undefined
                    }
                  }
                  if (!moverCharId && !moverNpcId && active) {
                    moverCharId = active.character_id || undefined
                    moverNpcId = active.npc_id || undefined
                  }
                  if (!moverCharId && !moverNpcId) return
                  setMoveMode({ characterId: moverCharId, npcId: moverNpcId, feet: 10 })
                }}
                  style={moveMode ? actBtn('#1a2e10', '#7fc458', '#2d5a1b') : actBtn('#242424', '#d4cfc9', '#3a3a3a')}>{moveMode ? 'Cancel Move' : 'Move'}</button>

                {/* ── RAPID FIRE: -1 CMod first shot, -3 CMod second. Both actions: -2/-4 ── */}
                {w && !isMelee ? (
                  <button onClick={has2Actions ? () => {
                    clearAimIfActive(activeEntry.id)
                    const rapid = charEntry?.character.data?.rapid ?? {}
                    const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                    const amod = npcAttacker ? (npcAttacker.dexterity ?? 0) : (rapid.DEX ?? 0)
                    const smod = npcAttacker
                      ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === 'Ranged Combat')?.level ?? 0 : 0)
                      : charEntry?.character.data?.skills?.find((s: any) => s.skillName === 'Ranged Combat')?.level ?? 0
                    const condCmod = weaponData?.condition ? (CONDITION_CMOD as any)[weaponData.condition] ?? 0 : 0
                    actionCostRef.current = 2
                    handleRollRequest(`${activeEntry.character_name} — Rapid Fire (${w.name}) [-1 CMod, then -3]`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: (condCmod !== -99 ? condCmod : 0) - 1, traits: w.traits })
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Rapid Fire</button>
                ) : (
                  <button disabled style={disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Rapid Fire</button>
                )}

                {/* ── READY WEAPON: switch/reload/unjam ── */}
                <button onClick={() => setShowReadyWeaponModal(true)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Ready Weapon</button>

                {/* ── REPOSITION: end-of-round positioning ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); consumeAction(activeEntry.id, `${activeEntry.character_name} — Reposition (Resolution phase)`) }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Reposition</button>

                {/* ── SPRINT: both actions, 3x move (30ft), then Athletics check ── */}
                {/* Action consumption happens in onMoveComplete — NOT here. If we */}
                {/* pre-consumed and the player's cell click was rejected silently */}
                {/* (too far / occupied / off-grid), actions would vanish with no   */}
                {/* movement. Deferring consume to the success path makes the click */}
                {/* reversible via onMoveCancel / second Sprint press.               */}
                <button onClick={has2Actions ? () => {
                  clearAimIfActive(activeEntry.id)
                  sprintPendingRef.current = true
                  setMoveMode({ characterId: activeEntry.character_id || undefined, npcId: activeEntry.npc_id || undefined, feet: 30 })
                } : undefined} disabled={!has2Actions}
                  style={has2Actions ? actBtn('#242424', '#d4cfc9', '#3a3a3a') : disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Sprint</button>

                {/* ── SUBDUE: unarmed/melee, full RP, 50% WP ── */}
                <button onClick={() => {
                  clearAimIfActive(activeEntry.id)
                  const rapid = charEntry?.character.data?.rapid ?? {}
                  const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                  const wName = isMelee && w ? w.name : 'Unarmed'
                  const wDmg = isMelee && w ? w.damage : '1d3'
                  const amod = npcAttacker ? (npcAttacker.physicality ?? 0) : (rapid.PHY ?? 0)
                  const skillName = isMelee && w ? 'Melee Combat' : 'Unarmed Combat'
                  const smod = npcAttacker
                    ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === skillName)?.level ?? 0 : 0)
                    : charEntry?.character.data?.skills?.find((s: any) => s.skillName === skillName)?.level ?? 0
                  handleRollRequest(`${activeEntry.character_name} — Subdue (${wName})`, amod, smod, { weaponName: wName, damage: wDmg, rpPercent: 100, conditionCmod: 0 })
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Subdue</button>

                {/* ── TAKE COVER: +2 defensive modifier for all attacks this round (once per round) ── */}
                <button onClick={!activeEntry.has_cover ? async () => {
                  clearAimIfActive(activeEntry.id)
                  await supabase.from('initiative_order').update({ defense_bonus: (activeEntry.defense_bonus ?? 0) + 2, has_cover: true }).eq('id', activeEntry.id)
                  await consumeAction(activeEntry.id, `${activeEntry.character_name} — Take Cover (+2 Defensive Modifier, all attacks this round)`)
                } : undefined} disabled={activeEntry.has_cover}
                  style={activeEntry.has_cover ? disabledBtn('#1a2e10', '#7fc458', '#2d5a1b') : actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Take Cover{activeEntry.has_cover ? ' ✓' : ''}</button>

                {/* ── UNARMED: PHY + Unarmed Combat, 1d3 ── */}
                <button onClick={() => {
                  const rapid = charEntry?.character.data?.rapid ?? {}
                  const npcAttacker = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
                  const amod = npcAttacker ? (npcAttacker.physicality ?? 0) : (rapid.PHY ?? 0)
                  const smod = npcAttacker
                    ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === 'Unarmed Combat')?.level ?? 0 : 0)
                    : charEntry?.character.data?.skills?.find((s: any) => s.skillName === 'Unarmed Combat')?.level ?? 0
                  handleRollRequest(`${activeEntry.character_name} — Unarmed`, amod, smod, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Unarmed</button>
                {/* Stabilize — one button per mortally-wounded combatant
                    (WP=0, not yet dead) within 20ft of the active combatant.
                    With multiple bleeding-out targets the GM gets a button
                    per target instead of just the first one the find() hit. */}
                {(() => {
                  const aTok = mapTokens.find(t => (activeEntry.character_id && t.character_id === activeEntry.character_id) || (activeEntry.npc_id && t.npc_id === activeEntry.npc_id))
                  const getDistFeet = (targetCharId?: string, targetNpcId?: string): number | null => {
                    if (!aTok || mapTokens.length === 0) return null // no map
                    const tTok = mapTokens.find(t => (targetCharId && t.character_id === targetCharId) || (targetNpcId && t.npc_id === targetNpcId))
                    if (!tTok) return null
                    const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
                    return dist * mapCellFeet
                  }
                  type StabTarget = { kind: 'pc' | 'npc'; name: string; charId?: string; npcId?: string; distFeet: number | null }
                  const targets: StabTarget[] = []
                  for (const e of entries) {
                    if (!e.liveState) continue
                    const wp = e.liveState.wp_current
                    const dc = (e.liveState as any).death_countdown
                    if (wp === 0 && (dc == null || dc > 0)) {
                      targets.push({ kind: 'pc', name: e.character.name, charId: e.character.id, distFeet: getDistFeet(e.character.id, undefined) })
                    }
                  }
                  for (const n of campaignNpcs as any[]) {
                    const wp = n.wp_current ?? n.wp_max ?? 10
                    if (wp === 0 && (n.death_countdown == null || n.death_countdown > 0)) {
                      targets.push({ kind: 'npc', name: n.name, npcId: n.id, distFeet: getDistFeet(undefined, n.id) })
                    }
                  }
                  // distFeet === null means "no map / no token" — preserve the
                  // pre-multi behavior of allowing the click in that case.
                  const inRange = targets.filter(t => t.distFeet === null || t.distFeet <= 20)
                  if (inRange.length === 0) return null
                  return (
                    <>
                      {inRange.map(t => {
                        const notEngaged = t.distFeet !== null && t.distFeet > 5
                        return (
                          <button key={`stab_${t.kind}_${t.charId ?? t.npcId}`}
                            onClick={notEngaged ? () => alert(`${activeEntry.character_name} must be engaged (adjacent) to ${t.name} to stabilize them. Move closer first.`) : async () => {
                              // Determine roller's Medicine stats — use active combatant's stats
                              // (could be PC via charEntry, or NPC via campaignNpcs)
                              let amod = 0, smod = 0
                              if (charEntry) {
                                const rapid = charEntry.character.data?.rapid ?? {}
                                amod = rapid.RSN ?? 0
                                smod = charEntry.character.data?.skills?.find((s: any) => s.skillName === 'Medicine')?.level ?? 0
                              } else {
                                const npcRoller = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
                                if (npcRoller) {
                                  amod = npcRoller.reason ?? 0
                                  const npcSkills: any[] = Array.isArray(npcRoller.skills?.entries) ? npcRoller.skills.entries : []
                                  smod = npcSkills.find((s: any) => s.name === 'Medicine')?.level ?? 0
                                }
                              }
                              // Open roll FIRST (before consumeAction changes the active combatant)
                              handleRollRequest(`${activeEntry.character_name} — Stabilize ${t.name}`, amod, smod)
                              actionPreConsumedRef.current = true
                              await consumeAction(activeEntry.id)
                            }}
                            style={notEngaged ? actBtn('#2a2010', '#EF9F27', '#5a4a1b') : actBtn('#1a2e10', '#7fc458', '#2d5a1b')}>🩸 Stabilize {t.name}{notEngaged ? ' (not engaged)' : ''}</button>
                        )
                      })}
                    </>
                  )
                })()}
                </>}
              </div>
            )
          })()}
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left — Game Feed */}
        <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            <div style={{ fontSize: '15px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#c0392b' }}>{myUsername}{isGM ? ' (GM)' : ''}</span><MessagesBell /><NotificationBell />
            </div>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            {(['rolls', 'chat', 'both'] as const).map(tab => (
              <button key={tab} onClick={() => setFeedTab(tab)}
                style={{ flex: 1, padding: '8px 0', background: feedTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: feedTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: feedTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '13px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {tab === 'rolls' ? 'Logs' : tab === 'chat' ? 'Chat' : 'Both'}
              </button>
            ))}
          </div>
          <div ref={rollsFeed.rollFeedRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessionStatus === 'idle' && (
              isGM ? (
                <button onClick={startSession} disabled={sessionActing}
                  style={{ width: '100%', textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
                  {sessionActing ? 'Starting...' : 'Start Session'}
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                  Waiting for GM to open the session
                </div>
              )
            )}
            {/* Roll entries (Logs tab only) */}
            {feedTab === 'rolls' && (
              rollsFeed.rolls.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '🎲'}</div>
                  <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {sessionStatus === 'idle' ? 'Session not active' : 'Click a skill or attribute on your sheet to roll'}
                  </div>
                </div>
              ) : (
                rollsFeed.rolls.map(r => (
                  <RollEntryCard
                    key={r.id}
                    r={r as any}
                    expandedRollIds={rollsFeed.expandedRollIds}
                    toggleExpanded={rollsFeed.toggleExpanded}
                  />
                ))
              )
            )}
            {/* Chat messages (Chat tab only) — render delegated. */}
            {feedTab === 'chat' && (
              <ChatMessageList messages={chat.messages} viewerUserId={userId} entries={entries} formatTime={formatTime} />
            )}
            {/* Both tab — merged chronological feed. Roll branches stay
                inline (huge JSX with lots of parent-scope helpers); chat
                branch delegates to <ChatMessageRow> for dedup with the
                Chat-tab path above. */}
            {feedTab === 'both' && (() => {
              const merged: { type: 'roll' | 'chat'; created_at: string; data: any }[] = [
                ...rollsFeed.rolls.map(r => ({ type: 'roll' as const, created_at: r.created_at, data: r })),
                ...chat.messages.map(m => ({ type: 'chat' as const, created_at: m.created_at, data: m })),
              ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              if (merged.length === 0) return (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '💬'}</div>
                  <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {sessionStatus === 'idle' ? 'Session not active' : 'No activity yet'}
                  </div>
                </div>
              )
              return merged.map(item => item.type === 'chat' ? (
                <ChatMessageRow key={`chat-${item.data.id}`} message={item.data} viewerUserId={userId} entries={entries} formatTime={formatTime} />
              ) : (
                <RollEntryCard
                  key={`roll-${item.data.id}`}
                  r={item.data as any}
                  expandedRollIds={rollsFeed.expandedRollIds}
                  toggleExpanded={rollsFeed.toggleExpanded}
                  simple
                />
              ))
            })()}
          </div>
          {/* Bottom: chat composer (textarea + Send + whisper indicator).
              Owns its own input state and the slash-command parsing
              inside <ChatComposer> — see components/TableChat.tsx. */}
          <div style={{ borderTop: '1px solid #2e2e2e', flexShrink: 0 }}>
            {(feedTab === 'chat' || feedTab === 'both') && (
              <ChatComposer
                campaignId={id}
                userId={userId}
                isGM={isGM}
                campaign={campaign}
                entries={entries}
                whisperTarget={whisperTarget}
                setWhisperTarget={setWhisperTarget}
              />
            )}
          </div>
        </div>

        {/* Center — Map always rendered, sheets float on top */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a1a1a', overflow: 'hidden', position: 'relative' }}>
          {/* Center map — tactical during combat or when toggled, campaign otherwise */}
          {(combatActive || showTacticalMap || tacticalShared) ? (
            <TacticalMap
              campaignId={id}
              isGM={isGM}
              initiativeOrder={initiativeOrder}
              tokenRefreshKey={tokenRefreshKey}
              onTokenChanged={() => { setTokenRefreshKey(k => k + 1); initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} }) }}
              onPlayerDragMove={(characterId) => {
                // Player dragged their own PC within the Move-action limit.
                // Consume 1 action via the owner's initiative row. No log
                // label — the drag animation is self-evident.
                const entry = initiativeOrder.find(e => e.character_id === characterId)
                if (entry) consumeAction(entry.id, undefined, 1)
              }}
              onGMDragMove={({ characterId, npcId }) => {
                // GM dragged the active combatant's token. Same 1-action
                // cost as a player drag. The TacticalMap-side gate already
                // confirmed this is the active combatant before firing.
                const entry = initiativeOrder.find(e =>
                  (characterId && e.character_id === characterId) ||
                  (npcId && e.npc_id === npcId)
                )
                if (entry) consumeAction(entry.id, undefined, 1)
              }}
              campaignNpcs={campaignNpcs}
              entries={entries}
              myCharacterId={myCharIdRef.current}
              vehicles={vehicles}
              onObjectMove={(tokenId: string) => {
                // Mirror the same speed × current_speed × 30ft logic the
                // ObjectCard's onMove uses, so the in-map panel's Move
                // button feels identical. Acceleration ramp also kicks
                // in via onMoveComplete (which already handles the
                // objectTokenId branch and bumps current_speed).
                const tok = mapTokens.find(t => t.id === tokenId)
                if (!tok) return
                const matchingVehicle = vehicles.find(v => v.name === tok.name)
                const maxSpeed = matchingVehicle?.speed ?? 1
                const currentSpeed = Math.max(1, Math.min(maxSpeed, (tok as any).current_speed ?? 1))
                const moveFeet = currentSpeed * 30
                setMoveMode({ objectTokenId: tokenId, feet: moveFeet })
              }}
              onTokenClick={(token: any) => {
                // Double-click = opens a card AND selects the token as attack target,
                // so hitting ATTACK right after peeking at a zombie pre-populates it.
                setSelectedMapTargetName(token?.name ?? null)
                if (token.npc_id) {
                  const npc = campaignNpcs.find((n: any) => n.id === token.npc_id)
                  if (npc) {
                    setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev.filter(n => n.id !== npc.id) : [...prev, npc as CampaignNpc])
                    setSelectedEntry(null)
                  }
                } else if (token.character_id) {
                  const entry = entries.find(e => e.character.id === token.character_id)
                  if (entry) {
                    // Players can only open their OWN character sheet — seeing
                    // another PC's sheet leaks stats, inventory, and notes.
                    // GM keeps full access.
                    if (!isGM && entry.userId !== userId) return
                    if (selectedEntry?.stateId === entry.stateId) { setSelectedEntry(null); setSheetPos(null) }
                    else { setSelectedEntry(entry); setViewingNpcs([]); setSheetPos(null) }
                  }
                } else if (token.token_type === 'object') {
                  setViewingObjects(prev =>
                    prev.some(o => o.tokenId === token.id)
                      ? prev.filter(o => o.tokenId !== token.id)
                      : [...prev, { tokenId: token.id, name: token.name, color: token.color, portraitUrl: token.portrait_url }]
                  )
                }
              }}
              onTokenSelect={(token: any) => {
                setSelectedMapTargetName(token?.name ?? null)
              }}
              moveMode={moveMode}
              onTokensUpdate={(toks, cellFeet) => {
                // Only update if positions actually changed to avoid re-render churn
                setMapTokens(prev => {
                  const same = prev.length === toks.length && prev.every((p, i) => p.id === toks[i].id && p.grid_x === toks[i].grid_x && p.grid_y === toks[i].grid_y)
                  return same ? prev : toks
                })
                setMapCellFeet(cellFeet)
              }}
              onMoveComplete={async () => {
                // Vehicle / object-token moves: the token physically moved
                // via scene_tokens.grid_x/y, but no character/NPC consumed
                // an action — vehicles aren't combatants. Bump the token's
                // current_speed (acceleration ramp), capped at the parent
                // vehicle's max Speed, so the next Move can cover more
                // ground. Then bail before the action-consume logic.
                if (moveMode?.objectTokenId) {
                  const objTokenId = moveMode.objectTokenId
                  setMoveMode(null)
                  const tok = mapTokens.find(t => t.id === objTokenId)
                  if (tok) {
                    const matchingVehicle = vehicles.find(v => v.name === tok.name)
                    const maxSpeed = matchingVehicle?.speed ?? 1
                    const cur = Math.max(1, (tok as any).current_speed ?? 1)
                    const next = Math.min(maxSpeed, cur + 1)
                    if (next !== cur) {
                      await supabase.from('scene_tokens').update({ current_speed: next }).eq('id', objTokenId)
                      setMapTokens(prev => prev.map(t => t.id === objTokenId ? { ...t, current_speed: next } as any : t))
                      initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                    }
                  }
                  return
                }
                // The mover is whoever moveMode references — NOT necessarily the
                // current active combatant. Turn could auto-advance between Move
                // click and target-cell click, leaving stale active state, in
                // which case the visibly-moved token belongs to a former active.
                const activeNow = initiativeOrder.find((e: any) => e.is_active)
                const mover = (moveMode?.characterId
                  ? initiativeOrder.find((e: any) => e.character_id === moveMode.characterId)
                  : moveMode?.npcId
                    ? initiativeOrder.find((e: any) => e.npc_id === moveMode.npcId)
                    : null) ?? activeNow
                console.warn('[move] onMoveComplete', {
                  moveMode,
                  activeName: activeNow?.character_name, activeId: activeNow?.id, activeActions: activeNow?.actions_remaining,
                  moverName: mover?.character_name, moverId: mover?.id, moverActions: mover?.actions_remaining,
                  matched: mover?.id === activeNow?.id,
                })
                const charge = pendingChargeRef.current
                if (charge) {
                  if (mover && charge.activeId && charge.activeId !== mover.id) {
                    console.warn('[charge] active combatant changed — aborting charge')
                    pendingChargeRef.current = null
                    setMoveMode(null)
                    return
                  }
                  pendingChargeRef.current = null
                  setMoveMode(null)
                  actionCostRef.current = 2
                  handleRollRequest(charge.label, charge.amod, charge.smod, charge.weapon)
                } else if (sprintPendingRef.current) {
                  // Sprint: token moved, NOW consume the 2 actions and fire the
                  // Athletics check. We consume here (not on button click) so that
                  // a failed cell click can't burn actions without movement.
                  sprintPendingRef.current = false
                  setMoveMode(null)
                  if (mover) {
                    // Flag before consume so closeRollModal knows not to
                    // double-consume when the Athletics roll finishes.
                    // Pass `undefined` for actionLabel: we don't want a
                    // generic "— Sprint" log entry to land BEFORE the
                    // Athletics roll resolves (playtest #4). The post-roll
                    // handler (line ~2780) writes a single combined entry
                    // with the final outcome: "sprinted successfully" or
                    // "sprinted but is now winded".
                    actionPreConsumedRef.current = true
                    // Flag BEFORE consumeAction so nextTurn's new-round
                    // branch (which runs synchronously inside consumeAction
                    // when Frankie's 2-action burn empties the round) can
                    // see it and hold the reroll back until the Athletics
                    // roll resolves. Otherwise the Initiative log beats the
                    // Sprint outcome to the feed.
                    sprintAthleticsPendingRef.current = true
                    await consumeAction(mover.id, undefined, 2)
                  }
                  const charEntry = mover ? entries.find(e => e.character.name === mover.character_name) : null
                  const npcAttacker = mover?.is_npc ? campaignNpcs.find((n: any) => n.name === mover.character_name) : null
                  const rapid = charEntry?.character.data?.rapid ?? {}
                  const amod = npcAttacker ? (npcAttacker.physicality ?? 0) : (rapid.PHY ?? 0)
                  const smod = npcAttacker
                    ? (Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === 'Athletics')?.level ?? 0 : 0)
                    : charEntry?.character.data?.skills?.find((s: any) => s.skillName === 'Athletics')?.level ?? 0
                  // bypassTurnGate=true: consumeAction above advanced the turn.
                  // The Athletics roll fires for the former active combatant —
                  // bypass the active-combatant check that would otherwise block it.
                  handleRollRequest(`${mover?.character_name ?? 'Unknown'} — Sprint (Athletics)`, amod, smod, undefined, true)
                } else {
                  // Only consume an action when the combatant we just moved is
                  // actually the active one. GM-initiated "move this NPC" for an
                  // off-turn combatant must not silently deduct from their next
                  // real turn's action budget.
                  if (mover && mover.is_active) consumeAction(mover.id, `${mover.character_name} — Move`)
                  setMoveMode(null)
                }
              }}
              onMoveCancel={() => { pendingChargeRef.current = null; sprintPendingRef.current = false; setMoveMode(null) }}
              throwMode={throwMode ? { attackerCharId: throwMode.attackerCharId, attackerNpcId: throwMode.attackerNpcId, rangeFeet: throwMode.rangeFeet, hasBlast: throwMode.hasBlast, friendlyCharacterIds: throwMode.friendlyCharacterIds } : null}
              onThrowComplete={(gx, gy) => {
                // Commit the cell target and open the roll modal. We keep
                // throwMode cleared from here so a second click doesn't
                // re-fire the handler; the modal now takes over.
                if (!throwMode) return
                const tm = throwMode
                setGrenadeTargetCell({ gx, gy })
                setThrowMode(null)
                // Synthetic target name for the log / dropdown: "Cell
                // (x,y)". executeRoll detects grenadeTargetCell and
                // applies blast centered on the cell position instead
                // of a token.
                handleRollRequest(tm.label, tm.amod, tm.smod, tm.weapon)
                // Pre-populate the modal target with the synthetic cell
                // label so the UI shows "Target: Cell (x,y)" instead of
                // the token dropdown.
                setTargetName(`Cell (${gx},${gy})`)
              }}
              onThrowCancel={() => setThrowMode(null)}
            />
          ) : (
            <CampaignMap campaignId={id} isGM={isGM} setting={campaign?.setting} mapStyle={(campaign as any)?.map_style} mapCenterLat={(campaign as any)?.map_center_lat} mapCenterLng={(campaign as any)?.map_center_lng} revealedNpcIds={revealedNpcIds} focusPin={focusPin} onMapDoubleClick={(lat, lng) => openQuickAddPin(lat, lng)} />
          )}

          {/* NPC Card(s) — grid overlay when out of combat, draggable inline when in combat */}
          {viewingNpcs.length > 0 && !combatActive && !showTacticalMap && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '8px', background: 'rgba(26,26,26,0.95)', zIndex: 1100, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', alignContent: 'start' }}>
              {viewingNpcs.map(npc => {
                const fresh = campaignNpcs.find((c: any) => c.id === npc.id)
                const liveNpc = fresh ? { ...fresh } as CampaignNpc : npc
                const cardKey = `${npc.id}-${liveNpc.wp_current}-${liveNpc.rp_current}-${liveNpc.death_countdown}`
                return isGM ? (
                  <NpcCard key={cardKey}
                    npc={liveNpc}
                    onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                    onEdit={() => { setViewingNpcs(prev => prev.filter(n => n.id !== npc.id)); setGmTab('npcs'); setPendingEditNpcId(npc.id) }}
                    onRoll={sessionStatus === 'active' ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                    onPublish={() => handlePublishNpc(npc)}
                    isPublished={publishedNpcIds.has(npc.id)}
                    onPlaceOnMap={(combatActive || showTacticalMap) ? () => placeTokenOnMap(npc.name, 'npc', undefined, npc.id, npc.portrait_url || undefined) : undefined}
                    campaignId={id}
                    pcCharacters={entries.map(e => ({ id: e.character.id, name: e.character.name }))}
                  />
                ) : (
                  <PlayerNpcCard key={cardKey}
                    npc={liveNpc}
                    onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                    viewingCharacterId={myEntry?.character.id}
                    onRecruit={sessionStatus === 'active' ? () => openRecruitModal(npc.id) : undefined}
                  />
                )
              })}
            </div>
          )}
          {viewingNpcs.length > 0 && (combatActive || showTacticalMap) && (() => {
            const activeIdx = initiativeOrder.findIndex(e => e.is_active)
            const rotated = activeIdx >= 0
              ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
              : initiativeOrder
            const npcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
            const idIdx = new Map(npcOrder.map((id, i) => [id, i]))
            const isDead = (n: CampaignNpc) => {
              const wp = n.wp_current ?? n.wp_max ?? 10
              return n.status === 'dead' || wp === 0
            }
            const sorted = [...viewingNpcs].sort((a, b) => {
              const ad = isDead(a) ? 1 : 0
              const bd = isDead(b) ? 1 : 0
              if (ad !== bd) return ad - bd
              const ai = idIdx.has(a.id) ? idIdx.get(a.id)! : Infinity
              const bi = idIdx.has(b.id) ? idIdx.get(b.id)! : Infinity
              return ai - bi
            })
            return sorted.map((npc, i) => {
              const fresh = campaignNpcs.find((c: any) => c.id === npc.id)
              const liveNpc = fresh ? { ...fresh } as CampaignNpc : npc
              const pos = npcPositions[npc.id]
              const size = npcCardSizes[npc.id]
              return (
                <div key={`${npc.id}-${liveNpc.wp_current}-${liveNpc.rp_current}-${liveNpc.death_countdown}`}
                  style={{
                    position: 'absolute',
                    left: pos?.x ?? 10 + i * 20,
                    top: pos?.y ?? 10 + i * 20,
                    // Default 571×400 — Xero's spec for the in-combat /
                    // tactical-map double-click popup. Resize handle in
                    // the bottom-right still lets the GM grow either
                    // dimension; once dragged, the user-set size wins.
                    width: size?.w ?? 571,
                    height: size?.h ?? 400,
                    maxHeight: size?.h ? undefined : '80vh',
                    overflow: 'auto',
                    // Wrapper bg — without this, when NpcCard's natural
                    // content height (~160px for a Foe) is shorter than
                    // the forced popup height, the empty strip at the
                    // bottom is transparent and shows the map terrain
                    // through. Match the surrounding chrome color so the
                    // gap reads as part of the card.
                    background: '#161616',
                    zIndex: 1100 + i,
                    borderRadius: '4px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                  }}>
                  {/* Drag handle */}
                  <div
                    onMouseDown={e => {
                      const el = e.currentTarget.parentElement as HTMLElement
                      const rect = el.getBoundingClientRect()
                      const parentRect = el.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 }
                      const origX = rect.left - parentRect.left
                      const origY = rect.top - parentRect.top
                      npcDragRef.current = { id: npc.id, startX: e.clientX, startY: e.clientY, origX, origY }
                      const onMove = (ev: MouseEvent) => {
                        if (!npcDragRef.current) return
                        const dx = ev.clientX - npcDragRef.current.startX
                        const dy = ev.clientY - npcDragRef.current.startY
                        setNpcPositions(prev => ({ ...prev, [npc.id]: { x: npcDragRef.current!.origX + dx, y: npcDragRef.current!.origY + dy } }))
                      }
                      const onUp = () => {
                        npcDragRef.current = null
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', border: '1px solid #3a3a3a', borderBottom: 'none', userSelect: 'none' }}>
                    <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: '#5a5a5a' }} />
                  </div>
                  {isGM ? (
                    <NpcCard
                      npc={liveNpc}
                      onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                      onEdit={() => { setViewingNpcs(prev => prev.filter(n => n.id !== npc.id)); setGmTab('npcs'); setPendingEditNpcId(npc.id) }}
                      onRoll={sessionStatus === 'active' ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                      onPublish={() => handlePublishNpc(npc)}
                      isPublished={publishedNpcIds.has(npc.id)}
                      onPlaceOnMap={() => placeTokenOnMap(npc.name, 'npc', undefined, npc.id, npc.portrait_url || undefined)}
                      campaignId={id}
                      pcCharacters={entries.map(e => ({ id: e.character.id, name: e.character.name }))}
                      />
                  ) : (
                    <PlayerNpcCard
                      npc={liveNpc}
                      onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                      viewingCharacterId={myEntry?.character.id}
                      onRecruit={sessionStatus === 'active' ? () => openRecruitModal(npc.id) : undefined}
                    />
                  )}
                  {/* Resize handle — bottom-right corner. Drag to resize the
                      card. Constrained 200-700 px wide and 150 px to 95vh
                      tall. Session-only sizing (not persisted across reloads). */}
                  <div
                    onMouseDown={e => {
                      e.stopPropagation()
                      const wrapper = e.currentTarget.parentElement as HTMLElement
                      const rect = wrapper.getBoundingClientRect()
                      npcResizeRef.current = { id: npc.id, startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height }
                      const onMove = (ev: MouseEvent) => {
                        if (!npcResizeRef.current) return
                        const dx = ev.clientX - npcResizeRef.current.startX
                        const dy = ev.clientY - npcResizeRef.current.startY
                        const newW = Math.max(200, Math.min(700, npcResizeRef.current.origW + dx))
                        const newH = Math.max(150, Math.min(window.innerHeight * 0.95, npcResizeRef.current.origH + dy))
                        setNpcCardSizes(prev => ({ ...prev, [npc.id]: { w: newW, h: newH } }))
                      }
                      const onUp = () => {
                        npcResizeRef.current = null
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    title="Drag to resize"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '16px',
                      height: '16px',
                      cursor: 'nwse-resize',
                      background: 'linear-gradient(135deg, transparent 0%, transparent 55%, #7ab3d4 55%, #7ab3d4 65%, transparent 65%, transparent 78%, #7ab3d4 78%, #7ab3d4 88%, transparent 88%)',
                      borderBottomRightRadius: '4px',
                      zIndex: 10,
                    }}
                  />
                </div>
              )
            })
          })()}

          {/* Object Card(s) — draggable inline, live WP from mapTokens */}
          {viewingObjects.map((obj, i) => {
            const liveTok = mapTokens.find(t => t.id === obj.tokenId)
            const pos = objectPositions[obj.tokenId]
            return (
              <div key={obj.tokenId}
                style={{
                  position: 'absolute',
                  left: pos?.x ?? 40 + i * 22,
                  top: pos?.y ?? 40 + i * 22,
                  width: '340px',
                  zIndex: 1150 + i,
                  borderRadius: '4px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                }}>
                <div
                  onMouseDown={e => {
                    const el = e.currentTarget.parentElement as HTMLElement
                    const rect = el.getBoundingClientRect()
                    const parentRect = el.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 }
                    const origX = rect.left - parentRect.left
                    const origY = rect.top - parentRect.top
                    objectDragRef.current = { id: obj.tokenId, startX: e.clientX, startY: e.clientY, origX, origY }
                    const onMove = (ev: MouseEvent) => {
                      if (!objectDragRef.current) return
                      const dx = ev.clientX - objectDragRef.current.startX
                      const dy = ev.clientY - objectDragRef.current.startY
                      setObjectPositions(prev => ({ ...prev, [objectDragRef.current!.id]: { x: objectDragRef.current!.origX + dx, y: objectDragRef.current!.origY + dy } }))
                    }
                    const onUp = () => {
                      objectDragRef.current = null
                      window.removeEventListener('mousemove', onMove)
                      window.removeEventListener('mouseup', onUp)
                    }
                    window.addEventListener('mousemove', onMove)
                    window.addEventListener('mouseup', onUp)
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', border: '1px solid #3a3a3a', borderBottom: 'none', userSelect: 'none' }}>
                  <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: '#5a5a5a' }} />
                </div>
                {(() => {
                  // Resolve WP/WPmax: prefer the token's own values (so per-
                  // instance damage persists), fall back to the matching
                  // vehicle's wp_max/wp_current. Without the fallback, a
                  // freshly-placed Minnie token shows 0/0 because the token
                  // was created without copying the vehicle's stats.
                  const matchingVehicleForWp = vehicles.find(v => v.name === obj.name)
                  const fallbackWpMax = matchingVehicleForWp?.wp_max ?? null
                  const fallbackWpCurrent = matchingVehicleForWp?.wp_current ?? matchingVehicleForWp?.wp_max ?? null
                  return (
                <ObjectCard
                  tokenId={obj.tokenId}
                  name={obj.name}
                  wpCurrent={liveTok?.wp_current ?? fallbackWpCurrent}
                  wpMax={liveTok?.wp_max ?? fallbackWpMax}
                  color={obj.color}
                  portraitUrl={obj.portraitUrl}
                  isGM={isGM}
                  entries={entries as any}
                  myCharacter={(() => {
                    const me = entries.find(e => e.userId === userId)
                    return me ? { id: me.character.id, name: me.character.name, data: me.character.data } : null
                  })()}
                  onLoot={async (objectName, item, characterId, characterName) => {
                    await supabase.from('roll_log').insert({
                      campaign_id: id, user_id: userId, character_name: 'System',
                      label: `🎒 ${characterName} looted ${item.name} from ${objectName}`,
                      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'loot',
                    })
                    await loadEntries(id)
                    await rollsFeed.refetch()
                  }}
                  onMove={(() => {
                    // GM can always reposition. Players can only move an object
                    // they're listed in `controlled_by_character_ids` for —
                    // typically the driver(s) of a vehicle. No action burned
                    // (vehicles aren't combatants); the move mode picks a
                    // valid cell within the vehicle's CURRENT speed range
                    // (which ramps up over consecutive Move actions —
                    // see onMoveComplete).
                    const me = entries.find(e => e.userId === userId)
                    const controllers = (liveTok as any)?.controlled_by_character_ids
                    const canControl = isGM
                      || (!!me && Array.isArray(controllers) && controllers.includes(me.character.id))
                    if (!canControl) return undefined
                    // Acceleration model: per Distemper CRB pp.137-139,
                    // vehicle Speed is a 1-5 stat. To represent the old
                    // and broken nature of beat-up vehicles like Minnie,
                    // we ramp up from current_speed = 1 on the first
                    // move, then +1 per consecutive Move action, capped
                    // at the vehicle's max Speed. So Minnie (max Speed 3)
                    // moves 30ft round 1, 60ft round 2, 90ft round 3+.
                    // Non-vehicle controllable objects use a flat 30ft.
                    const matchingVehicle = vehicles.find(v => v.name === obj.name)
                    const maxSpeed = matchingVehicle?.speed ?? 1
                    const currentSpeed = Math.max(1, Math.min(maxSpeed, (liveTok as any)?.current_speed ?? 1))
                    const moveFeet = currentSpeed * 30
                    return () => {
                      setViewingObjects(prev => prev.filter(o => o.tokenId !== obj.tokenId))
                      setMoveMode({ objectTokenId: obj.tokenId, feet: moveFeet })
                    }
                  })()}
                  onRotate={(degrees) => {
                    // Optimistic local update so the GM (or driver) sees the
                    // rotation immediately. tokenRefreshKey bump triggers
                    // TacticalMap.loadTokens() via its useEffect dep — the
                    // canonical re-fetch path that mirrors what the existing
                    // GM Edit Object panel uses. Belt + suspenders for the
                    // realtime postgres_changes round-trip.
                    setMapTokens(prev => prev.map(t => t.id === obj.tokenId ? { ...t, rotation: degrees } : t))
                    setTokenRefreshKey(k => k + 1)
                  }}
                  onClose={() => setViewingObjects(prev => prev.filter(o => o.tokenId !== obj.tokenId))}
                />
                  )
                })()}
              </div>
            )
          })}

          {/* Inline character sheet — full screen over map */}
          {syncedSelectedEntry && sheetMode === 'inline' && (
            <div style={{
              position: 'absolute', inset: 0,
              overflowY: 'auto',
              padding: '1rem',
              background: 'rgba(26,26,26,1)',
              zIndex: 1100,
            }}>
              <CharacterCard
                campaignId={id}
                character={syncedSelectedEntry.character}
                liveState={syncedSelectedEntry.liveState}
                canEdit={isGM || syncedSelectedEntry.userId === userId}
                showButtons={true}
                isMySheet={syncedSelectedEntry.userId === userId}
                isGM={isGM}
                onStatUpdate={handleStatUpdate}
                onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                onClose={() => { setSelectedEntry(null); setSheetPos(null) }}
                onKick={isGM && syncedSelectedEntry.userId !== userId ? async () => {
                  const kickUserId = syncedSelectedEntry.userId
                  const kickName = syncedSelectedEntry.character.name
                  if (!confirm(`Remove ${kickName} from this session?`)) return
                  // Mark as kicked so they don't reload on refresh.
                  // Update by (campaign_id, user_id) rather than a cached stateId so a
                  // stale entry row (e.g. after a character reassignment) can't miss.
                  // .select() returns the updated rows — a 0-length array here means
                  // RLS silently blocked the write (Supabase does not surface an error).
                  const { error: kickErr, data: kickData } = await supabase
                    .from('character_states')
                    .update({ kicked: true })
                    .eq('campaign_id', id)
                    .eq('user_id', kickUserId)
                    .select('id')
                  console.warn('[kick] rows updated:', kickData?.length ?? 0, 'error:', kickErr?.message ?? 'none')
                  if (kickErr) {
                    alert(`Kick failed: ${kickErr.message}`)
                    return
                  }
                  if (!kickData || kickData.length === 0) {
                    alert('Kick did not affect any rows — likely an RLS / permissions issue. Check console.')
                    return
                  }
                  // Broadcast for immediate redirect
                  if (initChannelRef.current) {
                    await initChannelRef.current.send({ type: 'broadcast', event: 'player_kicked', payload: { userId: kickUserId } })
                  }
                  // Note: notification insert removed — RLS blocks cross-user inserts.
                  // The kicked flag + broadcast handle the redirect.
                  setEntries(prev => prev.filter(e => e.userId !== kickUserId))
                  setSelectedEntry(null)
                } : undefined}
                onPlaceOnMap={(combatActive || showTacticalMap || tacticalShared) && syncedSelectedEntry.userId === userId ? () => placeTokenOnMap(syncedSelectedEntry.character.name, 'pc', syncedSelectedEntry.character.id, undefined, getCharPhoto(syncedSelectedEntry) || undefined) : undefined}
                inline={true}
                otherCharacters={entries.filter(e => e.character.id !== syncedSelectedEntry.character.id).map(e => ({ id: e.character.id, name: e.character.name }))}
                onGiveItem={async (item: InventoryItem, targetCharId: string, qty: number) => {
                  const targetEntry = entries.find(e => e.character.id === targetCharId)
                  if (!targetEntry) return
                  const targetData = targetEntry.character.data ?? {}
                  const targetInv: InventoryItem[] = targetData.inventory ?? []
                  const existing = targetInv.find((i: InventoryItem) => i.name === item.name && i.custom === item.custom)
                  const newTargetInv = existing
                    ? targetInv.map((i: InventoryItem) => i === existing ? { ...i, qty: i.qty + qty } : i)
                    : [...targetInv, { ...item, qty }]
                  await supabase.from('characters').update({ data: { ...targetData, inventory: newTargetInv } }).eq('id', targetCharId)
                  initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: { targetCharId } })
                  // Cross-user notification — RPC bypasses notifications
                  // RLS via SECURITY DEFINER. from_label is the giver's
                  // character name so the receiver sees who handed it
                  // over without parsing the body.
                  await supabase.rpc('notify_inventory_received', {
                    target_character_id: targetCharId,
                    item_name: item.name,
                    item_qty: qty,
                    from_label: syncedSelectedEntry.character.name,
                  })
                }}
                onInventoryChange={(newInventory: InventoryItem[]) => {
                  // Patch our entries state so the new inventory persists when
                  // the character sheet closes and reopens without a loadEntries.
                  const charId = syncedSelectedEntry.character.id
                  setEntries(prev => prev.map(e => e.character.id === charId
                    ? { ...e, character: { ...e.character, data: { ...e.character.data, inventory: newInventory } } }
                    : e))
                }}
                onWeaponChange={(slot, newWeapon) => {
                  // Patch entries immediately so the combat action bar's
                  // Attack button reflects the new weapon without a round
                  // trip. Without this, changing the sheet's weapon dropdown
                  // leaves the bar showing the previous weapon until the
                  // next loadEntries fires.
                  const charId = syncedSelectedEntry.character.id
                  setEntries(prev => prev.map(e => e.character.id === charId
                    ? { ...e, character: { ...e.character, data: { ...e.character.data, [slot]: newWeapon } } }
                    : e))
                }}
              />
            </div>
          )}
        </div>

        {/* Right — Asset panel. GM gets NPCs/Assets/GM Notes; players get
            NPCs (revealed only) and Assets (read-only). */}
        <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            {((combatActive || showTacticalMap) ? ['npcs', 'assets', 'pins', 'notes'] as const : ['pins', 'npcs', 'assets', 'notes'] as const).map(tab => (
              <button key={tab} onClick={() => setGmTab(tab)}
                style={{ flex: 1, padding: '8px 0', background: gmTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: gmTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: gmTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '13px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {tab === 'pins' ? 'Pins' : tab === 'npcs' ? 'NPCs' : tab === 'assets' ? 'Assets' : isGM ? 'GM Notes' : 'Notes'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {gmTab === 'npcs' && isGM && (() => {
              // Rotate initiative order so the currently-active combatant is first.
              const activeIdx = initiativeOrder.findIndex(e => e.is_active)
              const rotated = activeIdx >= 0
                ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
                : initiativeOrder
              const initiativeNpcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
              return <NpcRoster campaignId={id} isGM={isGM} combatActive={combatActive} initiativeNpcIds={new Set(initiativeOrder.filter(e => e.npc_id).map(e => e.npc_id!))} initiativeNpcOrder={initiativeNpcOrder} onAddToCombat={addNpcsToCombat} pcEntries={entries.map(e => ({ characterId: e.character.id, characterName: e.character.name, userId: e.userId }))} onViewNpc={npc => { openPopout(`/npc-sheet?c=${id}&npc=${npc.id}&gm=${isGM ? 1 : 0}`, `npc-${npc.id}`, { w: 571, h: 400 }) }} viewingNpcIds={new Set(viewingNpcs.map(n => n.id))} editNpcId={pendingEditNpcId} onEditStarted={() => setPendingEditNpcId(null)} externalNpcs={campaignNpcs} onPlaceOnMap={(combatActive || showTacticalMap) ? (npc) => placeTokenOnMap(npc.name, 'npc', undefined, npc.id, npc.portrait_url || undefined) : undefined} onRemoveFromMap={(combatActive || showTacticalMap) ? (npc) => removeTokenFromMap(npc.name) : undefined} onPlaceFolderOnMap={(combatActive || showTacticalMap) ? (folderNpcs) => placeFolderOnMap(folderNpcs.map(n => ({ id: n.id, name: n.name, portrait_url: n.portrait_url, disposition: (n as any).disposition, npc_type: (n as any).npc_type }))) : undefined} onUnmapFolder={(combatActive || showTacticalMap) ? (folderNpcs) => unmapFolderFromMap(folderNpcs.map(n => ({ id: n.id }))) : undefined} onTacticalRefresh={async () => {
              // Final-pass refresh after the GM toggles SHOW/HIDE on a
              // folder. revealNpcsByIds in NpcRoster updates is_visible
              // on scene_tokens but doesn't broadcast — without this
              // nudge, players would have to refresh to see the new
              // visibility state on their canvas.
              setTokenRefreshKey(k => k + 1)
              await refreshMapTokenIds()
              initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
            }} npcIdsOnMap={mapTokenNpcIds} onNpcDeleted={async (npcId) => {
              // Drop the NPC from every local collection immediately so the
              // initiative bar, roster card overlay, and map token disappear
              // without waiting on a realtime DELETE event.
              setCampaignNpcs(prev => prev.filter(n => n.id !== npcId))
              setRosterNpcs(prev => prev.filter(n => n.id !== npcId))
              setViewingNpcs(prev => prev.filter(n => n.id !== npcId))
              await loadInitiative(id)
              setTokenRefreshKey(k => k + 1)
              initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
              initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
            }} />
            })()}
            {gmTab === 'npcs' && !isGM && (() => {
              // Merge revealed NPCs with any NPCs currently in combat,
              // sorted in initiative order (active combatant first) — mirrors GM view.
              const revealedIds = new Set(revealedNpcs.map((n: any) => n.id))
              const activeIdx = initiativeOrder.findIndex(e => e.is_active)
              const rotated = activeIdx >= 0
                ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
                : initiativeOrder
              const combatNpcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
              const combatIdSet = new Set(combatNpcOrder)
              // Build combat NPCs in initiative order
              const combatNpcsInOrder = combatActive
                ? combatNpcOrder.map(npcId => {
                    const revealed = revealedNpcs.find((n: any) => n.id === npcId)
                    if (revealed) return revealed
                    const base = campaignNpcs.find((n: any) => n.id === npcId)
                    return base ? { ...base, _combatOnly: true } : null
                  }).filter(Boolean)
                : []
              // Combine combat + revealed NPCs, group by GM-assigned folder.
              // Combat NPCs not otherwise revealed are included as
              // `_combatOnly: true` so they show even without a relationship.
              const combined: any[] = [
                ...combatNpcsInOrder,
                ...revealedNpcs.filter((n: any) => !combatIdSet.has(n.id)),
              ]
              if (combined.length === 0) {
                return (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No NPCs revealed yet</div>
                  </div>
                )
              }
              // Group by folder. Recruited NPCs go into "🏘 Community — {name}"
              // buckets (pinned after combat), others by GM-assigned folder.
              // "Unfiled" sorts last.
              type FolderBucket = { name: string; key: string; npcs: any[] }
              const folders: FolderBucket[] = []
              if (combatNpcsInOrder.length > 0) {
                folders.push({ name: '⚔️ In Combat', key: '__combat__', npcs: combatNpcsInOrder })
              }
              // Community buckets — NPC is recruited (in playerNpcCommunityMap) and not in combat
              const communityBuckets = new Map<string, any[]>()
              const byFolder = new Map<string, any[]>()
              for (const n of revealedNpcs) {
                if (combatIdSet.has(n.id)) continue
                const commName = playerNpcCommunityMap[n.id]
                if (commName) {
                  const arr = communityBuckets.get(commName) ?? []
                  arr.push(n)
                  communityBuckets.set(commName, arr)
                } else {
                  const f = (n.folder && n.folder.trim()) ? n.folder.trim() : 'Unfiled'
                  const arr = byFolder.get(f) ?? []
                  arr.push(n)
                  byFolder.set(f, arr)
                }
              }
              for (const [cname, cnpcs] of [...communityBuckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
                folders.push({ name: `🏘 Community — ${cname}`, key: `__community__${cname}`, npcs: cnpcs.sort((a, b) => a.name.localeCompare(b.name)) })
              }
              const folderNames = [...byFolder.keys()].sort((a, b) => {
                if (a === 'Unfiled') return 1
                if (b === 'Unfiled') return -1
                return a.localeCompare(b)
              })
              for (const f of folderNames) {
                folders.push({ name: f, key: f, npcs: byFolder.get(f)!.sort((a, b) => a.name.localeCompare(b.name)) })
              }

              function renderNpcRow(npc: any) {
                const isOpen = viewingNpcs.some(n => n.id === npc.id)
                const inCombat = combatIdSet.has(npc.id)
                const freshNpc = campaignNpcs.find((n: any) => n.id === npc.id)
                const npcWP = freshNpc?.wp_current ?? npc.wp_current ?? npc.wp_max ?? 10
                const npcIsDead = freshNpc?.status === 'dead' || (npcWP === 0 && freshNpc?.death_countdown != null && freshNpc.death_countdown <= 0)
                const npcIsMortal = npcWP === 0 && !npcIsDead
                return (
                  <div
                    key={npc.id}
                    onClick={() => {
                      setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev.filter(n => n.id !== npc.id) : [...prev, npc])
                      setSelectedEntry(null)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: isOpen ? '#2a1210' : npcIsDead ? '#0f0f0f' : '#1a1a1a', border: `1px solid ${isOpen ? '#c0392b' : npcIsDead ? '#3a3a3a' : inCombat ? '#5a1b1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.15s', opacity: npcIsDead ? 0.5 : 1 }}
                  >
                    {(() => {
                      // Player-side NPC list. Pull disposition + npc_type
                      // from the fresh campaign_npcs row when available
                      // (revealedNpcs is built from npc_relationships +
                      // an older snapshot; freshNpc has the live state)
                      // so the ring follows the disposition picker
                      // instantly. Same getNpcRingColor helper as the
                      // GM roster — both surfaces never disagree.
                      const ring = getNpcRingColor({
                        disposition: ((freshNpc as any)?.disposition ?? npc.disposition) ?? null,
                        npc_type: ((freshNpc as any)?.npc_type ?? npc.npc_type) ?? null,
                      })
                      return (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ring.bg, border: `2px solid ${ring.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {npc.portrait_url ? (
                            <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '13px', fontWeight: 700, color: ring.color, fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                          )}
                        </div>
                      )
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
                      {npcIsDead && <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>💀 Dead</div>}
                      {npcIsMortal && <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>🩸 Mortally Wounded</div>}
                      {inCombat && !npcIsDead && !npcIsMortal && <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>In Combat</div>}
                      {!npc._combatOnly && npc.reveal_level === 'name_portrait_role' && npc.recruitment_role && (
                        <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.recruitment_role}</div>
                      )}
                      {!npc._combatOnly && npc.relationship_cmod !== 0 && npc.relationship_cmod != null && (
                        <div style={{ fontSize: '13px', color: npc.relationship_cmod > 0 ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          {npc.relationship_cmod > 0 ? `+${npc.relationship_cmod}` : npc.relationship_cmod} CMod
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {folders.map(bucket => {
                  // Combat pseudo-folder is always open — you don't want
                  // to hide the "it's your turn" indicator behind a click.
                  const isCombatBucket = bucket.key === '__combat__'
                  const isCommunityBucket = bucket.key.startsWith('__community__')
                  const isOpen = isCombatBucket || playerFolderOpen.has(bucket.key)
                  const headerColor = isCombatBucket ? '#f5a89a' : isCommunityBucket ? '#7fc458' : '#EF9F27'
                  return (
                    <div key={bucket.key} style={{ marginBottom: '6px' }}>
                      <div
                        onClick={() => !isCombatBucket && togglePlayerFolder(bucket.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', cursor: isCombatBucket ? 'default' : 'pointer', userSelect: 'none' }}>
                        {!isCombatBucket && (
                          <span style={{ fontSize: '13px', color: '#5a5550', width: '10px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                        )}
                        <span style={{ fontSize: '13px', color: headerColor, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                          {bucket.name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          ({bucket.npcs.length})
                        </span>
                      </div>
                      {isOpen && bucket.npcs.map(renderNpcRow)}
                    </div>
                  )
                })}
              </div>
              )
            })()}
            {gmTab === 'pins' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <CampaignPins campaignId={id} isGM={isGM} isThriver={isThriver} onPinFocus={p => setFocusPin({ ...p })} onOpenScene={async (sceneId: string) => {
                  await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', id)
                  await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', sceneId)
                  setShowTacticalMap(true)
                  setTokenRefreshKey(k => k + 1)
                }} />
              </div>
            )}
            {gmTab === 'assets' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {/* Objects folder */}
                <div onClick={() => setAssetsFolderState(prev => { const n = new Set(prev); n.has('objects') ? n.delete('objects') : n.add('objects'); return n })}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{assetsFolderState.has('objects') ? '▼' : '▶'}</span>
                  <span style={{ fontSize: '14px' }}>🎯</span>
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>Objects</span>
                </div>
                {assetsFolderState.has('objects') && (
                  <CampaignObjects campaignId={id} isGM={isGM} tokenRefreshKey={tokenRefreshKey}
                    onTokenChanged={() => { setTokenRefreshKey(k => k + 1); initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} }) }}
                    onPlaceOnMap={async (name, portraitUrl, wpMax) => {
                      const { data: activeScene } = await supabase.from('tactical_scenes').select('id, grid_cols').eq('campaign_id', id).eq('is_active', true).single()
                      if (!activeScene) { alert('No active scene.'); return }
                      const cols = (activeScene as any).grid_cols ?? 20
                      await supabase.from('scene_tokens').insert({
                        scene_id: activeScene.id, name, token_type: 'object',
                        portrait_url: portraitUrl, grid_x: 1, grid_y: 1,
                        is_visible: true, color: '#EF9F27',
                        wp_max: wpMax, wp_current: wpMax,
                      })
                      setTokenRefreshKey(k => k + 1)
                      initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                    }}
                    onRemoveFromMap={async (name) => {
                      const { data: activeScene } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id).eq('is_active', true).single()
                      if (activeScene) {
                        await supabase.from('scene_tokens').delete().eq('scene_id', activeScene.id).eq('name', name).eq('token_type', 'object')
                        setTokenRefreshKey(k => k + 1)
                        initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                      }
                    }}
                    onLoot={async (objectName, item, characterId, characterName) => {
                      await supabase.from('roll_log').insert({
                        campaign_id: id, user_id: userId, character_name: 'System',
                        label: `🎒 ${characterName} looted ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''} from ${objectName}`,
                        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'loot',
                      })
                      await loadEntries(id)
                      await rollsFeed.refetch()
                    }}
                    onDuplicate={async (source) => {
                      // Pull lootable too — the source object passed in only carries the
                      // ObjectToken type fields; we read it fresh so the clone matches DB state.
                      const { data: full } = await supabase
                        .from('scene_tokens')
                        .select('lootable')
                        .eq('id', source.id)
                        .maybeSingle()
                      // Bump suffix so we don't collide with the source name.
                      const baseName = source.name.replace(/\s*\(copy(?:\s+\d+)?\)$/i, '')
                      // Find next available "(copy)", "(copy 2)", "(copy 3)" suffix.
                      const { data: existing } = await supabase
                        .from('scene_tokens')
                        .select('name')
                        .eq('scene_id', source.scene_id)
                        .eq('token_type', 'object')
                      const taken = new Set((existing ?? []).map((r: any) => r.name))
                      let candidate = `${baseName} (copy)`
                      let n = 2
                      while (taken.has(candidate)) candidate = `${baseName} (copy ${n++})`
                      const { error } = await supabase.from('scene_tokens').insert({
                        scene_id: source.scene_id,
                        name: candidate,
                        token_type: 'object',
                        portrait_url: source.portrait_url,
                        grid_x: 1, grid_y: 1, // top-left per memory rule
                        is_visible: source.is_visible,
                        color: source.color,
                        wp_max: source.wp_max,
                        wp_current: source.wp_max, // restore to full integrity
                        properties: source.properties ?? [],
                        contents: source.contents ?? [],
                        lootable: full?.lootable ?? false,
                      })
                      if (error) { alert(`Duplicate failed: ${error.message}`); return }
                      setTokenRefreshKey(k => k + 1)
                      initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                    }}
                    entries={entries as any}
                  />
                )}
                {/* Vehicles folder */}
                {vehicles.length > 0 && (
                  <>
                    <div onClick={() => setAssetsFolderState(prev => { const n = new Set(prev); n.has('vehicles') ? n.delete('vehicles') : n.add('vehicles'); return n })}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{assetsFolderState.has('vehicles') ? '▼' : '▶'}</span>
                      <span style={{ fontSize: '14px' }}>🚗</span>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>Vehicles</span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{vehicles.length}</span>
                    </div>
                    {assetsFolderState.has('vehicles') && (
                      <div style={{ padding: '4px' }}>
                        {vehicles.map((v: Vehicle) => (
                          <div key={v.id} style={{ marginBottom: '4px' }}>
                            {/* Vehicles render their full card directly inside
                                the expanded Vehicles folder — no second click
                                needed. The compact "Recreational Vehicle · WP
                                X/Y" row this used to be was a redundant gate
                                given that the folder header already groups
                                them. expandedVehicleId state retained for
                                forward-compat (other surfaces may want it). */}
                            <VehicleCard vehicle={v} campaignId={id} canEdit={true}
                              onUpdate={async (updated: Vehicle) => {
                                const newVehicles = vehicles.map(vv => vv.id === updated.id ? updated : vv)
                                setVehicles(newVehicles)
                                await supabase.from('campaigns').update({ vehicles: newVehicles }).eq('id', id)
                              }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {gmTab === 'notes' && isGM && <GmNotes campaignId={id} />}
            {gmTab === 'notes' && !isGM && <PlayerNotes campaignId={id} />}
          </div>
        </div>

      </div>

      {/* Bottom portrait strip */}
      <div style={{ borderTop: '1px solid #2e2e2e', display: 'flex', flexShrink: 0, background: '#0f0f0f', height: '80px' }}>
        <button
          onClick={() => { if (gmEntry) { if (selectedEntry?.stateId === gmEntry.stateId) { setSelectedEntry(null); setSheetPos(null) } else { setSelectedEntry(gmEntry); setViewingNpcs([]); setSheetPos(null) } } }}
          style={{ width: '120px', flexShrink: 0, background: gmEntry ? '#1a1a1a' : '#111', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid #2e2e2e', cursor: gmEntry ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px', transition: 'background 0.15s' }}
          onMouseEnter={e => { if (gmEntry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = gmEntry ? '#1a1a1a' : '#111' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {gmEntry && getCharPhoto(gmEntry) ? (
              <img src={getCharPhoto(gmEntry)!} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img
                src="/gm-icon.png"
                alt="GM"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => {
                  // File missing or broken — swap to the text fallback so the
                  // circle never renders as a silent empty badge.
                  const parent = (e.currentTarget.parentElement as HTMLElement | null)
                  if (parent) {
                    parent.innerHTML = '<span style="font-size:12px;font-weight:700;color:#c0392b;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.04em">GM</span>'
                  }
                }}
              />
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(gmEntry ? gmEntry.username : (gmInfo?.username ?? 'GM'))} (GM)
          </div>
        </button>

        {(() => {
          const slotCount = Math.max(playerEntries.length, 3)
          const isCompact = slotCount > 5
          const avatarSize = isCompact ? '28px' : '36px'
          const nameSize = isCompact ? '11px' : '13px'
          const subSize = isCompact ? '9px' : '10px'
          const pad = isCompact ? '4px' : '8px'
          return playerEntries.map((entry, i) => {
            const photo = getCharPhoto(entry)
            const isActive = combatActive && initiativeOrder.some(o => o.is_active && o.character_id === entry.character.id)
            const isMe = entry.userId === userId
            return (
              <button key={entry.stateId} onClick={() => {
                if (isGM || isMe) {
                  if (selectedEntry?.stateId === entry.stateId) { setSelectedEntry(null); setSheetPos(null) }
                  else { setSelectedEntry(entry); setViewingNpcs([]); setSheetPos(null) }
                } else {
                  // Click another player's portrait → whisper mode
                  if (whisperTarget?.userId === entry.userId) { setWhisperTarget(null) }
                  else { setWhisperTarget({ userId: entry.userId, characterName: entry.character.name }); setFeedTab('chat') }
                }
              }}
                style={{ flex: 1, minWidth: 0, background: isActive ? '#1a0f0f' : whisperTarget?.userId === entry.userId ? '#2a102a' : '#1a1a1a', borderTop: isActive ? '2px solid #c0392b' : isMe ? '2px solid #2d5a1b' : whisperTarget?.userId === entry.userId ? '2px solid #8b2e8b' : 'none', borderBottom: 'none', borderLeft: 'none', borderRight: i < playerEntries.length - 1 ? '1px solid #2e2e2e' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isCompact ? '2px' : '4px', padding: pad, transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? '#1a0f0f' : '#1a1a1a')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {isGM && (combatActive || showTacticalMap) && (() => {
                    // Read the actual token state — was checking initiativeOrder,
                    // which meant the button didn't flip color for PCs placed on
                    // the map outside of combat (or cleared but still in init).
                    const onMap = mapTokens.some(t => t.character_id === entry.character.id)
                    return (
                      <div onClick={async e => {
                        e.stopPropagation()
                        if (onMap) {
                          // Remove from map — find and delete the token
                          const { data: activeScene } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', id).eq('is_active', true).single()
                          if (activeScene) {
                            await supabase.from('scene_tokens').delete().eq('scene_id', activeScene.id).eq('name', entry.character.name)
                            setTokenRefreshKey(k => k + 1)
                            initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                          }
                        } else {
                          placeTokenOnMap(entry.character.name, 'pc', entry.character.id, undefined, getCharPhoto(entry) || undefined)
                        }
                      }}
                        style={{ padding: '3px 8px', background: onMap ? '#1a2e10' : '#2a2010', border: `1px solid ${onMap ? '#2d5a1b' : '#5a4a1b'}`, borderRadius: '3px', color: onMap ? '#7fc458' : '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.2 }}>
                        Map
                      </div>
                    )
                  })()}
                  <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: '#1a3a5c', border: `2px solid ${isActive ? '#c0392b' : '#7ab3d4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {photo ? <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: isCompact ? '9px' : '11px', fontWeight: 700, color: isActive ? '#c0392b' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                  </div>
                  {(isGM || isMe) && (
                    <div onClick={e => { e.stopPropagation(); openPopout(`/character-sheet?c=${id}&char=${entry.character.id}`, `char-${entry.character.id}`, { w: 800, h: 800 }) }}
                      style={{ padding: '3px 6px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.2 }}>
                      Popout
                    </div>
                  )}
                </div>
                <div style={{ fontSize: nameSize, color: isActive ? '#f5a89a' : '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.character.name} <span style={{ color: '#cce0f5', fontWeight: 400 }}>({entry.username})</span>
                </div>
              </button>
            )
          })
        })()}
      </div>

      {/* Character sheet overlay — draggable floating window */}
      {syncedSelectedEntry && sheetMode === 'overlay' && (
        <div onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute',
            left: sheetPos?.x ?? '50%',
            top: sheetPos?.y ?? '50%',
            transform: sheetPos ? 'none' : 'translate(-50%, -50%)',
            maxWidth: '780px', width: '95%', maxHeight: '90vh', overflow: 'auto', borderRadius: '4px',
            border: '1px solid #3a3a3a',
          }}>
            {/* Drag handle */}
            <div
              onMouseDown={e => {
                const el = e.currentTarget.parentElement as HTMLElement
                const rect = el.getBoundingClientRect()
                sheetDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: rect.left,
                  origY: rect.top,
                }
                const onMove = (ev: MouseEvent) => {
                  if (!sheetDragRef.current) return
                  const dx = ev.clientX - sheetDragRef.current.startX
                  const dy = ev.clientY - sheetDragRef.current.startY
                  setSheetPos({ x: sheetDragRef.current.origX + dx, y: sheetDragRef.current.origY + dy })
                }
                const onUp = () => {
                  sheetDragRef.current = null
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', border: '1px solid #3a3a3a', borderBottom: 'none', userSelect: 'none' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#5a5a5a' }} />
            </div>
            <CharacterCard
              campaignId={id}
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              isGM={isGM}
              onStatUpdate={handleStatUpdate}
              onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod, weapon) => { setSelectedEntry(null); handleRollRequest(label, amod, smod, weapon) } : undefined}
              onWeaponChange={(slot, newWeapon) => {
                // Same fix as the inline-mode card above — patch entries so
                // the combat bar's Attack button picks up the new weapon
                // immediately. Without this, overlay-mode weapon swaps
                // lagged behind by a loadEntries cycle.
                const charId = syncedSelectedEntry.character.id
                setEntries(prev => prev.map(e => e.character.id === charId
                  ? { ...e, character: { ...e.character, data: { ...e.character.data, [slot]: newWeapon } } }
                  : e))
              }}
            />
            <button onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderTop: 'none', borderRadius: '0 0 4px 4px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Roll modal — draggable floating panel so the player can shove it aside
          to see the tactical map behind it. No backdrop: clicks pass through
          to the map so they can peek at token positions while deciding. The
          panel itself is stopPropagation-gated to keep its own clicks local. */}
      {pendingRoll && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: rollModalPos?.x ?? '50%',
            top: rollModalPos?.y ?? '50%',
            transform: rollModalPos ? 'none' : 'translate(-50%, -50%)',
            zIndex: 10000,
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            borderRadius: '4px',
            width: '340px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {/* Drag handle — grab strip across the top. */}
          <div
            onMouseDown={e => {
              const el = e.currentTarget.parentElement as HTMLElement
              const rect = el.getBoundingClientRect()
              rollModalDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origX: rect.left,
                origY: rect.top,
              }
              const onMove = (ev: MouseEvent) => {
                if (!rollModalDragRef.current) return
                const dx = ev.clientX - rollModalDragRef.current.startX
                const dy = ev.clientY - rollModalDragRef.current.startY
                setRollModalPos({ x: rollModalDragRef.current.origX + dx, y: rollModalDragRef.current.origY + dy })
              }
              const onUp = () => {
                rollModalDragRef.current = null
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', borderBottom: '1px solid #3a3a3a', userSelect: 'none' }}
          >
            <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: '#5a5a5a' }} />
          </div>
          <div style={{ padding: '1.5rem' }}>

            {!rollResult && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{pendingRoll.weapon ? 'Attack Roll' : 'Rolling'}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{pendingRoll.label}</div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: pendingRoll.weapon ? '6px' : '1rem', fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  <span>2d6</span>
                  {pendingRoll.amod !== 0 && <span style={{ color: pendingRoll.amod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.amod > 0 ? '+' : ''}{pendingRoll.amod} AMod</span>}
                  {pendingRoll.smod !== 0 && <span style={{ color: pendingRoll.smod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.smod > 0 ? '+' : ''}{pendingRoll.smod} SMod</span>}
                </div>
                {pendingRoll.weapon && (
                  <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1rem', padding: '6px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div>
                      <span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{pendingRoll.weapon.damage}</span>
                      &nbsp;&nbsp;<span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{pendingRoll.weapon.rpPercent}%</span>
                    </div>
                    {((pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 || pendingRoll.weapon.traitLabel) && (
                      <div style={{ marginTop: '4px' }}>
                        {(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 && (
                          <span><span style={{ color: '#cce0f5' }}>Condition:</span> <span style={{ color: (pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) > 0 ? '#7fc458' : '#EF9F27' }}>{(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) > 0 ? '+' : ''}{pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)} CMod</span></span>
                        )}
                        {pendingRoll.weapon.traitLabel && (
                          <span>{(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 && <>&nbsp;&nbsp;</>}<span style={{ color: '#EF9F27' }}>{pendingRoll.weapon.traitLabel.replace(/-(\d+)/, '(-$1 CMod)')}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {pendingRoll.weapon?.traits && getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') !== null && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button onClick={() => setUseBurst(prev => !prev)}
                      style={{ width: '100%', padding: '6px', background: useBurst ? '#2d5a1b' : '#242424', border: `1px solid ${useBurst ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: useBurst ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      {useBurst ? `✓ Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)` : `Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)`}
                    </button>
                  </div>
                )}
                {/* Range band auto-calculated in background — no manual selector */}
                {(combatActive || pendingRoll.weapon) && initiativeOrder.length > 0 && !pendingRoll.label.includes('Coordinate') && !pendingRoll.label.includes('Sprint') && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Target</div>
                    <select value={targetName} onChange={e => {
                      setTargetName(e.target.value)
                      // Auto-apply target's defensive modifier + same-target bonus
                      if (pendingRoll.weapon && e.target.value) {
                        const w = getWeaponByName(pendingRoll.weapon.weaponName)
                        const isMelee = w?.category === 'melee'
                        const targetEntry = entries.find(en => en.character.name === e.target.value)
                        const isObjectTarget = !targetEntry && !initiativeOrder.some(ie => ie.character_name === e.target.value) && mapTokens.some(t => t.token_type === 'object' && t.name === e.target.value)
                        const targetRapid = targetEntry?.character.data?.rapid ?? {}
                        const defensiveMod = isObjectTarget ? 0 : (isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0))
                        const baseCmod = pendingRoll.weapon.conditionCmod ?? 0
                        // SRD: +1 CMod if attacking the same target as your last attack this turn
                        const activeForBonus = initiativeOrder.find(ie => ie.is_active)
                        const sameTargetBonus = (activeForBonus?.last_attack_target === e.target.value) ? 1 : 0
                        // Coordinate bonus: +2 when attacking the coordinated target
                        const myInitEntry = initiativeOrder.find(ie =>
                          (activeForBonus?.character_id && ie.character_id === activeForBonus.character_id) ||
                          (activeForBonus?.npc_id && ie.npc_id === activeForBonus.npc_id) ||
                          ie.character_name === activeForBonus?.character_name
                        )
                        const coordBonus = (myInitEntry?.coordinate_target === e.target.value) ? (myInitEntry?.coordinate_bonus ?? 0) : 0
                        setCmod(String(baseCmod - defensiveMod + sameTargetBonus + coordBonus))
                        // Auto-calculate range band from token positions
                        const active = initiativeOrder.find(ie => ie.is_active)
                        if (active) {
                          const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, e.target.value)
                          if (autoRange) setRangeBand(autoRange)
                        }
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="" style={{ color: '#cce0f5' }}>No target</option>
                      {[...initiativeOrder].sort((a, b) => (a.is_npc === b.is_npc ? 0 : a.is_npc ? -1 : 1))
                        .filter(entry => {
                          // Filter out dead or mortally wounded NPCs
                          if (entry.is_npc) {
                            const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                            if (npc && npc.wp_current != null && npc.wp_current <= 0) return false
                          }
                          // Filter out dead or mortally wounded PCs (WP = 0)
                          if (!entry.is_npc) {
                            const pcEntry = entries.find(e => e.character.id === entry.character_id)
                            if (pcEntry?.liveState && pcEntry.liveState.wp_current === 0) return false
                          }
                          // Filter out targets the weapon can't hit at their range (skip for Charge — it includes movement)
                          if (pendingRoll.weapon && mapTokens.length > 0 && !pendingRoll.label.includes('Charge')) {
                            const active = initiativeOrder.find(ie => ie.is_active)
                            if (active) {
                              const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, entry.character_name)
                              if (autoRange && !isInRange(pendingRoll.weapon.weaponName, autoRange)) return false
                            }
                          }
                          // Distract: only targets within 30 ft (Close range,
                          // per CRB §06). The active themselves was already
                          // excluded in the dead/alive checks above (it's the
                          // active's own entry id), but double-check.
                          if (pendingRoll.label.endsWith(' — Distract') && mapTokens.length > 0) {
                            const active = initiativeOrder.find(ie => ie.is_active)
                            if (active && entry.id === active.id) return false
                            if (active) {
                              const aTok = mapTokens.find(t => (active.character_id && t.character_id === active.character_id) || (active.npc_id && t.npc_id === active.npc_id))
                              const tTok = mapTokens.find(t => {
                                const pe = entries.find(e => e.character.name === entry.character_name)
                                if (pe && t.character_id === pe.character.id) return true
                                const npc = campaignNpcs.find((n: any) => n.name === entry.character_name)
                                if (npc && t.npc_id === npc.id) return true
                                return false
                              })
                              if (aTok && tTok) {
                                const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
                                if (dist * mapCellFeet > 30) return false
                              }
                            }
                          }
                          // Charge: only targets within 20ft (2 moves × 10ft)
                          if (pendingRoll.label.includes('Charge') && mapTokens.length > 0) {
                            const active = initiativeOrder.find(ie => ie.is_active)
                            if (active) {
                              const aTok = mapTokens.find(t => (active.character_id && t.character_id === active.character_id) || (active.npc_id && t.npc_id === active.npc_id))
                              const tTok = mapTokens.find(t => {
                                const pe = entries.find(e => e.character.name === entry.character_name)
                                if (pe && t.character_id === pe.character.id) return true
                                const npc = campaignNpcs.find((n: any) => n.name === entry.character_name)
                                if (npc && t.npc_id === npc.id) return true
                                return false
                              })
                              if (aTok && tTok) {
                                const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
                                const chargeFeet = dist * mapCellFeet
                                if (chargeFeet > 20) return false
                              }
                            }
                          }
                          return true
                        })
                        .map(entry => (
                        <option key={entry.id} value={entry.character_name} style={{ color: entry.is_npc ? '#7fc458' : '#c0392b' }}>
                          {entry.character_name}{entry.is_npc ? ' (NPC)' : ''}
                        </option>
                      ))}
                      {/* Non-initiative PCs + NPCs who have map tokens — lets the attacker target bystanders and creatures that haven't joined initiative */}
                      {mapTokens
                        .filter(t => {
                          if (t.token_type === 'object') return false
                          if (!t.character_id && !t.npc_id) return false
                          // skip if already listed as an initiative combatant
                          if (t.character_id && initiativeOrder.some(ie => ie.character_id === t.character_id)) return false
                          if (t.npc_id && initiativeOrder.some(ie => ie.npc_id === t.npc_id)) return false
                          // alive check
                          if (t.character_id) {
                            const pc = entries.find(e => e.character.id === t.character_id)
                            if (pc?.liveState && pc.liveState.wp_current === 0) return false
                          }
                          if (t.npc_id) {
                            const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
                            if (!npc) return false
                            if (npc.wp_current != null && npc.wp_current <= 0) return false
                            if (npc.status === 'dead') return false
                          }
                          // range filter (skip for Charge — it includes movement)
                          if (pendingRoll.weapon && !pendingRoll.label.includes('Charge')) {
                            const active = initiativeOrder.find(ie => ie.is_active)
                            if (active) {
                              const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, t.name)
                              if (autoRange && !isInRange(pendingRoll.weapon.weaponName, autoRange)) return false
                            }
                          }
                          return true
                        })
                        .map(t => {
                          const isNpc = !!t.npc_id
                          return (
                            <option key={`maptok-${t.id}`} value={t.name} style={{ color: isNpc ? '#7fc458' : '#c0392b' }}>
                              {t.name}{isNpc ? ' (NPC)' : ''}
                            </option>
                          )
                        })}
                      {/* Object tokens — crates, doors, barrels, etc. Show EVERY
                          object on the map regardless of wp_max configuration;
                          the suffix tells the user WHY one can't be destroyed
                          ((indestructible) / (destroyed)) instead of silently
                          omitting it. Silent omission was the source of several
                          "I can see it right there but can't target it" reports
                          during playtest — GMs assumed they'd placed the object
                          wrong (or mis-configured wp_max) because there was no
                          diagnostic.
                          Distract excluded — you can't distract a crate. */}
                      {!pendingRoll.label.endsWith(' — Distract') && (() => {
                        const objs = mapTokens.filter(t => t.token_type === 'object')
                        if (objs.length > 0 && process.env.NODE_ENV !== 'production') {
                          console.warn('[target-dropdown] objects on map:', objs.map(o => ({
                            name: o.name, wp_max: o.wp_max, wp_current: o.wp_current,
                          })))
                        }
                        return objs
                          .filter(t => {
                            // Range filter (skip for Charge). An out-of-range
                            // object still doesn't make the list — showing it
                            // selectable would let the user roll and then
                            // confusingly fail, same as for NPC targets.
                            if (pendingRoll.weapon && !pendingRoll.label.includes('Charge')) {
                              const active = initiativeOrder.find(ie => ie.is_active)
                              if (active) {
                                const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, t.name)
                                if (autoRange && !isInRange(pendingRoll.weapon.weaponName, autoRange)) return false
                              }
                            }
                            return true
                          })
                          .map(t => {
                            const indestructible = (t.wp_max ?? 0) <= 0
                            const destroyed = !indestructible && (t.wp_current ?? t.wp_max ?? 0) <= 0
                            const suffix = indestructible ? ' (Indestructible)' : destroyed ? ' (Destroyed)' : ' (Object)'
                            const color = indestructible || destroyed ? '#5a5a5a' : '#EF9F27'
                            return (
                              <option key={t.id} value={t.name} style={{ color }} disabled={indestructible || destroyed}>
                                {t.name}{suffix}
                              </option>
                            )
                          })
                      })()}
                    </select>
                  </div>
                )}
                {SOCIAL_SKILLS.some(s => pendingRoll.label.includes(s)) && campaignNpcs.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Interacting with an NPC?</div>
                    <select value={socialNpcId} onChange={async e => {
                      const npcId = e.target.value
                      setSocialNpcId(npcId)
                      if (!npcId) { setSocialCmod(null); return }
                      const npc = campaignNpcs.find((n: any) => n.id === npcId)
                      const myChar = entries.find(en => en.userId === userId)
                      if (!myChar) { setSocialCmod(null); return }
                      const { data: rel } = await supabase.from('npc_relationships').select('relationship_cmod').eq('npc_id', npcId).eq('character_id', myChar.character.id).maybeSingle()
                      if (rel) {
                        setSocialCmod({ npcName: npc?.name ?? '', cmod: rel.relationship_cmod })
                        setCmod(String(rel.relationship_cmod))
                      } else {
                        setSocialCmod({ npcName: npc?.name ?? '', cmod: 0 })
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="">No NPC</option>
                      {campaignNpcs.map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    {socialCmod && (
                      <div style={{ fontSize: '13px', color: socialCmod.cmod > 0 ? '#7fc458' : socialCmod.cmod < 0 ? '#f5a89a' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                        Relationship CMod with {socialCmod.npcName}: {socialCmod.cmod > 0 ? `+${socialCmod.cmod}` : socialCmod.cmod}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Conditional Modifier</div>
                  <input type="number" value={cmod} onChange={e => setCmod(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') executeRoll() }} autoFocus
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                {myInsightDice > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
                      Spend Insight Die ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setPreRollInsight(preRollInsight === '3d6' ? 'none' : '3d6')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Roll 3d6<br /><span style={{ fontSize: '13px', color: preRollInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep all 3</span>
                      </button>
                      <button onClick={() => setPreRollInsight(preRollInsight === '+3cmod' ? 'none' : '+3cmod')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        +3 CMod<br /><span style={{ fontSize: '13px', color: preRollInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                      </button>
                    </div>
                  </div>
                )}
                {pendingRoll.weapon && !targetName && (
                  <div style={{ padding: '6px 10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>
                    Select a target or damage will not be applied
                  </div>
                )}
                {pendingRoll.weapon && targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand) && (
                  <div style={{ padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>
                    Out of range
                  </div>
                )}
                {grenadeTargetCell && (() => {
                  // Replace the meaningless "(17, 14)" coordinate with a
                  // human-readable list of who's actually in the blast.
                  // Walk every map token, classify by Chebyshev distance
                  // from the target cell into Engaged/Close/Far bands,
                  // and render names grouped by band. Empty list (the
                  // throw landed in vacant ground) → fall back to a
                  // generic "splash damage will apply" so the player
                  // still sees confirmation that the throw is committed.
                  // Per playtest 2026-04-27: blast preview only counts
                  // Engaged (full) + Close (50%). Anything beyond 30ft
                  // takes no damage, so don't show it in the preview.
                  const ft = mapCellFeet || 3
                  const engagedCells = Math.max(1, Math.round(5 / ft))
                  const closeCells = Math.max(1, Math.round(30 / ft))
                  const groups: { engaged: string[]; close: string[] } = { engaged: [], close: [] }
                  for (const tok of mapTokens) {
                    const isCombatant = !!tok.character_id || !!tok.npc_id
                    const isDestructibleObject = tok.token_type === 'object' && tok.wp_max != null && tok.wp_max > 0
                    if (!isCombatant && !isDestructibleObject) continue
                    const d = Math.max(Math.abs(tok.grid_x - grenadeTargetCell.gx), Math.abs(tok.grid_y - grenadeTargetCell.gy))
                    if (d > closeCells) continue
                    if (d <= engagedCells) groups.engaged.push(tok.name)
                    else groups.close.push(tok.name)
                  }
                  const total = groups.engaged.length + groups.close.length
                  return (
                    <div style={{ padding: '6px 10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'left', marginBottom: '8px' }}>
                      {total === 0 ? (
                        <span>💥 Throwing into open ground — no targets in blast radius</span>
                      ) : (
                        <>
                          <div style={{ marginBottom: '4px' }}>💥 Blast will hit:</div>
                          {groups.engaged.length > 0 && (
                            <div style={{ color: '#f5a89a' }}>Engaged (full): {groups.engaged.join(', ')}</div>
                          )}
                          {groups.close.length > 0 && (
                            <div style={{ color: '#EF9F27' }}>Close (50%): {groups.close.join(', ')}</div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={closeRollModal} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={executeRoll} disabled={rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: (rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))) ? 'not-allowed' : 'pointer', opacity: (rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))) ? 0.6 : 1 }}>
                    {rolling ? 'Rolling...' : preRollInsight === '3d6' ? '🎲 Roll 3d6' : '🎲 Roll'}
                  </button>
                </div>
              </>
            )}

            {rollResult && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{rollResult.label}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '1rem 0' }}>
                  {/* Show all three dice on a 3d6 Insight roll; otherwise the
                      two die-storage columns. diceRolled is populated only
                      when preRollInsight === '3d6' and the roll happened. */}
                  {(rollResult.diceRolled && rollResult.diceRolled.length > 2
                    ? rollResult.diceRolled
                    : [rollResult.die1, rollResult.die2]).map((d, i) => (
                    <div key={i} style={{ width: '52px', height: '52px', background: '#242424', border: '2px solid #3a3a3a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, color: '#f5f2ee' }}>{d}</div>
                  ))}
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                  [{rollResult.diceRolled && rollResult.diceRolled.length > 2
                    ? rollResult.diceRolled.join('+')
                    : `${rollResult.die1}+${rollResult.die2}`}]
                  {rollResult.amod !== 0 && <span style={{ color: rollResult.amod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.amod > 0 ? '+' : ''}{rollResult.amod}</span>}
                  {rollResult.smod !== 0 && <span style={{ color: rollResult.smod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.smod > 0 ? '+' : ''}{rollResult.smod}</span>}
                  {rollResult.cmod !== 0 && <span style={{ color: rollResult.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {rollResult.cmod > 0 ? '+' : ''}{rollResult.cmod}</span>}
                  <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.total}</span>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: outcomeColor(rollResult.outcome) }}>{rollResult.outcome}</div>
                  {rollResult.insightAwarded && (
                    <div style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '3px 8px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', display: 'inline-block', marginTop: '6px' }}>+1 Insight Die</div>
                  )}
                  {(rollResult as any).weaponJammed && (
                    <div style={{ fontSize: '14px', color: '#c0392b', background: '#2a1210', border: '1px solid #c0392b', padding: '6px 10px', borderRadius: '3px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '8px' }}>
                      ⚠️ Weapon Jammed! Condition degraded. Requires Ready Weapon action to unjam.
                    </div>
                  )}
                </div>
                {/* Damage result */}
                {rollResult.damage && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
                      Damage to {rollResult.damage.targetName}
                    </div>
                    <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                      {rollResult.damage.base > 0 && <span>{rollResult.damage.base}</span>}
                      {rollResult.damage.diceDesc && <span>{rollResult.damage.base > 0 ? '+' : ''}{rollResult.damage.diceDesc} ({rollResult.damage.diceRoll})</span>}
                      {rollResult.damage.phyBonus > 0 && <span> +{rollResult.damage.phyBonus} PHY</span>}
                      <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.damage.totalWP} raw WP</span>
                    </div>
                    {rollResult.damage.mitigated > 0 && (
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                        Defense mitigates {rollResult.damage.mitigated} WP
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
                      <div style={{ padding: '6px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{rollResult.damage.finalWP}</div>
                        <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>WP</div>
                      </div>
                      <div style={{ padding: '6px 12px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{rollResult.damage.finalRP}</div>
                        <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>RP</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '6px' }}>Applied automatically</div>
                    {(rollResult.traitNotes ?? []).length > 0 && (
                      <div style={{ marginTop: '8px', padding: '6px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px' }}>
                        {(rollResult.traitNotes ?? []).map((note: string, i: number) => (
                          <div key={i} style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', marginBottom: i < (rollResult.traitNotes ?? []).length - 1 ? '4px' : 0 }}>{note}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {rollResult.insightUsed !== 'pre' && rollResult.insightUsed !== 'both' && myInsightDice > 0 && rollResult.outcome !== 'High Insight' && rollResult.outcome !== 'Low Insight' && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', textAlign: 'center' }}>
                      Spend Insight Dice ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {rollResult.insightUsed !== 'die1' && (
                        <button onClick={() => spendInsightDie('die1')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 1</button>
                      )}
                      {rollResult.insightUsed !== 'die2' && (
                        <button onClick={() => spendInsightDie('die2')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 2</button>
                      )}
                      {rollResult.insightUsed === null && (
                        <button onClick={() => spendInsightDie('both')} disabled={rolling || myInsightDice < 2} style={{ flex: 1, padding: '8px 4px', background: myInsightDice >= 2 ? '#1a2e10' : '#1a1a1a', border: `1px solid ${myInsightDice >= 2 ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: myInsightDice >= 2 ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling || myInsightDice < 2 ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Both (2)</button>
                      )}
                    </div>
                  </div>
                )}
                {(rollResult.insightUsed === 'pre' || rollResult.insightUsed === 'both') && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>Insight {rollResult.insightUsed === 'both' ? 'Dice' : 'Die'} spent</div>
                )}
                <button onClick={closeRollModal} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
              </>
            )}

          </div>
        </div>
      )}

      {/* Restore modal — NPCs and PCs */}
      {/* GM Loot Distribution Modal */}
      {showLootModal && (
        <div onClick={() => setShowLootModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Loot Distribution</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Give Items to Players</div>

            {/* Item list */}
            <div style={{ marginBottom: '8px', maxHeight: '150px', overflowY: 'auto' }}>
              {lootItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '2px', fontSize: '13px' }}>
                  <span style={{ flex: 1, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {item.name}{item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
                    {item.notes && <span style={{ color: '#5a5550', fontSize: '13px' }}> — {item.notes}</span>}
                  </span>
                  <button onClick={() => setLootItems(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              <input id="loot-item-name" placeholder="Item name" style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
              <input id="loot-item-qty" type="number" min="1" defaultValue="1" placeholder="Qty" style={{ width: '45px', padding: '5px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
              <button onClick={() => {
                const nameEl = document.getElementById('loot-item-name') as HTMLInputElement
                const qtyEl = document.getElementById('loot-item-qty') as HTMLInputElement
                if (!nameEl?.value.trim()) return
                setLootItems(prev => [...prev, { name: nameEl.value.trim(), qty: parseInt(qtyEl?.value) || 1, notes: '' }])
                nameEl.value = ''
                qtyEl.value = '1'
                nameEl.focus()
              }}
                style={{ padding: '5px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>+</button>
            </div>

            {/* Recipients */}
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Give to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
              {entries.map(e => (
                <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: lootRecipients.has(e.character.id) ? '#1a2e10' : '#111', border: `1px solid ${lootRecipients.has(e.character.id) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', cursor: 'pointer', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  <input type="checkbox" checked={lootRecipients.has(e.character.id)} onChange={() => {
                    setLootRecipients(prev => { const n = new Set(prev); n.has(e.character.id) ? n.delete(e.character.id) : n.add(e.character.id); return n })
                  }} style={{ accentColor: '#7fc458' }} />
                  {e.character.name}
                </label>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowLootModal(false)}
                style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => {
                if (lootItems.length === 0 || lootRecipients.size === 0) return
                // Give each item to each selected character
                for (const charId of lootRecipients) {
                  const entry = entries.find(e => e.character.id === charId)
                  if (!entry) continue
                  const charData = entry.character.data ?? {}
                  const inv: InventoryItem[] = charData.inventory ?? []
                  let newInv = [...inv]
                  for (const item of lootItems) {
                    const existing = newInv.find(i => i.name === item.name)
                    if (existing) {
                      newInv = newInv.map(i => i === existing ? { ...i, qty: i.qty + item.qty } : i)
                    } else {
                      newInv.push({ name: item.name, enc: 0, rarity: 'Common', notes: item.notes, qty: item.qty, custom: true })
                    }
                  }
                  await supabase.from('characters').update({ data: { ...charData, inventory: newInv } }).eq('id', charId)
                }
                // Log to feed
                const names = entries.filter(e => lootRecipients.has(e.character.id)).map(e => e.character.name).join(', ')
                const itemList = lootItems.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')
                await supabase.from('roll_log').insert({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `🎒 Loot: ${itemList} → ${names}`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'loot',
                })
                initChannelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
                await loadEntries(id)
                await rollsFeed.refetch()
                setShowLootModal(false)
              }} disabled={lootItems.length === 0 || lootRecipients.size === 0}
                style={{ flex: 2, padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: lootItems.length === 0 || lootRecipients.size === 0 ? 'not-allowed' : 'pointer', opacity: lootItems.length === 0 || lootRecipients.size === 0 ? 0.5 : 1 }}>
                Give {lootItems.length} item{lootItems.length !== 1 ? 's' : ''} to {lootRecipients.size} player{lootRecipients.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CDP Award Modal */}
      {showCdpModal && (
        <div onClick={() => setShowCdpModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '360px' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Award CDP</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Character Development Points</div>

            {/* Amount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>Amount</span>
              <button onClick={() => setCdpAmount(Math.max(1, cdpAmount - 1))} style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer' }}>-</button>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '24px', textAlign: 'center' }}>{cdpAmount}</span>
              <button onClick={() => setCdpAmount(Math.min(10, cdpAmount + 1))} style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer' }}>+</button>
            </div>

            {/* Recipients */}
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Award to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
              {entries.map(e => (
                <label key={e.stateId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: cdpRecipients.has(e.stateId) ? '#1a1a2e' : '#111', border: `1px solid ${cdpRecipients.has(e.stateId) ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', cursor: 'pointer', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  <input type="checkbox" checked={cdpRecipients.has(e.stateId)} onChange={() => {
                    setCdpRecipients(prev => { const n = new Set(prev); n.has(e.stateId) ? n.delete(e.stateId) : n.add(e.stateId); return n })
                  }} style={{ accentColor: '#7ab3d4' }} />
                  {e.character.name} <span style={{ color: '#5a5550', fontWeight: 400 }}>({e.liveState?.cdp ?? 0} CDP)</span>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowCdpModal(false)}
                style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => {
                if (cdpRecipients.size === 0) return
                const names: string[] = []
                for (const stateId of cdpRecipients) {
                  const entry = entries.find(e => e.stateId === stateId)
                  if (!entry?.liveState) continue
                  const newCdp = Math.min(10, (entry.liveState.cdp ?? 0) + cdpAmount)
                  await supabase.from('character_states').update({ cdp: newCdp, updated_at: new Date().toISOString() }).eq('id', stateId)
                  // Auto-log to progression log
                  const charData = entry.character.data ?? {}
                  const progLog = charData.progression_log ?? []
                  await supabase.from('characters').update({ data: { ...charData, progression_log: [{ date: new Date().toISOString(), type: 'cdp', text: `+${cdpAmount} CDP awarded` }, ...progLog] } }).eq('id', entry.character.id)
                  names.push(entry.character.name)
                }
                await supabase.from('roll_log').insert({
                  campaign_id: id, user_id: userId, character_name: 'System',
                  label: `📚 +${cdpAmount} CDP awarded to ${names.join(', ')}`,
                  die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'cdp',
                })
                initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
                await loadEntries(id)
                await rollsFeed.refetch()
                setShowCdpModal(false)
              }} disabled={cdpRecipients.size === 0}
                style={{ flex: 2, padding: '10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: cdpRecipients.size === 0 ? 'not-allowed' : 'pointer', opacity: cdpRecipients.size === 0 ? 0.5 : 1 }}>
                Award +{cdpAmount} CDP
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestorePicker && (() => {
        const deadNpcs = campaignNpcs
          .map(n => {
            const wp = n.wp_current ?? n.wp_max ?? 10
            const wpMax = n.wp_max ?? 10
            const rp = n.rp_current ?? n.rp_max ?? 6
            const rpMax = n.rp_max ?? 6
            const damaged = n.status === 'dead' || wp < wpMax || rp < rpMax
            return { key: `npc:${n.id}`, name: n.name, type: n.npc_type ?? 'NPC', damaged }
          })
          .filter(d => d.damaged)
        const deadPCs = entries
          .filter(e => e.liveState && (e.liveState.wp_current < e.liveState.wp_max || e.liveState.rp_current < e.liveState.rp_max))
          .map(e => ({ key: `pc:${e.stateId}`, name: e.character.name, type: 'PC' }))
        // Objects come from restoreObjects — a fresh snapshot taken when
        // the modal opened, so they show up regardless of which view the GM
        // was on when they hit Restore.
        const damagedObjects = restoreObjects.map(t => ({ key: `obj:${t.id}`, name: t.name, type: 'OBJECT' }))
        const sections: { label: string; items: { key: string; name: string; type: string }[] }[] = [
          { label: 'Player Characters', items: deadPCs },
          { label: 'NPCs', items: deadNpcs },
          { label: 'Objects', items: damagedObjects },
        ].filter(s => s.items.length > 0)
        const allDead = [...deadPCs, ...deadNpcs, ...damagedObjects]
        const allSelected = allDead.length > 0 && allDead.every(d => restoreNpcIds.has(d.key))
        return (
        <div onClick={() => setShowRestorePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Restore</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Restore to full health</div>
            {allDead.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{restoreNpcIds.size} of {allDead.length} selected</span>
                <button onClick={() => setRestoreNpcIds(allSelected ? new Set() : new Set(allDead.map(d => d.key)))}
                  style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {sections.length === 0 ? (
                <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Nothing to restore — everyone is at full health.</div>
              ) : sections.map(section => {
                const sectionKeys = section.items.map(i => i.key)
                const sectionAllSelected = sectionKeys.every(k => restoreNpcIds.has(k))
                return (
                  <div key={section.label} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 2px' }}>
                      <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>{section.label} ({section.items.length})</span>
                      <button onClick={() => {
                        setRestoreNpcIds(prev => {
                          const next = new Set(prev)
                          if (sectionAllSelected) sectionKeys.forEach(k => next.delete(k))
                          else sectionKeys.forEach(k => next.add(k))
                          return next
                        })
                      }}
                        style={{ padding: '1px 6px', background: 'none', border: '1px solid #2e2e2e', borderRadius: '2px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {sectionAllSelected ? 'None' : 'All'}
                      </button>
                    </div>
                    {section.items.map(d => {
                      const color = section.label === 'Player Characters' ? '#7ab3d4' : section.label === 'Objects' ? '#EF9F27' : '#f5a89a'
                      return (
                        <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: restoreNpcIds.has(d.key) ? '#1a2e10' : '#1a1a1a', border: `1px solid ${restoreNpcIds.has(d.key) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={restoreNpcIds.has(d.key)} onChange={() => {
                            setRestoreNpcIds(prev => { const next = new Set(prev); if (next.has(d.key)) next.delete(d.key); else next.add(d.key); return next })
                          }} style={{ accentColor: '#7fc458' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{d.name}</div>
                            <span style={{ fontSize: '13px', color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{d.type}</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRestorePicker(false)}
                style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={async () => {
                if (restoreNpcIds.size === 0) return
                const selected = Array.from(restoreNpcIds)
                // Restore NPCs
                for (const key of selected.filter(k => k.startsWith('npc:'))) {
                  const npcId = key.slice(4)
                  const npc = campaignNpcs.find((n: any) => n.id === npcId)
                  const wpMax = npc?.wp_max ?? (10 + (npc?.physicality ?? 0) + (npc?.dexterity ?? 0))
                  const rpMax = npc?.rp_max ?? (6 + (npc?.physicality ?? 0))
                  await supabase.from('campaign_npcs').update({ wp_current: wpMax, rp_current: rpMax, status: 'active', death_countdown: null, incap_rounds: null }).eq('id', npcId)
                }
                // Restore PCs
                for (const key of selected.filter(k => k.startsWith('pc:'))) {
                  const stateId = key.slice(3)
                  const entry = entries.find(e => e.stateId === stateId)
                  if (entry) {
                    await supabase.from('character_states').update({ wp_current: entry.liveState.wp_max, rp_current: entry.liveState.rp_max, death_countdown: null, incap_rounds: null, updated_at: new Date().toISOString() }).eq('id', stateId)
                  }
                }
                // Restore map objects (crates, barrels, etc.) to full WP. Loot
                // contents are NOT magically restored — if a player already
                // looted the crate before you destroyed and restored it, the
                // contents stay gone. Reset is just "this token is intact
                // again" so it can be destroyed a second time.
                for (const key of selected.filter(k => k.startsWith('obj:'))) {
                  const tokenId = key.slice(4)
                  // Prefer the fresh snapshot (works on any view); fall back to
                  // mapTokens for older callers still relying on it.
                  const snap = restoreObjects.find(t => t.id === tokenId)
                  const fromMap = mapTokens.find(t => t.id === tokenId)
                  const wpMax = snap?.wp_max ?? fromMap?.wp_max
                  if (wpMax != null) {
                    await supabase.from('scene_tokens').update({ wp_current: wpMax }).eq('id', tokenId)
                  }
                }
                // Refresh all data
                const { data: freshNpcs } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
                if (freshNpcs) {
                  setCampaignNpcs(freshNpcs)
                  setRosterNpcs(freshNpcs.filter((n: any) => {
                    if (n.status !== 'active') return false
                    const wp = n.wp_current ?? n.wp_max ?? 10
                    return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
                  }))
                  setViewingNpcs(prev => prev.map(vn => {
                    const fresh = freshNpcs.find((f: any) => f.id === vn.id)
                    return fresh ? { ...fresh } as CampaignNpc : vn
                  }))
                }
                await loadEntries(id)
                initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
                // Optimistic local patch + refresh trigger for restored object tokens
                const objKeys = selected.filter(k => k.startsWith('obj:'))
                if (objKeys.length > 0) {
                  const restoredIds = new Set(objKeys.map(k => k.slice(4)))
                  setMapTokens(prev => prev.map(t =>
                    restoredIds.has(t.id) && t.wp_max != null ? { ...t, wp_current: t.wp_max } : t
                  ))
                  setTokenRefreshKey(k => k + 1)
                  initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                }
                setShowRestorePicker(false)
                setRestoreNpcIds(new Set())
              }}
                disabled={restoreNpcIds.size === 0}
                style={{ flex: 1, padding: '10px', background: restoreNpcIds.size > 0 ? '#1a2e10' : '#242424', border: `1px solid ${restoreNpcIds.size > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: restoreNpcIds.size > 0 ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: restoreNpcIds.size > 0 ? 'pointer' : 'not-allowed' }}>
                Restore {restoreNpcIds.size > 0 ? `(${restoreNpcIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* End Session modal */}
      {showEndSessionModal && (
        <div onClick={() => setShowEndSessionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>End Session</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1.25rem' }}>Session {sessionCount} Summary</div>

            {/* Player submissions — notes the players flagged "Add to Session Summary". */}
            {submittedPlayerNotes.length > 0 && (
              <div style={{ marginBottom: '1.25rem', padding: '10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Player Submissions ({submittedPlayerNotes.length})</div>
                {submittedPlayerNotes.map(n => (
                  <div key={n.id} style={{ marginBottom: '8px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '2px' }}>{n.character_name}</div>
                    {n.title && <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', marginBottom: '2px' }}>{n.title}</div>}
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, marginBottom: '6px' }}>{n.content}</div>
                    <button onClick={() => {
                      const titlePart = n.title ? ` — ${n.title}` : ''
                      const block = (sessionSummary.trim() ? '\n\n' : '') + `${n.character_name}${titlePart}: ${n.content}`
                      setSessionSummary(prev => prev + block)
                    }}
                      style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Append to Summary
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* What happened */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>What happened this session?</div>
              <textarea
                value={sessionSummary}
                onChange={e => setSessionSummary(e.target.value)}
                placeholder="Summarise the session — key events, decisions, outcomes."
                autoFocus
                rows={6}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* How did the session end */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>How did the session end?</div>
              <textarea
                value={sessionCliffhanger}
                onChange={e => setSessionCliffhanger(e.target.value)}
                placeholder="What do you need to remember? What was the cliffhanger? Who had the last word?"
                rows={3}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* Notes for next session */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Notes for next session</div>
              <textarea
                value={nextSessionNotes}
                onChange={e => setNextSessionNotes(e.target.value)}
                placeholder="Prep notes, loose threads, things to follow up on."
                rows={4}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* File upload */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Attach files (optional)</div>
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c0392b' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a' }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#3a3a3a'
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                  if (files.length > 0) setSessionFiles(prev => [...prev, ...files])
                }}
                style={{ border: '2px dashed #3a3a3a', borderRadius: '4px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*,.pdf,.txt,.doc,.docx'; input.onchange = () => { const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); if (files.length > 0) setSessionFiles(prev => [...prev, ...files]) }; input.click() }}
              >
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Drop files here or click to browse
                </div>
                <div style={{ fontSize: '14px', color: '#cce0f5', marginTop: '4px' }}>Maps, handouts, references — images, PDFs, text, and Word docs</div>
              </div>
              {sessionFiles.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {sessionFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#d4cfc9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button onClick={() => setSessionFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowEndSessionModal(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={endSession} disabled={sessionActing} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
                {sessionActing ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NPC Picker for Start Combat */}
      {showNpcPicker && (
        <div onClick={() => setShowNpcPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Start Combat</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Select NPCs for this encounter</div>
            {(() => {
              // Exclude dead NPCs from the combat picker
              const aliveNpcs = rosterNpcs.filter(n => {
                const wp = n.wp_current ?? n.wp_max ?? 10
                const isDead = wp === 0 && n.death_countdown != null && n.death_countdown <= 0
                return !isDead
              })
              const allSelected = aliveNpcs.length > 0 && aliveNpcs.every(n => selectedNpcIds.has(n.id))
              return aliveNpcs.length > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{selectedNpcIds.size} of {aliveNpcs.length} selected</span>
                  <button onClick={() => setSelectedNpcIds(allSelected ? new Set() : new Set(aliveNpcs.map(n => n.id)))}
                    style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              ) : null
            })()}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {(() => {
                const aliveNpcs = rosterNpcs.filter(n => {
                  const wp = n.wp_current ?? n.wp_max ?? 10
                  const isDead = wp === 0 && n.death_countdown != null && n.death_countdown <= 0
                  return !isDead
                })
                if (aliveNpcs.length === 0) {
                  return <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>No active NPCs in roster. You can add them during combat.</div>
                }
                // Group NPCs by folder so the GM can sweep an entire
                // group in or out before fine-tuning individual picks.
                // Uncategorized always renders last (matches the
                // NpcRoster sort + lets the GM exclude the bucket
                // quickly).
                const folderMap: Record<string, typeof aliveNpcs> = {}
                for (const npc of aliveNpcs) {
                  const f = (npc as any).folder ?? 'Uncategorized'
                  if (!folderMap[f]) folderMap[f] = []
                  folderMap[f].push(npc)
                }
                const folderNames = Object.keys(folderMap).sort((a, b) => {
                  if (a === 'Uncategorized') return 1
                  if (b === 'Uncategorized') return -1
                  return a.localeCompare(b)
                })
                return folderNames.map(folderName => {
                  const folderNpcs = folderMap[folderName]
                  const folderIds = folderNpcs.map(n => n.id)
                  const allInFolder = folderIds.every(id => selectedNpcIds.has(id))
                  const someInFolder = folderIds.some(id => selectedNpcIds.has(id))
                  return (
                    <div key={folderName} style={{ marginBottom: '8px' }}>
                      {/* Folder header — checkbox toggles every NPC in
                          this folder. Uses indeterminate state when
                          some-but-not-all are selected. */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', marginBottom: '2px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={allInFolder}
                          ref={el => { if (el) el.indeterminate = !allInFolder && someInFolder }}
                          onChange={() => {
                            setSelectedNpcIds(prev => {
                              const next = new Set(prev)
                              if (allInFolder) folderIds.forEach(id => next.delete(id))
                              else folderIds.forEach(id => next.add(id))
                              return next
                            })
                          }}
                          style={{ accentColor: '#7ab3d4' }} />
                        <span style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>{folderName}</span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{folderNpcs.filter(n => selectedNpcIds.has(n.id)).length}/{folderNpcs.length}</span>
                      </label>
                      {folderNpcs.map(npc => (
                        <label key={npc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', paddingLeft: '24px', background: selectedNpcIds.has(npc.id) ? '#2a1210' : '#1a1a1a', border: `1px solid ${selectedNpcIds.has(npc.id) ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '2px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedNpcIds.has(npc.id)} onChange={() => {
                            setSelectedNpcIds(prev => {
                              const next = new Set(prev)
                              if (next.has(npc.id)) next.delete(npc.id)
                              else next.add(npc.id)
                              return next
                            })
                          }} style={{ accentColor: '#c0392b' }} />
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {npc.portrait_url ? (
                              <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                            {npc.npc_type && <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )
                })
              })()}
            </div>
            {/* Getting The Drop */}
            <div style={{ marginBottom: '1rem', padding: '8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Getting The Drop (optional)</div>
              <select value={dropCharacter} onChange={e => setDropCharacter(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: 'pointer' }}>
                <option value="">No one gets the drop</option>
                <optgroup label="Players">
                  {entries.map(e => <option key={e.character.id} value={e.character.name}>{e.character.name}</option>)}
                </optgroup>
                {rosterNpcs.filter(n => selectedNpcIds.has(n.id)).length > 0 && (
                  <optgroup label="NPCs">
                    {rosterNpcs.filter(n => selectedNpcIds.has(n.id)).map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                  </optgroup>
                )}
              </select>
              {dropCharacter && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>{dropCharacter} acts first with 1 action, then takes -2 CMod on initiative roll.</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowNpcPicker(false); setDropCharacter('') }} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmStartCombat} disabled={startingCombat}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: startingCombat ? 'not-allowed' : 'pointer', opacity: startingCombat ? 0.6 : 1 }}>
                {startingCombat ? 'Rolling...' : `⚔️ Start Combat${selectedNpcIds.size > 0 ? ` (${selectedNpcIds.size} NPCs)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add modal — extracted to components/QuickAddModal.tsx
          so /map and other surfaces share the UI. Pin-only on
          dblclick (qaHideCommunity=true), both panels via the
          Community header button. */}
      {showQuickAdd && (
        <QuickAddModal
          mode="campaign"
          campaignId={id}
          hideCommunity={qaHideCommunity}
          initialLat={qaPinLat}
          initialLng={qaPinLng}
          userRole={null}
          userId={userId}
          onClose={closeQuickAdd}
        />
      )}

      {/* Community Status — overlay modal wrapping <CampaignCommunity>.
          Same management surface as /communities but docked on the table
          page so players can check pending requests / Apprentice links /
          role coverage without leaving their PC view. Click the backdrop
          or ✕ to close. */}
      {showCommunityModal && (
        <div onClick={() => setShowCommunityModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '4px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>Community</div>
              <button onClick={() => setShowCommunityModal(false)}
                style={{ background: 'none', border: 'none', color: '#d4cfc9', fontSize: '20px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                title="Close">✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <CampaignCommunity
                campaignId={id}
                isGM={isGM}
                initialMode={communityModalMode}
                initialModeToken={communityModalToken}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grapple Modal */}
      {showGrappleModal && (() => {
        const active = initiativeOrder.find(e => e.is_active)!
        if (!active) return null
        const charEntry = entries.find(e => e.character.name === active.character_name)
        const npcAttacker = active.is_npc ? campaignNpcs.find((n: any) => n.name === active.character_name) : null

        // Get attacker mods
        const aRapid = charEntry ? (charEntry.character.data?.rapid ?? {}) : { PHY: npcAttacker?.physicality ?? 0 }
        const aPhyMod = (aRapid.PHY ?? 0)
        const aUnarmed = charEntry
          ? charEntry.character.data?.skills?.find((s: any) => s.skillName === 'Unarmed Combat')?.level ?? 0
          : (npcAttacker && Array.isArray(npcAttacker.skills?.entries) ? npcAttacker.skills.entries.find((s: any) => s.name === 'Unarmed Combat')?.level ?? 0 : 0)

        // Build engaged target list (within 5ft)
        const aTok = mapTokens.find(t => (active.character_id && t.character_id === active.character_id) || (active.npc_id && t.npc_id === active.npc_id))
        const engagedTargets = initiativeOrder.filter(entry => {
          if (entry.id === active.id) return false
          // Filter dead/mortally wounded
          if (entry.is_npc) {
            const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
            if (npc && npc.wp_current != null && npc.wp_current <= 0) return false
          } else {
            const pe = entries.find(e => e.character.id === entry.character_id)
            if (pe?.liveState && pe.liveState.wp_current === 0) return false
          }
          // Check engaged range (≤5ft) — require tokens on map
          if (aTok && mapTokens.length > 0) {
            const tTok = mapTokens.find(t => {
              const pe = entries.find(e => e.character.name === entry.character_name)
              if (pe && t.character_id === pe.character.id) return true
              const npc = campaignNpcs.find((n: any) => n.name === entry.character_name)
              if (npc && t.npc_id === npc.id) return true
              return false
            })
            if (!tTok) return false // no token on map = can't target
            const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
            if (dist * mapCellFeet > 5) return false
          }
          return true
        })

        function getOutcome(total: number): string {
          if (total >= 14) return 'Wild Success'
          if (total >= 9) return 'Success'
          if (total >= 4) return 'Failure'
          return 'Dire Failure'
        }

        function isSuccess(outcome: string) { return outcome === 'Success' || outcome === 'Wild Success' }

        async function executeGrapple(targetEntry: InitiativeEntry, insightMode: 'none' | '3d6' | '+3cmod' = 'none') {
          // Get defender mods
          const defCharEntry = entries.find(e => e.character.name === targetEntry.character_name)
          const defNpc = targetEntry.is_npc ? campaignNpcs.find((n: any) => n.name === targetEntry.character_name) : null
          const dRapid = defCharEntry ? (defCharEntry.character.data?.rapid ?? {}) : { PHY: defNpc?.physicality ?? 0 }
          const dPhyMod = (dRapid.PHY ?? 0)
          const dUnarmed = defCharEntry
            ? defCharEntry.character.data?.skills?.find((s: any) => s.skillName === 'Unarmed Combat')?.level ?? 0
            : (defNpc && Array.isArray(defNpc.skills?.entries) ? defNpc.skills.entries.find((s: any) => s.name === 'Unarmed Combat')?.level ?? 0 : 0)
          const dAthletics = defCharEntry
            ? defCharEntry.character.data?.skills?.find((s: any) => s.skillName === 'Athletics')?.level ?? 0
            : (defNpc && Array.isArray(defNpc.skills?.entries) ? defNpc.skills.entries.find((s: any) => s.name === 'Athletics')?.level ?? 0 : 0)
          const dSmod = Math.max(dUnarmed, dAthletics)

          // Attacker roll — optional Insight Die spend. 3d6 rolls three dice
          // and keeps all three (total = d1+d2+d3+mods) per the SRD keep-all
          // rule; +3 CMod is a flat bonus on top of 2d6. Both deduct 1
          // Insight Die from the PC attacker's state. Only PCs can spend —
          // NPCs don't maintain Insight Dice, so grappleInsight is gated in
          // the UI to PC attackers with insight_dice >= 1.
          let aDie1: number, aDie2: number
          let aDiceRolled: number[] | undefined
          let aBonusCmod = 0
          let insightSpent = false
          if (insightMode === '3d6' && charEntry?.liveState && charEntry.liveState.insight_dice >= 1) {
            const d1 = rollD6(), d2 = rollD6(), d3 = rollD6()
            aDie1 = d1
            aDie2 = d2 + d3  // pack d2+d3 into die2 so existing log schema still works
            aDiceRolled = [d1, d2, d3]
            const newInsight = charEntry.liveState.insight_dice - 1
            await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', charEntry.stateId)
            setEntries(prev => prev.map(e => e.stateId === charEntry.stateId ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } } : e))
            if (charEntry.character?.id) void appendProgressionLog(charEntry.character.id, 'insight', `Spent 1 Insight Die — rolled 3d6 on Grapple`)
            insightSpent = true
          } else if (insightMode === '+3cmod' && charEntry?.liveState && charEntry.liveState.insight_dice >= 1) {
            aDie1 = rollD6()
            aDie2 = rollD6()
            aBonusCmod = 3
            const newInsight = charEntry.liveState.insight_dice - 1
            await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', charEntry.stateId)
            setEntries(prev => prev.map(e => e.stateId === charEntry.stateId ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } } : e))
            if (charEntry.character?.id) void appendProgressionLog(charEntry.character.id, 'insight', `Spent 1 Insight Die — +3 CMod on Grapple`)
            insightSpent = true
          } else {
            aDie1 = rollD6()
            aDie2 = rollD6()
          }
          const aTotal = aDie1 + aDie2 + aPhyMod + aUnarmed + aBonusCmod
          const aOutcome = getOutcome(aTotal)

          const dDie1 = rollD6()
          const dDie2 = rollD6()
          const dTotal = dDie1 + dDie2 + dPhyMod + dSmod
          const dOutcome = getOutcome(dTotal)

          // Determine result
          const attackerWins = isSuccess(aOutcome) && !isSuccess(dOutcome)
          const defenderWins = !isSuccess(aOutcome) && isSuccess(dOutcome)
          const result = attackerWins ? 'grappled' as const : defenderWins ? 'failed' as const : 'no_victor' as const

          // Apply effects
          if (attackerWins) {
            // Target is grappled, take 1 RP
            await supabase.from('initiative_order').update({ grappled_by: active.character_name }).eq('id', targetEntry.id)
            // Apply 1 RP to target
            if (defCharEntry?.liveState) {
              const newRP = Math.max(0, defCharEntry.liveState.rp_current - 1)
              await supabase.from('character_states').update({ rp_current: newRP, updated_at: new Date().toISOString() }).eq('id', defCharEntry.stateId)
            } else if (defNpc) {
              const newRP = Math.max(0, (defNpc.rp_current ?? defNpc.rp_max ?? 6) - 1)
              await supabase.from('campaign_npcs').update({ rp_current: newRP }).eq('id', defNpc.id)
            }
          } else if (defenderWins) {
            // Attacker takes 1 RP
            if (charEntry?.liveState) {
              const newRP = Math.max(0, charEntry.liveState.rp_current - 1)
              await supabase.from('character_states').update({ rp_current: newRP, updated_at: new Date().toISOString() }).eq('id', charEntry.stateId)
            } else if (npcAttacker) {
              const newRP = Math.max(0, (npcAttacker.rp_current ?? npcAttacker.rp_max ?? 6) - 1)
              await supabase.from('campaign_npcs').update({ rp_current: newRP }).eq('id', npcAttacker.id)
            }
          }

          // Log to roll_log
          await supabase.from('roll_log').insert({
            campaign_id: id, user_id: userId, character_name: active.character_name,
            label: `${active.character_name} — Grapple ${targetEntry.character_name}${insightSpent ? (insightMode === '3d6' ? ' (3d6 Insight)' : ' (+3 CMod Insight)') : ''}`,
            die1: aDie1, die2: aDie2, amod: aPhyMod, smod: aUnarmed, cmod: aBonusCmod,
            total: aTotal, outcome: result === 'grappled' ? 'Grappled!' : result === 'failed' ? 'Failed — 1 RP' : 'No clear victor',
          })

          setGrappleResult({
            attackerName: active.character_name, defenderName: targetEntry.character_name,
            aDie1, aDie2, aTotal, aOutcome, aDiceRolled,
            dDie1, dDie2, dTotal, dOutcome,
            result, rpTarget: attackerWins ? targetEntry.character_name : defenderWins ? active.character_name : null,
            insightSpent,
          })

          // Consume action
          await consumeAction(active.id)
        }

        return (
          <div onClick={() => { if (!grappleResult) { setShowGrappleModal(false); setGrappleTarget(null); setGrappleInsight('none') } }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Grapple — Opposed Check</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>{active.character_name}</div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1rem' }}>
                PHY {aPhyMod >= 0 ? '+' : ''}{aPhyMod} · Unarmed {aUnarmed >= 0 ? '+' : ''}{aUnarmed}
              </div>

              {grappleResult ? (
                <>
                  {/* Results */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {/* Attacker roll */}
                    <div style={{ flex: 1, padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>Attacker</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{grappleResult.attackerName}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                        {/* Show three dice when Insight Die 3d6 was spent, two otherwise */}
                        {Array.isArray(grappleResult.aDiceRolled) && grappleResult.aDiceRolled.length > 0
                          ? `${grappleResult.aDiceRolled.join(' + ')} = ${grappleResult.aTotal}`
                          : `${grappleResult.aDie1} + ${grappleResult.aDie2} = ${grappleResult.aTotal}`}
                      </div>
                      {grappleResult.insightSpent && (
                        <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '2px' }}>Insight Die spent</div>
                      )}
                      <div style={{ fontSize: '13px', color: isSuccess(grappleResult.aOutcome) ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', fontWeight: 700 }}>{grappleResult.aOutcome}</div>
                    </div>
                    {/* Defender roll */}
                    <div style={{ flex: 1, padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>Defender</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{grappleResult.defenderName}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                        {grappleResult.dDie1} + {grappleResult.dDie2} = {grappleResult.dTotal}
                      </div>
                      <div style={{ fontSize: '13px', color: isSuccess(grappleResult.dOutcome) ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', fontWeight: 700 }}>{grappleResult.dOutcome}</div>
                    </div>
                  </div>

                  {/* Result banner */}
                  <div style={{
                    padding: '10px', borderRadius: '3px', textAlign: 'center', marginBottom: '1rem',
                    fontSize: '16px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase',
                    background: grappleResult.result === 'grappled' ? '#1a2e10' : grappleResult.result === 'failed' ? '#2a1210' : '#242424',
                    border: `1px solid ${grappleResult.result === 'grappled' ? '#2d5a1b' : grappleResult.result === 'failed' ? '#c0392b' : '#3a3a3a'}`,
                    color: grappleResult.result === 'grappled' ? '#7fc458' : grappleResult.result === 'failed' ? '#f5a89a' : '#d4cfc9',
                  }}>
                    {grappleResult.result === 'grappled' && `${grappleResult.defenderName} is Grappled!`}
                    {grappleResult.result === 'failed' && 'Grapple Failed!'}
                    {grappleResult.result === 'no_victor' && 'No Clear Victor'}
                  </div>
                  {grappleResult.rpTarget && (
                    <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                      {grappleResult.rpTarget} takes 1 RP damage
                    </div>
                  )}

                  <button onClick={() => { setShowGrappleModal(false); setGrappleResult(null); setGrappleTarget(null); setGrappleInsight('none') }}
                    style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Close
                  </button>
                </>
              ) : !grappleTarget ? (
                <>
                  <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Select Target (Engaged)</div>
                  {engagedTargets.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>No targets within Engaged range</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                      {engagedTargets.map(target => (
                        <button key={target.id} onClick={() => { setGrappleTarget(target); setGrappleInsight('none') }}
                          style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: target.is_npc ? '#7fc458' : '#c0392b', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}>
                          {target.character_name}{target.is_npc ? ' (NPC)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowGrappleModal(false); setGrappleTarget(null); setGrappleInsight('none') }}
                    style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {/* Target confirmation + optional Insight Die spend before rolling */}
                  <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Target</div>
                  <div style={{ padding: '8px 12px', marginBottom: '1rem', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', fontSize: '14px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: grappleTarget.is_npc ? '#7fc458' : '#c0392b' }}>
                    {grappleTarget.character_name}{grappleTarget.is_npc ? ' (NPC)' : ''}
                  </div>
                  {/* Insight Die — PC attackers only, must have at least 1 die. Same
                      two options as the main attack modal: 3d6 keep-all, or +3 CMod
                      on 2d6. See grapple flow comment above. */}
                  {charEntry?.liveState && charEntry.liveState.insight_dice >= 1 && (
                    <div style={{ marginBottom: '1rem', padding: '8px', background: '#0f2010', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
                        Spend Insight Die? ({charEntry.liveState.insight_dice} available)
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setGrappleInsight(grappleInsight === '3d6' ? 'none' : '3d6')}
                          style={{ flex: 1, padding: '8px 4px', background: grappleInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${grappleInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Roll 3d6<br /><span style={{ fontSize: '13px', color: grappleInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep all 3</span>
                        </button>
                        <button onClick={() => setGrappleInsight(grappleInsight === '+3cmod' ? 'none' : '+3cmod')}
                          style={{ flex: 1, padding: '8px 4px', background: grappleInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${grappleInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          +3 CMod<br /><span style={{ fontSize: '13px', color: grappleInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setGrappleTarget(null); setGrappleInsight('none') }}
                      style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Back</button>
                    <button onClick={() => executeGrapple(grappleTarget, grappleInsight)}
                      style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      🎲 {grappleInsight === '3d6' ? 'Roll 3d6' : 'Roll Grapple'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Ready Weapon Modal */}
      {showReadyWeaponModal && (() => {
        const active = initiativeOrder.find(e => e.is_active)!
        if (!active) return null
        const charEntry = entries.find(e => e.character.name === active.character_name)
        const npcForWeapon = active.is_npc ? campaignNpcs.find((n: any) => n.name === active.character_name) : null
        const charData = charEntry?.character.data ?? {}
        const primary = charData.weaponPrimary ?? (npcForWeapon?.skills?.weapon ? { weaponName: npcForWeapon.skills.weapon.weaponName, condition: npcForWeapon.skills.weapon.condition ?? 'Used', ammoCurrent: npcForWeapon.skills.weapon.ammoCurrent ?? 0, ammoMax: npcForWeapon.skills.weapon.ammoMax ?? 0, reloads: npcForWeapon.skills.weapon.reloads ?? 0 } : null)
        const secondary = charData.weaponSecondary ?? null
        const primaryW = primary ? getWeaponByName(primary.weaponName) : null
        const secondaryW = secondary ? getWeaponByName(secondary.weaponName) : null

        const canSwitch = !!secondary?.weaponName
        const canReload = !!primaryW && !!primaryW.clip && primaryW.clip > 0 && (primary?.reloads ?? 0) > 0
        const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
        const condIdx = conditions.indexOf(primary?.condition ?? 'Used')
        const canUnjam = condIdx >= 2 // Worn, Damaged, or Broken — allows unjam after single Low Insight degrade

        async function doSwitch() {
          if (!charEntry || !canSwitch) return
          const newData = { ...charData, weaponPrimary: secondary, weaponSecondary: primary }
          await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
          // Update local entries so combat bar reflects the new weapon immediately
          setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} — Switch to ${secondary.weaponName}`)
          setShowReadyWeaponModal(false)
        }

        // Equip a weapon from inventory into the primary or secondary slot
        // (playtest #15 + #16 follow-up). Closes the loot→ready loop:
        // looted weapons land in `character.data.inventory[]` (PC) or
        // `campaign_npcs.inventory` (NPC) as InventoryItem rows. Now
        // clicking Equip on an inventory weapon here:
        //   - decrements that weapon's qty in inventory (removes if 0)
        //   - pushes the existing slot weapon (if any) back to inventory
        //     (stacks with matching entry if one exists)
        //   - writes the inventory weapon into the chosen slot with Used
        //     condition, full clip, and rolled reloads
        //   - consumes the Ready Weapon action
        // Nothing is ever lost — displaced weapons return to inventory.
        // NPCs ignore the `slot` param — they only have a single
        // weapon slot under skills.weapon.
        async function doEquipFromInventory(invItemName: string, slot: 'primary' | 'secondary' = 'primary') {
          const w = getWeaponByName(invItemName)
          if (!w) return
          // Branch on PC vs NPC. Both carry InventoryItem[]; the target
          // row (characters.data vs campaign_npcs.*) and the slot shape
          // (weaponPrimary/Secondary vs skills.weapon) differ.
          if (charEntry) {
            const inv: InventoryItem[] = (charData.inventory ?? []) as InventoryItem[]
            let newInv: InventoryItem[] = inv
              .map(i => i.name === invItemName ? { ...i, qty: i.qty - 1 } : i)
              .filter(i => i.qty > 0)
            const displaced = slot === 'primary' ? primary : secondary
            if (displaced?.weaponName) {
              const existingW = getWeaponByName(displaced.weaponName)
              const idx = newInv.findIndex(i => i.name === displaced.weaponName && !i.custom)
              if (idx >= 0) {
                newInv = newInv.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i)
              } else if (existingW) {
                newInv = [...newInv, { name: displaced.weaponName, enc: existingW.enc, rarity: existingW.rarity, notes: '', qty: 1, custom: false }]
              }
            }
            const newSlotData = {
              weaponName: invItemName,
              condition: 'Used',
              ammoCurrent: w.clip ?? 0,
              ammoMax: w.clip ?? 0,
              reloads: w.ammo ? Math.floor(Math.random() * 3) + 1 : 0,
            }
            const newData = slot === 'primary'
              ? { ...charData, weaponPrimary: newSlotData, inventory: newInv }
              : { ...charData, weaponSecondary: newSlotData, inventory: newInv }
            await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
            setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          } else if (npcForWeapon) {
            const inv: InventoryItem[] = ((npcForWeapon as any).inventory ?? []) as InventoryItem[]
            let newInv: InventoryItem[] = inv
              .map(i => i.name === invItemName ? { ...i, qty: i.qty - 1 } : i)
              .filter(i => i.qty > 0)
            // Displaced NPC weapon goes back to inventory, same stacking rule.
            const currentWeapon = (npcForWeapon.skills as any)?.weapon
            if (currentWeapon?.weaponName) {
              const existingW = getWeaponByName(currentWeapon.weaponName)
              const idx = newInv.findIndex(i => i.name === currentWeapon.weaponName && !i.custom)
              if (idx >= 0) {
                newInv = newInv.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i)
              } else if (existingW) {
                newInv = [...newInv, { name: currentWeapon.weaponName, enc: existingW.enc, rarity: existingW.rarity, notes: '', qty: 1, custom: false }]
              }
            }
            const newWeapon = {
              weaponName: invItemName,
              condition: 'Used',
              ammoCurrent: w.clip ?? 0,
              ammoMax: w.clip ?? 0,
              reloads: w.ammo ? Math.floor(Math.random() * 3) + 1 : 0,
            }
            const newSkills = { ...(npcForWeapon.skills ?? {}), weapon: newWeapon }
            await supabase.from('campaign_npcs').update({ skills: newSkills, inventory: newInv }).eq('id', npcForWeapon.id)
            // Reflect locally so the combat bar / card see the new weapon instantly.
            setCampaignNpcs(prev => prev.map(n => n.id === npcForWeapon.id ? { ...n, skills: newSkills, inventory: newInv } as any : n))
            setRosterNpcs(prev => prev.map(n => n.id === npcForWeapon.id ? { ...n, skills: newSkills, inventory: newInv } as any : n))
          } else {
            return
          }
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} — Ready ${invItemName}${charEntry && slot === 'secondary' ? ' (Secondary)' : ''}`)
          setShowReadyWeaponModal(false)
        }

        // Unequip a weapon back to inventory (PC only — NPCs have a
        // single weapon slot and "unequipping" them would leave them
        // unarmed, which the combat bar doesn't model). The slot's
        // weapon stacks with a matching inventory entry if present;
        // otherwise it's added as a fresh row. Costs 1 action like
        // any other Ready Weapon op.
        async function doUnequip(slot: 'primary' | 'secondary') {
          if (!charEntry) return
          const target = slot === 'primary' ? primary : secondary
          if (!target?.weaponName) return
          const inv: InventoryItem[] = (charData.inventory ?? []) as InventoryItem[]
          const existingW = getWeaponByName(target.weaponName)
          let newInv: InventoryItem[] = inv
          const idx = newInv.findIndex(i => i.name === target.weaponName && !i.custom)
          if (idx >= 0) {
            newInv = newInv.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i)
          } else if (existingW) {
            newInv = [...inv, { name: target.weaponName, enc: existingW.enc, rarity: existingW.rarity, notes: '', qty: 1, custom: false }]
          }
          const newData = slot === 'primary'
            ? { ...charData, weaponPrimary: null, inventory: newInv }
            : { ...charData, weaponSecondary: null, inventory: newInv }
          await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
          setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} — Unequip ${target.weaponName}`)
          setShowReadyWeaponModal(false)
        }

        async function doReload() {
          if (!charEntry || !canReload || !primaryW) return
          const reloaded = { ...primary, ammoCurrent: primaryW.clip, reloads: Math.max(0, (primary.reloads ?? 0) - 1) }
          const newData = { ...charData, weaponPrimary: reloaded }
          await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
          setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} — Reload ${primary.weaponName}`)
          setShowReadyWeaponModal(false)
        }

        async function doUnjam() {
          if (!primary || !canUnjam) return
          const isMelee = primaryW?.category === 'melee'
          // Pick best skill: Tinkerer, Weaponsmith, or Ranged/Melee Combat
          const combatSkill = isMelee ? 'Melee Combat' : 'Ranged Combat'
          const attrForCombat = isMelee ? 'PHY' : 'DEX'
          let bestSkill = combatSkill
          let bestAttr = attrForCombat
          let bestLevel = 0
          const getLevel = (skillName: string) => {
            if (charEntry) {
              return charEntry.character.data?.skills?.find((s: any) => s.skillName === skillName)?.level ?? 0
            }
            if (npcForWeapon) {
              const npcSkills: any[] = Array.isArray(npcForWeapon.skills?.entries) ? npcForWeapon.skills.entries : []
              return npcSkills.find((s: any) => s.name === skillName)?.level ?? 0
            }
            return 0
          }
          const rapid = charEntry ? (charEntry.character.data?.rapid ?? {}) : { RSN: npcForWeapon?.reason ?? 0, ACU: npcForWeapon?.acumen ?? 0, PHY: npcForWeapon?.physicality ?? 0, INF: npcForWeapon?.influence ?? 0, DEX: npcForWeapon?.dexterity ?? 0 }
          const candidates = [
            { skill: 'Tinkerer', attr: 'DEX' },
            { skill: 'Weaponsmith', attr: 'DEX' },
            { skill: combatSkill, attr: attrForCombat },
          ]
          for (const c of candidates) {
            const lvl = getLevel(c.skill)
            if (lvl > bestLevel) { bestLevel = lvl; bestSkill = c.skill; bestAttr = c.attr }
          }
          const amod = (rapid as any)[bestAttr] ?? 0
          clearAimIfActive(active.id)
          handleRollRequest(`Unjam — ${primary.weaponName} (${bestSkill})`, amod, bestLevel)
          actionPreConsumedRef.current = true
          await consumeAction(active.id)
          setShowReadyWeaponModal(false)
        }

        // Tracking bonus — applied automatically
        const hasTracking = primaryW ? getTraitValue(primaryW.traits, 'Tracking') !== null : false

        return (
          <div onClick={() => setShowReadyWeaponModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '380px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Ready Weapon</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{active.character_name}</div>

              {/* Current weapon info */}
              <div style={{ marginBottom: '1rem', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Primary</span>
                  {charEntry && primary?.weaponName && (
                    <button onClick={() => doUnequip('primary')}
                      title="Move to inventory"
                      style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Unequip
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase' }}>{primary?.weaponName ?? 'None'}</div>
                {primary && <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Condition: <span style={{ color: condIdx <= 1 ? '#7fc458' : condIdx === 2 ? '#EF9F27' : '#f5a89a' }}>{primary.condition ?? 'Used'}</span>
                  {primaryW?.clip ? <> · Ammo: <span style={{ color: '#EF9F27' }}>{primary.ammoCurrent ?? 0}/{primaryW.clip}</span> · Reloads: <span style={{ color: '#7ab3d4' }}>{primary.reloads ?? 0}</span></> : null}
                </div>}
                {secondary?.weaponName && <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Secondary</span>
                    {charEntry && (
                      <button onClick={() => doUnequip('secondary')}
                        title="Move to inventory"
                        style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Unequip
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{secondary.weaponName}</div>
                </>}
              </div>

              {hasTracking && (
                <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', padding: '4px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                  Tracking weapon — Ready Weapon grants +1 CMod aim bonus
                </div>
              )}

              {/* Equip from Inventory — any weapon the character is carrying
                  can be readied into the primary slot. Primary goes back to
                  inventory (no loss). Closes the loot→ready gap from
                  playtest #15. Reads PC inventory from characters.data or
                  NPC inventory from campaign_npcs.inventory depending on
                  whose turn it is. Without the NPC branch an NPC could
                  loot a fire axe and still show "Primary: None" here with
                  no way to equip it. */}
              {(() => {
                const inv: InventoryItem[] = charEntry
                  ? ((charData.inventory ?? []) as InventoryItem[])
                  : (((npcForWeapon as any)?.inventory ?? []) as InventoryItem[])
                const invWeapons = inv.filter(i => getWeaponByName(i.name))
                if (invWeapons.length === 0) return null
                return (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Equip from Inventory</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                      {invWeapons.map(item => {
                        const w = getWeaponByName(item.name)!
                        return (
                          <div key={item.name}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                            <span style={{ flex: 1, color: '#7fc458', fontWeight: 700, fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{item.name}</span>
                            <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{w.damage} · {w.range}</span>
                            {item.qty > 1 && <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>×{item.qty}</span>}
                            {charEntry ? (
                              <>
                                <button onClick={() => doEquipFromInventory(item.name, 'primary')}
                                  title="Equip to Primary"
                                  style={{ padding: '3px 8px', background: '#2d5a1b', border: '1px solid #7fc458', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
                                  → 1°
                                </button>
                                <button onClick={() => doEquipFromInventory(item.name, 'secondary')}
                                  title="Equip to Secondary"
                                  style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
                                  → 2°
                                </button>
                              </>
                            ) : (
                              <button onClick={() => doEquipFromInventory(item.name, 'primary')}
                                style={{ padding: '3px 10px', background: '#2d5a1b', border: '1px solid #7fc458', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
                                READY →
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={canSwitch ? doSwitch : undefined} disabled={!canSwitch}
                  style={{ padding: '10px', background: canSwitch ? '#1a1a2e' : '#1a1a1a', border: `1px solid ${canSwitch ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', color: canSwitch ? '#7ab3d4' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canSwitch ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  Switch{secondary?.weaponName ? ` to ${secondary.weaponName}` : ''} {!canSwitch && <span style={{ fontSize: '13px', opacity: 0.5 }}>— no secondary</span>}
                </button>
                <button onClick={canReload ? doReload : undefined} disabled={!canReload}
                  style={{ padding: '10px', background: canReload ? '#2a2010' : '#1a1a1a', border: `1px solid ${canReload ? '#5a4a1b' : '#2e2e2e'}`, borderRadius: '3px', color: canReload ? '#EF9F27' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canReload ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  Reload{primaryW?.clip ? ` (${primary?.reloads ?? 0} remaining)` : ''} {!canReload && !primaryW?.clip && <span style={{ fontSize: '13px', opacity: 0.5 }}>— melee weapon</span>}{!canReload && primaryW?.clip && (primary?.reloads ?? 0) <= 0 && <span style={{ fontSize: '13px', opacity: 0.5 }}>— no reloads left</span>}
                </button>
                <button onClick={canUnjam ? doUnjam : undefined} disabled={!canUnjam}
                  style={{ padding: '10px', background: canUnjam ? '#2a1210' : '#1a1a1a', border: `1px solid ${canUnjam ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', color: canUnjam ? '#f5a89a' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canUnjam ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  Unjam / Repair {!canUnjam && <span style={{ fontSize: '13px', opacity: 0.5 }}>— weapon not damaged</span>}
                </button>
              </div>

              <button onClick={() => setShowReadyWeaponModal(false)}
                style={{ marginTop: '1rem', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {/* Special Check Modal */}
      {showSpecialCheck && (
        <div onClick={() => { setShowSpecialCheck(null); setFirstImpressionNpcId('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '380px' }}>
            {showSpecialCheck === 'perception' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Perception Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Perception modifier (RSN + ACU)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Players only see their own PC(s); GMs can roll Perception
                      for any PC (mirror First Impression pattern below). */}
                  {entries.filter(e => isGM || e.userId === userId).map(e => (
                    <button key={e.character.id} onClick={() => triggerPerceptionCheck(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name} (PER {(e.character.data?.rapid?.RSN ?? 0) + (e.character.data?.rapid?.ACU ?? 0)})</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'gut' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Gut Instinct</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Perception + best of Psychology, Streetwise, Tactics</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Same player-self / GM-all filter as Perception + First Impression. */}
                  {entries.filter(e => isGM || e.userId === userId).map(e => (
                    <button key={e.character.id} onClick={() => triggerGutInstinct(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name}</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'first_impression' && (() => {
              // Eligible NPCs = on the active tactical map OR revealed
              // to any PC. Dedupe by id. Drop dead/mortal NPCs since
              // First Impression doesn't apply to corpses.
              const onMap = mapTokens.filter(t => t.token_type !== 'object' && t.npc_id)
              const revealed = revealedNpcs
              const byId = new Map<string, any>()
              for (const n of revealed) byId.set(n.id, n)
              for (const t of onMap) {
                if (!t.npc_id || byId.has(t.npc_id)) continue
                const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
                if (npc) byId.set(npc.id, npc)
              }
              const eligibleNpcs = [...byId.values()].filter((n: any) => {
                const wp = n.wp_current ?? n.wp_max ?? 10
                return wp > 0 && n.status !== 'dead'
              }).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
              const npcChosen = eligibleNpcs.find((n: any) => n.id === firstImpressionNpcId) ?? null
              return (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>First Impression</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Influence + best of Manipulation, Streetwise, Psychology. Result sets the Relationship CMod between the rolling PC and the target NPC — feeds future Recruitment / social checks.</div>

                {/* NPC target picker */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Target NPC</div>
                  {eligibleNpcs.length === 0 ? (
                    <div style={{ padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px' }}>
                      No NPCs visible on the map or in your sidebar. A GM needs to place an NPC or reveal one first.
                    </div>
                  ) : (
                    <select value={firstImpressionNpcId} onChange={e => setFirstImpressionNpcId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                      <option value="">— pick an NPC —</option>
                      {eligibleNpcs.map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* PC roller buttons — players only see their own PC(s);
                    GMs can roll for any PC (they orchestrate NPC reactions
                    and may need to fire a First Impression on a PC's
                    behalf during an absent player's turn). */}
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Rolling PC</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entries.filter(e => isGM || e.userId === userId).map(e => {
                    const ready = !!npcChosen
                    return (
                      <button key={e.character.id}
                        disabled={!ready}
                        onClick={() => { if (npcChosen) triggerFirstImpression(e.character.name, npcChosen.id, npcChosen.name) }}
                        style={{ ...hdrBtn('#242424', '#d4cfc9', '#3a3a3a'), opacity: ready ? 1 : 0.4, cursor: ready ? 'pointer' : 'not-allowed' }}>
                        {e.character.name} (INF {e.character.data?.rapid?.INF ?? 0})
                      </button>
                    )
                  })}
                </div>
              </>
              )
            })()}
            {showSpecialCheck === 'group' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Group Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Highest modifier leads. Others contribute their SMod. No Insight Dice.</div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Skill</div>
                  <select value={groupCheckSkill} onChange={e => setGroupCheckSkill(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {SKILLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Participants</div>
                  {entries.map(e => (
                    <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={groupCheckParticipants.has(e.character.id)} onChange={() => {
                        setGroupCheckParticipants(prev => { const next = new Set(prev); if (next.has(e.character.id)) next.delete(e.character.id); else next.add(e.character.id); return next })
                      }} style={{ accentColor: '#c0392b' }} />
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{e.character.name}</span>
                    </label>
                  ))}
                </div>
                <button onClick={triggerGroupCheck} disabled={groupCheckParticipants.size === 0 || !groupCheckSkill}
                  style={{ width: '100%', padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: groupCheckParticipants.size === 0 || !groupCheckSkill ? 0.5 : 1 }}>
                  Roll Group Check
                </button>
              </>
            )}
            {showSpecialCheck === 'opposed' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Opposed Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Both sides roll until one succeeds and the other fails. Use standard skill rolls for each side.</div>
                <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', padding: '1rem' }}>
                  Have each participant roll their relevant skill check normally. Compare outcomes — first to get Success while opponent gets Failure wins.
                </div>
              </>
            )}
            <button onClick={() => setShowSpecialCheck(null)}
              style={{ marginTop: '1rem', width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Recruitment Modal (Communities Phase B) ─────────────────── */}
      {showRecruit && (() => {
        const eligibleNpcs = getRecruitEligibleNpcs()
        const pickedNpc = eligibleNpcs.find((n: any) => n.id === recruitNpcId)
        const rollerEntry = entries.find(e => e.character.id === recruitRollerId)
        const cmods = computeRecruitCmods()
        const suggestedSkills = suggestedSkillsForApproach(recruitApproach)
        const hasAnyCommunity = recruitCommunityList.length > 0
        const resolvedCommunityName = recruitCommunityId === '__new__'
          ? (recruitNewCommunityName.trim() || '— new community —')
          : (recruitCommunityList.find(c => c.id === recruitCommunityId)?.name ?? '')
        const canRoll = !!rollerEntry && !!pickedNpc && !!recruitSkill && (
          recruitCommunityId === '__new__'
            ? recruitNewCommunityName.trim().length > 0
            : !!recruitCommunityId
        )
        const pcHasApprentice = recruitRollerId ? !!apprenticeByCharacter[recruitRollerId] : false
        const poachingNpcCommunity = recruitNpcId ? npcCommunityMap[recruitNpcId] : null
        // Apprentice eligibility — SRD §08 p.21: ONLY a Moment of
        // High Insight (double-6) grants the Apprentice option.
        // Wild Success (plain 14+ without matching faces) does not.
        const isHighInsight = recruitResult?.outcome === 'High Insight'
        return (
          <div onClick={closeRecruitModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Recruitment</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>
                {recruitStep === 'pick' ? 'Pick target & approach' : recruitStep === 'roll' ? 'Review the roll' : 'Outcome'}
              </div>

              {/* ── STEP PICK ── */}
              {recruitStep === 'pick' && (
                <>
                  {/* Roller PC — players only see their own PC; GMs
                      see everyone (they may orchestrate on behalf of
                      an absent player). Stops Percy from rolling a
                      First Impression or Recruitment Check *as* Ada. */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Rolling PC</div>
                    <select value={recruitRollerId} onChange={e => setRecruitRollerId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                      <option value="">— pick a PC —</option>
                      {entries.filter(e => isGM || e.userId === userId).map(e => (
                        <option key={e.character.id} value={e.character.id}>{e.character.name} (INF {e.character.data?.rapid?.INF ?? 0})</option>
                      ))}
                    </select>
                  </div>

                  {/* Target NPC */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Target NPC</div>
                    {eligibleNpcs.length === 0 ? (
                      <div style={{ padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px' }}>
                        No NPCs visible on the map or in your sidebar. A GM needs to reveal one first.
                      </div>
                    ) : (
                      <select value={recruitNpcId} onChange={e => setRecruitNpcId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                        <option value="">— pick an NPC —</option>
                        {eligibleNpcs.map((n: any) => {
                          const mem = npcCommunityMap[n.id]
                          return <option key={n.id} value={n.id}>{n.name}{mem ? ` — already in ${mem.name}` : ''}</option>
                        })}
                      </select>
                    )}
                    {poachingNpcCommunity && (
                      <div style={{ marginTop: '6px', padding: '6px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                        ⚠ Poaching penalty: {pickedNpc?.name} is already in {poachingNpcCommunity.name} (−3 CMod)
                      </div>
                    )}
                  </div>

                  {/* Community */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Community</div>
                    {hasAnyCommunity ? (
                      <select value={recruitCommunityId} onChange={e => setRecruitCommunityId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                        <option value="">— pick a community —</option>
                        {recruitCommunityList.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.member_count} member{c.member_count === 1 ? '' : 's'})</option>
                        ))}
                        <option value="__new__">+ Found a new community</option>
                      </select>
                    ) : (
                      <div style={{ padding: '8px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>
                        No communities yet — this recruit will found a new one.
                        {(() => { if (recruitCommunityId !== '__new__') setRecruitCommunityId('__new__'); return null })()}
                      </div>
                    )}
                    {recruitCommunityId === '__new__' && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Name</div>
                        <input value={recruitNewCommunityName} onChange={e => setRecruitNewCommunityName(e.target.value)} placeholder="e.g. The Greenhouse"
                          style={{ width: '100%', padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          <input type="checkbox" checked={recruitNewCommunityPublic} onChange={e => setRecruitNewCommunityPublic(e.target.checked)} />
                          Make this community public (discoverable via LFG — coming soon)
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Approach */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Approach</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['cohort', 'conscript', 'convert'] as RecruitApproach[]).map(ap => (
                        <button key={ap} onClick={() => { setRecruitApproach(ap); setRecruitSkill('') }}
                          style={{ flex: 1, padding: '8px 6px', background: recruitApproach === ap ? '#2d5a1b' : '#242424', border: `1px solid ${recruitApproach === ap ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: recruitApproach === ap ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {ap}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow, sans-serif' }}>
                      {recruitApproach === 'cohort' ? 'Shared interest or goal — joins until the next Morale Check.'
                        : recruitApproach === 'conscript' ? 'Coerced by credible threat — follows orders while coercion holds.'
                        : 'Shared belief or ideology — probationary through first Morale Check, then committed.'}
                    </div>
                    {/* Pressgang gate — explicit warning on Conscript so
                        the GM/players see this is coercion, not
                        persuasion, before rolling. A blocking confirm
                        fires on submit; this banner just makes it
                        visible earlier. */}
                    {recruitApproach === 'conscript' && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                        ⚠ <span style={{ fontWeight: 700 }}>Pressgang.</span> This is pressure, not persuasion. The PC must have established a credible threat (weapons drawn, leverage held, escape cut off) before the roll. You'll be asked to confirm on submit.
                      </div>
                    )}
                  </div>

                  {/* Skill */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Skill</div>
                    <select value={recruitSkill} onChange={e => setRecruitSkill(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                      <option value="">— pick a skill —</option>
                      <optgroup label={`Suggested for ${recruitApproach}`}>
                        {suggestedSkills.map(s => {
                          const lvl = rollerEntry ? ((rollerEntry.character.data?.skills ?? []).find((sk: any) => sk.skillName === s)?.level ?? 0) : 0
                          return <option key={s} value={s}>{s} (Lv {lvl})</option>
                        })}
                      </optgroup>
                      <optgroup label="Other social">
                        {RECRUITMENT_ALL_SKILLS.filter(s => !suggestedSkills.includes(s)).map(s => {
                          const lvl = rollerEntry ? ((rollerEntry.character.data?.skills ?? []).find((sk: any) => sk.skillName === s)?.level ?? 0) : 0
                          return <option key={s} value={s}>{s} (Lv {lvl})</option>
                        })}
                      </optgroup>
                    </select>
                  </div>

                  {/* CMod preview */}
                  <div style={{ marginBottom: '12px', padding: '10px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>CMod stack</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: '#d4cfc9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>First Impression</span>
                        <span style={{ color: cmods.firstImpression > 0 ? '#7fc458' : cmods.firstImpression < 0 ? '#f5a89a' : '#5a5550' }}>
                          {cmods.firstImpression > 0 ? `+${cmods.firstImpression}` : cmods.firstImpression}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Inspiration skill (+1/level)</span>
                        <span style={{ color: cmods.inspiration > 0 ? '#7fc458' : '#5a5550' }}>
                          {cmods.inspiration > 0 ? `+${cmods.inspiration}` : '0'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Poaching penalty</span>
                        <span style={{ color: cmods.poaching < 0 ? '#f5a89a' : '#5a5550' }}>
                          {cmods.poaching < 0 ? cmods.poaching : '0'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>GM adjustment</span>
                        <input type="number" value={recruitGmCmod} onChange={e => setRecruitGmCmod(parseInt(e.target.value) || 0)}
                          style={{ width: '60px', padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'right' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #2e2e5a', marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}>
                        <span>TOTAL CMOD</span>
                        <span style={{ color: cmods.total > 0 ? '#7fc458' : cmods.total < 0 ? '#f5a89a' : '#f5f2ee' }}>
                          {cmods.total > 0 ? `+${cmods.total}` : cmods.total}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pre-roll Insight Die — show only if the roller has ≥1 */}
                  {(() => {
                    const insightAvail = rollerEntry?.liveState?.insight_dice ?? 0
                    if (insightAvail < 1) return null
                    const pill = (active: boolean) => ({
                      flex: 1, padding: '8px 10px',
                      background: active ? '#2a102a' : '#242424',
                      border: `1px solid ${active ? '#d48bd4' : '#3a3a3a'}`,
                      borderRadius: '3px',
                      color: active ? '#fff' : '#d4cfc9',
                      fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
                    } as React.CSSProperties)
                    return (
                      <div style={{ marginBottom: '12px', padding: '10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px' }}>
                        <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Insight Die (pre-roll)</span>
                          <span style={{ color: '#cce0f5' }}>{insightAvail} available</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setRecruitPreInsight('none')} style={pill(recruitPreInsight === 'none')}>None</button>
                          <button onClick={() => setRecruitPreInsight('3d6')} style={pill(recruitPreInsight === '3d6')}>Roll 3d6</button>
                          <button onClick={() => setRecruitPreInsight('+3cmod')} style={pill(recruitPreInsight === '+3cmod')}>+3 CMod</button>
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', lineHeight: 1.4 }}>
                          Spends 1 Insight Die. <strong>3d6</strong> keeps all three dice; <strong>+3 CMod</strong> flat-adds 3 to the total.
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={closeRecruitModal}
                      style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={executeRecruitRoll} disabled={!canRoll}
                      style={{ flex: 2, padding: '10px', background: canRoll ? '#c0392b' : '#2a1210', border: `1px solid ${canRoll ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: canRoll ? '#fff' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: canRoll ? 'pointer' : 'not-allowed' }}>
                      🎲 Roll Recruitment
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP RESULT ── */}
              {recruitStep === 'result' && recruitResult && (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {([recruitResult.die1, recruitResult.die2, ...(recruitResult.die3 !== undefined ? [recruitResult.die3] : [])]).map((d, i) => (
                      <div key={i} style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', textAlign: 'center', fontSize: '24px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
                    [{recruitResult.die1}+{recruitResult.die2}{recruitResult.die3 !== undefined ? `+${recruitResult.die3}` : ''}]
                    {recruitResult.amod !== 0 && <span style={{ color: recruitResult.amod > 0 ? '#7fc458' : '#c0392b' }}> {recruitResult.amod > 0 ? '+' : ''}{recruitResult.amod} AMod</span>}
                    {recruitResult.smod !== 0 && <span style={{ color: recruitResult.smod > 0 ? '#7fc458' : '#c0392b' }}> {recruitResult.smod > 0 ? '+' : ''}{recruitResult.smod} SMod</span>}
                    {recruitResult.cmod !== 0 && <span style={{ color: recruitResult.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {recruitResult.cmod > 0 ? '+' : ''}{recruitResult.cmod} CMod</span>}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {recruitResult.total}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: outcomeColor(recruitResult.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                    {recruitResult.outcome}
                  </div>
                  <div style={{ padding: '12px', background: recruitResult.inserted ? '#0f1a0f' : '#2a1210', border: `1px solid ${recruitResult.inserted ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', marginBottom: '1rem', lineHeight: 1.4 }}>
                    {recruitResult.inserted ? (
                      <>
                        <strong>{recruitResult.npcName}</strong> joined <strong>{recruitResult.communityName}</strong>
                        {recruitResult.apprenticeApplied ? ` as an Apprentice to ${recruitResult.rollerName}.` : ` as a ${recruitResult.approach.charAt(0).toUpperCase() + recruitResult.approach.slice(1)}.`}
                      </>
                    ) : (
                      <>The attempt failed. <strong>{recruitResult.npcName}</strong> is not joining {recruitResult.communityName}.</>
                    )}
                  </div>

                  {/* Post-roll Insight Die reroll — spend 1 to reroll a single die.
                      Moments of Insight (double-1 Low / double-6 High) are
                      locked per XSE rules: the double-face outcome
                      overrides the modifier math and cannot be rerolled
                      or otherwise altered. Hide the reroll box in that
                      case. */}
                  {(() => {
                    const rollerEntry = entries.find(e => e.character.name === recruitResult.rollerName)
                    const insightAvail = rollerEntry?.liveState?.insight_dice ?? 0
                    if (insightAvail < 1) return null
                    if (recruitResult.outcome === 'Low Insight' || recruitResult.outcome === 'High Insight') return null
                    const btn = (label: string, which: 1 | 2 | 3) => (
                      <button onClick={() => rerollRecruitDie(which)}
                        style={{ flex: 1, padding: '8px 10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {label}
                      </button>
                    )
                    return (
                      <div style={{ marginBottom: '1rem', padding: '10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px' }}>
                        <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Spend Insight to Reroll</span>
                          <span style={{ color: '#cce0f5' }}>{insightAvail} available</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {btn(`Re-roll Die 1 (${recruitResult.die1})`, 1)}
                          {btn(`Re-roll Die 2 (${recruitResult.die2})`, 2)}
                          {recruitResult.die3 !== undefined && btn(`Re-roll Die 3 (${recruitResult.die3})`, 3)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', lineHeight: 1.4 }}>
                          Rerolling flips membership state if the outcome crosses the success line.
                        </div>
                      </div>
                    )
                  })()}

                  {/* Apprentice toggle — re-shown only after a Moment
                      of High Insight (double-6). Wild Success alone
                      does NOT unlock Apprentice per XSE SRD §08 p.21. */}
                  {isHighInsight && recruitResult.inserted && !recruitResult.apprenticeApplied && !pcHasApprentice && (
                    <div style={{ padding: '10px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>⭐ Apprentice Eligible</div>
                      <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                        A Moment of High Insight (double-6) on this recruit allows {recruitResult.rollerName} to take {recruitResult.npcName} as an Apprentice (1 per PC).
                      </div>
                      <button onClick={async () => {
                        await supabase.from('community_members')
                          .update({ recruitment_type: 'apprentice', apprentice_of_character_id: recruitRollerId })
                          .eq('community_id', recruitResult.communityId)
                          .eq('npc_id', recruitNpcId)
                        setRecruitResult(r => r ? { ...r, apprenticeApplied: true } : r)
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('tapestry:recruit-updated', { detail: { npcId: recruitNpcId } }))
                        }
                      }}
                        style={{ padding: '6px 12px', background: '#8b2e8b', border: '1px solid #d48bd4', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Take as Apprentice
                      </button>
                    </div>
                  )}

                  <button onClick={closeRecruitModal}
                    style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Insight Die Save Modal */}
      {insightSavePrompt && (() => {
        const isMyPC = (insightSavePrompt as any).targetUserId === userId
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🩸</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#c0392b', marginBottom: '8px' }}>
              Mortal Injury
            </div>
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', marginBottom: '6px' }}>
              <strong>{insightSavePrompt.targetName}</strong> is mortally wounded!
            </div>
            {isMyPC ? (
              /* Player's own PC — they choose */
              insightSavePrompt.insightDice > 0 ? (
                <>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
                    Trade ALL Insight Dice to survive with 1 WP and 1 RP?
                    <br /><span style={{ fontSize: '13px', color: '#7fc458' }}>({insightSavePrompt.insightDice} Insight {insightSavePrompt.insightDice === 1 ? 'Die' : 'Dice'} will be lost)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleInsightSave(true)}
                      style={{ flex: 1, padding: '10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Trade All Dice — Survive
                    </button>
                    <button onClick={() => handleInsightSave(false)}
                      style={{ flex: 1, padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Accept Fate
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '14px', color: '#f5a89a', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
                    No Insight Dice available to trade. {insightSavePrompt.targetName} will die if not stabilized.
                  </div>
                  <button onClick={() => { setInsightSavePrompt(null); initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound_resolved', payload: {} }) }}
                    style={{ width: '100%', padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Understood
                  </button>
                </>
              )
            ) : (
              /* GM or other player — read-only view */
              <>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
                  {insightSavePrompt.insightDice > 0
                    ? `Waiting for ${insightSavePrompt.targetName}'s player to decide whether to trade ${insightSavePrompt.insightDice} Insight ${insightSavePrompt.insightDice === 1 ? 'Die' : 'Dice'}...`
                    : `${insightSavePrompt.targetName} has no Insight Dice. Waiting for player to acknowledge...`}
                </div>
                <button onClick={() => setInsightSavePrompt(null)}
                  style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
        )
      })()}

    </div>
  )
}

// Option B "subdued pill" — neutral dark bg, no border, 8px radius. The
// three args are preserved for source compatibility, but only `color`
// (text color) still affects the visual. `bg` / `border` are ignored in
// favor of a unified `#1a1a1a` pill that hovers to `#242424` via the
// `.hdr-btn` class rule in globals.css. Keeps the muscle-memory of
// color-coded headers by carrying the hue on the TEXT only, so 6-7
// buttons in a row no longer compete as solid colored rectangles.
const hdrBtn = (_bg: string, color: string, _border: string): React.CSSProperties => ({
  padding: '4px 14px', background: '#1a1a1a', border: 'none', borderRadius: '8px',
  color, fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  height: '28px', minWidth: '70px', boxSizing: 'border-box',
  appearance: 'none', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0, verticalAlign: 'middle',
})
