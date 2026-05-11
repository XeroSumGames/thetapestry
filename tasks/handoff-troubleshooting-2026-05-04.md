# Troubleshooting handoff — 2026-05-04

Written end of session. Pasting this into a new chat should be enough for the next Claude instance to pick up cold.

## TL;DR — current state

- `main` HEAD: **`676ef39`** (`docs: backfill lessons + todo + missing testplans for today's audit-followup arc`)
- Active worktree: `C:\TheTapestry\.claude\worktrees\audit-followup` on branch `claude/audit-followup-2026-05-03`
- C:\TheTapestry is fully synced to `main`. User has uncommitted local CRB-rewrite work in there (see "User's local work, untouched" below) — **don't commit those files**, they're an independent workstream.
- User is mid-playtest. Three player-visible changes shipped today touch the tactical map and could have second-order regressions: **fog rendering**, **imgScale auto-fit**, **tile-provider zoom cap**. See "Hot spots / watch list" if a player reports something weird.

## Today's shipped work (chronological)

All on branch `claude/audit-followup-2026-05-03`, pushed to `main`. Each is a separate commit so single-revert granularity holds.

| # | Commit | What |
|---|---|---|
| 1 | [`d7dc829`](https://github.com/XeroSumGames/thetapestry/commit/d7dc829) | Defensive bundle: moderator-character delete error-checks + vehicle crew fetch error logging |
| 2 | [`8553234`](https://github.com/XeroSumGames/thetapestry/commit/8553234) | `gm-kit.ts` — scoped `scene_tokens` fetch (was unfiltered!) + lazy `JSZip` import |
| 3 | [`5fd6275`](https://github.com/XeroSumGames/thetapestry/commit/5fd6275) | Dead-code drop: `LABEL_STYLE_LG_TIGHT` + `app/oldfavicon.ico` |
| 4 | [`26f6dfc`](https://github.com/XeroSumGames/thetapestry/commit/26f6dfc) | Painted fog absolute (first attempt — broke open-window-clears-fog, see #5) |
| 5 | [`4f2ee48`](https://github.com/XeroSumGames/thetapestry/commit/4f2ee48) | **Painted fog blocker-gated (real fix).** Painted fog is LoS-defeasible ONLY when scene has authored wall/door/window segments. No-walls maps → absolute. |
| 6 | [`3d699d4`](https://github.com/XeroSumGames/thetapestry/commit/3d699d4) | imgScale clobber — player zoom-jumped on every `tactical_scenes` UPDATE. Now only re-applies non-default DB values. |
| 7 | [`68505c4`](https://github.com/XeroSumGames/thetapestry/commit/68505c4) | Dropped Sentry-example wizard scaffolding (no callers, no value) |
| 8 | [`ab22260`](https://github.com/XeroSumGames/thetapestry/commit/ab22260) | Z-index norm: NoteAttachmentsView lightbox uses `Z_INDEX.criticalModalOver` |
| 9 | [`ab8eeb5`](https://github.com/XeroSumGames/thetapestry/commit/ab8eeb5) | Map tile zoom — first attempt (`maxNativeZoom`, upscale-blurry approach) |
| 10 | [`87acdef`](https://github.com/XeroSumGames/thetapestry/commit/87acdef) | **Map tile zoom hard-cap.** Topo capped at z17, others at z19. + button greys out at provider's cap. `switchLayer` clamps current zoom on cross-provider switches. |
| 11 | [`676ef39`](https://github.com/XeroSumGames/thetapestry/commit/676ef39) | Docs backfill: lessons + todo + 3 missing testplans |

## Hot spots / watch list

Three tactical-map systems were patched today. If a player reports any of the following symptoms, look here first:

### 1. Fog of war
**Files:** [`components/TacticalMap.tsx`](components/TacticalMap.tsx) lines ~1227–1352.
**Today's design:** painted fog is LoS-defeasible **only when the scene has authored vision blockers** (wall/closed-door/closed-window segments OR wall-tagged tokens). Without blockers, painted fog is absolute and auto-fog is off.

**Symptom → likely cause:**
- "Painted fog vanished on the player side" → check if the scene has authored wall segments. If yes, the `hasBlockers` branch is firing and LoS is clearing the fog. Either author walls around the painted region OR confirm this is intended (PC stands in painted-fog cell, LoS punches through).
- "Closed window/door doesn't re-fog the area beyond" → check that the segment has `door_open: false`. Plain-click on the segment as GM toggles the state. Realtime sync has a 200ms debounce + ~300ms realtime roundtrip = ~500ms for the player to see the change.
- "Map looks the same to GM and player on a no-walls scene" → expected. With no blockers, auto-fog doesn't fire; both see only what the GM painted.

**Revert if it's all wrong:** `git revert 4f2ee48 26f6dfc --no-edit && git push origin main` — back to the pre-today state (PC LoS punches through painted fog on all maps; the morning's "no walls = painted fog vanishes" bug returns).

### 2. Player view zoom-jump on GM action
**File:** [`components/TacticalMap.tsx`](components/TacticalMap.tsx) lines ~620–640 (`loadScenes` player-path).
**Today's design:** `loadScenes()` only re-applies `setImgScale(active.img_scale)` when the DB value is non-default (`>0 && !== 1`). The DB default means "let the viewer auto-fit"; we leave the local value alone.

**Symptom → likely cause:**
- "Player view zoom-shifts when GM toggles anything" → regression of `3d699d4`. The condition got widened to apply on every update again. Check the gate at the `setImgScale` call.
- "GM manually sets img_scale, player doesn't update" → expected ONLY if GM resets back to 1 (the default). Player will keep their previous custom value until next page load. Followup logged: track last-synced per-scene to apply on diff instead. Edge case; usually not worth bothering with.

**Revert:** `git revert 3d699d4 --no-edit && git push origin main`.

### 3. Map zoom cap
**Files:** [`components/CampaignMap.tsx`](components/CampaignMap.tsx) lines ~49–63 + 391–410; [`components/MapView.tsx`](components/MapView.tsx) lines ~920–945.
**Today's design:** every tile provider has an explicit `maxZoom` matching its native cap. Topo = 17, all others = 19. `switchLayer` calls `map.setMaxZoom(t.maxZoom)` and clamps current zoom on cross-provider switches.

**Symptom → likely cause:**
- "Can't zoom in past 17 on topo" → that's intended now. Switch to street/satellite/voyager/etc. for higher zoom.
- "Switching topo → satellite + can't zoom past 17 anymore" → regression. `setMaxZoom` isn't pushing the new cap. Check the `switchLayer` function.
- "'max zoom layer = 17' placeholder appears again" → regression. Check `maxZoom: t.maxZoom` is being passed to `L.tileLayer()` instead of a hard-coded 19.

**Revert:** `git revert 87acdef ab8eeb5 --no-edit && git push origin main`.

## User's local work, untouched

The user has an independent CRB-rewrite workstream with uncommitted edits and untracked files in C:\TheTapestry. **Don't commit any of these:**

- `M CLAUDE.md` (user's own edits)
- `M tasks/lessons.md` (user's CRB additions; my doc commit auto-merged with these via stash → pull → pop)
- `M tasks/todo.md` (same)
- `M supabase/.temp/cli-latest` (auto-generated, user can ignore)
- Untracked files in `tasks/` related to CRB: `tasks/_work/`, `tasks/crb-*.md`, `tasks/crb-rewrite/`, `tasks/froms-tos-crb.md`, `tasks/handoff-crb-rewrite.md`, `tasks/roadmap.md`, plus various handoffs and playtest preview files.

When working in a new chat, **operate from the worktree** (`/c/TheTapestry/.claude/worktrees/audit-followup`) so you don't touch the user's main checkout. After pushing to main, sync C:\TheTapestry with stash/pull/pop:

```
git -C /c/TheTapestry stash push -m "user-local pre-sync stash" -- tasks/lessons.md tasks/todo.md CLAUDE.md
git -C /c/TheTapestry pull origin main
git -C /c/TheTapestry stash pop
```

## Audit follow-up: what's left

The audit-followup arc completed today's set. **Open items** (not started, just identified):
- `<CloseButton>` adoption sweep is **blocked**: the helper has hardcoded 13px font + muted/danger tones, but the codebase's × buttons mix 13/14/22px sizes and themed colors (purple/red/etc.). Helper needs `size` prop + theme color support before a sweep is worthwhile. Audit overstated the fit. ~1 hr to extend + sweep.
- Some z-index literals deliberately left in place (`zIndex: 10001` in `app/stories/[id]/table/page.tsx` × 2). They have intentional "+1 above critical" offsets and need traced concurrent-modal stacking analysis before normalization. Don't touch without that analysis.

If user asks for "what's next on the audit," see [`tasks/letsgototheend.md`](tasks/letsgototheend.md) for the broader project roadmap, or run a fresh audit using the evergreen prompt (saved somewhere in `tasks/` — I forget the exact filename, but it's the prompt that dispatches four parallel Explore agents).

## User preferences I've learned

Carried over from session memory. Worth knowing without re-discovering:

- **Push to live, test on live** — every change ships straight to main; Vercel deploy = dev env. No staging branch.
- **Worktree pattern** — work from `.claude/worktrees/<name>`, push the branch as `main` (`git push origin <branch>:main`), then `git -C /c/TheTapestry pull origin main`.
- **No "want to break?" / "should I continue?" offers** — banned phrasing. The user closes with "what's next?" when ready. Don't end responses with framing-as-offer.
- **No em-dashes / en-dashes** in code or chat — ASCII hyphen only.
- **Min inline `fontSize` = 13px** + banned combo `13px + #3a3a3a`. Guardrail at `scripts/check-font-sizes.mjs`.
- **Long-term fix over quick fix** — root-cause path always wins.
- **Capture lessons + todo immediately** — after every meaningful ship, edit `tasks/lessons.md` + `tasks/todo.md` in the same response. Don't offer to add them later.
- **Live URL**: `thetapestry.distemperverse.com` (NOT `thetapestry.app`).
- **Working dir** = `C:\TheTapestry`. After a worktree push, always sync the main checkout.

## How to verify state at session start

```
cd /c/TheTapestry/.claude/worktrees/audit-followup
git fetch origin main
git log --oneline origin/main..HEAD          # should be empty (worktree up-to-date)
git log -1 --oneline                          # last commit, should be 676ef39
git -C /c/TheTapestry log -1 --oneline        # main checkout last commit, also 676ef39
git -C /c/TheTapestry status --short          # should show user's untracked CRB files, nothing of mine
```

If `git log origin/main..HEAD` is empty AND `git log HEAD..origin/main` is empty, the worktree IS at main. If the second has commits, someone shipped while I was offline — `git rebase origin/main` to catch up.

## Quick links to today's testplans

All in `tasks/`:
- `defensive-bundle-2026-05-04-testplan.md`
- `gm-kit-scope-2026-05-03-testplan.md`
- `dead-code-2026-05-03-testplan.md`
- `painted-fog-absolute-2026-05-04-testplan.md` (the first attempt)
- `fog-blocker-gated-2026-05-04-testplan.md` (the real fix)
- `imgscale-clobber-2026-05-04-testplan.md`
- `sentry-example-drop-2026-05-03-testplan.md`
- `zindex-norm-2026-05-03-testplan.md`
- `map-tile-zoom-cap-2026-05-04-testplan.md`

If a user reports a bug related to one of today's commits, the matching testplan has the design intent + a rollback command.

---

**Last update:** end of session 2026-05-04, after user said "wait, WTF are you talking about? just commit, push, update all documentation" and I shipped the doc backfill.
