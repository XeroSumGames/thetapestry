import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, getInviteCode, type SupaCreds } from './_teardown'

// Grapple-family structure / contract net for the 2026-06-01 rework
// (`f5b4465` Subdue, `e5c1b61` Break Free; spec `tasks/grapple-subdue-rework-spec.md`,
// manual plan `tasks/subdue-rework-testplan.md`).
//
// The whole loop is dice-driven (opposed 2d6 + 1d3) on the CLIENT in
// executeGrapple/executeSubdue/executeBreakFree - there is NO RPC seam like
// gm_apply_damage. So this spec is a STRUCTURE / CONTRACT net (mirrors the
// Distract/coordinate posture): assert rows land with the right OUTCOME enum +
// label shape + the right state side-effects, NOT specific results.
//
// This batch covers the Grapple-roll contract only. Subdue + Break Free land
// as a follow-up batch (each needs the actor on the active turn + the picker /
// modal driven; share a fixture/helper with this one).
//
// Seeded state allowed (NOT a "forced outcome", just a precondition fixture):
//   - GM PATCHes initiative_order to make marv's PC the active turn so the
//     action-bar buttons render on marv's client.
// Random outcome accepted: the Grapple roll itself - assert one of the three
// canon outcomes lands (Grappled! / Failed - 1 RP / No clear victor) + the
// label has the canonical "<grappler> grapples / fails / no clear" shape.

const RUN = `[E2E ${Date.now().toString(36)}]`
const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const GRAPPLE_OUTCOMES = ['Grappled!', 'Failed - 1 RP', 'No clear victor'] as const
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// Mirror combat-flow.spec's throwaway-campaign + marv-as-PC setup. Inlined
// here rather than extracted to a shared lib so the two specs stay
// independently maintainable.
async function setupGrappleArena(opts: {
  gm: Page; pl: Page; gmCreds: SupaCreds; plCreds: SupaCreds; name: string
}): Promise<{ campaignId: string; npcId: string; npcName: string; marvName: string }> {
  const { gm, pl, gmCreds, plCreds, name } = opts

  // GM creates the throwaway via /stories/new (the real path).
  await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
  await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(name)
  await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
  await gm.getByRole('button', { name: /^create story$/i }).click()
  await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
  const campaignId = gm.url().split('/stories/')[1]
  expect(campaignId, 'no campaign id in landing URL').toBeTruthy()
  const inviteCode = await getInviteCode(gm, campaignId, gmCreds)
  expect(inviteCode, 'campaign has no invite_code').toBeTruthy()

  // marv joins by code.
  await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
  await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
  await pl.getByRole('button', { name: /join/i }).first().click()
  await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

  // Wire marv's PC to his campaign_members row + seed character_states so
  // combat has a PC combatant with HP. marv's session writes both (own-row).
  const me = await (await pl.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(plCreds) })).json() as any
  const myUserId = me?.id as string
  await pl.request.patch(
    `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${myUserId}`,
    { headers: { ...H(plCreds), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
  )
  await pl.request.post(
    `${SUPABASE_URL}/rest/v1/character_states`,
    {
      headers: { ...H(plCreds), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: { campaign_id: campaignId, character_id: MARV_CHAR, user_id: myUserId, wp_current: 10, wp_max: 10, rp_current: 6, rp_max: 6, stress: 0 },
    },
  )

  // GM seeds a single NPC for the Start-Combat picker.
  const npcName = `${RUN.replace(/[\[\] ]/g, '')}NPC`
  const npcIns = await gm.request.post(
    `${SUPABASE_URL}/rest/v1/campaign_npcs`,
    {
      headers: { ...H(gmCreds), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      data: { campaign_id: campaignId, name: npcName, wp_max: 10, wp_current: 10, rp_max: 6, rp_current: 6, physicality: 1, dexterity: 1 },
    },
  )
  expect(npcIns.ok(), `campaign_npcs INSERT failed: ${npcIns.status()} ${await npcIns.text()}`).toBe(true)
  const npcId = (await npcIns.json() as Array<{ id: string }>)[0].id

  // Resolve marv's character name for assertions (label format references it).
  const charRow = await (await gm.request.get(
    `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}&select=name`,
    { headers: H(gmCreds) },
  )).json() as Array<{ name: string }>
  const marvName = charRow?.[0]?.name
  expect(marvName, 'could not resolve marv character name').toBeTruthy()

  return { campaignId, npcId, npcName, marvName }
}

test.describe('Combat - Grapple family contract net (2026-06-01 rework)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  // UN-PARKED 2026-06-11: HP shipped the full grapple/subdue/break-free rework
  // (f5b4465, e5c1b61, 05ff9ec, 558ac0e) + Phase A Start-Combat regression fixed.
  // 859 HP tests green. Same wall-segment-door un-fixme pattern validated.

  test('marv drives Grapple via the action-bar UI -> roll_log row lands with one of the three canon outcomes + canonical label shape', async ({ browser }) => {
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

      const setup = await setupGrappleArena({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Grapple`,
      })
      campaignId = setup.campaignId
      const { npcName, marvName } = setup

      // Both clients open the table - marv drives the action bar.
      await Promise.all([
        gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      await gm.waitForTimeout(2000)

      // GM starts the session (combat requires sessionStatus='active').
      await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1500)

      // GM starts combat with the seeded NPC. Picker shows + we tick the first
      // checkbox if nothing is preselected (mirrors section-a1 / Phase A).
      await gm.getByRole('button', { name: /into the moment/i }).first().click()
      await gm.waitForTimeout(800)
      // Confirm button inside the NPC picker reads "⚔️ Into the Moment (N NPCs)";
      // use the paren-variant to distinguish from the header "Into the Moment" button.
      const confirm = gm.getByRole('button', { name: /into the moment \(/i }).first()
      if (!(await confirm.isEnabled().catch(() => false))) {
        await gm.getByRole('checkbox').first().check().catch(() => {})
        await gm.waitForTimeout(300)
      }
      await confirm.click()

      // Combat renamed "Into the Moment" (HP 2026-06); player status shows "IN THE MOMENT".
      await expect(
        pl.getByText(/in the moment/i).first(),
        'player did not see IN THE MOMENT live after Into the Moment',
      ).toBeVisible({ timeout: 25_000 })

      // Seed precondition: make marv's PC the active turn so the action bar
      // renders the Grapple button on marv's client. Initiative is dice-rolled
      // so the actual is_active winner is random; PATCHing it directly here
      // is a fixture, NOT a forced dice outcome - we're not changing what
      // Grapple itself rolls.
      const initRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}&select=id,character_name,is_active`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; character_name: string; is_active: boolean }>
      const marvEntry = initRows.find(e => e.character_name === marvName)
      const npcEntry = initRows.find(e => e.character_name === npcName)
      expect(marvEntry, 'marv PC has no initiative_order row').toBeTruthy()
      expect(npcEntry, 'NPC has no initiative_order row').toBeTruthy()
      // Clear is_active everywhere then set on marv.
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data: { is_active: false } },
      )
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/initiative_order?id=eq.${marvEntry!.id}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data: { is_active: true } },
      )
      // Give realtime a beat to reflect the active swap on marv's UI.
      await pl.waitForTimeout(2500)

      // Drive the Grapple flow on marv's client.
      const grappleBtn = pl.getByRole('button', { name: /^grapple$/i }).first()
      await expect(
        grappleBtn,
        'Grapple button did not render on marv action bar (is marv the active turn?)',
      ).toBeVisible({ timeout: 15_000 })
      await grappleBtn.click()

      // Modal opens with eyebrow "GRAPPLE". Target picker shows engaged combatants.
      // Button text is "{name} (NPC)" - must match the suffix, not exact name.
      await expect(
        pl.getByText(/^grapple$/i).first(),
        'Grapple modal eyebrow did not appear',
      ).toBeVisible({ timeout: 10_000 })
      // Click the NPC target button (sets grappleTarget, enables Roll).
      await pl.getByRole('button', { name: new RegExp(`${npcName}`) }).first().click()

      // Primary action button is "ROLL GRAPPLE" (not generic "Roll").
      await pl.getByRole('button', { name: /roll grapple/i }).first().click()

      // The contract: a roll_log row lands with one of the three canon Grapple
      // outcomes + a label with the raw insert shape from executeGrapple at
      // table/page.tsx: "{actor} - Grapple {target}" (maybeLogGrapple processes
      // it for display but the DB column stores the raw form).
      const labelPatterns = [
        new RegExp(`^${marvName} - Grapple `, 'i'),
      ]
      const found = await expect.poll(
        async () => {
          const r = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=in.(${GRAPPLE_OUTCOMES.map(o => `"${o}"`).join(',')})&select=outcome,label,character_name&order=created_at.desc&limit=1`,
            { headers: H(gmCreds!) },
          )
          const rows = await r.json().catch(() => []) as Array<{ outcome: string; label: string; character_name: string }>
          return rows?.[0] ?? null
        },
        { timeout: 12_000, message: 'no Grapple roll_log row with one of {Grappled!, Failed - 1 RP, No clear victor}' },
      ).not.toBeNull()
      // The above asserts non-null; now grab the row for shape checks. Re-read
      // since the poll returned (we need access to it; expect.poll's return
      // isn't easily captured - one extra GET is cheap and keeps the assertion
      // text honest).
      const rowsFinal = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=in.(${GRAPPLE_OUTCOMES.map(o => `"${o}"`).join(',')})&select=outcome,label,character_name&order=created_at.desc&limit=1`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ outcome: string; label: string; character_name: string }>
      const row = rowsFinal[0]
      expect(GRAPPLE_OUTCOMES, 'roll_log outcome is not one of the canon three').toContain(row.outcome)
      expect(
        labelPatterns.some(p => p.test(row.label)),
        `roll_log label "${row.label}" doesn't match any canonical Grapple shape for actor "${marvName}"`,
      ).toBe(true)
      expect(row.character_name, 'roll_log character_name should be the actor (marv)').toBe(marvName)
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
