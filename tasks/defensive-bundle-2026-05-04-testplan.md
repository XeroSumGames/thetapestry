# Defensive bundle — 2026-05-04 testplan

Two real defensive fixes from the latest audit. (LFG deletes were dropped — the audit's claim was stale; LFG's `handleDelete` and interest toggle already error-check.) One PR. Ship to live.

## What's fixed

### 1. Moderator's character delete + delete-all surfaces failures
[app/moderate/users/[userId]/characters/page.tsx:52](app/moderate/users/[userId]/characters/page.tsx:52). Both `handleDelete` and `handleDeleteAll` were optimistic deletes — `await supabase.from('characters').delete()` followed by `setCharacters(prev => prev.filter(...))` regardless of outcome. An RLS denial or network blip left rows gone from the moderator UI while still present server-side. Now we error-check, alert on failure, and only flip local state on success. Mirrors the user-side fix that already shipped on `/characters` (commit `4429915`).

### 2. Vehicle crew fetch logs partial failures
[app/vehicle/page.tsx:115](app/vehicle/page.tsx:115). The `Promise.all([memberRes, npcRes])` destructured `.data` from each result without checking `.error`. Crew rendered as empty with no console trail when RLS denied either query. Now logs per-result errors. Same defensive pattern shipped earlier for CampaignCommunity loaders.

No DB migration. No functional behavior change on happy paths.

## Test plan

### A. Moderator character delete (3 min)
- [ ] Sign in as a Thriver. Visit `/moderate/users/<someUserId>/characters`. Delete a character normally — confirm dialog → row disappears → no alert.
- [ ] Force-fail (DevTools throttle to offline, then click delete). Expect: alert "Delete failed: …" and the row STAYS visible (pre-fix it would have disappeared).
- [ ] Same drill for "Delete all characters" — happy path clears the list, force-fail keeps the list visible with the alert.
- [ ] Restore network, reload — UI matches server.

### B. Vehicle crew fetch (2 min)
- [ ] Open a `/vehicle/<id>` page on a campaign with both PCs and NPCs in the crew pool. Crew picker renders normally. No `[vehicle]` console errors.
- [ ] To verify logging works: temporarily revoke a SELECT policy on `campaign_members` or `campaign_npcs` in the Supabase SQL editor, reload — expect the crew picker to render empty AND a `[vehicle] campaign_members fetch:` (or `campaign_npcs fetch:`) console error. Restore policy after.

### C. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during normal moderator + vehicle flows.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
