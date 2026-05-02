# Let's Go To The End

The complete remaining-work list as of 2026-05-02. The launch-gate (5
BLOCKING items) is empty. Everything below is pre-launch polish,
post-launch follow-up, or future roadmap.

---

## 🚨 LAUNCH-BLOCKING

**Empty.** All five items from the 2026-05-01 triage shipped:

| # | Item | Commit |
|---|---|---|
| 4 | Email FROM → noreply@distemperverse.com | `d5a43a5` |
| 1+2 | Campaign-scope RLS on Campfire content | `e1a0a60` |
| 3 | LFG legacy setting backfill | `751ed10` |
| 5 | /firsttimers redirect → WelcomeModal | `6bc5ff6` |

Optional pre-launch hardening (no specific item is blocking):
- Domain verification spot-check on Resend (FROM swap is in code; verify outbound mail still lands)
- One full smoke pass through new-user signup → /firsttimers reference → /welcome → /characters/new save → first /map visit → first whisper

---

## 🟡 OPEN — pre-launch polish (small / medium)

### Bounded — ~1 session each
- **Hide-NPCs multi-select bar** — cross-folder bulk Hide/Reveal. Folder-level + global Show-All already shipped; this is the "select 7 NPCs across 3 folders, hide all in one click" mode.
- **Parent/child pin structure** — schema column + UI nesting so a "rumor about the basement" can hang off "the abandoned warehouse" pin. Schema + indented row in the pin browser + parent picker on the pin form.
- **Pin-image migration base64 → Supabase Storage** — DB migration, per-pin URL rewrite. Low priority but reduces row weight.
- **Tools enhancements** — batch portrait resize, manual crop control on the resizer, auth gating on each /tools page (most already gate via component-level checks).

### Need design input from Xero before I can start
- **Player-facing NPC card on Show All click** — when a player clicks an NPC tile they haven't been formally introduced to, what shows? Name only / name+description / name+portrait+description / something with a "Demand introduction" Recruit-style button?
- **Remaining event instrumentation (9 items)** — backlog says 9 missing instrumented events but doesn't list them. Need the list.
- **Embed Distemper videos** — discarded earlier this session (no clear target page). Re-open if you have a target in mind.

### Content prep (waiting on author copy, not code)
- **King's Crossroads Mall content** — tactical scenes (motel courtyard, Costco, gas station, Belvedere's) + handouts (broadcasts, journal pages, ham-radio transcripts). Wire targets exist in `SETTING_SCENES.kings_crossroads_mall` / `SETTING_HANDOUTS.kings_crossroads_mall`.

---

## ⏸ DEFERRED — explicit reasons

- **Modal unification pass 3** (Attack modal) — declined 2026-05-01: ~480 lines of bespoke pendingRoll attack logic; no win from forcing the shared shell.
- **CMod Stack reusable component** — multi-session refactor; would clean up Recruit / Barter / Social / First Impression / Attack but not pre-launch material.
- **Lag on initiative** — needs a Xero solo repro before I can chase it. No specific symptom logged.
- **Code audit deferrals** — table-page split (5,365 lines), debounce realtime callbacks, sequence guards on loadRolls/loadChat. High-risk pre-game; defer until post-launch.
- **GM Kit v1 image-bucket repointing** — paused 2026-04-19; Phase 5 Modules supersedes. Don't touch.
- **Tactical map mouse-pan via drag** — broken; no fix path identified. Workaround: WASD/arrows or zoom out.
- **Communities Phase B: NPC-proxy recruitment** — depends on Activity Blocks Phase D, which doesn't exist yet.

---

## 🌱 ASPIRATIONAL — Phase 5+

### Phase 5 — Module System
- **Phase C — Marketplace** — `/modules` browse + filters, detail page with version history + reviews, cover-image upload, featured-module surface on dashboard, play stats per module
- **Phase D — Monetization** — Free / Paid / Premium pricing, license unlocks, author payout flow, referral tracking
- **Phase E — Ecosystem** — GM Kit Export v2 (PDF + zip), Module + Community cross-publish, in-session GM toolkit (scene switcher / NPC roster / handouts panel / roll tables), third-party module import (Roll20 / Foundry → Tapestry; stretch)
- **Phase F — GM Adventure Authoring Toolkit** — Story Arc form (4-question), NPC quick-build, Map quick-build, Handout quick-build, Encounter quick-build, route tables for travel arcs, Adventure preview (dry-run), Publish Adventure

### §3 Tactical map long-term lifts
- Dynamic lighting + per-token visibility / fog of war
- Doors token type with `is_open` + movement/vision blocking
- Line of sight polygon vision masks per token

### §3 Lv4 Skill Traits — user-deferred (ship together or not at all)
- Inspiration Lv4 "Beacon of Hope" auto +4 Morale
- Psychology Lv4 "Insightful Counselor" auto +3 Morale
- Generic Lv4 Trait surface on character sheet
- Auto-application hooks (Morale / Recruitment / Fed / Clothed / combat)
- Barter Lv4 cheat-doubling (locked behind Lv4 Trait list)

### §6 Backburners (no triggers fired yet)
- Campaign calendar (date-gated lore events, GM-controlled states)
- Thriver godmode UI sweep (DB-level done; UI deferred)
- NPC health as narrative feeling (deferred 2026-04-26)

### Phase 6-11 Roadmap
- **Phase 6 — Community & Retention** — LFG matching, session scheduling, The Gazette (auto-newsletter), between-session experience, subscriber tiers, Graffiti reactions
- **Phase 7 — Ghost Mode Advanced** — funnel analytics, A/B soft wall, QR onboarding, /firsttimers reactivation
- **Phase 8 — Physical Products** — Chased QR codes, anonymous QR preview, Chased module, Mongrels sourcebook, product landing pages
- **Phase 9 — Maturity** — full SRD content fill (current state: stub hubs everywhere except Communities), contextual rules links, GM quick-ref panel, mobile pass, mobile dice roller, global search
- **Phase 10 — Future Platforms** — Displaced (space setting), `@xse/core` monorepo, per-setting domains
- **Phase 11 — Cross-Platform Parity** — Campaign Calendar, Roll20 Export

---

## ✅ JUST-SHIPPED — 2026-05-01 + 2026-05-02 push

For your records. Roughly 50+ commits. Grouped:

### Sidebar / nav
- Setting hubs (DZ + Kings) moved into /campfire (`0b77ef3`)
- Distemper page-headers across /characters /stories /communities /campfire /rumors /welcome (`9bf178a`, `66d271c`)
- The Rules link promoted next to Rumors (`0b77ef3`)
- /characters creation row: 4 buttons + Test, evenly spaced full-width (`b726ec1`, `8216bf0`, `b3cea1b`)
- /welcome adds Paradigms card to the Building a Survivor row (`a94bf32`)
- Sidebar 'Survivors present' Thriver hover roster (`a94bf32`)

### /campfire
- Mocked /campfire2 portal style → won A/B → folded into /campfire as no-?tab cards / ?tab=<id> tab-strip switcher (`406547a`, `9bf178a`)
- Campfire intro trimmed to one sentence (`b6a5b23`)

### Welcome / onboarding
- WelcomeModal on /dashboard for `onboarded=false`; /firsttimers becomes static reference (`6bc5ff6`)

### SRD redesign
- Style B (cards + pill subnav) applied platform-wide; SectionHub + SectionSubNav generic components (`9ad81c3`)
- 11 stub sections converted to hub-with-cards
- Communities anchors slimmed 16 → 5
- /rules/communities2 deleted; StubPage / StyleBanner / Communities-specific SubNav deleted

### Map / pins
- 🛡️ CANON badge on Thriver-published world-map pins (marker overlay + folder-list inline tag) (`748013c`, `2286583`)
- Players can submit pins on /table — `+ Suggest Pin` for non-GM members; revealed=false for GM review (`aa5c6e8`)
- Map search Nominatim US-first across 8 sites (pre-session)
- WHISPERS — 4th tab on /map sidebar; public message wall, Thriver-deletable, realtime (`5cedb19`)

### Combat / NPC / table
- Recruit Approach tooltip with rules-context HelpTooltip (`8bc95ee`)
- Auto-relationship-penalty on Dire/Low Insight Barter against an NPC (`883f194`)
- Auto-reveal hidden NPCs entering combat via initiative-only path (`b8e5f7d`)
- Per-item Give controls in GM Assets→Objects loot modal (`33f948a`)

### Print sheet
- Initial population for existing chars (relationships, wounds, progression log) (`2e04ef4`)
- Full redesign per Xero feedback: trimmed header, hand-fill RAPID + skill boxes with grey CDP hints, Unarmed without emoji, progression log at bottom, @page margin=0 to suppress browser headers (`a979af2`)
- Wizard Save redirect + print rendering fix (was blank because `print-sheet-active` class was missing) (`871986f`)

### GM tooling
- GM Screen popout: per-panel × close + Reset Layout restores hidden (`642c64b`)
- GM Notes drag-to-reorder (HTML5 drag, sort_order column, above/below drop-position) (`7eea88f`, `fec2fae` parallel-agent merge, `24522c6`)
- Player NPC notes UI (table + PlayerNpcCard hookup) (`bdab202`, `ed7b147`)
- /tools/reseed-campaign — Thriver re-seed of setting content (`7a0e5cb`)
- /tools/campaign-explorer — Thriver oversight roster (`5c8cb3f`)

### RLS / data hygiene
- Campaign-scope SELECT tightening on six Campfire tables (`e1a0a60`)
- LFG legacy setting backfill (`751ed10`)
- Player NPC notes table (`bdab202`)
- Whispers table (`5cedb19`)
- Campaign Notes sort_order column (`7eea88f`)

### Email
- Transactional FROM → noreply@distemperverse.com on notify-thriver + log-visit edge functions (`d5a43a5`)

### Stale strikes (already shipped, doc was wrong)
Katana, Discord `<t:UNIX:f>` renderer, inline timestamp tokens, destroyed-object portrait swap, LFG setting+schedule filters, feed pagination, LFG interest-ping notifications, hide-NPCs folder Show/Hide, hide-NPCs global Show All / Hide All, CharacterEvolution component, CDP audit-log gap.

---

## 🟢 SUMMARY

| Bucket | Count |
|---|---|
| 🚨 Launch-blocking | 0 |
| 🟡 Open pre-launch (bounded) | 4 |
| 🟡 Open pre-launch (needs design) | 3 |
| 🟡 Content prep (waiting on author) | 1 |
| ⏸ Deferred | 7 |
| 🌱 Aspirational Phase 5+ | ~30+ |
| ✅ Shipped this push | ~50 commits |

**The launch-gate is empty.** Everything in the 🟡 column is "the experience gets better with this" rather than "users can't sign up without this." Pick a launch-readiness target with Xero — either ship now and chip away post-launch, or knock out the four bounded items first (Hide-NPCs multi-select, parent/child pins, pin-image migration, tools enhancements) for a tighter v1.

**Suggested order if you want to keep grinding:**
1. Hide-NPCs multi-select bar — bounded, ~1 session
2. Parent/child pin structure — bounded, ~1 session
3. Pin-image migration — DB migration, ~30 min
4. Then design call on Player-facing NPC card on Show All
5. Then content prep handoff for Kings Crossroads
