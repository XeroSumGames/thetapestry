import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Rumors marketplace search contract: the /rumors page fetches all modules
// where latest_version_id IS NOT NULL AND archived_at IS NULL (filtered by
// RLS to listed+approved or authored-by-self). The client-side filter in
// useMemo matches against name/tagline/description. This spec:
//
//   1. REST-INSERTs a module (visibility='listed', moderation_status='approved')
//      + a module_version + PATCHes latest_version_id on the module so it
//      appears in the fetch.
//   2. Navigates to /rumors, types the unique name fragment, asserts the card
//      appears (proves the module loaded + client-side filter matched).
//   3. Types nonsense, asserts "No modules match that search" (proves the empty
//      state renders correctly when no module passes the filter).
//
// Only the GM context is needed (author_user_id = auth.uid() -> RLS passes).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Rumors marketplace search', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('typed search filters the module list and shows empty state on no match', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let moduleId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      // Navigate to a lightweight page to initialise the session cookies before
      // resolveCreds reads them.
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      // Build a unique name so the search hit is unambiguous even in a busy list.
      const tag = `E2E-Mod-${Date.now().toString(36)}`

      // Step 1a: REST-INSERT the module.
      const modInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/modules`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { author_user_id: gmUserId, name: tag, visibility: 'listed', moderation_status: 'approved' } },
      )).json() as Array<{ id: string }>
      moduleId = modInsert?.[0]?.id ?? null
      expect(moduleId, 'modules INSERT did not return an id').toBeTruthy()

      // Step 1b: REST-INSERT a module_version. snapshot is jsonb NOT NULL.
      // RLS module_versions_insert: the parent module must be owned by auth.uid().
      const verInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/module_versions`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { module_id: moduleId, version: '1.0', snapshot: {} } },
      )).json() as Array<{ id: string }>
      const versionId = verInsert?.[0]?.id ?? null
      expect(versionId, 'module_versions INSERT did not return an id').toBeTruthy()

      // Step 1c: REST-PATCH the module to set latest_version_id. Without this
      // field set, listAvailableModulesTwoStep filters the row out
      // (.not('latest_version_id', 'is', null) in lib/modules.ts:212).
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/modules?id=eq.${moduleId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { latest_version_id: versionId } },
      )

      // Step 2: Navigate to /rumors. The page fetches modules once on mount.
      // Because the 3 REST calls completed before navigate, the row exists in DB.
      await gm.goto('/rumors', { waitUntil: 'domcontentloaded' })

      // Wait for "Loading modules..." to resolve to an actual count (not "…").
      await expect(
        gm.locator('div').filter({ hasText: /^\d+ modules?$/ }).first(),
        '"N modules" count did not appear - module list may not have loaded',
      ).toBeVisible({ timeout: 15_000 })

      // Type a fragment of the unique name into the search input.
      await gm.getByPlaceholder('Search modules…').fill(tag.slice(0, 10))

      // The module card should appear with the full unique name.
      await expect(
        gm.getByText(tag, { exact: true }),
        `Module card with name "${tag}" did not appear after search`,
      ).toBeVisible({ timeout: 10_000 })

      // Step 3: Type nonsense - triggers the empty state.
      await gm.getByPlaceholder('Search modules…').fill('zzznomatch-e2e-99999')
      await expect(
        gm.getByText('No modules match that search'),
        '"No modules match that search" empty state did not appear',
      ).toBeVisible({ timeout: 8_000 })
    } finally {
      if (moduleId && gmCreds) {
        // module_versions has ON DELETE CASCADE from modules -> version row is
        // cleaned up automatically.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/modules?id=eq.${moduleId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
