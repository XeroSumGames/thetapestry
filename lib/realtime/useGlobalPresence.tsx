'use client'
// Global presence - ONE channel for the whole app (lib/realtime seam).
//
// WHY A SINGLE PROVIDER: presence used to be owned by TWO components on
// mutually-exclusive LayoutShell branches - Sidebar (normal routes) and a
// GlobalPresence tracker (full-width routes: table / vehicle / popouts). On a
// route transition the outgoing one's removeChannel is async while the incoming
// one calls channel('global_presence'), which can hand back the still-leaving
// instance; its .subscribe() then no-ops (a joined channel ignores subscribe),
// so track() never runs and the user silently vanishes from the roster for the
// rest of the session. Mounting ONE provider at the app root means the channel
// is created once and never torn down on navigation - the race is gone.
//
// IDLE: presence is "has a live socket", not "is actually here". A browser tab
// left open (or restored on launch) keeps the websocket alive for weeks, so
// someone who last played in June still showed as ONLINE NOW. Each client now
// tracks an `active_at` stamp and refreshes it on real user activity (throttled);
// anyone past IDLE_MS is reported separately as idle, so the count means
// "actually around" instead of "has a tab open somewhere".

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '../supabase-browser'
import { getCachedAuth } from '../auth-cache'

/** Past this much inactivity a present user is reported idle, not active. */
export const IDLE_MS = 20 * 60 * 1000
/** At most one re-track per this interval, however much the user moves. */
const ACTIVITY_THROTTLE_MS = 60 * 1000
/** Re-evaluate idle/active on a timer so status decays without presence events. */
const IDLE_SWEEP_MS = 60 * 1000

export interface GlobalPresenceState {
  /** Every user id with a live connection (tab open), active or idle. */
  presentIds: string[]
  /** Present AND active within IDLE_MS - what "Survivors present" should show. */
  activeIds: string[]
}

const PresenceContext = createContext<GlobalPresenceState>({ presentIds: [], activeIds: [] })

/** Read the shared roster. Safe anywhere under PresenceProvider. */
export function useGlobalPresence(): GlobalPresenceState {
  return useContext(PresenceContext)
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalPresenceState>({ presentIds: [], activeIds: [] })
  // Latest raw presence state, so the idle sweep can re-derive without an event.
  const rawRef = useRef<Record<string, any[]>>({})

  useEffect(() => {
    const supabase = createClient()
    let channel: any = null
    let cancelled = false
    let lastTrack = 0
    let sweep: ReturnType<typeof setInterval> | null = null
    let onActivity: (() => void) | null = null

    // Split the roster into present vs active using each entry's newest
    // active_at meta. Entries from before this change (no active_at) are
    // treated as active so nobody vanishes mid-rollout.
    const derive = () => {
      const raw = rawRef.current
      const now = Date.now()
      const presentIds = Object.keys(raw)
      const activeIds = presentIds.filter(id => {
        const metas = raw[id] ?? []
        const newest = metas.reduce((acc: number, m: any) => {
          const t = m?.active_at ? Date.parse(m.active_at) : NaN
          return Number.isFinite(t) && t > acc ? t : acc
        }, 0)
        if (newest === 0) return true // legacy entry with no stamp
        return now - newest < IDLE_MS
      })
      setState({ presentIds, activeIds })
    }

    ;(async () => {
      const { user } = await getCachedAuth()
      if (cancelled || !user) return
      channel = supabase.channel('global_presence', { config: { presence: { key: user.id } } })
      channel.on('presence', { event: 'sync' }, () => {
        rawRef.current = channel.presenceState() ?? {}
        derive()
      })
      channel.subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return
        lastTrack = Date.now()
        await channel.track({ user_id: user.id, active_at: new Date().toISOString() })
      })

      // Refresh active_at on genuine interaction, throttled so a mousemove
      // storm doesn't spam the channel.
      onActivity = () => {
        if (document.hidden) return
        const now = Date.now()
        if (now - lastTrack < ACTIVITY_THROTTLE_MS) return
        lastTrack = now
        void channel?.track({ user_id: user.id, active_at: new Date().toISOString() })
      }
      for (const ev of ['pointerdown', 'keydown', 'visibilitychange'] as const) {
        document.addEventListener(ev, onActivity)
      }
      sweep = setInterval(derive, IDLE_SWEEP_MS)
    })()

    return () => {
      cancelled = true
      if (onActivity) {
        for (const ev of ['pointerdown', 'keydown', 'visibilitychange'] as const) {
          document.removeEventListener(ev, onActivity)
        }
      }
      if (sweep) clearInterval(sweep)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return <PresenceContext.Provider value={state}>{children}</PresenceContext.Provider>
}
