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

- `tasks/handoff.md` - this file (single paste target; Claude maintains it)
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
- `lib/playtest-recorder.ts` + `components/PlaytestRecorder.tsx` - telemetry only. `Ctrl+Shift+M` marks are per-browser localStorage with no central collection; silently drop when gate is off. Don't trust for player feedback - a `playtest_marks` Supabase table is the right shape if asked.
- `.git/hooks/pre-commit` - local hook (not in git), runs `check-font-sizes.mjs` + `check-role-literals.mjs` on every commit.
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

# Session state - 2026-05-15

## Current main HEAD

`67552ab chore(todo): mark player-notes-session-tag migration applied 2026-05-15`

## What shipped in the 2026-05-14 / 2026-05-15 audit-and-followup arc

Stretch driven by a 4-agent cold audit (bugs/perf/dead/refactor) plus three sub-batches of remote agent runs scheduled against it. Most ships are perf-only and rendering-output-identical by design, but the TacticalMap canvas caching is non-trivial and worth one playtest before stacking more.

| Commit | What | Risk |
|---|---|---|
| `0827fcc` `d23908c` | Drop superseded `update-player-joined-trigger.sql` v1/v2 (v3 covers) | None |
| `9028295` | Drop superseded `build-open-work-docx.py` (dated `-2026-05-06` variant supersedes) | None |
| `8caef7f` | Cleanup sweep summary | Docs |
| `71b5a0e` `3cc47ac` `51206aa` `85a0617` | Role-helper consolidation: 30+ inline `.role?.toLowerCase() === 'thriver'` sites -> `roleIsThriver()` across app/, app/tools/, app/moderate/, components/ | Low (semantics-preserving) |
| `a0f37f2` | **Guardrail tightened:** `scripts/check-role-literals.mjs` now catches inline lowercase comparison drift too, not just capital-case literals. Allowlist still via `role-literal-allow` line comment. | None |
| `fb29f09` | Role-helper consolidation summary | Docs |
| `49a9733` | `perf(queries):` column-pick `character-sheet` `select('*')` (characters + character_states; campaign-sheet was already column-picked) | Low |
| `2194d63` | `perf(campaign-sheet):` 200ms debounce on realtime refetch (`scheduleRefetch` ref + `loadParty`/`loadPending` wrapped in `useCallback`) | Low |
| `ef8f300` | A1 summary | Docs |
| `ce5e33f` | `perf(stories-table):` memoize NpcRoster prop construction (4 `useMemo` for Set/array props, 2 `useCallback` for handlers; 7 callback props flagged but skipped to avoid cascade) | Low |
| `ad116c3` | A2 summary | Docs |
| `6465079` | A3 no-op: 24-dep useEffect from the original audit doesn't exist in stories-table. Max dep count = 4. Audit finding was bogus. | None (no-op) |
| `c5041e5` | `perf(tactical-map):` cache move/throw/blast cell-zone overlays (`moveZoneCacheRef`, `throwZoneCacheRef`, `blastZoneCacheRef`; keyed on grid pos + range + grid dims + occupied cells; blast renders batched red-then-amber) | **Untested live** |
| `ab7e0c9` | `perf(tactical-map):` cache fog visibility bitmap (`fogVisibleCacheRef` keyed on day-mode + all-PC-positions+sight + walls + cell blockers; ~6700 LoS checks/frame eliminated on cache hit for 20x20 / 4 PCs) | **Untested live** |
| `5b04678` | A4 summary | Docs |
| `c455b13` | Merge `perf/tactical-map-canvas` | - |
| **LIVE DB** | `sql/initiative-order-rls-members-write.sql` + `sql/initiative-order-rls-tighten-2026-05.sql` applied. `pg_policies` verified: SELECT/INSERT/UPDATE for campaign members, DELETE GM-only, ALL thriver bypass. Legacy permissive `"Anyone authenticated can manage"` dropped. Nana 2-attack repro path closed. | **Verified via pg_policies** |
| `5d42507` | Mark initiative-order RLS migrations applied in todo.md | Docs |
| **LIVE DB** | `sql/player-notes-session-tag.sql` applied. `session_number` int column + `player_notes_stamp_session` BEFORE INSERT trigger + `player_notes_session_idx` partial index. PostgREST schema reloaded. | **Verified via information_schema + pg_trigger** |
| `67552ab` | Mark player-notes migration applied in todo.md | Docs |

Side-branches at `origin/perf/column-pick-and-debounce`, `origin/perf/npc-roster-memo`, `origin/perf/tactical-map-canvas`, `origin/role-helper-consolidation-2026-05-14` are now fully merged. Safe to delete or leave as paper trail.

## Verified vs untested

- **Verified via DB queries:** initiative_order RLS policy state; player_notes `session_number` column + trigger present.
- **Verified by passing pre-commit hooks:** role-literal guardrail (tightened) passes on 248 files.
- **Untested on live:** TacticalMap canvas caches (move/throw/blast + fog visibility). Rendering-output-identical by construction but cache-invalidation keys are non-trivial. Worth one combat playtest before more TacticalMap work.
- **Untested from previous session (still):** Phase 3 a/b/c/d + 10 feed-audit drift fixes carried forward from 2026-05-13. No playtest in between.

## Risks the next session should know

- **TacticalMap cache invalidation surface area.** Three caches added today, each with a string key built from inputs. If a render bug shows up that involves stale cells (moved token still shows old movement zone, fog stuck after a wall move), the keys at `components/TacticalMap.tsx:392-394` and `~1356-1404` are where to look.
- **A4's 3 new findings flagged for follow-up** in `tasks/perf-a4-tactical-map-2026-05-14.md`: `effective` fog map still O(n^2) at lines 1414-1420; `getWeaponByName` called inside `draw()` at 1177/1184; `ResizeObserver.observe` bypasses rAF coalescing at 956. Low priority; do in one tight agent pass when convenient.
- **Cold audits are noisy.** Two findings from the cold audit were already-done (NpcRoster `memo` wrap, campaign-sheet column-pick), one was hallucinated (24-dep useEffect), and one was misframed (29-dep `draw()` useEffect - every dep actually drives output). Treat any specific `file:line` claim from a cold audit as a hypothesis, not a fact. Tightened audit prompts to "quote 2 surrounding lines so user can spot-verify" - apply same pattern if running another cold audit.
- **Remote agents keep going to feature branches** despite explicit "push to main" instruction. C, A1, A2, A4 all branched. Easier to accept and merge than fight it. Three of those got named branches per a fallback clause; one (`role-helper-consolidation-2026-05-14`) used its own name.
- **Carried-forward 2026-05-13 risks (still active):** `out_since_day` math in Phase 3c, Skip Week prompt semantics, Recruit LI MOI tag retroactive. See git history of this file pre-2026-05-15 if context needed.

## Open threads

### Blocked on Xero design calls (unchanged from 2026-05-13)
- **Playtest-marks system** (4 Qs)
- **Healing on GM time-tick** (5 Qs)
- **Coordinated Effort** (4 Qs)
- **Group Check redesign** (4 Qs)
- **GM Notes / Assets merge** (3 options)

### Blocked on playtest captures (unchanged)
- Initiative lag (`[nextTurn] done` payload)
- Damage calc `2+2d6(6)=8 raw -> should be 7/7`
- Failed-check leaves 2 actions (`[closeRollModal] gate`)
- TacticalMap mouse-pan

### Audit follow-ups (new, low priority)
- A4's 3 new findings (see Risks above)
- A3's alternative angles if perf on stories-table is still wanted: shallow-equality on `setEntries`, split the 435-line mount effect at L1128 by concern, `useCallback` on `loadEntries`

### From this morning's todo audit (`8899809`)
- **Bugs:** Print sheet renders blank (hydration), Distemper font missing in mobile navbar, Insight Dice cap hardcoded to 9 in CharacterCard + executeRoll, HP render lag from `b4d4671`
- Phase 3 Table Completion: huge list (combat actions, NPC roster, campaign management, session history) - long-term work

### Multi-day builds ready to start (unchanged)
- VehicleSheet refactor (~half day, useSearchParams lift)
- Log template scope (a) - Export session log button (~1 day)
- CRB Tier 1 canon promotions (9 items)

## Suggested next moves (in order)

1. **Playtest the unverified surfaces.** TacticalMap canvas caching + the still-untested 2026-05-13 Phase 3 + feed audit changes. One real combat session would clear all of it in 30 min.
2. **Insight Dice cap removal.** Two specific edit sites called out in todo (`CharacterCard` `max={9}`, `executeRoll` `Math.min(..., 9)`). Quick concrete fix; clarify "remove cap" = uncap entirely or raise to N before shipping.
3. **A4 follow-up findings** if you want to drain the last drops from the perf audit. One tight remote-agent run.
4. **Pick a blocked-on-design call** and answer it. Unlocks the largest remaining build queue.

---

What's next?
