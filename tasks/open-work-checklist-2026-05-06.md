# The Tapestry — Open Work Checklist

**Generated 2026-05-06** after the marathon-session prune.
Cross items off as you finish them. Each line is one bug / issue /
enhancement with a one-line description.

This supersedes `tasks/open-work-2026-05-05-printable.md`.

---

## TOP PRIORITY — Playtest carry-over

- [ ] **PCs riding Minnie don't move with her.** Passengers in vehicle
      footprint should follow with offset preserved.
      *Design call: stickiness vs. explicit mount/disembark; what
      happens on incompatible terrain.*

- [ ] **Random character — Medic produces no First Aid skill.**
      *Likely a wording mix-up — XSE has no "First Aid" skill;
      Medic seeds Medicine\*. Confirm with player before chasing.*

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

- [ ] **Thriver godmode UI sweep — surface 5 of 5.** Character-sheet
      edit affordance for non-owned PCs. (Surfaces 1–4 shipped
      `92f9243`: NpcRoster, CampaignCommunity, CampaignObjects,
      VehicleCard.)

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

- [ ] **Beginners' guide /welcome links.** `docs/beginners-guide.{txt,
      docx}` drafted on disk; commit + surface chapter links.

- [ ] **Domain verification spot-check on Resend.** FROM swap is in
      code; confirm outbound mail still lands.

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

---

## SUMMARY

- **Top priority:** 2 (1 design call, 1 confirm-with-player)
- **Bugs needing repro:** 5
- **Partials to finish:** 9
- **Older bugs:** 5
- **UX / polish:** 7
- **Pre-tester polish:** 6
- **Pin / map / tools:** 4
- **Phase 4 tail / Module Phases D–F:** 21
- **Tactical map long-term + Lv4 (Xero-blocked):** 6
- **Code health:** 2
- **Discussion:** 2
- **Stale top-level repo:** 2
- **Long-term roadmap (Phases 6–11):** ~25

**Realistic short-term:** ~30 items not blocked on Lv4 / repro / roadmap.
**This-week sprint:** the 6 pre-tester polish + 3-4 partials = 9–10 item sprint.

*end of checklist*
