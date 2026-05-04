# Master Inventory — The Tapestry (2026-05-02)

Complete historical work consolidation. Spine: letsgototheend.md. Cross-verified against backlog-2026-05-01, outstanding-work, handoff evening, git log.

---

## SHIPPED (recent + verified)

### 2026-05-02 (git verified)
- /tools/reseed-campaign (7a0e5cb), /tools/campaign-explorer (5c8cb3f)
- Whispers public wall (5cedb19), NPC multi-select bar (5ce5e97)
- Player NPC notes (ed7b147, bdab202), Stories UI row (d9ba560)

### 2026-05-01 major
- SRD redesign to Style B (9ad81c3): all 11 stubs → SectionHub
- /campfire portal Style B (406547a, 9bf178a), /campfire2 deleted
- Distemper headers across all major pages
- Recruit tooltip (8bc95ee), auto-relationship CMod (883f194), auto-reveal NPCs (b8e5f7d)
- Give loot UI (33f948a), player pins (aa5c6e8), CANON badge (748013c)
- GM Screen modals (642c64b), GM Notes reorder (7eea88f), print redesign (a979af2)

### Launch-blockers (all cleared)
- Email FROM (d5a43a5), Campfire RLS (e1a0a60), LFG backfill (751ed10), /firsttimers modal (6bc5ff6)

**TOTAL: ~60 commits, 5 blockers, ~40 nice-to-haves, 2 major redesigns (SRD, print).**

---

## OPEN — actionable now (13 items)

### Small bounded items
- Parent/child pin structure (schema + UI nesting)
- Character photo base64 → Storage (one-shot migration)
- Tools enhancements (batch resize, manual crop, auth gating)

### Awaiting Xero design call
- Player-facing NPC card on Show All (description/demands/other?)

### Verify post-launch (no code work)
- Funnel event instrumentation (11 events shipped; verify on live traffic)

### Content prep (waiting on author)
- King's Crossroads Mall content (in progress, off list)

---

## DEFERRED (6 items with reasons)

- Modal unification pass 3 (Attack) — declined by Xero; 480 lines bespoke, no shared-shell win
- CMod Stack component — multi-session refactor, not pre-launch
- Lag on initiative — needs Xero solo repro; no action without symptom data
- Code audit deferrals — table split/debounce/guards; high-risk pre-launch
- GM Kit v1 repoint — paused 2026-04-19; Phase 5 Modules supersedes; don't touch
- Communities Phase B NPC-proxy — Activity Blocks Phase D shipped 2026-04-23, un-blocked; needs scoping + small UI

---

## BACKBURNER (3 items, trigger-gated)

Don't touch unless trigger fires:
- Campaign calendar (triggers: forgotten Skip Week, stale world events, auto-encumbrance tick, "X days passed" automation)
- Thriver godmode UI (DB done; UI deferred after pilot; widen-at-caller pattern documented)
- NPC health narrative (Xero deferred 2026-04-26; re-open if different framing)

---

## PHASE 4 NON-GOALS (4 items, parked by design)

Don't build:
- Forum redesign (both Style A/B rejected)
- Hubs for Mongrels/Chased/Custom/Arena (only DZ + Kings featured)
- Homebrew tab redesign (placeholder stays)
- User profiles / reputation

---

## ASPIRATIONAL Phase 5+ (35+ items)

### Phase 5 Module System (flagship, spec: tasks/spec-modules.md)
- Phase C: Marketplace (/modules browse, detail, cover, play stats)
- Phase D: Monetization (Free/Paid/Premium, licenses, payout, referral)
- Phase E: Ecosystem (GM Kit Export v2, Module+Community cross-publish, in-session toolkit, Roll20/Foundry import)
- Phase F: GM Adventure Authoring (Story Arc form, NPC/Map/Handout/Encounter quick-builds, route tables, preview, publish)

### BLOCKED on Xero — Lv4 Skill Traits (ship-together-or-not-at-all)
Full list not yet written. Both Morale bonuses reverted 2026-04-23 per Xero direction.
- Inspiration Lv4 "Beacon of Hope" auto +4 Morale
- Psychology Lv4 "Insightful Counselor" auto +3 Morale
- Generic Lv4 Trait surface on character sheet
- Auto-application hooks (Morale/Recruitment/Fed/Clothed/combat)
- Barter Lv4 cheat-doubling

### Tactical map lifts (3)
- Dynamic lighting + per-token visibility / fog of war
- Doors with is_open + movement/vision blocking
- Line of sight polygon vision masks

### Phase 6—11 roadmap
Phase 6 (Community & Retention: LFG matching, scheduling, Gazette, between-session, subscriber tiers, Graffiti) · Phase 7 (Ghost Mode Advanced) · Phase 8 (Physical Products) · Phase 9 (Maturity) · Phase 10 (Future Platforms) · Phase 11 (Cross-Platform Parity).

---

## DISCARDED (2 items, closed)

- Embed Distemper videos — Xero discarded (no clear target page)
- /firsttimers retention question — replaced by WelcomeModal (6bc5ff6), fully closed

---

## UNCLEAR / NEEDS INVESTIGATION (1 item)

- Tactical map mouse-pan via drag — click-and-drag empty doesn't pan when canvas overflows. Hypothesized causes (no actual overflow, contain:layout interaction, canvas styling) but unverified. Workaround: WASD/arrows work. **Pre-action:** dev tools investigation to confirm root cause, OR Xero says "ship without it."

---

## CROSS-DOC ALIASES (3, unified)

- "Pin-image migration" (backlog) = "Character photo base64 → Storage" (this list). Pins use Storage; characters store base64. Framing corrected.
- "Embed videos" — backlog §7 AND letsgototheend.md ❌ DISCARDED. Closed.
- /firsttimers — backlog "do not touch" AND letsgototheend.md ❌ DISCARDED via WelcomeModal. Closed.

---

## STALE-STRUCK VERIFICATION (26 items)

Items confirmed shipped during 2026-05-01 but lingering on old lists as "open":
Katana · Discord timestamp renderer · inline <t:UNIX:f> tokens · destroyed-object portrait swap · LFG filters (setting+schedule) · pagination (Forums/War Stories/LFG) · LFG interest-ping notifications · hide-NPCs folder Show/Hide + global Show All/Hide All · CharacterEvolution component · CDP audit-log gap.

All verified live in code + git history.

---

## SUMMARY TABLE

| Bucket | Count |
|---|---|
| ✅ Shipped (2026-05-01 to 05-02) | ~60 commits |
| 🟡 Open — actionable now | 3 small + 1 design + 1 verify + 1 content |
| ⏸ Deferred (with reasons) | 6 |
| 🔄 Backburner (trigger-gated) | 3 |
| ⏹ Phase 4 non-goals | 4 |
| 🌱 Aspirational Phase 5+ | ~35+ |
| ❌ Discarded / closed | 2 |
| ❓ Unclear / echoes | 1 |
| 🔀 Duplicates unified | 3 |

**Actionable total (OPEN + Backburner triggers): 13**
**Aspirational total: 35+**

---

## KEY FINDINGS

1. **Lv4 Skill Traits fully blocked** — Ship-together-or-not-at-all enforced. Both Morale bonuses reverted 2026-04-23. No exceptions until full list lands outside repo.

2. **Modal unification declined** — Attack modal's 480 lines have no shared-shell payoff. Deliberate de-scope by Xero.

3. **Code audit deferrals intentional** — Table page split (5,365 lines), debounce, sequence guards all post-launch work. High-risk pre-launch.

4. **Phase 4 Campfire 85%+ complete** — Phases 4A–4C shipped. Remaining 4D (per-community feed) + 4E (pagination/FTS/reactions) all nice-to-have.

5. **Communities ~98% shipped** — Phases A–D fully done. Phase E ~95% shipped. Only per-community Campfire feed + Lv4 bonuses remain, both gated on dependencies.

---

**Generated:** 2026-05-02 evening. **Sources:** letsgototheend.md, backlog-2026-05-01.md, todo.md, totallist.md, PLAYTEST_TODO.md, outstanding-work, handoff evening, spec-modules.md, spec-communities.md, 11 memory projects, 16 feedback rules, git log (100 commits).

