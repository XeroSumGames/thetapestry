import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, accessTokenFromContext, userIdFromToken, type SupaCreds } from './_teardown'

// Ch (P) - Account settings persistence (/account). The page lets a user change
// their username, avatar, email, and password (app/account/page.tsx). We assert
// the two REVERSIBLE, non-bright-line surfaces persist across a reload:
//
//  1. USERNAME - exercised through the REAL UI (fill the Identity input -> Save
//     -> "Username updated." -> reload -> the new value is still there). This is
//     the headline: it proves the save handler + the DB write + the reload-read.
//
//  2. AVATAR - exercised as a REVERSIBLE avatar_url round-trip via the acting
//     account's own Supabase session (PATCH profiles.avatar_url -> reload ->
//     the avatar circle renders that url in its background -> restore). We do
//     NOT drive the file-upload control: that upserts a real object into the
//     account-avatars storage bucket at a fixed path (irreversible byte-wise),
//     which is the wrong thing to do to a prod account. The round-trip proves
//     the persistence + render-binding half of the feature; the upload-bytes
//     path stays a documented manual check. The upload control's presence is
//     asserted structurally.
//
// EXCLUDED (bright lines, never automated): email change (sends a real
// verification email) and password change (can lock the account out). The page
// also has a Danger-Zone account-delete we never touch.
//
// Acts as `pesky` (a disposable test account, deliberately the one NOT read by
// any other spec - presence reads marv + percy - so the brief username rename
// can't race a concurrent reader under cross-file parallelism). Both mutations
// are captured up-front and restored in `finally` so a mid-test failure still
// leaves pesky's profile exactly as it was.

const RUN = Date.now().toString(36)

interface ProfileSnapshot {
  username: string
  avatar_url: string | null
}

async function readProfile(page: Page, creds: SupaCreds, userId: string): Promise<ProfileSnapshot | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,avatar_url`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? (rows[0] as ProfileSnapshot) : null
}

async function patchProfile(page: Page, creds: SupaCreds, userId: string, patch: Partial<ProfileSnapshot>): Promise<boolean> {
  try {
    const res = await page.request.patch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
        data: patch,
      },
    )
    return res.ok()
  } catch {
    return false
  }
}

test.describe('Ch P - Account settings persist (username UI + reversible avatar round-trip)', () => {
  test.skip(!canAuth('pesky'), 'needs pesky session/creds')

  test('username change via the form + avatar_url round-trip both survive reload', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.pesky })
    const page = await ctx.newPage()
    let creds: SupaCreds | null = null
    let original: ProfileSnapshot | null = null
    let userId: string | null = null
    try {
      const anonP = captureAnonKey(page)
      await page.goto('/account', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve pesky creds').toBeTruthy()

      const token = await accessTokenFromContext(ctx)
      userId = token ? userIdFromToken(token) : null
      expect(userId, 'could not derive pesky user id').toBeTruthy()

      original = await readProfile(page, creds!, userId!)
      expect(original, 'could not read pesky profile').toBeTruthy()

      // The page hydrates the username input from profiles. Wait for it to hold
      // the current value before touching it (avoids racing the load effect).
      // The username input is the only text input that is not file/email/password.
      const usernameInput = page.locator('input:not([type="file"]):not([type="email"]):not([type="password"])').first()
      await expect(usernameInput).toHaveValue(original!.username, { timeout: 15_000 })

      // --- 1. USERNAME via the real UI ---
      // A short, standalone tag: guaranteed to differ from the original (so the
      // Save button enables) and well under any column-length limit. Restored
      // to the captured original in `finally`.
      const newName = `e2e-${RUN}`
      await usernameInput.fill(newName)
      // The first "Save" button is the username one (email Save is second in DOM).
      await page.getByRole('button', { name: /^save$/i }).first().click()
      await expect(page.getByText('Username updated.', { exact: false })).toBeVisible({ timeout: 15_000 })

      // Persistence: reload and confirm the new value survived (not just optimistic state).
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(usernameInput).toHaveValue(newName, { timeout: 15_000 })
      // The hero heading also reflects it.
      await expect(page.getByText(newName, { exact: false }).first()).toBeVisible()

      // --- 2. AVATAR url round-trip (reversible; storage untouched) ---
      // Structural: the upload control exists (the real bytes path stays manual).
      await expect(page.getByText(/^(Upload|Replace)$/i).first()).toBeVisible()

      const testAvatar = `https://e2e.invalid/avatar-${RUN}.jpg`
      expect(await patchProfile(page, creds!, userId!, { avatar_url: testAvatar }), 'avatar_url PATCH failed').toBe(true)
      await page.reload({ waitUntil: 'domcontentloaded' })
      // The avatar circle binds avatar_url into its inline background style; the
      // unique run tag makes the locator unambiguous.
      await expect(page.locator(`[style*="avatar-${RUN}.jpg"]`).first(), 'avatar circle should render the new url after reload').toBeVisible({ timeout: 15_000 })
    } finally {
      // Restore EXACTLY what we captured (username + avatar_url), in one PATCH.
      if (creds && original && userId) {
        await patchProfile(page, creds, userId, { username: original.username, avatar_url: original.avatar_url })
      }
      await ctx.close()
    }
  })
})
