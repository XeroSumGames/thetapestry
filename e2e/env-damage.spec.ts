import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Env Dmg (environmental damage) contract net.
//
// Tests the "Env Dmg" button (brown, CharacterCard.tsx:597-642) which is the
// CURRENT path: two prompt() dialogs -> WP+RP update -> insertRollLog.
// Distinct from the old "Env. Damage" button (red, :509-539) which uses alert()
// and does NOT call insertRollLog.
//
// Falling damage formula: fallingDamage(10) = { wp: 3, rp: 3 }.
// Starting state: wp_current=10, rp_current=6.
// Expected after 10 ft fall: wp_current=7, rp_current=3.
//
// Dialog handling: page.on('dialog') fires for both prompt() calls in sequence.
// The handler accepts '1' (Falling) on the first call and '10' (feet) on the second.

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('CharacterCard - Env Dmg (Falling) contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM applies 10 ft Falling damage via Env Dmg button -> character_states + roll_log updated', async ({ browser }) => {
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

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] EnvDmg`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      const campRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ invite_code: string }>
      const inviteCode = campRow?.[0]?.invite_code
      expect(inviteCode, 'no invite_code').toBeTruthy()

      // Marv joins + wires PC + seeds character_states.
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

      // Resolve character name for portrait-button selector.
      const charRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}&select=name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ name: string }>
      const marvName = charRow?.[0]?.name
      expect(marvName, 'could not resolve marv character name').toBeTruthy()

      // GM opens table + clicks the portrait button to open CharacterCard overlay.
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await expect(
        gm.getByRole('button', { name: new RegExp(marvName!, 'i') }).first(),
        'marv portrait button did not appear in the bottom strip',
      ).toBeVisible({ timeout: 15_000 })
      await gm.getByRole('button', { name: new RegExp(marvName!, 'i') }).first().click()
      await expect(gm.getByText('Wound Points').first()).toBeVisible({ timeout: 10_000 })

      // Register dialog handlers before clicking Env Dmg. The button fires two
      // sequential prompt() calls: (1) damage type, (2) amount.
      const dialogAnswers = ['1', '10']
      let dialogIdx = 0
      gm.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          await dialog.accept(dialogAnswers[dialogIdx] ?? dialog.defaultValue() ?? '')
          dialogIdx++
        } else {
          // Dismiss any confirm/alert dialogs so they don't hang the test.
          await dialog.dismiss()
        }
      })

      // "Env Dmg" (no period, brown) is the current path with insertRollLog.
      // "Env. Damage" (with period, red) is the legacy path without insertRollLog.
      // Substring 'Env Dmg' uniquely identifies the correct button.
      await gm.getByRole('button', { name: 'Env Dmg' }).first().click()

      // Poll REST: wp_current should drop from 10 to 7 (10 ft = 3 WP damage).
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current,rp_current`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ wp_current: number; rp_current: number }>
        return Array.isArray(rows) && rows[0] ? rows[0].wp_current : null
      }, { timeout: 10_000, message: 'wp_current did not drop to 7 after 10 ft Falling damage' }).toBe(7)

      // rp_current should drop from 6 to 3 (10 ft = 3 RP damage).
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=rp_current`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ rp_current: number }>
        return Array.isArray(rows) && rows[0] ? rows[0].rp_current : null
      }, { timeout: 8_000, message: 'rp_current did not drop to 3 after 10 ft Falling damage' }).toBe(3)

      // roll_log row lands with outcome='falling' for this campaign.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=eq.falling&select=outcome,label&limit=1`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ outcome: string; label: string }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0].outcome : null
      }, { timeout: 8_000, message: 'no roll_log row with outcome=falling for this campaign' }).toBe('falling')
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
