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

## 🔜 Next up

### Tier A — mechanical, low risk
- **A1.** Convert remaining ~28 plain `<a href="/...">` to `<Link>` across pages. Skip any with `target="_blank"` (intentional new-tab) and `<a href="#">` (placeholder).
- **A2.** Cache `VisitLogger`'s `auth.getUser()` + `getSession()` per session. Currently fires on every nav (in addition to whatever else does).

### Tier B — medium risk
- **B2.** Extract rolls feed (`loadRolls`, `rollChannelRef`, `expandedRollIds`, `rollFeedRef`, the rolls render block) into its own module — same shape as `TableChat`. Watch out for: `loadRolls(id)` is called from many cross-component spots (combat events, sprint resolution); either expose an imperative refetch via the hook or move the calling code with it.

### Tier C — structural, defer until quiet
- **C1.** Replace mount-time fetch waterfall in the table page's `load()` (~15 sequential queries) with parallel + a snapshot RPC.
- **C2.** Extract initiative bar (`loadInitiative`, `initChannelRef`, `combatActive`, `combatRound`, `initiativeOrder`, `nextTurnInFlightRef`, the seq-ref pattern, the broadcast switchboard).

### Tier D — defer indefinitely without tests
- **D1.** Combat / damage / roll-modal cluster. Scar tissue says don't touch without a regression harness or a quiet weekend.

---

## Workflow note (lesson learned 2026-04-28)

We tried using a side branch (`perf/local-test`) for a "test on localhost first" workflow during the chat extraction. Ran into trouble because **multiple Claude sessions were working simultaneously** — one shipped the chat extraction to main while another was still working on the side branch, causing references to a now-defunct branch to leak into other chats.

**Decision (2026-04-28):** abandon side-branch workflows for this codebase. Push everything straight to main per the original `feedback_push_to_live.md` memory. Vercel deploys are the dev environment; the user is the only real site user.

If a future change is genuinely too risky for live, isolate it in a feature flag rather than a side branch — flags don't fork the working tree.
