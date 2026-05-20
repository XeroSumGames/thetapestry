# Architectural Decisions Log

Append-only record of architectural calls worth remembering. Per `tasks/operating-mode.md` standing behavior #3.

**Format:** date, decision, alternatives considered, why this won, what would change our mind.

**Maintenance:** any chat appends. Never edit a past entry. If a decision is overturned, log a new entry that supersedes the old one and update both with `(see <date>)` cross-references.

Newest first.

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
