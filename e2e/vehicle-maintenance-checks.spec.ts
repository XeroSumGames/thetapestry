import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch9 [Sys] - Vehicle maintenance skill-checks (Install Fuel Drum + Gather
// Materials), shipped by Hunt & Peck in 12fbe58 and routed to this lane for
// durable coverage. Both open the shared <RollModal> through the
// useVehicleCheck hook, roll 2d6 + AMOD/SMOD/CMOD client-side, classify, log a
// roll_log row, and apply the locked lib/vehicle-checks outcome.
//
// DICE-GATED -> we assert FLOW + STRUCTURE, never the rolled value. The
// outcome is Math.random; a value assertion would flake ~half the runs. So:
//   - the right modal opens (title),
//   - the roller picker renders (install/gather have no fixed seat),
//   - rolling resolves (the post-roll Close button replaces Roll) and shows a
//     real XSE outcome banner,
//   - a roll_log row lands tagged damage_json->>checkKind = install|gather,
//     and its outcome is one of the six valid XSE outcomes.
// The success-only vehicle deltas (fuel_max +1 / brewing_supplies +1) are NOT
// asserted - they only fire on success tiers (see lib/vehicle-checks.ts).
//
// RUNS IN ITS OWN THROWAWAY CAMPAIGN, never The Arena: install/gather mutate
// the vehicle JSON on campaigns.vehicles + write roll_log; a fresh campaign
// isolates that. The GM owns the campaign, so its own session can PATCH
// campaigns.vehicles (the "GM can update campaigns" RLS policy only rejects
// NON-GM writes - that's why the in-app non-GM path needs the RPC) and INSERT
// campaign_npcs ("GM can manage campaign NPCs"). Teardown deletes the campaign;
// CASCADE clears campaign_npcs + roll_log. Nothing touched outside what this
// test created. Zero app testids - every selector is real DOM text.

const RUN = `[E2E ${Date.now().toString(36)}]`
const VALID_OUTCOMES = ['Wild Success', 'Success', 'High Insight', 'Low Insight', 'Failure', 'Dire Failure']

// roll_log rows for a given vehicle check-kind, visible to the acting session.
async function checkKindRows(
  page: Page, creds: SupaCreds, campaignId: string, kind: 'install' | 'gather',
): Promise<Array<{ outcome: string; label: string; damage_json: any }>> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&damage_json->>checkKind=eq.${kind}&select=outcome,label,damage_json`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return []
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

// Drive one maintenance check end to end: open the modal via its trigger
// button, confirm the modal + roller picker, roll, confirm resolution, then
// verify the structural side-effect (a tagged roll_log row with a real
// outcome). Returns nothing; asserts inline so a failure points at the step.
async function runCheck(
  gm: Page, creds: SupaCreds, campaignId: string,
  opts: { trigger: string; title: string; rollLabel: RegExp; kind: 'install' | 'gather' },
) {
  await gm.getByRole('button', { name: opts.trigger, exact: true }).click()

  // Modal opened: title + the install/gather-only roller picker ("Who's doing it").
  await expect(gm.getByText(opts.title, { exact: true }), `${opts.kind}: modal title`).toBeVisible({ timeout: 15_000 })
  await expect(gm.getByText(/who.s doing it/i), `${opts.kind}: roller picker present`).toBeVisible()

  // Roll. Post-roll, the "Close" button replaces "Roll" - that transition IS
  // the resolution, and a real XSE outcome banner renders.
  await gm.getByRole('button', { name: opts.rollLabel }).click()
  const closeBtn = gm.getByRole('button', { name: 'Close', exact: true })
  await expect(closeBtn, `${opts.kind}: roll resolved (Close replaces Roll)`).toBeVisible({ timeout: 15_000 })
  await expect(
    gm.getByText(new RegExp(VALID_OUTCOMES.join('|'))).first(),
    `${opts.kind}: an XSE outcome banner renders`,
  ).toBeVisible()

  // Structural side-effect: a roll_log row tagged with this check-kind, whose
  // outcome is one of the six valid XSE outcomes (the authoritative,
  // dice-independent proof the flow ran end to end).
  await expect.poll(
    async () => (await checkKindRows(gm, creds, campaignId, opts.kind)).length,
    { timeout: 10_000, message: `${opts.kind}: a roll_log row should land tagged checkKind=${opts.kind}` },
  ).toBeGreaterThan(0)
  const rows = await checkKindRows(gm, creds, campaignId, opts.kind)
  expect(VALID_OUTCOMES, `${opts.kind}: logged a valid XSE outcome`).toContain(rows[0].outcome)
  expect(rows[0].damage_json?.vehicleName, `${opts.kind}: row bound to our vehicle`).toContain(RUN)

  await closeBtn.click()
}

test.describe('Ch9 - Vehicle maintenance checks (install fuel drum / gather materials)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM rolls an Install Fuel Drum check, then a Gather Materials check (both log + resolve)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    gm.on('dialog', d => d.accept().catch(() => {})) // safety: surface no-crew alert as a fast modal-timeout instead of a hang
    let campaignId: string | null = null
    let creds: SupaCreds | null = null
    const vehicleId = randomUUID()
    try {
      const anonP = captureAnonKey(gm)

      // --- Throwaway campaign via the real form (same path as session-lifecycle) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} VehicleMaint`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id in landing URL').toBeTruthy()

      const authHeaders = { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}` }

      // --- Seed one crew member so openCheck() doesn't alert "Add a crew
      //     member" (it needs crew.length > 0). A null wp_current still passes
      //     the popout's crew filter (death_countdown is null). ---
      const npcRes = await gm.request.post(`${SUPABASE_URL}/rest/v1/campaign_npcs`, {
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        data: { campaign_id: campaignId, name: `${RUN} Wrench` },
      })
      expect(npcRes.ok(), 'seed crew NPC').toBeTruthy()

      // --- Seed a vehicle configured to enable BOTH buttons ---
      //   Install: fuel_storage_max (6) > base (4) -> section renders; headroom
      //            2 drums; one 55-Gallon Drum in cargo -> button enabled.
      //   Gather:  brewing_supplies_max 2 > current 0 -> button enabled.
      const vehicle = {
        id: vehicleId,
        name: `${RUN} Rustbucket`,
        type: 'Bus',
        rarity: 'Common',
        size: 3,
        speed: 30,
        passengers: 6,
        encumbrance: 50,
        range: 'Medium',
        wp_max: 30,
        wp_current: 30,
        stress: 0,
        fuel_max: 4,
        fuel_current: 4,
        fuel_max_base: 4,
        fuel_storage_max: 6,
        brewing_supplies_current: 0,
        brewing_supplies_max: 2,
        three_words: 'rusty loud reliable',
        notes: '',
        image_url: null,
        floorplan_url: null,
        has_still: true,
        cargo: [{ name: '55-Gallon Drum', qty: 1, enc: 2, rarity: 'Common', custom: false, notes: '' }],
        mounted_weapons: [],
        passenger_seats: [null, null, null, null, null, null],
        driver_character_id: null, driver_kind: null,
        brewer_character_id: null, brewer_kind: null,
        navigator_character_id: null, navigator_kind: null,
      }
      const patchRes = await gm.request.patch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`, {
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        data: { vehicles: [vehicle] },
      })
      expect(patchRes.ok(), 'seed vehicle into campaigns.vehicles').toBeTruthy()

      // --- Open the vehicle popout. Both buttons enabled gates load + canEdit
      //     (GM owns the campaign) + the per-feature drum/supply gating. ---
      await gm.goto(`/vehicle?c=${campaignId}&v=${vehicleId}`, { waitUntil: 'domcontentloaded' })
      await expect(gm.getByRole('button', { name: '+ Install', exact: true }), 'Install button (load + gating)').toBeVisible({ timeout: 30_000 })
      await expect(gm.getByRole('button', { name: '+ Gather Materials', exact: true }), 'Gather button (load + gating)').toBeVisible()
      // No maintenance rolls logged yet.
      expect(await checkKindRows(gm, creds!, campaignId!, 'install'), 'no install rolls before').toHaveLength(0)
      expect(await checkKindRows(gm, creds!, campaignId!, 'gather'), 'no gather rolls before').toHaveLength(0)

      // --- Install Fuel Drum check ---
      await runCheck(gm, creds!, campaignId!, {
        trigger: '+ Install',
        title: 'Install Fuel Drum',
        rollLabel: /Roll Install Fuel Drum/,
        kind: 'install',
      })

      // --- Gather Materials check (independent fields; install removed the
      //     drum from cargo but brewing supplies are untouched) ---
      await runCheck(gm, creds!, campaignId!, {
        trigger: '+ Gather Materials',
        title: 'Gather Materials',
        rollLabel: /Roll Gather Materials/,
        kind: 'gather',
      })
    } finally {
      // Delete the throwaway campaign; CASCADE removes campaign_npcs + roll_log.
      if (campaignId && creds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
