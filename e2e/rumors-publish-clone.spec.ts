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

  // Ch14.4 - the version-UPDATE half: publish v1 -> clone -> publish v2 from the
  // source -> the subscriber campaign's StoryActionBar surfaces the "update
  // available" notice (`📦 v<latest> ↑`, StoryActionBar.tsx:282) and links to the
  // version-history page. Own full setup + teardown (NOT bolted onto test 1, so a
  // flake here can't redden the certified publish/clone coverage). No NPC seed -
  // the update detection is version-only (subscription.current_version_id !=
  // modules.latest_version_id, scoped `.eq('campaign_id', campaignId)` so the live
  // gm account's OTHER real subscriptions can't pollute the assertion). Assertions
  // are semver-AGNOSTIC: module_versions count >= 2 + the version-independent
  // "has a newer version" title, not a hardcoded "1.1.0".
  test('GM publishes v2 of a module; the subscriber campaign surfaces the update + links to version history', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    gm.on('dialog', d => d.accept().catch(() => {})) // publish success alert()
    let srcId: string | null = null
    let cloneId: string | null = null
    let moduleId: string | null = null
    let creds: SupaCreds | null = null
    const moduleName = `${RUN} V2Module`
    try {
      const anonP = captureAnonKey(gm)

      // --- 1. Source story + publish v1.0.0 (no content needed - update
      //     detection is version-only) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} V2Src`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      srcId = gm.url().split('/stories/')[1]
      expect(srcId, 'no source campaign id').toBeTruthy()

      await gm.goto(`/stories/${srcId}`, { waitUntil: 'domcontentloaded' })
      await gm.getByRole('button', { name: 'Publish', exact: true }).click()
      const nameField = gm.getByPlaceholder('e.g. The Arena')
      await expect(nameField, 'publish modal should open').toBeVisible({ timeout: 15_000 })
      await nameField.fill(moduleName)
      await gm.getByRole('button', { name: /Private/i }).click()
      await gm.getByRole('button', { name: /Publish v/i }).click()
      await expect.poll(async () => {
        const m = await rows(gm, creds!, `modules?source_campaign_id=eq.${srcId}&select=id`)
        if (m.length === 1) moduleId = m[0].id
        return m.length
      }, { timeout: 15_000, message: 'module row after v1 publish' }).toBe(1)
      await expect.poll(
        async () => (await rows(gm, creds!, `module_versions?module_id=eq.${moduleId}&select=version`)).length,
        { timeout: 15_000, message: 'v1 should be published' },
      ).toBe(1)

      // --- 2. Clone it (creates the module_subscriptions row pinned to v1) ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByText(moduleName, { exact: false }).first().click()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} V2Clone`)
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      cloneId = gm.url().split('/stories/')[1]
      expect(cloneId && cloneId !== srcId, 'clone should be a distinct campaign').toBeTruthy()
      await expect.poll(
        async () => (await rows(gm, creds!, `module_subscriptions?campaign_id=eq.${cloneId}&module_id=eq.${moduleId}&select=id`)).length,
        { timeout: 15_000, message: 'clone should be subscribed to the module' },
      ).toBe(1)

      // --- 3. Publish v2 from the SOURCE hub. After v1 the bar's Publish button
      //     re-labels to "Module v1.0.0" (StoryActionBar.tsx:267) and opens the
      //     re-publish modal; default minor bump, just click Publish. ---
      await gm.goto(`/stories/${srcId}`, { waitUntil: 'domcontentloaded' })
      await gm.getByRole('button', { name: /^Module v/i }).click()
      await expect(gm.getByText(/Publish New Version/i), 're-publish modal should open').toBeVisible({ timeout: 15_000 })
      await gm.getByRole('button', { name: /Publish v/i }).click()
      // Two versions now exist (the trigger advances modules.latest_version_id).
      await expect.poll(
        async () => (await rows(gm, creds!, `module_versions?module_id=eq.${moduleId}&select=version`)).length,
        { timeout: 15_000, message: 'a second version should be published' },
      ).toBe(2)

      // --- 4. The subscriber (clone) hub surfaces the update notice. The check
      //     is scoped to this campaign, so the title is the stable, version-
      //     independent assertion. ---
      await gm.goto(`/stories/${cloneId}`, { waitUntil: 'domcontentloaded' })
      const updateLink = gm.getByTitle(/has a newer version/i)
      await expect(updateLink, 'clone bar should show the module-update notice').toBeVisible({ timeout: 20_000 })

      // --- 5. It links to the version-history page (both versions listed) ---
      await updateLink.click()
      await gm.waitForURL(new RegExp(`/stories/${cloneId}/modules/[0-9a-f-]{36}/versions`), { timeout: 30_000 })
      await expect(gm.getByText(/Version History/i), 'version-history page should render').toBeVisible({ timeout: 15_000 })
    } finally {
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
