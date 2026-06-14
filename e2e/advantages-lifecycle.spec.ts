import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Advantage lifecycle contract: GM REST-inserts an advantage for a PC ->
// advantage row persists in DB with correct fields (skill_name, cmod_delta,
// description, consumed_at=null) -> REST PATCH simulates consume -> consumed_at
// is set.
//
// The full star-button grant flow requires an active roll_log row in the
// feed (dice roll seeded in session). REST-seeding the advantage tests the
// core contract (RLS + schema + consumed-state lifecycle) without the full
// dice flow. The consume path (PATCH consumed_at) mirrors what executeRoll
// does when a player uses their advantage on a roll.

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32'
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Advantage lifecycle contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM grants advantage for PC -> row persists with correct fields -> consume marks consumed_at', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let advantageId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] AdvLifecycle`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // Marv joins + wires PC + seeds character_states.
      const campRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ invite_code: string }>
      const inviteCode = campRow?.[0]?.invite_code
      expect(inviteCode, 'no invite_code').toBeTruthy()

      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
      await pl.getByRole('button', { name: /join/i }).first().click()
      await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })
      const me = await (await pl.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(plCreds!) })).json() as any
      const myUserId = me?.id as string
      await pl.request.patch(
        `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${myUserId}`,
        { headers: { ...H(plCreds!), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
      )
      await pl.request.post(
        `${SUPABASE_URL}/rest/v1/character_states`,
        { headers: { ...H(plCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, character_id: MARV_CHAR, user_id: myUserId,
                   wp_current: 10, wp_max: 10, rp_current: 6, rp_max: 6, stress: 0 } },
      )

      // GM REST INSERTs advantage for marv (mirrors what grantAdvantage() in lib/advantages.ts does).
      const advDesc = `E2E-${Date.now().toString(36)}-advantage`
      const advInsertResp = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/advantages`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, character_id: MARV_CHAR, skill_name: 'Barter', cmod_delta: 2, description: advDesc } },
      )
      const advRows = await advInsertResp.json() as Array<{ id: string }>
      advantageId = advRows?.[0]?.id ?? null
      expect(advantageId, 'advantage INSERT did not return an id').toBeTruthy()

      // REST poll: advantage row exists with correct fields, consumed_at still null.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/advantages?id=eq.${advantageId}&select=id,skill_name,cmod_delta,description,consumed_at`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; skill_name: string; cmod_delta: number; description: string; consumed_at: string | null }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      }, { timeout: 10_000, message: 'advantage row did not appear in DB after INSERT' }).toMatchObject({
        skill_name: 'Barter',
        cmod_delta: 2,
        description: advDesc,
        consumed_at: null,
      })

      // Marv verifies the row is also readable with their own creds (RLS SELECT:
      // character holder can read their own unconsumed advantages).
      const marvRows = await (await pl.request.get(
        `${SUPABASE_URL}/rest/v1/advantages?id=eq.${advantageId}&select=id,consumed_at`,
        { headers: H(plCreds!) },
      )).json() as Array<{ id: string; consumed_at: string | null }>
      expect(Array.isArray(marvRows) && marvRows.length > 0, 'marv cannot read their own advantage row').toBe(true)

      // REST PATCH: set consumed_at (mirrors what the executeRoll handler does when a
      // player clicks Use on the row and completes a roll).
      const nowIso = new Date().toISOString()
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/advantages?id=eq.${advantageId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data: { consumed_at: nowIso } },
      )

      // REST poll: consumed_at is now set (advantage is spent).
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/advantages?id=eq.${advantageId}&select=consumed_at`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ consumed_at: string | null }>
        return rows?.[0]?.consumed_at ?? null
      }, { timeout: 10_000, message: 'consumed_at did not get set on advantage row' }).not.toBeNull()
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
