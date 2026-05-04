# Scaling plan — Tiers A → B → C

Roadmap from "ship to 50 invited testers" through "open to 1000+ public users." Tier D (50K+) is its own beast and lives outside this doc.

Each item is sized + tagged with type:
  - 🟦 **Code** — I can ship without input
  - 🟨 **Vendor** — Xero clicks through a 3rd-party UI (Cloudflare, Sentry, Resend, etc.)
  - 🟧 **Content** — copy / press / docs Xero writes
  - 🟥 **Process** — operational rhythm Xero runs

---

## Sprint 1 — Tier A foundations (~1 day)

**Goal:** safely open to 50-100 invited testers. Everything below this point hardens the platform against accidental damage from trusted users.

### Code (ship-able this session)
- [ ] 🟦 **Invite-code signup gate** — table `signup_codes (code, max_uses, used_count, created_by, expires_at)` + RLS that blocks `auth.signUp` until a valid code is provided. Wire into `/signup` form. ~1-2 hours.
- [ ] 🟦 **Rate limits** — per-user-per-hour caps via a `rate_limits` table + helper RPC. Apply to: `whispers` (60/hr), `forum_threads` (10/hr), `war_stories` (5/hr), `lfg_posts` (5/hr), `map_pins` (50/hr), `bug_reports` (10/hr). ~1 hour.
- [ ] 🟦 **Account suspension** — `profiles.suspended_until timestamptz`; RLS predicate on every write-table denies inserts/updates when `now() < suspended_until`. ~1 hour.
- [ ] 🟦 **`/moderate?section=bugs`** — Thriver triage view of `bug_reports`. Sort by recency, status filter. ~30 min.

### Process
- [ ] 🟥 **Weekly triage rhythm** — pick a day (Sundays?). Walk the bug-reports queue, mark status, ship critical fixes. Document on the public roadmap.

---

## Sprint 2 — Tier B reviewers (~1 day)

**Goal:** ready for press / reviewers. First impression matters disproportionately.

### Content
- [ ] 🟧 **Press kit** — Notion or Google Doc, public link. One page: what The Tapestry is, what it does, what's distinctive vs Roll20/Foundry/Owlbear. Screenshots, founder quote, contact email. Embargo language template. ~2-3 hours.
- [ ] 🟧 **FAQ for reviewers** — anticipated questions with thoughtful answers. "Is this open source?" "Self-hostable?" "Roll20 competitor?" "Business model?" "Audience size goal?" ~1 hour.
- [ ] 🟧 **Beginners' guide commit** — currently `docs/beginners-guide.txt` exists on disk uncommitted. Commit it (and the per-chapter files), surface from /welcome.

### Code
- [ ] 🟦 **Demo campaign seed** — "Try the demo" button on /stories/new that creates a fresh campaign pre-populated with NPCs / pins / scenes / handouts from a "Demo" setting (could reuse Mongrels content). User auto-enrolls as GM. Lets reviewers see the platform in 15 min instead of 30. ~3-4 hours.
- [ ] 🟦 **/welcome chapter cards for beginners' guide** — under "A Guide to the Tapestry," a card per chapter with "Read" links to the docx (or inline static pages). ~1 hour.

### Process
- [ ] 🟥 **Embargo plan** — pick a coverage date, send press kit + access N days before, ask for embargo until that date. Standard indie-game playbook.

---

## Sprint 3 — Tier C cliff (~3-5 days)

**Goal:** open public signup safely. Everything below is non-negotiable before that. Skip any of these and you're a news story when something goes wrong.

### Image scanning (CRITICAL — legal exposure)
- [ ] 🟦 **CSAM-detection on every image upload** — Hive Moderation, Cloudflare Images Moderation, or AWS Rekognition. Wire into the upload pipeline (account-avatars, character-portraits, pin-attachments). Block + queue for review on hits. ~half-day. **Mandatory before public signup.** Federal law in US; immediate platform takedown by Vercel if reported.

### Anti-abuse
- [ ] 🟦 **CAPTCHA on signup** — Cloudflare Turnstile (free). 30 min wire-up: add the widget to `/signup`, server-validate the token. ~1 hour.
- [ ] 🟦 **Block-user feature** — table `user_blocks (blocker_id, blocked_id, created_at)`. RLS predicates on `whispers`, `messages`, `forum_replies`, `war_story_replies`, `lfg_post_replies` filter out blocked-user content. UI: button on AuthorBadge / user profile cards. ~3-4 hours.
- [ ] 🟦 **Report-content + report-user buttons** — `content_reports` table; `/moderate?section=reports` queue. ~3 hours.

### Operations
- [ ] 🟨 **Cloudflare Turnstile account** — sign up, generate site keys (free). ~10 min.
- [ ] 🟨 **Sentry integration** — sentry.io account, install `@sentry/nextjs`, paste DSN into env vars, deploy. Catches every uncaught error in the wild. ~30 min vendor + 30 min code = ~1 hour total. Free tier covers 5K errors/mo which is enough for Tier C.
- [ ] 🟨 **Status page** — Better Stack (~$0-30/mo) or Statuspage.io. ~30 min vendor setup. Pin to status.thetapestry.com (DNS CNAME) or similar.
- [ ] 🟨 **Cost alarms** — Supabase project → settings → usage alerts at 75% of every quota. Vercel → settings → spending limit. ~30 min vendor.
- [ ] 🟨 **Email deliverability** — finish the DNS records discussed earlier (Resend SPF + DKIM + DMARC). ~1 hour vendor + DNS propagation wait.
- [ ] 🟨 **Supabase Pro upgrade** — $25/mo when free tier limits get tight. Don't pre-upgrade; watch alarms.
- [ ] 🟨 **Vercel Pro upgrade** — $20/mo same logic.

### Reliability
- [ ] 🟦 **Backup restore drill** — actually try restoring from a Supabase backup to a fresh staging project. Document the runbook. ~1-2 hours including the test. Find any gotchas BEFORE you need them.
- [ ] 🟦 **Database performance pass** — run `EXPLAIN ANALYZE` on the 10 slowest queries. Add missing indexes. Audit `app/stories/[id]/table/page.tsx` for unbatched queries. ~3-4 hours.

### Compliance
- [ ] 🟦 **GDPR data export** — `/account` → "Download my data" button. JSON export of every row that references `user_id = me`. ~3-4 hours.
- [ ] 🟧 **Lawyer-reviewed Terms + Privacy** — current versions are beta-grade. Pay a TTRPG-savvy lawyer to review pre-public-launch. ~1-2 weeks turnaround.

### Public roadmap + changelog
- [ ] 🟧 **Public roadmap page** — `/roadmap` or external (Trello, Linear public board). Sets expectations, deflects "when is X coming." ~1-2 hours of curation from `letsgototheend.md`.
- [ ] 🟦 **Changelog page** — `/changelog` showing recent releases. Pulls from git log filtered to feat/fix commits. ~1-2 hours.

---

## Sprint 4 — Tier C polish (~1-2 days)

**Goal:** smooth-out the rough edges that exist between "Tier C launch-ready" and "Tier C feels good."

- [ ] 🟦 **Mobile responsiveness pass** — at minimum, /map + /campfire + /characters work usably on phones. (Tactical map can stay desktop-only with a "your phone is too small" hint.) ~1 day.
- [ ] 🟦 **Empty-surface bait** — first-time visitor to /campfire/forums sees "Be the first to post" + 2-3 in-character bot posts to seed the room. ~2 hours.
- [ ] 🟦 **Email digest** — weekly Sunday email summarizing what's happened in your campaigns. ~1 day.
- [ ] 🟧 **Support inbox** — `support@distemperverse.com`. Helpscout free tier or just IMAP. Documented response-time goal. ~1 hour.

---

## Out of scope for this plan

**Tier D (1000-50K users)** — distinct strategic exercise. Mostly operational maturity, not engineering. Deal with it after Tier C runs cleanly for 3+ months.

**Monetization (Phase 5D)** — orthogonal. Tackle when Tier C is stable and you have signal on willingness-to-pay.

---

## Suggested order tonight + this week

| When | Items |
|---|---|
| **Tonight (before playtest)** | None — ship-discipline says don't deploy 30 min before a session. |
| **Tomorrow morning** | Sprint 1 code: invite codes, rate limits, account suspension, /moderate?section=bugs. ~half day. |
| **Tomorrow afternoon** | Sprint 1 process: pick triage day. Sprint 2 code: demo campaign seed (~3-4 hr). |
| **Day 3** | Sprint 2 content: press kit + FAQ + beginners' guide commit. Mostly Xero writing. |
| **Day 4-5** | Sprint 3 code: image scanning, CAPTCHA, blocks, reports. ~2 days. |
| **Day 6** | Sprint 3 vendor: Sentry, Turnstile, status page, cost alarms. ~half day clicking through portals. |
| **Day 7** | Sprint 3 reliability: backup drill, DB perf pass. Sprint 4 polish opportunistically. |
| **Week 2** | Lawyer review. Open Tier B (reviewers). |
| **Week 3-4** | Reviewers ship coverage; address feedback. |
| **Week 5+** | Open Tier C public signup once everything above is green. |

---

## Cost trajectory

| Tier | Monthly cost (vendor) |
|---|---|
| A (50-100 invited) | $0 |
| B (25-50 reviewers) | $0 |
| C (1000-2000) | ~$120-180/mo (Supabase Pro $25 + Vercel Pro $20 + Sentry $25 + image scan $20 + status page $30 + Resend Pro $20) |
| D (1000-50K) | $1500-5000/mo |

---

## Order rationale

1. **Tier A code first** — locks down the platform against your invited testers. Worst case if you skip it: a buggy tester accidentally creates 10K rows. Recoverable.
2. **Tier C image scanning second** — non-negotiable legal blocker. If you skip it AND open public signup, criminal liability is real.
3. **Tier C anti-abuse third** — prevents the platform from becoming hostile to its own users.
4. **Tier C operations fourth** — when something breaks (it will), you need to know about it (Sentry) and tell users (status page).
5. **Tier B content interleaved** — content takes calendar time (your writing). Start it early so it's ready when you want reviewers.
