import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'

// TIER 1 - role-gated navigation (Thriver vs Survivor). This is the bug class
// AGENTS.md warns about: capital-case role literals silently never match the
// lowercased DB value, hiding whole sections from a role group. The sidebar
// gates the "Tools" section + "Moderation Queue" on isThriver (Sidebar.tsx).
// Zero writes; two contexts (GM=Thriver, marv=Survivor) on a sidebar-visible
// route (/dashboard - the sidebar is hidden on full-width/table/popout routes).

test.describe('role-gated nav: Thriver sees Tools, Survivor does not', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('Moderation Queue is Thriver-only in the sidebar', async ({ browser }) => {
    const thriverCtx = await browser.newContext({ storageState: AUTH.gm })
    const survivorCtx = await browser.newContext({ storageState: AUTH.marv })
    try {
      const thriver = await thriverCtx.newPage()
      const survivor = await survivorCtx.newPage()
      await Promise.all([
        thriver.goto('/dashboard', { waitUntil: 'domcontentloaded' }),
        survivor.goto('/dashboard', { waitUntil: 'domcontentloaded' }),
      ])

      // Neither should have bounced to /login (sessions valid).
      expect(thriver.url(), 'GM session expired').not.toContain('/login')
      expect(survivor.url(), 'player session expired').not.toContain('/login')

      // GM (Thriver) sees the Thriver-only Tools link. toBeVisible waits for the
      // sidebar's async role fetch to resolve.
      await expect(thriver.getByText('Moderation Queue')).toBeVisible({ timeout: 15_000 })

      // Survivor must NOT see it. Anchor on a shared sidebar element first so we
      // assert absence only AFTER the survivor's sidebar has actually rendered
      // (avoids a premature pass before the role loads).
      await expect(survivor.getByText('Log Out')).toBeVisible({ timeout: 15_000 })
      await expect(survivor.getByText('Moderation Queue')).toHaveCount(0)
    } finally {
      await thriverCtx.close()
      await survivorCtx.close()
    }
  })
})
