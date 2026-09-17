import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'

/**
 * The /v2 PINS rail, SIGNED IN - the surface a logged-out sweep cannot reach.
 *
 * Routed here by the hub (2026-09-16) because this lane owns the only mechanism
 * that can produce a session: auth.setup.ts logs in through the real /login
 * form at a path RELATIVE to baseURL, so pointing E2E_BASE_URL at localhost
 * mints a localhost session with no hand-capture and no credential handling.
 *
 * WHY THIS FILE EXISTS AT ALL - the DEAD CONTROL class. Every assertion in
 * v2-frame-standard.spec.ts checks that widths and heights are RIGHT. An inert
 * control passes all of them: correct size, correct place, correct hover
 * colour, and it does nothing. That defect has already shipped once here (the
 * inert panel close button), and the frame makes it more likely, because it
 * moves panels between contexts where an interaction that made sense inline is
 * meaningless in a rail. So: click what looks clickable and assert SOMETHING
 * OBSERVABLE CHANGED. That is worth more per line than another width check.
 *
 * Run: E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/v2-pins-rail-signedin.spec.ts
 */

/* RELATIVE, deliberately. An absolute URL with its own default is how this
   file broke a prod run: it defaulted to localhost while e2e/_fixtures.ts keys
   the storageState off the CONFIG's baseURL default (prod), so a plain prod run
   navigated to localhost carrying prod cookies and executed logged out. Going
   through baseURL means the origin the state was minted for and the origin we
   visit are the SAME VALUE by construction, not two defaults that have to be
   kept in step. Point the run with E2E_BASE_URL and both follow it. */
const TARGET = '/v2/dashboard'

/** The rail's own tab strip, in CLICK ORDER. PinsPanel gates these on userId,
 *  so a guest sees the PINS header and rows but none of these - which is why
 *  this file needs a session and the guest-facing spec holds that row.
 *  "World Events" is the default active tab, so it is clicked LAST: every tab
 *  here is therefore entered from a different one, and no step can be a false
 *  red for the legitimate no-op of re-clicking the tab already selected. */
const PINS_TABS = ['My Pins', 'Whispers', 'World Events']

/** House standard: rail tab strips are 28px (vtt-frame-standard.md). */
const RAIL_TAB_H = 28

test.use({ storageState: canAuth('gm') ? AUTH.gm : undefined })

test.describe('/v2 PINS rail - signed in', () => {
  test.skip(!canAuth('gm'), 'needs gm credentials or a session for this environment')

  test.beforeAll(async ({ request }) => {
    const res = await request.get(TARGET).catch(() => null)
    test.skip(!res || !res.ok(), 'dev server not serving ' + TARGET)
  })

  const openRail = async (page: import('@playwright/test').Page) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.frame')).toBeVisible({ timeout: 20_000 })
    const right = page.locator('.fcol-right')
    await expect(right, 'the PINS rail is present').toHaveCount(1)
    return right
  }

  /* CANARY. Session state is keyed by target origin (e2e/_fixtures.ts), because
     auth.setup.ts reuses any state file under 50 minutes old and cookies are
     origin-scoped - so a shared path let a prod session be reused by a
     localhost run, silently executing LOGGED OUT. If that regresses, every
     assertion below would still "pass" by measuring a guest, so this asserts
     the session is real BEFORE anything depends on it.
     Asserted POSITIVELY: a "body does not contain GHOST" check passes trivially
     against the pre-hydration shell, so it would go green on exactly the broken
     run it exists to catch. The tablist renders only when userId is set. */
  test('the signed-in session actually applies to this origin', async ({ page }) => {
    const right = await openRail(page)
    await expect(right.getByRole('tablist'),
      'the rail tab strip is gated on userId, so seeing it PROVES a live session for this origin')
      .toBeVisible({ timeout: 20_000 })
    await expect(page.locator('body')).not.toContainText('YOU ARE A GHOST')
  })

  /* SEMANTICS, not geometry. The original defect here was three bare <button>s
     that measured a plausible 29px: a height assertion would have gone GREEN on
     them the moment someone nudged them to 28, while no screen reader could see
     a tab strip or tell which tab was active. Measuring what a control LOOKS
     like says nothing about whether it IS that control, so this row asserts the
     device and the height row asserts the number.
     A FAILURE HERE HAS TWO DISTINCT CAUSES, so the message must say which path
     was measured: bare buttons in the rail now means `inRail` never arrived
     (PinsPanel renders the house device only on that branch), NOT the old
     hand-rolled strip coming back. Different cause, different fix. The inline
     incarnation on the old /map and /dashboard keeps its bare buttons and its
     data-tour hooks by design, and is not this row's business. */
  test('the rail tab strip is a real tab device, not lookalike buttons', async ({ page }) => {
    const right = await openRail(page)
    await expect(right.getByRole('tablist'),
      'no role="tablist" in the RAIL - if bare buttons are rendering there, `inRail` is not reaching PinsPanel')
      .toBeVisible({ timeout: 20_000 })

    const tabs = right.locator('.railtab')
    await expect(tabs, 'three .railtab elements in the rail (PINS renders three tabs)').toHaveCount(3)

    const roles = await tabs.evaluateAll(els => els.map(e => e.getAttribute('role')))
    expect(roles, 'every rail tab carries role="tab"').toEqual(['tab', 'tab', 'tab'])

    const selected = await tabs.evaluateAll(els => els.map(e => e.getAttribute('aria-selected')))
    expect(selected.filter(v => v === 'true').length,
      `exactly one tab is aria-selected (got ${JSON.stringify(selected)}) - none means assistive tech cannot report the active tab, more than one is incoherent`).toBe(1)
  })

  test('the rail tab strip renders, and is the house 28px', async ({ page }) => {
    const right = await openRail(page)
    for (const label of PINS_TABS) {
      await expect(right.getByRole('tab', { name: label }).first(),
        `the "${label}" tab renders for a signed-in user`).toBeVisible({ timeout: 20_000 })
    }
    const strip = right.getByRole('tablist').first()
    const box = await strip.boundingBox()
    expect(box, 'the tab strip has a box').not.toBeNull()
    expect(Math.round(box!.height),
      `rail tab strips are ${RAIL_TAB_H}px in the house frame standard`).toBe(RAIL_TAB_H)
  })

  /* THE DEAD-CONTROL ROW. Not a width check: click each tab and require BOTH
     the selected state to move AND the rail's rendered content to change. A
     control that is perfectly sized and does nothing fails here and nowhere
     else. Checking aria-selected alone is not enough - a tab can light up and
     still render the same list, which is the same defect one layer down. */
  test('every PINS rail tab DOES something (dead-control guard)', async ({ page }) => {
    const right = await openRail(page)
    await expect(right.getByRole('tablist')).toBeVisible({ timeout: 20_000 })

    const snapshot = async () => (await right.innerText()).replace(/\s+/g, ' ').trim()
    const inert: string[] = []

    for (const label of PINS_TABS) {
      const tab = right.getByRole('tab', { name: label }).first()
      const before = await snapshot()
      await tab.click()
      await expect(tab, `clicking "${label}" should select it`)
        .toHaveAttribute('aria-selected', 'true', { timeout: 8_000 })
      // The panel swaps its list client-side; poll rather than fix a delay.
      const changed = await expect
        .poll(async () => (await snapshot()) !== before, { timeout: 8_000 })
        .toBe(true)
        .then(() => true, () => false)
      if (!changed) inert.push(label)
    }

    expect(inert.join(', ') || 'none',
      'a tab that changes NOTHING when clicked is a dead control - correct geometry, no behaviour').toBe('none')
  })
})
