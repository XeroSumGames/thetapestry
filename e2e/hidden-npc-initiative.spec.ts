import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, getInviteCode, type SupaCreds } from './_teardown'

// Hidden NPC multi-client visibility spec (HP ac27b8a, 2026-05-31).
//
// Feature: initiative_order.hidden_from_players column + NpcRoster toggle +
// InitiativeBar filters for non-GM clients + 👁 Reveal button (GM-only).
//
// This spec drives the Reveal flow end-to-end:
//   1. Start a throwaway campaign + session + combat (same path as Phase A).
//   2. PATCH the NPC's initiative_order row to hidden_from_players=true.
//   3. Player's InitiativeBar does NOT show the NPC chip (client-side filter).
//   4. GM's InitiativeBar DOES show the NPC chip with the HIDDEN label.
//   5. GM clicks the 👁 Reveal button.
//   6. Player's InitiativeBar NOW shows the NPC chip within realtime SLA.
//   7. roll_log has an 'action' row: "{npcName} reveals themselves!".
//
// TacticalMap token visibility (makeTokenVisibleByNpc) is NOT covered here -
// it requires a scene + token setup beyond this fixture. That remains MANUAL.

const RUN = `[E2E ${Date.now().toString(36)}]`
const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32'
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Hidden NPC multi-client visibility (HP ac27b8a)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM PATCHes hidden_from_players=true -> player bar omits NPC -> GM reveals -> player bar shows NPC + roll_log action row', async ({ browser }) => {
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

      // --- Set up throwaway campaign (mirror grapple-family setup) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} HiddenNPC`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id in landing URL').toBeTruthy()

      const inviteCode = await getInviteCode(gm, campaignId, gmCreds!)
      expect(inviteCode, 'campaign has no invite_code').toBeTruthy()

      // marv joins.
      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
      await pl.getByRole('button', { name: /join/i }).first().click()
      await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

      // Wire marv's PC.
      const me = await (await pl.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(plCreds!) })).json() as any
      const myUserId = me?.id as string
      await pl.request.patch(
        `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${myUserId}`,
        { headers: { ...H(plCreds!), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
      )
      await pl.request.post(
        `${SUPABASE_URL}/rest/v1/character_states`,
        { headers: { ...H(plCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, character_id: MARV_CHAR, user_id: myUserId, wp_current: 10, wp_max: 10, rp_current: 6, rp_max: 6, stress: 0 } },
      )

      // Seed the NPC.
      const npcName = `${RUN.replace(/[\[\] ]/g, '')}NPC`
      const npcIns = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: npcName, wp_max: 10, wp_current: 10, rp_max: 6, rp_current: 6, physicality: 1, dexterity: 1 } },
      )
      expect(npcIns.ok(), `campaign_npcs INSERT failed: ${npcIns.status()} ${await npcIns.text()}`).toBe(true)

      // Both clients open the table page.
      await Promise.all([
        gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      await gm.waitForTimeout(2000)

      // GM starts session.
      await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1500)

      // GM starts combat ("Into the Moment").
      await gm.getByRole('button', { name: /into the moment/i }).first().click()
      await gm.waitForTimeout(800)
      const confirm = gm.getByRole('button', { name: /into the moment \(/i }).first()
      if (!(await confirm.isEnabled().catch(() => false))) {
        await gm.getByRole('checkbox').first().check().catch(() => {})
        await gm.waitForTimeout(300)
      }
      await confirm.click()

      // Wait for player to see combat is live.
      await expect(
        pl.getByText(/in the moment/i).first(),
        'player did not see IN THE MOMENT live after Into the Moment',
      ).toBeVisible({ timeout: 25_000 })

      // --- Hide the NPC from players ---
      // Find the NPC's initiative_order row then PATCH it.
      const initRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}&select=id,character_name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; character_name: string }>
      const npcEntry = initRows.find(e => e.character_name === npcName)
      expect(npcEntry, 'NPC has no initiative_order row').toBeTruthy()

      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/initiative_order?id=eq.${npcEntry!.id}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data: { hidden_from_players: true } },
      )
      // Give realtime a beat to propagate the hide to both clients.
      await pl.waitForTimeout(2500)

      // --- Assert: player's bar does NOT show the NPC chip ---
      // The InitiativeBar renders each chip with title={character_name}; when
      // hidden, the entry is filtered from visibleAlive entirely (not just
      // visually hidden), so getByTitle(npcName) returns nothing.
      await expect(
        pl.getByTitle(npcName).first(),
        'player bar should NOT show hidden NPC chip',
      ).not.toBeVisible({ timeout: 3_000 })

      // GM sees the HIDDEN label for the entry.
      await expect(
        gm.getByText('HIDDEN').first(),
        'GM bar should show HIDDEN chip for hidden NPC',
      ).toBeVisible({ timeout: 5_000 })

      // Dismiss the "New Scene" auto-modal if it appeared (no scene in throwaway campaign).
      const cancelBtn = gm.getByRole('button', { name: /^cancel$/i }).first()
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click()
        await gm.waitForTimeout(300)
      }

      // --- GM reveals the NPC via the 👁 Reveal button ---
      await gm.getByTitle('Reveal to players').first().click()

      // --- Assert: player's bar NOW shows the NPC chip within realtime SLA ---
      await expect(
        pl.getByTitle(npcName).first(),
        'player bar should show NPC chip after GM reveals',
      ).toBeVisible({ timeout: 15_000 })

      // --- Assert: roll_log has the action row for the reveal ---
      const revealRows = await expect.poll(
        async () => {
          const r = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=eq.action&character_name=eq.${encodeURIComponent(npcName)}&select=label,outcome&order=created_at.desc&limit=1`,
            { headers: H(gmCreds!) },
          )
          const rows = await r.json().catch(() => []) as Array<{ label: string; outcome: string }>
          return rows?.[0] ?? null
        },
        { timeout: 10_000, message: 'no action roll_log row for the revealed NPC' },
      ).not.toBeNull()

      const revealRowsFinal = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=eq.action&character_name=eq.${encodeURIComponent(npcName)}&select=label,outcome&order=created_at.desc&limit=1`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ label: string; outcome: string }>
      const revealRow = revealRowsFinal[0]
      expect(revealRow.label, 'reveal roll_log label should end with "reveals themselves!"').toMatch(
        new RegExp(`${npcName} reveals themselves!`, 'i'),
      )
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
