'use client'
// useGlobalPresenceTracker - tracks the current user on the cross-platform
// `global_presence` channel (grand re-architecture, lib/realtime seam).
//
// The "Survivors present" count in Sidebar reads this channel, but Sidebar
// unmounts on full-width routes (table / vehicle / popouts), so users there
// fell out of the count. An always-mounted layer calls this hook to keep the
// user tracked everywhere. Presence is keyed by user.id, so multiple trackers
// for one user dedup to a single presence key (the count is distinct keys).
//
// This is the sanctioned home for the raw `.channel()` - the check-arch
// seam-leakage ratchet + the dep-cruiser rule both require `.channel(` to
// live in lib/realtime. Tracker-only; the roster/count is read in Sidebar.

import { useEffect } from 'react'
import { createClient } from '../supabase-browser'
import { getCachedAuth } from '../auth-cache'

export function useGlobalPresenceTracker(): void {
  useEffect(() => {
    const supabase = createClient()
    let channel: any = null
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (cancelled || !user) return
      // `enabled: true` is REQUIRED for track() to work. realtime-js computes
      // presence_enabled = (has a presence binding) OR config.presence.enabled.
      // This tracker registers NO `.on('presence')` binding (only Sidebar reads
      // the roster), so without the flag the channel joined with presence
      // DISABLED and track() was silently dropped - the user never appeared in
      // "Survivors present" on any full-width route (table/vehicle/popouts).
      channel = supabase.channel('global_presence', { config: { presence: { key: user.id, enabled: true } } })
      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') await channel.track({ user_id: user.id })
      })
    })()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])
}
