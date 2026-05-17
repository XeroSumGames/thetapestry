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
- `tasks/slash-conventions.md` - quick reference for `/architect /security /qa /product /ops /business /ux` with when-to-reach-for + 4 example triggers + what-you-get per slash.
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
- `tests/lib/*.test.ts` - 141 Vitest unit tests covering high-value pure helpers. `npm test` runs in ~230ms.
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

# Session state - 2026-05-17

## Current main HEAD

`d2ba6b6 fix(tactical-map): drag-end honors grab offset for multi-cell tokens`

## The arc since 2026-05-15

Two parallel tracks converged this stretch:

1. **Infrastructure track (this chat)** built the puffer-fish system: operating-mode + debug-handoff + slash-conventions + workflow-guide artifacts, Vitest test suite with 141 unit tests + pre-commit gate + GitHub Actions CI, and two autonomous scheduled routines (health-pulse 7x/day + security-audit weekly).
2. **Tactical track (parallel chat)** shipped: vehicle popout / Minnie passenger system, Lasting Wounds chips on Character/NpcCard, Heal-LI cross-client Wound Infection cascade, Coordinated Effort per-participant Withdraw with retcon, HIDE ALL panic button, route planner on campaign map, multi-cell token drag-end fix.

Both tracks see the same artifacts via the repo and are gated by the same pre-commit hook + CI. Coordination via shared substrate.

## What shipped 2026-05-15 -> 2026-05-17

### Infrastructure (this chat)

| Commit | What | Risk |
|---|---|---|
| `e83514b` | `perf(tactical-map):` cache `effective` fog map (A4 follow-up #1). Drops O(grid_cols * grid_rows) auto-fog iteration to zero on cache hit. Same shape as fogVisibleCacheRef. | **Untested live** |
| `baa704f` | `fix(character-sheet):` remove Insight Dice cap on `+` button. Pip render stays at 10; counts above 10 visually clamp, value increments freely. | **Untested live** |
| `bc86d5e` | `fix(role-checks):` 5 inline role gates -> `roleIsThriver()` (logging, vehicle, moderate/users/activity + characters, tools/rescale). **Guardrail tightened** to catch `!=`/`!==` + `String(...).toLowerCase()` shapes. Dead `invalidateAuthCache` deleted. | **Untested live** |
| `dabf888` | `refactor(wizard):` 3 inline `ALL_WEAPONS.find` sites -> `getWeaponByName` (PrintSheet, StepEight). | Low |
| `e119598` | `refactor(equipment):` extract `findEquipmentByName` helper for fuzzy catalog lookup; 4 sites migrated (CampaignCommunity, app/vehicle). | Low |
| `5c6d2d8` | `chore(lib):` dead-export sweep. 2 deleted (createCharacterWeapon, CONDITION_LABELS in weapons.ts), 4 demoted to file-private (haversineKm, BACKPACK_BONUS, dumpBuffer, getWeaponRangeProfile). | Low |
| `8afb610` | `chore(stale-cleanup):` removed unused+wrong `INSIGHT_DICE_DESCRIPTION` (claimed cap of 10, contradicted the just-shipped removal) + audit-corrected stale loot-found-nothing todo (already shipped in `6abb46b` on 2026-05-14). | Docs/cleanup |
| `87f3063` + `4bbd7eb` + `42d5cd3` | `feat/refactor(roll-outcomes):` 3-commit RollOutcome union type migration across 51 insert sites. Created `lib/roll-outcomes.ts` with `OUTCOME` const + `RollOutcome` + `RollResult` types. Narrowed `getOutcome()` return type. **Bonus:** TS narrowing surfaced a real dead-code path in the sprint handler (`outcome === 'Failure'` comparison in else-branch where outcome was already narrowed away from Failure). Copy-paste leftover, replaced with literal true/false. | **Untested live, large surface** |
| `f6c04df` | `docs(debug-handoff):` created `tasks/debug-handoff.md`. Risk register + tech debt ledger + confidence ledger + triage playbook + pre-ship 5-question checklist. | Docs |
| `ba96bf9` + `ee15d14` + `16777d6` | `test:` install Vitest + first batch (74 tests across roll-helpers/cdp-costs/community-logic/encumbrance) + second batch (+67 = 141 total across damage/xse-engine/roll-outcomes). Pre-commit hook wired via `scripts/install-hooks.sh`. | Net positive (safety net) |
| `c120c0d` | `ci:` GitHub Actions workflow at `.github/workflows/test.yml` runs guardrails + tsc + tests on push to main. | None |
| `fd93bcb` | `docs(debug-handoff):` mark test-infra paid down in Tech Debt Ledger; populate TESTED row in Confidence Ledger. | Docs |
| **ROUTINE** | Created scheduled remote agent `trig_012SuKNa7cQZDLjAkLTBQdVA` (health-pulse, every 3h at 00/06/09/12/15/18/21 UTC). Silent on green; commits `health-pulse: ...` to `tasks/health-pulse.md` when RED or DRIFT. | Live; emitting drift notes |
| `233a18a` | `chore(deps):` bump `next` 16.2.1 -> ^16.2.6. Patches SSRF CVSS 8.6, middleware bypass family, DoS Server Components. **Surfaced by 3 consecutive health-pulse runs.** | Net positive |
| `a28f4c6` | `chore(deps):` bump `fast-uri` 3.1.1 -> 3.1.2 via `npm audit fix`. Resolves host confusion via percent-encoded authority delimiters. | Low |
| `a5a7543` | `docs(operating-mode):` created `tasks/operating-mode.md`. 8 standing roles, slash conventions, 17 bright lines, standing behaviors. Wired into CLAUDE.md via @-ref. | Docs |
| `02d3c64` | `docs(operating-mode):` add UX role, slash example table, user-content bright line, weekly security routine reference. | Docs |
| **ROUTINE** | Created scheduled remote agent `trig_01QsNg4GfAEcT31hSER4w9Pm` (security audit, weekly Tue 16:23 UTC). Deeper than health-pulse: full audit incl. moderate, RLS gap scan, file-upload audit, secret grep, SQL/XSS patterns, dep drift, rate-limit surface, permission boundaries. | Live; first fire 2026-05-19 |
| `50c0904` | `docs(slash-conventions):` exported full slash quick-reference to `tasks/slash-conventions.md`. All 9 additional bright lines added to operating-mode (17 total). | Docs |
| `8706bf6` | `docs(workflow-guide):` created `tasks/workflow-guide.md`. Daily flow, multi-chat coordination, habits, what to ignore, when to update the system. | Docs |

### Tactical (parallel chat — see git log for full per-commit detail)

- `0efa08c` Lasting Wounds chip on CharacterCard + Show/Hide flips RLS gate
- `6342556` Lasting Wounds chip on NpcCard + cross-folder panic-hide button
- `1e642de` BUG-2 (PCs ride vehicles) resolved per Xero confirmation
- `b78d5fa` Lesson logged: canvas redraw deps - the half-day vehicle-sync bug
- `16e33d6` `fix(tactical-map):` redraw canvas when vehicles prop changes
- `64eb3db` `feat(coord):` per-participant Withdraw with full retcon (Option B)
- `026d65a` `chore(icon):` swap bug-report emoji 🐛 -> 🐞 (ladybug)
- `e1163fc` `feat(healing):` heal-LI auto-fires patient's Wound Infection check
- `d2ba6b6` `fix(tactical-map):` drag-end honors grab offset for multi-cell tokens (HEAD)

Plus the vehicle popout / Minnie passenger system arc, route planner on campaign map (OSRM), QuickAddModal pin picker unification, GM Notes localStorage draft persistence, Tools menu reorder. Full detail in the parallel-chat's own summary or via `git log`.

## Verified vs untested

- **VERIFIED via automated tests:** the 141 cases in `tests/lib/` run on every commit (pre-commit hook) and every push (CI). Covers: roll-helpers thresholds, cdp-costs ladder, community-logic morale/departure/labor math, encumbrance, damage (DM stacking + Stun rpFromRaw + reactive-melee armor), xse-engine cumulative attrs/skills, roll-outcomes literal-string locks.
- **VERIFIED via `npm audit`:** 0 high / 0 critical vulnerabilities after the `next` + `fast-uri` patches.
- **VERIFIED via pre-commit guardrails:** font-sizes + role-literals + tsc + tests all green on current main.
- **UNTESTED live (load-bearing, awaiting Monday playtest):**
  - 2026-05-13 Phase 3 a/b/c/d batch (campaign-clock drainers + 10 feed-audit drift fixes). HOPED-FOR for 4+ days per health-pulse drift report.
  - 2026-05-14 batch (Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3 in expanded log, CampaignObjects found-nothing, Luxury Ration). 3 days HOPED-FOR.
  - 2026-05-15 batch: TacticalMap effective-fog cache, Insight cap removal, role-check sweep, helper consolidations (weapon + equipment), dead-export sweep, RollOutcome 49-site migration.
  - 2026-05-16 / 17 tactical track: vehicle popout / passenger system, Lasting Wounds chips, Heal-LI cascade, Coord Effort Withdraw, panic-hide, route planner, multi-cell drag-end.

## Risks the next session should know

- **Persistent DRIFT entry from the health-pulse routine.** The 2026-05-13 Phase 3 batch keeps flagging because it's been HOPED-FOR for >3 days. Monday playtest clears it. The routine will keep nagging on every run (3rd consecutive RED report self-noted "this is the 3rd consecutive check with the same finding").
- **RollOutcome migration is large surface.** 51 insert sites touched. Runtime behavior is identical (`OUTCOME.loot` evaluates to `'loot'`). Tests cover the OUTCOME constants and the read-side functions. If a feed row renders wrong post-2026-05-15, suspect this first.
- **TacticalMap caches are stacking.** `moveZoneCacheRef`, `throwZoneCacheRef`, `blastZoneCacheRef`, `fogVisibleCacheRef`, and now `fogEffectiveCacheRef`. Each has its own invalidation key. If you see stale visual state (token shows old movement zone, fog stuck after door open), suspect the cache key shape at `components/TacticalMap.tsx:388-394` first.
- **Vehicle canvas-redraw lesson.** The parallel chat hit a half-day bug where parent state updated and the memo re-rendered but the canvas never repainted — because `vehicles` was missing from the canvas `draw()` `useEffect` deps array. Lesson logged in `tasks/lessons.md`. When adding new state to canvas-driven components, audit the deps.
- **Auto-routine quirks:** Health-pulse re-commits the same DRIFT every 3 hours when the finding hasn't changed. The 3rd-run self-noted "no fix landed yet" but still posts. Could tune the prompt to only re-commit on state CHANGE. Skip for now; treat it as a nag-feature.
- **`gh` not authenticated in the routine sandboxes.** Both health-pulse and security-audit skip the GitHub Actions status check with a noted skip. GitHub Actions still emails on failure anyway, so this is a "nice to have" fix.
- **Carried-forward 2026-05-13 risks (still live):** `out_since_day` math in Phase 3c, Skip Week prompt semantics, Recruit LI MOI tag retroactive.

## Open threads

### Blocked on Xero design calls (unchanged from 2026-05-13)
- **Playtest-marks system** (4 Qs)
- **Healing on GM time-tick** (5 Qs) — partial answer via Heal-LI cascade ship (`e1163fc`); still open on the deeper coordination
- **Group Check redesign** (4 Qs)
- **GM Notes / Assets merge** (3 options)
- **Lv4 Skill Traits full list** (blocks all Lv4 auto-bonuses)

### Audit residue (low priority)
- A4's two remaining perf follow-ups: `getWeaponByName` memo at `components/TacticalMap.tsx:1177/1184`, `ResizeObserver` rAF redirect at `:956`. Dismissed earlier as sub-millisecond payoff; pick up if a perf complaint surfaces.
- Two local re-implementations of `outcomeColor` still inline at `app/stories/[id]/community/page.tsx:42` and `components/RollModal.tsx:120`. Consolidate to canonical when convenient.
- `tasks/decisions.md` stub not yet seeded. Lazy-created on next architectural decision worth remembering.

### From the parallel chat
- ~53 open items in `tasks/todo.md`. Active threads: Coordinated Effort follow-up tuning, Modal Unification (5 of 6 remaining), Character Evolution route, King's Crossroads Mall content, CRB rewrite workstreams.

### Multi-day builds (carried)
- VehicleSheet refactor (~half day)
- CRB Tier 1 canon promotions (9 items)

## Suggested next moves (in order)

1. **Monday playtest** — clears the persistent DRIFT + the accumulated HOPED-FOR list. Highest signal-to-effort. Health-pulse will go quiet after.
2. **Address whatever Monday surfaces.** Triage via `tasks/debug-handoff.md` Sec. 4. Use the 15-minute revert-first rule for anything that's not obvious. Add a unit test per bug fixed (`tests/lib/`).
3. **Tune health-pulse to only commit on state CHANGE.** Quick prompt edit to the routine. Eliminates the nag-spam when the same DRIFT persists.
4. **Audit residue cleanup** (outcomeColor duplicates, A4 #2 + #3) as low-priority drain-the-queue work.
5. **Pick a blocked-on-design call** when ready. Unlocks the largest remaining build queue.

---

What's next?
