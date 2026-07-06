'use client'
// usePostgresSubscription - a single-table postgres_changes subscription
// (grand re-architecture, lib/realtime seam).
//
// useCampaignChannel is the right primitive for CAMPAIGN-scoped realtime
// (broadcasts + campaign-filtered postgres on a `campaign_${id}` channel).
// But some realtime is GLOBAL, not campaign-scoped - the world map's
// `map_pins` and `whispers` feeds watch a whole table for any client. This
// is the primitive for that case: one channel, one table, sentry-wrapped,
// handler kept fresh via a ref so the subscription only churns on
// `channelName`. Pass a null/undefined channelName to not subscribe (lets a
// caller gate on "only while this tab is open").
//
// Like useCampaignChannel, this is the ONLY sanctioned home for a raw
// `.channel()` outside campaign scope - the check-arch seam-leakage ratchet
// and the dep-cruiser rule both require `.channel(` to live in lib/realtime.

import { useEffect, useRef } from 'react'
import { createClient } from '../supabase-browser'
import { wrapDbChange } from '../sentry-realtime'
import { record } from '../playtest-recorder'

export interface PostgresSubscriptionConfig {
  /** A short stable label for Sentry tagging (e.g. 'map_pins:*'). */
  label: string
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema?: string
  /** e.g. `campaign_id=eq.${id}`. Omit to watch the whole table. */
  filter?: string
  handler: (payload: any) => void | Promise<void>
  /**
   * Opt-in reconcile refetch. postgres_changes is best-effort: a visible,
   * still-subscribed tab can silently drop an event (Chrome throttling, a
   * flaky RLS'd delivery) and never recover until a manual refresh - the
   * 2026-07-06 review confirmed RollsFeed/TableChat could permanently miss a
   * roll or chat message this way. When a reconcile fn is supplied it runs on
   * (re)subscribe, on tab-return-to-visible, and on a low-frequency poll, so
   * convergence never depends on catching one ephemeral event. Mirrors the
   * hardened CampaignMap pin-sync pattern. Make its presence stable across
   * renders (the interval/listener are wired once per channel).
   */
  reconcile?: () => void | Promise<void>
  /** Reconcile poll cadence in ms (default 30000). Ignored without reconcile. */
  reconcileMs?: number
}

export function usePostgresSubscription(
  channelName: string | null | undefined,
  config: PostgresSubscriptionConfig,
): void {
  // Mirror config into a ref every render so the subscribed callback always
  // sees the latest handler (current closures) without resubscribing.
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (!channelName) return
    const supabase = createClient()
    const c = configRef.current
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event: c.event ?? '*', schema: c.schema ?? 'public', table: c.table, ...(c.filter ? { filter: c.filter } : {}) },
        wrapDbChange(c.label, (payload: any) => configRef.current.handler(payload)),
      )
      .subscribe((status: string) => {
        record('realtime', { direction: 'status', channel: channelName, status })
        // Catch-up on (re)subscribe: a dropped or late-joined channel reloads
        // instead of sitting on stale data until a manual refresh.
        if (status === 'SUBSCRIBED') void configRef.current.reconcile?.()
      })

    // Reconcile safety net (opt-in). Only wired when a reconcile fn is given,
    // so callers that don't need it (e.g. map_pins/whispers) keep exactly their
    // old behavior - no extra interval or listener.
    let onVisible: (() => void) | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    if (c.reconcile) {
      onVisible = () => { if (!document.hidden) void configRef.current.reconcile?.() }
      document.addEventListener('visibilitychange', onVisible)
      poll = setInterval(() => { if (!document.hidden) void configRef.current.reconcile?.() }, c.reconcileMs ?? 30000)
    }

    return () => {
      try { supabase.removeChannel(channel) } catch { /* already torn down */ }
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
      if (poll) clearInterval(poll)
    }
    // ONLY channelName - the handler + reconcile stay fresh via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName])
}
