import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch13.2 + 13.4 - Campfire forums: thread create + reply through the real
// composer (Thriver), and the moderation role-gate.
//
// How moderation actually works (verified against source, not assumed):
//   - Client (forums page.tsx:270) auto-approves when campaign-scoped OR isThriver.
//   - The DB trigger enforce_moderation_on_insert (sql/moderation-enforce-trigger-
//     2026-05-17.sql) is the SECURITY backstop: for a NON-Thriver it FORCES
//     global/setting-scoped (campaign_id NULL) posts to 'pending' regardless of
//     what the client sent; for a Thriver it RESPECTS the client's value.
// So the Thriver auto-approve is a client-side UX decision (needs isThriver
// loaded - an async profiles fetch, page.tsx:118), while the Survivor->pending
// gate is DB-enforced and unbypassable. We test each at its real layer.
//
// Throwaway [E2E]-tagged threads; teardown deletes the thread (FK CASCADE clears
// replies + reactions). GLOBAL scope so campaign_id is NULL.

const RUN = `[E2E ${Date.now().toString(36)}]`

async function restHeaders(creds: SupaCreds, extra: Record<string, string> = {}) {
  return { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, ...extra }
}

async function moderationStatus(page: Page, creds: SupaCreds, threadId: string): Promise<string | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/forum_threads?id=eq.${threadId}&select=moderation_status`,
    { headers: await restHeaders(creds) },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? (rows[0].moderation_status as string) : null
}

async function deleteThread(page: Page, creds: SupaCreds, threadId: string) {
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/forum_threads?id=eq.${threadId}`,
    { headers: await restHeaders(creds) },
  ).catch(() => {})
}

test.describe('Ch13 - Campfire forums: create/reply + moderation role-gate', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  // --- Thriver path (UI): compose a thread, it auto-approves, a reply persists. ---
  test('Thriver creates a thread via the composer, it auto-approves, and a reply persists', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const page = await ctx.newPage()
    let threadId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(page)
      await page.goto('/campfire/forums', { waitUntil: 'domcontentloaded' })
      // isThriver is set after an async profiles.select('role') fetch; wait for it
      // so the client computes auto-approve (else the post races to 'pending').
      await page.waitForResponse(
        r => r.url().includes('/rest/v1/profiles') && r.request().method() === 'GET',
        { timeout: 10_000 },
      ).catch(() => {})

      await page.getByRole('button', { name: /new thread/i }).click()
      await page.getByRole('button', { name: '🌐 Global' }).click() // scope pill -> Global (campaign_id NULL)
      await page.getByPlaceholder("What's on your mind?").fill(`${RUN} Thriver`)
      await page.locator('textarea').first().fill(`${RUN} - automated E2E thread, safe to remove.`)
      await page.getByRole('button', { name: /^post thread$/i }).click()
      await page.waitForURL(/\/campfire\/forums\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      threadId = page.url().split('/forums/')[1]

      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve gm creds').toBeTruthy()
      expect(
        await moderationStatus(page, creds!, threadId!),
        'Thriver-authored thread should auto-approve',
      ).toBe('approved')

      // A reply on the detail page persists.
      await page.getByPlaceholder('Write a reply...').fill(`${RUN} reply`)
      await page.getByRole('button', { name: /^post reply$/i }).click()
      await expect.poll(async () => {
        const r = await page.request.get(
          `${SUPABASE_URL}/rest/v1/forum_replies?thread_id=eq.${threadId}&select=id`,
          { headers: await restHeaders(creds!) },
        )
        const rows = await r.json().catch(() => [])
        return Array.isArray(rows) ? rows.length : 0
      }, { timeout: 8_000, message: 'reply did not persist' }).toBeGreaterThan(0)
    } finally {
      if (threadId && creds) await deleteThread(page, creds, threadId)
      await ctx.close()
    }
  })

  // --- Survivor path (DB enforcement): the trigger FORCES pending for a global
  // post even when the client tries to send 'approved'. Unbypassable; no UI
  // timing. This is the security guarantee behind the role-gate. ---
  test('a Survivor global post is forced to pending by the DB trigger (cannot self-approve)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.marv })
    const page = await ctx.newPage()
    let threadId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(page)
      await page.goto('/campfire/forums', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve marv creds').toBeTruthy()

      // Marv (Survivor) inserts a GLOBAL thread, deliberately claiming
      // moderation_status='approved'. The BEFORE INSERT trigger must overwrite it.
      const res = await page.request.post(`${SUPABASE_URL}/rest/v1/forum_threads`, {
        headers: await restHeaders(creds!, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        data: {
          author_user_id: ACCOUNTS.marv.userId,
          category: 'general',
          title: `${RUN} Survivor bypass attempt`,
          body: `${RUN} - automated E2E, safe to remove.`,
          campaign_id: null,
          setting: null,
          moderation_status: 'approved', // the bypass the trigger must neutralise
        },
      })
      expect(res.ok(), `insert failed: ${res.status()} ${await res.text()}`).toBe(true)
      const row = (await res.json())[0] as { id: string; moderation_status: string }
      threadId = row.id
      expect(
        row.moderation_status,
        'Survivor global post must be forced to pending by the trigger, not the claimed approved',
      ).toBe('pending')
    } finally {
      if (threadId && creds) await deleteThread(page, creds, threadId)
      await ctx.close()
    }
  })
})
