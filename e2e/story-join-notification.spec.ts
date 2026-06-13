import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Player-join notification contract: when a player accepts an invite code,
// the DB trigger on_player_joined fires (AFTER INSERT ON campaign_members) and
// inserts a notifications row for existing campaign members (the GM).
//
// The notification's link field is '/stories/<campaign_id>', which lets us scope
// the REST poll to this specific campaign without relying on timestamps.
//
// GM auto-joins campaign_members on campaign creation (app/stories/new/page.tsx:195),
// so they are a valid recipient when marv joins.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Player-join notification contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('Marv joins via invite code -> GM receives player_joined notification', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      // Resolve GM user_id so we can poll notifications for the right recipient.
      const gmMe = await (await gm.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(gmCreds!) })).json() as any
      const gmUserId = gmMe?.id as string
      expect(gmUserId, 'could not resolve GM user id').toBeTruthy()

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] JoinNotif`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // Fetch invite code.
      const campRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ invite_code: string }>
      const inviteCode = campRow?.[0]?.invite_code
      expect(inviteCode, 'no invite_code').toBeTruthy()

      // Marv joins by invite code (triggers the on_player_joined DB trigger).
      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
      await pl.getByRole('button', { name: /join/i }).first().click()
      await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

      // REST poll: notifications row for GM with type=player_joined + link=/stories/<campaignId>.
      // The link field scopes the poll to this specific campaign.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${gmUserId}&type=eq.player_joined&link=eq./stories/${campaignId}&select=id,type,link&limit=1`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; type: string; link: string }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0].type : null
      }, { timeout: 15_000, message: 'player_joined notification did not appear for GM within 15s' }).toBe('player_joined')
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
