# TheTapestry handoff (scaffolding for Claude)

**This file is the source-of-truth Claude uses to assemble the chat handoff block.** Xero does not paste this file. When he asks for a handoff, Claude rewrites this file in the background (evergreen top + session state bottom), commits it, then outputs a paste-ready text block in chat. The chat block is the deliverable; this file is the scaffold behind it.

---

# Evergreen

## Role + project

You are a working assistant for **TheTapestry** - a Next.js TTRPG platform for the XSE / Distemper system. Live at `thetapestry.distemperverse.com`. Solo dev (Xero). Mix of bug triage, feature builds, doc-sync, audit, and rules work.

Be alert. Read code before guessing. Cite `file:line`. Single-commit fixes when possible. Ship -> sync -> move on. Push straight to main; Vercel deploy = dev env. No staging branch.

## Working directory

- Main checkout: `C:\TheTapestry`
- Worktree pattern: `C:\TheTapestry\.claude\worktrees\<name>` on branch `claude/<name>`. Use a worktree for non-trivial work.
- **Edit/Write absolute paths must point at the worktree** (`C:\TheTapestry\.claude\worktrees\<name>\...`), not `C:\TheTapestry\...`. Subagent reports cite main-checkout paths - re-prefix every path before Edit/Write. Recovery if mis-targeted: `cp <main> <worktree>` then `git -C /c/TheTapestry checkout -- <path>`. Burned twice on 2026-05-12.
- After every push to main: `git -C /c/TheTapestry pull origin main` to sync the main checkout.
- Main checkout has uncommitted CRB-rewrite work (`M CLAUDE.md`, `M tasks/lessons.md`, `M tasks/todo.md`, untracked `tasks/crb-*`, `tasks/_work/`, etc.). Untouched independent workstream. **Don't commit any of it.** If syncing requires it, stash -> pull -> pop:

  ```
  git -C /c/TheTapestry stash push -m "pre-sync" -- tasks/lessons.md tasks/todo.md CLAUDE.md
  git -C /c/TheTapestry pull origin main
  git -C /c/TheTapestry stash pop
  ```

## Locked behavior rules

These exist because I broke them and Xero corrected me. Do not violate.

- **No em-dashes or en-dashes anywhere.** Chat, code, docs, commit messages. Plain ASCII hyphen only.
- **No "(critical)" in roll-feed output.** Use "Moment of Insight" wording.
- **13px minimum inline `fontSize`.** Never write `'9px'` through `'12px'` in `style={{...}}`. Banned combo: `13px + #3a3a3a` (illegible on dark backgrounds; use `#cce0f5`). Guardrail: `node scripts/check-font-sizes.mjs` (with `--fix` for size, no auto-fix for color).
- **Carlito font everywhere.** Default `'Carlito, sans-serif'`. Header buttons use `hdrBtn()` helper at 28px uniform height.
- **Push to live, test on live.** No staging. Every change ships straight to main.
- **Long-term fix over quick fix.** Root-cause path always wins. Surface latent bugs even when off-request.
- **Verify shipped state before quoting scope.** Grep + git log first. Don't trust master inventories or specs.
- **Pre-feature-start origin check.** Before starting any non-trivial feature work, run `git fetch && git log --oneline origin/main -10` and grep the touched modules. Multi-chat tracks routinely ship competing or overlapping work mid-session - the most recent explicit Xero approval wins, but discovering the collision at push-time costs 20+ minutes of rebase/supersede work. (Logged 2026-05-19 after the DRIVE/BREW vs `54c46a1` collision.)
- **Cold-audit findings are hypotheses, not facts.** When running a 4-agent audit or following up on `file:line` claims from any subagent report, verify the cited line before changing code. Audits have ~30% noise rate on specifics - findings get hallucinated, get pre-fixed by other work, or are misframed. When dispatching audit agents, require the prompt to quote 2 surrounding lines per finding so the cite can be spot-verified.
- **Remote agents default to feature branches.** When dispatching via `RemoteTrigger`, expect the spawned agent to create `claude/<name>` or named feature branches despite explicit "push directly to main" instructions - the safety prior wins. Easier to accept and merge than fight. Always specify a fallback branch name (e.g. `perf/<topic>-canvas`) in the prompt so you can find the branch by name afterward.
- **Capture lessons + todo immediately.** After every meaningful ship, edit `tasks/lessons.md` + `tasks/todo.md` in the same response. Never offer "want me to add this?"
- **Handoff = paste-ready CHAT BLOCK, not a file pointer.** When Xero asks for a handoff, the FINAL response in chat must be a self-contained block of text he can copy-paste into a new chat. Spells out role, working-dir rules, reference files, hard rules, response protocol, current state. `tasks/handoff.md` exists as scaffolding (rebuild + commit it in the background), but never end by saying "go read the file" or "paste tasks/handoff.md". The chat block IS the deliverable.
- **Never delete backlog items silently.** Move resolved items to a "Shipped" section with the commit hash.
- **Testplan naming:** `tasks/<topic>testplan.md` with descriptive name (e.g. `loadtimestestplan.md`). Never overwrite generic `tasks/testplan.md`.
- **Token spawn = top-left (1,1).** Never top-right.
- **`cell_px` default = 35.** `tactical_scenes.cell_px` must stay 35, never 70.
- **No stamina-check / offer-framing phrasing.** Banned: "want me to continue?", "should I keep going?", "stop here?". Xero closes with "What's next?" when ready.
- **No "cosmetic" / "redundant" value-labels on offers.** Offer-framing is fine; banned is attaching dismissive labels.
- **Git + worktree ownership:** I do ALL git/merge/push end-to-end, never ask permission. After a worktree push, immediately pull into the main checkout.

## Locked canon (XSE / Distemper rules)

Rules I cannot rewrite without explicit unlock. Source: `docs/Rules/` PDFs (precedence: SRD 1.1.17 > Distemper CRB 0.9.2 > QS > Chased > DZ). Read PDFs via `pdftotext`.

- **Insight Dice on Death:** 1 WP + 1 RP **total**, NOT per die.
- **Stress on mortal/incap:** entering WP=0 or RP=0 auto-fills 1 Stress pip (cap 5); on-entry, not end-of-combat.
- **Stun weapons:** Taser = 1WP/4RP, Cattle Prod = 2WP/8RP. Stun-tagged weapons compute RP from raw WP (bypass DM).
- **Infection:** CRB p.114-115. Wound Infection (post-combat) + Sickness & Disease (environmental). GM-button driven. -2 CMod deferred.
- **Armor:** 8 entries from QS Table 7 + Xero overrides. Riot Shield = reactive_melee_only. Inventory-driven worn flag. Upkeep Phase 2 condition tracking.
- **Rations:** Standard/Luxury/Military = Common/Uncommon/Rare. 2 starting default. Source = `lib/xse-schema.ts:RATIONS`.
- **Subsistence damage:** 1 WP + 1 RP per day past day 2 without rations (CRB Ch.07 p.117). Phase 3c drainer applies it on day-boundary ticks past `out_since_day + 2`.
- **Skill levels** include level 1 (real skill rank; Medic profession floors Medicine* at 1+).

Pre-digested extracts in `tasks/rules-extract-*.md` consulted first. If spec disagrees with rules, rules are canonical.

## Response protocol

When Xero reports a bug or asks for a change:

1. **Triage** - what code path / file / function produces this? Cite `file:line` when you can.
2. **Verify** - read the relevant code now. Don't infer from name or memory.
3. **Diagnose** - say what's wrong, plain language.
4. **Propose fix + revert command** before shipping. "One-line at X. Revert: `git revert <sha> --no-edit && git push origin main`."
5. **Wait for go** - "go", "ship it", or a redirect.
6. **Ship** - apply, verify (`npx tsc --noEmit`; `node scripts/check-font-sizes.mjs` if UI), commit with conventional-commit message, push, sync `C:\TheTapestry`, confirm last commit + revert command in chat.
7. **Lessons + todo** - same response. If a reusable pattern surfaced, write it into `tasks/lessons.md` and `tasks/todo.md`. Don't offer; do it.

If a bug report is vague, ask **one** sharp clarifying question. Don't ask three.

If a fix balloons beyond one commit, STOP and re-plan. Don't keep digging.

## Reference files

- `tasks/handoff.md` - this file (scaffold for the chat block; Claude maintains it)
- `tasks/operating-mode.md` - **AUTO-LOADED via CLAUDE.md @-ref.** Relational scaffold: 8 standing roles (architect/eng/qa/security/ops/product/business/ux), slash conventions, 17 always-confirm-first bright lines, standing behaviors (pre-ship 5-question check, cross-role tradeoff surfacing, decision audit trail, test-per-fix, stop-and-replan).
- `tasks/debug-handoff.md` - **diagnostic companion.** Risk register, tech debt ledger with interest rates, confidence ledger (TESTED / playtested / HOPED-FOR), triage playbook (Sec. 4, includes 15-min revert-first rule), pre-ship 5-question checklist (Sec. 5).
- `tasks/slash-conventions.md` - quick reference for `/architect /security /qa /product /ops /business /ux` with when-to-reach-for + 4 example triggers + what-you-get per slash. Also documents `/stability-audit` (on-demand periodic review; output: dated audit doc at `tasks/stability-audit-YYYY-MM-DD.md`).
- `tasks/stability-audit-YYYY-MM-DD.md` - dated stability audits. Read the most recent before quoting "current risk." Pattern + gotchas in `tasks/lessons.md` "Stability-audit pattern" entry. First was 2026-05-19.
- `tasks/workflow-guide.md` - how Xero uses the puffer-fish day to day. Daily flow, multi-chat coordination, habits, what to ignore, when to update the system.
- `tasks/health-pulse.md` - **auto-maintained.** Health-pulse routine (trig_012SuKNa7cQZDLjAkLTBQdVA) prepends entries every 3 hours when RED or DRIFT.
- `tasks/security-audit.md` - **auto-maintained.** Security audit routine (trig_01QsNg4GfAEcT31hSER4w9Pm) prepends entries weekly Tue 16:23 UTC when findings.
- `tasks/lessons.md` - UNIFIED ROW pattern + roll-feed log patterns at the top; everything I've been corrected on
- `tasks/todo.md` - running canon-promotion + bugs backlog
- `tasks/backlog-*-comprehensive.md` - periodic full backlog snapshots (verdict tags may be low-trust; re-verify before acting)
- `tasks/campaign-sheet-phase3-testplan.md` - 3a/3b/3c/3d verification steps for the campaign-clock drainers
- `tasks/roll-feed-log-preview.html` - canonical visual reference for log rendering. Open before editing `components/RollsFeed.tsx` or `lib/roll-helpers.ts:compactRollSummary`.
- `tasks/rules-extract-*.md` - pre-digested rulebook extracts (consult before re-reading PDFs)
- `tasks/tapestry-rules-canon.md` - current canon snapshot
- `docs/Rules/` - canonical PDFs (gitignored; never `git stash -u` while these are untracked)
- `lib/xse-schema.ts` - single source of truth for skills, professions, paradigms, rations, etc.
- `lib/campaign-clock.ts` - `advance()` + drainers (streaming heals, rations, subsistence). Phase 3 backbone.
- `lib/roll-outcomes.ts` - `OUTCOME` const + `RollOutcome` / `RollResult` union types for the `roll_log.outcome` column. Use `OUTCOME.X` at every insert site for typo safety.
- `lib/playtest-recorder.ts` + `components/PlaytestRecorder.tsx` - telemetry only. `Ctrl+Shift+M` marks are per-browser localStorage with no central collection; silently drop when gate is off.
- `tests/lib/*.test.ts` - 388 Vitest unit tests across 20 files covering pure helpers (roll-helpers, community-logic, roll-outcomes, fuel-storage, brewing-supplies, first-impression-resolver, xse-engine, cdp-costs, damage, npc-drag-drop, sentry-filters, encumbrance, supabase-errors, rolls-feed-collapse, sentry-realtime, image-utils, signed, advantages, safe-upload, playtest-recorder). `npm test` runs in ~430ms. **Confidence Ledger drift rule:** if this number is stale by 2+ consecutive health-pulse entries, automate or drain at session-start (see `tasks/lessons.md` "Confidence-Ledger drift threshold").
- `vitest.config.ts` + `scripts/install-hooks.sh` - test runner config + reinstall script for the pre-commit hook.
- `.github/workflows/test.yml` - CI runs guardrails + tsc + tests on every push to main.
- `.git/hooks/pre-commit` - local hook (not in git, install via `sh scripts/install-hooks.sh`), runs `check-font-sizes.mjs` + `check-role-literals.mjs` + `npm test --silent`. Bad commits refuse before push.
- `C:\Users\tony_\.claude\projects\C--TheTapestry\memory\MEMORY.md` - user-memory index (auto-loaded)

## Session-start state check

```
git -C /c/TheTapestry fetch origin main
git -C /c/TheTapestry log -1 --oneline      # latest main commit
git -C /c/TheTapestry status --short        # untracked CRB files OK; nothing of mine should be M
```

If working from a worktree, also:

```
git log -1 --oneline                         # worktree HEAD
git log HEAD..origin/main --oneline          # commits behind main; if non-empty, rebase
```

## Sharpening + chat-block protocol

When Xero asks for a handoff:

1. Sharpen the evergreen section above. ONE edit per session, sourced from:
   - Correction Xero gave -> new locked rule.
   - Recurring process friction (asked the same clarifying question twice) -> response-protocol tweak.
   - Canon I had to re-derive from PDFs -> new locked-canon entry.
   - Tool I should have reached for sooner -> reference-files edit.
2. Rewrite the **Session state** section below from scratch with latest commits + open threads.
3. Commit this file.
4. **Output the chat block as the final response.** Self-contained: role one-liner, "read `tasks/handoff.md` first" + session-start check commands, working-directory rules with worktree-path footgun, reference-file list, full hard-rules list (not "see file"), full response protocol, current state (HEAD + recent ships + untested + blocked), final "What's next?"

Aim: evergreen section stays under ~150 lines. Merge new rules into existing ones rather than appending.

The chat block IS the deliverable. Never end a handoff by pointing at this file.

---

# Session state - 2026-05-19 (stability audit + /stability-audit scaffolding)

## Current main HEAD

`a0d611b docs(stability-audit): scaffold /stability-audit slash + pattern + lessons`

## The arc this session (2026-05-19, evening)

Xero asked the "dev team" (the puffer-fish system) to verify the codebase was stable post-playtest. First `/stability-audit` ever run on the project. Output: read-only audit doc, then triaged HIGH findings shipped, then scaffolded the pattern so future iterations don't have to re-invent the framing.

Three commits, all on main, all green through pre-commit gates:

1. **Audit pass (no code edits)** - wrote `tasks/stability-audit-2026-05-19.md`. Read existing evidence (Risk Register + Tech Debt + Confidence Ledger from `tasks/debug-handoff.md`, newest `tasks/health-pulse.md` + `tasks/security-audit.md` entries, 14 days of `git log` showing 542 commits / 7 days showing 335 commits), ran live gates (tsc clean, font-sizes OK, role-literals OK, 368 tests passing in 432ms, npm audit 0 high / 0 critical), footgun grep (`as any`, realtime channels, polling, upload calls). Findings: 3 HIGH (4-6 unsanitized upload sites + verify-turnstile no rate-limit + 2026-05-19 HOPED-FOR batch the ledger missed), 5 MEDIUM, 3 LOW. Drained the Confidence Ledger (174 → 388 tests; added the ~50-commit 2026-05-19 batch). Updated `tasks/todo.md` CURRENT OPEN with the audit checklist sorted by severity. Added to `tasks/debug-handoff.md` §3.
2. **`061b434` fix(security): sanitize upload filenames + lock contentType + IP rate-limit turnstile** - H-1 + H-2 + M-1.
   - **H-1:** new `lib/safe-upload.ts` exposes `prepareUpload(bucket, file)` returning `{ ok, filename, contentType }`. Sanitizes filename (strips path traversal, replaces unsafe chars with underscore, NFKD-strips accents, caps stem 80 + ext 8), enforces per-bucket size caps (10 MB attachments, 5 MB module-covers), maps extension to a whitelisted contentType (`image/jpeg | image/png | image/gif | image/webp`; PDF + txt only in attachment buckets). SVG excluded everywhere (script-execution risk). Applied at 7 sites: table page session-attachments, CampaignMap pin-attachments, MapView pin-attachments (new + edit), GmNotes note-attachments, war-stories, rumors module-covers. 20 unit tests at `tests/lib/safe-upload.test.ts`.
   - **H-2:** `app/api/auth/verify-turnstile/route.ts` enforces 30 req/min/IP (in-memory token bucket, `x-forwarded-for` keyed, stale-bucket sweeper) + 4 KB body cap (413 if exceeded) + JSON parse guard (400 if invalid). 429 + `Retry-After` header on rate-limit hit. In-memory limiter is per-instance; L-3 todo logged for KV-backed upgrade before paid signups.
   - **M-1:** confirmed no-op. `brace-expansion` + `ws` already at fixed versions in lockfile; remaining 2 moderates are postcss-via-next (breaking, held per security-audit).
3. **`a0d611b` docs(stability-audit): scaffold /stability-audit slash + pattern + lessons** - caught after Xero asked "are you keeping a file/log of this for future iterations?" The audit doc + commit messages persisted but the *pattern* wasn't reusable. Added:
   - **`tasks/lessons.md`** - new entry "Stability-audit pattern + stale audit line numbers + Confidence-Ledger drift threshold." Documents the 5-step audit shape, the gotcha that audit line refs go stale fast on hot files (security-audit said `:3414` for session-attachments upload, actual was `:3518` after ~100 commits drift), and the rule that the same drift item in 3+ pulses means the ledger has lost its signal.
   - **`tasks/slash-conventions.md`** - `/stability-audit` entry with trigger examples + output shape. Wired into the pair-with-periodic-reviews tip.
   - **`tasks/operating-mode.md`** - `/stability-audit` added to the on-demand periodic reviews section between `/commercial-review` and `/pre-launch-audit`.
   - **`tasks/stability-audit-2026-05-19.md`** - forward links so a future reader landing on the doc sees the pattern + slash + naming convention without grepping.

## What shipped this session

| Commit | What | Risk |
|---|---|---|
| (uncommitted in audit pass) | `tasks/stability-audit-2026-05-19.md` (new), `tasks/debug-handoff.md` §3 Confidence Ledger drain (174 → 388 tests + 2026-05-19 HOPED-FOR batch), `tasks/todo.md` CURRENT OPEN audit checklist (H-1/H-2/M-1/M-2/M-3/M-5/L-1/L-2 + 5 Risk Register demote candidates) | Docs/audit only; folded into next commit |
| `061b434` | `fix(security):` upload hardening across 7 sites + verify-turnstile rate-limit + body cap. `lib/safe-upload.ts` (new helper), 20 new tests. Pre-ship 5-Q answered in commit body. | **Untested live** (auth boundary). Behavior change visible to users only on bad uploads (alert with reason). |
| `a0d611b` | `docs(stability-audit):` scaffolded the `/stability-audit` slash + lesson + operating-mode entry + forward links in the audit doc. | Docs |

## Verified vs untested (this session)

- **VERIFIED via automated tests:** 388 cases in `tests/lib/` (was 174 per stale ledger; was 368 before today). New today: 20 safe-upload cases (path traversal, accents, oversize, SVG/HTML/exe rejection, type-spoofing override, bucket-specific size caps). `npm test` ~432ms.
- **VERIFIED via pre-commit guardrails:** tsc + font-sizes + role-literals + tests all green at HEAD `a0d611b`. Pre-commit hook ran the full suite before each commit.
- **UNTESTED live this session:**
  - **`safe-upload` helper across 7 upload sites** - XSS-via-filename / size DoS / contentType-spoofing all closed in unit tests. Live behavior change for end users: oversized or wrong-type uploads now show an `alert()` with the reason instead of silently uploading. Try a `.docx` to GM Notes attachments to verify.
  - **`verify-turnstile` rate-limit** - 30/min/IP + 4 KB body cap. To verify: open signup, complete CAPTCHA, watch network tab; or hit the endpoint with a curl loop and confirm 429 after 30 hits.
- **CARRY-FORWARD from prior arc (still untested live):** 2026-05-19 morning batch (Tier-2 Recruit Phase A/B/C, vehicle fuel Q4-c, brewing supplies Q4-d, advantages P4+5, FI streamline Phase 1-3, `useHeaderMenus` extraction, GM Share View, NPC reorder + drag/drop + CLOSE ALL, GM-cascade playtest recorder, 10+ feed narrative locks). All on main since this morning; drain target = 2026-05-25 playtest per `tasks/pre-playtest-smoke-2026-05-25.md`.

## Risks the next session should know

- **Audit line numbers age in days, not weeks.** When reading `tasks/security-audit.md` or any earlier audit doc, re-grep for the call shape before quoting `file:line` to a fix. The 2026-05-19 16:23 UTC audit was off by ~100 lines on the session-attachments site by the time it was triaged that same evening. Pattern documented in `tasks/lessons.md`.
- **Confidence-Ledger drift signal threshold.** If health-pulse flags the same item in 2 consecutive entries, the next session opens by draining it (run the action listed) or automating the drain. Today's audit found the test count had been stale 3 times in 4 days. The lesson + `feedback_immediate_lesson_capture` memory rule both point at this.
- **In-memory rate limiter on verify-turnstile is belt-and-suspenders.** Blocks single-client loops; does not block distributed abuse across warm Vercel instances. L-3 todo logged: swap to `@vercel/kv` + `@upstash/ratelimit` before paid signups open. Until then: low-grade protection is in place, real protection is queued.
- **The lessons + todo capture rule was applied late today.** I closed the todo items in `061b434` but didn't write the lesson until Xero asked "are you keeping a log?" The rule says lessons + todo in the same response as the ship; today I held the lesson back. The memory-rule trigger (after meaningful ship) was active and I missed it. Worth watching in future sessions.
- **Carry-forward from prior arc:** multi-chat collision risk (the `54c46a1` collision in the morning), TacticalMap cache stacking, vehicle JSONB schema additions stacking (`fuel_max_base`, `fuel_storage_max`, `brewing_supplies_current`, `brewing_supplies_max` - all optional, all per-vehicle opt-in), legacy roll_log rows render as plain rolls (no retro migration).

## Open threads

### Stability-audit punch list (still open, sorted by severity)
- **M-2** Confidence-Ledger drift mechanism. Either automate test count via `scripts/refresh-ledger.mjs` (parse `npm test` output) or formalize a session-start drain. The 2+ pulses threshold from the new lesson is the trigger.
- **M-3** Dedupe `tasks/todo.md` per the 2026-05-19 12:05 UTC health-pulse. Close `Coordinated Effort bespoke chain summary` (shipped via `137be68`); drop lines 56+57 (dups of 80+84); drop one of the lines-580/621 third copies.
- **M-5** Vehicle 3s polling at `app/stories/[id]/table/page.tsx:3153`. Realtime + BroadcastChannel already triggers refetch; ~28.8K unnecessary refetches per 4-hour 6-player session. Measure first; drop if realtime is reliable.
- **L-1** Stale TODOs at `lib/campaign-snapshot.ts:22` (communities Phase 4b) + `app/campfire/timestamp/page.tsx:8` (Tapestry-side renderer).
- **L-2** `app/dashboard/page.tsx:52` accesses `profile.role` directly for display. Not a security bypass; erodes the invariant. Swap to a `getDisplayRole(profile)` helper.
- **L-3** verify-turnstile KV-backed rate limiter upgrade before paid signups (in-memory leaks across N warm instances). Needs Xero approval to add `@vercel/kv` + `@upstash/ratelimit` deps (Upstash free tier - flag bright-line "new SaaS subscription").
- **Risk Register demote candidates** (pending 2026-05-25 playtest): `lib/campaign-clock.ts`, `roll_log` writer (hold 1 extra cycle for Advantages broadcast + FI cutover write paths), Initiative state machine (hold for Tier-2 Recruit drainers), TacticalMap canvas. Hold `app/stories/[id]/table/page.tsx` YELLOW until 3-4 more `useHeaderMenus`-style extractions land.

### Blocked on next-playtest repro (carry-forward)
- **Punch-list mark #2** 01:05:31 ping not working
- **Punch-list mark #3** 01:13:55 + 02:37:59 dead-click bursts on map
- **Punch-list mark #4** 01:14:04 work around map pins (partially shipped)

### Blocked on Xero design calls (carry-forward, unchanged)
- Playtest-marks system (4 Qs)
- Healing on GM time-tick (5 Qs, partial answer via Heal-LI cascade)
- Group Check redesign (4 Qs; sprint tracker says resolved as dead per spec via `15c9139`; confirm)
- GM Notes / Assets merge (3 options)
- Lv4 Skill Traits full list (blocks all Lv4 auto-bonuses)

### Audit / cleanup residue (low priority, carry-forward)
- Mounted-weapon attack narrative still uses legacy `🎯 ... · ... · ...` label format.
- A4 perf follow-ups: `getWeaponByName` memo at `TacticalMap.tsx:1177/1184`, `ResizeObserver` rAF redirect at `:956`.
- Two local `outcomeColor` duplicates at `app/stories/[id]/community/page.tsx:42` and `components/RollModal.tsx:120`.
- `tasks/decisions.md` stub not yet seeded.

## Suggested next moves (in order)

1. **M-3 todo dedupe** - 5-min mechanical edit; clears the longest-running health-pulse DRIFT entry.
2. **M-2 ledger refresh automation** - `scripts/refresh-ledger.mjs` parses `npm test` output and rewrites the test-count line in `tasks/debug-handoff.md` §3. Kills the drift pattern at the root.
3. **2026-05-25 playtest** - validates the 2026-05-19 ship batch (~50 commits) AND today's safe-upload + turnstile changes. Highest signal-to-effort.
4. **Address what the playtest surfaces** via the Triage Playbook (Sec. 4 of `tasks/debug-handoff.md`). 15-min revert-first rule.
5. **L-3 KV-backed rate limiter** before paid signups. Bright-line: Xero approval needed for the new dep.
6. **Demote YELLOW items** in Risk Register per the audit triage list once the playtest greenlights them.


---

What's next?
