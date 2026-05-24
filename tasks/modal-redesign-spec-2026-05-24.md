# Modal Redesign - LOCKED spec (2026-05-24)

**Status:** design LOCKED by Xero 2026-05-24. Visual source of record: [tasks/modal-mockup.html](modal-mockup.html) (v8). This SUPERSEDES [tasks/modal-visual-unification-spec-2026-05-21.md](modal-visual-unification-spec-2026-05-21.md) - the scope grew from "reskin the roll modals" to "almost every modal adopts one shell."

This is mockup-approved DESIGN. Several items below are FUNCTIONAL changes (not just visual) and are flagged - they need a canon walk and/or a quick Xero confirm before building, because they change how a roll behaves, not just how it looks.

---

## The locked shell (the ATTACK shape)

- **Width: 340px default.** Only exceptions: Portrait Bank (420, thumbnail grid), Community Status (480, embeds the full community panel), and the 4 bespoke modals. End Session + Trade were trialled at their old widths and clamped to 340 (Trade's offer/want columns stack vertically at 340).
- **Three-zone fixed length** (every roll/check modal is the same length as Distract):
  1. **TOP (fixed):** colored eyebrow (roll TYPE) -> uppercase title (ACTION/instance) -> optional subtitle (context) -> base-roll line.
  2. **MIDDLE (variable strip, reserves a consistent min-height even when blank):** the per-modal body. Blank for Stabilize/Navigate/Breaking Point/Lasting Wound; damage preview for Attack; a dropdown/warning for Distract/Gut Instinct/Stress; etc. Mock reserves ~70px; tune to Distract's rendered middle height at build time.
  3. **BOTTOM (pinned):** Insight Dice option, then Cancel / Roll buttons.
- **Base-roll line = one row:** `2d6  +AMod  +SMod  ........  CMod[box]`. AMod/SMod green (+) / red (-). The **CMod is a compact inline box** pushed to the right (just wide enough for `-10`); the old full-width "Conditional Modifier" label+input is REMOVED.
- **Drag:** all draggable via the shared grab strip (`lib/use-drag-position.ts`).
- **Contextual backdrop:** map-context = no dim (see-through); sheet-context = dimmed `rgba(0,0,0,0.85)`.
- **Outcome palette:** feed palette (`outcomeColor` from `lib/roll-helpers.ts`) - Success = BLUE. Post-roll: 52px dice tiles (2px border, 28px digits, #242424), 22px outcome banner, green "+1 Insight Die" pill, green reroll buttons.
- **Per-roll accent** colors the eyebrow + the primary Roll button. A roll modal ALWAYS uses its roll accent (it beats any category color).

### Accents (locked)
| Modal | Accent | Backdrop |
|---|---|---|
| Attack | `#c0392b` red | no-dim |
| Stabilize | `#7fc458` green | no-dim |
| Distract | `#4aa3b5` teal | no-dim |
| Gut Instinct | `#5aa0c0` cyan | no-dim |
| Vehicle / Navigate | `#d4883a` rust | no-dim |
| Recruit | `#b07cc6` purple | no-dim |
| Proxy Recruit | `#b07cc6` purple | dim (sheet) |
| First Impression | `#7ab3d4` blue | no-dim |
| Stress Check | `#EF9F27` amber | dim |
| Breaking Point | `#c0392b` red | dim |
| Lasting Wound | `#c0392b` red | dim |

### Non-roll category accents (eyebrow + primary button)
- **GM Tools** `#c9a227` gold; **Community** `#6fae5a` green; **Module** `#9b7cc6` purple; **Player** (Character / Map / Apprentice / Trade) `#7ab3d4` blue. All dimmed (sheet context).

---

## ALWAYS-insight rule (FUNCTIONAL - Xero confirmed)

Every roll/check modal shows the Insight Dice option (No spend / Roll 3d6 / +3 CMod) unless Xero says otherwise. Confirmed to include Stress Check, Breaking Point, Lasting Wound (and they keep post-roll reroll too). **Build note:** these three did not previously offer insight - wiring it means the roll path must actually honor a 3d6 / +3 CMod spend and decrement the die. That is roll-engine work, not chrome.

## Functional changes flagged (confirm canon / Xero before building)
1. **Gut Instinct sub-skill DROPDOWN.** Today it auto-uses best of Psychology/Streetwise/Tactics. The locked design lets the player PICK. That changes the mechanic - walk canon (precedence stack) and confirm before changing the resolution.
2. **Recruit who/approach/skill in the modal.** Today recruiting has a separate pick step then a result modal. Locked design folds Recruit / Approach / Skill dropdowns into the roll modal. Flow change - reconcile with the recruit pick-step path before building.
3. **First Impression** moves from its bespoke 480px modal to the shell with NPC + skill dropdowns. Confirm the skill list + targeting matches the current resolver.
4. **Base-roll line above the pickers** even where the pick changes the mods (Recruit / First Impression) - the displayed AMod must recompute live when the dropdown changes.

---

## Modal inventory (26) - shell vs bespoke

**Roll/check on the shell (12):** Attack, Stabilize, Distract, Gut Instinct, Vehicle/Navigate, Recruit, Proxy Recruit, First Impression, Stress Check, Breaking Point, Lasting Wound (+ the inline ATTACK reference).

**Non-roll on the shell (13):** Restore, Reload, Portrait Bank (420), Paradigm/Profession pickers, Trade, Loot, Community Morale, Community Status (480), Module Publish, Module Review, Award CDP, Advance Time, Populate, Grant Advantage, End Session, QuickAdd, Apprentice Wizard. (Count folds the two pickers + the GM-tools cluster.)

**Bespoke - stay as-is (4):** Welcome, Object Image Cropper, Bug Report, Delete (typed-name) gate.

---

## Implementation phases

Phase A already shipped a FIRST cut of the shared `RollModal` (400px, drag, contextual backdrop, outcomeColor, accent) - the locked design revises it (340px, three-zone, inline CMod, always-insight), so Phase A2 reworks that component rather than starting fresh.

- **A2 - rework `components/RollModal.tsx` to the locked shell.** 400 -> 340; add the three-zone layout (reserved-height middle); move CMod inline onto the base-roll line, remove the full-width block; make the Insight option always render; keep drag/backdrop/accent/outcomeColor. Update the 8 roll callers for the new prop shape. Pure-visual parts first; the per-caller functional additions (skill dropdowns, recruit dropdowns) come after their canon check.
- **A3 - functional caller changes** (gated on the flags above): Gut Instinct skill picker, Recruit dropdowns-in-modal, always-insight wiring on Stress/Breaking Point/Lasting Wound.
- **B - First Impression** onto the shell (NPC + skill dropdowns, blue accent).
- **C - reconcile inline ATTACK** (`page.tsx:7819`) onto the shared hook + 340 + three-zone so ATTACK and the component are pixel-identical.
- **D - collapse inline ATTACK into `RollModal`** (DEFERRED, Xero-gated, post-playtest; load-bearing on combat).
- **E - migrate the 13 non-roll modals** onto the shell with category accents. Large; do per category (GM Tools cluster, Community, Module, Player) as separate commits. Each is its own component, so this is the biggest chunk by file count.

**Gates each phase:** `npx tsc --noEmit`, font/role/em-dash/arch, full test suite. Per-modal idiosyncrasy regression (the modal's own body still works). Visual eyeball on the deploy.

**Rollback:** each phase a discrete commit -> `git revert <sha>`.
