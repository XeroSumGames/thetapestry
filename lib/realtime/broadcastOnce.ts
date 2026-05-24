// broadcastOnce - fire a single campaign broadcast through a throwaway
// channel (grand re-architecture, lib/realtime seam).
//
// Some senders aren't subscribed to the channel they broadcast on - the
// vehicle popout fires `token_moved` / `turn_advance_requested` /
// `firing_arc_toggle` at the tactical/initiative channels it only listens
// to indirectly. The old code hand-rolled `supabase.channel(name)
// .subscribe(status => { if SUBSCRIBED send; removeChannel })` inline at
// each site. This centralises that open-send-close dance behind the seam,
// typed against the broadcast registry so a wrong event/payload fails tsc.
//
// `holdMs` keeps the channel alive briefly after the send so the server
// can fan the message out before teardown - the vehicle_updated fallback
// path relies on that 500ms hold. Default 0 = tear down immediately
// (matches the sites that awaited removeChannel right after send).

import { createClient } from '../supabase-browser'
import type { CampaignBroadcastEvent, CampaignBroadcastPayloads } from './events'

export function broadcastOnce<E extends CampaignBroadcastEvent>(
  channelName: string,
  event: E,
  payload: CampaignBroadcastPayloads[E],
  opts: { holdMs?: number } = {},
): Promise<void> {
  const supabase = createClient()
  const ch = supabase.channel(channelName)
  return new Promise<void>((resolve) => {
    ch.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED') return
      try {
        await ch.send({ type: 'broadcast', event, payload })
      } finally {
        if (opts.holdMs && opts.holdMs > 0) {
          setTimeout(() => { try { supabase.removeChannel(ch) } catch { /* already gone */ } }, opts.holdMs)
        } else {
          try { await supabase.removeChannel(ch) } catch { /* already gone */ }
        }
        resolve()
      }
    })
  })
}
