# Kickstarter Readiness - TheTapestry, 2026-09-01

**Owner of record for the 9/1 milestone.** Anchor: [`tasks/north-star.md`](north-star.md). This doc exists because the KS is the thing everything serves, and until now it had only a one-line row in `road-to-1.0`. Owner tags: **[OP]** Xero/operator, **[PF]** Puffer Fish, **[HP]** Hunt & Peck, **[E2E]** Playwright.

## What the KS is
A ~30-day **Kickstarter for the whole Distemper project** (TTRPG + comic book + VTT), launching **9/1**. **Only TheTapestry** goes live (TheTableau later, TheTable when-ready). Backers get a **blanket free-GM account** for the campaign -> they drive final playtesting + bug-fixing. **Beta-500 (7/1) is the dress rehearsal** that proves it first.

## The VTT's job at the KS
It is a **marketing + funding moment** - backers decide whether to pay based on first contact. Bar (Xero, verbatim): *"the platform is stable, polished, and fun. When people go there, it should look great and be intuitive and have a lot of things for people to explore. It can still be bare bones, but it must look and feel promising."* So: **reliability + polish + first-impression > feature-completeness.** It must run flawlessly in a live demo and pull a brand-new visitor into a fun first session fast.

## Free-GM access model (pre-billing)
Billing / GM-paid gating does NOT exist until ~10/1 (post-KS). **So through Beta-500 and the KS, there is no GM gate at all - everyone can GM by default.** "Free GM for beta-500 / reviewers / backers" is therefore the automatic pre-billing state; no provisioning system is needed before the campaign.
- **[PF/OP] 10/1 grandfather (don't forget):** when GM-paid gating turns on (~10/1), the beta-500 testers, reviewers, and KS backers who were promised free GM (some in perpetuity) must be GRANDFATHERED - capture their `user_id`s now (or a durable flag) so the entitlements migration can exempt them. This is the one piece of the free-GM promise that needs real work, and it lands with billing.

## Readiness checklist (the 9/1 go / no-go)
### A. Reliability (the "stable" half) - the core loop must not fall apart
- [ ] **[HP]** Tactical-map render rewrite shipped + **passes the 2-client verification gate** ([tactical-map-verify-2client-testplan-2026-05-27.md](tactical-map-verify-2client-testplan-2026-05-27.md)). #1 item.
- [ ] **[HP]** Combat math / conditions / end-of-combat infection verified (the documented manual 2-client smoke, #10).
- [ ] **[HP]** Broadcast catch-up fix on all 5 subs (pins didn't show without refresh; class).
- [ ] **[E2E]** Full `npm run test:e2e` green on prod as a launch gate; combat-flow covered or manually smoked.
- [ ] **[PF/OP]** Beta-safety floor: uptime monitor + alerting on `/api/health` (a mid-demo outage during a live KS is catastrophic); backup cadence confirmed; realtime concurrent-connection sanity at backer-scale.

### B. Polish + first-impression (the "looks great / feel promising" half)
- [ ] **[PF->HP]** KS first-impression punch list (from [ks-first-impression-audit-2026-05-27.md](ks-first-impression-audit-2026-05-27.md)) - the cold-visitor path (landing -> signup -> first campaign -> first session) has no rough/dead-end/"what do I do now" moments.
- [ ] **[OP/taste]** Xero's eyes-on verdict of the 4 key surfaces (publiclanding / cold-`/` ghost map / signup / first-time-GM) against "would a backer fund this."
- [ ] **[HP]** New-GM is PULLED toward "create a campaign / run Empty," not dropped on an empty dashboard.

### C. Content-demo readiness (the "lots to explore + fun" half) - [OP] your lane
- [ ] **[OP]** Decide + confirm the free GM-able demo content (Empty, The Arena, maybe District Zero) is POLISHED and fun enough to convert - this is what a backer actually plays.
- [ ] **[OP]** "Lots to explore" - enough visible content/surfaces that the platform feels alive, not bare. (Bare-bones is OK; *empty* is not.)
- [ ] **[OP]** Gated content (Minnie, Chased, etc.) present + browsable via `/rumors` so backers see the depth coming, even if locked.

### D. Landing + pitch
- [ ] **[OP/HP]** `/publiclanding` is REAL, not the placeholder stub (the audit flagged empty boxes). The hero must land.
- [ ] **[OP] DECISION:** what does the KS "play the VTT" link point to (the F1 question) - the live signup, a guided demo, the Arena? Drives the funnel.
- [ ] **[OP/HP]** Remove/repoint any stale launch dates in `publiclanding` / `press` (the dead `6/15` strings).

### E. Go / no-go
All of A green (esp. the tactical-map gate) + B clear + C "fun, not empty" + D real -> GREEN to launch. Any A-item red -> hold.

## Open decisions (Xero)
1. At KS, is signup **open to all** or **backers-only via codes** (extend the beta-500 invite-gate)?
2. Which content is the **featured demo** a backer hits first?
3. The KS "try it" link target (F1).
4. Timing of the 10/1 grandfather + billing turn-on relative to the campaign end.

## Sources / keep in sync
- [`tasks/north-star.md`](north-star.md) (the anchor), [`tasks/road-to-1.0.md`](road-to-1.0.md) (the milestones), [`tasks/beta-500-readiness-2026-06-01.md`](beta-500-readiness-2026-06-01.md) (the 7/1 dress rehearsal), [`tasks/ks-first-impression-audit-2026-05-27.md`](ks-first-impression-audit-2026-05-27.md) (the polish punch list), [`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`](tactical-map-verify-2client-testplan-2026-05-27.md) (the #1 reliability gate).
