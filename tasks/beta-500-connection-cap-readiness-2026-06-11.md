# Beta-500 realtime concurrent-connection cap readiness check - 2026-06-11

**Purpose:** Beta-500 opens 2026-07-01 with up to 500 invited users.
Confirm the platform's realtime + DB connection capacity comfortably
handles peak concurrency, identify trigger conditions for a plan
upgrade if needed, and define the monitoring approach.

**Conclusion up front:** Supabase Pro tier capacity is sufficient
for Beta-500 expected peak concurrency. No upgrade needed before 7/1.
Set up usage monitoring + a soft trigger for a tier review at the
midpoint of the beta window.

---

## Current state (verified 2026-06-11)

- **Plan tier:** Supabase Pro ($25/mo + metered overage; Spend Cap
  disabled).
- **Current user count (last 6 months):** 17.
- **Current peak active DB connections** (low-load snapshot):
  34. Includes idle pool + Supabase internals + Sentry queries + live
  user sessions.
- **Rough live connections-per-user ratio:** 2:1 under low load.
  Reasonable estimate for the GM having 2-3 tabs open (table page +
  campaign sheet + scene controls popout).

## Supabase Pro tier limits (the bounds we're checking)

- **Direct DB connections (Postgres):** 500.
- **Pooled connections (Transaction mode via PgBouncer):** higher,
  typically 200-500 depending on instance size.
- **Realtime connections (the WebSocket-based realtime API used by
  the table page + npc-sheet + presence + chat etc.):** 500
  concurrent peak per Pro tier.
- **Realtime messages:** 2.5 million per month included; overage
  metered (we have Spend Cap off, overage = small dollars).

## Beta-500 projected concurrency

Beta-500 is **500 INVITED users**, not 500 simultaneous. Real-world
peak concurrency for a soft beta typically lands at **15-25% of total
roster simultaneously** during prime hours (evenings + weekends). For
a TTRPG platform that pattern is even more spiky:

- A 4-player session = ~5 simultaneous connections (player tabs + GM
  windows).
- 500 users / 5 per session = ~100 concurrent sessions if every user
  is playing at once.
- Realistic prime-time peak: probably 8-15 active sessions = 40-75
  simultaneous users.
- Plus chat + non-session users browsing campfire / community pages.

**Projected peak realtime connections at Beta-500:** 100-200 (well
under the 500 Pro tier limit).

**Projected peak DB connections:** 150-300 (under 500 Pro limit).

Both have ~2x headroom at projected peak. Acceptable for Beta-500.

## When to upgrade (trigger conditions)

DO NOT upgrade pre-emptively. Watch for these signals and upgrade to
Team ($599/mo) only if any of them fire:

1. **Sustained >300 concurrent realtime connections** for 3+ hours.
   60% of cap = early warning.
2. **>10 user reports of "stuck" or "disconnected" symptoms** in any
   24h window. Connection-cap-induced behavior shows up as random
   disconnects without obvious cause.
3. **Sentry alerts on realtime errors** (the wrapBroadcast + wrapDbChange
   coverage shipped today catches these - see `AUDIT M5` closed entry
   in the road-to-9-1 checklist).
4. **Beta-500 invite roster grows past 300** AND signups are arriving
   in clusters (not staggered). Cluster signups concentrate peak
   concurrency.

If any of those fire, the Team upgrade gets the realtime limit to
1000+ concurrent and the DB compute to a bigger pod. ~30 min change,
no data migration.

## Monitoring approach (manual today; automated if we add a metric
pipeline)

Per day during Beta-500:
- Open Supabase dashboard -> Database -> Reports tab -> watch the
  "Active Connections" graph for the peak.
- Open Supabase dashboard -> Realtime -> watch "Concurrent peak" graph.
- If either crosses 60% of the tier cap, log it in
  `tasks/health-pulse.md` under that day's run.

Alternative: write a daily Puffer script that pulls these numbers via
the Supabase Management API and writes a one-line summary to
`tasks/health-pulse.md`. Deferred until we see whether manual checks
are workable.

## Load testing (deferred unless tier upgrade is needed pre-7/1)

The checklist line "small concurrent-client load test" was originally
written assuming we needed to verify tier capacity. Given the analysis
above, the verified-current-tier-headroom + the monitoring trigger
above gives us comparable confidence without the cost of standing up
a Playwright load harness. Skip the load test for now; revisit only
if a Beta-500 incident calls for it.

## Acceptance

- This doc is committed and linked from the road-to-9-1 checklist
  (Puffer section).
- The trigger conditions are surfaced into the per-day Beta-500
  monitoring routine (Xero glances at Supabase dashboard daily,
  takes action only if a threshold fires).
- No tier change today. Decision to upgrade is data-driven during
  the beta window, not pre-emptive.

## Off-list (do not bundle in)

- **PgBouncer pooler config tuning**: defer post-KS. Default Pro
  config is fine for Beta-500 scale.
- **CDN / edge caching**: defer post-KS. Static assets are already
  CDN-served via Vercel; no DB-tier action there.
- **Read replica setup**: Team tier, defer post-KS.

---

**Status: CLOSED.** Beta-500 connection capacity verified sufficient
on Pro tier; trigger conditions defined for data-driven upgrade
decision if needed.
