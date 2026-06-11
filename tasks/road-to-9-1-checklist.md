# Road to 9/1 KS - Owner Checklist

**Anchor:** [tasks/north-star.md](north-star.md). **Detail:** [tasks/kickstarter-readiness-2026-09-01.md](kickstarter-readiness-2026-09-01.md).

Exact items, by owner. No fluff. Check off as shipped.

---

## XERO ONLY (decisions + content - lanes are blocked on these)

- [x] **F1** - DECISION LOCKED 2026-06-11: **Option A** - server-side redirect anon visitors from `/` to `/publiclanding`. Memo: [tasks/f1-cold-root-decision-memo-2026-05-30.md](f1-cold-root-decision-memo-2026-05-30.md). Routes to HP for the one-commit wire (see HP section).
- [ ] **F2 copy** - real text for `/publiclanding` "What is Tapestry?" + "Who is it for?" + bottom CTA. Replace 4 `[PLACEHOLDER]` blocks.
- [ ] **F2 assets** - 3 screenshots or 30-60s video loop for `/publiclanding` "What it looks like" cards (In-session table / Character sheet / Community dashboard).
- [ ] **F2 press** - real copy for `/press` (5 `[PLACEHOLDER]` blocks + founder bio + screenshots + logo ZIP).
- [x] **Demo content decision** - LOCKED 2026-06-11. **FREE Day 1 (3 stand-alones): Empty, The Basement, The Arena.** **PAID (browsable in `/rumors`): Minnie & The Magnificent Mongrels, Chased.** Reasoning: Empty is the explicit tutorial; The Basement is combat-sandbox + already personally playtested (kids 2026-05-31 + 2026-06-10 - it's the Fight Club campaign); The Arena is the tactical-map combat showcase. Minnie + Chased are the long-form narrative campaigns that map to the published-book IP and serve as premium "depth coming" content for backers. UNBLOCKS: KS marketing copy ("ships with 3 free modules"), HP F5 new-GM flow (Empty = first-action target), `/rumors` gated-content paywall design.
- [x] **Gated content surface** - RESOLVED 2026-06-11 alongside Demo content decision. Paid: Minnie + Chased browsable in `/rumors`. Wiring is HP work in Week 2 against this decision.
- [x] **Observability B** - CLOSED 2026-06-11. Sentry alert rule live on `thetapestry` project: WHEN new issue created / resolved / escalates / unresolved -> Notify on preferred channel (email to xerosumstudio@gmail.com) with 5-min throttle. Test alert "THETAPESTRY-E - Test Issue" delivered to inbox 2026-06-11 15:01 UTC. Production-error signal now routes to a human.
- [x] **Backup cadence** - CLOSED 2026-06-11. Supabase project confirmed on **Pro** tier. PITR (point-in-time recovery) is included with Pro - 7-day window, restore to any second. Covers Beta-500 (7/1) and KS launch (9/1). No upgrade or migration needed; the data-loss-risk story is closed.
- [x] **Spend Cap (Beta-500 prereq)** - CLOSED 2026-06-11. Verified disabled in Supabase Billing -> Cost Control: "Spend cap is disabled / You will be charged for usage beyond the included quota." Projected June 11 - July 7 invoice: $25 Pro + ~$6 overage = $31.34. Platform stays up if usage spikes during Beta-500 / KS demo windows; overage charges remain metered + predictable.
- [ ] **Moderation capacity** - process decision: can 2 people clear `/moderate` at 500 users + a user report/abuse path.
- [ ] **KS link target** - what does the Kickstarter "play the VTT" button point to (live signup / guided demo / Arena).
- [ ] **4-surface eyes-on verdict** - your taste call on `/publiclanding` / cold `/` / signup / new-GM dashboard against "would a backer fund this."

---

## HP (app code)

- [x] **F1 WIRE** - SHIPPED `c588ce0` 2026-06-11 (HP, same session Xero locked Option A). Server-side redirect anon `/` -> `/publiclanding` live in `app/page.tsx`. F4 / F5 / F6 are now unblocked.
- [ ] **F4** - cold-`/` ghost-map landing polish: clear value-prop + get-in CTA (not a dead-end). NOTE: F1 redirect (above) means anon visitors don't reach the ghost-map at all - F4 only applies to logged-in cold landings, scope likely shrinks dramatically.
- [ ] **F5** - new-GM first-action pull: "create your first campaign / run a free module" (not stalled on empty dashboard).
- [ ] **F6** - single-source WelcomeModal <-> `/firsttimers` duplicated onboarding copy.
- [ ] **4 combat-flow testids** (XERO APPROVED, queued in active-lanes): `initiative-row-<id>`, `initiative-row-active`, `roll-feed-row-<id>`, `roll-feed-attack-result`.
- [ ] **Broadcast catch-up** remaining surfaces: `PlayerNotes` + `app/npc-sheet` + `app/campaign-sheet` (3 of 5; 2 shipped).
- [ ] **`/press` first-paint** investigation - blank black on initial render until scroll. HP code check.
- [x] **Combat math 2-client smoke** - 12-check tactical-map 2-client gate ALL-PASS 2026-05-30. **KS #1 CORE-LOOP RELIABILITY CLOSED.** (E2E baseline 140/0/0.)
- [ ] **Modal redesign A3 -> E** - 5 phases. Spec [tasks/modal-redesign-spec-2026-05-24.md](modal-redesign-spec-2026-05-24.md).
- [x] **Rest / heal-over-time finish** - CLOSED 2026-06-11 via verify-first sweep. All 3 gaps shipped in `lib/rest.ts` (`5ba32d1` Stress cooling-off + sick RP cap; HP shipped recovering_from_mortal_wound column + trigger same week). Gap A: stressDrop computed at lib/rest.ts:79. Gap B: infection_state checked, half-max RP cap enforced. Gap C: recovering_from_mortal_wound boolean live on character_states + trigger maintains it BEFORE-UPDATE OF wp_current. Verify E: heal-over-time queue drainers (drainPendingHeals + drainStreamingHeals) confirmed firing on every advance() per yesterday's heal-over-time deep-dive. Pre-extract spec did its job: [tasks/canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md).
- [x] **Tier 1 rules-canon gaps** - verify-first sweep 2026-05-31 (`a1591a1`) confirmed all four already SHIPPED: vehicles-as-cover RDM (`f264f7b`), item condition + upkeep (`724a1e2`), environmental damage trio (`1b5b958`), conditions phase-2 (wrong-premise, deferred post-KS). Full audit: [tasks/canon-extract-mechanics-status-2026-05-31.md](canon-extract-mechanics-status-2026-05-31.md). Net: Rest finish is the only remaining mechanics-bucket pickup.
- [x] **AUDIT M1** - SHIPPED 2026-05-31 by Puffer. Registered `tactical-maps` bucket (25 MB cap, image-only) in `lib/safe-upload.ts`; wired `prepareUpload('tactical-maps', file)` at `app/scene-controls-popout/page.tsx:372+` BEFORE the upload-state commit. +2 unit tests in `tests/lib/safe-upload.test.ts`.
- [~] **AUDIT M3** - `console.*` sweep top 4 files. Phase 1 SHIPPED 2026-05-31 (Puffer): CampaignCommunity 10 -> 2 (8 Supabase-shape errors migrated to `reportSupabaseError` for Sentry coverage; 2 domain-assertion logs legitimately kept). Pattern locked: Supabase-error-shape -> `reportSupabaseError(err, context)`; domain assertions stay as `console.error`. Phases 2-4 owed: useRollResolution (19), campaign-clock (17), table-page (51). HP can apply the same triage.
- [x] **AUDIT M5** - CLOSED 2026-06-11 via verify-first sweep. HP Path-B migration shipped at `b982759` covered ~80% of channel sites. Verify-first found only 3 remaining candidates: app/messages/page.tsx (REAL bypass, fixed at `4fe0b83`), components/GmNotes.tsx (outbound `.send()` not a handler, not a bypass), components/Sidebar.tsx (presence subscription, outside wrap scope - no presence wrap exists). Net: every postgres_changes + broadcast handler in the app is now Sentry-wrapped. Finding superseded: [tasks/finding-realtime-wrap-bypass-2026-05-30.md](finding-realtime-wrap-bypass-2026-05-30.md).
- [x] **AUDIT L1** - CLOSED 2026-06-11. Race-safety analysis confirmed `maybeLogWoundInfection`'s internal dedup (ref `add()` BEFORE `await` + rollsFeed snapshot check) makes serial-await unnecessary. Parallelized via `Promise.all(names.map(...))` in `useRollResolution.ts`. Same outcome as the serial loop for fresh + repeat-target + cross-combat dedup; small latency win per multi-target hit. Comment updated with the analysis.
- [ ] **AUDIT L2** - empty `.catch(() => {})` sweep across 5+ sites.

---

## E2E (Playwright)

- [ ] **Combat-flow Phase B** - DOM ordering / action decrement assertions. Unblocked the moment HP testids ship.
- [ ] **End-of-combat infection banner DOM assertion** - unblocked by `gm_apply_damage` v3 (`f4f3e9d`). ~15 min.
- [ ] **Full re-cert as 9/1 launch gate** - `npm run test:e2e` green on prod, dashboard updated in place.

---

## PUFFER (me)

- [ ] **Realtime concurrent-connection-cap sanity** + small concurrent-client load test (Beta-500 readiness #5).
- [ ] **KS visual pass 3** - when Xero supplies state: logged-out browser for true ghost `/`, fresh GM account for new-GM dashboard, real mobile device for responsive verification.
- [ ] **Final pre-launch sweep** - `/stability-audit` cycle ~10 days before 9/1, freeze window enforced after.
- [ ] **(After all green)** Risk Register sanity sweep + Confidence Ledger refresh - one more drain pass.

---

## What is OFF this list (intentionally deferred to ~10/1 post-KS)

- Stripe / billing / subscriptions / tax
- Lawyer-reviewed ToS + Privacy
- Third-party security audit + pen test
- PITR / Supabase Pro upgrade
- Architecture hardening (PC lasting-wounds column, `/pre-launch-audit` one-time)

These are Bucket 4 in [tasks/road-to-1.0.md](road-to-1.0.md). NOT a 9/1 blocker.

---

## Recommended order

1. **Now -> 6/15:** XERO clears observability B + backup cadence + moderation decisions. HP closes F4/F5/F6 + the audit-flagged carry-overs. E2E ships Phase B + infection banner.
2. **6/15 -> 7/1:** Beta-500 floor + invite-code list. Open beta.
3. **7/1 -> 8/15:** XERO drives F1 + F2 (copy + assets). HP closes the rules-canon Tier 1 + modal redesign + Rest. Beta-500 learns from real users.
4. **8/15 -> 9/1:** Freeze-window. E2E full re-cert. Puffer final pre-launch sweep. Polish only.
5. **9/1:** KS launches.
