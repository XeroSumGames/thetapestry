import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

// Ch6 - Story lifecycle: GM creates a story (setting picker) -> it lands in My
// Stories with a 6-char invite code; a player joins by code -> the join persists
// and the GM roster reflects it ON RELOAD (the roster is refetch-based, NOT
// realtime - app/stories/[id]/page.tsx:49); the player leaves -> drops off.
// Create + join are direct table INSERTs (no RPC): campaigns + campaign_members.
// The campaign is a throwaway tagged [E2E <runid>]; teardown deletes the
// campaign row, which CASCADE-removes campaign_members + character_states
// (schema.sql:1039, :1105) - so one delete cleans the whole run.

const RUN = `[E2E ${Date.now().toString(36)}]`

async function memberIds(page: Page, creds: SupaCreds, campaignId: string): Promise<string[]> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&select=user_id`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return []
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows.map((r: { user_id: string }) => r.user_id) : []
}

async function username(page: Page, creds: SupaCreds, userId: string): Promise<string | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0]?.username ? (rows[0].username as string) : null
}

test.describe('Ch6 - Story lifecycle (create / join-by-code / leave)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM creates a story -> player joins by code -> roster reflects -> player leaves', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    const marvId = ACCOUNTS.marv.userId
    let campaignId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)

      // --- FLOW 1: GM creates the story via the real form (Ch6.1) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      const storyName = `${RUN} Lifecycle`
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(storyName)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()

      // Lands on the story hub /stories/<uuid>.
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id in landing URL').toBeTruthy()

      // Invite code persisted + exactly 6 chars (campaigns.invite_code). The
      // invite_code column is no longer directly readable (PII revoke 2026-06-29);
      // read it via the sanctioned get_campaign_invite_code RPC (getInviteCode).
      const inviteCode = await getInviteCode(gm, campaignId!, creds!)
      expect(inviteCode, 'campaign has no invite_code').toBeTruthy()
      expect(inviteCode).toHaveLength(6)
      // gm_user_id is still directly readable; only invite_code was revoked.
      const camp = (await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=gm_user_id`,
        { headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}` } },
      )).json())[0] as { gm_user_id: string }

      // Appears in My Stories with its invite code (Ch6.1).
      await gm.goto('/stories', { waitUntil: 'domcontentloaded' })
      await expect(gm.getByText(storyName, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
      await expect(gm.getByText(inviteCode, { exact: true }).first()).toBeVisible()

      // Only the GM is a member so far.
      expect(await memberIds(gm, creds!, campaignId!)).toEqual([camp.gm_user_id])

      // --- FLOW 2: player joins by code (Ch6.2) ---
      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode)
      await pl.getByRole('button', { name: /^join story$/i }).click()
      await pl.waitForURL(new RegExp(`/stories/${campaignId}$`), { timeout: 30_000 })

      // Join persisted: marv is now a member (campaign_members row).
      await expect.poll(
        async () => (await memberIds(gm, creds!, campaignId!)).includes(marvId),
        { timeout: 8_000, message: 'marv did not appear in campaign_members after join' },
      ).toBe(true)

      // GM roster reflects it on reload (refetch-based, not realtime).
      const marvName = await username(gm, creds!, marvId)
      await gm.goto(`/stories/${campaignId}`, { waitUntil: 'domcontentloaded' })
      if (marvName) {
        await expect(gm.getByText(marvName, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
      }

      // --- FLOW 3: player leaves (Ch6.3) ---
      pl.on('dialog', d => d.accept().catch(() => {})) // confirm('Leave this story?')
      await pl.getByRole('button', { name: /^leave$/i }).first().click()
      await pl.waitForURL(/\/stories$/, { timeout: 30_000 })

      await expect.poll(
        async () => (await memberIds(gm, creds!, campaignId!)).includes(marvId),
        { timeout: 8_000, message: 'marv still a member after leaving' },
      ).toBe(false)
    } finally {
      // Teardown: delete the throwaway campaign; CASCADE removes members + states.
      if (campaignId && creds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
