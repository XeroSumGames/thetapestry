# Optimistic-update rollback fixes — 2026-05-01 testplan

Two real low-severity bugs from the audit. Two "high severity" findings audit flagged were already guarded upstream — false positives, no fix needed (`split('Stabilize ')[1]` at table:4829 is gated by `.includes('Stabilize ')` at :4828; `order[0]` at :1681 is gated by `if (order.length === 0) return` at :1674). One PR. Ship to live.

## What's fixed

### 1. Character delete leaves UI inconsistent on RLS denial

[app/characters/page.tsx:43](app/characters/page.tsx:43). Pre-fix the optimistic filter ran regardless of the Supabase delete's outcome — RLS denial or network blip left the row gone from the UI but still present on the server until reload. Now: await the delete, check `error`, only flip local state on success; surface a user-facing alert on failure.

### 2. `handleStatUpdate` ignored Supabase errors

[app/stories/[id]/table/page.tsx:1373](app/stories/[id]/table/page.tsx:1373). Pre-fix `await supabase…update` ran but the result wasn't checked, then `setEntries` flipped to the new value unconditionally. UI showed the new value indefinitely even when the write didn't land. Now: keep optimistic flip first (snappy UI), then on error surface alert + force a `loadEntries(id)` to converge against actual DB state.

No DB migration. No functional behavior change on the happy path.

## Test plan

### A. Character delete (3 min)
- [ ] Sign in as a character owner. From `/characters`, delete a character. Expect: confirm dialog → row disappears → no error.
- [ ] To force the failure path: in DevTools Network, throttle to offline, then delete. Expect: alert "Delete failed: …" and the row STAYS in the UI (pre-fix it would have disappeared).
- [ ] Restore network, refresh the page — row state matches the server.

### B. Stat update rollback (5 min)
- [ ] Open `/stories/<id>/table` as the GM during an active session. Adjust a PC's WP/RP/Sanity stat from the table. Expect: stat snaps to the new value instantly; no error.
- [ ] To force the failure path: throttle to offline in DevTools, then bump a stat. Expect: stat shows the new value briefly, then alert "Stat update failed: …", then `loadEntries` re-pulls and the stat snaps back to the server-side value.
- [ ] Restore network. Subsequent stat updates work normally.

### C. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during normal table-page interactions.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
