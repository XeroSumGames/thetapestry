import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { RULE_SECTIONS } from '../lib/rules/sections'

// Ch5.2 - The Rules: every section + appendix LANDING renders real content (its
// <h1> title via RuleHero), not just an error-free shell, and representative
// deep-link anchor pages render a heading. The 92-route console sweep already
// proves these load without console errors; this adds the distinct guarantee
// that the title actually renders (a crashed error-boundary or empty stub would
// pass the sweep but fail here). Read-only - no writes, no teardown.
// Driven off the canonical RULE_SECTIONS list so new sections are covered free.

const DEEP_LINKS = [
  '/rules/combat/damage',
  '/rules/equipment/item-traits',
  '/rules/communities/activity-blocks', // regressed once (dead-nav 404, the sweep's BUG A) - lock it
]

test.describe('Ch5 - Rules sections + appendices render content', () => {
  test.skip(!canAuth('gm'), 'needs a session to load gated routes')

  test('all 8 sections + 4 appendices show their <h1> title; deep links render', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const page = await ctx.newPage()
    try {
      for (const s of RULE_SECTIONS) {
        // SectionHub strips the "Appendix X - " prefix for the displayed h1.
        const displayTitle = s.title.replace(/^Appendix [A-D] - /, '')
        await page.goto(`/rules/${s.slug}`, { waitUntil: 'domcontentloaded' })
        await expect(
          page.getByRole('heading', { level: 1, name: displayTitle }),
          `${s.slug} missing its <h1> "${displayTitle}" (crashed / bounced / empty)`,
        ).toBeVisible({ timeout: 15_000 })
        expect(page.url(), `/rules/${s.slug} redirected away`).toContain(`/rules/${s.slug}`)
      }

      for (const path of DEEP_LINKS) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await expect(
          page.getByRole('heading').first(),
          `${path} rendered no heading`,
        ).toBeVisible({ timeout: 15_000 })
        expect(page.url(), `${path} redirected away`).toContain(path)
      }
    } finally {
      await ctx.close()
    }
  })
})
