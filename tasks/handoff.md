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

# Session state - 2026-05-21 (combat smoke bug batch + morning ships)

## Current main HEAD

`7503179 fix(combat): smoke bug batch - self-blast turn-stall, coord-effort lead banner, faction-aware friendly-fire`

(Plus this handoff commit on top.) One pre-staged branch still sitting unmerged:
- `claude/phase4-prestage` at `3671c68` - retires the legacy executeRoll branches for Stabilize / Distract / Gut Instinct (-108/+12). **Do NOT merge before the Monday 2026-05-25 playtest verifies all three dedicated modals.** Merge command in `tasks/todo.md`.

The `claude/combat-smoke` worktree is merged and safe to remove (`git worktree remove .claude/worktrees/combat-smoke`); keep it only if you want to flip the SMOKE-3 design (see below).

## What shipped 2026-05-21

Two clusters, in order.

### Morning - encumbrance + narrative trims + grenade-qty
| Commit | What |
|---|---|
| (enc fix) | Over-encumbrance RP-drain canon restored: `lib/encumbrance.ts` adds `overBy`; the Advance-Time tick drains `hours * overBy` RP/h (was flat `hours`). Canon prose added to `app/rules/character-overview/secondary-stats` + regenerated `tasks/tapestry-rules-canon.md`. 13 encumbrance tests. |
| (log trims) | Three feed-narrative wording fixes: mortal-wound row ("...will die if not stabilized in N rounds"), infection ("will be sick for N days"), Coordinated Effort LI ("kicks off ... but <first> has a Moment of Insight"). |
| `1d84eb6` | `feat(npc):` grenade/molotov carry-quantity on the NPC weapon slot (Xero ruling #1 - count on the slot, not inventory). |
| `1fa9292` | `feat(pc):` same carry-quantity on the PC weapon slot. |
| `d29b823` | `docs:` grenade-qty testplan + todo (shipped + throw-time auto-decrement follow-up). |

### Afternoon - combat smoke bug batch (the puffer-fish handoff; all 3 done)
Single commit `7503179`:
- **SMOKE-1 (was stalling combat):** an active combatant who self-downs in their own grenade blast is a SPLASH victim, so the per-target auto-advance (page.tsx ~L5546 PC / ~L5613 NPC) never fired. The blast Pass-3 loop now tracks `activeDownedByBlast` and fires `nextTurn` after the writes land. No double-advance (closeRollModal sees the roller is no longer active and skips its consumeAction). MW combatants stay in the rotation (stabilizable).
- **SMOKE-2:** a lead-only Coordinated Effort now renders as a banner immediately (new lead-only renderer in `RollsFeed.tsx`, reuses `compactRollSummary` for the locked wording) instead of a plain row that morphed into a banner once a participant rolled.
- **SMOKE-3:** the friendly-fire warning is now faction-symmetric. PC thrower -> other PCs; NPC thrower -> other NPCs; the opposing faction never prompts. `page.tsx` builds the matching list, `TacticalMap.tsx` scan now checks both PC and NPC tokens.

Testplan: `tasks/combat-smoke-batch-testplan-2026-05-21.md`. Type-clean, 476/476 vitest, all guardrails green (font / role / em-dash / preview-sync).

## One open decision (SMOKE-3)

The handoff said "check with Xero." I shipped **faction-symmetric** (an NPC throwing near its OWN NPCs still warns the GM, mirroring the PC experience). If Xero would rather an NPC thrower get NO friendly-fire prompt at all (the GM sees the whole board anyway), it is a one-line flip in `page.tsx` (set `friendlyNpcIds = []` for NPC throwers). Awaiting Xero's call.

## Open threads (this lane)

### Queued - puffer-fish handoff "ALSO QUEUED" (priority order)
1. **Modal visual consistency** - all `<RollModal>` instances to match the ATTACK ROLL modal shape. Largest of the queued items.
2. **Throw-time grenade auto-decrement** - follow-up to grenade-qty: decrement the slot count when a grenade is actually thrown.
3. **Xero soft-delete + invite rulings (7 items)** - in `tasks/todo.md` under "Xero soft-delete + invite rulings 2026-05-20". Three are SPEC-READY (Y11-a character_states preserve, Y11-e roll_log session-archive, Invite-code HYBRID); Y11-b/c/d are smaller. Schema-touching = always-confirm-first bright line.
4. **Decomposition leaf batching** - lower priority; coordinate with the puffer-fish decomposition plan.

### Awaiting Xero canon confirmation
- **Lost Eye + Crippled `LASTING_WOUND_NARRATIVE` overrides** (per the Skittish principle locked 2026-05-20). Candidate phrasings in `tasks/todo.md`.

### Blocked on Monday 2026-05-25 playtest
- The combat-smoke batch (SMOKE-1/2/3) - manual smoke per `tasks/combat-smoke-batch-testplan-2026-05-21.md`.
- All 4 modal migrations (Stabilize / Distract / Gut Instinct / Vehicle) - per per-modal testplans dated 2026-05-20.
- Phase 4 cleanup merge (`claude/phase4-prestage`) - gated on the 3 modals verifying clean.
- 2026-05-19 batch carry-forward (~50 commits).

### Two operator actions still owed by Xero (code shipped, infra pending)
1. **Upstash KV** setup in the Vercel dashboard (L-3 rate limiter). Until done, prod `/api/auth/verify-turnstile` returns 503. See `tasks/l3-kv-ratelimiter-testplan-2026-05-20.md`.
2. **Apply `sql/audit-log-table-2026-05-20.sql`** to live (re-link the supabase CLI or paste into the dashboard SQL editor).

### Blocked on puffer-fish
- DamagePayload D3 steps 2-11 (spec needs the per-writer reshape + the VehicleCheck Option A/B/C ruling).

## Suggested next moves (in order)
1. Get Xero's SMOKE-3 ruling (symmetric vs suppress) - one-line either way.
2. Pick up **modal visual consistency** (biggest queued win) OR **throw-time grenade auto-decrement** (small, closes the grenade-qty loop).
3. Monday 2026-05-25 playtest - smoke the combat batch + the 4 modal migrations, then merge `claude/phase4-prestage` if clean.
4. Triage what the playtest surfaces via `tasks/debug-handoff.md` Sec 4 (Triage Playbook, 15-min revert-first rule).

---

What's next?
