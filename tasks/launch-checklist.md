# TheTapestry - Launch Checklist

**Directive (Xero, 2026-07-01):** clear the TIER 1 platform + game work FIRST, get the
platform technically ready, THEN switch to large-scale playtests. All TIER 2 work
(content / legal / payments / marketing) is PARKED until platform-ready.

**Milestones:** Beta-500 (7/1, prove it) -> large-scale playtests -> Kickstarter
(9/1, public) -> GM-paid billing (~10/1, post-KS). North star:
[tasks/north-star.md](north-star.md).

Owners: `[PF]` Puffer Fish (arch/risk/SQL/infra) - `[HP]` Hunt & Peck (app code) -
`[E2E]` Playwright - `[Xero]` vision/canon/decisions - `[human]` specialist needed.

---

## TIER 0 - DONE (foundation, verified - confidence anchor)
- [x] PII/data exposure closed: both column revokes + write-path + whole-schema sweep, no leaks `[PF]`
- [x] RLS broad-read cluster, storage buckets, Thriver self-escalation, realtime campaign-scoping `[PF]`
- [x] Health-endpoint DoS cap, log-visit body cap, FK/scale indexes present, uptime monitor + pager `[PF]`
- [x] Core table-loop reliability (tactical-map render + 2-client gate), onboarding trio `[HP]`
- [x] ~892 unit tests + Playwright E2E on pre-commit/CI; live gates (publication, db-emdashes) clean

---

## TIER 1 - PLATFORM-READY (ACTIVE - clear before large-scale playtests)

### Scale & load
- [ ] **M-3** remove the redundant 3s vehicles poll (~167 req/s idle at 500 concurrent) `[HP]`
- [ ] **T2-4** incremental realtime payloads (character_states / chat_messages / roll_log refetch -> payload-apply); careful 2-client pass, merge risk `[HP]`
- [ ] **T2-5** batch campaign-clock drainers (low priority; modest benefit, clobber risk) `[HP]`
- [ ] Load/soak test the table page at ~50-100 concurrent before trusting 500 `[E2E/PF]`
- [ ] Confirm Supabase tier headroom (connection pool, DB CPU) for the cohort `[PF + Xero on plan]`
- [ ] Rate-limit surface review beyond /health + log-visit (auth/signup endpoints) `[PF]`

### Reliability, ops & incident readiness
- [ ] Finish Sentry alert-rule routing (the split-out ~5-min task) `[Xero/PF]`
- [ ] Written incident runbook: what players see if X breaks, how we know, rollback + speed `[PF]`
- [x] **Staging/preview environment - DONE + smoke-verified 2026-07-01** `[PF/Xero]`. Staging Supabase at exact prod parity; Vercel Preview env split (prod->Production, staging->Preview); `staging` branch -> Preview deploy. Smoke PASSED: a fresh signup on the Preview URL shows an empty world (no campaigns/stories/pins) = reading staging, not prod. Risky SQL/RLS/schema now route through `tasks/workflow-staging.md`. (Minor: staging Auth Site URL still defaults to localhost - email confirmation disabled on staging, so harmless; set Site URL if email flows ever need testing there.)
- [ ] Confirm Supabase automated backups ON + run a test restore drill `[PF + Xero on plan]`
- [ ] Backup of user-uploaded storage (images) separate from the DB `[PF]`

### Test coverage & proof
- [ ] Broaden E2E over the core loops (combat, travel-equivalent, join, character create) `[E2E]`
- [ ] A repeatable load-test harness/script (feeds the soak test above) `[E2E/PF]`

### Trust & safety TOOLING (engineering only - the policy is TIER 2)
- [ ] Report/flag flow for UGC (posts, war stories, modules, uploaded images) `[HP]`
- [ ] Audit moderation tooling coverage for Thrivers (hide/ban/lock at scale) `[PF audit -> HP]`
- [ ] Confirm image-upload abuse posture (size/type caps) on EVERY storage bucket `[PF]`

### Platform hygiene
- [ ] robots.txt + sitemap (none exist) + decide pre-launch crawl posture `[HP]`
- [ ] OG/meta tags + social preview cards for landing + shared invite links `[HP]`

### Open gameplay issues (engineering)
- [ ] Hidden-NPC fog occlusion - token SHOW only renders when the player can see the cell `[HP]`
- [ ] Gus inventory-gun "Equip from Inventory" filter drops non-catalog-named guns (PARKED, Xero watching for repro) `[HP]`
- [ ] Disarm-loot live-verify owed (2-client: disarm -> ground token -> loot -> Ready -> fire) `[Xero+HP]`
- [ ] T3-6 jargon inline tooltips (CDP/RAPID/AMod/SMod/CMod) for first-timers `[HP]`
- [ ] map_pins "View pins" dead capital-`Thriver` policy clause - harmless cleanup (post-Beta-500) `[PF]`

### Game-content / canon (Xero-blocked - parallel to engineering)
- [ ] Weapons audit: add missing (Revolver) + damage-balance pass - canon numbers are Xero's call `[Xero+HP]`
- [ ] David Battersby pregen bio reads pre-Chased but ships Chased-era backstory - needs corrected text `[Xero]`
- [ ] Lv4 Skill Trait auto-bonuses - ship together or not at all; blocked on the full list `[Xero]`

### >>> EXIT CRITERIA - "platform-ready" (then switch to large-scale playtests)
All Scale + Reliability + Test + Trust&Safety-tooling boxes checked; a clean soak test at
target concurrency; staging env live; backups proven restorable; incident runbook written.
Open gameplay issues either fixed or consciously parked. When this holds -> open large-scale
playtests, and only then start TIER 2.

---

## TIER 2 - PARKED until platform-ready + playtests underway

### Legal & compliance (needs a real human before public/paid)
- [ ] Privacy Policy + Terms content lawyer-reviewed (pages exist; adequacy != existence) `[human]`
- [ ] GDPR: data-export + delete-my-account flow, cookie/consent posture `[human + HP]`
- [ ] COPPA / age gate (a TTRPG will attract minors) `[human]`
- [ ] Email compliance (unsubscribe, sender identity) for any broadcast `[Xero]`
- [ ] Module IP/licensing clarity for user-generated `/rumors` content `[Xero/human]`

### Payments & billing (post-KS ~10/1 - BRIGHT LINE, confirm before build)
- [ ] Stripe: GM-paid model, checkout, webhooks, dunning, refunds `[HP + Xero on Stripe acct]`
- [ ] Tax handling (US sales tax / VAT) `[human]`
- [ ] Billing RLS + "what can they access when they stop paying" rules `[PF]`

### Trust & safety POLICY (vs the tooling in Tier 1)
- [ ] Written moderation policy + abuse-response plan `[Xero]`

### Marketing / Kickstarter / public surface
- [ ] Public landing polish + `[PLACEHOLDER]` copy sweep `[HP/Xero]`
- [ ] KS page: video, tiers, copy, art `[Xero]`
- [ ] Frictionless demo/trial path a KS backer can touch `[HP/Xero]`
- [ ] Pre-launch audience + email list `[Xero]`
- [ ] Third-party security audit before paid users at scale (self-review != audit) `[human]`

---

## How the lanes burn this down
Tier 1 only, until exit criteria hold. Each lane pulls items in its own column, updates
`tasks/active-lanes.md` + checks the box here on ship. PF drives sequencing + the
infra/ops/scale items; HP the app-code + gameplay; E2E the coverage + load proof. Tier 2
stays untouched until Xero flips it on post-playtest.
