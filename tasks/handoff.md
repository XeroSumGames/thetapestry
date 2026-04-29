# Session Handoff — 2026-04-29 (UI Streamline + Modules curation + persistent GM nav)

## TL;DR
- **Multi-day session arc closed:** every item from the UI Streamline list (Enter→GM Tools, Snapshot to its own page, drop Clone, persistent button row, Edit-page snapshot panel removed) is shipped. Plus: Modules marketplace got an EDIT page + cover upload + sort_order curation, Survivors gallery balances correctly, Communities click-through auto-expands.
- **Earlier in this session arc:** Distract redesign (5 commits), C2 InitiativeBar extraction, perf sweep (memo + useStableCallback), Grapple opposed-check tier fix, player-side Search Remains loot RPC, snapshot RESTORE auto-launch, weapon jam persistence, Kings Crossing → Kings Crossroads rename, setting consolidation (5 deprecated settings → published modules).
- **Worktree:** `C:\TheTapestry\.claude\worktrees\beautiful-dijkstra-8da918` on `claude/beautiful-dijkstra-8da918` tracking main. Working tree clean (only `.claude/settings.local.json` permission deltas, intentionally not committed).
- **`C:\TheTapestry`** is synced to `main` — the user's primary working dir matches what's live on Vercel.

## Pick up here

The user has no specific outstanding ask — they wrapped the session by saying "push, commit, update todo and everything else, then get me a handoff ready." So the next chat should open ready to either:

1. **Pick up from the backlog** — top candidates flagged by Xero this week:
   - Restore-to-Full-Health perf (n+1 fetch on the multi-target restore modal — batch into 3 concurrent table-scoped UPDATEs)
   - "Streamline logging into missions" (player-side login → join → table is too many clicks; need to discuss before shipping)
   - Hide-NPCs reveal UX streamlining (data layer works; reveal flow needs fewer clicks)
   - Vehicles + Handouts in `cloneSnapshotIntoCampaign` v1.1.0 (parked when Xero pivoted to UI Streamline)
   - Re-run `/tools/migrate-settings-to-modules` — the descriptions/order changed, existing module rows in DB are stale; tool has UPDATE-on-conflict but Xero hasn't re-clicked yet
   - Apply `sql/modules-sort-order.sql` if not yet run (Xero hasn't confirmed)

2. **Wait for playtest reports** — the next Mongrels session is what'll surface the next round of bugs. Items 5–11 of the C1 testing checklist still aren't formally retested (Sprint slowness, UNEQUIP button visibility, X button on Initiative bar, etc.) but most are likely already fixed by chat-loop kill / parallelization / auth-cache work.

**Open the next chat with this question:**
> "What's next — backlog item, or did the playtest surface new bugs?"

## What shipped this session arc (newest first)

```
af15ca1 ui: persistent StoryToolsNav + Survivors gallery + community auto-expand
d8eeb23 feat(modules): sort_order column for /modules curation + UI on Edit page
84b831d ui(stories): rename Enter→GM Tools, Snapshot tab, drop Clone, drop new-tab
8951b0f feat(modules): EDIT button + cover-image upload page; reorder /stories/new fields
197491d feat(modules): reorder migration list + new descriptions + The Basement rename
b310ccd feat(modules): Thriver migration tool to publish 5 deprecated settings
b5f5602 fix(setting): rename King's Crossing → Kings Crossroads (Delaware geography)
70fa32f ui(stories): trim setting list + remove "New Campaign" button
743fa75 perf(render): React.memo on heavy children + useStableCallback for TacticalMap
7930e3b perf(table): parallelize 5 sequential await pairs (loadEntries + rollsFeed)
42291ba fix(jam): persist Low-Insight jam flag so Unjam stays available
11ddf77 feat(loot): player-side "Search Remains" via SECURITY DEFINER RPC
4ebd57f fix(grapple): opposed-check resolves by outcome tier, not binary success
7c26a9d feat(snapshots): auto-launch table after admin-page restore
7544bf8 feat(grapple): add Conditional Modifier input to the Grapple modal
... (and 50+ earlier commits in this multi-day arc — see git log for the full picture)
```

## Two systemic wins worth understanding (still in force)

**Auth Web-Lock contention** — `supabase.auth.getUser()` takes a Web Lock, and a backgrounded tab mid-mount holding it makes login spin forever. `lib/auth-cache.ts` provides `getCachedAuth()` (30 s TTL local snapshot from `getSession()`). The codemod migrated 44 files. Any new code calling `supabase.auth.getUser()` directly is a regression risk — use `getCachedAuth()`.

**Render-perf memo pattern** — `TacticalMap` is fully memoized (every callback consumed via `useStableCallback` to keep stable identity). Same memo wrap landed on `CharacterCard` and `NpcRoster`, but their parent's call sites (the table page) still pass inline `new Set(...)` and inline arrows on every render. Memo currently doesn't skip those two — fixing it is a follow-up: stabilize the call-site props in `app/stories/[id]/table/page.tsx`.

## Critical files / locations (where the scar tissue is)

- [app/stories/[id]/table/page.tsx](app/stories/[id]/table/page.tsx) — ~9300-line megafile. Most combat work happens here. C2 already extracted `InitiativeBar`; future C3 candidates: action-button strip, roll modal, GM Tools dropdown.
- [components/StoryToolsNav.tsx](components/StoryToolsNav.tsx) — new shared nav. If you add a new GM sub-page, mount this at the top.
- [components/CharacterCard.tsx](components/CharacterCard.tsx) — has the new Evolution button (purple, scrolls to Progression Log block on the same card).
- [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) — `initialOpenId` prop now lets callers auto-expand a specific community.
- [lib/modules.ts](lib/modules.ts) — sort order: `.order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })`.
- [app/modules/[id]/edit/page.tsx](app/modules/[id]/edit/page.tsx) — module editor (cover upload + name/tagline/description/sort_order). Author-or-Thriver gated.
- [lib/auth-cache.ts](lib/auth-cache.ts) — 30 s TTL session cache. Use `getCachedAuth()` everywhere.
- [lib/useStableCallback.ts](lib/useStableCallback.ts) — stable callback identity with fresh closures.
- [lib/debug-log.ts](lib/debug-log.ts) — telemetry (errors + page-load timing). NO global fetch wrapper (was reverted as too invasive).

## SQL applied this session arc

- `sql/setting-rename-kings-crossroads.sql` — applied (Xero confirmed)
- `sql/loot-npc-item-rpc.sql` — applied
- `sql/modules-sort-order.sql` — **NOT yet confirmed applied** (re-run to pin Empty=1, Chased=2, Minnie=3, Basement=4, Arena=5)
- `sql/debug-log.sql` — applied

## Workflow rules (still in force)

- `C:\TheTapestry` is permanently on `main`. After every push from the worktree, run `git -C C:/TheTapestry pull origin main` (memory rule covers this).
- No long-lived feature branches. Ship same-session or use a flag.
- Push first, fast-fail on the live Vercel deploy (Xero is the only real-site user).
- Memory rules: keep using `getCachedAuth`, never sub-13px inline fontSize, header buttons via `hdrBtn()` helper.

## Test plans written this session

Living in `C:\TheTapestry\tasks\` (and the worktree mirror):
- `persistent-nav-survivors-communities-testplan.md` — today's commit
- `modules-edit-cover-testplan.md`
- `modules-sort-order-testplan.md`
- `setting-migration-testplan.md`
- `kings-crossroads-rename-testplan.md`
- `gm-tools-streamline-testplan.md`
- `loot-search-remains-testplan.md`
- `grapple-opposed-tiers-testplan.md`
- (older C1 / Distract testplans still valid)
