import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Campaign Snapshot contract: GM navigates to /stories/<id>/snapshots, fills in
// a unique snapshot name, clicks "Save Snapshot", and a campaign_snapshots row
// lands in the DB. No character states are included (the default) - we are
// testing the save path, not state capture.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Campaign Snapshots - save contract', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM saves a named snapshot -> campaign_snapshots row appears in DB', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve gm creds').toBeTruthy()

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] Snapshot`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // Navigate to the dedicated Snapshots sub-page.
      await gm.goto(`/stories/${campaignId}/snapshots`, { waitUntil: 'domcontentloaded' })

      // Fill in the snapshot name and save.
      const snapName = `E2E-${Date.now().toString(36)}`
      // The input has placeholder "e.g. Arena act 1 pre-playtest" and label "Snapshot name".
      await gm.getByPlaceholder(/arena act 1/i).fill(snapName)
      await gm.getByRole('button', { name: /^save snapshot$/i }).click()

      // REST poll: campaign_snapshots row should appear with our name.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/campaign_snapshots?campaign_id=eq.${campaignId}&name=eq.${encodeURIComponent(snapName)}&select=id,name,campaign_id`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; name: string; campaign_id: string }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0].name : null
      }, { timeout: 10_000, message: 'campaign_snapshots row did not appear after Save Snapshot' }).toBe(snapName)
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
