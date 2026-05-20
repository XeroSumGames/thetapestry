# Puffer-Fish Platform Plan

**Mandate (Xero, 2026-05-20):** make the platform as stable and optimized as possible. Nothing else. No date pressure, no launch coordination, no press timing - just the work of getting the codebase to where the only thing left to argue about is which feature ships next.

**Mode:** continuous improvement across multiple chats. This doc is the source-of-truth that any chat (puffer-fish or hunt-and-peck) can open, read, and pick up from. Substrate updates after every shipped step keep it current.

**Status:** ACTIVE. Supersedes the date-anchored framing in `tasks/launch-plan-2026-06-15.md` (which has been archived; see that file's status log for context).

---

## 1. What "stable and optimized" means (the measurable axes)

We can't ship "the platform is perfect" - too fuzzy. So we define stability + optimization along six measurable axes. Every piece of work in this plan rolls up to one of them.

1. **Bug-investigation cost.** When something breaks, how fast can you find + fix it?
   - Metrics: largest-file LOC, `as any` count, missing-type density, comment coverage, observability tags.
2. **Multi-client reliability.** When two clients are on the same campaign, do they stay in sync?
   - Metrics: realtime channel count, retry surface, manual-repro-only failure modes, broadcast event types.
3. **Performance.** Does the platform feel fast under load?
   - Metrics: render cost on table page, query count per session start, polling waste, p95 latency on session start.
4. **Recovery posture.** When something goes wrong, can we get back?
   - Metrics: PITR availability, RTO, audit-log coverage, incident-response runbooks.
5. **Security posture.** Where can bad actors hurt us?
   - Metrics: rate-limited routes count, CSP coverage, SRI coverage, RLS gap surface, secret rotation playbook existence.
6. **Test coverage.** Will we catch regressions before users do?
   - Metrics: unit test count, integration test count, E2E test count, % of bug fixes that ship a test.

A phase is "done" when its target axis crosses a defined threshold. No phase is open-ended.

---

## 2. The work, grouped by axis

Inventory. Not yet sequenced - that's section 4.

### Axis 1: Bug-investigation cost

- **A1.1 Table page decomposition.** `app/stories/[id]/table/page.tsx` is 13,192 lines. Full plan at `tasks/page-tsx-decomposition-plan.md` - 18 steps, 6 phases. Target: page becomes a thin orchestrator (~300 lines) composing hooks + sub-components.
- **A1.2 `damage_json` typed payload.** Two `as any` casts in load-bearing combat code (per Tech Debt Ledger). Define `DamagePayload` interface, type the writes, type the reads.
- **A1.3 `outcome` column overload split.** Single column stores roll results / event tags / grapple results. Tech Debt Ledger calls it a 2-day job today, 4-day job later. Right fix: split into `outcome_kind` enum + `outcome_value`, or move event-only rows to `roll_log_events`.
- **A1.4 `compactRollSummary` regex parsing deprecation.** Brittle label-string parser at `lib/roll-helpers.ts`. Right fix: add structured columns (`event_type`, `target_name`, etc.) to `roll_log` and stop deriving structure from prose.
- **A1.5 God-component breakdown of the next-biggest files.** `components/TacticalMap.tsx` (4,300 lines), `components/CampaignCommunity.tsx` (3,158), `components/NpcRoster.tsx` (2,269), `app/vehicle/page.tsx` (2,137), `components/MapView.tsx` (2,041). Each gets its own decomposition spec after A1.1 is in flight (the pattern transfers).
- **A1.6 Observability tags on every load-bearing handler.** Sentry traces already exist; verify every realtime handler + every DB write site carries enough tags to triage from a single trace.

### Axis 2: Multi-client reliability

- **A2.1 Realtime channel audit.** 10 files use `.channel(`. Document channel ownership, resubscription policy, payload shapes, and the manual-repro failure modes. Output: `tasks/spec-realtime-channels.md`.
- **A2.2 Stale-closure landmine inventory.** The decomposition plan flags 2 documented stale-closure bugs (L1498-L1500 lasting_damage, L1530-L1537 infection). Sweep for similar patterns in the realtime handlers + any handler that reads state from a `[]`-deps useEffect.
- **A2.3 Cross-client test infrastructure.** Today every multi-client bug is manual-repro. Identify the minimum infra to drive two clients programmatically (Playwright? Cypress? bespoke two-tab harness?). Output: spec + ADR.
- **A2.4 Re-entry guard audit.** `nextTurnInFlightRef`, `consumeActionInFlightRef`, `rollExecutedRef`. Verify each guard's scope + reset condition. Output: inline comments + tests if testable.

### Axis 3: Performance

- **A3.1 Table page render profile.** Production-mode profile of one full session round-trip. Identify any render cascades worth memoizing. Output: profile capture + recommendations.
- **A3.2 Query-count audit per session start.** Today `loadEntries` + `loadInitiative` + `loadRevealedNpcs` + `loadPlayerNpcCommunityMap` + `ensureCharacterStates` all fire on mount. Count queries; look for `.in()` opportunities.
- **A3.3 Realtime subscription cost at scale.** 10 files x N campaigns x N users = how many active subscriptions per Supabase instance? Map theoretical scale + identify scoping opportunities.
- **A3.4 Vehicle 3s polling (verified necessary).** Documented in `tasks/todo.md` M-5 closure. Keep; revisit only if a cleaner cross-tab sync primitive lands.

### Axis 4: Recovery posture

- **A4.1 Supabase Pro + PITR.** Bright-line Xero decision. Without PITR there is no row-level recovery. Plan: decide + execute when ready. Until then, Scenario A/B/C in the backup playbook collapse to "we lose data."
- **A4.2 Backup drill execution.** `tasks/ops-backup-playbook-2026-05-19.md` has the drill plan; needs live run against a real Pro project. Output: RTO measured, gotchas documented.
- **A4.3 Audit log of destructive ops.** Today there is no `deleted_records` table. Recovery from accidental delete relies entirely on PITR. If A4.1 stays deferred, A4.3 becomes higher priority.
- **A4.4 Incident response runbook.** "Site is down" / "DB is corrupted" / "key leaked" scenarios. Output: `tasks/ops-incident-response.md`.
- **A4.5 Secret rotation playbook.** Today rotating a Turnstile / Stripe / Supabase key is undocumented. Output: per-secret runbook with copy-paste commands.

### Axis 5: Security posture

- **A5.1 CSP + SRI on third-party scripts.** Turnstile + Sentry script tags. Currently unverified. Output: audit + headers config.
- **A5.2 Storage bucket policy audit.** 5 buckets (session-attachments, note-attachments, pin-attachments, war-stories, module-covers). Verify each has dashboard-level size + MIME + public-read policies matching the `lib/safe-upload.ts` whitelist. Output: dashboard verification + audit doc.
- **A5.3 RLS gap sweep.** Most tables have RLS; some don't. Output: per-table RLS status table + recommended fills.
- **A5.4 KV-backed rate-limiter on verify-turnstile (L-3).** Xero approved. Hunt-and-peck executes. Puffer-fish writes the spec if needed.
- **A5.5 Rate-limit coverage audit.** Verify-turnstile has it; what about `/api/health`? Other future routes? Output: per-route audit.

### Axis 6: Test coverage

- **A6.1 Unit-test ledger health.** 419 tests across 23 files today. `scripts/refresh-ledger.mjs` drains drift. Habit: every bug fix gets a test.
- **A6.2 Component test infrastructure.** Today zero component tests. Pick a framework (React Testing Library? bespoke Playwright component?). Spec the first 3 components to cover. Output: ADR + first 3 tests.
- **A6.3 Integration test against a real DB.** Today every RLS/cascade behavior tests in production. Spec a Supabase-local-Docker integration test harness. Output: ADR.
- **A6.4 E2E test for the happy-path session.** Sign up -> create campaign -> add character -> run a roll -> end session. Spec the harness + first happy path. Output: ADR + first E2E.

---

## 3. Multi-chat handoff conventions

This plan must survive multiple chats picking up + putting down work. The conventions:

### How any chat enters the work

1. **`sh scripts/start-session.sh`** at session start. (Created 2026-05-20 to make multi-chat collision visible.)
2. **Read this plan.** Open `tasks/puffer-fish-platform-plan.md`. The "Sequencing" section (next) names what's next.
3. **Read the resume pointer** at the bottom of this file. It names the EXACT next action + the chat that last touched it.
4. **Read `tasks/debug-handoff.md`** Sec 1 (Risk Register) + Sec 3 (Confidence Ledger). Risk Register tells you what's currently load-bearing; Ledger tells you what's verified.
5. **Read `tasks/todo.md` CURRENT OPEN.** Skim the top section. If something's `[~]` PARTIAL, it's mid-flight.

### How any chat updates the plan after shipping

After a step ships:
1. **Update this file.** Mark the item `[x]` in section 2 with the commit hash + date. If the step was partial, mark `[~]` with what landed + what's left.
2. **Update the resume pointer.** Move it to the NEXT action.
3. **Update `tasks/todo.md`** CURRENT OPEN if the item appeared there. Cross-reference the commit.
4. **Update `tasks/debug-handoff.md`** if the Risk Register or Confidence Ledger shifted.
5. **Update `tasks/lessons.md`** if the work surfaced a reusable pattern.
6. **Run `node scripts/refresh-ledger.mjs`** if tests were added.

### How lanes split

- **Puffer-fish chat (this one) owns:** specs, audits, risk-priority sequencing, plan maintenance, ops docs, ADRs, schema reverse-engineering for canonical DDL, security audits, observability gap-finding.
- **Hunt-and-peck chat owns:** code execution. Decomposition extractions, type-tightening migrations, modal unification, narrative polish, bug fixes from playtest.

If puffer-fish writes a spec, hunt-and-peck executes it. If hunt-and-peck hits an architectural fork, puffer-fish writes the decision doc. Both chats see the same substrate.

### Gate mechanisms

A step is "done" when:
- Pre-commit hook passes (tsc + font-sizes + role-literals + em-dashes + preview-sync + tests).
- For audit-only / spec-only steps: the output doc lands in `tasks/` with a real maintenance section.
- For code steps: a playtest verification passes if the step touches load-bearing surfaces (Risk Register YELLOW items).
- Per-step manual smoke test passes (defined in the plan spec for that step).

If a step shipped + verified + the substrate is updated, it's done. Don't re-litigate.

---

## 4. Sequencing (by dependency, not calendar)

Phases ordered so each unblocks the next. Within a phase, items can run in parallel between the two lanes.

### Phase P0: Foundations (in flight)

Already largely shipped today (2026-05-20). Closes the substrate gaps the rest of the work depends on.

- [x] `scripts/start-session.sh` (multi-chat collision visibility) - `aa3840c`
- [x] `scripts/refresh-ledger.mjs` (Confidence-Ledger drain) - `0964b46`
- [x] Risk Register triage 2026-05-20 - `38541ce`
- [x] Two-chat lane split in operating-mode - `ef37580`
- [x] Page-tsx decomposition plan + status update - `a0460d4`
- [x] Y11 / Y12 / R4 / R10 ops docs - shipped earlier today
- [x] **`tasks/decisions.md` seed.** SHIPPED 2026-05-20 (this commit). Inaugural 10 entries documenting architectural calls made over 2026-05-13 through 2026-05-20 (platform-stability mandate, two-chat lane split, `/stability-audit` slash, refresh-ledger script, em-dash guardrail, supabase/.temp/ untrack, Sentry PII + traces, delete-user JWT-derived caller, RollOutcome band-aid, safe-upload helper). Format template at end of file for future appends.

### Phase P1: Table-page decomposition starts (front-loaded)

Foundation for Axis 1 (bug-investigation cost). The page is the throat of the app + the largest file by 3x. The decomposition plan unblocks everything that depends on the page being readable.

Lane: hunt-and-peck executes; puffer-fish updates Risk Register + plan after each phase ships.

- [ ] Phase 3.0 Prep (types, useRecorderToggle, broadcasts helper) - useHeaderMenus already shipped `2426e5b`
- [ ] Phase 3.1 Leaf modal extractions (GmTools, SpecialChecks, Recruit, Trade)
- [ ] Phase 3.2 Render extractions (Header, FeedColumn, GmSidebar)
- [ ] Phase 3.3 Tactical + Initiative
- [ ] Phase 3.4 Roll pipeline (highest risk; needs playtest between each chunk)
- [ ] Phase 3.5 Auth + CampaignState + TableRealtime
- [ ] Phase 3.6 Compose + polish

Gate per phase: playtest verification of the touched surface before the next phase starts.

### Phase P2: Tech debt cleanup (parallel to P1 where possible)

Lane: puffer-fish writes specs, hunt-and-peck executes.

- [~] A1.2 `DamagePayload` interface (spec + migration). **SPEC SHIPPED 2026-05-20:** [tasks/spec-damage-json-payload.md](spec-damage-json-payload.md). Discriminated union of 12+ payload variants, `kind` discriminator at write time, 5-phase migration plan (D1-D5) over 9-10 hunt-and-peck sessions, 4 risks logged. D3h (AttackDamage) gates on Phase 3.4 of the decomposition plan. Hunt-and-peck owns execution.
- [~] A1.4 `compactRollSummary` regex deprecation. **SPEC SHIPPED 2026-05-20:** [tasks/spec-compactrollsummary-regex-deprecation.md](spec-compactrollsummary-regex-deprecation.md). Replaces ~30 regex patterns with 5 structured columns (event_type, event_subtype, target_name, skill_name, weapon_name) on roll_log. 5-phase migration C1-C5 over 8-9 hunt-and-peck sessions. C3-attack (last writer migration) gates on Phase 3.4 of the decomposition plan + couples with DamagePayload D3h - all three benefit from same-session execution.
- [~] A1.3 `outcome` column split. **SPEC SHIPPED 2026-05-20:** [tasks/spec-outcome-column-split.md](spec-outcome-column-split.md). Reframed: the right fix is TYPE-ONLY kind discrimination (sub-unions + `outcomeKind()` helper + type guards), NOT schema migration. Schema migration (Option B) deferred unless DB-integrity bug surfaces. 3 phases (O1-O3) over 2.5-4 hunt-and-peck sessions. OC-R1 risk: SQL audit before Phase O2 to surface any historical outcomes not in the OUTCOME union.
- [x] **A2.4 Re-entry guard audit.** SHIPPED 2026-05-20: [tasks/audit-reentry-guards.md](audit-reentry-guards.md). 19 guards inventoried across 6 categories (A: in-flight locks, B: sequence guards, C: dedup Sets, D: pending-work queues, E: phase flags, F: closure-state mirrors). Reset-condition risk assessment: 6 healthy, 8 "watch" (correct but scattered comments), 0 currently risky. 5 recommended follow-up actions all low-medium priority - no launch-blockers. Pairs with the decomposition plan's R1+R2+R3 risks (informs hook-extraction co-location).
- [x] **A2.2 Stale-closure landmine sweep.** SHIPPED 2026-05-20: [tasks/audit-stale-closure-landmines.md](audit-stale-closure-landmines.md). 30 realtime handlers swept; 2 documented past fixes confirmed safe (infection_check_request L1534, lasting_damage_check_request L1499); 1 NEW landmine found: `pc_mortal_wound` handler at L1487-L1493 reads raw `userId` + `gmLike` instead of `userIdRef.current` + `gmLikeRef.current`. Same bug class as the L1534 fix. Hunt-and-peck follow-up: one-line fix + lift the L1534 inline comment as rationale. Section 4 documents the re-runnable sweep methodology for future audits.

### Phase P3: Recovery posture

Gated on Xero approving Supabase Pro + PITR. Until then, work the audit-log alternative.

- [ ] A4.1 Pro + PITR upgrade (Xero approval)
- [ ] A4.2 Backup drill execution (depends on P3.1)
- [~] **A4.3 Audit log of destructive ops.** SPEC SHIPPED 2026-05-20: [tasks/spec-audit-log-destructive-ops.md](spec-audit-log-destructive-ops.md). NEW table `audit_log` with append-only DELETE/BULK_DELETE/CRITICAL_UPDATE/CASCADE_DELETE rows. Trigger-driven on 18 hard-delete tables + app-level for edge functions + bulk ops. RLS scoped to Thriver (all) + self (own actor rows). 365-day retention. 6-phase migration AL1-AL6 over ~5 hunt-and-peck sessions. Without PITR, this IS the recovery mechanism. 5 risks logged (CASCADE write-amplification, hot-table overhead, NULL auth.uid in service-role contexts, recovery flow has no UI, audit log itself can be DELETEd by Thrivers - mitigated via explicit `DELETE USING (false)` RLS).
- [x] **A4.4 Incident response runbook.** SHIPPED 2026-05-20: [tasks/ops-incident-response-2026-05-20.md](ops-incident-response-2026-05-20.md). 13 sections: when to open, pre-incident state inventory, P0-P3 severity classification, 4 P0/P1 playbooks (site down Vercel-side, DB unreachable, secret leaked, realtime desync + data corruption), env-var inventory table, pre-written comm templates, post-incident review pattern, what's NOT covered, maintenance.
- [x] **A4.5 Secret rotation playbook.** SHIPPED 2026-05-20: [tasks/ops-secret-rotation-2026-05-20.md](ops-secret-rotation-2026-05-20.md). Per-service rotation procedures for Supabase service-role + anon, Turnstile, Sentry DSN, Vercel deploy tokens, Stripe (placeholder). 8 sections: when to rotate (emergency/proactive/scheduled), pre-rotation checklist, per-service procedures, post-rotation verification, scheduled cadence table, audit log format (first-4-chars only, never full keys), what's NOT covered, maintenance.

### Phase P4: Security hardening

- [ ] A5.4 KV rate-limiter (Xero approved; hunt-and-peck)
- [ ] A5.1 CSP + SRI audit + headers config
- [ ] A5.2 Storage bucket policy audit
- [ ] A5.3 RLS gap sweep
- [ ] A5.5 Rate-limit coverage audit (next API routes added)

### Phase P5: Multi-client reliability

Most-leveraged after P1 settles, since extracted realtime hook is cleaner to audit.

- [ ] A2.1 Realtime channel audit + spec
- [ ] A2.3 Cross-client test infrastructure (ADR + first harness)

### Phase P6: Performance

- [ ] A3.1 Table-page render profile (after P1 settles - the decomposition itself changes the render shape)
- [ ] A3.2 Query-count audit per session start
- [ ] A3.3 Realtime subscription scale model

### Phase P7: Test coverage ladder

- [ ] A6.2 Component test infrastructure ADR + first 3 tests
- [ ] A6.3 Integration test against real DB ADR
- [ ] A6.4 E2E happy-path test ADR + first test

### Phase P8: God-component breakdown (after P1 settles)

- [ ] A1.5 `components/TacticalMap.tsx` decomposition spec
- [ ] A1.5 `components/CampaignCommunity.tsx` decomposition spec
- [ ] A1.5 `components/NpcRoster.tsx` decomposition spec
- [ ] A1.5 `app/vehicle/page.tsx` decomposition spec
- [ ] A1.5 `components/MapView.tsx` decomposition spec

---

## 5. Stop conditions

When does the platform-stability work end?

Per-axis thresholds (Xero adjusts as he sees fit):

1. **Bug-investigation cost:** table page < 500 lines (orchestrator only). Each god-component < 800 lines. Zero `as any` casts in combat code.
2. **Multi-client reliability:** realtime channel ownership documented for every `.channel(` site. Zero manual-repro-only failure modes in the bug backlog. Cross-client test infra exists.
3. **Performance:** session-start renders in < 1s on a warm cache. Query count per session start < 10. Realtime subscription model is documented and bounded.
4. **Recovery posture:** PITR live + drill completed. Incident response runbook covers DB-down, key-leak, data-corruption. Secret rotation playbook exists per service.
5. **Security posture:** CSP + SRI enforced. Storage bucket policies match the upload-helper whitelist. RLS gap sweep shipped findings. Rate-limit coverage = 100% of write routes.
6. **Test coverage:** unit > 500. Component > 20. Integration > 5 RLS / cascade scenarios. E2E > 1 happy-path session.

When all six axes hit threshold, the platform is "stable enough." Re-evaluate against new ambitions then.

---

## 6. Resume pointer

**LAST UPDATED:** 2026-05-20 (this commit).
**LAST CHAT:** puffer-fish (writing the plan + seeding decisions.md).
**NEXT ACTION (puffer-fish lane):** Hunt-and-peck priority queue handoff shipped as the puffer-fish run's capstone ([tasks/hunt-and-peck-priority-queue-2026-05-20.md](hunt-and-peck-priority-queue-2026-05-20.md)). Maps 9 specs/audits shipped today into a priority-ordered execution queue with coupling notes (the executeRoll-touching specs run as a single arc, not three parallel tracks). After hunt-and-peck has shipped ~5 items, puffer-fish lane resumes at P4/A5.1 (CSP+SRI audit of third-party scripts) - first item still untouched.

**NEXT ACTION (hunt-and-peck lane):** start Phase P1 step 1 of the decomposition plan - move types + module constants out of `app/stories/[id]/table/page.tsx` into `app/stories/[id]/table/types.ts`. -200 LOC. Trivial leaf. Hunt-and-peck owns; puffer-fish updates Risk Register + this plan after each phase ships.

**SUBSTRATE CURRENT (2026-05-20):**
- Tests: 419 passing across 23 files (refresh-ledger run + committed in this work).
- Risk Register: 2 YELLOW held (`roll_log` writer path + table page); 3 GREEN-ish demoted this morning.
- HOPED-FOR: 2026-05-19 batch + 2026-05-20 batch (safe-upload, turnstile rate-limit, Stabilize Phase 1, Distract Phase 2, Gut Instinct helpers, outcomeColor dedup, refresh-ledger, start-session, ops docs, Risk triage, lane split, launch plan, decomposition plan refresh, decisions.md seed, this plan).
- Largest open YELLOW: table page at 13,192 lines. Phase 3.0 step 2 (useHeaderMenus) shipped; remaining steps queued in hunt-and-peck lane.

---

## 7. Maintenance

This file is updated by every chat after every shipped step. Format:
- Items get `[x] SHIPPED <date> via <hash>` when done.
- Items get `[~] PARTIAL <date>` when in flight; named the part done.
- Phases get a status line at the top when first item ships and when last item ships.
- The resume pointer (section 6) moves with every commit.

Archive when: every axis hits threshold AND no new platform-health work has surfaced in 30 days of playtest cycles. Move to `tasks/puffer-fish-platform-plan-archived-<date>.md` with a postmortem.
