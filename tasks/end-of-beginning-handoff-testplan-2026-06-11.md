# End-of-Beginning Handoff - Test Plan 2026-06-11

Six items shipped in this session. Test in the live environment at
`thetapestry.distemperverse.com`.

---

## Item 1: F1-WIRE - anon redirect to /publiclanding

**What changed:** `app/page.tsx` is now an async server component that
calls `supabase.auth.getUser()` and redirects unauthenticated visitors
to `/publiclanding`.

**Test:**
1. Open an incognito/private browser window.
2. Navigate to `thetapestry.distemperverse.com`.
3. EXPECT: immediate redirect to `/publiclanding` (the marketing pitch).
4. Do NOT sign in. Confirm the URL is `/publiclanding` and the pitch
   content is visible.
5. Sign in via the login flow. Navigate back to `/`.
6. EXPECT: dashboard (world map) renders - no redirect.
7. REGRESSION: all other logged-out pages (`/login`, `/signup`, `/press`,
   `/publiclanding`) still load directly - no spurious redirects.

---

## Item 2: Phase 3 grapple action-loss carryover

**What changed:** `initiative_order.pending_action_loss boolean DEFAULT false`
column added. When a grapple succeeds and the defender has 0 actions
remaining, the debt carries to their next turn (1 action instead of 2).

**Test (requires two-client session, combat active):**
1. Start a combat session with at least 2 combatants (A and B).
2. Let Combatant B act until they have 0 actions remaining.
3. On Combatant A's turn, open Grapple vs Combatant B and win.
4. EXPECT: No immediate action consumption on B (they have 0).
   Feed should NOT show "B - Action" log.
5. Advance turns until Combatant B's next turn activates.
6. EXPECT: B starts their turn with 1 action (not 2).
7. After B uses that 1 action, their turn ends normally.

**Baseline case (actions available):**
1. Combatant B has 2 actions remaining.
2. Combatant A wins a grapple.
3. EXPECT: B immediately loses 1 action (now has 1 remaining). This is
   the existing behavior - should be unchanged.

---

## Item 3+4: F4/F5 - First-action pull (new logged-in user)

**What changed:** Dashboard now detects 0 GM-owned campaigns and shows
a "Your Story Starts Here" panel with Create CTA + 3 free module tiles.

**Test - new user path:**
1. Create a fresh test account (or use an account with no campaigns).
2. Sign in and navigate to `/`.
3. EXPECT: "Your Story Starts Here" panel - NOT the world map.
4. Panel should show:
   - "Create Your First Story" button linking to `/stories/new`
   - Three module tiles: Empty (Tutorial), The Basement (Free), The Arena (Free)
   - Each tile links to `/stories/new`
5. Click "Create Your First Story" - EXPECT: `/stories/new` loads.
6. REGRESSION: Create one campaign via `/stories/new`. Return to `/`.
   EXPECT: world map shows (not the first-action panel).

**Test - WelcomeModal + first-action panel co-exist:**
1. Use an account with `onboarded = false` and no campaigns.
2. Visit `/`.
3. EXPECT: "Your Story Starts Here" base + WelcomeModal overlay on top.
4. Dismiss WelcomeModal.
5. EXPECT: first-action panel remains visible underneath.

---

## Item 5: F6 - Single-source onboarding copy

**What changed:** WelcomeModal and /firsttimers now render from
`lib/onboarding-sections.ts`. /firsttimers copy was also cleaned up
(em-dashes removed, typos fixed, "Coming soon" removed from the Table
section).

**Test:**
1. Open an account with `onboarded = false` and trigger the WelcomeModal.
2. Verify the 4 sections render: Create Your Survivor, The World Map,
   The Campfire, Play at The Table.
3. Verify "Play at The Table" does NOT say "Coming soon."
4. Navigate to `/firsttimers`.
5. Verify the same 4 sections render with the same content.
6. Verify no em-dashes (no `--` or `-` used as em-dashes) in the copy.
7. Verify "desperate" is spelled correctly (not "desparate").

---

## Item 6: Combat-flow testids (already shipped as abbdfac)

Already verified in a prior session. No test needed here.

---

## Regression sweep

After all items pass:
1. Run a full combat session (initiative, attacks, grapple, advance turns).
2. Verify the world map loads normally for a logged-in user with campaigns.
3. Verify `/publiclanding` is reachable without a session.
4. Verify `/login` and `/signup` work normally for unauthenticated users.
