# Hunt-and-Peck Priority Queue (2026-05-20)

Written by the puffer-fish lane as a one-shot handoff. Maps the spec/audit inventory shipped 2026-05-20 to a priority-ordered "what to ship next" list for the hunt-and-peck lane.

**Purpose:** the hunt-and-peck chat opens, runs `sh scripts/start-session.sh`, reads its own resume pointer, then opens THIS file to pick the next ship. Higher-resolution than the puffer-fish plan's phase ordering (which is dependency-ordered, not effort-ordered).

**Audience:** the hunt-and-peck chat. Updated by either lane when items ship.

**Status:** ACTIVE 2026-05-20. Re-evaluate after ~5 hunt-and-peck ships or after the 2026-05-25 playtest, whichever comes first.

---

## 0. COMBAT SMOKE BUGS (2026-05-20/21) - ALL SHIPPED 2026-05-21 (commit 7503179)

**STATUS: DONE.** SMOKE-1/2/3 all shipped in `7503179` (see todo.md CURRENT OPEN for the as-shipped notes - the actual fix sites differed from the line numbers below; SMOKE-1 landed in the blast-resolution loop ~page.tsx:5546, not 2169-2210). Left here for provenance. Pending re-verify on the next 2-client smoke.

Found by the decomposition 2-client smoke (Parts 0/2/3). All PRE-EXISTING, not decomposition regressions. All root-caused to file:line by the puffer-fish lane. The decomposition extractions themselves verified clean.

### SMOKE-1 (HIGHEST - stalls combat): active combatant going down mid-turn doesn't auto-advance
- **Symptom:** a combatant who drops to mortally-wounded/dead during their OWN turn (self-blast grenade) stays the active combatant, can't act, and `nextTurn` doesn't advance. Repro'd twice: NPC Hugo (died), PC Cree (mortally wounded, stuck active on player view).
- **Root cause:** skip-downed logic at `app/stories/[id]/table/page.tsx:2169-2210` only runs when `nextTurn` walks FORWARD to the next actor (PCs skipped at `wp_current===0 || rp_current===0` L2201, dead/0-WP NPCs L2195). It does NOT handle the ACTIVE combatant going down during their own turn.
- **Fix:** after damage resolution drops a combatant to MW/incap/dead in the post-damage / blast-resolution branch of `executeRoll`, if they're the active combatant, auto-fire `nextTurn` (or clear `is_active` so the GM NEXT advances cleanly). Mortally-wounded PCs STAY in the list (stabilizable); only death_countdown-expired leave the rotation.
- **Verify:** NPC throws grenade at own cluster, dies -> turn auto-advances. PC drops to MW mid-turn -> turn advances, PC stays in list but isn't active.

### SMOKE-2 (presentational): Coordinated Effort lead renders as a plain row, not a bespoke feed banner
- **Symptom:** firing a coord-effort produces no meaningful log entry. Mechanics WORK (3-browser dump confirmed: lead roll fires, action consumed, +3 CMod chain activates) - but the activation only shows as a transient top-of-screen "COORDINATED EFFORT ACTIVE" banner, nothing persisted in the feed.
- **Root cause:** `collapseCoordEffortChains` (`components/RollsFeed.tsx:122-181`) only renders the bespoke Coord-Effort banner once PARTICIPANTS have rolled (enrich path L160-176). A lead-only chain falls through L154-158 as a plain dice row. The lead roll IS written to roll_log (`page.tsx:4905`, coord_chain_id stamped at L4895-4903).
- **Fix:** render a bespoke lead-only banner the moment the lead rolls ("Frankie starts a Coordinated Effort using <skill> - +N CMod to all participants"), persisted in the feed. The Tier-A Coord-Effort banner renderer already exists at `RollsFeed.tsx:776+`; extend it to the lead-only state instead of plain-row passthrough.
- **Verify:** fire a coord-effort lead -> a bespoke banner appears in the feed immediately, showing the +N CMod; participant rolls then fold into it.

### SMOKE-3 (cosmetic): grenade friendly-fire warning fires for NPC throwers hitting PCs
- **Symptom:** GM throws an NPC's grenade at PCs -> "This blast will hit: Cree Hask (Engaged). Throw anyway?" - but hitting a PC is the NPC's intent, not friendly fire.
- **Root cause:** `app/stories/[id]/table/page.tsx:7730-7732` builds `friendlyCharacterIds` from ALL other combatants regardless of faction. Consumed at `components/TacticalMap.tsx:2904-2927`.
- **Fix:** (a) faction-aware friendlies (NPC thrower's friendlies = same-disposition NPCs, not PCs), OR (b) suppress the warning when `activeEntry.npc_id` is set (GM sees the whole board). Pick with Xero - intent is "only fire for actual friendly fire."
- **Verify:** NPC grenade at PCs -> no warning. NPC grenade that catches another goon -> warning fires.

---

## 0.5. SECURITY HIGH (2026-05-21) - do this before the spec work in Section 2

### log-visit unauthenticated email mailbomb + analytics poisoning

Found by the puffer-fish A5.5 re-read 2026-05-21. Full write-up: [tasks/audit-rate-limit-coverage-2026-05-20.md](audit-rate-limit-coverage-2026-05-20.md) finding A-F4b + Phase RL3. Real, trivially exploitable, zero-auth.

**Symptom:** any unauthenticated POST to `/functions/v1/log-visit` (URL is in the public client bundle) can fire a "new visitor" email to Xero's alert inbox on every request, and inject forged analytics rows.

**Root cause:** `supabase/functions/log-visit/index.ts` is deployed `--no-verify-jwt`. The email gate at `:84` keys off `visitNumber`, COUNTed from the **body-supplied** `ip_hash` (`:27`, `:42-48`); the only suppression keys off the **body-supplied** `city` (`:81-82`). Omit both -> `visitNumber` stays 1 -> email fires every request. Resend-quota DoS + the genuine new-visitor alarm drowns in attacker noise. Body fields (`user_id`, geo) are inserted unvalidated -> analytics poisoning.

**Fix (root-cause, 3 parts, in order):**
1. Derive the email-gate visit count from a SERVER-side hash of the real `x-forwarded-for` IP (`:29` already reads it), NOT the body `ip_hash`.
2. Add 60/min/IP `@upstash/ratelimit` (works in Deno; same pattern as verify-turnstile) keyed off the server IP.
3. Validate body: reject non-UUID `user_id`; bound `city`/`region`/`page`/`referrer` lengths.

**Xero decision (does NOT block parts 1-3):** whether the analytics dedup column also switches from client-`ip_hash` to the server IP hash - that changes traffic-stat semantics.

**Effort:** ~1 session. **Verify:** curl the function with `{}` (no auth) repeatedly -> after the fix, no email fires for non-distinct source IPs and 429 after 60/min. No automated test covers edge functions yet; document the curl repro in a testplan if the Deno harness can't host one.

---

## 1. The IMMEDIATE fix (folds into SMOKE-1)

### pc_mortal_wound stale-closure bug

Found 2026-05-20 by [tasks/audit-stale-closure-landmines.md](audit-stale-closure-landmines.md). One-line fix. Real bug; silent-drop failure mode. **Likely related to SMOKE-1** - both are mortal-wound-on-the-active-PC paths; fix together.

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
