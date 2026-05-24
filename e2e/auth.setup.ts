import { test as setup } from '@playwright/test'
import { AUTH, loadCredential, type AccountKey } from './_fixtures'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Auto-login. Runs as a 'setup' project (a dependency of the test projects), so
// sessions are minted/refreshed automatically before every run - no more
// hand-capturing. Logs in via the real /login form headlessly: Turnstile is a
// soft gate, so with no token the app calls signInWithPassword directly and the
// login proceeds. Credentials come from e2e/.auth/credentials.json or
// E2E_<KEY>_EMAIL/PASSWORD env vars (both gitignored / never committed). A key
// with no credentials simply skips (its tests then skip via canAuth).

const FRESH_MS = 50 * 60 * 1000 // Supabase access token ~1h; refresh a bit early.

function isFresh(p: string): boolean {
  try {
    return existsSync(p) && Date.now() - statSync(p).mtimeMs < FRESH_MS
  } catch {
    return false
  }
}

for (const key of ['gm', 'marv', 'pesky', 'percy'] as AccountKey[]) {
  setup(`authenticate ${key}`, async ({ page }) => {
    const cred = loadCredential(key)
    setup.skip(!cred, `no credentials for ${key} - add to e2e/.auth/credentials.json (or run capture-auth.mjs ${key})`)
    if (isFresh(AUTH[key])) return // recent session still valid - reuse it

    mkdirSync(dirname(AUTH[key]), { recursive: true })
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(cred!.email)
    await page.getByPlaceholder('Password').fill(cred!.password)
    await page.getByRole('button', { name: 'Log In' }).click()
    // Successful login routes to /dashboard. If this times out the password is
    // wrong or server-side captcha got enabled - the setup fails loudly and the
    // dependent tests don't run (better than masking it).
    await page.waitForURL('**/dashboard', { timeout: 30_000 })
    await page.context().storageState({ path: AUTH[key] })
  })
}
