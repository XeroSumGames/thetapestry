# Architectural Decisions Log

Append-only record of architectural calls worth remembering. Per `tasks/operating-mode.md` standing behavior #3.

**Format:** date, decision, alternatives considered, why this won, what would change our mind.

**Maintenance:** any chat appends. Never edit a past entry. If a decision is overturned, log a new entry that supersedes the old one and update both with `(see <date>)` cross-references.

Newest first.

---

## 2026-08-02 (correction, same day): cross-session coordination is direct via `mcp__ccd_session_mgmt__send_message`, not manually relayed by Xero

**Correction to the entry immediately below** ("Puffer Fish becomes the review/merge hub"), specifically Alternative B's claim that "these are separate Claude chats that cannot message each other - Xero is the only relay." Xero corrected this directly: the hub tells the other chats what to do and they respond back to the hub - he doesn't carry messages between them. Verified: `mcp__ccd_session_mgmt__send_message` delivers a message directly into another session (found via `list_sessions`, matched by title/cwd - "Tapestry | HP" and "Tapestry | E2E" were both live, running sessions). Used it to deliver the actual hub/spoke rollout message to both lanes in the same turn as writing this correction.

**Does this overturn the graduated-gate conclusion (option C)?** No - kept per below, but the STATED REASON changes. The original doc claimed blanket gating (option B) would fail because it would turn Xero into "a full-time message bus." That's not the real cost anymore - direct session messaging removes the human-relay bottleneck entirely. The reason graduated still wins: hub review of every commit has a real cost independent of how the SHA arrives - reading a diff carefully takes time regardless of transport, and gating everything would slow Hunt & Peck's high-frequency shipping in proportion to volume, not risk. That's the corrected justification for option C; the original entry below is left as-written per this file's own append-only rule (already pushed before the correction landed).

**What would change our mind:** if review-latency-at-volume turns out to be a non-issue in practice (the hub keeps up fine even reviewing everything), blanket gating becomes viable and strictly safer - worth revisiting after a few weeks of real hub-and-spoke usage, not re-litigating from first principles again.

---

## 2026-08-02: Puffer Fish becomes the review/merge hub for SQL/RLS/hot-file work; Hunt & Peck and E2E become spokes

**Decision:** Tapestry's three-lane model moves from "all three chats push to `main` directly" to a hub-and-spoke model, adapted from the pattern Xero ran on TheTableau's Puffer Fish hub. Puffer Fish is the hub - the only chat that reviews, merges, and pushes SQL/RLS/shared-hot-file work to `main`. Hunt & Peck and Playwright/E2E are spokes: each still works in its own worktree/branch (unchanged), still self-ships pure UI/feature/spec-only work exactly as before, but hands the hub a commit SHA for anything SQL/RLS or hub-flagged-hot-file. Live hub claim + retirement rule: `tasks/HUB-LIVE.md`. Open questions/decisions in flight: `tasks/COMMS.md`. Full mechanics: `tasks/lane-protocol.md` "Hub & Spoke model" section.

**Why:** the 2026-08-01 full-codebase audit (3 waves, ~50 fixes total across two sessions) found a large volume of real, live, unreviewed CRITICAL bugs - most strikingly, the same "moderation self-approval" bug shape (a clamp existed on INSERT but not UPDATE, letting content authors self-approve their own pending submissions) recurred independently across 7 unrelated tables over months of unreviewed commits. That's the exact failure class a merge-time review gate exists to catch before it ships, not months later in an audit.

**Alternatives considered:**
- A. Keep all three lanes pushing directly to `main`, rely on the existing pre-commit gate suite (tsc/tests/arch/font/role/em-dash) + periodic audits to catch drift. Zero added latency, but this IS the status quo that let 7 instances of the same bug ship - the pre-commit suite has no concept of "does this RLS policy actually do what its name claims."
- B. Gate EVERY commit from every lane through hub review, no exceptions. Maximum safety, but these are separate Claude chats that cannot message each other - Xero is the only relay. Blanket gating would make him a full-time message bus for routine UI fixes too, adding real friction to Hunt & Peck's day-to-day shipping cadence for no proportional safety gain (a button color change doesn't carry the same risk as an RLS policy).
- C. Graduated gate - hub review required for SQL/RLS/hot-file work only, spokes self-ship everything else (chosen). Captures the real value (every RLS/SQL change gets a second set of eyes before going live) without slowing down the high-frequency, lower-stakes work.

**Why C won:** matches where tonight's actual damage was concentrated (SQL/RLS, not UI) and keeps the relay cost proportional to risk. Puffer Fish already has the deepest SQL/RLS/security context of the three lanes by design, so it's the natural reviewer for that category specifically, not a new burden invented for the hub role.

**What would change our mind:** if the graduated boundary itself turns out to leak (a Hunt & Peck "pure UI" change that actually touches RLS-adjacent logic slips through self-ship and causes a real incident), tighten the hot-file list rather than reverting to blanket gating - the failure mode to watch for is scope-creep in the OTHER direction (the hub becoming a bottleneck that gets bypassed informally, which would be worse than not having the gate at all).

---

## 2026-07-01: lib/weapons.ts is the single source of truth for weapon DATA; lib/xse-schema.ts derives its weapon catalogs from it

**Decision:** `lib/weapons.ts` (the runtime catalog the game actually uses) is the single source of truth for weapon data. `lib/xse-schema.ts`'s `MELEE_WEAPONS` + `RANGED_WEAPONS` are now DERIVED from it (`RUNTIME_*.map(toMeleeWeapon/toRangedWeapon)` via a damage-string + trait parser), instead of being a second hand-maintained copy. To change weapon data, edit `lib/weapons.ts` only.

**Why:** the two catalogs had silently drifted - xse-schema (consumed by the canon snapshot AND the live `LootModal`) was stale: it had "Automatic Rifle" (vs runtime "Assault Rifle"), was missing 5 playable weapons (Crowbar, Katana, Bolt-Action/Pump Rifle, Tranquilizer Gun, Revolver), and carried stale stun stats (Taser 600 / Cattle Prod 200 / trait "Stunned") that the 2026-05-09 stun-canon lock had superseded in the runtime (400 / "Stun"). A player looting via LootModal saw a different, stale list than what they could Ready/equip. Two hand-maintained copies WILL keep drifting; deriving makes drift structurally impossible.

**Alternatives considered:**
- A. Manually re-sync xse-schema to weapons.ts + add a guardrail test asserting they match. Lower refactor risk, but keeps two copies (a dev must still edit both; the test only catches drift post-hoc).
- B. Derive xse-schema from weapons.ts (chosen). One source; the duplicate becomes computed and cannot diverge. Consumers (LootModal, export-canon) unchanged - same import, same shape.

**Why B won:** eliminates the drift CLASS, not just the current instance. LootModal only reads name/enc/rarity (works off the derived list); export-canon needs the canon shape, which the transform produces; weapons.ts has no import of xse-schema, so no cycle.

**Precedence nuance:** `CLAUDE.md` lists `lib/xse-schema.ts` as canon data (#1). That still holds for everything else (skills, complications, paradigms, etc.). For WEAPONS specifically, the curated truth (Xero overrides like the Tranq Gun + the stun-lock) lives in `weapons.ts`, and xse-schema now mirrors it - so canon and runtime agree by construction.

**What would change our mind:** if weapons.ts's runtime shape (`damage: '4+1d6'` string) ever needs richer canon-only fields the parser can't produce, split the source into a shared structured module both derive from. The "Stun Gun" weapon was preserved into weapons.ts during this (was canon-only, never playable); if Xero drops it, it leaves both automatically.

---

## 2026-05-24: Group->Community promotion counts party PCs + group NPCs (combined), not enrolled members

**Decision:** the at-13 promotion threshold (recruit-into-a-Group Phase 3) is keyed off `combined = active campaign PCs (the party) + the group's recruited NPC members`, NOT the group's enrolled `community_members` count. Implemented as `combinedMemberCount(pcCount, npcCount)` / `shouldPromoteToCommunity()` in `lib/community-stage.ts`; the card sources PCs from the campaign roster (`chars.length`) and NPCs from the group's active members (`npcMems.length`).

**Alternatives considered:**
- A. Promote off the card's enrolled-member count (`total`). Simplest, matches the roster exactly.
- B. Promote off combined party PCs + group NPCs (chosen).

**Why B won:** canon (`tasks/tapestry-rules-canon.md:746`) is explicit - "a combined total of 13 or more PCs and NPCs." The recruit flow (`app/stories/[id]/table/page.tsx:3838`) does NOT enroll the roller PC as a member - it inserts only the recruited NPC - so for recruit-founded groups the enrolled count is NPC-only and option A would systematically undercount the party, contradicting canon ("PCs working together are a Group").

**Known simplifications (MVP, revisit if they bite):** (1) `chars` = all active campaign PCs, so if a campaign ever has multiple groups they each count the full party; (2) a large party (>=13 PCs) makes a group promote-ready on its first recruit - canon-consistent (13+ people) but worth noting. The card shows the `(P PCs + N NPCs)` breakdown so the count is never opaque.

**What would change our mind:** if Xero wants promotion to require PCs to be explicitly enrolled in the group, or a per-group PC roster, switch to counting enrolled PC members instead of the whole party.

## 2026-05-24: Phase 7 closed - the Grand Re-Architecture is validated

**Decision:** the re-arch moves from HOPED-FOR to VALIDATED. The Playwright lane closed Gate 0 against the closure criteria (every Phase 7 section passes headless OR is logged manual-with-rationale; the 92-route console/network sweep is green; runs repeat via `npm run test:e2e`). 10 automated spec files are green on prod covering the realtime core: combat-start (A1), tactical token-move (A3, the hardest seam), NPC reveal (C), stockpile deposit/qty/resubscribe (D), whispers + map pins (E), plus seeding, role-gating, character lifecycle.

**Book-closing actions taken (architecture lane):** Risk Register (`debug-handoff.md` Sec 1) - Realtime channels YELLOW -> GREEN-ish (vehicle-B caveat), table page YELLOW -> GREEN-ish (verified-behavior demote, still ~10.5k -> Stage C). Confidence Ledger (Sec 3) - added the re-arch as VALIDATED-BY-AUTOMATED-2-CLIENT-SUITE. Archived `tasks/decomposition-2client-smoke-testplan.md`.

**What is NOT yet validated (honest residual):** Section B vehicle popout broadcasts (manual-only, rides the 2026-05-25 Minnie playtest) and A2/F combat-math + infection modal (the documented manual conditions smoke = the #5 gate). The 2026-05-25 playtest is the final real-world confirmation on top of the automated suite.

**Alternatives considered:** (A) hold everything YELLOW until 100% including B + a live playtest; (B) demote on the automated-suite evidence with explicit residual caveats (chosen).

**Why B won:** the automated 2-client suite is a stronger, repeatable evidence class than a single manual pass and it covers the hardest seams (canvas token-move, dynamic-IN resubscribe). Holding everything YELLOW for the one manual surface (B) would understate validated reality. The caveats keep it honest.

**Impact:** Stage C (client-state layer) is unblocked to BUILD (its Phase-7 gate is met). The formal release call (paid signups, user-facing announcements) remains Xero's and is separate from this validation bookkeeping.

**What would change our mind:** a Section B failure at the 2026-05-25 playtest re-opens the vehicle realtime surface (not the whole re-arch - the other 5 surfaces are independently validated).

---

## 2026-05-24: NPC stress is narrative-only, not a tracked mechanic

**Decision (Xero):** Stress is a PC-only mechanic. For NPCs it exists ONLY narratively (flavor), never as a tracked stat. `campaign_npcs` therefore gets NO `stress` column - the PC-has-stress / NPC-has-none asymmetry is intentional and correct.

**Alternatives considered:**
- A. Add `campaign_npcs.stress` for PC/NPC symmetry (the conditions audit flagged the asymmetry as a possible gap).
- B. Leave NPCs without a stress stat; stress stays PC-only (chosen).

**Why B won:** the audit surfaced "an NPC can never be stressed out" as an inconsistency, but it is by design - the game does not model NPC stress mechanically. Adding the column would invite mechanic creep with no canon backing.

**Impact:** Stage B conditions API `addStress` stays PC-only (no NPC branch); no migration. Documented in `tasks/stage-b-conditions-design.md`.

**What would change our mind:** if canon later introduces an NPC stress mechanic, it becomes a one-column additive migration.

---

## 2026-05-23: Architecture path beyond the re-arch - sequence + Stage C state-layer call

**Decision:** the re-arch built the foundation (seams); it stops one layer short (page.tsx still 10.5k - orchestration has nowhere to live but the route). The path to "structurally ready for the world / paid launch" (Xero's destination, confirmed by "start planning it all") is `tasks/architecture-path.md`, sequenced by dependency + risk, NOT by leverage:
- **Gate 0:** close Phase 7 (validate the seams across 2 clients) - now automatable via the Playwright suite (no longer calendar-blocked on the Minnie playtest, because the suite can seed the vehicle/community fixtures into the Arena).
- **Stage A** (parallel, now): infra-as-code (publication/RLS/triggers/orphan-tables into CI-applied migrations) + typed payloads. Cheap, safe, kills the silent-config + `561 as any` bug classes.
- **Stage B:** conditions subsystem (one model/lifecycle/render/reset for infection+lasting-wound+stress+MW).
- **Stage C** (the big one): client-state layer = **TanStack Query for server-state + Zustand slices for orchestration state** (NOT either/or - they solve different problems). Design doc -> PILOT on one non-combat god-component (MapView/vehicle) -> propagate -> **table page LAST**.
- **Stage D** (parallel throughout): the Playwright test pyramid - the gate that lets B/C move behavior-preserving + validated-per-slice.

**Risk-posture flip (load-bearing):** the re-arch's "break-things-OK, no playtest until done" is OVER - playtesters are live. New posture for everything above: behavior-preserving, one `git revert` away, ratchet-locked, validated per slice, table page last.

**Alternatives considered:**
- A. Stop at the seams (re-arch "done"); fix bugs in place. Leaves the god-components god-sized.
- B. Single state tool (Query OR Zustand, per the arch review's framing).
- C. Query + Zustand split, sequenced behind Phase 7 + a pilot (chosen).

**Why C won:** A is what `018c423` ("re-arch done") could be misread as - but the review is explicit it is "the first move, not the last." B undersells it: the god-components conflate server-state (wants a cache + invalidation) and orchestration state (wants a store) - one tool is wrong for half the problem. C splits cleanly along that seam and de-risks via a pilot before touching combat code.

**What would change our mind:** if the Stage C pilot shows orchestration state is thin enough that Query alone gets a component under the LOC ceiling, drop Zustand (stay single-tool). If realtime-as-cache-invalidation over-fetches on the combat hot path, keep targeted broadcasts there and use Query only for cold reads. This call is the one flagged for a human architect's review before the bulk Stage-C propagation (C3).

---

## 2026-05-22..24: Grand Re-Architecture - the locked structural calls

**Decision:** the whole-platform re-arch (Xero mandate: every god-component onto the ideal layered architecture before the next playtest) locked four structural calls, now load-bearing across the codebase:

- **Layered seam + ratchet fitness functions.** All DB access goes through `lib/data/*` repos; all realtime through `lib/realtime/*`. Enforced by monotonic ratchets in `scripts/check-arch.mjs` (baseline `tasks/_baselines/arch.json`): `.from`-outside-`lib/data` (1039), `.channel`-outside-`lib/realtime` (22), prod-console (0), + per-file LOC ceilings. `--save` only ratchets DOWN. Runs on pre-commit + CI. dependency-cruiser (`.dependency-cruiser.cjs`) locks no-circular / lib-no-upward / components-no-route-internals / no-test-imports as errors.
- **`trace()` / console-seam.** `trace(label, data)` in `lib/playtest-recorder` is the single sanctioned console home (pushes a recorder-buffer event; echoes to console ONLY in `NODE_ENV=development`). All bare `console.*` stripped from prod (115 -> 0); error/SILENT-RLS surfacing kept as `console.error` (prod-visible + recorder-captured). check-arch excludes `lib/playtest-recorder` for the console metric (analogous to `lib/data` for `.from`).
- **Realtime primitives.** Three composable primitives replace hand-rolled channels: `useCampaignChannel` (campaign-scoped broadcast + `postgres[]` subscriptions, re-subscribes on `[campaignId]` only, handlers fresh via ref), `usePostgresSubscription` (global/dynamic single-table watch, re-subscribes on `[channelName]`), `broadcastOnce` (fire-and-forget typed send with `holdMs`). Event payloads typed in `lib/realtime/events.ts` so tsc verifies sends. The ref-freshness pattern is the deliberate fix for the stale-closure/resubscribe bug class - the exhaustive-deps suppressions in these hooks are by-design, not latent bugs.

**Alternatives considered:**
- A. Keep god-components as-is, fix bugs in place. (status quo)
- B. Rewrite to a state-management lib (Redux/Zustand) + service layer.
- C. Thin seams + fitness-function ratchets + incremental per-component migration (chosen).

**Why C won:** A loses - the 12.5k-line table page was actively producing stale-closure combat bugs (CMod drop, infection-modal miss) that a seam eliminates structurally. B is a multi-month rewrite with its own risk surface and no incremental safety net. C gets the architecture wins (testable seams, observable realtime, enforced monotonic improvement) while staying behavior-preserving and shippable commit-by-commit; the ratchets make backsliding impossible without an explicit `--force`.

**What would change our mind:** if the ratchets start blocking legitimate work more than they catch regressions, relax the LOC ceilings (the seam-leakage + console metrics earn their keep regardless). If a realtime surface fails the Phase 7 2-client acceptance in a way the seam caused, re-examine the primitive (but TacticalMap - the hardest - passed on prod).

**Status (2026-05-24):** Phase 5 (all 6 god-components) + Phase 6 (console) COMPLETE. Phase 7 acceptance PARTIAL (TacticalMap token-move + combat-start + presence smoked on prod; vehicle/communities/stockpile/MapView owed). The whole re-arch is HOPED-FOR until the batched 2-client acceptance + the 2026-05-25 playtest. See `tasks/stability-audit-2026-05-24.md` (Realtime channels bumped GREEN-ish -> YELLOW for exactly this reason).

---

## 2026-05-20: Soft-delete policy rulings (Y11) + invite-code gate + Pro/lawyer status

**Decision:** Xero ruled on all five Y11 soft-delete questions + the invite-code gate + deferred two infra decisions.

- **Y11-a `character_states`: PRESERVE.** Soft-delete via `archived_at` instead of cascade-delete on character delete. Revive flow can resurrect last-known state.
- **Y11-b campaign delete: double-confirm YES.** "Type the campaign name to confirm" gate on the Delete Campaign button.
- **Y11-c generalize decision tree: YES, scoped to communities.** `community with 0 active members = hard-delete OK; with members = soft-leave only`. Mirrors the modules archive-vs-delete pattern. NOT a blanket every-table sweep - communities specifically.
- **Y11-d `campaign_snapshots`: SOFT.** `archived_at` flag + reaper hard-deletes after 30 days.
- **Y11-e `roll_log` session clear: ARCHIVE.** Add `session_id`, drop the session-start DELETE, filter feed by session_id, prior sessions browsable read-only. No roll data lost.
- **Invite-code gate: HYBRID.** Optional code field on signup (empty = sign up normally; filled = attribute + mark used) + a feature flag to make it REQUIRED if launch velocity needs capping.
- **Supabase Pro + PITR: DEFERRED indefinitely.** Xero decides when needed. Until then the audit-log spec (AL1-AL4) is the recovery substitute.
- **Lawyer for TOS/Privacy: PENDING.** Xero asking his retainer lawyer for a specialist recommendation.

**Alternatives considered:** each question had a binary or scoped set laid out in `tasks/ops-soft-delete-stance-2026-05-19.md` + the chat exchange 2026-05-20.

**Why these won:** Xero's calls as product owner. The throughline: preserve user-recoverable state (character_states, snapshots, roll history) rather than hard-delete, because the platform-stability mandate values "nothing is silently lost" over "clean slate." Invite-hybrid keeps zero-friction signup while retaining the velocity kill-switch.

**What would change our mind:** if the soft-delete tables bloat storage materially, add reaper jobs (already planned for snapshots). If invite attribution proves unused, drop the optional field.

**Execution:** all 7 ship-items queued for hunt-and-peck in `tasks/todo.md`. The 3 schema+behavior changes (Y11-a preserve, Y11-e session-archive, invite hybrid) warrant their own spec docs - puffer-fish writes those next.

---

## 2026-05-20: Platform stability is the entire mandate; date-anchored launch planning is paused

**Decision:** the puffer-fish lane's mandate is making the platform as stable and optimized as possible. No date pressure, no launch coordination, no press timing. The 2026-06-15 launch plan composed earlier today is SUPERSEDED; active plan is `tasks/puffer-fish-platform-plan.md`.

**Alternatives considered:**
- A. Optimize around 2026-06-15 limited-public launch (reviewers / YouTubers / bloggers).
- B. Optimize around 2026-09-01 full launch with 2026-06-15 as start of press drive.
- C. Stop date-anchoring entirely; the platform-stability work is the whole job, multi-chat, no calendar pressure.

**Why C won:** Xero is solo with ~10 playtesters. The riskiest decomposition extractions WANT a small, tolerant verification audience - exactly what the playtester group is. Doing the heavy lifting now means the press drive (when it comes) sees a stable platform, not one mid-remodel. Date-anchoring before the platform is stable inverts the priority and concentrates regression risk into the launch window.

**What would change our mind:** Xero re-anchors a date (acquires partner, gets funding, commits press, etc.). Until that re-anchor, the platform plan is the plan.

---

## 2026-05-20: Two-chat lane split (puffer-fish + hunt-and-peck)

**Decision:** Tapestry runs across two Claude chats by deliberate split. Puffer-fish (this lane) owns architecture / risk / audit / observability / scaffolding. Hunt-and-peck owns tactical bug fixes, feature ships, narrative tweaks, modal migrations. Documented in `tasks/operating-mode.md` "Multi-chat lanes" section.

**Alternatives considered:**
- A. Three lanes (tactical / infrastructure / organize-thoughts) as the earlier MEMORY.md entry described.
- B. Single chat with role-switching via slash conventions (`/architect`, `/qa`, etc.).
- C. Two-lane split: puffer-fish + hunt-and-peck.

**Why C won:** organize-thoughts proved redundant with infrastructure work; the three-lane model had bandwidth waste. Single-chat role-switching collapses if a single chat tries to ship both audits and bug fixes - context churn makes both worse. Two lanes maps cleanly: doc-first work in one chat, code-first work in the other; coordination via shared substrate (commits, lessons, todo, debug-handoff).

**What would change our mind:** a third concern emerges that neither lane fits (e.g., dedicated security work as a third lane if security audits become a routine recurring practice).

---

## 2026-05-19: `/stability-audit` slash convention + dated audit doc pattern

**Decision:** stability audits are a periodic-review category in `tasks/operating-mode.md`, invoked via `/stability-audit`. Output: `tasks/stability-audit-YYYY-MM-DD.md` (dated, do not overwrite). Pattern: read existing evidence -> run live gates -> footgun grep -> Confidence-Ledger triage -> sorted findings (BLOCKER / HIGH / MEDIUM / LOW).

**Alternatives considered:**
- A. Ad-hoc audits whenever fuzz feels right; no naming convention.
- B. Single overwriting `tasks/stability-audit.md` that gets refreshed each pass.
- C. Dated immutable files (`stability-audit-YYYY-MM-DD.md`) following the pattern from health-pulse logs.

**Why C won:** post-mortem value of an audit comes from comparing this audit to last audit. Overwriting destroys that. Ad-hoc audits never get run consistently because there's no shape to repeat. The dated-file convention plus the documented 5-step pattern makes each audit re-runnable.

**What would change our mind:** if dated files proliferate past ~10 and become hard to navigate, move to `tasks/stability-audits/<date>.md` subdirectory.

---

## 2026-05-19: Confidence-Ledger drift threshold automated via refresh-ledger.mjs

**Decision:** the Confidence Ledger TESTED line in `tasks/debug-handoff.md` Sec 3 gets drained via `node scripts/refresh-ledger.mjs`. Fingerprint-based drift detection (test count + file count + per-file breakdown). Duration + last-refresh date render but excluded from the equality check.

**Alternatives considered:**
- A. Hand-edit the ledger after each test addition. (Current pre-2026-05-19 state.)
- B. Auto-run in pre-commit hook (forces every commit to re-run vitest + auto-stage the change).
- C. Standalone script + manual invocation, called when health-pulse flags drift.

**Why C won:** A drifts silently between drains - the health-pulse flagged it 3 times in 4 days before draining. B forces vitest on every commit (slow + auto-stage is sketchy). C makes the drain a single command without changing commit semantics; the health-pulse routine is the natural drift detector.

**What would change our mind:** if drift recurs after the script lands, escalate to B (pre-commit auto-stage).

---

## 2026-05-19: Em-dash guardrail enforced at pre-commit, full sweep across docs

**Decision:** `scripts/check-em-dashes.mjs` is a pre-commit guardrail. Em-dashes (U+2014) and en-dashes (U+2013) are banned in all `.ts/.tsx/.js/.mjs/.sql/.md` files staged for commit. Three exempt paths (`lib/roll-helpers.ts` legacy strip detector, its test, and the guardrail script itself). Bulk swept 2533 chars across 247 files via `b260397` + 4566 chars across 162 files via `0cedda7`.

**Alternatives considered:**
- A. Trust the chat to remember the rule. (Pre-2026-05-19 state.)
- B. Guardrail blocks at commit; sweep historical violations as they're touched.
- C. Guardrail blocks at commit; bulk sweep all historical violations immediately.

**Why C won:** the rule was repeatedly violated under A; B leaves residue that pollutes every audit grep. C clears the codebase to a known-good state + the guardrail prevents regression.

**What would change our mind:** if a legitimate use of em-dash arises (e.g., a Unicode-aware feature), revisit the exempt list rather than removing the rule.

---

## 2026-05-19: Supabase CLI cache `supabase/.temp/` removed from git tracking

**Decision:** `supabase/.temp/` added to `.gitignore` and the 9 cached files (`cli-latest`, `pooler-url`, `linked-project.json`, etc.) removed from tracking. Local CLI continues to write the cache; git no longer tracks the changes.

**Alternatives considered:**
- A. Keep tracking; stash-rebase-pop on every rebase.
- B. Add to gitignore but keep historical commits intact.
- C. Add to gitignore + scrub git history of the cached files.

**Why B won:** the cli-latest blocker hit 3 times in a single day under A. B fixes going-forward at zero risk. C would require a force-push to main (bright line) and the historical exposure is low-severity (project ref + pooler URL, no password).

**What would change our mind:** if the historical exposure becomes a compliance issue, escalate to C with explicit Xero approval.

---

## 2026-05-17: Sentry PII scrub + 0.1 traces sample rate

**Decision:** `Sentry.init` config sets `sendDefaultPii: false` across all three configs (client / server / edge); `beforeSend` scrubs `code`/`token`/`access_token`/`refresh_token` URL params + `[Filtered]`s Authorization + Cookie headers; `tracesSampleRate: 0.1` on all three; exceptions stay at 1.0.

**Alternatives considered:**
- A. Default Sentry config (PII enabled, traces 1.0).
- B. Scrub PII, traces 1.0 (full trace capture).
- C. Scrub PII, traces 0.1 (sample 10% of transactions).

**Why C won:** A leaks PII to a third party (`tasks/operating-mode.md` bright line). B is correct on PII but generates 10x the trace volume = larger Sentry bill + harder signal-vs-noise. C is the sweet spot for alpha-tier traffic.

**What would change our mind:** at paid-signup scale, re-evaluate sample rate vs Sentry plan tier.

---

## 2026-05-17: User-delete edge function derives caller from JWT, not request body

**Decision:** `delete-user` edge function calls `supabase.auth.getUser(token)` against the Authorization header. The legacy `caller_id` body field is still accepted (backward compat) but ignored.

**Alternatives considered:**
- A. Trust the body's `caller_id` (legacy).
- B. Derive from JWT; reject if missing.
- C. Derive from JWT; ignore body (backward compat).

**Why C won:** A is impersonation-exploitable (a spoofed body claims to be a Thriver and deletes anyone). B breaks any in-flight client still sending the old shape. C closes the exploit while preserving compat.

**What would change our mind:** sunsetting the legacy body field is a separate decision once no clients send it.

---

## 2026-05-15: `OUTCOME` const + `RollOutcome` union as type-safety band-aid for the overloaded `outcome` column

**Decision:** `lib/roll-outcomes.ts` exports `OUTCOME` const + `RollOutcome` discriminated union + `RollResult` subtype. 49 insert sites migrated to `outcome: OUTCOME.X`. `getOutcome()` return narrowed.

**Alternatives considered:**
- A. Leave as-is (string literals everywhere; typo-prone).
- B. Split the `outcome` column into `outcome_kind` + `outcome_value` (the right fix).
- C. Type-only band-aid via union (this).

**Why C won:** B is a 2-day schema migration + every consumer change. C is a 1-day type-only refactor that catches typos at compile time + surfaces dead-code paths (caught one in the sprint handler). Buys time for B.

**What would change our mind:** if event-type proliferation continues, B becomes mandatory. Tracked in Tech Debt Ledger.

---

## 2026-05-13: `lib/safe-upload.ts` helper as canonical pattern for all storage uploads

**Decision:** all storage uploads go through `prepareUpload(bucket, file)` which returns `{ ok, filename, contentType }`. Sanitizes filename (path-traversal, accents, length), enforces per-bucket size cap, maps extension to whitelisted contentType. SVG excluded from all buckets.

**Alternatives considered:**
- A. Inline sanitization at each upload site.
- B. Centralized helper with bucket-aware rules (this).
- C. Server-side validation in an edge function.

**Why B won:** A produces drift between sites (proven by the stability audit's H-1 finding - 7 sites all sanitizing differently or not at all). C is the most defensible long-term but requires an edge function + routing every upload through it = more infrastructure. B is the middle path that gets 90% of the value at 10% of the cost.

**What would change our mind:** if RLS bypass becomes a real concern, escalate to C.

---

## How to add an entry

Append to the top of section 2 (above the most recent entry). Use this template:

```
## YYYY-MM-DD: <one-line decision summary>

**Decision:** <2-3 sentences naming what we picked + key constraint>.

**Alternatives considered:**
- A. <option>
- B. <option>
- C. <chosen option>

**Why <chosen> won:** <2-3 sentences of reasoning>.

**What would change our mind:** <1 sentence trigger for re-opening>.
```

If a past decision is overturned, append a new entry referencing the old one + edit the old one to add `**SUPERSEDED YYYY-MM-DD** (see entry above)` at the top.
