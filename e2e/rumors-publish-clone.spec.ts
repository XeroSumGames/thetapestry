import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch14 [Sys M] - Rumors (internally "Modules"): publish a story as a PRIVATE
// module, then clone it into a new story and prove the content lands.
//
// Publish (StoryActionBar "Publish" -> ModulePublishModal -> publishModuleVersion,
// lib/modules.ts:712, NO RPC): inserts a `modules` row (visibility default
// 'private', moderation_status auto-'approved' for non-listed) + a
// `module_versions` row carrying the campaign snapshot (jsonb). A trigger
// (schema.sql:3429) stamps modules.latest_version_id, which is what makes the
// module appear in the /stories/new "start from module" list.
//
// Clone (/stories/new "Or start from a Module" -> pick card -> Create Story ->
// cloneModuleIntoCampaign, lib/modules.ts:254): inserts a new `campaigns` row,
// a `module_subscriptions` row linking it to the module, and re-inserts the
// snapshot content (campaign_npcs/pins/scenes/notes) stamped with source_module_id.
//
// PRIVATE on purpose (RLS modules_read, schema.sql:2656): a private module is
// invisible to everyone except its author, so we publish AND clone as the SAME
// account (gm) - gm sees its own private module in the clone list - and nothing
// leaks into the public marketplace. To make "content lands" meaningful (a blank
// new campaign has nothing to copy), we seed ONE campaign_npc into the source
// before publishing and assert that exact NPC appears in the clone.
//
// Teardown (gm owns all three rows): delete the module (FK CASCADE clears
// module_versions + module_subscriptions, schema.sql:1361/1355) + delete both
// the source and clone campaigns (CASCADE clears their content).

const RUN = `[E2E ${Date.now().toString(36)}]`

async function rows(page: Page, creds: SupaCreds, query: string): Promise<any[]> {
  const res = await page.request.get(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` },
  })
  if (!res.ok()) return []
  const out = await res.json().catch(() => [])
  return Array.isArray(out) ? out : []
}

test.describe('Ch14 - Rumors: publish a PRIVATE module + clone it (content lands)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM publishes a private module from a story, then clones it - NPC content lands', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    // The publish handler pops an alert() on success; auto-accept any dialog.
    gm.on('dialog', d => d.accept().catch(() => {}))
    let srcId: string | null = null
    let cloneId: string | null = null
    let moduleId: string | null = null
    let creds: SupaCreds | null = null
    const moduleName = `${RUN} Module`
    const npcName = `${RUN} Seed NPC`
    try {
      const anonP = captureAnonKey(gm)

      // --- 1. Throwaway SOURCE story ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} ModSrc`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      srcId = gm.url().split('/stories/')[1]
      expect(srcId, 'no source campaign id').toBeTruthy()

      // --- 2. Seed one NPC so the module has content to carry ---
      const npcIns = await gm.request.post(`${SUPABASE_URL}/rest/v1/campaign_npcs`, {
        headers: {
          apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        data: {
          campaign_id: srcId, name: npcName,
          reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
          skills: [], equipment: [],
          wp_max: 5, rp_max: 5, wp_current: 5, rp_current: 5,
          status: 'active', sort_order: 1,
        },
      })
      expect(npcIns.ok(), `npc seed failed: ${npcIns.status()} ${await npcIns.text()}`).toBe(true)

      // --- 3. Publish as a PRIVATE module from the story hub ---
      await gm.goto(`/stories/${srcId}`, { waitUntil: 'domcontentloaded' })
      await gm.getByRole('button', { name: 'Publish', exact: true }).click()
      // Modal: name (prefilled from the campaign - override to a clean tag),
      // visibility defaults to Private (click to be explicit/idempotent), publish.
      const nameField = gm.getByPlaceholder('e.g. The Arena')
      await expect(nameField, 'publish modal should open').toBeVisible({ timeout: 15_000 })
      await nameField.fill(moduleName)
      await gm.getByRole('button', { name: /Private/i }).click()
      await gm.getByRole('button', { name: /Publish v/i }).click()

      // --- 4. The module + its v1.0.0 version persisted (private) ---
      await expect.poll(async () => {
        const m = await rows(gm, creds!, `modules?source_campaign_id=eq.${srcId}&select=id,visibility,name`)
        if (m.length === 1) { moduleId = m[0].id }
        return m.length === 1 && m[0].visibility === 'private'
      }, { timeout: 15_000, message: 'a single PRIVATE module row should exist after publish' }).toBe(true)
      // publishModuleVersion inserts the modules row BEFORE the module_versions
      // row, so the version lags the module - poll for it (a one-shot query here
      // raced ahead and got [] under full-suite load).
      await expect.poll(
        async () => (await rows(gm, creds!, `module_versions?module_id=eq.${moduleId}&select=version`)).map(v => v.version),
        { timeout: 15_000, message: 'module v1.0.0 should be published' },
      ).toContain('1.0.0')

      // --- 5. The private module shows in the author's "start from module" list ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      const card = gm.getByText(moduleName, { exact: false }).first()
      await expect(card, 'author should see their own private module in the clone list').toBeVisible({ timeout: 15_000 })

      // --- 6. Clone it into a new story ---
      await card.click()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} Clone`)
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      cloneId = gm.url().split('/stories/')[1]
      expect(cloneId && cloneId !== srcId, 'clone should be a new campaign, distinct from source').toBeTruthy()

      // --- 7. Clone is linked to the module + the NPC content landed ---
      await expect.poll(
        async () => (await rows(gm, creds!, `module_subscriptions?campaign_id=eq.${cloneId}&module_id=eq.${moduleId}&select=id`)).length,
        { timeout: 15_000, message: 'the clone should have a module_subscriptions row linking it to the module' },
      ).toBe(1)
      await expect.poll(
        async () => (await rows(gm, creds!, `campaign_npcs?campaign_id=eq.${cloneId}&name=eq.${encodeURIComponent(npcName)}&select=id`)).length,
        { timeout: 15_000, message: 'the seeded NPC should have been cloned into the new campaign' },
      ).toBe(1)
    } finally {
      // Delete the module (CASCADE clears versions + subscriptions), then both campaigns.
      const del = async (q: string) => {
        if (!creds) return
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/${q}`, {
          headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` },
        }).catch(() => {})
      }
      if (moduleId) await del(`modules?id=eq.${moduleId}`)
      if (cloneId) await del(`campaigns?id=eq.${cloneId}`)
      if (srcId) await del(`campaigns?id=eq.${srcId}`)
      await gmCtx.close()
    }
  })
})
