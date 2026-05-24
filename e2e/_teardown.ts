import type { BrowserContext, Page } from '@playwright/test'

// Reusable teardown infra for write-specs. The rule (Xero OK'd create/teardown
// on prod 2026-05-23): a test may only ever delete data IT created, and it does
// so through the acting account's OWN Supabase session - so RLS is the backstop
// (the request literally cannot touch another user's rows). Nothing here is
// destructive beyond the row id the test just made.

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'https://jbudzglgtxeoaufpejrv.supabase.co'

// @supabase/ssr stores the session in one cookie: sb-<ref>-auth-token whose
// value is "base64-" + base64(JSON{ access_token, refresh_token, ... }).
export async function accessTokenFromContext(ctx: BrowserContext): Promise<string | null> {
  const cookies = await ctx.cookies()
  const c = cookies.find(ck => /^sb-.*-auth-token$/.test(ck.name))
  if (!c) return null
  try {
    const raw = c.value.startsWith('base64-') ? c.value.slice('base64-'.length) : c.value
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    return typeof json.access_token === 'string' ? json.access_token : null
  } catch {
    return null
  }
}

// The anon key is public (shipped in the client bundle). Capture it from the
// first Supabase request the page makes rather than hardcoding/committing it.
// Falls back to E2E_SUPABASE_ANON_KEY if set.
export function captureAnonKey(page: Page, timeoutMs = 12_000): Promise<string | null> {
  const envKey = process.env.E2E_SUPABASE_ANON_KEY
  if (envKey) return Promise.resolve(envKey)
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs)
    page.on('request', (req) => {
      const k = req.headers()['apikey']
      if (k && req.url().includes('.supabase.co')) {
        clearTimeout(t)
        resolve(k)
      }
    })
  })
}

export interface SupaCreds {
  accessToken: string
  anonKey: string
}

export async function resolveCreds(page: Page, anonKeyPromise: Promise<string | null>): Promise<SupaCreds | null> {
  const accessToken = await accessTokenFromContext(page.context())
  const anonKey = await anonKeyPromise
  if (!accessToken || !anonKey) return null
  return { accessToken, anonKey }
}

// How many rows with this id are visible to the acting session (0 or 1).
// -1 signals the request itself failed.
export async function restCount(page: Page, table: string, id: string, creds: SupaCreds): Promise<number> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return -1
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows.length : -1
}

// Best-effort delete of a row the test created. Never throws - teardown hygiene
// must not fail the test it's cleaning up after.
export async function restDelete(page: Page, table: string, id: string, creds: SupaCreds): Promise<boolean> {
  try {
    const res = await page.request.delete(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
    )
    return res.ok()
  } catch {
    return false
  }
}
