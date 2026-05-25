'use client'
// Per-USER, client-only "hide this pin on MY map" set, kept in localStorage.
// Distinct from the GM's shared campaign_pins.revealed flag: this only
// declutters the current viewer's own map + pin list and never changes what
// the GM or other players see (Xero 2026-05-25 - players asked for a personal
// hide). Both CampaignPins (the radio) and CampaignMap (marker filter) use it;
// a custom event keeps them in sync within the tab, 'storage' across tabs.
import { useCallback, useEffect, useState } from 'react'

const keyFor = (campaignId: string) => `pins_hidden_${campaignId}`
const SYNC_EVENT = 'pins-hidden-changed'

export function useHiddenPins(campaignId: string) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
    const read = () => {
      try {
        const v = JSON.parse(localStorage.getItem(keyFor(campaignId)) || '[]')
        setHidden(new Set(Array.isArray(v) ? v : []))
      } catch { setHidden(new Set()) }
    }
    read()
    window.addEventListener(SYNC_EVENT, read)
    window.addEventListener('storage', read)
    return () => { window.removeEventListener(SYNC_EVENT, read); window.removeEventListener('storage', read) }
  }, [campaignId])

  const toggle = useCallback((pinId: string) => {
    try {
      const cur = new Set<string>(JSON.parse(localStorage.getItem(keyFor(campaignId)) || '[]'))
      cur.has(pinId) ? cur.delete(pinId) : cur.add(pinId)
      localStorage.setItem(keyFor(campaignId), JSON.stringify([...cur]))
      window.dispatchEvent(new Event(SYNC_EVENT))
    } catch {}
  }, [campaignId])

  return { hidden, toggle, isHidden: (id: string) => hidden.has(id) }
}
