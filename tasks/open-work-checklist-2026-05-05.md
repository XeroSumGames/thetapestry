# The Tapestry — Open Work Checklist

**As of 2026-05-05** (compiled from `tasks/todo.md`, `PLAYTEST_TODO.md`,
`outstanding-work-2026-05-01.md`, `letsgototheend.md`, `long-term-fixes.md`,
`loadtimes-roadmap.md`, `next-session-prompt.md`, `handoff-*.md`,
`spec-*.md`, and the top-level `todo.md`.)

Items marked **(verify)** appear unchecked in `tasks/todo.md` but newer
audit files claim they've shipped. Confirm before acting.

---

## BUGS — OPEN

### From last night's playtest (2026-05-04)

- [ ] Perception check has a redundant first modal. Goes to a picker
      showing all 4 PCs with PER values; should go straight to the roll
      modal (auto-pick active PC, or fold into one combined modal).
- [ ] PCs riding Minnie don't move with her. When a vehicle/carrier
      moves, passengers in its footprint should follow with relative
      offset preserved. Needs design call: positional-only stickiness
      vs. explicit mount/disembark; what happens when carrier moves
      onto terrain a PC can't enter.
- [ ] Random character generation — Medic paradigm produces no First
      Aid skill. Either `/characters/random` doesn't honor paradigm-
      skill seeding, or Medic's entry in `lib/xse-schema.ts` PARADIGMS
      is missing First Aid.
- [ ] Mounted-weapon attacks don't consume an action. Tonight's damage
      fix landed, but the action-consume gap is separate. **HIGH
      PRIORITY** — unlimited free attacks per turn for any vehicle
      gunner is a balance break.

### From 2026-05-01

- [ ] Tighten RLS on campaign-tagged threads + War Stories.
      `campaign_id` is currently a tag only; non-members can SELECT
      campaign-tagged rows. `forum_threads` and `war_stories` need RLS
      that filters by membership when `campaign_id` is set.
- [ ] Backfill old LFG freetext settings (Distemper / Homebrew /
      Chased) so they show under their proper setting chip, not just
      "All".

### From 2026-04-29

- [ ] Empty-adventure module clone fails on null pin name in
      `cloneModuleIntoCampaign`. **(verify — possibly shipped)**
- [ ] Gut Instinct results presentation needs rework. Result framing
      doesn't communicate what the player learned. Design discussion:
      narrative card vs. sheet overlay vs. GM-only DM.

### From 2026-04-27 (Mongrels playtest)

- [ ] Initiative lag — needs solo repro. Don't action until Xero
      confirms symptom on his own machine.

### Older / undated

- [ ] Damage calculation spot-check. Reported `2+2d6 (6) = 8 raw →
      should be 7 WP / 7 RP (1 mitigated)`. Confirm formula across all
      weapons.
- [ ] Failed skill checks still have two actions available. Code looks
      right on paper; needs repro from next playtest. Parked.
- [ ] Print sheet missing data — Relationships/CMod, Lasting
      Wounds/Notes, Tracking (Insight/CDP) not populated.
- [ ] Player NPC notes + first impressions. Clicking an NPC name in
      player's Assets NPCs tab should open personal-notes space + show
      First Impression results. Table `player_npc_notes` exists; UI
      hookup pending.
- [ ] Inventory migration — auto-convert old string equipment to
      structured items on load.
- [ ] Allow characters in multiple campaigns.
- [ ] Transfer GM role; Session scheduling.
- [ ] Tactical map mouse-pan via drag — broken. Click-and-drag on
      empty cell doesn't scroll even when canvas overflows. WASD/
      arrows works. Multiple ship+revert attempts; "no fix path
      identified" per `long-term-fixes.md`.

### Top-level repo `todo.md` (last updated 2026-04-11 — verify each)

- [ ] VERIFY + APPLY `sql/initiative-order-rls-members-write.sql` —
      Nana took 2 attacks but initiative didn't advance.
- [ ] APPLY `sql/player-notes-session-tag.sql` — `session_number`
      column + BEFORE INSERT trigger.
- [ ] Remove Insight Dice cap — hardcoded to 9 in CharacterCard
      (`max={9}`) and executeRoll (`Math.min(..., 9)`).
- [ ] HP render lag — previous-session follow-up (commit `b4d4671`).

---

## UX & POLISH — OPEN

### Modal unification (2026-04-29 lock-in)

- [ ] Modal unification continues. Pass 1+2 shipped (Stress / Breaking
      / Lasting / Recruit). Still to normalize against the Attack Roll
      gold-standard shape: Stabilize, Distract, Coordinate, Group
      Check, Gut Instinct, First Impression.

### From 2026-04-27 (Mongrels playtest)

- [ ] Hide-NPCs reveal UX needs streamlining. Three reveal paths
      today; "ambush of 5 NPCs" is N+ clicks. Ideas: folder-level
      "Reveal all in this folder", multi-select bar, auto-reveal in
      Start Combat picker, panic-button "reveal entire roster".
      Discuss workflow first.
- [ ] Streamline logging into missions. `/login → /stories → click
      campaign → Join Session → /table` is too many steps. Possible:
      deep-link to active session, auto-redirect from `/stories/[id]`
      to `/table` when GM has session active, "Resume last session"
      tile on `/stories`.

### Next-up post-combat sprint (some may be shipped — verify)

- [ ] Insight Die spend — track on roll_log. 3d6 rolls where
      d2+d3 ≤ 6 (~17%) still escape detection. **(verify)**
- [ ] King's Crossing Mall — tactical scenes. Author battle maps for
      mall complex (motel courtyard, Costco interior, gas station,
      Belvedere's etc.) and wire into `SETTING_SCENES`.
- [ ] King's Crossing Mall — handouts. Port broadcasts, journal pages,
      ham-radio transcripts into `SETTING_HANDOUTS`.
- [ ] Re-seed an existing campaign with a setting's content. Build
      `/tools/reseed-campaign?id=…` with name-collision skipping.
- [ ] Destroyed-object portrait swap. Optional `destroyed_portrait_url`
      on object tokens. **(verify)**
- [ ] CMod Stack reusable component. Extract from Recruit modal,
      reuse in Grapple, First Impression, main Attack modal.
- [ ] GM force-push view to players. When GM switches campaign world
      map ↔ tactical, scene A ↔ scene B, push to all connected
      players. **(verify)**
- [ ] Tapestry-side `<t:UNIX:format>` renderer. Replace Discord-style
      tokens with viewer-local `<time>`. Hook into LFG / Forums / War
      Stories / Messages / Notes. **(verify)**

### From 2026-04-30 inventory followups

- [ ] Multi-round haggling (Barter currently single-roll).

### Pre-tester polish (added 2026-05-04)

- [ ] Cost-containment alarm. Supabase project alert at 75% of any
      quota; Vercel bandwidth alarm. ~30 min vendor-portal config.
- [ ] Demo / sample campaign for first-time GMs. "Try the demo
      campaign" button on `/stories/new`. ~2-3 hours.
- [ ] Beginners' guide links from `/welcome`.
      `docs/beginners-guide.txt` is drafted, uncommitted on disk.
      Commit + surface chapter links. ~1-2 hours.
- [ ] Domain verification spot-check on Resend. FROM swap is in code;
      verify outbound mail still lands.
- [ ] End-to-end smoke pass — signup → /firsttimers → /welcome →
      /characters/new save → first /map → first whisper.

### Pin / map

- [ ] Pin-image migration from base64 → Supabase Storage.
- [ ] Hide-NPCs multi-select bar.

### Tools (future)

- [ ] Manual crop control — drag-to-select crop area instead of auto
      center-crop.
- [ ] Upload to Supabase Storage — shared portrait bank across
      campaigns; random assignment during NPC creation.
- [ ] Auth gating on `/tools/*` (currently public).
- [ ] More tools — handout generator, token template maker, roll
      table randomizer.

### Welcome / onboarding

- [ ] Quick Reference card content for `/welcome`. Cheat-sheet: CDP,
      WP/RP, Stress, Inspiration, links into SRD/CRB.

---

## REFACTORS / SPECS / UNFINISHED PHASES

### Phase 4 — Campfire (Phase 4E remainder)

- [ ] 4E Notifications UI for LFG interest pings. Rows exist in
      `lfg_interests`, no read/dismiss view.
- [ ] 4E Inline `<t:UNIX:f>` token rendering (same as Tapestry-side
      renderer above).

### Phase 4 — older items not yet absorbed

- [ ] Reactions and comments on Campfire posts.
- [ ] Featured items — Thriver can promote any post to featured
      status.

### District Zero hub deepening

- [ ] DZ canon layer — immutable pins set by Thriver only.
- [ ] DZ community layer — approved player Rumors visible to all DZ
      campaigns.
- [ ] DZ timeline — chronological history of events in the setting.
- [ ] Timeline sort_order management — UI for Thrivers to reorder
      timeline pins.
- [ ] Campaign creation — "Run in District Zero" pre-populates setting
      content.

### Communities Phase E

- [ ] Per-community Campfire feed (gated on Phase 4 shipping).

### Phase 5 — Module System Phase C

- [ ] `/modules` browse + search + filters (setting, tags, rating,
      subscriber count).
- [ ] `/modules/[id]` detail page with version history, reviews.
- [ ] Listed-module Thriver moderation queue.
- [ ] Cover image upload, featured-module surface on dashboard.
- [ ] Play stats per module (subscriber count, session count, avg
      player count).

### Phase 5 — Phase F (GM Adventure Authoring Toolkit, added 2026-04-30)

- [ ] Story Arc form — guided 4-question creation surface.
- [ ] NPC quick-build inline forms.
- [ ] Map quick-build — drop new tactical scene from inside a beat.
- [ ] Handout quick-build.
- [ ] Encounter quick-build.
- [ ] Route tables — leg-by-leg encounters with roll-target each.
- [ ] Adventure preview — "play test mode" runs GM through arc
      beat-by-beat.
- [ ] Publish Adventure — terminal step on Story Arc form.

### Tactical map long-term lifts

- [ ] Line of sight — Phase 3 polygon vision mask. Deferred until
      painted-fog + segments see real play. Audit scheduled 2026-05-10.

### Lv4 Skill Traits (FULL BACKBURNER — ships together or not at all)

- [ ] Inspiration Lv4 "Beacon of Hope" auto +4 to Morale.
- [ ] Psychology* Lv4 "Insightful Counselor" auto +3 to Morale.
- [ ] Generic Lv4 Trait surface on the character sheet.
- [ ] Auto-application hooks for any other Lv4 Trait that touches
      Morale / Recruitment / Fed / Clothed / combat.
- [ ] Barter Lv4 cheat-doubling.

### Code audit deferrals

- [ ] Split table page (5,365 lines) into subcomponents. DEFERRED,
      high risk before game.
- [ ] Debounce realtime callbacks. DEFERRED, optimization only.
- [ ] Sequence guards on `loadRolls` / `loadChat`. DEFERRED, low
      impact.

### Loadtimes roadmap

- [ ] Tier C1. Replace mount-time fetch waterfall in table page's
      `load()` with parallel + snapshot RPC.
- [ ] Tier C2. Extract initiative bar into its own component.
- [ ] Tier D1. Combat / damage / roll-modal cluster — defer
      indefinitely without tests.

---

## DEFERRED — LONG TERM, NOT ACTIVE

### Backburner — Campaign calendar (revisit triggers)

- [ ] Forgetting Skip Week → community frozen for 4+ sessions.
- [ ] World events that should've ended weeks ago still applying CMod.
- [ ] Wanting "X days passed" → automatic ration consumption /
      weather drift / community drift.
- [ ] Encumbrance tick should auto-fire on time advancement.
- [ ] DB: `campaign_clock` table or jsonb on `campaigns` (start_date
      + ticks_per_day + current_tick).
- [ ] Helper `lib/campaign-clock.ts` with `advance(campaignId, hours)`
      fanning to every time-aware subsystem.
- [ ] Clock widget in table page header.
- [ ] Migrate Time button from Inventory #1 to unified clock.

### Backburner — Thriver godmode UI sweep

- [ ] Every `isGM && <button>` widens to `(isGM || isThriver)` across
      Table page header, NpcRoster, TacticalMap, CampaignCommunity,
      CampaignPins/Objects/VehicleCard, character sheet edits for
      non-owned PCs.

### Backburner — `/firsttimers` auto-redirect

- [ ] Drop the `/firsttimers → /dashboard` auto-redirect when
      `profiles.onboarded = true`. **DO NOT TOUCH until Xero gives
      go-ahead.**

### Roadmap Phase 6

- [ ] LFG matching by setting + playstyle.
- [ ] Session scheduling — calendar view.
- [ ] The Gazette — auto campaign newsletter.
- [ ] Between-session experience.
- [ ] Subscriber tiers — Free / Paid / Premium.
- [ ] Graffiti — Distemper-branded reactions.

### Roadmap Phase 7 (Ghost Mode Advanced)

- [ ] Funnel analytics, A/B test soft wall, QR-scanner onboarding,
      reactivate `/firsttimers`.

### Roadmap Phase 8 (Physical Products)

- [ ] Chased QR codes, anonymous preview, Chased module, Mongrels
      sourcebook upload, physical product landing pages.

### Roadmap Phase 9 (Maturity)

- [ ] Full XSE SRD searchable in-app.
- [ ] Contextual rules links from sheet + dice roller.
- [ ] Mobile optimization pass.
- [ ] Mobile dice roller.
- [ ] Global search across characters / campaigns / pins / NPCs /
      Campfire.

### Roadmap Phase 10 (Future Platforms)

- [ ] Displaced — space setting on separate platform.
- [ ] Extract `@xse/core` monorepo.
- [ ] Each setting gets own domain + branding on shared core.

### Roadmap Phase 11 (Cross-Platform Parity)

- [ ] Campaign Calendar — date-gated lore events. Build for Displaced
      first, backport.
- [ ] Roll20 Export — sheet HTML/CSS/JS, per-campaign ZIP exporter,
      ingest paths.

### Phase 5 — Phases D + E

- [ ] D: Free / Paid / Premium pricing.
- [ ] D: Licensed GM permission unlocks paid modules.
- [ ] D: Author payout flow, referral tracking.
- [ ] E: GM Kit Export v2 = printable PDF + module zip.
- [ ] E: Module + Community cross-publish.
- [ ] E: In-session GM toolkit — scene switcher, NPC roster, handouts
      panel, roll tables linked to dice roller.
- [ ] E: Third-party module import (Roll20 / Foundry → Tapestry).

### Technical debt

- [ ] Migrate character photos from base64 → Supabase Storage (low
      priority — already 256x256 JPEG).

---

## DISCUSSION / UNDECIDED

- [ ] NPC health as narrative feeling. DEFERRED 2026-04-26. Re-open
      if a different framing comes up.
- [ ] Decide on hide-NPCs flag — global "reveal to players" boolean
      on `campaign_npcs` vs. per-instance reveal events.

---

## RECONCILIATION NOTES

A 30-min sweep through `tasks/todo.md` to flip `- [ ]` → `- [x]` on
confirmed-shipped items would substantially clean up the next audit.
The top-level `C:/TheTapestry/todo.md` (last updated 2026-04-11) is
largely superseded — 90%+ of its open items have shipped. Worth
pruning rather than acting line-by-line.

---

*end of checklist*
