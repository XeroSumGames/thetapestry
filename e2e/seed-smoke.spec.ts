import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, restCount, restDelete } from './_teardown'
import { seedCommunity, seedStockpileItem, captureVehicles, seedVehicle, restoreVehicles } from './_seed'

// GATE 0 step 1 - fixture seeding integrity. Proves the seed/teardown infra the
// A-F realtime specs depend on actually works against the live Arena: each seed
// inserts, is readable, and cleans up completely. Deterministic (no realtime).
// Acts as GM (the identity Section D community-seed + vehicle RPC require).

test.use({ storageState: canAuth('gm') ? AUTH.gm : undefined })

test.describe('Gate 0 fixture seeding (Arena): seed -> exists -> teardown', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('community + stockpile item seed and cascade-clean', async ({ page }) => {
    const anonKeyP = captureAnonKey(page)
    await page.goto('/dashboard') // triggers a Supabase request so the anon key is captured
    const creds = await resolveCreds(page, anonKeyP)
    expect(creds, 'could not resolve GM creds').toBeTruthy()

    const communityId = await seedCommunity(page, creds!, CAMPAIGN_ID, '[E2E] Seed Community')
    expect(communityId, 'community insert returned no id').toBeTruthy()

    const itemId = await seedStockpileItem(page, creds!, communityId, '[E2E] Canned Beans')
    expect(await restCount(page, 'community_stockpile_items', itemId, creds!), 'stockpile item not persisted').toBe(1)

    // Deleting the community cascades its stockpile rows.
    expect(await restDelete(page, 'communities', communityId, creds!), 'community delete failed').toBe(true)
    expect(await restCount(page, 'community_stockpile_items', itemId, creds!), 'stockpile not cascade-cleaned').toBe(0)
  })

  test('vehicle seed via RPC and restore', async ({ page }) => {
    const anonKeyP = captureAnonKey(page)
    await page.goto('/dashboard')
    const creds = await resolveCreds(page, anonKeyP)
    expect(creds, 'could not resolve GM creds').toBeTruthy()

    const before = await captureVehicles(page, creds!, CAMPAIGN_ID)
    const r = await seedVehicle(page, creds!, CAMPAIGN_ID, 'e2e-test-rig')
    expect(r.ok, `vehicle RPC failed: ${r.detail}`).toBe(true)

    const after = await captureVehicles(page, creds!, CAMPAIGN_ID)
    expect(after.some((v) => (v as { id?: string }).id === 'e2e-test-rig'), 'seeded vehicle not present').toBe(true)

    // Restore the original vehicles array (the RPC can only replace/append).
    expect(await restoreVehicles(page, creds!, CAMPAIGN_ID, before), 'restore failed').toBe(true)
    const restored = await captureVehicles(page, creds!, CAMPAIGN_ID)
    expect(restored.some((v) => (v as { id?: string }).id === 'e2e-test-rig'), 'vehicle not cleaned up').toBe(false)
  })
})
