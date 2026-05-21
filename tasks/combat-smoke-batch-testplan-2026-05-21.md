# Combat Smoke Bug Batch - Test Plan (2026-05-21)

Three root-caused combat-surface bugs from the puffer-fish handoff, fixed in
worktree `claude/combat-smoke`. All changes are in React event-handler / render
code on the combat surface (no unit tests - the testable pure helpers
`compactRollSummary` + `collapseCoordEffortChains` are already covered, and the
fixes themselves live in DB-coupled component code that the codebase smoke-tests
manually). Type-clean (`npx tsc --noEmit`) + 476/476 vitest pass + all 3
guardrails (font / role / em-dash) green + preview-sync satisfied.

---

## SMOKE-1 (HIGHEST) - active combatant self-downs mid-turn, combat stalls

**Bug:** When the active combatant throws a grenade and stands in its own blast
(or otherwise drops to Mortally Wounded / Incapacitated via SPLASH damage), the
turn never advances. The downed combatant stays `is_active=true` and the GM has
to manually click NEXT. Root cause: the per-target auto-advance in the named-
damage branches (page.tsx ~L5546 PC / ~L5613 NPC) only covers the PRIMARY
target. A self-blast victim is a SPLASH job, and the blast loop applied damage
with no initiative handling at all.

**Fix:** In the blast Pass-3 loop (page.tsx ~L5894), track `activeDownedByBlast`
when a splash job drops the *active* combatant (PC by `character_id`, NPC by
`npc_id`) to WP=0 or RP=0. After the blast writes land, if set, zero the active
entry's `actions_remaining` and fire `nextTurn()` + `loadInitiative` + a
`turn_changed` broadcast. `nextTurn` re-fetches `initiative_order` from the DB,
so the `actions_remaining=0` write is visible to its skip-walk.

**No double-advance:** the turn normally advances at modal-close via
`closeRollModal` -> `consumeAction` -> `nextTurn`. After this fix advances the
turn inside `executeRoll`, `closeRollModal` re-fetches `is_active` (L7061), finds
the roller is no longer active (`rollerIsActive=false`, L7075), and skips
`consumeAction`. Primary target is skipped in the blast loop (`isPrimary`
continue), so only ONE `nextTurn` can fire per roll.

### Steps
1. Open a tactical scene at `/stories/<id>/table` with combat active.
2. Give the ACTIVE combatant (PC) a Grenade (Blast Radius) with qty >= 1.
3. Click Attack -> the map enters throw mode. Click a cell ADJACENT to the
   thrower's own token (so the thrower is in the Engaged band).
4. Confirm the friendly-fire prompt (it should list the thrower as `(YOU)`).
5. Roll. Watch the thrower take splash damage that drops them to WP=0 (Mortally
   Wounded) or RP=0 (Incapacitated).
6. **Expected:** the initiative bar advances to the NEXT combatant automatically.
   The downed thrower STAYS in the initiative list (still stabilizable) but is no
   longer the active combatant. The "Death is in the air" / "Lights Out" row +
   the Stress row appear in the feed.
7. **Repeat for an NPC thrower** (GM controls an NPC whose turn it is; throw a
   grenade at its own feet): turn advances, NPC stays listed.
8. **Negative check (no regression):** a PC throws a grenade at an ENEMY and does
   NOT down themselves -> turn advances normally on modal close (one advance, not
   two). Confirm the next combatant isn't skipped.
9. **Negative check:** an OUT-OF-TURN thrower (not the active combatant) self-
   downs via blast -> turn does NOT advance (it isn't their turn). Confirm the
   active combatant is unchanged.

---

## SMOKE-2 (presentational) - Coordinated Effort lead shows as plain row

**Bug:** A Coordinated Effort that has only the LEAD roll so far (participants
haven't rolled yet) rendered as a plain default narrative row, then "morphed"
into the Tier-A banner once the first participant rolled. `collapseCoordEffortChains`
only enriches a chain that HAS participants; lead-only chains passed through
unenriched and fell to the default `compactRollSummary` row.

**Fix:** Added a lead-only banner renderer in RollsFeed.tsx (sibling to the
enriched banner) that fires when `label` starts with `Coordinated Effort - ` AND
there are no `coordChainParticipants`. It reuses `compactRollSummary` for the
locked "kicks off a Coordinated Effort with <skill> ..." wording (single source
of truth) and wraps it in the same Tier-A chrome. Preview HTML updated.

### Steps
1. In combat, have a PC start a Coordinated Effort (Tactics*) as the lead.
2. **Expected:** immediately, the feed shows a `COORDINATED EFFORT` BANNER (blue/
   green/amber/red by outcome) reading "<lead> kicks off a Coordinated Effort
   with Tactics* ...". NOT a plain name-row.
3. Expand (>) -> shows just the lead's dice + AMod/SMod/CMod/total/outcome (no
   participant rows yet).
4. Have a participant roll into the chain.
5. **Expected:** the banner upgrades in place to the enriched form ("<lead> uses
   Tactics* to coordinate an effort with <names>"); expand now lists the lead +
   each participant's dice.
6. Check each outcome tier produces the right wording + the +1 Insight Die badge
   only on High/Low Insight. Cross-check against
   `tasks/roll-feed-log-preview.html` (Lead-only banner section).

---

## SMOKE-3 (cosmetic) - friendly-fire warning fires for NPC throwers hitting PCs

**Bug:** The grenade friendly-fire confirm fired for an NPC thrower about to hit
PCs - but PCs are the NPC's ENEMIES, so that's intended damage, not friendly
fire. Root cause: page.tsx built `friendlyCharacterIds` from ALL PCs and excluded
the attacker by `character_id`; for an NPC thrower `character_id` is null so the
filter was a no-op -> every PC counted as "friendly." The TacticalMap scan also
only ever looked at PC tokens (`if (!tok.character_id) continue`).

**Fix (faction-symmetric):** page.tsx now populates only the list matching the
thrower's faction - a PC thrower gets `friendlyCharacterIds` (other PCs), an NPC
thrower gets `friendlyNpcIds` (other NPCs); the opposing faction list is empty.
TacticalMap's scan now checks BOTH PC and NPC tokens against the matching list +
self by either `attackerCharId` or `attackerNpcId`. Hitting the opposing faction
never prompts.

### Steps
1. **PC thrower (no regression):** active PC throws a grenade near another PC ->
   friendly-fire confirm fires and lists the other PC. Throwing near an ENEMY NPC
   only -> NO confirm (or only the (YOU) self-hit if the PC is in radius).
2. **NPC thrower (the bug):** GM's NPC (whose turn it is) throws a grenade that
   will land on PCs -> **NO friendly-fire confirm** (PCs are enemies). The throw
   proceeds straight to the roll modal.
3. **NPC thrower hitting own NPCs:** NPC throws near ANOTHER NPC -> confirm fires
   and lists the other NPC (faction-symmetric with the PC case).
4. **Self-hit still works both ways:** a thrower (PC or NPC) standing in its own
   blast still gets the `(YOU)` self-hit tag in the confirm.

---

## Rollback
All four files revert cleanly (`git revert <sha>`); no schema, no migration, no
data writes added. SMOKE-1 is the only behavioral combat change - if it
misbehaves at the table, the symptom is a turn that advances when it shouldn't
(visible immediately) or stalls (the pre-fix behavior), both non-destructive.
