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
// PC <-> PC TRADE is a separate test, marked test.fixme: it is a CONFIRMED prod
// DATA-LOSS bug (a Survivor giver cannot write the receiver's characters row
// under own-row RLS, so the item is destroyed) - routed to Puffer Fish (RLS/RPC)
// + Hunt & Peck (client). See tasks/finding-pc-trade-rls-dataloss-2026-05-24.md.
// Un-fixme once the SECURITY DEFINER give-item RPC lands.

const RUN = Date.now().toString(36)
// marv's character in THE ARENA (verified against the live roster 2026-05-24).
const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32'
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

  // BLOCKED on a prod data-loss bug (finding-pc-trade-rls-dataloss-2026-05-24.md):
  // a Survivor giver's session cannot write the receiver's characters row (own-row
  // RLS), so the give silently no-ops while the sender's item is removed -> item
  // destroyed. Un-fixme once a SECURITY DEFINER give-item RPC lands; then this
  // asserts marv gives an item -> percy's REST inventory GAINS it (and marv's
  // loses it), both via the acting sessions, with a reversible capture/restore.
  test.fixme('PC->PC trade moves the item to the receiver (pending the give-item RPC fix)', async () => {
    // Intentionally empty until the RPC exists - see the finding doc.
  })
})
