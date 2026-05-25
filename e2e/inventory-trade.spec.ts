import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Sys J - PC inventory: add a catalog item + a custom item via the real
// InventoryPanel (CharacterCard "Inventory" button), assert encumbrance
// recomputes and the items persist (REST on characters.data.inventory + a page
// reload). Inventory lives in characters.data.inventory (jsonb); encumbrance is
// derived live by the (unit-tested) computeEncumbrance, surfaced as the "Gear:"
// breakdown. All writes are to marv's OWN character (RLS "Users can update own
// characters", schema.sql:2187), so it's fully reversible: capture data.inventory
// up-front, restore it in `finally`. No spec reads marv's inventory, so the
// reversible mutation can't race a sibling reader.
//
// PC <-> PC TRADE (2nd test): WAS a confirmed prod DATA-LOSS bug (a Survivor
// giver couldn't write the receiver's characters row under own-row RLS, so the
// item was destroyed). FIXED 2026-05-25: `onGiveItem` now calls the SECURITY
// DEFINER `give_item_to_character` RPC (atomic both-sides, in-function authz;
// PF wrote + applied it, the client rewire shipped via the E2E lane). This test
// is the regression net - matches the finding's intent: marv (a Survivor) gives
// a throwaway item via the RPC + the receiver (percy) GAINS it while marv LOSES
// it, both checked via the acting sessions, reversible capture/restore.
// See tasks/finding-pc-trade-rls-dataloss-2026-05-24.md.

const RUN = Date.now().toString(36)
// THE ARENA character ids (verified against the live roster 2026-05-24/25).
const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32'  // marv: "Cree Blaine"
const PERCY_CHAR = '549df590-37f6-46e5-93cb-5f920b913035' // percy: "Frankie Gibblets"
const SHEET = `/character-sheet?c=${CAMPAIGN_ID}&char=${MARV_CHAR}`

async function charData(page: Page, creds: SupaCreds, charId: string): Promise<any | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/characters?id=eq.${charId}&select=data`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0].data : null
}

function invNames(data: any): string[] {
  return ((data?.inventory ?? []) as { name: string }[]).map(i => i.name)
}

// Read the "Gear:" breakdown number (sum of inventory enc*qty) from the modal.
async function gearEnc(page: Page): Promise<number> {
  const t = (await page.getByText(/^Gear:/).first().textContent()) ?? ''
  const m = t.match(/Gear:\s*([\d.]+)/)
  return m ? parseFloat(m[1]) : NaN
}

test.describe('Sys J - PC inventory (add catalog + custom item, encumbrance, persistence)', () => {
  test.skip(!canAuth('marv'), 'needs marv session/creds')

  test('add a custom + catalog item -> encumbrance recomputes + persists on reload', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.marv })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let original: any = null
    const crate = `[E2E ${RUN}] Crate`
    try {
      const anonP = captureAnonKey(page)
      await page.goto(SHEET, { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve marv creds').toBeTruthy()
      original = await charData(page, creds!, MARV_CHAR)
      expect(original, 'could not read marv character data').toBeTruthy()

      // Open the inventory modal.
      await page.getByRole('button', { name: 'Inventory' }).first().click()
      await expect(page.getByText('Equipment', { exact: true }).first(), 'inventory modal should open').toBeVisible({ timeout: 15_000 })
      const gear0 = await gearEnc(page)
      expect(Number.isNaN(gear0), 'should read the Gear breakdown').toBe(false)

      // --- Add a CUSTOM item (ENC 3) -> encumbrance recomputes by +3 ---
      await page.getByRole('button', { name: '+ Custom Item' }).click()
      await page.getByPlaceholder('Item name').fill(crate)
      await page.getByRole('spinbutton').fill('3') // the ENC number input
      await page.getByRole('button', { name: 'Add Custom Item' }).click()
      await expect.poll(() => gearEnc(page), { timeout: 10_000, message: 'Gear encumbrance should increase by the new item enc (3)' })
        .toBeCloseTo(gear0 + 3, 1)
      await expect.poll(
        async () => invNames(await charData(page, creds!, MARV_CHAR)).includes(crate),
        { timeout: 10_000, message: 'custom item should persist to characters.data.inventory' },
      ).toBe(true)
      await expect(page.getByText(crate, { exact: false }).first(), 'custom item shows in the list').toBeVisible()

      // --- Add a CATALOG item ("Bolt Cutters") ---
      await page.getByRole('button', { name: '+ From Catalog' }).click()
      await page.getByPlaceholder('Search equipment...').fill('Bolt Cutters')
      await page.getByText('Bolt Cutters', { exact: false }).first().click()
      await expect.poll(
        async () => invNames(await charData(page, creds!, MARV_CHAR)).includes('Bolt Cutters'),
        { timeout: 10_000, message: 'catalog item should persist to characters.data.inventory' },
      ).toBe(true)

      // --- Persistence: reload, re-open inventory, the custom item is still there ---
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Inventory' }).first().click()
      await expect(page.getByText(crate, { exact: false }).first(), 'custom item survives a reload (persisted in the DB)').toBeVisible({ timeout: 15_000 })
    } finally {
      // Restore marv's inventory exactly (own-character write).
      if (creds && original) {
        await page.request.patch(
          `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}`,
          {
            headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
            data: { data: original },
          },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })

  // The fix's regression net (was test.fixme while the give-item RPC was pending).
  // marv (a Survivor) gives a throwaway item to percy's PC via the live
  // give_item_to_character RPC; the item MOVES (percy gains, marv loses) instead
  // of vanishing. Reversible: both inventories captured up-front + restored via
  // each owner's own session in finally.
  test('PC->PC trade MOVES the item (receiver gains, giver loses) via the give-item RPC', async ({ browser }) => {
    test.skip(!canAuth('marv') || !canAuth('percy'), 'needs marv + percy sessions/creds')
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const percyCtx = await browser.newContext({ storageState: AUTH.percy })
    const marv = await marvCtx.newPage()
    const percy = await percyCtx.newPage()
    let marvCreds: SupaCreds | null = null
    let percyCreds: SupaCreds | null = null
    let marvOrig: any = null
    let percyOrig: any = null
    const probe = `[E2E ${RUN}] TradeProbe`

    const patchInv = (page: Page, creds: SupaCreds, charId: string, data: any) =>
      page.request.patch(`${SUPABASE_URL}/rest/v1/characters?id=eq.${charId}`, {
        headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
        data: { data },
      })

    try {
      const marvAnon = captureAnonKey(marv)
      const percyAnon = captureAnonKey(percy)
      await marv.goto(SHEET, { waitUntil: 'domcontentloaded' })
      await percy.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      marvCreds = await resolveCreds(marv, marvAnon)
      percyCreds = await resolveCreds(percy, percyAnon)
      expect(marvCreds && percyCreds, 'could not resolve marv + percy creds').toBeTruthy()

      // Capture both inventories for restore.
      marvOrig = await charData(marv, marvCreds!, MARV_CHAR)
      percyOrig = await charData(percy, percyCreds!, PERCY_CHAR)
      expect(marvOrig && percyOrig, 'could not read both characters').toBeTruthy()

      // Seed a unique throwaway item on marv (own-row write) so the trade can't
      // perturb marv's real gear and the assertion is unambiguous.
      const seeded = { ...marvOrig, inventory: [...(marvOrig.inventory ?? []), { name: probe, qty: 1, enc: 1, rarity: 'Common', custom: true, notes: '' }] }
      expect((await patchInv(marv, marvCreds!, MARV_CHAR, seeded)).ok(), 'seed probe on marv failed').toBe(true)

      // marv gives it to percy via the RPC (the exact call the client now makes).
      const give = await marv.request.post(`${SUPABASE_URL}/rest/v1/rpc/give_item_to_character`, {
        headers: { apikey: marvCreds!.anonKey, Authorization: `Bearer ${marvCreds!.accessToken}`, 'Content-Type': 'application/json' },
        data: { p_giver_id: MARV_CHAR, p_target_id: PERCY_CHAR, p_item_name: probe, p_item_custom: true, p_qty: 1 },
      })
      expect(give.ok(), `give RPC failed: ${give.status()} ${await give.text()}`).toBe(true)

      // The item MOVED: percy gained it, marv lost it (pre-fix: marv lost it +
      // percy never got it = destroyed).
      await expect.poll(
        async () => invNames(await charData(percy, percyCreds!, PERCY_CHAR)),
        { timeout: 10_000, message: 'receiver (percy) should GAIN the traded item' },
      ).toContain(probe)
      expect(invNames(await charData(marv, marvCreds!, MARV_CHAR)), 'giver (marv) should no longer hold it').not.toContain(probe)
    } finally {
      // Restore both to their captured originals via each owner's own session.
      if (marvCreds && marvOrig) await patchInv(marv, marvCreds, MARV_CHAR, marvOrig).catch(() => {})
      if (percyCreds && percyOrig) await patchInv(percy, percyCreds, PERCY_CHAR, percyOrig).catch(() => {})
      await marvCtx.close()
      await percyCtx.close()
    }
  })
})
