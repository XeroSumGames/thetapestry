# Next Playtest Sprint (2026-05-18 → 2026-05-25)

One week to next playtest. Goal: maximum completed surface, locked
build by Saturday, smoke-tested by Sunday.

---

## Day 1-2 (Mon-Tue): Modal Unification + Feed Polish batch

### Shipped (Sunday warmup)
- [x] **Coordinated Effort summary banner** (`137be68` + `9a3eb94`) — N participant chain rows fold into single Tier A banner with new Xero-locked narrative; individual rolls in expanded ▸ view. 6 unit tests + RollEntry type extended with coord_chain_id.
- [x] **Em-dash sweep, batch 1** (`87f0e46`) — 10 hits across 7 files (NpcCard attack label, CommunityMoraleModal weekly checks, ApprenticeCreationWizard tooltip, CharacterCard subtitle, MapView marker, PlayerNpcCard tooltip). Parser-affecting + display-only. 188 tests still passing.
- [x] **Confidence Ledger drain** (`328035e`) — test count 160 → 174 (now 188 after collapse + drift catch-up).

### Open
- [ ] **Stress Check narrative rewrite** — proposed `STRESS CHECK <name>` prefix pattern, *AWAITING Q5 ANSWER from Xero*.
- [ ] **Distract migration** — *attempting Sunday night as pattern test.* Pull out of `pendingRoll` into dedicated `<RollModal>`. If clean in <3h, Stabilize + First Impression follow same pattern.
- [ ] **Stabilize migration** — gated on Distract result. Multi-day if Distract spirals.
- [ ] **First Impression migration** — gated on Distract result. Likely smallest.
- [ ] **Group Check** — *BLOCKED on design call (Q3 below)*
- [ ] **Gut Instinct** — *BLOCKED on design call (Q4 below)*

### Findings to surface
- The original "modal unification" todo conflated label-dispatched paths through `pendingRoll` with bespoke modals. Stabilize/Distract/First Impression aren't bespoke - they reuse pendingRoll but route distinct post-roll logic on label substring. "Migration" here means pulling each out of pendingRoll into its own `<RollModal>` instance, which means duplicating pieces of pendingRoll's plumbing (action consumption gates, RLS write echoes, broadcast firing). Distract attempt will tell us the real cost.

---

## Day 3-4 (Wed-Thu): Skill + Combat end-to-end audit

Walk every check / action / weapon path through the live app vs
[tasks/roll-feed-log-preview.html](roll-feed-log-preview.html).
Log drift, fix small bugs inline, queue big ones.

- [ ] PHY/DEX/RSN/INF/ACU manual attribute checks (verify new ATTRIBUTE CHECK narrative)
- [ ] Stress Check mid-play + at-max cascade (verify the ddf51e9 fix)
- [ ] Skill rolls — every skill tier (1-3), specialized vs not
- [ ] Weapon attacks — ranged / melee / unarmed / stun (Taser, Cattle Prod)
- [ ] Initiative + turn-stuck regression check
- [ ] Healing — LI cascade, kit consumption gap noted
- [ ] Coord Effort full chain (lead + participants + Withdraw retcon)
- [ ] Vehicle attacks (mounted weapons)
- [ ] Brew / Driving / Navigate checks
- [ ] Recruitment / Negotiations / Apprentice
- [ ] Group Check (basic, pre-redesign)
- [ ] Fed / Clothed / Morale / Retention community checks
- [ ] Loot / Barter / CDP / Encumbrance feed rendering
- [ ] Lasting Wound application + chip render
- [ ] Wound Infection check + Sickness propagation

---

## Day 5 (Fri): GM Force-Push View to Players (#10)

Add `view_changed` broadcast event so GM moving the camera /
switching scenes pushes the same view to all player clients.
Concrete missing piece, well-trodden Supabase broadcast pattern.

- [ ] Spec the payload (scene_id? camera xy + zoom? both?)
- [ ] Broadcast on GM scene switch + (optional) pan/zoom
- [ ] Player listener applies the view
- [ ] Opt-out per client (don't trap players if they're navigating)
- [ ] Test 2-client: GM moves, player follows; player can break-follow

---

## Day 6 (Sat): Pre-playtest smoke + new session-prep doc

Mirror what we did for 2026-05-18.

- [ ] Run all gates + tests + typecheck
- [ ] Write `tasks/preplay-testsmoke-2026-05-25.md` covering everything shipped this sprint
- [ ] Write `tasks/session-prep-2026-05-25.md` (what's new + things you should NOT see)
- [ ] Lock the build (no further ships)

---

## Day 7 (Sun): Buffer

Slippage absorption. If nothing slipped: post-playtest polish
candidates (Stress Check narrative rewrite, etc.).

---

## Design Calls (Xero answers, one at a time)

1. ~~**Coordinated Effort summary banner**~~ — ANSWERED + SHIPPED 2026-05-18 (`137be68`). Format: "<lead> {success-adverb} uses <skill> to coordinate an effort with <participants>". Per-participant rolls hidden in default feed, visible in expanded ▸ view.
2. **Recruitment / Inspiration / Apprentice Tier-2 semantics** (#21) — 3 items
3. ~~**Group Check redesign**~~ — RESOLVED. The "individual-rolls-feed-leader" redesign was killed 2026-05-13 per [tasks/spec-group-check.md](spec-group-check.md). Current Group Check (leader rolls with summed AMods + SMods from helpers) is locked canon. Today's polish (present-tense banner, `cd5e030`) is the only change.
4. **Gut Instinct results presentation** (#8) — what does the result card look like?

---

## Explicitly NOT in this sprint

- Lv4 Skill Traits (blocked on full 22-trait list from Xero)
- Intimidation skill removal (4 canon design Qs unanswered)
- Healing kit charges (needs schema decision)
- CRB rewrite tier items
- VehicleSheet refactor (deferred from day 5 pick)
- Character Evolution / CDP Calculator (deferred from day 5 pick)
- Tactical map pan-via-drag fix (deferred from day 5 pick)
