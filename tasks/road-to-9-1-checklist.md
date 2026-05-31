# Road to 9/1 KS - Owner Checklist

**Anchor:** [tasks/north-star.md](north-star.md). **Detail:** [tasks/kickstarter-readiness-2026-09-01.md](kickstarter-readiness-2026-09-01.md).

Exact items, by owner. No fluff. Check off as shipped.

---

## XERO ONLY (decisions + content - lanes are blocked on these)

- [ ] **F1** - pick cold-`/` routing: A (redirect anon to `/publiclanding`) / B / C / D. Memo: [tasks/f1-cold-root-decision-memo-2026-05-30.md](f1-cold-root-decision-memo-2026-05-30.md).
- [ ] **F2 copy** - real text for `/publiclanding` "What is Tapestry?" + "Who is it for?" + bottom CTA. Replace 4 `[PLACEHOLDER]` blocks.
- [ ] **F2 assets** - 3 screenshots or 30-60s video loop for `/publiclanding` "What it looks like" cards (In-session table / Character sheet / Community dashboard).
- [ ] **F2 press** - real copy for `/press` (5 `[PLACEHOLDER]` blocks + founder bio + screenshots + logo ZIP).
- [ ] **Demo content decision** - which free modules ship Day 1 (Empty / The Arena / District Zero / other).
- [ ] **Gated content surface** - which paid modules (Minnie / Chased) are browsable in `/rumors` so backers see depth coming.
- [ ] **Observability B** - Sentry -> thetapestry -> Alerts -> Create Alert Rule + send test. ~5 min. Playbook Section 5 of [tasks/ops-uptime-monitor-setup-2026-05-29.md](ops-uptime-monitor-setup-2026-05-29.md).
- [ ] **Backup cadence** - confirm Supabase tier backup schedule (or decide PITR/Pro upgrade).
- [ ] **Moderation capacity** - process decision: can 2 people clear `/moderate` at 500 users + a user report/abuse path.
- [ ] **KS link target** - what does the Kickstarter "play the VTT" button point to (live signup / guided demo / Arena).
- [ ] **4-surface eyes-on verdict** - your taste call on `/publiclanding` / cold `/` / signup / new-GM dashboard against "would a backer fund this."

---

## HP (app code)

- [ ] **F4** - cold-`/` ghost-map landing polish: clear value-prop + get-in CTA (not a dead-end).
- [ ] **F5** - new-GM first-action pull: "create your first campaign / run a free module" (not stalled on empty dashboard).
- [ ] **F6** - single-source WelcomeModal <-> `/firsttimers` duplicated onboarding copy.
- [ ] **4 combat-flow testids** (XERO APPROVED, queued in active-lanes): `initiative-row-<id>`, `initiative-row-active`, `roll-feed-row-<id>`, `roll-feed-attack-result`.
- [ ] **Broadcast catch-up** remaining surfaces: `PlayerNotes` + `app/npc-sheet` + `app/campaign-sheet` (3 of 5; 2 shipped).
- [ ] **`/press` first-paint** investigation - blank black on initial render until scroll. HP code check.
- [ ] **Combat math 2-client smoke** - verified at a manual 2-client run OR via the new E2E Phase B (whichever lands first).
- [ ] **Modal redesign A3 -> E** - 5 phases. Spec [tasks/modal-redesign-spec-2026-05-24.md](modal-redesign-spec-2026-05-24.md).
- [ ] **Rest / heal-over-time finish** - currently a Phase-3 placeholder.
- [ ] **Tier 1 rules-canon gaps** (`tasks/roadmap.md` Tier 1): vehicles-as-cover, item condition + upkeep, environmental damage, conditions phase-2.
- [ ] **AUDIT M1** - `prepareUpload('tactical-maps', file)` guard at `app/scene-controls-popout/page.tsx:316` + register `tactical-maps` in `lib/safe-upload.ts`.
- [ ] **AUDIT M3** - `console.*` sweep top 4 files (table-page 51, useRollResolution 19, campaign-clock 17, CampaignCommunity 10).
- [ ] **AUDIT M5** - realtime-wrap migration: 14 sites bypass `wrapBroadcast`/`wrapDbChange`. Path B (wrap-at-call-site, ~70 min) recommended first. Finding: [tasks/finding-realtime-wrap-bypass-2026-05-30.md](finding-realtime-wrap-bypass-2026-05-30.md).
- [ ] **AUDIT L1** - wound-infection serial `await` loop check (`useRollResolution.ts:1855`).
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
