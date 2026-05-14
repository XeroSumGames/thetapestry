# Perf A3 — Stories Table useEffect Split Audit
**Date:** 2026-05-14  
**File:** `app/stories/[id]/table/page.tsx` (11,743 lines)

## Outcome: No-op — target effect not found

### What I searched for
A `useEffect` with 24+ deps near line 843 (old file position) or anywhere in the file.

### What I found

The file contains exactly **18 `useEffect` calls**. Their line numbers and dep counts:

| Line | Deps | Dep array |
|------|------|-----------|
| 242  | 1    | `[userId]` |
| 263  | 0    | `[]` |
| 322  | 1    | `[openHeaderMenu]` |
| 380  | 1    | `[selectedEntry]` |
| 443  | 2    | `[showTacticalMap, id]` |
| 453  | 4    | `[initiativeOrder, id, supabase, tokenScenesRefreshKey]` — largest |
| 525  | 2    | `[id, supabase]` |
| 547  | 2    | `[combatActive, showTacticalMap]` |
| 561  | 1    | `[tacticalShared]` |
| 595  | 1    | `[activeIdForReset]` |
| 731  | 3    | `[tradeTarget, supabase, id]` |
| 1101 | 2    | `[entries, isGM]` |
| 1128 | 1    | `[id]` — 435-line mount effect |
| 1574 | 2    | `[id, isGM]` |
| 1625 | 1    | `[id]` |
| 1637 | 3    | `[pendingRoll, selectedEntry, showEndSessionModal]` |
| 3323 | 1    | `[id]` |
| 3349 | 1    | `[campaignNpcs]` |

**Maximum deps in any single `useEffect`: 4.** No effect with 24+ deps exists.

### Most likely explanation

The 24-dep effect described in the task was cleaned up in a prior session before the oldest available git history for this file (earliest reachable commit: `3edc35e`, which already shows the same dep counts). The task description appears to be queued work that is already done.

### Closest remaining concern (not fixed — out of scope)

The mount effect at **L1128** is 435 lines long with `[id]` as its sole dep. It references many variables inside its body (`router`, `supabase`, `isGM`, `loadEntries`, etc.) that are technically unlisted deps, suppressed by design because the effect is intentionally a one-shot initializer. This is an accepted pattern in this codebase, not a bug. It does NOT create the "re-runs on every dep change" problem the task was targeting, since it only runs when `id` changes (i.e., on mount and campaign switch).

### Guardrail checks

- `node scripts/check-font-sizes.mjs` — not run (no code changes)
- `node scripts/check-role-literals.mjs` — not run (no code changes)
- `npx tsc --noEmit` — not run (no code changes)

### Nothing pushed

Per the bail-out clause: no fake split attempted, no commit created.

### Alternative angle if a perf fix is still wanted

If mount time or re-render frequency is still a concern on this page, the more productive targets are:

1. **Memoize `entries` shape** — `setEntries` fires on every realtime tick and produces a new array reference, causing everything that consumes `entries` to re-render even when the visible data hasn't changed. A shallow-equality check before setting state would cut re-renders.
2. **Split the 435-line mount effect** — not by dep count (it already has 1 dep) but by concern: channel setup, data loading, and presence tracking are independent and could be in separate `[id]`-dep effects. This wouldn't reduce how often each runs but would make them easier to reason about and test in isolation.
3. **`useCallback` on `loadEntries`** — it's re-declared on every render; wrapping it would let dependent effects stabilize their dep arrays.

### Smoke test plan (if a future split is applied to the mount effect)

1. **Combat path:** Start session → Start Combat → advance turns → verify initiative bar updates, token HP decrements, and damage log posts correctly.
2. **Fog/token movement:** Move a token on the tactical map → verify fog recalculates and token position syncs to all other clients (GM + at least one player tab).
