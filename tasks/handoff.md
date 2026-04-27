# Session Handoff — 2026-04-27

## TL;DR
- Big day post-Mongrels playtest. Drained the **last-minute fix list** (9 items, 3 parked pending repro), shipped **Communities Phase D GM dashboard**, polished a stack of UI surfaces. ~25 commits on the day.
- **Two SQL migrations may need running** in Supabase — see § Run-Me SQL.
- **Three parked items** waiting on table data: damage-math repro (PLAYTEST #1), failed-skill-check action burn (#2), and the inventory Give/Unequip verification (last-minute #8/#9).
- Worktree is `C:\TheTapestry\.claude\worktrees\romantic-chatelet-3647bb` — `claude/romantic-chatelet-3647bb` branch tracks main.

## Run-Me SQL (do first if not already)
User confirmed they ran the earlier batch mid-session. New ones from this session:
```
notepad C:\TheTapestry\sql\community-morale-role-snapshot.sql
notepad C:\TheTapestry\sql\patch-minnie-floorplan-cachebust.sql
```
1. `community-morale-role-snapshot.sql` — adds `role_snapshot jsonb` to `community_morale_checks`. Without it, Phase D dashboard's role-coverage chart shows empty rows.
2. `patch-minnie-floorplan-cachebust.sql` — bumps Minnie's floorplan_url to `?v=20260427` so browsers stop serving the cached old image.

Older SQL queued, likely already run (idempotent — re-running is safe):
- `sql/community-members-add-member-type.sql`
- `sql/scene-tokens-current-speed.sql`
- `sql/scene-tokens-rotation.sql`
- `sql/notify-inventory-received.sql`
- `sql/patch-minnie-speed-3.sql`

## What just shipped (last 25 commits, newest first)
- `3541fc3` grey-out idle message + campfire icons (opacity + grayscale; CSS `color` doesn't affect emoji)
- `da049fb` 💬 messages icon opens `/messages` in a new tab
- `9f6b049` NPC roster avatar borders use vivid disposition palette (matches map tokens)
- `4ad9aff` NPC popout 571×257 → 600×800
- `f91845a` **Communities Phase D GM dashboard** — full morale timeline + role coverage chart + recruit success rate, lazy-loaded per community, GM-only
- `d3c7478` Forums Discourse-style redesign + Reddit/Lemmy preview tab
- `904c372` Notification title + body 13px → 14px
- `d6251bf` Start Combat NPC picker groups by folder w/ tri-state checkbox + Uncategorized last
- `eeba9a3` **Committed the actual new Minnie floorplan PNG** (was missing from the worktree — user dropped it in main checkout, worktree had old file)
- `6404368` Community create modal stops re-opening above the new community
- `e1add58` Floorplan URL cache-bust (`?v=20260427`)
- `3d9a3c3` **Grenade blast: Engaged 100% / Close 50% / nothing beyond** (dropped Medium tier)
- `40db7ae` Per-row MAP toggle preserves position via soft-delete (no more top-left snap on hide/show)
- `0dbc263` NPC popout perf: GM hint in URL, parallel queries
- `c772fa6` SHOW/HIDE on every folder (community + regular), drop pcEntries gate
- `0e09c72` MAP button colors orange/green platform-wide
- `a39af4d` Lazy-load 6 gated panels/modals on the table page
- `ff96650` Player-bar MAP button orange off-map / green on-map
- `bf958b2` RLS fix: `is_thriver()` lowercase 'thriver' role compare
- `34257c8` Route-level `loading.tsx` for the table page
- `6b277dd` Rejoin Session instantly opens table in new tab
- `bbd00da` **Spacebar pan: preventDefault on every keydown** (kills auto-repeat page-scroll fight)
- `17edc4d` Sidebar `<a>` → `<Link>` for soft-nav
- `19b3c31` Defer mouse-drag pan to long-term-fixes.md
- `9e623ec` Last-minute fix #1: revert pan to React handlers (window listeners broke baseline)

## What's parked / blocked
**PLAYTEST_TODO** — `tasks/PLAYTEST_TODO.md`:
- **#1 Damage math** — `2+2d6 (6) = 8 raw → should be 7 WP / 7 RP (1 mitigated)`. Need a screenshot of the actual log row (showing the buggy output) so we know which path is broken. Code review can't isolate it.
- **#2 Failed skill checks still leave 2 actions** — code looks correct on paper. Need a repro: which character, which skill, what the `[consumeAction]` console log shows.

**Last-minute fixes** — `tasks/long-term-fixes.md` for #1; rest in conversation:
- **Last-minute #8 — Give qty picker** — code looks correct on inspection. User said they'll test in play. If broken, need to know:
  1. Did the Give button appear on the stackable row?
  2. When clicked, what happened (modal opens/nothing/error)?
  3. If modal opened, was the qty `−`/`+`/`[All]` row visible?
- **Last-minute #9 — Primary/Secondary Unequip buttons** — code looks correct. Need: modal close behavior on click, weapon visibility after, console errors if any.
- **Mouse-drag pan in tactical** — broken across multiple architectural attempts. Arrow keys / WASD work as the workaround. See `tasks/long-term-fixes.md` for the trail of failed approaches and likely-cause hypotheses.

## What's next on the roadmap (user's pick)
Last asked status was a high-level breakdown:
- **Communities Phase D continued** — Lv4 auto-CMods (Inspiration / Psychology Lv4 grant +1 morale CMod), Apprentice task delegation UI
- **Modules MVP** — content engine, spec at `tasks/spec-modules.md`
- **HammerTime `<t:UNIX>` renderer** — Discord timestamp tokens render literally outside Discord
- **Inventory polish** — qty picker / Unequip verification (parked above), custom-item loot UI, full encumbrance UX
- **GM role transfer + session scheduling**
- **Allow characters in multiple campaigns**

User picked **GM dashboard (Phase D)** this session — shipped. Next pick is open.

## Test plan for next session
Pre-existing: `tasks/preplaytestsmoke-2026-04-27.md` covers most of the table surfaces. Add to it:
- **Phase D Dashboard** — open a community, click ▶ Dashboard, verify all three modules (timeline, role chart, recruit stats) render with data. New campaigns will have empty role chart until at least one morale check rolls.
- **Vivid roster borders** — friendly NPCs ring vivid green, hostiles vivid red, neutrals medium gray. Should match the map tokens.
- **💬 messages icon** — dim/grayscale by default, brightens to color the moment an unread message arrives, opens in a new tab when clicked.
- **NPC popout size** — should fill ~600×800 window, not the cramped 571×257.
- **Grenade blast** — drops to nothing past 30 ft. Engaged = 100%, Close = 50%.
- **Per-row MAP toggle** — hide a token, re-show, verify it returns to its original position (not 0,0).

## Working tree state
- Branch: `claude/romantic-chatelet-3647bb` worktree at `C:\TheTapestry\.claude\worktrees\romantic-chatelet-3647bb`.
- All commits pushed to `origin/main`.
- `C:\TheTapestry` main checkout synced via `git -C C:/TheTapestry pull origin main` (per memory rule).
- Vercel deploy pipeline auto-runs on push to main, ~60s lag.

## Known gotchas (lessons from this session)
- **Worktree vs main-checkout file drift** — user dropped the new Minnie floorplan PNG into `C:\TheTapestry\public\` (main checkout) but the worktree at `.claude\worktrees\romantic-chatelet-3647bb\public\` still had the old file. Vercel deploys from the WORKTREE's commits, so the new file never went out. Fix: `cp` from main into worktree, commit, push. Pattern to remember whenever the user uploads assets directly.
- **Emoji glyphs ignore CSS `color`** — emoji always renders in its native palette. Use `opacity` + `filter: grayscale(1)` to grey it out instead. Bit me on the messages bell + campfire shortcut.
- **`!e.repeat` gate on key handlers**: spacebar (and any held key) fires repeated keydown events while held. If the handler only `preventDefault`s on `!e.repeat`, the browser's default action (page-down scroll for spacebar) fires every repeat — exactly the "twitchy spacebar pan" the user reported. Always preventDefault on every event when the action involves a held key.
- **Soft-delete pattern for tokens** — `archived_at timestamptz` instead of `.delete()` preserves grid_x/y/scale/rotation across hide → show cycles. Both folder SHOW/HIDE and per-row MAP toggle now use this.
- **Range bands are CANONICAL** — locked into `tasks/rules-extract-combat.md`. Engaged 5 / Close 30 / Medium 100 / Long 300 / Distant 1000 ft. The user has corrected the assistant on these multiple times — don't second-guess. Don't suggest "maybe bump to 50ft" when canonical Close is 30ft.
- **Realtime publication still bites** — any new table that needs `postgres_changes` events must be added to the `supabase_realtime` publication. Enabling RLS isn't enough.
- **Pan architecture parked** — multiple attempts (rAF coalescing, GPU layer, layout containment, window-level mouse listeners) didn't stick. Ariow keys / WASD path works fine. The persistent failure mode is "click+drag empty cell does nothing" — likely the canvas isn't actually overflowing the container at typical zoom levels. See `tasks/long-term-fixes.md` for the next-investigation list.

## Memory updates worth adding
- "After user drops new assets into `C:\TheTapestry\public\`, copy them into the worktree's `public/` before committing — Vercel deploys from the worktree's git, not the main checkout." (new pattern)
- "Range bands canonical: Engaged 5 / Close 30 / Medium 100 / Long 300 / Distant 1000 ft. Locked in `tasks/rules-extract-combat.md`. Stop second-guessing." (reinforce)
- "Emoji glyphs ignore CSS `color` property. Use opacity + grayscale filter for dim/active states." (new lesson)
