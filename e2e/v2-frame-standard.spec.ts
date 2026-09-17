import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 1.4 - the house VTT frame, MEASURED.
 *
 * Ported from the Mothership reference scripts/test-frame.ts. IMPORTANT
 * DIFFERENCE, deliberate: the reference is a STATIC test - it reads
 * app/globals.css as text and regex-asserts declarations, and never opens a
 * browser. It therefore cannot produce any of the numbers this phase is about
 * (used track widths, the frame's bottom edge, the strip growing on a wrapped
 * tab). This port asserts the same standard by MEASURING the rendered page,
 * which is strictly stronger: it catches drift the CSS text would still look
 * correct for - a cascade override, a parent that stops filling, a wrap that
 * pushes the frame off screen.
 *
 * TARGET IS LOCALHOST, not prod. Nothing is live under the local-first policy
 * (Xero 2026-09-16), so /v2 exists only on the dev server.
 *
 * DO NOT trust an HTTP 200 here. LayoutShell returns a blank div server-side
 * until its auth check resolves, so every Tapestry page's server HTML is the
 * pre-auth shell - 200 says "reachable", never "rendered". Every check below
 * waits for a real element and measures it in a browser.
 *
 * The standard: TheTable/tasks/vtt-frame-standard.md. If a number here
 * changes, the SPEC changes first and this file follows.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const TARGET = BASE + '/v2/dashboard'

/** The right rail is SUPPRESSED on this page - a sanctioned two-column
 *  configuration (frame--noright). The 260px rail arrives in 1.2b and gets its
 *  own assertions here then. */
const EXPECTED_TABS = ['DASHBOARD', 'MY SURVIVORS', 'MY STORIES', 'MY COMMUNITIES', 'THE CAMPFIRE', 'THE RULES']

const LEFT_RAIL = 280
const TITLEBAR = 45
const STRIP_MIN = 34

interface Case { w: number; h: number; strip: number; restTab: number; centre: number; note: string }

/* Measured twice and agreed by HP and the hub before this spec existed.
   centre = width - LEFT_RAIL - 1px gap. restTab = (width - 280) / 5. */
const CASES: Case[] = [
  { w: 1920, h: 1080, strip: 34, restTab: 328, centre: 1639, note: 'desktop' },
  { w: 1280, h: 800, strip: 34, restTab: 200, centre: 999, note: 'laptop' },
  { w: 900, h: 800, strip: 48, restTab: 124, centre: 619, note: 'a tab label wraps - the strip GROWS and the frame still ends exactly at the viewport' },
]

const round = (n: number) => Math.round(n)

async function box(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox()
  if (!b) throw new Error('no bounding box for ' + sel + ' - element missing or not rendered')
  return b
}

test.describe('VTT house frame standard - /v2 measured', () => {
  test.beforeAll(async ({ request }) => {
    // Reachability only. Render is proven per-test by waiting on .frame.
    const res = await request.get(TARGET).catch(() => null)
    test.skip(!res || !res.ok(), 'dev server not serving ' + TARGET + ' - start it in the primary checkout and re-run (this spec is localhost-only by design)')
  })

  for (const c of CASES) {
    test(c.w + 'x' + c.h + ' - ' + c.note, async ({ page }) => {
      await page.setViewportSize({ width: c.w, height: c.h })
      await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
      // Proof of RENDER, not of 200: the frame itself must exist.
      await expect(page.locator('.frame'), 'the frame rendered (200 alone proves nothing here)').toBeVisible({ timeout: 20_000 })

      /* ---- the section tabs: Xero's set, in his order ---- */
      const labels = (await page.locator('.navstrip .navtab').allTextContents()).map(s => s.trim().toUpperCase())
      expect(labels, 'the six section tabs, in order').toEqual(EXPECTED_TABS)

      /* ---- chrome heights ---- */
      expect(round((await box(page, '.titlebar')).height), 'title bar is 45px').toBe(TITLEBAR)
      const strip = round((await box(page, '.navstrip')).height)
      expect(strip, 'section strip is ' + c.strip + 'px').toBe(c.strip)
      expect(strip, 'the strip is never below its 34px minimum').toBeGreaterThanOrEqual(STRIP_MIN)

      /* ---- the columns ---- */
      expect(round((await box(page, '.fcol-left')).width), 'left rail is 280px').toBe(LEFT_RAIL)
      expect(round((await box(page, '.fcol-centre')).width), 'centre is ' + c.centre + 'px').toBe(c.centre)

      /* Two-column fallback: this page has no right rail, which is sanctioned. */
      await expect(page.locator('.frame.frame--noright'), 'right rail suppressed -> two-column frame').toHaveCount(1)
      await expect(page.locator('.fcol-right'), 'no right rail is rendered on this page').toHaveCount(0)
      const tracks = await page.locator('.frame').first().evaluate(el => getComputedStyle(el).gridTemplateColumns)
      const parts = tracks.split(/\s+/)
      expect(parts.length, 'exactly two grid tracks').toBe(2)
      expect(parts.map(t => round(parseFloat(t))).join(' '), 'grid is "' + LEFT_RAIL + 'px ' + c.centre + 'px"').toBe(LEFT_RAIL + ' ' + c.centre)

      /* ---- tab widths line up with the columns beneath ---- */
      const tabW = await page.locator('.navstrip .navtab').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)))
      expect(tabW[0], 'first tab sits exactly over the 280px left rail').toBe(LEFT_RAIL)
      expect(tabW.slice(1), 'the remaining five tabs share the rest at ' + c.restTab + 'px each').toEqual(Array(5).fill(c.restTab))

      /* ---- THE ONE THAT MATTERS: the frame ends exactly at the viewport ----
         A grown strip must take its height FROM the panes, never push the
         frame off screen. */
      const frame = await box(page, '.frame')
      expect(round(frame.y + frame.height), 'frame bottom is exactly ' + c.h).toBe(c.h)
      expect(round(c.h - (frame.y + frame.height)), 'no gap below the frame').toBe(0)

      /* ---- nothing scrolls that should not ----
         NO RAIL MAY SCROLL. A long list owns its own scroll box INSIDE the
         rail; the column itself never scrolls (standard 1b, 2026-09-16).
         The CENTRE is deliberately excluded - it is the one pane the standard
         allows to scroll, so asserting it here would forbid correct behaviour.
         This check is NOT in the Mothership reference and cannot be: its rail
         content never gets long enough to overflow. Ours did - the site menu
         measured 1206px in a 721px rail at 1280x800 and scrolled the whole
         column, on a faithful copy of the frame, because .fcol is still
         overflow-y:auto here. HP fixed it at the page; if the fix later moves
         into .fcol house-wide, this assertion still holds. */
      const scrollState = await page.evaluate(() => {
        const d = document.scrollingElement as HTMLElement
        const rails = Array.from(document.querySelectorAll('.fcol'))
          .filter(el => !el.classList.contains('fcol-centre'))
          .map(el => ({
            name: el.className.split(/\s+/).find(c => c.startsWith('fcol-')) ?? 'fcol',
            over: (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight,
          }))
        return { pageY: d.scrollHeight - d.clientHeight, pageX: d.scrollWidth - d.clientWidth, rails }
      })
      expect(scrollState.pageY, 'the document never scrolls vertically').toBeLessThanOrEqual(0)
      expect(scrollState.pageX, 'the document never scrolls horizontally').toBeLessThanOrEqual(0)
      expect(scrollState.rails.length, 'at least one rail was found to measure').toBeGreaterThan(0)
      const overflowing = scrollState.rails.filter(r => r.over > 0)
      expect(
        overflowing.map(r => r.name + ' overflows its own height by ' + r.over + 'px').join('; ') || 'none',
        'NO rail may scroll - a long list must scroll in its OWN box inside the rail (standard 1b)',
      ).toBe('none')
    })
  }

  /* Rail tab strips are 28px by explicit height + line-height, so Tapestry's
     13px type floor (vs the reference's 11/10px) must NOT have moved them.
     Asserted rather than assumed, per the hub. */
  test('rail tab strips are 28px despite the 13px type floor', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.frame')).toBeVisible({ timeout: 20_000 })
    const n = await page.locator('.railtab').count()
    test.skip(n === 0, 'no rail tabs on /v2/dashboard yet - re-assert when a rail gains a strip')
    const heights = await page.locator('.railtab').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)))
    expect(heights.every(h => h === 28), 'every rail tab is 28px (got ' + heights.join(', ') + ')').toBe(true)
  })
})
