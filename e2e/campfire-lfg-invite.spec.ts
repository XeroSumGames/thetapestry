import { test, expect } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Campfire LFG invite flow: GM sends a campaign invitation -> trigger creates a
// notification for the recipient -> GM accepts on recipient's behalf via REST
// PATCH -> trigger adds recipient to campaign_members.
//
//   1. Throwaway campaign - avoids the UNIQUE (campaign_id, recipient_user_id, status)
//      constraint colliding with any existing pending invite to Marv in The Arena.
//   2. GM REST-INSERT campaign_invitations
//      -> on_campaign_invitation_insert fires notify_campaign_invitation() (SECURITY DEFINER)
//      -> creates notification (type='campaign_invitation') for Marv.
//   3. Poll Marv's notifications via GM creds (notifications_thriver_bypass FOR ALL
//      USING is_thriver()) until the row with the correct invitation_id appears.
//   4. GM REST-PATCH invitation to status='accepted'
//      (ci_update RLS: sender OR recipient = auth.uid(); GM is sender -> passes)
//      -> on_campaign_invitation_response fires handle_campaign_invitation_response() (SECURITY DEFINER)
//      -> inserts Marv into campaign_members.
//   5. Poll campaign_members for Marv (SELECT USING auth.role()='authenticated').
//
// Teardown: DELETE campaign (CASCADE kills campaign_invitations + campaign_members).
// The trigger-created notification is NOT cleaned up here - it survives and
// is visible only to Marv and Thriver accounts. It will age out of the bell
// top-10 naturally as other notifications accumulate.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })
const MARV_USER_ID = ACCOUNTS.marv.userId

test.describe('Campfire LFG invite flow', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM invite triggers notification and acceptance lands recipient in campaign_members', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let campaignId: string | null = null
    let invitationId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-LFG-${Date.now().toString(36)}`

      // Throwaway campaign. invite_code has no DEFAULT in the schema.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns?select=id`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // Step 1: GM sends the invitation.
      // ci_insert_gm RLS: sender_user_id = auth.uid() AND campaign's gm_user_id = auth.uid().
      const inviteInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_invitations`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, sender_user_id: gmUserId, recipient_user_id: MARV_USER_ID } },
      )).json() as Array<{ id: string }>
      invitationId = inviteInsert?.[0]?.id ?? null
      expect(invitationId, 'campaign_invitations INSERT did not return an id (check ci_insert_gm RLS)').toBeTruthy()

      // Step 2: poll Marv's notifications for the trigger-created row.
      // The trigger (notify_campaign_invitation, SECURITY DEFINER) inserts a row
      // with type='campaign_invitation' and metadata.invitation_id = invitationId.
      // GM reads via notifications_thriver_bypass (FOR ALL USING is_thriver()).
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${MARV_USER_ID}&type=eq.campaign_invitation&select=id,metadata`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; metadata: Record<string, unknown> }>
        return rows.some(r => r.metadata?.invitation_id === invitationId)
      }, {
        timeout: 10_000,
        message: 'notify_campaign_invitation() trigger did not create a campaign_invitation notification for Marv',
      }).toBe(true)

      // Step 3: GM REST-PATCHes the invitation to 'accepted'.
      // ci_update RLS: (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
      // - GM is the sender, so this passes without needing Marv's credentials.
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/campaign_invitations?id=eq.${invitationId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { status: 'accepted' } },
      )

      // Step 4: poll campaign_members until Marv appears.
      // handle_campaign_invitation_response() (SECURITY DEFINER) inserts the row
      // as soon as the UPDATE trigger fires (no race - it's synchronous in the txn).
      // campaign_members SELECT: USING (auth.role() = 'authenticated') - any auth user reads.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${MARV_USER_ID}&select=id`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string }>
        return rows.length
      }, {
        timeout: 10_000,
        message: 'handle_campaign_invitation_response() trigger did not add Marv to campaign_members after acceptance',
      }).toBe(1)
    } finally {
      if (campaignId && gmCreds) {
        // CASCADE DELETE kills campaign_invitations and campaign_members.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
