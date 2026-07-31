import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

// CharacterCard live-tracker contract: GM opens the character overlay via the
// bottom portrait strip, then increments and decrements Stress using the +/-
// buttons. Verified via REST poll on character_states.stress.
//
// Selector rationale for Stress +/-:
//   DotTracker (WP/RP) pips are <button> elements with NO text content (circle-
//   styled) - they don't match getByRole('button', { name: '+' }).
//   A grep of table/page.tsx confirms it has zero text-content +/- buttons;
//   the Counter component in CharacterCard.tsx is defined but never instantiated.
//   Therefore the first text-content +/- button in the page DOM when the overlay
//   is open is the Stress section's ±, which renders before Insight/CDP/Morality.

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('CharacterCard - live stress tracker (GM overlay)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM increments and decrements Stress via overlay -> character_states.stress updates via REST', async ({ browser }) => {
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
      const tag = `[E2E ${Date.now().toString(36)}] Trackers`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      const inviteCode = await getInviteCode(gm, campaignId!, gmCreds!)
      expect(inviteCode, 'no invite_code').toBeTruthy()

      // Marv joins + wires PC + seeds character_states (stress=0).
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

      // GM opens table. No combat start needed - portrait strip appears whenever
      // character_states + campaign_members are both set.
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await expect(
        gm.getByRole('button', { name: new RegExp(marvName!, 'i') }).first(),
        'marv portrait button did not appear in the bottom strip',
      ).toBeVisible({ timeout: 15_000 })
      await gm.getByRole('button', { name: new RegExp(marvName!, 'i') }).first().click()

      // CharacterCard overlay opens (z-index: 9999). Wait for the WP label.
      await expect(gm.getByText('Wound Points').first()).toBeVisible({ timeout: 10_000 })

      // Poll helper - reads stress for this character + campaign.
      const pollStress = async (): Promise<number | null> => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=stress`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ stress: number }>
        return Array.isArray(rows) && rows[0] != null ? rows[0].stress : null
      }

      // exact:true so we match buttons whose entire accessible name is '+' or '-'.
      // The table page has a '+ Pin' button (accessible name '+ Pin') which would
      // match without exact:true and is blocked by the overlay backdrop anyway.
      // Stress +/- come before Insight/CDP/Morality in the CharacterCard DOM.
      const stressPlus = gm.getByRole('button', { name: '+', exact: true }).first()
      const stressMinus = gm.getByRole('button', { name: '-', exact: true }).first()

      // stress 0 -> 1.
      await stressPlus.click()
      await expect.poll(pollStress, { timeout: 8_000, message: 'stress did not reach 1 after first +' }).toBe(1)
      // Brief settle so CharacterCard's useEffect propagates new liveState before next click.
      await gm.waitForTimeout(300)

      // stress 1 -> 2.
      await stressPlus.click()
      await expect.poll(pollStress, { timeout: 8_000, message: 'stress did not reach 2 after second +' }).toBe(2)
      await gm.waitForTimeout(300)

      // stress 2 -> 1 (Stress - is now enabled since stress > 0).
      await stressMinus.click()
      await expect.poll(pollStress, { timeout: 8_000, message: 'stress did not return to 1 after -' }).toBe(1)
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
