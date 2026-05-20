# Tapestry - To Do & Backlog

> **CURRENT OPEN - 2026-05-15** lives at the top. Everything below the divider is the historical shipped log (don't trust those headings for current status - audit before quoting). Last full audit: 2026-05-15 (3 parallel Explore agents grepped every line item against live code + git log).

---

## 🎯 CURRENT OPEN - 2026-05-15

### SHIPPED 2026-05-20: Beginners' Guide v2
14 chapters as per-chapter txt files in `docs/`, voice-tightened per `feedback_user_guide_voice` (no em-dash, no step counts, no URL patterns, no Survivor/Thriver outside first-mention). Two NEW chapters vs v1: The Rules (Ch 5), Vehicles (Ch 11). One MERGE: Tactical Map + Fog of War (Ch 8). Chapter 13 (Campfire) has a placeholder paragraph where Forums would go - both Forums and Forums B are flagged for redesign before documentation. Chapter 14 (Rumors) is a full rewrite for the layered umbrella (modules + maps + pins). v1 monolith `docs/beginners-guide.{txt,docx}` left in place as archive. Build script at `scripts/build-beginners-docx.js` will regenerate the v2 docx once chapter content is approved.

**Next on this track:** rewrite the three older internal guides at `docs/user-guide.txt`, `docs/communities-guide.txt`, `docs/module-system-guide.txt` under the same voice rules (pre-voice-lock, heavier rewrite than the beginners' set).

### Puffer-fish platform plan (active 2026-05-20)
Full plan: [tasks/puffer-fish-platform-plan.md](puffer-fish-platform-plan.md). Xero redirected 2026-05-20: ignore the date-anchored launch plan; the mandate is making the platform as stable and optimized as possible. Multi-chat, no calendar pressure. 8 phases (P0-P8) sequenced by dependency; 6 measurable axes (bug-investigation cost / multi-client reliability / performance / recovery posture / security posture / test coverage); per-phase gate is playtest verification + substrate updates. Resume pointer at the bottom of the plan moves with every commit. **Launch plan (`tasks/launch-plan-2026-06-15.md`) is SUPERSEDED.**

### Launch plan ARCHIVED (was 2026-06-15)
Full plan: [tasks/launch-plan-2026-06-15.md](launch-plan-2026-06-15.md). Target audience was reviewers / YouTubers / bloggers. Composed 2026-05-20. **Superseded 2026-05-20** by the puffer-fish platform plan above. Per-role gap analysis + invite-code gate explainer + outsourcing-options content preserved in the file for reference, but the dated timeline is not active. Five of six Xero decisions from that plan were answered 2026-05-20; invite-code gate decision is still open if relevant later.
- [ ] **Approve Supabase Pro + PITR** (~$125/mo). Blocks Y12 drill + the entire backup story. Without this, my recommendation is delay launch.
- [ ] **Approve Upstash KV (or @vercel/kv)** ($0-10/mo). Blocks L-3 KV-backed rate-limiter; signup-fraud vector during launch window.
- [ ] **Approve lawyer for TOS + Privacy review** ($500-2000 one-time). Cheapest insurance against a viral GDPR/CPRA article. 2-week turnaround means draft to lawyer by 2026-05-24.
- [ ] **Decide invite-code gate** yes/no for soft-capping launch velocity. If yes, hunt-and-peck builds by 2026-06-01.
- [ ] **Confirm launch day** (6/15 is a Sunday; reviewers publish Tue-Thu; consider 6/16 or 6/17).
- [ ] **Press kit content + demo video** - DIY or outsource.

**MUST-DO (10 items)**, **SHOULD-DO (6 items)**, **COULD-DO (4 items)** ranked in the launch plan with effort + cost. Week-by-week timeline 5/20 -> 6/15.

### Stability audit (2026-05-19, post-playtest)
Full punch list: [tasks/stability-audit-2026-05-19.md](stability-audit-2026-05-19.md). Read-only audit; items below are the action checklist sorted by severity.

**HIGH**
- [x] ~~**H-1 Upload pipelines - `safeUploadKey()` helper + apply at 7 sites.**~~ SHIPPED 2026-05-19. `lib/safe-upload.ts` defines `prepareUpload(bucket, file)` returning `{ ok, filename, contentType }`. Sanitizes filename (strips path traversal, replaces unsafe chars with underscore, NFKD-strips accents, caps stem to 80 + ext to 8), enforces per-bucket size caps (10 MB attachments, 5 MB module-covers), maps extension to a whitelisted contentType (image/jpeg, image/png, image/gif, image/webp; pdf + txt only in attachment buckets). SVG excluded everywhere (script-execution risk). Applied at: table page session-attachments, CampaignMap pin-attachments, MapView pin-attachments (new + edit), GmNotes note-attachments, war-stories, rumors module-covers. 20 unit tests in `tests/lib/safe-upload.test.ts`.
- [x] ~~**H-2 verify-turnstile rate limit + body cap.**~~ SHIPPED 2026-05-19. `app/api/auth/verify-turnstile/route.ts` now enforces 30 req/min/IP via in-memory token bucket (x-forwarded-for keyed, stale-bucket sweeper) + 4 KB body cap (returns 413 if exceeded) + JSON parse guard (returns 400 if invalid). Rate-limit response returns 429 + `Retry-After` header. **Upgrade path:** when paid-signups open, swap in `@vercel/kv` + `@upstash/ratelimit` for distributed enforcement; in-memory bucket leaks ~N × LIMIT across N warm instances (see L-3 below).

**MEDIUM**
- [x] ~~**M-1 `npm audit fix` scoped to brace-expansion + ws.**~~ NO-OP 2026-05-19. Both already at fixed versions in package-lock.json (brace-expansion 5.0.6, ws ^8.18.2). The 2 remaining moderate vulns are postcss-via-next and only fix via `npm audit fix --force` which downgrades next to 9.3.3 (breaking) - held per security-audit.
- [x] ~~**M-2 Confidence Ledger drift mechanism.**~~ SHIPPED 2026-05-19. `scripts/refresh-ledger.mjs` parses vitest summary (`Test Files N passed`, `Tests N passed`, per-file `✓ tests/lib/X.test.ts (N tests)`, `Duration Nms`) and rewrites the `- **TESTED (automated):**` line in `tasks/debug-handoff.md` Sec 3. Fingerprint-based drift check (test count + file count + per-file breakdown) - duration + last-refresh date are rendered but excluded from the diff so `--check` doesn't fire false positives. Usage: `node scripts/refresh-ledger.mjs` to drain, `node scripts/refresh-ledger.mjs --check` to detect (exit 1 on drift). Auto-refresh signature in the line itself (`(Auto-refreshed YYYY-MM-DD via scripts/refresh-ledger.mjs.)`) so future Claudes find the fix path by grep. Hook integration intentionally deferred - vitest-on-every-commit + auto-stage trade-offs are not worth the extra friction; the 3-hour health-pulse is the natural drift detector and now has a single-command drain.
- [x] ~~**M-3 Dedupe todo.md per 2026-05-19 12:05 UTC health-pulse.**~~ SHIPPED 2026-05-19. Coordinated Effort bespoke chain summary banner was already `[x]` (line 117, `137be68` + `9a3eb94`); confirmed. Refreshed the stale dedup-placeholder note (line 81) to point at the current "Ready to build (medium)" section instead of stale absolute line refs. Removed the two third-copies of Modal Unification + CMod Stack from the historical "From 2026-04-29 chat" section, replaced with single-line dedup notes that point at the canonical entries (per the "never delete backlog items silently" rule).
- [x] ~~**M-5 Vehicle 3s polling at `app/stories/[id]/table/page.tsx:3153`.**~~ REJECTED 2026-05-19. Audit recommendation was wrong on hypothesis. Code comment at lines 3131-3137 explicitly documents "*four independent paths because a single one keeps dropping under load*" - commit `052e52b fix(vehicle): 4 signals for cross-tab vehicle-update propagation`. The polling is a deliberate last-resort guarantee under known single-channel reliability problems, not redundant defensiveness. Dropping it would re-introduce the bug that commit was designed to fix. Lesson: audit recommendations are hypotheses; verify against in-code comments + commit history before acting. (Extension of the "stale audit line numbers" lesson - audit *conclusions* go stale too.)

**LOW**
- [x] ~~**L-1 Stale TODOs.**~~ SHIPPED 2026-05-19. (a) `lib/campaign-snapshot.ts:22` swept - the "TODO once tables are in use" was stale (tables in use across 19 files); inline comment replaced with a permanent note explaining why communities are out of snapshot scope, real work promoted to "Bigger builds" above. (b) `app/campfire/timestamp/page.tsx:8` swept - the "(TODO)" was overtaken by shipped work; HammerTime renderer landed via `855a10c` and lives in `lib/rich-text.tsx` (TOKEN_RE at L19, HammerTimeChip at L50). Comment updated to point at the actual implementation.
- [x] ~~**L-2 `app/dashboard/page.tsx:52` accesses `profile.role` directly.**~~ SHIPPED 2026-05-19. Surprise root-cause fix: `userRole` state was completely unused (declared line 29, set line 52, never read). The "swap to a helper" recommendation would have wrapped a dead write in nicer syntax. Removed the dead state + setter call entirely. Permission branches use `roleIsThriver(profile)` already. tsc + role-literal guardrails clean.
- [ ] **L-3 verify-turnstile: upgrade to KV-backed rate-limiter before paid signups.** Current in-memory bucket leaks ~N × LIMIT across N warm Vercel instances. Add `@vercel/kv` + `@upstash/ratelimit` (Upstash has a free tier; flag for Xero before installing). Pre-paid-signups blocker.

**Risk Register triage (TRIAGED 2026-05-20)**
- [x] ~~**Demote `lib/campaign-clock.ts` YELLOW -> GREEN-ish**~~ DEMOTED 2026-05-20. Phase 3 drainers playtested green 2026-05-18, no functional changes since.
- [~] **`roll_log` writer YELLOW HELD** one extra cycle. 2026-05-19 added new write paths (Advantages `advantage_used` outcome + C3 broadcast, FI single-modal cutover, Stress 12-string narrative, Stabilize Phase 1 cascade) + outcomeColor dedup widens the consumer surface. Re-evaluate post-2026-05-25 playtest.
- [x] ~~**Demote Initiative state machine YELLOW -> GREEN-ish**~~ DEMOTED 2026-05-20. No stuck-turn reports through 2026-05-18 playtest; Stabilize Phase 1 exercises consumeAction synchronously without breakage.
- [x] ~~**Demote TacticalMap canvas YELLOW -> GREEN-ish**~~ DEMOTED 2026-05-20. Effective fog cache + drag-end fix + GM Share View all playtested green / additive-only.
- [~] **Table page YELLOW HELD.** Now 13,192 lines (Stabilize Phase 1 added +200). `useHeaderMenus` (2426e5b) is the first real extraction; need 3-4 more before demote. The Stabilize/Distract/FI/Recruit-modal pattern repeating in-file hardens the case for going wider on the decomposition plan.

### Pre-launch audit (2026-05-17, structural)
Full punch list: [tasks/pre-launch-audit-2026-05-17.md](pre-launch-audit-2026-05-17.md). Items below are the operational checklist.

**Phase 2 follow-ups (surfaced by today's drift report, [tasks/schema-drift-report-2026-05-17.md](schema-drift-report-2026-05-17.md))**
- [ ] **15 orphan tables** - no canonical CREATE TABLE in sql/. Tier 1 (`profiles`, `campaigns`, `characters`, `character_states`, `campaign_members`), Tier 2 (`roll_log`, `chat_messages`, `notifications`), Tier 3 (`campaign_notes`, `map_pins`, `session_attachments`, `sessions`, `user_events`, `visitor_logs`, `world_npcs`). Same reverse-engineering pattern as `sql/000-initiative-order-canonical-2026-05-17.sql`. ~3-5 sessions total. **Do NOT touch `characters` / `character_states` / `profiles` until after the 2026-05-18 playtest.**
- [x] ~~**1 orphan trigger**~~ - SHIPPED 2026-05-17 (`3fc28e6`). `notify_character_changed()` function was defined in `sql/update-player-joined-trigger-v3.sql` but the matching CREATE TRIGGER had only been applied manually in the dashboard. Added DROP IF EXISTS + CREATE TRIGGER block to the bottom of the same file (v3 migration now self-contained) and re-applied to live (no-op as expected).

**Cleanup follow-ups (low priority, do during next surrounding-feature touch)**
- [ ] **Dead client-side moderation_status logic** at `app/campfire/forums/page.tsx:270` and ~5 sibling sites (war-stories, lfg, modules). Trigger from Y3 (sql/moderation-enforce-trigger-2026-05-17.sql) now overrides for non-thrivers. Safe to leave; clean up when forums/war-stories/lfg gets its next refactor pass.

**Phase 3 planning artifact**
- [ ] **`page.tsx` decomposition plan** at [tasks/page-tsx-decomposition-plan.md](page-tsx-decomposition-plan.md) - 18-step extraction sequence over ~12-14 sessions, with per-step LOC removal targets + smoke gates + risk register. Read this before starting Phase 3. **2026-05-20 updates:** step 2 (useHeaderMenus) shipped via 2426e5b. File grew to 13,192 lines from 12,429 over Stabilize Phase 1 + Distract Phase 2 modal migrations. **Pre-launch carve-out defined (Phases 3.0 + 3.1, 8 steps, ~2980 LOC removed):** steps 1/3/4 (types/recorder/broadcasts) → step 5 (GmTools+GmModalStack) → steps 6/7/8 (specials/recruit/trade). Targets 5/20-6/7. Hard rule: no Phase 3.4 (roll pipeline) or 3.5 (realtime) within 14 days of launch.

**Pre-playtest verification (2026-05-18)** - CLOSED (playtest happened 2026-05-18; both items implicitly covered, neither has been re-flagged in 2 days).
- [x] ~~**Sentry pipeline check**~~ - Verified 2026-05-18 (`/monitoring` tunnel returns 200, SDK loaded). Latest re-verify in `tasks/session-prep-2026-05-25.md`.
- [x] ~~**2026-05-13 batch watch-fors**~~ - 2026-05-18 playtest passed (no fresh bug reports against the Phase 3 a/b/c/d drainers); confidence ledger demote-candidate annotation in `tasks/debug-handoff.md` §1.


**Phase 0 - Observability + security YELLOW (do BEFORE any structural refactor)**
- [x] ~~**R1 - Sentry PII scrub.**~~ SHIPPED 2026-05-17 (`1894455`). `sendDefaultPii: false` across all three configs; `beforeSend` scrubs `code`/`token`/`access_token`/`refresh_token` URL params + `[Filtered]`s Authorization + Cookie headers.
- [x] ~~**R2 - Sentry sample rate.**~~ SHIPPED 2026-05-17 (`1894455`). `tracesSampleRate: 0.1` on all three configs; exceptions stay at 1.0.
- [x] ~~**R3 - Sentry user context.**~~ SHIPPED 2026-05-17 (`1894455`). `Sentry.setUser({ id: user.id })` wired into `lib/auth-cache.ts` - central choke point, covers every consumer of `getCachedAuth`. ID only, no email/username/role.
- [~] **R4 - Slack webhook.** RUNBOOK READY 2026-05-20. [tasks/ops-sentry-slack-setup-2026-05-20.md](ops-sentry-slack-setup-2026-05-20.md) documents the click-through: recommended path (Sentry's built-in Slack OAuth integration), fallback path (Slack Incoming Webhook), recommended starting alert config (new-issue + issue-spike, skip transaction perf), and post-wiring updates to operating-mode + todo. Can't be done from Claude's side (needs Xero's Sentry + Slack workspace logins). ~15 min click-through; close R4 fully once Xero executes the runbook.
- [x] ~~**R5 - `/api/health` endpoint.**~~ SHIPPED 2026-05-17. `app/api/health/route.ts` returns `{ status, checks: { db }, ms, ts }`. 200 when DB reachable, 503 otherwise. No auth required, no PII exposed, `force-dynamic` so it never caches. Ready to pair with Pingdom / StatusCake / etc. - point a 1-minute poller at `/api/health` and you get production-uptime visibility for free.
- [x] ~~**R6 - Realtime handler try/catch.**~~ SHIPPED 2026-05-17. `lib/sentry-realtime.ts` exposes `wrapBroadcast(name, fn)` + `wrapDbChange(name, fn)`; every realtime listener in `app/stories/[id]/table/page.tsx` is wrapped (18 broadcast + 12 postgres_changes = 30 handlers). Exceptions go to console + Sentry with `realtime_kind` + `realtime_event` tags; one bad payload no longer breaks the dispatch chain. Direct prep for Phase 3 page.tsx decomposition - every handler is now an independently-observable failure mode.
- [x] ~~**Y1 - Edge function role normalization.**~~ SHIPPED 2026-05-17. delete-user role compare now `String(caller?.role ?? '').toLowerCase() !== 'thriver'` - defense-in-depth normalization on top of the DB trigger lowercase.
- [x] ~~**Y2 - `notify-thriver` caller auth.**~~ SHIPPED 2026-05-17. Function rejects 403 unless `Authorization` header exactly matches `Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Legitimate caller is pg_net via `call_notify_thriver()` which already sends that header. External URL-stuffing can no longer spam Thriver inboxes.
- [x] ~~**Y3 - moderation_status CHECK / RPC.**~~ SHIPPED 2026-05-17. `sql/moderation-enforce-trigger-2026-05-17.sql` adds a BEFORE INSERT trigger to forum_threads, war_stories, lfg_posts that overwrites `moderation_status` / `approved_by` / `approved_at` based on the actual `auth.uid()` role and `campaign_id` scope. A crafted insert with `moderation_status='approved'` + fake `approved_by` is now silently corrected to `pending` (global) or `approved with approved_by=NULL` (campaign-scope). Thriver inserts are respected but `approved_by` is forced to the real `auth.uid()` so a thriver cannot credit a different thriver. Trigger is SECURITY DEFINER with locked search_path.
- [x] ~~**Y4 - `delete-user` derive caller from JWT.**~~ SHIPPED 2026-05-17. Caller identity now comes from `supabase.auth.getUser(token)` against the `Authorization` Bearer JWT. The legacy `caller_id` body field is still accepted (backward compat) but ignored. A spoofed body can no longer impersonate a Thriver to delete other users.

**Phase 1 - Scalability blockers**
- [x] ~~**R7 - Paginate lfg_interests.**~~ SHIPPED 2026-05-17. Split the unbounded `.from('lfg_interests').select(...)` into two bounded parallel queries: (1) `.eq('interested_user_id', myId)` - own interests, naturally bounded by user's own activity; (2) `.in('post_id', myAuthoredPostsInList)` - roster for my visible authored posts, bounded by PAGE_SIZE. Both fire via Promise.all.
- [~] **R8 - scene_tokens index + scoped subscription.** Partial index `idx_scene_tokens_archived_at ON (scene_id) WHERE archived_at IS NULL` already exists and covers the dominant "active tokens for scene X" query - audit was incorrect that no scene_id index existed. Subscription scoping deferred: scene_tokens RLS is campaign-member-gated so realtime broadcasts are naturally bounded to the user's campaign set, not "all scene changes globally." Followup work item if traffic surfaces it at scale: filter `postgres_changes` subscription by active scene_id and re-subscribe on scene switch (stateful subscription pattern).
- [x] ~~**R11 - Index hot tables.**~~ SHIPPED 2026-05-17. `sql/hot-table-indexes-2026-05-17.sql` adds: `idx_roll_log_campaign_created (campaign_id, created_at DESC)`, `idx_chat_messages_campaign_created (campaign_id, created_at DESC)`, `idx_notifications_user_created (user_id, created_at DESC)`. DESC ordering matches UI's newest-first reads. Verified live via pg_indexes.
- [~] **Y5 - Batch npc_relationships loop.** Verified 2026-05-17: the audit's claim of "N+1 loop over PCs" does NOT match current code. `loadRevealedNpcs` at L1083-1107 is a single batched `.in('npc_id', cnpcIds)` query, not a loop. The other npc_relationships sites (L2990, L3023, L3028) also batch via `.in()` / single insert. Audit was likely reading older code that's since been refactored. No change needed.
- [x] ~~**Y6 - Image upload size cap.**~~ SHIPPED 2026-05-17. `lib/image-utils.ts` exports `MAX_INPUT_BYTES = 10MB` + `ImageTooLargeError`; `resizeImage()` rejects oversize files before decoding. War Stories upload path at `app/campfire/war-stories/page.tsx:400` enforces the same 10MB cap and shows the user a friendly alert. Bucket-level size policy still TODO via Supabase dashboard.
- [x] ~~**Y7 - community_stockpile limit.**~~ SHIPPED 2026-05-17. `.limit(500)` added to the trade-modal stockpile query at `app/stories/[id]/table/page.tsx:769`. 500 is comfortably above realistic long-campaign stockpiles; the UX wouldn't render more anyway.

**Phase 2 - Schema sanity**
- [x] ~~**R9 - Canonical `initiative_order` DDL.**~~ SHIPPED 2026-05-17. `sql/000-initiative-order-canonical-2026-05-17.sql` reverse-engineered from live DB: 24 columns + types + defaults + NOT NULLs + FK on campaign_id (CASCADE) + ALL 5 RLS policies + thriver bypass. Idempotent. Bonus finding: added `idx_initiative_order_campaign (campaign_id, roll DESC)` - the table previously had ONLY the pkey, so every initiative load was a seq scan.
- [~] **R10 - Migration ordering discipline.** PARTIAL 2026-05-20. [tasks/ops-migration-discipline-2026-05-20.md](ops-migration-discipline-2026-05-20.md) codifies the current convention (229 SQL files in `sql/`, topic-named, manually applied via `npx supabase db query --linked -f`, idempotent-or-it-doesn't-ship, no `supabase/migrations/` directory yet) + the going-forward rules (date-suffix every new file, numeric prefix only for canonical DDL, inline dependency comments, commit body documents the apply). Deferred until Supabase Pro + staging project + second dev: full migration to `supabase/migrations/` proper with the one-time audit. Three open Xero questions logged (when to migrate to supabase/migrations/, scripts/apply-sql.sh wrapper, 15 orphan tables ordering prefix).
- [ ] **R12 - User-delete cascade for characters / character_states.** Define stance; fix FKs; add end-to-end deletion test.
- [x] ~~**Y11 - Soft-delete stance per table.**~~ SHIPPED 2026-05-19. [tasks/ops-soft-delete-stance-2026-05-19.md](ops-soft-delete-stance-2026-05-19.md) documents the four tables that soft-delete (`modules`, `scene_tokens`, `community_members`, `conversation_participants`) + the hard-delete default across ~30 other tables. Five open policy questions logged for Xero ruling (characters/character_states cascade depth, campaign-delete double-confirm, modules-style decision tree generalization, snapshot delete, roll_log session-clear). No schema changes - pure doc capturing current truth.
- [~] **Y12 - Backup / restore playbook.** PARTIAL 2026-05-19 (initial draft) + 2026-05-20 augmentations. [tasks/ops-backup-playbook-2026-05-19.md](ops-backup-playbook-2026-05-19.md) documents: Supabase tier-by-tier coverage (free = no PITR, Pro = +$100/mo add-on for 7-day PITR), in-app campaign-snapshot recovery (covers + limits), 6 recovery scenarios (single row / full campaign / db-wide / GDPR delete / storage object / single-row-surgery), the pre-migration ritual (`npx supabase db dump` before risky SQL), and the drill plan (~2h end-to-end). Still owed: (a) the actual drill against a real Pro project; (b) Xero pastes the current dashboard tier/PITR/retention into the verification block at the top of the doc. Drill is the closing item before paid signups.

**Phase 3-5** (the four committed structural workstreams from chat - sequenced AFTER Phase 0-2)
- [ ] **Decompose `app/stories/[id]/table/page.tsx`** (12,429 lines) - extract by concern into hooks + sub-components. Realtime subscription audit folds into this.
- *(Modal unification + CMod Stack dedup-removed 2026-05-19. Canonical entries live in "Ready to build (medium)" below - search for "Modal unification (5 of 6 remaining)" and "CMod Stack reusable component".)*
- [x] ~~**Stabilize migration to dedicated `<RollModal>` (Phase 1)**~~ SHIPPED 2026-05-20. The 🩸 STABILIZE dropdown now routes through a dedicated `<RollModal>` instance (table/page.tsx L12730+) backed by `lib/stabilize-helpers.ts` (pure outcome → narrative + 1d6-PHY incap roll, 10 unit tests). New `runStabilizeCascade` helper owns DB writes + optimistic state updates + progression log. The brittle `pendingRoll.label.includes('Stabilize ')` branch in `executeRoll` is preserved unreachable for one-playtest rollback safety (Phase 4 deletion). Surprise root-cause: the per-card Stabilize button on `CharacterCard.tsx:660` was using the PATIENT's own RSN/Medicine as the medic's stats (latent bug since inception); removed as part of the cleanup. Post-combat stabilize surface is now follow-up territory if playtest demands it. Tests: 400/400 (10 new). tsc clean. Phase 2 (Distract) + Phase 3 (First Impression) + Phase 4 (retire pendingRoll branch) chain behind.
- [x] ~~**Stabilize migration Phase 2 - Distract**~~ SHIPPED 2026-05-20. The in-combat Distract button now routes through a dedicated `<RollModal>` backed by `lib/distract-helpers.ts` (pure outcome → action-delta + narrative, 11 unit tests). New `runDistractCascade` helper owns the `initiative_order.actions_remaining` update + `turn_changed` broadcast. Target picker rendered via `preRollExtras` (Close-range candidates). Legacy `executeRoll` Distract branch preserved unreachable for Phase 4 deletion. Bonus cleanup: deleted the dead `applySocialAction` Distract branch (superseded by the in-combat button trigger but never removed). Tests 411/411 pass.
- [x] ~~**Stabilize migration Phase 3 - First Impression**~~ ALREADY SHIPPED 2026-05-19 via the parallel FI streamline track. The spec at tasks/spec-stabilize-migration.md was stale on this point - verified 2026-05-20 (FirstImpressionModal component + resolveFirstImpression resolver + 18 unit tests + 3 entry points all routing through the dedicated modal). Spec updated to reflect actual status.
- [~] **Stabilize / Distract / Gut Instinct Phase 4 - retire legacy executeRoll branches.** PRE-STAGED 2026-05-20 on branch `claude/phase4-prestage` (commit `a7b449b`). +12 / -108 lines, tests 419/419 pass, tsc + guardrails clean. NOT merged. Post-playtest merge: `git -C /c/TheTapestry fetch origin claude/phase4-prestage && git -C /c/TheTapestry merge --ff-only origin/claude/phase4-prestage && git -C /c/TheTapestry push origin main`. Verify all three modals fired correctly at the Monday 2026-05-25 playtest before merging.
- [ ] **Lasting Wound effect-text: Lost Eye + Crippled per-roll-CMod wording** - 2026-05-20 audit flagged 3 wounds whose `LASTING_WOUND_NARRATIVE` overrides used "-1 CMod on X checks" phrasing (per-roll) instead of the lasting form Xero locked for Skittish ("-1 Initiative Modifier"). Skittish itself fixed (`24b5504`). Remaining: `#2 Lost Eye` ("-1 CMod on Dexterity checks") and `#11 Crippled` ("-1 ACU attribute and -1 CMod on Perception checks"). Candidate fix per the Skittish principle: Lost Eye -> "-1 on Dexterity checks" (mirrors canon "-1 on checks using Dexterity"); Crippled -> "-1 Perception and -1 ACU" (mirrors canon "-1 Perception & -1 Acumen"). Awaiting Xero canon confirmation on the exact wording.
- [ ] **Post-combat Stabilize surface (if needed).** Per-card Stabilize button removed 2026-05-20 (broken stats). If a playtester needs to stabilize a mortally-wounded survivor outside the active-combatant header context, design a new surface (probably a popover on the patient's card asking "who is the medic?"). Currently survivors are stabilized in-combat or die during the death_countdown.

### Untested live

**2026-05-18 playtest punch-list closeout - all Xero-blocked items SHIPPED 2026-05-19, awaiting next-playtest verification**

- [ ] **#2 / mark 01:05:31** - ping not working. **Pending** - needs next-playtest repro signal (current code path unclear without watching it fail live).
- [ ] **#3 / marks 01:13:55 + 02:37:59** - map non-responsive (dead-click bursts). **Pending** - needs repro pattern (intermittent; suspect cache invalidation race in TacticalMap).
- [ ] **#4 / mark 01:14:04** - work around map pins (partially shipped). **Pending** - needs repro on whatever's still broken after the partial ship.
- [x] ~~**#5 / mark 01:18:54**~~ - FI modal missing CMod. Shipped earlier in the session arc (FI streamline Phase 1).
- [x] ~~**#6 / mark 01:32:51**~~ - player drag/drop NPCs in their tab (Phase A). Shipped `4b9ce21`.
- [x] ~~**#7 / mark 02:07:35**~~ - "drives Minnie" breakdown formatting. Shipped `faa60ab` (DRIVE / BREW / NAVIGATE prefix-CAPS narratives + fuel state baked into BREW line; supersedes the parallel-chat `54c46a1` mid-session collision).
- [x] ~~**#8 / mark 02:12:29**~~ - Minnie inventory player-editable. Shipped `1f79e08`.
- [x] ~~**#9 / mark 02:21:57**~~ - fuel storage fungible (+1 day per drum). Shipped `c31e564` - per-vehicle cap via new optional `fuel_max_base` + `fuel_storage_max` cols, 55-Gallon Drum scavengeable item, Install/Uninstall UI on vehicle popout. Minnie 4 → 6 cap.
- [x] ~~**#10 / mark 02:25:36**~~ - storage for 2 days of brewing supplies. Shipped `f3b20fb` - new optional `brewing_supplies_current` + `brewing_supplies_max` cols, [+ Gather Materials] button (passive 1-day action, no dice), brew blocked at 0, every brew burns 1 supply. Minnie cap 2.
- [x] ~~**#11 / mark 02:28:30**~~ - generic Advantage tab based on scavenging roles. Shipped 5 phases: `054c04d` (schema + helpers), `47a1f36` (GM grant dialog + player tab + Use button), `011c55e` (P4 ⭐ Award button on roll feed + P5 C3 consumed broadcast - fixed JSX from the prior compacted session).
- [x] ~~**#12 / mark 02:37:45**~~ - CLOSE ALL on multi-NPC-card view. Shipped `fcd8a9d`.
- [x] ~~**#13 / mark 01:29:32**~~ - Pin SHOW broadcast to players. Shipped `236167c`.
- [x] ~~**#14 / mark 01:44:00**~~ - FI wording with NPC target. Shipped `89ad835`.
- [x] ~~**#15 / mark 02:03:06**~~ - time-advance log entry. Shipped `89ad835`.
- [x] ~~**#16 / mark 02:13:19**~~ - routes vanish on Esc + auto-clear on new. Shipped `d17b1c1`.
- [x] ~~**#17 / mark 02:15:12**~~ - brew check Mechanic* +-3 display bug. Shipped `a6376c9`.
- [x] ~~**#18 / Q2 Phase B**~~ - player-side folder reordering (companion to Phase A drag/drop within folders). Shipped `18989f3` - drag folder headers, saved per-user-per-campaign under `npc_folder_order_player_<id>`, combat + community buckets stay non-draggable.

- [x] ~~**Polish-pass-2026-05-14 testplan**~~ - PLAYTESTED 2026-05-18, all sections passed. Coord Effort, Healing, Year-0, Campaign Sheet header/Edit Clock modal, Export Log, Luxury Ration, die3, Weapon Repair, CampaignObjects "found nothing", 4 polish bundles all working as intended.
- [x] ~~**Thriver-godmode-sweep testplan**~~ - PLAYTESTED 2026-05-18, all sections passed. Thriver-on-non-owned-campaign + GM regression + Survivor no-leak all green.
- [x] ~~**Preplay-testsmoke-2026-05-17**~~ - PLAYTESTED 2026-05-18 ([tasks/preplay-testsmoke-2026-05-17.md](preplay-testsmoke-2026-05-17.md)). Covered 2026-05-15→17 ships: drag-end grab-offset fix, vehicle passenger model, Coord Effort Withdraw retcon, Heal-LI infection cascade, Day-0 Lasting Damage modal, Lasting Wound chips, HIDE ALL panic button, vehicle sheet redesign, pin sidebar OSRM router, GM Notes draft, Tools sidebar, moderation email triggers, bug report tools. All green.

### Ready to build (small)
- [x] ~~**Brew Check modal rework**~~ SHIPPED 2026-05-20. Per Xero "the modal is very different from the other modals; all modals should be uniform" - swapped the bespoke `ModalBackdrop`-based vehicle check modal (driving/brew/navigate/attack, ~225 lines of JSX) for a `<RollModal>` shell. State machine (`check` + `rollCheck`) preserved verbatim - only the visual layer changed. AMOD/SMOD now read-only chips for uniformity with every other modal in the app; CMOD stays GM-tunable. Mid-roll modifier tuning happens via the brew/navigate skill picker (auto-recomputes via `switchBrewSkill` / `switchNavigateSkill`) or by swapping the crew member. The narrative dispatch (BREW prefix in `lib/roll-helpers.ts`) is unchanged. Tests 419/419 pass. tsc + guardrails clean.
- [x] ~~**Vehicle passenger auto-positioning**~~ - SHIPPED 2026-05-15. MOVE HERE button on every popout slot + rotation-aware offset map (Minnie floorplan locked: driver right-front, navigator right-mid, shooter center, brewer far-left, passengers spread across back). Shipping commits: `c6c8ad1` (sheet redesign + MOVE HERE buttons), `5a54773` (confirm-gate auto-snap), parallel session `2bd03dd` (one-click Disembark covers the "exit vehicle" action). Drag-lock follow-up queued below.
- [x] ~~**Lock passenger tokens from independent drag while assigned to vehicle slot**~~ - SHIPPED 2026-05-15 via parallel session `8ee54f4` "passengers vanish inside vehicle + count badge on token". Drag-lock approach was made moot by a cleaner approach: aboard tokens are filtered out of the canvas render entirely (`TacticalMap.tsx:1527-1532`), so there's no token visible to drag. Headcount badge replaces the individual tokens on the vehicle. Same UX outcome.
- [x] ~~**NPC full-attribute backfill for vehicle Navigate skill picker**~~ - SHIPPED 2026-05-15. Widened `campaign_npcs` `.select()` to include `physicality` + `influence` (was just `dexterity` + `reason`); mapped into the NPC CrewMember's `attributes` record. Confirmed schema: campaign_npcs only carries PHY/DEX/RSN/INF columns. The remaining gap (no ACU column on NPCs, so ACU-based skills - Navigation, Farming, Gambling, Lock-Picking - still return AMod=0 for NPC navigators) is queued separately below as a schema issue, not a vehicle-popout fix.
- [x] ~~**NPC ACU (Acumen) attribute "gap"**~~ - RESOLVED 2026-05-15. There was no actual gap. `campaign_npcs.acumen` has existed all along; my earlier diag query filtered against 'acuity' / 'perception' / 'instinct' (the stale wording from 3 rules pages) and didn't include 'acumen', so I missed it and shipped a duplicate `acuity` column. That column has been dropped (`sql/drop-duplicate-acuity-column.sql`). Vehicle popout's NPC mapper now reads `n.acumen` correctly. 3 stale rules pages (rapid / combat-rounds / modifiers) updated to say Acumen instead of Acuity.
- [x] ~~**NPC `lasting_wounds` UI / NpcCard surface**~~ - SHIPPED 2026-05-16 (`6342556`). Red chip strip on NpcCard between HP block and Skills, each chip names the canon Table-12 wound with the effect string in tooltip. Reads from `campaign_npcs.lasting_wounds jsonb`.
- [x] ~~**Coordinated Effort - per-participant opt-out UI**~~ - SHIPPED 2026-05-17. Per-participant 🚪 Withdraw chips on the active-chain banner. Design Q resolved Option B (full retcon): every other participant's already-logged roll gets cmod -= 1 / total -= 1 / outcome recomputed. Chain id stamped on every roll_log row at insert; withdraw handler queries by chain id and updates in place. Chain auto-ends when only one participant remains.
- [x] ~~**Coordinated Effort - bespoke chain summary banner**~~ - SHIPPED 2026-05-19 (`137be68` + `9a3eb94`). Renderer-side aggregation in `useRollsFeed` (`collapseCoordEffortChains`) groups chain rows by `coord_chain_id`, identifies the lead by label prefix, enriches with `damage_json.coordChainParticipants`, drops constituent rows. New bespoke Tier A banner in `RollEntry` renders the narrative ("<lead> {success-adverb} uses <skill> to coordinate an effort with <participants>"); per-participant rolls live in the expanded ▸ view. 6 unit tests on `collapseCoordEffortChains`.
- [ ] **Coordinated Effort - combat turn-gate behavior tested in actual combat** (verification, not build)
- [x] ~~**Healing - Wound Infection auto-trigger on LI**~~ - SHIPPED 2026-05-17. Heal-LI now broadcasts `infection_check_request` to the patient's owning client (reuses the end-of-combat sweep pipeline + listener at L1522). Self-heal opens locally. NPC patient drains through `pendingInfectionChecksRef`. Insight-Die opt-out was already correct: the medic's spend resolves BEFORE the heal post-resolve evaluates `outcome === 'Low Insight'`, so flipping the outcome via a spend silently skips the cascade.
- [ ] **Healing - kit consumption / charges** - *needs schema*: new columns on character inventory for kit charges. Canon silent on the math (charges per Doctor's Bag? per First Aid Kit?).
- [x] ~~**Export Session Log - bespoke banner types**~~ - **FULLY SHIPPED 2026-05-15** (`22d75dc` + `43a1e04`). All 13 bespoke types ported (combat_start, combat_end, initiative, drop, defer, sprint, death, incap, revive, retention_check, fed_check, clothed_check, morale_check). Static HTML always shows the breakdown that the live feed gates behind ▸/▾.
- [x] ~~**Export Session Log - chat messages export**~~ - **SHIPPED 2026-05-15** (`22d75dc`). Fetches chat_messages in parallel with roll_log, interleaves by created_at via discriminated-union FeedItem. Whispers get purple palette, RLS-respecting.

### Ready to build (medium)
- [ ] **Skill + Combat action end-to-end audit** - walk every check/action against [tasks/roll-feed-log-preview.html](roll-feed-log-preview.html); log drift as bugs
- [x] ~~**Modal unification (Stabilize / Distract / First Impression / Gut Instinct)**~~ COMPLETE 2026-05-20. Stabilize Phase 1 (`2255ced`), Distract Phase 2 (`54dec35`), First Impression (already shipped 2026-05-19 via FI streamline), Gut Instinct (this commit). Coordinated Effort already migrated (`6640b1a`). Group Check resolved as not-bespoke (current banner is canonical, spec-group-check.md). Only Phase 4 cleanup remains: delete the three preserved-unreachable legacy executeRoll branches (~85 lines combined) after the 2026-05-25 playtest verifies all three migrated modals are clean.
- [x] ~~**First Impression skips target picker**~~ - **ALREADY SHIPPED 2026-05-01** on `PlayerNpcCard` ([components/PlayerNpcCard.tsx:438-447](../components/PlayerNpcCard.tsx)). The skip-picker button is the `onFirstImpression` quick-fire on the player NPC card. GM-side `NpcCard.tsx` intentionally has no quick-fire (GM orchestrates).
- [x] ~~**Perception check skips picker**~~ - **ALREADY SHIPPED**. `shortCircuitForSpecialCheck` at [app/stories/[id]/table/page.tsx:3436](../app/stories/[id]/table/page.tsx:3436) auto-picks single-PC or active-PC-in-combat for Perception and Gut Instinct. Picker only renders for "multi-PC GM out-of-combat" which is intentional per the comment at L3432.
- [x] ~~**Gut Instinct results presentation**~~ - SHIPPED 2026-05-19 (`adb9382`). Per Xero option-a: standard feed narrative remains for everyone; GM gets an auto-opening whisper-detail modal on every Gut Instinct roll (skipped when GM rolled on their own PC). Modal sends a `Gut Instinct: <text>` whisper to the rolling player. Player's existing whisper handler auto-flips to Chat tab.
- [ ] **CMod Stack reusable component** - extract from Recruit modal, use in Grapple / First Impression / Attack. **Bigger than it looks**: extraction itself is small but each consumer (Grapple, First Impression, Attack) needs its own per-CMod-source compute function + render slot. Multi-day refactor properly thought through, not a single-session item.
- [x] ~~**GM force-push view to players**~~ - SHIPPED 2026-05-19 (`6a4669b`). Tactical Map "👁 Share View" button mirrors the existing CampaignMap button (added 2026-05-11). One-shot deliberate push (NOT a continuous follow per Xero "not a drag-follow mechanism"). Payload: `{ scrollLeft, scrollTop, zoom, imgScale }`. Player listener smooth-scrolls + matches asset scale. Flash-green `✓ Shared` 1.5s confirmation.
- [x] ~~**Character Evolution / CDP Calculator**~~ - SHIPPED. The feature is at `components/CharacterEvolution.tsx`, mounted as a modal from CharacterCard via the purple "Evolution" button (L569). No standalone `/evolve` route, but the modal is discoverable from the character sheet and handles the full RAPID + skill spend flow. (Audit-corrected 2026-05-20: the original todo was written before this component existed.)
- [x] ~~**Em-dash backlog sweep**~~ - SHIPPED 2026-05-20 (`3f8bcd4`). Mechanical bulk replacement of 2533 em-dash/en-dash chars across 247 files (comments + user-facing prose + placeholders + titles). 3 intentional exempt sites preserved: lib/roll-helpers.ts L91 legacy DB strip detector + tests/lib/roll-helpers.test.ts L103/136/139 strip-path tests + scripts/check-em-dashes.mjs pattern literal. Per Xero 2026-05-20 "I HATE the Em-dash stuff."
- *(Setting content - King's Crossroads Mall scenes/handouts + new settings "Astoria: Home by the Sea" + "Pelee Island" - DEFERRED to back of list per Xero 2026-05-20: "content comes when the platform is stable.")*
- [ ] **Streamline player login flow** - too many steps; needs design call before build
- [x] ~~**PCs riding vehicles don't move with the vehicle**~~ - RESOLVED 2026-05-16 by the vanish-inside-vehicle model + canvas redraw deps fix (commits `8ee54f4` + `16e33d6`). Aboard tokens are hidden from the canvas; the passenger-count badge rides on the vehicle token. No ghost tokens left behind. Xero confirmed fixed in playtest.
- [ ] **Tactical map pan via mouse drag - broken** ([tasks/long-term-fixes.md](long-term-fixes.md)). WASD/arrow workaround exists. Deferred since 2026-04-27.

### Bigger builds
- [ ] **VehicleSheet refactor** - vehicle page is a full page now (not iframe), but the "shared component" refactor for use in both popout + inline contexts hasn't shipped. Half-day, high risk.
- [ ] **Campaign snapshot: capture + restore communities.** `lib/campaign-snapshot.ts` currently excludes the community subsystem; 88 `.from()` sites across 19 files prove the tables are heavily in use. Six tables in scope: `communities` + `community_members` + `community_stockpile` + `community_events` + `community_subscriptions` + `npc_relationships`. Need to extend `CampaignSnapshot` interface, the `Promise.all` capture pipeline at line 56, and the restore-side DELETE+INSERT block (lower in file). RLS-respecting wipe is the tricky part - each table has different policies. Multi-hour scope. Current behavior: GM who restores a snapshot loses all community state silently. Acceptable for now; promote when a GM hits the loss. (Replaces the stale inline TODO at `lib/campaign-snapshot.ts:22`, removed 2026-05-19.)

### Blocked on Xero design call
- [ ] **GM Notes / Assets merge** - unify, cross-link, or leave-as-is
- [ ] **Other explosives audit (QS Table 18)** - Grenade / Flash-Bang Grenade / Shiv-Grenade exist in [lib/weapons.ts](../lib/weapons.ts) and [lib/xse-schema.ts](../lib/xse-schema.ts); audit-vs-Table-18 not commit-marked
- [ ] **Lv4 Skill Traits suite** - 2 of 24 traits authored (Inspiration "Beacon of Hope", Psychology "Insightful Counselor"). Remaining 22 blocked on full list from Xero. Blocks ALL Lv4 auto-bonuses.
- [ ] **`hide-NPCs` global flag decision**
- [x] ~~**Recruitment/Inspiration/Apprentice Tier-2 semantics** (3 items)~~ - SHIPPED 2026-05-19. (1) Inspiration SMod relabel + double-count suppression (`f131736`). (2)(3) Approach-specific Success/Failure semantics across 3 phases: Phase A schema + flag-setting (`6287480`), Phase B morale-tick drainer + GM "Escape Pending" surface (`1951d77`), Phase C Recruit modal locked-approach gates (`57cc125`). Plus spec: [tasks/rules-extract-recruitment-inspiration.md](rules-extract-recruitment-inspiration.md).
- [ ] **HP pip dots on player-facing NPC card** ([components/PlayerNpcCard.tsx](../components/PlayerNpcCard.tsx) comment lists this as GM-only hidden data)
- [x] ~~**Folder-level NPC reveal panic button**~~ - SHIPPED 2026-05-16 (`6342556`). 🚨 HIDE ALL button on the NpcRoster toolbar next to the Show/Hide toggle. Single-purpose, no toggle state to read: hits `campaign_npcs.hidden_from_players=true` + `npc_relationships.revealed=false` + `scene_tokens.is_visible=false` across every folder in one click.
- [ ] **Initiative lag** - needs Xero solo-validation first
- [ ] Healing on GM time-tick - 5 open questions (per [tasks/post-playtest-todo-2026-05-12.md](post-playtest-todo-2026-05-12.md))
- [ ] Coordinated Effort - 3 open questions (per same)
- [x] ~~Group Check redesign - 3 open questions~~ - RESOLVED. Per [tasks/spec-group-check.md](spec-group-check.md): the "individual-rolls-feed-leader" redesign was killed 2026-05-13. Current Group Check (leader rolls with summed AMods + SMods from helpers) is locked canon. Present-tense banner polish shipped 2026-05-19 (`cd5e030`); no other changes needed.

### Long-term map features
- [ ] **Dynamic lighting on tactical map** - no `light source` / `lights layer` references in [components/TacticalMap.tsx](../components/TacticalMap.tsx)
- [ ] **Doors as movement-blockers** - fog-edit doors/windows ship vision-blocking (`4e02f70`/`4f9971b`). The `door` token_type with `is_open` state for movement-blocking is the open piece.

### CRB rewrite workstream (Tier 1 canon - open)
- [ ] **Vehicle subsystem + Vehicles-as-Cover** - no `app/rules/vehicles/` directory yet
- [ ] **NPC threat tiers** (Friendlies/Goons/Foes/Antagonists templates) - `lib/populate-triangle.ts` comment mentions the ratio but no canon page
- [ ] **Travel Times subsystem** - 8h travel + 8h rest + 8h sleep + 1RP/hour overage
- [ ] **Resource Quality / Supplies abstraction** - `ItemRarity` exists; full Supplies subsystem + monthly cost not in canon
- [ ] **Per-activity yield rates** - Scavenging 2/Daily, Foraging 2 Standard, Fishing 2 Luxury, Trapping 1 Luxury, Hunting 10 Luxury, Farming 90 days
- [ ] **Base of Operations sizing** - Tiny/Small/Medium/Large/Massive with monthly Supplies cost

### CRB rewrite workstream (Tier 2 supplement - open)
- [ ] **Dog Flu** - 1WP+RP per 6h, severity-tier disease (setting flavor exists; mechanic doesn't)
- [ ] **Fuel subsystem** - gasoline spoilage, ethanol/methanol
- [ ] **Government Remnants / Beacons of Hope factions**

### CRB rewrite workstream (Tier 3 optional - open)
- [ ] Morality loss/regain ladder (3 lost → -1 INF; 6 regained → +1 INF)
- [ ] Called Shots (Wild Success required, Fill in the Gaps)
- [ ] Tactical Advantages (+1 to +3 CMod GM-discretion catch-all)
- [ ] Chases subsystem (Speed-matched Opposed across range bands)
- [ ] Banishment (Code-of-Conduct teeth for Communities)
- [ ] Mundane vs Complex Tasks split + Simplified Group Check
- [ ] Apprentice continuity on PC death

### CRB rewrite workstream (Cross-cutting - open, platform-side)
- [ ] **Intimidation skill removal** - gone from canon; still in [lib/npc-generator.ts](../lib/npc-generator.ts) Politician bundle + [lib/setting-npcs.ts](../lib/setting-npcs.ts) NPC stat lines
- [ ] **Lv4 Skill Trait paragraphs** - 2 of 24 (blocked on the wider Lv4 design call above)
- [ ] **Morale outcomes percentages (25/50/75%)** - verify moodRow table at [app/rules/communities/morale/page.tsx:100+](../app/rules/communities/morale/page.tsx)

### CRB rewrite workstream (Cross-cutting - open, CRB-doc side only)
- [ ] General Knowledge → Specific Knowledge sweep
- [ ] CMod ladder labels (11 tiers renamed)
- [ ] 12 Profession bundles (7-skill → 5-skill)

### Backburner
- [ ] **Campaign calendar** - deferred; revisit only on listed pain triggers (Forgotten Skip Week, world events sticking past end-date, etc.). See [memory/project_campaign_calendar.md](../../../../Users/tony_/.claude/projects/C--TheTapestry/memory/project_campaign_calendar.md).
- [ ] **Remove PlaytestRecorder + GM-cascade plumbing post-beta.** When the beta playtest window closes: drop the `<PlaytestRecorder />` mount in `app/layout.tsx`, delete `components/PlaytestRecorder.tsx`, `lib/playtest-recorder.ts`, `tests/lib/playtest-recorder.test.ts`. Remove the recorder import + Record button + `toggleRecorder` + the two `recorder_start` / `recorder_stop` broadcast handlers from `app/stories/[id]/table/page.tsx`. ~30 min, low risk. Added with `653ff86` per Xero's instruction "We'll disable this when out of beta testing."

### Drop / archive
- ~~"#33 general UI smoothness"~~ - too vague, needs specifics before tracking
- ~~Random char gen - Medic missing First Aid~~ - NOT A BUG. Per [lib/xse-schema.ts:157-170](../lib/xse-schema.ts), Medic skills are `['Manipulation', 'Medicine*', 'Psychology*', 'Research', 'Sleight of Hand']`. First Aid isn't in the SKILLS table at all.

---

## Audit notes - what shipped recently that USED to be open
- **2026-05-19 PlaytestRecorder GM-cascade + localStorage resume** (`653ff86`) - Record button is now GM-only. GM click broadcasts `recorder_start` / `recorder_stop` on `initChannelRef` (wrapped via `wrapBroadcast`); every connected player tab flips capture in lockstep and writes `tapestry_recorder_enabled_<campaignId>` to localStorage. Table-page mount reads that flag and resumes capture on refresh / back-nav / late mount. `beforeunload` listener does a one-shot full flush so close-tab loses ≤1 event instead of up to 60s. Players keep Ctrl+Shift+L for ad-hoc dumps. Closes the "Alex hit Stop without ever hitting Start" failure mode from session 3 (2026-05-18). 6 new tests at [tests/lib/playtest-recorder.test.ts](../tests/lib/playtest-recorder.test.ts). Backburner item added for the post-beta removal. Lesson logged at [tasks/lessons.md](lessons.md) head - "Tab-local default-OFF UX fails when ONE user forgets to flip it."
- **2026-05-15 RollOutcome typo-proofing** (`87f3063` + `4bbd7eb` + `42d5cd3`) - 3-commit refactor adding compile-time typo safety to the `roll_log.outcome` column. (1) Created [lib/roll-outcomes.ts](../lib/roll-outcomes.ts) with `RollOutcome` union (33 values) + `OUTCOME` const lookup + `RollResult` subtype for dice-result-only callers. (2) Migrated 49 insert sites across 8 files from `outcome: 'literal'` to `outcome: OUTCOME.X` (typos at write time now red-squiggle). (3) Narrowed `getOutcome()` return to `RollResult`, migrated switch case literals in `outcomeColor` / `colorClass` / `compactRollSummary` to `OUTCOME.X` constants. Bonus: the narrowed `getOutcome` return surfaced a real dead-code path in the sprint handler at [app/stories/[id]/table/page.tsx:5797](../app/stories/[id]/table/page.tsx:5797) - copy-paste leftover where `winded` was computed as `outcome === 'Failure' || outcome === 'Dire Failure'` in BOTH the if and else branches; TS flagged the else branch as always-false. Replaced with true/false literals. Audit residue: 2 local re-implementations of `outcomeColor` (community/page.tsx:42, RollModal.tsx:120) still inline. Separate refactor.
- **2026-05-15 Dead-export sweep** (`5c6d2d8`) - node-side word-boundary identifier sweep across app/components/lib/hooks/scripts surfaced 50 export candidates with zero external importers. After verification: deleted `createCharacterWeapon` + `CONDITION_LABELS` from [lib/weapons.ts](../lib/weapons.ts); demoted to file-private (kept the function, dropped the `export` keyword) `haversineKm` ([lib/world-events.ts](../lib/world-events.ts)), `BACKPACK_BONUS` ([lib/encumbrance.ts](../lib/encumbrance.ts)), `dumpBuffer` ([lib/playtest-recorder.ts](../lib/playtest-recorder.ts)), `getWeaponRangeProfile` ([lib/range-profiles.ts](../lib/range-profiles.ts)). Other 44 candidates left as-is - likely intentional API surface (help-text tooltip registry, style-helpers primitives, auth-roles parity, setting-* data bundles, rarity color variants). Audit method: word-boundary regex on every export identifier, filtered for zero matches outside the defining file.
- **2026-05-15 findEquipmentByName helper** (`e119598`) - case-insensitive whitespace-trimmed catalog lookup extracted to [lib/xse-schema.ts:300](../lib/xse-schema.ts:300). Four duplicate inline copies in CampaignCommunity (stockpile add) and app/vehicle (cargo add) now route through it. NpcRoster's strict-canonical match at L1831 left inline (dropdown values are canonical, strict is correct there).
- **2026-05-15 getWeaponByName consolidation** (`dabf888`) - three inline `ALL_WEAPONS.find(w => w.name === ...)` call sites in [PrintSheet](../components/wizard/PrintSheet.tsx) (2) and [StepEight](../components/wizard/StepEight.tsx) (1) now route through the canonical helper. PrintSheet no longer needs the full `ALL_WEAPONS` import.
- **2026-05-15 Role-check sweep + guardrail tightening** (`bc86d5e`) - 5 inline role gates routed through `roleIsThriver` helper across [app/logging](../app/logging/page.tsx), [app/vehicle](../app/vehicle/page.tsx), [app/moderate/users/[userId]/activity](../app/moderate/users/[userId]/activity/page.tsx), [app/moderate/users/[userId]/characters](../app/moderate/users/[userId]/characters/page.tsx), [app/tools/rescale-tactical-scenes](../app/tools/rescale-tactical-scenes/page.tsx). Guardrail extended to catch `!=`/`!==` and `String(...).toLowerCase()` shapes (only `==`/`===` and bare `.role.toLowerCase()` before). Dead `invalidateAuthCache` export dropped from [lib/auth-cache.ts](../lib/auth-cache.ts) (zero callers; auth listener auto-invalidates).
- **2026-05-15 Multi-cell token click-snap fix** (`ae1a2a2`) - clicking anywhere inside Minnie's (or any wide-token's) footprint was snapping her top-left to the clicked cell. Replaced point-equality `moved` check with a footprint-overlap test at [components/TacticalMap.tsx:3168](../components/TacticalMap.tsx:3168). Drag-end sibling fix shipped 2026-05-17 (see below).
- **2026-05-17 Drag-end grab-offset fix** - sibling to the click-snap fix above. mouseup handler at [components/TacticalMap.tsx:3402](../components/TacticalMap.tsx:3402) was snapping the token anchor (top-left) to `pos.gx, pos.gy` (the cursor's cell) on release, ignoring `dragging.offsetX/offsetY`. So grabbing Minnie by her center cell jumped her top-left +N cells past where the drag ended. Fix: compute target anchor from `dragPosRef.current` (which already carries the grab offset, same way the live drag at L3201 honors it), clamp to scene bounds, use newGx/newGy for setTokens + supabase write + vehicle-passenger-sync dx/dy. Player-PC distance gate at L3384 still uses raw `pos.gx - tok.grid_x` - fine for 1x1 PCs (current state), would re-expose if PCs ever become multi-cell. Tracked as latent.
- **2026-05-15 Export Session Log polish - FULLY CLOSED** (`22d75dc` + `43a1e04`) - all 13 bespoke banner types ported + chat-message interleave.
- **2026-05-15 Insight Dice cap removal** (`baa704f`) - `+` button on the character sheet Insight bar no longer caps at 10. Floor check on `-` unchanged. Pip render stays at 10; counts above 10 visually clamp (all pips green), per Xero's call. [components/CharacterCard.tsx:714](../components/CharacterCard.tsx:714).
- **2026-05-15 Perf A4 follow-up #1** (`e83514b`) - `effective` fog map cached per `visKey + paintedFogHash + grid + hasPCs/hasBlockers` in [components/TacticalMap.tsx:1401](../components/TacticalMap.tsx:1401). Drops the O(grid_cols * grid_rows) auto-fog iteration to zero on cache hit; same shape as `fogVisibleCacheRef`. Findings #2 (getWeaponByName memo) and #3 (ResizeObserver rAF) still open in [tasks/perf-a4-tactical-map-2026-05-14.md](perf-a4-tactical-map-2026-05-14.md).
- **2026-05-15 Edit page retirement** (`3e911d8`) - `/stories/[id]/edit` deleted; form inlined on the hub as a GM Tools card. EDIT button dropped from StoryActionBar.
- **2026-05-15 Export Session Log polish** (`22d75dc`) - 9 of 13 bespoke banner types ported + chat-message interleave.
- **2026-05-15 Thriver godmode UI sweep** (`07652f8` / `98d81c9`) - full UI layer parity with DB-level godmode
- **2026-05-15 audit corrections** - Perception skip-picker + First Impression skip-picker were ALREADY shipped (2026-05-01 / `shortCircuitForSpecialCheck`); todo entries were stale.
- **2026-05-14 stack**: Coord Effort, Healing on Time-Tick, Year-0 calendar shift, Campaign Sheet header redesign + Edit Clock modal, Export Session Log, Weapon Repair, die3 in expanded log, CampaignObjects "found nothing" write path (Bundle 4), Luxury Ration consume
- **2026-05-14 canon shipped**: Item Condition + Upkeep, Activity Block taxonomy, Falling/Drowning/Subsistence Damage, Distemper-Infected Canines bestiary, Insight Dice on Death "1WP+1RP total" fix, Negotiations Gambit/Rebuttal full system
- **2026-05-14 perf passes** (a1/a2/a3) - campaign-sheet debounce, NpcRoster prop memoization, stories useEffect cleanup. All shipped or no-op findings.
- **2026-05-05 GM Tools Restore is slow** (`55d0693`) - fixed via optimistic-local + background-refetch
- **2026-05-04 fog-blocker-gated LoS** - PC line-of-sight + painted fog interaction shipped

---

## ✅ Shipped 2026-05-12 - Skill-description tooltips on character sheet

- [x] **Skill-description hover tooltips on character sheet** - commit `bc24db9`. Each skill chip in `components/CharacterCard.tsx` now carries a native `title` attribute resolving from `lib/xse-schema.ts:SKILLS[].description`, so hovering surfaces the canonical prose ("Providing first aid, diagnosis, treatment, emergency stabilization..." for Medicine\*, etc.). Native browser tooltip means ~500ms delay, no JS state, no positioning logic, no portal - appropriate scope for a 30m item. Flagged 2026-05-11 after a playtester misread a Medic with Medicine\* lv1 as having no first aid skill.

---

## ✅ Shipped 2026-05-14 - Loot "found nothing" write path FULLY CLOSED

- [x] **Loot: "found nothing" write for `CampaignObjects.tsx`** - **SHIPPED 2026-05-14** (`6abb46b`). Empty destroyed containers in the campaign sidebar now show a "Search" affordance ([components/CampaignObjects.tsx:515](../components/CampaignObjects.tsx:515)); confirming opens the loot modal in empty mode ([components/CampaignObjects.tsx:601](../components/CampaignObjects.tsx:601)-637) which writes a roll_log row with the standard "looked through the remains of X and found nothing" label format. Closes the 2026-05-13 flag (audit residue: todo line claimed it was still silent; verified 2026-05-15 it shipped). The full empty-loot row write path is now in: auto-loot, ObjectCard player search, and CampaignObjects sidebar.

---

## 🔲 Flagged 2026-05-13 - Skill + Combat action end-to-end audit

- [ ] **Skill + Combat action playtest audit** - walk every skill check and every combat action (Aim, Move, Ready, Switch, Reload, Unequip, Defend, Take Cover, Reposition, Cover Fire, Inspire, Charge, Subdue, Unarmed, Distract, Explosives, Rapid Fire, Fire from Cover, Grapple, Coordinate, Stress Check, Stabilize, Unjam, Upkeep) and verify each fires the correct roll, produces the correct feed row, and applies the correct game state change. Use `tasks/roll-feed-log-preview.html` as the canonical visual reference. Log any drift as bugs.

---

## 🔲 Flagged 2026-05-09 - Canon promotions from CRB audit

Source: [tasks/froms-tos-crb.md](froms-tos-crb.md) audit of Distemper CRB v0.9.2 against `tasks/tapestry-rules-canon.md`. Strategic ordering in [tasks/roadmap.md](roadmap.md). Verify against live platform state before drafting; some may already be partly implemented per the `Inventory system shipped` memory.

**Tier 1 - High-value canon gap fills (priority order):**

- [ ] **1. Item Condition + Upkeep Check** - five-state degradation (Pristine / Used / Worn / Damaged / Broken), Upkeep Check rules (skill-of-the-tool, drop on Dire Failure, Wild-Success caps at Used). Verify against live inventory page; if implemented, document in canon §07. CRB Ch. 06 pp. 67-70.
- [ ] **2. Vehicle subsystem + Vehicles-as-Cover** - Rarity, Size 1-6, Speed 1-5, WP = size×10 + size·d6, Encumbrance = size×20, Range with ethanol/methanol modifiers, Cover-as-RDM by size. Highest-value canon gap; platform already has cargo/vehicle surface. CRB Ch. 08 pp. 138-141.
- [ ] **3. Activity Block taxonomy** - formal Daily / Weekly / Monthly / Seasonal time-granularity ladder. Canon §08 uses "weekly" but never names the four tiers. Tiny addition that unblocks naming across many other rules. CRB Ch. 08 pp. 147-148.
- [ ] **4. NPC threat tiers** - Friendlies / Goons / Foes / Antagonists with stat-block templates. GM-side scaffolding, zero conflict. CRB Ch. 10 pp. 174-175.
- [ ] **5. Falling / Drowning / Subsistence Damage** - three small independent additions:
  - Falling: 3 WP + 3 RP per 10 ft.
  - Drowning: 6 + PHY AMod rounds breath; 3 WP + 3 RP per round after, with -1 CMod per resist.
  - Subsistence: 1 WP + 1 RP per day past day 2 without food/water.
  - CRB Ch. 07 pp. 116-117. (Subsistence supersedes the older 2026-05-08 flagged item below.)
- [ ] **6. Travel Times subsystem** - 8h travel + 8h rest + 8h sleep cycle; 1 RP/hour overage past 8h. CRB Ch. 08 p. 142.
- [ ] **7. Resource Quality / Supplies abstraction** - Common / Uncommon / Rare units of generic Supplies as a resource currency. Anchors Communities economy. CRB Ch. 08 pp. 131, 133.
- [ ] **8. Per-activity yield rates** - Scavenging 2/Daily, Foraging 2 Standard, Fishing 2 Luxury, Trapping 1 Luxury/trap, Hunting 10 Luxury (15 Wild), Farming season → 90 days at 1 Standard each. CRB Ch. 08 pp. 134-136. Depends on (1) and (7) landing first.
- [ ] **9. Base of Operations sizing** - Tiny (≤4) / Small (≤12) / Medium (≤36, min for Homestead) / Large (≤300) / Massive (≤1000), with monthly Supplies cost. Pre-Community gap. CRB Ch. 09 pp. 152-155.

**Tier 2 - Distemper-supplement content (not core canon):**

- [ ] **Dog Flu signature mechanic** - 1 WP+RP per 6h, severity-tier disease. Reconcile with canon Sick state. CRB Ch. 10 pp. 184-186.
- [ ] **Distemper-Infected Canines** - +1 Athletics & Unarmed Combat tag for infected wolves/dogs. CRB Ch. 10 pp. 196-197.
- [ ] **Fuel subsystem** - gasoline spoilage, ethanol -66% range / -1 Speed, methanol -80% range, still build/conversion costs. Hangs off Vehicles if Tier 1 (2) lands. CRB Ch. 08 pp. 145-146.
- [ ] **Government Remnants / Beacons of Hope factions** - Cunningham + American Colonial Forces (Washington); Buchanan (Manhattan); Wilkerson (New Philly). Cross-check no territorial overlap. Chs. 08, 10.

**Tier 3 - Optional GM-aid promotions (playtest first):**

- [ ] **Negotiations Gambit / Rebuttal** - two-step Opposed Check structure for social scenes. CRB Ch. 10 p. 178.
- [ ] **Morality loss/regain ladder** - 3 lost → -1 INF; 6 regained → +1 INF; INF floor at -2. Puts teeth on canon's "Morality starts at 3." CRB Ch. 10 pp. 181-182.
- [ ] **Called Shots** - Wild Success required, freeform effect via Fill in the Gaps. CRB Ch. 07 p. 119.
- [ ] **Tactical Advantages** - +1 to +3 CMod GM-discretion catch-all. CRB Ch. 07 p. 119.
- [ ] **Chases subsystem** - Speed-matched Opposed Athletics/Animal Handling/Driving across range bands; escape at Distant. CRB Ch. 08 p. 141.
- [ ] **Banishment** - Code-of-Conduct teeth for Communities. CRB Ch. 09 p. 165.
- [ ] **Luxury Ration clears 1 Stress pip** - gives Luxury Rations a real purpose. Compatible with canon Cooling Off. CRB Ch. 08 p. 133.
- [ ] **Mundane vs Complex Tasks split** + Simplified Group Check (+2 CMod per participant, no AMods/SMods, Mundane-only label). CRB Ch. 09 pp. 166-167.
- [ ] **Apprentice continuity on PC death** - player promotes Apprentice → PC. CRB Ch. 09 p. 173.

**Tier 4 - Skip / drop (don't promote, recommend dropping from CRB):**

- Stacking +1 CMod patterns (second Attack / Cover Fire / Defend in same round).
- Distract↔Inspire backfire symmetry on Dire Failure.
- Helper-clears-Stress check (conflicts with Cooling Off).
- Eight Explosive / Special weapons (Grenade, Smoke, Flashbang, Mortar, RPG, Flamethrower, Molotov, Tranquilizer Gun) - only promote if encounter design wants explosives.

---

## 🔲 Flagged 2026-05-09 - CRB rewrite tracking

Audit produced ~150 FROM/TO blocks across Chs. 01-10. See [tasks/froms-tos-crb.md](froms-tos-crb.md) for full per-chapter listing. Largest cross-cutting fixes:

- [ ] **DMM/DMR → MDM/RDM** sweep (every chapter, ~40 sites including 33 NPC stat blocks).
- [ ] **Intimidation skill removal** - replace with Manipulation or Psychology\* across Chs. 05, 07, 09, 10 (~12 sites).
- [ ] **General Knowledge → Specific Knowledge** sweep (Chs. 04, 05, 07).
- [ ] **Mechanics\* → Mechanic\*** plural sweep (Chs. 06, 08).
- [ ] **Panic Threshold / Stress counter → Stress Level (0-5) + Stress Modifier (RSN+ACU AMod)** - wholesale replacement across Chs. 05, 07, 08, 10.
- [ ] **Insight Dice on Death** - "1 WP + 1 RP per die" → "1 WP + 1 RP total" at three sites (CRB pp. 28, 122, plus the live `app/rules/core-mechanics/insight-dice/page.tsx` which still has the bug).
- [ ] **Lv4 Skill Trait paragraphs** - pull from all 24 skill descriptions in Ch. 05 §05 pending unified Lv4 trait release.
- [ ] **Combat Actions table** - 17 actions, "Grapple" (not Grappling), drop "Skill Check" action (Ch. 07 p. 108).
- [ ] **CMod ladder labels** - all 11 tiers renamed (Ch. 04 pp. 22, 25-26).
- [ ] **All 12 Profession bundles** - wholesale 7-skill → 5-skill replacement (Ch. 05 pp. 41-43).
- [ ] **Paradigm roster** - 16 → 12: drop Beat Cop, Cosmetic Surgeon, Family Doctor, Flea Market Trader, Handyman, Semi-Pro Athlete, Trucker; add Antiques Dealer + Hot Rod Mechanic; rename "Business Owner" body → "Bar Owner" (Ch. 05 pp. 62-65).
- [ ] **Range Band movement** - Engaged → Close = 3 (not 1), → Medium = 6 (not 3), → Long = 10 (not 6), → Distant = 15 (not 10). Ch. 07 pp. 117-118.
- [ ] **Morale Check structure** - replace freeform CMod list with canon's 6 named slots (Mood / Fed / Clothed / Enough Hands / A Clear Voice / Someone To Watch Over Me / Adjusted). Ch. 09 p. 164.
- [ ] **Morale outcomes** - replace "1d6 / 2d6 leave" with canon's percentage attrition (25% / 50% / 75%) and Mood-carryforward values. Ch. 09 pp. 164-165.
- [ ] **Fed Check + Clothed Check** - both missing entirely from the CRB; insert canon's two 6-row outcome tables. Ch. 09 p. 167.
- [ ] **Apprentice unlock** - Wild Success OR High Insight → **High Insight only** (3 sites: Cohort, Conscript, Convert + Apprentices section). Ch. 09 pp. 169-172.
- [ ] **Apprentice creation CDP** - add canon's 3 RAPID + 5 skill CDP allocation. Ch. 09 p. 173.

---

## 🔲 Flagged 2026-05-08 - Rules coverage

- [ ] **Infection audit** - verify Infection condition/progression/treatment is fully implemented against the SRD.
- [ ] **Armor system** - build armor into character sheet (slots/worn), damage calc (DR), and inventory. Needs SRD rules-extract first.
- [ ] **Subsistence Damage + Rations** - SRD §06: 1 RP/day after day 1 without food. Quickstart tracks Rations (2 starting). Not yet in the platform. Decision needed: scope to canon, then build Rations as inventory item + daily Subsistence Damage tick. Flagged from SRD audit item A.10. **Note**: CRB Ch. 07 p. 117 specifies 1 WP + 1 RP per day (not just 1 RP) past day 2 without food/water - see Tier 1 (5) above for the canon-grade spec.

---

## ✅ Shipped 2026-05-03 → 2026-05-04 - audit follow-ups + tactical fog/zoom fixes

Aggregated from the multi-session audit follow-up arc. Each item is a single commit on `main` from the `claude/audit-followup-2026-05-03` branch.

- [x] **Defensive bundle: moderator-character delete + vehicle crew fetch surface errors** - `handleDelete` + `handleDeleteAll` on `/moderate/users/[id]/characters` now error-check, alert, and only flip state on success (mirrors the user-side fix in `4429915`). Vehicle page's `Promise.all([memberRes, npcRes])` logs per-result errors instead of falling through to empty arrays on RLS denial. LFG deletes turned out to already be error-checked; dropped from PR. Commit `d7dc829`. Testplan: `tasks/defensive-bundle-2026-05-04-testplan.md`.
- [x] **gm-kit: scoped scene_tokens fetch + lazy JSZip** - `cloneModuleIntoCampaign` was fetching ALL `scene_tokens` across the DB (unfiltered `select('*')`) and filtering client-side; now uses `.in('scene_id', sceneIds)` for proper server-side filtering. Plus JSZip moved to a dynamic `await import('jszip')` inside `exportGmKit` (was a top-level import pulling ~50KB into every bundle that touched the module). Commit `8553234`. Testplan: `tasks/gm-kit-scope-2026-05-03-testplan.md`.
- [x] **Dead-code: drop `LABEL_STYLE_LG_TIGHT` + `app/oldfavicon.ico`** - `LABEL_STYLE_LG_TIGHT` was created defensively during the initial label-style sweep but had no 14px+.08em sites to map onto. Verified zero callers. `oldfavicon.ico` was a leftover orphan from a favicon refresh. Commit `5fd6275`. Testplan: `tasks/dead-code-2026-05-03-testplan.md`.
- [x] **Painted fog absolute (initial)** - reverted the `!visible.has(k)` guard on painted-fog rendering, making painted fog absolute. Fixed the morning playtest where day-mode unbounded sight on a no-walls map cleared every painted-fog cell. Commit `26f6dfc`.
- [x] **Painted fog blocker-gated (the real fix)** - the "absolute" fix above broke the open-window-clears-fog workflow on properly-walled maps. Final fix gates LoS-defeasibility on `hasBlockers = visionSegs.length > 0 || cellBlockers.size > 0`. No blockers → painted fog absolute, auto-fog off. Blockers + PC → LoS-driven painted fog + auto-fog. Both morning and evening playtest cases satisfied. Commit `4f2ee48`. Testplan: `tasks/fog-blocker-gated-2026-05-04-testplan.md`.
- [x] **imgScale clobber on tactical_scenes UPDATE** - player view zoom-jumped every time the GM toggled a window/wall. Cause: `loadScenes()` (which fires on every `tactical_scenes` UPDATE) was unconditionally re-applying `setImgScale(active.img_scale)` for every player, clobbering the per-viewer local auto-fit value. Fix: only re-apply when DB has a non-default value (`>0 && !== 1`). Commit `3d699d4`. Testplan: `tasks/imgscale-clobber-2026-05-04-testplan.md`.
- [x] **Sentry-example wizard scaffolding dropped** - `app/sentry-example-page/page.tsx` + `app/api/sentry-example-api/route.ts` from the Sentry setup wizard, never wired into anything. Commit `68505c4`. Testplan: `tasks/sentry-example-drop-2026-05-03-testplan.md`.
- [x] **Z-index norm: NoteAttachmentsView lightbox** - single-site swap from literal `zIndex: 10010` to `Z_INDEX.criticalModalOver`. Two other off-scale literals (`10001` × 2) deliberately preserved because of intentional `+1`-above-critical stacking offsets. Commit `ab22260`. Testplan: `tasks/zindex-norm-2026-05-03-testplan.md`.
- [x] **Map tile-provider zoom cap (hard-cap)** - OpenTopoMap returns a "max zoom layer = 17" placeholder image past z17. First attempt used `maxNativeZoom` (commit `ab8eeb5`, lets zoom past with blurry upscaled tiles); replaced with hard-cap `maxZoom` per provider so the + button greys out at the provider's native max. `switchLayer` also calls `map.setMaxZoom(t.maxZoom)` and clamps current zoom on cross-provider switches. Commit `87acdef`. Testplan: `tasks/map-tile-zoom-cap-2026-05-04-testplan.md`.

---

## ✅ Shipped 2026-05-08 - anti-spam, Turnstile, godmode surface 5, Leaflet fixes

- [x] **SUSPEND/DELETE layout fix** - `<select>` was filling the full row width due to `globals.css select{width:100%}`. Fixed with `width:'auto'` + wrapped Suspend+Delete as a single inner flex unit so they stay paired. Commits `9045492`, `2cc1a1d`.
- [x] **Pages Visited section on activity dossier** - added `visitor_logs` fetch (last 20 rows + total count) to the `Promise.all` in `app/moderate/users/[userId]/activity/page.tsx`. Shows path, IP hash, timestamp, and total visit count. Commit `b495cea`.
- [x] **Per-user Email button on /moderate rows** - `<a href="mailto:...">` rendered between Message and Characters when `u.email` is non-null. Commit `d00c5ac`.
- [x] **Bot-guard on signup: honeypot + consonant-run username check** - hidden `name="website"` field (positioned off-screen, not `display:none`); `looksRandom()` blocks usernames with 6+ consecutive consonants (y/Y treated as vowel). Triggered by spam account `wEpAfxklFqFikMBdndLxo`. Commit `6e49091`.
- [x] **Cloudflare Turnstile invisible CAPTCHA on /signup** - Script loads `api.js?render=explicit`, widget renders in Managed (auto-execution) mode; token cached in `cachedTokenRef` on solve callback; read on submit; verified against `/api/auth/verify-turnstile` (new route). Fail-open when widget errors; hard-block only on server token rejection. Commits `3b14a02`, `54c3402`, `315570c`, `3d95be2`.
- [x] **Cloudflare Turnstile hostname registration** - added `localhost`, `thetapestry.distemperverse.com`, and `vercel.app` to widget Hostname Management. Resolves Sentry error 400020.
- [x] **Thriver godmode surface 5: character-sheet edit for non-owned PCs** - `app/character-sheet/page.tsx` wires `isThriver` into `canEdit` + `onRoll`; `app/characters/[id]/edit/page.tsx` bypasses `user_id` ownership filter for Thriver profiles; `app/stories/[id]/table/page.tsx` widens `canEdit` on CharacterSheet to `gmLike`. Commit `ae0933a`.
- [x] **CampaignMap Leaflet fixes (Sentry cleanup)** - added `minZoom:2, maxZoom:19` to `L.map()` init (fixes "Map has no maxZoom" warning); added `map.remove()` in `useEffect` cleanup (fixes orphaned-instance `_leaflet_pos` TypeError when navigating away and back). Commit `b6852e0`.

---

## ✅ Shipped 2026-05-08 - /moderate redesign + visit-alert fix

- [x] **/moderate user-row redesign** - commit `397c6ec feat(moderate): user-row redesign + Track activity dossier`. Two visual rows: top = username + role chip + suspended chip; bottom = action buttons in one line (Make Survivor/Thriver, Message, Characters, Track, Suspend…/Unsuspend, Delete). New TRACK button opens the activity dossier. Per-user `Joined` and `Last login` dates surfaced.
- [x] **TRACK activity dossier** - new page `app/moderate/users/[userId]/activity/page.tsx`. Read-only cross-surface dossier: characters, campaigns owned (GM), campaigns joined (player), recent rolls (last 20 + total count), forum threads, forum replies, war stories, LFG posts, bug reports, map pins. All 13 sources fetched in parallel via `Promise.all`. Empty sections render `None.`.
- [x] **`admin_users_with_login()` + `admin_user_with_login(uuid)` RPCs** - `sql/admin-users-with-login.sql`, applied to live. SECURITY DEFINER, Thriver-gated, joins `profiles` + `auth.users.last_sign_in_at` so the client SDK can surface last-login without exposing `auth.users` directly.
- [x] **`profiles.email` backfill - GrumpyBattersby caught** - `UPDATE profiles SET email = auth.users.email WHERE profiles.email IS NULL`. All 16 of 16 profiles now have `email`. Old account `2d789818-…` from 2026-04-21 had been missed by the original backfill.
- [x] **Email visibility on /moderate row** - commit `9861034 fix(moderate,visits): emails always visible + visit alert on new ip_hash only`. Was a CSS-overflow bug (single-line layout with `overflow:hidden + textOverflow:ellipsis + whiteSpace:nowrap` ate emails behind long usernames). Fixed by splitting top row (username + chips) from bottom muted line (email · Joined · Last login) - email can never be cropped now.
- [x] **Visit-alert email gate - visitNumber === 1 only** - same commit `9861034`. The old gate stacked `isFirstVisit` (per-session) with `!isRepeatSurvivor` (signed-in user with `visitNumber > 5` was suppressed). Live `visitor_logs` showed every active user's `ip_hash` count was 88-1612, so `isRepeatSurvivor=true` on every request → no emails fired anywhere. Per Xero pref: binary gate. Edge function `supabase/functions/log-visit/index.ts` deployed live (`jbudzglgtxeoaufpejrv`).
- [x] **`RETURNS TABLE` column-ambiguity fix on the admin RPCs** - commit `78df30c fix(moderate): qualify Thriver-gate columns to escape RETURNS TABLE shadowing`. The unqualified Thriver gate `WHERE id = auth.uid() AND lower(role) = 'thriver'` collided with the OUT params declared by `RETURNS TABLE (id uuid, role text, ...)`. Aliased the gate's read as `caller` so every reference is qualified. Lesson captured in `tasks/lessons.md` 2026-05-08.

Testplans:
- [tasks/moderate-user-redesign-2026-05-08-testplan.md](moderate-user-redesign-2026-05-08-testplan.md)
- [tasks/moderate-email-visit-fixes-2026-05-08-testplan.md](moderate-email-visit-fixes-2026-05-08-testplan.md)

---

## ✅ Shipped 2026-05-06 marathon-session tail

Commits past the chat-boundary handoff at `f463a6d`. Earlier session work (2026-05-04 → 2026-05-05) is captured in `tasks/handoff-2026-05-06.md`.

- [x] **GM Notes popout - every field click-to-edit** - commit `c4610ad feat(gm-notes): make popout fields inline-editable`. Editable surfaces: campaign description, plot beats (campaign_notes title + content), scene names, NPC name/type/disposition/motivation/notes/hidden, pin name/notes/sort_order/revealed. Helper components `EditableText` / `EditableSelect` / `EditableToggle` / `EditableNumber` at the bottom of the file. Optimistic local update + rollback via `.update().select()` so RLS rejections surface as alerts.
- [x] **GM Notes popout - campaign description font 14 → 17px** - commit `6200fb2 style(gm-notes): bump campaign description 14→17px on popout`. Reads small from second-monitor distance; lede paragraph now visually distinct.
- [x] **Sequence guards on `useRollsFeed.refetch` + `useChatPanel.refetch`** - commit `d4a97e1 fix(realtime): sequence guards on rolls + chat refetch`. Ports the `loadEntries` `refetchSeqRef` pattern. Stale earlier query landing AFTER fresher state now drops instead of clobbering.
- [x] **Thriver godmode UI sweep - 4 of 5 surfaces** - commit `92f9243 feat(thriver): godmode UI sweep on table page`. Single `gmLike = isGM || isThriver` derivation routed through NpcRoster, CampaignCommunity, CampaignObjects, VehicleCard, the GM/Player Notes pane, and the `gm=` flag on the NPC sheet popout URL. Surface 5 (character-sheet edit affordance for non-owned PCs) deferred to next sweep. **Side-effect bug fix:** `VehicleCard canEdit={true}` was wide-open - now `canEdit={gmLike}`, so players can no longer edit shared vehicles.
- [x] **2026-05-06 backlog snapshot** - commit `24b8456 docs(backlog): 2026-05-06 open-work checklist + printable docx`. Generates `tasks/open-work-checklist-2026-05-06.md` + `tasks/open-work-2026-05-06.docx` + `scripts/build-open-work-docx-2026-05-06.py`. Supersedes `tasks/open-work-2026-05-05-printable.md`.
- [x] **Validated stale entries (cleanup, no new code)** - *Beginners' guide /welcome links* (already shipped `d4c75b7` 2026-05-05; pruned from checklist) + *PCs riding Minnie passenger-sync* (already shipped `7f71bce` 2026-05-05; pruned from checklist - only the "incompatible terrain" sub-question remains open).

---

## ✅ Shipped 2026-05-05 verification sweep

- [x] **Mounted-weapon attacks consume an action** - commit `62a2a27 fix(combat): mounted-weapon attacks consume actions`. Mounted weapons now properly decrement actions_remaining.
- [x] **Tighten RLS on campaign-tagged threads + War Stories** - commit `e1a0a60 fix(rls): tighten Campfire SELECT to campaign members on tagged content`, migration `sql/campfire-rls-tighten-campaign-scope.sql`. Covers forum_threads, forum_replies, forum_thread_reactions, war_stories, war_story_replies, war_story_reactions.
- [x] **Backfill old LFG freetext settings** - commit `751ed10 fix(lfg): backfill legacy freetext setting values to canonical slugs`, migration `sql/lfg-setting-backfill.sql`. Legacy freetext setting values normalized to canonical slugs.
- [x] **Empty-adventure module clone fails on null pin name** - `lib/modules.ts:324` defensive coalesce skips pin rows with no name/title (`console.warn('[cloneModuleIntoCampaign] pin row has no name/title - skipping:', p)`).
- [x] **Print sheet missing data (Relationships/CMod, Lasting Wounds/Notes, Tracking)** - commits `2e04ef4 feat(print): populate Print Sheet for existing characters` and `a979af2 fix(print): trim header, hand-fill RAPID + skills`. Verified at `components/wizard/PrintSheet.tsx:105,247-283`.
- [x] **Player NPC notes + first impressions** - commit `ed7b147 feat(npc): private player notes per-PC inside PlayerNpcCard` (UI), commit `5e3dd01` (skip-the-picker), table at `sql/player-npc-notes.sql` (commit `bdab202`).
- [x] **Remove Insight Dice cap** - raised to 10 in `components/CharacterCard.tsx:605-607` (was hardcoded to 9). Cap is `>= 10` / `< 10` now.
- [x] **Insight Die spend - track on roll_log** - commit `f9b59dc feat(roll-log): track Insight Die spend kind for full extended-log fidelity`, migration `sql/roll-log-insight-used.sql` adds the `insight_used` column.
- [x] **Re-seed an existing campaign with a setting's content** - commit `7a0e5cb feat(tools): /tools/reseed-campaign - idempotent setting re-seed` and `5c8cb3f`. Path `app/tools/reseed-campaign/page.tsx`.
- [x] **Destroyed-object portrait swap** - `components/TacticalMap.tsx:1373-1392`, migration `sql/scene-tokens-destroyed-portrait.sql`. Optional `destroyed_portrait_url` swaps on token death.
- [x] **Tapestry-side `<t:UNIX:format>` renderer** - commit `855a10c feat(rich-text): HammerTime <t:UNIX> renderer + URL linkifier`, `lib/rich-text.tsx`. Used across GmNotes / InlineRepliesPanel / PlayerNotes / ProgressionLog / TableChat.
- [x] **Hide-NPCs multi-select bar** - commit `5ce5e97 feat(npc-roster): multi-select bar for cross-folder bulk Hide/Reveal`. Cross-folder bulk Hide/Reveal lives on the NPC roster.
- [x] **Portrait bank - Supabase Storage upload** - `app/tools/portrait-resizer/page.tsx:305,463` inserts into `portrait_bank`; bucket per `sql/character-portraits-bucket.sql`.
- [x] **Auth gating on `/tools/*`** - commit `b0f59ee feat(tools): auth-gating audit + batch portrait resizer`. Each tool gates by isThriver/role.
- [x] **4E Notifications UI for LFG interest pings** - `components/NotificationBell.tsx:454-456` handles `type === 'lfg_interest'` with deep-link, trigger in `sql/lfg-interests.sql`.
- [x] **Reactions + comments on Campfire posts** - `components/ReactionButtons.tsx` + `components/InlineRepliesPanel.tsx`. Phase 4E.
- [x] **Campaign creation - "Run in District Zero" pre-populates setting content** - commit `3ba25a8` Phase 4C, `app/stories/new/page.tsx:34-211` accepts `?setting=<slug>`.
- [x] **Per-community Campfire feed (Communities Phase E)** - commit `9725b09 feat(communities): Phase 4D - per-community Campfire feed`, `components/CampaignCommunity.tsx:233-689`.
- [x] **`/modules` → `/rumors` marketplace browse + search + filters** - commit `6625a07 feat(modules): Phase C marketplace`. `app/rumors/page.tsx`.
- [x] **`/modules/[id]` detail page - version history + reviews** - commit `b9ac828`. `app/rumors/[id]/page.tsx`. Reviews via `sql/modules-phase-c-reviews.sql`.
- [x] **Listed-module Thriver moderation queue** - `app/moderate/page.tsx:111` queries modules for `moderation_status='pending'`/`visibility='listed'`.
- [x] **Module cover image upload + featured-module surface on dashboard** - `app/rumors/[id]/edit/page.tsx`, `app/campfire/page.tsx:230-260`, bucket `sql/module-covers-bucket.sql`.
- [x] **Migrate character photos from base64 → Supabase Storage** - commit `2c49873 fix(picker): sharpen library portraits + ship character-photo migration tool`. Tool at `app/tools/migrate-character-photos/page.tsx`.
- [x] **Tier C2 - extract initiative bar into its own component** - commit `f712691 refactor(C2)`. `components/InitiativeBar.tsx`.
- [x] **4E Inline `<t:UNIX:f>` token rendering** - same renderer as HammerTime above. Already in use across Campfire reply panels.

---

## ✅ Shipped 2026-05-01 (XSE SRD web reference + GM Notes drag-to-reorder)

**XSE SRD as a public web reference (`/rules/*`):**
- Sidebar `Rules` promoted from "- soon" placeholder to a real link. Public-prefix gating (`PUBLIC_PREFIXES`) added to `LayoutShell.tsx` so guests can read the SRD without an account.
- New `/rules` landing - 13-card section grid (§01-§08 + Appendices A-D). 11 stub pages render their anchor outline + a "forthcoming" notice; only `/rules/communities` ships full copy.
- `/rules/communities` (Style A - one long page, 16 anchors) - full §08 copy reconciled against `tasks/rules-extract-communities.md`. 4 "Try it →" callouts deep-link to `/communities` and `/characters/new`.
- `/rules/communities2` + 5 sub-pages (Style B - many short pages) - same SRD content split across `/recruitment`, `/apprentices`, `/morale`, `/structure`, `/crb-additions` for an A/B comparison test. Orange `StyleBanner` at the top of every comparison page flips to the other style anchor-aware. Loser of A/B gets deleted in one commit. ([components/rules/StyleBanner.tsx](../components/rules/StyleBanner.tsx))
- `RulesNav` left rail - non-scrolling column; only `<main>` scrolls (sticky was unreliable inside LayoutShell's existing scroll context). IntersectionObserver pinned to `<main>` so the active-anchor highlight tracks correctly. Manual `scrollIntoView` on hash-change so deep links like `/rules/communities#apprentices` land on the heading. ([components/rules/RulesNav.tsx](../components/rules/RulesNav.tsx), [app/rules/layout.tsx](../app/rules/layout.tsx))
- Wix export - `scripts/build-rules-html.mjs` fetches every `/rules/*` page, extracts `<main>`, absolutizes links to the live Tapestry domain, writes one HTML file per route to `out/wix-rules/` for paste into Wix HTML-embed blocks (Strategy B). Scheduled remote agent `trig_01WynguxqCjrQLWRaGfwjxr7` runs it ~30min after the deploy. ([scripts/build-rules-html.mjs](../scripts/build-rules-html.mjs))
- Sketch + test plan: [tasks/rules-srd-web-sketch.md](rules-srd-web-sketch.md), [tasks/rulescommunitiestestplan-2026-05-01.md](rulescommunitiestestplan-2026-05-01.md).

**GM Notes drag-to-reorder:**
- Each note in `GmNotes.tsx` is now `draggable`; drop above or below another note (decided by mouse Y vs row midpoint, 2px green bar previews the landing zone). All notes renumber 1..N on drop and persist in parallel via `Promise.all`. Optimistic local update reverts to server truth if any update fails.
- New `campaign_notes.sort_order integer` column with idempotent backfill `ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY created_at ASC)`. Index on `(campaign_id, sort_order)`. ([sql/campaign-notes-sort-order.sql](../sql/campaign-notes-sort-order.sql))
- New notes go to the end (max `sort_order` + 1). Component is column-tolerant - if the migration hasn't been run yet, the alert points the user to the SQL file.

---

## ✅ Shipped 2026-04-30 (Phase E close-out + Inventory full sweep + map-setup persistence)

**Communities Phase E (the world layer):**
- World Event CMod propagation - `map_pins` gets `cmod_active`/`cmod_impact`/`cmod_radius_km`/`cmod_label`; the Weekly Morale Check modal now auto-applies all matching active timeline events within their radius. New "World Events" slot with per-event opt-out checkboxes; full audit trail in `modifiers_json.worldEventsDetail`. ([sql/map-pins-world-event-cmod.sql](../sql/map-pins-world-event-cmod.sql), [lib/world-events.ts](../lib/world-events.ts), [components/CommunityMoraleModal.tsx](../components/CommunityMoraleModal.tsx))
- Player community subscriptions polish - denormalized `subscriber_count` + ★ chip on world-map popups + Following cards; subscriber-notify trigger fans cross-scope public-info changes to followers; Weekly Morale Check finalize bumps `world_communities.last_public_update_at` and auto-recomputes `community_status` from outcome (Thriving/Holding/Struggling/Dying/Dissolved). ([sql/world-communities-subscriber-count.sql](../sql/world-communities-subscriber-count.sql), [sql/world-communities-subscriber-notify.sql](../sql/world-communities-subscriber-notify.sql))
- "Start near existing community" wizard tile - fourth tile on /stories/new alongside Custom / Setting / Module. Picks an approved world community, seeds the new campaign's Homestead pin at its coords, fires the encounter handshake to the source GM. Self-filtered (own communities hidden).

**Apprentice creation flow rewrite:**
- Apprentice creation flipped from Paradigm-based to **Profession-based** per SRD §08 p.21 (Xero clarification). New 5-step wizard: Identity (name + age + 3 trait words + background) → Profession pick (12 PROFESSIONS, each seeds 1 CDP per profession-skill) → 3 CDP RAPID (baseline 0) → 5 CDP skills (per-skill SRD cap = master_PC.skill − 1) → Confirm. Recruit-time auto-rolls Motivation/Complication AND age + 3 words. ([components/ProfessionPicker.tsx](../components/ProfessionPicker.tsx), [components/ApprenticeCreationWizard.tsx](../components/ApprenticeCreationWizard.tsx), [lib/xse-engine.ts](../lib/xse-engine.ts) `THREE_WORDS_LIST` / `rollThreeWords` / `rollApprenticeAge`)

**Inventory system - full queue closed:**
- **#1** Encumbrance time-tick - GM Tools → Time. House-rule: every overencumbered PC + NPC loses 1 RP per hour over the limit. Hours stepper, affected-list preview with INCAP red-flag, single roll-log summary. PCs hitting RP=0 from non-zero with WP > 0 get the existing Mortal/Incap pipeline (incap_rounds + Stress pip).
- **#2** PC ↔ NPC trade - InventoryPanel give modal now shows three recipient groups: 👤 PCs (existing), 🎭 NPCs (new), 🏘 communities. Hidden-from-players NPCs filtered out for non-GM viewers; dead NPCs filtered too.
- **#3** Vehicle cargo unification - VehicleCargo aliased to InventoryItem; tolerant reads for legacy { name, qty, notes } rows; vehicle popout cargo editor surfaces enc + total/cap; VehicleCard summary stat shows current/cap with OVERLOADED red. Minnie's seed cargo backfilled with enc values (98 of 100 cap, 2 slack). ([lib/inventory.ts](../lib/inventory.ts))
- **#4** Shared community stockpile - new `community_stockpile_items` table (row-per-item, RLS gated to campaign members). 📦 Stockpile section under Role Coverage in CampaignCommunity panel; inline + Add (catalog autofills enc); InventoryPanel give modal gains 🏘 community recipients for deposits. Withdrawal-to-PC and realtime sub left as followups. ([sql/community-stockpile.sql](../sql/community-stockpile.sql))
- **#5** Barter trade negotiation - single-roll opposed Barter check between PC and target (NPC or community). Two-column item picker, rarity-weighted fairness gauge (Common 1 / Uncommon 2 / Rare 4), Roll Barter button, Apply Deal moves items both ways in one batch. Outcome states (Wild/High Insight = generous; Success = struck; Counter-offered = NPC won; Refused/Insulted = Dire/Low). ([components/TradeNegotiationModal.tsx](../components/TradeNegotiationModal.tsx))

**Map / scene polish:**
- Cell PX persistence - `tactical_scenes.cell_px` is now hydrated on popout open (gated by lastSyncedSceneIdRef so realtime UPDATEs don't clobber in-flight changes); debounced write on user change. Schema NOTIFY pgrst added so column changes propagate immediately. Persist failures now log to console with a `[scene-controls] <field> persist failed: <message>` tag.
- Grid settings persistence - show_grid / grid_color / grid_opacity now survive main-window refresh. Same scene-id-keyed hydration pattern. ([sql/tactical-scenes-grid-persist.sql](../sql/tactical-scenes-grid-persist.sql))
- Cell PX lower bound dropped 20 → 5 (still steps in 5s).

**GM screen + popouts:**
- GM Screen (`/gm-screen`) drag + resize + lock for the 7 reference panels - each box draggable by title bar, resizable via native CSS resize, layout persisted to localStorage; toolbar Lock/Edit toggle + Reset Layout. 8th GM Notes panel mounted via `next/dynamic` ssr:false + force-dynamic so SSR doesn't fail on the Supabase client.
- Map Setup popout dropdown - "Reuse map" lists every uploaded map across all the GM's campaigns (de-duped by URL, sorted alphabetically as `Campaign → Scene`); picking one stamps the URL onto the current scene without re-uploading.
- Delete Map / Delete Scene confirms moved to in-app modal (native confirm() was getting clipped in the narrow popout).

**Pin system:**
- Category icon picker on campaign pin edit + view-mode emoji indicator (shared lib/pin-categories.ts taxonomy with MapView).
- 🌍 Add to world map button → 🗺️ Add to tactical map button when in tactical mode; spawns a `token_type='pin'` minimal marker (just emoji, no square, no label) at (1,1).
- Tactical-mode X removes only the pin's markers from the active scene; campaign pin survives. New `scene_tokens.campaign_pin_id` links markers back to source. ([sql/scene-tokens-campaign-pin-link.sql](../sql/scene-tokens-campaign-pin-link.sql))

**Comic reader:**
- New `/reader-popout?pin=<id>` page. Pins with `reader_mode='comic'` get a 📖 button; popout flips through the pin's image attachments (sorted natural-numerically) with single/spread/fit toggles, page slider, full keyboard nav. ([sql/campaign-pins-reader-mode.sql](../sql/campaign-pins-reader-mode.sql))

**Story creation flow:**
- /rumors "All settings" filter repurposed as Sort By (Featured / Newest / Most subscribed / A-Z / Z-A).
- /stories/new - Custom Setting moves Starting Location above the "Or start from a Module" picker so location pinning happens first.
- Paradigm Pick → Step 4 (Final Review) on the edit wizard (was landing on Step 0).

**Tab + UI:**
- Mode-aware sidebar tab default - Pins for campaign map, NPCs for tactical/combat. Auto-flips on mode change only when user is on the other mode's default (Assets/Notes survive).
- NPC roster per-folder MAP/UNMAP button next to SHOW (places markers without revealing).
- Communities Phase E status: 96% implemented overall. Two items remain (per-community Campfire feed = blocked on Campfire existing → see Phase 4 plan below; Lv4 Skill Traits = locked on all-or-nothing Trait list).

---

## 🚀 Phase 4 - Campfire (scoped 2026-04-30)

**Reframe:** Phase 4 is **85% built** - Forums (A + B preview), War Stories, LFG, Timestamp tool, hub routing all production-ready. The actual remaining work is the cross-scope plumbing.

**Locked design decisions:**
1. **Forums design** - both A (Discourse) and B (Reddit) are parked. UX redesign deferred until Xero has new direction.
2. **Thriver approval** - required only when content leaves the GM's group. Campaign-internal = no approval. Setting / global = approval required.
3. **Setting hubs** - DZ + Kings Crossroads only (both already in setting taxonomy with full NPC + pin seed registries). Other settings (Custom / Mongrels / Chased / Arena) deferred.
4. **Community feed auto-posts** - ship auto first, parse back if too noisy. Morale outcomes / schism / migration / dissolution all auto-post.
5. **Default scope on new posts** - campaign-private (least surprising; Vegas-rules content stays in-campaign by default).

**Sprint plan (~7-10 days for 4A-D, polish 4E opportunistic):**

### Phase 4A - Per-setting feed layer (~2-3 days, foundational)
- DB: add `setting text NULL` + `(setting, created_at DESC)` index to `forum_threads`, `war_stories`, `lfg_posts`. Single migration + NOTIFY pgrst.
- Compose UX: radio "Where to post?" with three options (campaign / setting / global). Setting + global flag `moderation_status='pending'`.
- Reader UX: setting-filter chip strip (All · DZ · Kings Crossroads · Distemper · etc.) on each surface. /campfire dropdown for one-click context switch.

### Phase 4B - Promotion + moderation flow (~2 days, depends on 4A)
- DB: add `moderation_status` (`approved` | `pending` | `rejected`) + `approved_by` + `approved_at` to the same three tables. Same shape as `world_communities`.
- Compose: campaign-internal → instant publish; setting / global → pending. Author always sees own pending posts with a banner.
- Moderation queue: extend [app/moderate/page.tsx](../app/moderate/page.tsx) with sections for pending forums / war stories / LFG. Approve / Reject buttons mirror existing world_communities pattern.

### Phase 4C - Setting hubs DZ + Kings Crossroads (~2-3 days, depends on 4A + 4B)
- Route: `app/settings/[setting]/page.tsx` - single dynamic page for any registered setting.
- Layout: name + tagline → canon timeline (from `SETTING_PINS[setting]`) + community pin layer (`world_communities` filtered) → setting feed (4A's filter applied to Forums / War Stories / LFG) → "Run a campaign in [Setting]" button (jumps to /stories/new?setting=X).
- Sidebar: new "Settings" expandable with DZ + Kings Crossroads.

### Phase 4D - Per-community Campfire feed (~1 day)
- Closes spec-communities §2.
- Auto-posts: Morale Check finalize → `📊 <Community> · Week N · <Outcome>` with modifiers_json summary. Schism / Migration / Dissolution → auto-post the event. Manual GM "Post community update" for free-form.
- Surface: Community detail page + /communities Following card render the latest 5-10 events.

### Phase 4E - Polish (each ~1 day, opportunistic)
- [ ] Pagination on every feed (currently unbounded `.select('*')`)
- [ ] Full-text search across Forums / War Stories / LFG
- [ ] Reactions on War Stories + LFG (persist Forums B votes; extend pattern)
- [ ] Comment threading on War Stories + LFG (Forums has it; others flat)
- [ ] Formal `campaign_invitations` accept/reject flow (replaces DM-with-link)
- [ ] LFG filters by setting + schedule

**Explicit non-goals for Phase 4:**
- ❌ Forum redesign (parked)
- ❌ Hubs for Mongrels / Chased / Custom / Arena
- ❌ Homebrew tab (placeholder stays placeholder until design)
- ❌ User profiles / reputation

---

## ✅ Shipped 2026-04-29 (UI Streamline + Modules curation + portrait/community polish)

- **Persistent GM nav across all sub-pages** - new `<StoryToolsNav>`
  shared button row (Launch / GM Tools / Edit / Snapshot / Sessions /
  Community / Share) mounted on `/stories/[id]/edit`, `/snapshots`,
  `/sessions`, `/community`. Active page is highlighted via
  `usePathname()`. Hub `/stories/[id]` keeps its richer button row
  (GM Kit, Publish Module, Archive, Delete) since those carry heavy
  modal state. Commit `af15ca1`.
- **Survivors portrait gallery rebalanced** - `/characters` tile
  container flipped from fixed-88px flex-wrap to CSS grid
  `auto-fill 1fr` so tiles stretch to fill each row. Kills the dead
  block on the right. Commit `af15ca1`.
- **Character sheet - Evolution button** - purple button between
  Inventory and Apprentice on every CharacterCard. For now it
  smooth-scrolls to the existing Progression Log block on the same
  card; will wire up to the real CDP Calculator when that ships.
  Commit `af15ca1`.
- **Auto-expand single community on /communities/[id]** - clicking a
  community in My Communities now drops you into the expanded
  accordion (Homestead / Leader / Roles / Members) instead of a
  collapsed header. New `initialOpenId` prop on `CampaignCommunity`.
  Commit `af15ca1`.
- **/modules sort_order curation** - `modules` table gets `sort_order`
  int column + index. Marketplace + Edit page query in `lib/modules.ts`
  now sort by `sort_order ASC NULLS LAST, created_at DESC`. Edit page
  exposes a numeric sort-order field. SQL: `sql/modules-sort-order.sql`
  pins the 5 setting modules in Xero's order
  (Empty=1, Chased=2, Minnie=3, Basement=4, Arena=5). Commit `d8eeb23`.
- **/modules EDIT button + cover upload** - Thrivers and module authors
  see EDIT alongside DELETE on each card. New page
  `app/modules/[id]/edit/page.tsx` lets the author upload a cover image
  to the `module-covers` Supabase Storage bucket and edit name /
  tagline / description / content_tags. Commit `8951b0f`.
- **MY STORIES streamline** - Enter renamed to **GM Tools**, dropped
  `target="_blank"` so it opens in the same tab, removed the **Clone**
  button entirely (publish-as-Module is the canonical clone path),
  pulled Snapshot management out of the Edit page into its own
  `/stories/[id]/snapshots`. Commits `84b831d`, this commit's prep work.
- **Settings list trimmed to 3** on `/stories/new` -
  Custom · District Zero · Kings Crossroads (Mall). The 5 deprecated
  setting slugs (Empty / Chased / Minnie / Basement / Arena) live on as
  published modules via the new Thriver migration tool
  `/tools/migrate-settings-to-modules`. Commits `70fa32f`, `b310ccd`,
  `197491d`.
- **Kings Crossing → Kings Crossroads rename** - real Delaware location
  is "Kings Crossroads" (Sussex County, near Greenwood). Full code
  rename across `lib/settings.ts`, `lib/setting-npcs.ts`,
  `lib/setting-pins.ts`, plus DB migration
  `sql/setting-rename-kings-crossroads.sql` (applied). Commit `b5f5602`.
- **Font swap - Barlow Condensed → Carlito (legibility)** -
  playtesters reported the narrow Barlow Condensed at 13px (the
  project's minimum inline font-size) was hard to read on UI labels,
  chips, and buttons. Carlito is the open-source metric-compatible
  clone of Calibri: wider letterforms, far more legible at small sizes.
  1,583 inline `font-family` references swapped across 91 files -
  inline JSX styles, Leaflet popup HTML strings, canvas `ctx.font`,
  double-quoted variants, and escaped-quote innerHTML. Body text keeps
  regular `Barlow`. Carlito now loaded via Google Fonts in
  `app/layout.tsx` (`Barlow+Condensed` removed from URL). Commit
  `0baea8c`.

## ✅ Shipped 2026-04-29 (combat correctness + perf + C2 extraction)
- **Grapple opposed-check tiers** - opposed checks now resolve by
  outcome tier ordering (Wild Success > Success, Failure > Dire
  Failure) instead of binary success-vs-success = tie. Fix per Xero's
  CRB read. Commit `4ebd57f`.
- **Player-side loot - Search Remains** - `🎒 Search Remains` button on
  `PlayerNpcCard` when displayStatus is dead/mortally wounded/uncon.
  New SECURITY DEFINER RPC `loot_npc_item` does atomic transfer +
  audit row in roll_log. SQL: `sql/loot-npc-item-rpc.sql`. Commit `11ddf77`.
- **Weapon jam persists** - Low-Insight jam now sets a `jammed: true`
  flag on the weapon slot so the Unjam (Ready Weapon) button stays
  available across renders. Commit `42291ba`.
- **Snapshot RESTORE auto-launches** - after a successful snapshot
  restore, the page jumps to `/stories/[id]/table` so the GM doesn't
  land on a blank screen. Commit `7c26a9d`.
- **Render-perf sweep** - `React.memo` on `TacticalMap`,
  `CharacterCard`, `NpcRoster` + new `useStableCallback` for the 11
  inline TacticalMap callbacks lifted out of the table page. Caveat:
  parent's call-site props for CharacterCard/NpcRoster still pass
  inline objects on every render - memo will fully kick in once those
  call sites are stabilized. Commit `743fa75`.
- **Mount-fetch parallelization** - 5 sequential await pairs
  (loadEntries, rollsFeed) collapsed into Promise.all. Commit `7930e3b`.
- **C2 InitiativeBar extracted** - 406-line component pulled out of the
  9300-line table page. Lives at `components/InitiativeBar.tsx`.
- **Auth Web-Lock contention** - codemod across 44 files migrating
  `supabase.auth.getUser()` → `getCachedAuth()`. Commit `67989ce`.
- **Distract redesign** - unified ATTACK ROLL modal + 30 ft Close-range
  gate + outcome scaling (Wild=both, Success=1, Dire Failure=Inspired+1)
  + object filter + auto-select pre-selected target + log line trim.
  Commits `c04650c`, `9218f86`, `2e15258`, `dea681d`, `931de35`.

## 🎯 From 2026-05-04 Mongrels playtest

- [ ] **Random character generation - Medic paradigm should grant First Aid.** Tonight a player rolled a random character with the Medic paradigm but the resulting character sheet had no First Aid skill. Per the SRD, Medic's paradigm-skill list includes First Aid (or whatever the canonical equivalent is - `lib/xse-schema.ts` `PARADIGMS` is the source of truth). Either (a) the random-character route doesn't honor paradigm-skill seeding, or (b) Medic's entry in the paradigm definitions is missing First Aid. Repro: `/characters/random`, generate until a Medic comes up, inspect the skills block.

## 🎯 From 2026-04-29 chat - roll-log clarity + modal unification + new-campaign bug

- [ ] **Gut Instinct results presentation needs rework.** Tied to "how info is shared in roll logs" - current Gut Instinct rolls land in the standard roll modal + roll_log feed, but the *result framing* doesn't communicate what the player learned (or didn't) clearly. Needs design discussion: what's the canonical surface for "your gut says X" - narrative card in the feed? An overlay on the rolling PC's sheet? GM-only insight delivered via DM? This is about player comprehension, not mechanics - the formula (`Perception + Psychology/Streetwise/Tactics`) is fine.
- [ ] **First Impression → straight to roll modal.** Today First Impression has a separate pre-roll picker (target NPC + skill). Xero wants clicking First Impression on a revealed NPC card to **skip the picker** and dump straight into the main Attack Roll modal pre-populated with `INF + Manipulation/Streetwise/Psychology` and the NPC pre-targeted. Save: ~3-4 clicks per use. Same "roll-log clarity" theme as Gut Instinct.
- *(Modal unification + CMod Stack third-copies dedup-removed 2026-05-19. Canonical entries live in CURRENT OPEN > "Ready to build (medium)" - search for "Modal unification (5 of 6 remaining)" and "CMod Stack reusable component".)*

## 🎯 From 2026-04-27 Mongrels playtest (Xero's batch handoff)

Xero captured the following items mid-/post-playtest. Bugs first, then UX, then content, then long-term map features. Each is self-contained so an agent can pick one up cold.

> **Scheduled sweep:** the three combat-correctness items marked 🤖 below are queued for a one-shot remote agent on **2026-04-30T16:00:00Z** (Thursday 10am MT) - routine `trig_01DgrfRt5ymUuU4fUf2jzq8N`. The agent will triage what's already fixed, ship the rest, and check the items off itself. Don't grab them manually unless something blocks the playtest before then.

### Bugs (combat correctness)
- [x] 🤖 **Distract didn't remove an action for the next round on Cree.** (Shipped be6e768 2026-04-30 - Distract result handler was already fixed with .select()+SILENT RLS FAIL+turn_changed; applied same defensive pattern to Cover Fire and Inspire in applySocialAction which had the same raw-update gap; sql/initiative-order-rls-members-write.sql already exists covering the RLS write policy.)
- [x] 🤖 **Stabilize should consume an action.** (Verified 2026-04-30 - no change needed; fireStabilize already sets actionPreConsumedRef=true then awaits consumeAction before the roll modal is interactable; consumeAction has .select()+SILENT RLS FAIL; closeRollModal sees preConsumed=true and correctly skips double-consume on all paths including cancel. Pre-existing RLS fix file sql/initiative-order-rls-members-write.sql covers the write.)
- [x] **Stabilize button should pick from ALL mortally-wounded characters in range, not just the first.** Shipped 2026-04-28 as `476989e` - `find` → `filter`, every wounded combatant within 20ft gets its own button, each with its own engaged check. Single-target case looks identical to before. Testplan: tasks/stabilize-multi-target-testplan.md.
- [x] 🤖 **What happens to a character after Stabilize is used?** (Shipped 3026569 2026-04-30 - root cause identified: Stabilize success branch wrote to character_states without .select(), so a silent RLS rejection left death_countdown untouched and the round-tick continued the death spiral. Added .select()+SILENT RLS FAIL to both the PC (character_states) and NPC (campaign_npcs) success paths. Round-tick Warren guard verified correct: dcActive=(death_countdown!=null && >0)=false when death_countdown=null, so !dcActive=true and WP=1 bump fires correctly for stabilized chars. incap_rounds=max(1,1d6-PHY) confirmed correct per spec (todo.md §405).)
- [ ] **Lag on initiative - needs solo validation.** User will playtest alone with multiple combatants and confirm the perceived lag on turn advance. Earlier work shipped batched fetches in `nextTurn` (see [PLAYTEST_TODO.md:81](tasks/PLAYTEST_TODO.md:81) #32) but a long initiative chain may still feel slow. Look for: sequential awaits in `nextTurn` that aren't yet in `Promise.all`, missed indexes on initiative_order, the postgres_changes subscription firing extra unnecessary `loadInitiative()` rounds. Don't action until Xero confirms the symptom on his own machine.

### Bugs (visibility / permissions)
- [ ] **Hide NPCs - folder-level reveal + panic button.** Folder-level 'Reveal all in this folder' button + panic-button 'reveal entire roster' (multi-select bar + auto-reveal-on-Start-Combat already shipped).

### Rules / mechanics gaps
- [x] **Crossbow + bow should require a Reload / Ready Weapon between shots.** Shipped 2026-04-28 (earlier) as `03de984` - Attack button disabled when `ammoCurrent <= 0` on clip-tracked ranged weapons.
- [x] **Weapon DB SRD audit - confirm everything is there (Club is missing).** Shipped 2026-04-28 (Path A: rename + add + fix) as `179f883` + `769e3e4` + DB migration `sql/weapons-srd-rename.sql`. Findings: 5 entries had stats matching CRB weapons but wrong names (Bayonet/Bowie→Baseball Bat, Bat/Stick→Bullwhip, Cleaver→Club, Makeshift Cleaver→Makeshift Club, Compact Bow→Compound Bow). Plus 3 stat fixes (Machete range, Compound Bow range/rarity, Katana parens) and 3 new weapons (Black Powder Rifle, Mortar, Tranquilizer Gun). Audit: tasks/srd-weapons-audit.md. Cattle Prod 400% confirmed correct; RPG Launcher → Rocket Launcher rename + Flamethrower clip discrepancy still flagged in audit doc as open follow-ups.

### UX / friction
- [ ] **Streamline logging into missions.** Xero says login → join campaign → land in table is too many steps for players. Audit the player side of the flow today: `/login` → `/stories` → click campaign → click "Join Session" → `/stories/[id]/table`. Possible streamlines: deep-link straight to the active session if there's one running; auto-redirect from `/stories/[id]` to `/table` when the GM has a session active; preserve the last campaign in localStorage and offer a "Resume last session" tile on `/stories`. Discuss with Xero before shipping - the right cut depends on what specifically felt slow.
- [x] **Drag-to-bottom-left is blocked by a popup.** Shipped 2026-04-28 as `cf175f8` - TacticalMap toggles `body.dragging-token` while a token drag is in progress; globals.css disables pointer-events on `.drag-blocker` overlays. Both NotificationBell + MessagesBell dropdowns now carry the className. Notification position stayed locked at `left:10px` per the feedback memory.
- [x] **Map pinging is too clunky - make it easier.** Shipped 2026-04-29 - **Alt + left-click on an empty cell** fires a ping. Replaces both the press-and-hold (~600ms) and the Alt+double-click gestures, both of which felt clunky. Modifier keeps it deliberate - no accidental clicks fire pings. Token interactions on the cell still win.

### Long-term (map features, not for next sprint)
- [ ] **Dynamic lighting on the tactical map.** Player vision limited by light sources (torches, lanterns, sun) - areas outside the lit radius render fogged. Will need a lights layer on `tactical_scenes` (`{ x, y, radius, color }[]`), per-token visibility computed against light sources, fog-of-war canvas pass on the player side. Big feature; design separately when prioritized.
- [ ] **Doors on tactical maps.** Door tokens with open/closed state, blocking movement and (with line-of-sight) blocking vision when closed. New `door` token_type on scene_tokens with a `is_open boolean` field. GM toggles by clicking the token; player movement pathfinding respects closed doors.
- [ ] **Line of sight on tactical maps.** Visibility blocking (walls, large objects, closed doors) hides tokens beyond the wall from the player's view. Probably implemented as a polygon vision mask per token, recalculated on token move. Heavy lift - pairs naturally with dynamic lighting since they share the visibility pipeline.

## 🎯 Next up (post-combat sprint)
- [x] **NPC inventory - primary & secondary weapons should count toward encumbrance.** Shipped 2026-04-28 as `e6199bc` - NpcCard was passing empty strings to InventoryPanel for the weapon names; now pulls them off `npc.skills.weapon.weaponName` / `npc.skills.weapon2.weaponName`. InventoryPanel + computeEncumbrance were already correct, just being fed nulls.
- [x] **Player-side loot - Search Remains button on the NPC popout.** Shipped 2026-04-29 as `11ddf77` - `PlayerNpcCard` shows "🎒 Search Remains" when `displayStatus !== 'active'`; new SECURITY DEFINER RPC `loot_npc_item` does atomic transfer + audit row in roll_log. SQL: `sql/loot-npc-item-rpc.sql`.
- [x] **Stale realtime subscriptions - table tab needs manual refresh after backgrounding.** Shipped 2026-04-28 as `607342d` - visibilitychange listener on the table page + useChatPanel + useRollsFeed re-runs the load functions on hidden→visible. State refetch only in v1; channel rebuild deferred until/if state-only proves insufficient (supabase-js handles socket reconnection internally on health checks). Testplan: tasks/realtime-visibility-refetch-testplan.md. Also covered later by useRollsFeed extraction (B2.2) which carries the same handler.
- [x] **SRD wording sweep - replace user-visible "SRD" with "the rules"** - shipped 2026-04-28 as `84027d4`. 8 user-visible hits swapped: CommunityMoraleModal leader-not-set banner + 4 tooltips, CampaignCommunity Assigned-NPCs hint + Re-balance Roles tooltip, stories/[id]/community quota-tick tooltip. gm-screen `XSE SRD v1.1` header left as a system-version banner pending Xero's call. Code comments referencing SRD as a source remain (authoring notes).
- [ ] **King's Crossing Mall - tactical scenes** - author battle maps for the mall complex (motel courtyard, Costco interior, gas station, Belvedere's etc.) and wire into `SETTING_SCENES.kings_crossing_mall` in `lib/setting-scenes.ts` using the same filter-from-CHASED_SCENES pattern as the pins + NPCs.
- [ ] **King's Crossing Mall - handouts** - port any in-world broadcasts, journal pages, or ham-radio transcripts that fit the persistent mall setting into `SETTING_HANDOUTS.kings_crossing_mall` in `lib/setting-handouts.ts`. Mirror the filter-from-CHASED_HANDOUTS approach.
- [x] **Community leader "step down" mechanism** - shipped 2026-04-23. PC leader or GM sees a "Step Down" button next to the Leader dropdown; picker offers Auto (next founder → longest-tenured), Leave Leaderless, or any specific member. `handleRemoveMember` now auto-promotes the same way when the outgoing member was the leader, so leaving the community also triggers succession.
- [x] **"Assigned" role - mission/task linkage** - shipped 2026-04-23. Schema: `assignment_pc_id uuid` on community_members (FK to characters, ON DELETE SET NULL) + reuses `current_task` from the Apprentice migration. UI: picking "Assigned" on the role dropdown opens a modal for director PC + task text; save writes all three fields in one update; cancel leaves the role unchanged. Display: assigned rows mirror Apprentice rows - `<NPC> ⇐ <PC>` name + "Task: <text>" line with GM-edit ✎. Flipping role OUT of 'assigned' auto-clears assignment_pc_id + current_task. PC-deletion silently clears via FK. SQL: `sql/community-members-add-assignment-pc.sql`.
- *(CMod Stack reusable component third-copy dedup-removed 2026-05-19. Canonical entry in CURRENT OPEN > "Ready to build (medium)" - "CMod Stack reusable component".)*
- [ ] **GM force-push view to players** - when the GM switches view (campaign world map ↔ tactical map, or scene A ↔ scene B), they should be able to push that view change to every connected player so everyone follows along automatically. Today there's `tactical_shared` / `tactical_unshared` broadcasts on `init_${id}` that toggle the tactical-map pane on the player side, but no general "switch to scene X" or "switch to campaign view" push. Likely shape: extend the `tactical_shared` broadcast (or add a new `view_changed` event) carrying `{ view: 'campaign' | 'tactical', sceneId?: string }`; player TacticalMap activates the matching scene + opens/closes the pane to match. GM side: a "Sync to players" toggle (or always-on) + auto-fire on scene-switch in TacticalMap setup.
- [ ] **Character Evolution / CDP Calculator** - post-creation character growth tool. Characters earn CDP (Character Development Points) over time (per-session awards, session arcs, milestones) and spend them to raise RAPID attributes, raise/acquire skills, take Traits, etc. Today the character creation funnel (`/characters/new` Backstory, `/characters/quick`, `/characters/random`) handles the CDP spend at character-creation time only; there's no surface for spending earned CDP afterward. Build a `/characters/[id]/evolve` (or modal on the character sheet) that: (1) shows the character's current CDP balance from `data.cdp` (already tracked), (2) lists buyable upgrades per the rules - attribute raises (cost = current value × multiplier), skill raises (cost = next-level cost), new trait picks (cost depends on tier), (3) previews the cost before commit, (4) applies the spend in one transaction (decrement `data.cdp`, write the changes, append a `roll_log` entry with `outcome='evolution'` so the table feed surfaces it). Reuse the wizard's CDP cost tables - they're already in `lib/xse-engine.ts` / wizard step components; extract into a shared helper if needed. Player-facing tool, GM doesn't need to approve (CDP is GM-awarded already, spend is the player's call). Audit log entry covers the GM oversight surface.
- [x] **GM Tools → Restore to Full Health is slow** - shipped 2026-05-05 as `55d0693`. DB writes were already parallelized via Promise.all; the real freeze was the post-write refetch blocking modal close. Fix: optimistic local patches BEFORE the await, modal closes immediately, refetch + broadcast run in background. `Restoring…` disabled-state on the button. Per-row UPDATEs are still N (different wp_max per row prevents `.in()` batching), but they all fire in one Promise.all wave so 11 targets = ~150ms not ~1.6s. Comment at `app/stories/[id]/table/page.tsx:9735` documents the fix. **If this still feels slow in a real session, the next escalation is a SECURITY DEFINER bulk_restore RPC using CASE WHEN to collapse to one round-trip - log fresh repro first.**
- [x] **Restore from snapshot auto-launches into that snapshot** - shipped 2026-04-29 as `7c26a9d` - `CampaignSnapshots.tsx` now `window.location.href`'s to `/stories/<id>/table` after a successful restore so the GM lands directly on the scene.
- [x] **`/modules` Thriver-delete + clear test modules** - shipped 2026-04-29: Thriver-only DELETE chip on each `/modules` card (also gated to module author); confirmation modal in place. Test-module bulk-clear handled by Xero via the new chip.
- [x] **Phase C Communities** - weekly Morale Check + Resource Checks (Fed/Clothed) shipped 2026-04-23. Activity Blocks + Lv4 skill auto-CMods deferred to Phase D.

## 🔒 Backburner - Campaign calendar
**Status:** Multiple independent in-game time signals exist (`communities.week_number`, the new Advance Time / encumbrance tick, `map_pins.event_date` text, world event `cmod_active` toggle, `sessions.start/end` real-world). They work decoupled today; a unified calendar would let them interlock - time-tick advances real game clock → communities auto-week-tick → Morale becomes due → world events with end-dates auto-deactivate → ration consumption etc.

**Why deferred:** none of the friction points actually bite yet. Manual Skip Week + manual world-event toggle + manual encumbrance tick all work in current play. Building a calendar to head off pain that hasn't materialized is premature. See `memory:project_campaign_calendar.md` for the full framing.

**Revisit triggers** (any one of these flips it back to active):
- [ ] Forgetting to Skip Week and a community sits frozen for 4+ sessions
- [ ] World events that should've ended weeks ago still applying CMod in play
- [ ] Wanting "X days passed" → automatic ration consumption / weather change / community drift
- [ ] Encumbrance tick feels like it should auto-fire on time advancement instead of being a button

When picking this back up:
- [ ] DB: a `campaign_clock` table or jsonb on `campaigns` (start_date + ticks_per_day + current_tick).
- [ ] Helper `lib/campaign-clock.ts` exposing `advance(campaignId, hours)` that fans out to every time-aware subsystem (encumbrance ticks, community Morale due-dates, world event activation, ration decay).
- [ ] UI surface: probably a small clock widget in the table page header showing "Day N · Hour H" with a +/- stepper on it. GM-only.
- [ ] Migrate the `Time` button from Inventory #1 to use the unified clock instead of its current standalone tick.

## ✅ Shipped 2026-05-14 - Thriver godmode UI sweep COMPLETE
Final pass shipped in commit `07652f8` (merged to main `98d81c9`). DB layer (`sql/thriver-godmode-policies.sql`) was in place for weeks; UI was deferred so the sweep could land in one pass. Today's commit finishes:
- `app/stories/[id]/snapshots/page.tsx` - upstream gate admits Thrivers
- `app/campaign-sheet/page.tsx` - Advance Time / Heal / Edit Clock / Export Log / Pending Heal Cancel all widened
- `app/stories/[id]/page.tsx` - Rejoin banner / extraButtons / My Survivor card / Remove member all gmLike
- `app/stories/[id]/table/page.tsx` - header bar action buttons, 7 prop-passes (InitiativeBar, ChatComposer, TacticalMap, CampaignMap, ObjectCard, two CharacterCard), ~30 internal gates (entries.filter, action handlers, NpcCard vs PlayerNpcCard, hidden_from_players filter, special-check pickers, canControl, canAct, onKick, onRoll)
- Strict `isGM` kept on identity-only surfaces: "GM View" header, "(GM)" badge, telemetry log, recorder toggle (Thriver-only by design)
- Pattern: widen at the caller (`isGM={gmLike}`) per the lessons memo
- Per Xero (2026-05-14): widening `entries.filter` means visiting Thrivers see every PC sheet + every player's rolls; `onKick` widening means Thrivers can kick from initiative. Both intentional.
- Plan: `tasks/thriver-godmode-sweep-plan-2026-05-14.md`
- Testplan: `tasks/thriver-godmode-sweep-testplan.md` (Sections 1-4 Thriver checks + Section 5 GM no-regression + Section 6 Survivor no-leak)
- Earlier shipped passes (preserved here for history): `92f9243` (table page partial 4/5), `ae0933a` (character sheet edit), `bea860a` (community + vehicle pages), CampaignCommunity / CampaignObjects / GmNotes / VehicleCard / CampaignSnapshots already wired before today.

*Inventory migration removed 2026-04-21 - DB audit confirmed every character's `data.inventory` is already an array. Nothing to migrate.*

## ✅ Shipped 2026-04-25/26 (player UX polish)
- **Tactical map view persists across page refresh** - per-campaign `localStorage` key `tactical_map_view_<id>`. `useState` function initializer reads it on mount; a `useEffect` writes the latest value, so every transition path stays in sync (GM share broadcast, combat_ended, GM toggle, player going back to campaign map). Players who refresh during the tactical view stay there instead of snapping back to the world map. Commit 6214a33.
- **DM messages auto-linkify URLs** - the campaign-invite DM body said "Tap to join: https://…" but the URL was rendered as plain text - uncopyable on mobile, unclickable everywhere. Added `linkifyBody()` helper in `app/messages/page.tsx` that splits on http(s) URL boundaries and emits `<a target="_blank" rel="noreferrer">` for each chunk. Applies to every DM, not just invites. Commit e541fa5.
- **Player NPC popout is 140×140** - GM keeps the 571×257 default (full NpcCard is dense). Player popout opens the read-only PlayerNpcCard (portrait + name + 2 badges + close), so 257px height was mostly empty. Two reachable-by-player paths pass `{ w: 140, h: 140 }` when `!isGM`. **Plus** a `window.resizeTo()` on mount inside `app/npc-sheet/page.tsx` because Chrome remembers per-window-name geometry - without it, a popout that was ever opened at the larger size stays large. Commits 100f738, this commit.
- **Retention Check - drop SRD reference + skill picker** - copy now reads "to salvage fragments" (no rule citation). Leader sees an inline skill picker + SMod field next to the Attempt button on the Result stage; defaults to whatever drove the failed Morale roll, swappable. Commit 6007832.
- **`/campfire` warmer tagline** - "The meta layer - connect with players, GMs, and visitors across campaigns." → "Take a seat. Here you can connect with players, GMs, and visitors outside of campaigns." Commit f3703c3.
- **Copy nits** - "Roles are already at SRD minimums" → "their minimums" (commit 492fede). `/creating-a-character`: "the SRD does not allow banking" → "the rules do not allow banking" (commit 7a4d5d7).

## ✅ Shipped 2026-04-24 (Tapestry rebrand + Communities polish)
- **Brand taxonomy enforced** - every user-visible "Distemperverse" reference in CampaignCommunity rewritten to "Tapestry" (publish strip, button, modal copy, unpublish confirm, sub-headings, recruit-offer count). Memory `project_brand_taxonomy.md` records the rule: DistemperVerse = umbrella IP (game + comics + platform), Tapestry = the platform itself; cross-campaign features always = Tapestry. Code comments scrubbed too - zero `Distemperverse` strings left in any .ts/.tsx (commits 141ac1c, af6bd29).
- **Player self-leave Communities** - red-bordered "Leave" button on a player's own PC row, distinct from the GM's "Remove" ×. Soft-leaves via `community_members.left_at` with `left_reason='self'`. New RLS policy `Player leaves own community row` (`sql/community-members-self-leave.sql`) lets a campaign member soft-delete only their own PC's row. Commit bc997c8.
- **delete-user edge function - full table + storage sweep** - fixed npc_relationships bug (was keying on user_id instead of character_id, always a no-op); added explicit cleanup for newer campaign-scoped tables (player_notes, campaign_notes, campaign_snapshots, object_token_library, tactical_scenes, communities); recursive storage-bucket sweep across pin-attachments, note-attachments, object-tokens, campaign-npcs, tactical-maps, session-attachments per owned campaign. Auth deletion last so partial failures don't strand orphan auth rows. Needs `npx supabase functions deploy delete-user --project-ref jbudzglgtxeoaufpejrv`. Commit 842b9f3.
- **Pin date dropped from expanded card** - `By <username> · Apr 7, 2026` → just `By <username>`. world_event pins still show `event_date` (in-world date, useful). Commit 8e50cc6.
- **"Published Communities" → "Player Communities"** - synthetic folder label in the MapView pins panel reads better for a ghost reader. Commit 612cc7b.
- **Community size_band retaxonomy** - old Small/Band/Settlement/Enclave/City scale → new Group/Small/Medium/Large/Huge/Nation State (Group <13, Small 13-50, Medium 51-150, Large 151-500, Huge 501-1000, Nation State 1000+). Updated `computeSizeBand`, MapView marker dot ramp (20→40px), and the world_communities CHECK constraint. One-shot migration `sql/world-communities-size-band-retaxonomy.sql` recomputes each row from live member count, falls back to label-swap when source is gone. Default bumped to 'Group'. Commit 0cbeb8e.
- **`notify_world_community_public_update()` array_append fix** - latent bug: trigger used `text[] || 'literal'` which Postgres parses ambiguously and fails with `22P02 malformed array literal`. The retaxonomy was the first UPDATE to ever change `size_band` on existing rows, surfacing it. Replaced with `array_append`. Inline fix in `sql/world-communities-update-notify.sql`; live-environment patch in `sql/world-communities-update-notify-fix.sql`. Commit f459e72.
- **Sidebar version chip v1.0 → v0.5** - aligns with the actual phase coverage. User will step it forward as Phase milestones complete. Commit e969aca.
- **Copy polish** - "Roles are already at SRD minimums" → "their minimums" (commit 492fede). `/creating-a-character` step copy: "the SRD does not allow banking" → "the rules do not allow banking" (this commit).

## ✅ Shipped 2026-04-23 (Mall setting wiring + small polish)
- **King's Crossing Mall - NPC seed wired** - added `KINGS_CROSSING_MALL_NPCS` as a filtered subset of CHASED_NPCS (12 names: Robertsons, Ortizes, Pastor Nick, Eric, Macy, Mikey, Art Buchanan) plus Maddy Bell + Troy & Mark Bell as post-Chased survivors. Wired into `SETTING_NPCS.kings_crossing_mall`. Single source of truth, so Chased stat tweaks propagate. Connors intentionally excluded - Chased-only antagonists. Commits c5b62f3, 4de722e.
- **King's Crossing Mall - pin seed wired** - `KINGS_CROSSING_MALL_PINS` filters CHASED_PINS by title for the 7 mall complex pins (Best Nite Motel, Belvedere's, Drop By, Costco, Tri-State Firearms, Swiss Tony's, RoadCo) plus Georgetown reference pin. NPC pin_title references resolve correctly in the Mall setting now. Commit ca28029.
- **NPC auto-file to "Community Members" folder** - Postgres trigger on `community_members` INSERT moves `campaign_npcs.folder` to 'Community Members' if currently unfiled (preserves custom folders). Backfill at the bottom files currently-recruited unfiled NPCs immediately. Apply `sql/npc-folder-auto-community-members.sql`. Commit 7c650bc.
- **Minnie floorplan replaced** - hand-drawn PNG (2 MB) swapped in for the small reference photo. `sql/minnie-floorplan-update.sql` updated to `.png` and re-run-safe. Commit 885230a.
- **Mall scenes/handouts/reseed-campaign tool added to TODO** - currently in the Next-up list (Phase E preparation work). Commit c231c11.

## ✅ Shipped 2026-04-23 (Communities Phase D - Activity Blocks + Dashboard)
**NOTE:** The Lv4 Morale auto-CMods that originally shipped in this batch (Inspiration "Beacon of Hope" +4, Psychology\* "Insightful Counselor" +3) were reverted on the same day - Xero's ruling is Lv4 Traits ship together with the full list or not at all. See `memory:project_lv4_traits.md`. The entries below are what remains live.
- **Skip Week button** - secondary "Skip Week" on the Weekly Check strip advances `week_number` without rolling. Pure clock bump, no consequences; Mood still carries from the last actual check.
- **Pressgang confirmation** - Conscript approach on the Recruit modal now shows a red "pressure, not persuasion" warning banner at pick stage, plus a blocking confirm() at submit. Cancel returns to pick without burning Insight Dice.
- **Community Dashboard** - new GM-only route `/stories/[id]/community`. Community picker + Morale history (last 20 weeks) + resource history (last 40 rolls) + current role distribution with SRD-minimum threshold markers + recruitment stats by approach + member-type breakdown. Community ▾ → Dashboard entry links to it.
- **At-a-Glance block** - inside each expanded community body: Recent Morale trend chips (W/H/S/F/D/L letters, last 5 weeks) + "You" row showing the viewer's role, Apprentice bond, and NPCs they recruited. Visible to everyone; primary view for non-GMs.
- **Apprentice task delegation** - `community_members.current_task` text column. Apprentice rows render a "Task: <text>" line with GM-edit ✎; no task + GM → "+ Assign task" dashed button. Edit-in-place with Enter/Escape keyboard handling. SQL: `sql/community-members-add-current-task.sql`.

## ✅ Shipped 2026-04-23 (Communities Phase C - Weekly Morale loop)
- **Weekly Check modal** - `components/CommunityMoraleModal.tsx`. Single-button rolls Fed → Clothed → Morale in sequence. GM sees per-roll AMod/SMod/CMod inputs + 6 auto-filled Morale slots with override inputs (Mood from prior check's cmod_for_next; Enough Hands / Clear Voice / Safety computed mechanically; Fed + Clothed snap to actual rolled outcomes; Additional freeform). Result stage shows each roll, slot breakdown, departures / dissolution, then "Finalize & Save" commits everything in a single batch (cancel leaves DB untouched).
- **Community logic extracted** - `lib/community-logic.ts` - pure helpers for CMod slot math, outcome → next-Morale CMod, outcome → departure %, weighted NPC departure picker (Unassigned → Cohort → Convert → Conscript → Founder → Apprentice), roll classification.
- **Consequence engine** - Failure 25% / Dire Failure 50% / Low Insight 75% leave; PCs never auto-removed. `consecutive_failures` ticks on any failure tier, resets to 0 on any success tier. `week_number` bumps on finalize. 3rd consecutive failure flips community to `status='dissolved'` + `dissolved_at=now`, all members soft-removed with reason='dissolved'.
- **New left_reason 'morale_75'** - `sql/community-members-add-morale-75-reason.sql` widens the CHECK constraint. Modal falls back to 'manual' if the migration hasn't been applied yet.
- **Roll-log custom cards** - `fed_check` / `clothed_check` / `morale_check` render as colored cards in the Logs tab with slot breakdowns, departure names, consecutive-failure counter, and a red dissolved variant. compactRollSummary narrative falls back to the stored label for the Both tab.
- **"Run Weekly Check" gate** - button only renders for the GM on `status='active'` communities with ≥13 members. Shows week number + consecutive-failure count; flashes red "one more failure dissolves" warning at 2/3.

## ✅ Shipped 2026-04-22 (Communities Phase B wrap + header nest)
- **Recruitment Insight Dice** - pre-roll 3d6 / +3 CMod picker on the Recruit modal pick step (gated on roller having ≥1 Insight Die) + post-roll reroll buttons on the result step. Reroll reconciles `community_members` state if outcome crosses the success line, patches `roll_log` in place via captured row id. Handles 3d6 threshold math (14+/9+/4+/<4).
- **Community milestone notification** - new Postgres trigger on `community_members` INSERT/UPDATE: when active count crosses 13 for the first time, notifies `leader_user_id` with `type='community_milestone'`, back-fills `notified_community_milestone=true` on existing ≥13 communities so they don't retro-fire. Colorized in `NotificationBell.tsx`. SQL: `sql/community-milestone-trigger.sql`.
- **Community roster row redesign** - NPC name renders bold/prominent; recruitment type moves to subtle subtext; Apprentice rows show `Apprentice ⇐ <PC name>` inline so masters are visible. Roles bars now compute percentages over **NPCs only**. New "Player Characters (N)" block sits between role bars and NPC roster.
- **Recruit copy fix** - `"X joined Y as a Cohort."` / `"as an Apprentice to Z"` (articles added everywhere - modal + roll_log label).
- **Log trimming** - failure recruit labels compact to narrative `"Ada tried to recruit Jess but it didn't go well"` / `"it went badly"` (Dire Failure / Low Insight).
- **Header bar nesting** - flat 12+ buttons → 4 dropdowns: `Checks ▾` / `Community ▾` / `Campaign ▾` (Share, Sessions, Stories) / `GM Tools ▾` (Restore, Loot, CDP, GM Screen). Custom dropdown replaces native `<select>` on Checks so option text center-aligns across browsers. ESC + outside-click close; chevron flips `▾`↔`▴` when open.
- **Canvas token z-order** - tactical map sorts tokens so objects render first (bottom), then NPCs, then PCs on top. Barrels no longer cover PC name plates.
- **`consumeAction` race guard** - per-entry `Set<string>` in-flight ref. A double-clicked Aim (or any action button) no longer decrements `actions_remaining` twice and skips the turn.

## ✅ Shipped 2026-04-20 (pre-Mongrels game sprint)
- `f2e708f` Insight Dice sequential reroll - second spend on the OTHER die after first fails
- `ce50927` Sprint no longer burns actions on silent click-fail - consumeAction deferred to onMoveComplete
- `46cee3a` Object WP defaults to 3 + explicit "Indestructible (decorative only)" toggle on add/edit
- `e2c3b7d` Initiative no longer reactivates a combatant mid-round after a kill - skip-walk now detects wrap-past-end and fires new-round
- `cdcedef` Move button anchors on GM's selected token (not active combatant) + guards consumeAction on non-active move
- `deccf40` Deleting an NPC auto-cleans orphan scene_tokens + initiative_order rows
- `875c8d7` NPC folder tree shows during combat too
- `8b8c347` Initiative bar - fixed roll-descending order (no rotation); pre-selected target range-band no longer clobbered by unconditional medium reset

## 🔴 Bugs (Fix First)
- [x] Print character sheet renders blank
- [x] Distemper font not applying on mobile navbar
- [x] Combat actions bar not visible to Survivor-role players - fixed with user_id match
- [x] Initiative breakdown not appearing in Logs tab - startCombat/nextTurn/broadcast handlers now call loadRolls()
- [x] Players show as "Unknown" - initiative now fetches fresh character data from DB
- [x] Signup error fixed - handle_new_user trigger had wrong role casing + no EXCEPTION handler + RLS blocking
- [x] NPC damage not applying - rosterNpcs loaded on init, target lookup uses character_id fallback
- [x] Dead NPCs still attackable - filtered from target dropdown
- [x] Auto-advance not working after 2 actions - nextTurn uses fresh DB data, closeRollModal uses user_id match
- [x] Session end now auto-ends combat
- [x] Combat start broadcast to players - no refresh needed
- [x] Player X button to end own turn on initiative bar
- [x] NPC Insight Dice - only Antagonists get them per SRD
- [x] Clips limit increased to 10 with dynamic pip display
- [x] Renamed Rolls tab to Logs
- [x] Combat Start/End messages in Logs tab
- [x] Attack button on action bar no longer double-consumes actions
- [x] Visitor email suppression for bot cities (San Jose, Ashburn, etc.)

### Known Issues (needs testing)
- [x] NPC action pips consuming on use (confirmed working, will readdress if not)
- [x] PC damage from NPC attacks (confirmed fixed)
- [x] Manipulation rolls auto-include First Impression CMod - "Interacting with NPC?" dropdown on social skill rolls auto-sets CMod from relationship_cmod
- [x] Add to Combat modal filters NPCs already in initiative (was already working via initiativeNpcIds prop)
- [x] Self-attack applies damage to self (confirmed working)
- [x] **Stafford → Staff** - typo in weapon database, renamed
- [x] **NPC card HP not updating on damage** - root cause: player deals damage from their browser, setState only updates player's React state. GM is a different client and never received the update. Fixed by broadcasting `npc_damaged` event through the initiative channel (same pattern as turn_changed). Also: NpcCard reads HP from props only (no useState), card grid merges latest campaignNpcs at render, realtime callback suppressed during manual updates to prevent race condition
- [x] **General Knowledge → Specific Knowledge** - renamed in all NPC seed data (setting-npcs.ts), DB backfill via jsonb_set query
- [x] **Stabilize button blocked during combat** - consumeAction was called before handleRollRequest, which triggered nextTurn and changed the active combatant before the roll gate ran. Fixed: open roll first, then consume action. Same fix for Charge and Rapid Fire
- [x] **Dead NPCs appearing in Start Combat** - rosterNpcs filter missed the combat picker re-fetch path; also NPC death now sets status='dead' so the existing status filter catches them
- [x] **Initiative bar shows all combatants with color coding** - green (active), yellow (waiting), red (acted); rotates so active is always leftmost
- [x] **NPC cards auto-open/close with combat** - open all selected NPCs on combat start, close all on combat end
- [x] **Death log entries** - "Death is in the air" header, custom red card rendering, no dice display
- [x] **NPC card shows derived status** - dead/mortally wounded/unconscious from HP, not stale DB status field
- [x] **Restore button on dead/mortally wounded NPC cards** - resets to full HP + active status
- [x] **Out-of-combat stabilize on NPC cards** - Medicine roll from NPC card when mortally wounded
- [x] **Auto-advance after 2 actions** - root causes: (1) consumeAction didn't write actions_remaining=0 to DB before calling nextTurn, (2) closeRollModal used rollResult state (subject to React batching/stale closures) - switched to rollExecutedRef, (3) Charge/Rapid Fire/Stabilize double-consumed via closeRollModal - added actionPreConsumedRef flag, (4) nextTurn had no fallback when no active entry found in DB
- [x] **NPC HP display lags until refresh** - NpcRoster had no realtime subscription on campaign_npcs; added Supabase realtime channel that calls loadNpcs() on any change
- [x] **Roll modal stuck "Rolling..."** - confirmed resolved, will readdress if it recurs
- [x] **Damage bidirectional** - PC→NPC and NPC→PC both work. Root cause was silent RLS rejection on `character_states` and `campaign_npcs` UPDATE policies. Fixed via `sql/character-states-rls-fix.sql` and `sql/campaign-npcs-rls-fix.sql` plus explicit `.select()` on both updates to detect 0-row cases. Biggest diagnostic unlock: `next.config.ts` `compiler.removeConsole` was stripping every `console.log` from production - switched diagnostic logs to `console.warn` to survive the build.
- [x] Player join 20s → 1-2s - RLS index fix (`sql/campaign-members-indexes.sql`) and `log-visit` edge function unblock
- [x] Combat start 15s → fast (verified by user)
- [x] PCs showing "Unknown" - characters/profiles cross-user RLS (`sql/character-profile-rls-fix.sql`)
- [x] Combat Started + Initiative boxes missing in Logs - `user_id: userId` on system roll_log inserts (RLS) and explicit timestamps for ordering
- [x] Combat Started above Initiative
- [x] Initiative box uses combined Init mod (DEX + ACU) instead of separate ACU/DEX, PC names in blue
- [x] End Combat blue button + `combat_end` log entry box
- [x] Show All / Hide All toggle on NPCs tab (always visible, disabled with tooltip when no players)
- [x] Select All / Deselect All toggle in Start Combat NPC picker
- [x] NPC tab reorders during combat - active combatant on top, rotating in turn order
- [x] Players see right-side asset panel with revealed NPCs + any NPCs in combat (auto-merged, "In Combat" label)
- [x] Players have own Notes tab with "Add to Session Summary" - appended notes prefix with character name in GM's End Session modal
- [x] Player bar reorders so each viewer sees their own character next to GM portrait
- [x] Open NpcCard refreshes when underlying NPC HP changes
- [ ] **Player-facing NPC card on Show All click** - clicking a revealed NPC in the player's NPCs tab opens a read-only card (currently opens the same editable view as GM). Design question: should the player card just show Name, First Impression role, and description? Or more?
- [x] **Insight Dice pre-roll CMod** - confirmed +3 CMod (per SRD)
- [x] **Insight Dice sequential reroll** - `f2e708f` `spent` boolean → `insightUsed: 'pre' | 'die1' | 'die2' | 'both' | null`. After rerolling one die, only the OTHER die's button remains; second spend locks the panel. Pre-roll 3d6 still locks post-roll rerolls.
- [x] **Whisper chat** - click a player's portrait → private whisper between you two (GM + other players do not see it). Chat tab auto-switches when a whisper arrives addressed to you. Purple styling distinguishes whispers from group chat.
- [~] **NPC health as narrative feeling** - *DEFERRED 2026-04-26 → long-term review list. User decided not to ship as currently scoped (narrative state strings replacing pip numbers for non-GM). Re-open if a different framing comes up.*

---

## 🟠 Phase 3 - Table Completion

### Insight Dice
- [x] Pre-roll spend UI - Roll 3d6 button and +3 CMod button
- [x] Pre-roll and post-roll spends don't conflict

### Session Management
- [x] Session open/close with session counter
- [x] Session history table in Supabase
- [x] Lobby state when session is idle
- [x] End session modal with summary, cliffhanger, next-session notes, and file attachments
- [x] End session modal closes instantly (UI updates immediately, DB writes fire-and-forget in background)
- [x] Exit button in table header - navigates to /stories for GM and players
- [x] Start session clears rolls/chat from DB + local state (clean slate each session)
- [x] Realtime subscriptions listen to all events (INSERT + DELETE) for log clearing propagation
- [x] Session history page with grid layout, deactivate, delete
- [x] Session delete renumbers remaining and updates campaign count
- [x] Session delete RLS fix - GM DELETE/UPDATE policies on sessions table
- [x] Timeline pins: event_date field, sort_order in Edit Pin UI
- [x] Character sheet pop-out (/character-sheet) with realtime sync + session notes
- [x] Vehicle system - VehicleCard, pop-out (/vehicle), WP/stress/fuel/cargo, floorplan, realtime sync
- [x] Handout pop-out (/handout) for GM Notes + player-side GM Handouts
- [x] All pop-outs use full-width layout (no sidebar)
- [x] Pop-out buttons on: character cards, bottom portrait bar, vehicle cards, GM notes, player handouts
- [x] PC damage broadcasts include optimistic patch for instant client-side updates
- [x] Object tokens show 2-line names, Edit button in info panel, draggable in Assets sidebar with persistent sort_order
- [x] Previous Sessions button in table header
- [x] Cliffhanger field displayed in session history
- [x] Table auto-refreshes when player joins (Realtime on campaign_members)
- [x] War Stories - moved to Phase 4 (Campfire)

### Stress & Breaking Point (SRD Core Mechanic)
- [x] Stress bar tracker on character card (5 segments, color-coded green→yellow→red)
- [x] Stress Check button triggers roll using Stress Modifier (RSN + ACU AMods)
- [x] Breaking Point auto-triggers when stress reaches 5 - rolls 2d6 on Table 13
- [x] Breaking Point modal shows result name, effect, and resets stress to 0
- [x] Lasting Wounds - "Roll Lasting Wound" button when WP reaches 0, rolls Table 12
- [x] Insight, CDP, Morality converted to bar trackers (10/10/7 blocks)
- [x] Stress Check with CMod when stress hits 5 - success drops to 4, failure triggers Breaking Point
- [x] Breaking Point modal shows on whichever screen has the sheet open

### Combat Actions (SRD Table 10 - all 18 + Unarmed + Stabilize)
- [x] **Aim** - +2 CMod (SRD-correct), aim_active flag enforces "must Attack next or lost"
- [x] **Attack** - +1 CMod auto-applied when attacking same target twice in one turn (last_attack_target tracking)
- [x] **Attack Roll** auto-populates last-targeted character - target dropdown, CMod, range band all pre-applied when a second attack happens in the same turn
- [x] **Charge** - both actions, melee/unarmed attack, targets within 20ft, skips weapon range filter
- [x] **Charge** fix - actually costs 2 actions now (was silently costing 1 because actionCostRef wasn't set)
- [x] **Coordinate** - dedicated modal: dropdown picks enemy → Tactics* roll → allies within Close range get +2 CMod vs that target. Log entry announces recipients.
- [x] **Cover Fire** - target picker modal → -2 CMod to enemy's next action
- [x] **Defend** - +2 defense_bonus applied to damage calc, clears after one hit (unless has_cover)
- [x] **Distract** - target picker modal → steals 1 action from target
- [x] **Fire from Cover** - both actions, only appears when has_cover, fire weapon + keep defense
- [x] **Grapple** - full opposed check system, auto-roll both sides, grappled/grappling states, Break Free/Release actions
- [x] **Inspire** - target picker modal → grants +1 action to ally, once per round (inspired_this_round)
- [x] **Move** - grid highlight + click to move token, 10ft Chebyshev
- [x] **Rapid Fire** - -1 CMod first shot, costs 2 actions, ranged only
- [x] **Ready Weapon** - modal with Switch/Reload/Unjam, Tracking +1, weapon swap updates entries state
- [x] Unjam threshold lowered to Worn (was Damaged/Broken) - jammed melee weapons can be unjammed after one Low-Insight degrade
- [x] **Charge** - pick destination cell (20ft) on tactical map before attack roll, no pre-consume on cancel
- [x] **Take Cover** - once per round, no stacking
- [x] **Reposition** - end-of-round positioning action
- [x] **Sprint** - both actions, Athletics check, winded flag (1 action next round)
- [x] **Subdue** - full RP, attack via melee/unarmed
- [x] **Take Cover** - +2 defense_bonus for all attacks this round, sets has_cover, enables Fire from Cover
- [x] **Unarmed** - PHY + Unarmed Combat, 1d3 damage
- [x] **Stabilize** - Medicine roll on dying target
- [x] Social action modals show all combatants (no faction filter - NPCs can be allies)
- [x] Action pips on all initiative entries (green active, orange waiting, grey spent)

### Combat UI
- [x] Defer button on initiative tracker
- [x] All NPCs pre-selected when starting combat
- [x] NPCs sorted first in target dropdown
- [x] Attack Roll / Rolling labels
- [x] Conditional Modifier label
- [x] 4 combat skill buttons on PC card
- [x] Weapon jam/degrade on Moment of Low Insight
- [x] Aim/social bonus badges on initiative tracker (+1/-1)
- [x] Status badges: 💀 Dead, 🩸 Mortally Wounded, 💤 Unconscious, ⚡ Stressed (PCs + NPCs)
- [x] Instant combat end broadcast to players
- [x] Instant turn change broadcast to players (turn_changed event)
- [x] Initiative bar hides combatants who already acted - only shows active + waiting until next round
- [x] All combat rolls (weapon + skill) gated on active combatant with actions remaining
- [x] PC weapon attack labels include character name (consistent with NPC format)
- [x] NPC target dropdown - fix false-dead filter for NPCs with null wp_current
- [x] Default feed tab opens on Logs (not Both)
- [x] Both tab merges rolls + chat chronologically (was sequential blocks)
- [x] "Open My Sheet to Roll" button toggles sheet closed if already open

### Combat Rules - Advanced (SRD)
- [x] Getting The Drop - solo round before initiative: drop character acts alone with 1 action, then full initiative rolls for everyone. "⚡ Gets the Drop!" log entry.
- [x] Range Bands - fully automatic from token positions, no manual selector. Per-weapon CMod profiles.
- [x] Initiative re-roll each round (PCs beat NPCs on ties)
- [x] Delayed Actions - handled by Defer button (same mechanic)
- [x] Resolution Phase - narrative, handled by GM with existing mechanics
- [x] Initiative fetches fresh character data from DB (fixes "Unknown" name bug)
- [x] Initiative results logged to Rolls tab in chat feed
- [x] Combat start parallelized - cut from 8 sequential DB calls to 3 rounds (set active in insert, skip re-fetch)

### Damage & Health Automation (SRD)
- [x] Auto-damage on successful attacks with DMM/DMR defense
- [x] Damage breakdown in roll modal
- [x] NPC damage applies to campaign_npcs table
- [x] RP reaches 0 → Incapacitated for 4-PHY rounds, then regain 1 RP
- [x] RP auto-recovery: 1 per round for conscious characters below max
- [x] WP reaches 0 → Mortally Wounded with death countdown (4+PHY rounds per SRD)
- [x] Death countdown decrements each round, reaches 0 → Dead
- [x] Stabilize mechanic - Medicine roll, success → incapacitated 1d6-PHY rounds, then 1 WP + 1 RP (PCs + NPCs)
- [x] NPC mortal wounds - death_countdown (4+PHY), incap_rounds, badges, turn skip, stabilize button
- [x] Death prevention via Insight Die - trade ALL dice, regain 1 WP + 1 RP (per SRD)
- [x] Lasting Wounds - PHY check first, Table 12 only on failure (per SRD)
- [x] Healing rates - Rest button with hours/days/weeks, SRD rates (1 WP/day, 1 WP/2 days mortally wounded, 1 RP/hour)
- [x] Mortally Wounded → +1 Stress at end of combat
- [x] Mortally wounded NPCs excluded from combat picker (WP=0 filter)
- [x] Defend/Take Cover defense_bonus applied to damage calculation
- [x] Winded combatants get 1 action instead of 2 on next turn
- [x] Auto-decrement ammo on ranged attacks (burst count for Automatic Burst)
- [x] Environmental Damage buttons - Falling (3 per 10ft), Drowning (3+3), Subsistence (1 RP)
- [x] Reduce Stress button - 8+ hours narrative downtime
- [x] Breaking Point shows 1d6 hours duration

### Weapons & Equipment (SRD)
- [x] Full weapon database (38 weapons)
- [x] Weapon dropdowns, ammo pips, reload system, condition tracking
- [x] Attack buttons per weapon with auto-damage
- [x] Weapon jam on Low Insight
- [x] Traits: Cumbersome, Unwieldy (CMod penalties)
- [x] Traits: Stun, Automatic Burst (mechanical)
- [x] Traits: Blast Radius (auto AoE damage), Burning, Close-Up, Cone-Up
- [x] Tracking +1 CMod via Ready Weapon action
- [x] Upkeep Checks (Mechanic/Tinkerer/weapon skill, full SRD outcomes)
- [x] Encumbrance tracker (6 + PHY AMod, OVERLOADED warning)
- [x] **Weapon range realism pass** - nominal bands recalibrated to real-world effective combat range (Heavy Pistol Close→Medium, Carbine Medium→Long, Compact Bow Long→Medium, Molotov Distant→Close, RPG Distant→Long, Mounted Turret Medium→Long). Profile CMods tuned: Assault Rifle gains Distant (-3), Heavy Mounted gains Distant (-4), Flamethrower gains Medium (-4), Heavy Pistol Medium -1→0, Bow Long -2→-3.
- [x] **Taser split** - old melee Taser renamed **Cattle Prod** (contact stun unchanged); new **Taser** is projectile darts (Close range, clip 1, Rare ammo, Stun). SQL migration `sql/weapon-taser-rename.sql` auto-converts existing characters/NPCs.
- [ ] **Add Katana to weapon database** - differentiate from Sword (higher damage or different traits, e.g. lighter/faster with lower Cumbersome, or a unique trait like Precise)

### Additional Check Types (SRD)
- [x] Perception Check (RSN + ACU)
- [x] Gut Instinct (Perception + Psychology/Streetwise/Tactics)
- [x] First Impression (INF + Manipulation/Streetwise/Psychology)
- [x] Group Check (skill picker, participant selector, combined SMods)
- [x] Opposed Check (instructions for GM)

### NPC Roster
- [x] All 5 passes complete + random generator + form overhaul
- [x] Show/Hide/Fight buttons, stackable NPC cards
- [x] NPC Card with clickable RAPID/skills, weapon attack button
- [x] NPC WP/RP health trackers with dot trackers
- [x] NPC weapon auto-assignment by type tier (Goon/Foe/Antagonist)
- [x] Weapon dropdown on NPC edit form
- [x] Viewed NPCs highlighted in roster, Show All / Hide All toggle
- [x] NPCs linked to campaign map pins - `campaign_npcs.campaign_pin_id` wired in seed, backfill SQL for existing campaigns, pin popup shows `ALSO HERE` list of linked NPCs (player view filtered by `revealedNpcIds`, dead NPCs struck through, realtime via `campaign_npcs` channel)
- [x] Click pin name in Assets tab → map flies to it and opens popup (uses `clusterGroup.zoomToShowLayer`)
- [x] Click NPC card in NPCs tab again → closes (toggle behavior)
- [x] `sort_order` column on `campaign_pins` and `campaign_npcs` - seeded campaigns get story-order from array index, manual additions append at max+1, drag the ⠿ handle to reorder
- [x] NPC seed schema fix - migrated `lib/setting-npcs.ts` off legacy `rapid_range`/`wp`/`rp`/`dmm`/`dmr`/`init`/`per`/`enc`/`pt` to live RAPID columns; resurrected silently-broken NPC seeding (was inserting 0 rows on every create)
- [x] Show All / Hide All button on NPCs tab - always visible when NPCs exist (disabled with tooltip when no players have joined), bulk-batched DB ops
- [x] Select All / Deselect All toggle in Start Combat NPC picker
- [x] Start Session is perceived-instant - fire-and-forget DB writes, mirrors endSession pattern
- [x] Leaflet popup base font bumped site-wide for table readability; latent XSS in pin popup fixed
- [x] Share button in table header - copies invite link to clipboard
- [x] GM Notes attachments - jsonb `attachments` column on `campaign_notes`, `note-attachments` storage bucket with RLS, file picker in add form and on each expanded note, image thumbnails inline
- [x] Campaign creation surfaces seed errors - no more silent swallowing on schema mismatch
- [x] **Author Mongrels NPCs** - 4 NPCs (Frankie, Kincaid, Justice Morse, soldiers), 2 scenes (Minnie interior, Barn), 3 handouts (Session Zero, Vehicle Sheet, Route), equipment in DB column

### Campaign Pins
- [x] campaign_pins table with reveal/hide per pin
- [x] Setting seed pins (Mongrels 28, Chased 14, District Zero 31) insert into campaign_pins
- [x] Assets tab with pin management - show/hide, edit, delete, promote to world
- [x] Campaign map in center panel with campaign pins
- [x] Campaign map search bar with autocomplete + layer switcher (Street/Satellite/Dark)
- [x] Realtime sync - GM reveals pin, player sees it on map instantly
- [x] GM can add new campaign pins from the map (click to place)

### GM Assets Panel
- [x] NPCs tab (renamed from NPC Roster)
- [x] Assets tab with campaign pins
- [x] GM Notes tab - campaign_notes table, GmNotes component, add/delete/expand notes
- [x] GM Notes share toggle - players see shared notes as read-only handouts
- [x] NPC card click-to-enlarge portrait (lightbox)
- [x] NPC edit form "Library" button - pick from portrait bank
- [x] Pin coordinates shown on New Pin modal and Edit Pin form
- [ ] Maps & Objects - scene images, tactical map assets, tokens
- [ ] Handouts, Roll Tables *(Communities moved to its own Phase - see below)*
- [x] NPC card 3-column grid layout over campaign map
- [x] Publish to Library button on NPC card (GM only)
- [x] NPC form + card compacted (portrait/bank/status on one row)
- [x] Renamed Friendly → Bystander NPC type
- [x] NPC folder tree - collapsible folders, drag NPCs between, drag to reorder, double-click rename, folder field on edit form
- [x] NPC Show/Hide syncs token visibility on tactical map
- [x] NPC browsing/filtering - search bar + type/status filter chips
- [x] GM Screen - pop-out /gm-screen page for second monitor (outcomes, combat actions, range bands, conditions, CMods, healing, skills→attrs)

### Player Inventory System
- [x] InventoryPanel component - item list, catalog search (33 SRD items + **all 50+ weapons**), custom items, qty tracking
- [x] Inventory button (orange) on CharacterCard
- [x] Encumbrance updated - counts weapons + all inventory items
- [x] Backpack / Military Backpack adds +2 to encumbrance limit
- [x] OVERLOADED warning when over limit
- [x] Custom item creation - name, enc, notes
- [x] Give/Trade - give items to other characters at the table via broadcast
- [x] Real-time sync - receiving player's inventory refreshes on transfer
- [x] **+ From Catalog now sticks** - InventoryPanel was prop-driven from `c.data?.inventory`, but the parent's `entries` state was never patched on add/remove, so the item only existed in the DB and the UI showed stale data. Fix: `CharacterCard` now keeps a local `inventoryState` mirror (updates optimistically, rolls back on DB error) and fires a new `onInventoryChange` callback that the table page uses to patch `entries` so the change survives close/reopen without a `loadEntries` round-trip.
- [x] GM loot distribution modal - bulk give items to multiple players + auto-loot on crate destruction
- [x] NPC click opens pop-out window (not overlay), Edit button (✎) on roster card
- [x] NPC card always shows weapon info (name, damage, range) even without active session
- [x] Tab order: NPCs > Assets > Pins > Notes in tactical map mode
- [x] Katana added to weapon database (4+3d3, Rare, Unwieldy 1)
- [ ] Inventory migration - auto-convert old string equipment to structured items on load

### Vehicle System
- [x] VehicleCard component - WP bar, stress, fuel reserves, cargo manifest, operator notes
- [x] Vehicle pop-out page (/vehicle) - full two-column layout for second monitor
- [x] Realtime sync via Supabase postgres_changes
- [x] Editable by all campaign members (not just GM)
- [x] Cargo add/remove with quantity and notes
- [x] Operator notes editable
- [x] Floorplan image support
- [x] Vehicles folder in Assets tab
- [x] Pop-out hides sidebar (full-width layout)
- [x] SQL: campaigns.vehicles jsonb column + Minnie seed data

### Code Audit (2026-04-18)
- [x] CRITICAL: Grapple consumeAction awaited
- [x] CRITICAL: Charge validates active combatant before roll
- [x] CRITICAL: loadInitiative sequence guard (prevents stale turn order)
- [x] HIGH: Blast radius primary target check includes position fallback
- [x] HIGH: Canvas draw dependency array trimmed (5 volatile deps removed)
- [x] MEDIUM: Sprint/Stabilize/Unjam consumeAction awaited
- [x] MEDIUM: Custom item encumbrance clamped >= 0, null-safe calc
- [x] LOW: Animation frame cleanup on TacticalMap unmount
- [x] LOW: Portrait cache capped at 100 entries (LRU)
- [ ] DEFERRED: Split table page (5,365 lines) into subcomponents - high risk before game
- [ ] DEFERRED: Debounce realtime callbacks - works fine, optimization only
- [ ] DEFERRED: Add seq guards to loadRolls / loadChat (loadEntries already has `loadEntriesSeqRef` at `app/stories/[id]/table/page.tsx:227-228`)

### Combat Audit (2026-04-20)
- [x] CRITICAL: Winded mechanic - activateUpdate() now used at all activation points (was hardcoded actions_remaining: 2)
- [x] CRITICAL: Sprint winded - finds combatant by name, not stale active entry
- [x] HIGH: PC turn skip - re-fetches fresh state from DB instead of stale entries closure
- [x] MEDIUM: Aim active warning - prominent "Aimed - Attack or lose it" badge
- [x] VERIFIED: Coordinate bonus persists through round, clears on re-roll (correct)
- [x] VERIFIED: Ready Weapon switch updates entries state correctly
- [x] VERIFIED: Stabilize consumes action on failure (correct per SRD)
- [x] VERIFIED: Charge cancel - token stays, no action cost (GM discretion)
- [x] **Player-initiated loot from ObjectCard (destroyed-only v1)** - players can open an ObjectCard for a destroyed crate (`wp_max > 0 && wp_current <= 0`) and click a per-item **Take** button; item lands in their own `character.data.equipment`, crate contents decrement, loot log entry written. Matches the existing CampaignObjects policy exactly. Follow-ups: `lootable` flag for pre-destroyed unlock, always-allowed policy, inventory-vs-equipment reconciliation (loot currently appends to legacy string[] equipment, not the new InventoryItem[] inventory).
- [x] **Lootable flag (GM-controlled unlock)** - new `scene_tokens.lootable boolean` column (`sql/scene-tokens-lootable.sql`). ObjectCard header for GM gets a 🔒 Locked / 🔓 Unlocked toggle (hidden when destroyed since destruction already opens contents). Players can Take items when `destroyed || lootable` is true; Contents header reflects state (Destroyed / Unlocked / Locked for GM, Loot for player). Remaining follow-ups: always-allowed policy, inventory/equipment reconciliation.
- [x] **GM Note image handouts - inline preview + lightbox** - shared GM notes already supported image attachments, but they rendered as 32×32 thumbnails with a filename link, useless for storytelling pages. New shared `NoteAttachmentsView` component renders images inline at full panel width (capped at 600px height), click-to-zoom lightbox at native resolution, non-image files stay as compact chips. Used by both `GmNotes` and `PlayerNotes`. Also added a realtime `campaign_notes` subscription to `PlayerNotes` so a GM toggling Share pushes the handout (or its updates) to players without a page refresh.
- [x] **Object Duplicate button** - new `Dup` button next to Edit in the GM's Assets → Objects panel. Clones the source `scene_token` row including portrait, color, WP (resets `wp_current` to full), `is_visible`, properties, contents, and `lootable`. Auto-suffixes name as `… (copy)`, `(copy 2)`, etc. so collisions can't happen. Spawns at top-left (1,1) per the token spawn rule. Broadcasts `token_changed` so the map and other clients see it.
- [ ] **Surface Give loot UI in the GM Assets → Objects panel too** - mirror the per-item Give controls that now live on ObjectCard so GM can loot without placing the object on the map first (current panel loot still requires crate to be destroyed).

### Campaign Management
- [x] Launch, Leave, Share buttons
- [x] Game Feed with Rolls/Chat/Both tabs and Realtime chat
- [x] Campaign edit page (`/stories/[id]/edit`) - name, description, map style, map center location
- [x] "Custom Setting" label (was "New Setting")
- [x] Players get Tactical Map / Campaign Map toggle button in header
- [x] Combat end stays on tactical map for both GM and players
- [x] Start Combat auto-shares tactical map to all players
- [x] NotificationBell on table page header
- [x] Session join race condition fix (await ensureCharacterStates before loadEntries)
- [x] GM private notes
- [x] Player kick from session (kicked flag on character_states, persists on refresh, resets on new session start)
- [x] **Kicked players no longer auto-rejoin on session restart** - removed the silent `UPDATE character_states SET kicked=false` in `startSession()`. Kick now persists indefinitely. Kicked player sees a red "Removed from Session" banner + green **Rejoin Session** button on the story overview page - clicking it clears their own `kicked` flag. Kick UPDATE now uses `(campaign_id, user_id)` + `.select()` so silent RLS failures surface as an alert instead of appearing to succeed.
- [x] **Kicked players excluded from initiative on combat start** - `confirmStartCombat` pulled combatants straight from `campaign_members` and bypassed the `character_states.kicked` filter that `loadEntries` applies. Fix: fetch kicked `user_id`s up front and filter `rawMembers` before rolling initiative so kicked PCs are never inserted into `initiative_order`.
- [x] **CDP awards** - GM bulk-award modal, selected players get CDP with a log entry
- [x] Mortal wound insight save - player acts, GM sees read-only
- [x] Character delete confirmation dialog
- [x] Mortally wounded characters excluded from target list
- [x] Stabilize range check - within 20ft, engaged warning if >5ft
- [x] NPC remove button (red ×) on roster cards
- [x] NPC clone button (+) - duplicates below source with auto-numbered name
- [x] NPC secondary weapon (Foe/Antagonist only)
- [x] NPC portrait bank reduced to 3 (Enemy/Ally/Neutral)
- [x] NPC portrait library z-index fix (appears above edit modal)
- [x] NPC edit modal widened to 430px
- [x] NPC card layout - × under drag handle, larger portrait, wrapping names
- [x] Floating NPC card widened to 420px, drag offset fixed
- [x] Combat action button font increased to 12px
- [x] Combat round counter replaces action pips
- [x] Dashboard button moved to right side of header
- [x] Notification text left-aligned, dropdown positioned below bell (locked)
- [x] Default map cell size 35px
- [x] Map image consistent between GM/player screens (scales from grid width)
- [x] Map popup no longer covers pin icon
- [x] World map default center [8.2316, 13.5352] zoom 3
- [x] World map sidebar tabs - Public / My Pins / Campaign
- [x] Rumor pins show ❓ on map regardless of category
- [x] Copy Map Position button (Thriver only, sidebar)
- [x] Ghost landing shows world map directly (no splash page)
- [x] Launch button on Edit Story page
- [x] Profiles email column + backfill from auth.users
- [x] User guide at docs/user-guide.txt
- [x] **Character progression log** - automatic events + manual journal entries per character
- [x] **Campaign snapshots** - GM save-point system. Capture full campaign state (NPCs, pins, scenes, tokens, notes, optional party states) into `campaign_snapshots` jsonb, restore in-place (same campaign id, same invite, same players). `lib/campaign-snapshot.ts` + `components/CampaignSnapshots.tsx` on edit page. Shares shape with Module System snapshot - Phase 5A reuse planned. Run `sql/campaign-snapshots.sql`.
- [x] **Default Assets tab = NPCs** (was Pins)
- [x] **Tab order in tactical map mode** - NPCs > Assets > Pins > Notes
- [x] **Edit button (✎) on NPC roster card** - accessible without the overlay
- [x] **NPC pop-out window from roster** - clicking NPC card opens pop-out instead of floating overlay
- [x] **NPC pop-out size standardized** - 607×357 with overflow:auto
- [x] **NPC card shows weapon inline** - name, damage, range, condition always visible
- [x] **Sprint log entry uses SPRINT header** (was "System")
- [x] **Move log attributes to mover**, not stale active combatant
- [x] **NPC damage realtime propagation** - broadcast fires, other clients converge (diagnostic logs retained)
- [x] **Custom GM icon** on player bar - `public/gm-icon.png`, fallback to GM text if missing
- [ ] Allow characters in multiple campaigns
- [ ] Transfer GM role, Session scheduling

### Setting Seeds
- [x] District Zero - 31 pins seeded to world map, 18 NPCs in setting-npcs.ts
- [x] Chased - 14 pins (campaign-scoped), 21 NPCs + 5 pregens in setting-npcs.ts
- [x] Renamed district0 → district_zero across entire codebase
- [x] campaign_npcs table created with RLS + Realtime
- [x] Campaign creation auto-seeds NPCs for District Zero and Chased
- [x] Mongrels - 28 pins (campaign-scoped, 14 waypoints + 14 landmarks/encounters) with notes, landmark (🗿) and encounter (⚡) categories added
- [x] Pregen system - PregenSeed with full character data, buildCharacterFromPregen() builder, pregen selection UI on campaign page
- [x] Chased pregens - 5 fully statted pregens (David, Carly, Morgan, Marv, Victor) with skills, weapons, equipment, relationships
- [x] Chased NPC skill name fixes - "Ranged Weapons" → "Ranged Combat" (Ray, Jackie, Maddy)
- [x] Chased Georgetown pin updated - coords, category → settlement, description
- [x] Tactical scene seeding - SETTING_SCENES in lib/setting-scenes.ts, auto-seeds during campaign creation (Chased: Connor Boys Farmhouse)
- [x] Empty campaign package - Gus pregen, Dylan & Becky NPCs, Battersby Farm + Gas Station pins, gas station scene, Session Zero handout
- [x] Empty pregens - 4 shared Chased pregens (David, Carly, Morgan, Marv) + Gus González (Empty-exclusive)
- [x] GM handout seeding - SETTING_HANDOUTS in lib/setting-handouts.ts, auto-seeds during campaign creation
- [x] Chased pins updated - 16 total (14 original + Battersby Farm + Stansfield's Gas Station)
- [x] Empty maps to Chased content - shares pins, NPCs, scenes via setting slug mapping
- [x] End session modal drop zone text size bumped (11/10px → 13/12px)
- [x] All setting pins campaign-scoped only (District Zero, Chased, Mongrels)
- [x] Make Thriver button - error feedback on failure
- [x] Extracted SETTINGS to shared lib/settings.ts (was duplicated in 5 files)
- [x] Pin/NPC seed inserts now have error handling + eliminated extra DB round-trip

### Character Creation
- [x] Clickable steps, portrait upload, concept display, photo resize, test character
- [ ] CDP tracker boxes (partially fixed)
- [ ] **Tooltips throughout character creation** - hover/tap explanations on skills, attributes (RAPID), and other game terms so new players understand what each thing does without leaving the page
- [ ] **Overhaul "What They Have" / Weapons + Equipment step** - current layout is unwieldy AND only includes Melee + Ranged. Missing Heavy Weapons, Demolitions, Explosives, and any future weapon categories. Redesign:
  - Tabbed or filtered category picker covering ALL weapon families (Melee / Ranged / Heavy / Explosives / etc.)
  - Search across the full weapon catalog
  - Compact card / row layout - fewer dense fields per item, cleaner secondary stats
  - Equipment side gets the same treatment (categorized, searchable)
  - Stays compatible with Paradigm + Random flows that pre-seed weapons
  - QoL captured 2026-04-30; not blocking anything but every character creator hits this surface
- [ ] **Clean up Weapons/Equipment page** - superseded by the overhaul above; keep the entry until the overhaul ships then collapse
- [ ] **Weapon dropdowns on Final Touch screen** - let players swap their seeded/picked weapons via a dropdown selector instead of being locked into the default loadout

### Ghost Mode
- [x] Public pages: /, /map, /dashboard, /campaigns, /characters, /creating-a-character, character builders
- [x] Sidebar with "Ghost - You Don't Exist" label, navigation, Sign In / Create Account
- [x] Map read-only for ghosts (no pin placement)
- [x] Dashboard landing page for ghosts with Distemper branding
- [x] Character builders bounce to login on Advance/Back/step clicks
- [x] Ghost-to-Survivor conversion tracking
- [x] Soft wall modal instead of hard redirect

### UI Polish
- [x] All items from previous sessions complete
- [x] Navbar removed, sidebar branding with Distemper logo
- [x] Sidebar links open in new tabs
- [x] Overlay mode 30% opacity - map visible behind character sheet
- [x] Inline mode: full-screen sheet; Overlay mode: draggable floating window
- [x] NPC card: Melee/Ranged/Demolitions green skill buttons (no duplicates)
- [x] PC card: single centered Unarmed Attack button with damage info
- [x] Creating-a-character page - all 6 builder links open in new tab

---

## 🟠 Phase 3 - Map
- [x] Map autocomplete on search bar (Nominatim)
- [x] Pin clustering (leaflet.markercluster, both world + campaign maps)
- [x] 10 map tile styles on both world map and campaign map (unified layout)
- [x] World map default view: center [-25, 15] zoom 3, no gray space, maxBounds locked
- [x] Campaign map style selector on New Campaign page
- [x] Custom location search for New Setting campaigns (Nominatim, saves center lat/lng)
- [x] Unified header button styling (hdrBtn helper, 28px uniform)
- [x] Filter chips replace sidebar tabs - All, Public, Mine, Canon, Rumors, Timeline with counts
- [x] Timeline filter - world_event pins in chronological order, overrides sort, date labels
- [x] Sort control - Newest, Oldest, By Category, Nearest
- [x] Ghost default - Timeline active for unauthenticated visitors
- [x] Ghost CTA in Timeline view - "Sign up to add your own story to this world."
- [x] Filter state persisted in localStorage for authenticated users
- [x] World event pins - 16 Dog Flu timeline + settlement pins on world map
- [x] New pin categories: world_event (🌍) and settlement (🏚️)
- [x] Setting regions - fly-to buttons for District Zero, Chased, Mongrels
- [x] Pin search - keyword filter on title, notes, category
- [x] Pin cards - expandable sidebar, enhanced popup, view count, nearby pins, campaign context, username
- [x] Pin hierarchy - visual weight: Landmark / Location / Event / Personal
- [x] Pin card attachments - images inline, documents as download links, public bucket
- [ ] Parent/child pin structure - rumor about a specific building within a landmark
- [ ] Immutable canon layer - Thriver-set pins only, cannot be edited by others
- [ ] **Map search predictive results - prioritize US locations** - currently Nominatim returns global results in arbitrary order; bias the autocomplete to US first (use `countrycodes=us` as a primary query, fall back to global if no matches)
- [ ] **Players can drop pins on the /table campaign map** - currently the "+ Pin" button in `CampaignMap.tsx` is gated on `isGM`; let players place their own pins (probably starts as `revealed=false` from the GM's POV until the GM approves, or as a separate "player-suggested" category)

---

## 🟠 Logging & Notifications
- [x] All 5 passes + consolidated /logging page
- [x] Player joined notification to all campaign members with character name
- [x] Player left notification
- [x] Pin rejection notification
- [x] Visitor email alerts - New Visitor / Survivor Active with location + visit count
- [x] Visitor geo-location - country, region, city, lat/lng from Vercel headers
- [x] IP hash tracking - SHA-256, no PII stored
- [x] Visual visitor map on /logging - dark tiles, green/red dots, popup with details
- [x] Visitor log filter - search by user/IP/page, multi-exclude with chips (type + Enter to exclude, click chip to remove)
- [x] Visitor log timestamp column - exact time alongside relative "When"
- [x] Thriver user deletion - edge function with admin API, prevents self-delete
- [x] Renamed /campaigns → /stories - URLs, text, redirects for backwards compat
- [x] Singleton Supabase client - fixes auth lock race condition
- [x] Performance pass - duplicate font removal, next.config, query parallelization, lazy images, unused deps removed
- [ ] Remaining event instrumentation (9 items)
- [ ] Switch email FROM address back to `noreply@distemperverse.com` once domain is verified on Resend (currently using `onboarding@resend.dev` workaround due to Wix MX limitation)

---

## 🟡 Phase 4 - The Living World

### The Campfire
- [ ] Campfire global feed - approved Rumors, World Events, session summaries, War Stories, LFG posts visible to all
- [ ] Campfire setting feed - filtered view per setting (District Zero, Chased, Mongrels)
- [ ] Campfire campaign feed - private feed per campaign, GM session summaries, player War Stories
- [ ] Promotion flow - campaign post → setting feed → global feed, Thriver approval at each level
- [ ] World Events - Thriver-authored announcements that shape the living world, permanently pinned
- [ ] War Stories - players post memorable moments from sessions, visible on campaign and setting feeds
- [ ] Filtering by setting, date, post type
- [ ] Featured items - Thriver promote-to-featured for forum threads + war stories (module featured already shipped)
- [ ] LFG posts - GMs and players post availability, setting preference, playstyle, experience level

### District Zero
- [ ] District Zero setting page - canonical hub for the setting
- [ ] Canon layer - District Zero-specific canon scope/UX (generic `is_canon` badge already shipped via commit `748013c`)
- [ ] Community layer - approved player Rumors visible to all District Zero campaigns
- [ ] District Zero Campfire feed - setting-scoped posts
- [ ] District Zero timeline - chronological visualization page surfacing world-event timeline pins (timeline category + sort_order migration already shipped)
- [ ] Timeline sort_order management - UI for Thrivers to reorder timeline pins (drag-and-drop or number field), GMs can set sort_order on campaign-scoped world_event pins. Currently hardcoded via SQL.

### Tactical Map
- [x] Canvas-based tactical map replaces campaign map during combat
- [x] GM uploads battle map image (tactical-maps storage bucket)
- [x] Grid overlay with column/row labels (A1, B2, etc.)
- [x] Token rendering - circles with initials, color-coded (blue PC, red NPC)
- [x] GM drags tokens to move, saved to DB
- [x] Realtime sync - token moves broadcast via Supabase Realtime
- [x] Auto-populate tokens from initiative order (Place Tokens button)
- [x] Active combatant glow (green) on token
- [x] Range band visualization on selected token (Engaged/Close/Medium/Long)
- [x] Hidden tokens - GM can hide/reveal (ambushes)
- [x] Token info panel - name, type, position, Hide/Remove buttons
- [x] Scene management - create, name, set grid dimensions
- [x] Multiple scenes per campaign with dropdown switcher
- [x] Double-click token opens NPC card
- [x] Reverts to campaign map when combat ends
- [x] Zoom and pan - +/- buttons, Ctrl+scroll wheel zoom, spacebar+drag to pan, scrollable at >100%
- [x] Tactical Map toggle button in header bar (GM can set up scenes before combat)
- [x] GM controls strip - Scene Name, Upload Map, Place Tokens, zoom, grid on/off, grid color picker, opacity slider, Fit to Map, cols/rows/cell-feet adjusters, Lock/Unlock Map, Delete Map, Delete Scene, Fit to Screen
- [x] Scene dropdown with + New Scene option
- [x] Corner resize handles for map image (independent of zoom)
- [x] Map always fits to container width, scroll vertically for tall maps
- [x] Grid anchored to top-left, adjustable cols/rows/cell size in feet (default 3ft)
- [x] WP bar beneath each token (color-graded green/yellow/red)
- [x] Token death visuals - red X for mortal wound, 50% opacity for dead
- [x] Initiative order numbered badges on tokens (green for active)
- [x] GM + player ping - double-click empty cell, two consecutive pulses (GM=orange, player=green)
- [x] Range band auto-select from token positions in attack modal (hidden, fully automatic)
- [x] Range enforcement - targets filtered by range (all weapons), "Out of range" blocks Roll button
- [x] Range circle shows PRIMARY weapon range (not best-of-all). Melee capped at 5/10ft
- [x] Per-weapon range CMod profile tables (`lib/range-profiles.ts`) - Shotgun falloff, hunting rifle point-blank penalty, sniper bonuses, etc.
- [x] New range band thresholds - Engaged ≤5ft, Close ≤30ft, Medium ≤100ft, Long ≤300ft, Distant >300ft
- [x] Color-coded range overlay - GM "Show Ranges" toggle; each grid cell colored by band
- [x] NPC cards as draggable floating windows over tactical map during combat
- [x] Move action highlights reachable cells (10ft Chebyshev) on tactical map, click to move
- [x] Players can drag their own token on the tactical map
- [x] Token place/remove broadcasts to all clients for real-time sync
- [x] Tokens spawn at top-left of grid (0,0)
- [x] Smooth token dragging - tokens follow cursor during drag, snap to grid on release
- [x] Zoom slider for all users (GM + players), controls zoom not cell size
- [x] Spacebar pan scrolls the container correctly
- [x] Fit to Screen resets zoom and scale
- [x] Double-click Cols/Rows to type value directly
- [x] Auto-activate most recent scene when switching to tactical map (no empty screen)
- [x] Pin-to-tactical-scene linking - edit pin, select scene, double-click to open
- [x] Blast Radius AoE - grenades/RPGs auto-damage nearby tokens (Engaged=full, Close=50%, Far=25%)
- [x] Map button toggles token on/off (was "already on map" alert)
- [x] Zoom slider moved to top-right, compact (0%/100% labels, white text)
- [x] Resize handles fixed (zoom-corrected hit-test coordinates)
- [x] "Select a target or damage will not be applied" warning in attack roll modal
- [x] Unarmed Attack button on combat action bar
- [x] Token death visuals - red X for mortal wound, 50% opacity for dead
- [x] NPC cards show all equipment weapons as attack buttons
- [x] GM Notes share toggle - players see shared notes as read-only handouts
- [x] NotificationBell on table page header
- [x] Start Combat auto-shares tactical map to all players
- [x] Session join race condition fix (await ensureCharacterStates before loadEntries)
- [x] Sticky-drag fix - handleMouseUp is synchronous; drag state clears before DB write, failures no longer orphan drag
- [x] Click-without-move skips the DB write (token stayed in same cell - avoids wasted round trip)
- [x] **Object tokens targetable in attacks** - weapons crates/barrels/doors with WP appear in Attack Roll target dropdown; damage decrements `scene_tokens.wp_current`; no defensive mod, no RP, no death countdown. Works in primary + reroll damage paths.
- [x] **ObjectCard on double-click** - GM + players double-click an object token to open an inline draggable card: name, WP bar, portrait, properties (GM sees hidden ones). Live WP sync.
- [x] **Map selection pre-populates attack target** - single-click a token, open Attack modal, target dropdown is pre-filled (overrides `last_attack_target` if both exist)
- [x] **Edit Object modal** - font sizes bumped for readability (10→12, 11→12, 12→13, 13→14)
- [x] **Range circles on selected token** - clicking a PC/NPC auto-draws 3 circles: green Engaged, blue 9ft Move, red primary-weapon range. Object tokens (crates, cars, doors) never show range bands. Drawn under tokens so sprites stay crisp. Show/Hide Ranges toggle in GM strip.
- [x] **Range band circles REMOVED from tokens** - overlay drawing, Show/Hide Ranges button, `showRangeOverlay` state, and related constants all deleted from `TacticalMap.tsx`. Attack modal's auto range-band logic (`getAutoRangeBand` in page.tsx) still drives CMod + target filtering - just no canvas painting.
- [x] **ObjectCard loot (GM)** - Contents section shows per-item `Give to [PC]` dropdown + green `Give` button. Transfers one-at-a-time to the chosen character's equipment, decrements (or removes) the crate's quantity in `scene_tokens.contents`, logs `🎒 [name] looted [item] from [crate]` to roll_log. Works on intact crates - no need to destroy first.
- [x] **Object-token image library** - every uploaded image is saved to `object_token_library` (campaign-scoped, RLS: members read, GM insert/delete). Add + Edit object flows show "Or pick from library (N)" thumbnail strip for reuse. Run `sql/object-token-library.sql`.
- [x] **Image crop modal on upload** - new `ObjectImageCropper` component: drag-to-move + corner-resize (aspect-locked square). Output is 512×512 JPEG. Tokens render square, so pre-cropping prevents the old stretch.
- [x] **GM/player map alignment fix** - image size now derives from `image.naturalWidth × img_scale` (viewer-independent) instead of `container.clientWidth × img_scale` (viewer-dependent). Everyone sees pixel-identical positioning.
- [x] **Cols/Rows changes no longer resize the image** - grid and image are fully decoupled; Cols+ only moves the grid.
- [x] **Rescale Tactical Scenes tool** (`/tools/rescale-tactical-scenes`, Thriver only) - one-time migration that probes each scene's image naturalWidth and converts legacy container-based `img_scale` to the new baseline. Per-row + bulk rescale.
- [x] **Order box on Assets → Map Pins edit form** - parity with /map sidebar. GM sets explicit numeric `sort_order`; list resorts immediately on save.

---

## 🟡 Phase 4b - Communities, Recruitment, Morale (SRD §08)

**Full spec: `tasks/spec-communities.md`.** Implements XSE SRD v1.1 Community Resource & Morale Rules with Distemper Core overlay. Four-phase rollout - A is the foundation, each next phase adds a mechanic layer.

### Phase A - Foundation (DB + manual management) ✅
- [x] `communities` + `community_members` + `community_morale_checks` + `community_resource_checks` tables with RLS (`sql/communities-phase-a.sql`) - includes day-one Phase E columns (`published_at`, `world_visibility`, `world_community_id`) so the persistent-world migration is additive
- [x] `components/CampaignCommunity.tsx` - reusable panel with Create flow, member list grouped by role, % bars with SRD min/max thresholds, add/remove/role-change, soft-remove via `left_at`
- [x] **Sidebar: "My Communities" link** under "My Stories"
- [x] `/communities` index - grid grouped by campaign with status chip (Group / Community / Dissolved), member count, "N to Community" progress, GM badge
- [x] `/communities/[id]` detail page - mounts the CampaignCommunity panel scoped to the community's campaign
- [x] 13+ threshold auto-detection (Group → Community status badge)

### Phase B - Recruitment mechanic
- [ ] `Recruit` button on NPC card (GM + player)
- [ ] Recruitment modal - approach picker (Cohort / Conscript / Convert), skill auto-suggest, CMod preview
- [ ] First Impression integration (`npc_relationships.relationship_cmod` flows into Recruitment CMod)
- [ ] Outcome resolution → auto-insert `community_members` row per SRD table (Success / Wild Success / High Insight / Failure / Dire Failure / Low Insight)
- [ ] Apprentice toggle on Wild Success / High Insight - one Apprentice per PC, persistent bond
- [ ] Recruitment log entry in `roll_log` with custom card style

### Phase C - Morale + Resource checks (weekly loop) ✅ 2026-04-23
- [x] `community_morale_checks` table + `community_resource_checks` table + RLS (already landed in Phase A migration)
- [x] Fed / Clothed / Morale rolled together in a single **Weekly Check modal** (`components/CommunityMoraleModal.tsx`) - NPCs assumed reasonable proficiency, GM adjusts A/S/CMod per roll, single "Run Weekly Check" fires all three rolls sequentially
- [x] Morale auto-fills all 6 SRD slots - Mood (from prior week's cmod_for_next), Fed + Clothed (snap to actual rolled outcomes), Enough Hands (mechanical − 1 per understaffed role group, max −3), A Clear Voice (0 with leader, −1 leaderless), Someone To Watch Over Me (+1 ≥10% Safety, −1 <5%); GM override on any slot + Additional freeform CMod
- [x] Consequence application: Failure 25% / Dire Failure 50% / Low Insight 75% leave, weighted priority Unassigned → Cohort → Convert → Conscript → Founder → Apprentice, PCs never auto-removed; `consecutive_failures` +1 on failure / reset to 0 on success; `week_number` increments on finalize
- [x] 3-consecutive-failure dissolution - Result stage flips to a red "Finalize - Dissolve Community" button, all members soft-removed with reason='dissolved', community flips to status='dissolved'
- [x] Custom roll_log cards for `fed_check` / `clothed_check` / `morale_check` with slot breakdown + departure list + dissolve warning; compactRollSummary narrative for the Both tab
- [x] New SQL migration `sql/community-members-add-morale-75-reason.sql` widens left_reason CHECK to include 'morale_75' for the Low Insight drop
- [x] Retention Check on 3rd failure (SRD §08 p.22) - fast-acting leader gets an immediate salvage Morale Check using the failed Morale's cmod_for_next as the Mood CMod. Inline on the Result stage: "🙏 Attempt Retention Check" button appears when willDissolve=true, uses the leader's current AMod/SMod + skill pick. Success of any tier saves the community (consecutive_failures drops to 2); failure tiers let dissolution proceed. Custom `retention_check` roll-log card.

### Phase D - Activity Blocks + dashboard ✅ 2026-04-23 (Lv4 items deferred)
- [x] "Skip Week" button on the Weekly Check strip advances `week_number` without rolls (Activity Block off-screen time)
- [x] Conscription pressgang - red warning banner on pick stage + blocking confirm() on submit ("this is coercion, requires credible threat")
- [x] `/stories/[id]/community` full-screen GM dashboard: Morale history (last 20), resource history (last 40), role distribution with SRD minimum markers, recruitment stats by approach, member breakdown by recruitment_type. Community ▾ → Dashboard links to it.
- [x] At-a-Glance block inside each expanded community body: Recent Morale trend chips (last 5) + "You" row showing viewer's role, Apprentice, and their recruited NPCs. Visible to everyone.
- [x] Apprentice task delegation - `community_members.current_task` freeform text, GM-editable inline on apprentice rows. Display: "Task: <text>" with ✎ edit. No task + GM → "+ Assign task" affordance. SQL: `sql/community-members-add-current-task.sql`.

**🔒 Lv4 Skill Traits system - FULLY BACKBURNER (Xero 2026-04-23, reinforced)**
Every skill gets a Trait at Level 4, but the full list isn't written. Xero's ruling: **ships together or not at all - no piecemeal.** The two CRB-defined Morale bonuses (Inspiration "Beacon of Hope" +4, Psychology\* "Insightful Counselor" +3) were shipped in `03d8767` and then reverted on the same day to enforce this rule. Until the authoritative list lands, the GM stuffs any Lv4 bonus into the Morale "Additional" slot manually. Pending:
- [ ] Inspiration Lv4 "Beacon of Hope" auto +4 to Morale (awaiting full list)
- [ ] Psychology\* Lv4 "Insightful Counselor" auto +3 to Morale (awaiting full list)
- [ ] Generic Lv4 Trait surface on the character sheet
- [ ] Auto-application hooks for any other Lv4 Trait that touches Morale / Recruitment / Fed / Clothed / combat

### Phase E - The Tapestry (Persistent World) 🚩 flagship differentiator
Communities become first-class entities in the Distemperverse. Every published community from every table shares one world.
- [x] Day-one schema carries `published_at`, `world_visibility`, `world_community_id` on `communities` (`sql/communities-phase-a.sql`)
- [x] `world_communities` mirror table (`sql/world-communities.sql`) - sanitized public row with size band, public status, faction label, moderation_status
- [x] Community "Publish to Tapestry" toggle on `CampaignCommunity.tsx` (line 1972) + handlePublish at :883 + Thriver moderation queue at `app/moderate/page.tsx` (`sql/world-communities-moderation-notify.sql`)
- [x] World map overlay - published communities render via `MapView.tsx` with size-banded icons (radius 20→40px on size band)
- [x] GM-to-GM contact handshake - `community_encounters` table + 🤝-button on world-map community cards + notification metadata jsonb (`sql/community-encounters.sql`)
- [x] Trade / alliance / feud links - `world_community_links` with two-way consent, color-coded polylines on world map (`sql/world-community-links.sql`)
- [x] Migration on dissolution - `community-migrations` table + autocopy migration tooling lets survivors land in nearby published communities (`sql/community-migrations.sql` + `sql/community-migrations-autocopy.sql`); modal in `CampaignCommunity.tsx`
- [x] Schism - large communities split; `handleSchism` in `CampaignCommunity.tsx` + `sql/community-members-add-schism-reason.sql` widens left_reason CHECK
- [x] Leader permissions - non-GM PC leader can publish own community (`sql/world-communities-leader-permissions.sql`)
- [ ] **World Event CMod propagation** - Distemper Timeline pins in a region apply temporary CMods to all published communities in that region. No code path yet; needs a regional bounding-box query + `morale_check` modifier slot wired to active world events.
- [ ] **Community subscription for players** - no `community_subscriptions` table or follow UI. Lets players follow a published community across sessions; surfaces updates in their feed.
- [ ] **Campaign-creation wizard "Start inside/around an existing published community"** - `/stories/new` currently picks Custom / Setting / Module; needs a fourth option that seeds the new campaign adjacent to a published community (autopopulates Homestead pin + invites the new GM into the encounter handshake).

### Out of scope (see spec §12)
- Community-as-single-combat-entity (members still combat individually)
- Full trade-economy simulation (Phase E has narrative links only)
- Procedural community generation (GM-authored only)

---

## 🔵 Phase 5 - Module System 🚩 flagship content engine

**Full spec: `tasks/spec-modules.md`.** Supersedes the paused GM Kit v1 seed-table plumbing - unifies authoring (in-campaign), publishing (as a versioned jsonb snapshot), subscribing (campaign creation picks a module), and updates (opt-in diff/merge). Pairs with Phase 4b Communities (modules ship with pre-authored communities).

### Phase A - MVP publish + subscribe loop ✅ shipped
- [x] `modules` + `module_versions` + `module_subscriptions` tables with jsonb snapshots + RLS
- [x] Publish wizard on campaign edit page - metadata, include/exclude content types, visibility (Private / Unlisted / Listed)
- [x] Campaign creation third option: **Module** picker alongside Custom + Setting
- [x] `cloneModuleIntoCampaign(version, campaign)` - transactional clone of snapshot into campaign_npcs/pins/scenes/tokens/notes
- [x] Record `source_module_id` + `source_module_version_id` on cloned rows for Phase B update tracking
- [ ] Migrate existing Arena seed (`setting_seed_*` tables) into a `modules` row; deprecate seed tables

### Phase B - Versioning + updates ✅ shipped
- [x] Semver bump on publish (patch/minor/major), changelog field
- [x] `/stories/[id]/modules/[id]/versions` history UI with diff summary
- [x] Update notifications on subscriber dashboards
- [x] Review modal - per-asset accept/reject diff, fork option, conflict resolver for locally-edited rows
- [x] `edited_since_clone` flag on cloned content so updates skip customized assets

### Phase B+ - Lifecycle (shipped 2026-04-24)
- [x] Listed modules enter Thriver moderation queue on publish/re-publish
- [x] Thriver approve/reject notifies author; approval stamps `platform_locked_at` on all versions
- [x] Author can archive module (soft-delete); hard-delete only when 0 subscribers
- [x] Subscribers notified on archive; their campaign content untouched
- [x] Archived modules hidden from campaign-creation picker

### Phase C - Marketplace
- [ ] Play stats per module - track actuals (session count + avg player count). subscriber_count already shipped; session_count_estimate is author-edited not actuals.

### Phase D - Monetization + tiers
- [ ] Free / Paid / Premium module pricing
- [ ] Licensed GM permission unlocks paid modules
- [ ] Author payout flow, referral tracking

### Phase E - Ecosystem
- [ ] GM Kit Export v2 = printable PDF + module zip from a module snapshot
- [ ] Module + Community cross-publish (depends on Phase 4b Phase E)
- [ ] In-session GM toolkit - scene switcher, NPC roster, handouts panel, roll tables linked to dice roller
- [ ] Third-party module import (Roll20 / Foundry → Tapestry module - stretch)

### Phase F - GM Adventure Authoring Toolkit 🚩 (added 2026-04-30)

The current authoring path is "run a campaign for months, then click Publish Module." That works for Xero personally but assumes the GM has already done the work in their head + populated the campaign before Publish exists as a button. New GMs need scaffolding that helps them go from blank-page idea → playable adventure WITHOUT a long live-campaign on-ramp first.

**Vision:** opinionated, guided forms that walk the GM through the bones of an adventure (the "story arc" form), plus on-the-fly creation tools for everything an adventure needs (NPCs, maps, handouts, encounters, route tables). Output of the authoring tools feeds straight into the Module Publish flow - adventures authored with this toolkit ship as Modules end-to-end.

- [ ] **Story Arc form** - guided 4-question creation surface:
  - "What is this about?" (the premise - one-paragraph hook + thematic tags)
  - "Where do they start?" (opening scene + starting pin/Homestead)
  - "What happens along the way?" (3-5 beat outline; each beat carries an optional encounter / scene / handout reference)
  - "Where do they end?" (resolution scenes - branching outcomes Wild / Success / Failure / Dire)
  - Persists to a new `adventures` table or as a structured `metadata.adventure_arc` blob on the existing `campaigns` row. Same data exports into the published module's manifest so subscribers see the arc.
- [ ] **NPC quick-build inline forms** - surface the existing generateRandomNpc + manual-edit flow as a popover from inside the Story Arc form ("add an NPC to this beat"). Pre-fills the NPC's role from the beat (antagonist for the climax, bystander for the opening, etc.). Pairs with the new GM Tools → Populate flow.
- [ ] **Map quick-build** - drop a new tactical scene from inside a beat. Image upload + grid + cell_px + a "place opening tokens" affordance. Wires straight into `tactical_scenes`.
- [ ] **Handout quick-build** - title + rich text + optional image; persists to `campaign_notes` with `share=true`. Surfaces as the player handout when its beat fires.
- [ ] **Encounter quick-build** - pre-rolled stat block for a fight (initiative line-up, recommended weapons, terrain notes). Drops into a beat as "what happens here." Could mature into a roll-table + outcome-tier reference once Lv 4 traits land.
- [ ] **Route tables** - for travel-arc adventures (Mongrels-style road trip), a list of leg-by-leg encounters with a roll-target each. Probably a new `route_legs` table linking to existing pins.
- [ ] **Adventure preview** - a "play test mode" that runs the GM through the arc beat-by-beat in a dry-run UI, surfacing each linked NPC / scene / handout / encounter so they can audit the adventure before publishing.
- [ ] **Publish Adventure** - terminal step on the Story Arc form. Bundles the arc + every linked asset into a Module snapshot via the existing `buildModuleSnapshot` path. Skips the "run a campaign first" friction.

**Out of scope for v1:** branching narratives (the arc is linear with multiple endings), procedural adventure generation (every adventure is GM-authored), shared authoring (one GM owns the arc; collaborator support is a Phase 6/7 ask).

**Why this is its own phase:** the existing Module System assumes you've already played the adventure in a real campaign before publishing. This toolkit is the missing front-end - it lets you AUTHOR an adventure without playing it first. Pairs naturally with Phase 5 Phase D monetization (paid module authors need authoring scaffolding to produce content at quality + speed).

### Legacy GM Kit v1 (for reference)
- [ ] **GM Kit Export** - compile all assets for a campaign/adventure into a downloadable package: NPCs (with portraits + stats), map pins, tactical scenes + battle maps, handouts, object tokens, route tables, session notes. Include GM instructions/playbook. Export as PDF, ZIP, or shareable link. Could serve as the distribution format for published modules.
- [~] **GM Kit v1 - export + seed-import loop (DIRECTION UNCERTAIN, paused 2026-04-19)** - Shipped end-to-end: green `GM Kit` button on `/stories/[id]` (`lib/gm-kit.ts`, jszip) downloads a `gm-kit-<slug>-<date>.zip` with manifest, pins/npcs/scenes/tokens/handouts JSON, and an `images/` folder pulled from Supabase. `/tools/import-gm-kit` reads any kit zip and upserts into `setting_seed_*` tables; `/stories/new` and `/campaigns/new` then seed new campaigns with backgrounds + portraits + handout attachments intact (`sql/setting-seeds-extend.sql`). Wired to The Arena story option (`arena` setting key in `lib/settings.ts`). **Why paused:** image URLs in seeds still point to the source campaign's bucket - delete that campaign and seed images 404. Scene `tokens.json` round-trips through the kit but neither the seed schema nor the create flow ingests it (objects placed on tactical maps don't carry to new campaigns). Not yet clear whether the right answer is (a) re-upload kit images to a "shared seed assets" bucket on import, (b) treat seeds as live-linked to the source campaign, (c) abandon the seed approach and lean on a real Module data structure (Phase 5 line 1). **How to apply:** revisit before promoting any setting beyond personal beta use.

---

## 🔵 Phase 6 - Community & Retention

> Depends on Phase 4b Phase E shipping - Campfire feeds, subscription, and cross-community features hang off the `world_communities` layer.

- [ ] LFG system - GMs post open campaigns, players post availability, matching by setting and playstyle
- [ ] Session scheduling - GM proposes times, players confirm, calendar view
- [ ] The Gazette - auto-generated campaign newsletter after each session pulling from roll log highlights, session summary, GM notes. Shareable link for non-members.
- [ ] Between-session experience - something to do on the platform outside of active sessions
- [ ] Subscriber tiers - Free, Paid, Premium with defined feature gates
- [ ] Graffiti - reactions on War Stories and Campfire posts (Distemper-branded reactions)

---

## 🔵 Phase 7 - Ghost Mode Advanced
- [ ] Ghost-to-Survivor funnel analytics - track where conversions happen
- [ ] A/B test soft wall messaging
- [ ] Onboarding flow for physical product QR scanners - different from standard signup
- [ ] **Reactivate `/firsttimers` onboarding page** - file exists at `app/firsttimers/page.tsx` and remains reachable, but signup no longer auto-redirects new users to it (see `app/signup/page.tsx`, was disabled alongside the `/welcome` forced redirect in 2026-04-20 playtest fix #12). When the site is ready to onboard new users: change signup's fallback from `/dashboard` back to `/firsttimers`, and re-enable the `/dashboard` → `/welcome` redirect in `app/dashboard/page.tsx` (also commented-out under playtest #12).

---

## 🔵 Phase 8 - Physical Products
- [ ] Chased QR code integration - fold-out map codes deep-link into Tapestry at Delaware setting
- [ ] Anonymous preview for QR scanners without accounts - show setting content before signup prompt
- [ ] Chased module - pre-populated with Delaware setting content, linked to physical product
- [ ] Minnie & The Magnificent Mongrels setting - sourcebook upload, seed pins and NPCs
- [ ] Physical product landing pages - one per product, branded, drives to signup

---

## 🔵 Phase 9 - Maturity
- [ ] Rules reference - surface in-app search across the SRD content (SRD copy is structurally complete; `/rules/*` pages just need search UI)
- [ ] Contextual rules links - from character sheet and dice roller to relevant SRD sections
- [x] GM quick-reference panel - pop-out /gm-screen with outcomes, CMod, range bands, combat actions, healing, skills→attrs
- [ ] Mobile optimization pass - dashboard, map, character wizard, table view all responsive
- [ ] Mobile dice roller - optimized for rolling at a physical table on your phone
- [ ] Global search - find characters, campaigns, pins, NPCs, Campfire posts

---

## 🔵 Phase 10 - Future Platforms
- [ ] Displaced - space setting, separate platform, custom star map
- [ ] Extract shared XSE engine into @xse/core monorepo - character system, campaign system, table surface shared across platforms
- [ ] Each setting gets own domain, branding, and map layer built on shared core
- [ ] Long-term: Tapestry becomes the proof of concept for the XSE platform family

---

## 🔵 Phase 11 - Cross-Platform Parity
- [ ] **Campaign Calendar** - date-gated lore events, GM-controlled include/ignore/pending states. Build for Displaced first, backport to Tapestry using same schema pattern if player demand exists. Potential Distemper uses: seasonal/anniversary events tied to collapse timeline, campaign duration tracking, faction state changes over time. Schema: `campaign_date timestamptz` on campaigns table (default year TBD - confirm canonical Distemper present year).
- [ ] **Roll20 Export** - one-way migration for GMs/players who want to take a campaign to Roll20. Accepts loss of Tapestry-specific features (tactical ranges, realtime, insight/stress automation). Three parts:
  1. **Minimal "Distemper" Roll20 character sheet** (HTML/CSS/sheet-worker JS): Rapid attrs → amod, skill table, weapons, WP/RP, one roll button per skill/weapon (`2d6 + @{amod} + @{skill_level} + @{weapon_cmod}`). Hosted in a Pro game or submitted to Roll20's public sheet repo.
  2. **Exporter in Tapestry** (GM-only): per-campaign ZIP download - `characters/<name>.json` (Roll20 Character Vault format: name, bio, avatar, attribs[], abilities[]), `npcs/<name>.json`, `handouts/` (scenes, pins, GM/player notes, cliffhangers), `manifest.json`.
  3. **Ingest paths**: Pro GMs drag JSONs into the Character Vault or run a small API script that batch-creates characters + handouts from the manifest; free-tier GMs paste bios into handouts and manually click "Create Character." Scope estimate: sheet ~2-4 days, exporter ~1 day, API import script ~half a day; add calendar time if submitting the sheet to Roll20's public library.

---

## 🛠 Tools
- [x] **Portrait Resizer** (`/tools/portrait-resizer`) - drag-drop image → 256×256 JPEG with center-crop, quality slider (0.5-1.0), live previews at 256/56/32px, optional dashed circle overlay showing token clip area, live file size display, download button

### Future enhancements for the tools suite
- [ ] **Batch mode** - multi-file upload, process and download as zip
- [ ] **Manual crop control** - drag-to-select crop area instead of auto center-crop (useful for off-center subjects)
- [ ] **More tools** - handout generator, token template maker, roll table randomizer

## 📝 Technical Debt
- [x] Auto-resize uploaded photos to 256x256
- [ ] Embed Distemper videos on landing page
- [x] Welcome page dual-mode
- [x] Thriver Console
# Plan: Communities, NPCs, and Recruitment (Phase B)

**Status**: Drafted, awaiting review. Do NOT start implementing until user signs off.

**Source spec**: `tasks/spec-communities.md` §2 (Recruitment Types), §3 (Recruitment Check), §9a/9b (UI), §11 Phase B.

---

## Context summary (from codebase audit)

- **Phase A DB + UI shipped.** Tables (`communities`, `community_members`, `community_morale_checks`, `community_resource_checks`) + RLS + `CampaignCommunity.tsx` with create/manage/role-assignment UI all live.
- **Gap found**: `CampaignCommunity` is mounted at `/communities/[id]` only - NOT as a tab in the GM Assets panel on the table page. GMs have to leave the table to manage their community. This blocks mid-session recruitment UX.
- **Gap found**: `npc_relationships` table is used in code (First Impression CMod, reveal level) but has no SQL definition in `sql/`. Likely exists in Supabase from an untracked migration. Must confirm before Phase B leans on `relationship_cmod`.
- **Recruitment is wholly unbuilt.** `community_members.recruitment_type` column exists with type enum, but nothing writes the recruitment flow. NPC card has no "Recruit" button.
- **First Impression already writes `relationship_cmod`** via `npc_relationships` - the primary input Recruitment needs is already flowing.

---

## Plan phases

### Step 0 - Pre-work (unblockers) - ~30 min

- [ ] **0.1** Write `sql/npc-relationships-schema.sql` to formalize the existing table (check + reveal + add IF NOT EXISTS). Columns confirmed from code: `id`, `campaign_id`, `npc_id`, `character_id`, `relationship_cmod int`, `revealed bool`, `reveal_level text`, `created_at`, `updated_at`. Includes RLS: campaign members read, GM writes, player writes their own relationship rows.
- [ ] **0.2** Mount `CampaignCommunity` as a new tab in the table page's GM Assets panel. Add `'community'` to the `gmTab` union in `app/stories/[id]/table/page.tsx`. Add tab button next to Pins/NPCs/Assets/Notes. Render `<CampaignCommunity campaignId={id} isGM={isGM} />` when tab is active. Don't break the existing `/communities/[id]` standalone route - both should work.
- [ ] **0.3** Verify Phase A UI still works with the new mount point. Manual smoke test: create a community, add an NPC manually, remove, rename.

**Ship gate**: commit `chore: mount Community tab in Assets panel + formalize npc_relationships schema` before starting Step 1.

---

### Step 1 - NPC card "Recruit" button - ~45 min

- [ ] **1.1** Add `onRecruit?: () => void` prop to `NpcCard.tsx`. Button renders in the header row next to Edit/Close. Green outline styling. Only visible when `onRecruit` is provided (GM view, campaign has at least one community).
- [ ] **1.2** Wire the callback in `app/stories/[id]/table/page.tsx` (and wherever NpcCard is mounted - scan for all render sites). Clicking opens a new `<RecruitmentModal />`.
- [ ] **1.3** Gate the button: only shown when (a) the NPC is revealed to at least one PC AND (b) the NPC is not already in a `community_members` row (no duplicate membership). Query on modal mount; cache in `campaignNpcs` state if it already loads relationships.
- [ ] **1.4** Hide the button for PCs in `PlayerNpcCard.tsx` - recruitment is a GM action (for Phase B; spec §10 "Who can recruit" says GM-only in MVP).

**Ship gate**: commit `feat: NPC card 'Recruit' button - opens recruitment modal (empty shell)`.

---

### Step 2 - Recruitment modal: approach + skill picker - ~1 hour

- [ ] **2.1** New file `components/RecruitmentModal.tsx`. Props: `npc`, `campaignId`, `communities[]` (if multiple; modal starts with community picker if >1), `onClose`, `onRecruited`.
- [ ] **2.2** Step 1 UI: three approach cards (Cohort / Conscript / Convert) with flavor text from spec §2. Apprentice picked later as a toggle - it's not an approach, it's a modifier.
- [ ] **2.3** Step 2 UI: skill picker auto-suggests per approach (Cohort → Barter/Tactics, Conscript → Intimidation/Tactics, Convert → Inspiration/Psychology). Free-pick fallback for house-rule flex. SMod pulls from the roller PC's skills; AMod pulls from the PC's relevant RAPID (INF for most social).
- [ ] **2.4** Step 3 UI: CMod review. Auto-fills:
    - First Impression bonus = `npc_relationships.relationship_cmod` for the rolling PC vs this NPC (may be null/0 if never rolled First Impression).
    - GM freeform +/- CMod input.
  - Show running total below dice line.
- [ ] **2.5** Roller selection: defaults to the active combatant PC (if combat) or a PC dropdown (otherwise). GM can override.

**Ship gate**: commit `feat: Recruitment modal steps 1-3 - approach + skill + CMod preview`. Roll step still a stub.

---

### Step 3 - Recruitment roll + outcome table - ~1 hour

- [ ] **3.1** Add roll logic to the modal: 2d6 + AMod + SMod + CMod. Reuse `executeRoll`'s dice-rolling patterns; do NOT route through the main attack flow (Recruitment is a pre-combat / out-of-combat social check). A lighter standalone resolver inside the modal is fine.
- [ ] **3.2** Outcome mapping per spec §3:
    - 14+: Wild Success
    - 6+6: Moment of High Insight (overlay; still treat as Wild Success for join logic, unlocks Apprentice option)
    - 9-13: Success
    - 4-8: Failure
    - 0-3: Dire Failure
    - 1+1: Moment of Low Insight (overlay; dire-failure + escalation flavor)
  - Per-approach copy for each bucket (cohort/conscript/convert have different flavor strings - spec §3 table).
- [ ] **3.3** Outcome screen: dice animation → result banner (green/red/amber) → "Confirm" button that commits the outcome.
- [ ] **3.4** Commit success → INSERT `community_members` row:
    - `community_id` (selected community)
    - `npc_id` (the NPC being recruited)
    - `character_id` null (NPC member)
    - `recruitment_type` = 'cohort' | 'conscript' | 'convert' | 'apprentice' if toggle enabled
    - `apprentice_of_character_id` = roller PC if apprentice toggled
    - `role` = 'unassigned' (GM assigns later)
    - `joined_at` now, `joined_week` = community.week_number
- [ ] **3.5** Commit failure / dire failure → no DB write other than roll_log. Show flavor + "Close" button.

**Ship gate**: commit `feat: Recruitment roll + outcome + community_members insert`.

---

### Step 4 - Apprentice toggle + constraints - ~30 min

- [ ] **4.1** Apprentice toggle only rendered on Wild Success / High Insight outcomes. Spec §2: "Only 1 Apprentice per PC."
- [ ] **4.2** On toggle, INSERT sets `recruitment_type = 'apprentice'` + `apprentice_of_character_id = rollerPcId`.
- [ ] **4.3** Validation: query `community_members WHERE apprentice_of_character_id = <rollerPcId>`. If any exist, toggle is disabled with tooltip "PC already has an apprentice (<name>)".

**Ship gate**: commit `feat: Apprentice flag on Wild Success recruits - 1 per PC constraint`.

---

### Step 5 - Roll log integration - ~30 min

- [ ] **5.1** Write a `roll_log` row for every recruitment attempt. Outcome string examples:
    - Success: `Vera Oakes recruited Nolan Penn as Cohort`
    - Failure: `Vera Oakes failed to recruit Nolan Penn`
    - Dire: `Vera Oakes alienated Nolan Penn`
  - `outcome` column = `'recruit'` (new category; add to feed renderer styling).
  - `damage_json` carries `{ npc_id, community_id, recruitment_type, approach, skill_name }` for future auditing / Phase C recoverability.
- [ ] **5.2** Feed renderer: recruitment rows get a custom style card (green border for success, amber for failure, red for dire). Similar to `sprint` / `defer` / `loot` existing patterns.
- [ ] **5.3** compactRollSummary branch: narrative one-liner per approach. `Vera Oakes inspired Nolan Penn to join the Greenhouse` / `Vera Oakes failed to win Nolan Penn over`.

**Ship gate**: commit `feat: recruitment log entries + feed card styling`.

---

### Step 6 - First Impression integration polish - ~20 min

- [ ] **6.1** Verify Step 2.4 actually pulls `relationship_cmod`. If `npc_relationships` row doesn't exist for this PC+NPC pair, show a hint: "No First Impression yet - roll one from the NPC card for a CMod input."
- [ ] **6.2** If PC rolled First Impression *in this session* (no prior relationship row), cache it locally so the modal picks it up without a DB re-fetch.

**Ship gate**: commit `feat: Recruitment modal surfaces First Impression CMod prominently`.

---

## Testing plan (to `tasks/testplan.md` on implementation day)

1. **Happy path Cohort**: Revealed NPC → GM clicks Recruit → Cohort/Barter/+0 CMod → Success → NPC appears in community member list with "Cohort" label.
2. **Apprentice path**: Same but Wild Success → toggle Apprentice ON → insert sets apprentice_of_character_id.
3. **Apprentice cap**: PC already has an apprentice → toggle disabled with tooltip.
4. **Convert flavor**: Pick Convert → skill list narrows to Inspiration/Psychology → win the roll → recruitment_type = 'convert', not 'cohort'.
5. **Dire Failure**: Bad CMod → 1+1 → Moment of Low Insight card shown, no membership written, roll_log entry reads alienation.
6. **Multi-community selector**: Create 2 communities → open Recruit → step 0 shows picker.
7. **No community case**: Campaign with zero communities → Recruit button hidden on NPC card OR modal shows "Create a community first" CTA.
8. **Already-member guard**: Recruit a recruited NPC → button disabled OR modal shows "already a member".
9. **RLS**: Non-GM player tries to open Recruit → button not rendered; direct API call rejected by campaign_members policy.
10. **Feed log**: All outcomes land in roll_log with custom styling, compact line reads narratively.

---

## Decisions - locked by user

- **DECISION 1 - Community tab location**: BOTH. New tab in the GM Assets panel on the table page AND keep the standalone `/communities/[id]` route.
- **DECISION 2 - Who rolls Recruitment**: Always a PC. Roller picker in the modal lists all alive PCs in the campaign (not just the active combatant). No NPC rollers, no GM-side roll. (NPCs might recruit for their community later via GM proxy - that's a Phase D concern.)
- **DECISION 3 - Combat action cost**: No. Recruitment is out-of-combat only. Modal may open during combat but the roll does NOT advance the turn or decrement `actions_remaining`.
- **DECISION 4 - Manual Add kept**: Yes. Existing "+ Add Member" stays on `CampaignCommunity` for Founders and GM retcon.
- **DECISION 5 - Approach tooltips**: Single-sentence flavor for now. Revisit with deeper tooltip in a future polish pass (logged below).

### Follow-ups logged from these decisions

- [ ] **Polish** Deeper approach tooltip - "Why this approach?" with rules context (commitment duration, SRD references, when to pick each). Part of a future Communities UX pass, not Phase B MVP.
- [ ] **Phase D candidate** NPC-proxy recruitment - GM rolls on behalf of a Community's Leader NPC to recruit other NPCs. Needed if a community grows itself off-screen while PCs are elsewhere. Design dependency: Activity Blocks (Phase D).

---

## Out of scope (explicit non-goals for this round)

- Morale Checks (Phase C).
- Resource Checks - Fed / Clothed (Phase C).
- Activity Blocks + End Week flow (Phase D).
- Cross-campaign / Tapestry Layer publishing (Phase E).
- Apprentice task delegation (PC-via-proxy actions; Phase D).
- World map overlay for communities (Phase E).

---

## Review section - filled in AFTER implementation

*Not yet started.*

---

## 🎯 From 2026-04-28 chat (Welcome page + Messages bell session)

- [x] **Run `sql/messages-realtime-publication.sql` on prod database** - applied 2026-04-28; Xero confirmed chat in `/messages` now refreshes live without reload. Adds `public.messages` and `public.conversation_participants` to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL` on `conversation_participants` so the bell's `user_id=eq.<uid>` filter survives UPDATE payloads.
- [ ] **Welcome page → Quick Reference card content TBD.** [app/welcome/page.tsx](app/welcome/page.tsx) has a `Quick Reference` placeholder card. Needs cheat-sheet content per Xero's direction: CDP, WP/RP, Stress, Inspiration, links into the SRD/CRB. Wait for Xero to specify what to surface first, then wire it in.

## 🔒 Backburner - Setting content (deferred 2026-05-20 per Xero: "content comes when the platform is stable")

- [ ] **King's Crossroads Mall - tactical scenes** - author battle maps for the mall complex (motel courtyard, Costco interior, gas station, Belvedere's etc.) and wire into `SETTING_SCENES.kings_crossroads_mall` in `lib/setting-scenes.ts` using the filter-from-CHASED_SCENES pattern as the pins + NPCs. (Was active list; moved to backburner 2026-05-20.)
- [ ] **King's Crossroads Mall - handouts** - port in-world broadcasts, journal pages, ham-radio transcripts into `SETTING_HANDOUTS.kings_crossroads_mall` in `lib/setting-handouts.ts`. Mirror the filter-from-CHASED_HANDOUTS approach.
- [ ] **Astoria: Home by the Sea** - new setting. Pins / NPCs / scenes / handouts. Needs setting key (suggest `astoria_home_by_the_sea`), SETTING_CENTERS entry, full content pass.
- [ ] **Pelee Island** - new setting. Pins / NPCs / scenes / handouts. Needs setting key (suggest `pelee_island`), SETTING_CENTERS entry, full content pass.

(Order: stabilize platform first - finish CRB workstreams, modal unification residue, performance. Then setting content.)
