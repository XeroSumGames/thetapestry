import { test, expect } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Chat propagation contract: a chat_message REST-INSERTed by the GM appears
// live in another player's feed via the postgres_changes realtime subscription
// that useChatPanel mounts when the table page loads (chat_messages is in the
// supabase_realtime publication per publication.sql).
//
// Why NOT The Arena (CAMPAIGN_ID)? Marv has a `kicked=true` character_state
// row in The Arena. The table page's kick-gate (page.tsx ~L1302) fires a
// window.location.href redirect to /stories/<id> for any user with kicked=true,
// making that page inaccessible for Marv in tests. A throwaway campaign avoids
// this entirely - no character_states rows exist, so the gate never triggers.
//
// Why Marv self-joins? campaign_members INSERT RLS: `WITH CHECK (auth.uid() =
// user_id)` - users can add ONLY themselves. GM cannot REST-INSERT on Marv's
// behalf. Marv's token adds her to the throwaway campaign so the table page
// loads without a "not a member" redirect.
//
// The throwaway campaign also starts empty (no roll logs, no prior chat),
// so the new message appears at the top of the clean Both-tab feed without
// any scroll/virtualization race.
//
// RLS:
//   chat_messages INSERT: user_id = auth.uid() - GM inserts as their own user.
//   chat_messages SELECT: USING (true) - any authenticated user reads all.
//   chat_messages DELETE: GM of the campaign (chat_messages_delete_gm policy).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })
const MARV_USER_ID = ACCOUNTS.marv.userId

test.describe('Chat propagation - realtime contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM chat message appears in player feed live via realtime subscription', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const marv = await marvCtx.newPage()
    let campaignId: string | null = null
    let chatMessageId: string | null = null
    let gmCreds: SupaCreds | null = null
    let marvCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      const marvAnonP = captureAnonKey(marv)

      // Navigate both to /campfire to initialise session cookies for creds.
      await Promise.all([
        gm.goto('/campfire', { waitUntil: 'domcontentloaded' }),
        marv.goto('/campfire', { waitUntil: 'domcontentloaded' }),
      ])
      gmCreds = await resolveCreds(gm, gmAnonP)
      marvCreds = await resolveCreds(marv, marvAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()
      expect(marvCreds, 'could not resolve Marv creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-CHAT-${Date.now().toString(36)}`

      // Throwaway campaign owned by GM. invite_code has no DEFAULT.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns?select=id`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // Marv self-joins the throwaway campaign.
      // campaign_members INSERT RLS: WITH CHECK (auth.uid() = user_id) - Marv's token.
      await marv.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_members`,
        { headers: { ...H(marvCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, user_id: MARV_USER_ID } },
      )

      // Marv navigates to the throwaway campaign's table page. The kick-gate
      // checks character_states for the campaign - none exist here, so no redirect.
      await marv.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })

      // Wait for the Chat tab button - confirms the FeedColumn tree hydrated
      // and useChatPanel's useEffect (subscription + initial refetch) has run.
      // Then allow ~2s for the Supabase realtime WebSocket handshake to complete.
      const chatTabBtn = marv.getByRole('button', { name: 'Chat', exact: true })
      await expect(chatTabBtn, '"Chat" feed tab button not visible - table page may not have loaded for Marv').toBeVisible({ timeout: 20_000 })
      await marv.waitForTimeout(2_000)

      // GM REST-INSERTs a chat message to the throwaway campaign.
      // INSERT RLS: user_id = auth.uid() (matches gmUserId).
      const chatInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/chat_messages`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, user_id: gmUserId, character_name: 'GM', message: tag, is_whisper: false } },
      )).json() as Array<{ id: string }>
      chatMessageId = chatInsert?.[0]?.id ?? null
      expect(chatMessageId, 'chat_messages INSERT did not return an id').toBeTruthy()

      // Marv's feed should show the unique message text live via the
      // postgres_changes subscription on chat_messages. The throwaway campaign
      // starts empty, so the message appears at the top of the Both-tab feed
      // without any scroll/virtualization interference.
      await expect(
        marv.getByText(tag).first(),
        `chat message "${tag}" did not appear in Marv's feed within realtime SLA`,
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      if (campaignId && gmCreds) {
        // chat_messages CASCADE from campaigns, so deleting the campaign cleans
        // up the message too. One call handles both.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await marvCtx.close()
    }
  })
})
