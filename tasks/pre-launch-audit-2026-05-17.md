# Pre-Launch Audit — 2026-05-17

> Top-down structural audit per `/pre-launch-audit` slash in `tasks/operating-mode.md`. Five parallel Explore agents covered auth/RLS, payment, scalability, observability, and data model. This file is the synthesis — a punch list of structural items that must be resolved (or knowingly deferred) before opening paid signups. Per Xero direction (2026-05-17), this audit presupposes the 5 structural workstreams from the chat (page.tsx decomposition, realtime audit, CMod stack extraction, modal unification, this audit) are ALL committed; the question this answers is sequencing and "what else is on fire."

**Audit commit base:** `d2ba6b6` (multi-cell drag-end fix)
**Trajectory:** alpha/beta -> paid signups, targeting 50k users / 20k paying

---

## TL;DR

The auth + RLS surface is genuinely sound. The big fires are observability (Sentry is wired but leaking PII + has no alerting + has no user context), scalability (two unbounded queries + missing indexes on hot tables + N+1 in the live-session loop), and schema hygiene (170 unversioned migration files + a canonical table with no CREATE TABLE statement + ambiguous user-delete cascade behavior). Payment infrastructure is fully greenfield — there is literally zero billing code, which is actually a clean slate, not a debt.

The 12k-line `app/stories/[id]/table/page.tsx` decomposition is still the right structural priority, but it should NOT be the next thing we ship. The audit surfaces fire-class items that the decomposition would otherwise paper over.

---

## Severity map (cross-audit cluster)

### RED — blockers before any paid signups

| # | Finding | Source audit | Cite |
|---|---|---|---|
| R1 | Sentry `sendDefaultPii: true` ships user emails / usernames / session IDs to Sentry on every event | Observability | `instrumentation-client.ts:12`, `sentry.server.config.ts:12`, `sentry.edge.config.ts` |
| R2 | No Sentry sample rate set; at 20k users every event ships; budget will explode | Observability | All three Sentry config files |
| R3 | No Sentry user context attached; errors orphaned from the user that hit them | Observability | Live-session `load()` flow |
| R4 | No alerting beyond Sentry email; production breaks discovered via player Discord posts | Observability | (no Slack/PagerDuty wiring found) |
| R5 | No `/api/health` endpoint; cannot tell programmatically if the app is alive | Observability | (none exists) |
| R6 | Realtime broadcast handlers in `page.tsx` have no try/catch; one malformed payload silently breaks the dispatch chain | Observability | `app/stories/[id]/table/page.tsx:1380-1559` |
| R7 | Unbounded `lfg_interests` fetch with no `.limit()` / `.range()` | Scalability | `app/campfire/lfg/page.tsx:269` |
| R8 | `scene_tokens` has no index on `scene_id` and realtime subscription has no column filter; flood risk at scale | Scalability + Data Model | `sql/tactical-map.sql:20-32`, `app/stories/[id]/table/page.tsx:555` |
| R9 | `initiative_order` table has zero `CREATE TABLE` statement; schema reconstructed entirely from scattered `ALTER` migrations. Backup-restore breaks. | Data Model | code reads from it across `app/stories/[id]/table/page.tsx`; no DDL in `sql/` |
| R10 | 170 unversioned SQL migration files in `sql/`; no Supabase `migrations/` directory; ordering enforced by convention only | Data Model | `sql/` directory listing |
| R11 | Index gaps on `roll_log`, `chat_messages`, `notifications` — high-growth tables, no `(campaign_id, created_at)` / `(user_id, created_at)` indexes | Scalability + Data Model | `sql/roll-log-coord-chain-id-2026-05-17.sql`, `sql/messages.sql:40-41` |
| R12 | Cascade behavior on `characters` / `character_states` on user deletion not defined; could orphan or destroy player state inconsistently | Data Model | `sql/fix-auth-cascades-2026-05-08.sql` only covers 5 tables, doesn't include `characters` |

### YELLOW — concerning, fix before scale but not launch-blocking

| # | Finding | Source audit | Cite |
|---|---|---|---|
| Y1 | `delete-user` edge function uses raw string role compare (`role !== 'thriver'`); not normalized | Auth/RLS | `supabase/functions/delete-user/index.ts:70` |
| Y2 | `notify-thriver` edge function has NO caller authorization — anyone with the URL can mass-mail thrivers | Auth/RLS | `supabase/functions/notify-thriver/index.ts:7-59` |
| Y3 | Client controls `moderation_status` + `approved_by` on forum/war-story/lfg inserts; RLS doesn't re-validate the approver is actually a thriver | Auth/RLS | `app/campfire/forums/page.tsx:270` and 5+ similar |
| Y4 | `delete-user` accepts `caller_id` from request body instead of trusting `auth.uid()` | Auth/RLS | `supabase/functions/delete-user/index.ts:55,70` |
| Y5 | `npc_relationships` N+1 loop over PCs (fires N sequential queries on load) | Scalability | `app/stories/[id]/table/page.tsx:1091-1092` |
| Y6 | No file-size validation on image uploads; a 100MB TIFF will grind the browser before client resize | Scalability | `lib/image-utils.ts:5-30`, `app/campfire/war-stories/page.tsx` upload path |
| Y7 | `community_stockpile_items` query has no `.limit()` | Scalability | `app/stories/[id]/table/page.tsx:768` |
| Y8 | 245 raw `console.log`/`error`/`warn` calls across 59 files; `next.config.ts` strips only `console.log` in prod | Observability | grep, `next.config.ts:14-15` |
| Y9 | Only `global-error.tsx` exists — no route-level `error.tsx` boundaries; a crash in `app/stories/[id]/table/page.tsx` collapses the whole tree | Observability | `app/global-error.tsx:1-27` |
| Y10 | Queryable JSONB blobs that probably want to be tables: `campaign_npcs.skills`, `campaigns.vehicles`, `campaign_npcs.lasting_wounds` (last is round-tripped only — defensible) | Data Model | `sql/npc-equipment-column.sql`, `sql/campaign-vehicles.sql` |
| Y11 | Partial soft-delete pattern; some tables have `archived_at`, others CASCADE-hard-delete; recovery from accidental bulk delete depends on Supabase PITR | Data Model | `sql/scene-tokens-archived-at.sql` vs `sql/fix-auth-cascades-2026-05-08.sql` |
| Y12 | No backup / restore playbook in the repo | Data Model | (no `docs/runbook-*` files) |

### GREEN — reassuring (do not touch, but worth knowing)

- RLS coverage is comprehensive across 56+ tables; all user-data tables enforce owner/member/GM/thriver scoping. Thriver godmode is well-architected via additive `FOR ALL` policies + `public.is_thriver()` SECURITY DEFINER helper.
- Role normalization enforced at DB level (`trg_normalize_role`) plus a build-time guardrail script (`scripts/check-role-literals.mjs`).
- Service-role key is server-only across all three uses (`delete-user`, `log-visit`, `notify-thriver` edge functions). No client bundle exposure.
- The 9 realtime channels in `app/stories/[id]/table/page.tsx:1656-1668` cleanup cleanly on unmount via `supabase.removeChannel()`. No leaks in the channel teardown for the live-session view.
- Forums / War Stories / LFG (post-list reads) use bounded `.range(offset, offset + 49)` pagination with author lookups batched via `.in()`. Pattern is correct.
- `roll_log.coord_chain_id` is indexed (shipped 2026-05-17). Coordinated Effort withdraw retcon is fast.
- Sentry v10.51.0 SDK is current; source maps upload via Vercel CI; tunnel at `/monitoring` (ad-blocker bypass) works.
- `lib/debug-log.ts` is a well-designed opt-in structured logger that captures `window.onerror` + `unhandledrejection` + page-load timings to a Supabase `debug_log` table. Underused but built.
- Payment surface is zero. No Stripe code, no billing tables, no entitlement gating. This is a clean slate, not technical debt — when we build it, we build it right the first time.

---

## What's NOT yet built (acknowledged greenfield, not a finding)

- **Payment infrastructure** — zero Stripe code, zero billing tables. Backlog estimates 3-5 days for "schema + Stripe + listing UI"; realistic estimate is 1-2 weeks including webhook handler, entitlement gating, refund flow, billing UI, dunning, and tax. Bright line in operating-mode.md requires explicit approval for any payment work.
- **Health-check endpoint** — see R5.
- **Slack alerting integration** — see R4.

---

## Sequencing for the 5 committed structural workstreams

Original chat list (Xero confirmed all 5 are committed):
1. Decompose `app/stories/[id]/table/page.tsx` (12,429 lines)
2. Realtime subscription audit
3. CMod Stack extraction
4. Modal unification finish (5 of 6 modals)
5. Pre-launch audit (this document)

**Audit-informed proposed sequence:**

### Phase 0 — Observability + security YELLOW cleanup (1-2 days)
Quick, surgical, and absolutely must happen BEFORE we start moving 12k lines of code around. We need to be able to detect what we break.
- R1, R2, R3, R6 — Sentry PII scrub + sample rate + user context + try/catch on realtime handlers
- R4 — Slack webhook wiring
- R5 — health-check endpoint
- Y1, Y2, Y4 — edge function role/auth hardening
- Y3 — DB-side CHECK constraint or RPC validation on moderation_status / approved_by

### Phase 1 — Scalability blockers (1-2 days)
Cheap to fix, expensive to leave.
- R7 — paginate lfg_interests
- R8 — index scene_tokens.scene_id + scope the realtime subscription
- R11 — `(campaign_id, created_at)` index on roll_log; `(conversation_id, created_at)` or `(campaign_id, created_at)` on chat_messages; `(user_id, created_at)` on notifications
- Y5 — batch the npc_relationships loop
- Y6, Y7 — file-size cap on uploads, limit on community_stockpile

### Phase 2 — Schema sanity (2-3 days)
Foundational. Doing this before the page.tsx decomposition prevents the decomposition from baking in undocumented assumptions.
- R9 — write canonical `sql/000_create_initiative_order.sql` reconstructing the current shape from live DB
- R10 — adopt Supabase `migrations/` directory; one-time audit of `sql/` to produce ordered list and document which files are applied; add `npx supabase migration` to the workflow going forward (informational only; doesn't move existing files)
- R12 — explicitly define + test user-deletion cascade behavior for `characters` and `character_states`
- Y11 — document the soft-delete vs hard-delete decision per table; pick one stance and converge

### Phase 3 — Decompose `app/stories/[id]/table/page.tsx` + realtime audit (multi-session, this is workstream #1 + #2 from chat)
Now we can refactor safely because the observability net is up and the schema is documented. Realtime audit (#2) folds into this work since broadcast handlers cluster in page.tsx. Concrete plan: catalog responsibilities (state slices, broadcast handlers, modal mounts, render sections), extract by concern into hooks + sub-components, leave page.tsx as a thin orchestrator. Test gates between extractions (the 141-test suite is the safety net).

### Phase 4 — Modal unification finish (workstream #4 from chat)
Tactical, can run in parallel with Phase 3 if we want.

### Phase 5 — CMod Stack extraction (workstream #3 from chat)
Touches multiple consumers (Recruit, Grapple, First Impression, Attack). Do this LAST because each consumer needs its own per-CMod-source compute function and render slot, and we'll know more about the right abstraction after Phase 3 has shaken the table page apart.

### Phase 6 — Payment integration (separate workstream)
Doesn't block any of the above structural work. Should be sequenced relative to Xero's commercial timeline, not relative to engineering.

---

## What this audit did NOT cover (honest scope flag)

- **Rate limiting** on auth endpoints (signup, login, password recovery). Not surveyed.
- **CSRF / CORS configuration.** Not surveyed.
- **Data exfiltration vectors** via profile lookups or member enumeration. Not surveyed.
- **Bundle size / route-level performance** — flagged in the scalability audit as a probable issue with the 12k-line page.tsx but not measured.
- **Third-party penetration test.** Operating-mode.md flags this as required before scaling paid users. Out of scope for this audit; needs a real human.
- **Legal / GDPR / COPPA / ToS / privacy policy review.** Operating-mode.md bright line — needs a real lawyer.

---

## Confidence

This audit was produced by 5 parallel Explore subagents, each given a focused brief and ~600-1000 words of output budget. Findings are file:line-cited; severity ratings are mine (synthesizer's), reconciled where audits overlapped. Confidence is high on RED items (they're concrete and either present or absent). Confidence is moderate on YELLOW items (some involve judgment about scale-out impact). The data-model audit explicitly flagged 70% confidence due to the absence of canonical DDL — next pass should `pg_dump` the live schema and reconcile against `sql/`.

---

## Next move

Phase 0 first. Specifically:
1. Sentry PII scrub + sample rate + user context (R1/R2/R3) — single commit, fast.
2. Realtime handler try/catch sweep (R6) — touches `app/stories/[id]/table/page.tsx:1380-1559`. Surgical.
3. Slack webhook wiring (R4) — one-time Sentry config.
4. Health check endpoint (R5) — single file.
5. Edge function hardening (Y1, Y2, Y4) — small.

Pick one and ship, or batch Phase 0 as a single thread. Xero's call.
