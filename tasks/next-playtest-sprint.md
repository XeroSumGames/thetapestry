# Next Playtest Sprint (2026-05-18 → 2026-05-25)

**STATUS: SPRINT CLOSED 2026-05-20 (5 days early).** All 7 sprint
days landed by Tuesday. Pre-playtest smoke + session-prep docs
shipped. Build locked. Auditing dust + maintenance work ongoing
until Saturday playtest.

One week to next playtest. Goal: maximum completed surface, locked
build by Saturday, smoke-tested by Sunday.

---

## Day 1-2 (Mon-Tue): Modal Unification + Feed Polish batch

### Shipped (Sunday warmup)
- [x] **Coordinated Effort summary banner** (`137be68` + `9a3eb94`) - N participant chain rows fold into single Tier A banner with new Xero-locked narrative; individual rolls in expanded ▸ view. 6 unit tests + RollEntry type extended with coord_chain_id.
- [x] **Em-dash sweep, batch 1** (`87f0e46`) - 10 hits across 7 files (NpcCard attack label, CommunityMoraleModal weekly checks, ApprenticeCreationWizard tooltip, CharacterCard subtitle, MapView marker, PlayerNpcCard tooltip). Parser-affecting + display-only. 188 tests still passing.
- [x] **Confidence Ledger drain** (`328035e`) - test count 160 → 174 (now 188 after collapse + drift catch-up).

### Open (CLOSED OUT 2026-05-20)
- [x] **Stress Check narrative rewrite** - SHIPPED 2026-05-19 (`dd7a7eb`) per Xero Q5: 12 strings locked across mid-play + at-max modes.
- [x] **Distract migration** - DEFERRED to Phase 2 of [spec-stabilize-migration.md](spec-stabilize-migration.md). Bespoke Distract narrative shipped without migration via per-outcome cinematic at compactRollSummary; full pendingRoll-extraction is Phase 2.
- [x] **Stabilize migration** - DEFERRED to Phase 1 of [spec-stabilize-migration.md](spec-stabilize-migration.md). Bespoke STABILIZE narrative shipped without migration; full pendingRoll-extraction is Phase 1 of the post-playtest sprint.
- [x] **First Impression migration** - SHIPPED 2026-05-19 across FI streamline Phase 1-3 (`f9ca0ab` extract pure helpers, `ae7eafd` single-modal flow, `e1d1da0` Insight Die spend + cutover). Plus bespoke narrative tail polish.
- [x] **Group Check** - RESOLVED as dead redesign per [spec-group-check.md](spec-group-check.md). Current canon locked; present-tense banner polish 2026-05-19 (`cd5e030`).
- [x] **Gut Instinct** - SHIPPED 2026-05-19 (`adb9382`) GM whisper-detail modal per Xero option-a.

### Findings to surface
- The original "modal unification" todo conflated label-dispatched paths through `pendingRoll` with bespoke modals. Stabilize/Distract/First Impression aren't bespoke - they reuse pendingRoll but route distinct post-roll logic on label substring. "Migration" here means pulling each out of pendingRoll into its own `<RollModal>` instance, which means duplicating pieces of pendingRoll's plumbing (action consumption gates, RLS write echoes, broadcast firing). Distract attempt will tell us the real cost.

---

## Day 3-4 (Wed-Thu): Skill + Combat end-to-end audit

**Status: replaced by tester-driven smoke test.** All 14 audit
points moved to [tasks/preplay-testsmoke-2026-05-25.md](preplay-testsmoke-2026-05-25.md)
where Xero runs them against the live deploy. The code-side audit
happened inline during the narrative-polish ships across 2026-05-19;
no drift surfaced that wasn't immediately fixed.

---

## Day 5 (Fri): GM Force-Push View to Players (#10)

- [x] SHIPPED 2026-05-19 (`8f5821e`). Mirrors the existing CampaignMap "👁 Share View" button (added 2026-05-11). One-shot deliberate push, NOT a continuous follow per Xero 2026-05-19 ("not a drag-follow mechanism"). Payload: `{ scrollLeft, scrollTop, zoom, imgScale }`. Player listener smooth-scrolls. Flash green for ~1.5s after click as confirmation. GM-only button placed next to the zoom control top-right of the tactical map.
- [x] Pre-existing complementary syncs kept: `scene_activated` (scene switch), `tactical_zoom` (zoom slider), `tactical_shared` / `tactical_unshared` (pane on/off).
- [ ] **Manual smoke test (Xero):** 2-client (GM + player) on a tactical scene, GM scrolls + zooms + clicks Share View, confirm player's view smooth-scrolls to match.

---

## Day 6 (Sat): Pre-playtest smoke + new session-prep doc

Mirror what we did for 2026-05-18.

- [x] Run all gates + tests + typecheck (388 tests pass, tsc clean, all guardrails silent)
- [x] Write `tasks/preplay-testsmoke-2026-05-25.md` (`4c65601`) - covering everything shipped this sprint
- [x] Write `tasks/session-prep-2026-05-25.md` (`90d5b2a`) - "what's new + things you should NOT see"
- [x] Lock the build (no further load-bearing ships; only docs/maintenance/audit work after 2026-05-19)

---

## Day 7 (Sun): Buffer

Used for: em-dash sweep (`3f8bcd4` + `d610ba8`, 7099 chars across
409 files + new check-em-dashes guardrail), Stabilize migration
spec (`a25fa01`), Confidence Ledger refresh (`2260f21`), todo
cleanup (`004905e`).

---

## Design Calls (Xero answers, one at a time)

1. ~~**Coordinated Effort summary banner**~~ - ANSWERED + SHIPPED 2026-05-18 (`137be68`). Format: "<lead> {success-adverb} uses <skill> to coordinate an effort with <participants>". Per-participant rolls hidden in default feed, visible in expanded ▸ view.
2. ~~**Recruitment / Inspiration / Apprentice Tier-2 semantics** (#21) - 3 items~~ - ANSWERED + SHIPPED 2026-05-19. (1) Inspiration SMod relabel + double-count suppression (`f131736`). (2)(3) Approach-specific semantics across 3 phases: A schema (`6287480`) + B drainer/escape (`1951d77`) + C modal gates (`57cc125`).
3. ~~**Group Check redesign**~~ - RESOLVED. The "individual-rolls-feed-leader" redesign was killed 2026-05-13 per [tasks/spec-group-check.md](spec-group-check.md). Current Group Check (leader rolls with summed AMods + SMods from helpers) is locked canon. Today's polish (present-tense banner, `cd5e030`) is the only change.
4. ~~**Gut Instinct results presentation** (#8)~~ - ANSWERED + SHIPPED 2026-05-19 (`adb9382`) per Xero option-a: standard feed narrative for everyone + GM auto-opening whisper-detail modal that sends a private "Gut Instinct: <text>" message to the rolling player.

---

## Explicitly NOT in this sprint

- Lv4 Skill Traits (blocked on full 22-trait list from Xero)
- Intimidation skill removal (4 canon design Qs unanswered)
- Healing kit charges (needs schema decision)
- CRB rewrite tier items
- VehicleSheet refactor (deferred from day 5 pick)
- Character Evolution / CDP Calculator (deferred from day 5 pick)
- Tactical map pan-via-drag fix (deferred from day 5 pick)
