# Dead-code drops — 2026-05-03 testplan

Two dead-code removals confirmed unused across the codebase. One PR. Ship to live.

## What's removed

### 1. `LABEL_STYLE_LG_TIGHT` export

[lib/style-helpers.tsx](lib/style-helpers.tsx). The 14px + `.08em` letterSpacing variant. Created defensively during the initial label-style sweep alongside `LABEL_STYLE`, `LABEL_STYLE_LG`, and `LABEL_STYLE_TIGHT`, but the codebase had no 14px+.08em sites to map onto. Verified zero callers via grep across `app/`, `components/`, `lib/`. The other three label styles all stay — they have real call sites.

A short comment is left where the export used to live so a future PR that needs the variant has a breadcrumb back to git history.

### 2. `app/oldfavicon.ico`

Orphaned asset. Verified zero references in any TS/TSX/HTML/config file. Was presumably left over from a favicon refresh.

No DB migration. No functional behavior change.

## Test plan

### A. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] `next build` (or Vercel deploy) succeeds — `app/oldfavicon.ico` removal doesn't break any route's static asset graph.

### B. Visual smoke (1 min)
- [ ] Browser tab favicon for the live site still renders (the active favicon is at `app/favicon.ico` or `public/favicon.ico` — separate file, untouched).
- [ ] No 404s for `oldfavicon.ico` in DevTools Network on any page (nothing should be requesting it).

## Rollback

`git revert <commit>` then redeploy. Both items are restorable from git history if needed.
