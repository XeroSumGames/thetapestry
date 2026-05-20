# Sentry -> Slack Alert Wiring

Closes Pre-Launch Audit item **R4**. The click-through procedure to route Sentry alerts to a Slack channel. ~15 minutes of dashboard work; can't be done from Claude's side because it needs Xero's Sentry + Slack workspace logins.

Pairs with the Sentry config that landed 2026-05-17 (`1894455` PII scrub + sample rate; `R5` health endpoint; `R6` realtime handler wrap).

---

## Why we want this

Today: errors land in Sentry. Xero has to remember to open the Sentry dashboard to see them. The first signal that something's wrong in production is often a player saying "X is broken" - i.e. zero observability lead time.

With Slack wired: new error class -> notification within seconds. Lead time goes from "next time a player tells you" to "you find out before the next player hits it."

---

## Recommended path: Sentry's built-in Slack integration

Sentry has a first-party Slack integration (OAuth-based, configured in Sentry's UI). It's the simplest setup and gives you per-project alert rules.

### Step-by-step (~15 min)

1. **Sentry side**
   - Open https://sentry.io -> select org `xero-sum-games`.
   - Settings -> Integrations -> Slack.
   - Click "Add Workspace" -> OAuth into the Slack workspace where you want alerts.
   - Authorize the integration. (Slack admin permission may be needed; if you're the only Slack admin, you already have it.)

2. **Slack side (auto)**
   - The Sentry OAuth flow asks which Slack channel(s) the integration can post to. Pick one (suggested: `#alerts` if it exists, else create it now).

3. **Sentry: create the alert rule**
   - Sentry -> Projects -> `thetapestry` -> Alerts -> Create Alert Rule.
   - Choose "Issues" alert type.
   - Conditions:
     - **A new issue is created** (highest-value default - catches every first-occurrence error).
     - OPTIONAL: "An issue is seen more than 10 times in 1 hour" - catches error spikes.
   - Actions:
     - Send a notification to Slack -> pick the workspace + channel.
   - Save the rule.

4. **Test it**
   - Trigger a test error from the app. The fastest way: open the Sentry dashboard for the project, click "Send Test Event" (in the project's setup wizard area).
   - Within ~30 seconds, the Slack channel should get a Sentry message with the error details + a link back to the issue.
   - If nothing shows up: open the alert rule's "Activity" tab in Sentry; it logs whether the alert tried to fire and what response Slack gave.

---

## Alternative path: Slack Incoming Webhook + Sentry Webhook action

Use this only if the built-in Slack integration is blocked (e.g. workspace policy doesn't allow third-party OAuth apps). More config, less polish.

1. **Slack:** Apps -> Manage -> Custom Integrations -> Incoming Webhooks -> Add to Channel. Copy the webhook URL.
2. **Sentry:** Settings -> Integrations -> Webhooks -> Add. Paste the Slack webhook URL.
3. **Sentry:** Create the alert rule as above, but Action = "Send a notification via webhook" + select the webhook you just added.
4. Slack message formatting will be raw JSON unless you wrap the webhook with a transformer. Built-in path is significantly better; pursue this only as fallback.

---

## What to alert on (recommended starting config)

Start narrow, widen if it's quiet. Too noisy and you'll mute the channel.

| Alert | Why | Action |
|---|---|---|
| **New issue first-seen** | Catches every novel error class on first occurrence | Slack ping |
| **Issue spike (10+ events/hour)** | Catches "one error class is exploding" | Slack ping |
| **Issue marked unresolved after fix-release** | Catches regressions after a deploy | Slack ping, separate channel if available |
| **Issue assigned to me** | Personal todo signal | DM (not channel) |

Things NOT to alert on initially:
- "Issue resolved" / "Issue assigned to someone else" - noise.
- "Issue first seen on N events" with N > 1 - the new-issue rule already covers this.
- Transaction performance alerts - we have tracesSampleRate at 0.1, the data is sparse, alerts would be flaky.

---

## After it's wired

1. Add a row to the operating-mode "Standing behaviors" or a new "Observability" section noting that Sentry -> Slack is live + which channel.
2. Update `tasks/operating-mode.md` "Periodic reviews" section if you want a weekly "Sentry triage" recurring task (open the channel, sweep new issues, mark fixed-or-suppressed).
3. Close R4 in todo.md by changing the entry from `[ ] R4 Slack webhook` to `[x] ~~R4~~ - SHIPPED <date> via the runbook at tasks/ops-sentry-slack-setup-2026-05-20.md.`

---

## Troubleshooting

- **No Slack message after a real production error.** Open Sentry -> Alerts -> the rule -> Activity tab. Look for the "tried to send, got response..." entry. Common cause: Slack channel was archived or the integration's OAuth scope was revoked.
- **Slack channel is flooded.** Lower the noise: add an alert filter (e.g. exclude issues tagged `environment:development`), OR raise the threshold for "issue spike" from 10/hr to 50/hr.
- **No notification for a NEW error.** First check: is the error actually reaching Sentry? Open the project's Issues tab in Sentry; if the error isn't there, the issue is on the SDK side, not the alert side. Beware: `beforeSend` scrubs some errors (per the 1894455 PII scrub commit) - a too-aggressive filter could be eating the alert payload before it leaves the SDK.

---

## What's NOT in this scope

- **PagerDuty / SMS escalation.** Slack-only is fine for a solo dev + 50k-trajectory product. PagerDuty wiring is a separate exercise IF/WHEN you need wake-up-at-3am alerting.
- **Per-error-class routing.** All issues -> one channel. Slack thread filtering is good enough until you're managing more than ~10 distinct error classes in flight.
- **Alert silencing during deploys.** Sentry can suppress new issues that match a release - configure this only if deploys start drowning the channel.

---

## Maintenance notes

Update this doc when:
- The integration breaks and the troubleshooting steps grow.
- A new alert rule earns its place (catalog it under "What to alert on").
- Slack workspace / channel changes - update the wiring.

Last review: 2026-05-20 (runbook drafted; click-through pending Xero).
