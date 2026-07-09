// Regression net for lib/realtime/broadcastOnce.ts (sendBroadcastRaw) - the
// 2026-07-09 T4 realtime fix. The primitive must NEVER subscribe (subscribe
// no-ops + hangs on an already-joined channel) and must NEVER removeChannel a
// channel it did not create (that tears down a live page's subscription).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: any = {}

vi.mock('../../lib/supabase-browser', () => ({
  createClient: () => state.client,
}))

import { sendBroadcastRaw } from '../../lib/realtime/broadcastOnce'

function makeClient() {
  const existingSend = vi.fn(async () => 'ok')
  const ephemeralSend = vi.fn(async () => 'ok')
  const ephemeralSubscribe = vi.fn()
  const removeChannel = vi.fn()
  const channels: any[] = []
  const client = {
    _channels: channels,
    getChannels: () => channels,
    channel: vi.fn((_name: string) => {
      // Ephemeral channel the helper creates when no holder exists.
      const ch = { send: ephemeralSend, subscribe: ephemeralSubscribe }
      return ch
    }),
    removeChannel,
  }
  return { client, existingSend, ephemeralSend, ephemeralSubscribe, removeChannel, channels }
}

describe('sendBroadcastRaw', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('reuses a live holder channel: sends over it, never subscribes, never removes it', async () => {
    const m = makeClient()
    // A live component already holds realtime:tac_1.
    m.channels.push({ topic: 'realtime:tac_1', send: m.existingSend })
    state.client = m.client

    await sendBroadcastRaw('tac_1', 'token_moved', { tokenId: 't1' })

    expect(m.existingSend).toHaveBeenCalledWith({ type: 'broadcast', event: 'token_moved', payload: { tokenId: 't1' } })
    expect(m.client.channel).not.toHaveBeenCalled()   // did not create an ephemeral channel
    expect(m.ephemeralSubscribe).not.toHaveBeenCalled() // never subscribes
    expect(m.removeChannel).not.toHaveBeenCalled()      // never tears down the holder
  })

  it('no holder: creates an ephemeral channel, sends (REST fallback), removes only its own', async () => {
    const m = makeClient()
    state.client = m.client // getChannels() empty

    await sendBroadcastRaw('tac_1', 'clock_advanced', { day: 5 })

    expect(m.client.channel).toHaveBeenCalledWith('tac_1')
    expect(m.ephemeralSend).toHaveBeenCalledWith({ type: 'broadcast', event: 'clock_advanced', payload: { day: 5 } })
    expect(m.ephemeralSubscribe).not.toHaveBeenCalled() // REST fallback needs no subscribe
    expect(m.removeChannel).toHaveBeenCalledTimes(1)     // cleans up its own ephemeral channel
  })

  it('a failed send never throws (best-effort)', async () => {
    const m = makeClient()
    m.channels.push({ topic: 'realtime:tac_1', send: vi.fn(async () => { throw new Error('socket down') }) })
    state.client = m.client
    await expect(sendBroadcastRaw('tac_1', 'sync', {})).resolves.toBeUndefined()
  })

  it('holdMs delays teardown of an ephemeral channel', async () => {
    vi.useFakeTimers()
    const m = makeClient()
    state.client = m.client
    await sendBroadcastRaw('tac_1', 'vehicle_updated', { vehicle_id: 'v1' }, { holdMs: 500 })
    expect(m.removeChannel).not.toHaveBeenCalled() // not yet
    vi.advanceTimersByTime(500)
    expect(m.removeChannel).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
