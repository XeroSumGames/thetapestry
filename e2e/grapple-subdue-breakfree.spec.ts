import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Subdue + Break Free contract net (extends grapple-family.spec.ts).
//
// Both tests REST-seed grappled_by directly so we don't need to drive the
// Grapple roll first (dice path). The Subdue/Break Free buttons render on the
// active combatant's action bar based purely on initiative_order.grappled_by
// state - seeding it is a fixture, not a forced dice outcome.
//
// Actions drive from the GM client (gmLike=true -> canAct=true always),
// which lets the spec avoid waiting for realtime to reach marv's client
// before clicking.
//
// Note: actions_remaining decrement (consumeAction) is dice-outcome-dependent;
// no deterministic seam exists, so it is NOT verified here.

const RUN = `[E2E ${Date.now().toString(36)}]`
const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const GRAPPLE_OUTCOMES = ['Grappled!', 'Failed - 1 RP', 'No clear victor'] as const
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// Throwaway campaign + marv joins + NPC seeded. Mirrors grapple-family.spec.ts.
async function setupArena(opts: {
  gm: Page; pl: Page; gmCreds: SupaCreds; plCreds: SupaCreds; tag: string
}): Promise<{ campaignId: string; npcId: string; npcName: string; marvName: string }> {
  const { gm, pl, gmCreds, plCreds, tag } = opts

  await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
  await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
  await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
  await gm.getByRole('button', { name: /^create story$/i }).click()
  await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
  const campaignId = gm.url().split('/stories/')[1]

  const campRow = await (await gm.request.get(
    `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
    { headers: H(gmCreds) },
  )).json() as Array<{ invite_code: string }>
  const inviteCode = campRow?.[0]?.invite_code
  expect(inviteCode, 'no invite_code').toBeTruthy()

  await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
  await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
  await pl.getByRole('button', { name: /join/i }).first().click()
  await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

  const me = await (await pl.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(plCreds) })).json() as any
  const myUserId = me?.id as string
  await pl.request.patch(
    `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${myUserId}`,
    { headers: { ...H(plCreds), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
  )
  await pl.request.post(
    `${SUPABASE_URL}/rest/v1/character_states`,
    { headers: { ...H(plCreds), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: { campaign_id: campaignId, character_id: MARV_CHAR, user_id: myUserId,
               wp_current: 10, wp_max: 10, rp_current: 6, rp_max: 6, stress: 0 } },
  )

  const npcName = `${tag.replace(/[\[\] ]/g, '')}NPC`
  const npcIns = await gm.request.post(
    `${SUPABASE_URL}/rest/v1/campaign_npcs`,
    { headers: { ...H(gmCreds), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      data: { campaign_id: campaignId, name: npcName,
               wp_max: 10, wp_current: 10, rp_max: 6, rp_current: 6, physicality: 1, dexterity: 1 } },
  )
  const npcId = (await npcIns.json() as Array<{ id: string }>)[0].id

  const charRow = await (await gm.request.get(
    `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}&select=name`,
    { headers: H(gmCreds) },
  )).json() as Array<{ name: string }>
  const marvName = charRow?.[0]?.name
  expect(marvName, 'could not resolve marv character name').toBeTruthy()

  return { campaignId, npcId, npcName, marvName }
}

// Navigate both clients to the table, start the session, start combat, dismiss
// the New Scene auto-modal (throwaway campaigns have no tactical scenes).
async function launchCombat(gm: Page, pl: Page, campaignId: string) {
  await Promise.all([
    gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
    pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
  ])
  await gm.waitForTimeout(2000)
  await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
  await gm.waitForTimeout(1500)
  await gm.getByRole('button', { name: /into the moment/i }).first().click()
  await gm.waitForTimeout(800)
  const confirm = gm.getByRole('button', { name: /into the moment \(/i }).first()
  if (!(await confirm.isEnabled().catch(() => false))) {
    await gm.getByRole('checkbox').first().check().catch(() => {})
    await gm.waitForTimeout(300)
  }
  await confirm.click()
  await expect(pl.getByText(/in the moment/i).first()).toBeVisible({ timeout: 25_000 })
  // Dismiss New Scene auto-modal (same guard pattern as hidden-npc-initiative.spec.ts).
  const cancel = gm.getByRole('button', { name: /^cancel$/i }).first()
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click()
    await gm.waitForTimeout(400)
  }
}

// REST-seed: clear all initiative state, set marv active, then optionally
// set grappled_by on marv's row or the NPC's row.
async function seedInitiativeState(opts: {
  gm: Page; gmCreds: SupaCreds; campaignId: string;
  marvName: string; npcName: string;
  npcGrappledBy?: string; marvGrappledBy?: string
}): Promise<void> {
  const { gm, gmCreds, campaignId, marvName, npcName, npcGrappledBy, marvGrappledBy } = opts
  const initRows = await (await gm.request.get(
    `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}&select=id,character_name`,
    { headers: H(gmCreds) },
  )).json() as Array<{ id: string; character_name: string }>
  const marvEntry = initRows.find(e => e.character_name === marvName)
  const npcEntry = initRows.find(e => e.character_name === npcName)
  expect(marvEntry, 'marv has no initiative_order row').toBeTruthy()
  expect(npcEntry, 'NPC has no initiative_order row').toBeTruthy()

  // Clear all is_active + grappled_by across all combatants first.
  await gm.request.patch(
    `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}`,
    { headers: { ...H(gmCreds), 'Content-Type': 'application/json' }, data: { is_active: false, grappled_by: null } },
  )
  // Set marv active (plus optional grappled_by on marv's row).
  await gm.request.patch(
    `${SUPABASE_URL}/rest/v1/initiative_order?id=eq.${marvEntry!.id}`,
    { headers: { ...H(gmCreds), 'Content-Type': 'application/json' },
      data: { is_active: true, ...(marvGrappledBy !== undefined ? { grappled_by: marvGrappledBy } : {}) } },
  )
  // Optionally set grappled_by on the NPC's row.
  if (npcGrappledBy !== undefined) {
    await gm.request.patch(
      `${SUPABASE_URL}/rest/v1/initiative_order?id=eq.${npcEntry!.id}`,
      { headers: { ...H(gmCreds), 'Content-Type': 'application/json' }, data: { grappled_by: npcGrappledBy } },
    )
  }
}

test.describe('Combat - Subdue + Break Free contract net', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM drives Subdue via action bar -> roll_log row lands with canonical Subdue label + outcome', async ({ browser }) => {
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

      const { campaignId: cid, npcName, marvName } = await setupArena({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, tag: `${RUN} Subdue`,
      })
      campaignId = cid
      await launchCombat(gm, pl, campaignId)

      // Precondition: NPC grappled_by=marvName (marv is grappling the NPC).
      // This triggers isGrappling=true on marv's action bar -> Subdue + Release appear.
      await seedInitiativeState({
        gm, gmCreds: gmCreds!, campaignId, marvName, npcName,
        npcGrappledBy: marvName,
      })
      // Wait for GM client realtime to reflect the state change.
      await expect(
        gm.getByRole('button', { name: /^subdue$/i }),
        'Subdue button did not appear on GM action bar after seeding NPC grappled_by=marvName',
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        gm.getByRole('button', { name: /^release$/i }),
        'Release button should be visible alongside Subdue',
      ).toBeVisible()

      await gm.getByRole('button', { name: /^subdue$/i }).first().click()

      // Grapple modal opens in subdue mode. Target is pre-set to grappledTarget
      // (no picker step needed). Roll button label: '🎲 Roll Subdue'.
      await expect(
        gm.getByRole('button', { name: /roll subdue/i }),
        'Roll Subdue button did not appear in the grapple modal',
      ).toBeVisible({ timeout: 10_000 })
      await gm.getByRole('button', { name: /roll subdue/i }).first().click()

      // Contract: roll_log row lands with a label containing "Subdue" + a canon outcome.
      let subdueRow: { outcome: string; label: string } | null = null
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&select=outcome,label&order=created_at.desc&limit=5`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ outcome: string; label: string }>
        subdueRow = Array.isArray(rows) ? (rows.find(r => /subdue/i.test(r.label)) ?? null) : null
        return subdueRow
      }, { timeout: 12_000, message: 'no Subdue roll_log row found within 12s' }).not.toBeNull()

      expect(
        (GRAPPLE_OUTCOMES as readonly string[]).includes(subdueRow!.outcome),
        `Subdue outcome "${subdueRow!.outcome}" is not one of the canon three`,
      ).toBe(true)
      expect(
        /subdue/i.test(subdueRow!.label),
        `Subdue label "${subdueRow!.label}" does not contain "Subdue"`,
      ).toBe(true)
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

  test('GM drives Break Free via action bar -> roll_log row lands with canonical Break Free label + outcome', async ({ browser }) => {
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

      const { campaignId: cid, npcName, marvName } = await setupArena({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, tag: `${RUN} BreakFree`,
      })
      campaignId = cid
      await launchCombat(gm, pl, campaignId)

      // Precondition: marv grappled_by=npcName (marv is being held).
      // This triggers isGrappled=true on marv's action bar -> Break Free appears.
      await seedInitiativeState({
        gm, gmCreds: gmCreds!, campaignId, marvName, npcName,
        marvGrappledBy: npcName,
      })
      await expect(
        gm.getByRole('button', { name: /^break free$/i }),
        'Break Free button did not appear on GM action bar after seeding marv grappled_by=npcName',
      ).toBeVisible({ timeout: 15_000 })

      await gm.getByRole('button', { name: /^break free$/i }).first().click()

      // Modal opens in breakfree mode. The action-bar button is "Break Free";
      // the modal roll button is "🎲 Break Free" - require the emoji to distinguish.
      await expect(
        gm.getByRole('button', { name: /🎲.*break free/i }),
        'Break Free roll button (with dice emoji) did not appear in the grapple modal',
      ).toBeVisible({ timeout: 10_000 })
      await gm.getByRole('button', { name: /🎲.*break free/i }).first().click()

      // Contract: roll_log row lands with a label containing "Break Free" + a canon outcome.
      let bfRow: { outcome: string; label: string } | null = null
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&select=outcome,label&order=created_at.desc&limit=5`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ outcome: string; label: string }>
        bfRow = Array.isArray(rows) ? (rows.find(r => /break free/i.test(r.label)) ?? null) : null
        return bfRow
      }, { timeout: 12_000, message: 'no Break Free roll_log row found within 12s' }).not.toBeNull()

      expect(
        (GRAPPLE_OUTCOMES as readonly string[]).includes(bfRow!.outcome),
        `Break Free outcome "${bfRow!.outcome}" is not one of the canon three`,
      ).toBe(true)
      expect(
        /break free/i.test(bfRow!.label),
        `Break Free label "${bfRow!.label}" does not contain "Break Free"`,
      ).toBe(true)
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
