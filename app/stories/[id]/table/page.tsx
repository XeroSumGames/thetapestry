'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { getCampaignNpcs } from '../../../../lib/data/campaign-npcs'
import { insertRollLog, deleteRollLog } from '../../../../lib/data/roll-log'
import { prepareUpload } from '../../../../lib/safe-upload'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../../../components/CharacterCard'
import type { InventoryItem } from '../../../../components/InventoryPanel'
import NpcRoster, { getNpcRingColor, getNpcTokenBorderColor } from '../../../../components/NpcRoster'
import NpcCard from '../../../../components/NpcCard'
import TradeNegotiationModal from '../../../../components/TradeNegotiationModal'
import PlayerNpcCard from '../../../../components/PlayerNpcCard'
import ObjectCard from '../../../../components/ObjectCard'
import VehicleCard, { Vehicle } from '../../../../components/VehicleCard'
import RollModal, { type RollResult as SharedRollResult } from '../../../../components/RollModal'
import HelpTooltip from '../../../../components/HelpTooltip'
import InitiativeBar from '../../../../components/InitiativeBar'
import { useChatPanel } from '../../../../components/TableChat'
import { useRollsFeed } from '../../../../components/RollsFeed'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { wrapBroadcast, wrapDbChange } from '../../../../lib/sentry-realtime'
import { useCampaignChannel } from '../../../../lib/realtime/useCampaignChannel'
import { reportSupabaseError } from '../../../../lib/supabase-errors'
import { useHeaderMenus } from './hooks/useHeaderMenus'
import { useGmTools } from './hooks/useGmTools'
import { useRollResolution } from './hooks/useRollResolution'
import { useRecorderToggle } from './hooks/useRecorderToggle'
import {
  firstImpressionCmodDelta,
  firstImpressionProgressionMessage,
  resolveFirstImpression,
} from '../../../../lib/first-impression-resolver'
import FirstImpressionModal, { type FiPc, type FiNpc } from './components/FirstImpressionModal'
import { CdpModal } from './components/CdpModal'
import { PlayerStatusChips } from './components/PlayerStatusChips'
import { LootModal } from './components/LootModal'
import { PopulateModal } from './components/PopulateModal'
import { AdvanceTimeModal } from './components/AdvanceTimeModal'
import { EndSessionModal } from './components/EndSessionModal'
import { ReloadPickerModal } from './components/ReloadPickerModal'
import { RestorePickerModal } from './components/RestorePickerModal'
import { GrantAdvantageModal } from './components/GrantAdvantageModal'
import { FeedColumn } from './components/FeedColumn'
import { CommunityStatusModal } from './components/CommunityStatusModal'
import { reorderNpcs, dirtyNpcSortRows, persistNpcSort, persistNpcFolder } from '../../../../lib/npc-drag-drop'
import {
  type Advantage,
  consumeAdvantage,
  listCampaignPendingAdvantages,
} from '../../../../lib/advantages'
import { isThriver as roleIsThriver } from '../../../../lib/auth/roles'
import { SETTINGS } from '../../../../lib/settings'
import dynamic from 'next/dynamic'
const CampaignMap = dynamic(() => import('../../../../components/CampaignMap'), { ssr: false })
const TacticalMap = dynamic(() => import('../../../../components/TacticalMap'), { ssr: false })
// Lazy: gated behind tabs / modals / GM toggle. None render on initial paint,
// so chunking them out shrinks the first-load bundle without changing UX.
// `loading: () => null` keeps the gate's outer container empty during the
// chunk fetch instead of showing a Next.js default placeholder.
const QuickAddModal = dynamic(() => import('../../../../components/QuickAddModal'), { ssr: false, loading: () => null })
const GmNotes = dynamic(() => import('../../../../components/GmNotes'), { ssr: false, loading: () => null })
const PlayerNotes = dynamic(() => import('../../../../components/PlayerNotes'), { ssr: false, loading: () => null })
const CampaignPins = dynamic(() => import('../../../../components/CampaignPins'), { ssr: false, loading: () => null })
const CampaignObjects = dynamic(() => import('../../../../components/CampaignObjects'), { ssr: false, loading: () => null })
import type { CampaignNpc } from '../../../../components/NpcRoster'
import { getCategoryEmoji } from '../../../../lib/pin-categories'
import { queuePendingHeal } from '../../../../lib/campaign-clock'
import { defaultSpawnCell } from '../../../../lib/tactical-spawn'
import { shouldFollowSharedTactical, shouldRenderTactical } from '../../../../lib/tactical-view'
import { logEvent } from '../../../../lib/events'
import { openPopout } from '../../../../lib/popout'
import { renderRichText } from '../../../../lib/rich-text'
import { downloadDump as recorderDownloadDump, wipeBuffer as recorderWipeBuffer, setEnabled as recorderSetEnabled, writeCampaignEnabled, trace } from '../../../../lib/playtest-recorder'
import { rollDamage, calculateDamage, type ArmorPiece, type AttackerCategory } from '../../../../lib/damage'
import { restoreCampaignSnapshot, type CampaignSnapshot } from '../../../../lib/campaign-snapshot'
import { useStableCallback } from '../../../../lib/useStableCallback'
import { appendProgressionEntry } from '../../../../lib/progression-log'
import ApprenticeCreationWizard from '../../../../components/ApprenticeCreationWizard'
import { getWeaponByName, getTraitValue, CONDITION_CMOD } from '../../../../lib/weapons'
import { getOutcome, outcomeColor, compactRollSummary } from '../../../../lib/roll-helpers'
import { OUTCOME } from '../../../../lib/roll-outcomes'
import { isStabilizeSuccess, rollIncapRounds, stabilizeNarrative } from '../../../../lib/stabilize-helpers'
import { distractActionDelta, distractNarrative } from '../../../../lib/distract-helpers'
import { gutInstinctSmod } from '../../../../lib/gut-instinct-helpers'
import { getRangeBand as getRangeBandFromFeet, getWeaponRangeCMod, canHitAtRange } from '../../../../lib/range-profiles'
import { computeBlastSplash, mortalWoundCountdown, buildCmodBreakdown, computeAttackCmod, type CmodSources, type AttackCmodCtx } from '../../../../lib/table-roll-context'
import { SKILLS, MOTIVATIONS, COMPLICATIONS, ARMOR, LASTING_WOUNDS, LASTING_WOUND_NARRATIVE } from '../../../../lib/xse-schema'
import { rollThreeWords, rollApprenticeAge } from '../../../../lib/xse-engine'

// Types + module constants live in ./types.ts (extracted 2026-05-17 as
// Phase 3.0 step 1 of the page.tsx decomposition - pure mechanical move,
// no runtime change). See tasks/page-tsx-decomposition-plan.md.
import {
  type Campaign,
  type TableEntry,
  type GmInfo,
  type RollEntry,
  type WeaponContext,
  type PendingRoll,
  type DamageResult,
  type RollResult,
  type ApprenticeBond,
  type InitiativeEntry,
  MAX_PLAYER_SLOTS,
  SOCIAL_SKILLS,
  rollD6,
} from './types'

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const rollsFeed = useRollsFeed({ campaignId: id })
  // Callback ref that wires the feed scroll container to BOTH the
  // existing rollsFeed.rollFeedRef (used by useRollsFeed for its
  // scrollToBottom helper) AND the feedScrollEl state (used by the
  // Chat tab's Virtuoso virtualization). Same DOM node, two consumers.
  const setFeedScrollContainer = useCallback((el: HTMLDivElement | null) => {
    rollsFeed.rollFeedRef.current = el
    setFeedScrollEl(el)
  }, [rollsFeed.rollFeedRef])
  const npcFetchInFlightRef = useRef(false)  // Suppress realtime callback during manual NPC re-fetch
  const myCharIdRef = useRef<string | null>(null)
  // loadEntries sequence guard - see definition below.
  const loadEntriesSeqRef = useRef(0)
  const loadInitSeqRef = useRef(0)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  useEffect(() => { userIdRef.current = userId }, [userId])
  // Companion refs for long-lived listeners that need a fresh snapshot
  // of gmLike / entries / campaignNpcs. The infection-check stale-
  // closure post-mortem (56c0534, lessons.md) showed why these have to
  // be refs not closures: listeners are registered once in a [id]-deps
  // useEffect and never re-bound. Plain React state captured in those
  // closures stays at the mount-time value forever.
  const gmLikeRef = useRef<boolean>(false)
  const entriesRef = useRef<TableEntry[]>([])
  const campaignNpcsRef = useRef<CampaignNpc[]>([])

  // Header-bar nested dropdowns (Checks / Community / GM Tools).
  // State + outside-click / ESC handling live in useHeaderMenus
  // (extracted 2026-05-19 as Phase 3.0 step 2 of the page.tsx
  // decomposition). Behavior unchanged.
  const { openHeaderMenu, setOpenHeaderMenu, isMenuPinned, setIsMenuPinned } = useHeaderMenus()

  // initiative channel (3d.2b) - migrated off the imperative load() setup onto
  // useCampaignChannel. Gated on userId so the notifications postgres filter has
  // the real id baked in at subscribe time (matches the old "subscribe after
  // getUser" behavior). Handlers receive the typed PAYLOAD directly (the
  // primitive unwraps msg.payload + auto-Sentry-wraps); bodies are otherwise
  // unchanged and read companion refs (userIdRef/gmLikeRef/...) to stay fresh.
  // initChannelRef aliases the handle's channelRef so every existing
  // initChannelRef.current?.send(...) site + the useRollResolution hook are untouched.
  const initChannel = useCampaignChannel(userId ? id : null, {
    channelName: `initiative_${id}`,
    postgres: [
      { label: 'initiative_order:*', event: '*', table: 'initiative_order', filter: `campaign_id=eq.${id}`, handler: () => loadInitiative(id) },
      { label: 'notifications:INSERT', event: 'INSERT', table: 'notifications', filter: `user_id=eq.${userId}`, handler: (payload: any) => {
        if (payload.new?.type === 'session_kick') { alert('You have been removed from this session by the GM.'); window.location.href = `/stories/${id}` }
      } },
    ],
    broadcasts: {
      recorder_start: () => { recorderWipeBuffer(); recorderSetEnabled(true); writeCampaignEnabled(id, true); setRecorderEnabled(true) },
      recorder_stop: () => { recorderDownloadDump(); recorderSetEnabled(false); writeCampaignEnabled(id, false); setRecorderEnabled(false) },
      combat_ended: () => { setInitiativeOrder([]); setCombatActive(false); setViewingNpcs([]); setShowTacticalMap(true) },
      player_kicked: (payload) => { if (payload?.userId === userIdRef.current) { alert('You have been removed from this session by the GM.'); window.location.href = `/stories/${id}` } },
      combat_started: () => { loadInitiative(id); rollsFeed.refetch() },
      tactical_shared: (payload) => { setTacticalShared(payload?.shared ?? false); if (shouldFollowSharedTactical(gmLikeRef.current)) setShowTacticalMap(payload?.shared ?? false) },
      tactical_unshared: () => { setTacticalShared(false); if (shouldFollowSharedTactical(gmLikeRef.current)) setShowTacticalMap(false) },
      scene_activated: () => { if (tacticalSharedRef.current && shouldFollowSharedTactical(gmLikeRef.current)) setShowTacticalMap(true); setTokenRefreshKey(k => k + 1) },
      gut_instinct_resolved: (payload) => {
        if (!gmLikeRef.current) return
        if (!payload) return
        const { pcOwnerId, characterName, outcome } = payload
        if (!pcOwnerId || !characterName || !outcome) return
        if (pcOwnerId === userIdRef.current) return
        setGutInstinctPrompt({ pcOwnerId, characterName, outcome })
        setGutInstinctDetail('')
      },
      token_changed: () => { setTokenRefreshKey(k => k + 1) },
      turn_changed: () => { loadInitiative(id); loadEntries(id); rollsFeed.refetch() },
      turn_advance_requested: async () => { await nextTurn(); await loadInitiative(id) },
      logs_cleared: () => { rollsFeed.clear(); chat.clear(); rollsFeed.refetch(); chat.refetch() },
      npc_damaged: async (payload) => {
        const { npcId, patch } = payload ?? {}
        trace('npc_damaged', { recv: true, npcId, patch })
        if (npcId && patch) {
          setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
          setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
          setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
        } else {
          const { data } = await getCampaignNpcs(id)
          if (data) {
            setCampaignNpcs(data)
            setRosterNpcs(data.filter((n: any) => { if (n.status !== 'active') return false; const wp = n.wp_current ?? n.wp_max ?? 10; return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0) }))
            setViewingNpcs(prev => prev.map(vn => { const fresh = data.find((f: any) => f.id === vn.id); return fresh ? { ...fresh } as CampaignNpc : vn }))
          }
        }
      },
      pc_damaged: (payload) => {
        const sid = payload?.stateId
        const patch = payload?.patch
        if (sid && patch) setEntries(prev => prev.map(e => e.stateId === sid ? { ...e, liveState: { ...e.liveState, ...patch } } : e))
        loadEntries(id)
      },
      inventory_transfer: () => { loadEntries(id) },
      pc_mortal_wound: (payload) => { if (payload && (payload.targetUserId === userIdRef.current || gmLikeRef.current)) setInsightSavePrompt(payload) },
      pc_mortal_wound_resolved: () => { setInsightSavePrompt(null); loadEntries(id) },
      lasting_damage_check_request: (payload) => {
        const data = payload
        if (!data) return
        if (data.isPc) { if (data.targetUserId !== userIdRef.current) return } else { if (!gmLikeRef.current) return }
        let phyAmod = 0
        if (data.isPc) { const pcEntry = entriesRef.current.find(e => e.character.name === data.name); phyAmod = pcEntry?.character.data?.rapid?.PHY ?? 0 }
        else { const npcRow = campaignNpcsRef.current.find((n: any) => n.name === data.name); phyAmod = (npcRow as any)?.physicality ?? 0 }
        handleRollRequest(`${data.name} - Lasting Damage Check`, phyAmod, 0)
      },
      infection_check_request: (payload) => {
        const data = payload
        if (!data || data.targetUserId !== userIdRef.current) return
        handleRollRequest(`${data.name} - Infection Check (Wound)`, data.amod ?? 0, 0)
      },
      npcs_revealed: async () => {
        const { data: fresh } = await getCampaignNpcs(id)
        const freshList = fresh ?? []
        if (freshList.length > 0) {
          setCampaignNpcs(freshList)
          setRosterNpcs(freshList.filter((n: any) => { if (n.status !== 'active') return false; const wp = n.wp_current ?? n.wp_max ?? 10; return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0) }))
        }
        loadRevealedNpcs(myCharIdRef.current, freshList)
      },
    },
  })
  const initChannelRef = initChannel.channelRef

  // Tab-local playtest-recorder lifecycle (extracted -> hooks/useRecorderToggle).
  // GM-cascaded: toggleRecorder broadcasts recorder_start/stop; the recorder_start/
  // recorder_stop handlers on the initiative channel above call setRecorderEnabled here.
  const { recorderEnabled, recorderToggling, toggleRecorder, setRecorderEnabled } = useRecorderToggle(id, initChannelRef)

  // Close any open header-bar dropdown on outside click or ESC. The
  // click target is checked against `[data-header-menu]` containers;
  // anything outside that closes the menu.
  // outside-click + ESC handling for header menus now lives inside
  // useHeaderMenus (see import at top + hook call above).
  // Per-PC stress memory - used to detect the <5 → 5 transition at the
  // table-page level so the Stress Check modal fires even when the target's
  // CharacterCard sheet isn't mounted.
  const prevStressByStateIdRef = useRef<Map<string, number>>(new Map())
  // Set on load to skip threshold triggers on the initial entries snapshot
  // (otherwise a PC who's ALREADY at 5 from a previous session would pop the
  // modal again on every page load).
  const stressWatchPrimedRef = useRef(false)
  const [myUsername, setMyUsername] = useState<string>('')
  const [isGM, setIsGM] = useState(false)
  // Thriver = app-level admin role. Gets full GM parity (godmode) so
  // they can run / debug / repair any campaign, not just their own.
  // RLS already lets Thrivers read+write everywhere - see
  // sql/thriver-godmode-policies.sql. The UI matches by routing
  // gmLike (= isGM || isThriver) anywhere `isGM` gates an editable
  // affordance. Strict isGM is kept for label-only surfaces ("GM View",
  // "GM Tools" menu name) where Thrivers should still read as themselves.
  const [isThriver, setIsThriver] = useState(false)
  const gmLike = isGM || isThriver
  // Sync gmLikeRef every render so listener closures get a fresh read.
  useEffect(() => { gmLikeRef.current = gmLike }, [gmLike])
  const [entries, setEntries] = useState<TableEntry[]>([])
  useEffect(() => { entriesRef.current = entries }, [entries])
  const [gmInfo, setGmInfo] = useState<GmInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<TableEntry | null>(null)
  // Vehicle inline takeover - mirrors the character-sheet inline path.
  // When set, the full /vehicle popout UI renders as an iframe over the
  // center area (same absolute-inset-0 overlay as the character sheet).
  // Cleared on close, or when a character sheet opens (one inline view
  // at a time). The Popout button on VehicleCard stays as the
  // separate-window option.
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  // One inline view at a time: opening a character sheet always closes
  // any open vehicle takeover. Vehicle-open already clears selectedEntry
  // in VehicleCard's onClickInline callback, so this useEffect only
  // covers the other direction.
  useEffect(() => {
    if (selectedEntry) setSelectedVehicleId(null)
  }, [selectedEntry])
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null)
  // Dedicated <RollModal> state for Stabilize - migrated off pendingRoll
  // 2026-05-20 (Phase 1 of tasks/spec-stabilize-migration.md). The legacy
  // executeRoll Stabilize branch (around L6140) is now unreachable from
  // the in-app dropdown trigger - left in place as a paper trail / safety
  // net until Phase 4 retirement.
  const [stabilizePending, setStabilizePending] = useState<{
    medicEntryId: string         // initiative_order.id of the medic (active combatant)
    medicName: string            // for narrative + log
    targetName: string
    targetKind: 'pc' | 'npc'
    amod: number                 // medic's RSN AMod
    smod: number                 // medic's Medicine SMod
  } | null>(null)
  const [stabilizeCmod, setStabilizeCmod] = useState(0)
  const [stabilizeResult, setStabilizeResult] = useState<SharedRollResult | null>(null)
  const [stabilizeNarrativeText, setStabilizeNarrativeText] = useState<string>('')
  // Dedicated <RollModal> state for Distract - migrated off pendingRoll
  // 2026-05-20 (Phase 2 of tasks/spec-stabilize-migration.md, companion
  // to Stabilize Phase 1). Pre-roll: target dropdown rendered via
  // preRollExtras (candidates = combatants within 30ft Close range).
  // Post-roll: cascade applies the action-delta to the target's
  // initiative_order row + fires the turn_changed broadcast.
  const [distractPending, setDistractPending] = useState<{
    rollerEntryId: string        // initiative_order.id of the active combatant
    rollerName: string
    amod: number                 // INF AMod
    smod: number                 // max of Intimidation / Inspiration / Psychology* / Tactics*
    candidates: Array<{ entryId: string; name: string; distFeet: number | null }>
    preselectName: string | null
  } | null>(null)
  const [distractTargetName, setDistractTargetName] = useState<string>('')
  const [distractCmod, setDistractCmod] = useState(0)
  const [distractResult, setDistractResult] = useState<SharedRollResult | null>(null)
  const [distractNarrativeText, setDistractNarrativeText] = useState<string>('')
  const actionPreConsumedRef = useRef(false)  // Set when Sprint/Unjam pre-consumes before the roll modal (Stabilize + Distract migrated off this 2026-05-20)
  const actionCostRef = useRef(1)             // Action cost for the current roll (2 for Charge/Rapid Fire)
  const pendingChargeRef = useRef<{ label: string; amod: number; smod: number; weapon: any; activeId?: string; moved?: boolean } | null>(null)
  const rollExecutedRef = useRef(false)       // Set in executeRoll, read in closeRollModal - refs survive React batching. RESET in closeRollModal after the consume-gate logic reads it (the guard is per-roll, not per-modal-open).
  const nextTurnInFlightRef = useRef(false)   // Re-entry guard for nextTurn - prevents races where realtime echo + optimistic call both advance, silently skipping a combatant. RESET in the try/finally of nextTurn itself (set true at top, false in finally) - guard is per-nextTurn-call, not session-scoped.
  const consumeActionInFlightRef = useRef<Set<string>>(new Set())   // Per-entry lock for consumeAction - prevents double-click races from decrementing actions_remaining twice (e.g. Aim button hit twice fast burning both actions instead of one)
  const [insightSavePrompt, setInsightSavePrompt] = useState<{ stateId: string; targetName: string; newWP: number; newRP: number; phyAmod: number; insightDice: number } | null>(null)
  const [rollResult, setRollResult] = useState<RollResult | null>(null)
  const [cmod, setCmod] = useState('0')
  // Itemized auto-computed CMod sources for the pending attack roll (aim,
  // target-defense, coord, same-target, weapon condition). Set in
  // handleRollRequest + the target-dropdown onChange via computeAttackCmod;
  // read by executeRoll to render the source-labeled breakdown (3c). A ref
  // (not state) so executeRoll's closure always reads the latest, never a
  // stale snapshot - same reasoning as coordEffortRef.
  const cmodSourcesRef = useRef<CmodSources>({})
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
    friendlyNpcIds?: string[]
  } | null>(null)
  const [grenadeTargetCell, setGrenadeTargetCell] = useState<{ gx: number; gy: number } | null>(null)

  // Initiative
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [combatActive, setCombatActive] = useState(false)
  const [combatRound, setCombatRound] = useState(1)
  // Wound-infection warning dedup. Holds character names that have
  // already had a warning row emitted this combat. Resets on combat
  // start (useEffect below). Cross-checked against rollsFeed in the
  // emit helper so a reload mid-combat doesn't re-emit duplicates
  // for names the page already wrote pre-reload.
  const woundInfectionLoggedRef = useRef<Set<string>>(new Set())
  // Per-roll queue of target names that took a wound this attack.
  // Populated during damage application; drained AFTER saveRollToLog
  // finishes the attack row, so the warning's created_at strictly
  // follows the attack's (feed order: attack first, warning below).
  // Mirrors the pendingLootLogs pattern used for auto-loot rows.
  const pendingWoundInfectionRef = useRef<Set<string>>(new Set())
  // End-of-combat queue of Infection Check rolls. Each entry opens
  // the standard roll modal sequentially so the patient (PC or GM)
  // can layer CMod / Insight Dice / Stress per the normal flow.
  // Populated by endCombat, drained by closeRollModal as each roll
  // resolves.
  const pendingInfectionChecksRef = useRef<Array<{ name: string; amod: number }>>([])
  // Per-roll queue of weapon-malfunction log rows. Populated when an
  // attack roll lands Low Insight on a non-Unarmed weapon; drained
  // AFTER saveRollToLog so the malfunction row's created_at follows
  // the attack row's. Mirrors pendingWoundInfectionRef.
  const pendingJamLogRef = useRef<string | null>(null)
  // Tracks which character_states / campaign_npc rows we've already
  // auto-opened a Lasting Damage Check modal for in this session.
  // Without this, every loadEntries refresh would re-fire the modal
  // for the same pending row (the DB flag stays true until the roll
  // resolves), spamming the UI. Cleared on page navigation away (the
  // ref dies with the component).
  const firedLastingChecksRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    // Reset on combatActive flipping true. False→false transitions
    // (e.g. parent state churn) don't fire because the dep only
    // changes when the bool flips.
    if (combatActive) woundInfectionLoggedRef.current = new Set()
  }, [combatActive])
  // Multistory: per-entry off-scene tag for the initiative bar.
  // Map from initiative entry id → scene name (or '' if same scene as
  // active). Computed by joining initiative entries' character_id /
  // npc_id against scene_tokens, then resolving scene_id → name.
  // Populated by the useEffect below; refreshed when initiative or
  // tokens change so a token shunted via "→ Scene" updates the tag
  // without manual reload.
  const [entrySceneTags, setEntrySceneTags] = useState<Record<string, string>>({})
  const [tokenScenesRefreshKey, setTokenScenesRefreshKey] = useState(0)
  // Note: the Add-PC / Add-NPC / npcName UI state used to live here; it
  // moved into <InitiativeBar/> during the C2 extraction since nothing
  // outside the bar reads them. addNPC / addPCToCombat below take their
  // inputs as parameters instead.
  const [startingCombat, setStartingCombat] = useState(false)
  // Persist per-campaign so a refresh keeps players on the tactical view
  // they were watching. Default false on first visit; flipped true by the
  // GM share broadcast, the combat_ended broadcast, the GM's own toggle
  // button, etc. - every transition writes back to localStorage via the
  // effect below.
  const [showTacticalMap, setShowTacticalMap] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`tactical_map_view_${id}`) === '1'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`tactical_map_view_${id}`, showTacticalMap ? '1' : '0')
  }, [showTacticalMap, id])

  // Multistory cross-scene initiative tag. For each initiative entry,
  // resolve its character_id / npc_id to a scene token and check
  // whether that token is on the active scene. If not, surface the
  // scene name as a chip on the initiative bar so combat continuity
  // doesn't get confusing when PCs split across floors.
  useEffect(() => {
    if (initiativeOrder.length === 0) {
      setEntrySceneTags({})
      return
    }
    let cancelled = false
    ;(async () => {
      // Pull every scene in THIS campaign first so we can scope the
      // token query to those ids only - pre-fix, the scene_tokens
      // SELECT was unfiltered, so a PC's character_id resolved to
      // whichever stale token row happened to be processed last
      // (e.g. one left over from a prior scene like "Canyon Lake
      // Marina"). That stale tag then lit up the cross-scene chip
      // on every PC every session.
      const { data: scenes } = await supabase
        .from('tactical_scenes')
        .select('id, name, is_active')
        .eq('campaign_id', id)
      if (cancelled) return
      const sceneNameById: Record<string, string> = {}
      let activeSceneId: string | null = null
      const sceneIds: string[] = []
      for (const s of (scenes ?? []) as any[]) {
        sceneNameById[s.id] = s.name
        sceneIds.push(s.id)
        if (s.is_active) activeSceneId = s.id
      }
      if (sceneIds.length === 0) { setEntrySceneTags({}); return }
      const { data: toks } = await supabase
        .from('scene_tokens')
        .select('scene_id, character_id, npc_id')
        .is('archived_at', null)
        .in('scene_id', sceneIds)
      if (cancelled) return
      // Build character_id → scene_id and npc_id → scene_id lookups.
      // When a PC has tokens on multiple scenes (very common with
      // multi-scene campaigns), PREFER the active scene - that way
      // the cross-scene chip only shows when the token is genuinely
      // off-stage. Pre-fix the last-write-wins behavior could pick
      // the off-stage scene by accident and falsely tag the PC.
      const charScene: Record<string, string> = {}
      const npcScene: Record<string, string> = {}
      for (const t of (toks ?? []) as any[]) {
        if (t.character_id) {
          if (!charScene[t.character_id] || t.scene_id === activeSceneId) {
            charScene[t.character_id] = t.scene_id
          }
        }
        if (t.npc_id) {
          if (!npcScene[t.npc_id] || t.scene_id === activeSceneId) {
            npcScene[t.npc_id] = t.scene_id
          }
        }
      }
      const tags: Record<string, string> = {}
      for (const e of initiativeOrder) {
        const sceneId = e.character_id ? charScene[e.character_id]
          : e.npc_id ? npcScene[e.npc_id]
          : null
        if (!sceneId || sceneId === activeSceneId) continue
        tags[e.id] = sceneNameById[sceneId] ?? 'Other scene'
      }
      setEntrySceneTags(tags)
    })()
    return () => { cancelled = true }
  }, [initiativeOrder, id, supabase, tokenScenesRefreshKey])

  // Bump tokenScenesRefreshKey when a token moves between scenes
  // (the "→ Scene" button in TacticalMap mutates scene_tokens.scene_id
  // and broadcasts token_changed; postgres_changes on scene_tokens
  // catches the row update directly here). Cheap - just flips a
  // counter that retriggers the scene-tags effect above.
  // Migrated to useCampaignChannel (3d): stable [id] subscription, sentry-wrapped.
  useCampaignChannel(id, {
    channelName: `init-scene-tags-${id}`,
    postgres: [
      { label: 'scene_tokens:UPDATE', event: 'UPDATE', table: 'scene_tokens', handler: () => setTokenScenesRefreshKey(k => k + 1) },
      { label: 'scene_tokens:INSERT', event: 'INSERT', table: 'scene_tokens', handler: () => setTokenScenesRefreshKey(k => k + 1) },
      { label: 'tactical_scenes:UPDATE', event: 'UPDATE', table: 'tactical_scenes', filter: `campaign_id=eq.${id}`, handler: () => setTokenScenesRefreshKey(k => k + 1) },
    ],
  })

  // Mode-aware sidebar tab default. Campaign map → Pins ("where are
  // we"); Tactical/Combat → NPCs ("who's on the field"). The flip only
  // intervenes when the current tab is the OTHER mode's default -
  // explicit picks like Assets / Notes survive mode switches. Also
  // runs on mount, so a session starting in tactical mode lands on
  // NPCs rather than the Pins initial-state default.
  useEffect(() => {
    const inTactical = combatActive || showTacticalMap
    setGmTab(prev => {
      if (inTactical && prev === 'pins') return 'npcs'
      if (!inTactical && prev === 'npcs') return 'pins'
      return prev
    })
  }, [combatActive, showTacticalMap])
  const [tacticalShared, setTacticalShared] = useState(false)
  // Ref-mirror so the realtime broadcast handler at subscription time
  // doesn't capture a stale `tacticalShared`. Used by the
  // `scene_activated` listener to decide whether a GM scene switch
  // should force-open the player's tactical pane.
  const tacticalSharedRef = useRef(false)
  useEffect(() => { tacticalSharedRef.current = tacticalShared }, [tacticalShared])
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
  // While true, nextTurn's new-round branch holds back - if Frankie is the
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
  // target cell - which advances the turn immediately. Sprint then needs
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
  // Restore cluster (showRestorePicker/restoreNpcIds/restoring/restoreObjects)
  // now lives in useGmTools (re-arch Phase 3); destructured below.
  // Reload cluster (showReloadPicker/reloadSnapshots/reloadingSnapshotId)
  // now lives in useGmTools (re-arch Phase 3); destructured below.
  // Loot cluster (showLootModal/lootItems/lootRecipients) now lives in
  // useGmTools (re-arch Phase 3); destructured below.
  // CDP cluster (showCdpModal/cdpAmount/cdpRecipients) now lives in
  // useGmTools (re-arch Phase 3); destructured below.
  // Populate cluster (showPopulateModal/populateCount/populateBusy) now lives
  // in useGmTools (re-arch Phase 3); destructured below.
  // Advance Time cluster (showAdvanceTimeModal/advanceTimeHours/advanceTimeBusy)
  // now lives in useGmTools (re-arch Phase 3); destructured below.
  const [presenceCount, setPresenceCount] = useState(0)
  // Set of user_ids currently subscribed to the table page presence
  // channel. Driven by the same Realtime channel as presenceCount;
  // used to paint a green online dot on each player's footer avatar.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const presenceChannelRef = useRef<any>(null)


  // Session
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [sessionCount, setSessionCount] = useState(0)
  // End Session cluster (showEndSessionModal/submittedPlayerNotes) now lives
  // in useGmTools (re-arch Phase 3); destructured below.
  const [showSpecialCheck, setShowSpecialCheck] = useState<'group' | 'opposed' | 'perception' | 'gut' | 'first_impression' | 'coordinated_effort' | 'heal' | null>(null)
  // Quick Add modal cluster (showQuickAdd/qaHideCommunity/qaPinLat/qaPinLng)
  // and the Community Status modal cluster now live in useGmTools
  // (re-arch Phase 3); both destructured below.

  // Recruitment state lives separately from the Special Check modal
  // because its UI doesn't fit the 380px wrapper - multi-step wizard.
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
  // Apprentice bonds keyed by npc_id - populated by
  // loadPlayerNpcCommunityMap on mount + on community_members realtime.
  // Drives the "✨ Set Up Apprentice" button on NpcCard. setup_complete
  // flag distinguishes "needs wizard" from "already set up."
  const [apprenticeBondsByNpcId, setApprenticeBondsByNpcId] = useState<Record<string, ApprenticeBond>>({})
  // Map of PC id → communities they belong to. Sourced from
  // community_members; used to drive the "Deposit to community" option
  // in the InventoryPanel give-modal.
  const [pcCommunityMemberships, setPcCommunityMemberships] = useState<Record<string, { id: string; name: string }[]>>({})
  // Trade modal target - when set, the TradeNegotiationModal mounts.
  // Resolved against `campaignNpcs` (kind='npc') or fetched fresh from
  // community_stockpile_items (kind='community') at open time.
  const [tradeTarget, setTradeTarget] = useState<{ kind: 'npc' | 'community'; id: string } | null>(null)
  // Resolved community stockpile + leader Barter for the trade modal.
  // Fetched on demand when tradeTarget.kind === 'community'.
  const [tradeCommunityData, setTradeCommunityData] = useState<{
    name: string; inventory: InventoryItem[]; barterSmod: number; subtext?: string
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!tradeTarget || tradeTarget.kind !== 'community') {
      setTradeCommunityData(null)
      return
    }
    ;(async () => {
      const [{ data: comm }, { data: stockpile }] = await Promise.all([
        supabase.from('communities').select('id, name, leader_npc_id, leader_user_id').eq('id', tradeTarget.id).maybeSingle(),
        // Pre-launch audit Y7: cap at 500. Long-running campaigns can
        // accumulate large stockpiles; rendering more in the trade modal
        // is not the UX we want anyway. 500 is well above realistic.
        supabase.from('community_stockpile_items').select('*').eq('community_id', tradeTarget.id).order('name').limit(500),
      ])
      if (cancelled) return
      // Resolve leader's Barter SMod. Leader could be an NPC or a PC.
      let barterSmod = 0
      const c: any = comm
      if (c?.leader_npc_id) {
        const { data: npc } = await supabase.from('campaign_npcs').select('skills').eq('id', c.leader_npc_id).maybeSingle()
        const entries: Array<{ name: string; level: number }> = (npc as any)?.skills?.entries ?? []
        barterSmod = entries.find(s => s.name === 'Barter')?.level ?? 0
      } else if (c?.leader_user_id) {
        const { data: chRow } = await supabase
          .from('campaign_members')
          .select('character_id, characters:character_id(data)')
          .eq('campaign_id', id).eq('user_id', c.leader_user_id).maybeSingle()
        const skills: Array<{ skillName: string; level: number }> = (chRow as any)?.characters?.data?.skills ?? []
        barterSmod = skills.find(s => s.skillName === 'Barter')?.level ?? 0
      }
      if (cancelled) return
      setTradeCommunityData({
        name: c?.name ?? 'Community',
        inventory: (stockpile ?? []) as InventoryItem[],
        barterSmod,
        subtext: 'Stockpile',
      })
    })()
    return () => { cancelled = true }
  }, [tradeTarget, supabase, id])
  // Which Apprentice (if any) the wizard is currently editing. Single
  // wizard instance lifted to the page level so multiple open NpcCards
  // can share it without state collisions.
  const [setupApprenticeNpcId, setSetupApprenticeNpcId] = useState<string | null>(null)
  // Communities available to recruit into (loaded when modal opens).
  const [recruitCommunityList, setRecruitCommunityList] = useState<{ id: string; name: string; member_count: number }[]>([])
  // NPC memberships - which community (if any) each NPC is already in.
  const [npcCommunityMap, setNpcCommunityMap] = useState<Record<string, { id: string; name: string; recruitment_type: string }>>({})
  // Lightweight community name map for all users (players + GM). Maps npc_id → community name.
  // Loaded at startup so the player NPC list shows "Community - {name}" buckets.
  const [playerNpcCommunityMap, setPlayerNpcCommunityMap] = useState<Record<string, string>>({})
  // Player-side NPC drag/drop state (Q2 scope C, post-playtest mark
  // 01:32:51, 2026-05-19). The GM's NpcRoster has its own drag state;
  // these mirror that on the player-side inline render at L8602+.
  // Drag persists via lib/npc-drag-drop helpers (same RLS path as GM).
  const [playerNpcDragId, setPlayerNpcDragId] = useState<string | null>(null)
  const [playerNpcDragOverId, setPlayerNpcDragOverId] = useState<string | null>(null)
  const [playerNpcDragOverFolder, setPlayerNpcDragOverFolder] = useState<string | null>(null)
  // Phase B (Q2 follow-up): player-side folder REORDERING. Mirrors the
  // GM's `folderOrder` in NpcRoster (localStorage per user-per-campaign).
  // Combat + community buckets stay computed views - only the regular
  // custom folders + 'Unfiled' participate in the user-driven order.
  // Key: `npc_folder_order_player_${campaignId}` - distinct from the
  // GM's `npc_folder_order_${campaignId}` so a user who GMs one campaign
  // and plays another doesn't cross-pollute orderings.
  const [playerFolderDragId, setPlayerFolderDragId] = useState<string | null>(null)
  const [playerFolderDragOverId, setPlayerFolderDragOverId] = useState<string | null>(null)

  // First Impression NPC picker - used as the modal's defaultNpcId when
  // entry is via PlayerNpcCard's quick-fire button (player clicks the
  // FI chip on an NPC card, we pre-select that NPC and open the modal).
  // The modal owns its own internal npcId / skillChoice / cmod state;
  // this top-level state is just the pre-selection hand-off. Cleared
  // when the modal closes.
  const [firstImpressionNpcId, setFirstImpressionNpcId] = useState<string>('')
  // firstImpressionSkill + firstImpressionTargetRef both removed
  // 2026-05-19 (FI streamline Phase 3). The skill picker now lives
  // inside <FirstImpressionModal>'s local state; the ref-based stash
  // was only there because executeRoll's FI branch (also deleted)
  // wrote the relationship-bump AFTER the roll resolved.
  // Group Check stash - set by triggerGroupCheck just before the dice
  // modal opens, read by executeRoll's saveRollToLog branch so the
  // bespoke "Group Check" banner in RollsFeed has the full participant
  // list (the label only carries the leader's name, not the supporters).
  // Mutually exclusive with healPendingRef and coordEffortRef by design - only one
  // multi-participant modal at a time (the modal-open state gates re-entry; opening
  // the next modal aborts the previous). Documented 2026-05-20 per
  // tasks/audit-reentry-guards.md section 4 item 2.
  const groupCheckPayloadRef = useRef<{ participants: string[]; skill: string } | null>(null)
  const [showReadyWeaponModal, setShowReadyWeaponModal] = useState(false)
  const [showGrappleModal, setShowGrappleModal] = useState(false)
  // Two-step grapple flow: click a target → confirm + optionally spend
  // an Insight Die (3d6 or +3 CMod) → roll. Previously the click rolled
  // instantly which meant there was no window to spend insight - all
  // other attack flows get that option at the pre-roll modal.
  const [grappleTarget, setGrappleTarget] = useState<InitiativeEntry | null>(null)
  const [grappleInsight, setGrappleInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  // Manual Conditional Modifier - same field the standard attack modal
  // exposes. Stacks with the +3 CMod Insight option and any other
  // mods (PHY / Unarmed). Defaults to '0', stays as a string in state
  // so users can type "-2" or clear-and-retype without React stomping
  // the input cursor.
  const [grappleCmod, setGrappleCmod] = useState('0')
  const [grappleResult, setGrappleResult] = useState<{
    attackerName: string; defenderName: string
    aDie1: number; aDie2: number; aTotal: number; aOutcome: string
    aDiceRolled?: number[]  // populated when attacker spent a 3d6 Insight Die - surfaces all three dice in the result card
    dDie1: number; dDie2: number; dTotal: number; dOutcome: string
    result: 'grappled' | 'failed' | 'no_victor'
    rpTarget: string | null
    insightSpent?: boolean
  } | null>(null)
  const [groupCheckParticipants, setGroupCheckParticipants] = useState<Set<string>>(new Set())
  const [groupCheckSkill, setGroupCheckSkill] = useState('')
  // Healing state - see tasks/spec-healing.md. Healer picks a target
  // and (optionally) a kit (First Aid Kit / Doctor's Bag). Roll fires
  // Medicine* with kit CMod baked in. Post-resolve handler queues the
  // pending heal via queuePendingHeal() in lib/campaign-clock.ts.
  const [healTargetCharId, setHealTargetCharId] = useState<string>('')
  const [healKit, setHealKit] = useState<'none' | 'first_aid' | 'doctors_bag'>('none')
  // Stashed so the executeRoll post-resolve block knows it came from
  // the Heal modal (label-prefix match alone could be brittle if the
  // user labels their own roll something weird).
  // Mutually exclusive with groupCheckPayloadRef and coordEffortRef by design (see
  // comment on groupCheckPayloadRef above).
  const healPendingRef = useRef<{ targetCharId: string; targetName: string; kit: 'none' | 'first_aid' | 'doctors_bag' } | null>(null)
  // Coordinated Effort state - see tasks/spec-coordinated-effort.md.
  // The initiator picks participants + their first skill, fires the
  // lead roll. Lead outcome → leadCmod (per ladder) is stored on
  // coordEffortRef so every subsequent participant roll auto-applies
  // (+N coord bonus + leadCmod) to its CMod.
  const [coordEffortParticipants, setCoordEffortParticipants] = useState<Set<string>>(new Set())
  const [coordEffortSkill, setCoordEffortSkill] = useState('')
  // chainId is minted on chain-start and stamped onto every roll_log
  // row in the chain so the per-participant Withdraw button can find
  // them all and retcon (Option B locked 2026-05-17: cmod -= 1 / total
  // -= 1 / outcome recomputed across already-rolled chain rows).
  // Mutually exclusive with groupCheckPayloadRef and healPendingRef by design (see
  // comment on groupCheckPayloadRef above).
  const coordEffortRef = useRef<{ participantIds: string[]; totalParticipants: number; leadCmod: number; isActive: boolean; leadRollPending: boolean; chainId: string } | null>(null)
  // UI tick so the active-banner / End button can react when the ref
  // changes (refs don't trigger re-renders). Bumped whenever
  // coordEffortRef state changes meaningfully.
  const [coordEffortTick, setCoordEffortTick] = useState(0)
  const [opposedTarget, setOpposedTarget] = useState('')
  const [sessionSummary, setSessionSummary] = useState('')
  const [nextSessionNotes, setNextSessionNotes] = useState('')
  const [sessionCliffhanger, setSessionCliffhanger] = useState('')
  const [sessionFiles, setSessionFiles] = useState<File[]>([])
  const [sessionActing, setSessionActing] = useState(false)
  // Default tab follows mode: Campaign map → Pins ("where are we"),
  // Tactical/Combat → NPCs ("who's on the field"). The auto-flip
  // useEffect below only intervenes when the user is on the OTHER
  // mode's default - explicit picks like Assets or Notes survive
  // mode switches.
  const [gmTab, setGmTab] = useState<'pins' | 'npcs' | 'assets' | 'advantages' | 'notes'>('pins')

  // Advantage feature (post-playtest task #11). Pending advantages for
  // the campaign, refreshed on load + realtime postgres_changes. RLS
  // scopes the visible set: GM sees all pending; players see their own
  // pending + the whole campaign's consumed history.
  const [advantages, setAdvantages] = useState<Advantage[]>([])
  // GM Grant Advantage modal state.
  // Grant Advantage modal state now lives in useGmTools (re-arch Phase 3).
  // Destructured here so every existing call site is unchanged.
  const {
    showGrantAdvantage, setShowGrantAdvantage,
    grantPcId, setGrantPcId,
    grantSkill, setGrantSkill,
    grantCmod, setGrantCmod,
    grantDescription, setGrantDescription,
    grantSubmitting, setGrantSubmitting,
    grantError, setGrantError,
    grantSourceRollLogId, setGrantSourceRollLogId,
    showRestorePicker, setShowRestorePicker,
    restoreNpcIds, setRestoreNpcIds,
    restoring, setRestoring,
    restoreObjects, setRestoreObjects,
    showReloadPicker, setShowReloadPicker,
    reloadSnapshots, setReloadSnapshots,
    reloadingSnapshotId, setReloadingSnapshotId,
    showLootModal, setShowLootModal,
    lootItems, setLootItems,
    lootRecipients, setLootRecipients,
    showCdpModal, setShowCdpModal,
    cdpAmount, setCdpAmount,
    cdpRecipients, setCdpRecipients,
    showPopulateModal, setShowPopulateModal,
    populateCount, setPopulateCount,
    populateBusy, setPopulateBusy,
    showAdvanceTimeModal, setShowAdvanceTimeModal,
    advanceTimeHours, setAdvanceTimeHours,
    advanceTimeBusy, setAdvanceTimeBusy,
    showEndSessionModal, setShowEndSessionModal,
    submittedPlayerNotes, setSubmittedPlayerNotes,
    showCommunityModal, setShowCommunityModal,
    communityModalMode, setCommunityModalMode,
    communityModalToken, setCommunityModalToken,
    openCommunityModal,
    showQuickAdd, setShowQuickAdd,
    qaHideCommunity, setQaHideCommunity,
    qaPinLat, setQaPinLat,
    qaPinLng, setQaPinLng,
  } = useGmTools()
  // Per-advantage "Use" submission lock so a double-click doesn't fire
  // consume twice (idempotent at the DB level via the .is(consumed_at,
  // null) guard, but the UI flicker is avoidable).
  const [useInFlight, setUseInFlight] = useState<Set<string>>(new Set())
  const [assetsFolderState, setAssetsFolderState] = useState<Set<string>>(new Set())
  const [sheetMode, setSheetMode] = useState<'inline' | 'overlay'>('inline')
  const [feedTab, setFeedTab] = useState<'rolls' | 'chat' | 'both'>('both')
  // The Chat tab's <ChatMessageList> virtualizes via react-virtuoso's
  // customScrollParent mode, sharing the scroll container that already
  // serves the Logs / Both tabs (rollsFeed.rollFeedRef). Virtuoso needs
  // the actual DOM node, not a ref, so we mirror it into state via a
  // mount-time effect below - refs don't trigger re-renders on update.
  const [feedScrollEl, setFeedScrollEl] = useState<HTMLDivElement | null>(null)
  // Chat state (messages, channel, refetch, clear) lives in the
  // useChatPanel hook in components/TableChat.tsx - this is just the
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
  // Gut Instinct GM detail prompt. When a player (or GM-on-behalf-of-player)
  // resolves a Gut Instinct roll, the rolling client broadcasts
  // 'gut_instinct_resolved'; the GM/Thriver clients open this modal to
  // whisper a private detail to the rolling player. The standard
  // narrative feed row lands for everyone immediately; this whisper is
  // the GM color on top. Skipped on self-roll (pcOwnerId === GM userId).
  const [gutInstinctPrompt, setGutInstinctPrompt] = useState<{ pcOwnerId: string; characterName: string; outcome: string } | null>(null)
  const [gutInstinctDetail, setGutInstinctDetail] = useState('')
  const [gutInstinctSending, setGutInstinctSending] = useState(false)
  // Dedicated <RollModal> state for Gut Instinct - migrated off pendingRoll
  // 2026-05-20 (companion to Stabilize Phase 1 + Distract Phase 2). The
  // dice path lands here; the GM whisper-detail modal (already shipped
  // 2026-05-19, adb9382) opens via the `gut_instinct_resolved` broadcast
  // fired in the cascade below. No DB state changes - the broadcast IS
  // the cascade.
  const [gutInstinctPending, setGutInstinctPending] = useState<{
    characterName: string
    pcOwnerId: string | null    // null for GM-led on an unowned PC; falls through silently
    amod: number                // RSN + ACU
    smod: number                // best of Psychology / Streetwise / Tactics
  } | null>(null)
  const [gutInstinctCmod, setGutInstinctCmod] = useState(0)
  const [gutInstinctRollResult, setGutInstinctRollResult] = useState<SharedRollResult | null>(null)
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
  // Session-only - not persisted across reloads. Default width is 250 px
  // (see card wrapper); height tracks content unless the user resizes.
  const [npcCardSizes, setNpcCardSizes] = useState<Record<string, { w: number; h: number }>>({})
  const npcResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)
  // Roll modal position - null means "use default centered placement". Once
  // the user drags the roll panel, its position persists across re-opens so
  // attacks don't keep snapping back over the map.
  const [rollModalPos, setRollModalPos] = useState<{ x: number; y: number } | null>(null)
  const rollModalDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  async function loadEntries(campaignId: string) {
    // Sequence guard - multiple realtime callbacks fire in quick succession
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

    // The strip-then-patch pattern below renders character cards without
    // their (potentially large) photoDataUrl base64 first, then patches
    // photos in via a second setEntries - keeps Time-To-Interactive snappy
    // when the JSONB photo blob is heavy. We KEEP that pattern, but feed
    // both passes from the SAME initial fetch (line 530 already pulls the
    // full `data` column). Earlier code did a SECOND DB round-trip just to
    // re-fetch photoDataUrl - wasteful, and a real cost during 4-browser
    // simultaneous mounts where every redundant query stacks under
    // network contention.
    const charMap = Object.fromEntries((chars ?? []).map((c: any) => [c.id, c]))
    const photoMap: Record<string, string | null> = {}
    for (const c of chars ?? []) {
      photoMap[c.id] = (c as any).data?.photoDataUrl ?? null
    }
    // Lean copy without photo for the first paint; full data with photo
    // is preserved in `charMap` for the patch-in step below.
    const charMapLean = Object.fromEntries((chars ?? []).map((c: any) => {
      const { photoDataUrl, ...dataWithoutPhoto } = c.data ?? {}
      return [c.id, { ...c, data: dataWithoutPhoto }]
    }))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))
    const missingChars = charIds.filter((cid: string) => !(cid in charMap))
    if (missingChars.length > 0) {
      console.error('[loadEntries] missing chars for ids - likely RLS blocking cross-user reads:', missingChars, 'returned chars:', chars?.map((c: any) => c.id))
    }

    const newEntries: TableEntry[] = filteredStates.map((s: any) => ({
      stateId: s.id,
      userId: s.user_id,
      username: profileMap[s.user_id] ?? 'Unknown',
      character: charMapLean[s.character_id] ?? { id: s.character_id, name: 'Unknown', created_at: '', data: {} },
      liveState: {
        id: s.id,
        wp_current: s.wp_current, wp_max: s.wp_max,
        rp_current: s.rp_current, rp_max: s.rp_max,
        stress: s.stress, insight_dice: s.insight_dice, morality: s.morality, cdp: s.cdp ?? 0,
        // death_countdown / incap_rounds - without these the
        // mortally-wounded banner reads "Stabilize within ? rounds"
        // because every loadEntries call (which fires on turn_changed,
        // pc_damaged broadcast, etc.) wipes the countdown back to
        // undefined.
        death_countdown: s.death_countdown ?? null,
        incap_rounds: s.incap_rounds ?? null,
        // Infection fields - surfaced so the pending-Lasting-Damage
        // auto-open useEffect can detect rows that need a check rolled,
        // and so CharacterCard's existing infection_state branches
        // hydrate on fresh page loads (previously they only got these
        // fields when an executeRoll branch wrote them mid-session).
        infection_state: s.infection_state ?? null,
        infection_days_left: s.infection_days_left ?? null,
        infection_lasting_risk: !!s.infection_lasting_risk,
        infection_severity: s.infection_severity ?? null,
        infection_pending_lasting_check: !!s.infection_pending_lasting_check,
      } as any,
    }))

    if (!isLatest()) return
    setEntries(newEntries)
    setEntriesLoading(false)

    // Patch photos in from the data we ALREADY downloaded - no second
    // round-trip. setTimeout(0) yields to React so the lean cards paint
    // before the photo blob hydrates the `character.data.photoDataUrl`
    // field, preserving the original strip-then-patch UX intent.
    setTimeout(() => {
      if (!isLatest()) return
      setEntries(prev => prev.map(e => {
        const photo = photoMap[e.character.id]
        return photo
          ? { ...e, character: { ...e.character, data: { ...e.character.data, photoDataUrl: photo } } }
          : e
      }))
    }, 0)
  }

  // loadChat / sendChat moved to components/TableChat.tsx - accessed
  // via `chat.refetch()` and the <ChatComposer>'s internal send.

  async function loadPlayerNpcCommunityMap(campaignId: string) {
    const { data } = await supabase
      .from('community_members')
      .select('id, character_id, npc_id, recruitment_type, apprentice_of_character_id, apprentice_meta, communities!inner(id, name, campaign_id)')
      .is('left_at', null)
      .eq('communities.campaign_id', campaignId)
    const map: Record<string, string> = {}
    // Apprentice bonds keyed by npc_id - fuels the "Set Up Apprentice"
    // button on NpcCard. setup_complete=true means the wizard already
    // ran and the button hides.
    const bonds: Record<string, ApprenticeBond> = {}
    // PC → list of communities they belong to. Drives the
    // InventoryPanel's "Deposit to community" recipient list.
    const pcComms: Record<string, { id: string; name: string }[]> = {}
    for (const row of (data ?? []) as any[]) {
      if (row.npc_id) map[row.npc_id] = row.communities?.name ?? '?'
      if (row.npc_id && row.recruitment_type === 'apprentice' && row.apprentice_meta && row.apprentice_of_character_id) {
        bonds[row.npc_id] = {
          communityMemberId: row.id,
          masterCharacterId: row.apprentice_of_character_id,
          apprenticeMeta: row.apprentice_meta,
        }
      }
      if (row.character_id && row.communities?.id) {
        const list = pcComms[row.character_id] ?? []
        if (!list.some(c => c.id === row.communities.id)) {
          list.push({ id: row.communities.id, name: row.communities.name ?? '?' })
        }
        pcComms[row.character_id] = list
      }
    }
    setPlayerNpcCommunityMap(map)
    setApprenticeBondsByNpcId(bonds)
    setPcCommunityMemberships(pcComms)
  }

  async function loadRevealedNpcs(characterId: string | null, cnpcs: any[]) {
    // Filter to THIS campaign's NPCs - earlier code queried the full
    // npc_relationships table without a campaign filter (RLS reduced
    // the visible set, but the query still scanned all rows the user
    // could see across every campaign they GM/play). For a GM with
    // many campaigns this was a heavy fetch on every mount.
    const cnpcIds = cnpcs.map(n => n.id)
    if (cnpcIds.length === 0) { setRevealedNpcs([]); return }
    const query = characterId
      ? supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('character_id', characterId).eq('revealed', true).in('npc_id', cnpcIds)
      : supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('revealed', true).in('npc_id', cnpcIds)
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
    if (seq !== loadInitSeqRef.current) return // stale - a newer call is in flight
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
          // It's my PC - open the sheet so CharacterCard's effect fires the modal.
          setSelectedEntry(e)
          setViewingNpcs([])
        } else if (gmLike) {
          // GM-or-Thriver telemetry. Player will see the modal on their own client.
          trace('stress', { character: e.character.name, note: 'hit 5 - Stress Check triggered for player' })
        }
        // Log to the affected PC's progression log. Fires once per transition.
        if (e.character?.id) void appendProgressionLog(e.character.id, 'stress', 'Stress reached 5 - Stress Check triggered')
      }
      prev.set(stateId, curStress)
    }
    stressWatchPrimedRef.current = true
  }, [entries, gmLike])

  useEffect(() => {
    // Race guard. The mount effect's load() does multiple awaits before
    // it gets to assigning channels to refs. If the user navigates from
    // /stories/A/table → /stories/B/table mid-load, the cleanup for A
    // fires (refs may still be null at that moment, so removeChannel is
    // a no-op), then load(B) starts. When load(A) resumes after its
    // awaits and assigns its channel objects to the refs, those
    // assignments either (a) leak the A-channels if load(B) overwrites
    // the same ref later, or (b) get torn down on the next nav, after
    // burning a session of duplicated channels. Setting `cancelled`
    // true in cleanup, and checking before each channel assignment,
    // makes load() bail cleanly the moment the effect goes stale.
    let cancelled = false
    async function load() {
      // ── Wave 1 ──────────────────────────────────────────────────
      // auth + campaign load in parallel - neither depends on the
      // other, the prior sequential pair was paying ~one cold round-
      // trip per mount unnecessarily.
      //
      // 2026-04-29 - switched the auth read from supabase.auth.getUser()
      // to getCachedAuth(). The former takes the gotrue-js Web Lock
      // and round-trips GET /auth/v1/user; if any other tab is mid-
      // mount and holding the lock, this whole Promise.all hangs
      // (because Promise.all awaits ALL its inputs even if one is
      // stuck). The "Loading The Table..." screen sat indefinitely.
      // getCachedAuth() reads from getSession() which is a localStorage
      // hit - no lock contention, no network call.
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
      // forget - failure here doesn't block the table view.
      supabase.from('campaigns').update({ last_accessed_at: new Date().toISOString() }).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[table] last_accessed_at bump failed:', error.message) })
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
      // Everything that only needs id, user, or camp.gm_user_id -
      // fired together. Previously this was three sequential awaits:
      //   profiles.select(user.id) → Promise.all(gmProfile, members) →
      //   character_states kick check → Promise.all(loads + cnpcs +
      //   world_npcs + refreshMapTokenIds) → loadPlayerNpcCommunityMap.
      // Combining them into a single Promise.all collapses ~3 round-
      // trips of waterfall into one. Trade-off: a kicked player still
      // pays for the unused fetches before being redirected, but
      // kick is a rare path - accepting that cost for the common-path
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
        getCampaignNpcs(id),
        supabase.from('world_npcs').select('source_campaign_npc_id').not('source_campaign_npc_id', 'is', null),
        // Hydrate the "which NPCs already have a token in the active
        // scene?" set on initial load so the folder MAP/UNMAP button
        // shows the correct state from the start. Without this, the
        // set stays empty until the user opens the tactical map view
        // and the button stays "MAP" even when everything is already
        // placed from a prior session.
        refreshMapTokenIds(),
        // Community-membership map for the player NPC list ("Community
        // - <name>" buckets vs "Unfiled"). Independent of cnpcs.
        loadPlayerNpcCommunityMap(id),
        kickCheckPromise,
      ])

      const myProfile = myProfileRes.data
      const gmProfile = gmProfileRes.data
      const members = membersRes.data
      setMyUsername(myProfile?.username ?? '')
      setIsThriver(roleIsThriver(myProfile))
      setGmInfo({ userId: camp.gm_user_id, username: (gmProfile as any)?.username ?? 'GM' })

      // Kick gate - handled after the parallel batch instead of mid-
      // waterfall. Diagnostic log preserved for the silent-RLS pattern
      // that bit us before.
      if (!amGM) {
        const myState = (kickRes as any).data
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

      // Load revealed NPCs - GM sees all, players see their own. The
      // npc_relationships realtime channel (+ table/members/community_members)
      // is migrated to useCampaignChannel (3d.2a); only the INITIAL load stays here.
      if (camp.gm_user_id === user.id) {
        await loadRevealedNpcs(null, cnpcs)
        if (cancelled) return
      } else {
        const myMember = (members ?? []).find((m: any) => m.user_id === user.id)
        if (myMember?.character_id) {
          myCharIdRef.current = myMember.character_id
          await loadRevealedNpcs(myMember.character_id, cnpcs)
          if (cancelled) return
        }
      }

      // Chat realtime channel lives inside useChatPanel.

      // initiative_${id} channel (postgres initiative_order + notifications +
      // 21 broadcasts) migrated to useCampaignChannel (3d.2b) - see initChannel
      // near useRecorderToggle. presence stays raw below.

      // campaign_ + campaign_npcs_ channels migrated to useCampaignChannel (3d.2a).

      if (cancelled) return
      // Presence - track how many users are on this table page
      try {
        // Channel name MUST be stable across all viewers of the same
        // campaign - anything that varies per page load (Date.now(),
        // session-local UUIDs, etc.) silos each user into their own
        // channel and presence sync never sees anyone else. Pre-fix
        // this had `_${Date.now()}` appended and the online dot never
        // lit because no two clients shared a channel.
        const presChannel = supabase.channel(`presence_table_${id}`, { config: { presence: { key: user.id } } })
        presChannel.on('presence', { event: 'sync' }, () => {
          const state = presChannel.presenceState()
          const keys = Object.keys(state)
          setPresenceCount(keys.length)
          setOnlineUserIds(new Set(keys))
        })
        presChannel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await presChannel.track({ user_id: user.id })
          }
        })
        presenceChannelRef.current = presChannel
      } catch (e) {
        console.error('[presence] setup error:', e)
      }
    }
    load()
    return () => {
      cancelled = true
      // table/members/campaign_npcs/campaign/reveals/community_members/initiative
      // channels are now owned by useCampaignChannel (3d.2a + 3d.2b) - they tear
      // down themselves (initChannelRef aliases the handle's ref, so don't
      // removeChannel it here). chat teardown is in useChatPanel. Only the raw
      // presence channel remains hand-managed.
      if (presenceChannelRef.current) { supabase.removeChannel(presenceChannelRef.current); presenceChannelRef.current = null }
    }
  }, [id])

  // Tab-backgrounding refetch. Chrome throttles inactive tabs; websockets
  // can pause without a clean close, so postgres_changes events stop
  // arriving while the tab "looks" connected. On hidden→visible we
  // re-pull the state the mount effect originally hydrated, so the
  // moment the user returns the feed is in sync with the DB even if a
  // few realtime events were dropped during the background window.
  // Channel rebuild is intentionally NOT done here - supabase-js
  // reconnects internally on socket health checks. If staleness
  // persists for users after this, expand to a teardown+resubscribe.
  useEffect(() => {
    if (!id) return
    // Debounce the catch-up refetch. A user alt-tabbing quickly (Win+L
    // lock screen, focus-then-blur, etc.) can fire visibilitychange
    // multiple times in <500ms, and the un-debounced version dispatched
    // five full DB fetches for every flap. 500ms is comfortably below
    // any user-perceptible "I came back" window but above the typical
    // OS-level focus dance.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function runRefetch() {
      void (async () => {
        loadEntries(id)
        rollsFeed.refetch()
        loadInitiative(id)
        loadPlayerNpcCommunityMap(id)
        const { data: cnpcs } = await getCampaignNpcs(id)
        if (cnpcs) {
          setCampaignNpcs(cnpcs)
          setRosterNpcs(cnpcs.filter((n: any) => {
            if (n.status !== 'active') return false
            const wp = n.wp_current ?? n.wp_max ?? 10
            return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
          }))
          const charId = gmLike ? null : myCharIdRef.current
          if (gmLike || charId) loadRevealedNpcs(charId, cnpcs)
        }
      })()
    }
    function handleVisibility() {
      if (document.hidden) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        runRefetch()
      }, 500)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [id, gmLike])

  // Roll requests broadcast from the /character-sheet popout window. The
  // popout doesn't own the roll modal / initiative gates / CMod stack -
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

  // ── Advantages: load + realtime sync (P3 Q4-b) ──────────────────
  // RLS shapes the visible set per role automatically; we just refetch
  // on any advantages-table change for this campaign. Best-effort: a
  // failed initial load leaves advantages=[] and the UI shows "none."
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { rows } = await listCampaignPendingAdvantages(supabase, id)
      if (!cancelled) setAdvantages(rows)
    })()
    return () => { cancelled = true }
  }, [id])
  // Realtime migrated to useCampaignChannel (3d): refetch on any advantages change.
  useCampaignChannel(id, {
    channelName: `advantages_${id}`,
    postgres: [{
      label: 'advantages:*', event: '*', table: 'advantages', filter: `campaign_id=eq.${id}`,
      handler: async () => { const { rows } = await listCampaignPendingAdvantages(supabase, id); setAdvantages(rows) },
    }],
  })

  // --- Postgres-only table channels migrated out of the load() mount effect
  // to useCampaignChannel (3d.2a). Stable [id] subscription (no churn on
  // unrelated re-renders), auto-Sentry-wrapped, channel names preserved.
  // Handlers read component state/refs at dispatch (closures stay fresh via
  // the primitive's configRef mirror). The initiative channel (broadcasts) is
  // migrated separately in 3d.2b; presence stays raw (no presence support).
  useCampaignChannel(id, {
    channelName: `table_${id}`,
    postgres: [{ label: 'character_states:*', event: '*', table: 'character_states', filter: `campaign_id=eq.${id}`, handler: () => loadEntries(id) }],
  })
  useCampaignChannel(id, {
    channelName: `members_${id}`,
    postgres: [{
      label: 'campaign_members:*', event: '*', table: 'campaign_members', filter: `campaign_id=eq.${id}`,
      handler: async () => {
        const { data: refreshedMembers } = await supabase
          .from('campaign_members')
          .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
          .eq('campaign_id', id)
          .not('character_id', 'is', null)
        if (refreshedMembers && refreshedMembers.length > 0) await ensureCharacterStates(id, refreshedMembers as any[])
        await loadEntries(id)
      },
    }],
  })
  useCampaignChannel(id, {
    channelName: `campaign_${id}`,
    postgres: [{
      label: 'campaigns:UPDATE', event: 'UPDATE', table: 'campaigns', filter: `id=eq.${id}`,
      handler: (payload: any) => {
        const row = payload.new
        setSessionStatus(row.session_status === 'active' ? 'active' : 'idle')
        setSessionCount(row.session_count ?? 0)
        setCampaign((prev: Campaign | null) => prev ? { ...prev, session_status: row.session_status, session_count: row.session_count, session_started_at: row.session_started_at } : prev)
        if (Array.isArray(row.vehicles)) setVehicles(row.vehicles)
      },
    }],
  })
  useCampaignChannel(id, {
    channelName: `campaign_npcs_${id}`,
    postgres: [{
      label: 'campaign_npcs:*', event: '*', table: 'campaign_npcs', filter: `campaign_id=eq.${id}`,
      handler: (payload: any) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new
          setCampaignNpcs(prev => prev.some(n => n.id === row.id) ? prev.map(n => n.id === row.id ? { ...n, ...row } : n) : [...prev, row])
          setRosterNpcs(prev => {
            const alive = (n: any) => { const wp = n.wp_current ?? n.wp_max ?? 10; return n.status === 'active' && !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0) }
            const merged = prev.some(n => n.id === row.id) ? prev.map(n => n.id === row.id ? { ...n, ...row } : n) : [...prev, row]
            return merged.filter(alive)
          })
          setViewingNpcs(prev => prev.map(n => n.id === row.id ? { ...n, ...row } as CampaignNpc : n))
          return
        }
        void (async () => {
          const { data: cnpcs } = await getCampaignNpcs(id)
          if (cnpcs) {
            setCampaignNpcs(cnpcs)
            setRosterNpcs(cnpcs.filter((n: any) => { if (n.status !== 'active') return false; const wp = n.wp_current ?? n.wp_max ?? 10; return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0) }))
          }
        })()
      },
    }],
  })
  useCampaignChannel(id, {
    channelName: `community_members_${id}`,
    postgres: [{ label: 'community_members:*', event: '*', table: 'community_members', handler: () => loadPlayerNpcCommunityMap(id) }],
  })
  useCampaignChannel(id, {
    channelName: `reveals_${id}`,
    postgres: [{
      label: 'npc_relationships:*', event: '*', table: 'npc_relationships',
      handler: () => {
        if (gmLikeRef.current) loadRevealedNpcs(null, campaignNpcs)
        else if (myCharIdRef.current) loadRevealedNpcs(myCharIdRef.current, campaignNpcs)
      },
    }],
  })

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Skip Esc when typing - let the input handle it (e.g. clear
      // text). Same guard as the route/measure tool's Esc handler.
      const active = document.activeElement as HTMLElement | null
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return
      // Modal priority order. Each branch returns to keep Esc one-shot
      // (don't both close a roll modal AND clear NPC cards at once).
      if (pendingRoll) { closeRollModal(); return }
      if (selectedEntry) { setSelectedEntry(null); return }
      if (showEndSessionModal) { setShowEndSessionModal(false); return }
      // Close-all NPC cards (post-playtest mark 02:37:45, Q4-a). Only
      // when 2+ are open - single-card view uses its own Close button.
      if (viewingNpcs.length >= 2) { setViewingNpcs([]); return }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [pendingRoll, selectedEntry, showEndSessionModal, viewingNpcs.length])

  async function handleStatUpdate(stateId: string, field: string, value: number | string | boolean | null) {
    // Optimistic flip first so the UI responds instantly. If the
    // server write fails (RLS denial / network), we surface the error
    // and force a reload of entries so the local state converges with
    // the actual DB. Pre-fix the update was awaited but the error
    // was ignored, leaving the UI showing the new value indefinitely
    // even when the write hadn't landed.
    setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, [field]: value } } : e))
    const { error } = await supabase
      .from('character_states')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', stateId)
    if (error) {
      console.error('[handleStatUpdate] failed:', error.message)
      alert(`Stat update failed: ${error.message}`)
      void loadEntries(id)
    }
  }

  // ── Initiative functions ──

  async function startCombat() {
    if (!gmLike) return
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
    // Sanity check - no players present AND no NPCs selected = nothing
    // to roll initiative for. Bail with a friendly alert instead of
    // silently inserting zero combatants. (entries.length-zero guard
    // moved here from the Start Combat button so a GM can solo-test
    // with NPCs only - the per-button gate was blocking that intent.)
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
    // row - a player who joined moments ago may not be in entries yet, but they
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
    // CRITICAL: scope by character_id, NOT just user_id. character_states
    // has one row per (campaign, user, character) - if a player was once
    // kicked while playing character A and then later rejoins with
    // character B, the stale kicked=true row on A would otherwise poison
    // B too. Pre-fix, that bit Shimmy Paint on 2026-05-04: TimTheLiar
    // had been kicked on a previous PC, then made a new character, and
    // combat-start kept silently excluding them.
    const memberCharIds = (rawMembers ?? []).map((m: any) => m.character_id).filter(Boolean)
    const { data: kickedStates } = memberCharIds.length > 0
      ? await supabase
          .from('character_states')
          .select('user_id, character_id')
          .eq('campaign_id', id)
          .eq('kicked', true)
          .in('character_id', memberCharIds)
      : { data: [] }
    const kickedCharIds = new Set((kickedStates ?? []).map((k: any) => k.character_id))
    const freshMembers = (rawMembers ?? []).filter((m: any) => !kickedCharIds.has(m.character_id))
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

    // Auto-reveal hidden NPCs entering combat. Without this, players
    // would see anonymous turn names appearing in initiative for NPCs
    // they can't actually look up. The token-placement trigger in
    // sql/campaign-npcs-hidden-from-players.sql handles tokens on the
    // tactical map; this covers the initiative-roster path. Fire-and-
    // forget - the table UPDATE doesn't block combat start.
    const npcIdsToReveal = rosterNpcs
      .filter(n => selectedNpcIds.has(n.id) && (n as any).hidden_from_players === true)
      .map(n => n.id)
    if (npcIdsToReveal.length > 0) {
      void supabase.from('campaign_npcs').update({ hidden_from_players: false }).in('id', npcIdsToReveal)
    }

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
        // Insert ALL combatants - drop character gets 1 action, everyone else gets 0 (frozen)
        pendingCombatantsRef.current = allRows
        dropPhaseRef.current = true

        const dropInsertRows = allRows.map(r =>
          r.character_name === dropCharacter
            ? { ...r, is_active: true, actions_remaining: 1 }
            : { ...r, is_active: false, actions_remaining: 0 }
        )
        const [{ data: insertedDrop, error: dropInsertErr }, { error: dropLogErr }] = await Promise.all([
          supabase.from('initiative_order').insert(dropInsertRows).select(),
          insertRollLog([
            { campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Started',
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.combat_start,
              damage_json: { combatants } as any, created_at: new Date(now).toISOString() },
            { campaign_id: id, user_id: userId, character_name: 'System',
              label: `⚡ ${dropCharacter} Gets the Drop!`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.drop,
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
        insertRollLog([
          { campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Started',
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.combat_start,
            damage_json: { combatants } as any, created_at: new Date(now).toISOString() },
          { campaign_id: id, user_id: userId, character_name: 'System', label: 'Initiative',
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.initiative,
            damage_json: { initiative: sorted } as any, created_at: new Date(now + 1).toISOString() },
        ]),
      ])
      if (initInsertErr) console.error('[confirmStartCombat] initiative insert error:', initInsertErr.message)
      if (rollInsertErr) console.error('[confirmStartCombat] roll_log insert error:', rollInsertErr.message)
      // Optimistic local state - sorted by roll desc to match loadInitiative behavior.
      const sortedInit = (insertedInit ?? []).slice().sort((a: any, b: any) => b.roll - a.roll || String(a.character_name).localeCompare(String(b.character_name)))
      setInitiativeOrder(sortedInit)
      setCombatActive(sortedInit.length > 0)
      setCombatRound(1)
    }
    setDropCharacter('')

    // Auto-open NPC cards for all NPCs in combat (skip if tactical map is showing - cards block the map)
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
    const __t0 = performance.now()
    trace('nextTurn', { at: new Date().toISOString() })

    // Re-entry guard: a rapid-fire consumeAction + realtime echo can fire two
    // nextTurn calls back-to-back. Without this guard, call #2 reads active
    // state that call #1 hasn't finished writing yet, then advances the turn
    // a second time - silently skipping whoever call #1 just activated.
    if (nextTurnInFlightRef.current) {
      trace('nextTurn', { skipped: 'already in flight - bailing to avoid double-advance' })
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
      await insertRollLog({
        campaign_id: id, user_id: userId, character_name: 'System', label: 'Initiative',
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.initiative,
        damage_json: { initiative: sortedReroll } as any,
      })

      await Promise.all([loadInitiative(id), rollsFeed.refetch()])
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Fetch fresh initiative order from DB to avoid stale state
    const { data: freshOrder, error: orderErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false }).order('character_name', { ascending: true })
    if (orderErr) console.error('[nextTurn] order fetch error:', orderErr.message)
    const order = freshOrder ?? initiativeOrder
    if (order.length === 0) { trace('nextTurn', { skipped: 'empty order' }); return }
    const currentIdx = order.findIndex((e: any) => e.is_active)
    trace('nextTurn', { currentIdx, orderLength: order.length, activeName: order[currentIdx]?.character_name })

    // Guard: if no active entry found, forcibly activate the first alive combatant
    if (currentIdx < 0) {
      trace('nextTurn', { note: 'no active entry found - activating first combatant as fallback' })
      await supabase.from('initiative_order').update(activateUpdate(order[0])).eq('id', order[0].id)
      await loadInitiative(id)
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Find next combatant who can act - skip dead, mortally wounded, and incapacitated.
    // Done BEFORE the new-round check so the skip walk's wrap-around is detectable:
    // if the active combatant isn't the last in the order but every remaining entry
    // in this round is dead (e.g. Jules kills the tail-end NPC), the walk wraps via
    // `%` onto a combatant who already acted. Without detecting that, we would
    // reactivate them mid-round with fresh actions. See `wrappedPastEnd` below.
    //
    // Performance note (playtest #32): NPC + PC state fetches are BATCHED
    // up front via two bulk queries instead of one `.maybeSingle()` per PC
    // inside the loop. Before this change, a campaign with several PCs and a
    // long skip chain triggered a sequential round trip for each PC - often
    // ~200-500ms of perceived delay between turns on ordinary latency.
    // Two parallel bulk queries is one network wait regardless of combatant
    // count.
    const pcCharIdsInInit = order.filter((e: any) => !e.is_npc && e.character_id).map((e: any) => e.character_id)
    const [{ data: freshNpcsForSkip }, { data: freshPcStatesForSkip }] = await Promise.all([
      getCampaignNpcs(id),
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
    // valid combatant - i.e. `attempts` hit `order.length`. The previous
    // `wrappedPastEnd` trigger also fired when the walk wrapped and THEN
    // found someone with actions left (common after a defer-to-tied-roll
    // or multi-defer), silently stranding that combatant's remaining
    // action into a new round. We only want new-round when nobody was
    // found - `wrappedPastEnd && attempts >= order.length` collapses to
    // `attempts >= order.length` since the walk can only run out of
    // attempts by wrapping. Using `attempts` directly reads cleaner.
    const everyoneSkipped = attempts >= order.length
    // Keep wrappedPastEnd referenced so the old comment context stays
    // anchored in diffs / git blame - cheap no-op.
    void wrappedPastEnd
    // Sprint-Athletics race: if the active combatant was the last one
    // to act AND they did so via Sprint's 2-action pre-consume, their
    // Athletics check is still outstanding (pending the dice roll in
    // the modal). Firing the new-round reroll NOW would put the
    // Initiative log ahead of the Sprint outcome in the feed - visible
    // to players as "new round started before I finished sprinting".
    // Defer: mark the pending-transition and return. The Sprint block
    // in executeRoll will re-invoke nextTurn after its log entry lands.
    if (everyoneSkipped && sprintAthleticsPendingRef.current) {
      trace('nextTurn', { note: 'new round deferred - Sprint Athletics roll still pending' })
      sprintAthleticsRoundDeferredRef.current = true
      return
    }
    if (everyoneSkipped) {
      // ── New-round bookkeeping - batched ──
      // Was: three nested for-await loops (PC state, NPC state, init reroll)
      // each firing N sequential UPDATEs. With 6 combatants at 150ms RTT,
      // that's ~2.7s of dead air at the round boundary. Now: build per-row
      // update promises, run them all in a single Promise.all wave. The
      // values differ per row so we can't .in() into a single SQL stmt,
      // but parallelizing the network round-trips collapses ~3N RTTs to 1.
      const pcUpdates: Promise<any>[] = []
      const npcUpdates: Promise<any>[] = []
      const npcLocalPatches: { id: string; updates: any }[] = []
      const deathLogRows: any[] = []

      // PC death countdown + incapacitation + RP recovery
      for (const e of entries) {
        if (!e.liveState) continue
        const ls = e.liveState as any
        const updates: any = {}
        // Death countdown
        if (ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown > 0) {
          updates.death_countdown = ls.death_countdown - 1
          if (ls.death_countdown - 1 <= 0) {
            deathLogRows.push({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${e.character.name} is gone.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.death,
            })
            if (e.character?.id) void appendProgressionLog(e.character.id, 'wound', '💀 Died.')
          }
        }
        // Incapacitation countdown
        if (ls.incap_rounds != null && ls.incap_rounds > 0) {
          updates.incap_rounds = ls.incap_rounds - 1
          if (ls.incap_rounds - 1 <= 0) {
            // Regain consciousness: 1 RP, and 1 WP if was stabilized (WP=0).
            // Guard: do NOT bump WP if a death_countdown is still ticking -
            // that would silently un-mortal-wound a PC who happens to also
            // be incapacitated, no stabilize roll required (Warren bug
            // 2026-04-27).
            updates.rp_current = Math.max(1, ls.rp_current)
            const dcActive = (ls as any).death_countdown != null && (ls as any).death_countdown > 0
            if (ls.wp_current === 0 && !dcActive) updates.wp_current = 1
            updates.incap_rounds = null
            // Log the revival - paired with the "Lights out" Incapacitated
            // banner from when they went down. Reuses deathLogRows for the
            // same single-batch insert at the end of the round-tick.
            deathLogRows.push({
              campaign_id: id, user_id: userId,
              character_name: 'Coming around',
              label: `${e.character.name} has regained consciousness.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.revive,
            })
          }
        }
        // RP recovery: conscious characters below max RP recover 1 per round.
        // Sick characters (infection_state set) recover up to half-max only -
        // the half-max cap is the ceiling until they recover.
        if (ls.rp_current > 0 && ls.rp_current < e.liveState.rp_max && ls.wp_current > 0 && (ls.incap_rounds == null || ls.incap_rounds <= 0)) {
          const cap = ls.infection_state ? Math.floor(e.liveState.rp_max / 2) : e.liveState.rp_max
          updates.rp_current = Math.min(cap, (updates.rp_current ?? ls.rp_current) + 1)
        }
        if (Object.keys(updates).length > 0) {
          pcUpdates.push(supabase.from('character_states').update(updates).eq('id', e.stateId))
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
          // NPC dies when countdown expires - mark status and log
          if (npc.death_countdown - 1 <= 0) {
            updates.status = 'dead'
            deathLogRows.push({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${npc.name} is gone.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.death,
            })
          }
        }
        // Incapacitation countdown
        if (npc.incap_rounds != null && npc.incap_rounds > 0) {
          updates.incap_rounds = npc.incap_rounds - 1
          if (npc.incap_rounds - 1 <= 0) {
            updates.rp_current = Math.max(1, npc.rp_current ?? 0)
            // Guard against silently un-mortal-wounding an NPC whose
            // death_countdown is still active - same Warren-bug fix as
            // the PC branch above.
            const npcDcActive = npc.death_countdown != null && npc.death_countdown > 0
            if ((npc.wp_current ?? 0) === 0 && !npcDcActive) updates.wp_current = 1
            updates.incap_rounds = null
            // Revival log - see PC branch comment above.
            deathLogRows.push({
              campaign_id: id, user_id: userId,
              character_name: 'Coming around',
              label: `${npc.name} has regained consciousness.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.revive,
            })
          }
        }
        // RP recovery - sick NPCs cap at half-max same as PCs.
        const npcWP = npc.wp_current ?? npc.wp_max ?? 10
        const npcRP = npc.rp_current ?? npc.rp_max ?? 6
        const npcRPMax = npc.rp_max ?? 6
        if (npcRP > 0 && npcRP < npcRPMax && npcWP > 0 && (npc.incap_rounds == null || npc.incap_rounds <= 0)) {
          const npcCap = (npc as any).infection_state ? Math.floor(npcRPMax / 2) : npcRPMax
          updates.rp_current = Math.min(npcCap, (updates.rp_current ?? npcRP) + 1)
        }
        if (Object.keys(updates).length > 0) {
          npcUpdates.push(supabase.from('campaign_npcs').update(updates).eq('id', npcId))
          npcLocalPatches.push({ id: npcId, updates })
        }
      }

      // Re-roll initiative for all combatants
      const rerollDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
      const initUpdates: Promise<any>[] = []
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
        initUpdates.push(supabase.from('initiative_order').update({ roll: newRoll, actions_remaining: 2, aim_bonus: 0, aim_active: false, defense_bonus: 0, has_cover: false, inspired_this_round: false, coordinate_target: null, coordinate_bonus: 0, is_active: false }).eq('id', entry.id))
      }

      // Log new round initiative
      const sortedReroll = [...rerollDetails].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      const newRoundLogInsert = insertRollLog({
        campaign_id: id, user_id: userId, character_name: 'System', label: 'New Round - Initiative',
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.initiative,
        damage_json: { initiative: sortedReroll } as any,
      })
      const deathLogInsert = deathLogRows.length > 0
        ? insertRollLog(deathLogRows)
        : Promise.resolve(null)

      // Single parallel wave - three table updates + two log inserts.
      await Promise.all([...pcUpdates, ...npcUpdates, ...initUpdates, newRoundLogInsert, deathLogInsert])

      // Apply NPC local patches once (was: setState N times inside the loop).
      if (npcLocalPatches.length > 0) {
        const patchMap = new Map(npcLocalPatches.map(p => [p.id, p.updates]))
        setCampaignNpcs(prev => prev.map(n => patchMap.has(n.id) ? { ...n, ...patchMap.get(n.id) } : n))
        setRosterNpcs(prev => prev.map(n => patchMap.has(n.id) ? { ...n, ...patchMap.get(n.id) } : n))
      }

      setCombatRound(prev => prev + 1)

      // Re-sort and set first ALIVE combatant as active (PCs beat NPCs on ties).
      // Two parallel fetches - initiative_order + campaign_npcs (different tables).
      const [{ data: rerolled }, { data: freshNpcsForRound }] = await Promise.all([
        supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false }).order('character_name', { ascending: true }),
        getCampaignNpcs(id),
      ])
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

    // ── Normal advance: deactivate current, activate next ──
    // nextIdx was computed above (before the new-round check) so the skip-walk
    // wrap is detectable.
    const currentEntry = order.find((e: any) => e.is_active)
    trace('nextTurn', { deactivating: currentEntry?.character_name, activating: order[nextIdx]?.character_name })
    // Defense: if the skip-walk landed on the same combatant we're advancing
    // from (stale state, or every other combatant dead), trigger a new round
    // rather than no-op reactivating - prevents an infinite reactivate loop.
    if (currentEntry && order[nextIdx] && currentEntry.id === order[nextIdx].id) {
      trace('nextTurn', { note: 'nextIdx resolves to self - no-op (finally will release lock)' })
      return
    }

    const nextId = order[nextIdx].id
    const activation = activateUpdate(order[nextIdx])
    const deactivation = { is_active: false, actions_remaining: 0, aim_bonus: 0 }

    // OPTIMISTIC TURN-FLIP: apply the post-write state to local initiative NOW
    // so the turn changes instantly instead of waiting ~0.7-3.6s for two
    // sequential DB writes + a reload (measured in the 2026-05-22 smoke). The
    // patch mirrors the two writes below EXACTLY (activate nextId via the same
    // `activation` object; clear is_active/actions/aim on every other currently
    // active row via the same `deactivation` object), and `order` is the same
    // select+sort `loadInitiative` produces - so the optimistic array is
    // field-identical to the reload that follows (no flicker), and a write
    // failure self-heals when the reload reads DB truth.
    setInitiativeOrder(order.map((e: any) => {
      if (e.id === nextId) return { ...e, ...activation }
      if (e.is_active) return { ...e, ...deactivation }
      return e
    }))

    // Persist: the two writes touch DISJOINT rows (deactivate excludes nextId
    // via .neq; activate touches only nextId), so they run in ONE parallel wave
    // instead of two sequential round-trips. Broad-clearing every is_active row
    // except next is idempotent + self-healing if a race left two active.
    const [{ error: deactErr }, { error: actErr }] = await Promise.all([
      supabase.from('initiative_order')
        .update(deactivation)
        .eq('campaign_id', id)
        .eq('is_active', true)
        .neq('id', nextId),
      supabase.from('initiative_order').update(activation).eq('id', nextId),
    ])
    if (deactErr) console.error('[nextTurn] bulk deactivate error:', deactErr.message)
    if (actErr) console.error('[nextTurn] activate error:', actErr.message)
    // Reconcile local state with DB truth + refresh PC liveState, then notify peers.
    await Promise.all([loadInitiative(id), loadEntries(id)])
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
    trace('nextTurn', {
      done: 'optimistic flip + parallel writes',
      settle_ms: Math.round(performance.now() - __t0),
      activated_name: order[nextIdx]?.character_name,
    })
    } finally {
      nextTurnInFlightRef.current = false
    }
  }

  /** Thin wrapper around the shared lib/progression-log helper so the existing
   *  call sites in this file don't need to thread `supabase` themselves. The
   *  Progression Log is a permanent journey journal - only durable life events
   *  belong (memory rule: feedback_progression_log_curation.md). */
  async function appendProgressionLog(characterId: string, type: any, text: string) {
    return appendProgressionEntry(supabase, characterId, type, text)
  }

  async function consumeAction(entryId: string, actionLabel?: string, cost = 1) {
    // Per-entry re-entry guard. A rapid double-click on Aim (or any action
    // button) previously raced two consumeAction calls that both read
    // actions_remaining=2 before either wrote, then both wrote a
    // decrement - burning BOTH actions on a single click. The lock is
    // scoped per entryId so other combatants aren't blocked.
    if (consumeActionInFlightRef.current.has(entryId)) {
      trace('consumeAction', { skipped: 'already in flight - ignoring duplicate call', entryId })
      return
    }
    consumeActionInFlightRef.current.add(entryId)
    try {
    // Re-fetch from DB to avoid stale state
    const { data: freshEntry, error: freshErr } = await supabase.from('initiative_order').select('*').eq('id', entryId).single()
    if (freshErr) console.error('[consumeAction] fetch error:', freshErr.message)
    const entry = freshEntry ?? initiativeOrder.find(e => e.id === entryId)
    trace('consumeAction', {
      called: true,
      entryId,
      character: entry?.character_name,
      actions_before: entry?.actions_remaining,
      cost,
      label: actionLabel,
      call_site_via_stack: new Error().stack?.split('\n').slice(2, 5).join(' | '),
    })
    if (!entry) { trace('consumeAction', { skipped: 'no entry found, bailing' }); return }
    if ((entry.actions_remaining ?? 0) < cost) { trace('consumeAction', { skipped: 'insufficient actions', actions_remaining: entry.actions_remaining, cost }); return }
    const newRemaining = (entry.actions_remaining ?? 0) - cost
    trace('consumeAction', { wrote_actions_remaining: { from: entry.actions_remaining, to: newRemaining } })

    // Log the action to game feed
    if (actionLabel) {
      const { error: actionLogErr } = await insertRollLog({
        campaign_id: id,
        user_id: userId,
        character_name: entry.character_name,
        label: actionLabel,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: OUTCOME.action,
      })
      if (actionLogErr) console.error('[consumeAction] action log insert error:', actionLogErr.message)
    }

    // Clear aim bonus after a roll (no actionLabel = called from closeRollModal).
    // Clear BOTH aim_bonus (the numeric +N CMod) and aim_active (the "Aimed -
    // Attack or lose it" badge). Previously only aim_bonus was cleared, so
    // the badge lingered after the attack even though the bonus was already
    // consumed - visually misleading.
    const clearAim = !actionLabel && entry.aim_bonus > 0

    // Always persist the new action count to DB first - if nextTurn fails or
    // races, the DB is at least consistent with "this combatant is spent".
    // `.select()` so a silent RLS rejection (0 rows affected, no error) is
    // distinguishable from a real update.
    const { error: updErr, data: updData } = await supabase.from('initiative_order')
      .update({ actions_remaining: newRemaining, ...(clearAim ? { aim_bonus: 0, aim_active: false } : {}) })
      .eq('id', entryId)
      .select('id, actions_remaining')
    trace('consumeAction', { update: true, entryId, newRemaining, rowsAffected: updData?.length ?? 0, error: updErr?.message ?? 'none', returned: updData })
    if (updErr) console.error('[consumeAction] update error:', updErr.message)
    if (!updErr && (!updData || updData.length === 0)) {
      console.error('[consumeAction] SILENT RLS FAIL - 0 rows updated, no error. entryId:', entryId)
    }

    if (newRemaining <= 0) {
      trace('consumeAction', { note: 'newRemaining<=0 -> calling nextTurn' })
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
    await consumeAction(entryId, `${entry.character_name} - Aim (+${newAim} CMod). Must Attack next or Aim is lost.`)
  }

  // Activate a combatant - handles winded (1 action instead of 2)
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
      await consumeAction(entryId, `${entry.character_name} - Ready Weapon (Tracking +${newAim} CMod)`)
    } else {
      await consumeAction(entryId, `${entry.character_name} - Ready Weapon`)
    }
  }

  async function endCombat() {
    if (!gmLike) return
    // Snapshot the combatants for the log entry before clearing initiative.
    const combatants = initiativeOrder.map(e => e.character_name)
    const { error: endLogErr } = await insertRollLog({
      campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended',
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
      outcome: OUTCOME.combat_end,
      damage_json: { combatants } as any,
    })
    if (endLogErr) console.error('[endCombat] roll_log insert error:', endLogErr.message)
    // Queue Wound Infection checks as roll modals - one per wounded
    // combatant (canon §06: one PHY check per character per combat).
    // The patient (or GM) sees each modal, can layer CMod / Insight
    // Dice / Stress like any other roll. PCs get a broadcast to
    // their owner's client; NPCs drain sequentially through
    // closeRollModal on the GM's client. Awaited so the queue is
    // populated before the rest of endCombat clears state.
    await queueWoundInfectionChecks()
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
    // Parallel - independent fetches (different tables).
    await Promise.all([rollsFeed.refetch(), loadEntries(id)])
    initChannelRef.current?.send({ type: 'broadcast', event: 'combat_ended', payload: {} })
  }

  // End-of-combat Wound Infection sweep. Called from endCombat after
  // the Combat Ended row lands. For every character (PC or NPC) who
  // got a wound_infection_warning during this combat, broadcast or
  // queue a roll-modal check.
  //
  // PCs: broadcast `infection_check_request` to the PC's owning
  // userId - the player's client opens the modal on its own screen.
  // NPCs: queued on the GM's local pendingInfectionChecksRef; first
  // opens immediately, the rest drain from closeRollModal as each
  // modal closes.
  //
  // Canon §06 outcome resolution lives in executeRoll's
  // "Infection Check (" label branch and runs on whichever client
  // wrote the roll_log row, so this function only orchestrates the
  // modals - state writes happen there.
  //
  // Source of truth = DIRECT DB QUERY, not rollsFeed.rolls. The
  // in-memory feed can lag the DB by seconds after a warning emits,
  // so a fast End Combat click (< the feed refetch round-trip) would
  // see zero warnings and skip the sweep entirely. Documented bug
  // hit on the 21:20 playtest. Going direct is one extra query per
  // End Combat - cheap and infrequent.
  async function queueWoundInfectionChecks() {
    const { data: combatStartRows, error: csErr } = await supabase
      .from('roll_log')
      .select('created_at')
      .eq('campaign_id', id)
      .eq('outcome', OUTCOME.combat_start)
      .order('created_at', { ascending: false })
      .limit(1)
    if (csErr) { console.error('[end-combat-infection] combat_start lookup error:', csErr.message); return }
    const combatStartedAt: string | undefined = (combatStartRows as any[])?.[0]?.created_at
    if (!combatStartedAt) return
    const { data: warningRows, error: wErr } = await supabase
      .from('roll_log')
      .select('character_name')
      .eq('campaign_id', id)
      .eq('outcome', OUTCOME.wound_infection_warning)
      .gte('created_at', combatStartedAt)
    if (wErr) { console.error('[end-combat-infection] warning lookup error:', wErr.message); return }
    const wounded = new Set<string>()
    for (const r of (warningRows ?? []) as any[]) {
      if (r.character_name) wounded.add(r.character_name)
    }
    if (wounded.size === 0) return
    // Split: PCs get a broadcast to their owning client (player rolls
    // their own check). NPCs stay on the GM's local queue (no owner;
    // GM rolls). Same canon outcome resolution either path.
    const npcQueue: Array<{ name: string; amod: number }> = []
    for (const name of Array.from(wounded)) {
      const pcEntry = entries.find(e => e.character.name === name)
      const npcRow = !pcEntry ? campaignNpcs.find((n: any) => n.name === name) : null
      if (!pcEntry && !npcRow) continue
      // Read infection_state FRESH from the DB, not in-memory liveState. A
      // Restore/clear writes the DB but may not have refreshed the local
      // entries cache, so the cached value goes stale 'wound' and the
      // no-stacking gate silently skips a legitimate check. Same fresh-source
      // principle the warning query above already follows.
      let currentState: string | null = null
      if (pcEntry) {
        const { data: freshCs } = await supabase.from('character_states').select('infection_state').eq('id', pcEntry.stateId).maybeSingle()
        currentState = (freshCs as any)?.infection_state ?? null
      } else if (npcRow) {
        const { data: freshNpc } = await supabase.from('campaign_npcs').select('infection_state').eq('id', (npcRow as any).id).maybeSingle()
        currentState = (freshNpc as any)?.infection_state ?? null
      }
      trace('infection-queue', { name, isPc: !!pcEntry, currentState, userId: pcEntry?.userId ?? null, action: currentState ? 'skip-already-sick' : (pcEntry ? 'broadcast-pc' : 'queue-npc') })
      if (currentState) continue // already sick - canon: no stacking
      if (pcEntry) {
        const phyAmod = pcEntry.character.data?.rapid?.PHY ?? 0
        // Broadcast scoped to the PC's owning userId. The listener
        // in init channel gates on targetUserId === userId, so only
        // that player's client opens the modal.
        initChannelRef.current?.send({
          type: 'broadcast',
          event: 'infection_check_request',
          payload: { targetUserId: pcEntry.userId, name, amod: phyAmod },
        })
      } else if (npcRow) {
        const phyAmod = (npcRow as any).physicality ?? 0
        npcQueue.push({ name, amod: phyAmod })
      }
    }
    if (npcQueue.length === 0) return
    // GM rolls NPC checks sequentially - first opens now, the rest
    // drain from closeRollModal as each closes.
    const first = npcQueue.shift()!
    pendingInfectionChecksRef.current = npcQueue
    handleRollRequest(`${first.name} - Infection Check (Wound)`, first.amod, 0)
  }

  async function addNPC(name: string) {
    if (!gmLike) return
    const trimmed = name.trim()
    if (!trimmed) return
    const roll = rollD6() + rollD6()
    await supabase.from('initiative_order').insert({
      campaign_id: id,
      character_name: trimmed,
      character_id: null,
      user_id: null,
      roll,
      is_active: false,
      is_npc: true,
      actions_remaining: 2,
    })
    await loadInitiative(id)
  }

  // Add a PC to the initiative mid-combat (playtest #23). Used when a player
  // joins the table after combat started and needs to be slotted in. Rolls
  // their initiative with ACU+DEX modifiers same as combat-start, inserts
  // an initiative_order row, broadcasts turn_changed so every client sees
  // them on the bar. The PC is inactive by default - GM advances to them
  // when their turn comes up in sort order.
  async function addPCToCombat(charEntry: TableEntry) {
    if (!gmLike) return
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
    // (0,0) - what the playtest hit. Mirrors the pattern already used
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
    //   1. Live token (archived_at IS NULL) - already on map; skip.
    //   2. Archived token (archived_at NOT NULL) - un-archive in place
    //      to restore the GM's previous positioning.
    //   3. No token at all - insert fresh at cluster position.
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
    // restored from archive)? Done - no top-left cluster needed.
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
    const { data: activeScene } = await supabase.from('tactical_scenes').select('id, grid_cols, grid_rows').eq('campaign_id', id).eq('is_active', true).single()
    if (!activeScene) { alert('No active tactical scene. Create a scene first.'); return }
    const spawn = defaultSpawnCell((activeScene as any).grid_cols ?? 20, (activeScene as any).grid_rows ?? 15)
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
    // Spawn top-left (1,1) via defaultSpawnCell - one cell in from the
    // corner so the draggable day/night/fog toolbar doesn't hide it.
    const { error: tokenErr } = await supabase.from('scene_tokens').insert({
      scene_id: activeScene.id,
      name,
      token_type: type,
      character_id: characterId || null,
      npc_id: npcId || null,
      portrait_url: portraitUrl || null,
      grid_x: spawn.grid_x,
      grid_y: spawn.grid_y,
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
    // Nudge the player clients to refetch - their postgres_changes subscription
    // on npc_relationships doesn't reliably fire (see handler in initChannelRef
    // setup). Broadcast bypasses RLS/publication and always lands.
    initChannelRef.current?.send({ type: 'broadcast', event: 'npcs_revealed', payload: {} })
  }

  async function removeFromInitiative(entryId: string) {
    if (!gmLike) return
    await supabase.from('initiative_order').delete().eq('id', entryId)
    await loadInitiative(id)
  }

  // ── InitiativeBar callbacks ──────────────────────────────────
  // Parent owns DB writes; <InitiativeBar/> calls these by name.
  // Identical behavior to the inline handlers that used to live in the
  // bar's JSX before the C2 extraction.

  async function handleGrantAction(entry: InitiativeEntry) {
    const nextCount = Math.min(2, (entry.actions_remaining ?? 0) + 1)
    await supabase.from('initiative_order').update({ actions_remaining: nextCount }).eq('id', entry.id)
    await loadInitiative(id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  async function handleSkipTurn(entry: InitiativeEntry) {
    await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', entry.id)
    if (entry.is_active) {
      // Active combatant: nextTurn handles the advance + the New-Round
      // wrap-and-fire when this was the last unacted combatant.
      await nextTurn()
    } else {
      // Non-active: refresh local state so the bar's hasActed gating
      // greys them out.
      await loadInitiative(id)
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
    }
  }

  async function handleInitiativeBarRemove(entry: InitiativeEntry) {
    if (!gmLike) {
      // Player ending their own active turn - × is gated to active+self
      // in the bar component, so we can just advance. Thrivers fall
      // through to the GM-side remove branch via godmode.
      await nextTurn()
      return
    }
    if (entry.is_active) {
      // Hand activity to the next combatant in roll-desc order WITHOUT
      // calling nextTurn - that would wrap past end and fire "New
      // Round" which isn't what GM wants when just removing someone.
      const sorted = [...initiativeOrder].sort((a, b) => b.roll - a.roll || a.character_name.localeCompare(b.character_name))
      const idx = sorted.findIndex(e => e.id === entry.id)
      const successor = idx >= 0 ? sorted.slice(idx + 1).concat(sorted.slice(0, idx)).find(e => e.id !== entry.id) : null
      if (successor) {
        await supabase.from('initiative_order').update({ is_active: true }).eq('id', successor.id)
      }
    }
    await removeFromInitiative(entry.id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  // ── TacticalMap callbacks - stable identity, fresh closures ──
  // Each is wrapped in useStableCallback so the function reference
  // never changes for the lifetime of this component. With the
  // memo'd <TacticalMap/> child, this means re-renders triggered by
  // unrelated parent state (chat updates, modal toggles, rolls
  // feed updates, etc.) skip the entire canvas component. Data
  // props (initiativeOrder, entries, campaignNpcs, vehicles) still
  // trigger re-renders when their references change - that's
  // correct behavior. Stale-closure risk is eliminated by the
  // useStableCallback ref pattern (the wrapped fn always reads
  // the latest closure).

  const handleMapTokenChanged = useStableCallback(() => {
    setTokenRefreshKey(k => k + 1)
    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
  })

  const handleMapPlayerDragMove = useStableCallback((characterId: string) => {
    // Player dragged their own PC within the Move-action limit.
    // Consume 1 action via the owner's initiative row. No log
    // label - the drag animation is self-evident.
    const entry = initiativeOrder.find(e => e.character_id === characterId)
    if (entry) consumeAction(entry.id, undefined, 1)
  })

  const handleMapGMDragMove = useStableCallback(({ characterId, npcId }: { characterId?: string; npcId?: string }) => {
    // GM dragged the active combatant's token. Same 1-action
    // cost as a player drag. The TacticalMap-side gate already
    // confirmed this is the active combatant before firing.
    const entry = initiativeOrder.find(e =>
      (characterId && e.character_id === characterId) ||
      (npcId && e.npc_id === npcId)
    )
    if (entry) consumeAction(entry.id, undefined, 1)
  })

  // Defensive vehicles refresh - called by TacticalMap when the
  // tactical channel receives a vehicle_updated broadcast (popout
  // wrote new seat assignments). Refetches campaigns.vehicles
  // directly, bypassing the flaky jsonb-over-realtime path.
  const refetchVehicles = useStableCallback(async () => {
    const { data: camp } = await supabase
      .from('campaigns')
      .select('vehicles')
      .eq('id', id)
      .maybeSingle()
    if (camp && Array.isArray((camp as any).vehicles)) {
      setVehicles((camp as any).vehicles)
    }
  })

  // Cross-tab vehicle-update signals - four independent paths because
  // a single one keeps dropping under load:
  //   1. localStorage 'storage' event - browser-native, OTHER tab only
  //   2. BroadcastChannel - browser-native, OTHER context only
  //   3. window 'focus' - whenever this tab regains focus
  //   4. 3-second polling - last-resort guarantee
  // Whatever fires first wins; refetchVehicles is idempotent.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `vehicle_updated_${id}`
    const channelName = `tapestry-vehicle-updates-${id}`
    function onStorage(e: StorageEvent) {
      if (e.key !== storageKey) return
      void refetchVehicles()
    }
    function onFocus() {
      void refetchVehicles()
    }
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(channelName)
      bc.onmessage = () => { void refetchVehicles() }
    } catch { bc = null }
    const pollId = window.setInterval(() => { void refetchVehicles() }, 3000)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(pollId)
      try { bc?.close() } catch {}
    }
  }, [id, refetchVehicles])

  const handleMapObjectMove = useStableCallback((tokenId: string) => {
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
  })

  const handleMapTokenClick = useStableCallback((token: any) => {
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
        // Players can only open their OWN character sheet - seeing
        // another PC's sheet leaks stats, inventory, and notes.
        // GM and Thriver godmode keep full access.
        if (!gmLike && entry.userId !== userId) return
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
  })

  const handleMapTokenSelect = useStableCallback((token: any) => {
    setSelectedMapTargetName(token?.name ?? null)
  })

  const handleMapTokensUpdate = useStableCallback((toks: any[], cellFeet: number) => {
    // Only update if positions actually changed to avoid re-render churn
    setMapTokens(prev => {
      const same = prev.length === toks.length && prev.every((p, i) => p.id === toks[i].id && p.grid_x === toks[i].grid_x && p.grid_y === toks[i].grid_y)
      return same ? prev : toks
    })
    setMapCellFeet(cellFeet)
  })

  const handleMapMoveComplete = useStableCallback(async () => {
    // Vehicle / object-token moves: the token physically moved
    // via scene_tokens.grid_x/y, but no character/NPC consumed
    // an action - vehicles aren't combatants. Bump the token's
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
    // The mover is whoever moveMode references - NOT necessarily the
    // current active combatant. Turn could auto-advance between Move
    // click and target-cell click, leaving stale active state, in
    // which case the visibly-moved token belongs to a former active.
    const activeNow = initiativeOrder.find((e: any) => e.is_active)
    const mover = (moveMode?.characterId
      ? initiativeOrder.find((e: any) => e.character_id === moveMode.characterId)
      : moveMode?.npcId
        ? initiativeOrder.find((e: any) => e.npc_id === moveMode.npcId)
        : null) ?? activeNow
    trace('move', {
      onMoveComplete: true,
      moveMode,
      activeName: activeNow?.character_name, activeId: activeNow?.id, activeActions: activeNow?.actions_remaining,
      moverName: mover?.character_name, moverId: mover?.id, moverActions: mover?.actions_remaining,
      matched: mover?.id === activeNow?.id,
    })
    const charge = pendingChargeRef.current
    if (charge) {
      if (mover && charge.activeId && charge.activeId !== mover.id) {
        trace('charge', { aborted: 'active combatant changed' })
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
        // generic "- Sprint" log entry to land BEFORE the
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
      // The Athletics roll fires for the former active combatant -
      // bypass the active-combatant check that would otherwise block it.
      handleRollRequest(`${mover?.character_name ?? 'Unknown'} - Sprint (Athletics)`, amod, smod, undefined, true)
    } else {
      // Only consume an action when the combatant we just moved is
      // actually the active one. GM-initiated "move this NPC" for an
      // off-turn combatant must not silently deduct from their next
      // real turn's action budget.
      if (mover && mover.is_active) consumeAction(mover.id, `${mover.character_name} - Move`)
      setMoveMode(null)
    }
  })

  const handleMapMoveCancel = useStableCallback(() => {
    pendingChargeRef.current = null
    sprintPendingRef.current = false
    setMoveMode(null)
  })

  const handleMapThrowComplete = useStableCallback((gx: number, gy: number) => {
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
  })

  const handleMapThrowCancel = useStableCallback(() => setThrowMode(null))

  // TacticalMap only cares about the five throw fields - the rest of
  // the throwMode state (weapon, amod, smod, label) belongs to the
  // roll modal. Memoizing the projection keeps the prop reference
  // stable across re-renders that don't actually mutate throwMode,
  // so TacticalMap (which is wrapped in memo internally) doesn't
  // re-mount its in-flight throw arc / target preview every render.
  const tacticalThrowMode = useMemo(
    () => throwMode ? {
      attackerCharId: throwMode.attackerCharId,
      attackerNpcId: throwMode.attackerNpcId,
      rangeFeet: throwMode.rangeFeet,
      hasBlast: throwMode.hasBlast,
      friendlyCharacterIds: throwMode.friendlyCharacterIds,
      friendlyNpcIds: throwMode.friendlyNpcIds,
    } : null,
    [throwMode],
  )

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
    // Optimistic local swap - the initiative bar repaints instantly instead
    // of waiting for the DB round-trip + realtime fanout. Without this, a
    // slow network makes defer feel broken (the icon stays put for seconds).
    const activation = activateUpdate(next)
    setInitiativeOrder(prev => prev.map(e => {
      if (e.id === current.id) return { ...e, roll: newCurrentRoll, ...(wasActive ? { is_active: false, actions_remaining: current.actions_remaining ?? 2, aim_bonus: 0 } : {}) }
      if (e.id === next.id) return { ...e, roll: newNextRoll, ...(wasActive ? activation : {}) }
      return e
    }).sort((a, b) => b.roll - a.roll || a.character_name.localeCompare(b.character_name)))
    // Persist the new roll values to the DB - playtest #7 fix: direct
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
    await insertRollLog({
      campaign_id: id, user_id: userId, character_name: 'System',
      label: `↓ ${current.character_name} deferred their turn to after ${next.character_name}`,
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.defer,
    })
    await Promise.all([loadInitiative(id), rollsFeed.refetch()])
    // Always broadcast so other clients refresh whether or not the deferrer
    // was active - previously non-active defers silently stranded other
    // viewers on the old order.
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  // ── Session functions ──

  async function startSession() {
    if (!gmLike) return
    // UI updates instantly; DB writes fire in the background (mirrors endSession).
    const newCount = sessionCount + 1
    const startedAt = new Date().toISOString()
    rollsFeed.clear()
    chat.clear()
    setSessionStatus('active')
    setSessionCount(newCount)
    logEvent('session_started', { campaign_id: id, session_number: newCount })
    trace('startSession', { note: 'kick-preserve build - kicks persist across sessions' })
    // Fire all four DB calls in parallel - none depend on each other.
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
      deleteRollLog().eq('campaign_id', id).then(({ error }: any) => {
        if (error) console.error('[startSession] roll_log delete failed:', error.message)
      }),
      supabase.from('chat_messages').delete().eq('campaign_id', id).then(({ error }: any) => {
        if (error) console.error('[startSession] chat_messages delete failed:', error.message)
      }),
      // NOTE: no mass kicked=false reset - kick persists across sessions.
      // Kicked players must manually Rejoin from the story overview page.
    ]).catch(err => console.error('[startSession] background error:', err))
    // Broadcast to every client so local chat/log state is force-cleared even
    // if a DELETE realtime event gets dropped or RLS blocks the write.
    initChannelRef.current?.send({ type: 'broadcast', event: 'logs_cleared', payload: {} })
  }

  async function endSession() {
    if (!gmLike) return
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

    // Fire all DB work in the background - UI is already updated
    const now = new Date().toISOString()
    const bgWork = async () => {
      try {
        await Promise.all([
          supabase.from('campaigns').update({ session_status: 'idle', session_started_at: null }).eq('id', id),
          deleteRollLog().eq('campaign_id', id).then(({ error }: any) => {
            if (error) console.error('[endSession] roll_log delete failed:', error.message)
          }),
          supabase.from('chat_messages').delete().eq('campaign_id', id).then(({ error }: any) => {
            if (error) console.error('[endSession] chat_messages delete failed:', error.message)
          }),
          combatActive ? Promise.all([
            insertRollLog({ campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended', die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.action }),
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
              const check = prepareUpload('session-attachments', file)
              if (!check.ok) { console.error('[EndSession] upload rejected:', check.reason); continue }
              const path = `${sessionRow.id}/${check.filename}`
              const { error: upErr } = await supabase.storage.from('session-attachments').upload(path, file, { contentType: check.contentType })
              if (!upErr) {
                const { data: urlData } = supabase.storage.from('session-attachments').getPublicUrl(path)
                await supabase.from('session_attachments').insert({
                  session_id: sessionRow.id,
                  file_url: urlData.publicUrl,
                  file_name: check.filename,
                  file_type: check.contentType,
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
  useEffect(() => { campaignNpcsRef.current = campaignNpcs as any }, [campaignNpcs])

  // Auto-open the Lasting Damage Check modal for any character with
  // infection_pending_lasting_check=true on their row. The drainer sets
  // this flag when an infection's days_left hits 0 with severity='check',
  // alongside firing the realtime broadcast. Broadcast = fast path
  // (modal opens within seconds on live tabs); this effect = durability
  // path (modal opens on next page load even if the broadcast was
  // missed - closed tab, stale bundle, websocket dropped).
  //
  // Gating:
  //   PC row  -> only the owning user opens it.
  //   NPC row -> only GM-likes open it.
  //   firedLastingChecksRef dedups per-session so loadEntries refreshes
  //     don't re-pop a modal that's already up. The DB flag clears in
  //     executeRoll's Lasting Damage Check branch on resolve.
  useEffect(() => {
    if (pendingRoll) return       // one modal at a time
    if (!userId) return
    for (const e of entries) {
      const ls: any = e.liveState
      if (!ls?.infection_pending_lasting_check) continue
      if (e.userId !== userId) continue
      if (firedLastingChecksRef.current.has(e.stateId)) continue
      firedLastingChecksRef.current.add(e.stateId)
      const phyAmod = e.character.data?.rapid?.PHY ?? 0
      handleRollRequest(`${e.character.name} - Lasting Damage Check`, phyAmod, 0)
      return
    }
    if (!gmLike) return
    for (const n of campaignNpcs as any[]) {
      if (!n.infection_pending_lasting_check) continue
      if (firedLastingChecksRef.current.has(n.id)) continue
      firedLastingChecksRef.current.add(n.id)
      const phyAmod = n.physicality ?? 0
      handleRollRequest(`${n.name} - Lasting Damage Check`, phyAmod, 0)
      return
    }
  }, [entries, campaignNpcs, userId, gmLike, pendingRoll])

  const [revealedNpcs, setRevealedNpcs] = useState<any[]>([])
  const revealedNpcIds = useMemo(() => new Set<string>(revealedNpcs.map((n: any) => n.id)), [revealedNpcs])
  const npcRosterInitiativeNpcIds = useMemo(
    () => new Set(initiativeOrder.filter(e => e.npc_id).map(e => e.npc_id!)),
    [initiativeOrder]
  )
  const npcRosterInitiativeNpcOrder = useMemo(() => {
    const activeIdx = initiativeOrder.findIndex(e => e.is_active)
    const rotated = activeIdx >= 0
      ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
      : initiativeOrder
    return rotated.filter(e => e.npc_id).map(e => e.npc_id!)
  }, [initiativeOrder])
  const npcRosterPcEntries = useMemo(
    () => entries.map(e => ({ characterId: e.character.id, characterName: e.character.name, userId: e.userId })),
    [entries]
  )
  const npcRosterViewingNpcIds = useMemo(
    () => new Set(viewingNpcs.map(n => n.id)),
    [viewingNpcs]
  )
  const onNpcRosterViewNpc = useCallback(
    (npc: CampaignNpc) => { openPopout(`/npc-sheet?c=${id}&npc=${npc.id}&gm=${gmLike ? 1 : 0}`, `npc-${npc.id}`, { w: 571, h: 400 }) },
    [id, gmLike]
  )
  const onNpcRosterEditStarted = useCallback(() => setPendingEditNpcId(null), [])
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
  // Phase B player-folder reorder (companion to playerFolderDragId at L687).
  // Mirrors the GM's `folderOrder` in NpcRoster but keyed under
  // `npc_folder_order_player_${id}` so a single user's GM order and
  // player order on different campaigns stay independent. Persists
  // immediately on every reorder; survives reload because the player
  // tab is the only place we surface NPC folders to non-GMs.
  const [playerFolderOrder, setPlayerFolderOrder] = useState<string[]>([])
  const playerFolderOrderLoadedRef = useRef(false)
  useEffect(() => {
    if (playerFolderOrderLoadedRef.current || !id) return
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(`npc_folder_order_player_${id}`)
      if (saved) setPlayerFolderOrder(JSON.parse(saved))
    } catch { /* ignore quota / parse errors */ }
    playerFolderOrderLoadedRef.current = true
  }, [id])
  function handlePlayerFolderReorder(targetKey: string) {
    if (!playerFolderDragId || playerFolderDragId === targetKey) {
      setPlayerFolderDragId(null); setPlayerFolderDragOverId(null); return
    }
    setPlayerFolderOrder(prev => {
      const fromIdx = prev.indexOf(playerFolderDragId!)
      const toIdx = prev.indexOf(targetKey)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(`npc_folder_order_player_${id}`, JSON.stringify(next)) } catch {}
      }
      return next
    })
    setPlayerFolderDragId(null)
    setPlayerFolderDragOverId(null)
  }
  const [focusPin, setFocusPin] = useState<{ id: string; lat: number; lng: number } | null>(null)

  // Re-sync any open NpcCards (centered "viewing" cards) whenever the underlying
  // campaignNpcs list refreshes from realtime - without this, an open card keeps
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
    const { user } = await getCachedAuth()
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
    handleRollRequest(`${characterName} - Perception Check`, perMod, 0)
    setShowSpecialCheck(null)
  }

  // Skip the PC-picker modal for special checks when the answer is
  // unambiguous. Two short-circuits, in priority order:
  //
  //   1. Single eligible PC. Player path (sees only own PC) and
  //      solo-test GM (one PC seeded). Picker would be a 1-button
  //      modal - pure overhead.
  //   2. Combat is active AND a PC has the turn. The 99% case the
  //      GM hits during a fight: "the active PC just spotted
  //      something - give me a Perception". Auto-pick the active
  //      combatant; GM keeps the picker for the rare "I want a
  //      different PC to roll" case via the menu (just call
  //      setShowSpecialCheck directly if needed - but in practice
  //      the active-PC autopick is what they want).
  //
  // Multi-PC GM out-of-combat (or NPC's turn) still gets the picker
  // - there's a real choice to make there. Reported in last night's
  // playtest (2026-05-04 BUG-1: "Perception check has a redundant
  // first modal - should go straight to the roll modal").
  function shortCircuitForSpecialCheck(): { name: string } | null {
    const visible = entries.filter(e => gmLike || e.userId === userId)
    if (visible.length === 1) return { name: visible[0].character.name }
    if (gmLike && combatActive) {
      const active = initiativeOrder.find(ie => ie.is_active && !ie.is_npc)
      if (active && active.character_id) {
        const tgt = visible.find(e => e.character.id === active.character_id)
        if (tgt) return { name: tgt.character.name }
      }
    }
    return null
  }
  function startSpecialCheckPerception() {
    const sc = shortCircuitForSpecialCheck()
    if (sc) { triggerPerceptionCheck(sc.name); return }
    setShowSpecialCheck('perception' as any)
  }
  function startSpecialCheckGut() {
    const sc = shortCircuitForSpecialCheck()
    if (sc) { triggerGutInstinct(sc.name); return }
    setShowSpecialCheck('gut' as any)
  }

  function triggerGutInstinct(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const perMod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
    // Gut Instinct = Perception (RSN + ACU) + best of Psychology /
    // Streetwise / Tactics. Picker logic lives in lib/gut-instinct-helpers
    // (8 unit tests). Migrated off handleRollRequest 2026-05-20 onto the
    // dedicated <RollModal> mounted at the bottom of this file.
    const smod = gutInstinctSmod(charEntry.character.data?.skills ?? [])
    setGutInstinctCmod(0)
    setGutInstinctRollResult(null)
    setGutInstinctPending({
      characterName,
      pcOwnerId: charEntry.userId ?? null,
      amod: perMod,
      smod,
    })
    setShowSpecialCheck(null)
  }

  // First Impression - rolled by a PC against a specific NPC. On outcome,
  // writes `npc_relationships.relationship_cmod` so future Recruitment
  // Checks (and other social interactions) have the right CMod baked in.
  // See SRD §02 First Impressions + §08 Communities Recruitment Check.
  // triggerFirstImpression() deleted 2026-05-19 (FI streamline Phase 3).
  // Old flow: stash target ref + open standard RollModal, with the
  // relationship-bump happening inside executeRoll's FI branch.
  // New flow: <FirstImpressionModal> owns the whole pick + roll + bump
  // cycle via resolveFirstImpression. Callers (PlayerNpcCard quick-fire
  // buttons + the special-check picker entry) now set
  // firstImpressionNpcId + open showSpecialCheck = 'first_impression'.

  // ── Recruitment Check (Communities Phase B) ─────────────────────────
  // Flow: openRecruitModal() preps state + loads dependencies, then the
  // inline modal walks the player through pick → roll → result.
  // executeRecruitRoll() resolves the roll inside the modal (not via the
  // standard handleRollRequest/executeRoll path - Recruitment is out-
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
        // chosen-skill SMod. Summed into the UI breakdown alongside
        // CMod values for total-mod display; the actual roll adds it
        // to SMod (not CMod). UI label flags it as "SMod" so the
        // player isn't confused (rules-extract Tier-2 fix, 2026-05-19).
        //
        // Double-count suppression (Tier-2 fix, 2026-05-19): when the
        // chosen recruit skill IS Inspiration, its level is already in
        // SMod via the chosen-skill path. Adding the Inspiration auto-
        // bonus on top would double-count. Suppress here.
        if (recruitSkill !== 'Inspiration') {
          const insp = (rollerEntry.character.data?.skills ?? []).find((s: any) => s.skillName === 'Inspiration')
          inspiration = insp?.level ?? 0
        }
      }
    }
    // First Impression CMod - needs a fetch from npc_relationships;
    // we don't eagerly sync this into state. The UI preview just
    // falls through to 0 until the player rolls First Impression
    // separately (which writes the row). Future enhancement: fetch
    // on NPC pick. MVP: inline hint if it's null.
    // For now, read from revealedNpcs which carries relationship_cmod.
    const revealed = revealedNpcs.find((n: any) => n.id === recruitNpcId)
    if (revealed && typeof revealed.relationship_cmod === 'number') firstImpression = revealed.relationship_cmod
    // Poaching - if NPC is already in another community, apply -3.
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
    // requires a credible threat - coercion, leverage, weapons drawn,
    // hostage, etc. Surface this at roll time so it can't be a
    // half-accidental click. SRD: "The PCs must present a credible
    // threat for Conscription to work."
    if (recruitApproach === 'conscript') {
      const ack = confirm(
        `Conscription - pressgang.\n\n` +
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
    // Insight Die pre-roll - 3d6 keep-all, or +3 CMod flat. Deducts 1
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

    // Tier-2 approach-specific Success / Failure flags per Xero
    // 2026-05-19 (Phase A: schema + flag-setting). Phase B (morale
    // drainer + GM escape surface) and Phase C (modal lock gate) ship
    // separately. Canon mapping:
    //   Success (any approach)         → temporary_until_morale = true
    //   Wild Success / HI (any)        → permanent (default flags)
    //   Conscript Failure              → escape_pending = true, still
    //                                     inserts the membership
    //   Convert + Intimidation Failure → no membership; append
    //                                     'convert' to NPC's
    //                                     recruit_locked_approaches array
    //   Cohort/Convert Failure or any  → no membership, no lock
    //   Dire Failure / Low Insight     → no membership, no lock
    //                                     (narrative-only)
    const isSuccessTier = outcome === 'Success'  // plain Success, NOT Wild/HI
    const isConscriptFailure = recruitApproach === 'conscript' && (outcome === 'Failure' || outcome === 'Dire Failure' || outcome === 'Low Insight')
    const isConvertIntimidationFailure = recruitApproach === 'convert' && recruitSkill === 'Intimidation' && (outcome === 'Failure' || outcome === 'Dire Failure' || outcome === 'Low Insight')
    // Membership-shape: who gets a row? Successes always do; Conscript
    // Failure gets a row WITH escape_pending so the GM can fire the
    // escape later. Convert+Intimidation Failure NEVER gets a row;
    // the NPC just gets the approach locked.
    const writesMembership = isSuccess || isConscriptFailure

    // On success, INSERT community_members. If the NPC is currently in
    // another community (poaching), leave that row alone - narratively
    // the NPC is switching allegiance but the GM may want to retain
    // history. MVP behavior: just insert the new membership; GM can
    // manually remove old one if desired.
    let inserted = false
    if (writesMembership) {
      const { error: memErr } = await supabase.from('community_members').insert({
        community_id: finalCommunityId,
        npc_id: recruitNpcId,
        character_id: null,
        role: 'unassigned',
        recruitment_type: recruitmentType,
        apprentice_of_character_id: applyApprentice ? recruitRollerId : null,
        joined_at: new Date().toISOString(),
        // Tier-2 flags: plain Success → temporary; Conscript Failure
        // → escape_pending. Wild Success / HI leave both false
        // (permanent commit per canon).
        temporary_until_morale: isSuccessTier,
        escape_pending: isConscriptFailure,
      })
      if (memErr) {
        alert(`Failed to add member: ${memErr.message}`)
      } else {
        inserted = true
        // Progression log entry on the recruiter PC. Wording varies
        // by outcome: Conscript Failure reads as "appears to comply"
        // so the GM has a clear in-fiction beat to work with.
        let recruitedAs: string
        if (isConscriptFailure) {
          recruitedAs = `a Conscript (appears to comply, but will escape at the first opportunity)`
        } else if (applyApprentice) {
          recruitedAs = 'an Apprentice'
        } else {
          const baseLabel = recruitmentType.charAt(0).toUpperCase() + recruitmentType.slice(1)
          recruitedAs = isSuccessTier ? `a temporary ${baseLabel} (drops at next Morale Check)` : `a ${baseLabel}`
        }
        if (rollerEntry.character?.id) void appendProgressionLog(rollerEntry.character.id, 'community', `🤝 Recruited ${npc.name} as ${recruitedAs} to ${finalCommunityName}.`)
      }
    }
    // Convert + Intimidation Failure: lock the 'convert' approach on
    // this NPC permanently (any future PC, any future attempt). The
    // Recruit modal (Phase C) will hide the locked approach in its
    // picker. Dedupe in JS - array_append in SQL would also work but
    // requires a fetch-or-RPC roundtrip; this is one read + one
    // update either way.
    if (isConvertIntimidationFailure) {
      const existing: string[] = Array.isArray((npc as any).recruit_locked_approaches) ? (npc as any).recruit_locked_approaches : []
      if (!existing.includes('convert')) {
        const next = [...existing, 'convert']
        const { error: lockErr } = await supabase
          .from('campaign_npcs')
          .update({ recruit_locked_approaches: next })
          .eq('id', recruitNpcId)
        if (lockErr) console.error('[recruit-tier2] lock-approach update error:', lockErr.message)
        else {
          // Local state patch so the picker reflects the lock without a refetch.
          setCampaignNpcs(prev => prev.map(n => n.id === recruitNpcId ? { ...n, recruit_locked_approaches: next } as any : n))
        }
      }
    }

    // Log to roll_log with outcome='recruit' for the feed. damage_json
    // carries the metadata so the feed renderer can show structured
    // flavor: approach, community, apprentice flag, poaching, etc.
    const logLabel = isSuccess
      ? `🤝 ${rollerEntry.character.name} recruited ${npc.name}${applyApprentice ? ' as an Apprentice' : ` as a ${recruitmentType.charAt(0).toUpperCase() + recruitmentType.slice(1)}`} to ${finalCommunityName}`
      : `🤝 ${rollerEntry.character.name} tried to recruit ${npc.name} - ${outcome}`
    const { data: logRow } = await insertRollLog({
      campaign_id: id,
      user_id: userId,
      character_name: rollerEntry.character.name,
      label: logLabel,
      die1, die2, amod, smod, cmod: cmods.total + bonusCmod,
      total,
      outcome: OUTCOME.recruit,
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
    void logEvent('recruit_attempted', {
      campaign_id: id,
      approach: recruitApproach,
      outcome,
      npc_id: recruitNpcId,
      community_id: finalCommunityId,
      apprentice: applyApprentice,
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
      // Withdraw membership - the recruit no longer happened.
      await supabase.from('community_members')
        .delete()
        .eq('community_id', r.communityId)
        .eq('npc_id', recruitNpcId)
      inserted = false
      apprenticeApplied = false
    } else if (!wasSuccess && nowSuccess && r.communityId) {
      // Late-insert the member. Apprentice flag defers to the
      // post-roll Apprentice toggle (user clicks "Take as Apprentice"
      // if they want it) - here we just land them as the normal
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
      if (!memErr) {
        inserted = true
        // Progression log on the rolling PC.
        const recruitedAs = `a ${r.approach.charAt(0).toUpperCase() + r.approach.slice(1)}`
        if (rollerEntry.character?.id) void appendProgressionLog(rollerEntry.character.id, 'community', `🤝 Recruited ${r.npcName} as ${recruitedAs} to ${r.communityName}.`)
      }
    }

    // Patch the existing roll_log row.
    const newLabel = nowSuccess
      ? `🤝 ${r.rollerName} recruited ${r.npcName}${apprenticeApplied ? ' as an Apprentice' : ` as a ${r.approach.charAt(0).toUpperCase() + r.approach.slice(1)}`} to ${r.communityName}`
      : `🤝 ${r.rollerName} tried to recruit ${r.npcName} - ${outcome}`
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
    // Broadcast - reroll can flip membership state (added or removed)
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
    // Canon per Group Check rules (app/rules/core-mechanics/attribute-checks):
    // "The player with the highest relevant AMod or SMod makes the check
    // and applies any AMods or SMods from the other characters taking
    // part." Sum BOTH others' AMods and SMods - the previous version
    // only added SMods, which under-counted multi-person checks. For a
    // 3-person check this can be the difference between +1 SMod and
    // +3 AMod +3 SMod on the leader's roll.
    const bonusAmods = scored.slice(1).reduce((sum, p) => sum + p.amod, 0)
    const bonusSmods = scored.slice(1).reduce((sum, p) => sum + p.smod, 0)
    // Stash the full participant list so the saveRollToLog branch
    // can attach it to damage_json and the bespoke banner can render
    // "Cree Hask, Marv, and Wilson were Successful at Survival" rather
    // than just the leader's name. Cleared on close (see executeRoll).
    groupCheckPayloadRef.current = {
      participants: scored.map(p => p.character.name),
      skill: groupCheckSkill,
    }
    handleRollRequest(`Group Check - ${groupCheckSkill} (led by ${leader.character.name})`, leader.amod + bonusAmods, leader.smod + bonusSmods)
    setShowSpecialCheck(null)
    setGroupCheckParticipants(new Set())
    setGroupCheckSkill('')
  }

  // Heal: fires a Medicine* check on the chosen target with the kit CMod
  // pre-baked. Post-resolve handler in executeRoll handles outcome:
  // queues pending_heal events on Success+, applies -1 WP on Dire Failure,
  // triggers a Wound Infection prompt on Low Insight.
  function triggerHeal() {
    if (!healTargetCharId) return
    const myEntry = entries.find(e => e.userId === userId)
    if (!myEntry) { alert('You must have a character in this campaign to heal.'); return }
    const target = entries.find(e => e.character.id === healTargetCharId)
    if (!target) { alert('Target not found.'); return }
    // Medicine* is RSN-based.
    const amod = (myEntry.character.data?.rapid as any)?.RSN ?? 0
    const smod = (myEntry.character.data?.skills ?? []).find((s: any) => s.skillName === 'Medicine*')?.level ?? 0
    healPendingRef.current = {
      targetCharId: target.character.id,
      targetName: target.character.name,
      kit: healKit,
    }
    // Kit CMod is baked into baseCmod via the same path the
    // Coordinated-Effort auto-injection uses. Simpler: pass the kit
    // bonus by setting setCmod after handleRollRequest. handleRollRequest
    // resets cmod to baseCmod, so we override right after.
    const kitCmod = healKit === 'doctors_bag' ? 2 : healKit === 'first_aid' ? 1 : 0
    const kitLabel = healKit === 'doctors_bag' ? "Doctor's Bag" : healKit === 'first_aid' ? 'First Aid Kit' : 'naked'
    handleRollRequest(`${myEntry.character.name} - Heal ${target.character.name} (${kitLabel})`, amod, smod)
    if (kitCmod > 0) {
      // Defer to next tick so handleRollRequest's setCmod fires first. Clear
      // the itemized sources so the kit bonus reads as a plain CMod term in
      // the breakdown, not a stale Aim term from the prefill.
      setTimeout(() => { cmodSourcesRef.current = {}; setCmod(String(kitCmod)) }, 0)
    }
    setShowSpecialCheck(null)
    setHealTargetCharId('')
    setHealKit('none')
  }

  // Coordinated Effort: fires the first roll in the chain. The +N coord
  // bonus (one per OTHER participant) is pre-baked into CMod inside
  // handleRollRequest (see coordEffortRef check in baseCmod calc).
  // Lead outcome → leadCmod is captured in executeRoll's post-resolve
  // block; subsequent rolls by participants then auto-apply +N + leadCmod.
  function triggerCoordinatedEffort() {
    if (coordEffortParticipants.size === 0 || !coordEffortSkill) return
    const participants = entries.filter(e => coordEffortParticipants.has(e.character.id))
    if (participants.length === 0) return
    const myEntry = entries.find(e => e.userId === userId)
    if (!myEntry || !coordEffortParticipants.has(myEntry.character.id)) {
      alert('You must include your own character in the Coordinated Effort.')
      return
    }
    // Look up the chosen skill to find its attribute.
    const skillDef = SKILLS.find(s => s.name === coordEffortSkill)
    const attrKey = skillDef?.attribute ?? 'RSN'
    const amod = (myEntry.character.data?.rapid as any)?.[attrKey] ?? 0
    const smod = (myEntry.character.data?.skills ?? []).find((s: any) => s.skillName === coordEffortSkill)?.level ?? 0
    // Stash the chain state. leadRollPending = the lead roll is about
    // to fire; handleRollRequest's baseCmod hook will see this and
    // add the coord bonus but NOT leadCmod (which is 0 at this point).
    // executeRoll's post-resolve block flips this to isActive=true and
    // populates leadCmod from the outcome.
    coordEffortRef.current = {
      participantIds: Array.from(coordEffortParticipants),
      totalParticipants: participants.length,
      leadCmod: 0,
      isActive: false,
      leadRollPending: true,
      chainId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `chain-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }
    setCoordEffortTick(t => t + 1)
    handleRollRequest(`Coordinated Effort - ${coordEffortSkill}`, amod, smod)
    setShowSpecialCheck(null)
    setCoordEffortParticipants(new Set())
    setCoordEffortSkill('')
  }

  // End an active Coordinated Effort. Called from the active-chain
  // banner OR auto-fired on Low Insight lead outcome (chain collapses).
  function endCoordinatedEffort() {
    coordEffortRef.current = null
    setCoordEffortTick(t => t + 1)
  }

  // Withdraw a single participant from an active Coordinated Effort.
  // Per Xero's design call (2026-05-17): if a participant has to drop
  // mid-chain, the math fully retcons - every already-rolled chain
  // row gets cmod -= 1 / total -= 1 / outcome recomputed, the new
  // bonus going forward is (newTotal - 1).
  //
  // Edge: if the WITHDRAWING participant has already rolled, their
  // own row stays untouched (they took the action; the bonus they
  // had at the time stays in the log).  Everyone else gets the
  // retcon. We tag rows as "already rolled" by checking
  // character_name against the leaving participant.
  async function withdrawFromCoordinatedEffort(characterId: string) {
    const cef = coordEffortRef.current
    if (!cef || !cef.isActive) return
    // Identify the leaving participant by character name (roll_log
    // stores names, not ids).
    const leaver = entries.find(e => e.character.id === characterId)
    if (!leaver) return
    if (!confirm(`Withdraw ${leaver.character.name} from the Coordinated Effort? Every other participant's already-logged roll will have -1 CMod / -1 total / outcome recomputed.`)) return
    // Pull every row in the chain that ISN'T the leaver's own roll.
    const { data: chainRows, error: fetchErr } = await supabase
      .from('roll_log')
      .select('id, die1, die2, amod, smod, cmod, total, character_name')
      .eq('coord_chain_id', cef.chainId)
    if (fetchErr) {
      alert(`Withdraw failed: ${fetchErr.message}`)
      return
    }
    const toRetcon = (chainRows ?? []).filter((r: any) => r.character_name !== leaver.character.name)
    // Apply -1 to cmod + total, recompute outcome from the saved
    // d2 + d2 + mods. Insight pair (die1===die2) flips outcome to
    // High/Low Insight per canon - getOutcome handles that already.
    await Promise.all(toRetcon.map(async (r: any) => {
      const newCmod = (r.cmod ?? 0) - 1
      const newTotal = (r.total ?? 0) - 1
      const newOutcome = getOutcome(newTotal, r.die1, r.die2)
      await supabase
        .from('roll_log')
        .update({ cmod: newCmod, total: newTotal, outcome: newOutcome })
        .eq('id', r.id)
    }))
    // Drop the leaver from the chain. Decrement totalParticipants
    // so forward rolls use the new bonus baseline.
    coordEffortRef.current = {
      ...cef,
      participantIds: cef.participantIds.filter(pid => pid !== characterId),
      totalParticipants: Math.max(1, cef.totalParticipants - 1),
    }
    setCoordEffortTick(t => t + 1)
    // If only one participant remains, the chain has nothing left
    // to coordinate - tear it down.
    if (coordEffortRef.current!.totalParticipants <= 1) {
      endCoordinatedEffort()
    }
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

  // Target's Defense Mod for an incoming attack (the to-hit half of canon's
  // "double duty" - app/rules/combat/damage). MDM=PHY, RDM=DEX, + the init
  // row's defense_bonus (Defend/Take Cover). Works for PC OR NPC targets
  // (Q1=b: NPCs used to skip this because the prefill only looked up PCs).
  // Mirrors the damage path's resolution (~L5309). Objects have no defense.
  // resolveTargetDefense + computeAttackCmod moved to lib/table-roll-context.ts
  // (3c-B2, pure + unit-tested). The two call sites below pass the live
  // collections as an AttackCmodCtx bundle via cmodCtx().

  // Assembles the AttackCmodCtx from current component state for the prefill
  // and the target-dropdown onChange (the only two computeAttackCmod callers).
  function cmodCtx(): AttackCmodCtx {
    return {
      entries, npcs: campaignNpcs, tokens: mapTokens, initiative: initiativeOrder,
      userId, pendingLabel: pendingRoll?.label ?? '', coordEffort: coordEffortRef.current,
    }
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
      // Apply full damage - WP=0 with death countdown + Stress pip on entry
      // to mortal-wound (rule: any mortal/incap transition fills one pip).
      const deathCountdown = mortalWoundCountdown(phyAmod)
      const targetEntry = entries.find(e => e.stateId === stateId)
      const newStress = Math.min(5, (targetEntry?.liveState.stress ?? 0) + 1)
      await supabase.from('character_states').update({
        wp_current: 0, death_countdown: deathCountdown, stress: newStress, updated_at: new Date().toISOString(),
      }).eq('id', stateId)
      setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, wp_current: 0, death_countdown: deathCountdown, stress: newStress } as any } : e))
      if (targetEntry) {
        await insertRollLog({
          campaign_id: id, user_id: userId, character_name: 'System',
          label: `😰 ${targetEntry.character.name} gains a Stress from being Mortally Wounded`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
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
      const { data: cfRows, error: cfErr } = await supabase.from('initiative_order').update({ aim_bonus: newBonus }).eq('id', targetEntryId).select('id, aim_bonus')
      if (cfErr) console.error('[applySocialAction] Cover Fire update error:', cfErr.message)
      else if (!cfRows || cfRows.length === 0) console.error('[applySocialAction] SILENT RLS FAIL - Cover Fire aim_bonus not updated. Run sql/initiative-order-rls-members-write.sql.')
      else initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      await consumeAction(activeEntry.id, `${activeEntry.character_name} - Cover Fire → ${targetEntry.character_name} (-2 CMod)`)
    } else if (action === 'Inspire') {
      // SRD: Inspiration check → target gains +1 Combat Action. Once per round.
      if (targetEntry.inspired_this_round) {
        alert(`${targetEntry.character_name} has already been Inspired this round.`)
        return
      }
      const newActions = (targetEntry.actions_remaining ?? 0) + 1
      const { data: insRows, error: insErr } = await supabase.from('initiative_order').update({ actions_remaining: newActions, inspired_this_round: true }).eq('id', targetEntryId).select('id, actions_remaining')
      if (insErr) console.error('[applySocialAction] Inspire update error:', insErr.message)
      else if (!insRows || insRows.length === 0) console.error('[applySocialAction] SILENT RLS FAIL - Inspire actions_remaining not updated. Run sql/initiative-order-rls-members-write.sql.')
      else initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      await consumeAction(activeEntry.id, `${activeEntry.character_name} - Inspire → ${targetEntry.character_name} (+1 action)`)
    }
    setSocialTarget(null)
  }

  function handleRollRequest(label: string, amod: number, smod: number, weapon?: WeaponContext, bypassTurnGate = false) {
    // 2026-05-10: turn gate REMOVED. Any character at /table can fire any
    // check (skill / attribute / social / weapon attack) in or out of
    // combat. Previously this function blocked non-active combatants
    // from rolling during combat, with an "It's not X's turn" alert.
    // That gate was protecting closeRollModal from consuming an action
    // off whichever combatant happened to be active - corruption when
    // a non-active player rolled. The fix is at the consume site: we
    // now stash the roller's initiative_order id on pendingRoll, and
    // closeRollModal only consumes an action when that id matches the
    // active combatant. Out-of-turn rolls happen freely; the action
    // economy stays intact.
    //
    // bypassTurnGate is retained as a parameter for backwards compat
    // (sprint deferred-roll path passes true) but is now a no-op.
    void bypassTurnGate

    // Resolve the roller's initiative_order id so closeRollModal can
    // gate its consume. Mirrors the old gate logic but stashes instead
    // of blocking.
    let rollerInitId: string | null = null
    if (combatActive) {
      const active = initiativeOrder.find(e => e.is_active)
      const firstPart = label.split(' - ')[0]
      const firstPartIsKnownName =
        campaignNpcs.some((n: any) => n.name === firstPart) ||
        entries.some(e => e.character.name === firstPart)
      let rollerName: string | null = null
      if (firstPartIsKnownName) {
        rollerName = firstPart
      } else if (weapon) {
        // Weapon attacks default to selectedEntry (GM/Thriver context) or my PC.
        if (gmLike && selectedEntry) rollerName = selectedEntry.character.name
        else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      } else {
        // Non-weapon roll - GM/Thriver may be rolling for active NPC; otherwise
        // it's the selectedEntry or the player's PC.
        if (gmLike && active?.is_npc) rollerName = active.character_name
        else if (gmLike && selectedEntry) rollerName = selectedEntry.character.name
        else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      }
      if (rollerName) {
        const rollerInit = initiativeOrder.find(e => e.character_name === rollerName)
        rollerInitId = rollerInit?.id ?? null
      }
    }
    rollExecutedRef.current = false
    setPendingRoll({ label, amod, smod, weapon, rollerInitId })
    setRollResult(null)
    // Include aim bonus from Aim action or Tracking trait
    const activeEntry = combatActive ? initiativeOrder.find(e => e.is_active) : null
    const aimBonus = activeEntry?.aim_bonus ?? 0
    const weaponConditionCmod = weapon?.conditionCmod ?? 0
    // Coordinated Effort auto-injection: if a chain is active (or its
    // lead roll is firing) AND the logged-in user's character is a
    // participant, add the coord bonus (+1 per OTHER participant) +
    // the leadCmod (0 for lead roll, ladder value once chain active).
    // Skipped for the Group Check label since that uses its own pooled
    // bonus path.
    let coordEffortCmod = 0
    const cef = coordEffortRef.current
    if (cef && !label.startsWith('Group Check - ')) {
      const myEntry = entries.find(e => e.userId === userId)
      const myCharId = myEntry?.character.id
      if (myCharId && cef.participantIds.includes(myCharId)) {
        coordEffortCmod = (cef.totalParticipants - 1) + cef.leadCmod
      }
    }
    let baseCmod = weaponConditionCmod + aimBonus + coordEffortCmod
    // No-target / skill-roll sources (overwritten by computeAttackCmod below
    // once a weapon target is chosen). Reset every prefill so a prior attack's
    // Aim / defense terms never leak onto the next roll's breakdown.
    cmodSourcesRef.current = { weaponCondition: weaponConditionCmod, aim: aimBonus, coordinatedEffort: coordEffortCmod }
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
      // PC attackers prefer NPC targets over teammate PCs (or objects) - even
      // when a teammate is closer. Stops the modal landing on "Frankie
      // Gibblets" when there's an NPC also in range. NPC attackers fall
      // through to the original closest-by-distance pick. Sticky targeting
      // (last_attack_target) and explicit map selection still win above
      // this auto-pick - see the chosenTarget chain below.
      const attackerIsPC = !activeEntry.is_npc
      type Cand = { name: string; dist: number; isNpc: boolean }
      function preferred(cur: Cand | null, c: Cand): Cand {
        if (!cur) return c
        if (attackerIsPC) {
          if (c.isNpc && !cur.isNpc) return c
          if (!c.isNpc && cur.isNpc) return cur
        }
        return c.dist < cur.dist ? c : cur
      }
      let bestInRange: Cand | null = null
      let bestAny: Cand | null = null
      for (const t of mapTokens) {
        if (t.id === attackerTok.id) continue
        if (!isNameValidLiveTarget(t.name)) continue
        const dist = Math.max(Math.abs(t.grid_x - attackerTok.grid_x), Math.abs(t.grid_y - attackerTok.grid_y))
        const cand: Cand = { name: t.name, dist, isNpc: !!t.npc_id }
        bestAny = preferred(bestAny, cand)
        if (weapon) {
          const band = getAutoRangeBand(activeEntry.character_id || undefined, activeEntry.npc_id || undefined, t.name)
          if (band && isInRange(weapon.weaponName, band)) {
            bestInRange = preferred(bestInRange, cand)
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
      // Itemized CMod (incl. NPC-target defense on the to-hit roll, Q1=b) via
      // the shared computeAttackCmod so the prefill and the dropdown onChange
      // stay in lockstep.
      const { net, sources } = computeAttackCmod(chosenTarget, weapon, cmodCtx())
      cmodSourcesRef.current = sources
      setCmod(String(net))
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

  // Emit a one-per-character-per-combat "wound infection warning"
  // banner the first time `targetName` takes WP damage from an
  // attack during combat. Canon (CRB p.114-115): any character who
  // took at least one shot/stab/cut wound during a fight makes a
  // Physicality check post-combat. This row is the GM's reminder.
  //
  // Three-layer dedup:
  //   1. Skip if !combatActive (canon trigger is in-combat only)
  //   2. In-memory ref (woundInfectionLoggedRef) for instant skip on
  //      back-to-back hits in the same render cycle.
  //   3. rollsFeed cross-check - if a wound_infection_warning row for
  //      this character already exists since the most recent
  //      combat_start row, skip. Covers reload-mid-combat: ref is
  //      fresh but the row is in the feed.
  //
  // Only the attacker's client (the one applying damage) calls this;
  // other clients see the row via realtime once it lands.
  async function maybeLogWoundInfection(targetName: string | null | undefined) {
    if (!combatActive) return
    if (!targetName) return
    if (woundInfectionLoggedRef.current.has(targetName)) return
    // Cross-check rollsFeed for a prior warning for this target since
    // the most-recent combat_start. Reload-safe.
    const feed = rollsFeed.rolls
    let combatStartedAt: string | null = null
    for (let i = feed.length - 1; i >= 0; i--) {
      if ((feed[i] as any).outcome === OUTCOME.combat_start) { combatStartedAt = (feed[i] as any).created_at; break }
    }
    const alreadyWarned = feed.some((r: any) =>
      r.outcome === OUTCOME.wound_infection_warning &&
      r.character_name === targetName &&
      (!combatStartedAt || r.created_at >= combatStartedAt)
    )
    if (alreadyWarned) { woundInfectionLoggedRef.current.add(targetName); return }
    // Mark BEFORE the insert so a tight burst of damage events doesn't
    // race a second emit through before the await resolves.
    woundInfectionLoggedRef.current.add(targetName)
    const { error } = await insertRollLog({
      campaign_id: id, user_id: userId,
      character_name: targetName,
      label: `${targetName} is wounded and may have to deal with infection`,
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
      outcome: OUTCOME.wound_infection_warning,
    })
    if (error) {
      console.error('[wound-infection] roll_log insert error:', error.message)
      // Don't roll back the ref - even on insert failure we don't
      // want to spam retries every subsequent hit. Once-per-combat
      // stays.
    }
  }

  async function saveRollToLog(die1: number, die2: number, amod: number, smod: number, cmodVal: number, label: string, characterName: string, isReroll = false, target: string | null = null, damageData?: DamageResult, insightUsed: '3d6' | '+3cmod' | null = null, die3: number | null = null, cmodBreakdown: Array<{ label: string; value: number }> | null = null) {
    // NOTE on 3d6 Insight Die storage: existing convention packs d2+d3 into
    // die2 (so die1+die2+mods = d1+d2+d3+mods - correct total without a
    // schema change). die3 here is the RAW d3 value, stored separately in
    // damage_json.die3 so the renderer can show [d1+(die2-die3)+die3 (insight
    // die)] for the expanded math. Total math stays the same.
    const total = die1 + die2 + amod + smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    // Non-antagonist NPCs never get Insight Dice
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPC = isHighLow && !entries.some(e => e.character.name === characterName)
    const npcTypeForLog = isNPC ? (rosterNpcs.find((n: any) => n.name === characterName)?.npc_type ?? campaignNpcs.find((n: any) => n.name === characterName)?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPC && npcTypeForLog !== 'antagonist')

    // Merge die3 + the itemized CMod breakdown into damage_json (attack rolls
    // already have a damageData; skill rolls typically don't - then damage_json
    // becomes just {die3} / {cmodBreakdown}). null when there's nothing extra,
    // preserving the prior shape.
    const extraJson: Record<string, unknown> = {}
    if (die3 != null) extraJson.die3 = die3
    if (cmodBreakdown && cmodBreakdown.length > 0) extraJson.cmodBreakdown = cmodBreakdown
    const damageJsonOut = (damageData || Object.keys(extraJson).length > 0)
      ? { ...(damageData || {}), ...extraJson }
      : null

    // Stamp the Coord Effort chain id on every roll that belongs to
    // the active chain. The withdraw-retcon handler queries roll_log
    // by this id to find every row needing cmod -= 1 / total -= 1 /
    // outcome recomputed. Chain participants are matched by character
    // name vs participantIds → entries lookup.
    const cef = coordEffortRef.current
    let coordChainId: string | null = null
    if (cef && (cef.isActive || cef.leadRollPending)) {
      const isParticipantRoll = cef.participantIds.some(pid => {
        const ent = entries.find(e => e.character.id === pid)
        return ent?.character.name === characterName
      })
      if (isParticipantRoll) coordChainId = cef.chainId
    }

    await insertRollLog({
      campaign_id: id, user_id: userId, character_name: characterName,
      label: isReroll ? `${label} (Re-roll)` : label,
      die1, die2, amod, smod, cmod: cmodVal, total, outcome, insight_awarded: insightAwarded,
      target_name: target || null,
      damage_json: damageJsonOut,
      // Recorded so the extended log can call out +3 CMod spends
      // (which are otherwise indistinguishable from organic CMod
      // stacks) and 3d6 spends where d2+d3 ≤ 6 (the legacy heuristic
      // misses ~17% of those).
      insight_used: insightUsed,
      coord_chain_id: coordChainId,
    })
    logEvent('roll', { campaign_id: id, label, total, outcome, target, character: characterName })

    return { total, outcome, insightAwarded }
  }

  // Stabilize cascade - runs after the dedicated RollModal resolves a
  // Stabilize attempt. Pulled out of executeRoll 2026-05-20 (Phase 1 of
  // tasks/spec-stabilize-migration.md). Pure-ish: the outcome → state
  // mapping is deterministic via lib/stabilize-helpers, but the DB
  // writes + optimistic-state updates + progression-log append still
  // need the component closure (entries, campaignNpcs, setters,
  // supabase, appendProgressionEntry). Returns the narrative string
  // for the modal banner; null if the target is no longer mortally
  // wounded (race: target died or was healed between dropdown open
  // and roll commit).
  async function runStabilizeCascade(p: {
    medicName: string
    targetName: string
    targetKind: 'pc' | 'npc'
    outcome: string
  }): Promise<string> {
    const { medicName, targetName, targetKind, outcome } = p
    const success = isStabilizeSuccess(outcome)

    if (targetKind === 'pc') {
      const targetEntry = entries.find(e => e.character.name === targetName)
      if (!targetEntry?.liveState || targetEntry.liveState.wp_current !== 0) {
        return `${targetName} is no longer mortally wounded.`
      }
      if (!success) return stabilizeNarrative(false, targetName, 0)
      const phyAmod = targetEntry.character.data?.rapid?.PHY ?? 0
      const incapRounds = rollIncapRounds(phyAmod)
      const { data: stabRows, error: stabErr } = await supabase
        .from('character_states')
        .update({ death_countdown: null, incap_rounds: incapRounds, updated_at: new Date().toISOString() })
        .eq('id', targetEntry.stateId)
        .select('id, death_countdown, incap_rounds')
      if (stabErr) console.error('[stabilize] character_states update error:', stabErr.message)
      else if (!stabRows || stabRows.length === 0) console.error('[stabilize] SILENT RLS FAIL - stabilize did not persist for', targetName, '- Run sql/character-states-rls-fix.sql.')
      setEntries(prev => prev.map(e =>
        e.stateId === targetEntry.stateId
          ? { ...e, liveState: { ...e.liveState, death_countdown: null, incap_rounds: incapRounds } as any }
          : e,
      ))
      if (targetEntry.character?.id) void appendProgressionLog(targetEntry.character.id, 'wound', `🩸 Stabilized by ${medicName}.`)
      return stabilizeNarrative(true, targetName, incapRounds)
    }

    // NPC branch
    const targetNpc = campaignNpcs.find((n: any) => n.name === targetName)
    if (!targetNpc) return `${targetName} not found.`
    const npcWp = (targetNpc as any).wp_current ?? (targetNpc as any).wp_max ?? 10
    if (npcWp !== 0) return `${targetName} is no longer mortally wounded.`
    if (!success) return stabilizeNarrative(false, targetName, 0)
    const npcPhyAmod = (targetNpc as any).physicality ?? 0
    const incapRounds = rollIncapRounds(npcPhyAmod)
    const { data: nstabRows, error: nstabErr } = await supabase
      .from('campaign_npcs')
      .update({ death_countdown: null, incap_rounds: incapRounds })
      .eq('id', (targetNpc as any).id)
      .select('id, death_countdown, incap_rounds')
    if (nstabErr) console.error('[stabilize] campaign_npcs update error:', nstabErr.message)
    else if (!nstabRows || nstabRows.length === 0) console.error('[stabilize] SILENT RLS FAIL - NPC stabilize did not persist for', targetName)
    const npcPatch = { death_countdown: null, incap_rounds: incapRounds }
    setCampaignNpcs(prev => prev.map(n => n.id === (targetNpc as any).id ? { ...n, ...npcPatch } : n))
    setRosterNpcs(prev => prev.map(n => n.id === (targetNpc as any).id ? { ...n, ...npcPatch } : n))
    setViewingNpcs(prev => prev.map(n => n.id === (targetNpc as any).id ? { ...n, ...npcPatch } as CampaignNpc : n))
    return stabilizeNarrative(true, targetName, incapRounds)
  }

  // Distract cascade - runs after the dedicated Distract <RollModal>
  // resolves. Phase 2 of tasks/spec-stabilize-migration.md (2026-05-20).
  // Applies the action-delta to the target's initiative_order row +
  // fires the turn_changed broadcast so all clients refresh. Returns
  // the narrative for the modal banner. Per CRB §06: WS/HI = -2, S =
  // -1, F/LI = no-op (cost only), DF = +1 ("Inspired").
  async function runDistractCascade(p: {
    targetEntryId: string
    targetName: string
    outcome: string
  }): Promise<string> {
    const { targetEntryId, targetName, outcome } = p
    const delta = distractActionDelta(outcome)
    if (delta === 0) {
      return distractNarrative(targetName, 0, false)
    }
    // Fetch fresh actions_remaining - the optimistic state in
    // initiativeOrder can be stale if other rolls have fired in
    // parallel. Matches the legacy executeRoll pattern of reading off
    // initiativeOrder.find() (page.tsx L6174-6176 pre-migration).
    const targetEntry = initiativeOrder.find(e => e.id === targetEntryId)
    if (!targetEntry) {
      // Race: target left initiative (death, despawn). No-op narrative.
      return distractNarrative(targetName, 0, false)
    }
    const cur = targetEntry.actions_remaining ?? 0
    const newActions = Math.max(0, cur + delta)
    const { data: distractRows, error: distractErr } = await supabase
      .from('initiative_order')
      .update({ actions_remaining: newActions })
      .eq('id', targetEntryId)
      .select('id, actions_remaining')
    if (distractErr) {
      console.error('[distract] update error:', distractErr.message)
      return distractNarrative(targetName, 0, false)
    }
    if (!distractRows || distractRows.length === 0) {
      console.error('[distract] SILENT RLS FAIL - target actions_remaining not updated. Run sql/initiative-order-rls-members-write.sql.')
      return distractNarrative(targetName, 0, false)
    }
    // Broadcast turn_changed so all clients refresh immediately even
    // if the postgres_changes UPDATE is delayed.
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
    return distractNarrative(targetName, delta, true)
  }

  // executeRoll (the ~1810-line roll/combat resolution engine) was extracted to
  // hooks/useRollResolution.ts (3c-B3, behavior-preserving). syncedSelectedEntry is
  // hoisted up from its original spot below so the deps bundle has it in scope here.
  const syncedSelectedEntry = selectedEntry ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry : null
  const { executeRoll } = useRollResolution({
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
  })

  async function spendInsightDie(rerollDie: 'die1' | 'die2' | 'both') {
    if (!rollResult || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    if (!myEntry?.liveState) return

    const cost = rerollDie === 'both' ? 2 : 1
    if (myEntry.liveState.insight_dice < cost) return

    setRolling(true)

    const newInsight = myEntry.liveState.insight_dice - cost
    await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)

    const newDie1 = rerollDie === 'die2' ? rollResult.die1 : rollD6()
    const newDie2 = rerollDie === 'die1' ? rollResult.die2 : rollD6()
    const rerollLabelParts = rollResult.label.split(' - ')
    const characterName = rerollLabelParts.length > 1 ? rerollLabelParts[0] : (myEntry.character.name ?? 'Unknown')

    // Pre-compute outcome WITHOUT writing the log yet - the original code
    // saved once now, then again at the bottom with damage_json populated,
    // which produced two duplicate log rows for any successful reroll
    // (visible doubling in the feed). We now compute outcome inline,
    // run the damage pass, then call saveRollToLog ONCE with the damage
    // data attached. saveRollToLog returns insightAwarded so we still
    // bump insight_dice when applicable.
    const total = newDie1 + newDie2 + rollResult.amod + rollResult.smod + rollResult.cmod
    const outcome = getOutcome(total, newDie1, newDie2)

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
        if (finalWP > 0) pendingWoundInfectionRef.current.add(targetEntry.character.name)
        const tNewWP = Math.max(0, targetEntry.liveState.wp_current - finalWP)
        const tNewRP = Math.max(0, targetEntry.liveState.rp_current - finalRP)
        const update: any = { wp_current: tNewWP, rp_current: tNewRP, updated_at: new Date().toISOString() }
        let rerollStressReason: string | null = null
        if (tNewWP === 0 && targetEntry.liveState.wp_current > 0) {
          update.death_countdown = mortalWoundCountdown(targetEntry.character.data?.rapid?.PHY ?? 0)
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
          await insertRollLog({
            campaign_id: id, user_id: userId, character_name: 'System',
            label: `😰 ${targetEntry.character.name} gains a Stress from being ${rerollStressReason}`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.stress,
          })
        }
      } else if (targetNpcObj) {
        if (finalWP > 0) pendingWoundInfectionRef.current.add(targetNpcObj.name)
        const tNpcWP = targetNpcObj.wp_current ?? targetNpcObj.wp_max ?? 10
        const tNpcRP = targetNpcObj.rp_current ?? targetNpcObj.rp_max ?? 6
        const tNewWP = Math.max(0, tNpcWP - finalWP)
        const tNewRP = Math.max(0, tNpcRP - finalRP)
        const npcUpdate: any = { wp_current: tNewWP, rp_current: tNewRP }
        if (tNewWP === 0 && tNpcWP > 0) npcUpdate.death_countdown = mortalWoundCountdown(targetNpcObj.physicality ?? 0)
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

    }

    // Single save for the reroll - carries damage_json when applicable.
    // Was: two saves (one without damage at the top, one with damage here)
    // produced duplicate roll_log rows on every successful reroll. The
    // duplicated entries visibly doubled the feed; the second row often
    // confused the prefix-strip in the expanded render too.
    const { insightAwarded } = await saveRollToLog(newDie1, newDie2, rollResult.amod, rollResult.smod, rollResult.cmod, rollResult.label, characterName, true, targetName || null, rerollDamage)
    if (insightAwarded) {
      await supabase.from('character_states').update({ insight_dice: newInsight + 1, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }
    // Drain queued wound-infection warnings - reroll-path parallel of
    // the executeRoll drain (see comment there). Warning row's
    // created_at lands after the reroll's saveRollToLog completes.
    if (pendingWoundInfectionRef.current.size > 0) {
      const names = Array.from(pendingWoundInfectionRef.current)
      pendingWoundInfectionRef.current.clear()
      for (const n of names) await maybeLogWoundInfection(n)
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
    // was actually executed - rollResult state can be stale in closures.
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
    // Snapshot the roller's initiative id BEFORE clearing pendingRoll - the
    // consume-gate logic below needs it to decide whether this roll cost
    // an action off the active combatant. Null means "out of combat" or
    // "no roller could be resolved"; either way, no consume.
    const rollerInitId = pendingRoll?.rollerInitId ?? null
    const wasWeaponAttack = !!pendingRoll?.weapon
    setPendingRoll(null)
    setRollResult(null)

    trace('closeRollModal', {
      gate: true,
      didRoll,
      combatActive,
      preConsumed,
      cost,
      rollerInitId,
      wasWeaponAttack,
    })
    // Consume action(s) if a roll was actually executed.
    // Skip if the action was already pre-consumed (Stabilize/Unjam) OR
    // if the roller is NOT the active combatant (out-of-turn check, no
    // action cost - the 2026-05-10 turn-gate removal allows any
    // character at /table to fire any check, but action accounting
    // must stay tied to the active combatant).
    if (didRoll && combatActive && !preConsumed) {
      // Re-fetch active entry from DB to avoid stale closure state
      const { data: freshOrder, error: foErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).eq('is_active', true).limit(1)
      if (foErr) console.error('[closeRollModal] active fetch error:', foErr.message)
      const activeEntry = freshOrder?.[0]
      trace('closeRollModal', {
        activeEntry: true,
        name: activeEntry?.character_name,
        actions_remaining: activeEntry?.actions_remaining,
        user_id: activeEntry?.user_id,
        me: userId,
        isGM,
        is_npc: activeEntry?.is_npc,
      })
      if (activeEntry) {
        // Only consume if the roller is the active combatant. Out-of-turn
        // checks are free.
        const rollerIsActive = rollerInitId != null && rollerInitId === activeEntry.id
        trace('closeRollModal', { rollerIsActive, roller: rollerInitId, active: activeEntry.id })
        if (rollerIsActive) {
          // Track last attack target for same-target +1 CMod bonus AND
          // for pre-selecting the same target on the next Attack modal
          // (playtest: "the next time they attack the Attack Modal should
          // automatically select the same target a second time").
          if (wasWeaponAttack && targetName) {
            await supabase.from('initiative_order').update({ last_attack_target: targetName }).eq('id', activeEntry.id)
            // Clear any stale map-click target so the next Attack modal
            // open falls through to `last_attack_target` (the just-
            // attacked target) instead of re-using whatever token the
            // player happened to click on the map before rolling.
            setSelectedMapTargetName(null)
          }
          await consumeAction(activeEntry.id, undefined, cost)
        } else {
          trace('closeRollModal', { note: 'out-of-turn check - no action consumed', roller: rollerInitId, active: activeEntry.id })
        }
      } else {
        trace('closeRollModal', { note: 'no active entry found' })
      }
    }
    // Drain the wound-infection check queue (populated by endCombat).
    // Whether the player rolled or cancelled, advance to the next
    // wounded character. setTimeout 0 yields to React so the current
    // modal state fully tears down before the next modal opens -
    // without it the second modal can inherit pendingRoll = null
    // before handleRollRequest's setPendingRoll lands.
    if (pendingInfectionChecksRef.current.length > 0) {
      const next = pendingInfectionChecksRef.current.shift()!
      setTimeout(() => {
        handleRollRequest(`${next.name} - Infection Check (Wound)`, next.amod, 0)
      }, 0)
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function getCharPhoto(entry: TableEntry): string | null {
    return entry.character?.data?.photoDataUrl ?? null
  }

  if (loading || !campaign) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif', color: '#cce0f5', background: '#0f0f0f' }}>
      Loading The Table...
    </div>
  )

  // Header cascade renderer. Hover the trigger → sub-items unfold
  // inline to the right as sibling pill buttons. Click the trigger
  // also toggles (for touch/keyboard). Each sub-item keeps the same
  // pill style with its own text color; only the trigger has the
  // chevron. No dropdown panel - feels like the buttons are physically
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
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', zIndex: isOpen ? 10100 : undefined }}>
        <button onClick={() => {
          // Clicking the trigger toggles a pinned state - stays open
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
            // `top: 100%` + `paddingTop: 4px` closes the hover gap -
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
    // Order rule (per Xero 2026-05-18): currently-online players sit
    // closest to the GM, offline players after. `onlineUserIds` is a
    // React-state Set populated by the table-page presence channel
    // (the same source that drives the green border at L9082-9083),
    // so this reorders live as players join/leave. Stable sort by
    // online-bit only - within each group the underlying `entries`
    // order (≈ campaign join order) is preserved.
    const sorted = [...filtered].sort((a, b) => {
      const aOnline = onlineUserIds.has(a.userId) ? 1 : 0
      const bOnline = onlineUserIds.has(b.userId) ? 1 : 0
      return bOnline - aOnline
    })
    // Float the current viewer's own character to position 0 (right
    // next to GM). Applies only to non-GM viewers (the GM was filtered
    // out above, so meIdx is -1 for them and this is a no-op).
    if (!userId) return sorted
    const meIdx = sorted.findIndex(e => e.userId === userId)
    if (meIdx <= 0) return sorted
    return [sorted[meIdx], ...sorted.slice(0, meIdx), ...sorted.slice(meIdx + 1)]
  })()
  const myEntry = entries.find(e => e.userId === userId) ?? null
  const myInsightDice = myEntry?.liveState?.insight_dice ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Carlito, sans-serif', background: '#0f0f0f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, background: '#0f0f0f', position: 'relative', zIndex: 10001 }}>
        <div>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
            {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'GM View' : 'Player View'}
          </div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}>
            {campaign.name}
          </div>
        </div>
        {gmLike && sessionStatus === 'idle' && (
          <button onClick={startSession} disabled={sessionActing}
            className="hdr-btn"
            style={{ ...hdrBtn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: sessionActing ? 0.5 : 1, cursor: sessionActing ? 'not-allowed' : 'pointer' }}>
            {sessionActing ? 'Starting...' : 'Start Session'}
          </button>
        )}
        {/* Recorder toggle - TEMP WIDENED to all signed-in users
            (2026-05-17, Xero) so playtesters can capture sessions
            during the MINNIE module shake-down. Revert to `isThriver`
            before going live. Default (locked) shape:
              {isThriver && ( ... )}
            The recorder is otherwise an internal QA tool for the
            Tapestry team, not a campaign mechanic. Lives on the
            table page so the user never leaves the session tab -
            closing the session tab kills its localStorage-backed
            recorder buffer before any auto-download can fire. */}
        {/* GM-CASCADE (2026-05-18): Record button is GM-only. GM's
            click broadcasts recorder_start / recorder_stop to every
            connected player tab via initChannelRef, which flips each
            tab's capture flag + persists to localStorage. Removes the
            Alex-failure-mode where a player could hit Stop without
            ever hitting Start and dump an empty recording. Players
            still have Ctrl+Shift+L for ad-hoc dumps. */}
        {gmLike && (
          <button onClick={toggleRecorder} disabled={recorderToggling}
            className="hdr-btn"
            title={recorderEnabled ? 'Stop recording - every connected player tab auto-downloads its buffer' : 'Start recording - every connected player tab wipes its buffer and captures fresh'}
            style={{ ...hdrBtn(recorderEnabled ? '#2a1210' : '#242424', recorderEnabled ? '#f5a89a' : '#d4cfc9', recorderEnabled ? '#c0392b' : '#3a3a3a'), opacity: recorderToggling ? 0.5 : 1, cursor: recorderToggling ? 'not-allowed' : 'pointer' }}>
            {recorderToggling ? '...' : recorderEnabled ? '⏺ Stop Recording' : '⏺ Record'}
          </button>
        )}
        {gmLike && sessionStatus === 'active' && (
          <button onClick={async () => {
            // Fetch any submitted player notes so the GM sees them in the modal.
            // Only pull notes that were written DURING this session - notes from
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
        {gmLike && !combatActive && (
          <button onClick={() => { setShowTacticalMap(prev => !prev); refreshMapTokenIds() }}
            className={`hdr-btn${showTacticalMap ? ' hdr-btn--active' : ''}`}
            style={hdrBtn(showTacticalMap ? '#2a1210' : '#242424', showTacticalMap ? '#f5a89a' : '#d4cfc9', showTacticalMap ? '#c0392b' : '#3a3a3a')}>
            {showTacticalMap ? 'Campaign Map' : 'Tactical Map'}
          </button>
        )}
        {!gmLike && !combatActive && (
          <button onClick={() => { setShowTacticalMap(prev => !prev); if (tacticalShared) setTacticalShared(false) }}
            className={`hdr-btn${showTacticalMap ? ' hdr-btn--active' : ''}`}
            style={hdrBtn(showTacticalMap ? '#2a1210' : '#242424', showTacticalMap ? '#f5a89a' : '#d4cfc9', showTacticalMap ? '#c0392b' : '#3a3a3a')}>
            {showTacticalMap ? 'Campaign Map' : 'Tactical Map'}
          </button>
        )}
        {gmLike && showTacticalMap && !combatActive && (
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
        {gmLike && showTacticalMap && (
          // Map Setup - replaces the old inline 130px scene-controls
          // sidebar. Pops out the controls panel into its own browser
          // window so the GM can park it on a 2nd monitor and let the
          // tactical map fill the full table-page width. State syncs
          // between popout and main window via BroadcastChannel -
          // see lib/scene-controls-bus.ts.
          <button onClick={() => openPopout(`/scene-controls-popout?c=${id}`, `scene-controls-${id}`, { w: 250, h: 600 })}
            className="hdr-btn"
            style={hdrBtn('#2a1a3e', '#c4a7f0', '#5a2e5a')}>
            Map Setup
          </button>
        )}
        {gmLike && sessionStatus === 'active' && !combatActive && (
          <button onClick={startCombat} disabled={startingCombat}
            className="hdr-btn"
            style={{ ...hdrBtn('#7a1f16', '#f5a89a', '#c0392b'), opacity: startingCombat ? 0.5 : 1, cursor: startingCombat ? 'not-allowed' : 'pointer' }}>
            {startingCombat ? 'Rolling...' : '⚔️ Start Combat'}
          </button>
        )}
        {gmLike && combatActive && (
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
            { label: 'Perception', onClick: () => startSpecialCheckPerception() },
            { label: 'Gut Instinct', onClick: () => startSpecialCheckGut() },
            { label: 'First Impression', onClick: () => setShowSpecialCheck('first_impression' as any) },
            { label: 'Recruit', onClick: () => openRecruitModal() },
            { label: 'Group Check', onClick: () => setShowSpecialCheck('group' as any) },
            { label: 'Coordinated Effort', onClick: () => setShowSpecialCheck('coordinated_effort' as any) },
            { label: 'Heal', onClick: () => setShowSpecialCheck('heal' as any) },
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
            // Apprentice placeholder - the apprentice card / picker UI isn't
            // wired yet. Menu entry reserved so the nav slot lands now and
            // the feature can drop in without a menu reshuffle later.
            { label: 'Apprentice', onClick: () => alert('Apprentice view coming soon - for now, see the Apprentice NPC inside the Community roster (look for ⇐ <your PC name>).') },
            // Dashboard - full-screen GM view with Morale history,
            // resource log, role distribution, recruitment stats.
            // Route: /stories/<id>/community. GM-only gated inside
            // the page itself (non-GMs see an access-denied block).
            { label: 'Dashboard', onClick: () => window.open(`/stories/${id}/community`, '_blank', 'noopener,noreferrer'), hidden: !gmLike },
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
              // Header dropdowns navigate to other pages in a new tab so the
              // GM doesn't lose the live table session. DASHBOARD + EXIT are
              // intentionally left as same-tab in the header bar - Exit is
              // an explicit "leave the table" affordance, Dashboard already
              // uses target="_blank" on its anchor.
              onClick: () => window.open(`/stories/${id}/sessions`, '_blank', 'noopener,noreferrer'),
            },
            {
              label: 'Stories',
              onClick: () => window.open(`/stories/${id}`, '_blank', 'noopener,noreferrer'),
            },
            {
              // Campaign Sheet popout - clock, timeline, party
              // status, vehicles, pending heals. GM gets the
              // advance-time + queue-effect controls; players see
              // everything read-only plus a Discharge Stress button
              // (Phase 3 wiring).
              label: 'Campaign Sheet',
              onClick: () => openPopout(`/campaign-sheet?c=${id}`, `campaign-sheet-${id}`, { w: 900, h: 800 }),
            },
          ],
          hdrBtn('#1a1a2e', '#7ab3d4', '#2e2e5a'),
        )}
        {gmLike && renderHeaderMenu(
          'gm_tools',
          'GM Tools',
          [
            {
              // GM Notes popout - comprehensive story overview window:
              // plot beats, scenes, NPC list, pins. Same popout the
              // GM Notes button on /stories/[id] opens. Lives in GM
              // Tools so the GM can pop it open mid-session without
              // navigating off /table.
              label: 'GM Notes',
              onClick: () => {
                const w = 980, h = 800
                window.open(`/gm-notes-popout?c=${id}`, `gm-notes-${id}`,
                  `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`)
              },
            },
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
                // Fetch destructible scene_tokens from the DB directly - mapTokens
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
              // Reload - pick a campaign_snapshot and restore it in place.
              // Quick "rewind the scene" affordance for GMs running scenarios
              // they've snapshotted; the full Snapshots admin page is still
              // available via the campaign edit screen for save / download /
              // delete / import.
              label: 'Reload',
              onClick: async () => {
                const { data } = await supabase
                  .from('campaign_snapshots')
                  .select('id, name, description, includes_character_states, created_at, snapshot')
                  .eq('campaign_id', id)
                  .order('created_at', { ascending: false })
                setReloadSnapshots((data ?? []) as any)
                setShowReloadPicker(true)
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
              // Grant Advantage - post-playtest task #11. Opens a dialog
              // where the GM picks a PC + skill + CMod amount +
              // description. Result lands as a pending row in the
              // advantages table (see lib/advantages.ts).
              label: '⭐ Grant Advantage',
              onClick: () => {
                setGrantPcId(entries[0]?.character.id ?? '')
                setGrantSkill('')
                setGrantCmod(1)
                setGrantDescription('')
                setGrantSourceRollLogId(null)   // free-form path A1
                setGrantError(null)
                setShowGrantAdvantage(true)
              },
            },
            {
              label: 'Populate',
              onClick: () => { setPopulateCount(5); setShowPopulateModal(true) },
            },
            {
              // Tick overencumbered characters per house-rule: -1 RP per
              // hour over the limit until they rest or drop something.
              label: 'Time',
              onClick: () => { setAdvanceTimeHours(1); setShowAdvanceTimeModal(true) },
            },
            {
              label: 'GM Screen',
              onClick: () => openPopout(`/gm-screen?c=${id}`, `gm-screen-${id}`, { w: 900, h: 700 }),
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

      {/* Incapacitation banner - playtest #21.
          Shown to a PLAYER (not GM) when their own PC is mortally wounded
          (wp=0 with a countdown) or incapacitated (rp=0 while wp>0). Tells
          them plainly what happened, what they can still do (watch the
          map, whisper the GM, wait for stabilization / revival), and
          what they CAN'T do (take actions). Banner is dismissible only
          by restoring the PC. Hidden when the PC is fully dead (countdown
          expired) since that's a different ending. */}
      {!gmLike && combatActive && (() => {
        const myEntry = entries.find(e => e.userId === userId)
        if (!myEntry?.liveState) return null
        const ls = myEntry.liveState as any
        const isDead = ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown <= 0
        const isMortal = ls.wp_current === 0 && !isDead
        const isUnconscious = ls.rp_current === 0 && ls.wp_current > 0
        if (isDead || (!isMortal && !isUnconscious)) return null
        const title = isMortal ? 'Mortally Wounded' : 'Incapacitated'
        const subtitle = isMortal
          ? `You're bleeding out - someone needs to Stabilize you within ${ls.death_countdown ?? '?'} round${ls.death_countdown === 1 ? '' : 's'} or you die.`
          : 'You\'re unconscious - you can\'t take actions until you come to (rest, first aid, or an ally\'s Medicine check).'
        return (
          <div style={{ background: '#2a1210', borderBottom: '1px solid #c0392b', padding: '8px 16px', fontFamily: 'Carlito, sans-serif', color: '#f5a89a', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a' }}>🩸 {title}</div>
            <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>{subtitle}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>You can still watch the map, whisper the GM, and read the log.</div>
          </div>
        )
      })()}
      {/* Coordinated Effort active banner - visible while a chain is in
          flight, shows the current leadCmod + count of participants,
          and an End button to terminate the chain. tick state forces
          a re-render when the ref changes. */}
      {(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = coordEffortTick
        const cef = coordEffortRef.current
        if (!cef || !cef.isActive) return null
        const coordBonus = cef.totalParticipants - 1
        const sign = cef.leadCmod >= 0 ? '+' : ''
        return (
          <div style={{ background: '#0f1a2e', borderBottom: '1px solid #2d5a1b', padding: '8px 16px', fontFamily: 'Carlito, sans-serif', color: '#7fc458', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>🤝 Coordinated Effort active</span>
              <span style={{ fontSize: '13px', color: '#cce0f5', marginLeft: '10px' }}>
                Every participant&apos;s roll gets <span style={{ color: '#7fc458', fontWeight: 700 }}>+{coordBonus} (coord)</span>
                {cef.leadCmod !== 0 && <> + <span style={{ color: cef.leadCmod > 0 ? '#7fc458' : '#EF9F27', fontWeight: 700 }}>{sign}{cef.leadCmod} (lead)</span></>}
                {' '}= <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{sign}{coordBonus + cef.leadCmod} CMod</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Per-participant Withdraw chips. One per character
                  still in the chain. Click → retcon every other
                  participant's logged rolls by -1 CMod / -1 total /
                  outcome recomputed (Option B locked 2026-05-17).
                  Should rarely fire - canon expects committed chains
                  to ride to the end - but GM + table consensus can
                  force it. */}
              {cef.participantIds.map(pid => {
                const ent = entries.find(e => e.character.id === pid)
                if (!ent) return null
                return (
                  <button key={pid} onClick={() => withdrawFromCoordinatedEffort(pid)}
                    title={`Withdraw ${ent.character.name} from the chain - retcons everyone else's already-rolled CMod by -1`}
                    style={{ padding: '4px 8px', background: '#2a1210', border: '1px solid #5a3a3a', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    🚪 {ent.character.name}
                  </button>
                )
              })}
              <button onClick={endCoordinatedEffort}
                style={{ padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                End Effort
              </button>
            </div>
          </div>
        )
      })()}

      {/* Initiative Tracker - shown when combat is active */}
      {combatActive && (
        <div style={{ borderBottom: '1px solid #2e2e2e', background: '#0d0d0d', padding: '8px 12px', flexShrink: 0 }}>
          <InitiativeBar
            initiativeOrder={initiativeOrder}
            entries={entries}
            campaignNpcs={campaignNpcs}
            userId={userId}
            isGM={gmLike}
            entrySceneTags={entrySceneTags}
            onNextTurn={nextTurn}
            onDefer={deferInitiative}
            onRemove={handleInitiativeBarRemove}
            onAddPCToCombat={addPCToCombat}
            onAddNPC={addNPC}
            onGrantAction={handleGrantAction}
            onSkipTurn={handleSkipTurn}
            combatRound={combatRound}
          />
          {/* Action buttons - shown for active combatant or GM */}
          {(() => {
            const activeEntry = initiativeOrder.find(e => e.is_active)
            if (!activeEntry || (activeEntry.actions_remaining ?? 0) <= 0) return null
            const myChar = entries.find(e => e.userId === userId)
            const isMyTurn = !!(activeEntry.character_id && myChar && activeEntry.character_id === myChar.character.id)
            const canAct = isMyTurn || gmLike
            if (!canAct) return null

            // Determine combatant's weapon for conditional buttons
            const charEntry = entries.find(e => e.character.name === activeEntry.character_name)
            const npcForWeapon = activeEntry.is_npc ? campaignNpcs.find((n: any) => n.name === activeEntry.character_name) : null
            const weaponData = charEntry?.character.data?.weaponPrimary ?? (npcForWeapon?.skills?.weapon ? { weaponName: npcForWeapon.skills.weapon.weaponName, condition: 'Used' } : null)
            const w = weaponData ? getWeaponByName(weaponData.weaponName) : null
            const hasBurst = w ? getTraitValue(w.traits, 'Automatic Burst') !== null : false
            const isMelee = w?.category === 'melee'
            // Ammo gate - block the Attack button on ranged weapons
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
            const outOfAmmo = !!w && !isMelee && !!w.clip && w.clip > 0 && w.category !== 'explosive' && ammoCurrent !== null && ammoCurrent <= 0
            // Explosive throw gate - explosives are one-use consumables tracked
            // by qty on the slot (not the clip/ammo system). Block the throw when
            // the carry count hits 0, mirroring the ammo gate. Legacy explosives
            // with no qty set default to throwable (treated as 1 remaining).
            const throwQty: number | null =
              charEntry?.character.data?.weaponPrimary?.qty ??
              npcForWeapon?.skills?.weapon?.qty ??
              null
            const outOfThrows = !!w && w.category === 'explosive' && throwQty !== null && throwQty <= 0
            const has2Actions = (activeEntry.actions_remaining ?? 0) >= 2
            const isGrappled = !!activeEntry.grappled_by
            const isGrappling = initiativeOrder.some(e => e.grappled_by === activeEntry.character_name)
            const grappledTarget = isGrappling ? initiativeOrder.find(e => e.grappled_by === activeEntry.character_name) : null

            const actBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              padding: '2px 8px', background: bg, border: `1px solid ${border}`, borderRadius: '3px',
              color, fontSize: '13px', fontFamily: 'Carlito, sans-serif',
              letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer',
            })

            const disabledBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              ...actBtn(bg, color, border), opacity: 0.3, cursor: 'not-allowed',
            })

            return (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                {/* ── GRAPPLED STATE: only Break Free available ── */}
                {isGrappled && (
                  <>
                    <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '3px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                      Grappled by {activeEntry.grappled_by}
                    </span>
                    <button onClick={() => { setGrappleResult(null); setShowGrappleModal(true) }}
                      style={actBtn('#2a2010', '#EF9F27', '#5a4a1b')}>Break Free</button>
                  </>
                )}
                {/* ── GRAPPLING STATE: only Release available ── */}
                {isGrappling && grappledTarget && (
                  <>
                    <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                      Grappling {grappledTarget.character_name}
                    </span>
                    <button onClick={async () => {
                      await supabase.from('initiative_order').update({ grappled_by: null }).eq('id', grappledTarget.id)
                      await insertRollLog({
                        campaign_id: id, user_id: userId, character_name: activeEntry.character_name,
                        label: `${activeEntry.character_name} released ${grappledTarget.character_name}`,
                        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.action,
                      })
                      await loadInitiative(id)
                    }}
                      style={actBtn('#1a1a2e', '#7ab3d4', '#2e2e5a')}>Release</button>
                  </>
                )}
                {/* ── Normal combat actions (hidden when grappled/grappling) ── */}
                {!isGrappled && !isGrappling && <>
                {/* Buttons are in alphabetical order per Xero's request:
                    Aim, Attack, Charge, Coordinate, Cover Fire, Defend,
                    Distract, Fire from Cover, Grapple, Inspire, Move,
                    Rapid Fire, Ready Weapon, Reposition, Sprint, Subdue,
                    Take Cover, Unarmed. Modals (Social picker / Coordinate)
                    live at the bottom - they're absolutely-positioned
                    overlays so render order doesn't affect layout. */}

                {/* ── AIM: +2 CMod, must Attack next or lost ── */}
                <button onClick={() => handleAim(activeEntry.id)}
                  style={actBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
                  Aim{(activeEntry.aim_bonus ?? 0) > 0 ? ` (+${activeEntry.aim_bonus})` : ''}
                </button>
                {activeEntry.aim_active && <span style={{ fontSize: '13px', padding: '1px 6px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '2px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Aimed - Attack or lose it</span>}

                {/* ── ATTACK: weapon attack, +1 CMod if same target as last attack ── */}
                <button onClick={() => {
                  if (!w || !weaponData) { alert('No weapon readied.'); return }
                  if (outOfAmmo) { alert(`${w.name} is empty. Reload via Ready Weapon before firing again.`); return }
                  if (outOfThrows) { alert(`${w.name} - none left to throw.`); return }
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
                    // Faction-aware friendly list (SMOKE-3). The warning
                    // must only fire for ACTUAL friendly fire - hitting your
                    // OWN side. A PC thrower's side is the other PCs; an NPC
                    // thrower's side is the other NPCs. We populate only the
                    // list matching the thrower's faction and leave the other
                    // empty, so a grenade landing on the OPPOSING faction
                    // (an NPC's PCs, a PC's NPCs) is intended damage and never
                    // prompts. The thrower themselves is excluded from the
                    // friendly list (their own PHY-mitigated splash is shown
                    // separately as a (YOU) self-hit tag by TacticalMap).
                    const hasBlast = (w.traits ?? []).some((t: string) => t.startsWith('Blast Radius'))
                    const attackerIsNpc = !!activeEntry.npc_id
                    const friendlyCharacterIds = attackerIsNpc
                      ? []
                      : entries.map(e => e.character.id).filter(cid => cid !== activeEntry.character_id)
                    const friendlyNpcIds = attackerIsNpc
                      ? campaignNpcs.map((n: any) => n.id).filter((nid: string) => nid !== activeEntry.npc_id)
                      : []
                    setThrowMode({
                      attackerCharId: activeEntry.character_id,
                      attackerNpcId: activeEntry.npc_id,
                      weapon: weaponCtx,
                      amod, smod, rangeFeet,
                      label: `${activeEntry.character_name} - Attack (${w.name})`,
                      hasBlast,
                      friendlyCharacterIds,
                      friendlyNpcIds,
                    })
                    return
                  }
                  handleRollRequest(`${activeEntry.character_name} - Attack (${w.name})`, amod, smod, weaponCtx)
                }}
                  style={(w && !outOfAmmo && !outOfThrows) ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}
                  disabled={!w || outOfAmmo || outOfThrows}
                  title={outOfAmmo ? `${w?.name ?? 'Weapon'} is empty - Reload via Ready Weapon` : outOfThrows ? `${w?.name ?? 'Weapon'} - none left to throw` : undefined}>
                  Attack{w ? ` (${w.name})` : ''}{outOfAmmo ? ' - empty, Reload' : ''}{outOfThrows ? ' - none left' : ''}
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
                      pendingChargeRef.current = { label: `${activeEntry.character_name} - Charge (${chargeWName})`, amod, smod, weapon: { weaponName: chargeWName, damage: chargeWDmg, rpPercent: chargeWRp, conditionCmod: 0, traits: chargeW?.traits ?? [] }, activeId: activeEntry.id }
                      setMoveMode({ characterId: activeEntry.character_id || undefined, npcId: activeEntry.npc_id || undefined, feet: 20 })
                    } : undefined} disabled={!has2Actions}
                      style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Charge</button>
                  )
                })()}

                {/* ── COORDINATE ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); setShowCoordinateModal(true); setCoordinateSelection('') }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Coordinate</button>

                {/* ── COVER FIRE - opens social-target picker (no roll, auto-applies) ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); setSocialTarget(socialTarget?.action === 'Cover Fire' ? null : { action: 'Cover Fire' }) }}
                  style={actBtn(socialTarget?.action === 'Cover Fire' ? '#1a2e10' : '#242424', socialTarget?.action === 'Cover Fire' ? '#7fc458' : '#d4cfc9', socialTarget?.action === 'Cover Fire' ? '#2d5a1b' : '#3a3a3a')}>Cover Fire</button>

                {/* ── DEFEND: +2 defensive modifier for next incoming attack ── */}
                <button onClick={async () => {
                  clearAimIfActive(activeEntry.id)
                  await supabase.from('initiative_order').update({ defense_bonus: (activeEntry.defense_bonus ?? 0) + 2 }).eq('id', activeEntry.id)
                  await consumeAction(activeEntry.id, `${activeEntry.character_name} - Defend (+2 Defensive Modifier, next attack only)`)
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Defend{(activeEntry.defense_bonus ?? 0) > 0 ? ` (+${activeEntry.defense_bonus})` : ''}</button>

                {/* ── DICE CHECK: SRD §06 18th action - pop the active combatant's
                    sheet so the player can roll any attribute / skill. The roll
                    flow off the sheet already routes through handleRollRequest
                    + closeRollModal, which consumes 1 action on commit. No
                    pre-consume here - opening the sheet without rolling costs
                    nothing. ── */}
                <button onClick={() => {
                  if (activeEntry.is_npc) {
                    const npc = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
                    if (npc) setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev : [...prev, npc as CampaignNpc])
                  } else {
                    const pc = entries.find(e =>
                      activeEntry.character_id ? e.character.id === activeEntry.character_id : e.character.name === activeEntry.character_name
                    )
                    if (pc) { setSelectedEntry(pc); setViewingNpcs([]); setSheetPos(null) }
                  }
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Dice Check</button>

                {/* ── DISTRACT: dedicated <RollModal> (Phase 2 migration,
                    2026-05-20). Same Close-range + alive-target filter
                    as before; the candidates list, mods, and preselect
                    are computed here on click, then passed into
                    setDistractPending(...) which mounts the dedicated
                    modal. Cover Fire + Inspire still use the
                    socialTarget picker because they don't fire a roll
                    (they auto-apply effects). ── */}
                <button onClick={() => {
                  clearAimIfActive(activeEntry.id)
                  // Compute Distract roll mods from the active combatant.
                  // Per CRB: Intimidation / Inspiration / Tactics* /
                  // Psychology* - take the highest level. ("Tactical*"
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
                  // Reset prior modal state then mount the new modal.
                  // Action NOT pre-consumed - the modal's onRoll runs
                  // consumeAction synchronously before the dice fire so
                  // the action debit can't slip through if the modal
                  // closes mid-flow.
                  setDistractCmod(0)
                  setDistractResult(null)
                  setDistractNarrativeText('')
                  setDistractTargetName(preselect ?? '')
                  setDistractPending({
                    rollerEntryId: activeEntry.id,
                    rollerName: activeEntry.character_name,
                    amod, smod,
                    candidates: candidates.map(c => ({
                      entryId: c.entry.id,
                      name: c.entry.character_name,
                      distFeet: c.dist,
                    })),
                    preselectName: preselect,
                  })
                }} style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Distract</button>

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
                    handleRollRequest(`${activeEntry.character_name} - Fire from Cover (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: condCmod !== -99 ? condCmod : 0, traits: w.traits })
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Fire from Cover</button>
                ) : null}

                {/* ── GRAPPLE: Opposed Unarmed Combat check ── */}
                <button onClick={() => { setGrappleResult(null); setShowGrappleModal(true) }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Grapple</button>

                {/* ── INSPIRE - opens social-target picker (no roll, auto-applies) ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); setSocialTarget(socialTarget?.action === 'Inspire' ? null : { action: 'Inspire' }) }}
                  style={actBtn(socialTarget?.action === 'Inspire' ? '#1a2e10' : '#242424', socialTarget?.action === 'Inspire' ? '#7fc458' : '#d4cfc9', socialTarget?.action === 'Inspire' ? '#2d5a1b' : '#3a3a3a')}>Inspire</button>

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
                  if (gmLike && selectedMapTargetName) {
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
                    handleRollRequest(`${activeEntry.character_name} - Rapid Fire (${w.name}) [-1 CMod, then -3]`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: (condCmod !== -99 ? condCmod : 0) - 1, traits: w.traits })
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Rapid Fire</button>
                ) : (
                  <button disabled style={disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Rapid Fire</button>
                )}

                {/* ── READY WEAPON: switch/reload/unjam ── */}
                <button onClick={() => setShowReadyWeaponModal(true)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Ready Weapon</button>

                {/* ── REPOSITION: end-of-round positioning ── */}
                <button onClick={() => { clearAimIfActive(activeEntry.id); consumeAction(activeEntry.id, `${activeEntry.character_name} - Reposition (Resolution phase)`) }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Reposition</button>

                {/* ── SPRINT: both actions, 3x move (30ft), then Athletics check ── */}
                {/* Action consumption happens in onMoveComplete - NOT here. If we */}
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
                  handleRollRequest(`${activeEntry.character_name} - Subdue (${wName})`, amod, smod, { weaponName: wName, damage: wDmg, rpPercent: 100, conditionCmod: 0 })
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Subdue</button>

                {/* ── TAKE COVER: +2 defensive modifier for all attacks this round (once per round) ── */}
                <button onClick={!activeEntry.has_cover ? async () => {
                  clearAimIfActive(activeEntry.id)
                  await supabase.from('initiative_order').update({ defense_bonus: (activeEntry.defense_bonus ?? 0) + 2, has_cover: true }).eq('id', activeEntry.id)
                  await consumeAction(activeEntry.id, `${activeEntry.character_name} - Take Cover (+2 Defensive Modifier, all attacks this round)`)
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
                  handleRollRequest(`${activeEntry.character_name} - Unarmed`, amod, smod, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
                }}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Unarmed</button>

                {/* ── Modals (overlay-positioned; render order doesn't matter for layout) ── */}
                {socialTarget && (() => {
                  // Show all other combatants - GM/player picks the correct target.
                  // NPCs can be allies or enemies, so we can't filter by is_npc.
                  // Filter out dead / mortally wounded combatants - they have
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
                        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '10px' }}>{socialTarget.action} - Select Target</div>
                        {targets.length === 0 ? (
                          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', padding: '1rem 0', textAlign: 'center' }}>No valid targets</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {targets.map(t => (
                              <button key={t.id} onClick={() => applySocialAction(socialTarget.action, t.id)}
                                style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#2a1210')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#242424')}>
                                {t.character_name}{t.is_npc ? ' (NPC)' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                        <button onClick={() => setSocialTarget(null)}
                          style={{ marginTop: '10px', width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )
                })()}

                {/* ── COORDINATE MODAL ── */}
                {showCoordinateModal && (() => {
                  // Same dead/mortal filter as the social-action picker -
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
                        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Coordinate</div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5, marginBottom: '12px' }}>
                          Select the enemy to coordinate against. On a successful Tactics* check, allies within Close range get +2 CMod when attacking that target.
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Coordinate Against</div>
                        <select value={coordinateSelection} onChange={e => setCoordinateSelection(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none', marginBottom: '12px' }}>
                          <option value="">Select target...</option>
                          {allTargets.map(t => (
                            <option key={t.id} value={t.character_name}>{t.character_name}{t.is_npc ? ' (NPC)' : ''}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setShowCoordinateModal(false)}
                            style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
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
                            handleRollRequest(`${activeEntry.character_name} - Coordinate (vs ${coordinateSelection})`, amod, smod)
                            setShowCoordinateModal(false)
                          }}
                            style={{ flex: 2, padding: '8px', background: coordinateSelection ? '#c0392b' : '#242424', border: `1px solid ${coordinateSelection ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: coordinateSelection ? '#fff' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: coordinateSelection ? 'pointer' : 'not-allowed' }}>Roll Tactics*</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Stabilize - single 🩸 STABILIZE ▾ trigger that cascades
                    children for every mortally-wounded combatant (WP=0,
                    not yet dead) within 20ft of the active combatant.
                    Was an inline button-per-target row that ate horizontal
                    space; now folds into one menu the same way GM Tools /
                    Checks / Community do up in the header. Engaged status
                    flips a child's color (green = engaged, amber = needs to
                    move closer); the action still happens or warns the GM
                    on click per target. */}
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
                  // distFeet === null means "no map / no token" - preserve the
                  // pre-multi behavior of allowing the click in that case.
                  const inRange = targets.filter(t => t.distFeet === null || t.distFeet <= 20)
                  if (inRange.length === 0) return null
                  // One callback shape, per target. Engaged = open the roll;
                  // not engaged = warn the GM to move closer first. Same logic
                  // as before, just plumbed through the cascade helper.
                  // Stabilize routes through the dedicated <RollModal>
                  // (Phase 1 migration, 2026-05-20). No pre-consume here -
                  // the modal's onRoll runs consumeAction synchronously
                  // before the dice fire so the action debit can't slip
                  // through if the modal closes mid-flow.
                  const fireStabilize = (t: StabTarget) => () => {
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
                    setStabilizeCmod(0)
                    setStabilizeResult(null)
                    setStabilizeNarrativeText('')
                    setStabilizePending({
                      medicEntryId: activeEntry.id,
                      medicName: activeEntry.character_name,
                      targetName: t.name,
                      targetKind: t.kind,
                      amod,
                      smod,
                    })
                  }
                  const items = inRange.map(t => {
                    const notEngaged = t.distFeet !== null && t.distFeet > 5
                    return {
                      label: `${t.name}${notEngaged ? ' (not engaged)' : ''}`,
                      color: notEngaged ? '#EF9F27' : '#7fc458',
                      onClick: notEngaged
                        ? () => alert(`${activeEntry.character_name} must be engaged (adjacent) to ${t.name} to stabilize them. Move closer first.`)
                        : fireStabilize(t),
                    }
                  })
                  return renderHeaderMenu(
                    'stabilize-action',
                    '🩸 Stabilize',
                    items,
                    actBtn('#1a2e10', '#7fc458', '#2d5a1b'),
                  )
                })()}

                {/* Treat Infection - parallel to Stabilize. Lists sick
                    targets (infection_state set AND days_left > 0) within
                    engaged range. Medic rolls Medicine* (RSN + Medicine
                    SMod). Outcomes resolve in executeRoll. See
                    /rules/combat/infection. */}
                {(() => {
                  const aTok = mapTokens.find(t => (activeEntry.character_id && t.character_id === activeEntry.character_id) || (activeEntry.npc_id && t.npc_id === activeEntry.npc_id))
                  const getDistFeet = (targetCharId?: string, targetNpcId?: string): number | null => {
                    if (!aTok || mapTokens.length === 0) return null
                    const tTok = mapTokens.find(t => (targetCharId && t.character_id === targetCharId) || (targetNpcId && t.npc_id === targetNpcId))
                    if (!tTok) return null
                    const dist = Math.max(Math.abs(aTok.grid_x - tTok.grid_x), Math.abs(aTok.grid_y - tTok.grid_y))
                    return dist * mapCellFeet
                  }
                  type TreatTarget = { kind: 'pc' | 'npc'; name: string; charId?: string; npcId?: string; distFeet: number | null }
                  const targets: TreatTarget[] = []
                  for (const e of entries) {
                    if (!e.liveState) continue
                    const ls = e.liveState as any
                    if (ls.infection_state && (ls.infection_days_left ?? 0) > 0) {
                      targets.push({ kind: 'pc', name: e.character.name, charId: e.character.id, distFeet: getDistFeet(e.character.id, undefined) })
                    }
                  }
                  for (const n of campaignNpcs as any[]) {
                    if (n.infection_state && (n.infection_days_left ?? 0) > 0) {
                      targets.push({ kind: 'npc', name: n.name, npcId: n.id, distFeet: getDistFeet(undefined, n.id) })
                    }
                  }
                  const inRange = targets.filter(t => t.distFeet === null || t.distFeet <= 20)
                  if (inRange.length === 0) return null
                  const fireTreat = (t: TreatTarget) => async () => {
                    let amod = 0, smod = 0
                    if (charEntry) {
                      const rapid = charEntry.character.data?.rapid ?? {}
                      amod = rapid.RSN ?? 0
                      smod = charEntry.character.data?.skills?.find((s: any) => s.skillName === 'Medicine*')?.level
                        ?? charEntry.character.data?.skills?.find((s: any) => s.skillName === 'Medicine')?.level
                        ?? 0
                    } else {
                      const npcRoller = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
                      if (npcRoller) {
                        amod = npcRoller.reason ?? 0
                        const npcSkills: any[] = Array.isArray(npcRoller.skills?.entries) ? npcRoller.skills.entries : []
                        smod = npcSkills.find((s: any) => s.name === 'Medicine*')?.level
                          ?? npcSkills.find((s: any) => s.name === 'Medicine')?.level
                          ?? 0
                      }
                    }
                    handleRollRequest(`${activeEntry.character_name} - Treat Infection ${t.name}`, amod, smod)
                    actionPreConsumedRef.current = true
                    await consumeAction(activeEntry.id)
                  }
                  const items = inRange.map(t => {
                    const notEngaged = t.distFeet !== null && t.distFeet > 5
                    return {
                      label: `${t.name}${notEngaged ? ' (not engaged)' : ''}`,
                      color: notEngaged ? '#EF9F27' : '#d48bd4',
                      onClick: notEngaged
                        ? () => alert(`${activeEntry.character_name} must be engaged (adjacent) to ${t.name} to treat them. Move closer first.`)
                        : fireTreat(t),
                    }
                  })
                  return renderHeaderMenu(
                    'treat-infection-action',
                    '💊 Treat Infection',
                    items,
                    actBtn('#2a1a3e', '#d48bd4', '#5a2e5a'),
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

        {/* Left - Game Feed */}
        <FeedColumn
          campaignId={id}
          myUsername={myUsername}
          isGM={isGM}
          gmLike={gmLike}
          feedTab={feedTab}
          setFeedTab={setFeedTab}
          sessionStatus={sessionStatus}
          sessionActing={sessionActing}
          startSession={startSession}
          rollsFeed={rollsFeed}
          chat={chat}
          entries={entries}
          userId={userId}
          campaign={campaign}
          setFeedScrollContainer={setFeedScrollContainer}
          feedScrollEl={feedScrollEl}
          whisperTarget={whisperTarget}
          setWhisperTarget={setWhisperTarget}
          setGrantPcId={setGrantPcId}
          setGrantSkill={setGrantSkill}
          setGrantCmod={setGrantCmod}
          setGrantDescription={setGrantDescription}
          setGrantSourceRollLogId={setGrantSourceRollLogId}
          setGrantError={setGrantError}
          setShowGrantAdvantage={setShowGrantAdvantage}
        />

        {/* Center - Map always rendered, sheets float on top */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a1a1a', overflow: 'hidden', position: 'relative' }}>
          {/* Center map - tactical during combat or when toggled, campaign otherwise.
              The shared flag pins only non-GM clients: the GM can preview the
              campaign map while players see the shared tactical scene. */}
          {shouldRenderTactical({ combatActive, showTacticalMap, tacticalShared, gmLike }) ? (
            <TacticalMap
              campaignId={id}
              isGM={gmLike}
              initiativeOrder={initiativeOrder}
              tokenRefreshKey={tokenRefreshKey}
              onTokenChanged={handleMapTokenChanged}
              onPlayerDragMove={handleMapPlayerDragMove}
              onGMDragMove={handleMapGMDragMove}
              campaignNpcs={campaignNpcs}
              entries={entries}
              myCharacterId={myCharIdRef.current}
              vehicles={vehicles}
              onVehiclesNeedRefresh={refetchVehicles}
              onObjectMove={handleMapObjectMove}
              onTokenClick={handleMapTokenClick}
              onTokenSelect={handleMapTokenSelect}
              moveMode={moveMode}
              onTokensUpdate={handleMapTokensUpdate}
              onMoveComplete={handleMapMoveComplete}
              onMoveCancel={handleMapMoveCancel}
              throwMode={tacticalThrowMode}
              onThrowComplete={handleMapThrowComplete}
              onThrowCancel={handleMapThrowCancel}
            />
          ) : (
            <CampaignMap campaignId={id} isGM={gmLike} setting={campaign?.setting} mapStyle={(campaign as any)?.map_style} mapCenterLat={(campaign as any)?.map_center_lat} mapCenterLng={(campaign as any)?.map_center_lng} revealedNpcIds={revealedNpcIds} focusPin={focusPin} onMapDoubleClick={(lat, lng) => openQuickAddPin(lat, lng)} />
          )}
          {/* NPC Card(s) - grid overlay when out of combat, draggable inline when in combat */}
          {viewingNpcs.length > 0 && !combatActive && !showTacticalMap && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '8px', background: 'rgba(26,26,26,0.95)', zIndex: 1100, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', alignContent: 'start' }}>
              {/* Close-all chip (post-playtest mark 02:37:45, Q4-a). Spans
                  the full row at the top so it's always reachable. Only
                  renders when 2+ cards are open - single-card view uses
                  the per-card Close button. */}
              {viewingNpcs.length >= 2 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  <button onClick={() => setViewingNpcs([])}
                    style={{ padding: '6px 14px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700 }}>
                    ✕ Close All ({viewingNpcs.length})
                  </button>
                </div>
              )}
              {viewingNpcs.map(npc => {
                const fresh = campaignNpcs.find((c: any) => c.id === npc.id)
                const liveNpc = fresh ? { ...fresh } as CampaignNpc : npc
                const cardKey = `${npc.id}-${liveNpc.wp_current}-${liveNpc.rp_current}-${liveNpc.death_countdown}`
                return gmLike ? (
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
                    onSetupApprentice={(() => {
                      // Show the wizard trigger when this NPC is an Apprentice
                      // whose creation wizard hasn't run yet. GMs see it on
                      // every Apprentice (oversight); the master PC sees it
                      // on theirs only.
                      const bond = apprenticeBondsByNpcId[npc.id]
                      if (!bond || bond.apprenticeMeta.setup_complete) return undefined
                      const isMaster = !!myEntry && bond.masterCharacterId === myEntry.character.id
                      if (!gmLike && !isMaster) return undefined
                      return () => setSetupApprenticeNpcId(npc.id)
                    })()}
                    onOpenTrade={myEntry ? () => setTradeTarget({ kind: 'npc', id: npc.id }) : undefined}
                  />
                ) : (
                  <PlayerNpcCard key={cardKey}
                    npc={liveNpc}
                    onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                    viewingCharacterId={myEntry?.character.id}
                    onRecruit={sessionStatus === 'active' ? () => openRecruitModal(npc.id) : undefined}
                    onSetupApprentice={(() => {
                      const bond = apprenticeBondsByNpcId[npc.id]
                      if (!bond || bond.apprenticeMeta.setup_complete) return undefined
                      const isMaster = !!myEntry && bond.masterCharacterId === myEntry.character.id
                      if (!isMaster) return undefined
                      return () => setSetupApprenticeNpcId(npc.id)
                    })()}
                    // First Impression skip-the-picker (2026-05-01).
                    // Drops straight into the roll modal pre-populated
                    // with the viewing PC + this NPC. Wired only when
                    // the player has a character on this campaign;
                    // PlayerNpcCard hides the button if no
                    // viewingCharacterId.
                    onFirstImpression={myEntry
                      ? () => { setFirstImpressionNpcId(npc.id); setShowSpecialCheck('first_impression') }
                      : undefined}
                  />
                )
              })}
            </div>
          )}
          {/* Combat / tactical-map mode: floating Close All chip when
              2+ cards are open. Cards are draggable absolute-positioned
              tiles so a row-spanning button doesn't fit; instead a small
              chip in the top-right corner of the viewport (under any
              header chrome). Post-playtest mark 02:37:45, Q4-a. */}
          {viewingNpcs.length >= 2 && (combatActive || showTacticalMap) && (
            <button onClick={() => setViewingNpcs([])}
              style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1200, padding: '6px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
              ✕ Close All NPCs ({viewingNpcs.length})
            </button>
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
                    // Default 571×400 - Xero's spec for the in-combat /
                    // tactical-map double-click popup. Resize handle in
                    // the bottom-right still lets the GM grow either
                    // dimension; once dragged, the user-set size wins.
                    width: size?.w ?? 571,
                    height: size?.h ?? 400,
                    maxHeight: size?.h ? undefined : '80vh',
                    overflow: 'auto',
                    // Wrapper bg - without this, when NpcCard's natural
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
                  {gmLike ? (
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
                      onFirstImpression={myEntry
                        ? () => { setFirstImpressionNpcId(npc.id); setShowSpecialCheck('first_impression') }
                        : undefined}
                    />
                  )}
                  {/* Resize handle - bottom-right corner. Drag to resize the
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

          {/* Object Card(s) - draggable inline, live WP from mapTokens */}
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
                  isGM={gmLike}
                  entries={entries as any}
                  myCharacter={(() => {
                    const me = entries.find(e => e.userId === userId)
                    return me ? { id: me.character.id, name: me.character.name, data: me.character.data } : null
                  })()}
                  onLoot={async (objectName, item, characterId, characterName) => {
                    await insertRollLog({
                      campaign_id: id, user_id: userId, character_name: 'System',
                      label: `🎒 ${characterName} looted ${item.name} from ${objectName}`,
                      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
                    })
                    await Promise.all([loadEntries(id), rollsFeed.refetch()])
                  }}
                  onSearchEmpty={async (objectName, characterId, characterName) => {
                    await insertRollLog({
                      campaign_id: id, user_id: userId, character_name: characterName,
                      label: `🎒 ${characterName} looked through the remains of ${objectName} and found nothing`,
                      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
                    })
                    await rollsFeed.refetch()
                  }}
                  onMove={(() => {
                    // GM can always reposition. Players can only move an object
                    // they're listed in `controlled_by_character_ids` for -
                    // typically the driver(s) of a vehicle. No action burned
                    // (vehicles aren't combatants); the move mode picks a
                    // valid cell within the vehicle's CURRENT speed range
                    // (which ramps up over consecutive Move actions -
                    // see onMoveComplete).
                    const me = entries.find(e => e.userId === userId)
                    const controllers = (liveTok as any)?.controlled_by_character_ids
                    const canControl = gmLike
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
                    // TacticalMap.loadTokens() via its useEffect dep - the
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

          {/* Inline vehicle takeover - iframe of the /vehicle popout
              UI, anchored over the center area. /vehicle is already in
              LayoutShell's FULL_WIDTH_PATTERN so it renders sidebar-
              free; the iframe sits at the same z-index as the inline
              character sheet so the two are mutually exclusive (we
              clear selectedEntry when opening a vehicle inline, and
              vice versa via the same setSelectedVehicleId chain). */}
          {selectedVehicleId && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(26,26,26,1)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#0f0f0f', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {vehicles.find(v => v.id === selectedVehicleId)?.name ?? 'Vehicle'}
                </span>
                <button onClick={() => setSelectedVehicleId(null)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #5a5550', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
              <iframe
                src={`/vehicle?c=${id}&v=${selectedVehicleId}`}
                style={{ flex: 1, border: 'none', background: '#1a1a1a' }}
                title="Vehicle sheet"
              />
            </div>
          )}

          {/* Inline character sheet - full screen over map */}
          {syncedSelectedEntry && sheetMode === 'inline' && !selectedVehicleId && (
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
                canEdit={gmLike || syncedSelectedEntry.userId === userId}
                showButtons={true}
                isMySheet={syncedSelectedEntry.userId === userId}
                isGM={gmLike}
                onStatUpdate={handleStatUpdate}
                onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || gmLike) ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                onClose={() => { setSelectedEntry(null); setSheetPos(null) }}
                onKick={gmLike && syncedSelectedEntry.userId !== userId ? async () => {
                  const kickUserId = syncedSelectedEntry.userId
                  const kickName = syncedSelectedEntry.character.name
                  if (!confirm(`Remove ${kickName} from this session?`)) return
                  // Mark as kicked so they don't reload on refresh.
                  // Update by (campaign_id, user_id) rather than a cached stateId so a
                  // stale entry row (e.g. after a character reassignment) can't miss.
                  // .select() returns the updated rows - a 0-length array here means
                  // RLS silently blocked the write (Supabase does not surface an error).
                  const { error: kickErr, data: kickData } = await supabase
                    .from('character_states')
                    .update({ kicked: true })
                    .eq('campaign_id', id)
                    .eq('user_id', kickUserId)
                    .select('id')
                  console.error('[kick] rows updated:', kickData?.length ?? 0, 'error:', kickErr?.message ?? 'none')
                  if (kickErr) {
                    alert(`Kick failed: ${kickErr.message}`)
                    return
                  }
                  if (!kickData || kickData.length === 0) {
                    alert('Kick did not affect any rows - likely an RLS / permissions issue. Check console.')
                    return
                  }
                  // Broadcast for immediate redirect
                  if (initChannelRef.current) {
                    await initChannelRef.current.send({ type: 'broadcast', event: 'player_kicked', payload: { userId: kickUserId } })
                  }
                  // Note: notification insert removed - RLS blocks cross-user inserts.
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
                  // Cross-user notification - RPC bypasses notifications
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
                otherNpcs={campaignNpcs
                  .filter((n: any) => !(!gmLike && n.hidden_from_players))
                  .filter((n: any) => n.status !== 'dead')
                  .map((n: any) => ({ id: n.id, name: n.name }))}
                onGiveItemToNpc={async (item: InventoryItem, targetNpcId: string, qty: number) => {
                  // Mirrors onGiveItem but writes to campaign_npcs.
                  // Filters apply on the recipient list above so non-GM
                  // players can't see hidden NPCs as targets.
                  const targetNpc: any = campaignNpcs.find((n: any) => n.id === targetNpcId)
                  if (!targetNpc) return
                  const targetInv: InventoryItem[] = Array.isArray(targetNpc.inventory) ? targetNpc.inventory : []
                  const existing = targetInv.find((i: InventoryItem) => i.name === item.name && (i.custom ?? false) === (item.custom ?? false))
                  const newTargetInv = existing
                    ? targetInv.map((i: InventoryItem) => i === existing ? { ...i, qty: (i.qty ?? 1) + qty } : i)
                    : [...targetInv, { ...item, qty }]
                  const { error } = await supabase.from('campaign_npcs').update({ inventory: newTargetInv }).eq('id', targetNpcId)
                  if (error) { alert(`Give to NPC failed: ${error.message}`); return }
                  // Local state patch + token-refresh broadcast so other
                  // GMs / players see the NPC's new inventory without a
                  // manual refresh.
                  setCampaignNpcs(prev => prev.map((n: any) => n.id === targetNpcId ? { ...n, inventory: newTargetInv } : n))
                  setRosterNpcs(prev => prev.map((n: any) => n.id === targetNpcId ? { ...n, inventory: newTargetInv } : n))
                  setViewingNpcs(prev => prev.map((n: any) => n.id === targetNpcId ? { ...n, inventory: newTargetInv } : n))
                  initChannelRef.current?.send({ type: 'broadcast', event: 'npc_inventory_changed', payload: { npcId: targetNpcId } })
                }}
                otherCommunities={(pcCommunityMemberships[syncedSelectedEntry.character.id] ?? [])}
                onGiveItemToCommunity={async (item: InventoryItem, targetCommunityId: string, qty: number) => {
                  // Deposit to community_stockpile_items. Stack-merge
                  // by (name, custom): UPDATE qty if a row already
                  // exists, else INSERT. The unique index on
                  // (community_id, name, custom) catches the race.
                  const { data: existing, error: readErr } = await supabase
                    .from('community_stockpile_items')
                    .select('id, qty')
                    .eq('community_id', targetCommunityId)
                    .eq('name', item.name)
                    .eq('custom', item.custom)
                    .maybeSingle()
                  if (readErr) { alert(`Stockpile read failed: ${readErr.message}`); return }
                  if (existing) {
                    const newQty = ((existing as any).qty ?? 0) + qty
                    const { error } = await supabase
                      .from('community_stockpile_items')
                      .update({ qty: newQty })
                      .eq('id', (existing as any).id)
                    if (error) { alert(`Deposit failed: ${error.message}`); return }
                  } else {
                    const { error } = await supabase.from('community_stockpile_items').insert({
                      community_id: targetCommunityId,
                      name: item.name, qty, enc: item.enc, rarity: item.rarity,
                      notes: item.notes, custom: item.custom,
                    })
                    if (error) { alert(`Deposit failed: ${error.message}`); return }
                  }
                }}
                otherVehicles={vehicles.map(v => ({ id: v.id, name: v.name ?? 'Vehicle' }))}
                onGiveItemToVehicle={async (item: InventoryItem, targetVehicleId: string, qty: number) => {
                  // Stash in campaigns.vehicles[N].cargo. Stack-merge
                  // by (name, custom) to mirror the existing
                  // community-stockpile pattern: if the cargo array
                  // already has the same item, bump qty; else push a
                  // new row. Whole vehicles[] is then written back to
                  // the campaigns.vehicles jsonb in one update.
                  const targetIdx = vehicles.findIndex(v => v.id === targetVehicleId)
                  if (targetIdx < 0) { alert('Vehicle not found.'); return }
                  const target = vehicles[targetIdx]
                  const cargo = Array.isArray(target.cargo) ? [...target.cargo] : []
                  const existingIdx = cargo.findIndex(c => c.name === item.name && (c.custom ?? false) === (item.custom ?? false))
                  if (existingIdx >= 0) {
                    cargo[existingIdx] = { ...cargo[existingIdx], qty: (cargo[existingIdx].qty ?? 0) + qty }
                  } else {
                    cargo.push({ name: item.name, enc: item.enc, rarity: item.rarity, notes: item.notes, qty, custom: !!item.custom })
                  }
                  const newVehicles = vehicles.map((v, i) => i === targetIdx ? { ...v, cargo } : v)
                  setVehicles(newVehicles)
                  // RPC instead of direct UPDATE so non-GM members succeed
                  // (post-playtest Q3 scope A, 2026-05-19). Direct UPDATE is
                  // RLS-blocked for non-GM; the RPC is SECURITY DEFINER +
                  // member-authorized.
                  const updated = newVehicles[targetIdx]
                  const { error } = await supabase.rpc('update_vehicle_in_campaign', {
                    p_campaign_id: id,
                    p_vehicle_id: updated.id,
                    p_new_vehicle: updated as any,
                  })
                  if (error) { alert(`Stash failed: ${error.message}`); return }
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

        {/* Right - Asset panel. GM gets NPCs/Assets/GM Notes; players get
            NPCs (revealed only) and Assets (read-only). */}
        <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            {((combatActive || showTacticalMap) ? ['npcs', 'assets', 'pins', 'advantages', 'notes'] as const : ['pins', 'npcs', 'assets', 'advantages', 'notes'] as const).map(tab => (
              <button key={tab} onClick={() => setGmTab(tab)}
                style={{ flex: 1, padding: '8px 0', background: gmTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: gmTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: gmTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '13px', fontWeight: 600, fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {tab === 'pins' ? 'Pins' : tab === 'npcs' ? 'NPCs' : tab === 'assets' ? 'Assets' : tab === 'advantages' ? `⭐${advantages.length > 0 ? ` ${advantages.length}` : ''}` : gmLike ? 'GM Notes' : 'Notes'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {gmTab === 'npcs' && gmLike && (() => {
              return <NpcRoster campaignId={id} isGM={gmLike} combatActive={combatActive} initiativeNpcIds={npcRosterInitiativeNpcIds} initiativeNpcOrder={npcRosterInitiativeNpcOrder} onAddToCombat={addNpcsToCombat} pcEntries={npcRosterPcEntries} onViewNpc={onNpcRosterViewNpc} viewingNpcIds={npcRosterViewingNpcIds} editNpcId={pendingEditNpcId} onEditStarted={onNpcRosterEditStarted} externalNpcs={campaignNpcs} onPlaceOnMap={(combatActive || showTacticalMap) ? (npc) => placeTokenOnMap(npc.name, 'npc', undefined, npc.id, npc.portrait_url || undefined) : undefined} onRemoveFromMap={(combatActive || showTacticalMap) ? (npc) => removeTokenFromMap(npc.name) : undefined} onPlaceFolderOnMap={(combatActive || showTacticalMap) ? (folderNpcs) => placeFolderOnMap(folderNpcs.map(n => ({ id: n.id, name: n.name, portrait_url: n.portrait_url, disposition: (n as any).disposition, npc_type: (n as any).npc_type }))) : undefined} onUnmapFolder={(combatActive || showTacticalMap) ? (folderNpcs) => unmapFolderFromMap(folderNpcs.map(n => ({ id: n.id }))) : undefined} onTacticalRefresh={async () => {
              // Final-pass refresh after the GM toggles SHOW/HIDE on a
              // folder. revealNpcsByIds in NpcRoster updates is_visible
              // on scene_tokens but doesn't broadcast - without this
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
            {gmTab === 'npcs' && !gmLike && (() => {
              // Merge revealed NPCs with any NPCs currently in combat,
              // sorted in initiative order (active combatant first) - mirrors GM view.
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
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No NPCs revealed yet</div>
                  </div>
                )
              }
              // Group by folder. Recruited NPCs go into "🏘 Community - {name}"
              // buckets (pinned after combat), others by GM-assigned folder.
              // "Unfiled" sorts last.
              type FolderBucket = { name: string; key: string; npcs: any[] }
              const folders: FolderBucket[] = []
              if (combatNpcsInOrder.length > 0) {
                folders.push({ name: '⚔️ In Combat', key: '__combat__', npcs: combatNpcsInOrder })
              }
              // Community buckets - NPC is recruited (in playerNpcCommunityMap) and not in combat
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
                folders.push({ name: `🏘 Community - ${cname}`, key: `__community__${cname}`, npcs: cnpcs.sort((a, b) => a.name.localeCompare(b.name)) })
              }
              // Default alphabetical with Unfiled last - mirrors prior
              // behavior. Phase B: a saved playerFolderOrder overrides
              // this for any folder it covers; unknown / new folders
              // fall back to the alpha tail so they're discoverable
              // (and the user can drag them into place from there).
              const alpha = [...byFolder.keys()].sort((a, b) => {
                if (a === 'Unfiled') return 1
                if (b === 'Unfiled') return -1
                return a.localeCompare(b)
              })
              const orderedFolderNames: string[] = []
              const alphaSet = new Set(alpha)
              for (const key of playerFolderOrder) {
                if (alphaSet.has(key)) { orderedFolderNames.push(key); alphaSet.delete(key) }
              }
              for (const key of alpha) {
                if (alphaSet.has(key)) orderedFolderNames.push(key)
              }
              for (const f of orderedFolderNames) {
                folders.push({ name: f, key: f, npcs: byFolder.get(f)!.sort((a, b) => a.name.localeCompare(b.name)) })
              }
              // Phase B sync: keep playerFolderOrder current with what
              // actually rendered. Guarded with a length+order check so
              // it's a no-op when nothing changed (no render loop).
              // Stale keys (folder renamed by GM / NPCs revealed/hidden
              // such that a folder vanishes) drop out; new folders get
              // pinned in their alpha position so the saved order
              // stays exhaustive.
              if (
                playerFolderOrderLoadedRef.current &&
                (orderedFolderNames.length !== playerFolderOrder.length ||
                 orderedFolderNames.some((k, i) => k !== playerFolderOrder[i]))
              ) {
                // Defer to avoid the React "set state during render"
                // warning while still keeping the write batched with
                // the next render commit. Guarded on the load-done
                // ref so the first-mount render (before localStorage
                // load fires in the effect) doesn't clobber a saved
                // order with the bare alphabetical tail.
                queueMicrotask(() => {
                  setPlayerFolderOrder(orderedFolderNames)
                  if (typeof window !== 'undefined') {
                    try { localStorage.setItem(`npc_folder_order_player_${id}`, JSON.stringify(orderedFolderNames)) } catch {}
                  }
                })
              }

              function renderNpcRow(npc: any, bucket: { name: string; key: string; npcs: any[] }) {
                const isOpen = viewingNpcs.some(n => n.id === npc.id)
                const inCombat = combatIdSet.has(npc.id)
                const freshNpc = campaignNpcs.find((n: any) => n.id === npc.id)
                const npcWP = freshNpc?.wp_current ?? npc.wp_current ?? npc.wp_max ?? 10
                const npcIsDead = freshNpc?.status === 'dead' || (npcWP === 0 && freshNpc?.death_countdown != null && freshNpc.death_countdown <= 0)
                const npcIsMortal = npcWP === 0 && !npcIsDead
                // Drag/drop only inside custom folders. Combat + community
                // buckets are computed views, not editable groupings -
                // reordering them would just confuse players when the next
                // render snaps them back into initiative / community order.
                const isCombatBucket = bucket.key === '__combat__'
                const isCommunityBucket = bucket.key.startsWith('__community__')
                const canDragHere = !isCombatBucket && !isCommunityBucket
                const isDragOver = playerNpcDragOverId === npc.id && playerNpcDragId !== npc.id
                return (
                  <div
                    key={npc.id}
                    draggable={canDragHere}
                    onDragStart={e => {
                      if (!canDragHere) { e.preventDefault(); return }
                      e.stopPropagation()
                      setPlayerNpcDragId(npc.id)
                    }}
                    onDragEnd={() => { setPlayerNpcDragId(null); setPlayerNpcDragOverId(null); setPlayerNpcDragOverFolder(null) }}
                    onDragOver={e => {
                      if (!playerNpcDragId || !canDragHere) return
                      e.preventDefault()
                      setPlayerNpcDragOverId(npc.id)
                    }}
                    onDragLeave={() => { if (playerNpcDragOverId === npc.id) setPlayerNpcDragOverId(null) }}
                    onDrop={async e => {
                      if (!playerNpcDragId || playerNpcDragId === npc.id || !canDragHere) {
                        setPlayerNpcDragId(null); setPlayerNpcDragOverId(null); return
                      }
                      e.stopPropagation()
                      // Reorder within the bucket - operate on bucket.npcs.
                      // Note: bucket.npcs are sorted by name in the player
                      // view (L8669); after this drop sort_order persists to
                      // DB and the GM/player view will reorder accordingly
                      // on the next render.
                      const renumbered = reorderNpcs(bucket.npcs, playerNpcDragId, npc.id)
                      setPlayerNpcDragId(null)
                      setPlayerNpcDragOverId(null)
                      if (renumbered === bucket.npcs) return
                      await persistNpcSort(supabase, dirtyNpcSortRows(bucket.npcs, renumbered))
                    }}
                    onClick={() => {
                      setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev.filter(n => n.id !== npc.id) : [...prev, npc])
                      setSelectedEntry(null)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: isDragOver ? '#242424' : isOpen ? '#2a1210' : npcIsDead ? '#0f0f0f' : '#1a1a1a', border: `1px solid ${isDragOver ? '#7fc458' : isOpen ? '#c0392b' : npcIsDead ? '#3a3a3a' : inCombat ? '#5a1b1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: canDragHere ? 'grab' : 'pointer', transition: 'background 0.15s', opacity: npcIsDead ? 0.5 : 1 }}
                  >
                    {(() => {
                      // Player-side NPC list. Pull disposition + npc_type
                      // from the fresh campaign_npcs row when available
                      // (revealedNpcs is built from npc_relationships +
                      // an older snapshot; freshNpc has the live state)
                      // so the ring follows the disposition picker
                      // instantly. Same getNpcRingColor helper as the
                      // GM roster - both surfaces never disagree.
                      const ring = getNpcRingColor({
                        disposition: ((freshNpc as any)?.disposition ?? npc.disposition) ?? null,
                        npc_type: ((freshNpc as any)?.npc_type ?? npc.npc_type) ?? null,
                      })
                      return (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ring.bg, border: `2px solid ${ring.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {npc.portrait_url ? (
                            <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '13px', fontWeight: 700, color: ring.color, fontFamily: 'Carlito, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                          )}
                        </div>
                      )
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
                      {npcIsDead && <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>💀 Dead</div>}
                      {npcIsMortal && <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>🩸 Mortally Wounded</div>}
                      {inCombat && !npcIsDead && !npcIsMortal && <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>In Combat</div>}
                      {!npc._combatOnly && npc.reveal_level === 'name_portrait_role' && npc.recruitment_role && (
                        <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.recruitment_role}</div>
                      )}
                      {!npc._combatOnly && npc.relationship_cmod !== 0 && npc.relationship_cmod != null && (
                        <div style={{ fontSize: '13px', color: npc.relationship_cmod > 0 ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>
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
                  // Combat pseudo-folder is always open - you don't want
                  // to hide the "it's your turn" indicator behind a click.
                  const isCombatBucket = bucket.key === '__combat__'
                  const isCommunityBucket = bucket.key.startsWith('__community__')
                  const isOpen = isCombatBucket || playerFolderOpen.has(bucket.key)
                  const headerColor = isCombatBucket ? '#f5a89a' : isCommunityBucket ? '#7fc458' : '#EF9F27'
                  // Folder header is a valid drop target for cross-folder
                  // NPC moves. Combat + community buckets reject drops
                  // because they're computed views, not editable folders.
                  const canAcceptDrop = !isCombatBucket && !isCommunityBucket
                  // Two distinct drag types both target the folder header:
                  //   1. NPC card -> drop here = cross-folder move
                  //   2. Folder header -> drop on another header = reorder
                  // Visual feedback merges into one green-dashed border so
                  // the user sees "yes, this is a valid drop target" for
                  // either op. Branch on which dragId is set inside onDrop.
                  const isNpcDragOver = playerNpcDragOverFolder === bucket.key && playerNpcDragId !== null
                  const isFolderReorderDragOver = playerFolderDragOverId === bucket.key && playerFolderDragId !== null && playerFolderDragId !== bucket.key
                  const isFolderDragOver = isNpcDragOver || isFolderReorderDragOver
                  return (
                    <div key={bucket.key} style={{ marginBottom: '6px' }}>
                      <div
                        draggable={canAcceptDrop}
                        onClick={() => !isCombatBucket && togglePlayerFolder(bucket.key)}
                        onDragStart={e => {
                          if (!canAcceptDrop) { e.preventDefault(); return }
                          e.stopPropagation()
                          setPlayerFolderDragId(bucket.key)
                        }}
                        onDragEnd={() => { setPlayerFolderDragId(null); setPlayerFolderDragOverId(null) }}
                        onDragOver={e => {
                          if (!canAcceptDrop) return
                          if (playerNpcDragId) {
                            e.preventDefault()
                            setPlayerNpcDragOverFolder(bucket.key)
                          } else if (playerFolderDragId && playerFolderDragId !== bucket.key) {
                            e.preventDefault()
                            setPlayerFolderDragOverId(bucket.key)
                          }
                        }}
                        onDragLeave={() => {
                          if (playerNpcDragOverFolder === bucket.key) setPlayerNpcDragOverFolder(null)
                          if (playerFolderDragOverId === bucket.key) setPlayerFolderDragOverId(null)
                        }}
                        onDrop={async e => {
                          if (!canAcceptDrop) {
                            setPlayerNpcDragId(null); setPlayerNpcDragOverFolder(null)
                            setPlayerFolderDragId(null); setPlayerFolderDragOverId(null)
                            return
                          }
                          e.stopPropagation()
                          if (playerNpcDragId) {
                            // Cross-folder NPC move (Phase A behavior):
                            // bucket.name IS the folder string ('Unfiled'
                            // maps to null inside persistNpcFolder).
                            const dragId = playerNpcDragId
                            setPlayerNpcDragId(null)
                            setPlayerNpcDragOverFolder(null)
                            const { error } = await persistNpcFolder(supabase, dragId, bucket.name)
                            if (error) reportSupabaseError(error as any, 'player-npc-folder-move')
                          } else if (playerFolderDragId) {
                            // Folder reorder (Phase B): local-only,
                            // localStorage-backed. No DB write because
                            // folder order is per-user-per-campaign and
                            // never broadcast.
                            handlePlayerFolderReorder(bucket.key)
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', cursor: isCombatBucket ? 'default' : 'pointer', userSelect: 'none', background: isFolderDragOver ? '#1a2e10' : 'transparent', border: isFolderDragOver ? '1px dashed #7fc458' : '1px solid transparent', borderRadius: '3px', transition: 'background 0.15s' }}>
                        {!isCombatBucket && (
                          <span style={{ fontSize: '13px', color: '#5a5550', width: '10px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                        )}
                        <span style={{ fontSize: '13px', color: headerColor, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                          {bucket.name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                          ({bucket.npcs.length})
                        </span>
                      </div>
                      {isOpen && bucket.npcs.map(npc => renderNpcRow(npc, bucket))}
                    </div>
                  )
                })}
              </div>
              )
            })()}
            {gmTab === 'pins' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <CampaignPins campaignId={id} isGM={isGM} isThriver={isThriver}
                  showTacticalMap={showTacticalMap}
                  onPinFocus={p => setFocusPin({ ...p })}
                  onOpenScene={async (sceneId: string) => {
                    await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', id)
                    await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', sceneId)
                    setShowTacticalMap(true)
                    setTokenRefreshKey(k => k + 1)
                    // Force-push the scene switch so every player whose
                    // pane is open (or who has tacticalShared on) lands
                    // on the new scene without a manual refresh.
                    initChannelRef.current?.send({ type: 'broadcast', event: 'scene_activated', payload: { sceneId } })
                  }}
                  onPlaceOnTacticalMap={async (pin) => {
                    // Drop the pin onto the active scene as a minimal
                    // marker - token_type='pin' is rendered by
                    // TacticalMap as just the emoji at the grid center,
                    // no square background, no name label. Position is
                    // (1,1) per the top-left spawn convention; the GM
                    // drags it where it actually belongs after.
                    // campaign_pin_id is set so the symmetric "remove
                    // from tactical map" path can target only this
                    // pin's markers without colliding on emoji name.
                    const { data: activeScene } = await supabase
                      .from('tactical_scenes')
                      .select('id, grid_cols, grid_rows')
                      .eq('campaign_id', id)
                      .eq('is_active', true)
                      .single()
                    if (!activeScene) { alert('No active tactical scene - open one from Map Setup first.'); return }
                    const emoji = getCategoryEmoji(pin.category)
                    const pinSpawn = defaultSpawnCell((activeScene as any).grid_cols ?? 20, (activeScene as any).grid_rows ?? 15)
                    const { error } = await supabase.from('scene_tokens').insert({
                      scene_id: (activeScene as any).id,
                      name: emoji,
                      token_type: 'pin',
                      grid_x: pinSpawn.grid_x, grid_y: pinSpawn.grid_y,
                      is_visible: true, color: '#7ab3d4',
                      campaign_pin_id: pin.id,
                    })
                    if (error) { alert(`Add to tactical map failed: ${error.message}`); return }
                    setTokenRefreshKey(k => k + 1)
                    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                  }}
                  onRemoveFromTacticalMap={async (pin) => {
                    // Tactical-mode X button. Removes ONLY this pin's
                    // markers from the active scene; the campaign_pin
                    // row survives so the user can re-stamp later via
                    // the 🗺️ button. Silent no-op when no markers
                    // exist - clicking X without ever having stamped
                    // shouldn't error.
                    const { data: activeScene } = await supabase
                      .from('tactical_scenes')
                      .select('id')
                      .eq('campaign_id', id)
                      .eq('is_active', true)
                      .single()
                    if (!activeScene) { alert('No active tactical scene.'); return }
                    const { error } = await supabase.from('scene_tokens')
                      .delete()
                      .eq('scene_id', (activeScene as any).id)
                      .eq('token_type', 'pin')
                      .eq('campaign_pin_id', pin.id)
                    if (error) { alert(`Remove from tactical map failed: ${error.message}`); return }
                    setTokenRefreshKey(k => k + 1)
                    initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
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
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>Objects</span>
                </div>
                {assetsFolderState.has('objects') && (
                  <CampaignObjects campaignId={id} isGM={gmLike} tokenRefreshKey={tokenRefreshKey}
                    onTokenChanged={() => { setTokenRefreshKey(k => k + 1); initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} }) }}
                    onPlaceOnMap={async (name, portraitUrl, wpMax) => {
                      const { data: activeScene } = await supabase.from('tactical_scenes').select('id, grid_cols, grid_rows').eq('campaign_id', id).eq('is_active', true).single()
                      if (!activeScene) { alert('No active scene.'); return }
                      const objSpawn = defaultSpawnCell((activeScene as any).grid_cols ?? 20, (activeScene as any).grid_rows ?? 15)
                      await supabase.from('scene_tokens').insert({
                        scene_id: activeScene.id, name, token_type: 'object',
                        portrait_url: portraitUrl, grid_x: objSpawn.grid_x, grid_y: objSpawn.grid_y,
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
                      await insertRollLog({
                        campaign_id: id, user_id: userId, character_name: 'System',
                        label: `🎒 ${characterName} looted ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''} from ${objectName}`,
                        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
                      })
                      await Promise.all([loadEntries(id), rollsFeed.refetch()])
                    }}
                    onDuplicate={async (source) => {
                      // Pull lootable too - the source object passed in only carries the
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
                      // Fetch the cloned scene's grid dimensions so the
                      // copy spawns under the top-right zoom slider, not
                      // under the top-left fog/lighting toolbar.
                      const { data: cloneScene } = await supabase
                        .from('tactical_scenes')
                        .select('grid_cols, grid_rows')
                        .eq('id', source.scene_id)
                        .maybeSingle()
                      const dupSpawn = defaultSpawnCell((cloneScene as any)?.grid_cols ?? 20, (cloneScene as any)?.grid_rows ?? 15)
                      const { error } = await supabase.from('scene_tokens').insert({
                        scene_id: source.scene_id,
                        name: candidate,
                        token_type: 'object',
                        portrait_url: source.portrait_url,
                        grid_x: dupSpawn.grid_x, grid_y: dupSpawn.grid_y,
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
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>Vehicles</span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{vehicles.length}</span>
                    </div>
                    {assetsFolderState.has('vehicles') && (
                      <div style={{ padding: '4px' }}>
                        {vehicles.map((v: Vehicle) => (
                          <div key={v.id} style={{ marginBottom: '4px' }}>
                            {/* Vehicles render their full card directly inside
                                the expanded Vehicles folder - no second click
                                needed. The compact "Recreational Vehicle · WP
                                X/Y" row this used to be was a redundant gate
                                given that the folder header already groups
                                them. expandedVehicleId state retained for
                                forward-compat (other surfaces may want it). */}
                            {/* canEdit opened to all campaign members 2026-05-19
                                (post-playtest Mark 02:12:29 - Q3 scope A).
                                Writes routed through update_vehicle_in_campaign
                                RPC since direct campaigns.update is GM-RLS-blocked. */}
                            <VehicleCard vehicle={v} campaignId={id} canEdit={true}
                              onClickInline={() => { setSelectedEntry(null); setSheetPos(null); setSelectedVehicleId(v.id) }}
                              onUpdate={async (updated: Vehicle) => {
                                const newVehicles = vehicles.map(vv => vv.id === updated.id ? updated : vv)
                                setVehicles(newVehicles)
                                const { error } = await supabase.rpc('update_vehicle_in_campaign', {
                                  p_campaign_id: id,
                                  p_vehicle_id: updated.id,
                                  p_new_vehicle: updated as any,
                                })
                                if (error) {
                                  console.error('[vehicle-asset] updateVehicle RPC failed:', error.message)
                                  reportSupabaseError(error as any, 'vehicle-asset-update')
                                }
                              }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {gmTab === 'notes' && gmLike && <GmNotes campaignId={id} />}
            {gmTab === 'notes' && !gmLike && <PlayerNotes campaignId={id} />}
            {gmTab === 'advantages' && (() => {
              // C3 visibility: RLS already scopes the rows. GM sees all
              // pending in campaign; players see only their own pending.
              // Consumed advantages don't appear here - they're recorded
              // in the rolls feed via the consume flow (Phase 5).
              const myCharIds = new Set(entries.filter(e => e.userId === userId).map(e => e.character.id))
              const visible = gmLike
                ? advantages
                : advantages.filter(a => myCharIds.has(a.character_id))
              if (visible.length === 0) {
                return (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      No advantages pending
                    </div>
                    {gmLike && (
                      <div style={{ textAlign: 'center', padding: '0 1rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', marginTop: '8px', fontStyle: 'italic' }}>
                        Grant one via GM Tools → ⭐ Grant Advantage.
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {visible.map(a => {
                    const holder = entries.find(e => e.character.id === a.character_id)
                    const holderName = holder?.character.name ?? 'Unknown PC'
                    const isMyOwn = myCharIds.has(a.character_id)
                    const inFlight = useInFlight.has(a.id)
                    return (
                      <div key={a.id} style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1a1a', border: '1px solid #2a2010', borderLeft: '3px solid #EF9F27', borderRadius: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                            {a.cmod_delta > 0 ? `+${a.cmod_delta}` : a.cmod_delta} {a.skill_name}
                          </div>
                          {gmLike && !isMyOwn && (
                            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', whiteSpace: 'nowrap' }}>{holderName}</div>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', lineHeight: 1.4 }}>
                          {a.description}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(isMyOwn || gmLike) && (
                            <button type="button" disabled={inFlight}
                              onClick={async () => {
                                setUseInFlight(prev => new Set(prev).add(a.id))
                                const { error } = await consumeAdvantage(supabase, a.id, null)
                                if (error) {
                                  alert(`Use failed: ${error}`)
                                  setUseInFlight(prev => { const n = new Set(prev); n.delete(a.id); return n })
                                  return
                                }
                                // Phase 5: C3 shared-narrative feed broadcast.
                                // Insert a roll_log entry so the whole campaign
                                // sees the redemption. Best-effort: a failed
                                // log doesn't undo the consume.
                                const sign = a.cmod_delta > 0 ? `+${a.cmod_delta}` : `${a.cmod_delta}`
                                const holder2 = entries.find(e => e.character.id === a.character_id)
                                const holderName2 = holder2?.character.name ?? 'Unknown PC'
                                const holderUserId = holder2?.userId ?? userId
                                try {
                                  await insertRollLog({
                                    campaign_id: id,
                                    user_id: holderUserId,
                                    character_name: holderName2,
                                    label: `${holderName2} used their ${sign} ${a.skill_name} advantage (${a.description})`,
                                    die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
                                    outcome: 'advantage_used',
                                  })
                                  void rollsFeed.refetch()
                                } catch (e) {
                                  console.error('[advantages] feed broadcast failed', e)
                                }
                                // Optimistic local update - realtime will reconcile too.
                                setAdvantages(prev => prev.filter(x => x.id !== a.id))
                                setUseInFlight(prev => { const n = new Set(prev); n.delete(a.id); return n })
                              }}
                              style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight ? 0.5 : 1, fontWeight: 700 }}>
                              {inFlight ? 'Using…' : '✓ Use'}
                            </button>
                          )}
                          {gmLike && (
                            <button type="button"
                              onClick={async () => {
                                if (!confirm(`Delete advantage "+${a.cmod_delta} ${a.skill_name}" for ${holderName}? This is for mistakes - Use is the normal path.`)) return
                                const { deleteAdvantage } = await import('../../../../lib/advantages')
                                const { error } = await deleteAdvantage(supabase, a.id)
                                if (error) { alert(`Delete failed: ${error}`); return }
                                setAdvantages(prev => prev.filter(x => x.id !== a.id))
                              }}
                              style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #5a1f1f', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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
                  // File missing or broken - swap to the text fallback so the
                  // circle never renders as a silent empty badge.
                  const parent = (e.currentTarget.parentElement as HTMLElement | null)
                  if (parent) {
                    parent.innerHTML = '<span style="font-size:12px;font-weight:700;color:#c0392b;font-family:\'Carlito\',sans-serif;letter-spacing:.04em">GM</span>'
                  }
                }}
              />
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                if (gmLike || isMe) {
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
                  {gmLike && (combatActive || showTacticalMap) && (() => {
                    // Read the actual token state - was checking initiativeOrder,
                    // which meant the button didn't flip color for PCs placed on
                    // the map outside of combat (or cleared but still in init).
                    const onMap = mapTokens.some(t => t.character_id === entry.character.id)
                    return (
                      <div onClick={async e => {
                        e.stopPropagation()
                        if (onMap) {
                          // Remove from map - find and delete the token
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
                        style={{ padding: '3px 8px', background: onMap ? '#1a2e10' : '#2a2010', border: `1px solid ${onMap ? '#2d5a1b' : '#5a4a1b'}`, borderRadius: '3px', color: onMap ? '#7fc458' : '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.2 }}>
                        Map
                      </div>
                    )
                  })()}
                  {/* Avatar border colors signal status in priority order:
                      active combatant (red) > online (green) > default
                      (teal). Online presence is read from onlineUserIds
                      populated by the table-page presence channel. Glow
                      box-shadow on the online state makes the bright
                      green ring pop even at compact (28px) avatar size. */}
                  {(() => {
                    const isOnline = onlineUserIds.has(entry.userId)
                    const borderColor = isActive ? '#c0392b' : isOnline ? '#39ff14' : '#7ab3d4'
                    return (
                      <div title={isOnline ? `${entry.username} is online` : undefined}
                        style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: '#1a3a5c', border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: isOnline && !isActive ? '0 0 8px rgba(57,255,20,.6)' : 'none' }}>
                        {photo ? <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: isCompact ? '9px' : '11px', fontWeight: 700, color: isActive ? '#c0392b' : '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                      </div>
                    )
                  })()}
                  {(gmLike || isMe) && (
                    <div onClick={e => { e.stopPropagation(); openPopout(`/character-sheet?c=${id}&char=${entry.character.id}`, `char-${entry.character.id}`, { w: 800, h: 800 }) }}
                      style={{ padding: '3px 6px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.2 }}>
                      Popout
                    </div>
                  )}
                  <PlayerStatusChips liveState={entry.liveState} lastingWounds={(entry.character.data as any)?.lastingWounds} />
                </div>
                <div style={{ fontSize: nameSize, color: isActive ? '#f5a89a' : '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.character.name} <span style={{ color: '#cce0f5', fontWeight: 400 }}>({entry.username})</span>
                </div>
              </button>
            )
          })
        })()}
      </div>

      {/* Character sheet overlay - draggable floating window */}
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
              canEdit={gmLike || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              isGM={gmLike}
              onStatUpdate={handleStatUpdate}
              onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || gmLike) ? (label, amod, smod, weapon) => { setSelectedEntry(null); handleRollRequest(label, amod, smod, weapon) } : undefined}
              onWeaponChange={(slot, newWeapon) => {
                // Same fix as the inline-mode card above - patch entries so
                // the combat bar's Attack button picks up the new weapon
                // immediately. Without this, overlay-mode weapon swaps
                // lagged behind by a loadEntries cycle.
                const charId = syncedSelectedEntry.character.id
                setEntries(prev => prev.map(e => e.character.id === charId
                  ? { ...e, character: { ...e.character, data: { ...e.character.data, [slot]: newWeapon } } }
                  : e))
              }}
            />
            <button onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderTop: 'none', borderRadius: '0 0 4px 4px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Roll modal - draggable floating panel so the player can shove it aside
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
          {/* Drag handle - grab strip across the top. */}
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
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>{pendingRoll.weapon ? 'Attack Roll' : 'Rolling'}</div>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{pendingRoll.label}</div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: pendingRoll.weapon ? '6px' : '1rem', fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  <span>2d6</span>
                  {pendingRoll.amod !== 0 && <span style={{ color: pendingRoll.amod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.amod > 0 ? '+' : ''}{pendingRoll.amod} AMod</span>}
                  {pendingRoll.smod !== 0 && <span style={{ color: pendingRoll.smod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.smod > 0 ? '+' : ''}{pendingRoll.smod} SMod</span>}
                </div>
                {pendingRoll.weapon && (
                  <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', padding: '6px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
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
                      style={{ width: '100%', padding: '6px', background: useBurst ? '#2d5a1b' : '#242424', border: `1px solid ${useBurst ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: useBurst ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      {useBurst ? `✓ Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)` : `Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)`}
                    </button>
                  </div>
                )}
                {/* Range band auto-calculated in background - no manual selector */}
                {(combatActive || pendingRoll.weapon) && initiativeOrder.length > 0 && !pendingRoll.label.includes('Coordinate') && !pendingRoll.label.includes('Sprint') && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Target</div>
                    <select value={targetName} onChange={e => {
                      setTargetName(e.target.value)
                      // Re-apply the full itemized CMod (Aim, target defense
                      // incl. NPC, coord, same-target) via the shared helper -
                      // the old inline copy here dropped the Aim bonus (3c fix).
                      if (pendingRoll.weapon && e.target.value) {
                        const { net, sources } = computeAttackCmod(e.target.value, pendingRoll.weapon, cmodCtx())
                        cmodSourcesRef.current = sources
                        setCmod(String(net))
                        // Auto-calculate range band from token positions
                        const active = initiativeOrder.find(ie => ie.is_active)
                        if (active) {
                          const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, e.target.value)
                          if (autoRange) setRangeBand(autoRange)
                        }
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
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
                          // Filter out targets the weapon can't hit at their range (skip for Charge - it includes movement)
                          if (pendingRoll.weapon && mapTokens.length > 0 && !pendingRoll.label.includes('Charge')) {
                            const active = initiativeOrder.find(ie => ie.is_active)
                            if (active) {
                              const autoRange = getAutoRangeBand(active.character_id || undefined, active.npc_id || undefined, entry.character_name)
                              if (autoRange && !isInRange(pendingRoll.weapon.weaponName, autoRange)) return false
                            }
                          }
                          // Distract range-filter branch DELETED 2026-05-20.
                          // Distract migrated to its own dedicated <RollModal>
                          // 2026-05-20 (commit 54dec35); the new modal has
                          // its own Close-range filter at button-click time.
                          // No pendingRoll ever carries ' - Distract' anymore,
                          // so this branch was unreachable dead code.
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
                      {/* Non-initiative PCs + NPCs who have map tokens - lets the attacker target bystanders and creatures that haven't joined initiative */}
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
                          // range filter (skip for Charge - it includes movement)
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
                      {/* Object tokens - crates, doors, barrels, etc. Show EVERY
                          object on the map regardless of wp_max configuration;
                          the suffix tells the user WHY one can't be destroyed
                          ((indestructible) / (destroyed)) instead of silently
                          omitting it. Silent omission was the source of several
                          "I can see it right there but can't target it" reports
                          during playtest - GMs assumed they'd placed the object
                          wrong (or mis-configured wp_max) because there was no
                          diagnostic. (Distract-exclusion gate dropped 2026-05-20
                          when Distract moved off pendingRoll onto its own
                          dedicated modal - this branch is now unreachable for
                          Distract regardless.) */}
                      {(() => {
                        const objs = mapTokens.filter(t => t.token_type === 'object')
                        return objs
                          .filter(t => {
                            // Range filter (skip for Charge). An out-of-range
                            // object still doesn't make the list - showing it
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
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Interacting with an NPC?</div>
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
                        // Plain CMod term in the breakdown (relationship mod has
                        // no itemized source slot); clear any prefill sources.
                        cmodSourcesRef.current = {}
                        setCmod(String(rel.relationship_cmod))
                      } else {
                        setSocialCmod({ npcName: npc?.name ?? '', cmod: 0 })
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="">No NPC</option>
                      {campaignNpcs.map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    {socialCmod && (
                      <div style={{ fontSize: '13px', color: socialCmod.cmod > 0 ? '#7fc458' : socialCmod.cmod < 0 ? '#f5a89a' : '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                        Relationship CMod with {socialCmod.npcName}: {socialCmod.cmod > 0 ? `+${socialCmod.cmod}` : socialCmod.cmod}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Conditional Modifier</div>
                  <input type="number" value={cmod} onChange={e => setCmod(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') executeRoll() }} autoFocus
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                {myInsightDice > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>
                      Spend Insight Die ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setPreRollInsight(preRollInsight === '3d6' ? 'none' : '3d6')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Roll 3d6<br /><span style={{ fontSize: '13px', color: preRollInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep all 3</span>
                      </button>
                      <button onClick={() => setPreRollInsight(preRollInsight === '+3cmod' ? 'none' : '+3cmod')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        +3 CMod<br /><span style={{ fontSize: '13px', color: preRollInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                      </button>
                    </div>
                  </div>
                )}
                {pendingRoll.weapon && !targetName && (
                  <div style={{ padding: '6px 10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>
                    Select a target or damage will not be applied
                  </div>
                )}
                {pendingRoll.weapon && targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand) && (
                  <div style={{ padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>
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
                    <div style={{ padding: '6px 10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'left', marginBottom: '8px' }}>
                      {total === 0 ? (
                        <span>💥 Throwing into open ground - no targets in blast radius</span>
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
                  <button onClick={closeRollModal} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={executeRoll} disabled={rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: (rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))) ? 'not-allowed' : 'pointer', opacity: (rolling || (!!pendingRoll.weapon && !!targetName && !grenadeTargetCell && !pendingRoll.label.includes('Charge') && !isInRange(pendingRoll.weapon.weaponName, rangeBand))) ? 0.6 : 1 }}>
                    {rolling ? 'Rolling...' : preRollInsight === '3d6' ? '🎲 Roll 3d6' : '🎲 Roll'}
                  </button>
                </div>
              </>
            )}

            {rollResult && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>{rollResult.label}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '1rem 0' }}>
                  {/* Show all three dice on a 3d6 Insight roll; otherwise the
                      two die-storage columns. diceRolled is populated only
                      when preRollInsight === '3d6' and the roll happened. */}
                  {(rollResult.diceRolled && rollResult.diceRolled.length > 2
                    ? rollResult.diceRolled
                    : [rollResult.die1, rollResult.die2]).map((d, i) => (
                    <div key={i} style={{ width: '52px', height: '52px', background: '#242424', border: '2px solid #3a3a3a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, color: '#f5f2ee' }}>{d}</div>
                  ))}
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                  [{rollResult.diceRolled && rollResult.diceRolled.length > 2
                    ? rollResult.diceRolled.join('+')
                    : `${rollResult.die1}+${rollResult.die2}`}]
                  {rollResult.amod !== 0 && <span style={{ color: rollResult.amod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.amod > 0 ? '+' : ''}{rollResult.amod}</span>}
                  {rollResult.smod !== 0 && <span style={{ color: rollResult.smod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.smod > 0 ? '+' : ''}{rollResult.smod}</span>}
                  {rollResult.cmod !== 0 && <span style={{ color: rollResult.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {rollResult.cmod > 0 ? '+' : ''}{rollResult.cmod}</span>}
                  <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.total}</span>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: outcomeColor(rollResult.outcome) }}>{rollResult.outcome}</div>
                  {rollResult.insightAwarded && (
                    <div style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '3px 8px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', display: 'inline-block', marginTop: '6px' }}>+1 Insight Die</div>
                  )}
                  {(rollResult as any).weaponJammed && (
                    <div style={{ fontSize: '14px', color: '#c0392b', background: '#2a1210', border: '1px solid #c0392b', padding: '6px 10px', borderRadius: '3px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '8px' }}>
                      ⚠️ Weapon Malfunction! The condition is degraded and will require a Ready Weapon action to prepare again.
                    </div>
                  )}
                </div>
                {/* Damage result */}
                {rollResult.damage && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>
                      Damage to {rollResult.damage.targetName}
                    </div>
                    <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                      {rollResult.damage.base > 0 && <span>{rollResult.damage.base}</span>}
                      {rollResult.damage.diceDesc && <span>{rollResult.damage.base > 0 ? '+' : ''}{rollResult.damage.diceDesc} ({rollResult.damage.diceRoll})</span>}
                      {rollResult.damage.phyBonus > 0 && <span> +{rollResult.damage.phyBonus} PHY</span>}
                      <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.damage.totalWP} raw WP</span>
                    </div>
                    {rollResult.damage.mitigated > 0 && (
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                        Defense mitigates {rollResult.damage.mitigated} WP
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
                      <div style={{ padding: '6px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{rollResult.damage.finalWP}</div>
                        <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>WP</div>
                      </div>
                      <div style={{ padding: '6px 12px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>{rollResult.damage.finalRP}</div>
                        <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>RP</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', marginTop: '6px' }}>Applied automatically</div>
                    {(rollResult.traitNotes ?? []).length > 0 && (
                      <div style={{ marginTop: '8px', padding: '6px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px' }}>
                        {(rollResult.traitNotes ?? []).map((note: string, i: number) => (
                          <div key={i} style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', marginBottom: i < (rollResult.traitNotes ?? []).length - 1 ? '4px' : 0 }}>{note}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {rollResult.insightUsed !== 'pre' && rollResult.insightUsed !== 'both' && myInsightDice > 0 && rollResult.outcome !== 'High Insight' && rollResult.outcome !== 'Low Insight' && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', textAlign: 'center' }}>
                      Spend Insight Dice ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {rollResult.insightUsed !== 'die1' && (
                        <button onClick={() => spendInsightDie('die1')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 1</button>
                      )}
                      {rollResult.insightUsed !== 'die2' && (
                        <button onClick={() => spendInsightDie('die2')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 2</button>
                      )}
                      {rollResult.insightUsed === null && (
                        <button onClick={() => spendInsightDie('both')} disabled={rolling || myInsightDice < 2} style={{ flex: 1, padding: '8px 4px', background: myInsightDice >= 2 ? '#1a2e10' : '#1a1a1a', border: `1px solid ${myInsightDice >= 2 ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: myInsightDice >= 2 ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling || myInsightDice < 2 ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Both (2)</button>
                      )}
                    </div>
                  </div>
                )}
                {(rollResult.insightUsed === 'pre' || rollResult.insightUsed === 'both') && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Insight {rollResult.insightUsed === 'both' ? 'Dice' : 'Die'} spent</div>
                )}
                <button onClick={closeRollModal} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
              </>
            )}

          </div>
        </div>
      )}

      {/* Restore modal - NPCs and PCs */}
      <LootModal
        open={showLootModal}
        onClose={() => setShowLootModal(false)}
        entries={entries}
        lootItems={lootItems}
        setLootItems={setLootItems}
        lootRecipients={lootRecipients}
        setLootRecipients={setLootRecipients}
        supabase={supabase}
        campaignId={id}
        userId={userId}
        channelRef={initChannelRef}
        onGiven={() => Promise.all([loadEntries(id), rollsFeed.refetch()])}
      />

      {/* Populate Modal - bulk-generate NPCs distributed across the
          triangle ratio (1 Antagonist : 2 Foes : 3 Goons : 4 Bystanders
          per 10). Shows the count input + the live breakdown so the
          GM knows exactly what they'll get before clicking Generate. */}
      <PopulateModal
        open={showPopulateModal}
        onClose={() => setShowPopulateModal(false)}
        count={populateCount}
        setCount={setPopulateCount}
        busy={populateBusy}
        setBusy={setPopulateBusy}
        supabase={supabase}
        campaignId={id}
        onGenerated={() => setGmTab('npcs')}
      />

      {/* Advance Time (Encumbrance) Modal - house-rule: every
          overencumbered PC + NPC loses 1 RP per hour over the limit
          until they rest or drop something. Modal previews who's
          affected, runs in one batch on Apply. RP=0 transitions still
          flow through the existing Stress / Incap pipeline. */}
      <AdvanceTimeModal
        open={showAdvanceTimeModal}
        onClose={() => setShowAdvanceTimeModal(false)}
        hours={advanceTimeHours}
        setHours={setAdvanceTimeHours}
        busy={advanceTimeBusy}
        setBusy={setAdvanceTimeBusy}
        entries={entries}
        campaignNpcs={campaignNpcs}
        setEntries={setEntries}
        setCampaignNpcs={setCampaignNpcs}
        supabase={supabase}
        campaignId={id}
        userId={userId}
        channelRef={initChannelRef}
      />

      {/* Grant Advantage Modal (P3 Q4-b). GM picks PC + skill + CMod + description. */}
      <GrantAdvantageModal
        open={showGrantAdvantage}
        onClose={() => setShowGrantAdvantage(false)}
        campaignId={id}
        entries={entries}
        userId={userId}
        supabase={supabase}
        grantPcId={grantPcId}
        setGrantPcId={setGrantPcId}
        grantSkill={grantSkill}
        setGrantSkill={setGrantSkill}
        grantCmod={grantCmod}
        setGrantCmod={setGrantCmod}
        grantDescription={grantDescription}
        setGrantDescription={setGrantDescription}
        grantSubmitting={grantSubmitting}
        setGrantSubmitting={setGrantSubmitting}
        grantError={grantError}
        setGrantError={setGrantError}
        grantSourceRollLogId={grantSourceRollLogId}
        setAdvantages={setAdvantages}
      />

      {/* CDP Award Modal */}
      <CdpModal
        open={showCdpModal}
        onClose={() => setShowCdpModal(false)}
        entries={entries}
        cdpAmount={cdpAmount}
        setCdpAmount={setCdpAmount}
        cdpRecipients={cdpRecipients}
        setCdpRecipients={setCdpRecipients}
        supabase={supabase}
        campaignId={id}
        userId={userId}
        channelRef={initChannelRef}
        onAwarded={() => Promise.all([loadEntries(id), rollsFeed.refetch()])}
      />

      {/* Reload modal - GM-Tools shortcut to restore a campaign snapshot
          without leaving the table. Single-target picker (one snapshot →
          confirm → restoreCampaignSnapshot). The full Snapshots admin
          page (save / download / delete / import) is still in campaign
          edit. Loading the modal triggers a one-shot fetch of the
          snapshot list - no realtime subscription, no polling. */}
      <ReloadPickerModal
        open={showReloadPicker}
        onClose={() => setShowReloadPicker(false)}
        snapshots={reloadSnapshots}
        reloadingSnapshotId={reloadingSnapshotId}
        setReloadingSnapshotId={setReloadingSnapshotId}
        supabase={supabase}
        campaignId={id}
      />

      <RestorePickerModal
        open={showRestorePicker}
        onClose={() => setShowRestorePicker(false)}
        campaignId={id}
        campaignNpcs={campaignNpcs}
        entries={entries}
        restoreObjects={restoreObjects}
        mapTokens={mapTokens}
        restoreNpcIds={restoreNpcIds}
        setRestoreNpcIds={setRestoreNpcIds}
        restoring={restoring}
        setRestoring={setRestoring}
        setCampaignNpcs={setCampaignNpcs}
        setRosterNpcs={setRosterNpcs}
        setViewingNpcs={setViewingNpcs}
        setMapTokens={setMapTokens}
        setTokenRefreshKey={setTokenRefreshKey}
        supabase={supabase}
        initChannelRef={initChannelRef}
        loadEntries={loadEntries}
      />

      {/* End Session modal */}
      <EndSessionModal
        open={showEndSessionModal}
        onClose={() => setShowEndSessionModal(false)}
        sessionCount={sessionCount}
        submittedPlayerNotes={submittedPlayerNotes}
        sessionSummary={sessionSummary}
        setSessionSummary={setSessionSummary}
        sessionCliffhanger={sessionCliffhanger}
        setSessionCliffhanger={setSessionCliffhanger}
        nextSessionNotes={nextSessionNotes}
        setNextSessionNotes={setNextSessionNotes}
        sessionFiles={sessionFiles}
        setSessionFiles={setSessionFiles}
        campaignId={id}
        campaignName={campaign?.name ?? 'Campaign'}
        sessionActing={sessionActing}
        endSession={endSession}
      />

      {/* NPC Picker for Start Combat */}
      {showNpcPicker && (
        <div onClick={() => setShowNpcPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Start Combat</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Select NPCs for this encounter</div>
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
                  <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{selectedNpcIds.size} of {aliveNpcs.length} selected</span>
                  <button onClick={() => setSelectedNpcIds(allSelected ? new Set() : new Set(aliveNpcs.map(n => n.id)))}
                    style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
                      {/* Folder header - checkbox toggles every NPC in
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
                        <span style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>{folderName}</span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{folderNpcs.filter(n => selectedNpcIds.has(n.id)).length}/{folderNpcs.length}</span>
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
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                            {npc.npc_type && <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
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
              <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Getting The Drop (optional)</div>
              <select value={dropCharacter} onChange={e => setDropCharacter(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none', cursor: 'pointer' }}>
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
              {dropCharacter && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontFamily: 'Carlito, sans-serif' }}>{dropCharacter} acts first with 1 action, then takes -2 CMod on initiative roll.</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowNpcPicker(false); setDropCharacter('') }} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmStartCombat} disabled={startingCombat}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: startingCombat ? 'not-allowed' : 'pointer', opacity: startingCombat ? 0.6 : 1 }}>
                {startingCombat ? 'Rolling...' : `⚔️ Start Combat${selectedNpcIds.size > 0 ? ` (${selectedNpcIds.size} NPCs)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add modal - extracted to components/QuickAddModal.tsx
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

      {/* Community Status - overlay modal wrapping <CampaignCommunity>.
          Same management surface as /communities but docked on the table
          page so players can check pending requests / Apprentice links /
          role coverage without leaving their PC view. Click the backdrop
          or ✕ to close. */}
      <CommunityStatusModal
        open={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
        campaignId={id}
        isGM={gmLike}
        communityModalMode={communityModalMode}
        communityModalToken={communityModalToken}
        myEntry={myEntry}
        setTradeTarget={setTradeTarget}
      />

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
          // Check engaged range (≤5ft) - require tokens on map
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

        function isSuccess(outcome: string) { return outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight' }

        // Outcome tier - opposed-check ordering. Higher tier wins; same
        // tier ties. Per Xero's reading: Wild Success > Success and
        // Dire Failure < Failure (so a Failure beats a Dire Failure
        // in an opposed check). Critical-roll variants (High Insight /
        // Low Insight from 6+6 / 1+1 pairs) share tier with their
        // respective Wild Success / Dire Failure neighbours.
        function outcomeTier(outcome: string): number {
          if (outcome === 'Wild Success' || outcome === 'High Insight') return 4
          if (outcome === 'Success') return 3
          if (outcome === 'Failure') return 2
          if (outcome === 'Dire Failure' || outcome === 'Low Insight') return 1
          return 0
        }

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

          // Attacker roll - optional Insight Die spend. 3d6 rolls three dice
          // and keeps all three (total = d1+d2+d3+mods) per the SRD keep-all
          // rule; +3 CMod is a flat bonus on top of 2d6. Both deduct 1
          // Insight Die from the PC attacker's state. Only PCs can spend -
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
            insightSpent = true
          } else if (insightMode === '+3cmod' && charEntry?.liveState && charEntry.liveState.insight_dice >= 1) {
            aDie1 = rollD6()
            aDie2 = rollD6()
            aBonusCmod = 3
            const newInsight = charEntry.liveState.insight_dice - 1
            await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', charEntry.stateId)
            setEntries(prev => prev.map(e => e.stateId === charEntry.stateId ? { ...e, liveState: { ...e.liveState, insight_dice: newInsight } } : e))
            insightSpent = true
          } else {
            aDie1 = rollD6()
            aDie2 = rollD6()
          }
          // Stack the user-entered Conditional Modifier on top of any
          // Insight-Die +3 bonus. Parse-fail or empty string both
          // resolve to 0 - the input is text, so guard explicitly.
          const manualCmod = parseInt(grappleCmod, 10) || 0
          const totalCmod = aBonusCmod + manualCmod
          const aTotal = aDie1 + aDie2 + aPhyMod + aUnarmed + totalCmod
          const aOutcome = getOutcome(aTotal)

          const dDie1 = rollD6()
          const dDie2 = rollD6()
          const dTotal = dDie1 + dDie2 + dPhyMod + dSmod
          const dOutcome = getOutcome(dTotal)

          // Determine result by outcome tier - higher tier wins, same
          // tier ties (no clear victor). Replaces the older binary
          // success/fail check that incorrectly tied "Wild Success vs
          // Success" and "Failure vs Dire Failure" - Xero clarified
          // those should resolve in favor of the stronger tier.
          const aTier = outcomeTier(aOutcome)
          const dTier = outcomeTier(dOutcome)
          const attackerWins = aTier > dTier
          const defenderWins = dTier > aTier
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

          // Log to roll_log. cmod stores the COMBINED CMod (manual + Insight
          // +3 bonus) so the expanded log breakdown sums correctly back to
          // total. Splitting them across columns would require schema work
          // we don't need yet - the label tells the user when an Insight
          // Die was spent.
          await insertRollLog({
            campaign_id: id, user_id: userId, character_name: active.character_name,
            label: `${active.character_name} - Grapple ${targetEntry.character_name}${insightSpent ? (insightMode === '3d6' ? ' (3d6 Insight)' : ' (+3 CMod Insight)') : ''}`,
            die1: aDie1, die2: aDie2, amod: aPhyMod, smod: aUnarmed, cmod: totalCmod,
            total: aTotal, outcome: result === 'grappled' ? OUTCOME.Grappled : result === 'failed' ? OUTCOME.GrappleFailed : OUTCOME.GrappleNoVictor,
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
          <div onClick={() => { if (!grappleResult) { setShowGrappleModal(false); setGrappleTarget(null); setGrappleInsight('none'); setGrappleCmod('0') } }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Grapple - Opposed Check</div>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>{active.character_name}</div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>
                PHY {aPhyMod >= 0 ? '+' : ''}{aPhyMod} · Unarmed {aUnarmed >= 0 ? '+' : ''}{aUnarmed}
              </div>

              {grappleResult ? (
                <>
                  {/* Results */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {/* Attacker roll */}
                    <div style={{ flex: 1, padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>Attacker</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{grappleResult.attackerName}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                        {/* Show three dice when Insight Die 3d6 was spent, two otherwise */}
                        {Array.isArray(grappleResult.aDiceRolled) && grappleResult.aDiceRolled.length > 0
                          ? `${grappleResult.aDiceRolled.join(' + ')} = ${grappleResult.aTotal}`
                          : `${grappleResult.aDie1} + ${grappleResult.aDie2} = ${grappleResult.aTotal}`}
                      </div>
                      {grappleResult.insightSpent && (
                        <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '2px' }}>Insight Die spent</div>
                      )}
                      <div style={{ fontSize: '13px', color: isSuccess(grappleResult.aOutcome) ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', fontWeight: 700 }}>{grappleResult.aOutcome}</div>
                    </div>
                    {/* Defender roll */}
                    <div style={{ flex: 1, padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>Defender</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{grappleResult.defenderName}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                        {grappleResult.dDie1} + {grappleResult.dDie2} = {grappleResult.dTotal}
                      </div>
                      <div style={{ fontSize: '13px', color: isSuccess(grappleResult.dOutcome) ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', fontWeight: 700 }}>{grappleResult.dOutcome}</div>
                    </div>
                  </div>

                  {/* Result banner */}
                  <div style={{
                    padding: '10px', borderRadius: '3px', textAlign: 'center', marginBottom: '1rem',
                    fontSize: '16px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase',
                    background: grappleResult.result === 'grappled' ? '#1a2e10' : grappleResult.result === 'failed' ? '#2a1210' : '#242424',
                    border: `1px solid ${grappleResult.result === 'grappled' ? '#2d5a1b' : grappleResult.result === 'failed' ? '#c0392b' : '#3a3a3a'}`,
                    color: grappleResult.result === 'grappled' ? '#7fc458' : grappleResult.result === 'failed' ? '#f5a89a' : '#d4cfc9',
                  }}>
                    {grappleResult.result === 'grappled' && `${grappleResult.defenderName} is Grappled!`}
                    {grappleResult.result === 'failed' && 'Grapple Failed!'}
                    {grappleResult.result === 'no_victor' && 'No Clear Victor'}
                  </div>
                  {grappleResult.rpTarget && (
                    <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                      {grappleResult.rpTarget} takes 1 RP damage
                    </div>
                  )}

                  <button onClick={() => { setShowGrappleModal(false); setGrappleResult(null); setGrappleTarget(null); setGrappleInsight('none'); setGrappleCmod('0') }}
                    style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Close
                  </button>
                </>
              ) : !grappleTarget ? (
                <>
                  <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Select Target (Engaged)</div>
                  {engagedTargets.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>No targets within Engaged range</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                      {engagedTargets.map(target => (
                        <button key={target.id} onClick={() => { setGrappleTarget(target); setGrappleInsight('none'); setGrappleCmod('0') }}
                          style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: target.is_npc ? '#7fc458' : '#c0392b', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}>
                          {target.character_name}{target.is_npc ? ' (NPC)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowGrappleModal(false); setGrappleTarget(null); setGrappleInsight('none'); setGrappleCmod('0') }}
                    style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {/* Target confirmation + optional Insight Die spend before rolling */}
                  <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Target</div>
                  <div style={{ padding: '8px 12px', marginBottom: '1rem', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', fontSize: '14px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: grappleTarget.is_npc ? '#7fc458' : '#c0392b' }}>
                    {grappleTarget.character_name}{grappleTarget.is_npc ? ' (NPC)' : ''}
                  </div>
                  {/* Conditional Modifier - manual numeric mod that stacks on
                      top of PHY + Unarmed + Insight-Die bonus. Mirrors the
                      input on the standard attack modal so GMs and players
                      have a consistent place to add ad-hoc CMods (e.g. "+2
                      for high ground", "-1 prone target"). */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Conditional Modifier</div>
                    <input type="number" value={grappleCmod} onChange={e => setGrappleCmod(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') executeGrapple(grappleTarget!, grappleInsight) }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                  </div>
                  {/* Insight Die - PC attackers only, must have at least 1 die. Same
                      two options as the main attack modal: 3d6 keep-all, or +3 CMod
                      on 2d6. See grapple flow comment above. */}
                  {charEntry?.liveState && charEntry.liveState.insight_dice >= 1 && (
                    <div style={{ marginBottom: '1rem', padding: '8px', background: '#0f2010', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
                        Spend Insight Die? ({charEntry.liveState.insight_dice} available)
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setGrappleInsight(grappleInsight === '3d6' ? 'none' : '3d6')}
                          style={{ flex: 1, padding: '8px 4px', background: grappleInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${grappleInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Roll 3d6<br /><span style={{ fontSize: '13px', color: grappleInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep all 3</span>
                        </button>
                        <button onClick={() => setGrappleInsight(grappleInsight === '+3cmod' ? 'none' : '+3cmod')}
                          style={{ flex: 1, padding: '8px 4px', background: grappleInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${grappleInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          +3 CMod<br /><span style={{ fontSize: '13px', color: grappleInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setGrappleTarget(null); setGrappleInsight('none'); setGrappleCmod('0') }}
                      style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Back</button>
                    <button onClick={() => executeGrapple(grappleTarget, grappleInsight)}
                      style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
        const isJammed = !!primary?.jammed
        // Allow Unjam when the weapon is Worn-or-worse (cumulative wear)
        // OR when the persistent jammed flag is set (Low Insight just
        // jammed it even if condition is still Used). Either condition
        // surfaces the Unjam/Repair affordance.
        const canUnjam = condIdx >= 2 || isJammed

        async function doSwitch() {
          if (!charEntry || !canSwitch) return
          const newData = { ...charData, weaponPrimary: secondary, weaponSecondary: primary }
          await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
          // Update local entries so combat bar reflects the new weapon immediately
          setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} - Switch to ${secondary.weaponName}`)
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
        // Nothing is ever lost - displaced weapons return to inventory.
        // NPCs ignore the `slot` param - they only have a single
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
          consumeAction(active.id, `${active.character_name} - Ready ${invItemName}${charEntry && slot === 'secondary' ? ' (Secondary)' : ''}`)
          setShowReadyWeaponModal(false)
        }

        // Unequip a weapon back to inventory (PC only - NPCs have a
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
          consumeAction(active.id, `${active.character_name} - Unequip ${target.weaponName}`)
          setShowReadyWeaponModal(false)
        }

        async function doReload() {
          if (!charEntry || !canReload || !primaryW) return
          const reloaded = { ...primary, ammoCurrent: primaryW.clip, reloads: Math.max(0, (primary.reloads ?? 0) - 1) }
          const newData = { ...charData, weaponPrimary: reloaded }
          await supabase.from('characters').update({ data: newData }).eq('id', charEntry.character.id)
          setEntries(prev => prev.map(e => e.character.id === charEntry.character.id ? { ...e, character: { ...e.character, data: newData } } : e))
          clearAimIfActive(active.id)
          consumeAction(active.id, `${active.character_name} - Reload ${primary.weaponName}`)
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
          // Melee weapons don't "jam" - they malfunction (bent, stuck, fouled).
          // Roll request label distinguishes so the executeRoll handler picks the
          // right narrative and compactRollSummary renders the right verb.
          const verb = isMelee ? 'Repair' : 'Unjam'
          handleRollRequest(`${verb} - ${primary.weaponName} (${bestSkill})`, amod, bestLevel)
          actionPreConsumedRef.current = true
          await consumeAction(active.id)
          setShowReadyWeaponModal(false)
        }

        // Tracking bonus - applied automatically
        const hasTracking = primaryW ? getTraitValue(primaryW.traits, 'Tracking') !== null : false

        return (
          <div onClick={() => setShowReadyWeaponModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '380px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Ready Weapon</div>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{active.character_name}</div>

              {/* Current weapon info */}
              <div style={{ marginBottom: '1rem', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Primary</span>
                  {charEntry && primary?.weaponName && (
                    <button onClick={() => doUnequip('primary')}
                      title="Move to inventory"
                      style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Unequip
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700, textTransform: 'uppercase' }}>{primary?.weaponName ?? 'None'}</div>
                {primary && <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  Condition: <span style={{ color: condIdx <= 1 ? '#7fc458' : condIdx === 2 ? '#EF9F27' : '#f5a89a' }}>{primary.condition ?? 'Used'}</span>
                  {isJammed && <span style={{ marginLeft: '6px', padding: '0 5px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Jammed</span>}
                  {primaryW?.clip ? <> · Ammo: <span style={{ color: '#EF9F27' }}>{primary.ammoCurrent ?? 0}/{primaryW.clip}</span> · Reloads: <span style={{ color: '#7ab3d4' }}>{primary.reloads ?? 0}</span></> : null}
                </div>}
                {secondary?.weaponName && <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Secondary</span>
                    {charEntry && (
                      <button onClick={() => doUnequip('secondary')}
                        title="Move to inventory"
                        style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Unequip
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{secondary.weaponName}</div>
                </>}
              </div>

              {hasTracking && (
                <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', padding: '4px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                  Tracking weapon - Ready Weapon grants +1 CMod aim bonus
                </div>
              )}

              {/* Equip from Inventory - any weapon the character is carrying
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
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Equip from Inventory</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                      {invWeapons.map(item => {
                        const w = getWeaponByName(item.name)!
                        return (
                          <div key={item.name}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                            <span style={{ flex: 1, color: '#7fc458', fontWeight: 700, fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{item.name}</span>
                            <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{w.damage} · {w.range}</span>
                            {item.qty > 1 && <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>×{item.qty}</span>}
                            {charEntry ? (
                              <>
                                <button onClick={() => doEquipFromInventory(item.name, 'primary')}
                                  title="Equip to Primary"
                                  style={{ padding: '3px 8px', background: '#2d5a1b', border: '1px solid #7fc458', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
                                  → 1°
                                </button>
                                <button onClick={() => doEquipFromInventory(item.name, 'secondary')}
                                  title="Equip to Secondary"
                                  style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
                                  → 2°
                                </button>
                              </>
                            ) : (
                              <button onClick={() => doEquipFromInventory(item.name, 'primary')}
                                style={{ padding: '3px 10px', background: '#2d5a1b', border: '1px solid #7fc458', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}>
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
                  style={{ padding: '10px', background: canSwitch ? '#1a1a2e' : '#1a1a1a', border: `1px solid ${canSwitch ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', color: canSwitch ? '#7ab3d4' : '#3a3a3a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canSwitch ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  Switch{secondary?.weaponName ? ` to ${secondary.weaponName}` : ''} {!canSwitch && <span style={{ fontSize: '13px', opacity: 0.5 }}>- no secondary</span>}
                </button>
                <button onClick={canReload ? doReload : undefined} disabled={!canReload}
                  style={{ padding: '10px', background: canReload ? '#2a2010' : '#1a1a1a', border: `1px solid ${canReload ? '#5a4a1b' : '#2e2e2e'}`, borderRadius: '3px', color: canReload ? '#EF9F27' : '#3a3a3a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canReload ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  Reload{primaryW?.clip ? ` (${primary?.reloads ?? 0} remaining)` : ''} {!canReload && !primaryW?.clip && <span style={{ fontSize: '13px', opacity: 0.5 }}>- melee weapon</span>}{!canReload && primaryW?.clip && (primary?.reloads ?? 0) <= 0 && <span style={{ fontSize: '13px', opacity: 0.5 }}>- no reloads left</span>}
                </button>
                <button onClick={canUnjam ? doUnjam : undefined} disabled={!canUnjam}
                  style={{ padding: '10px', background: canUnjam ? '#2a1210' : '#1a1a1a', border: `1px solid ${canUnjam ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', color: canUnjam ? '#f5a89a' : '#3a3a3a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: canUnjam ? 'pointer' : 'not-allowed', textAlign: 'left' }}>
                  {primaryW?.category === 'melee' ? 'Repair' : 'Unjam'} {!canUnjam && <span style={{ fontSize: '13px', opacity: 0.5 }}>- not jammed or damaged</span>}
                </button>
              </div>

              <button onClick={() => setShowReadyWeaponModal(false)}
                style={{ marginTop: '1rem', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {/* Special Check Modal */}
      {/* First Impression now has its own modal (Phase 2 of FI streamline,
          2026-05-19). New <FirstImpressionModal> mounts independently
          and owns the entire pick + roll + result flow. Other special-
          check variants still render inside the shared modal frame
          below. Phase 3 will move the rest into per-check components
          using the same pattern. */}
      {showSpecialCheck === 'first_impression' && (() => {
        // Build the eligible-PC list. Players only see their own PCs;
        // GM/Thriver sees all visible.
        const visiblePcs = entries.filter(en => gmLike || en.userId === userId)
        const eligiblePcs: FiPc[] = visiblePcs.map(en => {
          const rapid = en.character.data?.rapid ?? {}
          const skills = en.character.data?.skills ?? []
          const lvl = (name: string): number => (skills.find((s: any) => s.skillName === name)?.level ?? 0)
          const manipLevel = lvl('Manipulation')
          const streetLevel = lvl('Streetwise')
          const psychLevel = lvl('Psychology')
          // Ties pick Manipulation first (declaration order).
          const cands: Array<['Manipulation' | 'Streetwise' | 'Psychology', number]> = [
            ['Manipulation', manipLevel],
            ['Streetwise', streetLevel],
            ['Psychology', psychLevel],
          ]
          cands.sort((a, b) => b[1] - a[1])
          const [bestSkillName, bestSkillLevel] = cands[0]
          return {
            characterId: en.character.id,
            characterName: en.character.name,
            stateId: en.stateId,
            infMod: rapid.INF ?? 0,
            bestSkillName, bestSkillLevel, manipLevel, streetLevel, psychLevel,
            insightDice: en.liveState?.insight_dice ?? 0,
          }
        })
        // Build eligible NPC list - on the active tactical map OR revealed
        // to any PC. Same dedup + alive filter as the prior FI picker.
        const onMap = mapTokens.filter(t => t.token_type !== 'object' && t.npc_id)
        const byId = new Map<string, any>()
        for (const n of revealedNpcs) byId.set(n.id, n)
        for (const t of onMap) {
          if (!t.npc_id || byId.has(t.npc_id)) continue
          const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
          if (npc) byId.set(npc.id, npc)
        }
        const eligibleNpcs: FiNpc[] = [...byId.values()]
          .filter((n: any) => {
            const wp = n.wp_current ?? n.wp_max ?? 10
            return wp > 0 && n.status !== 'dead'
          })
          .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
          .map((n: any) => ({ id: n.id, name: n.name }))
        // Default PC pick - single eligible PC, or active combatant in GM-led combat.
        let defaultPcId: string | undefined
        if (eligiblePcs.length === 1) defaultPcId = eligiblePcs[0].characterId
        else if (gmLike && combatActive) {
          const activeIE = initiativeOrder.find(ie => ie.is_active && !ie.is_npc)
          if (activeIE?.character_id) defaultPcId = activeIE.character_id
        }
        return (
          <FirstImpressionModal
            isGm={gmLike}
            eligiblePcs={eligiblePcs}
            eligibleNpcs={eligibleNpcs}
            defaultPcId={defaultPcId}
            defaultNpcId={firstImpressionNpcId || undefined}
            onClose={() => { setShowSpecialCheck(null); setFirstImpressionNpcId('') }}
            onRoll={async ({ pc, npc, amod, smod, cmod, die1, die2, die3, total, outcome, insightUsed, insightDieDelta }) => {
              if (!userId) return { cmodDelta: 0, vibe: '', warnings: ['no userId'] }
              // 1. Apply the Insight Die delta to character_states FIRST so
              //    resolveFirstImpression's roll_log row writes against the
              //    post-spend state (matches executeRoll's pre-spend
              //    decrement order at L4762).
              if (insightDieDelta !== 0) {
                const nextInsight = Math.max(0, pc.insightDice + insightDieDelta)
                const { error: idErr } = await supabase
                  .from('character_states')
                  .update({ insight_dice: nextInsight, updated_at: new Date().toISOString() })
                  .eq('id', pc.stateId)
                if (!idErr) {
                  setEntries(prev => prev.map(e => e.stateId === pc.stateId
                    ? { ...e, liveState: { ...e.liveState, insight_dice: nextInsight } }
                    : e))
                }
              }
              // 2. Resolver does the three writes (roll_log + RPC + progression).
              const result = await resolveFirstImpression({
                supabase, campaignId: id, userId,
                characterId: pc.characterId,
                characterName: pc.characterName,
                npcId: npc.id,
                npcName: npc.name,
                die1, die2, die3, amod, smod, cmod, total, outcome,
                insightUsed,
              })
              // Refresh local revealedNpcs so the sidebar/cards reflect
              // the new CMod without waiting for a realtime broadcast.
              if (myCharIdRef.current) {
                void loadRevealedNpcs(myCharIdRef.current, campaignNpcs)
              }
              // Refresh the rolls feed so the new roll_log entry appears.
              void rollsFeed.refetch()
              return result
            }}
          />
        )
      })()}
      {showSpecialCheck && showSpecialCheck !== 'first_impression' && (
        <div onClick={() => { setShowSpecialCheck(null); setFirstImpressionNpcId('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '380px' }}>
            {showSpecialCheck === 'perception' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Perception Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>Uses Perception modifier (RSN + ACU)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Players only see their own PC(s); GMs/Thrivers can roll
                      Perception for any PC (mirror First Impression below). */}
                  {entries.filter(e => gmLike || e.userId === userId).map(e => (
                    <button key={e.character.id} onClick={() => triggerPerceptionCheck(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name} (PER {(e.character.data?.rapid?.RSN ?? 0) + (e.character.data?.rapid?.ACU ?? 0)})</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'gut' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Gut Instinct</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>Uses Perception + best of Psychology, Streetwise, Tactics</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Same player-self / GM-all filter as Perception + First Impression. */}
                  {entries.filter(e => gmLike || e.userId === userId).map(e => (
                    <button key={e.character.id} onClick={() => triggerGutInstinct(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name}</button>
                  ))}
                </div>
              </>
            )}
            {/* First Impression branch deleted 2026-05-19 (FI streamline Phase 2).
                Replaced by the top-level <FirstImpressionModal> mount above.
                The supporting state (firstImpressionNpcId / firstImpressionSkill /
                firstImpressionTargetRef) and the FI branch in executeRoll stay
                alive in this commit; Phase 3 removes them. */}
            {showSpecialCheck === 'group' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Group Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>Highest modifier leads. Others contribute their SMod. No Insight Dice.</div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Skill</div>
                  <select value={groupCheckSkill} onChange={e => setGroupCheckSkill(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {SKILLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Participants</div>
                  {entries.map(e => (
                    <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={groupCheckParticipants.has(e.character.id)} onChange={() => {
                        setGroupCheckParticipants(prev => { const next = new Set(prev); if (next.has(e.character.id)) next.delete(e.character.id); else next.add(e.character.id); return next })
                      }} style={{ accentColor: '#c0392b' }} />
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{e.character.name}</span>
                    </label>
                  ))}
                </div>
                <button onClick={triggerGroupCheck} disabled={groupCheckParticipants.size === 0 || !groupCheckSkill}
                  style={{ width: '100%', padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: groupCheckParticipants.size === 0 || !groupCheckSkill ? 0.5 : 1 }}>
                  Roll Group Check
                </button>
              </>
            )}
            {showSpecialCheck === 'heal' && (() => {
              const myEntry = entries.find(e => e.userId === userId)
              const myInv: string[] = Array.isArray(myEntry?.character?.data?.equipment) ? myEntry!.character.data.equipment : []
              const hasFirstAid = myInv.some(i => /first aid kit/i.test(i))
              const hasDoctor = myInv.some(i => /doctor.{0,3}s bag/i.test(i))
              const medSmod = (myEntry?.character?.data?.skills ?? []).find((s: any) => s.skillName === 'Medicine*')?.level ?? 0
              // Preview the heal amounts (deterministic Success line - dice not rolled yet so show ranges for kit paths).
              const preview = healKit === 'doctors_bag'
                ? `On Success: heals 1+2d3 WP (2-7) over 24h. WS: +1 more. HI: +2 more.`
                : healKit === 'first_aid'
                  ? `On Success: heals 1+1d3 WP (2-4) over 24h. WS: +1 more. HI: +2 more.`
                  : `On Success: heals ${medSmod} WP (your Medicine* level) over 24h. WS: +1 more. HI: +2 more.`
              return (
                <>
                  <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Heal</div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>Medicine* check on a target. Heal applies over 24h: half at +12h, half at +24h. Failure: nothing. Dire Failure: target takes 1 WP. Low Insight: target makes a Wound Infection check.</div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Target</div>
                    <select value={healTargetCharId} onChange={e => setHealTargetCharId(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                      <option value="">Select target...</option>
                      {entries.map(e => <option key={e.character.id} value={e.character.id}>{e.character.name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Equipment</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                        <input type="radio" checked={healKit === 'none'} onChange={() => setHealKit('none')} style={{ accentColor: '#c0392b' }} />
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>Naked check (no kit) - heals your Medicine* level WP on Success</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: hasFirstAid ? 'pointer' : 'not-allowed', opacity: hasFirstAid ? 1 : 0.4 }}>
                        <input type="radio" checked={healKit === 'first_aid'} disabled={!hasFirstAid} onChange={() => setHealKit('first_aid')} style={{ accentColor: '#c0392b' }} />
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>First Aid Kit - +1 CMod, heals 1+1d3 WP {!hasFirstAid && '(not in inventory)'}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: hasDoctor ? 'pointer' : 'not-allowed', opacity: hasDoctor ? 1 : 0.4 }}>
                        <input type="radio" checked={healKit === 'doctors_bag'} disabled={!hasDoctor} onChange={() => setHealKit('doctors_bag')} style={{ accentColor: '#c0392b' }} />
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>Doctor&apos;s Bag - +2 CMod, heals 1+2d3 WP {!hasDoctor && '(not in inventory)'}</span>
                      </label>
                    </div>
                    <div style={{ fontSize: '13px', color: '#7fc458', marginTop: '6px', fontStyle: 'italic' }}>{preview}</div>
                  </div>
                  <button onClick={triggerHeal} disabled={!healTargetCharId}
                    style={{ width: '100%', padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: !healTargetCharId ? 'not-allowed' : 'pointer', opacity: !healTargetCharId ? 0.5 : 1 }}>
                    Roll Medicine* on Target
                  </button>
                </>
              )
            })()}
            {showSpecialCheck === 'coordinated_effort' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Coordinated Effort</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>You roll first - any skill that fits your part of the plan. The outcome of your roll becomes a CMod bonus / penalty for everyone else in the chain. Each participant rolls their own skill for their part. Every roll gets +1 CMod per OTHER participant. Low Insight collapses the chain.</div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Your First Skill</div>
                  <select value={coordEffortSkill} onChange={e => setCoordEffortSkill(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {SKILLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Participants (include yourself)</div>
                  {entries.map(e => (
                    <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={coordEffortParticipants.has(e.character.id)} onChange={() => {
                        setCoordEffortParticipants(prev => { const next = new Set(prev); if (next.has(e.character.id)) next.delete(e.character.id); else next.add(e.character.id); return next })
                      }} style={{ accentColor: '#c0392b' }} />
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{e.character.name}</span>
                    </label>
                  ))}
                  {coordEffortParticipants.size > 1 && (
                    <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', marginTop: '6px' }}>
                      +{coordEffortParticipants.size - 1} CMod from {coordEffortParticipants.size - 1} other participant{coordEffortParticipants.size > 2 ? 's' : ''} chipping in.
                    </div>
                  )}
                </div>
                <button onClick={triggerCoordinatedEffort} disabled={coordEffortParticipants.size < 2 || !coordEffortSkill}
                  style={{ width: '100%', padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: coordEffortParticipants.size < 2 || !coordEffortSkill ? 'not-allowed' : 'pointer', opacity: coordEffortParticipants.size < 2 || !coordEffortSkill ? 0.5 : 1 }}>
                  Start Effort - You Roll First
                </button>
              </>
            )}
            {showSpecialCheck === 'opposed' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Opposed Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif' }}>Both sides roll until one succeeds and the other fails. Use standard skill rolls for each side.</div>
                <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textAlign: 'center', padding: '1rem' }}>
                  Have each participant roll their relevant skill check normally. Compare outcomes - first to get Success while opponent gets Failure wins.
                </div>
              </>
            )}
            <button onClick={() => setShowSpecialCheck(null)}
              style={{ marginTop: '1rem', width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Recruitment Modal (Communities Phase B) ─────────────────── */}
      {/* ── PICK STEP - bespoke recruitment setup (PC / NPC / community
          / approach / skill picker). Modal Unification Pass 2 keeps
          this picker as-is and delegates the RESULT step to the shared
          <RollModal> shell rendered separately below. */}
      {showRecruit && recruitStep === 'pick' && (() => {
        const eligibleNpcs = getRecruitEligibleNpcs()
        const pickedNpc = eligibleNpcs.find((n: any) => n.id === recruitNpcId)
        const rollerEntry = entries.find(e => e.character.id === recruitRollerId)
        const cmods = computeRecruitCmods()
        const suggestedSkills = suggestedSkillsForApproach(recruitApproach)
        // Recruit Tier-2 Phase C lock-gate. Pulled from the picked NPC's
        // recruit_locked_approaches array (per-NPC, global across PCs).
        // Today only 'convert' gets locked (via Convert+Intimidation
        // Failure). The picker disables locked buttons and the roll
        // gate refuses to fire if the selected approach is locked.
        const lockedApproaches: RecruitApproach[] = Array.isArray((pickedNpc as any)?.recruit_locked_approaches)
          ? ((pickedNpc as any).recruit_locked_approaches as string[]).filter((s): s is RecruitApproach => s === 'cohort' || s === 'conscript' || s === 'convert')
          : []
        const allApproachesLocked = lockedApproaches.length >= 3
        const currentApproachLocked = lockedApproaches.includes(recruitApproach)
        const hasAnyCommunity = recruitCommunityList.length > 0
        const resolvedCommunityName = recruitCommunityId === '__new__'
          ? (recruitNewCommunityName.trim() || '- new community -')
          : (recruitCommunityList.find(c => c.id === recruitCommunityId)?.name ?? '')
        const canRoll = !!rollerEntry && !!pickedNpc && !!recruitSkill && !currentApproachLocked && (
          recruitCommunityId === '__new__'
            ? recruitNewCommunityName.trim().length > 0
            : !!recruitCommunityId
        )
        const poachingNpcCommunity = recruitNpcId ? npcCommunityMap[recruitNpcId] : null
        return (
          <div onClick={closeRecruitModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Recruitment</div>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>
                Pick target & approach
              </div>

              <>
                {/* Roller PC - players only see their own PC; GMs
                      see everyone (they may orchestrate on behalf of
                      an absent player). Stops Percy from rolling a
                      First Impression or Recruitment Check *as* Ada. */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Rolling PC</div>
                    <select value={recruitRollerId} onChange={e => setRecruitRollerId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                      <option value="">- pick a PC -</option>
                      {entries.filter(e => gmLike || e.userId === userId).map(e => (
                        <option key={e.character.id} value={e.character.id}>{e.character.name} (INF {e.character.data?.rapid?.INF ?? 0})</option>
                      ))}
                    </select>
                  </div>

                  {/* Target NPC */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Target NPC</div>
                    {eligibleNpcs.length === 0 ? (
                      <div style={{ padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px' }}>
                        No NPCs visible on the map or in your sidebar. A GM needs to reveal one first.
                      </div>
                    ) : (
                      <select value={recruitNpcId} onChange={e => setRecruitNpcId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                        <option value="">- pick an NPC -</option>
                        {eligibleNpcs.map((n: any) => {
                          const mem = npcCommunityMap[n.id]
                          return <option key={n.id} value={n.id}>{n.name}{mem ? ` - already in ${mem.name}` : ''}</option>
                        })}
                      </select>
                    )}
                    {poachingNpcCommunity && (
                      <div style={{ marginTop: '6px', padding: '6px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                        ⚠ Poaching penalty: {pickedNpc?.name} is already in {poachingNpcCommunity.name} (−3 CMod)
                      </div>
                    )}
                  </div>

                  {/* Community */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Community</div>
                    {hasAnyCommunity ? (
                      <select value={recruitCommunityId} onChange={e => setRecruitCommunityId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                        <option value="">- pick a community -</option>
                        {recruitCommunityList.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.member_count} member{c.member_count === 1 ? '' : 's'})</option>
                        ))}
                        <option value="__new__">+ Found a new community</option>
                      </select>
                    ) : (
                      <div style={{ padding: '8px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                        No communities yet - this recruit will found a new one.
                        {(() => { if (recruitCommunityId !== '__new__') setRecruitCommunityId('__new__'); return null })()}
                      </div>
                    )}
                    {recruitCommunityId === '__new__' && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Name</div>
                        <input value={recruitNewCommunityName} onChange={e => setRecruitNewCommunityName(e.target.value)} placeholder="e.g. The Greenhouse"
                          style={{ width: '100%', padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          <input type="checkbox" checked={recruitNewCommunityPublic} onChange={e => setRecruitNewCommunityPublic(e.target.checked)} />
                          Make this community public (discoverable via LFG - coming soon)
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Approach */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
                      Approach
                      <HelpTooltip
                        title="Recruitment Approach"
                        text={
                          'Cohort - cooperative. The NPC joins for a shared interest, goal, or perceived benefit. Best with Persuasion, Inspiration, or Charm. Probationary through the next Morale Check; the outcome decides whether they stick around or drift off.\n\nConscript - coercive. The PC must have already established a credible threat (weapons drawn, leverage held, escape cut off) before the roll. Best with Intimidation or Bluff. Stays compliant only while the threat holds; the first Morale Check typically becomes an escape attempt.\n\nConvert - ideological. The NPC is brought in by shared belief, worldview, or cause. Best with Inspiration, Religion, or a relevant Ideology. Probationary through the first Morale Check; if they pass it, they become long-term committed.'
                        }
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['cohort', 'conscript', 'convert'] as RecruitApproach[]).map(ap => {
                        const isLocked = lockedApproaches.includes(ap)
                        const isSelected = recruitApproach === ap
                        return (
                          <button key={ap}
                            disabled={isLocked}
                            onClick={() => { if (isLocked) return; setRecruitApproach(ap); setRecruitSkill('') }}
                            title={isLocked ? `${ap.toUpperCase()} permanently locked on this NPC - a prior Intimidation Failure on a Convert attempt ruled out the approach. Try a different approach.` : undefined}
                            style={{ flex: 1, padding: '8px 6px', background: isLocked ? '#1a1010' : (isSelected ? '#2d5a1b' : '#242424'), border: `1px solid ${isLocked ? '#3a1a1a' : (isSelected ? '#7fc458' : '#3a3a3a')}`, borderRadius: '3px', color: isLocked ? '#5a3030' : (isSelected ? '#7fc458' : '#d4cfc9'), fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: isLocked ? 'not-allowed' : 'pointer', textDecoration: isLocked ? 'line-through' : 'none' }}>
                            {ap}{isLocked ? ' 🔒' : ''}
                          </button>
                        )
                      })}
                    </div>
                    {/* Lock-state warnings per Recruit Tier-2 Phase C. */}
                    {allApproachesLocked && pickedNpc && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                        🔒 <span style={{ fontWeight: 700 }}>All recruit approaches are permanently locked on this NPC.</span> Prior Intimidation Failures have ruled out every approach. This NPC cannot be recruited.
                      </div>
                    )}
                    {currentApproachLocked && !allApproachesLocked && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                        🔒 <span style={{ fontWeight: 700 }}>{recruitApproach.toUpperCase()} locked on this NPC.</span> Pick a different approach above.
                      </div>
                    )}
                    <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                      {recruitApproach === 'cohort' ? 'Shared interest or goal - joins until the next Morale Check.'
                        : recruitApproach === 'conscript' ? 'Coerced by credible threat - follows orders while coercion holds.'
                        : 'Shared belief or ideology - probationary through first Morale Check, then committed.'}
                    </div>
                    {/* Pressgang gate - explicit warning on Conscript so
                        the GM/players see this is coercion, not
                        persuasion, before rolling. A blocking confirm
                        fires on submit; this banner just makes it
                        visible earlier. */}
                    {recruitApproach === 'conscript' && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                        ⚠ <span style={{ fontWeight: 700 }}>Pressgang.</span> This is pressure, not persuasion. The PC must have established a credible threat (weapons drawn, leverage held, escape cut off) before the roll. You'll be asked to confirm on submit.
                      </div>
                    )}
                  </div>

                  {/* Skill */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Skill</div>
                    <select value={recruitSkill} onChange={e => setRecruitSkill(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                      <option value="">- pick a skill -</option>
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
                    <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>CMod stack</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: '#d4cfc9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>First Impression</span>
                        <span style={{ color: cmods.firstImpression > 0 ? '#7fc458' : cmods.firstImpression < 0 ? '#f5a89a' : '#5a5550' }}>
                          {cmods.firstImpression > 0 ? `+${cmods.firstImpression}` : cmods.firstImpression}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Inspiration skill SMod (+1/level)</span>
                        <span style={{ color: cmods.inspiration > 0 ? '#7fc458' : '#5a5550' }}>
                          {cmods.inspiration > 0 ? `+${cmods.inspiration}` : '0'}
                          {recruitSkill === 'Inspiration' && cmods.inspiration === 0 && (
                            <span style={{ color: '#5a5550', fontSize: '13px', marginLeft: '4px' }}>(in SMod above)</span>
                          )}
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
                        <input type="number" value={recruitGmCmod} onChange={e => setRecruitGmCmod(parseInt(e.target.value, 10) || 0)}
                          style={{ width: '60px', padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'right' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #2e2e5a', marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}>
                        <span>TOTAL CMOD</span>
                        <span style={{ color: cmods.total > 0 ? '#7fc458' : cmods.total < 0 ? '#f5a89a' : '#f5f2ee' }}>
                          {cmods.total > 0 ? `+${cmods.total}` : cmods.total}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pre-roll Insight Die - show only if the roller has ≥1 */}
                  {(() => {
                    const insightAvail = rollerEntry?.liveState?.insight_dice ?? 0
                    if (insightAvail < 1) return null
                    const pill = (active: boolean) => ({
                      flex: 1, padding: '8px 10px',
                      background: active ? '#2a102a' : '#242424',
                      border: `1px solid ${active ? '#d48bd4' : '#3a3a3a'}`,
                      borderRadius: '3px',
                      color: active ? '#fff' : '#d4cfc9',
                      fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
                    } as React.CSSProperties)
                    return (
                      <div style={{ marginBottom: '12px', padding: '10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px' }}>
                        <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
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
                      style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={executeRecruitRoll} disabled={!canRoll}
                      style={{ flex: 2, padding: '10px', background: canRoll ? '#c0392b' : '#2a1210', border: `1px solid ${canRoll ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: canRoll ? '#fff' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: canRoll ? 'pointer' : 'not-allowed' }}>
                    🎲 Roll Recruitment
                  </button>
                </div>
              </>

            </div>
          </div>
        )
      })()}

      {/* ── RESULT STEP - unified <RollModal> shell. Apprentice toggle
          + Insight Die rerolls live in renderOutcome since they're
          recruitment-specific (the shell's standard 2-die reroll
          plumbing doesn't cover the 3d6 Insight pre-roll case). */}
      <RollModal
        open={!!recruitResult && showRecruit && recruitStep === 'result'}
        onClose={closeRecruitModal}
        title="Recruitment"
        subtitle={recruitResult ? `${recruitResult.rollerName} → ${recruitResult.npcName}${recruitResult.approach ? ` · ${recruitResult.approach.charAt(0).toUpperCase()}${recruitResult.approach.slice(1)}` : ''}` : undefined}
        rollFormula="2d6 + INF + Skill + CMod"
        amod={recruitResult?.amod ?? 0}
        smod={recruitResult?.smod ?? 0}
        cmod={recruitResult?.cmod ?? 0}
        result={recruitResult ? {
          die1: recruitResult.die1,
          die2: recruitResult.die2,
          die3: recruitResult.die3,
          amod: recruitResult.amod,
          smod: recruitResult.smod,
          cmod: recruitResult.cmod,
          total: recruitResult.total,
          outcome: recruitResult.outcome,
          diceRolled: recruitResult.die3 !== undefined
            ? [recruitResult.die1, recruitResult.die2, recruitResult.die3]
            : [recruitResult.die1, recruitResult.die2],
        } satisfies SharedRollResult : null}
        renderOutcome={(r) => {
          if (!recruitResult) return null
          const outcome = recruitResult.outcome
          const isHighInsight = outcome === 'High Insight'
          const pcHasApprentice = recruitRollerId ? !!apprenticeByCharacter[recruitRollerId] : false
          const rollerEntry = entries.find(e => e.character.name === recruitResult.rollerName)
          const insightAvail = rollerEntry?.liveState?.insight_dice ?? 0
          const insightLocked = outcome === 'Low Insight' || outcome === 'High Insight'
          const showRerolls = insightAvail > 0 && !insightLocked
          return (
            <>
              {/* Math line */}
              <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', textAlign: 'center' }}>
                [{recruitResult.die1}+{recruitResult.die2}{recruitResult.die3 !== undefined ? `+${recruitResult.die3}` : ''}]
                {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              </div>
              {/* Outcome banner */}
              <div style={{ fontSize: '18px', fontWeight: 700, color: outcomeColor(outcome), fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                {outcome}
              </div>
              {/* Joined/failed card */}
              <div style={{ padding: '12px', background: recruitResult.inserted ? '#0f1a0f' : '#2a1210', border: `1px solid ${recruitResult.inserted ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', lineHeight: 1.4 }}>
                {recruitResult.inserted ? (
                  <>
                    <strong>{recruitResult.npcName}</strong> joined <strong>{recruitResult.communityName}</strong>
                    {recruitResult.apprenticeApplied ? ` as an Apprentice to ${recruitResult.rollerName}.` : ` as a ${recruitResult.approach.charAt(0).toUpperCase() + recruitResult.approach.slice(1)}.`}
                  </>
                ) : (
                  <>The attempt failed. <strong>{recruitResult.npcName}</strong> is not joining {recruitResult.communityName}.</>
                )}
              </div>
              {/* Reroll buttons (custom - supports up to 3 dice for the
                  3d6 Insight pre-roll case) */}
              {showRerolls && (
                <div style={{ marginBottom: '1rem', padding: '10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px' }}>
                  <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Spend Insight to Reroll</span>
                    <span style={{ color: '#cce0f5' }}>{insightAvail} available</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => rerollRecruitDie(1)}
                      style={{ flex: 1, padding: '8px 10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Re-roll Die 1 ({recruitResult.die1})
                    </button>
                    <button onClick={() => rerollRecruitDie(2)}
                      style={{ flex: 1, padding: '8px 10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Re-roll Die 2 ({recruitResult.die2})
                    </button>
                    {recruitResult.die3 !== undefined && (
                      <button onClick={() => rerollRecruitDie(3)}
                        style={{ flex: 1, padding: '8px 10px', background: '#1a0f1a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Re-roll Die 3 ({recruitResult.die3})
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', lineHeight: 1.4 }}>
                    Rerolling flips membership state if the outcome crosses the success line.
                  </div>
                </div>
              )}
              {/* Apprentice toggle - High Insight only */}
              {isHighInsight && recruitResult.inserted && !recruitResult.apprenticeApplied && !pcHasApprentice && (
                <div style={{ padding: '10px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>⭐ Apprentice Eligible</div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                    A Moment of High Insight (double-6) on this recruit allows {recruitResult.rollerName} to take {recruitResult.npcName} as an Apprentice (1 per PC).
                  </div>
                  <button onClick={async () => {
                    const motivationRoll = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1)
                    const complicationRoll = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1)
                    const motivation = MOTIVATIONS[motivationRoll]
                    const complication = COMPLICATIONS[complicationRoll]
                    const age = rollApprenticeAge()
                    const threeWords = rollThreeWords()
                    const apprenticeMeta = {
                      motivation, motivation_roll: motivationRoll,
                      complication, complication_roll: complicationRoll,
                      age,
                      three_words: threeWords,
                      setup_complete: false,
                    }
                    await supabase.from('community_members')
                      .update({
                        recruitment_type: 'apprentice',
                        apprentice_of_character_id: recruitRollerId,
                        apprentice_meta: apprenticeMeta,
                      })
                      .eq('community_id', recruitResult.communityId)
                      .eq('npc_id', recruitNpcId)
                    setRecruitResult(r => r ? { ...r, apprenticeApplied: true } : r)
                    if (recruitRollerId) void appendProgressionLog(
                      recruitRollerId,
                      'community',
                      `⭐ Took ${recruitResult.npcName} (age ${age}, ${threeWords.join(' / ')}) as your Apprentice - Motivation: ${motivation}, Complication: ${complication}.`,
                    )
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('tapestry:recruit-updated', { detail: { npcId: recruitNpcId } }))
                    }
                  }}
                    style={{ padding: '6px 12px', background: '#8b2e8b', border: '1px solid #d48bd4', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Take as Apprentice
                  </button>
                </div>
              )}
            </>
          )
        }}
        postRollCloseLabel="Close"
        onPostRollClose={closeRecruitModal}
      />
      {/* (legacy roll-step + result-step JSX consolidated above) */}
      {false && (() => null)()}

      {/* Stabilize - dedicated <RollModal> (Phase 1 migration, 2026-05-20).
          Replaces the pendingRoll path for the 🩸 STABILIZE dropdown.
          Single-target; the dropdown loops over mortally-wounded
          combatants in range and fires this modal one per click. */}
      <RollModal
        open={stabilizePending !== null}
        onClose={() => {
          setStabilizePending(null)
          setStabilizeResult(null)
          setStabilizeNarrativeText('')
          setStabilizeCmod(0)
        }}
        title="Stabilize"
        subtitle={stabilizePending
          ? `${stabilizePending.medicName} stabilizes ${stabilizePending.targetName}`
          : undefined}
        rollFormula="2d6 + RSN + Medicine + CMod"
        amod={stabilizePending?.amod ?? 0}
        smod={stabilizePending?.smod ?? 0}
        cmod={stabilizeCmod}
        setCmod={stabilizeResult ? undefined : setStabilizeCmod}
        onRoll={async () => {
          const sp = stabilizePending
          if (!sp || stabilizeResult) return
          const d1 = Math.floor(Math.random() * 6) + 1
          const d2 = Math.floor(Math.random() * 6) + 1
          const total = d1 + d2 + sp.amod + sp.smod + stabilizeCmod
          const outcome = getOutcome(total, d1, d2)
          // Save to log FIRST (before cascade) so the feed row exists
          // even if the cascade DB write hits an RLS gap. Mirrors the
          // legacy executeRoll ordering (saveRollToLog at L4873).
          const label = `${sp.medicName} - Stabilize ${sp.targetName}`
          await saveRollToLog(d1, d2, sp.amod, sp.smod, stabilizeCmod, label, sp.medicName, false, null)
          // Consume the medic's action - silent (no actionLabel) to
          // match the legacy pre-consume behavior. The saveRollToLog
          // row above is the only feed entry for the attempt.
          await consumeAction(sp.medicEntryId)
          // Apply cascade (death_countdown=null, incap_rounds set, or
          // failure narrative). Cascade returns the human-readable
          // result; surfaced in renderOutcome below.
          const narrative = await runStabilizeCascade({
            medicName: sp.medicName,
            targetName: sp.targetName,
            targetKind: sp.targetKind,
            outcome,
          })
          setStabilizeNarrativeText(narrative)
          setStabilizeResult({
            die1: d1, die2: d2,
            amod: sp.amod, smod: sp.smod, cmod: stabilizeCmod,
            total, outcome,
            insightAwarded: outcome === 'High Insight',
          })
          await rollsFeed.refetch()
        }}
        rollLabel="Roll Stabilize"
        result={stabilizeResult}
        renderOutcome={(r) => (
          <>
            {/* Math line */}
            <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', textAlign: 'center' }}>
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
            </div>
            {/* Outcome banner */}
            <div style={{ fontSize: '18px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
              {r.outcome}
            </div>
            {/* Cascade narrative - "Bob stabilized! Incap 3 rounds..." or "Failed to stabilize Bob." */}
            {stabilizeNarrativeText && (
              <div style={{ padding: '12px', background: isStabilizeSuccess(r.outcome) ? '#0f1a0f' : '#2a1210', border: `1px solid ${isStabilizeSuccess(r.outcome) ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', lineHeight: 1.4, textAlign: 'center' }}>
                {stabilizeNarrativeText}
              </div>
            )}
          </>
        )}
        postRollCloseLabel="Close"
        onPostRollClose={() => {
          setStabilizePending(null)
          setStabilizeResult(null)
          setStabilizeNarrativeText('')
          setStabilizeCmod(0)
        }}
      />

      {/* Distract - dedicated <RollModal> (Phase 2 migration, 2026-05-20).
          Replaces the pendingRoll path for the in-combat Distract button.
          Target picker rendered via preRollExtras - candidate list
          computed at button-click time and stashed in distractPending. */}
      <RollModal
        open={distractPending !== null}
        onClose={() => {
          setDistractPending(null)
          setDistractResult(null)
          setDistractNarrativeText('')
          setDistractCmod(0)
          setDistractTargetName('')
        }}
        title="Distract"
        subtitle={distractPending
          ? `${distractPending.rollerName} distracts ${distractTargetName || '...'}`
          : undefined}
        rollFormula="2d6 + INF + Skill + CMod"
        amod={distractPending?.amod ?? 0}
        smod={distractPending?.smod ?? 0}
        cmod={distractCmod}
        setCmod={distractResult ? undefined : setDistractCmod}
        preRollExtras={distractPending && !distractResult ? (
          <div style={{ marginBottom: '12px', padding: '10px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Target (Close range, ≤30 ft)
            </div>
            <select
              value={distractTargetName}
              onChange={(e) => setDistractTargetName(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
              <option value="">-- Pick a target --</option>
              {distractPending.candidates.map(c => (
                <option key={c.entryId} value={c.name}>
                  {c.name}{c.distFeet !== null ? ` (${c.distFeet} ft)` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        onRoll={async () => {
          const dp = distractPending
          if (!dp || distractResult || !distractTargetName) return
          // Resolve target entry from the current candidates list. This
          // is the entry the user selected; the cascade reads fresh
          // actions_remaining off initiativeOrder so a parallel update
          // doesn't lose its delta.
          const targetCand = dp.candidates.find(c => c.name === distractTargetName)
          if (!targetCand) return
          const d1 = Math.floor(Math.random() * 6) + 1
          const d2 = Math.floor(Math.random() * 6) + 1
          const total = d1 + d2 + dp.amod + dp.smod + distractCmod
          const outcome = getOutcome(total, d1, d2)
          // Save to log FIRST. Label matches legacy shape so
          // compactRollSummary's "Distract → <target>" auto-format
          // (lib/roll-helpers.ts L6643+) renders the feed row right.
          const label = `${dp.rollerName} - Distract`
          await saveRollToLog(d1, d2, dp.amod, dp.smod, distractCmod, label, dp.rollerName, false, distractTargetName)
          // Consume the active combatant's action - silent (no actionLabel)
          // to match the legacy pre-consume behavior.
          await consumeAction(dp.rollerEntryId)
          const narrative = await runDistractCascade({
            targetEntryId: targetCand.entryId,
            targetName: distractTargetName,
            outcome,
          })
          setDistractNarrativeText(narrative)
          setDistractResult({
            die1: d1, die2: d2,
            amod: dp.amod, smod: dp.smod, cmod: distractCmod,
            total, outcome,
            insightAwarded: outcome === 'High Insight',
          })
          await rollsFeed.refetch()
        }}
        rollLabel="Roll Distract"
        rollDisabled={!distractTargetName}
        result={distractResult}
        renderOutcome={(r) => {
          const delta = distractActionDelta(r.outcome)
          const applied = delta !== 0
          // Narrative banner color: green on action-drain (Success / WS / HI),
          // amber on Dire Failure ("Inspired" - bad for the medic), neutral
          // grey on shrug-off (Failure / LI).
          const bg = !applied ? '#1a1a1a' : (delta < 0 ? '#0f1a0f' : '#2a1810')
          const border = !applied ? '#3a3a3a' : (delta < 0 ? '#2d5a1b' : '#5a4a1b')
          return (
            <>
              <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', textAlign: 'center' }}>
                [{r.die1}+{r.die2}]
                {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                {r.outcome}
              </div>
              {distractNarrativeText && (
                <div style={{ padding: '12px', background: bg, border: `1px solid ${border}`, borderRadius: '3px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', lineHeight: 1.4, textAlign: 'center' }}>
                  {distractNarrativeText}
                </div>
              )}
            </>
          )
        }}
        postRollCloseLabel="Close"
        onPostRollClose={() => {
          setDistractPending(null)
          setDistractResult(null)
          setDistractNarrativeText('')
          setDistractCmod(0)
          setDistractTargetName('')
        }}
      />

      {/* Gut Instinct - dedicated <RollModal> (2026-05-20). The dice
          path lives here; the GM whisper-detail modal (already shipped
          2026-05-19 at L13280+) opens via the gut_instinct_resolved
          broadcast fired in the cascade. No DB state changes - the
          GM's whisper is the only outcome-dependent UX. Action consumed
          ONLY if the rolling PC is the active combatant during active
          combat (mirrors the legacy closeRollModal gate at L6884). */}
      <RollModal
        open={gutInstinctPending !== null}
        onClose={() => {
          setGutInstinctPending(null)
          setGutInstinctRollResult(null)
          setGutInstinctCmod(0)
        }}
        title="Gut Instinct"
        subtitle={gutInstinctPending
          ? `${gutInstinctPending.characterName} reads the room`
          : undefined}
        rollFormula="2d6 + PER (RSN + ACU) + Sub-skill + CMod"
        amod={gutInstinctPending?.amod ?? 0}
        smod={gutInstinctPending?.smod ?? 0}
        cmod={gutInstinctCmod}
        setCmod={gutInstinctRollResult ? undefined : setGutInstinctCmod}
        warnings={gutInstinctRollResult ? null : (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#0f1a1f', border: '1px solid #2e4a5a', borderRadius: '3px', textAlign: 'center' }}>
            Sub-skill: best of Psychology / Streetwise / Tactics. GM whispers a private detail on resolve.
          </div>
        )}
        onRoll={async () => {
          const gi = gutInstinctPending
          if (!gi || gutInstinctRollResult) return
          const d1 = Math.floor(Math.random() * 6) + 1
          const d2 = Math.floor(Math.random() * 6) + 1
          const total = d1 + d2 + gi.amod + gi.smod + gutInstinctCmod
          const outcome = getOutcome(total, d1, d2)
          const label = `${gi.characterName} - Gut Instinct`
          // Save first so the feed row exists regardless of whether the
          // downstream broadcast lands.
          await saveRollToLog(d1, d2, gi.amod, gi.smod, gutInstinctCmod, label, gi.characterName, false, null)
          // Action accounting: only if the rolling PC is the active
          // combatant in active combat. Mirrors closeRollModal's
          // didRoll + rollerIsActive gate (page.tsx L6884) so a GM
          // firing Gut Instinct on a PC out of combat doesn't drain
          // someone else's actions.
          if (combatActive) {
            const activeEntry = initiativeOrder.find(e => e.is_active)
            const myEntry = entries.find(e => e.character.name === gi.characterName)
            if (activeEntry && myEntry?.character.id && activeEntry.character_id === myEntry.character.id) {
              await consumeAction(activeEntry.id)
            }
          }
          // Cascade: broadcast for the GM whisper-detail modal. Skipped
          // silently when pcOwnerId is null (GM-led on an orphan PC).
          // Receiver gates on gmLikeRef + pcOwnerId !== userIdRef to
          // skip self-roll (no self-whisper).
          if (gi.pcOwnerId && initChannelRef.current) {
            initChannelRef.current.send({
              type: 'broadcast',
              event: 'gut_instinct_resolved',
              payload: { pcOwnerId: gi.pcOwnerId, characterName: gi.characterName, outcome },
            })
          }
          setGutInstinctRollResult({
            die1: d1, die2: d2,
            amod: gi.amod, smod: gi.smod, cmod: gutInstinctCmod,
            total, outcome,
            insightAwarded: outcome === 'High Insight' || outcome === 'Low Insight',
          })
          await rollsFeed.refetch()
        }}
        rollLabel="Roll Gut Instinct"
        result={gutInstinctRollResult}
        postRollCloseLabel="Close"
        onPostRollClose={() => {
          setGutInstinctPending(null)
          setGutInstinctRollResult(null)
          setGutInstinctCmod(0)
        }}
      />

      {/* Apprentice Creation Wizard - single instance, lifted from
          NpcCard / PlayerNpcCard so multiple open NPC cards share it.
          Mounts only when an Apprentice has been targeted via
          setSetupApprenticeNpcId; saves write to campaign_npcs +
          community_members.apprentice_meta + master PC progression log. */}
      {setupApprenticeNpcId && (() => {
        const targetNpc = campaignNpcs.find((n: any) => n.id === setupApprenticeNpcId)
        const bond = apprenticeBondsByNpcId[setupApprenticeNpcId]
        if (!targetNpc || !bond) {
          // Defensive - if the data drifted between trigger and render,
          // close the modal silently rather than rendering empty.
          setSetupApprenticeNpcId(null)
          return null
        }
        return (
          <ApprenticeCreationWizard
            communityMemberId={bond.communityMemberId}
            campaignNpcId={targetNpc.id}
            npcCurrentName={targetNpc.name}
            masterCharacterId={bond.masterCharacterId}
            apprenticeMeta={bond.apprenticeMeta}
            onClose={() => setSetupApprenticeNpcId(null)}
            onSaved={() => {
              setSetupApprenticeNpcId(null)
              // Refresh the apprentice bond map so the Set Up button
              // hides on the card. The campaign_npcs realtime channel
              // handles RAPID + skills + name refresh automatically.
              void loadPlayerNpcCommunityMap(id)
            }}
          />
        )
      })()}

      {/* Trade Negotiation modal - single-roll opposed Barter check.
          Resolves against an NPC or a community stockpile; on apply,
          items move both ways via the existing inventory write paths. */}
      {tradeTarget && myEntry && (() => {
        const charData = myEntry.character.data ?? {}
        const pcInventory = (charData.inventory ?? []) as InventoryItem[]
        const pcAcuMod = charData.rapid?.ACU ?? 0
        const pcSkills = (charData.skills ?? []) as Array<{ skillName: string; level: number }>
        const pcBarter = pcSkills.find(s => s.skillName === 'Barter')?.level ?? 0
        let target: { kind: 'npc' | 'community'; id: string; name: string; inventory: InventoryItem[]; barterSmod: number; subtext?: string } | null = null
        if (tradeTarget.kind === 'npc') {
          const npc: any = campaignNpcs.find((n: any) => n.id === tradeTarget.id)
          if (!npc) { setTradeTarget(null); return null }
          const npcInv: InventoryItem[] = Array.isArray(npc.inventory) ? npc.inventory : []
          const npcSkillEntries: Array<{ name: string; level: number }> = npc.skills?.entries ?? []
          const npcBarter = npcSkillEntries.find(s => s.name === 'Barter')?.level ?? 0
          target = { kind: 'npc', id: npc.id, name: npc.name, inventory: npcInv, barterSmod: npcBarter, subtext: npc.npc_type ? npc.npc_type.toUpperCase() : undefined }
        } else {
          // Community target - resolved by the async useEffect above.
          // While the fetch is in flight, render nothing; the modal
          // pops in once the data lands.
          if (!tradeCommunityData) return null
          target = {
            kind: 'community',
            id: tradeTarget.id,
            name: tradeCommunityData.name,
            inventory: tradeCommunityData.inventory,
            barterSmod: tradeCommunityData.barterSmod,
            subtext: tradeCommunityData.subtext,
          }
        }
        if (!target) return null
        return (
          <TradeNegotiationModal
            pcName={myEntry.character.name}
            pcInventory={pcInventory}
            pcAcuMod={pcAcuMod}
            pcBarterSmod={pcBarter}
            target={target}
            onClose={() => setTradeTarget(null)}
            onRelationshipDamage={async () => {
              // PC rolled Dire Failure or Low Insight against an NPC.
              // Decrement (PC, NPC) relationship_cmod by 1, clamped to
              // ±3. Atomic via the bump RPC - pre-fix this was a
              // select-then-insert/update with both a unique-constraint
              // race and a lost-update window.
              const { error: bumpErr } = await supabase
                .rpc('bump_npc_relationship_cmod', {
                  p_npc_id: tradeTarget!.id,
                  p_character_id: myEntry.character.id,
                  p_delta: -1,
                })
              if (bumpErr) reportSupabaseError(bumpErr, 'barter-relationship-damage')
            }}
            onApply={async ({ pcGives, pcGets, rollSummary, outcome }) => {
              // Apply the deal as a single batch:
              //   - Decrement PC inventory by pcGives, increment by pcGets
              //   - Decrement target inventory by pcGets, increment by pcGives
              //
              // Wrapped in try/catch so any mid-flow failure (the NPC was
              // deleted on another client, an RLS write got denied, the
              // stockpile row vanished) lands as a user-facing alert
              // instead of a silent dev-console throw.
              try {
                const charId = myEntry.character.id
                const newPcInv: InventoryItem[] = structuredClone(pcInventory)
                for (const g of pcGives) {
                  const idx = newPcInv.findIndex(i => i.name === g.name && i.custom === g.custom)
                  if (idx >= 0) {
                    newPcInv[idx].qty -= g.selectedQty
                    if (newPcInv[idx].qty <= 0) newPcInv.splice(idx, 1)
                  }
                }
                for (const r of pcGets) {
                  const idx = newPcInv.findIndex(i => i.name === r.name && i.custom === r.custom)
                  if (idx >= 0) newPcInv[idx].qty += r.selectedQty
                  else newPcInv.push({ ...r, qty: r.selectedQty })
                }
                // PC write
                const { error: charErr } = await supabase
                  .from('characters')
                  .update({ data: { ...charData, inventory: newPcInv } })
                  .eq('id', charId)
                if (charErr) throw new Error(`PC inventory write failed: ${charErr.message}`)
                setEntries(prev => prev.map(e => e.character.id === charId
                  ? { ...e, character: { ...e.character, data: { ...e.character.data, inventory: newPcInv } } }
                  : e))
                // Target write
                if (tradeTarget!.kind === 'npc') {
                  const npc: any = campaignNpcs.find((n: any) => n.id === tradeTarget!.id)
                  if (!npc) throw new Error('NPC vanished mid-trade')
                  const newNpcInv: InventoryItem[] = structuredClone(npc.inventory ?? [])
                  for (const r of pcGets) {
                    const idx = newNpcInv.findIndex(i => i.name === r.name && i.custom === r.custom)
                    if (idx >= 0) {
                      newNpcInv[idx].qty -= r.selectedQty
                      if (newNpcInv[idx].qty <= 0) newNpcInv.splice(idx, 1)
                    }
                  }
                  for (const g of pcGives) {
                    const idx = newNpcInv.findIndex(i => i.name === g.name && i.custom === g.custom)
                    if (idx >= 0) newNpcInv[idx].qty += g.selectedQty
                    else newNpcInv.push({ ...g, qty: g.selectedQty })
                  }
                  const { error: npcErr } = await supabase.from('campaign_npcs')
                    .update({ inventory: newNpcInv })
                    .eq('id', tradeTarget!.id)
                  if (npcErr) throw new Error(`NPC inventory write failed: ${npcErr.message}`)
                  setCampaignNpcs(prev => prev.map((n: any) => n.id === tradeTarget!.id ? { ...n, inventory: newNpcInv } : n))
                  setRosterNpcs(prev => prev.map((n: any) => n.id === tradeTarget!.id ? { ...n, inventory: newNpcInv } : n))
                  initChannelRef.current?.send({ type: 'broadcast', event: 'npc_inventory_changed', payload: { npcId: tradeTarget!.id } })
                } else {
                  // Community stockpile target. PC gets items decrement
                  // existing stockpile rows (delete if qty hits 0); PC
                  // gives items insert/upsert by (name, custom). Each
                  // step is error-checked - a mid-loop failure now
                  // throws so the user sees it instead of leaving the
                  // stockpile in a half-applied state.
                  const communityId = tradeTarget!.id
                  for (const r of pcGets) {
                    const { data: existing, error: selErr } = await supabase
                      .from('community_stockpile_items')
                      .select('id, qty')
                      .eq('community_id', communityId).eq('name', r.name).eq('custom', r.custom)
                      .maybeSingle()
                    if (selErr) throw new Error(`Stockpile read failed: ${selErr.message}`)
                    if (!existing) continue
                    const remaining = ((existing as any).qty ?? 0) - r.selectedQty
                    if (remaining <= 0) {
                      const { error: delErr } = await supabase.from('community_stockpile_items').delete().eq('id', (existing as any).id)
                      if (delErr) throw new Error(`Stockpile delete failed: ${delErr.message}`)
                    } else {
                      const { error: updErr } = await supabase.from('community_stockpile_items').update({ qty: remaining }).eq('id', (existing as any).id)
                      if (updErr) throw new Error(`Stockpile update failed: ${updErr.message}`)
                    }
                  }
                  for (const g of pcGives) {
                    const { data: existing, error: selErr } = await supabase
                      .from('community_stockpile_items')
                      .select('id, qty')
                      .eq('community_id', communityId).eq('name', g.name).eq('custom', g.custom)
                      .maybeSingle()
                    if (selErr) throw new Error(`Stockpile read failed: ${selErr.message}`)
                    if (existing) {
                      const { error: updErr } = await supabase.from('community_stockpile_items')
                        .update({ qty: ((existing as any).qty ?? 0) + g.selectedQty })
                        .eq('id', (existing as any).id)
                      if (updErr) throw new Error(`Stockpile update failed: ${updErr.message}`)
                    } else {
                      const { error: insErr } = await supabase.from('community_stockpile_items').insert({
                        community_id: communityId,
                        name: g.name, qty: g.selectedQty, enc: g.enc, rarity: g.rarity,
                        notes: g.notes, custom: g.custom,
                      })
                      if (insErr) throw new Error(`Stockpile insert failed: ${insErr.message}`)
                    }
                  }
                }
                // Single roll-log summary.
                const giveStr = pcGives.map(g => `${g.name}×${g.selectedQty}`).join(', ') || '(nothing)'
                const getStr = pcGets.map(g => `${g.name}×${g.selectedQty}`).join(', ') || '(nothing)'
                await insertRollLog({
                  campaign_id: id, user_id: userId, character_name: myEntry.character.name,
                  label: `⚖ Trade with ${target!.name} · ${rollSummary} · gave ${giveStr} got ${getStr}`,
                  die1: outcome.pcDie1, die2: outcome.pcDie2,
                  amod: pcAcuMod, smod: pcBarter, cmod: 0,
                  total: outcome.pcTotal,
                  outcome: OUTCOME.barter,
                })
                setTradeTarget(null)
              } catch (err: any) {
                console.error('[barter] apply failed:', err)
                alert(`Trade failed: ${err?.message ?? 'unknown error'}`)
                // Re-pull entries + NPCs so the UI converges with the
                // server's actual state in case the PC write succeeded
                // but the target write failed.
                void loadEntries(id)
                const { data: cnpcs } = await getCampaignNpcs(id)
                if (cnpcs) setCampaignNpcs(cnpcs)
              }
            }}
          />
        )
      })()}

      {/* Insight Die Save Modal */}
      {insightSavePrompt && (() => {
        const isMyPC = (insightSavePrompt as any).targetUserId === userId
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🩸</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#c0392b', marginBottom: '8px' }}>
              Mortal Injury
            </div>
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>
              <strong>{insightSavePrompt.targetName}</strong> is mortally wounded!
            </div>
            {isMyPC ? (
              /* Player's own PC - they choose */
              insightSavePrompt.insightDice > 0 ? (
                <>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '1.5rem' }}>
                    Trade ALL Insight Dice to survive with 1 WP and 1 RP?
                    <br /><span style={{ fontSize: '13px', color: '#7fc458' }}>({insightSavePrompt.insightDice} Insight {insightSavePrompt.insightDice === 1 ? 'Die' : 'Dice'} will be lost)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleInsightSave(true)}
                      style={{ flex: 1, padding: '10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Trade All Dice - Survive
                    </button>
                    <button onClick={() => handleInsightSave(false)}
                      style={{ flex: 1, padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Accept Fate
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '14px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', marginBottom: '1.5rem' }}>
                    No Insight Dice available to trade. {insightSavePrompt.targetName} will die if not stabilized.
                  </div>
                  <button onClick={() => { setInsightSavePrompt(null); initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound_resolved', payload: {} }) }}
                    style={{ width: '100%', padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Understood
                  </button>
                </>
              )
            ) : (
              /* GM or other player - read-only view */
              <>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '1.5rem' }}>
                  {insightSavePrompt.insightDice > 0
                    ? `Waiting for ${insightSavePrompt.targetName}'s player to decide whether to trade ${insightSavePrompt.insightDice} Insight ${insightSavePrompt.insightDice === 1 ? 'Die' : 'Dice'}...`
                    : `${insightSavePrompt.targetName} has no Insight Dice. Waiting for player to acknowledge...`}
                </div>
                <button onClick={() => setInsightSavePrompt(null)}
                  style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
        )
      })()}

      {/* Gut Instinct GM detail modal - opens on the GM/Thriver client
          when a player resolves a Gut Instinct roll. GM types a private
          detail; Send writes a chat_messages whisper to the rolling
          player. Skip dismisses without sending. Fires per Xero
          option-a 2026-05-19 (feed narrative + private whisper). */}
      {gutInstinctPrompt && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, background: '#1a1a1a', border: '1px solid #5a4a1b', borderRadius: '4px', width: '420px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #3a3a3a', background: '#2a2010' }}>
            <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
              Gut Instinct - {gutInstinctPrompt.outcome}
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '2px' }}>
              {gutInstinctPrompt.characterName}
            </div>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', lineHeight: 1.5 }}>
              Whisper a private detail to {gutInstinctPrompt.characterName}'s player. They'll see it in their Chat tab. Skip if nothing to add.
            </div>
            <textarea
              value={gutInstinctDetail}
              onChange={e => setGutInstinctDetail(e.target.value)}
              autoFocus
              rows={4}
              placeholder="What does the PC sense?"
              style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #3a3a3a', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => { setGutInstinctPrompt(null); setGutInstinctDetail('') }}
              disabled={gutInstinctSending}
              style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: gutInstinctSending ? 'not-allowed' : 'pointer' }}>
              Skip
            </button>
            <button
              onClick={async () => {
                const detail = gutInstinctDetail.trim()
                if (!detail || gutInstinctSending || !gutInstinctPrompt) return
                setGutInstinctSending(true)
                const { error } = await supabase.from('chat_messages').insert({
                  campaign_id: id,
                  user_id: userId,
                  character_name: 'GM',
                  message: `Gut Instinct: ${detail}`,
                  is_whisper: true,
                  recipient_user_id: gutInstinctPrompt.pcOwnerId,
                })
                setGutInstinctSending(false)
                if (error) {
                  console.error('[gut-instinct] whisper insert error:', error.message)
                  alert('Failed to send whisper: ' + error.message)
                  return
                }
                setGutInstinctPrompt(null)
                setGutInstinctDetail('')
              }}
              disabled={!gutInstinctDetail.trim() || gutInstinctSending}
              style={{ padding: '6px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: (!gutInstinctDetail.trim() || gutInstinctSending) ? 'not-allowed' : 'pointer', opacity: (!gutInstinctDetail.trim() || gutInstinctSending) ? 0.5 : 1 }}>
              {gutInstinctSending ? 'Sending...' : 'Send Whisper'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// Option B "subdued pill" - neutral dark bg, no border, 8px radius. The
// three args are preserved for source compatibility, but only `color`
// (text color) still affects the visual. `bg` / `border` are ignored in
// favor of a unified `#1a1a1a` pill that hovers to `#242424` via the
// `.hdr-btn` class rule in globals.css. Keeps the muscle-memory of
// color-coded headers by carrying the hue on the TEXT only, so 6-7
// buttons in a row no longer compete as solid colored rectangles.
const hdrBtn = (_bg: string, color: string, _border: string): React.CSSProperties => ({
  padding: '4px 14px', background: '#1a1a1a', border: 'none', borderRadius: '8px',
  color, fontSize: '13px', fontFamily: 'Carlito, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  height: '28px', minWidth: '70px', boxSizing: 'border-box',
  appearance: 'none', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0, verticalAlign: 'middle',
})
