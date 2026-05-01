'use client'
// useBellDropdown — shared scaffolding for the header bell components
// (NotificationBell, MessagesBell). Both follow the same shape:
//
//   1. Resolve the current user via getCachedAuth().
//   2. Run an initial data load keyed off that user.
//   3. Subscribe to a Supabase realtime channel keyed off the user.
//   4. Toggle a dropdown open/closed.
//   5. Close the dropdown on outside-click.
//   6. Tear down the channel on unmount.
//
// Pulling the scaffolding here removes ~120 lines of duplicated effect
// boilerplate across the two bells, and means future bell additions
// (auth events, presence pings, etc.) only need to be added in one place.
//
// What this hook intentionally does NOT do:
//   • Hold the items list — different bells store different shapes
//     (Notification[] vs ConvItem[]); each bell keeps its own state.
//   • Render anything — bells render their own buttons + dropdowns.
//
// Race-safety: the mount effect uses a `cancelled` flag so a fast unmount
// (e.g. React Strict Mode double-invoke or rapid route nav) can't leave
// orphaned channels behind. Same pattern as the table-page guard.

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { createClient } from '../supabase-browser'
import { getCachedAuth } from '../auth-cache'

type SupabaseChannel = ReturnType<ReturnType<typeof createClient>['channel']>

export interface UseBellDropdownOptions {
  /** Prefix for the realtime channel — final name becomes `${channelKey}_${userId}`. */
  channelKey: string
  /** Initial data load — runs once after the user resolves, before channel subscribe. */
  loadItems: (userId: string) => void | Promise<void>
  /** Wire up `.on(...)` handlers on the supplied channel and return the
   *  `.subscribe()` chain result. The hook will store + later remove
   *  whatever you return. The `userId` arg is the auth'd user — capture
   *  it in your handler closures so they don't go stale. */
  setupChannel: (channel: SupabaseChannel, userId: string) => SupabaseChannel
}

export interface UseBellDropdownResult {
  /** Auth'd user id once `getCachedAuth()` has resolved; null until then. */
  userId: string | null
  /** Dropdown open state. */
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  /** Attach to the dropdown's outermost element. Outside-click on this
   *  ref's tree closes the dropdown. */
  containerRef: RefObject<HTMLDivElement | null>
}

export function useBellDropdown(opts: UseBellDropdownOptions): UseBellDropdownResult {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<SupabaseChannel | null>(null)

  // Stash the latest opts in a ref so the mount effect only runs once
  // even though the bell may pass fresh callback identities each render.
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { user } = await getCachedAuth()
      if (!user || cancelled) return
      setUserId(user.id)
      await optsRef.current.loadItems(user.id)
      if (cancelled) return
      const channel = supabase.channel(`${optsRef.current.channelKey}_${user.id}`)
      channelRef.current = optsRef.current.setupChannel(channel, user.id)
    }
    init()
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // Mount-only on purpose. Auth + channel setup don't need to re-run
    // when the bell re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Outside-click → close.
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return { userId, open, setOpen, containerRef }
}
