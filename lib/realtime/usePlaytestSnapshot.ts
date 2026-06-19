'use client'
// Registers window.__tapestrySnapshot for the playtest recorder (Item 3).
// The recorder calls this defensively before every error/mark and once on dump.
// All fields are IDs, flags, or counts - no free-text or PII.

import { useEffect } from 'react'

export interface PlaytestSnapshotFields {
  active_entry_id: string | null
  active_combatant_name: string | null
  actions_remaining: number | null
  scene_id: string | null
  scene_kind: 'tactical' | 'campaign'
  open_modal: string | null
  selected_token_id: string | null
  selected_npc_id: string | null
  combat_active: boolean
  my_character_id: string | null
  token_count: number
  initiative_count: number
}

export function usePlaytestSnapshot(snap: PlaytestSnapshotFields) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const frozen = { ...snap }
    window.__tapestrySnapshot = () => frozen
    return () => { if (window.__tapestrySnapshot) window.__tapestrySnapshot = undefined }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(snap))
}
