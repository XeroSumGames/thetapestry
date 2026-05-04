# Table page perf guards — 2026-05-01 testplan

Three small perf items from the audit. One PR. Ship to live.

## What's in this PR

1. **NotificationBell user_id filter** — already correct on inspection (line 73). No change needed; audit was a false positive. Documented here so it doesn't get re-flagged.

2. **Table page realtime race guard** ([app/stories/\[id\]/table/page.tsx:866](app/stories/[id]/table/page.tsx:866)) — added a `cancelled` flag inside the mount effect, with `if (cancelled) return` checks before each of the 8 realtime channel assignments. Cleanup now sets the flag and nulls each ref after `removeChannel`. Closes a race where navigating between two `/stories/<id>/table` pages while load() was mid-await could leak the previous campaign's channels.

3. **Visibility-change debounce** ([app/stories/\[id\]/table/page.tsx:1283](app/stories/[id]/table/page.tsx:1283)) — wraps the visibility refetch in a 500ms debounce. Pre-fix, fast alt-tab cycles (Win+L, focus-flap on switch) could fire 5 full table refetches per visibility flicker.

No DB migration. No functional behavior change for the user.

## Test plan

### A. Realtime race guard (5 min)
- [ ] Open `/stories/<A>/table`. While the "Loading The Table…" spinner is still up, click a sidebar link to `/stories/<B>/table`. Repeat several times.
- [ ] After landing on B, in DevTools → Network → WS, confirm no orphaned subscriptions to `reveals_<A>`, `members_<A>`, etc. (only B-channels should be active). Pre-fix: occasionally A-channels lingered until full page reload.
- [ ] Smoke: trigger a chat message / damage / NPC reveal — realtime updates still propagate as expected on the active campaign.
- [ ] Smoke: navigate away from `/table` entirely (back to `/stories`). Confirm channels close (no console warnings about leaked subscriptions).

### B. Visibility debounce (3 min)
- [ ] Open `/stories/<id>/table`. Open DevTools → Network and filter by `select` or by the supabase URL.
- [ ] Alt-tab away and back **rapidly** (3-4 times in 1 second). Confirm only ONE batch of refetches fires (loadEntries / rollsFeed / loadInitiative / etc.), not 3-4 batches.
- [ ] Alt-tab away and back **slowly** (>1 second between flips). Confirm one full refetch batch each time — debounce shouldn't suppress legitimate use.
- [ ] Smoke: come back to a tab after several minutes. Roll log + initiative + NPCs all reflect any DB changes that landed while the tab was hidden.

### C. Smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No new console errors on table page mount / unmount cycle.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes; 100% additive guardrails.
