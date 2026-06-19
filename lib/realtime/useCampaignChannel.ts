'use client'
// useCampaignChannel - the single realtime primitive for a campaign
// (grand re-architecture Phase 1a, lib/realtime seam).
//
// THE PROBLEM IT SOLVES: today every realtime consumer hand-rolls
// `supabase.channel(...).on(...).subscribe()` inside a big effect whose
// dependency array includes state/setters. When any of those deps change
// the channel tears down and resubscribes - the recurring stale-closure /
// "one client stops seeing the other" bug class (smoke R2). And only the
// table page wraps its handlers in Sentry; the other components don't.
//
// THE FIX, in one place:
//   1. Effect deps are `[campaignId]` ONLY. The channel subscribes once
//      per campaign and never churns on unrelated re-renders.
//   2. Handlers stay fresh WITHOUT resubscribing: the config is mirrored
//      into a ref every render, and the (stable) subscribed callbacks read
//      the latest handler from that ref at dispatch time. So you get
//      current closures over current state with a stable subscription.
//   3. Every handler is auto-wrapped with the Sentry guard
//      (wrapBroadcast / wrapDbChange) - 100% coverage, not opt-in.
//   4. `send(event, payload)` is typed against the CampaignBroadcastPayloads
//      registry, so a wrong event name or payload shape fails tsc.
//
// Nothing consumes this yet (Phase 1a is pure addition). The table page
// migrates onto it in Phase 3 (useTableRealtime), then the other six
// god-components follow. Its real acceptance gate is the 2-client smoke.

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '../supabase-browser'
import { wrapBroadcast, wrapDbChange } from '../sentry-realtime'
import { record } from '../playtest-recorder'
import type { CampaignBroadcastEvent, CampaignBroadcastPayloads } from './events'

/** A broadcast handler receives the (typed) payload directly. */
type BroadcastHandlers = Partial<{
  [E in CampaignBroadcastEvent]: (payload: CampaignBroadcastPayloads[E]) => void | Promise<void>
}>

/** A postgres_changes subscription on one table. */
export interface PostgresSubscription {
  /** A short stable label for Sentry tagging (e.g. 'initiative_order:*'). */
  label: string
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema?: string
  /** e.g. `campaign_id=eq.${campaignId}` */
  filter?: string
  handler: (payload: any) => void | Promise<void>
}

export interface CampaignChannelConfig {
  /** Broadcast event -> handler. Only the events you list are subscribed. */
  broadcasts?: BroadcastHandlers
  /** postgres_changes subscriptions. */
  postgres?: PostgresSubscription[]
  /**
   * Channel name. Defaults to `campaign_${campaignId}`. Pass an explicit
   * name only if you need more than one channel per campaign (the table
   * page historically used several - migrating them onto one named
   * channel is part of Phase 3).
   */
  channelName?: string
}

export interface CampaignChannelHandle {
  /** Type-checked broadcast send. No-op until the channel has subscribed. */
  send: <E extends CampaignBroadcastEvent>(event: E, payload: CampaignBroadcastPayloads[E]) => void
  /** Escape hatch for code mid-migration that still needs the raw channel. */
  channelRef: React.MutableRefObject<any>
}

export function useCampaignChannel(
  campaignId: string | null | undefined,
  config: CampaignChannelConfig,
): CampaignChannelHandle {
  // Mirror config into a ref every render so subscribed callbacks always
  // see the latest handlers (current closures) without resubscribing.
  const configRef = useRef(config)
  configRef.current = config

  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!campaignId) return
    const supabase = createClient()
    const name = configRef.current.channelName ?? `campaign_${campaignId}`
    let channel = supabase.channel(name)

    // Broadcast handlers. We register one listener per event NAME present
    // at subscribe time; the listener dispatches to the latest handler in
    // the ref, so handler bodies stay fresh across renders.
    const broadcastEvents = Object.keys(configRef.current.broadcasts ?? {}) as CampaignBroadcastEvent[]
    for (const event of broadcastEvents) {
      channel = channel.on(
        'broadcast',
        { event },
        wrapBroadcast(event, (msg: any) => {
          const fn = configRef.current.broadcasts?.[event]
          // Cast: the registry guarantees the payload shape for `event`,
          // but TS can't narrow the union index here.
          return fn?.(msg?.payload as never)
        }),
      )
    }

    // postgres_changes subscriptions.
    for (const sub of configRef.current.postgres ?? []) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: sub.event, schema: sub.schema ?? 'public', table: sub.table, ...(sub.filter ? { filter: sub.filter } : {}) },
        wrapDbChange(sub.label, (payload: any) => {
          // Re-read from the ref so the handler closure stays fresh.
          const live = configRef.current.postgres?.find(p => p.label === sub.label)
          return (live?.handler ?? sub.handler)(payload)
        }),
      )
    }

    channel.subscribe((status: string) => {
      record('realtime', { direction: 'status', channel: name, status })
    })
    channelRef.current = channel

    return () => {
      try { supabase.removeChannel(channel) } catch { /* already torn down */ }
      channelRef.current = null
    }
    // ONLY campaignId. This is the whole point - do not add deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const send = useCallback<CampaignChannelHandle['send']>((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }, [])

  return { send, channelRef }
}
