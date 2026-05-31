# Finding - Grapple still uses the old (pre-locked-shell) modal

**Lane:** discovered by Xero mid-playtest 2026-05-31; routed to **Hunt & Peck**.
**Severity:** polish, NOT a playtest blocker. Grapple still functions; it just
looks wrong against the locked modal-redesign shell.

## What

The grapple action launches a hand-rolled inline JSX modal at
`app/stories/[id]/table/page.tsx:8559+` (gated on `showGrappleModal`). It has
its own backdrop (`position:'fixed', inset:0, background:'rgba(0,0,0,0.9)'`),
its own chrome, and does NOT consume the locked `components/RollModal.tsx`
shell that all the other roll modals migrated onto in Phase A2.

## Where

- Open at `app/stories/[id]/table/page.tsx:8559` - the `{showGrappleModal && (() => { ... })()}` IIFE block.
- Triggers: same file `:5709` and `:5995` (two `setShowGrappleModal(true)` call sites).
- State: `showGrappleModal`, `grappleResult`, `grappleTarget`, `grappleInsight`, `grappleCmod` declared at `:705+`.
- Resolution result-set at `:8690` (`attackerWins ? 'grappled' : defenderWins ? 'failed' : 'no_victor'`).

## Why it's HP polish, not a blocker

Combat keeps moving; the grapple still rolls and applies state. The cost is
visual + brand inconsistency - against the new shell every other roll modal
follows. KS-first-impression risk if a reviewer hits a grapple at the demo.

## Fix shape (matches the Modal Redesign A3+ path)

Migrate the IIFE block to consume `RollModal` with:
- `accent` per the grapple outcome palette.
- `eyebrow = 'GRAPPLE'`.
- Inline CMod box on the base-roll line (already locked in the shell).
- Always-on Insight Die option.
- Pre-roll target picker (engaged list at `:8574+`) lives in the middle strip.
- Result phase = standard roll-result body; show
  `grappleResult.attackerName` + outcome chip (grappled / failed / no_victor).

Spec: `tasks/modal-redesign-spec-2026-05-24.md`.
Mockup: `tasks/modal-mockup.html` (v8 LOCKED).
Companion: the Recruit pick step (480 wide, similar pre-roll affordance set)
is the closest precedent.

## Acceptance

- Grapple launches `RollModal` shell at 340 px default (per the locked spec).
- The two trigger sites (`:5709`, `:5995`) keep working identically.
- The result phase shows the same outcome semantics
  (`grappled`/`failed`/`no_victor`) the current modal produces at `:8690`.
- No regression to the `consumeAction` / `applyDamage` / `roll_log` write
  side-effects.

## Tracking

Add to `tasks/todo.md` CURRENT OPEN, beneath the modal-redesign section, as:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31] grapple modal still on the old (pre-shell) inline JSX path** - `app/stories/[id]/table/page.tsx:8559+`. Migrate to `RollModal` per the locked spec; spec doc `tasks/modal-redesign-spec-2026-05-24.md`, finding `tasks/finding-grapple-old-modal-2026-05-31.md`. Polish, not a blocker.
```
