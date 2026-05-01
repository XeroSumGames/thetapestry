# Handoff — 2026-05-01 (evening)

End-of-session log for the long backlog-grinding pass that started after the
morning's go-live triage.

## Session shape

Morning: triage the 2026-05-01 backlog into BLOCKING / NICE-TO-HAVE / SHIPPED /
ASPIRATIONAL. Afternoon + evening: ship every BLOCKING item, plus as many
NICE-TO-HAVE items as could be done without design clarity, plus a print-sheet
redesign and an SRD redesign that came up live.

Started at HEAD `4b63368`. Ended at HEAD `bdab202`. ~25 commits.

## What shipped (in order)

### Sidebar + nav cleanup (early)
- Setting hubs (DZ + Kings Crossroads) pulled out of the sidebar; live inside
  /campfire as a Hubs row. ([0b77ef3](https://github.com/XeroSumGames/thetapestry/commit/0b77ef3))
- "Rules" → "The Rules", moved up next to Rumors.
- Distemper page-header font swap: /characters, /stories, /communities,
  /campfire (both modes), /rumors, /welcome. ([9bf178a](https://github.com/XeroSumGames/thetapestry/commit/9bf178a), [66d271c](https://github.com/XeroSumGames/thetapestry/commit/66d271c))

### /campfire portal (Style B promoted)
- Mocked /campfire2 as a card portal; user picked it over the existing tab
  strip. Folded into /campfire as a switcher: no `?tab` → cards portal,
  `?tab=<id>` → tab strip. Cards link into the tab strip; tab-strip title
  links back. /campfire2 deleted. ([406547a](https://github.com/XeroSumGames/thetapestry/commit/406547a), [9bf178a](https://github.com/XeroSumGames/thetapestry/commit/9bf178a))

### BLOCKING — all 5 shipped
| # | Item | Commit |
|---|---|---|
| 4 | Email FROM → noreply@distemperverse.com (notify-thriver + log-visit deployed live) | `d5a43a5` |
| 1+2 | Campaign-scope RLS on Campfire content (forum_threads, replies, reactions, war_stories, replies, reactions) | `e1a0a60` |
| 3 | LFG legacy setting backfill ('Any' → NULL, 'Empty' → 'empty', 'Chased' → 'chased') | `751ed10` |
| 5 | /firsttimers redirect → home-screen WelcomeModal on /dashboard; /firsttimers stays as reference | `6bc5ff6` |

### NICE-TO-HAVE shipped
- Recruit Approach tooltip on table page Recruit modal. ([8bc95ee](https://github.com/XeroSumGames/thetapestry/commit/8bc95ee))
- Auto -1 relationship CMod on Barter Dire/Low Insight against an NPC. ([883f194](https://github.com/XeroSumGames/thetapestry/commit/883f194))
- Auto-reveal hidden NPCs entering combat (initiative-roster path). ([b8e5f7d](https://github.com/XeroSumGames/thetapestry/commit/b8e5f7d))
- Per-item Give-loot controls in GM Assets→Objects modal (mirrors ObjectCard). ([33f948a](https://github.com/XeroSumGames/thetapestry/commit/33f948a))
- Players can submit pins on /table (revealed=false until GM approves). ([aa5c6e8](https://github.com/XeroSumGames/thetapestry/commit/aa5c6e8))
- 🛡️ CANON badge on Thriver-published world-map pins (marker overlay + folder-list inline tag). ([748013c](https://github.com/XeroSumGames/thetapestry/commit/748013c), [2286583](https://github.com/XeroSumGames/thetapestry/commit/2286583))
- GM Screen popout: per-panel × close + Reset Layout restores hidden panels. ([642c64b](https://github.com/XeroSumGames/thetapestry/commit/642c64b))
- GM Notes drag-to-reorder (HTML5 drag, sort_order column with above/below drop-position). ([7eea88f](https://github.com/XeroSumGames/thetapestry/commit/7eea88f), `fec2fae` parallel-agent merge, `24522c6`)
- Print sheet: trimmed header (no Distemper wordmark, no complication sidebar), hand-fill RAPID + skill boxes with grey CDP hints, Unarmed without emoji, progression log added at the bottom; @page margin=0 to suppress browser-added headers. ([a979af2](https://github.com/XeroSumGames/thetapestry/commit/a979af2))
- Wizard Save: redirect to /characters after save (was sticking on step 9). Print sheet rendering: added missing `print-sheet-active` class to wizard wrappers (was rendering blank). ([871986f](https://github.com/XeroSumGames/thetapestry/commit/871986f))

### SRD redesign (Style B winner everywhere)
- /rules/communities (was 807-line Style A) → 12-line hub using new SectionHub. ([9ad81c3](https://github.com/XeroSumGames/thetapestry/commit/9ad81c3))
- 5 Communities sub-pages moved from communities2/ to communities/. StyleBanner removed.
- Communities anchors slimmed from 16 to 5 (the ones that have real sub-pages).
- All 11 stub sections (overview, core-mechanics, character-overview, character-creation, skills, combat, equipment, appendix-tables, appendix-skills, appendix-equipment, appendix-paradigms) converted to use `<SectionHub />` so users see a planned-outline card grid instead of a generic Forthcoming banner.
- New generic components: `components/rules/SectionHub.tsx`, `components/rules/SectionSubNav.tsx`.
- Deleted: `/rules/communities2/`, `components/rules/StubPage.tsx`, `components/rules/StyleBanner.tsx`, `components/rules/communities/SubNav.tsx`.

### Schema migrations applied live
- `sql/campfire-rls-tighten-campaign-scope.sql` — campaign-scope SELECT on six Campfire tables.
- `sql/lfg-setting-backfill.sql` — 3 legacy LFG rows normalized.
- `sql/campaign-notes-sort-order.sql` — sort_order column + index for GM Notes drag-reorder.
- `sql/player-npc-notes.sql` — table for per-character NPC notes (UI pending).

### Triage dispositions (from Xero call)
- ✅ done: CDP tracker boxes, GM force-push view, login-flow audit, multi-round haggling, per-item Give-loot
- ❌ discarded: embed Distemper videos
- ✅ canon badge: shipped (originally tagged "not sure")

### Stale strikes (already shipped, doc was wrong)
Katana, Discord `<t:UNIX:f>` renderer, inline timestamp tokens, destroyed-object portrait swap, LFG setting+schedule filters, feed pagination, LFG interest-ping notifications, hide-NPCs folder Show/Hide, hide-NPCs global Show All / Hide All, CharacterEvolution component.

## Still open

### Substantial features (next session candidates)
- /tools/reseed-campaign (idempotent re-seed for setting content)
- Player NPC notes UI (table exists; PlayerNpcCard hookup pending)
- Player-facing NPC card on Show All click — design call needed
- Parent/child pin structure
- Pin-image migration from base64 → Supabase Storage
- Hide-NPCs multi-select bar
- Tools enhancements (batch / crop / auth gating)
- Remaining event instrumentation (9 items — needs a list from Xero)

### Aspirational (Phase 5+)
Module marketplace (Phase C), Lv4 Skill Traits, dynamic lighting, doors, LOS,
Phase 6-11 roadmap. Not launch-gating.

## Architecture changes worth knowing

- **Print sheet contract:** `<PrintSheet state={...} liveState={...} />`.
  Wizard print paths skip `liveState` and get a blank-form sheet. CharacterCard
  passes liveState (relationships, wounds, progressionLog) so the printout
  doubles as a journey record.
- **SRD page contract:** every `/rules/<section>/page.tsx` is now a 7-line
  thunk returning `<SectionHub section={findSection(slug)!} />`. Sub-pages get
  `<SectionSubNav />` for the pill nav. New section content goes in
  `lib/rules/sections.ts` (anchor list) + a new `app/rules/<section>/<anchor>/`
  directory.
- **CANON badge:** inferred from author role, no new column. RLS already
  prevents non-Thrivers from editing Thriver-authored pins; the badge just
  visualizes that boundary.
- **Player pins on /table:** RLS already permitted member INSERT; the UI was
  the only gate. Players see `+ Suggest Pin` and a 3-second "✓ Pin submitted"
  toast on save; pins land revealed=false for GM review.
- **GM Notes reorder:** `campaign_notes.sort_order` column + HTML5 drag with
  above/below drop position. `load()` orders by `sort_order ASC NULLS LAST,
  created_at ASC`. New inserts compute `max(sort_order) + 1` so they land at
  the bottom.

## Files to know

- `components/rules/SectionHub.tsx` — generic hub layout (cards)
- `components/rules/SectionSubNav.tsx` — generic pill subnav
- `components/WelcomeModal.tsx` — first-visit popup over /dashboard
- `tasks/backlog-triaged-2026-05-01.md` — all backlog dispositions
- `tasks/backlog-2026-05-01.md` — original curated backlog (now mostly outdated)

## Memory updates this session

- `feedback_portal_landing_pattern.md` — portal cards on root, tab-strip preserved as drill-down via `?tab=<id>`
- `reference_supabase_db_query.md` — `npx supabase db query --linked -f sql/<file>.sql` is the canonical migration apply path; same CLI deploys edge functions; no Docker needed
