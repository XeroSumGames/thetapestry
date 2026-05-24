# Stability Audit - 2026-05-24

First stability audit after the Grand Re-Architecture. Read-only pass (no code edits). Pattern: `tasks/lessons.md` "Stability-audit pattern" + `tasks/operating-mode.md` `/stability-audit` definition.

- **HEAD at audit:** `4dcdd12` (`docs(e2e): handoff brief for the Playwright "final test" suite`), in sync with origin/main.
- **Scope read:** Risk Register + Tech Debt + Confidence Ledger (`tasks/debug-handoff.md`), newest `tasks/health-pulse.md` (2026-05-24 00:11 UTC), `tasks/security-audit.md` (2026-05-19 16:23 UTC), last 14 days git log (~120 commits), `tasks/todo.md` CURRENT OPEN.
- **Gates run live:** tsc, vitest, check-arch ratchet, dependency-cruiser, font/role/em-dash/preview-sync guardrails, npm audit.
- **Footgun grep + the 16 react-hooks/exhaustive-deps suppressions reviewed** (handoff/todo said 13 - count drifted; see L-5).

---

## Top line

The re-arch landed clean. Every live gate is green and the ratchet baselines match the claimed end-state exactly (`.from` 1039, `.channel` 22, console 0). There are **no BLOCKERs** - nothing is actively broken at the table. The dominant risk this audit surfaces is not a defect, it is **unverified surface**: ~25 commits rewrote all six god-components and every realtime channel onto the seams, the suite is all-unit (548 tests, zero integration/2-client), and only a thin slice (TacticalMap token-move + combat-start) has been 2-client-smoked on prod. The whole re-arch sits in HOPED-FOR. The single most important Risk-Register move is bumping **Realtime channels GREEN-ish -> YELLOW**: the old "stable, hasn't been refactored in months" rationale was just invalidated by the largest realtime refactor in the app's history.

Two operator items owed by Xero are unchanged and one of them (Upstash KV) leaves a prod endpoint returning 503.

### Gate results (all green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npm test` (vitest) | 548 passed, 29 files, ~607ms |
| `node scripts/check-arch.mjs` | OK - all metrics at baseline (`.from` 1039, `.channel` 22, console 0) |
| `npm run arch:depcruise` | no violations (301 modules, 829 deps) |
| check-font-sizes / check-role-literals / check-em-dashes / check-preview-sync | all OK |
| `npm audit` | 2 moderate (postcss-via-next only); brace-expansion + ws from 2026-05-19 now resolved |

---

## BLOCKER

None. Re-arch shipped behavior-preserving, all gates green, the 2026-05-23 prod 2-client smoke passed on the hardest seam (TacticalMap).

---

## HIGH (action this week)

### H-1. `log-visit` edge function: unauthenticated email mailbomb (carried, still open)
- **Where:** `supabase/functions/log-visit/index.ts` (deployed `--no-verify-jwt`; URL ships in the client bundle at `lib/events.ts:66`).
- **What:** the "new visitor" email gate keys off a body-supplied `ip_hash` (`:27`, `:42-48`) and the only suppression keys off a body-supplied `city` (`:81-82`). Omit both and every request emails Xero's alert inbox -> Resend-quota DoS + alarm-fatigue. Body geo/`user_id` also inserted unvalidated -> analytics poisoning.
- **Why HIGH not BLOCKER:** no user-facing breakage, but it is unauthenticated + attacker-controlled + asymmetric (drains a paid quota, poisons stats). Pre-paid-signups is the deadline.
- **Fix (root-cause, ordered):** (1) derive the email-gate count from a SERVER-side hash of `x-forwarded-for` (`:29` already has it), not the body; (2) 60/min/IP `@upstash/ratelimit` keyed on server IP (same pattern as verify-turnstile); (3) validate body (UUID `user_id`, bound string lengths). Full write-up: `tasks/audit-rate-limit-coverage-2026-05-20.md` finding A-F4b.
- **Disposition:** hunt-and-peck. NOT a re-arch item.

### H-2. Upstash KV unset -> prod `/api/auth/verify-turnstile` returns 503 (operator-owed)
- **Where:** `app/api/auth/verify-turnstile/route.ts` - lazy-builds the limiter from `UPSTASH_REDIS_REST_URL` / `_TOKEN`; **prod fails loud (503) when those env vars are missing** (dev falls back to the in-memory bucket).
- **What:** the Turnstile CAPTCHA verify is the signup gate. On prod, with the env vars unset, that endpoint 503s, so the signup path is currently broken on live. Alpha/beta with a closed playtester group masks it (no open signups), which is exactly why it can sit unnoticed until the moment it matters.
- **Why HIGH:** prod endpoint live-returning 503 on a real auth path. Becomes a BLOCKER the instant paid/open signups turn on.
- **Fix:** Xero sets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in the Vercel dashboard. Code is shipped. Testplan: `tasks/l3-kv-ratelimiter-testplan-2026-05-20.md`. **Bright-line: env/deploy config - Xero executes, not Claude.**

---

## MEDIUM (action in 1-2 weeks)

### M-1. Re-arch realtime surfaces are migrated but NOT 2-client-smoked (the headline risk)
- **What:** vehicle / communities / stockpile / MapView realtime were all moved onto `useCampaignChannel` / `usePostgresSubscription` / `broadcastOnce`, behavior-preserving by construction but **unverified across two clients**. Phase 7 only smoked TacticalMap token-move + combat-start + presence. Per-surface realtime regressions (a dropped broadcast, a filter that doesn't resubscribe) are precisely the failure class that hides without two clients.
- **Why MEDIUM not HIGH:** the seam pattern is proven on the hardest surface (TacticalMap passed on prod), unit + tsc are green, and the playtest is the natural net. But until each surface is exercised by 2 clients, treat it as HOPED-FOR.
- **Action:** run the batched Phase 7 acceptance (per-surface steps in `tasks/todo.md` "PHASE 7 SMOKE - vehicle realtime" + `tasks/decomposition-2client-smoke-testplan.md`). Needs Xero (two browser windows). This is the demote-gate for the Realtime YELLOW below.

### M-2. End-of-combat infection MODAL unverified (combat-critical, likely-fixed-pending-confirm)
- **What:** in the 3c-B smoke the wound-infection check did not fire at end of combat for the wounded PC's owner (Xero confirmed the player owned the PC + watched + saw no modal). The `infection_check_request` rode the old churning init channel; **3d moved it onto the stable `useCampaignChannel` [userId/id] subscription**, which should eliminate the resubscribe-miss - but that is a hypothesis, not a verified fix.
- **Bisect (still owed):** did the "<name> is wounded and may have to deal with infection" WARNING rows appear in the feed during the fight? Rows present -> broadcast/listener bug (3d should fix). No rows -> logging bug. `sql/diag-wound-infection-2026-05-23.sql` written; needs a linked DB + a focused 1-combat repro.
- **Why MEDIUM:** combat-critical surface, but pre-existing (not a re-arch regression) and plausibly already fixed by 3d. Handed to the E2E/Playwright window.
- **Disposition:** hunt-and-peck investigate. Confirm root cause before any code change. Todo item already open.

### M-3. `sql/audit-log-table-2026-05-20.sql` not applied to live (operator-owed)
- **What:** the audit-log table is the agreed recovery substitute for the deferred Supabase Pro/PITR. Until applied, there is no forensic trail for sensitive actions (deletes, bans, role changes).
- **Why MEDIUM:** not user-facing, but it is the standing recovery-posture gap and the moderation actions it would log are bright-line-sensitive.
- **Fix:** `npx supabase db query --linked -f sql/audit-log-table-2026-05-20.sql`. **Bright-line: live-DB migration - confirm intent with Xero first.**

### M-4. `postcss`-via-`next` moderate vuln (carried from 2026-05-19)
- **What:** the only remaining `npm audit` finding (2 moderate, both the same chain). Fix is `npm audit fix --force` which downgrades `next` to 9.3.3 - breaking. Build-time XSS in CSS stringify; low runtime risk.
- **Action:** hold. Re-evaluate when a non-breaking `next` patch covers it. brace-expansion + ws (the 2026-05-19 non-breaking pair) are now resolved, so the audit surface shrank.

### M-5. 15 orphan tables still lack a canonical CREATE TABLE in `sql/` (carried)
- **What:** `profiles`, `campaigns`, `characters`, `character_states`, `campaign_members`, `roll_log`, `chat_messages`, `notifications`, `campaign_notes`, `map_pins`, `session_attachments`, `sessions`, `user_events`, `visitor_logs`, `world_npcs` have no reverse-engineered schema file. Recovery posture gap - a from-scratch rebuild has no source of truth for these.
- **Action:** same reverse-engineering pattern as `sql/000-initiative-order-canonical-2026-05-17.sql`. ~3-5 sessions. Do NOT touch `characters`/`character_states`/`profiles` casually; coordinate around playtests.

---

## LOW (when convenient)

### L-1. `TacticalMap.tsx:3640` - scene-controls popout bus reads local state directly in the snapshot handler
- **What:** the scene-controls-popout `BroadcastChannel` bus effect (deps `[isGM, campaignId]`) registers an `onRequestSnapshot` handler that reads `zoom, cellPx, showGrid, gridColor, gridOpacity, showRangeOverlay, mapLocked` from the closure. On a snapshot **request** it posts the values captured at mount, not current ones.
- **Why LOW:** the sibling per-change effects at `:3645+` (`postState('zoom', ...)` etc.) keep the popout fresh under normal use; the stale read only bites a snapshot-request edge case. This is the local cross-window `BroadcastChannel` bus, **NOT the Supabase realtime seam** - so it is outside the "realtime centralized" concern the seams address.
- **Fix when convenient:** mirror the seven values into a ref and read the ref in the snapshot handler (same ref-freshness pattern the seam primitives already use), or add them to the dep array.

### L-2. `PlayerNotes.tsx:54` - raw `gm_notes_share_${campaignId}` channel not migrated to the seam
- **What:** a hand-rolled `supabase.channel(...)` postgres+broadcast subscription, suppressed on `[campaignId]`. PlayerNotes is not one of the six god-components, so it was left raw (consistent with the 22 remaining `.channel` in the ratchet).
- **Why LOW:** the handler is a no-arg `() => loadShared()` - no captured payload, so stale-closure risk is minimal. The explicit broadcast fallback for un-share is well-commented and correct.
- **Fix when convenient:** future seam-migration candidate (`usePostgresSubscription` + a broadcast handler). Not urgent.

### L-3. `as any` density high (574 across 83 files)
- **What:** dominated by (a) the known `damage_json ... as any` tech-debt (Tech Debt Ledger) concentrated in `app/stories/[id]/table/page.tsx` (115) + `useRollResolution.ts` (23) + `RollsFeed.tsx` (36), and (b) the unavoidable `'postgres_changes' as any` Supabase typing gap in the seam primitives.
- **Why LOW:** pre-existing, not introduced by the re-arch; the seam casts are forced by Supabase's broken postgres_changes types.
- **Fix when convenient:** define `DamagePayload` and type the damage writes/reads (the Tech Debt Ledger's named fix). Candidate for a future ratchet metric.

### L-4. `scene-controls-popout/page.tsx:307` - tactical-maps upload has no size/content-type guard (carried)
- **What:** filename IS sanitized via regex, but no `prepareUpload` size cap / content-type whitelist (unlike the 7 sites H-1 of the 2026-05-19 audit covered). Note: the session-attachments upload that was the 2026-05-19 #1 finding is now at `page.tsx:3366` and **does** route through `check.contentType` (prepareUpload) - that one is remediated.
- **Fix when convenient:** route through `lib/safe-upload.ts:prepareUpload` for consistency.

### L-5. Doc drift: "13 exhaustive-deps suppressions" is actually 16
- **What:** `tasks/handoff.md` + `tasks/todo.md` say 13. Live grep finds 16 - the seam migration added three infra suppressions (`usePostgresSubscription.ts:59`, `useCampaignChannel.ts:126`, plus the consumer churn). Doc-accuracy nit.
- **Fix:** update the count when the handoff/todo next gets touched (folded into this audit's todo note).

---

## The 16 react-hooks/exhaustive-deps suppressions - reviewed (fold-in)

The prompt's hypothesis was that each suppression is "a latent stale-closure now that realtime is centralized on the seams." **The audit finds the opposite: centralizing on the seams is what REMOVES the stale-closure class.** Verdict per cluster:

**Seam primitives - JUSTIFIED BY DESIGN (not latent bugs; they are the fix):**
- `lib/realtime/usePostgresSubscription.ts:59` (`[channelName]`) and `lib/realtime/useCampaignChannel.ts:126` (`[campaignId]`) both mirror config into a ref every render (`configRef.current = config`) and re-read the handler through that ref inside the subscription callback. The channel only re-subscribes when the channel identity changes; handlers always see the latest closure. This is the canonical-correct realtime pattern and the entire point of the seam. Suppression is intentional and load-bearing.

**Migrated god-component consumers:**
- `CampaignCommunity.tsx:406` (`[loading, initialMode, initialModeToken, initialOpenId]`) - a UI one-shot that opens a community when the `initialMode` token changes; omits `communities`/`openId` deliberately so it fires on token change only. Justified.
- `TacticalMap.tsx:3640` - the only genuine latent stale read found (see L-1), and it is the local popout `BroadcastChannel` bus, not the Supabase seam. LOW.

**Not-yet-migrated raw channel:**
- `PlayerNotes.tsx:54` (`[campaignId]`) - raw channel, no-arg handler, low risk. Future seam candidate (L-2).

**Pre-date the re-arch, benign mount-once / single-key effects (no realtime concern):**
- `app/campaigns/new:60` `[]`, `app/stories/new:77` `[]`, `app/stories/new:121` `[]`, `app/tools/token-creator:377` `[]`, `lib/hooks/useBellDropdown:87` `[]` - mount-once.
- `app/reader-popout:109` `[pages.length]`, `components/CampaignMap:357` `[travelMode]`, `:949` `[campaignId]`, `:956` `[revealedNpcIds]`, `app/settings/[setting]:109` `[slug]`, `components/ModuleReviewModal:158` `[flagsLoaded, diff]` - keyed one-shots / load-on-key.

**Net:** zero of the realtime-seam suppressions are latent stale-closures. One non-seam popout-bus handler (L-1) is a genuine-but-low stale read. The rest are intentional. No code change required for the audit; L-1 + L-2 logged as convenient-fix todos.

---

## Risk Register triage (proposed updates to `tasks/debug-handoff.md` Sec 1)

| Entry | Current | Proposed | Rationale |
|---|---|---|---|
| **Realtime channels (Supabase)** | GREEN-ish | **YELLOW** | The re-arch rewrote every channel onto the seams (`useCampaignChannel`/`usePostgresSubscription`/`broadcastOnce`). The old "stable, hasn't been refactored in months" rationale is void. Only TacticalMap token-move + combat-start are 2-client-verified. Hold YELLOW until the batched Phase 7 acceptance (M-1) passes every surface. **Single most important change this audit.** |
| **`app/stories/[id]/table/page.tsx`** | YELLOW (held) | **YELLOW (hold, milestone noted)** | The 2026-05-20 triage wanted "3-4 more extractions before demote" - useGmTools, useRollResolution, useHeaderMenus, and the 3d realtime carve-off all landed (13,192 -> 10,545 LOC). That bar is met, but the file just underwent its largest-ever refactor and the result is HOPED-FOR. Demote candidate AFTER the 2026-05-25 playtest validates the re-arch end-to-end. |
| **`roll_log` writer path** | YELLOW (held) | **YELLOW (hold)** | The re-arch ADDED write paths here (executeRoll -> useRollResolution, CMod itemization 3c-A, blast-log 3c-A4) - all HOPED-FOR. Was already slated to re-evaluate post-2026-05-25 playtest; that still holds. |
| **TacticalMap canvas** | GREEN-ish | **GREEN-ish (hold)** | The canvas RENDER path was untouched by the re-arch; only its realtime token-sync moved onto the seam, and that path 2-client-smoked green on prod. The realtime-migration risk is captured by the Realtime YELLOW bump, not here. |
| `lib/campaign-clock.ts`, Initiative state machine, Character creation wizard | GREEN(-ish) | unchanged | No re-arch touch of consequence; no fresh evidence. |

---

## New todos (severity-prefixed, for `tasks/todo.md`)

- **[HIGH]** Run the batched Phase 7 2-client acceptance across vehicle / communities / stockpile / MapView realtime (M-1). Demote-gate for Realtime YELLOW. Needs Xero (two windows).
- **[HIGH]** (operator, Xero) Set `UPSTASH_REDIS_REST_URL` + `_TOKEN` in Vercel - prod verify-turnstile is 503 until then (H-2).
- **[HIGH]** (carried) `log-visit` unauth email mailbomb - server-IP gate + rate-limit + body validation (H-1).
- **[MEDIUM]** Confirm the end-of-combat infection modal fix (3d stable-init-subscription) via the feed-row bisect + a 1-combat repro (M-2).
- **[MEDIUM]** (operator, Xero) Apply `sql/audit-log-table-2026-05-20.sql` to live (M-3).
- **[LOW]** `TacticalMap.tsx:3640` - ref-mirror the 7 scene-control values so the snapshot handler stops reading stale local state (L-1).
- **[LOW]** Migrate `PlayerNotes.tsx:54` raw channel onto the realtime seam (L-2).
- **[LOW]** Route `scene-controls-popout:307` tactical-maps upload through `prepareUpload` (L-4).
- **[LOW]** Fix the "13 exhaustive-deps" -> 16 count in handoff + todo (L-5).

---

## What we did NOT audit (intentional scope cuts)

- **Behavioral correctness of the re-arch** beyond tsc + unit + the one prod smoke - that is what M-1's 2-client acceptance + the 2026-05-25 playtest are for. This audit reads evidence and runs gates; it does not re-derive that every seam migration is behavior-identical.
- **RLS policy depth** - no live-DB policy walk this pass (no linked CLI session). The 2026-05-19 weekly security audit covered auth/role gates; next weekly is due 2026-05-27 (Tue 16:23 UTC).
- **Performance under load** - nextTurn perf was fixed + smoke-confirmed (3b); no broader profiling this pass.
- **Edge function test coverage** - log-visit (H-1) still has no test; flagged in its todo.

---

## Recommended next moves, in order

1. Xero: the two operator items (H-2 Upstash env vars, M-3 audit-log SQL) - both are one-action and one of them un-503s prod.
2. Xero + Claude: the batched Phase 7 2-client acceptance (M-1) - this is what moves the whole re-arch out of HOPED-FOR and demotes the Realtime YELLOW.
3. The 2026-05-25 playtest (drain target for the 2026-05-19 batch + the re-arch). `tasks/pre-playtest-smoke-2026-05-25.md` did not exist as of the 00:11 UTC health-pulse - create it before the session.
4. Hunt-and-peck: H-1 log-visit mailbomb (pre-paid-signups deadline) + M-2 infection-modal confirm.
5. Confidence Ledger is already drained (548/29, auto-refreshed 2026-05-23); the 00:11 health-pulse drift (532 vs 548) was the pre-refresh number.

## Audit hygiene

- Doc is dated `2026-05-24` (do not overwrite). Prior audit: `tasks/stability-audit-2026-05-19.md`.
- Line numbers re-grepped live this pass (session-attachments upload `:3366`, vehicle poll `:2997`, the 16 suppressions) per the "stale audit line numbers" lesson - but re-verify before quoting in any fix, since the table page churns.
- No code edits in this pass. Fixes go through normal review with the pre-ship 5-question check each.
