import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('playtest-recorder per-campaign persisted flag', () => {
  beforeEach(() => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
      key: () => null,
      length: 0,
    })
  })

  it('readCampaignEnabled returns false when key absent', async () => {
    const mod = await import('../../lib/playtest-recorder')
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('writeCampaignEnabled(true) flips readCampaignEnabled to true', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
  })

  it('writeCampaignEnabled(false) clears the key', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
    mod.writeCampaignEnabled('camp-a', false)
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('isolates campaigns from each other', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
    expect(mod.readCampaignEnabled('camp-b')).toBe(false)
  })

  it('readCampaignEnabled tolerates a thrown localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('quota / disabled') },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    })
    const mod = await import('../../lib/playtest-recorder')
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('flushAllNow no-ops when recorder is not enabled', async () => {
    const mod = await import('../../lib/playtest-recorder')
    // No window.__tapestryRecorder set -> getRecorder() returns null.
    // flushAllNow should silently no-op, not throw.
    expect(() => mod.flushAllNow()).not.toThrow()
  })
})

describe('playtest-recorder redact() body-strip rule', () => {
  beforeEach(() => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    })
  })

  // Helper: call record() on an enabled recorder and inspect the last buffer entry.
  async function recordAndPeek(kind: any, data: Record<string, unknown>) {
    const mod = await import('../../lib/playtest-recorder')
    // Install a minimal recorder state
    const win = window as any
    win.__tapestryRecorder = {
      buffer: [],
      startedAt: Date.now(),
      userId: null,
      userEmail: null,
      sessionId: 'test',
      pathname: '/',
      enabled: true,
    }
    mod.record(kind, data)
    return win.__tapestryRecorder.buffer[win.__tapestryRecorder.buffer.length - 1]
  }

  it('strips "body" key from net event data', async () => {
    const ev = await recordAndPeek('net', {
      method: 'POST',
      url_path: '/rest/v1/characters',
      status: 400,
      ok: false,
      duration_ms: 42,
      body: '{"name":"Alice","data":{"skills":["secret"]}}',
    })
    expect(ev.data.method).toBe('POST')
    expect(ev.data.body).toBe('[body-stripped]')
  })

  it('strips "response_body" key', async () => {
    const ev = await recordAndPeek('net', {
      method: 'GET', url_path: '/rest/v1/items', status: 200, ok: true, duration_ms: 10,
      response_body: '{"rows":[{"secret":"value"}]}',
    })
    expect(ev.data.response_body).toBe('[body-stripped]')
  })

  it('strips "request_body" key', async () => {
    const ev = await recordAndPeek('net', {
      method: 'POST', url_path: '/rest/v1/rpc/fn', status: 200, ok: true, duration_ms: 10,
      request_body: '{"arg":"sensitive"}',
    })
    expect(ev.data.request_body).toBe('[body-stripped]')
  })

  it('redacts token/password keys', async () => {
    const ev = await recordAndPeek('custom', {
      label: 'test',
      token: 'abc123',
      authorization: 'Bearer xyz',
      password: 'hunter2',
    })
    expect(ev.data.token).toBe('[redacted]')
    expect(ev.data.authorization).toBe('[redacted]')
    expect(ev.data.password).toBe('[redacted]')
  })

  it('keeps safe net event fields intact', async () => {
    const ev = await recordAndPeek('net', {
      method: 'GET',
      url_path: '/rest/v1/characters?[select,order]',
      status: 200,
      ok: true,
      duration_ms: 120,
      table_or_rpc: 'characters',
    })
    expect(ev.kind).toBe('net')
    expect(ev.data.method).toBe('GET')
    expect(ev.data.status).toBe(200)
    expect(ev.data.ok).toBe(true)
    expect(ev.data.table_or_rpc).toBe('characters')
  })

  it('keeps safe realtime event fields intact', async () => {
    const ev = await recordAndPeek('realtime', {
      direction: 'in',
      transport: 'broadcast',
      event: 'npc_damaged',
    })
    expect(ev.kind).toBe('realtime')
    expect(ev.data.direction).toBe('in')
    expect(ev.data.transport).toBe('broadcast')
    expect(ev.data.event).toBe('npc_damaged')
  })

  it('snapshot provider IDs pass through (no PII in snapshot fields)', async () => {
    const ev = await recordAndPeek('snapshot', {
      active_entry_id: 'entry-uuid-123',
      active_combatant_name: 'Knox',
      actions_remaining: 2,
      scene_id: 'scene-abc',
      scene_kind: 'tactical',
      open_modal: null,
      selected_token_id: null,
      selected_npc_id: null,
      combat_active: true,
      my_character_id: 'char-xyz',
      token_count: 5,
      initiative_count: 3,
    })
    expect(ev.kind).toBe('snapshot')
    expect(ev.data.active_entry_id).toBe('entry-uuid-123')
    expect(ev.data.active_combatant_name).toBe('Knox')
    expect(ev.data.my_character_id).toBe('char-xyz')
    expect(ev.data.combat_active).toBe(true)
  })

  it('slow net call gets slow:true flag', async () => {
    const ev = await recordAndPeek('net', {
      method: 'GET', url_path: '/rest/v1/items', status: 200, ok: true,
      duration_ms: 2000, slow: true,
    })
    expect(ev.data.slow).toBe(true)
  })
})
