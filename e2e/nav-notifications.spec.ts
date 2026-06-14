import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Notification bell UI contract: the NotificationBell in FeedColumn loads the
// top-10 notifications on mount (sorted created_at DESC), shows an unread badge
// when unreadCount > 0, and lets the user delete individual notifications from
// the dropdown. This spec:
//
//   1. REST-INSERTs a notification for the GM BEFORE navigating so the mount-
//      load picks it up immediately (no realtime race).
//      RLS note: no INSERT policy for regular users, but the GM is a Thriver
//      and notifications_thriver_bypass (FOR ALL, is_thriver()) allows the write.
//   2. Navigates GM to The Arena's table page (NotificationBell in FeedColumn).
//   3. Waits for the orange (unread) bell SVG - confirms mount-load found the row.
//   4. Clicks the bell, asserts the unique title appears in the dropdown.
//   5. Clicks ✕ on that notification row, asserts it disappears.
//
// Teardown: the test deletes the notification via the UI. A REST fallback in
// `finally` cleans up if the UI delete didn't fire.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Nav notification bell', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('notification appears in bell dropdown on load and can be deleted', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let notifId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-NB-${Date.now().toString(36)}`

      // Insert the notification BEFORE navigating so the bell's mount-load finds it.
      // type='system' falls through to `return body` in colorizeBody (no special
      // rendering); title is always shown as-is in the row header span.
      const notifInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/notifications`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { user_id: gmUserId, type: 'system', title: tag, body: 'E2E notification spec - safe to ignore', link: null } },
      )).json() as Array<{ id: string }>
      notifId = notifInsert?.[0]?.id ?? null
      expect(notifId, 'notifications INSERT did not return an id (check thriver_bypass RLS)').toBeTruthy()

      // Navigate to The Arena table page where FeedColumn renders the NotificationBell.
      await gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })

      // Wait for the bell SVG to turn orange (#EF9F27) - that fill is only applied
      // when unreadCount > 0, meaning the mount-load found at least one unread row.
      // The bell SVG path starts with 'M12 2C10.9' (bell icon shape).
      const bellSvg = gm.locator('svg[fill="#EF9F27"]').filter({ has: gm.locator('path[d^="M12 2"]') })
      await expect(bellSvg, 'orange (unread) notification bell SVG not found - mount load may not have picked up the inserted notification').toBeVisible({ timeout: 20_000 })

      // Click the parent button to open the dropdown.
      await bellSvg.locator('..').click()

      // "Notifications" header text confirms the correct dropdown opened.
      await expect(gm.getByText('Notifications'), '"Notifications" dropdown header not found after clicking bell').toBeVisible({ timeout: 5_000 })

      // Our unique notification title should appear in the list.
      // NotificationBell renders n.title in a <span> (textTransform:uppercase via CSS,
      // but the DOM text node is still the original case - getByText matches DOM text).
      const titleEl = gm.getByText(tag, { exact: true }).first()
      await expect(titleEl, `notification title "${tag}" not found in bell dropdown`).toBeVisible({ timeout: 10_000 })

      // The ✕ delete button is a sibling of the title within the notification row's
      // header flex div: div(header-flex) > [span(title) | div > [span(time), button(✕)]].
      // Navigate up one level from the title span to the header flex div, then find
      // the button within it.
      await titleEl.locator('..').locator('button').filter({ hasText: '✕' }).click()
      notifId = null // UI delete succeeded - no REST fallback needed

      // Notification row should disappear from the open dropdown.
      await expect(
        gm.getByText(tag, { exact: true }),
        `notification "${tag}" still visible in dropdown after clicking ✕`,
      ).not.toBeVisible({ timeout: 5_000 })
    } finally {
      if (notifId && gmCreds) {
        // Fallback: UI delete did not fire - clean up via REST.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/notifications?id=eq.${notifId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
