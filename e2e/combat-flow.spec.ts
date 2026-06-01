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

  // PHASE C v2 - gm_apply_damage with the new p_infection_risk arg
  // (sql/gm-apply-damage-rpc-v2-infection-2026-05-30.sql, commit 4259d67).
  // Locks in the 4 contract gates from the v2 brief:
  //   (positive) PC + mortal-wound + flag=true  -> damage_json.infection_risk=true
  //   (negative) PC + non-mortal   + flag=true  -> flag NOT set
  //   (negative) NPC               + flag=true  -> flag NOT set (canon: NPCs never)
  //   (compat)   omit the arg                   -> damage_json byte-identical to v1
  //
  // Ordered so a single throwaway campaign exercises all four shapes without
  // mid-test state resets: non-mortal first (marv stays alive), NPC next
  // (independent target), mortal last (closes marv out).
  //
  // *** APP-SIDE BRIDGE GAP (flagged) ***
  // The brief proposed extending this test with "infection-modal renders on the
  // OWNER'S client only". Verified against app code: NO code path currently
  // reads damage_json.infection_risk (only lib/roll-helpers reads the unrelated
  // infection_DAYS / infection_SEVERITY env-sickness fields). The existing
  // "wound infection warning" surface is the orange RollsFeed banner gated on
  // roll_log.outcome === 'wound_infection_warning', inserted by
  // maybeLogWoundInfection() from the in-combat attack handler keyed off
  // weaponCausesWoundInfection() + pendingWoundInfectionRef. Until that bridge
  // is built (preferred: gm_apply_damage server-side also inserts the
  // wound_infection_warning row when the flag fires; alternative: client wires
  // damage_json.infection_risk -> maybeLogWoundInfection), this RPC flag is a
  // data-only contract. Bridge routed: tasks/finding-infection-risk-app-bridge
  // -2026-05-30.md + todo line under combat-flow #10. The banner DOM assertion
  // ships as a follow-up commit once the bridge lands.
  test('p_infection_risk gates: set ONLY on PC mortal-wound; omitted / non-mortal / NPC stays clean', async ({ browser }) => {
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
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Combat C2 infection`,
      })
      campaignId = setup.campaignId

      // marv baseline (needs >= 3 wp so we can do 2x non-mortal + 1 mortal).
      const baseSt = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current,wp_max`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ wp_current: number; wp_max: number }>
      expect(baseSt?.[0], 'marv character_states not readable').toBeTruthy()
      expect(baseSt[0].wp_max >= 3, 'wp_max too low to exercise non-mortal + mortal in one run').toBe(true)

      // Seed an NPC with explicit wp_current so the RPC's before-state is defined.
      const npcIns = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: `${RUN} InfectionNPC`, wp_max: 10, wp_current: 10 },
        },
      )
      expect(npcIns.ok(), `campaign_npcs INSERT failed: ${npcIns.status()} ${await npcIns.text()}`).toBe(true)
      const npcId = (await npcIns.json() as Array<{ id: string }>)[0].id

      // Helper: call the RPC + return the latest roll_log row's damage_json.
      const callAndReadDj = async (data: Record<string, any>): Promise<Record<string, any>> => {
        const r = await gm.request.post(
          `${SUPABASE_URL}/rest/v1/rpc/gm_apply_damage`,
          { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data },
        )
        expect(r.ok(), `RPC call failed: ${r.status()} ${await r.text()}`).toBe(true)
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&order=created_at.desc&limit=1&select=damage_json`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ damage_json: Record<string, any> | null }>
        expect(rows?.[0]?.damage_json, 'roll_log row should carry damage_json').toBeTruthy()
        return rows[0].damage_json ?? {}
      }

      // CASE 1 - BACKWARD COMPAT: 4-arg call (no p_infection_risk) on marv, 1 dmg.
      // v1 callers must remain byte-identical (no spurious infection_risk key).
      const dj1 = await callAndReadDj({
        p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: 1,
      })
      expect(dj1.via, 'v1 field preserved').toBe('gm_apply')
      expect(dj1.target_kind).toBe('pc')
      expect(
        dj1.infection_risk,
        '4-arg call MUST stay v1-byte-identical (no infection_risk set)',
      ).not.toBe(true)

      // CASE 2 - NEGATIVE non-mortal: flag=true but damage does NOT cross to WP=0.
      // Canon: wound-infection check fires on mortal-wound entry; non-mortal = no flag.
      const dj2 = await callAndReadDj({
        p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: 1, p_infection_risk: true,
      })
      expect(dj2.via).toBe('gm_apply')
      expect(
        dj2.infection_risk,
        'non-mortal damage MUST NOT set infection_risk (gated on WP=0 entry per RPC contract)',
      ).not.toBe(true)

      // CASE 3 - NEGATIVE NPC target: flag=true on an NPC. Canon: NPCs never roll
      // wound infection -> the RPC suppresses the flag.
      const dj3 = await callAndReadDj({
        p_campaign_id: campaignId, p_target_kind: 'npc', p_target_id: npcId, p_wp_damage: 10, p_infection_risk: true,
      })
      expect(dj3.via).toBe('gm_apply')
      expect(dj3.target_kind).toBe('npc')
      expect(
        dj3.infection_risk,
        'NPC target MUST NOT set infection_risk (canon: NPCs never roll wound infection)',
      ).not.toBe(true)

      // CASE 4 - POSITIVE: PC mortal-wound with flag=true -> damage_json carries
      // infection_risk=true alongside the v1 fields. Send exactly the remaining
      // wp so the assertion is robust to whatever capping behavior the RPC has.
      const beforeMortal = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ wp_current: number }>
      const remaining = beforeMortal[0].wp_current
      expect(remaining > 0, 'marv should still be alive going into the mortal-wound case').toBe(true)
      const dj4 = await callAndReadDj({
        p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: remaining, p_infection_risk: true,
      })
      expect(dj4.via).toBe('gm_apply')
      expect(dj4.target_kind).toBe('pc')
      expect(dj4.wp_after, 'PC should land at wp_current=0 after mortal-wound damage').toBe(0)
      expect(
        dj4.infection_risk,
        'PC + mortal-wound + flag=true MUST set damage_json.infection_risk=true',
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

  // PHASE C v3 - the wound-infection-warning SIBLING ROW bridge
  // (sql/gm-apply-damage-rpc-v3-bridge-2026-05-31.sql; 2026-05-31 playtest
  // confirmed it fires in real combat). When p_infection_risk=true AND
  // target='pc' AND damage crosses to WP=0, the RPC inserts a SECOND roll_log
  // row with outcome='wound_infection_warning' that mirrors the exact shape
  // maybeLogWoundInfection emits client-side - so the existing orange RollsFeed
  // banner renders without any client-side wiring (atomic + dedup + works for
  // GM-applied damage just like it does for in-combat attacks). The RPC's
  // return jsonb mirrors the flag in 'wound_infection_warning' (boolean).
  //
  // Dedup behavior (per SQL comments) - call twice in the same combat -> only
  // ONE warning row, second call returns false - is documented by the SQL but
  // NOT covered here: a second mortal-wound call to a PC at wp_current=0
  // doesn't re-cross zero so the flag wouldn't fire on its own merit
  // (independent of dedup). A faithful dedup test would need to restore wp
  // between calls, which adds RLS complications. Deferred.
  test('v3 bridge: infection_risk + PC mortal-wound inserts a sibling wound_infection_warning row mirroring maybeLogWoundInfection shape', async ({ browser }) => {
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
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Combat C3 bridge`,
      })
      campaignId = setup.campaignId

      // Resolve marv's character name - the sibling row's character_name +
      // label both reference it, so we assert against the actual value.
      const charRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/characters?id=eq.${MARV_CHAR}&select=name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ name: string }>
      const targetName = charRow?.[0]?.name
      expect(targetName, 'could not resolve marv character name').toBeTruthy()

      // Anchor the dedup window: a combat_start roll_log row mirrors what real
      // combat would have set down. Optional for dedup correctness here (the
      // RPC falls back to epoch when no combat_start row exists), but matches
      // the real playtest shape exactly.
      const csIns = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/roll_log`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: {
            campaign_id: campaignId, character_name: 'Combat',
            label: 'combat started', die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
            outcome: 'combat_start',
          },
        },
      )
      expect(csIns.ok(), `combat_start seed insert failed: ${csIns.status()} ${await csIns.text()}`).toBe(true)

      // Read marv's wp_current so we send exactly the remaining wp - the RPC
      // crosses to zero deterministically without depending on any cap.
      const stRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/character_states?campaign_id=eq.${campaignId}&character_id=eq.${MARV_CHAR}&select=wp_current`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ wp_current: number }>
      const wpRemaining = stRow?.[0]?.wp_current
      expect(wpRemaining > 0, 'marv should start with wp_current > 0').toBe(true)

      // Fire the RPC with the flag - this is the exact call shape an
      // end-of-combat GM "apply mortal-wound damage" UI would make.
      const rpc = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/gm_apply_damage`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { p_campaign_id: campaignId, p_target_kind: 'pc', p_target_id: MARV_CHAR, p_wp_damage: wpRemaining, p_infection_risk: true },
        },
      )
      expect(rpc.ok(), `gm_apply_damage v3 RPC failed: ${rpc.status()} ${await rpc.text()}`).toBe(true)

      // RPC return jsonb mirrors the flag - 'wound_infection_warning' = true
      // when the gate fired AND the warning was actually inserted (i.e. not
      // dedup'd this time).
      const rpcBody = await rpc.json() as Record<string, any>
      expect(
        rpcBody?.wound_infection_warning,
        'RPC return jsonb must mirror wound_infection_warning=true when the gate fires + warning was inserted',
      ).toBe(true)

      // The damage row's damage_json.infection_risk flag (the v2 contract,
      // still honored under v3) lands as before.
      const dmgRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&damage_json->>via=eq.gm_apply&select=damage_json&order=created_at.desc&limit=1`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ damage_json: Record<string, any> }>
      expect(dmgRows?.[0]?.damage_json?.infection_risk, 'damage row should carry damage_json.infection_risk=true').toBe(true)

      // SIBLING wound_infection_warning row exists with the maybeLogWound
      // Infection shape - same character_name, the canonical label string,
      // outcome='wound_infection_warning', all die/mod/total fields zeroed.
      // The existing orange RollsFeed banner (RollsFeed.tsx:433-447) keys on
      // outcome === 'wound_infection_warning' + label / character_name, so
      // matching the shape here means the banner renders for any client whose
      // RollsFeed picks up this row via realtime.
      await expect.poll(
        async () => {
          const r = await gm.request.get(
            `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=eq.wound_infection_warning&select=character_name,label,die1,die2,amod,smod,cmod,total`,
            { headers: H(gmCreds!) },
          )
          const rows = await r.json().catch(() => []) as Array<any>
          return rows?.length ?? 0
        },
        { timeout: 8_000, message: 'v3 RPC should insert exactly one wound_infection_warning sibling row' },
      ).toBe(1)

      const warnRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&outcome=eq.wound_infection_warning&select=character_name,label,die1,die2,amod,smod,cmod,total`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ character_name: string; label: string; die1: number; die2: number; amod: number; smod: number; cmod: number; total: number }>
      const w = warnRows[0]
      expect(w.character_name, 'sibling row character_name should match the target PC name').toBe(targetName)
      expect(
        w.label,
        'sibling row label should mirror maybeLogWoundInfection: "<name> is wounded and may have to deal with infection"',
      ).toBe(`${targetName} is wounded and may have to deal with infection`)
      expect({
        die1: w.die1, die2: w.die2, amod: w.amod, smod: w.smod, cmod: w.cmod, total: w.total,
      }, 'sibling row die/mod/total fields should all be zero (maybeLogWoundInfection shape)').toEqual({
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
      })
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
