# Pre-Beta-500 Infra Upgrade Checklist

Why this exists: Beta-500 puts ~500 real users on a stack that is currently on
FREE tiers across the board. Free tiers have hard caps AND (for Vercel) prohibit
commercial use. The recurring Vercel deploy stalls (2026-06-29/30) are the first
symptom. Xero confirmed 2026-06-29: "I'll upgrade everything before going live."

These are all THIRD-PARTY DASHBOARD actions (Xero's hands - the AI can't reach
billing/account settings). They cost real money, so they are Xero's calls; this
doc is the plan, not an authorization to spend. Prices below are approximate -
verify current pricing on each dashboard before committing.

Do them roughly in priority order. #1 is actively breaking things now.

---

## 1. Vercel -> Pro  [PRIORITY: NOW]
- **Current:** free team `xerosumgames-projects`. Already hit 75% of the free
  Fluid Active CPU (4h) allowance on 2026-06-21 with alpha traffic.
- **Why:** (a) free-tier throttling is the likely cause of the recurring
  main->production deploy stalls; (b) Vercel's free/Hobby tier **prohibits
  commercial use** - a paid product (KS) on Hobby is a TOS violation; (c) 500
  users will blow past the CPU/bandwidth/function caps immediately.
- **Action:** Vercel -> the `xerosumgames-projects` team -> **Settings -> Billing
  -> Upgrade to Pro**. ~$20/member/mo + usage. Covers both thetapestry AND
  thetableau (same team).
- **Bonus:** while there, fix today's stall - thetapestry project -> **Settings
  -> Git -> disconnect + reconnect** the repo (re-installs the dead webhook), or
  manual Redeploy of latest `main`.

## 2. Supabase -> Pro  [PRIORITY: before Beta-500]
- **Current:** almost certainly free tier (DB + auth + realtime + storage).
- **Why:** free tier caps that 500 users will hit: ~500MB DB, limited egress,
  ~200 concurrent + ~500 total realtime connections, 50K monthly active users,
  and **the project auto-pauses after 7 days idle** (a launch-day killer). The
  realtime concurrency cap matters most for the live table (every open table =
  connections).
- **Action:** Supabase dashboard -> the thetapestry project -> **Settings ->
  Billing -> upgrade to Pro** (~$25/mo + usage). Then re-check the realtime
  concurrent-connection limit against expected peak (500 users, multiple tables).
- **Verify after:** daily-active-user cap, DB size headroom, egress.

## 3. Upstash (Redis / rate limiting)  [PRIORITY: before Beta-500]
- **Current:** free tier (`@upstash/ratelimit` + `@upstash/redis`).
- **Why:** free tier caps daily commands (historically ~10K/day). Rate-limiting
  runs on hot paths (auth, posts, uploads) - 500 users can exhaust the daily
  command budget, and when Redis errors, rate-limit checks fail (open or closed
  depending on our fallback - worth confirming which).
- **Action:** Upstash dashboard -> upgrade to pay-as-you-go / fixed tier. Cheap
  (usage-based). Confirm the rate-limit fallback behavior when Redis is
  unavailable (fail-open vs fail-closed) so a cap breach doesn't lock users out.

## 4. Sentry  [PRIORITY: before/around Beta-500]
- **Current:** free Developer tier (`xero-sum-games` org / `thetapestry` project).
- **Why:** free tier ~5K errors/mo + 1 user. A buggy beta can blow the error
  quota fast, and once over, you are BLIND to new errors exactly when you most
  need visibility. Also limits teammates.
- **Action:** Sentry -> upgrade to Team (~$26/mo) OR at minimum set generous
  inbound-filter/sampling so the quota isn't burned by noise. Decide before
  Beta-500 so launch-week errors are actually captured.

## 5. Better Stack (uptime monitor)  [PRIORITY: low / verify]
- **Current:** free tier, one monitor on `/api/health` (set up by Puffer).
- **Why:** free tier is usually fine for a single monitor, but check the check
  interval (free can be 3min vs 30s) and alerting channels you need for launch.
- **Action:** verify the free tier covers the interval + pager you want; upgrade
  only if you need faster checks / more monitors / phone alerts.

## 6. Cloudflare Turnstile  [no action]
- Free for the bot-check use; no paid tier needed at this scale.

## 7. Stripe  [DEFER - post-KS]
- Not wired yet. Billing is the ~10/1 post-KS fast-follow, OFF the pre-KS path.
  No action before Beta-500/KS. (Stripe itself is pay-per-transaction, no
  upfront tier.)

---

## Suggested order
1. **Vercel Pro now** (unblocks deploys + TOS compliance) + reconnect the
   thetapestry Git webhook.
2. **Supabase Pro** + **Upstash** before Beta-500 opens (the two that 500
   concurrent users hit hardest).
3. **Sentry** before Beta-500 so launch-week errors are captured.
4. Better Stack: verify, upgrade only if needed.
5. Stripe: post-KS.

After upgrading, re-run a quick smoke (create a campaign, open a table with 2
clients) to confirm nothing was tier-gated, and note the new monthly burn so the
KS budget reflects real infra cost.
