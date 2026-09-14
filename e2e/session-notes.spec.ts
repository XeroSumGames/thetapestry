import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

// Session notes contract: GM starts a session, opens the End Session modal, fills
// in gm_summary + cliffhanger + next_session_notes, submits, and the sessions row
// lands with all three text fields populated.
//
// The sessions row is created when combat is started ("Into the Moment"). The GM
// then immediately ends the session via the End Session modal (no combat actions
// needed in between). The modal has two "End Session" buttons - the first opens
// the modal (GM tools bar), the second submits it (modal footer).

const MARV_CHAR = '54982e08-1dc9-49c9-b916-3ea86e02126f' // marv: "Mikey Shevik"
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Session notes - End Session modal contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM ends session with notes -> sessions row has gm_summary, cliffhanger, next_session_notes', async ({ browser }) => {
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
      const tag = `[E2E ${Date.now().toString(36)}] SessionNotes`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // Marv joins + wires PC + seeds character_states.
      const inviteCode = await getInviteCode(gm, campaignId!, gmCreds!)
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

      // GM navigates to table, clicks "Start Session".
      // startSession() (table/page.tsx:3327) inserts into sessions + sets sessionStatus='active'.
      // No combat start needed - "End Session" button renders whenever sessionStatus==='active',
      // independent of combatActive. "Into the Moment" is combat-only and not required here.
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await gm.waitForTimeout(2000)
      await gm.getByRole('button', { name: /^start session$/i }).first().click()
      // Wait for "End Session" to appear - proves sessionStatus flipped to 'active'.
      await expect(
        gm.getByRole('button', { name: /^end session$/i }).first(),
        '"End Session" button did not appear after Start Session',
      ).toBeVisible({ timeout: 20_000 })
      // Dismiss any auto-modal (New Scene, Into the Moment prompt) via Cancel.
      const autoCancel = gm.getByRole('button', { name: /^cancel$/i }).first()
      if (await autoCancel.isVisible().catch(() => false)) {
        await autoCancel.click()
        await gm.waitForTimeout(400)
      }

      // Poll for the sessions row - gives the DB insert time to commit.
      let sessionId: string | null = null
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/sessions?campaign_id=eq.${campaignId}&ended_at=is.null&select=id&order=started_at.desc&limit=1`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string }>
        sessionId = rows?.[0]?.id ?? null
        return sessionId
      }, { timeout: 10_000, message: 'sessions row did not appear in DB after Start Session' }).not.toBeNull()

      // Open the End Session modal via the GM tools bar button.
      await gm.getByRole('button', { name: /^end session$/i }).first().click()
      // Modal opens (z-index: 10000). Wait for the summary textarea label.
      await expect(gm.getByText(/what happened this session/i).first()).toBeVisible({ timeout: 10_000 })

      // Fill in all three summary fields.
      const summary = 'E2E session summary text'
      const cliffhanger = 'E2E cliffhanger text'
      const nextNotes = 'E2E next session notes text'
      await gm.getByPlaceholder(/summarise the session/i).fill(summary)
      await gm.getByPlaceholder(/cliffhanger/i).fill(cliffhanger)
      await gm.getByPlaceholder(/prep notes/i).fill(nextNotes)

      // Click the modal footer submit button (also labeled "End Session").
      // Use last() since the GM tools bar "End Session" is behind the modal backdrop.
      await gm.getByRole('button', { name: /^end session$/i }).last().click()

      // REST poll: sessions row should have ended_at set and all three text fields.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}&select=gm_summary,cliffhanger,next_session_notes,ended_at`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ gm_summary: string | null; cliffhanger: string | null; next_session_notes: string | null; ended_at: string | null }>
        const row = Array.isArray(rows) ? rows[0] : null
        return row?.ended_at ? row : null
      }, { timeout: 12_000, message: 'sessions row did not get ended_at + notes within 12s' }).toMatchObject({
        gm_summary: summary,
        cliffhanger: cliffhanger,
        next_session_notes: nextNotes,
      })
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
