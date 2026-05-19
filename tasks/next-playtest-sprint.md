# Next Playtest Sprint (2026-05-18 → 2026-05-25)

One week to next playtest. Goal: maximum completed surface, locked
build by Saturday, smoke-tested by Sunday.

---

## Day 1-2 (Mon-Tue): Modal Unification batch

5 bespoke modals migrate to `<RollModal>` shape. Pattern already
proven on Coord Effort, Stress Check, Breaking Point, Lasting Wound.

- [ ] **Stabilize** — `<RollModal>` migration
- [ ] **Distract** — `<RollModal>` migration
- [ ] **First Impression** — verify if PlayerNpcCard path is already unified; finish if not
- [ ] **Group Check** — *BLOCKED on design call (Q3 below)*
- [ ] **Gut Instinct** — *BLOCKED on design call (Q4 below)*

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
3. **Group Check redesign** (#26) — 3 open questions
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
