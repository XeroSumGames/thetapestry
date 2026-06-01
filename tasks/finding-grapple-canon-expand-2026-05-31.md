# Finding - Grapple canon expansion (defender action loss + grappler Subdue)

**Lane:** routed to **Hunt & Peck**.
**Severity:** canon mechanics fix + small UI add. NOT a blocker; combat
still resolves. But the current grapple flow is too restrictive (grappler
can only Release, defender keeps full actions) which fails the table-feel
test - canon owes both sides something they can DO.

## Trigger

2026-05-31 playtest. Xero (GM) note on memory (recorder was off so the
mark was lost; recovered verbally same evening):

> "a note was about losing an action for being grappled. also, when
>  someone is grappling successfully, they have no other options other
>  than grapple or release, we need to add Subdue to it."

## Canon source of truth

[app/rules/combat/combat-rounds/page.tsx:26](app/rules/combat/combat-rounds/page.tsx:26)
today:

> Grapple - 1 action - Opposed Physicality + Unarmed Combat. Winner
> restrains or takes 1 RP from the loser.

## Two changes (one commit)

### A. Defender loses 1 action on successful grapple

Current code at
[app/stories/[id]/table/page.tsx:8693-8702](app/stories/[id]/table/page.tsx:8693)
when attackerWins:

```ts
await supabase.from('initiative_order')
  .update({ grappled_by: active.character_name })
  .eq('id', targetEntry.id)
// Apply 1 RP to target...
```

Add a single call after the `grappled_by` write:

```ts
await consumeAction(targetEntry.id)
```

`consumeAction` already exists in scope (see :436401 etc. in the
playtest trace - it's the canonical action-decrement path; auto-advances
the turn if `actions_remaining` hits 0). One line, no new helper.

Canon prose update at
[app/rules/combat/combat-rounds/page.tsx:26](app/rules/combat/combat-rounds/page.tsx:26):

> Grapple - 1 action - Opposed Physicality + Unarmed Combat. Winner
> restrains or takes 1 RP from the loser. **On a successful grapple,
> the defender also loses 1 action this round** (they've been knocked
> off balance / pinned mid-action).

### B. Add Subdue to the grappler's action menu

Current code at
[app/stories/[id]/table/page.tsx:5713-5730](app/stories/[id]/table/page.tsx:5713):
when `isGrappling`, only the Release button renders. The grappler is
locked into Release-or-do-nothing.

Subdue **already exists** as a combat action at
[app/stories/[id]/table/page.tsx:6082-6084](app/stories/[id]/table/page.tsx:6082) -
it's a weapon attack at 100% RP intended for incapacitation. So this
isn't a new mechanic; it's exposing the existing one inside the
grappling state.

Render a Subdue button inside the `isGrappling` branch alongside
Release. Re-use the exact callback shape from :6082-6084 but target the
grappled entry (`grappledTarget.character_name`) rather than the
dropdown selection. Pseudo:

```tsx
{isGrappling && grappledTarget && (
  <>
    <span style={...}>Grappling {grappledTarget.character_name}</span>
    <button onClick={subdueGrappled}
      style={actBtn('#2a1210', '#f5a89a', '#5a1d1d')}>Subdue</button>
    <button onClick={releaseGrappled}
      style={actBtn('#1a1a2e', '#7ab3d4', '#2e2e5a')}>Release</button>
  </>
)}
```

Subdue should:
- Cost 1 action (same as the standard Subdue action).
- Auto-target the grappled entry (no target dropdown - they're already
  pinned to you).
- Roll Subdue with the wielded weapon at 100% RP (same as :6082).
- On Wild Success / Success: optional canon question - does Subdue
  while grappling auto-incapacitate, or is it just a damage roll? Per
  the literal canon today ("Winner restrains or takes 1 RP"), Subdue
  is a separate canon action that does damage at 100% RP. Recommend:
  KEEP Subdue's existing damage-roll behavior; do NOT auto-incap on a
  successful Subdue-while-grappling. Xero can revise later if play
  shows it's too tame.

Canon prose update: add a paragraph below the Grapple row noting that
**a grappler may use their action to Subdue the grappled defender each
round** instead of Release. The grappled defender has no defensive
roll against Subdue while grappled (they're pinned). Wording suggestion:

> While maintaining a grapple, the grappler may spend an action to
> Subdue the pinned defender (Unarmed Combat or wielded melee weapon
> at 100% RP). The grappled defender has no defensive roll while
> pinned. Release ends the grapple and frees the defender.

(HP - confirm exact wording with Xero before shipping; the mechanic is
locked, the prose is editorial.)

## Acceptance

- Grapple win: defender's `actions_remaining` decremented by 1 in
  `initiative_order`; turn auto-advances if they hit 0 (existing
  consumeAction behavior).
- Grappler's action bar shows BOTH Subdue and Release while
  `isGrappling`.
- Subdue button rolls against the grappled defender, applies damage at
  100% RP via the existing damage pipeline, posts the roll to roll_log,
  consumes 1 grappler action.
- Defender stays grappled after Subdue (only Release / Break Free
  unsets `grappled_by`).
- Canon page prose updated to match both changes.
- Build + unit tests + font/role/em-dash/arch + 822 tests still green.

## Out of scope (later)

- Grappler dragging the grapplee (movement-while-grappling). Canon
  silent today; defer.
- Multi-attacker grapples (gang up on one target). Defer.
- Improvised attacks from inside a grapple (eye-gouge, bite, etc).
  Defer; flavor color, not load-bearing.

## Tracking

Append to `tasks/todo.md` CURRENT OPEN, beneath the modal-redesign
block:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31] Grapple canon expansion - defender action loss + grappler Subdue.** (A) On a successful grapple, defender loses 1 action this round - add `await consumeAction(targetEntry.id)` after the `grappled_by` write at `app/stories/[id]/table/page.tsx:8702`. (B) Add Subdue button inside the `isGrappling` block at `:5713-5730` alongside Release; reuse Subdue logic at `:6082-6084`. Update canon prose at `app/rules/combat/combat-rounds/page.tsx:26`. Finding: `tasks/finding-grapple-canon-expand-2026-05-31.md`.
```
