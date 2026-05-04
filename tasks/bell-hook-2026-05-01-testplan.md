# useBellDropdown hook — 2026-05-01 testplan

Shared scaffolding for the two header bells (Notifications + Messages).
One PR. Ship to live.

## What changed

- New file: [lib/hooks/useBellDropdown.ts](lib/hooks/useBellDropdown.ts) — hook that owns userId resolution via `getCachedAuth()`, the realtime channel ref + cleanup, the outside-click → close handler, and the dropdown open state.
- [components/MessagesBell.tsx](components/MessagesBell.tsx) refactored to use it. Drops the local `useEffect` for auth + channel + outside-click, drops the `userIdRef` defensive ref (the hook captures `userId` directly in the setupChannel closure).
- [components/NotificationBell.tsx](components/NotificationBell.tsx) refactored to use it. Same shape.

Hook also adds a `cancelled` race guard (same pattern as the table-page realtime guard) — tighter than what either bell had before.

Net: ~120 fewer lines of duplicated effect boilerplate; future bell features (presence, auth events) only need to be added in the hook.

No DB migration. No functional behavior change.

## Test plan

### A. Notifications bell (3 min)
- [ ] Sign in. Open the bell dropdown — recent 10 notifications render correctly, unread count badge accurate.
- [ ] In another tab, trigger an action that creates a notification (e.g. another user joins your campaign). Within ~1s the bell badge increments AND the new notification appears at the top of the dropdown.
- [ ] Click outside the dropdown → it closes.
- [ ] Click the bell again → it opens and items are still there.
- [ ] Mark one as read — bold-state clears, badge decrements.

### B. Messages bell (3 min)
- [ ] Open the messages bell — recent 10 conversations render, unread count badge accurate.
- [ ] In another tab, send a message to a conversation you're in (or have someone send you one). Within ~1s the bell updates.
- [ ] Open the messages page in another tab and read a thread. Back on the bell, the unread bold-state clears for that conversation (last_read_at realtime echo working).
- [ ] Click outside → closes. Click bell again → opens.
- [ ] Mark all read — bold clears across all rows, badge goes to 0.

### C. Race guard smoke (2 min)
- [ ] Refresh the page rapidly several times. Network panel shows no orphaned `notif_*` or `msgs_bell_*` WebSocket subscriptions piling up.
- [ ] Sign out, sign in. Bells re-init cleanly — no console errors, no "channel already subscribed" warnings.

### D. Build
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No runtime errors in console on dashboard mount/unmount cycles.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
