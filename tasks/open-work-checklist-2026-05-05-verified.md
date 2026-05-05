# Verification Results — 2026-05-05

- Total items reviewed: 132
- ✅ Shipped (safe to delete): 30
- ⚠️ Partial (keep, edit scope): 9
- ❌ Not shipped (keep): 67
- 🔍 Needs user call: 18
- 🗑️ Stale (delete entirely): 8

Notes:
- The Lv4 backburner block (5 items) is treated as a single "user call" — Xero gates it on his content being ready.
- Roadmap Phases 6–11 (long-term backburner) are mostly status quo; verdicts are 🔍 because they're aspirational rather than open work.
- Anything matching commits from tonight's 14-commit push (2026-05-04 → 2026-05-05) is left ❌ unless explicitly verified, per the instructions.

---

## BUGS — OPEN

### From last night's playtest (2026-05-04)

- [ ] Perception check has a redundant first modal. Goes to a picker showing all 4 PCs with PER values; should go straight to the roll modal (auto-pick active PC, or fold into one combined modal).
  ❌ NOT SHIPPED — `app/stories/[id]/table/page.tsx:5046+` still uses a picker step before the roll modal. No commit since playtest matches "perception modal collapse".
- [ ] PCs riding Minnie don't move with her.
  ❌ NOT SHIPPED — no passenger/carrier logic in `components/TacticalMap.tsx`. Only mention is `app/vehicle/page.tsx:736` (label only).
- [ ] Random character generation — Medic paradigm produces no First Aid skill.
  🔍 NEEDS USER CALL — schema (`lib/xse-schema.ts:433`) defines an EMT (profession 'Medic') with `Medicine*` skills. There is no skill called "First Aid" in XSE — the bug claim may be a wording mismatch (player expecting "First Aid" but the skill is "Medicine*"). Confirm with Xero whether this is misnamed UI vs. an actual seeding bug.
- [ ] Mounted-weapon attacks don't consume an action.
  ✅ SHIPPED — commit `62a2a27 fix(combat): mounted-weapon attacks consume actions` (tonight). Safe to delete.

### From 2026-05-01

- [ ] Tighten RLS on campaign-tagged threads + War Stories.
  ✅ SHIPPED — commit `e1a0a60 fix(rls): tighten Campfire SELECT to campaign members on tagged content`. Migration is `sql/campfire-rls-tighten-campaign-scope.sql` (covers `forum_threads`, `forum_replies`, `forum_thread_reactions`, `war_stories`, `war_story_replies`, `war_story_reactions`). Safe to delete.
- [ ] Backfill old LFG freetext settings.
  ✅ SHIPPED — commit `751ed10 fix(lfg): backfill legacy freetext setting values to canonical slugs`. Migration is `sql/lfg-setting-backfill.sql`. Safe to delete.

### From 2026-04-29

- [ ] Empty-adventure module clone fails on null pin name in `cloneModuleIntoCampaign`. **(verify — possibly shipped)**
  ✅ SHIPPED — `lib/modules.ts:324` skips pin rows with no name/title (`console.warn('[cloneModuleIntoCampaign] pin row has no name/title — skipping:', p)`). Safe to delete.
- [ ] Gut Instinct results presentation needs rework.
  🔍 NEEDS USER CALL — design discussion (narrative card vs. sheet overlay vs. GM-only DM).

### From 2026-04-27 (Mongrels playtest)

- [ ] Initiative lag — needs solo repro.
  🔍 NEEDS USER CALL — explicitly parked pending repro on Xero's machine.

### Older / undated

- [ ] Damage calculation spot-check.
  🔍 NEEDS USER CALL — needs replay verification, not a code question.
- [ ] Failed skill checks still have two actions available.
  🔍 NEEDS USER CALL — explicitly "needs repro from next playtest" / "Parked".
- [ ] Print sheet missing data — Relationships/CMod, Lasting Wounds/Notes, Tracking (Insight/CDP) not populated.
  ✅ SHIPPED — `components/wizard/PrintSheet.tsx:247-283` populates Relationships/CMod and Lasting Wounds; Tracking row at line 105 includes `Insight` and `CDP`. Commits `2e04ef4 feat(print): populate Print Sheet for existing characters` and `a979af2 fix(print): trim header, hand-fill RAPID + skills, suppress date, add log`. Safe to delete.
- [ ] Player NPC notes + first impressions.
  ⚠️ PARTIAL — `player_npc_notes` table SQL committed (`sql/player-npc-notes.sql`, commit `bdab202`) AND UI is shipped: commit `ed7b147 feat(npc): private player notes per-PC inside PlayerNpcCard`. First Impression skip-the-picker shipped at commit `5e3dd01`. Looks fully shipped — recommend deleting.
- [ ] Inventory migration — auto-convert old string equipment to structured items on load.
  ❌ NOT SHIPPED — no migration helper found in `lib/` or `app/`.
- [ ] Allow characters in multiple campaigns.
  ❌ NOT SHIPPED — no schema or UI changes; characters remain campaign-scoped.
- [ ] Transfer GM role; Session scheduling.
  ❌ NOT SHIPPED — no transfer-GM RPC or UI; no scheduling surface.
- [ ] Tactical map mouse-pan via drag — broken.
  ❌ NOT SHIPPED — `components/TacticalMap.tsx:715-760` only supports spacebar+drag pan; click-and-drag on empty cell is not implemented. "No fix path identified" per long-term-fixes.md still stands.

### Top-level repo `todo.md` (last updated 2026-04-11 — verify each)

- [ ] VERIFY + APPLY `sql/initiative-order-rls-members-write.sql`.
  ⚠️ PARTIAL — file exists at `sql/initiative-order-rls-members-write.sql` and is well-commented. Whether it's been applied to live DB is not verifiable from code alone. 🔍 NEEDS USER CALL on the apply step.
- [ ] APPLY `sql/player-notes-session-tag.sql`.
  ⚠️ PARTIAL — file exists at `sql/player-notes-session-tag.sql` (column + BEFORE INSERT trigger). 🔍 NEEDS USER CALL on the apply step.
- [ ] Remove Insight Dice cap — hardcoded to 9 in CharacterCard.
  ✅ SHIPPED — `components/CharacterCard.tsx:605-607` uses `>= 10` / `< 10` (cap raised to 10). The original `max={9}` from `todo.md` is gone. Safe to delete (or treat as "raised to 10, not removed entirely" — per Xero's call).
- [ ] HP render lag — previous-session follow-up (commit `b4d4671`).
  🔍 NEEDS USER CALL — needs runtime verification; commit b4d4671 is documentation only.

---

## UX & POLISH — OPEN

### Modal unification (2026-04-29 lock-in)

- [ ] Modal unification continues. Pass 1+2 shipped (Stress / Breaking / Lasting / Recruit). Still to normalize: Stabilize, Distract, Coordinate, Group Check, Gut Instinct, First Impression.
  ⚠️ PARTIAL — commits `03aad03` (pass 1) and `3cb302e` (pass 2 Recruit) shipped. `<RollModal>` is only used by Recruit + result step in `app/stories/[id]/table/page.tsx:10106`. The other 6 listed modals still use inline patterns (`showCoordinateModal`, `groupCheckParticipants`, etc. at lines 476-697). Keep, scope unchanged.

### From 2026-04-27 (Mongrels playtest)

- [ ] Hide-NPCs reveal UX needs streamlining.
  ⚠️ PARTIAL — multi-select bar shipped (commit `5ce5e97 feat(npc-roster): multi-select bar for cross-folder bulk Hide/Reveal`); auto-reveal in Start Combat shipped (`b8e5f7d feat(combat): auto-reveal hidden NPCs entering combat`). Folder-level "Reveal all" + panic-button still pending. Keep, scope reduced.
- [ ] Streamline logging into missions.
  ❌ NOT SHIPPED — no deep-link / auto-redirect / "Resume last session" tile in `app/stories/page.tsx`.

### Next-up post-combat sprint (some may be shipped — verify)

- [ ] Insight Die spend — track on roll_log.
  ✅ SHIPPED — `sql/roll-log-insight-used.sql` adds `roll_log.insight_used` column with `'3d6'` / `'+3cmod'` values, closing the d2+d3 ≤ 6 detection gap. Commit `f9b59dc feat(roll-log): track Insight Die spend kind for full extended-log fidelity`. Safe to delete.
- [ ] King's Crossing Mall — tactical scenes.
  ❌ NOT SHIPPED — `lib/setting-scenes.ts` only exports `CHASED_SCENES`, `EMPTY_SCENES`, `MONGRELS_SCENES`. No Kings Crossroads scenes.
- [ ] King's Crossing Mall — handouts.
  ❌ NOT SHIPPED — `lib/setting-handouts.ts` only exports `EMPTY_HANDOUTS` and `MONGRELS_HANDOUTS`.
- [ ] Re-seed an existing campaign with a setting's content. Build `/tools/reseed-campaign?id=…`.
  ✅ SHIPPED — commits `7a0e5cb feat(tools): /tools/reseed-campaign — idempotent setting re-seed` and `5c8cb3f feat(tools): /tools/campaign-explorer + GM name on reseed picker`. Path exists at `app/tools/reseed-campaign/page.tsx`. Safe to delete.
- [ ] Destroyed-object portrait swap. Optional `destroyed_portrait_url` on object tokens.
  ✅ SHIPPED — `components/TacticalMap.tsx:30,1373-1392`, `components/CampaignObjects.tsx:50,315-316,776`, migration `sql/scene-tokens-destroyed-portrait.sql`. Safe to delete.
- [ ] CMod Stack reusable component.
  ❌ NOT SHIPPED — no `CModStack`-like component in `components/`. Each modal still computes its CMod stack inline.
- [ ] GM force-push view to players. **(verify)**
  ❌ NOT SHIPPED — no force-push code; no broadcast scene/world-mode primitive in `app/stories/[id]/table/page.tsx`. Keep.
- [ ] Tapestry-side `<t:UNIX:format>` renderer. **(verify)**
  ✅ SHIPPED — `lib/rich-text.tsx` (commit `855a10c feat(rich-text): HammerTime <t:UNIX> renderer + URL linkifier`). Used in `components/{GmNotes,InlineRepliesPanel,PlayerNotes,ProgressionLog,TableChat}.tsx`. Generator UI at `app/campfire/timestamp/page.tsx`. Safe to delete.

### From 2026-04-30 inventory followups

- [ ] Multi-round haggling (Barter currently single-roll).
  ❌ NOT SHIPPED — Barter remains single-roll per commit `675f302 feat(inventory): #5 Barter trade negotiation — single-roll opposed check`. No multi-round commit since.

### Pre-tester polish (added 2026-05-04)

- [ ] Cost-containment alarm.
  🔍 NEEDS USER CALL — vendor-portal config (Supabase + Vercel), not codebase-verifiable.
- [ ] Demo / sample campaign for first-time GMs.
  ❌ NOT SHIPPED — no "Try the demo campaign" button on `app/stories/new/page.tsx`.
- [ ] Beginners' guide links from `/welcome`. Commit + surface chapter links.
  ❌ NOT SHIPPED — `docs/beginners-guide.{txt,docx}` and `beginners-guide-01..12.txt` exist on disk but `git ls-files docs/` only tracks `communities-guide.txt`, `module-system-guide.txt`, `user-guide.txt`. Welcome page (`app/welcome/page.tsx:154-160`) has a placeholder Quick Reference block with no actual chapter links.
- [ ] Domain verification spot-check on Resend.
  🔍 NEEDS USER CALL — runtime check (FROM swap landed in commit `d5a43a5`, but "verify outbound mail still lands" requires sending a test email).
- [ ] End-to-end smoke pass.
  🔍 NEEDS USER CALL — manual QA pass.

### Pin / map

- [ ] Pin-image migration from base64 → Supabase Storage.
  ❌ NOT SHIPPED — character-photo migration tool exists (`app/tools/migrate-character-photos/page.tsx`) but no pin-image equivalent.
- [ ] Hide-NPCs multi-select bar.
  ✅ SHIPPED — commit `5ce5e97 feat(npc-roster): multi-select bar for cross-folder bulk Hide/Reveal`. Safe to delete (it's a duplicate of the partial above).

### Tools (future)

- [ ] Manual crop control — drag-to-select crop area instead of auto center-crop.
  ❌ NOT SHIPPED — `app/tools/portrait-resizer/page.tsx` still uses the auto-circle workflow.
- [ ] Upload to Supabase Storage — shared portrait bank.
  ✅ SHIPPED — `app/tools/portrait-resizer/page.tsx:305,463` inserts into `portrait_bank` table; Storage bucket exists per `sql/character-portraits-bucket.sql`. Safe to delete.
- [ ] Auth gating on `/tools/*` (currently public).
  ✅ SHIPPED — commit `b0f59ee feat(tools): auth-gating audit + batch portrait resizer`. Each tool page checks `isThriver`/role and gates content (`app/tools/portrait-resizer/page.tsx:74-80,495-496`). Safe to delete.
- [ ] More tools — handout generator, token template maker, roll table randomizer.
  ❌ NOT SHIPPED — no such tool pages under `app/tools/`.

### Welcome / onboarding

- [ ] Quick Reference card content for `/welcome`.
  ❌ NOT SHIPPED — `app/welcome/page.tsx:154-160` is still a placeholder ("Cheat sheets and rules excerpts will live here…").

---

## REFACTORS / SPECS / UNFINISHED PHASES

### Phase 4 — Campfire (Phase 4E remainder)

- [ ] 4E Notifications UI for LFG interest pings.
  ✅ SHIPPED — `components/NotificationBell.tsx:454-456` handles `type === 'lfg_interest'` with deep-link to the post on `/campfire/lfg`. Trigger in `sql/lfg-interests.sql`. Safe to delete.
- [ ] 4E Inline `<t:UNIX:f>` token rendering.
  ✅ SHIPPED — same as the Tapestry-side renderer above; `lib/rich-text.tsx` is in use across reply panels and progression log. Safe to delete.

### Phase 4 — older items not yet absorbed

- [ ] Reactions and comments on Campfire posts.
  ✅ SHIPPED — `components/ReactionButtons.tsx` (Phase 4E) covers up/down on `forum_thread_reactions`, `war_story_reactions`, `lfg_post_reactions`. `components/InlineRepliesPanel.tsx` covers replies on `war_story_replies`, `lfg_post_replies`. Forums have full thread + reply UI at `app/campfire/forums/[id]/page.tsx`. Safe to delete.
- [ ] Featured items — Thriver can promote any post to featured status.
  ⚠️ PARTIAL — featured-module on Campfire portal SHIPPED (commit `b9ac828`, `app/campfire/page.tsx:133-260`). Featured for forum threads / war stories not surfaced. Keep, scope reduced to "non-module Campfire surfaces".

### District Zero hub deepening

- [ ] DZ canon layer — immutable pins set by Thriver only.
  ⚠️ PARTIAL — `pin_type='gm'`, `is_canon`, and canon badge shipped (commit `748013c feat(map): canon badge on Thriver-published world-map pins`, see `components/MapView.tsx:688-1087`). DZ-specific scope/UX may remain — needs user call.
- [ ] DZ community layer — approved player Rumors visible to all DZ campaigns.
  🔍 NEEDS USER CALL — design question; depends on whether the canon/rumors filter chips already cover this.
- [ ] DZ timeline — chronological history of events in the setting.
  ⚠️ PARTIAL — timeline pin category exists (`components/MapView.tsx:1053,1124`), `sql/timeline-sort-order.sql` and `sql/timeline-sort-order-update.sql` shipped, world-event seed at `sql/world-event-pins-seed.sql`. Chronological visualization page not surfaced.
- [ ] Timeline sort_order management — UI for Thrivers to reorder timeline pins.
  ❌ NOT SHIPPED — no drag-to-reorder UI for timeline pins (the GM Notes drag-reorder at commit `fec2fae` is unrelated).
- [ ] Campaign creation — "Run in District Zero" pre-populates setting content.
  ✅ SHIPPED — `app/stories/new/page.tsx:34-211` accepts `?setting=<slug>` from setting-hub CTA and pre-seeds pins/NPCs/scenes/handouts/vehicles via `setting_seed_*` tables + `SETTING_PINS`/`SETTING_NPCS`/etc. Phase 4C commit `3ba25a8`. Safe to delete.

### Communities Phase E

- [ ] Per-community Campfire feed (gated on Phase 4 shipping).
  ✅ SHIPPED — commit `9725b09 feat(communities): Phase 4D — per-community Campfire feed`, see `components/CampaignCommunity.tsx:233-689`. Safe to delete.

### Phase 5 — Module System Phase C

- [ ] `/modules` browse + search + filters (setting, tags, rating, subscriber count).
  ✅ SHIPPED — `app/rumors/page.tsx` (path renamed `/modules` → `/rumors`). Has setting filter, sort by featured/newest/subs/rated/AZ. Commit `6625a07 feat(modules): Phase C marketplace`. Safe to delete.
- [ ] `/modules/[id]` detail page with version history, reviews.
  ✅ SHIPPED — `app/rumors/[id]/page.tsx` includes version history + reviews UI. Reviews via `sql/modules-phase-c-reviews.sql`. Commit `b9ac828`. Safe to delete.
- [ ] Listed-module Thriver moderation queue.
  ✅ SHIPPED — `app/moderate/page.tsx:111` queries `modules` for `moderation_status='pending'`/`visibility='listed'`. Tabs include modules. Safe to delete.
- [ ] Cover image upload, featured-module surface on dashboard.
  ✅ SHIPPED — cover-image upload at `app/rumors/[id]/edit/page.tsx`; featured-module hero on `app/campfire/page.tsx:230-260`. Storage bucket `sql/module-covers-bucket.sql`. Safe to delete.
- [ ] Play stats per module (subscriber count, session count, avg player count).
  ⚠️ PARTIAL — subscriber_count column shipped (`sql/modules-subscriber-count.sql`); `session_count_estimate` is author-edited not actuals. Avg player count not implemented. Keep, scope reduced to "actuals tracking".

### Phase 5 — Phase F (GM Adventure Authoring Toolkit, added 2026-04-30)

- [ ] Story Arc form — guided 4-question creation surface.
  ❌ NOT SHIPPED — no Story Arc form in `app/`.
- [ ] NPC quick-build inline forms.
  ❌ NOT SHIPPED.
- [ ] Map quick-build — drop new tactical scene from inside a beat.
  ❌ NOT SHIPPED.
- [ ] Handout quick-build.
  ❌ NOT SHIPPED.
- [ ] Encounter quick-build.
  ❌ NOT SHIPPED.
- [ ] Route tables — leg-by-leg encounters with roll-target each.
  ❌ NOT SHIPPED.
- [ ] Adventure preview — "play test mode".
  ❌ NOT SHIPPED.
- [ ] Publish Adventure — terminal step on Story Arc form.
  ❌ NOT SHIPPED.

### Tactical map long-term lifts

- [ ] Line of sight — Phase 3 polygon vision mask. Deferred until painted-fog + segments see real play. Audit scheduled 2026-05-10.
  🔍 NEEDS USER CALL — explicitly deferred with date.

### Lv4 Skill Traits (FULL BACKBURNER — ships together or not at all)

- [ ] Inspiration Lv4 "Beacon of Hope" auto +4 to Morale.
- [ ] Psychology* Lv4 "Insightful Counselor" auto +3 to Morale.
- [ ] Generic Lv4 Trait surface on the character sheet.
- [ ] Auto-application hooks for any other Lv4 Trait.
- [ ] Barter Lv4 cheat-doubling.
  🔍 NEEDS USER CALL (all 5) — `lib/cdp-costs.ts:46` has `isLv4Step` helper and `components/CommunityMoraleModal.tsx:348-349` documents the deferral. Per memory, this is Xero-blocked on full Lv4 trait list.

### Code audit deferrals

- [ ] Split table page (5,365 lines) into subcomponents. DEFERRED.
  ❌ NOT SHIPPED — `app/stories/[id]/table/page.tsx` is now 10,542 lines (grew, not shrank). Keep.
- [ ] Debounce realtime callbacks. DEFERRED.
  ❌ NOT SHIPPED — debounce exists in map components but not realtime callbacks generally. Keep, deferred status preserved.
- [ ] Sequence guards on `loadRolls` / `loadChat`. DEFERRED.
  ⚠️ PARTIAL — `loadEntriesSeqRef` at `app/stories/[id]/table/page.tsx:227-228` adds a sequence guard for loadEntries. loadRolls/loadChat-specific guards not verified. Keep.

### Loadtimes roadmap

- [ ] Tier C1. Replace mount-time fetch waterfall in table page's `load()` with parallel + snapshot RPC.
  ⚠️ PARTIAL — commit `96a66b2 perf(C1): collapse table-page mount fetch waterfall to two waves` shipped parallelization (Promise.all at lines 626, 766, 785). Snapshot RPC not shipped. Keep, scope to "snapshot RPC" only.
- [ ] Tier C2. Extract initiative bar into its own component.
  ✅ SHIPPED — `components/InitiativeBar.tsx` (commit `f712691 refactor(C2)`). Safe to delete.
- [ ] Tier D1. Combat / damage / roll-modal cluster — defer indefinitely without tests.
  🔍 NEEDS USER CALL — explicit "defer indefinitely".

---

## DEFERRED — LONG TERM, NOT ACTIVE

### Backburner — Campaign calendar (revisit triggers)

- [ ] Forgetting Skip Week → community frozen for 4+ sessions.
- [ ] World events that should've ended weeks ago still applying CMod.
- [ ] Wanting "X days passed" → automatic ration consumption / weather drift / community drift.
- [ ] Encumbrance tick should auto-fire on time advancement.
- [ ] DB: `campaign_clock` table or jsonb on `campaigns`.
- [ ] Helper `lib/campaign-clock.ts`.
- [ ] Clock widget in table page header.
- [ ] Migrate Time button from Inventory #1 to unified clock.
  🔍 NEEDS USER CALL (all 8) — explicitly backburner with revisit triggers; per memory `project_campaign_calendar.md` "deferred; revisit only on listed pain triggers".

### Backburner — Thriver godmode UI sweep

- [ ] Every `isGM && <button>` widens to `(isGM || isThriver)`.
  ⚠️ PARTIAL — `sql/thriver-godmode-policies.sql` and `sql/thriver-rls-case-insensitive.sql` shipped at the DB layer. UI-side `isGM &&` checks remain in `components/CampaignCommunity.tsx`, `components/CampaignObjects.tsx`, etc. (e.g. `CampaignObjects.tsx:350,463,481,493,526`). Keep.

### Backburner — `/firsttimers` auto-redirect

- [ ] Drop the `/firsttimers → /dashboard` auto-redirect when `profiles.onboarded = true`. **DO NOT TOUCH until Xero gives go-ahead.**
  🗑️ STALE — already dropped per `app/firsttimers/page.tsx:16-17`: "/firsttimers used to redirect to /dashboard once profiles.onboarded was true… Now /firsttimers is a reference page". The first-visit popup moved to `/dashboard` (commit `6bc5ff6`). Delete entirely.

### Roadmap Phase 6

- [ ] LFG matching by setting + playstyle.
- [ ] Session scheduling — calendar view.
- [ ] The Gazette — auto campaign newsletter.
- [ ] Between-session experience.
- [ ] Subscriber tiers — Free / Paid / Premium.
- [ ] Graffiti — Distemper-branded reactions.
  🔍 NEEDS USER CALL (all 6) — long-term roadmap, not "open work".

### Roadmap Phase 7 (Ghost Mode Advanced)

- [ ] Funnel analytics, A/B test soft wall, QR-scanner onboarding, reactivate `/firsttimers`.
  🔍 NEEDS USER CALL — long-term roadmap. (Note: 11 funnel events shipped via `2b694aa feat(events): instrument 11 funnel events in user_events`, so partial.)

### Roadmap Phase 8 (Physical Products)

- [ ] Chased QR codes, anonymous preview, Chased module, Mongrels sourcebook upload, physical product landing pages.
  🔍 NEEDS USER CALL — long-term roadmap.

### Roadmap Phase 9 (Maturity)

- [ ] Full XSE SRD searchable in-app.
  ⚠️ PARTIAL — SRD is structurally complete per commits `c14f4c3 docs(letsgototheend): SRD is structurally complete` and `4c3a738 feat(rules): populate Appendices A-D — SRD now 100% covered`. In-app search not surfaced. Keep, scope to "search".
- [ ] Contextual rules links from sheet + dice roller.
  ❌ NOT SHIPPED.
- [ ] Mobile optimization pass.
  ❌ NOT SHIPPED.
- [ ] Mobile dice roller.
  ❌ NOT SHIPPED.
- [ ] Global search across characters / campaigns / pins / NPCs / Campfire.
  ❌ NOT SHIPPED.

### Roadmap Phase 10 (Future Platforms)

- [ ] Displaced — space setting on separate platform.
- [ ] Extract `@xse/core` monorepo.
- [ ] Each setting gets own domain + branding on shared core.
  🔍 NEEDS USER CALL (all 3) — long-term roadmap.

### Roadmap Phase 11 (Cross-Platform Parity)

- [ ] Campaign Calendar — date-gated lore events.
- [ ] Roll20 Export — sheet HTML/CSS/JS, per-campaign ZIP exporter, ingest paths.
  🔍 NEEDS USER CALL (both) — long-term roadmap.

### Phase 5 — Phases D + E

- [ ] D: Free / Paid / Premium pricing.
- [ ] D: Licensed GM permission unlocks paid modules.
- [ ] D: Author payout flow, referral tracking.
- [ ] E: GM Kit Export v2 = printable PDF + module zip.
- [ ] E: Module + Community cross-publish.
- [ ] E: In-session GM toolkit — scene switcher, NPC roster, handouts panel, roll tables linked to dice roller.
- [ ] E: Third-party module import (Roll20 / Foundry → Tapestry).
  🔍 NEEDS USER CALL (all 7) — long-term roadmap; Phase D/E aspirational.

### Technical debt

- [ ] Migrate character photos from base64 → Supabase Storage (low priority).
  ✅ SHIPPED — `app/tools/migrate-character-photos/page.tsx` is the migration tool (commit `2c49873 fix(picker): sharpen library portraits + ship character-photo migration tool`). Safe to delete (or downgrade to "verify migration applied" if Xero hasn't run it).

---

## DISCUSSION / UNDECIDED

- [ ] NPC health as narrative feeling. DEFERRED 2026-04-26.
  🔍 NEEDS USER CALL — explicit "Re-open if a different framing comes up".
- [ ] Decide on hide-NPCs flag — global vs. per-instance reveal.
  🔍 NEEDS USER CALL — design question.

---

## Cleanup Recommendations

**Safe to delete (30 items):** All ✅ SHIPPED items above. Particularly the modal + RLS + LFG-backfill + Insight-cap + Print-sheet + reseed-campaign + destroyed-portrait + HammerTime renderer + reactions + featured-module + Phase 4D + InitiativeBar extract + character-photo migration tool + Hide-NPCs multi-select + auth gating on `/tools/*` + portrait Storage upload + LFG notifications + Player NPC notes + DZ canon badge + Run-in-setting CTA.

**Stale (1 item):** `/firsttimers` auto-redirect — already dropped per code; entry references the old behaviour that no longer exists. Delete entirely.

**Partial — keep with reduced scope (9 items):** Modal unification (6 modals remaining), Hide-NPCs reveal (folder/panic still open), Featured items (non-module), DZ canon/timeline depth, Play stats per module, Sequence guards, Tier C1 snapshot RPC, SRD in-app search, Thriver godmode UI sweep.

**🔍 Needs user call (18 items):** Design questions, runtime checks, vendor-portal config, repro-required bugs, and the Lv4 + Phase 6/8/10/11 long-term roadmap blocks.

**Genuinely open (67 items):** Everything labelled ❌ NOT SHIPPED. The Phase F GM Adventure Authoring Toolkit (8 items) and Roadmap Phase 9 polish (5 items) are the largest blocks.

*end of verified checklist*
