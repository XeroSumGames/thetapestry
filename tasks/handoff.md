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
- **Pre-feature-start origin check.** Before starting any non-trivial feature work, run `git fetch && git log --oneline origin/main -10` and grep the touched modules. Multi-chat tracks routinely ship competing or overlapping work mid-session — the most recent explicit Xero approval wins, but discovering the collision at push-time costs 20+ minutes of rebase/supersede work. (Logged 2026-05-19 after the DRIVE/BREW vs `54c46a1` collision.)
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

# Session state - 2026-05-19 (post-playtest punch-list closeout)

## Current main HEAD

`653ff86 feat(playtest-recorder): GM-cascade start/stop + localStorage resume`

## The arc this session (2026-05-19)

Continuation chat that picked up from a context-compacted session mid-way through the advantages-feature Phase 4 build (broken JSX). Fix-and-finish on that, then drained the rest of the post-2026-05-18 playtest punch list. Every Xero-blocked item from that list now ships.

## What shipped this session

| Commit | What | Risk |
|---|---|---|
| `011c55e` | `feat(advantages):` Award button on roll feed + C3 consumed broadcast (P3 Q4-b phases 4+5). Fixes the leftover JSX syntax error at L8102 (extra `)` in merged-feed IIFE) that blocked the prior session. GM-only star button overlays dice-result rows; Use button now inserts `outcome='advantage_used'` roll_log entry for whole-party narrative. | Untested live |
| `18989f3` | `feat(npcs):` player-side folder reorder (Q2 Phase B). Players drag folder headers to reorder their NPC tab (saved per-user-per-campaign in localStorage under `npc_folder_order_player_<id>`). Combat + Community buckets stay non-draggable. Phase A NPC drops still work; drop handler branches on dragId type. Microtask-deferred sync keeps saved order current with new/renamed folders. | Untested live |
| `faa60ab` | `feat(feed):` DRIVE / BREW / NAVIGATE prefix-CAPS narratives + fuel state baked in (Q1, supersedes `54c46a1`). Multi-chat collision — another chat shipped competing Driving/Brew narratives mid-session. My design (prefix CAPS + fuel state in line + NAVIGATE added + new label format `<name> - Drive - <vehicle>` etc.) had Xero approval in chat. Surgically replaced their Drive + Brew, kept their Vehicle Attack, added NAVIGATE new. Label rewrite in `app/vehicle/page.tsx`; 21 new tests; preview HTML rewritten. | Untested live |
| `85809b0` | `lessons:` verify shipped state before assuming uncontested scope. The lesson from the `faa60ab` collision — codified the pre-feature-start origin check. | Docs |
| `ba472f6` | `docs(preview):` 7th-pass changelog entry in `roll-feed-log-preview.html` documenting the DRIVE/BREW/NAVIGATE supersession. | Docs |
| `c31e564` | `feat(vehicles):` per-vehicle fuel storage via installable 55-Gallon Drums (Q4-c). New `lib/fuel-storage.ts` with pure helpers; new optional `fuel_max_base` + `fuel_storage_max` cols on Vehicle (Minnie base=4, cap=6). New "Fuel Storage" panel on vehicle popout with Install/Uninstall buttons. Drum is a new EQUIPMENT item (Common, enc 2). Brew "already full" detection Just Works at the new expanded cap (keys off fuel_max which install bumps directly). SQL backfill applied live to existing Minnie rows. 21 new tests. | Untested live |
| `f3b20fb` | `feat(vehicles):` brewing-supplies stockpile + Gather Materials (Q4-d). New `lib/brewing-supplies.ts` pure helpers; new optional `brewing_supplies_current` + `brewing_supplies_max` cols on Vehicle (Minnie current=0, max=2). New "Brewing Supplies" panel under Fuel Storage with [+ Gather Materials] button. Gather = passive no-dice action that bumps current by 1 and inserts a `gather_materials` feed event. Brew check is blocked when supplies=0; every brew attempt consumes 1 supply (success or fail) batched with the fuel update. SQL backfill applied live. 19 new tests. | Untested live |
| `653ff86` | `feat(playtest-recorder):` GM-cascade start/stop + localStorage resume. Record button is now GM-only. GM click broadcasts `recorder_start` / `recorder_stop` on `initChannelRef` (wrapped via `wrapBroadcast`); every connected player tab flips its capture flag in lockstep and writes `tapestry_recorder_enabled_<campaignId>` to localStorage. Table-page mount reads that flag and resumes capture without user action (survives refresh / back-nav / late mount). `beforeunload` listener does a one-shot flush so close-tab loses ≤1 event instead of up to 60s. Players keep Ctrl+Shift+L for ad-hoc dumps. Closes the "Alex hit Stop without ever hitting Start and dumped an empty recording" failure mode from 2026-05-18 session 3. 6 new tests. | Untested live |

## Playtest punch list (2026-05-18) — final status

| # | Mark | Status |
|---|---|---|
| 1 | (n/a, in-flight task tracker) | — |
| 2 | 01:05:31 ping not working | **Pending** — needs next-playtest repro |
| 3 | 01:13:55 + 02:37:59 dead-click bursts on map | **Pending** — needs repro |
| 4 | 01:14:04 work around map pins | **Pending** (partially shipped) — needs repro |
| 5 | 01:18:54 FI modal missing CMod | Shipped earlier this session arc |
| 6 | 01:32:51 player drag/drop NPCs (Phase A) | Shipped `4b9ce21` (prior session) |
| 7 | 02:07:35 "drives Minnie" breakdown | Shipped `faa60ab` |
| 8 | 02:12:29 Minnie inventory player-editable | Shipped `1f79e08` (prior) |
| 9 | 02:21:57 fuel storage fungible | Shipped `c31e564` |
| 10 | 02:25:36 brewing supplies storage | Shipped `f3b20fb` |
| 11 | 02:28:30 advantage tab (5 phases) | Shipped `054c04d` + `47a1f36` + `011c55e` |
| 12 | 02:37:45 CLOSE ALL multi-NPC | Shipped `fcd8a9d` |
| 13 | 01:29:32 Pin SHOW broadcast | Shipped `236167c` |
| 14 | 01:44:00 FI wording with NPC target | Shipped `89ad835` |
| 15 | 02:03:06 time-advance log | Shipped `89ad835` |
| 16 | 02:13:19 routes vanish on Esc | Shipped `d17b1c1` |
| 17 | 02:15:12 brew check +-3 display | Shipped `a6376c9` |
| 18 | Q2 Phase B player folder reorder | Shipped `18989f3` |

Every Xero-blocked mark from 2026-05-18 is now shipped. The 3 pending marks (2, 3, 4) need fresh repro data from your next live session — can't move on them without that.

## The arc since 2026-05-15 (carry-forward context)

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

- **VERIFIED via automated tests:** 368 cases in `tests/lib/` (up from 141 over the punch-list batch). New coverage this session: 21 fuel-storage helpers, 19 brewing-supplies helpers, 21 DRIVE/BREW/NAVIGATE narrative parsers. Plus the inherited 12 npc-drag-drop helpers, 14 advantages helpers, 18 FI resolver, etc. `npm test` runs in ~400ms.
- **VERIFIED via pre-commit guardrails:** font-sizes + role-literals + tsc + tests all green on current main (`f3b20fb`).
- **UNTESTED live (this session — load-bearing, awaiting next playtest):**
  - **Advantages Phase 4 + 5** (`011c55e`): ⭐ Award button on roll feed + `advantage_used` consumed broadcast.
  - **Player folder reorder Phase B** (`18989f3`): drag folder headers in the player NPC tab.
  - **DRIVE / BREW / NAVIGATE narratives** (`faa60ab`): new label format from `app/vehicle/page.tsx`; old `🚗/⚗️` rows render as plain rolls (no retro migration).
  - **Fuel storage drums** (`c31e564`): Install/Uninstall buttons on vehicle popout; Minnie expands 4 → 6 days via 2 scavengeable 55-Gallon Drums.
  - **Brewing supplies stockpile** (`f3b20fb`): Gather Materials button; brew check blocked at 0; every brew burns 1 supply.
- **UNTESTED carry-forward:** 2026-05-13/14/15/16/17 batches plus the parallel-chat tactical track (vehicle popout / Lasting Wounds chips / Heal-LI cascade / Coord Effort Withdraw / route planner / multi-cell drag-end). Health-pulse DRIFT note may persist on these.

## Risks the next session should know

- **Multi-chat collision is real.** Mid-session `54c46a1` shipped competing Vehicle Attack / Driving / Brew narratives from another chat. Caught at push-time; cost ~20 min to rebase + supersede. The new evergreen rule (pre-feature-start origin check) is the prevention; the lesson is logged at `tasks/lessons.md` top. **Always `git fetch && git log --oneline origin/main -10` before starting non-trivial feature work.**
- **Vehicle JSONB schema additions are stacking.** This session added `fuel_max_base`, `fuel_storage_max`, `brewing_supplies_current`, `brewing_supplies_max` — all optional. Read-site fallbacks handle missing fields. Per-vehicle opt-in. Backfills applied live for Minnie; other vehicle types stay opt-in until rules are spec'd post-campaign per Xero. If you see "feature disabled" on a vehicle that should have it, check whether the relevant cap field is present in the JSONB.
- **Backward-compat for old roll_log rows.** Old `🚗 Driving check · ...` / `⚗️ Brew check · ...` labels no longer match the new parsers — they render as plain rolls. Acceptable per Xero (no retro migration). If you see a "blank narrative" complaint on a row from before 2026-05-19, that's why.
- **Carry-forward from prior sessions:** TacticalMap cache stacking (`moveZoneCacheRef` + 4 siblings), vehicle canvas-redraw deps lesson, persistent health-pulse DRIFT entry, RollOutcome migration surface (51 insert sites), `out_since_day` Phase 3c, Skip Week semantics, Recruit LI MOI tag retroactive.

## Open threads

### Blocked on next-playtest repro (the only pending punch-list items)
- **#2** mark 01:05:31 — ping not working
- **#3** marks 01:13:55 + 02:37:59 — map non-responsive (dead-click bursts)
- **#4** mark 01:14:04 — work around map pins (partially shipped)

### Blocked on Xero design calls (carry-forward, unchanged)
- **Playtest-marks system** (4 Qs)
- **Healing on GM time-tick** (5 Qs) — partial answer via Heal-LI cascade ship (`e1163fc`); deeper coordination still open
- **Group Check redesign** (4 Qs) — sprint tracker says resolved as dead per spec (`15c9139`); confirm with Xero
- **GM Notes / Assets merge** (3 options)
- **Lv4 Skill Traits full list** (blocks all Lv4 auto-bonuses)

### Audit / cleanup residue (low priority)
- Mounted-weapon attack narrative still uses the legacy `🎯 ... · ... · ...` label format (Vehicle Attack parser from `54c46a1` kept; not yet upgraded to prefix-CAPS). Deferred — damage_json + bursts tangle on that path.
- A4 perf follow-ups: `getWeaponByName` memo at `TacticalMap.tsx:1177/1184`, `ResizeObserver` rAF redirect at `:956`. Sub-ms payoff; pick up if a perf complaint surfaces.
- Two local `outcomeColor` duplicates at `app/stories/[id]/community/page.tsx:42` and `components/RollModal.tsx:120`. Consolidate when convenient.
- `tasks/decisions.md` stub not yet seeded.

### From parallel chat tracks
- Recruit Tier-2 work landed mid-session (`f131736`, `6287480`, `1951d77`): Inspiration SMod relabel + approach-specific S/F flags + morale-tick drainer + GM Escape Pending surface. Untested live.
- GM Share View for tactical map (`6a4669b` + `9f02479`). Untested live.
- ~53 open items in `tasks/todo.md`. Active: Modal Unification (5 of 6 remaining), Character Evolution route, King's Crossroads Mall content, CRB rewrite workstreams.

### Multi-day builds (carried)
- VehicleSheet refactor (~half day)
- CRB Tier 1 canon promotions (9 items)

## Suggested next moves (in order)

1. **Next playtest** — clears the entire 2026-05-18 punch list (the 3 pending items need fresh repro) AND validates the 5 ships from this session (advantages P4/5, folder reorder B, DRIVE/BREW/NAVIGATE, fuel drums, brewing supplies). Highest signal-to-effort by far.
2. **Address what the playtest surfaces.** Triage via `tasks/debug-handoff.md` Sec. 4. 15-min revert-first rule for anything not obvious. Unit test per bug fixed.
3. **Pick a blocked-on-design call** (Group Check confirm-resolved / GM Notes-Assets merge / Lv4 Traits). Unlocks the largest remaining build queue.
4. **Mounted-weapon attack narrative upgrade** to prefix-CAPS (the one piece of vehicle narrative still legacy). Low priority unless a player complains.
5. **Audit residue cleanup** (outcomeColor duplicates, A4 perf follow-ups). Drain-the-queue work for slow days.

---

What's next?
