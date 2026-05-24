import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import {
  SUPABASE_URL, captureAnonKey, resolveCreds, accessTokenFromContext,
  userIdFromToken, restCount, restDelete, type SupaCreds,
} from './_teardown'

// Ch4 [Sys B] - the three character-creation funnels. All three end in a direct
// `supabase.from('characters').insert({ user_id, name, data })` (no RPC):
//   - Quick build    (/characters/quick,  6 steps 0-5)  app/characters/quick/page.tsx:145
//   - Backstory      (/characters/new,    10 steps 0-9) app/characters/new/page.tsx:88
//   - Paradigm pick  (/characters/paradigms -> /characters/random?paradigm=<n>)
//     auto-generates + inserts (.select().single()) then redirects to
//     /characters/<id>/edit?step=4 (Final Review)        app/characters/random/page.tsx
//
// Both wizard "Advance" buttons just increment the step (no field gate), and the
// progress dots jump to ANY step directly (quick/page.tsx:188, new/page.tsx:133)
// with no guard - so we fill the name on step 0, JUMP to the final step via the
// numbered dot (avoids the backstory per-step unspent-CDP window.confirm), then
// Save. handleSave router.push('/characters') immediately, so we assert the
// REDIRECT + the unique name in the list (not the flashing "Character saved!"
// toast, which the navigation races away).
//
// Created characters are STANDALONE (no campaign_members row), so they only ever
// appear in the acting account's own /characters list - no campaign roster, no
// other spec reads them. Acts as `percy`: presence reads percy's online ring and
// account-settings writes pesky, but NOTHING reads percy's character list, so
// these inserts can't race a sibling reader (the fullyParallel:false-still-runs-
// files-concurrently trap). Teardown deletes by the created id via percy's own
// session (the "delete own characters" RLS policy, schema.sql:2183) in `finally`.

const RUN = Date.now().toString(36)

// The created char's id, found by the unique name we saved it under (the two
// wizard inserts don't return it to the page; we read it back to both PROVE the
// row persisted and capture the id for teardown). Newest-first + limit 1 so a
// stray same-named row never makes this ambiguous.
async function charIdByName(page: Page, creds: SupaCreds, userId: string, name: string): Promise<string | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/characters?user_id=eq.${userId}&name=eq.${encodeURIComponent(name)}&select=id&order=created_at.desc&limit=1`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0]?.id ? (rows[0].id as string) : null
}

// Fill the concept-step name, jump to the final step via its numbered dot, Save,
// and wait for the post-save redirect to /characters.
async function runWizard(page: Page, route: string, finalDot: string, name: string): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const nameInput = page.getByPlaceholder('Full name')
  await nameInput.fill(name)
  await expect(nameInput, 'name input should hold the value we typed').toHaveValue(name)
  // Numbered progress dot for the final step (quick:"5", backstory:"9"); the
  // dots are the only purely-numeric buttons on the concept step, so exact match
  // is unambiguous. Jumping skips the per-step Advance confirm entirely.
  await page.getByRole('button', { name: finalDot, exact: true }).click()
  await page.getByRole('button', { name: 'Save Character' }).click()
  await page.waitForURL('**/characters', { timeout: 20_000 })
}

test.describe('Ch4 - Character creation methods (Quick / Backstory / Paradigm) save + list', () => {
  test.skip(!canAuth('percy'), 'needs percy session/creds')

  test('Quick build saves a character that lists under the account', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.percy })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let userId: string | null = null
    let createdId: string | null = null
    const name = `[E2E ${RUN}] Quick`
    try {
      const anonP = captureAnonKey(page)
      await runWizard(page, '/characters/quick', '5', name)
      // The new character appears in the account's own list (the real
      // persistence proof - it survived the insert + the list refetch).
      await expect(page.getByText(name).first(), 'Quick-built char should appear in /characters').toBeVisible({ timeout: 15_000 })

      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve percy creds').toBeTruthy()
      const token = await accessTokenFromContext(ctx)
      userId = token ? userIdFromToken(token) : null
      expect(userId, 'could not derive percy user id').toBeTruthy()
      createdId = await charIdByName(page, creds!, userId!, name)
      expect(createdId, 'created Quick char row not found via REST').toBeTruthy()
    } finally {
      if (creds && createdId) await restDelete(page, 'characters', createdId, creds)
      await ctx.close()
    }
  })

  test('Backstory wizard saves a character that lists under the account', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.percy })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let userId: string | null = null
    let createdId: string | null = null
    const name = `[E2E ${RUN}] Backstory`
    try {
      const anonP = captureAnonKey(page)
      await runWizard(page, '/characters/new', '9', name)
      await expect(page.getByText(name).first(), 'Backstory char should appear in /characters').toBeVisible({ timeout: 15_000 })

      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve percy creds').toBeTruthy()
      const token = await accessTokenFromContext(ctx)
      userId = token ? userIdFromToken(token) : null
      expect(userId, 'could not derive percy user id').toBeTruthy()
      createdId = await charIdByName(page, creds!, userId!, name)
      expect(createdId, 'created Backstory char row not found via REST').toBeTruthy()
    } finally {
      if (creds && createdId) await restDelete(page, 'characters', createdId, creds)
      await ctx.close()
    }
  })

  test('Paradigm pick generates, saves, and lands on the Final Review edit page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.percy })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let createdId: string | null = null
    try {
      const anonP = captureAnonKey(page)
      await page.goto('/characters/paradigms', { waitUntil: 'domcontentloaded' })
      // Each Paradigm card has a "Pick" button -> handlePick router.push to the
      // random generator, which auto-seeds from that Paradigm, inserts, and
      // redirects to /characters/<id>/edit?step=4. Retry-click until the
      // navigation actually starts (the onClick is client-wired post-hydration).
      const pick = page.getByRole('button', { name: 'Pick' }).first()
      await pick.waitFor({ state: 'visible', timeout: 15_000 })
      await expect(async () => {
        await pick.click().catch(() => {})
        await page.waitForURL(/\/characters\/[0-9a-f-]+\/edit/, { timeout: 8_000 })
      }, 'Pick should generate a character and land on its edit/Final-Review page').toPass({ timeout: 30_000 })

      // Capture the generated character's id from the review URL.
      const m = page.url().match(/\/characters\/([0-9a-f-]+)\/edit/)
      createdId = m ? m[1] : null
      expect(createdId, 'could not capture the generated character id from the edit URL').toBeTruthy()

      // REST-verify the row persisted (the save half of pick -> review -> save).
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve percy creds').toBeTruthy()
      expect(await restCount(page, 'characters', createdId!, creds!), 'generated Paradigm char should exist').toBe(1)
    } finally {
      if (creds && createdId) await restDelete(page, 'characters', createdId, creds)
      await ctx.close()
    }
  })
})
