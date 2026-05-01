# Backlog Triage — 2026-05-01 (updated 2026-05-01 late evening)

Total items reviewed: ~95. Bucket counts after the full session:
BLOCKING 0 (all 5 shipped), NICE-TO-HAVE 8 actually open (the rest shipped
or stale-struck), ALREADY SHIPPED 40+, ASPIRATIONAL 35.

Big late-session work added (not in original backlog):
  • Print sheet redesign per Xero's annotated preview (header trim, hand-fill
    boxes with grey CDP hints, progression log added). Commit a979af2.
  • SRD redesigned in the Style B winner shape — every section now uses the
    generic SectionHub component with a card grid. Commit 9ad81c3.
  • GM Notes drag-to-reorder, GM Screen per-panel × close, /campfire portal
    promotion, player pins on /table, CANON badge on Thriver pins.

End-of-session summary at tasks/handoff-2026-05-01-evening.md.

Source: `tasks/backlog-2026-05-01.md`. Verified against current code and recent commits (HEAD `66d271c`).

---

## ✅ BLOCKING — ALL SHIPPED THIS SESSION

| # | Item | Commit |
|---|---|---|
| 4 | Email FROM → noreply@distemperverse.com | d5a43a5 |
| 1+2 | Campaign-scope RLS on Campfire content | e1a0a60 |
| 3 | LFG legacy setting backfill | 751ed10 |
| 5 | /firsttimers redirect → home-screen welcome modal | 6bc5ff6 |

### Original BLOCKING list (preserved for reference)

### Security — RLS gaps on campaign-tagged feeds
- **forum_threads.SELECT lets any auth'd user read campaign-tagged threads** — `sql/forums.sql:113-115` policy is `auth.uid() IS NOT NULL` only; threads tagged with `campaign_id` are still visible to non-members.
  - Source: §0
  - Evidence: read `sql/forums.sql` — `ft_select` USING clause has no campaign-membership join. `forum_threads.campaign_id` column was added in `sql/forum-threads-campaign-id.sql` but no follow-up RLS migration exists.
- **war_stories.SELECT same gap** — `sql/war-stories.sql` `ws_select` policy is `auth.uid() IS NOT NULL`. Campaign-tagged War Stories leak to all authenticated users.
  - Source: §0
  - Evidence: `grep -A 3 ws_select sql/war-stories.sql` confirms.
  - Fix shape: SELECT policy needs `(campaign_id IS NULL) OR EXISTS (membership)` — same shape as `campaign-pins-rls-members-insert.sql` already in repo.

### Data integrity — pre-Phase-4A LFG row backfill
- **Old freetext LFG `setting` rows ("Distemper", "Homebrew", "Chased") don't match any chip filter** — show only in "All" view, invisible in setting hubs.
  - Source: §0
  - Evidence: `sql/campfire-setting-discriminator.sql:16-19` documents the legacy free-text rows; no backfill migration written. New users finding LFG via Kings Crossroads / Distemper hubs will see an unexpectedly empty feed.
  - Fix: one-shot UPDATE mapping known free-text labels → canonical slugs.

### Email — FROM address still on `onboarding@resend.dev`
- **Email FROM on `notify-thriver` and `log-visit` Edge Functions is `onboarding@resend.dev`**. Looks like spam to recipients; user-visible in every transactional email a stranger gets.
  - Source: §2 small items
  - Evidence: `supabase/functions/notify-thriver/index.ts:41` and `supabase/functions/log-visit/index.ts:116`. Domain on Resend is verified per backlog note. One-line change × 2 files + redeploy.

### Onboarding — `/firsttimers` redirect-to-dashboard
- **`/firsttimers` auto-redirects new users away from the very page meant to onboard them** if `profiles.onboarded = true`. Item is parked "DO NOT touch until Xero approves" but if they arrive here in launch comms, they bounce silently.
  - Source: §6 backburner — but launch-relevant
  - Evidence: backlog explicitly notes this is broken; component exists at `app/firsttimers/page.tsx`. Needs Xero call before fix, but flagging as launch-relevant rather than backburner.
  - **Open question for Xero** — see bottom.

---

## 🟡 NICE-TO-HAVE — actually-actionable remainder

After this session's pass, 10 of the original 35 are either shipped or
stale (see "Stale-struck" section below). Real remaining work:

### Small wins shipped this session
- ✅ Communities Phase B: deeper Approach tooltip (8bc95ee)
- ✅ Auto-relationship-penalty on Dire/Low Insight Barter (883f194)
- ✅ Hide-NPCs reveal UX: auto-reveal on Start Combat (b8e5f7d)

### Closed by Xero call + late-session work
- ✅ CDP tracker boxes — DONE (resolved into print-sheet hand-fill rewrite)
- ❌ Embed Distemper videos on landing page — DISCARDED (no clear target)
- ✅ GM force-push view to players — DONE (scene + zoom sync covers it)
- ✅ Streamline player login flow — DONE (current path is fine)
- ✅ Multi-round haggling — DONE (single-roll is the canonical UX)
- ✅ Surface per-item Give-loot UI — shipped 33f948a
- ✅ Immutable canon layer — shipped as 🛡️ CANON badge (748013c, 2286583)
- ✅ Print sheet population — shipped 2e04ef4, then redesigned a979af2
- ✅ Players can drop pins on /table — shipped aa5c6e8
- ✅ GM Notes drag-to-reorder — shipped 7eea88f (+ user's parallel refinement merged)
- ✅ GM Screen per-panel × close — shipped 642c64b
- ✅ Auto-relationship-penalty on Dire/Low Insight Barter — shipped 883f194
- ✅ Hide-NPCs auto-reveal on Start Combat — shipped b8e5f7d
- ✅ Recruit Approach tooltip — shipped 8bc95ee

### Still open — feature work (next-session candidates)
- /tools/reseed-campaign (idempotent re-seed for setting content)
- Hide-NPCs reveal UX: multi-select bar (folder Show/Hide + global Show-All already shipped)
- Player-facing NPC card on Show All (read-only details surface) — needs design call
- Player NPC notes UI (table shipped — sql/player-npc-notes.sql; PlayerNpcCard hookup pending)
- Parent/child pin structure (schema + UI nesting)
- Remaining event instrumentation (9 items — needs the list from Xero)
- Pin-image migration from base64 → Supabase Storage
- Tools enhancements (batch / crop / auth gating)

### Larger / deferred
- Modal unification pass 3 (Attack — declined; bespoke logic, no win)
- CMod Stack reusable component (multi-session refactor)
- Lag on initiative (needs Xero solo repro)
- King's Crossroads Mall content seeding (content prep, not code)
- Communities Phase B: NPC-proxy recruitment (depends on Activity Blocks Phase D)
- Code audit deferrals (table page split, debounce realtime — high risk)
- GM Kit v1 image-bucket repointing (paused — Phase 5 supersedes)
- Tactical map pan via mouse drag (broken; deferred 2026-04-27)

### Stale-struck this session (already shipped, not actually open)
- Add Katana to weapon DB → already in lib/weapons.ts:78
- Tapestry-side <t:UNIX:format> Discord token renderer → lib/rich-text.tsx
- Inline <t:UNIX:f> token rendering → wired into 15 surfaces
- Destroyed-object portrait swap → TacticalMap.tsx:858-877
- LFG filters by setting + schedule → lfg/page.tsx (settingFilter + scheduleQuery)
- Pagination on feeds → all three Campfire surfaces
- Notifications UI for LFG interest pings → NotificationBell.tsx:475 renders type='lfg_interest'
- Auto-relationship-penalty on Barter → shipped this session (883f194)
- Approach tooltip → shipped this session (8bc95ee)
- Hide-NPCs auto-reveal on Start Combat → shipped this session (b8e5f7d)

---

## ✅ ALREADY SHIPPED — strike from list

- **Pagination on Forums / War Stories / LFG** — `app/campfire/forums/page.tsx:138`, `war-stories/page.tsx:143`, `lfg/page.tsx:246` all use `PAGE_SIZE` + `.range(...)`. (§1, §4E)
- **Phase 4A–E (final)** — all 5 sub-phases shipped today: `db6586a`, `6704c56`, `f9609e4`, `3ba25a8`, `9725b09`, `e8686d9`, `71c4044`.
- **Reactions + threading + FTS + invitations** — `71c4044`. (§1)
- **forum_threads.campaign_id column + index** — `6704c56`, `sql/forum-threads-campaign-id.sql`. (§1)
- **Stress Check / Breaking Point / Lasting Wound modal unification** — `03aad03`. (§2)
- **Recruit result step modal pass 2** — `3cb302e`. (§2)
- **CDP Calculator audit-log gap** — `89c6b14` writes `outcome='evolution'` to `roll_log`. (§3)
- **CharacterEvolution component** — `components/CharacterEvolution.tsx` exists; CDP balance + buyable upgrades + preview + apply already ship-side. (§3 — only "polish CDP tracker boxes" remains)
- **Map search Nominatim US-first** — shipped across 8 sites, `38057f8`. (§2)
- **Tooltips throughout character creation** — `6e224e7`. (§2)
- **What They Have weapon catalog overhaul** — `1a4774d`. (Wizard quality)
- **Vocational skill step-down + unspent-CDP warning** — `4040efb`. (Wizard quality)
- **StepEight search-input focus fix** — `1f0e2cc`. (Wizard quality)
- **PlayerNpcCard First Impression skip-the-picker** — `5e3dd01`. (§2)
- **PC↔Vehicle item transfer + stockpile realtime sub** — `d9063a5`. (Inventory)
- **Stockpile withdraw-to-PC button** — `619fdb8`. (Inventory)
- **House-rule overencumbered time-tick (-1 RP/hr)** — `cc055ac`. (Inventory)
- **Comic-reader popout** — `03d227f`.
- **Map-setup grid persistence + cell_px fix** — `4472014`, `360ed6f`, `a2afa60`.
- **/rules SRD reference (Communities + 11 stubs + Wix export)** — `7336a00`. (§9 partial)
- **Apprentice rewrite Profession-based per SRD §08** — `48f8517`.
- **Font-size guardrail offenders** — guardrail script reports clean (`[check-font-sizes] OK`). The §0 entries for `TradeNegotiationModal.tsx:217` (rarityCol is a variable, not `#3a3a3a`) and `CampaignCommunity.tsx:2200` are stale.
- **Listed-module Thriver moderation queue** — already noted as shipped 2026-04-24. (§4 Phase C)

---

## 🌱 ASPIRATIONAL — long-term roadmap, not launch-gating

### Phase 4 explicit non-goals (parked by design)
- Forum redesign (both Style A and B disliked)
- Hubs for Mongrels / Chased / Custom / Arena
- Homebrew tab redesign
- User profiles / reputation

### §3 Tactical map long-term lifts
- Dynamic lighting + per-token visibility / fog of war
- Doors token type with `is_open` + movement/vision blocking
- Line of sight polygon vision masks

### §3 Lv4 Skill Traits (user-deferred — ship together or not at all)
- Inspiration Lv4 "Beacon of Hope" auto +4 Morale
- Psychology Lv4 "Insightful Counselor" auto +3 Morale
- Generic Lv4 Trait surface on character sheet
- Auto-application hooks (Morale / Recruitment / Fed / Clothed / combat)
- Barter Lv4 cheat-doubling (locked behind Lv4 list)

### §4 Phase 5 Module System
- Phase C — Marketplace (`/modules`, detail, cover upload, play stats)
- Phase D — Monetization + tiers
- Phase E — GM Kit Export v2, Module+Community cross-publish, in-session GM toolkit, third-party import
- Phase F — GM Adventure Authoring Toolkit (story arc, quick-build NPCs/maps/handouts/encounters, route tables, preview, publish)

### §6 Backburners
- Campaign calendar (no triggers fired yet)
- Thriver godmode UI sweep (DB-level done; UI deferred)
- NPC health as narrative feeling (deferred 2026-04-26)

### §9 Phases 6–11 roadmap
- Phase 6 — Community & Retention (LFG matching, scheduling, Gazette, between-session, subscriber tiers, Graffiti)
- Phase 7 — Ghost Mode Advanced (analytics, A/B, QR onboarding, `/firsttimers` reactivation)
- Phase 8 — Physical Products (Chased QR, anonymous preview, Mongrels sourcebook, product landing pages)
- Phase 9 — Maturity (full SRD, contextual rules links, GM quick-ref, mobile pass, mobile dice, global search)
- Phase 10 — Future Platforms (Displaced, `@xse/core` monorepo, per-setting domains)
- Phase 11 — Cross-Platform Parity (Campaign Calendar for Displaced, Roll20 export)

---

## Open questions for Xero

1. **`/firsttimers` redirect** — flagged BLOCKING because if launch comms point new users here, they bounce. Backlog says "DO NOT touch until Xero approves." Do you want the redirect dropped, made opt-in via `?firsttime=1`, or keep the parking lot and link new users somewhere else?
2. **RLS fix scope** — should the SELECT tightening on `forum_threads` and `war_stories` mirror the existing `campaign-pins-rls-members-insert.sql` shape (membership join via `campaign_members`), or do you want a different policy (e.g. include Thriver bypass)?
3. **LFG legacy backfill mapping** — for the pre-Phase-4A free-text rows: "Distemper" → ? (district_zero? ambiguous), "Chased" → ? (no slug yet), "Homebrew" → keep as-is (no canonical slug). Need the mapping from you.
4. **Email FROM redeploy** — Resend domain is verified per the backlog note, but I haven't confirmed it independently. Want me to verify with a Resend API check before flipping the FROM, or just ship it?
5. **Initiative lag** — backlog says "needs Xero solo validation." Any specific symptom (turn delay seconds, freeze, missed broadcasts)? Without a repro this stays in NICE-TO-HAVE.
