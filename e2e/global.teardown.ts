import { test as teardown } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// Global sweep: delete every throwaway `[E2E ...]`-named campaign owned by the
// test GM. Each spec's own `finally` deletes its campaign immediately in the
// common case; this catch-all reclaims ORPHANS from runs that threw before the
// spec captured campaignId (e.g. `/stories/new` created the campaign server-side
// but a later step failed, so the `if (campaignId)` teardown guard was skipped).
// That is how ~82 leftover campaigns accumulated on prod between 2026-05 and
// 2026-07 (Puffer Fish cleanup 2026-08-01). The campaigns DELETE cascades all
// children (verified live: communities / campaign_npcs / character_states /
// tactical_scenes / campaign_members all removed), so this is complete + safe.
//
// SAFETY: scoped to gm_user_id == the test GM AND the literal `[E2E ` name
// prefix, so it can only ever touch this lane's disposable campaigns - never The
// Arena or any real seeded campaign. NOTE: assumes E2E runs are not concurrent
// (single lane); a parallel run's in-flight `[E2E ...]` campaigns would be in
// scope. Teardown projects run after the suite regardless of pass/fail, so
// orphans from a failing run still get swept.
teardown('sweep leftover [E2E] campaigns owned by the test GM', async ({ browser }) => {
  if (!canAuth('gm')) {
    console.log('[e2e-sweep] no GM session - skipping campaign sweep')
    return
  }
  const ctx = await browser.newContext({ storageState: AUTH.gm })
  const gm = await ctx.newPage()
  try {
    const anonP = captureAnonKey(gm)
    await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
    const creds = await resolveCreds(gm, anonP)
    if (!creds) { console.log('[e2e-sweep] could not resolve GM creds - skipping'); return }
    const gmId = userIdFromToken(creds.accessToken)
    if (!gmId) { console.log('[e2e-sweep] could not derive GM id - skipping'); return }

    // PostgREST `like`: `*` is the wildcard; the `[` is a literal (URL-encoded).
    const pattern = `${encodeURIComponent('[E2E')}*` // matches names starting "[E2E"
    const res = await gm.request.get(
      `${SUPABASE_URL}/rest/v1/campaigns?gm_user_id=eq.${gmId}&name=like.${pattern}&select=id,name`,
      { headers: H(creds) },
    )
    if (!res.ok()) { console.log(`[e2e-sweep] listing failed: HTTP ${res.status()}`); return }
    const rows = (await res.json().catch(() => [])) as Array<{ id: string; name: string }>
    if (!rows.length) { console.log('[e2e-sweep] no leftover [E2E] campaigns to clean'); return }

    let deleted = 0
    for (const r of rows) {
      const d = await gm.request.delete(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${r.id}`,
        { headers: H(creds) },
      )
      if (d.ok()) deleted++
      else console.log(`[e2e-sweep] FAILED to delete ${r.id} ("${r.name}"): HTTP ${d.status()}`)
    }
    console.log(`[e2e-sweep] deleted ${deleted}/${rows.length} leftover [E2E] campaign(s)`)
  } finally {
    await ctx.close()
  }
})
