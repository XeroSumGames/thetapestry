import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Ch6 - Story-page action buttons: Delete via the type-to-confirm gate.
//
// StoryActionBar renders a Delete button (GM-only) on every campaign page.
// Clicking it calls confirmDeleteByName() which fires window.prompt() asking
// the GM to type the story name exactly. On a match: the campaign row is
// deleted and router.push('/stories') fires. This test drives that full flow.
//
// Flow:
//   1. Create throwaway campaign via REST (simpler than the UI form).
//   2. Navigate to the story hub /stories/[id].
//   3. Wait for StoryActionBar to load (it fetches campaign data on mount and
//      renders the Delete button only once isGM=true is confirmed).
//   4. Register a dialog handler: when window.prompt fires, accept with the
//      exact campaign name so confirmDeleteByName returns true.
//   5. Click the Delete button.
//   6. Wait for navigation to /stories.
//   7. Poll REST to confirm the campaign row is gone from the DB.
//
// The throwaway campaign has no published module, so no secondary warning
// dialog is shown (the warning path is module-gated in handleDelete).
//
// Teardown: in the finally block, the fallback REST DELETE is a no-op if the
// UI delete already ran (DELETE on a non-existent row returns 200 with 0 rows).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Story delete action - type-to-confirm gate', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM deletes a story via the type-to-confirm prompt and campaign is removed', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-DEL-${Date.now().toString(36)}`
      const campaignName = `${tag}-story`

      // Throwaway campaign via REST. invite_code has no DEFAULT.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns?select=id`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: campaignName, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // Navigate to the story hub. StoryActionBar fetches campaign data on mount
      // and sets isGM=true when gm_user_id matches the logged-in user.
      await gm.goto(`/stories/${campaignId}`, { waitUntil: 'domcontentloaded' })

      // Wait for the Delete button. It is rendered only after StoryActionBar
      // resolves isGM=true from the fetched campaign row.
      const deleteBtn = gm.getByRole('button', { name: 'Delete', exact: true })
      await expect(deleteBtn, '"Delete" button not found after StoryActionBar hydrated').toBeVisible({ timeout: 20_000 })

      // Register the dialog handler BEFORE clicking. confirmDeleteByName calls
      // window.prompt() (not window.confirm); Playwright routes both through
      // the 'dialog' event. Accept with the exact campaign name so the
      // trimmed-match check in confirmDeleteByName returns true.
      gm.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          await dialog.accept(campaignName)
        } else {
          await dialog.dismiss()
        }
      })

      await deleteBtn.click()

      // After a successful delete, StoryActionBar calls router.push('/stories').
      await gm.waitForURL(/\/stories$/, { timeout: 15_000 })

      // Confirm the row is gone from the DB.
      const checkRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=id`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string }>
      expect(checkRows.length, 'campaign still present in DB after Delete action').toBe(0)
      campaignId = null  // already deleted; skip fallback REST delete
    } finally {
      if (campaignId && gmCreds) {
        // Fallback: UI delete did not complete; clean up via REST.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
