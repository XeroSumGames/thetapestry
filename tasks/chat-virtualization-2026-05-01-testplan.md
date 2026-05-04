# Chat virtualization — 2026-05-01 testplan

`ChatMessageList` virtualized via `react-virtuoso` + `ChatMessageRow` memoized.
One PR. Ship to live.

## What changed

- New dep: `react-virtuoso` (~30KB gzipped). Production-grade virtualization with first-class chat-style auto-scroll-to-bottom and variable-height row support.

- [components/TableChat.tsx](components/TableChat.tsx)
  - `ChatMessageRow` wrapped in `React.memo`. Skips `entries.find` + `renderRichText` re-execution on parent re-renders that didn't actually change the row's props.
  - `ChatMessageList` now renders a `<Virtuoso>` when a `scrollParent` prop is supplied, falling back to a plain map render until the parent's scroll container ref resolves on first mount. The Virtuoso configuration:
    - `customScrollParent={scrollParent}` — Virtuoso virtualizes inside the parent's existing scroll container instead of owning a separate one. The Logs / Both tabs that share the same scroll box are unaffected.
    - `followOutput={atBottom => atBottom ? 'smooth' : false}` — auto-scrolls on new messages only when the user is already at the bottom. If they've scrolled up to read older messages, an inbound line won't yank them down.
    - `computeItemKey={(_, m) => m.id}` — stable keys so Virtuoso reuses row DOM correctly.

- [app/stories/[id]/table/page.tsx](app/stories/[id]/table/page.tsx)
  - New `feedScrollEl` state + `setFeedScrollContainer` callback ref. Wires the existing feed scroll `<div>` to BOTH `rollsFeed.rollFeedRef.current` (for `useRollsFeed`'s scrollToBottom) AND the `feedScrollEl` state (for Virtuoso). One DOM node, two consumers.
  - `<ChatMessageList>` call now passes `scrollParent={feedScrollEl}`.

## Why this shape (vs. plain `react-window`)

- The chat list shares a scroll container with the Logs / Both tabs. Plain `react-window` requires the virtualized list to own its own scrollbar with a fixed height — that would have meant refactoring the parent's flex layout to swap scroll ownership between tabs. Invasive.
- `react-virtuoso`'s `customScrollParent` mode keeps the parent's scroll container in charge and lets Virtuoso virtualize within it. Zero layout invasion.
- For typical session sizes (50–200 messages), the bigger immediate win is actually the `React.memo` — virtualization caps DOM growth past ~50 rows, but memoization is what stops `renderRichText` from re-firing on every parent tick.

No DB migration. No functional behavior change for the user.

## Test plan

### A. Chat tab basics (5 min)
- [ ] Open `/stories/<id>/table`. Send 10–20 chat messages from this tab and another window. Verify:
  - All messages render correctly in the Chat tab.
  - Both tab still interleaves chat + rolls correctly (uses `<ChatMessageRow>` directly, NOT virtualized).
  - Logs tab unaffected.
- [ ] In DevTools Elements, while the Chat tab is open, confirm only the visible window of `<ChatMessageRow>` divs is in the DOM (typically ~10–20 rows depending on container height) plus a couple of buffer rows above/below the viewport. Scroll up — earlier rows mount, later ones unmount.

### B. Auto-scroll-to-bottom + scroll-up read (3 min)
- [ ] At the bottom of the chat, have someone send you a message. Confirm the list smoothly scrolls to show it.
- [ ] Scroll up to read older messages. Have someone send a new line. Confirm the list does NOT yank you to the bottom — it stays where you parked. (Look for a "new messages below" UX hook later if desired; this PR just stops the rude jump.)
- [ ] Scroll back to the bottom manually. Next inbound message resumes auto-scroll.

### C. Realtime + race smoke (3 min)
- [ ] Send messages rapidly from another tab (3–4 in <1s). Confirm all of them appear and the list catches up smoothly.
- [ ] Switch tabs (Logs → Chat → Both → Chat). Confirm the chat list re-mounts and renders correctly each time, no console errors.
- [ ] Refresh the page mid-chat-tab. List re-hydrates, scroll position lands at the bottom (followOutput on initial mount).

### D. Long-session smoke (5 min, optional but recommended)
- [ ] Manually insert 200+ chat rows into the campaign (or open a long-running session). Confirm:
  - The Chat tab opens snappy (< ~200ms perceived) instead of pausing while React renders 200 rows.
  - Scrolling is smooth. No jank.
  - DevTools Performance tab shows render budget per scroll frame is < 16ms.

### E. Build + types
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] Vercel deploy succeeds (local `next build` fails for unrelated env-var prerender reasons — that's pre-existing, not from this PR).

## Rollback

`git revert <commit>` then redeploy. Restores the plain `messages.map` render. The `react-virtuoso` dep stays in `package.json` until cleaned up separately — cheap to leave.
