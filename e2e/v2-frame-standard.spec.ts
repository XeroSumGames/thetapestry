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
 * pushes the frame off screen. PORT THE STANDARD, NOT THE TECHNIQUE.
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

interface Case {
  w: number
  h: number
  strip: number
  /** Width of each tab after the first. Omitted where (w - 280) / 5 is not a
   *  whole number and the browser distributes sub-pixels - then only the first
   *  tab and the total are asserted. */
  restTab?: number
  centre: number
  note: string
}

/* centre = width - LEFT_RAIL - 1px gap. restTab = (width - 280) / 5.
   The three original widths were measured twice, by HP and the hub, before
   this spec existed. The two SHORT viewports were added after the Table hub's
   sweep found a real clip at 1280x700 (a right rail running 14px past its
   bottom) - the standard now says verify at a short screen, not only a narrow
   one, because `overflow: hidden` CLIPS where `auto` used to scroll. */
const CASES: Case[] = [
  { w: 1920, h: 1080, strip: 34, restTab: 328, centre: 1639, note: 'desktop' },
  { w: 1280, h: 800, strip: 34, restTab: 200, centre: 999, note: 'laptop' },
  { w: 1280, h: 700, strip: 34, restTab: 200, centre: 999, note: 'SHORT - the height the Table hub found a clip at' },
  { w: 1024, h: 640, strip: 34, centre: 743, note: 'SHORT and narrow - (1024-280)/5 is fractional, so tabs are checked by first + total' },
  { w: 900, h: 800, strip: 48, restTab: 124, centre: 619, note: 'a tab label wraps - the strip GROWS and the frame still ends exactly at the viewport' },
]

/** Below this the frame stacks and lets go of the viewport height. */
const STACK_BREAKPOINT = 820

const round = (n: number) => Math.round(n)

async function box(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox()
  if (!b) throw new Error('no bounding box for ' + sel + ' - element missing or not rendered')
  return b
}

/** Every pane, with the numbers the standard cares about. */
async function panes(page: Page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.fcol')).map(el => {
      const e = el as HTMLElement
      const cs = getComputedStyle(e)
      const rect = e.getBoundingClientRect()
      /* The lowest edge of anything the COLUMN itself is responsible for.
         `overflow: hidden` clips silently, so content past the column bottom is
         invisible damage.
         Walk ALL descendants, not just direct children, so a deep element that
         escapes the column is caught. But skip anything whose overflow is owned
         by an inner SCROLL BOX: a partly-scrolled list item is healthy, and
         counting it reads a working rail as a clip - the Table hub hit exactly
         that at 1024x640, flagging an inventory item that was simply scrolled
         inside its own list. The scroll box itself is still measured on its own
         pass, so a mis-sized box is still caught. */
      const scrolls = (el: Element) => {
        const o = getComputedStyle(el).overflowY
        return o === 'auto' || o === 'scroll'
      }
      let lowest = -Infinity
      let offender = ''
      for (const node of Array.from(e.querySelectorAll('*'))) {
        let ownedByInnerScroller = false
        for (let p = node.parentElement; p && p !== e; p = p.parentElement) {
          if (scrolls(p)) { ownedByInnerScroller = true; break }
        }
        if (ownedByInnerScroller) continue
        const b = node.getBoundingClientRect().bottom
        if (b > lowest) {
          lowest = b
          offender = (node.getAttribute('class') || node.tagName).split(/\s+/)[0]
        }
      }
      return {
        name: e.className.split(/\s+/).find(c => c.startsWith('fcol-')) ?? 'fcol',
        isCentre: e.classList.contains('fcol-centre'),
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        selfScroll: e.scrollHeight - e.clientHeight,
        overhang: lowest === -Infinity ? 0 : Math.round(lowest - rect.bottom),
        offender,
      }
    })
  })
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
      const tabW = await page.locator('.navstrip .navtab').evaluateAll(els => els.map(e => e.getBoundingClientRect().width))
      expect(round(tabW[0]), 'first tab sits exactly over the 280px left rail').toBe(LEFT_RAIL)
      if (c.restTab !== undefined) {
        expect(tabW.slice(1).map(round), 'the remaining five tabs share the rest at ' + c.restTab + 'px each').toEqual(Array(5).fill(c.restTab))
      } else {
        // (w - 280) / 5 is fractional here; assert the total instead of each.
        expect(round(tabW.reduce((a, b) => a + b, 0)), 'the tabs together span the full width').toBe(c.w)
      }

      /* ---- THE ONE THAT MATTERS: the frame ends exactly at the viewport ----
         A grown strip must take its height FROM the panes, never push the
         frame off screen. */
      const frame = await box(page, '.frame')
      expect(round(frame.y + frame.height), 'frame bottom is exactly ' + c.h).toBe(c.h)
      expect(round(c.h - (frame.y + frame.height)), 'no gap below the frame').toBe(0)

      /* ---- the rail rule, STRUCTURALLY (Table hub ccb7962, 2026-09-16) ----
         Measuring "nothing scrolls" only proves nothing bad happens TODAY - a
         rail can read clean simply because its content is short, which is how
         Mothership passed for months while the rule was unenforced. These
         assert the frame CANNOT let it happen tomorrow. */
      const cols = await panes(page)
      expect(cols.length, 'panes were found to measure').toBeGreaterThan(0)
      const rails = cols.filter(p => !p.isCentre)
      const centre = cols.find(p => p.isCentre)

      const wrongOverflow = rails.filter(r => r.overflowY !== 'hidden')
        .map(r => r.name + ' has overflow-y:' + r.overflowY)
      expect(wrongOverflow.join('; ') || 'none', 'every RAIL is overflow:hidden - a long list scrolls in its OWN box, never the column').toBe('none')
      expect(centre?.overflowY, 'the CENTRE is the one pane allowed to scroll').toBe('auto')

      /* ---- no rail scrolls (the symptom) ---- */
      const scrolling = rails.filter(r => r.selfScroll > 0)
        .map(r => r.name + ' scrolls by ' + r.selfScroll + 'px')
      expect(scrolling.join('; ') || 'none', 'NO rail may scroll - a long list must scroll in its OWN box inside the rail').toBe('none')

      /* ---- no rail CLIPS (the new failure mode) ----
         `overflow: hidden` clips where `auto` used to scroll, so content
         running past the column bottom is now silent damage. This is the
         assertion "nothing scrolls" would pass happily - and the one the Table
         hub's sweep actually caught, a right rail 14px past its bottom.
         Asserted as an INVARIANT (nothing below the bottom edge), not against
         today's incidental clearance, which changes whenever the page gains a
         row. */
      const clipped = rails.filter(r => r.overhang > 0)
        .map(r => r.name + ' content runs ' + r.overhang + 'px past the column bottom (CLIPPED, invisible) - lowest offender: ' + r.offender)
      expect(clipped.join('; ') || 'none', 'no rail CLIPS its content - the lowest child must sit inside the column').toBe('none')

      /* ---- the PAGE never scrolls while the frame is pinned ----
         NOT measured against documentElement. On full-width routes (every /v2
         page and the story table) LayoutShell wraps the route in an unclassed
         div with `overflow: auto`, and THAT is the scroller - documentElement
         reports 0 no matter what. Verified here: at 800x700 stacked the wrapper
         reports 350px scrollable while documentElement reports 0, so a
         documentElement check is wrong in BOTH directions - blind to real
         overflow, and unable to see correct scrolling either.
         The wrapper has no class, so it is found by walking up from .frameroot
         to the nearest scrolling ancestor rather than by selector. */
      const scroller = await page.evaluate(() => {
        let n: HTMLElement | null = document.querySelector('.frameroot') as HTMLElement
        while (n) {
          const o = getComputedStyle(n).overflowY
          if (o === 'auto' || o === 'scroll') break
          n = n.parentElement
        }
        const el = n ?? (document.scrollingElement as HTMLElement)
        return {
          found: !!n,
          tag: el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + el.getAttribute('class') : ''),
          y: el.scrollHeight - el.clientHeight,
          x: el.scrollWidth - el.clientWidth,
        }
      })
      expect(scroller.found, 'found the real scroll container by walking up from .frameroot').toBe(true)
      expect(scroller.y, 'the page never scrolls vertically while the frame is pinned (measured on ' + scroller.tag + ', the REAL scroller, not documentElement)').toBeLessThanOrEqual(0)
      expect(scroller.x, 'the page never scrolls horizontally').toBeLessThanOrEqual(0)
    })
  }

  /* Stacked, below 820px, the panes must let GO of the viewport height: the
     page grows and scrolls instead of clipping the columns below the first.
     So the overflow rule inverts here - hidden would hide real content. */
  test('stacked below ' + STACK_BREAKPOINT + 'px - every pane reverts to overflow:visible', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.frame')).toBeVisible({ timeout: 20_000 })
    const cols = await panes(page)
    expect(cols.length, 'panes were found to measure').toBeGreaterThan(0)
    const notVisible = cols.filter(p => p.overflowY !== 'visible')
      .map(p => p.name + ' has overflow-y:' + p.overflowY)
    expect(notVisible.join('; ') || 'none', 'stacked, panes revert to overflow:visible so the page scrolls instead of clipping').toBe('none')
  })

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
