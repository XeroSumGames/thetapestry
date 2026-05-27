# Launch Plan: Limited Public, 2026-06-15 (SUPERSEDED 2026-05-20)

> **STATUS: ARCHIVED.** Xero redirected 2026-05-20: stop optimizing around a launch date. **CURRENT anchor (2026-05-27): [tasks/north-star.md](north-star.md)** - the real timeline is Beta-500 7/1 -> 9/1 Kickstarter (TheTapestry only) -> billing ~10/1 post-KS. The "2026-06-15" in this filename + body is DEAD; do not act on it. (Earlier active plan: [tasks/puffer-fish-platform-plan.md](puffer-fish-platform-plan.md).)
>
> This file is preserved for the audience-reframe + per-role gap analysis + outsourcing-options + invite-code-gate explainer content. The dated timeline + freeze-week + reviewer-outreach windows are NOT active. Do not act on the timeline below.



Target audience: **reviewers, YouTubers, bloggers**. Not paying users. Not closed beta. Content-creators who will publish what they see, get linked from press releases, and shape early public perception. ~26 days from this plan's authoring (2026-05-20).

Composed in the puffer-fish lane; tactical follow-through belongs to the hunt-and-peck lane. This doc is the source-of-truth for "what we need to focus on between now and 6/15." Update it as items close.

---

## Reframe: why this is NOT closed beta

- These are **content-creators**. They publish what they see. Bugs go on YouTube and stay there.
- They are NOT paying. So optimize for **reputation cost** + **funnel-conversion downstream**, not revenue at this stage.
- They arrive cold via a link, not a personal invite. **First 5 minutes are everything.**
- They will hit edge cases the 10-person playtester group never has.
- They will publish before they understand the product. **Polish > depth.**
- Hostile-ish content (a YouTuber farming drama) is a real risk; resilience to "I tried to break it" coverage matters.

---

## Per-role gap analysis (as of 2026-05-20)

### Architect
- Architecture serves ~10 concurrent playtesters today. Break point under 50-200 concurrent users is unknown.
- 13,192-line `app/stories/[id]/table/page.tsx` = high bug-investigation cost when something breaks mid-session.
- No CDN strategy beyond Vercel defaults.
- Supabase Free tier connection limits unknown under load.
- Realtime channel scaling untested: 10 files use `.channel(`; 200 concurrent users = 2000+ subscriptions.

### Senior eng
- `damage_json: ... as any` casts in combat code = bug class fires on edge inputs.
- No integration tests; no E2E.
- **No staging environment** = cannot rehearse the launch path before reviewers walk it.

### QA
- 411 unit tests cover pure helpers. Zero component / integration / E2E coverage.
- Multi-client realtime desync = manual-repro only. With reviewers self-publishing bug reports as content, every desync becomes a video.
- Bug-report tool exists; not scale-tested for "200 strangers file overnight."

### Security (five must-close)
1. **L-3 KV rate-limiter** (`@vercel/kv` + `@upstash/ratelimit`). Bots will target the launch window.
2. **CSP headers + SRI** on Turnstile / Sentry scripts. Currently unverified.
3. **Storage bucket-level policies** at the Supabase dashboard. Currently unverified.
4. **Secret rotation playbook.** If a key leaks mid-launch, need 10-min response, not 2 hours.
5. **Privacy Policy + TOS update** for non-paid public use. Reviewers WILL link to these.

### SRE / ops
- **Biggest single gap: no PITR.** Free Supabase = if data corrupts, recovery is "we can't." Reputational suicide for a public launch.
- R4 Sentry -> Slack runbook ready, not executed. Means "we'll know about outages when a YouTuber tweets."
- No incident response runbook for launch day.
- Y12 backup drill not run; RTO is "unknown hours."
- Vercel + Supabase combined SLA on Free tier: no commitment.

### Product
- Onboarding flow audit is open (audit residue).
- First-time visitor without invite link sees... the login page with no context. No public landing page.
- No public roadmap stub for "what's coming."
- No demo session / screenshots / 2-min walkthrough video for reviewers who want to see before installing.

### Business
- **Press kit does not exist.** Reviewers expect: logo files (PNG + SVG), 3-5 hero screenshots, key messaging (3-5 sentences), founder bio (1 paragraph), embargo-coordination email.
- Embargo / coordinated launch timing requires outreach **2-3 weeks ahead = by 5/25-5/28 at the latest** if you want anyone published on 6/15.
- Pricing visibility decision: hidden or shown? If hidden, reviewers ask. If shown, must be defensible.

### UX
- Visual polish: any UI surfaces with "TODO" copy, alpha debug widgets, or unfinished states visible?
- **Mobile responsive:** likely poor today; reviewers will check.
- Accessibility: keyboard nav, color contrast, alt text.
- Error states: what does a 500 look like?
- Help / FAQ surface: where does a confused reviewer go?

---

## Ranked punch list

### MUST-DO (blocks launch; reputational floor)

| # | Item | Owner / lane | Effort | Cost |
|---|---|---|---|---|
| 1 | **Supabase Pro + PITR upgrade** | Xero approval (bright line) | 1h setup | ~$125/mo |
| 2 | **L-3 KV-backed rate-limiter** (Upstash + @vercel/kv) | Xero approval (new SaaS dep), then hunt-and-peck | ~3h | $0-10/mo (Upstash free tier) |
| 3 | **R4 Sentry -> Slack click-through** | Xero (runbook ready at `tasks/ops-sentry-slack-setup-2026-05-20.md`) | ~15 min | $0 |
| 4 | **Privacy Policy + TOS update** | Lawyer review | 1-2 weeks | $500-2000 |
| 5 | **Public-facing landing page** | Hunt-and-peck + Xero (design call) | 1-2 days | $0 (in-house) |
| 6 | **Press kit** at `/press` or `/about` | Xero + hunt-and-peck | 1 day | $0-500 (if logo design needed) |
| 7 | **Y12 backup drill (live run + document RTO)** | Puffer-fish + Xero | ~2h | Pro upgrade gate |
| 8 | **Mobile responsive audit + fix worst breaks** | Hunt-and-peck | 1-2 days | $0 |
| 9 | **First-time user flow end-to-end audit + fixes** | Puffer-fish audit, hunt-and-peck fix | ~1 day audit + Nx fix sessions | $0 |
| 10 | **Help / FAQ surface (even a stub)** | Hunt-and-peck | 0.5 day | $0 |

### SHOULD-DO (high-leverage; reviewers WILL notice if absent)

| # | Item | Owner / lane | Effort |
|---|---|---|---|
| 11 | Modal unification finish (Gut Instinct + Group Check) | Hunt-and-peck | ~5h total |
| 12 | Mounted-weapon prefix-CAPS narrative | Hunt-and-peck | ~30 min |
| 13 | Accessibility pass (keyboard / contrast / alt) | Hunt-and-peck | 1 day |
| 14 | Demo session video or annotated GIF (2-3 min) | Xero | 2-4h |
| 15 | Error-state polish (custom 404 + 500) | Hunt-and-peck | ~4h |
| 16 | Lv4 Skill Traits ship | Xero supplies 22 missing traits; hunt-and-peck wires | 1-2 days once unblocked |

### COULD-DO (deferred or risk-accepted)

| # | Item | Why deferred |
|---|---|---|
| 17 | Table-page decomposition (FULL plan, 12-14 sessions) | Won't ship before 6/15; full decomp deferred. **PARTIAL carve-out available:** Phases 3.0 + 3.1 (8 steps, ~2980 LOC removed, leaf-only) can ship pre-launch over 5/20-6/7. Brings table page 13,192 -> ~10,200. Detailed sequencing in [tasks/page-tsx-decomposition-plan.md](page-tsx-decomposition-plan.md) "Launch-window carve-out" section. **Hard rule: NO Phase 3.4 (roll pipeline) or 3.5 (realtime) extractions within 14 days of launch** - riskiest single extractions per R1/R2 in the plan. |
| 18 | supabase/migrations adoption (R10 full) | Deferred per R10 doc |
| 19 | 15 orphan tables canonical DDL | Deferred |
| 20 | Full E2E test coverage | Too big for window |

---

## Timeline

### 5/20 - 5/24 (this week)
- **Stop landing structural work** in either chat.
- Punch list #1-#4 ship: Supabase Pro, KV rate-limiter, Sentry-Slack, start drafting Privacy/TOS for lawyer review.
- **By 5/24 night: send TOS+Privacy draft to lawyer.** Two-week turnaround budgets to 6/7.
- Begin press-kit content drafting (in parallel).

### 5/25 - 5/31 (post-playtest week)
- 5/25 playtest goes off; drain HOPED-FOR per `tasks/preplay-monday-morning-2026-05-25.md` after-section.
- Landing page (#5) + press kit (#6) ship.
- Mobile responsive + accessibility audit + fixes (#8, #13).
- First-time user flow audit (#9) executed (puffer-fish pass) + fixes start (hunt-and-peck).
- Y12 backup drill executed (#7) - **only possible after Supabase Pro lands**.
- **Reviewer outreach starts 5/28-6/1.** Send press kits with embargo dates. Lock in who's covering.

### 6/1 - 6/7 (polish week)
- Error states (#15), FAQ stub (#10), demo video (#14).
- Modal unification finish (#11), mounted-weapon narrative (#12).
- Lawyer-reviewed Privacy/TOS lands; deploy.
- Second-round fixes from any QA passes.
- Internal walk-through: full session as a stranger would. Time it.

### 6/8 - 6/14 (freeze week)
- **NO new features.** Bug fixes only. Document any P1 issues as "known and tracked" if not blocker-tier.
- Practice "site is broken" incident response: simulate an outage, run through the steps.
- Re-run `/stability-audit` on 6/12 for fresh-eyes pass.
- Re-run `node scripts/refresh-ledger.mjs` + Confidence Ledger triage.
- Xero pastes current Supabase tier / PITR / retention into `tasks/ops-backup-playbook-2026-05-19.md` verification block.
- Final pass: `tasks/preplay-monday-morning-2026-05-25.md` pattern adapted to a "Launch-day morning checklist."

### 6/15 launch day
- **All hands on Sentry-Slack alerts + bug reports.**
- No deploys after morning unless P0.
- Have the "we're aware of X, working on it" template pre-written for in-app + email.
- Xero glued to the phone for 8h. Pre-clear the day.

---

## Budget asks (bright-line items - Xero decides)

| Item | Cost | Decision deadline |
|---|---|---|
| Supabase Pro + PITR | ~$125/mo | This week (5/24) - blocks Y12 drill + #1 |
| Upstash KV (or @vercel/kv) | $0-10/mo | This week (5/24) - blocks L-3 |
| Lawyer for TOS + Privacy review | $500-2000 (one-time) | This week (5/24) - 2-week turnaround |
| Logo / press-kit design (if needed) | $0-1500 (one-time) | 5/28 if outsourced; $0 if you DIY |
| Demo walkthrough video producer (optional) | $0-2000 (one-time) | 6/1 if outsourced; $0 if you screenshare-and-narrate |

**Realistic floor:** $125/mo recurring + $500-2000 one-time (the lawyer). Everything else can be in-house if you accept the time cost.

**Realistic ceiling:** $125/mo + $5500 one-time. Worth it if launch coverage matters more than $5K.

---

## Puffer-fish moves (the easily-missed risks)

### 1. Legal exposure is the biggest non-technical risk

A reviewer publishes; a player signs up under the new Privacy Policy; six months later they ask for data deletion under GDPR or California's CPRA. Today's `delete-user` edge function is technically correct, but the Privacy Policy / TOS needs to:

- Explicitly mention beta status and data-loss possibility.
- Specify retention windows for `roll_log`, `chat_messages`, `whispers`.
- Have an explicit GDPR / CPRA section.
- Identify a "data controller" with a real email.

**Claude cannot write these defensibly.** Budget the lawyer review. Cheapest insurance against a viral "Tapestry violates GDPR" article.

### 2. Solo-dev bandwidth at launch is the underestimated risk

A YouTuber publishes Saturday 9am; 200 signups by noon, 10 bug reports by 3pm. Solo-dev capacity = triage while the press window is open. Counter-measures:

- **Schedule launch day on a day you can be glued to the phone 8 hours straight.** Not a Saturday morning if you have kids' soccer. Pick the day deliberately.
- Pre-write "we're aware of X, working on it" templates.
- Pre-write a "thanks for the coverage, here's what we're working on next" reply.
- Have someone (spouse, friend, hired contractor for the day) on standby to triage non-technical questions / route press inquiries.

### 3. Embargo coordination has a hard deadline that isn't obvious

If you want reviewers publishing on 6/15, they need the press kit + advance access by **5/28 at the latest** (about 2-3 weeks ahead). Miss this window and 6/15 becomes "soft launch, hope someone picks it up." Working backward from 6/15:

- 5/24: TOS + Privacy draft to lawyer
- 5/27: Press kit composed
- 5/28-6/1: Reviewer outreach + advance access
- 6/7: Lawyer-reviewed legal text deployed
- 6/14: Freeze
- 6/15: Launch

### 4. "Limited" needs a soft cap

"Reviewers, YouTubers, bloggers" is open-ended. If 50 sign up, you have 50 cold users testing simultaneously. Decide ahead of time:

- Is there an invite-code system gating signups? (Today: no.)
- If the launch goes viral on day 1, do you flip a "we're at capacity, join the waitlist" gate? (Today: no mechanism.)
- Or is signup unlimited and we accept the load risk?

**Recommend: ship a simple invite-code gate before 6/15.** Lets you control velocity if a YouTuber's video goes harder than expected.

---

## Open questions for Xero (decide this week)

1. **Will you pay for the Supabase Pro upgrade + lawyer review?** ~$125/mo + $500-2000 one-time. Without these, my recommendation is **delay the launch.** Public release without backups or legal review is asymmetric downside.
2. **Invite-code gate yes or no?** If yes, who builds it (hunt-and-peck) and by when (recommend 6/1).
3. **What day of week is 6/15?** It's a **Monday** (verified 2026-05-20 via `date -d`). Earlier draft said Sunday - that was wrong. Monday is OK but not great; reviewers tend to publish Tuesday-Thursday for traffic. Consider 6/16 (Tuesday) or 6/17 (Wednesday) instead.
4. **Press kit content - DIY or outsource?** Logo + screenshots you have; founder bio + key messaging you write. Decide.
5. **Demo walkthrough video - record yourself or outsource?** ~2-3 min content; outsourcing is the speed play, DIY is the auth play (creator-tier audiences respond to founder-on-camera).
6. **What's "limited"?** First 50 invites? First 100? Open?

---

## Maintenance

Update this file when:
- An item ships (mark with `[x]` + commit hash in the table).
- A new risk surfaces.
- Xero answers one of the open questions (write the decision below + date).
- The 6/15 date shifts (re-run the timeline).

After 6/15: archive this file as `tasks/launch-plan-2026-06-15-postmortem.md` with the actual outcome + what we'd do differently. Use the postmortem to refine the next launch plan.

---

## Status log

- 2026-05-20: Plan composed. None of MUST-DO items shipped yet. Xero decisions pending on the 6 open questions.
- 2026-05-20 (later): Xero answered 5 of 6 open questions:
  - **Supabase Pro + PITR:** DELAYING as long as possible. Risk accepted (no PITR = no recovery during launch if data corrupts). Revisit closer to launch; if Y12 drill timing forces it, drop the delay.
  - **Upstash KV:** APPROVED. Hunt-and-peck can ship L-3 KV-backed rate-limiter.
  - **Lawyer review:** APPROVED in principle. Xero has a lawyer on retainer; asking them for a TOS/Privacy specialist recommendation. Action item: get the recommendation + brief them on the work this week.
  - **Launch day:** 2026-06-15 verified as a **Monday** (was incorrectly stated as Sunday in original plan; corrected today). Monday is OK but not optimal; Tue 6/16 or Wed 6/17 get more press traffic. Final-day-of-week decision still open.
  - **Press kit + demo video:** DIY confirmed. Outsourcing fallback open if DIY stalls (see "Outsourcing options" section below).
  - **Invite-code gate:** RESOLVED 2026-05-20 = **HYBRID.** Optional code field on signup (empty = normal signup; filled = attribute + mark used) + a feature flag to flip it to REQUIRED if launch velocity needs capping. Queued for hunt-and-peck in `tasks/todo.md`. Logged in `tasks/decisions.md`.
- 2026-05-20 (latest): Dummies shipped for #5 (Landing page) + #6 (Press kit) - placeholder copy at `/publiclanding` and `/press`. Real copy + assets needed before reviewer outreach (target 5/28-6/1).

---

## Invite-code gate explained

**What it is:** a simple "you need an invite code to sign up" mechanism. A new column on a `signup_invites` table holds `{ code text unique, used_by uuid, used_at timestamptz, issued_to text, issued_at timestamptz }`. The signup form gets a required "invite code" field. The verify-turnstile route (or a sibling) checks the code, marks it used, and only THEN allows account creation. Codes that have been used become inert.

**Why you might want it for the launch:**
1. **Soft-cap launch velocity.** If a YouTuber's video goes harder than expected and 5,000 people try to sign up Saturday morning, the gate is the difference between "everyone gets in and the realtime channels saturate" and "first 50 get in cleanly, others see a waitlist message." Without the gate, the only velocity-cap mechanism is Vercel + Supabase rate-limits, which fail loudly (500 errors), not gracefully.
2. **Outreach attribution.** Give each reviewer a unique code prefix (`TAPESTRY-IGN-001`, `TAPESTRY-POLY-001`, etc.). When a player redeems it, you know which outlet drove them. Free analytics.
3. **Bad-actor filter.** If someone's scraping signups for bots, the invite code is a friction layer they have to obtain rather than just having a working email.

**Why you might NOT want it:**
1. Adds friction for cold visitors who hear about it from a friend ("you have to ask for a code first").
2. More code to maintain + an admin UI to issue codes (or a Thriver-only "mint code" button).
3. If a code leaks publicly (someone tweets theirs), the gate fails open until you revoke it.

**Estimated effort if you want it:** 1-2 hunt-and-peck sessions. Schema migration + signup-form field + verify-turnstile (or new) endpoint + a `/moderate` page section for issuing codes. Total ~6-10 hours.

**Recommendation:** ship the gate IF you expect press coverage to be sizable OR you want attribution data. Skip if the launch is small-scale and you'd rather see organic signups.

---

## Outsourcing options (DIY confirmed; fallback list)

Where to look IF DIY stalls and you need a contractor:

### Logo / press kit visual design
- **Fiverr:** $50-300 for a single logo. Higher tiers ($200-500) get you full kit + source files. Search "logo for tabletop RPG / video game brand."
- **99designs:** $400-800 for a competition where designers compete. Better range of options, higher floor on quality. Slower (1-2 weeks).
- **Dribbble:** message individual designers directly. $300-1500 typical. Highest quality, highest variance.
- **Local freelancer:** if you know a graphic designer through gaming friends, often best ROI.

### Demo video (2-3 min walkthrough)
- **Cheap-and-fast:** Loom or OBS yourself, voiceover during a real session, edit in iMovie / DaVinci Resolve. $0, ~6 hours of your time. Authenticity > polish for an indie launch.
- **Fiverr video editor:** $50-200 to clean up your raw screenrecording + add intro/outro/music. Keeps your voice + framing, polishes the edges.
- **Upwork video producer:** $500-1500 for a full edit pass with motion graphics, multiple cuts, b-roll. Overkill for a beta launch.
- **TTRPG YouTuber for hire:** some review-channel hosts will produce sponsored walkthrough content. $200-1000. Authenticity boost (their voice + their audience trust) but pre-publish to a single audience only.

### Screenshots
- **Free path:** in-app, hide the dev tools, screenshot at 1920x1080. Crop in any image editor. Time: ~30 min for 5 shots.
- **Polished path:** Fiverr screenshot mockup service ($30-80) takes raw shots + drops them into device frames + adds annotations.

### TOS / Privacy
- Already covered by your lawyer recommendation path. Budget $500-2000 once you get the specialist recommendation.

**Recommendation given the DIY decision:** lock in 4-6 hours over Memorial Day weekend (5/24-5/25) to draft press-kit copy + screenshots yourself + record the demo walkthrough. If you stall on the design polish, drop $80-150 on a Fiverr cleanup pass week of 5/26.
