import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { captureAnonKey, resolveCreds, restCount, restDelete } from './_teardown'

// TIER 1 - character creation (a core system) end-to-end through the DB:
// the Random builder inserts a row and redirects to its edit page; we confirm
// the row actually persisted (read back through the owner's session), then the
// owner deletes it (RLS allows owner-delete) and we confirm it's gone. This is
// the first WRITE spec, and it exercises the reusable create->persist->teardown
// pattern (e2e/_teardown.ts) every later write-spec reuses. Marv (a player)
// is the acting account; the test only ever touches the row it just created.

test.use({ storageState: canAuth('marv') ? AUTH.marv : undefined })

test.describe('character creation (Random): create -> persist -> owner-delete', () => {
  test.skip(!canAuth('marv'), 'needs marv session/creds')

  test('Random Character inserts a persisted row the owner can delete', async ({ page }) => {
    const anonKeyP = captureAnonKey(page)

    // /characters/random builds + inserts, then redirects to /characters/<id>/edit.
    await page.goto('/characters/random')
    await page.waitForURL(/\/characters\/[0-9a-fA-F-]{36}\/edit/, { timeout: 30_000 })
    const id = page.url().match(/\/characters\/([0-9a-fA-F-]{36})\/edit/)?.[1]
    expect(id, 'Random did not redirect to a new character edit page').toBeTruthy()

    const creds = await resolveCreds(page, anonKeyP)
    expect(creds, 'could not resolve session token + anon key for teardown').toBeTruthy()

    // Persisted: the new row is readable through the owner's session.
    expect(await restCount(page, 'characters', id!, creds!), 'created character not found in DB').toBe(1)

    // Teardown: owner deletes it, and it's gone (also proves owner-delete RLS).
    expect(await restDelete(page, 'characters', id!, creds!), 'owner delete failed').toBe(true)
    expect(await restCount(page, 'characters', id!, creds!), 'character was not cleaned up').toBe(0)
  })
})
