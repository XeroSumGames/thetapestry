# Tactical-Map Vision System — One-Week Usage Audit
**Date:** 2026-05-10 | **Covers:** 2026-05-03 → 2026-05-10

---

## Data gaps (read this first)

Cannot reach Supabase without linked credentials. The following numbers would
sharpen every claim below — run them and paste results to get a fuller picture:

```sql
-- How many scenes have non-empty fog_state?
SELECT COUNT(*) FROM tactical_scenes WHERE fog_state != '{}'::jsonb;
-- How many door/window/wall tokens exist?
SELECT object_type, COUNT(*) FROM scene_tokens
  WHERE object_type IN ('door','window','wall') GROUP BY 1;
-- Any scenes have authored wall segments?
SELECT COUNT(*) FROM tactical_scenes WHERE walls IS NOT NULL AND walls != '[]'::jsonb;
-- Firing-arc usage proxy (vehicle tokens on scenes this week)
SELECT COUNT(*) FROM scene_tokens WHERE token_type = 'vehicle'
  AND updated_at > NOW() - INTERVAL '7 days';
```

Live session feedback not captured in writing is also invisible to this audit.

---

## 1. Features with evidence of real use

**GM-painted fog (Phase 1 core)** — *strong evidence*
Five bug-fix commits landed on 2026-05-04 alone, all provably triggered by
in-session use. `26f6dfc` references "a playtest screenshot" showing the
regression. `3d699d4` (imgScale clobber) was "reported during playtest."
`4f2ee48` was a same-day regression fix from `26f6dfc`. Two full testplans
were written (`painted-fog-absolute-2026-05-04-testplan.md`,
`fog-blocker-gated-2026-05-04-testplan.md`). The paint/erase/fog-all
workflow is clearly being exercised.

**Wall/window drawing tools (Phase 2 second pass)** — *moderate evidence*
`4e02f70` (window halo) and `4f9971b` (z-order for doors+windows) are visual
polish that only surfaces when someone actually draws these elements and
notices they're hard to see. `acd7396` (SHIFT-to-snap) is a QoL add that
implies walls/doors/windows were being drawn frequently enough to feel
friction. `6469dd7` (WALL RECT) was an entirely new feature to reduce drawing
labor — someone wanted to build rooms faster.

**LoS token-visibility gating** — *confirmed working in live session*
The open-work checklist (`tasks/open-work-checklist-2026-05-06.md:384`)
records a 2026-05-10 verification: "wall-between-PC-and-NPC hides NPC ✅;
opening door reveals NPC ✅; PC moving around corner reveals hidden tokens ✅."
Three of four test cases confirmed; multi-cell straddling deferred to the
2026-05-12 playtest.

**Doors as object tokens (Phase 2 first pass)** — *indirect evidence*
The imgScale testplan explicitly uses "toggle a window" as the trigger for
the repro. Doors and windows are being toggled in live sessions. No
door-specific bug fixes landed, suggesting the toggle itself works.

---

## 2. Features that got ignored

**Multistory move-token-to-scene** (`bb9ba5e`) — *no evidence either way*
Zero post-launch commits touching this path, no checklist entries, no
testplans mentioning it. DB lookup required (query `scene_tokens.scene_id`
change history) to know if it was used and silently worked or was never tried.

**Vehicle firing arcs + target gate** (`0922ed9`, `204dd20`) — *no evidence*
`app/vehicle/page.tsx` was touched post-launch (`6e59a4a`) but only for a
rarity-palette sweep — not arc-related. No bug reports, no QoL asks, no
checklist notes. The "Show Arc" cross-window broadcast (`1594a84`) has no
follow-up commits either. DB proxy query (vehicle tokens updated this week)
would tell you if vehicles are being used at all.

**Per-token sight radius + rect-erase fog** (`50c4899`) — *no evidence*
No mentions in checklist or commits post-launch. Given that the GM-painted
fog's core paint/erase workflow drove most of the iteration, it's possible
the per-token sight radius is invisible behind "fog all" usage patterns.
Cannot confirm without DB.

---

## 3. Bugs and follow-ups that surfaced

| # | Item | Status | Source |
|---|------|--------|--------|
| 1 | Painted fog was LoS-defeasible on no-walls scenes (PC sight punched through GM fog) | Fixed `26f6dfc` | Playtest screenshot |
| 2 | Fixing #1 broke open-window vision (painted fog became absolute everywhere) | Fixed `4f2ee48` | Same-day regression |
| 3 | Window toggle caused player view to zoom-jump (imgScale clobber) | Fixed `3d699d4` | Playtest report |
| 4 | Doors + windows rendered below wall palette z-order | Fixed `4f9971b` | Visual QA |
| 5 | Window dashed halo invisible against wall palette | Fixed `4e02f70` | Visual QA |
| 6 | Wall-rect preview blank on empty scenes | Fixed `569d051` | Bug catch |
| 7 | **Multi-cell token straddling wall checks only anchor cell** — large vehicle may be wrongly hidden/revealed | Open | Checklist, deferred to 2026-05-12 playtest |
| 8 | **Stale "LoS-aware hiding is Phase 3" comment** in TacticalMap.tsx | Open (cosmetic) | Checklist |
| 9 | **Polygon vision mask** — per-cell black rects work but look blocky at wall edges | Open (polish) | Checklist |
| 10 | **Token spawn at (1,1) verification** — FOG bar was covering it; now movable, needs playtest confirm | Open (investigation) | Checklist |

---

## 4. Recommendation: what to build next

**Recommendation: fix the multi-cell straddling bug (#7 above), then assess
Phase 3 after the 2026-05-12 playtest — don't pre-commit to it.**

Rationale:

The spec's Phase 3 gate was "after 3+ live sessions and a clear gap is
named." Evidence says fog and walls are being used in live sessions
(confirmed bugs, confirmed playtest verification). The spec's own named
signals are partially met: "GMs hand-painting around walls every session"
produced the WALL RECT feature — that's real workflow pain addressed. But
the LoS token-visibility work (originally labelled Phase 3) is already
partially shipped and confirmed working. The gap between "Phase 2 shipped"
and "Phase 3 territory" is narrower than the spec implies.

What Phase 3 actually adds now is: (a) automatic LoS computation driving
fog instead of GM-paint, (b) memory mode, and (c) a proper polygon vision
mask. The 1-2 week cost is still real.

**Before committing to Phase 3:** confirm at the 2026-05-12 playtest whether
GMs are still manually painting fog on walled scenes (they shouldn't need
to — auto-fog is live) or if the auto-fog is doing its job and the GM-paint
is only used for narrative "blackout" moments. If auto-fog is carrying the
weight, Phase 3's main benefit collapses to polish. If GMs are still
hand-painting to work around auto-fog edge cases, Phase 3 is justified.

**In the meantime:** the firing-arc and multistory features need a DB signal
check. If vehicle arc has zero session use, deprioritize it entirely. If
it's being used, one testplan confirmation would close the loop.

The polygon vision mask (#9) is the single highest-value cosmetic item if
you want to raise the perceived quality of the system without committing to
the full Phase 3 engine.
