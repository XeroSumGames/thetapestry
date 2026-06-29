# Stability / Readiness Audit - 2026-06-29 (Beta-500 ~2 days out, "bring in strangers" lens)

**Trigger:** PF lane idle after closing the realtime 2-client verify + T2-6 indexes; Beta-500
~2 days out (2026-07-01). First audit since 2026-06-23, which surfaced a HIGH cluster; that
cluster was largely burned down in the 06-23 security/scale hardening pass + this session.
**Method:** live gates (all GREEN) + live RLS broad-read scan (every table's SELECT policies)
+ realtime data-layer re-verify (this session) + read of 06-23 audit / security-audit /
health-pulse / punch list. **No code edited in this pass.**
**Headline:** **0 BLOCKER.** The 06-23 HIGH cluster is mostly CLOSED and verified on live. One
gating HIGH remains - the email + invite_code PII exposure - and it is fully staged, blocked
only on HP's reader-rewire. The rest is known/queued or low-risk ops hardening.

---

## Live gates - ALL GREEN
tsc 0 · role-literals OK · font-sizes OK · arch ratchet at baseline · publication drift OK
(21 tables) · db-emdashes OK · 892 unit tests / 49 files green · CI last 5 all-pass.

---

## BLOCKER
None.

---

## HIGH - gates "bring in strangers"; must close before Beta-500 opens

### H-1 (carry, STAGED + blocked on HP) - email + invite_code still column-readable by strangers
Confirmed LIVE this audit via `pg_policies`:
- **`profiles`** has TWO broad SELECT policies still live - "Profiles are viewable by
  authenticated users" (`auth.uid() IS NOT NULL`) and "Public profiles are viewable by
  authenticated users" (`auth.role()='authenticated'`). They OR-combine over the scoped
  "Campaign members read each other's profiles" policy, so **any logged-in user can read every
  profile row, including `email`** = mass email harvest the moment accounts are untrusted.
- **`campaigns`** has "Anyone can view campaigns" `USING(true)` - **anon-readable**, including
  `invite_code` = a stranger can enumerate invite codes and join any campaign uninvited.

**Status:** the fix is STAGED, not missing. RPC seams are live (`get_profile_email`,
`get_campaign_invite_code`, `find_campaign_by_invite_code`, `is_campaign_member`). The
column-revoke is committed at `sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql`
and a column-level `REVOKE SELECT` closes the hole even under the broad row policies (column
grants AND with RLS). It applies ONLY after HP rewires the 3 email + 6 invite_code readers
(`tasks/handoff-hp-pii-revokes-2026-06-23.md`); applying before the rewire breaks those
readers. **Action: PF applies the revoke + re-verifies by rolled-back JWT impersonation the
moment HP signals the rewire done. This is the one true Beta-500 security gate left.**

---

## MEDIUM

- **M-1 (PF/ops, 5 audits deferred) - `/api/health` DB-amplification DoS.** `app/api/health/route.ts`
  is unauthenticated, no rate limit, runs `SELECT COUNT` on `profiles` every call. Deferred 5
  consecutive security audits. At Beta-500 / paid scale a trivial amplification vector. Fix:
  in-memory 30s-TTL cache of the count, or Upstash sliding-window 10/min per IP. Small, isolated,
  reversible - the best candidate for the next PF action once H-1 unblocks.
- **M-2 (PF/ops) - `supabase/functions/log-visit` no body-size cap.** Deployed `--no-verify-jwt`
  (intentional, Ghost visitors), fields are `clip()`-ed, but no `content-length` guard. A flood of
  oversized POSTs costs function invocations + `visitor_logs` writes. Fix: reject `content-length`
  > ~2 KB up front.
- **M-3 (HP, routed) - 3s vehicles poll redundant load.** `page.tsx:3090` `setInterval(refetchVehicles,
  3000)` re-reads `campaigns.vehicles` every 3s per client forever (~167 req/s at Beta-500), but the
  `campaigns:UPDATE` sub already applies vehicles from the realtime payload + `vehicle_updated`
  broadcast already drives an event refetch. Remove the interval. Detail:
  `tasks/finding-vehicles-poll-scale-2026-06-29.md`.
- **M-4 (HP, queued) - full-refetch realtime handlers** (T2-4): `character_states`->loadEntries,
  `chat_messages` refetch-100, `roll_log` refetch-50. Campaign-scoped so correct, just wasteful under
  combat velocity. Real win, real merge risk - careful pass, not a tail-of-launch rush.

---

## LOW
- **L-1** `module_subscriptions` SELECT `auth.uid() IS NOT NULL` - any logged-in user reads the whole
  marketplace subscription graph (who-subscribes-to-what). Low sensitivity; scope to owner +
  module author if tightened.
- **L-2** `whispers` SELECT `USING(true)` is **by design** - the world-map ambient-message feature
  (MapView "whispers" tab; `lib/data/map.ts`; E2E `section-e-whispers`). Public is intended. Only
  nuance: `true` is anon-readable (no auth gate) where the feature is shown to logged-in users -
  cosmetic over-exposure of already-public ambient content. Optional: gate on `auth.uid() IS NOT NULL`.
- **L-3** npm moderate carry-overs (`postcss`/`next`/`@sentry/nextjs` chain) - all need breaking major
  bumps; build-time CSS only, no runtime user-CSS path. Hold per security-audit.
- **L-4** `campaign-clock` drainer N+1 (T2-5, HP) - party-sized loops, once per GM time-advance, not a
  concurrency hot path. Low priority by reassessment.
- **L-5** LOS-through-open-windows: 06-23 re-classified the old HIGH as operational-not-architectural;
  E2E already ships `wall-segment-door-cross-client`. Instrument the `TacticalMap` line-759 handler at
  a live table to confirm delivery before any fix; do not ship an architecture fix for sound
  architecture.

---

## What's solid (verified this audit - do not re-flag)
- **The 06-23 broad-read security cluster is CLOSED on live.** A full `pg_policies` SELECT scan for
  broad quals (`true` / `authenticated` / `uid IS NOT NULL`) returns NONE of `characters`,
  `character_states`, `roll_log`, `campaign_members` - their old broad policies were really dropped
  (H-SEC-1/2/3 + M-SEC-1 from 06-23 = done). Remaining broad matches are all either intentional public
  content (LFG approved posts, published community events, setting seeds, portrait counters, whispers)
  or the staged H-1 pair.
- **Storage buckets locked** (5 buckets + portrait_bank, 06-23). **Realtime campaign-scoping verified
  GM->player on live this session** (scene_tokens/tactical_scenes/campaign_npcs deliver, no sub killed;
  M-RT-1 grid/lock-to-player confirmed). **Scale indexes present** (T2-6 verified). **Thriver
  self-escalation blocked** (06-23). **search_path pinned on 33 definer fns.**

---

## Recommended order -> Beta-500
1. **H-1 (the gate):** the moment HP signals the PII reader-rewire done, PF applies the staged
   column-revoke + re-verifies by rolled-back JWT impersonation. Nothing else opens until email +
   invite_code are closed.
2. **M-1 health-DoS** (PF/ops, ~1 small file, no lane contention, 5 audits overdue) - strong candidate
   for the next concrete PF ship while H-1 waits on HP.
3. **M-2 log-visit cap** (PF/ops, small).
4. **M-3 vehicles poll** (HP, one-line) + **M-4 incremental handlers** (HP, careful pass).
5. Re-triage L-5 LOS by live instrumentation if it reproduces; otherwise leave the sound architecture.
