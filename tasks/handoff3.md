# Session Handoff — 2026-04-28 (post-playtest day-after)

## TL;DR
- **Workflow change is the headline.** `perf/local-test` retired; chat-extraction shipped; `C:\TheTapestry` is on `main` permanently. Going forward, every push from the worktree fast-forwards the user's checkout via the existing memory-rule pull. No branches to manage, no merges, no drift.
- Shipped a stack of polish: Phase C modules marketplace + cover image upload + `/modules → Import` button, scene-controls popout (replaced 130-px inline GM strip with `Map Setup` header button), Bow/Crossbow ammo gate, full Insight Die spend tracking, neutral-disposition yellow recolor, Perception/Gut/First-Impression list-self filter + narrative log copy.
- **Two SQL migrations queued for Supabase**: `sql/module-covers-bucket.sql` (cover image bucket) and `sql/roll-log-insight-used.sql` (insight_used column). Idempotent.
- **Arena module import was tested end-to-end and confirmed working** ("works perfectly" minus the now-shipped Import button on `/modules`). The migration loop is functionally closed.
- Worktree: `C:\TheTapestry\.claude\worktrees\distracted-carson-293c9d` on `claude/distracted-carson-293c9d` tracking main.

## Workflow rules going forward (NEW — read these)

The user's main checkout (`C:\TheTapestry`) is now permanently on `main`. The `perf/local-test` branch was retired in commit `b3042ee`. This eliminates the divergence + merge-conflict pattern that bit us yesterday.

**Every push from the worktree must be followed by:**
```
git -C C:/TheTapestry pull origin main
```
That's a fast-forward now (no conflicts ever, since main is the only branch). The existing memory rule already covers this.

**Do not create new long-lived feature branches.** If something needs experimentation, ship it the same session or it becomes a maintenance hazard. The chat-extraction precedent (4 days on a side branch → painful merge) is the worst-case we're avoiding. If something is genuinely too risky, use a feature flag — flags don't fork the working tree.

**Two divergence sources to watch:**
1. **Parallel commits from the user's main checkout.** They occasionally commit directly via another shell. Always `git fetch origin main` + check `git log HEAD..origin/main` before pushing from the worktree. If origin is ahead, rebase the worktree first.
2. **Untracked files in the user's tree.** The user keeps in-progress notes (e.g. `tasks/b1-chat-extraction-testplan.md`). Fast-forward pulls don't touch these — they're safe.

## Run-Me SQL (queued — confirm if applied)
```
notepad C:\TheTapestry\sql\module-covers-bucket.sql
notepad C:\TheTapestry\sql\roll-log-insight-used.sql
```
1. **`module-covers-bucket.sql`** — creates the `module-covers` storage bucket + RLS. Required for cover image uploads in the publish wizard. Without it, the upload fails with a bucket-not-found error.
2. **`roll-log-insight-used.sql`** — adds `roll_log.insight_used text` (CHECK NULL/'3d6'/'+3cmod'). Required for the new `🎲 Insight Die spent — +3 CMod` banner in the extended log card. Without it, inserts silently drop the new field; the legacy `die2 > 6` heuristic still surfaces 3d6 spends but +3cmod stays invisible.

## What shipped today (newest first)
- `b3042ee` **Chat extraction merged + perf/local-test retired** — squash-merged from the perf branch (`d6a69d9` orig). Pure code organization: 251 lines out of `table/page.tsx` into new `components/TableChat.tsx` (useChatPanel hook + ChatMessageRow + ChatMessageList + ChatComposer). Plus `tasks/b1-chat-extraction-design.md` + `tasks/rollback-procedure.md`. **No UI/behavior change** — same chat, same composer, same realtime sub.
- `f9b59dc` **Insight Die spend tracking** — `roll_log.insight_used` column ('3d6' / '+3cmod' / null). saveRollToLog accepts optional `insightUsed` param, executeRoll computes from preRollSpent + preRollInsight. Extended log card shows distinct banners for each kind; legacy `die2 > 6` heuristic stays as fallback for pre-bump rows.
- `03de984` **Bow/Crossbow ammo gate** — Attack button on combat actions row disabled when `ammoCurrent <= 0` on a clip-tracked ranged weapon. Label gains `— empty, Reload` suffix. Backward-compat: legacy NPCs without `ammoCurrent` set get unlimited (null treated as no-track).
- `32d03d1` **Cover image upload in publish wizard + `/modules` Import button** — `ObjectImageCropper` reused in publish modal; uploads land in new `module-covers` bucket. PublishParams gains `coverImageUrl` (tri-state: undefined = leave alone, null = clear, string = set). Plus a purple `📂 Import from snapshot` button on the marketplace title row pointing at `/modules/import`.
- `9ee175d` **Stepper grid transposed** — Cols/Rows in left column, Cell ft / Cell px in right column. Pairs related controls vertically.
- `a9b8a8c` Sidebar rename: "Welcome to the Tapestry" → "A Guide to the Tapestry". Same `/welcome` route.
- `2f6f9ac` Scene-controls popout: 2×2 stepper grid replaces 4 stacked rows. Default size 370×740 → **250×600**.
- `03d8c1e` Popout default 200×760 → 370×740 (intermediate).
- `58eeace` **Inline 130-px GM panel removed; `Map Setup` header button added** to the table page header row. Map canvas now fills full table-page width. State syncs popout↔main via BroadcastChannel from commit 8277be2.
- `8277be2` Scene-controls popout window (`/scene-controls-popout`) + `lib/scene-controls-bus.ts`. Bidirectional state sync (zoom / cellPx / showGrid / gridColor / gridOpacity / showRangeOverlay / mapLocked) + commands (fit_to_map / fit_to_screen / place_tokens) one-way popout→main.
- `6625a07` **Phase C marketplace** — `/modules` browse (grid + search + setting filter) + `/modules/[id]` detail (hero + version history + Subscribe CTA). `/campaigns/new?module=<id>` pre-selects from detail-page CTA. Sidebar gains `Modules` link.
- `173956e` Legacy neutral grey `#9ca3af` → vivid yellow `#facc15` for tokens placed before the yellow swap (no DB migration needed).
- `c51b0c0` **`/modules/import`** — publish a module from an uploaded campaign-snapshot JSON. New `lib/snapshot-to-module.ts` transform; `publishModuleVersion` accepts `null` campaignId. Closes the original Arena migration loop.
- `150df2b` Neutral disposition: grey → goldenrod/yellow palette (border `#a17a14`, vivid map `#facc15`). Affects picker + roster + map tokens.
- `990cbce` Roll log: Perception/Gut/First Impression render as sentences (`"Cree Hask successfully uses Perception"`) instead of `"Cree Hask — Perception Check"`.
- `078c95b` Perception/Gut Instinct PC list filtered to player-self (mirroring First Impression's existing `entries.filter(e => isGM || e.userId === userId)`).

User-side commits the same day (parallel work from their main checkout):
- `61b8fa3` /welcome redesigned as Guide + messages dropdown rework
- `462e3e7` messages-bell upgrade (recent + unread, deep-link OPEN)
- `2cb0921` parked items (firsttimers redirect, messages-realtime SQL, welcome quick-ref)
- `1882cb8` chore: marked messages-realtime SQL applied
- `5b562d2` docs: handoff + load-times roadmap; retire side-branch rollback doc

## Workflow rule reminders (carry-over from prior handoffs)

- **Push to live, test on live** — Vercel deploys from main automatically. After every commit, expect ~60s before the change is live.
- **Min inline fontSize = 13px** — never write 9–12px in `style={{ fontSize: '...' }}`. Run `node scripts/check-font-sizes.mjs` after edits to UI components.
- **Banned combo:** `fontSize: '13px'` + `color: '#3a3a3a'` (illegible on dark bg). Use `#cce0f5`. Guardrail flags it.
- **Popout routes:** name them `*-sheet` or `*-popout` so `LayoutShell.FULL_WIDTH_PATTERN` auto-hides the sidebar.
- **Working directory = `C:\TheTapestry`** — user only ever looks here. After push, run `git -C C:/TheTapestry pull origin main`.
- **Long-term fix over quick fix.** Surface root causes, even when off-request.

## What's parked / blocked

**Combat correctness — scheduled remote agent (2026-04-30T16:00:00Z, Thursday 10am MT):**
Routine `trig_01DgrfRt5ymUuU4fUf2jzq8N` will sweep three bugs:
1. Distract didn't decrement next-round actions on Cree (silent RLS suspected; needs `.select()` + broadcast + maybe `sql/initiative-order-rls-fix.sql`)
2. Stabilize should always consume an action (verify the `actionPreConsumedRef` flow)
3. Post-Stabilize state — Cree didn't revive (verify Warren-fix guard not blocking, audit Stabilize success branch)

**Don't touch items 1-3 manually unless something blocks playtest before Thursday.** The agent has the diagnostic context.

**Carry-over PLAYTEST_TODO items pending repro:**
- Damage math (`2+2d6 (6) = 8 raw → should be 7 WP / 7 RP (1 mitigated)`) — need screenshot of the actual log row
- Failed skill checks still leave 2 actions — need character/skill/`[consumeAction]` console log
- Inventory Give qty picker / Unequip buttons — need play-time screenshot

**13-item playtest backlog at top of `tasks/todo.md`:**
- Combat correctness (5 — items 1-3 above are 🤖 agent-owned, items 4-5 await user)
- Permissions (1) — Hide NPCs from players on Start Combat
- Rules / mechanics (2) — *(crossbow + bow reload SHIPPED today as `03de984`; weapon DB SRD audit still parked)*
- UX (3) — mission login flow, drag-to-bottom-left blocked, map pinging clunky
- Long-term (3) — dynamic lighting, doors, line of sight

**Older parked items still live in `tasks/todo.md`:**
- NPC inventory: primary/secondary weapons not counting toward NPC encumbrance
- Player-side "Search Remains" loot button on NPC popout (~150-line feature designed)
- Stale realtime subscriptions (GrumpyBattersby tab-backgrounding bug)
- SRD wording sweep, King's Crossing Mall content
- `lib/settings.ts` Arena entry → new module migration + retire `setting_seed_*` tables (Arena module is now published; flipping the campaign-create picker to clone from it instead of seeds is a follow-up — small SQL + small TS change, ~1 hour)

**Newly observed pending items (untracked file in user's tree):**
- `tasks/b1-chat-extraction-testplan.md` — user was authoring this when chat extraction landed. Post-merge testplan for verifying TableChat behaves identically to the inline version.

## Watch-list during next playtest (today's mechanics)

1. **Cover image on modules** — open publish wizard, upload cover, verify the marketplace card + detail-page hero render the image. Requires `module-covers-bucket.sql` to be applied.
2. **`+3 CMod` Insight Die banner** — spend an Insight Die in `+3 CMod` mode on a roll, expand the log card, see new green banner. Requires `roll-log-insight-used.sql` to be applied.
3. **Bow/Crossbow Attack gate** — fire a Bow once (clip=1), Attack button should disable with "— empty, Reload" suffix. Use Ready Weapon → Reload to re-enable.
4. **Map Setup popout** — click `Map Setup` in the GM header row → popout opens at 250×600 with 2×2 stepper grid. Bidirectional sync with the main window.
5. **Modules marketplace flow** — `/modules` shows all listed modules. Detail page renders cover + version history. "Create campaign with this" pre-selects on `/campaigns/new`.
6. **Chat refactor (regression check)** — every chat behavior should be identical: send a message, whisper, switch tabs, session start/end clears chat. The TableChat module is functionally a drop-in for the inline code.

## Working tree state
- **Worktree:** `C:\TheTapestry\.claude\worktrees\distracted-carson-293c9d` on `claude/distracted-carson-293c9d`. Rebased onto origin/main, no divergence.
- **User's main checkout:** `C:\TheTapestry` on `main`. Single branch, single source of truth. `perf/local-test` is gone.
- **All commits pushed to `origin/main`.**
- **Vercel** auto-deploys on push, ~60s lag.

## Memory updates worth adding
- "Single-branch flow active 2026-04-28: `perf/local-test` retired, all work on `main`. After every worktree push: `git -C C:/TheTapestry pull origin main` (fast-forward). No long-lived feature branches."
- "Module marketplace lives at `/modules` (browse) + `/modules/[id]` (detail). Inbound import for non-live snapshot files is `/modules/import`."
- "Insight Die spend kind tracked on `roll_log.insight_used` ('3d6' / '+3cmod' / null) — extended log card surfaces both banners."
- "Bow/Crossbow ammo gate: ranged weapons block Attack when `ammoCurrent <= 0` on clip-tracked weapons. Reload via Ready Weapon."
- "Tactical scene controls popout: `Map Setup` header button → `/scene-controls-popout?c=<id>` at 250×600. State syncs via `lib/scene-controls-bus.ts` BroadcastChannel."

## Companion docs
- `tasks/handoff.md` — the user's curated fresh-chat onboarding handoff (load-times campaign focus + workflow rules + don't-break list). Read that FIRST for orientation; this file is the comprehensive state companion.
- `tasks/loadtimes-roadmap.md` — perf-campaign plan with shipped + remaining items.
- `tasks/todo.md` — full project backlog.
- `tasks/PLAYTEST_TODO.md` — playtest items.
- `tasks/long-term-fixes.md` — genuinely-deferred bucket.
