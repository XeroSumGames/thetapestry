# Road to 9/1 KS - Owner Checklist

**Anchor:** [tasks/north-star.md](north-star.md). **Detail:** [tasks/kickstarter-readiness-2026-09-01.md](kickstarter-readiness-2026-09-01.md).

Exact items, by owner. No fluff. Check off as shipped.

---

## XERO ONLY (decisions + content - lanes are blocked on these)

- [~] **F1** - DECISION still Option A but DEFERRED 2026-06-11. Xero pulled `/publiclanding` entirely and reverted the redirect ("let's leave it as open and free until I start distributing invites"). The decision logic is unchanged - when invites start and the new pitch is written, re-ship the same redirect. See [tasks/f1-cold-root-decision-memo-2026-05-30.md](f1-cold-root-decision-memo-2026-05-30.md) when the time comes.
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

- [~] **F1 WIRE** - REVERTED 2026-06-11. Originally shipped `c588ce0` (HP server-side redirect) but Xero pulled `/publiclanding` entirely the same day ("open and free until invites start"). The redirect logic was removed in the revert commit; `app/page.tsx` is back to the thin sync re-export of `dashboard/page`. F4 / F5 / F6 are back to their original scopes (anons reach the dashboard ghost-map). When the new pitch is ready + invites start, re-ship the same one-line redirect.
- [x] **F4** - CLOSED 2026-06-11 (`6ba240a`). Dashboard detects 0 GM campaigns and shows "Your Story Starts Here" panel with Create CTA + 3 free module tiles (Empty/Basement/Arena). Testplan: [tasks/end-of-beginning-handoff-testplan-2026-06-11.md](end-of-beginning-handoff-testplan-2026-06-11.md).
- [x] **F5** - CLOSED 2026-06-11 (`6ba240a`). New-GM first-action pull shipped alongside F4 in the same commit.
- [x] **F6** - CLOSED 2026-06-11 (`6ba240a`). Single-sourced 4 onboarding sections into `lib/onboarding-sections.ts`; both WelcomeModal and /firsttimers now render from it. Fixed /firsttimers em-dashes, typos, stale "Coming soon."
- [x] **4 combat-flow testids** - SHIPPED 2026-05-31. `initiative-row-<id>`, `initiative-row-active`, `roll-feed-row-<id>`, `roll-feed-attack-result` - one additive commit, no behavior change. Unblocks E2E combat-flow Phase B.
- [ ] **Broadcast catch-up** remaining surfaces: `PlayerNotes` + `app/npc-sheet` + `app/campaign-sheet` (3 of 5; 2 shipped).
- [x] **`/press` first-paint** - FIXED `63ee6c8` 2026-06-12. LayoutShell now skips the `!checked` blank-screen for `NO_SIDEBAR_PAGES`; /press (and /login, /signup) render immediately without waiting for getCachedAuth.
- [x] **Combat math 2-client smoke** - 12-check tactical-map 2-client gate ALL-PASS 2026-05-30. **KS #1 CORE-LOOP RELIABILITY CLOSED.** (E2E baseline 140/0/0.)
- [ ] **Mass-upload tokens** - GM has a folder of NPC/character photos and wants to bulk-create tokens in one pass (upload N images -> N tokens placed on the active scene, or N NPC portrait rows created). Xero confirmed need 2026-06-12; scope TBD (portraits-only vs map-placement vs both). Design first.
- [ ] **Modal redesign A3 -> E** - 5 phases. Spec [tasks/modal-redesign-spec-2026-05-24.md](modal-redesign-spec-2026-05-24.md).
- [x] **Rest / heal-over-time finish** - CLOSED 2026-06-11 via verify-first sweep. All 3 gaps shipped in `lib/rest.ts` (`5ba32d1` Stress cooling-off + sick RP cap; HP shipped recovering_from_mortal_wound column + trigger same week). Gap A: stressDrop computed at lib/rest.ts:79. Gap B: infection_state checked, half-max RP cap enforced. Gap C: recovering_from_mortal_wound boolean live on character_states + trigger maintains it BEFORE-UPDATE OF wp_current. Verify E: heal-over-time queue drainers (drainPendingHeals + drainStreamingHeals) confirmed firing on every advance() per yesterday's heal-over-time deep-dive. Pre-extract spec did its job: [tasks/canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md).
- [x] **Tier 1 rules-canon gaps** - verify-first sweep 2026-05-31 (`a1591a1`) confirmed all four already SHIPPED: vehicles-as-cover RDM (`f264f7b`), item condition + upkeep (`724a1e2`), environmental damage trio (`1b5b958`), conditions phase-2 (wrong-premise, deferred post-KS). Full audit: [tasks/canon-extract-mechanics-status-2026-05-31.md](canon-extract-mechanics-status-2026-05-31.md). Net: Rest finish is the only remaining mechanics-bucket pickup.
- [x] **AUDIT M1** - SHIPPED 2026-05-31 by Puffer. Registered `tactical-maps` bucket (25 MB cap, image-only) in `lib/safe-upload.ts`; wired `prepareUpload('tactical-maps', file)` at `app/scene-controls-popout/page.tsx:372+` BEFORE the upload-state commit. +2 unit tests in `tests/lib/safe-upload.test.ts`.
- [~] **AUDIT M3** - `console.*` sweep top 4 files. Phase 1 SHIPPED 2026-05-31 (Puffer): CampaignCommunity 10 -> 2 (8 Supabase-shape errors migrated to `reportSupabaseError` for Sentry coverage; 2 domain-assertion logs legitimately kept). Pattern locked: Supabase-error-shape -> `reportSupabaseError(err, context)`; domain assertions stay as `console.error`. Phases 2-4 owed: useRollResolution (19), campaign-clock (17), table-page (51). HP can apply the same triage.
- [x] **AUDIT M5** - CLOSED 2026-06-11 via verify-first sweep. HP Path-B migration shipped at `b982759` covered ~80% of channel sites. Verify-first found only 3 remaining candidates: app/messages/page.tsx (REAL bypass, fixed at `4fe0b83`), components/GmNotes.tsx (outbound `.send()` not a handler, not a bypass), components/Sidebar.tsx (presence subscription, outside wrap scope - no presence wrap exists). Net: every postgres_changes + broadcast handler in the app is now Sentry-wrapped. Finding superseded: [tasks/finding-realtime-wrap-bypass-2026-05-30.md](finding-realtime-wrap-bypass-2026-05-30.md).
- [x] **AUDIT L1** - CLOSED 2026-06-11. Race-safety analysis confirmed `maybeLogWoundInfection`'s internal dedup (ref `add()` BEFORE `await` + rollsFeed snapshot check) makes serial-await unnecessary. Parallelized via `Promise.all(names.map(...))` in `useRollResolution.ts`. Same outcome as the serial loop for fresh + repeat-target + cross-combat dedup; small latency win per multi-target hit. Comment updated with the analysis.
- [x] **AUDIT L2** - CLOSED 2026-06-11 via verify-first sweep. All empty `.catch(() => {})` sites audited; ZERO real bypasses in production code. Breakdown: ~15 sites in `e2e/*.spec.ts` are legitimate "click if visible, ignore if not" test cleanup pattern; `app/rumors/[id]/edit/page.tsx:187,242` is best-effort old-cover-file removal (orphan file in storage is acceptable failure mode); `components/PlaytestRecorder.tsx:89` is best-effort auth lookup (recorder shouldn't crash on auth failure). All intentional, all documented in-context. No code change needed.

---

## E2E (Playwright)

- [x] **Combat-flow Phase B** - SHIPPED `5d9773f` 2026-06-11. Initiative-bar DOM ordering + GM turn-advance GREEN 12.4s. Two-client throwaway campaign: REST asserts chip order (roll DESC) + `aria-current` shift + both clients reflect within 15s realtime SLA.
- [ ] **End-of-combat infection banner DOM assertion** - unblocked by `gm_apply_damage` v3 (`f4f3e9d`). ~15 min.
- [ ] **Full re-cert as 9/1 launch gate** - `npm run test:e2e` green on prod, dashboard updated in place.

---

## PUFFER (me)

- [x] **Realtime concurrent-connection-cap sanity** - CLOSED 2026-06-11. Analysis at [tasks/beta-500-connection-cap-readiness-2026-06-11.md](beta-500-connection-cap-readiness-2026-06-11.md). Current state: Pro tier, 17 users, 34 active DB connections (2:1 connections-per-user). Projected Beta-500 peak: 100-200 concurrent realtime / 150-300 DB - both well under the 500-connection Pro caps with ~2x headroom. Trigger conditions defined for data-driven Team upgrade if needed. Load-test deferred (verified headroom + monitoring trigger gives comparable confidence without the harness cost).
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
