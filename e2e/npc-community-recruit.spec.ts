import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

// NPC recruitment contract: an NPC revealed to the party (via npc_relationships)
// can be recruited into a community during an active session. The GM clicks
// Checks -> Recruit, selects the PC, NPC, community, approach, and skill, then
// rolls. On any outcome, a community_members row lands in DB.
//
// Session is required: the Checks dropdown (and its "Recruit" item) only appears
// when sessionStatus === 'active' (table/page.tsx:5454).
//
// Eligible NPCs come from revealedNpcs (built from npc_relationships.revealed=true)
// or from mapTokens. We seed npc_relationships to make the NPC eligible without
// placing it on the tactical map. The community name must NOT start with "E2E"
// or "[E2E]" to pass the visibleCommunities filter in the pick step (line 9760).
//
// The roll is dice-driven (2d6 + INF + skill + CMod). We accept any outcome.
// The community_members INSERT happens inside executeRecruitRoll before the
// result modal opens, so the row should be visible as soon as we poll.

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32'
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('NPC community recruitment contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM recruits an NPC into a community -> community_members row appears in DB', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let npcId: string | null = null
    let communityId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] NpcRecruit`
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

      // REST INSERT a community. Name must NOT start with "E2E" or "[E2E]" so
      // it passes the visibleCommunities filter in the recruit modal (table/page.tsx:9760).
      const commInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/communities`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: 'Survivors Group', stage: 'community', status: 'active' } },
      )).json() as Array<{ id: string }>
      communityId = commInsert?.[0]?.id ?? null
      expect(communityId, 'community INSERT did not return an id').toBeTruthy()

      // REST INSERT an NPC with wp_current > 0 and status='active'.
      const npcName = `Recruit Target ${Date.now().toString(36)}`
      const npcInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: npcName,
                   reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
                   skills: [], equipment: [],
                   wp_max: 10, rp_max: 6, wp_current: 10, rp_current: 6,
                   status: 'active', sort_order: 1 } },
      )).json() as Array<{ id: string }>
      npcId = npcInsert?.[0]?.id ?? null
      expect(npcId, 'NPC INSERT did not return an id').toBeTruthy()

      // REST INSERT npc_relationships: revealed=true makes the NPC appear in
      // revealedNpcs, which is what getRecruitEligibleNpcs() draws from.
      // character_id must reference a valid characters row - use MARV_CHAR.
      await gm.request.post(
        `${SUPABASE_URL}/rest/v1/npc_relationships`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { npc_id: npcId, character_id: MARV_CHAR, revealed: true, relationship_cmod: 0 } },
      )

      // GM navigates to table + starts session (same pattern as session-notes.spec).
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await gm.waitForTimeout(2000)
      await gm.getByRole('button', { name: /^start session$/i }).first().click()
      await expect(
        gm.getByRole('button', { name: /^end session$/i }).first(),
        '"End Session" did not appear after Start Session',
      ).toBeVisible({ timeout: 20_000 })
      // Dismiss any auto-modal (New Scene prompt) via Cancel.
      const autoCancel = gm.getByRole('button', { name: /^cancel$/i }).first()
      if (await autoCancel.isVisible().catch(() => false)) {
        await autoCancel.click()
        await gm.waitForTimeout(400)
      }

      // Open Checks -> Recruit (header button only visible when session active).
      await expect(async () => {
        await gm.getByRole('button', { name: /^Checks/ }).first().click().catch(() => {})
        await gm.getByRole('button', { name: 'Recruit', exact: true }).first().click({ timeout: 2_000 }).catch(() => {})
        await expect(gm.getByText(/pick target.*approach/i).first()).toBeVisible({ timeout: 2_000 })
      }, 'Recruit modal should open from Checks dropdown').toPass({ timeout: 20_000 })

      // Select Rolling PC (Marv / Cree Blaine) - value is the character id.
      await gm.locator('select').nth(0).selectOption(MARV_CHAR)
      // Select Target NPC (the seeded NPC - option value is npcId).
      await gm.locator('select').nth(1).selectOption(npcId!)
      // Select community (Survivors Group - option value is communityId).
      await gm.locator('select').nth(2).selectOption(communityId!)
      // Approach defaults to 'cohort'; skill select is the 4th select.
      // Pick "Barter" (suggested for cohort approach).
      await gm.locator('select').nth(3).selectOption('Barter')

      // Roll. The button becomes enabled once PC + NPC + skill are all selected.
      await gm.getByRole('button', { name: /roll recruitment/i }).click()

      // Poll for the community_members row. The INSERT happens inside
      // executeRecruitRoll before the result step renders.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/community_members?npc_id=eq.${npcId}&select=id,npc_id,recruitment_type,community_id`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; npc_id: string; recruitment_type: string; community_id: string }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      }, { timeout: 20_000, message: 'community_members row did not appear after recruitment roll' }).toMatchObject({
        npc_id: npcId,
        community_id: communityId,
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
