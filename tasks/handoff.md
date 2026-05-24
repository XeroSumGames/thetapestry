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
- **Handoff accuracy: DERIVE, don't recall.** Every factual claim in a handoff (HEAD, test count, what shipped, what's next/untouched) must be verified against git/disk in the SAME turn it's written - never transcribed from conversation memory. The reader treats handoff Session-State as a HYPOTHESIS and spot-checks before acting. Full rule in "Handoff accuracy contract" below. (Locked 2026-05-21 after a puffer-fish handoff claimed "A5.5 untouched" when the audit had already shipped 2026-05-20 - a skipped file-existence check.)
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
- `tasks/architecture-review-2026-05-24.md` - the north-star architecture verdict (would we design it this way again?). KEEP seams+ratchets+pure-domain+Supabase; the layering stops at data access. 5 designed-not-retrofitted moves (todo "Architecture review 2026-05-24"); #1 = client-state layer to dissolve the god-components. Read before any big structural proposal.
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

## Handoff accuracy contract (locked 2026-05-21)

Handoffs kept asserting stale or wrong state. The Session-State section + the chat block are ONE chat's point-in-time belief; by the time the next chat reads them the other lane has shipped, and some claims were memory-drift wrong even when written (e.g. "A5.5 untouched" while the audit doc already existed on disk). Two halves close the gap:

**WRITE side - derive, don't recall.** Every factual claim in Session-State + the chat block comes from a command run in the SAME turn you write the handoff, not from memory:
- HEAD -> `git rev-parse --short HEAD` / `git log -1 --oneline`. Never transcribe.
- Test count -> `node scripts/refresh-ledger.mjs`, then read it back.
- "X shipped" -> `git log --oneline | grep`. "Y is next / untouched / to-be-written" -> Glob or `ls` the file (does it ALREADY exist?) AND confirm the todo item is actually open. The A5.5 miss was exactly a skipped file-existence check.
- Stamp volatile claims with provenance: "(verified @ <sha>)". A claim with no provenance is a guess.

**READ side - hypothesis, not ground truth.** `sh scripts/start-session.sh` verifies HEAD + incoming commits + per-state-file freshness (how many commits behind main `tasks/handoff.md` and the lane plans are). Before acting on any "what's next / what shipped" claim, spot-verify against git log / Glob / the todo. If the resume pointer says "write file Z," confirm Z does not already exist first.

**Structural principle - facts belong to the substrate, not the handoff.** Anything git/disk answers in 2 seconds (HEAD, counts, shipped status, file existence) goes stale fast; do not freeze a copy in prose - point at how to derive it. The handoff's real payload is what the substrate CANNOT tell you: intent, judgment calls, why-this-order, gotchas, "I shipped X but Xero may want Y." Same principle as auto-memory: do not store what is derivable from current state.

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

# Session state - 2026-05-24 (puffer-fish: stability audit + Phase 7 acceptance + post-smoke fixes + architecture review)

## Current HEAD: derive (`git rev-parse --short HEAD`; was `da22595` at write). page.tsx 10,557 LOC; 548 vitest green + a growing Playwright E2E suite (the e2e/hunt lane shipped Tier-1 multi-context tests this session); arch ratchets at baseline (`.from` ~1037, `.channel` 22, console 0); depcruise clean. **Grand Re-Arch Phases 1-6 DONE; Phase 7 (acceptance) all-but-the-vehicle.** Detailed Phase 1-7 logs below are HISTORICAL record.

## What this puffer-fish session did (2026-05-24)
- **Stability audit** (`tasks/stability-audit-2026-05-24.md`, commit `667c100`): all gates green, no BLOCKERs. Risk Register: **Realtime channels GREEN-ish -> YELLOW** (re-arch invalidated the "stable old code" rationale; debug-handoff.md Sec 1). decisions.md gained the re-arch locked-calls entry. Reviewed all 16 exhaustive-deps suppressions (none were the feared stale-closures).
- **Phase 7 acceptance** scaffolded: ONE runnable sheet `tasks/phase7-acceptance-2client-testplan.md` (Sections A-F; supersedes the table-only decomposition sheet). Run plan locked: A/C/D/E/F in THE ARENA (`35ed2133-...`, GM=Xero / player=MARV `02c22e46-...`), Section B (vehicle) rides the Minnie playtest (Arena has 0 vehicles). Cross-linked with the Playwright "final test" e2e suite (`tasks/e2e-final-test-handoff-2026-05-24.md`).
- **Xero ran the 2-client smoke; 4 "failures" triaged to root cause, ZERO re-arch regressions:**
  1. Stockpile/pins/membership realtime dead = **supabase_realtime publication gap** (6 subscribed tables never published; pre-existing). FIXED `0df7b81` (`sql/realtime-publication-fix-2026-05-24.sql`). HELD for triage: characters / war_story_replies / forum_thread_reactions (same gap).
  2. Infection modal never fired = the no-stacking check read **stale in-memory `infection_state`** while reading warnings fresh from DB. FIXED `89fb256` (reads infection_state fresh per char) + a `trace('infection-queue',...)`. **CONFIRMED working** (Cree's modal fired on Marv's window).
  3. Restore left conditions set = FIXED `be4740e` (Restore now clears stress + all 7 infection_* fields, PC + NPC).
  4. Show Arc / MOVE HERE = test artifact (no vehicle in Arena).
- **Player-bar status chips SHIPPED** (`4c90660` + `d31ca6c` tooltips): `app/stories/[id]/table/components/PlayerStatusChips.tsx` - 🦠 Infected/Sick, 💀 MW, 😵 Incap, 😰 Stressed, visible to everyone, hover tooltips with specifics. Extracted to a component (not inline) to keep the LOC ratchet green (the ratchet blocked the inline version - working as designed).
- **Architecture review** (`tasks/architecture-review-2026-05-24.md`, `da22595`) answering Xero's north star: KEEP the bottom (seams + ratchets + pure-domain lib + Supabase); the layering stops at data access. 5 priority "designed-not-retrofitted" moves logged in todo, #1 = **client-state layer** (dissolves the god-components; do after Phase 7, with a design doc + human architect for the migration).

## What's OPEN / next for puffer-fish
- **Phase 7 close-out:** Section B (vehicle) at the 2026-05-25 Minnie playtest (2nd window). D/E re-test (deposit + pin propagation - publication fix is live, no deploy needed). When all green: demote Realtime YELLOW, promote re-arch HOPED-FOR -> PLAYTESTED, archive the decomposition sheet, log Phase 7 closed in decisions.md.
- **The 5 architecture moves** (todo "Architecture review 2026-05-24"): #1 client-state layer is the next BIG initiative once Phase 7 closes.
- **Handed to HUNT-AND-PECK:** the 5th status chip (🩹 Lasting Wound, feed-derived) + tooltip polish.
- **Operator items owed by Xero** (carried, NOT re-arch): Upstash KV env vars in Vercel (prod verify-turnstile 503 until set); apply `sql/audit-log-table-2026-05-20.sql` to live.
- **CLI now linked** this session (`npx supabase db query --linked -f sql/<file>.sql` works) - useful diag probes written: `sql/diag-arena-readiness-2026-05-24.sql`, `sql/diag-arena-smoke-results-2026-05-24.sql`.

---

## (HISTORICAL) Grand Re-Arch phase-by-phase log
The sections below are the historical record of the re-arch (Phases 1-7), kept for reference. Current state is the summary above.

# (historical) Session state - 2026-05-23 (GRAND RE-ARCHITECTURE)

## Phase 6 status (cross-cutting cleanup)
- **console = DONE** (`730a172` + `bfc1529` + `a1e9f1e`, Xero's option B + decision (b) for error-surfacing). `trace(label, data)` in lib/playtest-recorder = the sanctioned console home (pushes a 'custom' recorder event; echo ONLY in NODE_ENV=development). All [playtest-trace] -> trace(); operational flow diagnostics -> trace(); error/SILENT-RLS surfacing -> console.error (visible in prod + recorder-captured); pure noise deleted. check-arch excludes lib/playtest-recorder (analogous to lib/data for .from). **console ratchet 115 -> 0.**
- **recorder gate = LEAVE widened** (Xero locked) - no action.
- **alert() placeholders = LEAVE as coming-soon stubs** (Xero locked) - no action.
- **PHASE 7 acceptance PARTIAL PASS (2026-05-24, Claude-driven 2-client on live Arena):** console SILENT on prod (tracked reload of /table = 0 log/warn, 0 errors; tracking verified working); trace() telemetry captured to the recorder buffer not console (Xero's dump shows nextTurn as kind:custom); realtime combat-start + token-move (TacticalMap, hardest seam) propagate GM->player live + console stays silent; presence works; wound-infection WARNING feed rows confirmed. Results in `tasks/phase7-rearch-acceptance-smoke-2026-05-23.md`. STILL OWED: end-of-combat infection MODAL for the wounded PC owner (handed to Xero - needs a fresh PC wound + END COMBAT, fragile to automate). Vehicle/communities/stockpile/map surfaces not yet smoked (pattern proven; lower-priority).
- **REMAINING (minor):** the 6 dead channelRef declares on the table page (3d leftover: channelRef/membersChannelRef/npcsChannelRef/revealChannelRef/communityMembersChannelRef/campaignChannelRef - declared-but-unused, harmless); the 13 react-hooks/exhaustive-deps suppressions (each a latent stale-closure now that realtime is centralized - review/justify each). Then **Phase 7** (the batched 2-client acceptance smoke - needs Xero; per-component smokes in todo.md + decomposition-2client-smoke-testplan.md).

## Autonomous run directive (Xero, 2026-05-23)
"Keep going from 3d all the way to Phase 7. Stop ONLY if you absolutely need me to smoke-test something, and only for critical issues." Drive P5 -> P6 -> P7, commit every verifiable step, keep this handoff current, **batch ALL 2-client smokes into the ONE Phase-7 acceptance**, do not stop between phases. Multi-window by nature - progress lives in git + this handoff + task list (#1-#5).

## Xero's Phase 6 decisions (locked 2026-05-23) - apply when you reach Phase 6:
- **Console stripping = option B (done right):** route telemetry OFF console - replace the diagnostic `console.warn('[playtest-trace] ...')` (and the useful debug lines) with an explicit `trace(label, data)` that pushes straight into the recorder buffer (console only in dev). Then strip ALL bare `console.*` from prod. Recorder workflow (GM starts -> player JSON dumps) is UNCHANGED; capture just gets explicit instead of monkey-patching console.warn. Convert the genuinely-useful lines ([damage]/[nextTurn]/[playtest-trace]) to trace(); delete pure noise ([kickCheck]/[crop]/one-offs).
- **Recorder gate = LEAVE widened** (all signed-in users) until launch. Do NOT narrow to isThriver now.
- **alert() placeholders = LEAVE** as "coming soon" stubs (Eat/Rest/Relax on campaign-sheet:395-405; Apprentice on CharacterCard.tsx:463 + page.tsx:5356). Don't remove, don't build. Revisit later.

## Phase 4 DONE (`be5b1d7`) - architecture locked
- CI gap closed: `.github/workflows/test.yml` now runs em-dash + preview-sync + `arch:check` + `arch:depcruise` (was font/role/tsc/tests only; ratchet had been local-hook-only).
- dependency-cruiser added (dev dep) + `.dependency-cruiser.cjs`: no-circular, lib-no-upward (app/components), components-no-route-internals, no-test-imports - ALL green (293 modules), locked as error. `npm run arch:depcruise`; also in the pre-commit hook.
- ADR: `tasks/architecture-target.md` (invariants -> fitness functions + the per-component reference checklist for Phase 5).

## Phase 5 COMPLETE (all 6 god-components); Phase 6 (cross-cutting cleanup) next

All six god-components now route DB through `lib/data/*` and realtime through `lib/realtime/*`. New repos: map, vehicle, npc-roster, community, tactical (+ the pre-existing campaign-npcs, character-states, moderation, roll-log). New realtime primitives: `usePostgresSubscription` (global/dynamic single-table watch), `broadcastOnce` (fire-and-forget typed send) alongside `useCampaignChannel`. events.ts registry now covers token_moved/vehicle_updated/firing_arc_toggle/tactical_zoom/tactical_view_share/gm_ping. Seam-leakage ratchet: `.from` 1263->1039, `.channel` 44->22 (remaining are non-god-component files + the documented presence-channel exception on the table page). All migrations behavior-preserving; the realtime ones (vehicle, NpcRoster, CampaignCommunity, TacticalMap) need their 2-client validation in the batched Phase 7 acceptance.

**Phase 6 (Xero's LOCKED decisions, apply now):** console = option B - replace the diagnostic `console.warn('[playtest-trace]...')` + useful debug lines with an explicit `trace(label, data)` that pushes into the recorder buffer (console only in dev), then strip ALL bare `console.*` from prod (115 in the ratchet). Recorder gate = LEAVE widened (all signed-in users) until launch. alert() placeholders = LEAVE as coming-soon stubs. Also: the 6 dead channelRef declares on the table page from 3d, the 13 exhaustive-deps suppressions (each a latent stale-closure now that realtime is centralized).

**Phase 7 (needs Xero):** the batched 2-client acceptance smoke across every realtime surface. See todo.md "PHASE 7 SMOKE - vehicle realtime" + the per-component smokes; tasks/decomposition-2client-smoke-testplan.md Parts 1-3.
- **`app/moderate/page.tsx` data seam COMPLETE 2026-05-23** (`b59d147` reads, `d3aa2ac` actions): 54 `.from` -> 0 table queries, all behind new `lib/data/moderation.ts` (counts/loaders/hydration helpers + update/delete/notify actions). Behavior-preserving, tsc clean, ratchet `--save`d. Reusable `usernamesByIds`/`campaignNamesByIds` helpers live there.
- **`components/MapView.tsx` data + realtime seams COMPLETE 2026-05-23** (`4b528f9`): 36 `.from` (28 DB + 7 storage + 1 `Array.from`) -> 0, 2 global `.channel` -> 0. DB+storage behind new `lib/data/map.ts`; the 2 GLOBAL postgres channels (whispers_feed, map_pins_changes - NOT campaign-scoped, so useCampaignChannel didn't fit) behind new `lib/realtime/usePostgresSubscription` primitive (sentry-wrapped, handler-fresh-via-ref, churns only on channelName). Behavior-preserving + better observability (old raw channels had no Sentry wrap). tsc clean, 548 tests, ratchet `--save`d (`.from` 1218->1182, `.channel` 34->32, MapView LOC 2042->2023). Technique captured in lessons.md top entry. No unit tests on MapView -> Phase 7 smoke is its behavior gate.
- **`app/vehicle/page.tsx` data + realtime seams COMPLETE 2026-05-23** (`deed757` data, `91e85fc` realtime): 14 DB `.from` -> `lib/data/vehicle.ts`; all 6 `.channel` -> seams (long-lived vehicle_ postgres -> usePostgresSubscription; long-lived tactical_ -> useCampaignChannel w/ tacticalChannelRef aliased to handle.channelRef; 4 ephemeral senders -> new `lib/realtime/broadcastOnce` typed helper w/ holdMs). events.ts gained token_moved/vehicle_updated/firing_arc_toggle + tightened turn_advance_requested. COMBAT-ADJACENT (shared tactical_/initiative_ channels) - 2-client smoke owed at Phase 7 (steps in todo.md "PHASE 7 SMOKE - vehicle realtime"). localStorage+BroadcastChannel belt-and-suspenders preserved verbatim. `supabase` var stays (2 RPCs + decrementInitiativeAction; not `.from`/`.channel`, Phase 6/optional). Ratchet `.from` 1182->1168, `.channel` 32->26.
- **`components/NpcRoster.tsx` data + realtime seams COMPLETE 2026-05-23** (`d92aba5`): 46 DB `.from` (8 tables) + 2 storage -> new `lib/data/npc-roster.ts` (reusing campaign-npcs.ts updateCampaignNpc/insertCampaignNpcs for single-id ops); the npc_roster_${id} channel (2 postgres subs) -> useCampaignChannel `postgres[]` array (dropped the stale isGM dep). supabase var stays (persistNpcSort/persistNpcFolder); 2 console.warn defer to Phase 6. Ratchet `.from` 1168->1120, `.channel` 26->25.
- **`components/CampaignCommunity.tsx` data + realtime seams COMPLETE 2026-05-23** (`a62f65c`): 56 DB `.from` across 13 tables -> new `lib/data/community.ts`; the dynamic-IN-filter `stockpile-${id}` channel -> usePostgresSubscription keyed on the community-id SET (so the filter resubscribes when communities change). supabase var stays (logManualPost/logMigration/logSchism/appendProgressionEntry take it); 3 console.* -> Phase 6. Ratchet `.from` 1120->1067, `.channel` 25->24.
- **NEXT (LAST ONE): `components/TacticalMap.tsx`** (4315 LOC, hardest - ~28 `.from`, 2 ch / 7 bcast / 6 pg). The combat-critical `tactical_${id}` channel + token broadcasts - careful, treat like the vehicle realtime. Uses the same `token_moved`/`firing_arc_toggle`/`vehicle_updated` events ALREADY in events.ts (TacticalMap currently sends them via raw `tacticalChannelRef.current?.send(...)` - migrate to useCampaignChannel + alias the ref, exactly like vehicle did). Data seam first (new lib/data table repos or reuse campaign-npcs/community/etc), then realtime. After this, Phase 5 is DONE -> Phase 6 (console/recorder/alert cleanup per Xero's locked decisions) -> Phase 7 (batched 2-client acceptance). Toolkit complete: useCampaignChannel (broadcast+postgres incl. `postgres[]`), usePostgresSubscription (global/dynamic single-table), broadcastOnce (fire-and-forget). Technique in lessons.md top 4 entries.

### (superseded) moderate recon notes
**`app/moderate/page.tsx` (1726 LOC, 54 `.from`, 0 `.channel`, 3 console) - the approach (recon'd, executed above):**
- It's a 9-section moderation dashboard (users/rumors/npcs/communities/modules/forums/warstories/lfg/bugs). Queries are VARIED + interleaved with orchestration, so: **repo extraction** into `lib/data/moderation.ts` (query -> repo fn, KEEP the Promise.all / conditional-hydration / optimistic-setState orchestration at the call site - standard seam pattern, behavior-preserving).
- **Reusable helpers to build:** `usernamesByIds(ids)` (the `profiles.select('id,username').in('id',authorIds)` two-step hydration, repeated 4x), `campaignNamesByIds(ids)` (the `campaigns.select('id,name').in('id',campaignIds)`, repeated 4x). Plus `moderationPendingCounts()` (the 9-count Promise.all -> counts object), per-section loaders (`loadPendingWorldNpcs`, `loadBugReports`, etc.), and the actions (`setBugReportStatus`, `setWorldNpcStatus`, pin approve/reject, `deleteX`, suspend/role-change on profiles, notification inserts).
- **ORDER: reads first** (counts + all loadX selects + hydration helpers = ~20 queries, NON-destructive, safe) as one commit; **then the write/delete/suspend actions** as a second careful commit (these touch user-content deletes + bans = bright-line-adjacent; preserve every `.eq` filter verbatim, review each).
- **No test coverage on moderate** - nets are tsc + arch ratchet (.from drops) + dep-cruiser + the Phase-7 smoke. Do it with FRESH focus, not deep in a window.
- Then `--save` the ratchet, run the ADR reference checklist.

## Phase 5 remaining - the other 5 god-components (ascending difficulty)
Order: `app/moderate/page.tsx` (1726, NO realtime - easiest) -> `components/MapView.tsx` (2041) -> `app/vehicle/page.tsx` (2110) -> `components/NpcRoster.tsx` (2301) -> `components/CampaignCommunity.tsx` (3158) -> `components/TacticalMap.tsx` (4314, hardest). Per component, behavior-preserving: `.from(` -> `lib/data/*`, `.channel(` -> `useCampaignChannel`, extract logic to hooks/lib, gut to dumb component / thin route. **Reuse the proven techniques:** the B3 byte-exact script-move + destructure-deps + tsc-convergence (lessons.md "God-component function extraction"), and the 3d channel->useCampaignChannel pattern (handlers take the payload arg directly; tighten event payload types in lib/realtime/events.ts so tsc verifies). Run the ADR reference checklist at the end of each. Ratchets enforce monotonic improvement; smokes batch to Phase 7. Each component is its own commit(s); --save the ratchet as numbers drop.

## 3c-B smoke result (2026-05-23, Xero, 2 clients): PASS
All executeRoll paths clean (damage, mortal-wound, auto-advance, no errors; pasted console = expected [playtest-trace] noise). Extraction validated behavior-preserving. ONE failure logged PRE-EXISTING (not 3c-B): wound-infection check did not fire at end of combat (Xero confirmed player owned the wounded PC + watched + no modal). The infection_check_request rides the ad-hoc init channel -> likely the resubscribe bug class **3d fixes**. Bisect: did "<name> is wounded and may have to deal with infection" rows show in the feed during the fight? (todo has full write-up + sql/diag-wound-infection-2026-05-23.sql.)

## 3d COMPLETE (table realtime -> lib/realtime/useCampaignChannel)
- **3d.1 (`efb8673`)** standalone scene-tags + advantages channels.
- **3d.2a (`a645c4d`)** the 6 postgres channels (table/members/campaign/campaign_npcs/community_members/reveals) out of load().
- **3d.2b (`30e4b5b`)** the 230-line initiative channel (initiative_order + notifications + 21 broadcasts), gated on userId, initChannelRef aliased to the handle's channelRef (all .send sites + useRollResolution untouched), 6 event payload types tightened in lib/realtime/events.ts. tsc-verified every handler.
- Net 3d: page.tsx 12663->10553 across the whole re-arch; `.channel outside lib/realtime` 44->34. **Only the raw `presence_table_${id}` channel remains hand-managed on the page** (useCampaignChannel has no presence support - Phase 4 dep-lint must either whitelist it or a small usePresenceChannel primitive must be added FIRST).
- **Likely infection-bug fix:** infection_check_request now rides the stable [userId/id] subscription instead of the churning load() channel - the resubscribe-miss that dropped the broadcast should be gone. CONFIRM in the Phase 7 smoke (the bisection question - did warning rows appear in the feed - is still worth answering).
- **Dead refs to sweep in Phase 6:** channelRef, membersChannelRef, npcsChannelRef, revealChannelRef, communityMembersChannelRef, campaignChannelRef are now declared-but-unused (harmless; no noUnusedLocals).
- **Deferred (optional L3 polish, NOT blocking P4/5/7):** useTacticalSync / useInitiative / useCampaignState carve-offs + thinning page.tsx to <400 lines. The realtime + roll cores are migrated; further hook extraction is lower-value than propagating the seams to the other 6 god-components (Phase 5).

## (historical) 3d.2 plan as executed - the 7 load()-embedded channels + teardown:
  - postgres-only: `table_${id}` (character_states->loadEntries), `members_${id}` (campaign_members; async handler refetches members+ensureCharacterStates+loadEntries), `campaign_${id}` (campaigns), `campaign_npcs_${id}` (40-line handler ~1559-1600), `community_members_${id}` (loadPlayerNpcCommunityMap), `reveals_${id}` (CONDITIONAL GM-vs-player; handler uses cnpcs -> swap to `campaignNpcs` state + myCharIdRef/gmLikeRef).
  - the big one: `initiative_${id}` (~1298-1527) = 2 postgres (initiative_order->loadInitiative; notifications filter `user_id=eq.<userId>`) + ~20 broadcasts. Restructure `.on('broadcast',{event:X},wrapBroadcast('X',h))` -> `broadcasts:{X:h}` (primitive auto-Sentry-wraps; STRIP the wrapBroadcast/wrapDbChange wrappers). Handler bodies UNCHANGED.
  - **GOTCHAS:** (1) notifications sub needs userId -> gate the init useCampaignChannel on `userId ? id : null` (matches current behavior - load() runs after getUser). (2) **KEEP `initChannelRef` working for the many `.send()` sites + the useRollResolution hook**: alias `const initChannelRef = initChannel.channelRef` (the handle's escape-hatch ref) so every existing `initChannelRef.current?.send(...)` is untouched. (3) `presence_table_${id}` (~1611) uses the presence API - useCampaignChannel does NOT support presence; LEAVE it raw OR add a small usePresenceChannel primitive (Phase 4 dep-lint will need presence handled - decide then). (4) tighten `infection_check_request` payload in lib/realtime/events.ts to `{ targetUserId: string; name: string; amod: number }` when migrating its send (page.tsx:2655) - tsc will guide. (5) remove the migrated channels from load() + the teardown block; keep load()'s non-channel logic intact.
  - After 3d.2: `node scripts/check-arch.mjs --save` (.channel drops toward ~1 [presence] + whatever else). The infection fix likely falls out of the stable init subscription - verify in P7 smoke.

**The whole-platform re-architecture is the ONLY active work** (Xero mandate Q1-B: every god-component to the ideal layered architecture before the next playtest; break-things-OK; Xero 2-client-smokes everything at the end). Executable spine: **[tasks/grand-rearchitecture-2026-05-22.md](grand-rearchitecture-2026-05-22.md)** - read first.

## Current main HEAD
Derive it: `git rev-parse --short HEAD` (was `e6919e5` at write; `wc -l "app/stories/[id]/table/page.tsx"` = 10730; 548 vitest green; CI green). **Arch LOC ratchet GREEN** (page ceiling re-baselined to 10731; `.from` 1263, console 115). Normal `git commit` works; the relaxed-ratchet protocol is RETIRED.

## Where we are (Phase 3)
- DONE earlier: Phase 1 seams, Phase 2 gating, mechanical `.from` migration, `useGmTools` Part A, **3a** GM-view (`cde8003`) + **3b** nextTurn perf (`e3a9df0`), **3c-A** itemized-CMod + NPC-defense + blast-log batch (`c47cdca..d75ff75`) - ALL confirmed in the 2026-05-23 smoke.
- **DONE THIS WINDOW - 3c-B COMPLETE (B1+B2+B3, all behavior-preserving, NOT yet smoke-validated):**
  - **3c-B1 (`35b72fe`)** - retired the 3 dead executeRoll branches (Distract/Stabilize/Gut-Instinct) + 2 dangling traitNotes spreads. Applied `claude/phase4-prestage`'s INTENT directly; **that branch is obsolete, can be deleted**. page.tsx 12663->12564.
  - **3c-B2 (`6de30a8`)** - `resolveTargetDefense` + `computeAttackCmod` to `lib/table-roll-context.ts` (pure, +16 tests, 532->548); call sites pass `AttackCmodCtx` via `cmodCtx()`. page.tsx 12564->12527.
  - **3c-B3 (`e6919e5`)** - `executeRoll` (~1810 lines) extracted to `app/stories/[id]/table/hooks/useRollResolution.ts` behind a typed `RollResolutionDeps` (51 deps). Body relocated BYTE-FOR-BYTE (script-verified identical to git-HEAD's executeRoll); 2 call sites unchanged; `syncedSelectedEntry` hoisted to the call site (TDZ). page.tsx 12527->10730; ratchet `--save` (page ceiling 10731); `.from` 1263 + console 115 UNCHANGED (no seam regression). Extraction method in lessons.md ("God-component function extraction") - reuse for Phase 5.
  - Lessons captured: shadow-rebind footgun (`f8e8033`), the extraction technique. Ledger drained to 548/29.
- **OPEN (classified, no action unless smoke contradicts):** GM-rolled NPC attack `+5 CMod` generic = manual GM entry (autoNet=0); NPC defense IS wired via prefill `computeAttackCmod`. No prefill change. Also: a preserved Group-Check stale-closure read (prefill passes the PREVIOUS roll's label) rode into the hook unchanged - the deeper pure/effect split is where it gets fixed, NOT done in B3.
- **NEXT:**
  - **Xero 2-client smoke of 3c-B** - testplan: [tasks/3c-b-executeroll-smoke-testplan-2026-05-23.md](3c-b-executeroll-smoke-testplan-2026-05-23.md) (combat math end-to-end: Aim/Cover/Range CMod, NPC defense, grenade blast + fumble, infection, lasting wounds, coordinated effort, insight dice 3d6/+3, mortal-wound + stress, auto-advance). B1/B2/B3 all fold into this ONE smoke (each behavior-preserving). If it passes, 3c is done.
  - **3d (separate FRESH window, own smoke)** - migrate the 11 channels / 23 events onto `lib/realtime/useCampaignChannel` (deps `[campaignId]`); then `useTacticalSync` + `useInitiative` carve off the now-owned `initiative_${id}` channel.
  - Then **Phase 4** (dep-cruiser lock) + **Phase 5** (the other 6 god-components, using the B3 extraction technique).

## Two operator actions still owed by Xero (code shipped, infra pending)
1. **Upstash KV** in the Vercel dashboard (L-3 rate limiter) - until done, prod `/api/auth/verify-turnstile` returns 503. See `tasks/l3-kv-ratelimiter-testplan-2026-05-20.md`.
2. **Apply `sql/audit-log-table-2026-05-20.sql`** to live.

## Other open threads (lower priority than the re-arch)
- Modal visual consistency (all `<RollModal>` to the ATTACK ROLL shape); throw-time grenade auto-decrement; Xero soft-delete + invite rulings (Y11-a/e + invite-code SPEC-READY in `tasks/todo.md`, schema-touching = confirm first); Lost Eye + Crippled lasting-wound narrative overrides (awaiting Xero canon confirm).

---

What's next?
