import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// SECTION C - NPC reveal propagates GM -> player live (~2s, no reload).
// The table page runs a campaign_npcs_${id} postgres sub that drives the
// player's revealedNpcs; players filter out hidden_from_players (page.tsx:6866).
// The GM "Show" action just flips hidden_from_players false (page.tsx:1734), so
// we replicate it via REST. Fully reversible fixture: pick an EXISTING hidden
// Arena NPC, reveal it, assert it appears in the player's panel, then re-hide
// it (teardown is the inverse - nothing created or destroyed).

async function setHidden(page: Page, creds: SupaCreds, npcId: string, hidden: boolean) {
  return page.request.patch(`${SUPABASE_URL}/rest/v1/campaign_npcs?id=eq.${npcId}`, {
    headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    data: { hidden_from_players: hidden },
  })
}

test.describe('Section C - NPC reveal GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM reveal flips hidden_from_players; player NPC panel updates live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let npcId: string | null = null
    let originalHidden = false
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto('/dashboard')
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Pick ANY Arena NPC as a reversible fixture; capture its original
      // visibility so teardown restores it exactly. (PostgREST boolean filters
      // want is.true not eq.true, so we don't filter - we read + restore.)
      const res = await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaign_npcs?campaign_id=eq.${CAMPAIGN_ID}&select=id,name,hidden_from_players&limit=1`,
        { headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}` } },
      )
      const rows = await res.json().catch(() => [])
      expect(Array.isArray(rows) && rows.length > 0, 'no NPCs found in Arena').toBe(true)
      const npc = rows[0] as { id: string; name: string; hidden_from_players: boolean }
      npcId = npc.id
      originalHidden = npc.hidden_from_players === true

      // Setup: ensure it starts HIDDEN before the player loads the table.
      expect((await setHidden(gm, creds!, npc.id, true)).ok(), 'setup hide failed').toBe(true)

      // Player opens the table + the NPCs panel.
      await pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })
      await pl.waitForTimeout(2500)
      const npcsTab = pl.getByRole('button', { name: /^npcs/i }).first()
      if (await npcsTab.count()) await npcsTab.click().catch(() => {})

      // While hidden, the NPC must NOT appear in the player's panel.
      await expect(pl.getByText(npc.name, { exact: true })).toHaveCount(0)

      // GM reveals (the same write the Show button performs).
      expect((await setHidden(gm, creds!, npc.id, false)).ok(), 'reveal PATCH failed').toBe(true)

      // Player sees it appear live, no reload (~2s; allow 8s headroom).
      await expect(pl.getByText(npc.name, { exact: true }).first()).toBeVisible({ timeout: 8_000 })
    } finally {
      if (npcId && creds) await setHidden(gm, creds, npcId, originalHidden).catch(() => {}) // restore original visibility
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
