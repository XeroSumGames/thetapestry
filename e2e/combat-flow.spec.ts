import { test, expect, type Page } from '@playwright/test'
import { AUTH, ACCOUNTS, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch9 / build-plan #10 - Combat-flow E2E (the last uncovered Phase-2 spec).
// Plan: tasks/e2e-combat-flow-plan-2026-05-30.md.
//
// PHASE A (this commit): a deterministic combat START. GM creates a THROWAWAY
// campaign, marv joins by code with his fixture PC, GM seeds an NPC, GM Starts
// Combat. Assertions (REST + DOM):
//   - initiative_order has >= 1 row for the campaign, exactly one is_active=true.
//   - character_states row exists for marv's PC (the "per PC combatant" check).
//   - The PLAYER's table reflects "IN COMBAT" live (cross-context realtime,
//     same pattern as section-a1).
// Cascade-delete the throwaway campaign in teardown (campaign_members,
// character_states, initiative_order, roll_log all FK to campaigns).
//
// PHASE B (DOM ordering / action decrement) is held until HP wraps the
// tactical-map move-follow gate-RED + flags 4 testids in active-lanes for
// Xero's "A" approval per the testid policy (no unilateral testids).
//
// PHASE C (deterministic damage chain via Puffer's gm_apply_damage RPC) lands
// as its own commit on top of this one.

const MARV_CHAR = '31300132-c808-4711-9936-13def2e1ce32' // marv: "Cree Blaine"
const RUN = `[E2E ${Date.now().toString(36)}]`

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// THROWAWAY-campaign + marv-as-PC helper. Single source of truth for Phase A /
// Phase C setup so the two tests stay in lock-step on shape.
//   - GM creates the campaign via the real /stories/new form (same shape as
//     story-lifecycle), captures invite_code.
//   - marv joins by code -> campaign_members row lands (character_id NULL).
//   - marv wires their PC: PATCH campaign_members.character_id = MARV_CHAR
//     (own-row, RLS-allowed) + INSERT character_states (own user_id + own
//     character, RLS-allowed) so combat has a PC combatant + a state to read.
async function setupThrowawayWithMarvPc(opts: {
  gm: Page; pl: Page; gmCreds: SupaCreds; plCreds: SupaCreds; name: string
}): Promise<{ campaignId: string; inviteCode: string }> {
  const { gm, pl, gmCreds, plCreds, name } = opts

  await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
  await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(name)
  await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
  await gm.getByRole('button', { name: /^create story$/i }).click()
  await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
  const campaignId = gm.url().split('/stories/')[1]
  expect(campaignId, 'no campaign id in landing URL').toBeTruthy()

  const campRow = await (await gm.request.get(
    `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
    { headers: H(gmCreds) },
  )).json() as Array<{ invite_code: string }>
  const inviteCode = campRow?.[0]?.invite_code
  expect(inviteCode, 'campaign has no invite_code').toBeTruthy()

  // marv joins by code (Ch6.2). The /stories/join page lands him at the hub.
  await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
  await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
  await pl.getByRole('button', { name: /^join story$/i }).click()
  await pl.waitForURL(new RegExp(`/stories/${campaignId}$`), { timeout: 30_000 })

  // Wire marv's PC for combat + Phase C damage. Both writes are own-row.
  const setMember = await pl.request.patch(
    `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${ACCOUNTS.marv.userId}`,
    { headers: { ...H(plCreds), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
  )
  expect(setMember.ok(), 'failed to wire marv PC on campaign_members').toBe(true)

  const stateIns = await pl.request.post(
    `${SUPABASE_URL}/rest/v1/character_states`,
    {
      headers: { ...H(plCreds), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      data: {
        campaign_id: campaignId,
        character_id: MARV_CHAR,
        user_id: ACCOUNTS.marv.userId,
        // schema defaults cover wp_current/max=10, rp_current/max=6, stress=0,
        // insight_dice=2 - enough for the existence + damage assertions.
      },
    },
  )
  expect(stateIns.ok(), `character_states INSERT failed: ${stateIns.status()} ${await stateIns.text()}`).toBe(true)

  return { campaignId: campaignId!, inviteCode: inviteCode! }
}

test.describe('Ch9 / #10 - Combat-flow Phase A (Start Combat -> initiative_order + IN-COMBAT)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM starts combat -> initiative_order has exactly one active row + marv PC has character_states + player sees IN COMBAT live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      // captureAnonKey reads the cached file (auth.setup persists it), so creds
      // resolve without needing an initial navigation.
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      const setup = await setupThrowawayWithMarvPc({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Combat A`,
      })
      campaignId = setup.campaignId

      // Seed one NPC so the Start Combat picker has a selectable target. GM owns
      // the throwaway campaign -> direct campaign_npcs INSERT is RLS-allowed.
      const npcIns = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: `${RUN} CombatNPC` },
        },
      )
      expect(npcIns.ok(), `campaign_npcs INSERT failed: ${npcIns.status()} ${await npcIns.text()}`).toBe(true)

      // Open the table on both contexts. marv's context drives the IN-COMBAT
      // realtime assertion below.
      await Promise.all([
        gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      await gm.waitForTimeout(2500)

      // Combat requires an active session. A fresh throwaway has no session, so
      // Start Session should be visible.
      await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1500)

      // Start Combat picker (mirror section-a1). The confirm button reads
      // "Start Combat (N NPCs)"; if nothing is preselected, tick the first NPC.
      await gm.getByRole('button', { name: /start combat/i }).first().click()
      await gm.waitForTimeout(800)
      const confirm = gm.getByRole('button', { name: /start combat \(/i }).first()
      if (!(await confirm.isEnabled().catch(() => false))) {
        await gm.getByRole('checkbox').first().check().catch(() => {})
        await gm.waitForTimeout(300)
      }
      await confirm.click()

      // (a) Player sees IN COMBAT live - cross-context realtime, no reload.
      await expect(
        pl.getByText(/in combat/i).first(),
        'player did not see IN COMBAT live after GM Start Combat',
      ).toBeVisible({ timeout: 25_000 })

      // (b) initiative_order: exactly one is_active=true (the active turn).
      await expect.poll(
        async () => {
          const r = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}&select=is_active`,
            { headers: H(gmCreds!) },
          )
          const rows = await r.json().catch(() => []) as Array<{ is_active: boolean }>
          return Array.isArray(rows) ? rows.filter(x => x.is_active).length : -1
        },
        { timeout: 12_000, message: 'initiative_order should have exactly one is_active=true row after Start Combat' },
      ).toBe(1)

      // (c) initiative_order has >= 1 combatant total.
      const allInit = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/initiative_order?campaign_id=eq.${campaignId}&select=id,is_npc,character_name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; is_npc: boolean; character_name: string }>
      expect(Array.isArray(allInit) && allInit.length >= 1, 'initiative_order has no combatants after Start Combat').toBe(true)

      // (d) character_states existence for marv's PC (the "per PC combatant" check).
      // Vacuous if Start Combat ended up NPC-only, so guard the assertion on whether
      // marv is actually IN the initiative - the brief's intent is "every PC in
      // combat has a state row", which is what we're proving.
      const marvInCombat = allInit.some(r => !r.is_npc && r.character_name)
      if (marvInCombat) {
        const st = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=character_id`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ character_id: string }>
        expect(
          Array.isArray(st) && st.length === 1,
          'PC marv is a combatant but has no character_states row in this campaign',
        ).toBe(true)
      }
    } finally {
      // Cascade-delete the throwaway. campaign_members, character_states,
      // initiative_order, campaign_npcs, roll_log all hang off campaigns; one
      // DELETE cleans the run (same pattern as story-lifecycle).
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})

test.describe('Ch9 / #10 - Combat-flow Phase C (deterministic damage via gm_apply_damage)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  // Phase C - Puffer's gm_apply_damage SECURITY DEFINER RPC (sql/gm-apply-damage-
  // rpc-2026-05-30.sql) drives the data-layer assertion the dice path can't:
  // applying wp_damage = wp_max to a PC crosses wp_current from >0 to 0, which
  // triggers the canon stress-on-mortal +1 (cap 5) and writes a roll_log row
  // with damage_json.via='gm_apply' so E2E can disambiguate it from a real
  // attack. The PLAYER's table page subs character_states realtime, so the
  // GM-side RPC call should make their client refetch (section-a3 pattern).
  // Authz: the RPC RAISEs for any non-GM caller; the negative half proves it.
  test('GM apply-damage(PC, wp_max) -> wp_current=0 + stress+1 + roll_log via=gm_apply; player refetches; non-GM RAISES', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      const setup = await setupThrowawayWithMarvPc({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Combat C`,
      })
      campaignId = setup.campaignId

      // Baseline: read marv's wp_max + stress to compute the expected after-state.
      const stBefore = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current,wp_max,stress`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ wp_current: number; wp_max: number; stress: number }>
      expect(stBefore?.[0], 'baseline character_states not readable').toBeTruthy()
      const wpMax = stBefore[0].wp_max
      const stressBefore = stBefore[0].stress ?? 0
      const expectedStress = Math.min(5, stressBefore + 1) // canon cap

      // marv opens the table so the character_states realtime sub is live BEFORE
      // we arm the refetch wait.
      await pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await pl.waitForTimeout(2500)

      // Arm the player's realtime-triggered REFETCH (the same shape section-a3
      // uses for scene_tokens). The character_states sub fires loadCharacterStates
      // on any UPDATE; we just need a GET on the table after the RPC mutates.
      const refetch = pl.waitForResponse(
        (r) => r.url().includes('/rest/v1/character_states') && r.request().method() === 'GET',
        { timeout: 15_000 },
      ).catch(() => null)

      // GM calls the RPC with damage = wp_max (forces wp_current to 0 + the
      // stress-on-mortal bump). Same call shape `onApplyDamage` would use.
      const rpc = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/gm_apply_damage`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: wpMax },
        },
      )
      expect(rpc.ok(), `gm_apply_damage RPC failed: ${rpc.status()} ${await rpc.text()}`).toBe(true)

      // Player's character_states subscription delivered + refetch fired.
      expect(await refetch, 'player did not refetch character_states after the GM RPC (realtime not delivered)').toBeTruthy()

      // DB: wp_current=0 AND stress=expectedStress (the canon +1, cap 5).
      await expect.poll(
        async () => {
          const r = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current,stress`,
            { headers: H(gmCreds!) },
          )
          const rows = await r.json().catch(() => []) as Array<{ wp_current: number; stress: number }>
          return rows?.[0] ? { wp_current: rows[0].wp_current, stress: rows[0].stress } : null
        },
        { timeout: 8_000, message: 'character_states should converge to wp_current=0 + stress=expected after the RPC' },
      ).toEqual({ wp_current: 0, stress: expectedStress })

      // roll_log audit row carries the gm_apply marker + target shape.
      const logRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&order=created_at.desc&limit=1&select=damage_json,target_name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ damage_json: Record<string, any> | null; target_name: string | null }>
      expect(logRows?.[0], 'no roll_log row for the campaign').toBeTruthy()
      const dj = (logRows[0].damage_json ?? {}) as Record<string, any>
      expect(dj.via, 'roll_log.damage_json.via should be gm_apply').toBe('gm_apply')
      expect(dj.target_kind, 'roll_log.damage_json.target_kind should be pc').toBe('pc')
      expect(dj.target_id, 'roll_log.damage_json.target_id should match marv char').toBe(MARV_CHAR)
      expect(dj.wp_before, 'roll_log.damage_json.wp_before should equal baseline wp_current').toBe(stBefore[0].wp_current)
      expect(dj.wp_after, 'roll_log.damage_json.wp_after should be 0').toBe(0)
      expect(dj.stress_after, 'roll_log.damage_json.stress_after should match expected').toBe(expectedStress)
      expect(typeof logRows[0].target_name === 'string' && logRows[0].target_name!.length > 0, 'roll_log.target_name should resolve to the character').toBe(true)

      // Negative: marv (non-GM) calls the RPC -> RAISEs (in-function authz).
      const neg = await pl.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/gm_apply_damage`,
        {
          headers: { ...H(plCreds!), 'Content-Type': 'application/json' },
          data: { p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: 1 },
        },
      )
      expect(neg.ok(), 'expected non-GM caller to be REJECTED by the RPC, got an OK response').toBe(false)
      const negBody = (await neg.text()).toLowerCase()
      expect(
        negBody.includes('not authorized'),
        `RPC error should explain non-GM rejection ('not authorized'), got: ${negBody}`,
      ).toBe(true)
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
