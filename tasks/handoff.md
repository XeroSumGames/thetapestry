# TheTapestry handoff

**This is the single file to paste into a fresh chat.** Two sections: evergreen (role briefing, locked rules, canon, protocol - sharpened in place when corrections surface) and session state (current commits, what's untested, what's blocked - rewritten each session). Maintained by Claude; pasted as-is by Xero.

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
- **Handoff = ONE file Claude maintains.** `tasks/handoff.md` is the single paste target. Never tell Xero to paste two files, combine pieces, or "open Notepad." Rebuild this file at session end and commit it.
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

## Sharpening hook

At session end (or whenever Xero asks for a fresh handoff), propose **ONE** edit to the evergreen section of this file. Sources:

- Any correction Xero gave during the session -> new locked rule.
- Recurring process friction (asked the same clarifying question twice) -> response-protocol tweak.
- Canon I had to re-derive from PDFs -> new locked-canon entry.
- Tool I should have reached for sooner -> reference-files edit.

Apply the edit directly. Show diff + one-line "why" in chat.

Then rewrite the **Session state** section below from scratch with latest commits + open threads. Commit the whole file. Xero pastes it as-is into the next chat.

Aim: evergreen section stays under ~150 lines. Merge new rules into existing ones rather than appending.

---

# Session state - 2026-05-13

## Current main HEAD

`5259926 docs(handoff): single combined paste target at tasks/handoff.md`

## What shipped in the 2026-05-12 / 2026-05-13 session

| Commit | What | Risk |
|---|---|---|
| (local) | Pre-commit hook at `.git/hooks/pre-commit` (font + role-literal guardrails) | None - hook proven to fire from worktrees |
| `bc24db9` | Skill chip hover tooltips on CharacterCard (native `title` attribute) | Cosmetic |
| `3d0ea42` | `tasks/roll-feed-log-preview.html` pinned as canonical log template | Docs |
| `d77d9cd` | **Phase 3a** - table "Advance Time" modal now ticks the campaign clock | **Untested live** |
| `aa20bdb` | **Phase 3b** - rations consumption drainer on day-tick | **Untested live** |
| `36feee3` | **Phase 3c** - subsistence damage drainer (CRB Ch.07 p.117) | **Untested live** |
| `80bc8f3` | **Phase 3d** - community Skip Week now ticks campaign clock 168h | **Untested live** |
| `e2fd0f8` | Feed audit: 6 easy drifts (sentinel case, init col, "Morale holds.", etc.) | **Untested live** |
| `e979b04` | Feed audit: 4 judgment-call resolutions (template + recruit-LI MOI tag) | **Untested live** |
| Various docs | Testplans, lessons, todo updates, single-file handoff rebuild | Docs |

## Verified vs untested

- **Verified:** pre-commit hook (fires on commit, blocks bad commits); skill tooltips visible on CharacterCard.
- **Untested on live:** Phase 3 a/b/c/d + 10 feed-audit drift fixes. Both touch what users see in roll_log and what PCs have in WP/RP and rations. Worth one playtest before stacking more work.

## Risks the next session should know

- **`out_since_day` math** in Phase 3c. A PC with `rations.count = 0` *before* the Phase 3 ship has no `out_since_day` stamped, so 3c won't apply subsistence to them until they go through the rations-hits-0 transition again. The drainer documents this as a known no-op, but if a GM expects their starving PC to start taking damage immediately, they won't see it until the PC eats and re-runs out.
- **Skip Week's new prompt** warns about the 7-day clock advance + downstream effects. Existing GMs may have built habits around the old "pure bookkeeping" semantics; flag in playtest if anyone's surprised.
- **Recruit LI MOI tag** - the new LI branch adds the canon-required tag; rows with old `outcome: 'recruit'` AND `rollOutcome: 'Low Insight'` written *before* `e979b04` lack the tag and won't retroactively pick it up. Acceptable: only affects historical rows.

## Open threads

### Blocked on Xero design calls
- **Playtest-marks system** (4 Qs): who sees whose marks; auto-tag campaign/scene/story; visible button + hotkey vs hotkey-only with louder toast; retention forever or auto-prune. Recorder gate currently silently drops marks - real bug, real fix is a `playtest_marks` Supabase table.
- **Healing on GM time-tick** (5 Qs): which rolls count; recovery math; time-advance trigger; healer-vs-target attachment; stack vs overwrite.
- **Coordinated Effort** (4 Qs): who picks skill; opt-in prompts; timeout behavior; fold into Group Check redesign or separate.
- **Group Check redesign** (4 Qs): Insight Dice on helper rolls; HI/LI awards on helpers; skill-0 helpers; replace current Group Check or add as second mode.
- **GM Notes / Assets merge** (3 options): unify into single tab; cross-link; leave as-is.

### Blocked on playtest captures
Bugs instrumented with `[playtest-trace]` console prefix on 2026-05-11 (commits `aaa29af`, `63a0b05`). Capture data not yet delivered:
- Initiative lag (`[nextTurn] done` payload)
- Damage calc `2+2d6(6)=8 raw -> should be 7/7`
- Failed-check leaves 2 actions (`[closeRollModal] gate`)
- TacticalMap mouse-pan

### Multi-day builds ready to start
- **VehicleSheet refactor** (~half day, real `useSearchParams` lift risk - plan-mode first)
- **Log template scope (a)** - "Export session log" button (~1 day)
- **CRB Tier 1 canon promotions** (9 items, see `tasks/todo.md` flagged 2026-05-09; highest-value gap is #2 Vehicle subsystem - pairs with VehicleSheet refactor)

### Lower-priority sweeps
- CRB doc-rewrite tracking (DMM/DMR -> MDM/RDM sweep, Intimidation removal, Profession 7->5 bundles, etc. - all doc fixes, not platform builds)
- Older flagged items in `tasks/todo.md` (re-verify before acting; some shipped per MEMORY)

## Suggested next moves (in order)

1. **Real playtest** to verify Phase 3 + the feed audit changes in one go. No code; observe rations decrementing, subsistence firing on day-3-hungry PCs, log feed renders match the template.
2. **VehicleSheet refactor** if you want orthogonal work that won't compound on today's surfaces.
3. **One judgment-call answer** from the blocked list above unlocks whichever sub-build feels most pressing.

---

What's next?
