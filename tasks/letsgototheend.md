# Let's Go To The End

The complete remaining-work list as of 2026-05-02 (post-audit + echo
prune). Launch-gate empty. Every item in this doc has the "can I
explain it / articulate why it matters / act on it without asking" test
applied; items that fail are quarantined at the bottom in **❓ NOT
SURE — needs investigation**.

Inline code TODOs are minimal (3 hits, all non-blocking). All 11 SRD
stub sections have been converted to hub-with-cards via SectionHub.

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
- Domain verification spot-check on Resend (FROM swap is in code; verify outbound mail still lands).
- One full smoke pass through new-user signup → /firsttimers reference → /welcome → /characters/new save → first /map visit → first whisper.

---

## 🟡 OPEN — pre-launch polish (small / medium)

Each of these I can open a file and start typing on right now.

### Bounded — ~1 session each
- **Parent/child pin structure** — schema column + UI nesting so a "rumor about the basement" can hang off "the abandoned warehouse" pin. Add `parent_pin_id` self-FK on `map_pins`; render indented children under their parent in the pin browser; add a parent picker on the pin form.
- **Character photo base64 → Supabase Storage migration** — characters' `data.photoDataUrl` currently stores base64-encoded JPEGs inline in the row. One-shot migration: read all characters with a `data:` prefix, upload to a `character-portraits` bucket, replace the value with the public URL. Reduces row weight materially.
- **Tools enhancements** — three sub-items, each a small chunk:
  - Batch portrait resize on `/tools/portrait-resizer` (process N images instead of one).
  - Manual crop control on the resizer (let the user adjust the crop circle).
  - Auth gating audit on every `/tools/*` page (most gate via component-level Thriver check; one quick sweep to confirm the rest do).

### Bounded but awaiting Xero confirm of the spec
- **Funnel event instrumentation (9 events)** — historical "9 missing" was a count Xero had in his head; never enumerated. My read of what would round out the funnel based on what's currently instrumented (`signup`, `login`, `first_*`, `campaign_created`, `session_*`, `roll`, `character_*`, `ghost_converted`):
  1. `whisper_posted`
  2. `community_created`
  3. `module_subscribed` + `module_published`
  4. `recruit_attempted` (with outcome)
  5. `morale_check_run`
  6. `forum_thread_created` + `war_story_published`
  7. `lfg_post_created` + `lfg_interest_pinged`
  8. `npc_revealed` / `pin_revealed`
  9. `character_evolved` (CDP spend)
  Each is a single `logEvent()` call at a known commit point; ~15 min each, ~1 session total. Confirm or swap items, then I ship.

### Need Xero design call
- **Player-facing NPC card on Show All click** — when a GM hits "Show All" and an unintroduced NPC pops into the player's roster, what does the player see when they click it? Already shows portrait, name, type, status, First Impression CMod, Recruit button. Open question: do we add a `description` field, or a "Demand introduction" Recruit-style button, or something else? Has been blocked on this design call across multiple sessions.

### Content prep (waiting on author copy, not code)
- **King's Crossroads Mall content** — tactical scenes (motel courtyard, Costco, gas station, Belvedere's) + handouts (broadcasts, journal pages, ham-radio transcripts). Wire targets already exist in `SETTING_SCENES.kings_crossroads_mall` / `SETTING_HANDOUTS.kings_crossroads_mall`.
- **SRD section content (11 sections)** — Overview, Core Mechanics, Character Overview, Character Creation, Skills, Combat, Equipment, Appendix A–D. The redesign (`9ad81c3`) put hub-with-cards on every section; only Communities has real sub-page content. Authoring task, not engineering.

---

## ⏸ DEFERRED — explicit reasons, but each is actionable when un-deferred

- **Modal unification pass 3** (Attack modal) — declined 2026-05-01 by Xero: ~480 lines of bespoke pendingRoll attack logic; no win from forcing the shared shell.
- **CMod Stack reusable component** — multi-session refactor; would clean up Recruit / Barter / Social / First Impression / Attack but not pre-launch material.
- **Lag on initiative** — needs a Xero solo repro before I can chase it. No specific symptom logged.
- **Code audit deferrals** — table-page split (5,365 lines), debounce realtime callbacks, sequence guards on loadRolls/loadChat. High-risk pre-launch; defer until post-launch.
- **GM Kit v1 image-bucket repointing** — paused 2026-04-19; Phase 5 Modules supersedes. Don't touch (memory: `project_modules_flagship.md`).
- **Communities Phase B: NPC-proxy recruitment** — GM rolls on behalf of a Community's Leader NPC to recruit other NPCs (so a community grows itself off-screen while PCs are elsewhere). Activity Blocks Phase D is shipped (2026-04-23) so this is no longer dependency-blocked — just needs scoping + a small UI pass.

### Backburner — don't touch unless trigger fires
- **Campaign calendar** — triggers: forgotten Skip Week, world events not expiring, "X days passed" automation, encumbrance auto-tick. Build path documented in `tasks/backlog-2026-05-01.md` §6.
- **Thriver godmode UI sweep** — DB-level done; UI deferred. Pilot rolled back. Widen-at-caller pattern (`isGM={isGM || isThriver}`) documented for the eventual sweep.
- **NPC health as narrative feeling** — show WP/RP as descriptive states (Healthy / Ragged / Beaten / Dying) instead of exact numbers on the player-facing card; GM keeps the dots. Deferred 2026-04-26 by Xero: "decided not to ship as currently scoped, re-open if a different framing comes up."

### Phase 4 Campfire explicit non-goals (parked by design)
Per `project_phase_4_campfire.md`:
- Forum redesign (Style A and Style B both rejected by Xero).
- Hubs for Mongrels / Chased / Custom / Arena (only DZ + Kings Crossroads featured).
- Homebrew tab redesign (placeholder stays).
- User profiles / reputation system.

---

## 🌱 ASPIRATIONAL — Phase 5+

### ⚠️ BLOCKED on Xero — Lv4 Skill Traits
Per memory `project_lv4_traits.md`: Xero blocks ALL Lv4 auto-bonuses
until the full authoritative Trait list lands. Inspiration Lv4 "Beacon
of Hope" (+4 Morale) and Psychology Lv4 "Insightful Counselor" (+3
Morale) were already coded then reverted; pre-built hooks sitting
waiting. Ship-together-or-not-at-all.

- Inspiration Lv4 "Beacon of Hope" auto +4 Morale
- Psychology Lv4 "Insightful Counselor" auto +3 Morale
- Generic Lv4 Trait surface on character sheet
- Auto-application hooks (Morale / Recruitment / Fed / Clothed / combat)
- Barter Lv4 cheat-doubling (gated behind same list)

### Phase 5 — Module System (flagship per `project_modules_flagship.md`)
The content engine that supersedes GM Kit v1. Spec lives at
`tasks/spec-modules.md` (100+ lines).

- **Phase C — Marketplace** — `/modules` browse + filters, detail page with version history + reviews, cover-image upload, featured-module surface on dashboard, play stats per module.
- **Phase D — Monetization** — Free / Paid / Premium pricing, license unlocks, author payout flow, referral tracking.
- **Phase E — Ecosystem** — GM Kit Export v2 (PDF + zip), Module + Community cross-publish, in-session GM toolkit (scene switcher / NPC roster / handouts panel / roll tables), third-party module import (Roll20 / Foundry → Tapestry; stretch).
- **Phase F — GM Adventure Authoring Toolkit** — Story Arc form (4-question), NPC quick-build, Map quick-build, Handout quick-build, Encounter quick-build, route tables for travel arcs, Adventure preview (dry-run), Publish Adventure.

### Tactical map long-term lifts
- Dynamic lighting + per-token visibility / fog of war.
- Doors token type with `is_open` + movement/vision blocking.
- Line of sight polygon vision masks per token.

### Phase 6-11 Roadmap
- **Phase 6 — Community & Retention** — LFG matching, session scheduling, The Gazette (auto-newsletter), between-session experience, subscriber tiers, Graffiti reactions.
- **Phase 7 — Ghost Mode Advanced** — funnel analytics, A/B soft wall, QR onboarding, /firsttimers reactivation.
- **Phase 8 — Physical Products** — Chased QR codes, anonymous QR preview, Chased module, Mongrels sourcebook, product landing pages.
- **Phase 9 — Maturity** — full SRD content fill (Communities done, 11 sections stub-hub), contextual rules links, GM quick-ref panel, mobile pass, mobile dice roller, global search.
- **Phase 10 — Future Platforms** — Displaced (space setting), `@xse/core` monorepo, per-setting domains.
- **Phase 11 — Cross-Platform Parity** — Campaign Calendar, Roll20 Export.

---

## ❌ DISCARDED / CLOSED

Items that lived on previous lists but should not appear in the open
queue. Recording for posterity:

- **Embed Distemper videos** — discarded by Xero (no clear target page); will only re-open if a specific page + video URL surfaces.
- **`/firsttimers` retention question** — replaced by WelcomeModal on /dashboard (commit `6bc5ff6`); the page itself is a static reference now. Fully closed.

---

## ❓ NOT SURE — quarantined echoes

Items I can't confidently explain, articulate why they matter, or move
forward on without first investigating. Parked here so they don't keep
ghost-haunting the active queue. To take any of these out, I need to
either find the missing context or have Xero kill them.

- **Tactical map mouse-pan via drag** — long-term-fixes.md says it's broken (click-and-drag on empty cell doesn't pan when canvas overflows) with WASD/arrows as the workaround. The note "no fix path identified" means I literally don't know what to try first. Likely causes listed (canvas may not actually overflow at typical zoom; `contain:layout` paint interaction with `overflow:auto`; canvas needs explicit width/height styling) but no one has confirmed which is the actual cause. Pre-action step required: an investigation session with the dev tools open during the failure to verify which hypothesis matches reality — or Xero says "ship without it" since the workaround works.

That's the only true echo. Everything else above either has a clear next-action or is parked with a documented reason (declined / waiting on copy / waiting on a list / trigger-gated / explicit non-goal).

---

## ✅ JUST-SHIPPED — 2026-05-01 + 2026-05-02 push

For the record. ~60 commits. Grouped chronologically.

### 2026-05-02
| Item | Commit |
|---|---|
| /tools/reseed-campaign — idempotent setting re-seed | `7a0e5cb` |
| /tools/campaign-explorer + GM-name on reseed picker | `5c8cb3f` |
| Whispers — public message wall on /map sidebar | `5cedb19` |
| NPC multi-select bar — cross-folder bulk Hide/Reveal | `5ce5e97` |
| Stories: all player buttons on one row | `d9ba560` |
| Player NPC notes UI inside PlayerNpcCard | `ed7b147` |
| `player_npc_notes` table + RLS | `bdab202` |
| Stories kicked-banner copy trim | `acbfcaa` |

### 2026-05-01 — Sidebar / nav
- Setting hubs (DZ + Kings) moved into /campfire (`0b77ef3`)
- Distemper page-headers across /characters /stories /communities /campfire /rumors /welcome (`9bf178a`, `66d271c`)
- The Rules link promoted next to Rumors (`0b77ef3`)
- /characters creation row: 4 buttons + Test, evenly spaced full-width (`b726ec1`, `8216bf0`, `b3cea1b`)
- /welcome adds Paradigms card to the Building a Survivor row (`a94bf32`)
- Sidebar 'Survivors present' Thriver hover roster (`a94bf32`)

### 2026-05-01 — /campfire
- Mocked /campfire2 portal style → won A/B → folded into /campfire as no-?tab cards / ?tab=<id> tab-strip switcher (`406547a`, `9bf178a`)
- Campfire intro trimmed to one sentence (`b6a5b23`)

### 2026-05-01 — Welcome / onboarding
- WelcomeModal on /dashboard for `onboarded=false`; /firsttimers becomes static reference (`6bc5ff6`)

### 2026-05-01 — SRD redesign
- Style B (cards + pill subnav) applied platform-wide; SectionHub + SectionSubNav generic components (`9ad81c3`)
- 11 stub sections converted to hub-with-cards
- Communities anchors slimmed 16 → 5
- /rules/communities2 deleted; StubPage / StyleBanner / Communities-specific SubNav deleted

### 2026-05-01 — Map / pins
- 🛡️ CANON badge on Thriver-published world-map pins (`748013c`, `2286583`)
- Players can submit pins on /table — `+ Suggest Pin` for non-GM members (`aa5c6e8`)
- Map search Nominatim US-first across 8 sites

### 2026-05-01 — Combat / NPC / table
- Recruit Approach tooltip with rules-context HelpTooltip (`8bc95ee`)
- Auto-relationship-penalty on Dire/Low Insight Barter against an NPC (`883f194`)
- Auto-reveal hidden NPCs entering combat via initiative-only path (`b8e5f7d`)
- Per-item Give controls in GM Assets→Objects loot modal (`33f948a`)

### 2026-05-01 — Print sheet
- Initial population for existing chars (`2e04ef4`)
- Full redesign per Xero feedback: trimmed header, hand-fill RAPID + skill boxes with grey CDP hints, Unarmed without emoji, progression log at bottom, @page margin=0 (`a979af2`)
- Wizard Save redirect + print rendering fix (`871986f`)

### 2026-05-01 — GM tooling
- GM Screen popout: per-panel × close + Reset Layout restores hidden (`642c64b`)
- GM Notes drag-to-reorder (`7eea88f`, `fec2fae` parallel-agent merge, `24522c6`)

### 2026-05-01 — RLS / data hygiene
- Campaign-scope SELECT tightening on six Campfire tables (`e1a0a60`)
- LFG legacy setting backfill (`751ed10`)
- Whispers table + RLS (`5cedb19`)
- Campaign Notes sort_order column (`7eea88f`)

### 2026-05-01 — Email
- Transactional FROM → noreply@distemperverse.com on notify-thriver + log-visit edge functions (`d5a43a5`)

### Stale strikes (already shipped, doc was wrong) — confirmed dead
Katana, Discord `<t:UNIX:f>` renderer, inline timestamp tokens, destroyed-object portrait swap, LFG setting+schedule filters, feed pagination, LFG interest-ping notifications, hide-NPCs folder Show/Hide, hide-NPCs global Show All / Hide All, CharacterEvolution component, CDP audit-log gap.

---

## 🟢 SUMMARY

| Bucket | Count |
|---|---|
| 🚨 Launch-blocking | 0 |
| 🟡 Open pre-launch (bounded, can start now) | 3 |
| 🟡 Bounded awaiting spec confirm (events) | 1 |
| 🟡 Need design call | 1 |
| 🟡 Content prep (waiting on author) | 2 |
| ⏸ Deferred (with reasons) | 6 |
| ⏸ Backburner (trigger-gated) | 3 |
| ⏸ Phase 4 explicit non-goals | 4 |
| 🌱 Aspirational Phase 5+ | ~30+ |
| ❌ Discarded / closed | 2 |
| ❓ Not sure — quarantined | 1 |
| ✅ Shipped 2026-05-01 + 02 | ~60 commits |

**Audit cleanups vs. previous version of this doc:**
- Re-labeled "Pin-image migration" → **Character photo migration** (pins already use Storage; characters store base64).
- Moved **Embed videos** + **/firsttimers retention** to ❌ DISCARDED / CLOSED (both were already closed; were lingering on the open queue).
- Un-blocked **Communities Phase B: NPC-proxy recruitment** — Activity Blocks Phase D shipped 2026-04-23 (per `tasks/spec-communities.md`).
- Promoted **Funnel event instrumentation** out of "needs design" — substituted my synthesized 9-event list as the working spec; awaits Xero confirm but actionable.
- Quarantined **Tactical map mouse-pan via drag** to ❓ NOT SURE — the only true "no fix path identified" item.
