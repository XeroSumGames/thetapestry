# Hunt-and-Peck Priority Queue (2026-05-20)

Written by the puffer-fish lane as a one-shot handoff. Maps the spec/audit inventory shipped 2026-05-20 to a priority-ordered "what to ship next" list for the hunt-and-peck lane.

**Purpose:** the hunt-and-peck chat opens, runs `sh scripts/start-session.sh`, reads its own resume pointer, then opens THIS file to pick the next ship. Higher-resolution than the puffer-fish plan's phase ordering (which is dependency-ordered, not effort-ordered).

**Audience:** the hunt-and-peck chat. Updated by either lane when items ship.

**Status:** ACTIVE 2026-05-20. Re-evaluate after ~5 hunt-and-peck ships or after the 2026-05-25 playtest, whichever comes first.

---

## 1. The IMMEDIATE fix (do FIRST)

### pc_mortal_wound stale-closure bug

Found 2026-05-20 by [tasks/audit-stale-closure-landmines.md](audit-stale-closure-landmines.md). One-line fix. Real bug; silent-drop failure mode.

**Location:** `app/stories/[id]/table/page.tsx` L1487-L1493.

**Symptom:** mortal-wound prompts may not appear on the targeted PC's tab because the broadcast handler captured `userId = null` at mount.

**Fix:** change the comparison from `data.targetUserId === userId || gmLike` to `data.targetUserId === userIdRef.current || gmLikeRef.current`. Lift the L1534 inline comment block (which documented the identical fix for `infection_check_request`) as the rationale.

**Effort:** ~10 minutes. One commit. Suggested commit message: `fix(realtime): pc_mortal_wound reads refs to dodge stale-closure (same class as 56c0534)`.

**Verification:** 2-client smoke. Force a mortal wound on the player's PC; confirm the Insight save modal opens on the player's tab.

---

## 2. The next 3 ships (do these in this order)

### #2: outcome column kind-discrimination Phase O1

Smallest puffer-fish spec to start executing. Type-only; zero schema risk.

**Spec:** [tasks/spec-outcome-column-split.md](spec-outcome-column-split.md) - Phase O1.

**Effort:** ~0.5 session. Add 3 sub-unions to `lib/roll-outcomes.ts` + `outcomeKind()` helper + 3 type guards + unit tests.

**Why first:** the 121 existing tests on `outcomeColor` + `compactRollSummary` continue to pass; no other code changes. Pure additive. Sets up Phase O2 readers to migrate.

**Then O2 over 2-3 sessions:** migrate `outcomeColor`, `compactRollSummary`, `RollsFeed`, community page to switch on `outcomeKind()`.

### #3: DamagePayload Phase D1 + D2

Spec: [tasks/spec-damage-json-payload.md](spec-damage-json-payload.md) - Phases D1 + D2.

**Effort:** ~2 sessions combined (D1 = 0.5; D2 = 1.5).

**D1:** create `lib/damage-payload.ts` with discriminated union of 12+ variants. Type-only tests.

**D2:** add per-variant `make*` writer helpers + tests. Still no-op; helpers added but not used yet.

**Why before D3:** Phase D3 (writer migrations) starts touching real production paths. D1 + D2 prep the types so D3 is mechanical.

### #4: Modal unification finish (your existing arc)

`Group Check` + `Gut Instinct` modal migrations. You already shipped Stabilize Phase 1 + Distract Phase 2 + First Impression earlier today. These two are the remaining "5 of 6" from the modal-unification list.

**Effort:** Group Check ~2-3 hours, Gut Instinct ~2 hours per the cross-chat handoff notes.

**Why before resuming decomposition Phase 3:** every modal migrated to a dedicated `<RollModal>` is one less branch the eventual `executeRoll` extraction has to untangle. The two arcs (modal unification + table-page decomposition) are coupled; finish modals first.

---

## 3. After those, the coupled ship (do as a single arc)

### DamagePayload D3-attack + compactRollSummary C3-attack + Decomposition Phase 3.4

**Specs:** all three of:
- [tasks/spec-damage-json-payload.md](spec-damage-json-payload.md) Phase D3h
- [tasks/spec-compactrollsummary-regex-deprecation.md](spec-compactrollsummary-regex-deprecation.md) Phase C3-attack
- [tasks/page-tsx-decomposition-plan.md](page-tsx-decomposition-plan.md) Phase 3.4 (`useRollResolution` extraction)

**Effort:** ~3-4 sessions combined. **Recommended as a SINGLE multi-day arc, not three parallel tracks.**

**Why coupled:** all three touch `executeRoll`. Doing them separately means touching the same 1850-line function three times, each time with regression risk. Doing them together means touching it once, exercising all three migrations in the same playtest cycle.

**Gate:** finish #2 (outcomeColor migration via kind-discrimination) and #3 (DamagePayload D1+D2) FIRST. The kind-discriminator + payload helpers are inputs to the executeRoll rewrite.

**Verification:** the longest playtest cycle you can spare. Three migrations in one session = highest single regression-surface in the platform plan.

---

## 4. After the coupled arc

These can run in any order, in parallel between sessions.

### Decomposition Phase 3.5 (`useTableRealtime`)

**Spec:** [tasks/page-tsx-decomposition-plan.md](page-tsx-decomposition-plan.md) Phase 3.5.

**Why last in the decomp:** depends on every other consumer hook having a stable callback surface. Section 3 of the audit notes ALL extractions tighten the realtime hook's prop list; Phase 3.5 only ships when that surface is final.

### Audit-log table (AL1-AL4)

**Spec:** [tasks/spec-audit-log-destructive-ops.md](spec-audit-log-destructive-ops.md).

**Effort:** ~5 sessions across 6 phases. AL1 (create table) is 0.5 session and unblocks everything else.

**Why prioritized:** without Supabase Pro+PITR (deferred per launch-plan), the audit log IS the recovery mechanism. Higher priority than spec originally framed.

### L-3 KV-backed rate-limiter

**Plan reference:** Phase P4/A5.4. Upstash KV approved by Xero per launch-plan.

**Effort:** ~1 session. Add `@vercel/kv` + `@upstash/ratelimit` deps. Replace in-memory bucket in `app/api/auth/verify-turnstile/route.ts`.

**Verification:** signup flow still works; rate-limit kicks in at 30/min as before.

### Re-entry guard inline comments (low priority)

5 recommended actions from [tasks/audit-reentry-guards.md](audit-reentry-guards.md) section 4. All low-medium priority. Pick up during a "drain the queue" day.

### Mounted-weapon prefix-CAPS narrative

Last legacy feed narrative. ~30 min. Pure polish.

---

## 5. Picking heuristics

Use these in order when picking the next ship:

1. **Real bugs first.** pc_mortal_wound fix beats any spec.
2. **Unblocking work next.** A ship that enables 3 other ships beats a ship that enables 0.
3. **Coupled work as one arc.** Don't fragment a coupled migration across sessions.
4. **Smaller first within equal priority.** A 0.5-session ship is better than a 3-session ship for momentum.
5. **Playtest verification windows.** Don't ship a high-risk extraction the day before a playtest unless verification rolls naturally into the same session.

If you're picking and everything looks equal: pick whatever you can ship cleanly in one commit cycle. Don't optimize.

---

## 6. What to ignore (for now)

Items in the platform plan that are intentionally deferred:

- **Phase P5 multi-client test infrastructure** (A2.3). Needs Playwright or equivalent. Wait until test infra ladder reaches that rung (Phase P7).
- **Phase P7 component / integration / E2E test infra.** Future tier. Don't start until at least 3 P2 items have shipped.
- **Phase P8 god-component decomposition** (TacticalMap, CampaignCommunity, etc.). Wait until P1 (table page) settles + the pattern transfers cleanly.
- **A1.3 Option B schema split for `outcome`.** Type-only Option A is sufficient. Don't escalate unless a DB-integrity bug forces it.
- **Supabase Pro + PITR (A4.1).** Xero decision; out of lane.
- **TacticalMap.tsx (4,300 lines).** Yes, it's big. But it's a render component, not a state machine. Lower priority than the table page.

---

## 7. Maintenance

Update this file when:
- A queued item ships - mark with `[x]` + commit hash + date.
- A new spec/audit lands in `tasks/` - add to the appropriate section.
- Priorities shift (Xero re-anchors, real bug surfaces) - re-order.
- After 5 hunt-and-peck ships or 2026-05-25 playtest - re-evaluate from scratch.

Archive when: every spec has shipped at least Phase 1 of its migration OR Xero declares "stable enough" per the platform plan's stop conditions.
