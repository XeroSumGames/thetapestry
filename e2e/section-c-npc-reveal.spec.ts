import { test, expect, type Page } from '@playwright/test'
import { AUTH, ACCOUNTS, canAuth, CAMPAIGN_ID } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// SECTION C - NPC reveal propagates GM -> player live (~2s, no reload).
//
// REWRITE 2026-05-27 (was deterministic-failing test-debt). The OLD test flipped
// `campaign_npcs.hidden_from_players` and watched the player roster - but that is
// NOT what drives the player NPC panel. The panel renders `revealedNpcs`, built
// by loadRevealedNpcs (table/page.tsx:1108) from `npc_relationships` rows where
// `revealed = true` for the PLAYER'S character. The GM "reveal to players" action
// writes exactly those rows (table/page.tsx:2920-2939, reveal_level
// 'name_portrait'). `hidden_from_players` is a separate coarse hide. So the old
// test only passed when the arbitrary first-by-id NPC happened to already be
// revealed to marv - pure data coupling, hence the flake.
//
// This rewrite drives + asserts the REAL mechanism, a3-style (assert the player's
// realtime REFETCH, not the <canvas>/folder-collapsed DOM): npc_relationships is
// in the realtime publication and the table page subs it (table/page.tsx:1613 ->
// loadRevealedNpcs). GM inserts a `revealed` relationship via REST; the player's
// sub fires loadRevealedNpcs; we assert that refetch returns a revealed set that
// now CONTAINS the NPC. Fully reversible: we INSERT one relationship row and
// DELETE exactly that row in teardown (nothing pre-existing is touched).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

async function getJson(page: Page, creds: SupaCreds, path: string): Promise<any[]> {
  const r = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H(creds) })
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

test.describe('Section C - NPC reveal GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a GM reveal (npc_relationships) makes the NPC appear in the player revealed set live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()

    const marvUserId = ACCOUNTS.marv.userId
    let gmCreds: SupaCreds | null = null
    let plCreds: SupaCreds | null = null
    let relId: string | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      // The player must have the TABLE open so its npc_relationships sub is live.
      await Promise.all([
        gm.goto('/dashboard', { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      gmCreds = await resolveCreds(gm, gmAnonP)
      plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve GM + player creds').toBeTruthy()

      // marv's PC in the Arena (read as marv - own membership).
      const members = await getJson(pl, plCreds!, `campaign_members?campaign_id=eq.${CAMPAIGN_ID}&user_id=eq.${marvUserId}&select=character_id`)
      const marvChar = members.find(m => m.character_id)?.character_id as string | undefined
      test.skip(!marvChar, 'marv has no character in the Arena')

      // Pick a NON-hidden Arena NPC marv has NO relationship row for yet: non-hidden
      // => it's in the player's known NPC set (so a revealed relationship will land
      // in loadRevealedNpcs' .in(npc_id) filter); no relationship => not yet shown,
      // and an INSERT (not UPDATE) keeps teardown a clean single-row delete.
      const npcs = await getJson(gm, gmCreds!, `campaign_npcs?campaign_id=eq.${CAMPAIGN_ID}&select=id,name,hidden_from_players`)
      const rels = await getJson(pl, plCreds!, `npc_relationships?character_id=eq.${marvChar}&select=npc_id`)
      const relSet = new Set(rels.map(r => r.npc_id))
      const target = npcs.find(n => n.hidden_from_players !== true && !relSet.has(n.id)) as { id: string; name: string } | undefined
      test.skip(!target, 'no unrevealed non-hidden NPC available in the Arena for marv')

      // Let the player's initial loadRevealedNpcs settle so the GET we catch next
      // is the one the REVEAL triggers.
      await pl.waitForTimeout(3000)

      // Arm the player's revealed-set refetch (loadRevealedNpcs issues a GET with
      // revealed=eq.true), then GM reveals via the same write the UI performs.
      const refetch = pl.waitForResponse(
        r => r.url().includes('/rest/v1/npc_relationships') && r.url().includes('revealed=eq.true') && r.request().method() === 'GET',
        { timeout: 15_000 },
      )
      const ins = await gm.request.post(`${SUPABASE_URL}/rest/v1/npc_relationships`, {
        headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        data: { npc_id: target!.id, character_id: marvChar, revealed: true, reveal_level: 'name_portrait', relationship_cmod: 0 },
      })
      expect(ins.ok(), 'reveal insert failed (RLS / unique conflict?)').toBe(true)
      const insRows = await ins.json().catch(() => [])
      relId = (Array.isArray(insRows) && insRows[0]?.id) ? insRows[0].id : null

      // The player's sub must refetch the revealed set, and it must now contain
      // the NPC - i.e. the reveal propagated live and the player can see it.
      const resp = await refetch
      const body = await resp.json().catch(() => [])
      expect(
        Array.isArray(body) && body.some((r: any) => r.npc_id === target!.id),
        'player did not refetch a revealed set containing the newly-revealed NPC (reveal did not propagate live)',
      ).toBe(true)
    } finally {
      if (relId && gmCreds) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/npc_relationships?id=eq.${relId}`, { headers: H(gmCreds) }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
