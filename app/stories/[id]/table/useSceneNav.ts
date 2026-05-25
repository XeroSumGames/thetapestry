// Scene navigation for the table header's "Tactical Map" dropdown
// (2026-05-25): the list of the campaign's scenes plus activate / create
// handlers. Lives in a hook so the LOC-ratcheted table page stays lean;
// the raw queries live in lib/data/scenes.
import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listCampaignScenes, activateCampaignScene, createCampaignScene, ensurePartyOnScene as ensurePartyOnSceneData, type PartyPc } from '../../../../lib/data/scenes'
import { claimToggleLock } from '../../../../lib/toggle-lock'

export interface SceneOption { id: string; name: string; is_active: boolean }
export type { PartyPc }

interface Params {
  campaignId: string
  supabase: SupabaseClient
  refreshKey: number  // page's tactical_scenes sub bumps this -> list re-loads
  setShowTacticalMap: (v: boolean) => void
  setTokenRefreshKey: (fn: (k: number) => number) => void
  refreshMapTokenIds: () => void
  initChannelRef: MutableRefObject<{ send: (m: any) => void } | null>
  // Current party PCs - opening a scene auto-ensures each has a live token
  // on it (Xero 2026-05-25: "don't make me place them each time; a char can
  // be in as many scenes as the campaign has"). Read fresh on each open.
  getParty: () => PartyPc[]
}

export function useSceneNav({ campaignId, supabase, refreshKey, setShowTacticalMap, setTokenRefreshKey, refreshMapTokenIds, initChannelRef, getParty }: Params) {
  const [sceneList, setSceneList] = useState<SceneOption[]>([])

  const reload = useCallback(async () => {
    const { data } = await listCampaignScenes(supabase, campaignId)
    setSceneList((data ?? []) as SceneOption[])
  }, [supabase, campaignId])

  useEffect(() => { void reload() }, [reload, refreshKey])

  // Side-effects after a scene becomes active: show the tactical map, refresh
  // tokens, broadcast the switch so other clients follow, re-load the list.
  const onActivate = useCallback((sceneId: string) => {
    setShowTacticalMap(true)
    setTokenRefreshKey(k => k + 1)
    refreshMapTokenIds()
    initChannelRef.current?.send({ type: 'broadcast', event: 'scene_activated', payload: { sceneId } })
    void reload()
  }, [setShowTacticalMap, setTokenRefreshKey, refreshMapTokenIds, initChannelRef, reload])

  // Best-effort auto-populate the party on a scene when it's opened
  // (logic + raw queries live in lib/data/scenes per the seam rule).
  const ensurePartyOnScene = useCallback(async (sceneId: string) => {
    try { await ensurePartyOnSceneData(supabase, sceneId, getParty()) } catch { /* never blocks activation */ }
  }, [supabase, getParty])

  const openScene = useCallback(async (sceneId: string) => {
    await activateCampaignScene(supabase, campaignId, sceneId)
    await ensurePartyOnScene(sceneId)
    onActivate(sceneId)
  }, [supabase, campaignId, onActivate, ensurePartyOnScene])

  const createNewScene = useCallback(async () => {
    if (!claimToggleLock(`new-scene:${campaignId}`)) return // guard double-click
    const sid = await createCampaignScene(supabase, campaignId, 'New Scene')
    if (sid) { await ensurePartyOnScene(sid); onActivate(sid) }
  }, [supabase, campaignId, onActivate, ensurePartyOnScene])

  return { sceneList, openScene, createNewScene }
}
