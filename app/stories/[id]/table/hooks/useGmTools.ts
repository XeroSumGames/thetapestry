'use client'
// useGmTools - owns the GM-Tools modal state that used to live as ~30 loose
// useState declarations in the table page (and got threaded as props into the
// extracted GM modals). Grand re-architecture Phase 3.
//
// APPROACH: grow this hook ONE modal-cluster at a time. The page destructures
// everything it returns, so every existing call site (the modal mounts, the
// header GM-Tools menu, the FeedColumn award-prefill) is UNCHANGED - the state
// just lives here now instead of inline. Behavior-identical and tsc-verified
// (a missed name fails to resolve). Once all clusters are in, the modals can
// take the returned object directly and the prop-threading drops away.
import { useState } from 'react'
import { type CampaignSnapshot } from '../../../../../lib/campaign-snapshot'

export function useGmTools() {
  // --- Grant Advantage cluster (GM Tools -> Grant Advantage + the rolls-feed award button) ---
  const [showGrantAdvantage, setShowGrantAdvantage] = useState(false)
  const [grantPcId, setGrantPcId] = useState<string>('')
  const [grantSkill, setGrantSkill] = useState<string>('')
  const [grantCmod, setGrantCmod] = useState<number>(1)
  const [grantDescription, setGrantDescription] = useState<string>('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  // Phase 4: source_roll_log_id pre-fill when granting via the per-row award
  // button on the rolls feed; null when granting free-form from GM Tools.
  const [grantSourceRollLogId, setGrantSourceRollLogId] = useState<string | null>(null)

  // --- Restore cluster (GM Tools -> Restore to full health: NPCs + destructible objects) ---
  const [showRestorePicker, setShowRestorePicker] = useState(false)
  const [restoreNpcIds, setRestoreNpcIds] = useState<Set<string>>(new Set())
  const [restoring, setRestoring] = useState(false)
  // Snapshot of damaged destructible scene_tokens at the moment Restore opens.
  // We can't rely on mapTokens because it's only populated while TacticalMap
  // is mounted, so opening Restore from the campaign-map view silently lost
  // every crate/barrel/vehicle.
  const [restoreObjects, setRestoreObjects] = useState<{ id: string; name: string; wp_max: number }[]>([])

  return {
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
  }
}
