import { test, expect, type Page } from '@playwright/test'

/**
 * The house VTT frame, MEASURED, across the /v2 section pages.
 *
 * Ported from the Mothership reference scripts/test-frame.ts. DELIBERATE
 * DIFFERENCE: the reference is a STATIC test - it reads app/globals.css as text
 * and regex-asserts declarations, never opening a browser - so it cannot
 * produce the numbers this phase is about (used track widths, the frame's
 * bottom edge, the strip growing on a wrapped tab). This port asserts the same
 * standard by MEASURING the rendered page, which catches drift the CSS text
 * would still look correct for: a cascade override, a parent that stops
 * filling, a wrap that pushes the frame off screen. PORT THE STANDARD, NOT THE
 * TECHNIQUE.
 *
 * LOCALHOST ONLY. Under local-first (Xero 2026-09-16) nothing is live, so /v2
 * exists on the dev server and nowhere else.
 *
 * AN HTTP 200 PROVES NOTHING HERE. LayoutShell returns a blank div server-side
 * until its auth check resolves, so a Tapestry page's server HTML is the
 * pre-auth shell. Every check waits for a real element and measures it.
 *
 * PHASE-AGNOSTIC BY DESIGN. The right rail (PINS) lands in 1.2b. Until then
 * every /v2 page is two-column (frame--noright); after, all six are
 * three-column. Rather than pinning today's shape and going red the day the
 * lift lands, the geometry is DERIVED from the standard's rail widths and the
 * shape actually rendered, and the end state has its own test that SKIPS until
 * the rail exists - so it cannot quietly pass before then either.
 *
 * The standard: TheTable/tasks/vtt-frame-standard.md. If a number here changes,
 * the SPEC changes first and this file follows.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/** Xero's set, in his order. Pinned as a LITERAL on purpose: route discovery
 *  drives coverage, but this pins INTENT, so a silent reorder fails. */
const EXPECTED_TABS = ['DASHBOARD', 'MY SURVIVORS', 'MY STORIES', 'MY COMMUNITIES', 'THE CAMPFIRE', 'THE RULES']

/** One route per section tab, in strip order (HP, 2026-09-16). The chrome comes
 *  from ONE shared client shell, so chrome assertions are parameterised over
 *  these rather than hand-written per page; only the centre differs. Routes not
 *  yet built SKIP with an explicit message and go green when HP lands them. */
const ROUTES = [
  '/v2/dashboard',
  '/v2/characters',
  '/v2/stories',
  '/v2/communities',
  '/v2/campfire',
  '/v2/rules',
]

const LEFT_RAIL = 280
const RIGHT_RAIL = 260
const GAP = 1 // the 1px gap IS the divider
const TITLEBAR = 45
const STRIP_MIN = 34
const RAIL_TAB = 28
const STACK_BREAKPOINT = 820

/** Deep geometry runs on the one route that exists throughout. */
const PRIMARY = '/v2/dashboard'

/* `stripGrows` rather than an exact grown height, deliberately. The standard
   says the strip is "34px and GROWS when a name wraps" - it does not fix the
   grown value, which depends on font metrics and the label text. It was quoted
   to me as 48px and measures 40px today (13px type, 14px line-height, two
   wrapped lines plus padding); pinning either would make the test go red when
   someone rewords a tab, which trains people to edit the test instead of
   trusting it. The INVARIANT is that it grows above its minimum and the frame
   still ends exactly at the viewport - that is what the standard promises. */
interface Case { w: number; h: number; stripGrows: boolean; note: string }
const CASES: Case[] = [
  { w: 1920, h: 1080, stripGrows: false, note: 'desktop' },
  { w: 1280, h: 800, stripGrows: false, note: 'laptop' },
  { w: 1280, h: 700, stripGrows: false, note: 'SHORT - the height the Table hub found a clip at' },
  { w: 1024, h: 640, stripGrows: false, note: 'SHORT and narrow' },
  { w: 900, h: 800, stripGrows: true, note: 'a tab label wraps - the strip GROWS and the frame still ends exactly at the viewport' },
]

const round = (n: number) => Math.round(n)

async function serves(page: Page, route: string) {
  const res = await page.request.get(BASE + route).catch(() => null)
  return !!res && res.ok()
}

async function open(page: Page, route: string) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  // Proof of RENDER, not of 200.
  await expect(page.locator('.frame'), 'the frame rendered (200 alone proves nothing here)').toBeVisible({ timeout: 20_000 })
}

/** Some /v2 routes may sit behind the auth gate, which renders INSTEAD of the
 *  frame. Distinguish that from a broken page so the skip names a cause rather
 *  than hiding one. NOTE: the suite's storageStates were captured against the
 *  PROD domain, so they do not apply on localhost - a local run is effectively
 *  a guest, and a gated route cannot be measured here at all. */
async function openOrAuthGate(page: Page, route: string): Promise<'frame' | 'authgate'> {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  try {
    await page.locator('.frame').waitFor({ state: 'visible', timeout: 15_000 })
    return 'frame'
  } catch {
    if (await page.getByText('Sign in to continue', { exact: false }).count() > 0) return 'authgate'
    throw new Error(route + ' rendered NEITHER the frame nor the auth gate - the page is broken, not gated')
  }
}

/** Everything the standard cares about, read from the live DOM. */
async function readFrame(page: Page) {
  return page.evaluate(() => {
    const scrolls = (el: Element) => {
      const o = getComputedStyle(el).overflowY
      return o === 'auto' || o === 'scroll'
    }
    const panes = Array.from(document.querySelectorAll('.fcol')).map(el => {
      const e = el as HTMLElement
      const rect = e.getBoundingClientRect()
      /* Lowest edge of anything the COLUMN itself owns. Walk ALL descendants so
         a deep element escaping the column is caught, but skip any whose chain
         to the column passes through a scroll container - a part-scrolled list
         item is healthy, and counting it reads a working rail as a clip. The
         scroll box is still measured on its own pass. */
      let lowest = -Infinity
      let offender = ''
      for (const node of Array.from(e.querySelectorAll('*'))) {
        let owned = false
        for (let p = node.parentElement; p && p !== e; p = p.parentElement) {
          if (scrolls(p)) { owned = true; break }
        }
        if (owned) continue
        const b = node.getBoundingClientRect().bottom
        if (b > lowest) { lowest = b; offender = (node.getAttribute('class') || node.tagName).split(/\s+/)[0] }
      }
      return {
        name: e.className.split(/\s+/).find(c => c.startsWith('fcol-')) ?? 'fcol',
        isCentre: e.classList.contains('fcol-centre'),
        overflowY: getComputedStyle(e).overflowY,
        width: rect.width,
        selfScroll: e.scrollHeight - e.clientHeight,
        overhang: lowest === -Infinity ? 0 : Math.round(lowest - rect.bottom),
        offender,
      }
    })

    const frameEl = document.querySelector('.frame') as HTMLElement
    const frameRect = frameEl.getBoundingClientRect()

    /* The real scroller is NOT documentElement: on full-width routes
       LayoutShell wraps the route in an UNCLASSED div with overflow:auto, and
       documentElement reports 0 no matter what the page does (verified: 350px
       scrollable there while documentElement said 0). It has no class, so walk
       up from .frameroot rather than selecting it - LayoutShell is being
       rewritten and nothing should depend on its markup. */
    let s: HTMLElement | null = document.querySelector('.frameroot') as HTMLElement
    while (s) {
      if (scrolls(s)) break
      s = s.parentElement
    }
    const scrollerEl = s ?? (document.scrollingElement as HTMLElement)

    return {
      tabs: Array.from(document.querySelectorAll('.navstrip .navtab')).map(t => ({
        label: (t.textContent || '').trim().toUpperCase(),
        width: t.getBoundingClientRect().width,
      })),
      titlebar: (document.querySelector('.titlebar') as HTMLElement)?.getBoundingClientRect().height ?? -1,
      strip: (document.querySelector('.navstrip') as HTMLElement)?.getBoundingClientRect().height ?? -1,
      stripNoRight: !!document.querySelector('.navstrip--noright'),
      frameNoRight: !!document.querySelector('.frame.frame--noright'),
      hasRightRail: !!document.querySelector('.fcol-right'),
      tracks: getComputedStyle(frameEl).gridTemplateColumns.split(/\s+/).map(t => Math.round(parseFloat(t))),
      frameBottom: Math.round(frameRect.y + frameRect.height),
      panes,
      railTabs: Array.from(document.querySelectorAll('.railtab')).map(t => Math.round(t.getBoundingClientRect().height)),
      scroller: {
        tag: scrollerEl.tagName.toLowerCase() + (scrollerEl.getAttribute('class') ? '.' + scrollerEl.getAttribute('class') : '(unclassed)'),
        y: scrollerEl.scrollHeight - scrollerEl.clientHeight,
        x: scrollerEl.scrollWidth - scrollerEl.clientWidth,
      },
    }
  })
}

test.describe('VTT house frame standard - /v2 measured', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get(BASE + PRIMARY).catch(() => null)
    test.skip(!res || !res.ok(), 'dev server not serving ' + BASE + PRIMARY + ' - start it in the primary checkout (this spec is localhost-only by design)')
  })

  test('/v2 redirects to the dashboard', async ({ page }) => {
    await page.goto(BASE + '/v2', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp('/v2/dashboard$'), { timeout: 20_000 })
  })

  /* ---- deep geometry, five viewports, on the route that always exists ---- */
  for (const c of CASES) {
    test(`geometry ${c.w}x${c.h} - ${c.note}`, async ({ page }) => {
      await page.setViewportSize({ width: c.w, height: c.h })
      await open(page, PRIMARY)
      const f = await readFrame(page)

      expect(f.tabs.map(t => t.label), 'the six section tabs, in order').toEqual(EXPECTED_TABS)
      expect(round(f.titlebar), 'title bar is 45px').toBe(TITLEBAR)
      expect(round(f.strip), 'the strip is never below its 34px minimum').toBeGreaterThanOrEqual(STRIP_MIN)
      if (c.stripGrows) {
        expect(round(f.strip), 'a wrapped tab label GROWS the strip above its 34px minimum').toBeGreaterThan(STRIP_MIN)
      } else {
        expect(round(f.strip), 'no label wraps at this width, so the strip sits at its 34px minimum').toBe(STRIP_MIN)
      }

      /* Geometry DERIVED from the standard, not hard-coded per phase, so the
         same assertions hold before and after the 1.2b right rail lands. */
      const expectedCentre = c.w - LEFT_RAIL - GAP - (f.hasRightRail ? RIGHT_RAIL + GAP : 0)
      const expectedTracks = f.hasRightRail
        ? [LEFT_RAIL, expectedCentre, RIGHT_RAIL]
        : [LEFT_RAIL, expectedCentre]

      const left = f.panes.find(p => p.name === 'fcol-left')
      const centre = f.panes.find(p => p.isCentre)
      expect(round(left!.width), 'left rail is 280px').toBe(LEFT_RAIL)
      expect(round(centre!.width), 'centre is the viewport minus the rails and gaps (' + expectedCentre + 'px)').toBe(expectedCentre)
      expect(f.tracks, 'grid tracks match the rendered shape').toEqual(expectedTracks)

      /* The interim shape must be INTERNALLY consistent: no right rail means
         both the frame and the strip carry --noright, never one without the
         other. */
      expect(f.frameNoRight, 'frame--noright matches whether a right rail exists').toBe(!f.hasRightRail)
      expect(f.stripNoRight, 'navstrip--noright matches whether a right rail exists').toBe(!f.hasRightRail)

      /* First tab over the left rail always; last tab over the right rail ONLY
         when there is one, otherwise it is an ordinary flexing tab. */
      expect(round(f.tabs[0].width), 'first tab sits exactly over the 280px left rail').toBe(LEFT_RAIL)
      if (f.hasRightRail) {
        expect(round(f.tabs[f.tabs.length - 1].width), 'last tab sits exactly over the 260px right rail').toBe(RIGHT_RAIL)
      }
      expect(round(f.tabs.reduce((a, t) => a + t.width, 0)), 'the tabs together span the full width').toBe(c.w)

      /* THE ONE THAT MATTERS: a grown strip takes height FROM the panes and
         never pushes the frame off screen. */
      expect(f.frameBottom, 'frame bottom is exactly ' + c.h).toBe(c.h)

      /* The rail rule, structurally - proves the frame CANNOT let a rail scroll
         tomorrow, not merely that none does today. */
      const rails = f.panes.filter(p => !p.isCentre)
      expect(rails.filter(r => r.overflowY !== 'hidden').map(r => r.name + ' has overflow-y:' + r.overflowY).join('; ') || 'none',
        'every RAIL is overflow:hidden - a long list scrolls in its OWN box').toBe('none')
      expect(centre!.overflowY, 'the CENTRE is the one pane allowed to scroll').toBe('auto')

      expect(rails.filter(r => r.selfScroll > 0).map(r => r.name + ' scrolls by ' + r.selfScroll + 'px').join('; ') || 'none',
        'NO rail may scroll').toBe('none')

      /* overflow:hidden CLIPS where auto scrolled, so content past the bottom is
         silent damage - and out-of-flow children never show up in scrollHeight
         at all, which is the real reason this check exists. */
      expect(rails.filter(r => r.overhang > 0).map(r => r.name + ' content runs ' + r.overhang + 'px past the column bottom (CLIPPED) - lowest offender: ' + r.offender).join('; ') || 'none',
        'no rail CLIPS its content').toBe('none')

      expect(f.scroller.y, 'the page never scrolls vertically while pinned (measured on ' + f.scroller.tag + ', the REAL scroller)').toBeLessThanOrEqual(0)
      expect(f.scroller.x, 'the page never scrolls horizontally').toBeLessThanOrEqual(0)
    })
  }

  /* ---- chrome parity across all six section pages ----
     The chrome comes from ONE shared client shell, so this is parameterised
     rather than hand-written six times; only the centre differs. Routes HP has
     not built yet SKIP explicitly and go green when they land. */
  for (const route of ROUTES) {
    test(`chrome parity ${route}`, async ({ page }) => {
      test.skip(!(await serves(page, route)), route + ' is not built yet (HP, 1.3) - this goes green when it lands')
      await page.setViewportSize({ width: 1280, height: 800 })
      const state = await openOrAuthGate(page, route)
      test.skip(state === 'authgate', route + ' renders the AUTH GATE, not the frame - the other five /v2 sections are guest-reachable, so this one is gated differently (reported to HP). Local auth is impossible here: the storageStates were captured against prod.')
      const f = await readFrame(page)

      expect(f.tabs.map(t => t.label), 'same six tabs, same order, on every section page').toEqual(EXPECTED_TABS)
      expect(round(f.titlebar), 'title bar is 45px').toBe(TITLEBAR)
      expect(round(f.strip), 'section strip is at its 34px minimum here').toBe(STRIP_MIN)
      expect(round(f.panes.find(p => p.name === 'fcol-left')!.width), 'left rail is 280px').toBe(LEFT_RAIL)
      expect(round(f.tabs[0].width), 'first tab sits over the left rail').toBe(LEFT_RAIL)
      expect(f.frameBottom, 'frame bottom is exactly 800').toBe(800)

      const rails = f.panes.filter(p => !p.isCentre)
      expect(rails.filter(r => r.overflowY !== 'hidden').map(r => r.name).join('; ') || 'none', 'every rail is overflow:hidden').toBe('none')
      expect(f.panes.find(p => p.isCentre)!.overflowY, 'the centre scrolls').toBe('auto')
      expect(rails.filter(r => r.selfScroll > 0).map(r => r.name + ' scrolls by ' + r.selfScroll + 'px').join('; ') || 'none', 'no rail scrolls').toBe('none')
      expect(rails.filter(r => r.overhang > 0).map(r => r.name + ' clipped by ' + r.overhang + 'px (' + r.offender + ')').join('; ') || 'none', 'no rail clips').toBe('none')
    })
  }

  /* ---- 1.2b END STATE: the PINS right rail ----
     HP confirmed from the approved mockup that ALL SIX pages are three-column -
     its rightRail() branches on S.view === 'world', which covers every world
     tab, so there is no "THE RULES stays two-column" exception. Skips until the
     rail exists so it cannot quietly pass beforehand. */
  for (const route of ROUTES) {
    test(`1.2b right rail is 260px ${route}`, async ({ page }) => {
      test.skip(!(await serves(page, route)), route + ' is not built yet (HP, 1.3)')
      await page.setViewportSize({ width: 1280, height: 800 })
      const state = await openOrAuthGate(page, route)
      test.skip(state === 'authgate', route + ' renders the AUTH GATE, not the frame (reported to HP)')
      const f = await readFrame(page)
      test.skip(!f.hasRightRail, 'right rail (PINS) lands in 1.2b - needs MapView panel state lifted out first')

      expect(round(f.panes.find(p => p.name === 'fcol-right')!.width), 'right rail is 260px').toBe(RIGHT_RAIL)
      expect(f.tracks, 'three tracks once the rail exists').toEqual([LEFT_RAIL, 1280 - LEFT_RAIL - RIGHT_RAIL - GAP * 2, RIGHT_RAIL])
      expect(round(f.tabs[f.tabs.length - 1].width), 'last tab sits exactly over the 260px right rail').toBe(RIGHT_RAIL)
      expect(f.frameNoRight, 'frame--noright is gone once the rail exists').toBe(false)
      expect(f.stripNoRight, 'navstrip--noright is gone once the rail exists').toBe(false)
    })
  }

  /* Stacked, below 820px, the panes must let GO of the viewport height so the
     page grows and scrolls instead of clipping the columns below the first. The
     overflow rule INVERTS here - hidden would hide real content. */
  test('stacked below ' + STACK_BREAKPOINT + 'px - every pane reverts to overflow:visible', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await open(page, PRIMARY)
    const f = await readFrame(page)
    expect(f.panes.length, 'panes were found to measure').toBeGreaterThan(0)
    expect(f.panes.filter(p => p.overflowY !== 'visible').map(p => p.name + ' has overflow-y:' + p.overflowY).join('; ') || 'none',
      'stacked, panes revert to overflow:visible so the page scrolls instead of clipping').toBe('none')
  })

  /* Rail tabs are 28px from explicit height + line-height, so Tapestry's 13px
     type floor (vs the reference's 11/10px) must not have moved them. Asserted
     rather than assumed; skips until a rail carries a strip (1.2b). */
  test('rail tab strips are 28px despite the 13px type floor', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await open(page, PRIMARY)
    const f = await readFrame(page)
    test.skip(f.railTabs.length === 0, 'no rail tabs yet - lands with the 1.2b rails')
    expect(f.railTabs.every(h => h === RAIL_TAB), 'every rail tab is 28px (got ' + f.railTabs.join(', ') + ')').toBe(true)
  })
})
