# Gut Instinct Modal Migration - Test Plan (2026-05-20)

**Branch:** `claude/gut-instinct-modal`
**Live URL:** thetapestry.distemperverse.com
**Time budget:** ~5 minutes manual smoke. Unit coverage already green (419/419, 8 new in `gut-instinct-helpers.test.ts`).

---

## Pre-flight (already verified)

- [x] `npx vitest run tests/lib/` - 419/419 pass (8 new).
- [x] `npx tsc --noEmit` - clean.
- [x] Guardrails (`check-em-dashes.mjs` / `check-font-sizes.mjs` / `check-role-literals.mjs`) - clean.

---

## Manual smoke - player rolls Gut Instinct on own PC (out of combat)

1. Open `https://thetapestry.distemperverse.com/stories/<campaign-id>/table` as a player.
2. With NO combat active, open the **Checks** menu in the active-combatant header (or wherever the GM Checks menu lives).
3. Click **Gut Instinct**.
4. If you have only one visible PC: the modal opens directly. If you have multiple, the picker opens first - pick your PC.
5. **Expected:** a new modal opens titled "Gut Instinct" with subtitle "&lt;PC&gt; reads the room", formula "2d6 + PER (RSN + ACU) + Sub-skill + CMod".
6. Confirm AMod = your PC's RSN + ACU. Confirm SMod = the HIGHEST level among Psychology / Streetwise / Tactics (0 if none).
7. Warnings box at the bottom should read: "Sub-skill: best of Psychology / Streetwise / Tactics. GM whispers a private detail on resolve."
8. Click "Roll Gut Instinct". **Expected:**
    - Dice fire visibly.
    - Outcome banner shows (Success / Failure / Wild Success / Dire Failure / High Insight / Low Insight).
    - Rolls feed shows a "&lt;PC&gt; - Gut Instinct" row with the canon narrative.
    - PC's `actions_remaining` UNCHANGED (no active combat = no action consumed).
9. **On the GM/Thriver's screen** (different browser / incognito tab logged in as the GM): a separate "Gut Instinct - &lt;outcome&gt;" modal pops up asking them to whisper a detail to the rolling player. They type something, hit Send.
10. The player's Chat tab shows the GM whisper "Gut Instinct: &lt;detail&gt;".
11. Click Close on the rolling player's modal. State resets.

---

## Manual smoke - GM rolls Gut Instinct on a player's PC

1. As GM, open the Checks menu, click Gut Instinct.
2. Pick a player's PC from the picker.
3. **Expected:** the modal opens with that PC's stats. GM rolls.
4. **No whisper modal pops up on the GM's screen** - the receiver gate at L1401 skips self-roll: `if (pcOwnerId === userIdRef.current) return`.
5. Feed row appears for everyone. Player whose PC was rolled DOES see the whisper modal on their own screen (because the broadcast targets their userId, not the GM's).

Wait, re-read L1397-1404: the gate is `if (pcOwnerId === userIdRef.current) return`. So the GM, if they rolled on a player's PC (pcOwnerId !== GM's userId), would NOT skip - they'd see the whisper modal. Then they'd whisper to themselves? Let me reread.

Actually the gate fires on the broadcast RECEIVER side. So:
- GM rolls Gut Instinct on Player A's PC.
- Broadcast sends `pcOwnerId = playerA.userId`.
- GM client receives broadcast. `gmLikeRef.current = true` (GM), `pcOwnerId !== userIdRef.current` (GM's id) - so GM client DOES open the whisper modal. GM whispers to Player A.
- Player A's client receives broadcast. `gmLikeRef.current = false` - so the gate `if (!gmLikeRef.current) return` skips opening the whisper modal. Player A doesn't see "Whisper a detail" prompt (they're not the GM).
- Player A DOES see the whisper land in their Chat tab when GM sends.

That's the right behavior. Skip-self only kicks in if the GM rolled on their OWN PC (pcOwnerId === GM's userId).

---

## Manual smoke - active combatant rolls Gut Instinct (consumes action)

1. Start a combat. PC is the active combatant.
2. From the active-combatant header, fire Gut Instinct on the active PC.
3. Roll.
4. **Expected:** the PC's `actions_remaining` decrements by 1. This is the only path that consumes an action - mirrors the legacy closeRollModal gate.
5. Out-of-turn Gut Instinct (rolled by anyone else, or rolled on a non-active PC) costs nothing.

---

## Edge case - GM rolls Gut Instinct on their OWN PC

1. As a GM who also has a PC in the campaign, fire Gut Instinct on their own PC.
2. Roll.
3. **Expected:** dice + feed row land normally. The whisper modal does NOT open on the GM's screen (gate at L1401: `if (pcOwnerId === userIdRef.current) return`). No self-whisper. This matches legacy behavior.

---

## Console / network checks

- DevTools Console: zero unexpected warnings.
- Network tab per Gut Instinct attempt:
    - 1× POST to `/rest/v1/roll_log` (saveRollToLog)
    - 0 or 1× PATCH to `/rest/v1/initiative_order` (consumeAction; only if PC is active combatant)
    - WebSocket: `gut_instinct_resolved` broadcast event after the roll resolves

---

## Rollback procedure

```sh
git -C /c/TheTapestry revert <gut-instinct-commit> --no-edit
git -C /c/TheTapestry push origin main
```

The legacy `executeRoll` Gut Instinct broadcast (now preserved unreachable) returns to active service on revert because `triggerGutInstinct` would route back through `handleRollRequest`.

---

## After playtest verifies clean

- Phase 4 cleanup ready to ship: delete the three preserved-unreachable legacy executeRoll branches (Stabilize + Distract + Gut Instinct, ~85 lines combined) in one commit.
- Modal unification arc COMPLETE except for Group Check (intentionally deferred; its current pooled-banner is canonical, not pendingRoll-bespoke).
