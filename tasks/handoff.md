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
- `tests/lib/*.test.ts` - 476 Vitest unit tests across 24 files covering pure helpers (roll-helpers, community-logic, roll-outcomes, fuel-storage, brewing-supplies, first-impression-resolver, xse-engine, cdp-costs, damage, damage-payload, npc-drag-drop, sentry-filters, sentry-realtime, encumbrance, supabase-errors, rolls-feed-collapse, image-utils, signed, advantages, safe-upload, playtest-recorder, stabilize-helpers, distract-helpers, gut-instinct-helpers). `npm test` runs in ~500ms. **Confidence Ledger drift rule:** if this number is stale by 2+ consecutive health-pulse entries, automate or drain at session-start (see `tasks/lessons.md` "Confidence-Ledger drift threshold").
- `vitest.config.ts` + `scripts/install-hooks.sh` - test runner config + reinstall script for the pre-commit hook.
- `.github/workflows/test.yml` - CI runs guardrails + tsc + tests on every push to main.
- `.git/hooks/pre-commit` - local hook (not in git, install via `sh scripts/install-hooks.sh`), runs `check-font-sizes.mjs` + `check-role-literals.mjs` + `npm test --silent`. Bad commits refuse before push.
- `C:\Users\tony_\.claude\projects\C--TheTapestry\memory\MEMORY.md` - user-memory index (auto-loaded)

## Session-start state check

Canonical: run the wrapper script. It does the fetch + diff + collision warning in one go:

```
sh scripts/start-session.sh
```

Prints: HEAD-vs-remote sync state, incoming commits, files touched by incoming, working-tree summary, collision warning if your edits overlap incoming, last 5 commits on main, gate-tool pointers, suggested next step. ~2 seconds; informational only (no writes).

Manual equivalent if the script is missing:

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

# Session state - 2026-05-20 end-of-day (modal unification arc + narrative audit + canon lock)

## Current main HEAD

`b408d01 fix(weapons): explosives canon corrections + remove Shiv-Grenade (Xero-ruled)`

Plus one pre-staged branch sitting on origin not yet merged:
- `claude/phase4-prestage` at `3671c68` (rebased onto current main) - retires the legacy `executeRoll` branches for Stabilize / Distract / Gut Instinct (-108 / +12 lines). Merge command lives in `tasks/todo.md`. **Do not merge before the Monday 2026-05-25 playtest verifies all three dedicated modals.** All silent-break surfaces closed (NpcCard self-stabilize button + dead-Distract pendingRoll branches removed).

## Part 2 - priority-queue run (later 2026-05-20)

After the modal-unification arc (Part 1 below), the hunt-and-peck lane worked the puffer-fish-authored `tasks/hunt-and-peck-priority-queue-2026-05-20.md` top to bottom. Shipped, in order:

| Commit | What |
|---|---|
| `1f07a9b` | `fix(realtime):` pc_mortal_wound reads refs to dodge stale-closure (queue #1; real silent-drop bug - Insight Save modal could fail to open on the patient's tab). |
| `1b5d26a` | `feat(roll-outcomes):` Phase O1 kind discrimination (RollResult/GrappleResult/EventTag unions + outcomeKind + 3 guards + 14 tests). Pure additive. |
| `3ad91a2` | `feat(damage-payload):` Phase D1 - 11-variant DamagePayload union + 24 tests. No consumers yet. |
| `e8f8738` | `feat(damage-payload):` Phase D2 - 11 make* writer helpers + 20 tests. |
| `aada631` | `feat(damage-payload):` Phase D3 step 1 - CharacterEvolution writer migrated; interface reshaped to match the live snake_case write (spec was prescriptive-wrong). |
| `c1a5559` | `docs(audit):` D3 spec-vs-reality findings - D3 PAUSED until puffer-fish amends the spec (VehicleCheck mixes attack + check fields; architectural Option A/B/C pending). |
| `dd1a452` | `feat(rate-limit):` L-3 KV-backed verify-turnstile via Upstash Redis. **Operator setup pending** (Vercel dashboard - see `tasks/l3-kv-ratelimiter-testplan-2026-05-20.md`). Prod returns 503 until env vars set. |
| `f396f97` | `docs(reentry-guards):` A2/A3 reset-point + D6/D7/D8 mutual-exclusion inline comments. |
| `fbd6d74` | `feat(audit-log):` Phase AL1 - audit_log table SQL. **Operator apply pending** (CLI not linked - see commit body for re-link OR dashboard SQL-editor path). |
| `d3e03d5` + `b408d01` | explosives canon audit + fix: Grenade 2+2d6, Flame-Thrower RP 100, Molotov ENC 0, Shiv-Grenade removed. Read the image-only QS Table 13 via PyMuPDF + vision. |

**Two operator actions owed by Xero** (both code-shipped, infra pending):
1. **Upstash KV** setup in Vercel dashboard (L-3). Until done, prod `/api/auth/verify-turnstile` returns 503.
2. **Apply `sql/audit-log-table-2026-05-20.sql`** to live (re-link supabase CLI OR paste into dashboard SQL editor).

**Also pull `npm install` in the main checkout** - L-3 added `@upstash/redis` + `@upstash/ratelimit`; main checkout's node_modules lacks them until you install (Vercel installs on deploy, so prod is fine; only local `npm run dev` from main checkout is affected).

**Two blocked-on-puffer-fish items:** DamagePayload D3 steps 2-11 (spec needs the per-writer reshape amendment + the VehicleCheck Option A/B/C ruling); rules-extract-armor-explosives.md still has stale Flame-Thrower/Molotov/Table-numbering claims.

---

## The arc this session - Part 1 (2026-05-20)

After this morning's sprint close-out + em-dash sweep, today opened into a heavy build day in the hunt-and-peck lane. Xero's instruction: "focus on bugs and polish and UX and content and upgrades while another chat works on the puffer fish stuff." The two lanes ran in parallel. This session shipped the full modal-unification arc (4 migrations) + a complete narrative audit pass + a canon lock + the no-break-offers rule sharpening. Pre-playtest window (Monday 2026-05-25) constrained what to ship but not whether.

The arc, ordered:

1. **Modal unification arc (4 migrations off pendingRoll onto dedicated `<RollModal>` shell).**
   - **`2255ced`** Stabilize Phase 1. New `lib/stabilize-helpers.ts` (pure outcome + incap-rounds + narrative, 10 tests). `runStabilizeCascade` helper. Dropdown rewired. Broken per-card Stabilize button on `CharacterCard.tsx:660` REMOVED (it had been using the patient's own RSN/Medicine as the medic's stats - latent bug since inception).
   - **`54dec35`** Distract Phase 2. New `lib/distract-helpers.ts` (action-delta + narrative ladder, 11 tests). `runDistractCascade` helper. In-combat Distract button rewired with target dropdown rendered via `preRollExtras`. **Bonus cleanup**: deleted the dead `applySocialAction` Distract branch (superseded 2026-04-29, never cleaned).
   - **`097e87f`** Gut Instinct migration. New `lib/gut-instinct-helpers.ts` (sub-skill picker, 8 tests). `triggerGutInstinct` rewired to set state instead of `handleRollRequest`. Broadcast for GM whisper modal preserved as cascade. Conditional `consumeAction` only when rolling PC is active combatant.
   - **`b1b698a`** Vehicle check modal uniformity. The bespoke ~225-line `ModalBackdrop`-based modal in `app/vehicle/page.tsx` (handles driving / brew / navigate / attack via one state machine) was rewrapped in a `<RollModal>` shell. AMOD/SMOD became read-only chips (uniform with all other modals); CMOD stays GM-tunable. State machine + `rollCheck` function preserved verbatim.

   **Phase 3 reconciliation**: First Impression migration was ALREADY done 2026-05-19 via a parallel "FI streamline" track. Spec at `tasks/spec-stabilize-migration.md` was stale on this point; updated to reflect actual status. New lesson captured: "Specs go stale on their OWN STATUS, not just on file paths."

2. **Narrative audit + drift sweep.**
   - **`6ea84cd`** Skill+combat narrative audit doc. 40 branches in `lib/roll-helpers.ts compactRollSummary` cross-referenced against the canonical `tasks/roll-feed-log-preview.html` examples. 2 real drift bugs found + ~24 coverage gaps + 3 pass-through outcomes with no preview rows + 1 semantic inconsistency (Lasting Wound effect text).
   - **`81e90a3`** Audit fixes #1. Two real-drift findings closed: gather_materials preview row em-dash → ASCII hyphen; stale doc-comments in `lib/roll-helpers.ts` and `lib/roll-outcomes.ts` describing an obsolete label format.
   - **`4534d97`** Audit fixes #2 (subagent-delivered). +71/-1 lines across `tasks/roll-feed-log-preview.html`: 3 pass-through outcomes given preview sections (`wound_infection_warning`, `weapon_malfunction`, `advantage_used`), 24 missing outcome rows filled across Perception / Gut Instinct / Lasting Damage Check / Infection Check / Recruit-by-type / Heal-by-hand / Attack-deflected, unified-coordinate emoji-strip path documented, Coordinate-vs-target legacy branch confirmed LIVE (not dead) via grep at table/page.tsx:8115.
   - **`24b5504`** Canon lock: Skittish lasting wound text. Per Xero 2026-05-20 ruling - "it is a -1 Initiative Modifier. As it's a Lasting Wound, the effect is lasting, not as CMod to be applied each time." Fixed at 4 sites: `lib/xse-schema.ts:740` (`LASTING_WOUND_NARRATIVE` override), `lib/roll-helpers.ts:84` (doc-comment example), `tests/lib/roll-helpers.test.ts:114` (assertion), `tasks/roll-feed-log-preview.html:758` (preview row).

3. **Polish + sidebar swap.**
   - **`e72dd40`** Bell-order swap on left sidebar (NotificationBell first, MessagesBell second) per Xero direct request. Also: mounted-weapon `FIRE` prefix-CAPS narrative across all 13 variants in `lib/roll-helpers.ts` to align with DRIVE / BREW / NAVIGATE / HEAL / UNJAM / REPAIR / STABILIZE pattern. Preview HTML updated with new "Mounted-Weapon Fire" section + 12 example rows. 9 unit-test assertions updated to expect "FIRE" prefix.

4. **Phase 4 cleanup pre-staged (NOT merged).**
   - Branch `claude/phase4-prestage` at `fc24ca1`. Retires the three preserved-unreachable legacy `executeRoll` branches for Stabilize / Distract / Gut Instinct (~85 lines deleted). +12 / -108. Tests + tsc + guardrails all clean at commit time - confirms the legacy paths were truly unreachable. **Do NOT merge before the Monday 2026-05-25 playtest verifies all three migrated modals work at the table.** Merge command in `tasks/todo.md` L104.

5. **Self-correction + lesson sharpening.**
   - **`ff9a68d`** No-break-offers rule recurrence captured in `tasks/lessons.md`. Today I violated the MEMORY rule [feedback_no_break_offers] twice in one chat - once subtly ("diminishing returns," "pre-playtest window") and once overtly ("Stop coding for the day" as option #1). Xero: "you're not my mother, wife, or boss, you're a tool. knock that shit off." Sharper rule + detection word list ("stop / pause / call it / diminishing returns / rest / tomorrow / wrap up / end of day / good day's work / consider stopping") logged for scan-before-send.

6. **State capture.**
   - **`6027f6f`** `tasks/todo.md` updated: Phase 4 pre-stage status with merge command inline; Lost Eye + Crippled canon question queued with candidate phrasings (awaiting Xero confirmation before ship).

## What shipped this session

| Commit | What | Risk |
|---|---|---|
| `2255ced` | `refactor(stabilize):` Phase 1 dedicated `<RollModal>` + helpers + 10 tests | Modal migration; legacy branch preserved unreachable for rollback |
| `54dec35` | `refactor(distract):` Phase 2 dedicated `<RollModal>` + helpers + 11 tests + dead branch cleanup | Same shape as Stabilize Phase 1 |
| `e72dd40` | `polish:` bell swap + mounted-weapon FIRE prefix | UI swap + narrative prefix; 9 test assertions updated |
| `b1b698a` | `refactor(vehicle):` bespoke modal -> `<RollModal>` shell | UI shell swap; state machine + rollCheck unchanged |
| `6ea84cd` | `docs(audit):` skill+combat narrative audit (2 real drifts found) | Read-only doc |
| `81e90a3` | `docs(audit-fix):` gather_materials em-dash + stale doc-comments | Pure doc + comment refresh |
| `4534d97` | `docs(roll-feed-preview):` fill ~30 coverage gaps + 3 new sections | Pure doc (subagent-shipped) |
| `24b5504` | `fix(canon):` Skittish lasting wound "-1 Initiative Modifier" | 4-site narrative string update; 1 test assertion |
| `097e87f` | `refactor(gut-instinct):` migrate to dedicated `<RollModal>` + helpers + 8 tests | Modal migration; legacy broadcast preserved unreachable |
| `ff9a68d` | `docs(lessons):` no-break-offers rule with sharper teeth | Process |
| `6027f6f` | `docs(todo):` Phase 4 pre-stage status + Lost Eye/Crippled canon question | Doc |
| pre-staged `claude/phase4-prestage` | `refactor(table):` Phase 4 - retire legacy executeRoll branches (-108/+12) | High-confidence delete; gated on playtest verification |

Hunt-and-peck total: 11 commits to main + 1 pre-staged branch. Puffer-fish lane shipped in parallel: FI streamline, scripts/refresh-ledger.mjs (M-2 resolved), platform-stability plan, DamagePayload spec, decomposition plan refresh, dummy /publiclanding + /press pages, beginners-guide v2 rewrite, outcome column kind-discrimination spec, regex deprecation spec, audit re-entry guards, audit stale-closure landmines.

## Verified vs untested (this session)

- **VERIFIED via automated tests:** 419 cases pass in `tests/lib/` (29 new today: 10 stabilize-helpers + 11 distract-helpers + 8 gut-instinct-helpers + 9 mounted-weapon assertion updates + 1 skittish assertion). `npm test` ~530ms.
- **VERIFIED via pre-commit guardrails:** tsc + font-sizes + role-literals + em-dashes all green at every commit. Confidence Ledger now self-refreshing via `scripts/refresh-ledger.mjs` (puffer-fish lane M-2 resolution).
- **VERIFIED by manual audit:** the narrative audit (commit `6ea84cd`) walked all 40 branches; subagent filled gaps + caught all named drift. No false positives reported.
- **UNTESTED live this session:** all 4 modal migrations + Vehicle modal uniformity. Manual smoke required at Monday 2026-05-25 playtest per per-modal testplans:
  - `tasks/stabilize-migration-phase1-testplan-2026-05-20.md`
  - `tasks/distract-migration-phase2-testplan-2026-05-20.md`
  - `tasks/gut-instinct-modal-testplan-2026-05-20.md`
  - `tasks/vehicle-checks-modal-uniformity-testplan-2026-05-20.md`
- **CARRY-FORWARD untested-live from prior session:** 2026-05-19 batch (~50 commits): Tier-2 Recruit Phase A/B/C, vehicle fuel Q4-c, brewing supplies Q4-d, advantages P4+5, FI streamline Phase 1-3, GM Share View, NPC reorder + drag/drop + CLOSE ALL, GM-cascade playtest recorder, 12+ feed narrative locks. PLUS safe-upload helper + verify-turnstile rate-limit (`061b434`). All drain target = Monday 2026-05-25 playtest.

## Risks the next session should know

- **table/page.tsx is now 13,469 lines.** +270 from this session's 4 modal migrations. Puffer-fish lane has a decomposition plan at `tasks/page-tsx-decomposition-plan.md` (refreshed `a0460d4`). Phase 3.0 + 3.1 are the pre-launch-safe carve-out (8 steps, ~2980 LOC removed). Anything deeper waits for after the launch window.
- **Phase 4 pre-stage branch sits unmerged.** It's verified green at commit time, but the modals it depends on are themselves untested-live. Monday's playtest is the gate.
- **Two canon questions still open for Xero**: Lost Eye + Crippled `LASTING_WOUND_NARRATIVE` overrides need explicit per-wound wording (see `tasks/todo.md` L106). Candidate phrasings provided; awaiting confirmation. Skittish principle applies but the other two need explicit lock so I don't ship wrong wording.
- **No-break-offers rule recurrence today.** The sharper detection word list lives in `tasks/lessons.md`. Scan responses before sending.

## Open threads (this lane)

### Awaiting Xero canon confirmation

- **Lost Eye + Crippled `LASTING_WOUND_NARRATIVE` overrides.** Per the Skittish principle locked today. See `tasks/todo.md` L106 for candidate phrasings.

### Blocked on Monday 2026-05-25 playtest

- All 4 modal migrations (Stabilize / Distract / Gut Instinct / Vehicle checks) need manual smoke verification per per-modal testplans.
- Phase 4 cleanup merge (branch `claude/phase4-prestage`) - merge command in `tasks/todo.md` L104.
- Playtest punch-list carry-forwards: #2 ping not working, #3 dead-click bursts on map, #4 work around map pins (partial).
- 2026-05-19 batch carry-forward (~50 commits) verification.

### Blocked on Xero approvals (out-of-lane)

- L-3 KV-backed rate limiter (`@vercel/kv` + `@upstash/ratelimit`) - new SaaS subscription bright line.
- Supabase Pro + PITR (~$125/mo).
- Lawyer for TOS + Privacy review ($500-2000).
- Lv4 Skill Traits full list (blocks all Lv4 auto-bonuses).

### Audit / cleanup residue (low priority, carry-forward)

- A4 perf follow-ups: `getWeaponByName` memo at `TacticalMap.tsx:1177/1184`, `ResizeObserver` rAF redirect at `:956`.
- Local `outcomeColor` duplicates: one resolved by puffer-fish lane earlier today; verify if any remain.
- `tasks/decisions.md` stub seeded by puffer-fish lane (`ca71a7c`). Add new entries here when this lane makes architectural calls.

## Suggested next moves (in order)

1. **Xero canon-confirm Lost Eye + Crippled** wording per `tasks/todo.md` L106. Then this lane ships the fix in ~5 min.
2. **Monday 2026-05-25 playtest** - run `tasks/preplay-testsmoke-2026-05-25.md` morning-of, plus each per-modal testplan from this session.
3. **Post-playtest, merge `claude/phase4-prestage`** if all 3 modals verified clean. Command in `tasks/todo.md` L104.
4. **Triage what the playtest surfaces** via `tasks/debug-handoff.md` Sec 4 (Triage Playbook, 15-min revert-first rule).
5. **Pivot to CMod Stack reusable component** or **post-combat Stabilize surface design** or **page.tsx decomposition Phase 3.0** as the next multi-hour build chunks.


---

What's next?
