# Load-times roadmap — what's done, what's next

Tracking the perf campaign that started 2026-04-27. All work below
is on `main` as of 2026-04-28 unless explicitly marked otherwise.

---

## ✅ Shipped

| Commit | What |
|---|---|
| `52ce092` | `router.push` for in-app links instead of `window.location.href` (table page Campaign menu, communities page, NotificationBell). Eliminates full-document reloads on those clicks. |
| `2f5ed1a` | LayoutShell auth check no longer re-fires on every navigation — runs once on mount + reacts only to real auth events via `onAuthStateChange`. |
| `17edc4d` | Sidebar `<a href>` → `<Link>` conversion. Without this, every sidebar click was a full reload that mounted LayoutShell fresh, defeating the auth cache. |
| `34257c8` | `app/stories/[id]/table/loading.tsx` — route-level Suspense skeleton so the 600KB table chunk doesn't show a blank page during cold loads. |
| `a39af4d` | Lazy-loaded 6 gated panels/modals (`QuickAddModal`, `CampaignCommunity`, `GmNotes`, `PlayerNotes`, `CampaignPins`, `CampaignObjects`) via `next/dynamic`. None paint on initial mount; pure first-load bundle reduction. |
| `0dbc263` | NPC popout — opener now passes `&gm=1\|0` URL hint, popout skips two supabase round-trips on mount (no more auth/user + campaigns query). Old bookmarks fall back to a parallelized runtime check. |
| `b3042ee` | Chat panel extracted into `components/TableChat.tsx` (`useChatPanel` hook + `ChatMessageList` + `ChatComposer` + `ChatMessageRow`). Removes 151 lines from the 9342-line table page. No bundle change (composer always visible) — code-organization win. |
| `f93fe7a` | **A1** — finish remaining `<a href="/...">` → `<Link>` conversions. 21 anchors across 11 files (NavBar, stories/page, logging, moderate, GhostWall, MapView, etc.). Internal nav now soft-navs, preserving the LayoutShell auth cache and table-page realtime subs. |
| `1c4b54d` | **A2** — VisitLogger auth cache. New `lib/auth-cache.ts` 30s TTL snapshot of `{user, session}` with in-flight dedup and onAuthStateChange invalidation. logVisit/logEvent/logFirstEvent/trackGhostConversion all switched. ~3 lock acquisitions + 1 network round-trip eliminated per soft-nav. |
| `abb1c5e` | **B2.1** — extract `getOutcome` / `outcomeColor` / `compactRollSummary` / `formatTime` helpers to `lib/roll-helpers.ts`. Table page sheds 285 lines. |
| `0d4477a` | **B2.2** — `useRollsFeed` hook in `components/RollsFeed.tsx`. Owns rolls state, expandedRollIds, rollFeedRef, the realtime channel, the visibilitychange refetch. 19 `loadRolls(id)` callsites → `rollsFeed.refetch()`. Table page sheds another 15 net lines. |
| `f2a9b1d` | **B2.3** — `<RollEntry>` variant render component. The 11-variant ladder (combat_start / drop / defer / sprint / death / combat_end / initiative / retention_check / fed_check / clothed_check / morale_check / default) moves into a single component. Both the rolls-only tab and the merged Both tab now share it. Table page **down 473 lines** (9401 → 8928). |

## 🔜 Next up

### Tier C — structural, defer until quiet
- **C1.** Replace mount-time fetch waterfall in the table page's `load()` (~15 sequential queries) with parallel + a snapshot RPC.
- **C2.** Extract initiative bar (`loadInitiative`, `initChannelRef`, `combatActive`, `combatRound`, `initiativeOrder`, `nextTurnInFlightRef`, the seq-ref pattern, the broadcast switchboard).

### Tier D — defer indefinitely without tests
- **D1.** Combat / damage / roll-modal cluster. Scar tissue says don't touch without a regression harness or a quiet weekend.

---

## Net delta this campaign

Table page (`app/stories/[id]/table/page.tsx`):
- Started at ~9342 lines (pre-perf-campaign, late April 2026)
- Now ~8928 lines after B2.1 + B2.2 + B2.3
- Plus chat extraction (b3042ee): −151 lines
- Plus helpers/hook/RollEntry extractions: −773 net lines
- **Total reduction: ~924 lines into reusable modules** (`components/TableChat.tsx`, `components/RollsFeed.tsx`, `lib/roll-helpers.ts`)
- Faster initial parse, better module boundaries, the variant render JSX is now lazy-loadable in a future C-tier pass if needed.

Auth-lock contention:
- LayoutShell auth check: was per-nav, now once-per-mount (2f5ed1a)
- VisitLogger: was 2 lock acquisitions + 1 network round-trip per nav, now 0 after first 30s window (1c4b54d)

---

## Workflow note (lesson learned 2026-04-28)

We tried using a side branch (`perf/local-test`) for a "test on localhost first" workflow during the chat extraction. Ran into trouble because **multiple Claude sessions were working simultaneously** — one shipped the chat extraction to main while another was still working on the side branch, causing references to a now-defunct branch to leak into other chats.

**Decision (2026-04-28):** abandon side-branch workflows for this codebase. Push everything straight to main per the original `feedback_push_to_live.md` memory. Vercel deploys are the dev environment; the user is the only real site user.

If a future change is genuinely too risky for live, isolate it in a feature flag rather than a side branch — flags don't fork the working tree.
