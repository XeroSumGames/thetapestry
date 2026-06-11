# The End of the Beginning - 2026-06-11 -> 2026-09-01

> *"Now this is not the end. It is not even the beginning of the end.
>  But it is, perhaps, the end of the beginning."* - Churchill, 1942

This doc is the SINGLE LANDING PAGE for the 12-week stretch between
where we are now and the Kickstarter launch. Open this first every
session. If we are anywhere on this stretch, this is the page that
tells us what it is, what we are doing, and what we are coming back
to.

---

## The frame - what this stretch IS

We are not building the engine anymore. The engine is built and it
works. We are not proving the game can be played at a table. It has
been played at a table - by Xero's kids, multiple sessions, with
combat, grapples, grenades, healing, NPCs dropping, PCs surviving,
no crashes, no soft-locks.

We are NOT yet open to paying backers. The Kickstarter is not yet
running. The platform is not yet running open public beta. There is
no billing wired in production. There is no third-party security
audit. The legal text has not been reviewed by a lawyer.

What this stretch IS: the **bridge from "the engine works" to "we
opened the gates and people walked in."** It has three phases:

1. **Beta-500** opens 2026-07-01 - 500-user invite-coded soft beta.
2. **Active beta** runs 2026-07-01 -> 2026-08-15 - real users, real
   feedback, real polish.
3. **Freeze + launch** runs 2026-08-15 -> 2026-09-01 - no architectural
   changes, polish only, full audits, KS opens 9/1.

Everything in this doc serves those three milestones, in that order.

---

## What we know - validated state, 2026-06-11

- **822 -> 859 unit tests, all gates green** (tsc + font + role +
  em-dash + arch + CI). The number grows by feature; never green-falls.
- **140/0/0 E2E baseline** on the dashboard at last full re-cert.
- **5 of 6 KS-bucket mechanics SHIPPED**: Rest (`lib/rest.ts` +
  trigger), Vehicles-as-Cover RDM (`f264f7b`), Item Condition + Upkeep
  (`724a1e2`), Falling/Drowning/Subsistence (`1b5b958` + clock
  drainer), Travel Times (`e7b1e56`). Audit:
  [canon-extract-mechanics-status-2026-05-31.md](canon-extract-mechanics-status-2026-05-31.md).
  The 6th (Conditions Phase-2) is wrong-premise, deferred post-KS.
- **Heal-over-time is fully shipped** - both variants:
  - Pending Medicine\* heal (canon +12h/+24h split) from `/table`.
  - Streaming heal (time-spread) from `/campaign-sheet` popout.
  - Both drain on every clock tick via
    `lib/campaign-clock.ts:drainPendingHeals` + `drainStreamingHeals`.
- **Grapple / Subdue / Break Free / Strike-the-grappler rework
  SHIPPED** (commits `f5b4465` + `e5c1b61` + `05ff9ec` + `558ac0e`).
  Phase 3 (`initiative_order.pending_action_loss` column) still owed.
- **KS #1 CORE-LOOP RELIABILITY CLOSED**: 12-check tactical-map
  2-client gate ALL-PASS 2026-05-30.
- **Playtests with kids 2026-05-31 + 2026-06-10**: 3 humans, 2 PCs vs
  2 NPCs, grenade fumbles, sibling PvP, auto-loot, cross-client
  realtime broadcasts, heal-over-time in real use. No crashes.
- **Two security findings closed today** (`03453dd`): gm-notes XSS
  trap + avatar pre-flight check.

The platform is closer to v1.0 than any roadmap doc reflects. What
remains for 9/1 is bridge work, not engine work.

---

## The 4 Xero-only Week 1 unblocks (CRITICAL PATH)

These four items take 30-60 min combined. They UNBLOCK every other
lane. Without them, HP and E2E run into walls within a week. With
them done, the entire workflow flows linearly until 9/1.

| # | Item | Time | What it unblocks |
|---|---|---|---|
| 1 | ~~**Observability B** - Sentry alert rule + test~~ **DONE 2026-06-11** | ~5 min | ~~incident-response story~~ CLOSED. Alert delivered to inbox; rule live with 5-min throttle. |
| 2 | ~~**Backup cadence** - Supabase tier review or PITR/Pro upgrade decision~~ **DONE 2026-06-11** | ~15 min | ~~data-loss-risk story~~ CLOSED. Already on Supabase Pro; 7-day PITR included. |
| 3 | **Demo content** - which free modules ship Day 1 | ~15 min | KS marketing copy + new-GM flow + `/rumors` gated content design |
| 4 | **F1 cold-`/` routing** - decide A/B/C/D from the memo | ~15-30 min | HP F4 (cold-`/` polish), F5 (new-GM pull), F6 (WelcomeModal dedup) all blocked behind this |

**Order matters.** Do them 1 -> 2 -> 3 -> 4 in sequence. Walk-through
instructions for each come from the advisor (Claude) when you ask
"walk me through #N."

---

## The flow after the 4 unblocks (Weeks 2-12)

Detailed week-by-week at
[tasks/road-to-9-1-checklist.md](road-to-9-1-checklist.md), but the
shape is:

- **Weeks 2-3** (6/18 -> 6/30): HP closes F4/F5/F6 + 4 testids +
  Phase 3 grapple column. E2E un-parks grapple-family contract net,
  builds Phase B + hidden NPC specs. Puffer runs concurrent-connection
  load test + HOPED-FOR verify-first sweep. Xero supplies F2 copy +
  assets.
- **Week 4** (7/1): **Beta-500 opens.**
- **Weeks 5-10** (7/1 -> 8/15): Active beta. HP runs modal redesign
  A3->E + AUDIT M3/M5/L1/L2 cleanups + broadcast catch-up + UX
  polish from beta findings. Xero writes KS campaign body copy in
  parallel.
- **Weeks 11-12** (8/15 -> 8/31): **FREEZE.** Puffer runs
  `/stability-audit` + `/pre-launch-audit` + Risk Register sweep.
  E2E full re-cert green on prod. HP polish only.
- **2026-09-01: KICKSTARTER OPENS.**

---

## What "coming back to" each session means

Every time we resume work on this stretch, the session opens with:

1. **Read this doc first.** It tells us where on the bridge we are.
2. **Then read [tasks/handoff.md](handoff.md)** - the operational
   scaffold. Last-session state.
3. **Then `git log --oneline --since='1 day ago'`** - what shipped
   since.
4. **Then [tasks/todo.md](todo.md) CURRENT OPEN** - open work, by lane.

If you're disoriented coming back, that order will re-anchor you in
under 5 minutes.

---

## What is OFF this stretch (intentionally deferred)

These do NOT block 9/1. Do not work them. Re-evaluate post-KS:

- Stripe / billing / subscriptions / per-seat pricing / tax
- Lawyer-reviewed ToS + Privacy Policy
- Third-party security audit + pen test
- PITR / Supabase Pro upgrade (decide IF in Item 2 above)
- Modal redesign Phase E (13 non-roll modals - biggest single chunk)
- Vehicles-as-Cover "behind it" LoS-trace case
- Conditions Phase-2 refactor (wrong-premise)
- Native mobile apps
- API for third-party VTT integrations
- Multi-language support

If something not listed above is being worked on and isn't on the
[road-to-9-1-checklist.md](road-to-9-1-checklist.md), STOP and ask
whether it belongs in this stretch at all.

---

## Related anchor docs (cross-reference)

- [tasks/north-star.md](north-star.md) - the one-line vision
- [tasks/operating-mode.md](operating-mode.md) - how Claude works
- [tasks/handoff.md](handoff.md) - operational state (per-session)
- [tasks/debug-handoff.md](debug-handoff.md) - diagnostic scaffold
- [tasks/road-to-9-1-checklist.md](road-to-9-1-checklist.md) - the
  owner-grouped detailed checklist
- [tasks/todo.md](todo.md) - CURRENT OPEN (live queue)

---

## The one-line check

If at any point in this stretch you wonder "what should I be doing
right now?" - the answer is: **the lowest-numbered open item in the
4-unblock list above, OR if those are all done, the lowest item in
the Week N section of the road-to-9-1 checklist.** Always.

The bridge is short. Walk it in order.
