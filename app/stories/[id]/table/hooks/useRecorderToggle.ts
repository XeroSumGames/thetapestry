// useRecorderToggle - owns the tab-local playtest-recorder lifecycle for the
// live-session view. Extracted from page.tsx (table re-arch Step 2).
//
// Behavior preserved verbatim:
//   - TAB-LOCAL recorder. No DB writes, no realtime subscription here; each
//     browser controls its own capture. (The shared-gate model was removed in
//     e53211b along with the orphan /record admin page.)
//   - Mount: resume capture if a previous tab on this campaign persisted the
//     enabled flag to localStorage (refresh / back-nav / GM-cascade start from
//     another tab); otherwise mirror the in-memory recorder flag.
//   - toggleRecorder is GM-cascaded: it does the local work (wipe on start /
//     auto-download on stop) AND broadcasts recorder_start / recorder_stop on
//     the passed channel ref so every connected tab flips in lockstep. The
//     matching .on('broadcast', ...) handlers (still in the realtime effect in
//     page.tsx until Step 3d) call the setRecorderEnabled returned here.
//
// channelRef is the init/presence channel ref (page.tsx initChannelRef).

import { useEffect, useState } from 'react'
import {
  downloadDump as recorderDownloadDump,
  wipeBuffer as recorderWipeBuffer,
  setEnabled as recorderSetEnabled,
  getRecorder,
  readCampaignEnabled,
  writeCampaignEnabled,
} from '../../../../../lib/playtest-recorder'

export interface UseRecorderToggle {
  recorderEnabled: boolean
  recorderToggling: boolean
  toggleRecorder: () => Promise<void>
  setRecorderEnabled: React.Dispatch<React.SetStateAction<boolean>>
}

export function useRecorderToggle(
  campaignId: string,
  channelRef: { current: any },
): UseRecorderToggle {
  const [recorderEnabled, setRecorderEnabled] = useState<boolean>(false)
  const [recorderToggling, setRecorderToggling] = useState<boolean>(false)

  useEffect(() => {
    const persisted = readCampaignEnabled(campaignId)
    if (persisted) {
      recorderSetEnabled(true)
      setRecorderEnabled(true)
    } else {
      const r = getRecorder()
      if (r) setRecorderEnabled(!!r.enabled)
    }
  }, [campaignId])

  async function toggleRecorder() {
    if (recorderToggling) return
    setRecorderToggling(true)
    const next = !recorderEnabled
    if (next) {
      recorderWipeBuffer()
      recorderSetEnabled(true)
      writeCampaignEnabled(campaignId, true)
      channelRef.current?.send({ type: 'broadcast', event: 'recorder_start', payload: { campaignId } })
    } else {
      recorderDownloadDump()
      recorderSetEnabled(false)
      writeCampaignEnabled(campaignId, false)
      channelRef.current?.send({ type: 'broadcast', event: 'recorder_stop', payload: { campaignId } })
    }
    setRecorderEnabled(next)
    setRecorderToggling(false)
  }

  return { recorderEnabled, recorderToggling, toggleRecorder, setRecorderEnabled }
}
