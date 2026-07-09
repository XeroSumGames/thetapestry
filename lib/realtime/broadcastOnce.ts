// broadcastOnce - fire a single campaign broadcast on a topic this caller
// does NOT own the lifecycle of (grand re-architecture, lib/realtime seam).
//
// Some senders aren't the owner of the channel they broadcast on - the vehicle
// popout fires `token_moved` / `firing_arc_toggle` at the tactical channel, and
// the clock drainers fire `lasting_damage_check_request` / `clock_advanced` at
// channels a table page or campaign sheet already holds.
//
// THE TRAP this helper exists to avoid (realtime-js facts):
//   - `supabase.channel(topic)` returns the EXISTING channel instance when a
//     component already subscribed that topic (params ignored).
//   - `.subscribe()` on an already-joined channel is a SILENT NO-OP: the
//     callback never fires, so an "open-subscribe-send-close" dance HANGS
//     forever on a topic a page already owns.
//   - `removeChannel()` on that shared instance tears down the PAGE's live
//     subscription.
//   - BUT `.send({type:'broadcast'})` on an un-joined channel auto-falls back
//     to a REST POST, so a broadcast never needs a subscribe at all.
//
// So the correct primitive NEVER subscribes and NEVER removes a channel it did
// not create: if a live holder exists, send over it and leave it alone; else
// create an ephemeral channel, send (REST fallback), and remove only OUR own.
//
// `holdMs` delays teardown of an ephemeral channel briefly. With the REST
// fallback the POST is already delivered when send() resolves, so it is
// largely vestigial now, but kept so existing call sites (vehicle_updated's
// 500ms) are byte-compatible. It never delays teardown of a reused holder
// channel (we never tear those down).

import { createClient } from '../supabase-browser'
import type { CampaignBroadcastEvent, CampaignBroadcastPayloads } from './events'

/**
 * Untyped core: send one broadcast on `channelName` without owning its
 * lifecycle. Reuses a live holder's channel if present (send only), else uses
 * an ephemeral channel (send via REST fallback, then remove OUR channel).
 * Never subscribes; never removes a channel it did not create. Best-effort -
 * a failed send resolves rather than throwing (the caller's postgres/poll net
 * is the correctness backstop).
 */
export async function sendBroadcastRaw(
  channelName: string,
  event: string,
  payload: unknown,
  opts: { holdMs?: number } = {},
): Promise<void> {
  const supabase = createClient()
  const realtimeTopic = `realtime:${channelName}`
  const existing = supabase.getChannels().find((c: any) => c.topic === realtimeTopic)
  if (existing) {
    // A live component owns this topic. Send over its channel (websocket push
    // if joined, REST fallback if mid-join). Do NOT subscribe or remove it.
    try { await existing.send({ type: 'broadcast', event, payload }) } catch { /* best-effort */ }
    return
  }
  // No holder: our own ephemeral channel. Never joined, so send() REST-posts.
  const ch = supabase.channel(channelName)
  try {
    await ch.send({ type: 'broadcast', event, payload })
  } catch {
    /* best-effort */
  } finally {
    const cleanup = () => { try { supabase.removeChannel(ch) } catch { /* already gone */ } }
    if (opts.holdMs && opts.holdMs > 0) setTimeout(cleanup, opts.holdMs)
    else cleanup()
  }
}

/**
 * Typed wrapper over `sendBroadcastRaw` for the campaign broadcast registry -
 * a wrong event name or payload shape fails tsc.
 */
export function broadcastOnce<E extends CampaignBroadcastEvent>(
  channelName: string,
  event: E,
  payload: CampaignBroadcastPayloads[E],
  opts: { holdMs?: number } = {},
): Promise<void> {
  return sendBroadcastRaw(channelName, event, payload, opts)
}
