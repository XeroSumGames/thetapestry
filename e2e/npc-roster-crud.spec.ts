import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch10 [Sys G] - NPC roster CRUD lifecycle on the GM's table page (NpcRoster.tsx).
// Drives the real UI (no app testids - the per-card controls already carry stable
// title= attributes) and verifies each step against the campaign_npcs table:
//   create (+ NPC form) -> edit (rename) -> clone (+ auto-numbered "<base> #2",
//   full HP) -> delete (confirm) -> back to one row.
//
// RUNS IN ITS OWN THROWAWAY CAMPAIGN (created via /stories/new like
// story-lifecycle/session-lifecycle), NEVER The Arena: NPC create/clone/delete
// mutate campaign_npcs that section-c-npc-reveal reads in the Arena. The GM owns
// the campaign, so its own session can INSERT/UPDATE/DELETE campaign_npcs ("GM
// can manage campaign NPCs", schema.sql:2088); teardown deletes the campaign and
// CASCADE clears the NPCs.
//
// DEFERRED out of this spec (documented):
//  - apply-damage -> WP/RP (the WP/RP dot-clicks live on the expanded NpcCard;
//    overlaps combat-flow #10's damage propagation).
//  - Populate archetype ratios, Conscript credible-threat gate (richer recruit
//    flows), Apprentice double-6 (DICE-GATED -> stays manual).

const RUN = `[E2E ${Date.now().toString(36)}]`

async function npcRows(page: Page, creds: SupaCreds, campaignId: string): Promise<any[]> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/campaign_npcs?campaign_id=eq.${campaignId}&select=id,name,wp_current,wp_max&order=sort_order.asc`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return []
  const out = await res.json().catch(() => [])
  return Array.isArray(out) ? out : []
}

test.describe('Ch10 - NPC roster CRUD (create / edit / clone / delete)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM creates, edits, clones (auto-numbered), and deletes an NPC', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    gm.on('dialog', d => d.accept().catch(() => {})) // delete confirm()
    let campaignId: string | null = null
    let creds: SupaCreds | null = null
    const base = `${RUN} Roster One`
    const edited = `${RUN} Roster Edited`
    const cloneName = `${edited} #2`
    try {
      const anonP = captureAnonKey(gm)

      // --- Throwaway campaign ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} NpcCrud`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id').toBeTruthy()

      // --- Open the table and switch to the NPCs panel ---
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await gm.getByRole('button', { name: 'NPCs', exact: true }).first().click()

      // --- CREATE via the "+ NPC" form ---
      await gm.getByRole('button', { name: '+ NPC' }).click()
      const saveCreate = gm.getByRole('button', { name: 'Add NPC' })
      await expect(saveCreate, 'Add NPC modal should open').toBeVisible({ timeout: 15_000 })
      // The Name field autofocuses on mount (NpcRoster.tsx:1758) - it has no
      // placeholder, so target the focused input.
      await gm.locator('input:focus').fill(base)
      await saveCreate.click()
      await expect.poll(
        async () => (await npcRows(gm, creds!, campaignId!)).map(n => n.name),
        { timeout: 15_000, message: 'created NPC should land in campaign_npcs' },
      ).toEqual([base])
      // The roster groups NPCs into folders; an ungrouped NPC lands in
      // "Uncategorized", which starts COLLAPSED (expandedFolders defaults empty,
      // NpcRoster.tsx:311), so its card + per-card controls aren't in the DOM
      // until we expand it. Click the folder header, then gate on the (now
      // rendered, unique-while-one-NPC) Edit control instead of the card name
      // (the name is CSS-uppercased, which trips an exact getByText).
      await gm.getByText('Uncategorized', { exact: false }).first().click()
      await expect(gm.locator('button[title="Edit NPC"]'), 'NPC card should render after expanding the folder').toBeVisible({ timeout: 10_000 })

      // --- EDIT (rename) via the per-card pencil (unique while one NPC) ---
      await gm.locator('button[title="Edit NPC"]').click()
      const saveEdit = gm.getByRole('button', { name: 'Save', exact: true })
      await expect(saveEdit, 'Edit NPC modal should open').toBeVisible({ timeout: 15_000 })
      await gm.locator('input:focus').fill(edited)
      await saveEdit.click()
      await expect.poll(
        async () => (await npcRows(gm, creds!, campaignId!)).map(n => n.name),
        { timeout: 15_000, message: 'edited name should persist' },
      ).toEqual([edited])

      // --- CLONE via the per-card "+" (unique while one NPC); auto-numbers "#2" ---
      await gm.locator('button[title="Clone NPC"]').click()
      await expect.poll(
        async () => (await npcRows(gm, creds!, campaignId!)).map(n => n.name).sort(),
        { timeout: 15_000, message: 'clone should add an auto-numbered "#2"' },
      ).toEqual([edited, cloneName].sort())
      const clone = (await npcRows(gm, creds!, campaignId!)).find(n => n.name === cloneName)
      expect(clone, 'clone row should exist').toBeTruthy()
      expect(clone.wp_current, 'a fresh clone starts at full WP').toBe(clone.wp_max)

      // --- DELETE the clone (two cards now -> scope by the clone's name) ---
      // exact:false = case-insensitive substring (the card name is CSS-uppercased);
      // the "#2" suffix keeps it off the original card. Walk up to the card div
      // (nearest ancestor holding a Remove control) and click its delete.
      await gm.getByText(cloneName, { exact: false }).first()
        .locator('xpath=ancestor::div[.//button[@title="Remove NPC"]][1]')
        .locator('button[title="Remove NPC"]').click()
      await expect.poll(
        async () => (await npcRows(gm, creds!, campaignId!)).map(n => n.name),
        { timeout: 15_000, message: 'deleting the clone should leave only the original' },
      ).toEqual([edited])
    } finally {
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
