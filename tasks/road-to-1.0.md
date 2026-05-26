# Road to TheTapestry 1.0

**Author:** Puffer Fish (synthesis). **Created:** 2026-05-26. **Status:** LIVING DOC - Xero owns scope (what's in/out of 1.0 is his call; this is the starting synthesis to edit/rewrite).

High-level only. The granular work lives in `tasks/todo.md` (CURRENT OPEN) and the source docs linked below; this doc is the map, not the punch list.

---

## Two finish lines (don't conflate them)

| Milestone | What it is | Money? | Gates |
|---|---|---|---|
| **Beta-500** (target 2026-06-01) | ~500 SELECT free friendlies, a bigger test | NO | "they get in, data is safe, we'd know if it broke, we can recover" |
| **TheTapestry 1.0** | Paid public launch - "structurally ready for the world" | YES | the real milestone; also the gate the 3-VTT platform/monorepo work waits behind |

Source: `tasks/beta-500-readiness-2026-06-01.md`, `tasks/architecture-path.md` (1.0 = "sound enough to take to the world / paid launch / 50k users").

---

## Beta-500 (the near gate) - mostly done, short critical path
- [ ] **[Xero] Signup works end-to-end on prod** - the one true blocker. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` + confirm `TURNSTILE_SECRET_KEY` in Vercel (`verify-turnstile` 503s without them), then a manual prod signup smoke (+ invite-code mint/redeem if invite-gated).
- [x] **Data-safety: `characters` cross-user write/data-loss class - largely CLOSED.** GM-of-campaign RLS applied; PC-PC trade RPC + client rewire shipped. (Was the RED Risk-Register item.)
- [ ] **Operational floor:** external uptime monitor on `/api/health` w/ alerting to a human; known Supabase backup cadence; a realtime concurrent-connection-cap sanity + small load test; moderation capacity (can two people clear `/moderate`?) + a user report/abuse path.
- [ ] **E2E green-light:** `npm run test:e2e` as go/no-go; combat-flow covered or manually smoked.

Full punch list: `tasks/beta-500-readiness-2026-06-01.md`.

---

## TheTapestry 1.0 (the bigger lift) - four buckets

### 1. Stabilize the core table loop  *(the heart of 1.0; actively underway)*
"Does it actually hold up at a real table." The 2026-05-26 Minnie playtest handed us the punch list (all captured + routed in `todo.md`):
- Tactical-map render (P0) - spec `tasks/tactical-map-render-fix-spec-2026-05-26.md` + schema migration applied; HP building the client rewrite.
- Loot loop (Search Remains -> PC inventory), roll_log feed reliability (a damage roll didn't log), pin realtime catch-up, + the UX polish batch (initiative round #, +NPC roster picker, ping, player-tile, grid contrast).

### 2. Finish what's in flight  *(the bulk of net-new work)*
- Modal redesign (phases A3 -> E; A/A2 shipped). Spec `tasks/modal-redesign-spec-2026-05-24.md`.
- Campaign-sheet / heal-over-time system finish (Rest is still a Phase-3 placeholder).
- Rules-canon gaps so the flagship FEELS complete: vehicles-as-cover, item condition + upkeep, environmental damage, conditions phase-2, etc. Source: `tasks/roadmap.md` (Tier 1).

### 3. Architecture hardening  *(pre-money structural soundness)*
- The structural bug-class kills in `tasks/architecture-path.md` (e.g. the realtime broadcast catch-up class swept 2026-05-26; PC lasting-wounds -> real column; conditions routing).
- The one-time `/pre-launch-audit` (top-down data model / auth / payment / scale / observability) BEFORE paid signups.

### 4. The paid-launch surface  *(deferred for beta-500, REQUIRED for 1.0)*
- Stripe / billing / subscriptions / tax.
- Lawyer-reviewed ToS + Privacy (basic pages + delete-account exist; real legal review owed before money).
- Third-party security audit + pen test.
- PITR / Supabase Pro / realtime + connection scale headroom.

---

## Honest read (2026-05-26)
- **Beta-500 is days away**, gated mostly on Xero's env vars; the hard data-safety work is largely done.
- **1.0 is bucket 1 (stabilize, underway) + bucket 2 (finish features) as the bulk**, then buckets 3-4 as the pre-money hardening gate. Buckets 3-4 are where the honest-boundary items live (real legal, real security audit, real scale) that the team-of-two can't self-certify.

## Sources / keep in sync
- `tasks/todo.md` CURRENT OPEN - the granular live list.
- `tasks/beta-500-readiness-2026-06-01.md` - the 6/1 gate.
- `tasks/roadmap.md` - rules-canon promotion roadmap (bucket 2 rules gaps).
- `tasks/architecture-path.md` + `tasks/architecture-review-2026-05-24.md` - bucket 3.
- `tasks/debug-handoff.md` Risk Register - current risk colors.
