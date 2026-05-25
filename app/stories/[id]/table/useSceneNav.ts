// Scene navigation for the table header's "Tactical Map" dropdown
// (2026-05-25): the list of the campaign's scenes plus activate / create
// handlers. Lives in a hook so the LOC-ratcheted table page stays lean;
// the raw queries live in lib/data/scenes.
import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listCampaignScenes, activateCampaignScene, createCampaignScene } from '../../../../lib/data/scenes'
import { claimToggleLock } from '../../../../lib/toggle-lock'

export interface SceneOption { id: string; name: string; is_active: boolean }

interface Params {
  campaignId: string
  supabase: SupabaseClient
  refreshKey: number  // page's tactical_scenes sub bumps this -> list re-loads
  setShowTacticalMap: (v: boolean) => void
  setTokenRefreshKey: (fn: (k: number) => number) => void
  refreshMapTokenIds: () => void
  initChannelRef: MutableRefObject<{ send: (m: any) => void } | null>
}

export function useSceneNav({ campaignId, supabase, refreshKey, setShowTacticalMap, setTokenRefreshKey, refreshMapTokenIds, initChannelRef }: Params) {
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

  const openScene = useCallback(async (sceneId: string) => {
    await activateCampaignScene(supabase, campaignId, sceneId)
    onActivate(sceneId)
  }, [supabase, campaignId, onActivate])

  const createNewScene = useCallback(async () => {
    if (!claimToggleLock(`new-scene:${campaignId}`)) return // guard double-click
    const sid = await createCampaignScene(supabase, campaignId, 'New Scene')
    if (sid) onActivate(sid)
  }, [supabase, campaignId, onActivate])

  return { sceneList, openScene, createNewScene }
}
