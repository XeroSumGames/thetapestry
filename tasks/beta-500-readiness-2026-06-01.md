# Beta-500 Readiness - target 2026-07-01 (puffer-fish, 2026-05-24; target moved 06-01 -> 07-01 by Xero 2026-05-26. Filename keeps the original date as a stable identifier.)

**Goal:** open to ~500 SELECT users on 6/1 as a larger beta. **Semi-friendlies, NO subscriptions, NO money** - just a bigger test. This scoping is the whole point: it strips out the entire payment / PCI / tax / billing surface (normally a launch's hardest part) and raises rough-edge tolerance. But it is still 500 real people on prod, so the floor is: **they can get in, their data is safe, you would know if it broke, and you can recover.**

**Owners:** [OP]=operator/Xero (dashboard, env, money), [PF]=Puffer Fish (risk/SQL/RLS/observability), [HP]=Hunt & Peck (app code), [E2E]=Playwright lane (tests).

**Critical path is SHORT:** only items 1 and 2 are true blockers. Everything else is "should, and cheap."

---

## MUST-HAVE (hard blockers / data-safety / cannot-undo)

1. **[OP+PF] Signup must actually work on prod - verify END-TO-END.** Verified 2026-05-24: `app/api/auth/verify-turnstile/route.ts` returns **503 in prod when Upstash env vars are missing** (lines 108-114, before it even checks the token), and 500s if `TURNSTILE_SECRET_KEY` is unset. So today, if signup gates on that call, **nobody can sign up.**
   - [OP] Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (free tier covers it) AND confirm `TURNSTILE_SECRET_KEY` in the Vercel dashboard.
   - [PF/manual] Then a real prod signup smoke - the E2E suite deliberately cannot automate Turnstile, so this is by hand.
   - If invite-gated ("500 SELECT users" -> `signup_codes`): test code generation + redemption + that the invite path still passes Turnstile. Confirm 500 codes can be minted.

2. **[PF+HP] PC-to-PC trade data-loss bug.** Confirmed live (E2E finding `finding-pc-trade-rls-dataloss-2026-05-24.md`): a Survivor giving an item writes the RECEIVER's `characters` row, blocked by owner-only RLS, so the item is destroyed. 500 users WILL trade. **Either fix (RLS/RPC = PF, client = HP) or disable PC-PC trade for the beta.** Data-loss bugs torch beta trust fastest.

3. **[PF] Sibling-RLS audit - DONE 2026-05-24, and the trade bug is the tip of a CLASS.** Finding: `tasks/finding-characters-rls-cross-user-writes-2026-05-24.md` (Risk Register RED). Verified live: `characters` UPDATE is owner-only + a THRIVER bypass; **a GM is not a Thriver**, so the entire GM loot/award/ration loop (8 flows, incl. NPC->PC loot, LootModal, object loot, ration tick, lasting-wounds) silently loses data when the GM is an ordinary Survivor. **Latent today only because dev GMs are Thrivers.** GOOD NEWS - **combat is SAFE**: HP/RP/stress/conditions write to `character_states`, which already has a member/GM policy; only `characters.data` writes hit the gap. **Fix written** (`sql/characters-gm-write-rls-2026-05-24.sql`, GM-of-campaign UPDATE policy, apply gated = Xero) resolves 7 of 8; PC-PC trade (flow 1) needs an inventory-only RPC [PF] + client rewire [HP] or disable-for-beta. This SUBSUMES item 2 above (trade is flow 1 of this class).

4. **[OP+PF] Know the recovery floor.** No PITR (deferred - fine, no money). `audit_log` table is live (2026-05-24) but its recovery TRIGGERS (Phase AL2+) are NOT wired, so it captures nothing yet. Before exposing 500 people: [OP] confirm what backup cadence the current Supabase tier actually gives (daily? none?); [PF] decide if AL2 destructive-op triggers are worth wiring first. For free friendlies, "daily backup, accept up to a day's loss" may be an acceptable STATED risk - but know the window, do not assume PITR.

---

## SHOULD-HAVE (rough edges OK, but these bite at 500)

5. **[OP/PF] Realtime scale sanity.** The app is realtime-heavy; the real ceiling is Supabase's concurrent-realtime-connection cap on the current tier, not raw user count. 500 users (not all concurrent) is modest - but verify the cap + run a small concurrent-client load test. Confirm the Vercel plan and that a free beta is within its limits/ToS (if Hobby).
6. **[Xero/process] Moderation capacity.** Server-side enforcement is now solid (campfire + map_pins triggers, both 2026-05-24). The open question is PEOPLE: can two-of-you keep the `/moderate` queue clear for 500 users? Plus a user "report/abuse" path. Process call.
7. **[E2E+manual] Pre-beta green light.** Run `npm run test:e2e` as go/no-go. Combat-flow (#10) is the last uncovered Phase-2 spec; the 2026-05-25 Minnie playtest covers vehicle + combat math. The core combat loop MUST be covered or manually smoked before 500 users hit it.
8. **[PF/OP] Observability: "would we know if it broke?"** Sentry (client/server/edge) + `/api/health` are wired; the health-pulse is internal-only. ADD an EXTERNAL uptime monitor hitting `/api/health` with alerting to Xero's phone/email, and confirm Sentry alerts actually route to a human. At 500 users you want a pager, not a player, to tell you prod is down.

---

## DEFER (proportionate to skip for free friendlies)

- Stripe / billing / subscriptions / tax - OUT entirely (no money).
- Third-party security audit + pen test - belongs before PAID GA, not this gate.
- PITR / Supabase Pro - accept the daily-backup + (eventual) audit_log floor.
- Lawyer-reviewed ToS/Privacy - `/terms` + `/privacy` pages exist + account-deletion edge fn exists; basic privacy + delete-account is proportionate for a free beta. Real legal review before paid GA.
- 50k-scale work - irrelevant at 500.

**Honest boundaries (do not fool ourselves):** real UX validation IS what this beta buys - do not try to pre-solve it. Real legal/security/scale sign-off still belongs before PAID GA; deferring for free friendlies is proportionate, not reckless. And a third-party security review is still owed before money + scale.

---

## Status / next
- Sibling-RLS audit (item 3): in flight (read-only), 2026-05-24. Findings + severities to be appended here + routed to the owning lanes.
- Tracking todos added to `todo.md` ("Beta-500 readiness" section), owner-tagged.
- This doc is the punch list; re-derive HEAD + re-verify env state at decision time.
