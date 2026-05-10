# The Tapestry — Open Work Checklist

**Generated 2026-05-06** after the marathon-session prune.
Cross items off as you finish them. Each line is one bug / issue /
enhancement with a one-line description.

This supersedes `tasks/open-work-2026-05-05-printable.md`.

---

## TOP PRIORITY — Playtest carry-over

- [ ] **Random character — Medic produces no First Aid skill.**
      *Likely a wording mix-up — XSE has no "First Aid" skill;
      Medic seeds Medicine\*. Confirm with player before chasing.*

- [ ] **Vehicle passenger sync — terrain rejection.** Passenger
      auto-move (`7f71bce`) follows the vehicle without checking
      whether the destination cell is walkable for a passenger
      (e.g. wall, water, off-road). Currently passengers track even
      onto invalid cells. Open: should the vehicle drag also reject
      the move, or do passengers leave the seat and stay behind?

---

## BUGS — Need repro / decision before code

- [ ] **Initiative lag.** Perceived delay between End-Turn and the
      next combatant going active. Needs solo repro on your machine.

- [ ] **Damage calc spot-check.** Reported `2+2d6 (6) = 8 raw → should
      be 7/7`. Need screenshot of the actual log row before chasing.

- [ ] **Failed skill checks still leave 2 actions.** Code traces
      clean; `consumeAction` should fire on every roll-completion
      path. Need char + skill + `[consumeAction]` console log.

- [ ] **Tactical map mouse-pan via drag — broken.** WASD works;
      click-drag on empty cell doesn't scroll. Multiple ship+revert
      attempts; deferred 2026-04-27 as "no fix path identified."

- [ ] **HP render lag** — previous-session follow-up.
      Possibly already fixed by the optimistic-local-patch sweep
      (Restore-to-Full-Health 2026-05-05, damage paths). Needs
      runtime re-verification.

---

## PARTIALS — Finish what's started

- [ ] **Modal unification.** Normalize Stabilize, Distract,
      Coordinate, Group Check, Gut Instinct, First Impression to
      `<RollModal>`. (Recruit + Stress/Breaking/Lasting/Wound shipped.)

- [ ] **Hide-NPCs reveal UX.** Folder-level "Reveal all in folder"
      + panic button "reveal entire roster". (Multi-select bar +
      auto-reveal-on-Start-Combat shipped.)

- [ ] **Featured items.** Thriver promote-to-featured for forum
      threads + war stories. (Module featured shipped.)

- [ ] **DZ canon layer.** District Zero–specific canon scope/UX.
      (Generic `is_canon` badge shipped.)

- [ ] **DZ timeline visualization.** Chronological page surfacing
      world-event timeline pins. (Timeline category + sort_order
      shipped.)

- [ ] **Play stats per module.** Track session count + avg player
      count. (Subscriber count shipped.)

- [ ] **Tier C1.** Single snapshot RPC for table-page mount.
      (Parallelization shipped via `96a66b2`; one round-trip remains.)

- [ ] **In-app SRD search.** SRD content is structurally complete;
      `/rules/*` just needs a search UI on top of it.

- [x] **Thriver godmode UI sweep — surface 5 of 5.** Character-sheet
      edit affordance for non-owned PCs. Shipped `ae0933a` 2026-05-08:
      character-sheet canEdit, /characters/[id]/edit ownership bypass,
      table-page CharacterSheet canEdit widened to gmLike.

---

## CANON PROMOTIONS — Quickstart v1.0.03 audit (queued)

Tracked from the Distemper Quickstart v1.0.03 audit. Canon > SRD >
Quickstart, so these are platform schema changes (`lib/xse-schema.ts`
+ `app/rules/*`), not edits to the Quickstart document.

### Ready to ship (no blockers)

- [x] **Stabilise duration FIX.** SHIPPED 2026-05-08D — rules page
      copy in `app/rules/combat/incapacitation/page.tsx:71` updated
      from `16 − PHY AMod` to `1d6 − PHY AMod`. The engine was
      already correct (`app/stories/[id]/table/page.tsx:5076`).

- [x] **Add "Dice Check" combat action (18th entry).** SHIPPED
      2026-05-08D — inserted alphabetically between Defend and
      Distract in `app/rules/combat/combat-rounds/page.tsx`.

- [x] **Subsistence Damage** — SHIPPED 2026-05-08D — Starvation &
      Dehydration sub-section in `app/rules/combat/damage/page.tsx`
      renamed to **Subsistence Damage** (anchor `subsistence`); copy
      now Day 1 free / Day 2+ 1 WP + 1 RP per day; RP=0 → Incapacitated,
      WP=0 → Mortally Wounded; recovery 1 WP + 1 RP / day. GM card
      Env. Damage prompt + alert text in `components/CharacterCard.tsx`
      bumped to deduct WP+RP (was RP-only).

- [x] **Rations promote** — PARTIAL SHIPPED 2026-05-08D — new
      `/rules/equipment/rations` page (Standard / Luxury / Military
      Grade with corrected rarities + ENC); equipment sub-nav anchor
      added. Wizard StepEight rarity fix: Luxury Uncommon → Common.
      **Still open:** `2 starting Rations` data-model change — current
      `XSECharacter.rations` is a single string; promoting to
      `{ type, count }` requires wizard + persistence + edit-page +
      DB migration on existing characters. Tracked separately below.

### Needs design call from Xero (parked)

- [x] **Special / Explosive Weapons** — SHIPPED 2026-05-09. Tranq
      Gun added to RANGED with Xero override stats (1d3 base × 400%
      RP via Stun-aware path). Molotov rebalanced to QS Table 19
      canon (1+1d3 Uncommon 50% RP + Tracking + Burning(1)).
      Flame-Thrower already matched. Other explosives (Grenade /
      Mortar / Shiv-Grenade / Flash-Bang / Rocket Launcher) left
      unchanged — flagged for follow-up audit when a QS table for
      those entries is available.

- [x] **Armor system** — SHIPPED 2026-05-09 (Phase 1). 8 entries
      in `lib/xse-schema.ts:ARMOR` per QS Table 7 + Xero overrides
      (Chainmail → Improvised; Riot Shield knocked DM 2 → DM 1 +
      reactive_melee_only). Inventory-driven via `worn?: boolean`
      flag. `lib/damage.ts:calculateDamage` aggregates worn-armor
      DMs into mitigation, filtering reactive pieces by attacker
      category. Wear / Worn toggle UI + DM chip in `InventoryPanel`.
      Rules page at `/rules/equipment/armor`. Canon spec:
      `tasks/rules-extract-armor-explosives.md`. **Phase 2 deferred:**
      armor `condition` tracking (Pristine→Broken), manual Upkeep
      button per worn armor, and auto-Upkeep on Moment of Low
      Insight in combat.

### Verify first (may already exist — investigation only)

- [x] **Lasting Wounds Table 12.** VERIFIED 2026-05-08D — fully
      shipped. Data lives at `lib/xse-schema.ts:572` (LASTING_WOUNDS,
      11 rolls 2-12) and is rendered on
      `/rules/combat/incapacitation` under §06.

- [x] **Item Condition Table 10.** VERIFIED 2026-05-08D — fully
      shipped. Data: `lib/xse-schema.ts:13` (5-state union) +
      `lib/weapons.ts:24` (CMod table). Rules pages:
      `/rules/equipment/item-condition` (5-state CMod table) and
      `/rules/equipment/upkeep` (Upkeep Check transitions table —
      success stay, failure drop, Wild Success / High Insight up to
      Used, Dire Failure / Low Insight → Broken). Upkeep button
      already on `CharacterCard.tsx:751`.

### Carry-over from Rations promote

- [ ] **Rations: 2-starting + structured count.** Promote
      `XSECharacter.rations` from `string` to `{ type: string; count:
      number }`. Wizard, edit page, character display, print sheet,
      random character flow, and DB migration for existing rows. Once
      structured, the GM Env-Damage Subsistence option could decrement
      `count` instead of just deducting WP/RP. Design call needed for
      whether the wizard hands out 2 of one type or lets the player
      mix-and-match.

---

## RULES COVERAGE — Verify / Build

- [x] **Infection rules coverage audit.** SHIPPED 2026-05-09 —
      CRB v0.9.2 p.114-115 extracted to `tasks/rules-extract-infection.md`,
      design decisions locked, rules page live at
      `/rules/combat/infection`, schema applied via
      `sql/infection-2026-05-09.sql`, GM "Infection" button +
      Treat Infection dropdown wired. Canon pinned in
      `memory/project_infection_canon.md`. **-2 CMod on physical
      checks while sick** wired in `executeRoll` 2026-05-10 — the
      sick CMod note lands in the roll-feed traitNotes
      (`🤒 Sick (...) — -2 CMod on physical check.`) so the
      player sees the deduction every time it fires.

- [ ] **Armor system.** Build armor into the platform - likely affects
      the character sheet (armor slots / worn items), damage calculation
      (damage reduction), and inventory. Needs rules-extract from SRD
      before building. Flagged 2026-05-08.

- [ ] **Subsistence Damage + Rations (SRD §06 / audit item A.10).**
      SRD: 1 RP/day after the first day without food. Quickstart tracks
      Rations as a character sheet item (2 starting). Neither is in the
      platform. Decision needed first - if canon, build as: Rations =
      inventory item type, daily Subsistence Damage tick in GM Tools
      Time (alongside the existing encumbrance tick). Flagged 2026-05-08.

- [ ] **Recruitment / Inspiration / Apprentice — disambiguate the four
      mechanics in-game.** Flagged 2026-05-09. Current platform conflates
      or under-models the distinctions; needs separate in-game treatment
      so the player can tell which lever is being pulled:
      - **Recruitment**: outcome tiers — **Cohort** vs. **Conscript** vs.
        **Convert** (different commitment levels / community impact).
        Verify whether the existing Recruit modal surfaces these.
      - **First Impression**: applies as a **CMod** (one-shot social
        modifier on subsequent rolls against the same NPC), not a flat
        stat change. Verify the modifier propagates correctly.
      - **Inspiration**: each skill level grants **+1 SMod / level** to
        the target on whatever they're rolling, not a CMod. Verify the
        SMod handoff path.
      - **Apprentice**: the picker / unlock surface fires **only on a
        Moment of High Insight (6+6)** during a Recruit roll — not on
        Wild Success or any other outcome. Verify the gate is wired
        correctly; spec out the rules-page entry if it's missing.
      Likely needs a `tasks/rules-extract-recruitment-inspiration.md`
      first (matching the Infection extract pattern), then targeted UI
      / roll-flow changes.

---

## SECURITY HARDENING — Linter follow-ups

Tier 1+2 cleared 2026-05-08C via `sql/security-hardening-2026-05-08.sql`
(~120 of ~130 linter warnings closed). Tier 3 remaining:

- [x] **HaveIBeenPwned password-leak protection.** DONE 2026-05-08D —
      flipped ON in Supabase dashboard (Authentication → Sign In /
      Providers → Email → "Prevent use of leaked passwords"). Closes
      the `auth_leaked_password_protection` linter row.

- [ ] **Public-bucket SELECT policy tightening.** 9 storage buckets
      (account-avatars, campaign-npcs, character-portraits,
      module-covers, object-tokens, portrait-bank, session-attachments,
      tactical-maps, war-stories) allow listing all files. URL access
      still works without listing — listing exposes file inventory.
      Per-bucket UX decision: do you need authors to see all their
      published assets? If yes, scope to author. If no, drop SELECT
      policy. Each bucket needs its own call.

---

## OLDER BUGS — Genuinely open

- [ ] **Gut Instinct results presentation needs rework.**
      *Design discussion: narrative card vs. sheet overlay vs. GM DM.*

- [ ] **Inventory migration.** Auto-convert old string equipment to
      structured items on load.

- [ ] **Allow characters in multiple campaigns.**

- [ ] **Transfer GM role.** Move ownership of a campaign without
      starting over.

- [ ] **Player-facing NPC card on Show All click.** Currently opens
      GM-editable view; players should get read-only.

---

## UX / POLISH

- [ ] **Streamline `/login → /table`.** Live-Now banner shipped
      (`66f75e5`); deep-link / "Resume last session" tile still
      open as alternatives.

- [ ] **King's Crossing Mall — tactical scenes** (mall complex maps).

- [ ] **King's Crossing Mall — handouts** (broadcasts, journals,
      ham-radio transcripts).

- [ ] **CMod Stack reusable component.** Extract from Recruit modal;
      reuse in Grapple, First Impression, main Attack.

- [ ] **GM force-push view to players.** Switching campaign ↔
      tactical or scene A ↔ B should propagate to all viewers.
      (Partial: tonight's `0673699` adds `scene_activated` broadcast.)

- [ ] **Multi-round haggling.** Barter currently single-roll.

- [ ] **Character Evolution / CDP Calculator.** Post-creation growth
      tool; spend earned CDP on attribute / skill / trait raises.

---

## PRE-TESTER POLISH

- [ ] **Cost-containment alarm.** Supabase 75% quota + Vercel
      bandwidth alert. ~30 min vendor-portal config.

- [ ] **Demo / sample campaign** for first-time GMs. ~2–3 hours.

- [x] ~~Domain verification spot-check on Resend.~~ **DONE 2026-05-08C** —
      domain verified, MX/SPF/DKIM all green via Cloudflare DNS.

- [x] ~~Wire Resend as Supabase Auth SMTP provider.~~ **DONE 2026-05-08C** —
      Cloudflare DNS migration replaced Wix; Resend domain verified;
      Supabase Custom SMTP configured (smtp.resend.com:465, sender
      `noreply@distemperverse.com`). Email-confirmation gate is now
      live and delivering.

- [ ] **End-to-end smoke pass** — signup → /firsttimers → /welcome
      → /characters/new → /map → first whisper.

- [ ] **Quick Reference card on /welcome.** Placeholder needs CDP /
      WP-RP / Stress / Inspiration cheat sheet + SRD/CRB links.

---

## PIN / MAP

- [ ] **Pin-image migration** from base64 → Supabase Storage.
      (Character-photo migration tool exists; pin equivalent doesn't.)

- [ ] **Timeline sort_order management UI.** Drag-to-reorder for
      Thrivers; currently hardcoded via SQL.

---

## TOOLS

- [ ] **Manual crop control** — drag-to-select instead of auto
      center-crop.

- [ ] **More tools** — handout generator, token template maker,
      roll table randomizer.

---

## PHASE 4 (Campfire) — Tail

- [ ] **Full-text search** across Forums / War Stories / LFG.

- [ ] **Reactions on War Stories + LFG.**

- [ ] **Comment threading on War Stories + LFG** (Forums has it;
      others flat).

- [ ] **Formal `campaign_invitations` accept/reject flow.**

- [ ] **LFG filters by setting + schedule.**

- [ ] **DZ community layer** — approved player Rumors visible to
      all DZ campaigns.

---

## PHASE 5 — MODULE SYSTEM (Phases D / E / F)

### Phase D — Monetization

- [ ] **Free / Paid / Premium pricing.**
- [ ] **Licensed GM permission unlocks paid modules.**
- [ ] **Author payout flow, referral tracking.**

### Phase E — Extras

- [ ] **GM Kit Export v2** — printable PDF + module zip.
- [ ] **Module + Community cross-publish.**
- [ ] **In-session GM toolkit** — scene switcher, roster, handouts
      panel, roll tables linked to dice roller.
- [ ] **Third-party module import** (Roll20 / Foundry → Tapestry).

### Phase F — GM Adventure Authoring Toolkit

- [ ] **Story Arc form** — guided 4-question creation surface.
- [ ] **NPC quick-build** inline forms.
- [ ] **Map quick-build** — drop new tactical scene from inside a beat.
- [ ] **Handout quick-build.**
- [ ] **Encounter quick-build.**
- [ ] **Route tables** — leg-by-leg encounters with roll-target each.
- [ ] **Adventure preview** — "play test mode."
- [ ] **Publish Adventure** — terminal step on Story Arc form.

---

## TACTICAL MAP — Long-term

- [ ] **Line of sight Phase 3** (polygon vision mask). Audit
      scheduled 2026-05-10.

- [x] **FOG wall/door/window drawing — SHIFT to snap.** SHIPPED
      2026-05-09. `getSegmentEndpoint` at
      `components/TacticalMap.tsx:507` honors `e.shiftKey` —
      free-form by default, SHIFT rounds the endpoint to the
      nearest grid intersection. Both click commits and hover
      preview flow through the same function so the modifier
      works end-to-end. Walls, doors, and windows behave the
      same. Doors + windows still post-snap to nearest wall on
      top of any grid snap. (Original assumption that drawing was
      grid-only by default was wrong — code was already free-form;
      this just adds the missing snap-to-grid path.)

- [ ] **Token / character spawn returns to top-left now that the
      FOG bar is mobile.** Flagged 2026-05-09. Spawn was already
      at `grid_x: 1, grid_y: 1` per
      `components/TacticalMap.tsx:3707`, but the previous fixed-
      position FOG bar was visually hiding the spawn area, so new
      tokens were essentially invisible until dragged. With the
      FOG bar now movable, top-left is freed up and the existing
      spawn coordinates should work as designed. Verify on the
      next playtest that newly-added PCs / NPCs / objects appear
      at (1,1) and aren't covered by any other UI overlay.
      Likely no code change — investigation + visual confirmation.
      If something else moved the spawn point, restore to (1,1)
      per the locked memory entry.

### Lv4 Skill Traits — Xero-blocked, ships together

- [ ] **Inspiration Lv4 "Beacon of Hope"** — auto +4 to Morale.
- [ ] **Psychology\* Lv4 "Insightful Counselor"** — auto +3 to Morale.
- [ ] **Generic Lv4 Trait surface** on the character sheet.
- [ ] **Auto-application hooks** for any other Lv4 Trait.
- [ ] **Barter Lv4 cheat-doubling.**

---

## CODE HEALTH

- [ ] **Split table page into subcomponents.** Currently 10,542
      lines (was 5,365 when first deferred — it grew, didn't shrink).
      High risk; needs a clean day.

- [ ] **Debounce realtime callbacks.** Optimization-only.

---

## DISCUSSION / UNDECIDED

- [ ] **NPC health as narrative feeling.** Deferred 2026-04-26;
      re-open if a different framing comes up.

- [ ] **Decide on hide-NPCs flag.** Global "reveal to players"
      boolean vs. per-instance reveal events.

---

## TOP-LEVEL `/todo.md` (mostly stale)

- [ ] **VERIFY + APPLY** `sql/initiative-order-rls-members-write.sql`
      (Nana attack-doesn't-advance bug).

- [ ] **APPLY** `sql/player-notes-session-tag.sql`.

---

## LONG-TERM ROADMAP (Phases 6–11) — Aspirational

### Phase 6
- [ ] LFG matching by setting + playstyle.
- [ ] Session scheduling — calendar view.
- [ ] The Gazette — auto campaign newsletter.
- [ ] Between-session experience.
- [ ] Subscriber tiers — Free / Paid / Premium.
- [ ] Graffiti — Distemper-branded reactions.

### Phase 7 — Ghost Mode Advanced
- [ ] Ghost-to-Survivor funnel analytics.
- [ ] A/B test soft wall messaging.
- [ ] QR-scanner onboarding flow.
- [ ] Reactivate /firsttimers onboarding page.

### Phase 8 — Physical Products
- [ ] Chased QR codes — fold-out map deep-links.
- [ ] Anonymous preview for QR scanners without accounts.
- [ ] Chased module — pre-populated with Delaware content.
- [ ] Mongrels sourcebook upload, seed pins/NPCs.
- [ ] Physical product landing pages.

### Phase 9 — Maturity
- [ ] Contextual rules links from sheet + dice roller.
- [ ] Mobile optimization pass.
- [ ] Mobile dice roller.
- [ ] Global search across characters / campaigns / pins / NPCs /
      Campfire.

### Phase 10 — Future Platforms
- [ ] Displaced — space setting on separate platform.
- [ ] Extract `@xse/core` monorepo.
- [ ] Each setting gets own domain + branding.

### Phase 11 — Cross-Platform Parity
- [ ] Campaign Calendar — date-gated lore events.
- [ ] Roll20 Export — sheet HTML/CSS/JS, ZIP exporter, ingest.

### Campaign Calendar Backburner — Revisit triggers
- [ ] Skip Week → community frozen 4+ sessions.
- [ ] World events that should've ended still applying CMod.
- [ ] "X days passed" → automatic ration / weather / community drift.
- [ ] Encumbrance tick auto-fire on time advancement.
- [ ] DB: `campaign_clock` table or jsonb on campaigns.
- [ ] Helper `lib/campaign-clock.ts` with `advance(campaignId, hours)`.
- [ ] Clock widget in table page header.
- [ ] Migrate Time button from Inventory #1 to unified clock.

---

## SHIPPED IN THIS SESSION (pruned from above)

- ✅ Perception/Gut Instinct auto-pick active PC during combat (`c8bfd0f`)
- ✅ Perception/Gut: skip picker when only 1 eligible PC (`22fd795`)
- ✅ First Impression auto-fires on NPC pick when PC clear (`7880fdc`)
- ✅ GM Notes popout — read-only (`3de55d8`)
- ✅ GM Notes popout — every field editable (`c4610ad`)
- ✅ GM Notes popout description font bump 14 → 17px (`6200fb2`)
- ✅ Story page button order (`3de55d8`)
- ✅ GM Notes button in /table GM Tools dropdown (`3de55d8`)
- ✅ GM Tools → Restore to Full Health speedup — already done (`Promise.all` + optimistic patches, `2026-05-05`)
- ✅ Sequence guards on `useRollsFeed.refetch` + `useChatPanel.refetch` (`d4a97e1`)
- ✅ Thriver godmode UI sweep, 4 of 5 surfaces (`92f9243`)
- ✅ PCs riding Minnie — passenger auto-move sync on tactical map drag (`7f71bce`, 2026-05-05; remaining: terrain rejection — see Top Priority)
- ✅ Beginners' guide /welcome links — `/welcome/guide` TOC + `/welcome/guide/[chapter]` renderer + 12 chapters (`d4c75b7`, 2026-05-05)

---

## SUMMARY

- **Top priority:** 2 (1 confirm-with-player, 1 design call on terrain rejection)
- **Bugs needing repro:** 5
- **Partials to finish:** 9
- **Older bugs:** 5
- **UX / polish:** 7
- **Pre-tester polish:** 5
- **Pin / map / tools:** 4
- **Phase 4 tail / Module Phases D–F:** 21
- **Tactical map long-term + Lv4 (Xero-blocked):** 6
- **Code health:** 2
- **Discussion:** 2
- **Stale top-level repo:** 2
- **Long-term roadmap (Phases 6–11):** ~25

**Realistic short-term:** ~29 items not blocked on Lv4 / repro / roadmap.
**This-week sprint:** the 5 pre-tester polish + 3-4 partials = 8–9 item sprint.

*end of checklist*
