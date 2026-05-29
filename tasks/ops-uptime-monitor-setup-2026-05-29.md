# External Uptime Monitor + Alerting - Setup Playbook (2026-05-29)

**NORTH STAR:** [tasks/north-star.md](north-star.md). Goal = TheTapestry stable, polished, fun
for the 9/1 Kickstarter (Beta-500 proves it 7/1). A mid-demo outage during a live KS, or a
silent prod-down during the beta, is catastrophic to that goal. This closes the "would we
know if it broke?" floor so a PAGER, not a player, tells us prod is down.

**Closes:** the open observability item in three plans of record:
- `tasks/beta-500-readiness-2026-06-01.md` L31 (#8 observability)
- `tasks/kickstarter-readiness-2026-09-01.md` L21 (beta-safety floor)
- `tasks/road-to-1.0.md` L26 (operational floor)
- `tasks/todo.md` CURRENT OPEN -> BETA-500 -> "[PF/OP] observability"

**Status:** PREPPED, awaiting Xero's account-creation step (the one part Claude cannot do -
third-party dashboard / account). Everything else is decided below.

---

## 1. What we are monitoring and why

The app already exposes a health endpoint built for exactly this (pre-launch audit R5):
`app/api/health/route.ts`.

Live behavior, verified 2026-05-29:

```
GET https://thetapestry.distemperverse.com/api/health
-> HTTP 200  {"status":"ok","checks":{"db":"ok"},"ms":535,"ts":"..."}
```

- **200 + `status:"ok"`** = app is up AND the Supabase DB is reachable (it does a real
  indexed count against `profiles` with the anon key on every hit).
- **503 + `status:"degraded"`** = app is up but the DB ping failed, OR the Supabase env
  vars are missing. This is the soft-failure case.
- **No response / 5xx / DNS fail** = hard down (Vercel-side or domain).

**Monitor rule (important):** check for HTTP status 200 **AND** the response body contains
the keyword `"status":"ok"`. That single rule catches BOTH failure modes - a hard non-200
AND the soft 503-degraded path - because a 503 fails the 200 check and a degraded body
fails the keyword check.

---

## 2. Tool decision: Better Stack (Better Uptime), free tier

**Recommended: Better Stack.** Rationale, and why the obvious alternative is disqualified:

| | Better Stack free | UptimeRobot free |
|---|---|---|
| Commercial use allowed | Yes (no restriction) | **NO - since Oct 2024 the free plan is personal / non-commercial ONLY; ToS forbids revenue-generating use.** TheTapestry is a commercial product heading to a Kickstarter, so this plan is OFF-LIMITS for us. |
| Monitors | 10 | 50 |
| Check interval | down to 30s | 5 min only |
| Keyword/HTTP-body check | Yes | Yes |
| Free alert channels | Email + Slack | Email + mobile push |
| Status page | 1 included | included |

The UptimeRobot non-commercial ToS clause is the decider - it would put a commercial product
in violation. Better Stack's free tier has no such restriction, gives faster checks (30s vs
5 min, which matters for a live demo), and email + Slack alerting.

**The free "pager":** Better Stack's free tier does not include SMS/phone, but it DOES
include Slack. The Slack mobile app push on your phone IS a pager and is free. So the alert
chain is: monitor fires -> email + Slack message -> Slack mobile push buzzes your phone.
(This also dovetails with the planned Sentry-Slack routing in the incident runbook L38.)

Verified against vendor pricing pages on 2026-05-29; confirm exact limits at signup since
free tiers shift.

---

## 3. Xero's steps (the part only you can do - click-by-click)

This is the third-party-account exception: Claude cannot create an account or click a
vendor dashboard. Do these, then tell me "monitor is live" and I finish the wiring (Section 4).

### A. Create the account
1. Open `https://betterstack.com/uptime` in a browser.
2. Click **Sign up** (top right). Use `xerosumgames@gmail.com`. Free plan, no card needed.
3. Confirm the email Better Stack sends, then log in. You land on the Uptime dashboard.

### B. Create the monitor
4. Click **Create monitor** (or **Monitors -> Create monitor**).
5. Fill in:
   - **URL to monitor:** `https://thetapestry.distemperverse.com/api/health`
   - **Monitor type / "Trigger when":** keep the default HTTP check. Set it to alert when
     the monitor is **"unavailable"** AND, if there is a "Required keyword" / "Response body
     should contain" field, enter exactly: `"status":"ok"` (with the quotes).
   - **Check frequency:** 30 seconds (or 1 minute - either is fine).
   - **Request timeout:** 10 seconds (the live endpoint answers in ~1.6s, so 10s is safe headroom).
   - **Regions / locations:** leave default (multiple regions confirm it is not a single-PoP blip).
   - **Confirmation / "wait before alerting":** if there is a "verify from N locations" or
     "alert after X failures" setting, require **2 consecutive failures** (~1 minute) before
     alerting. This kills false pages from a single transient hiccup while still meeting the
     runbook's ">2 minutes non-200 = incident" bar.
   - **Name it:** `Tapestry prod /api/health`.
6. Save the monitor. Within a minute it should show a green / "Up" status.

### C. Wire the alert to your phone (the free pager)
7. **Email is on by default** to your account email - good as the baseline channel.
8. **Add Slack push (the pager):**
   - If you have a Slack workspace: in Better Stack go **Integrations -> Slack -> Connect**,
     authorize, pick a channel (e.g. `#alerts` or even your own DM channel).
   - If you do NOT have Slack: create a free workspace at `https://slack.com/get-started`
     (2 min), install the **Slack mobile app** on your phone, enable notifications for it,
     then connect it to Better Stack as above.
   - In the monitor's escalation / "On-call" settings, make sure both Email and Slack are
     selected as notification targets.
9. **(Optional, recommended later) Status page:** Better Stack -> Status pages -> create one
   for `Tapestry`, add this monitor. Gives you a public "are we up?" link for backers.

### D. Prove it actually pages you (do not skip)
10. Easiest non-destructive test: in Better Stack, open the monitor -> **... menu -> Send
    test notification** (or "Test alert"). Confirm the email arrives AND the Slack mobile
    push buzzes your phone. If the push does not arrive, fix Slack notification permissions
    on the phone before trusting it.
11. (Optional, stronger) Point the monitor URL at a deliberately-bad path for 2 minutes
    (e.g. `/api/health-NOPE`), confirm it goes red and pages, then set it back. Only do this
    if the test-notification in step 10 felt insufficient.

That's it. Reply "monitor is live" (and tell me whether you used Slack or email-only) and I
close out the wiring.

---

## 4. Claude's steps after Xero confirms (Puffer lane, no app code)

Once Xero says the monitor is live, I will:
1. Flip `tasks/ops-incident-response-2026-05-20.md` Section 2 L38 from "Daily monitoring:
   none enforced yet" to name the Better Stack monitor + the alert chain, and add a row to
   the Section 2 pre-incident table (monitor dashboard URL).
2. Check the observability boxes in the three plans (beta-500 L31, KS L21, road-to-1.0 L26)
   and the `tasks/todo.md` line - splitting the "confirm Sentry alerts route to a human"
   half into its own remaining sub-item (see Section 5).
3. Note in the Risk Register (debug-handoff.md Sec 1) that the "no external monitoring"
   observability gap is now closed.

---

## 5. The OTHER half of this item: Sentry alert routing

The todo item is two things: (a) external uptime monitor [this doc], and (b) "confirm Sentry
alerts actually route to a human." Sentry catches application ERRORS; the uptime monitor
catches OUTAGES - different signals, both needed.

Sentry is wired (`xero-sum-games.sentry.io` -> `thetapestry`), but per incident-runbook L38
the alert click-through is pending. Separate ~5-min Xero task, same login pattern:
- Sentry -> the `thetapestry` project -> **Alerts -> Create Alert Rule**.
- A sane starter rule: "when a NEW issue is first seen" OR "an issue is seen more than 10
  times in 1 minute" -> notify your email (and the same Slack workspace if you connect the
  Sentry-Slack integration).
- Send yourself a test alert to confirm it routes.

I have left this as a tracked sub-item rather than folding it in, so closing the uptime
monitor does not falsely mark the whole observability item done.

---

## 6. Why this is the right next step toward the north star

- It is the single highest-leverage piece of the beta-safety floor: cheap (free), fast
  (~15 min of Xero's time), and it directly removes the "a player tells us prod is down"
  failure mode that is catastrophic during a live KS demo.
- It is unblocked (the endpoint already exists and is verified working) and needs nothing
  from Hunt & Peck or Playwright.
- It is proportionate: no money, no PCI, no new app code, no live SQL - exactly the kind of
  operational hardening the beta-500 / KS-readiness plans call a true floor item.
