import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch7 [Sys D] - Session lifecycle: Start Session -> session-active state (counter
// + End Session control + a persisted `sessions` row) -> End Session via the
// summary modal -> back to idle + the row stamped ended_at/gm_summary -> the
// session shows in /stories/<id>/sessions.
//
// RUNS IN ITS OWN THROWAWAY CAMPAIGN, never The Arena: startSession()
// (page.tsx:3335) WIPES roll_log + chat_messages for the campaign, increments
// campaigns.session_count permanently, and broadcasts `logs_cleared` to every
// connected client. Against the shared Arena that would clobber the fixture and
// any concurrent spec's feed. A fresh throwaway campaign isolates the wipe + the
// broadcast (no other client is in it) and the session_count bump dies with it.
// Teardown deletes the campaign; sessions FK is ON DELETE CASCADE
// (schema.sql:1459), so the session row + attachments go with it.
//
// "Dice enabled" is asserted via its PROXY: the "Session N" counter renders under
// the exact same `sessionStatus === 'active'` gate that enables every roll
// handler (page.tsx:5343 vs the onRoll guards at :6508 etc.) - so the counter
// being visible IS that gate being satisfied. Asserting a live roll button would
// need a seeded player character in the throwaway campaign (out of scope here;
// covered by combat-flow). "Players notified" is the same `logs_cleared`
// broadcast - not asserted in a player-less throwaway campaign.

const RUN = `[E2E ${Date.now().toString(36)}]`

interface SessionRow { session_number: number; ended_at: string | null; gm_summary: string | null }

async function sessionRows(page: Page, creds: SupaCreds, campaignId: string): Promise<SessionRow[]> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/sessions?campaign_id=eq.${campaignId}&select=session_number,ended_at,gm_summary&order=session_number.asc`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return []
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

test.describe('Ch7 - Session lifecycle (start -> active -> end -> history)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM starts a session (counter + row), then ends it via the summary modal (row stamped + listed)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let campaignId: string | null = null
    let creds: SupaCreds | null = null
    const summary = `${RUN} session summary - automated, safe to remove.`
    try {
      const anonP = captureAnonKey(gm)

      // --- Throwaway campaign via the real form (same path as story-lifecycle) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} Session`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id in landing URL').toBeTruthy()

      // --- Open the table; idle state shows "Start Session" ---
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      const startBtn = gm.getByRole('button', { name: 'Start Session' }).first()
      await expect(startBtn, 'idle table should offer Start Session').toBeVisible({ timeout: 30_000 })
      // No session rows yet.
      expect(await sessionRows(gm, creds!, campaignId!), 'no sessions before start').toHaveLength(0)

      // --- Start Session -> active state ---
      await startBtn.click()
      // The "Session 1" counter appears (same sessionStatus==='active' gate that
      // enables dice) and the End Session control replaces Start. The header
      // renders it as a colored suffix " (Session 1)" (table/page.tsx:5305), so
      // match the count tolerant of the parens/spacing/styling, not exact text.
      await expect(gm.getByText(/\bSession 1\b/).first(), 'session counter should read Session 1').toBeVisible({ timeout: 15_000 })
      const endBtn = gm.getByRole('button', { name: 'End Session' }).first()
      await expect(endBtn, 'active table should offer End Session').toBeVisible()
      // The session row persisted: number 1, not yet ended.
      await expect.poll(
        async () => sessionRows(gm, creds!, campaignId!).then(r => r.length === 1 && r[0].session_number === 1 && r[0].ended_at === null),
        { timeout: 10_000, message: 'a single open session #1 row should exist after start' },
      ).toBe(true)

      // --- End Session via the summary modal ---
      await endBtn.click()
      await expect(gm.getByText('Session 1 Summary'), 'End Session modal should open').toBeVisible({ timeout: 15_000 })
      await gm.getByPlaceholder('Summarise the session - key events, decisions, outcomes.').fill(summary)
      // Two "End Session" buttons now exist (header + modal); the modal's is the
      // one appended last in the DOM (fixed overlay, zIndex 10000).
      await gm.getByRole('button', { name: 'End Session' }).last().click()

      // Back to idle: Start Session returns.
      await expect(gm.getByRole('button', { name: 'Start Session' }).first(), 'should return to idle after ending').toBeVisible({ timeout: 15_000 })
      // The row is stamped: ended_at set + our summary saved.
      await expect.poll(
        async () => {
          const rows = await sessionRows(gm, creds!, campaignId!)
          return rows.length === 1 && rows[0].ended_at !== null && rows[0].gm_summary === summary
        },
        { timeout: 10_000, message: 'session #1 should be stamped ended_at + gm_summary' },
      ).toBe(true)

      // --- Shows in the Session History page ---
      await gm.goto(`/stories/${campaignId}/sessions`, { waitUntil: 'domcontentloaded' })
      await expect(gm.getByText('Session History', { exact: false }).first(), '/sessions should render the history').toBeVisible({ timeout: 15_000 })
      await expect(gm.getByText(/1\s+session\b/i).first(), 'history should count the one ended session').toBeVisible()
    } finally {
      // Delete the throwaway campaign; CASCADE removes the session row + attachments.
      if (campaignId && creds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
