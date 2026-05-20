# Sentry Pipeline Verification - 2026-05-17

> Manual verification that today's Sentry hardening (commit `1894455`) actually works end-to-end. Tests pass + tsc clean only prove code shape. This proves the pipeline.

**Time required:** ~5 min for client check, ~5 min for server check, ~5 min to inspect Sentry dashboard. ~15 min total.

---

## What we're verifying

1. Errors reach Sentry from both client and server.
2. The event has `user.id` attached (set in `lib/auth-cache.ts:syncSentryUser`).
3. The event does NOT contain `email`, `username`, raw cookies, raw `Authorization` headers, or `?code=` / `?token=` URL params.
4. Sample rate is honored (only ~10% of trace events should appear, all exceptions).
5. The route-transition capture and the realtime handler wrap (commit `313aa94`) both surface as expected.

---

## Step 1 - Trigger a client-side exception

Open the live site (`thetapestry.distemperverse.com`) in a logged-in browser tab. Open DevTools Console. Paste:

```js
throw new Error('sentry verification probe 2026-05-17 client')
```

The error appears in Console immediately. Sentry SDK's `window.onerror` handler captures it within a few seconds. Note the rough timestamp.

## Step 2 - Trigger a server-side exception via /api/health degradation

Easiest route: temporarily kill the env. Hard. Better: just trip a thrown error inside a server-rendered page request. Cheapest cheat - point the browser at a guaranteed-404 API route:

```
GET /api/route-that-does-not-exist-2026-05-17
```

Next.js will throw a 404 NotFoundError server-side. Sentry's instrumentation hook (`instrumentation.ts:captureRequestError`) captures it.

Alternative if that doesn't surface: temporarily edit `app/api/health/route.ts` to `throw new Error('sentry verification probe 2026-05-17 server')`, push, hit, revert. More invasive but guaranteed.

## Step 3 - Inspect the Sentry dashboard

Open https://xero-sum-games.sentry.io/projects/thetapestry/. Filter to events from the last 15 minutes.

**Expect to see both events** (client + server). Click into each:

### A. User context attached
Look for the **User** card on the issue detail page. It should show:
- `ID: <some-uuid>` (your auth.users id)

It should NOT show:
- `Email: ...`
- `Username: ...`
- `IP Address: ...` (unless Vercel's geo headers leaked it via middleware - flag if so)

### B. Request data scrubbed
Look for the **Request** section. The URL should not contain `?code=` / `?token=` / `?access_token=` / `?refresh_token=` (values replaced with `[Filtered]`). The Headers should NOT contain a readable `Authorization` or `Cookie` value (both should be `[Filtered]`).

### C. Sample rate
On the project's Performance tab, the trace count should be roughly 10% of expected page views over the last hour. Hard to verify with low traffic - note for later.

---

## Step 4 - Realtime handler wrap surfaces

Open a live session. Have a parallel tab with the same campaign open as a different role. Trigger a broadcast that has a handler the wrap covers (e.g., `npc_damaged`, `pc_damaged`, `combat_started`).

In the receiving client's DevTools Console, paste this to deliberately break a future handler (forces a thrown exception inside the wrap):

```js
// Optional - only if you want to exercise the wrap. Skip if you'd rather
// not poke around. The wrap will catch + report to Sentry without crashing
// the session.
window.__sentryProbe = () => { throw new Error('sentry verification probe 2026-05-17 broadcast') }
window.__sentryProbe()
```

Then check Sentry for an issue tagged `realtime_kind=broadcast` or `realtime_event=...`. The wrap should surface tagged exceptions.

---

## Pass criteria

- Both client + server events arrive in Sentry within 1 min of triggering.
- Both show a User ID.
- Neither shows an email, username, raw cookie, or auth-bearing URL param.

If any criterion fails: open this file's commit (`1894455`) and revisit. Most likely culprit if user id missing: `getCachedAuth` was never called on the failing path.

## After verification

Tick the R4 box in [tasks/todo.md](todo.md) when the Slack webhook is also wired (Sentry dashboard -> Settings -> Integrations -> Slack -> wire to #alerts).

Delete this file once verification is complete OR keep as a recurring smoke-test runbook - your call.
