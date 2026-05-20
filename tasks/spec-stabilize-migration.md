# Spec: Stabilize Migration to Dedicated `<RollModal>`

**Status:** Phase 1 SHIPPED 2026-05-20 (Stabilize, commit `2255ced`). Phase 2 SHIPPED 2026-05-20 (Distract). Phase 3 (First Impression) was ALREADY SHIPPED 2026-05-19 via the parallel FI streamline track - this spec was stale on that point. Only Phase 4 (retire legacy executeRoll branches) remains, gated on the 2026-05-25 playtest.
**Owner:** post-playtest sprint for Phase 4 cleanup.
**Estimated effort:** Phase 1+2 took ~4 hours total. Phase 4 deletion is ~15 minutes once playtest greenlights.

---

## The problem

Stabilize is a "core combat recovery" action that today resolves via the
generic `pendingRoll` modal in `app/stories/[id]/table/page.tsx` with
label-substring dispatch in `executeRoll`. Multiple deficiencies:

1. **Label-string dispatch is brittle.** The post-roll handler at
   `app/stories/[id]/table/page.tsx:6128` runs
   `pendingRoll.label.includes('Stabilize ')` to decide whether the
   resolved roll was a Stabilize attempt. Any future label change
   (translation, abbreviation, prefix swap) breaks the dispatch
   silently - failed Stabilize rolls would resolve as generic dice
   with no state cascade.
2. **Action pre-consumption coupling.** Stabilize sets
   `actionPreConsumedRef.current = true` (L4552) before opening
   pendingRoll, then relies on `closeRollModal` to honor that flag.
   The dance is hard to reason about and harder to test.
3. **Inconsistent with the dedicated-modal pattern.** Stress Check,
   Breaking Point, Lasting Wound, Recruit, Stabilize-Infection-Cascade,
   and Coordinated Effort all now ship as dedicated `<RollModal>`
   instances with their own state + post-roll callbacks. Stabilize is
   one of the last holdouts on the old pendingRoll path.
4. **PC vs NPC branches duplicated.** Lines 6132-6146 (PC) and 6147-6163
   (NPC) repeat the same shape with different table writes. A dedicated
   modal could share the logic via a helper.

The downstream pain is real but not blocking - the current path works.
This spec is for the cleanup when there's time.

---

## Why we keep deferring

- **Pre-playtest windows ban load-bearing refactors.** Stabilize fires
  during combat to save a downed PC; if the migration breaks it, players
  die who shouldn't. SRE rule: not inside the playtest window.
- **pendingRoll is bigger than the modal.** Migrating Stabilize means
  duplicating action-consumption gates, RLS write echoes, broadcast
  firing, and the 5ft engagement check. None of those are in
  `<RollModal>` today - they all live inline in pendingRoll.
- **Distract and First Impression share the path.** A Stabilize-only
  migration leaves the same pattern in place for 2 other actions; a
  full migration is closer to a Phase project than a single PR.

---

## Phases

### Phase 1 - Stabilize on its own dedicated `<RollModal>` (3-5 hours)

**Goal:** pull Stabilize out of pendingRoll. Other actions stay on the
old path; this is a single-modal migration.

**Steps:**

1. **New state in `app/stories/[id]/table/page.tsx`:**
   ```ts
   const [stabilizePending, setStabilizePending] = useState<{
     medicEntryId: string
     targetName: string
     targetKind: 'pc' | 'npc'
     amod: number  // medic's RSN AMod
     smod: number  // medic's Medicine* skill level
   } | null>(null)
   const [stabilizeCmod, setStabilizeCmod] = useState<number>(0)
   const [stabilizeResult, setStabilizeResult] = useState<RollResult | null>(null)
   ```

2. **Trigger replacement.** The Stabilize button on
   `components/CharacterCard.tsx:660` currently fires
   `onRoll('Stabilize <name>', amod, smod)`. Add a parallel callback
   prop `onStabilize?: (targetName, targetKind, amod, smod) => void`
   that opens the new modal directly without routing through
   `onRoll`. The table page wires `onStabilize` to
   `setStabilizePending(...)`.

3. **Engagement gate.** The current pendingRoll path gates the roll
   on within-5ft distance. Reproduce in the new modal's preroll
   warning banner + `canRoll` check.

4. **Dedicated `<RollModal>` instance.** Place near the existing
   recruit + stress modals at the bottom of the JSX tree:
   ```tsx
   <RollModal
     open={!!stabilizePending}
     title="Stabilize"
     subtitle={`<medic> stabilizes <target>`}
     rollFormula="2d6 + RSN + Medicine* + CMod"
     amod={stabilizePending?.amod ?? 0}
     smod={stabilizePending?.smod ?? 0}
     cmod={stabilizeCmod}
     setCmod={stabilizeResult ? undefined : setStabilizeCmod}
     onRoll={...}
     result={stabilizeResult}
     onPostRollClose={runStabilizeCascade}
   />
   ```

5. **Extract `runStabilizeCascade` helper.** Pull lines 6132-6163 out
   of `executeRoll` into a pure-ish function that takes
   `(targetName, targetKind, outcome, medicEntryId)` and runs the
   PC/NPC branch. Returns the narrative result string for the
   modal's success banner. Same DB writes, same broadcast pattern.

6. **Action pre-consumption.** The new modal's `onRoll` callback
   awaits `consumeAction(medicEntryId)` BEFORE rolling so the action
   debit can't slip through if the roll modal closes mid-flow.
   Removes the need for `actionPreConsumedRef`.

7. **Multi-target.** Today the table page renders one Stabilize
   button per mortally-wounded combatant within 20ft. Each button
   already passes its target name into the label. New flow: each
   button now passes `(targetName, targetKind)` into `setStabilizePending`.
   Same UX, cleaner data plumbing.

8. **Cleanup at the old path.** Remove the
   `if (pendingRoll.label.includes('Stabilize '))` branch in
   `executeRoll` (L6128). Remove the `actionPreConsumedRef` set
   site for Stabilize. Keep the old branch behind a feature flag
   for one playtest in case something falls through.

9. **Unit tests.** `runStabilizeCascade` is pure-enough to unit-test
   if we accept a mock supabase client. Cover:
   - PC success path (death_countdown → null, incap_rounds set)
   - PC failure path (no state change, narrative only)
   - NPC success path (campaign_npcs update)
   - NPC failure path
   - Stabilize on a target that's NOT mortally wounded (no-op)

10. **Update `tasks/roll-feed-log-preview.html`** Stabilize section
    if any narrative copy changes during the migration (the prefix
    polish was already done 2026-05-19; the migration shouldn't
    touch copy).

**Risks:**
- Engagement gate has historical bugs (5ft check vs 20ft button-render
  range). Don't refactor that surface in this phase.
- `appendProgressionLog` write on PC stabilize (L6143) writes to the
  PATIENT, not the medic. Preserve.
- `actionPreConsumedRef` is shared with Distract/Unjam paths. Don't
  delete the ref entirely - just stop setting it for Stabilize.

---

### Phase 2 - Distract migration (2-3 hours after Phase 1)

Same pattern as Phase 1 applied to Distract. Distract's cascade is
simpler (just `actions_remaining` delta on target via initiative_order
update + broadcast). The target picker is more involved because
Distract targets initiative entries, not arbitrary characters.

Defer to a separate file when starting.

---

### Phase 3 - First Impression migration (ALREADY SHIPPED 2026-05-19)

When this spec was written, FI had a half-migrated path via `PlayerNpcCard` quick-fire. Between then and 2026-05-20, the parallel **FI streamline** track shipped the full migration:

- `<FirstImpressionModal>` component at `app/stories/[id]/table/components/FirstImpressionModal.tsx` owns the pick + roll + result flow end-to-end.
- `resolveFirstImpression()` resolver in `lib/first-impression-resolver.ts` combines roll_log insert + `bump_npc_relationship_cmod` RPC + progression-log append in one call.
- Legacy executeRoll FI branch DELETED (comment at table/page.tsx L6749: "First Impression branch deleted 2026-05-19 (FI streamline Phase 3)").
- 18 unit tests in `tests/lib/first-impression-resolver.test.ts`.
- All 3 entry points (GM Checks menu, per-NPC card quick-fire from PlayerNpcCard, per-NPC card quick-fire from NpcCard) route through the dedicated modal.

Caught while starting Phase 2 (Distract) on 2026-05-20. Lesson captured in tasks/lessons.md: a spec can be stale on its own status when work happens on parallel tracks - always verify the legacy branch still exists before "migrating" it.

---

### Phase 4 - Retire `pendingRoll` for special actions entirely

Once Stabilize / Distract / First Impression are on dedicated modals,
the remaining pendingRoll consumers are weapon attacks + generic skill
rolls. Those are the right home for pendingRoll (the entire AOE pre-
visualization, range CMod calculation, target-picker plumbing is
appropriate there). pendingRoll stays for combat; the dedicated-modal
pattern owns the special actions.

No further migration needed; just remove the dead label-includes()
branches in `executeRoll` once each phase verifies clean.

---

## Acceptance criteria

Phase 1 is "done" when:
- Stabilize button on CharacterCard opens the dedicated modal
- Roll fires, cascade applies death_countdown=null + incap_rounds on
  success
- pendingRoll's `Stabilize ` branch is removed (gated behind feature
  flag for one playtest)
- All existing unit tests pass; new tests cover the cascade
- Roll-feed preview HTML reflects any narrative changes (likely zero)
- Manual smoke: medic stabilizes downed PC, dies if failed, recovers
  if successful, all in line with canon

---

## Out of scope for Phase 1

- 5ft / 20ft engagement-range refactor (separate todo)
- Multi-stabilize UI redesign (the per-target button list works)
- NPC-on-NPC stabilize (today the button only appears for PC medics)
- Healing-while-mortally-wounded edge case (out of scope; canon ambiguous)

---

## Cross-references

- Current path: `app/stories/[id]/table/page.tsx:6128-6164` (cascade)
- Trigger: `components/CharacterCard.tsx:660-668` (button)
- Multi-target render: `tasks/stabilize-multi-target-testplan.md`
- Roll-feed copy: `lib/roll-helpers.ts:411-433` (STABILIZE prefix branch)
- Similar pattern (reference): `components/CharacterCard.tsx:1100+`
  (Stress Check dedicated modal - this is the shape to mirror)
- Recruit Tier-2 Phase A/B/C (2026-05-19): a recent example of how to
  split a multi-phase migration into shippable chunks.
