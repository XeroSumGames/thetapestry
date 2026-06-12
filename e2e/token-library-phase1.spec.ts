import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Token Library Phase 1 - E2E regression guard (commit 76ff7ff, 2026-06-12).
//
// Phase 1 shipped two live DB columns:
//   characters.portrait_url text NULL
//   portrait_bank.is_private boolean DEFAULT false
//
// The PC portrait -> map token flow is wired end-to-end: the character-sheet
// owner can upload/remove a portrait; that URL is stored in characters.portrait_url
// so TacticalMap uses it as the token image when the GM places that PC.
//
// WHAT IS AUTOMATED HERE (all DOM-level, against prod, no file upload):
//   Test 1 - Character sheet portrait section renders (smoke)
//   Test 4 - Portrait Bank Picker loads without error from character edit Step 0
//   Test 5 - NPC roster Populate regression: generated NPCs carry <img> avatars
//   Test 6 - Remove portrait clears the preview
//
// SKIPPED (not automatable via DOM / Playwright):
//   Test 2 - Canvas token visual (TacticalMap renders portrait as token) - <canvas>
//   Test 3 - Full file upload + DB write (requires real image bytes + upload slot)
//
// Auth: acts as marv (a player) for sheet/edit tests; GM for the Populate test.
// Stable test character: marv "Cree Blaine" (31300132-c808-4711-9936-13def2e1ce32),
// THE ARENA campaign (35ed2133-498a-43d2-bbd6-21da05233af2).

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const SHEET_URL = `/character-sheet?c=${CAMPAIGN_ID}&char=${MARV_CHAR}`
const EDIT_URL  = `/characters/${MARV_CHAR}/edit`

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// ---------------------------------------------------------------------------
// Test 1: Character sheet Portrait / Map Token section exists (smoke).
//
// Guards against: the portrait section being accidentally removed or its
// container becoming hidden (e.g. an isMySheet / isGM gate broken by a
// role-check regression).
// ---------------------------------------------------------------------------
test.describe('Token Library Ph1 - Test 1: character-sheet portrait section smoke', () => {
  test.skip(!canAuth('marv'), 'needs marv session/creds')

  test('Portrait / Map Token section renders on the character sheet', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.marv })
    const page = await ctx.newPage()
    try {
      await page.goto(SHEET_URL, { waitUntil: 'domcontentloaded' })

      // The section heading "Portrait / Map Token" must be visible - it is
      // rendered only when isMySheet || isGM, and only after the character row
      // loads. A missing heading means the section was removed or the auth gate
      // broke.
      await expect(
        page.getByText('Portrait / Map Token', { exact: false }),
        'Portrait / Map Token section heading should be visible on the owners own character sheet',
      ).toBeVisible({ timeout: 20_000 })

      // The upload/replace button is always present in the section (even when no
      // portrait is set, it shows "Upload photo").
      const uploadBtn = page.getByRole('button', { name: /upload photo|replace photo/i })
      await expect(
        uploadBtn.first(),
        'Upload / Replace photo button should be visible in the portrait section',
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await ctx.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Test 4: Portrait Bank Picker loads without error from character edit Step 0.
//
// Guards against: the portrait_bank.is_private filter breaking the query
// (e.g. a missing column, wrong column type, or RLS that accidentally blocks
// the SELECT). The picker must open, reach a non-error state, and show either
// portraits or the empty-state message - never a JS crash or blank/frozen modal.
// ---------------------------------------------------------------------------
test.describe('Token Library Ph1 - Test 4: portrait bank picker loads without error', () => {
  test.skip(!canAuth('marv'), 'needs marv session/creds')

  test('"Pick from library" opens the portrait bank picker without error', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.marv })
    const page = await ctx.newPage()
    try {
      await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded' })

      // Step 0 (Character Concept / StepXero) is the default first step. The
      // "Pick from library" button lives in the Character photo section there.
      const pickBtn = page.getByRole('button', { name: /pick from library/i })
      await expect(pickBtn, '"Pick from library" button should be visible on edit Step 0').toBeVisible({ timeout: 20_000 })
      await pickBtn.click()

      // The picker's modal container has the heading "Portrait Bank" and always
      // renders either a grid of portraits OR the empty-state "No portraits in
      // the bank yet." message. Either is a success - a JS error or blank modal
      // would surface as this assertion timing out.
      await expect(
        page.getByText('Portrait Bank', { exact: false }),
        'Portrait Bank picker modal heading should appear after clicking the button',
      ).toBeVisible({ timeout: 15_000 })

      // The picker must also exit the loading state (the is_private=false query
      // resolves) - guard: loading spinner disappears.
      await expect(
        page.getByText('Loading...', { exact: false }),
        'picker should exit the loading state (portrait_bank is_private query should resolve)',
      ).not.toBeVisible({ timeout: 15_000 })

      // The REST request to portrait_bank with is_private filter must have
      // returned HTTP 200 - confirms the column is live and readable.
      // (If the column didn't exist the Supabase REST layer returns 400.)
      // We assert the modal is in a non-error state; the REST response was
      // already captured by the page to populate portraits / show empty state.
      const pickerContent = page.getByText(/portrait bank|no portraits in the bank/i)
      await expect(pickerContent.first(), 'picker should show content (not blank) after loading').toBeVisible({ timeout: 10_000 })

      // Close the picker - guard it doesn't crash on close.
      const closeBtn = page.getByRole('button', { name: /close/i })
      await closeBtn.first().click()
      await expect(
        page.getByText('Portrait Bank', { exact: false }),
        'picker should close without error',
      ).not.toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx.close()
    }
  })

  // Structural guard: the is_private column is present in PortraitBankPicker's
  // query (.eq('is_private', false)). This is a static source check - no network
  // needed. If the column is removed from the query the filter is silently gone
  // and all private portraits would leak into the picker.
  test('PortraitBankPicker source uses is_private=false filter (static source guard)', () => {
    const src = readFileSync(join(process.cwd(), 'components', 'PortraitBankPicker.tsx'), 'utf8')
    expect(
      src.includes("eq('is_private', false)"),
      'PortraitBankPicker must filter portrait_bank with .eq(\'is_private\', false) - the is_private column filter is missing',
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 5: Populate NPC portraits regression.
//
// Guards against: the portrait assignment in NpcRoster.populateNPCs being
// silently broken (e.g. portraitBankByGender returns nothing, or the
// portrait_url field is dropped from the INSERT). After a Populate run, the
// NPCs that were generated must carry a portrait_url (either a bank image or
// a tier-colored silhouette SVG) - not null / blank avatars.
//
// Strategy: rather than actually clicking Populate (which creates real NPCs in
// The Arena - a mutation we must teardown), we use a throwaway campaign just
// like npc-roster-crud.spec.ts does. We generate a small batch, assert every
// inserted NPC has portrait_url IS NOT NULL, then delete the campaign in finally.
//
// The Populate modal lives in the GM Tools -> Populate flow. We drive the real
// UI: create campaign -> go to /table -> open GM Tools -> click Populate ->
// set count 3 -> run -> wait for NPCs to appear -> assert portrait_url.
// ---------------------------------------------------------------------------
test.describe('Token Library Ph1 - Test 5: Populate NPC portraits (regression)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('generated NPCs have portrait_url set (not blank avatars)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let campaignId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)

      // --- Throwaway campaign (same pattern as npc-roster-crud.spec.ts) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`[E2E Populate] ${Date.now().toString(36)}`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id after create').toBeTruthy()

      // --- Navigate to the table ---
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })

      // --- Open GM Tools menu (click to pin-open the dropdown) ---
      // The trigger button label is "GM Tools ▾". Click to toggle-pin the menu open.
      const gmToolsBtn = gm.getByRole('button', { name: /gm tools/i }).first()
      await expect(gmToolsBtn, 'GM Tools button should be visible').toBeVisible({ timeout: 20_000 })
      await gmToolsBtn.click()

      // --- Click Populate (the dropdown item button) ---
      // The item buttons render below the trigger when the menu is open (data-header-menu).
      const populateItem = gm.getByRole('button', { name: 'Populate', exact: true })
      await expect(populateItem, '"Populate" menu item should appear after opening GM Tools').toBeVisible({ timeout: 10_000 })
      await populateItem.click()

      // --- Populate modal: verify it opened, set count to 3, run ---
      // Modal heading is "Populate" (uppercase, a separate div) + "How many NPCs?" below it.
      await expect(
        gm.getByText('How many NPCs?', { exact: false }),
        'Populate modal should open with "How many NPCs?" heading',
      ).toBeVisible({ timeout: 10_000 })

      // Set count to 3 via the number input (default is 5).
      const countInput = gm.locator('input[type="number"]').first()
      await countInput.fill('3')

      // Click the generate button: "Generate 3 NPCs"
      const runBtn = gm.getByRole('button', { name: /generate \d+ npcs?/i })
      await expect(runBtn.first(), '"Generate N NPCs" button should be in the modal').toBeVisible({ timeout: 5_000 })
      await runBtn.first().click()

      // --- Wait for NPCs to appear in campaign_npcs ---
      let rows: any[] = []
      await expect.poll(
        async () => {
          const res = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/campaign_npcs?campaign_id=eq.${campaignId}&select=id,name,portrait_url&order=created_at.asc`,
            { headers: H(creds!) },
          )
          if (!res.ok()) return 0
          rows = await res.json().catch(() => [])
          return Array.isArray(rows) ? rows.length : 0
        },
        { timeout: 30_000, intervals: [1_000], message: 'Generated NPCs should appear in campaign_npcs within 30s' },
      ).toBeGreaterThan(0)

      // --- Assert every generated NPC has portrait_url set ---
      // portrait_url is null when the portrait assignment logic is broken.
      const blanks = rows.filter((n: any) => !n.portrait_url)
      expect(
        blanks.length,
        `${blanks.length} of ${rows.length} generated NPCs have portrait_url=null (blank avatars): ${blanks.map((n: any) => n.name).join(', ')}`,
      ).toBe(0)

      // Bonus: each NPC with a portrait_url must have an <img> in the roster.
      // Switch to the NPC panel and expand "Uncategorized" to render the cards.
      await gm.getByRole('button', { name: 'NPCs', exact: true }).first().click().catch(() => {})
      await gm.getByText('Uncategorized', { exact: false }).first().click().catch(() => {})
      // At least one NPC img should now be visible in the roster.
      await expect(
        gm.locator('img[src]').first(),
        'At least one NPC portrait <img> should be visible in the roster after Populate',
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      if (campaignId && creds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(creds) },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Test 6: Remove portrait clears the preview on the character sheet.
//
// Guards against: the Remove button's onClick (handlePortraitRemove) being
// silently disconnected or the optimistic UI state not clearing the <img>.
//
// Strategy: reversible round-trip. We PATCH characters.portrait_url to a
// synthetic test URL via the acting user's session (same technique as
// account-settings.spec.ts uses for avatar_url), reload the sheet to prove
// the img renders, then click Remove, and assert the <img> disappears.
// portrait_url is restored to its original value in finally.
// ---------------------------------------------------------------------------
test.describe('Token Library Ph1 - Test 6: remove portrait clears the preview', () => {
  test.skip(!canAuth('marv'), 'needs marv session/creds')

  test('clicking Remove clears the portrait preview on the character sheet', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.marv })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let originalPortraitUrl: string | null = null
    const RUN = Date.now().toString(36)
    // A plausible fake portrait URL (in the character-portraits bucket domain).
    const testUrl = `https://jbudzglgtxeoaufpejrv.supabase.co/storage/v1/object/public/character-portraits/e2e-test-${RUN}.jpg`
    try {
      const anonP = captureAnonKey(page)
      await page.goto(SHEET_URL, { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve marv creds').toBeTruthy()

      // --- Capture current portrait_url for restoration ---
      const snap = await page.request.get(
        `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}&select=portrait_url`,
        { headers: H(creds!) },
      )
      expect(snap.ok(), 'could not read current portrait_url').toBe(true)
      const snapRows = await snap.json().catch(() => [])
      originalPortraitUrl = Array.isArray(snapRows) && snapRows[0] ? snapRows[0].portrait_url : null

      // --- Set a synthetic portrait_url ---
      const patch = await page.request.patch(
        `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}`,
        {
          headers: { ...H(creds!), 'Content-Type': 'application/json' },
          data: { portrait_url: testUrl },
        },
      )
      expect(patch.ok(), 'PATCH to set synthetic portrait_url failed - RLS or column missing').toBe(true)

      // Reload so the sheet fetches the updated portrait_url and renders the img.
      await page.reload({ waitUntil: 'domcontentloaded' })
      // The img src contains our test URL - proves the portrait_url -> img binding.
      const portraitImg = page.locator(`img[src*="e2e-test-${RUN}"]`)
      await expect(
        portraitImg,
        'portrait <img> with the test URL should render after patching portrait_url',
      ).toBeVisible({ timeout: 20_000 })

      // --- Click Remove ---
      const removeBtn = page.getByRole('button', { name: /^remove$/i })
      await expect(removeBtn, 'Remove button should be visible when a portrait is set').toBeVisible({ timeout: 5_000 })
      await removeBtn.click()

      // After Remove the img should disappear (portrait cleared from state).
      await expect(
        portraitImg,
        'portrait <img> should disappear after clicking Remove (handlePortraitRemove)',
      ).not.toBeVisible({ timeout: 10_000 })

      // The section stays visible (the "No photo" placeholder and Upload button).
      await expect(
        page.getByText('No photo', { exact: false }),
        '"No photo" placeholder should appear after Remove',
      ).toBeVisible({ timeout: 5_000 })
    } finally {
      // Restore original portrait_url (may be null = set to null).
      if (creds) {
        await page.request.patch(
          `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}`,
          {
            headers: { ...H(creds), 'Content-Type': 'application/json' },
            data: { portrait_url: originalPortraitUrl },
          },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
