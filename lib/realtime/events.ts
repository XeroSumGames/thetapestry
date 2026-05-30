// Typed broadcast event registry for the campaign realtime channel
// (grand re-architecture Phase 1a, lib/realtime seam).
//
// Today the table page broadcasts 23 distinct events through ad-hoc
// `.channel().send({ type: 'broadcast', event, payload })` calls with
// `payload: any`. This registry is the single typed source of truth for
// those event names + payload shapes, consumed by `useCampaignChannel`.
//
// PAYLOAD POLICY: most events are "refetch-only" - the sender carries no
// data and the receiver just re-pulls from the DB (e.g. turn_changed ->
// loadInitiative). Those are typed `EmptyPayload` ({} only). Events that
// DO carry data are typed precisely. When an event whose payload is still
// `EmptyPayload` turns out to carry data as its send sites migrate in
// Phase 3, tighten it HERE (tsc will flag the mismatch at the send site,
// which is exactly when we want to learn the real shape). Strict by
// default; loosen deliberately.

/** An event that carries no payload - receiver refetches from the DB. */
export type EmptyPayload = Record<string, never>

/**
 * Map of every campaign broadcast event to its payload type.
 * Add new events here (and only here) so the union stays the single
 * source of truth.
 */
export interface CampaignBroadcastPayloads {
  // --- Combat / initiative (refetch-only) ---
  combat_started: EmptyPayload
  combat_ended: EmptyPayload
  turn_changed: EmptyPayload
  // Sent by the vehicle popout when a mounted-weapon attack zeroes the
  // actor's actions; the table page's handler ignores the payload and
  // runs its full nextTurn() flow. entryId is carried but vestigial.
  turn_advance_requested: { entryId?: string }

  // --- Tactical map ---
  token_changed: EmptyPayload
  // token_moved: a token's grid position changed (TacticalMap drags, the
  // vehicle popout's MOVE HERE snaps). Receivers refetch; payload empty.
  token_moved: EmptyPayload
  scene_activated: EmptyPayload
  tactical_shared: { shared: boolean; sceneId?: string | null }
  tactical_unshared: EmptyPayload
  // Vehicle popout -> TacticalMap: the campaigns.vehicles JSON changed
  // (board/disembark/damage), and the popout's mounted-weapon arc toggle.
  vehicle_updated: { vehicle_id: string }
  firing_arc_toggle: { vehicleName: string; weaponIdx: number }
  // GM-driven view sync on the tactical map (zoom snap + one-shot Share View).
  tactical_zoom: { zoom: number }
  tactical_view_share: { scrollLeft: number; scrollTop: number; zoom: number; imgScale: number }
  // GM ping marker (also fired by players in green); rides its own ping_${id} channel.
  gm_ping: { gx: number; gy: number; color: string }

  // --- Health / damage ---
  // pc_damaged carries an optimistic patch; npc_damaged is EITHER {npcId,patch}
  // (single-target fast path) OR {} (coalesced multi-target -> receiver refetches),
  // so both fields are optional.
  pc_damaged: { stateId: string; patch: Record<string, unknown> }
  npc_damaged: { npcId?: string; patch?: Record<string, unknown> }
  pc_mortal_wound: { stateId: string; targetName: string; newWP: number; newRP: number; phyAmod: number; insightDice: number; targetUserId?: string | null }
  pc_mortal_wound_resolved: EmptyPayload

  // --- Post-combat / checks (tightened 3d.2b as the init-channel handlers migrated) ---
  infection_check_request: { targetUserId: string; name: string; amod: number }
  lasting_damage_check_request: { isPc: boolean; targetUserId: string | null; name: string }
  gut_instinct_resolved: { pcOwnerId: string; characterName: string; outcome: string }

  // --- Roster / inventory ---
  npcs_revealed: EmptyPayload
  npc_inventory_changed: EmptyPayload
  inventory_transfer: EmptyPayload

  // --- Session / feed ---
  logs_cleared: EmptyPayload
  player_kicked: { userId: string }
  recorder_start: EmptyPayload
  recorder_stop: EmptyPayload
  sync: EmptyPayload
}

/** Every valid broadcast event name. */
export type CampaignBroadcastEvent = keyof CampaignBroadcastPayloads

/**
 * Runtime list of all event names. Useful for iteration / validation /
 * tests. Kept in lockstep with `CampaignBroadcastPayloads` - the
 * `satisfies` clause makes tsc fail if an event is added to the type but
 * not here (or vice versa).
 */
export const CAMPAIGN_BROADCAST_EVENTS = [
  'combat_started',
  'combat_ended',
  'turn_changed',
  'turn_advance_requested',
  'token_changed',
  'token_moved',
  'scene_activated',
  'tactical_shared',
  'tactical_unshared',
  'vehicle_updated',
  'firing_arc_toggle',
  'tactical_zoom',
  'tactical_view_share',
  'gm_ping',
  'pc_damaged',
  'npc_damaged',
  'pc_mortal_wound',
  'pc_mortal_wound_resolved',
  'infection_check_request',
  'lasting_damage_check_request',
  'gut_instinct_resolved',
  'npcs_revealed',
  'npc_inventory_changed',
  'inventory_transfer',
  'logs_cleared',
  'player_kicked',
  'recorder_start',
  'recorder_stop',
  'sync',
] as const satisfies readonly CampaignBroadcastEvent[]

// Compile-time completeness guard: if the array and the interface ever
// drift, one of these assignments fails tsc.
type _EventsCoverArray = CampaignBroadcastEvent extends (typeof CAMPAIGN_BROADCAST_EVENTS)[number] ? true : never
const _eventsAreComplete: _EventsCoverArray = true
void _eventsAreComplete
