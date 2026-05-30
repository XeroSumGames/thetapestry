# Finding - Tactical-map move-follow gate RED on 2026-05-30 playtest

**Owner of fix:** Hunt & Peck (`components/TacticalMap.tsx`). **Author:** Puffer (this is a finding, not a fix). **Date:** 2026-05-30.

**Severity / KS-impact:** YELLOW on the Risk Register stays YELLOW. The #1 core-table-loop reliability item for the 9/1 Kickstarter (and the 7/1 Beta-500) is GATED on this passing. Tonight's playtest is currently unable to rely on the player's view auto-following GM moves; the **GM workaround is "Share View" after each move**, but that is friction, not a fix.

---

## What was tested + what failed

`7ba065b` (HP, 2026-05-29) shipped the full viewport model: shared scale metric, fit-on-open, and **smart move-follow for the active combatant + the viewer's own PC**. The Puffer gate (`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`) was extended in `45b92a9` (Puffer, 2026-05-29) with checks #9-12 to exercise the move-follow behavior end-to-end.

On the 2026-05-30 2-client playtest, **check #9 FAILED** (follow active combatant on move):

- **Setup:** GM + 1 player on prod. Combat started. **Cree** is the active combatant (green-ring indicator on the GM's token). The player is NOT Cree.
- **Action:** GM hit SPRINT to move Cree several cells.
- **GM screen:** Cree's token now centered roughly mid-map near a building edge, ACTIVE indicator visible.
- **Player screen:** parked on a completely different region (bottom-right area of the map, trees + green tint, "NO NPCS REVEALED" panel visible). Cree is nowhere in view, and the player's pan did NOT scroll to bring Cree back into frame.

Expectation per the spec (`tasks/tactical-map-viewport-model-2026-05-29.md`) and the test (`lib/tactical-view.ts:findMoveFollowToken`): the player's viewport should auto-scroll to bring Cree back into view because Cree is the active combatant AND was off-screen on that client.

Other checks not formally walked (#10/11/12) given #9 already trips the NO-GO; rerun the full 12 after the fix.

---

## Suspected root causes (in priority order, code-grounded)

These are pointers for HP - I have not edited app code.

### 1 (most likely). `initiativeOrderRef.current` is empty or stale on the player client when Cree's move-broadcast arrives.

Site: `components/TacticalMap.tsx:709`
```ts
const activeEntry = initiativeOrderRef.current.find((e: any) => e.is_active)
const mover = findMoveFollowToken(toks, prevTokenPosRef.current, myCharacterIdRef.current, activeEntry)
```

`initiativeOrderRef` mirrors the `initiativeOrder` prop (`TacticalMap.tsx:387-388`). If the player's parent component hasn't yet hydrated `initiativeOrder` from the campaign state when the `token_moved` broadcast (or `scene_tokens` postgres change, `TacticalMap.tsx:738-742`) fires `loadTokens`, `activeEntry` is `undefined`. `findMoveFollowToken` then only matches `isOwn` (the viewer's own PC). The player isn't Cree, so nothing matches and no scroll happens. **This is a sync/race between initiative-order propagation and the token-move broadcast.**

Cheap diagnostic for HP: add a temporary `console.log('[move-follow]', { activeEntryId: activeEntry?.character_id ?? activeEntry?.npc_id, myId: myCharacterIdRef.current, initiativeOrderLen: initiativeOrderRef.current.length, moverId: mover?.id })` inside `loadTokens` right after L710 and run a player-side reload during combat. If `initiativeOrderLen` is 0 or `activeEntryId` is undefined while a move is happening, this is the root cause.

Fix shape (HP to scope): pull `activeEntry` from a more durable source than the prop ref (e.g. read the campaign's active-initiative state directly, or query the same DB row the GM mutates), OR ensure the player's initiative-order prop is populated before/with the first scene_tokens subscription firing. Either way the follow decision needs an `activeEntry` that is reliable at move-broadcast time.

### 2. `activeEntry.character_id` is null on the player's copy of the entry and the name fallback misses.

Site: `lib/tactical-view.ts:findMoveFollowToken`
```ts
const isActive = !!activeEntry && (
  (activeEntry.character_id && tok.character_id === activeEntry.character_id)
  || (activeEntry.npc_id && tok.npc_id === activeEntry.npc_id)
  || (activeEntry.character_name && tok.name === activeEntry.character_name)
)
```

If the initiative_order entry on the player client lacks `character_id` (it can be the case for initiative rows entered by name only) AND the token's `name` differs from `character_name` (whitespace, case, an inserted label), the active branch fails. The same diagnostic log above shows this immediately.

### 3. `tokenScrollSceneRef.current !== sceneId` on the player client.

Site: `components/TacticalMap.tsx:701` (gate around the whole follow block).

If for any reason the player's `tokenScrollSceneRef` doesn't match the scene whose tokens are being loaded (e.g. ref reset on a re-render path that doesn't go through the else branch's assignment at L715), the follow block is skipped silently. Less likely than #1 but worth a `console.log` of the gate result.

---

## What is NOT the bug (ruled out by reading)

- `isCellInView` math (`lib/tactical-view.ts:161`) - straightforward axis-aligned overlap, no axis swap; would only short-circuit if `mover` was already found, which it isn't here.
- `prevTokenPosRef` first-load empty case - line 718 populates it at the end of every `loadTokens`, so by the 2nd loadTokens (Cree's move) prev is fully populated and the position diff fires.
- The scale-divergence fix - both screenshots show the SAME map composite per the scale model (#2 of the gate passes); this is purely the follow path.

---

## Workaround for tonight's session (GM-side, no code)

While HP is fixing this:
- After moving the active combatant, the GM clicks **Share View** to snap every player's pan+zoom to the GM's. The players will then see the active combatant at the GM's framing. Repeat after each significant move.
- This is documented at `components/TacticalMap.tsx:760-771` (Share View is a one-shot broadcast, not a continuous mirror).

---

## Re-test on fix landing

Re-run all 12 checks of `tasks/tactical-map-verify-2client-testplan-2026-05-27.md` on TWO clients (one narrow) including the new #9-12. Risk Register demote (`debug-handoff.md` Sec 1, TacticalMap canvas) is gated on all-12 GREEN; staying YELLOW until then.
