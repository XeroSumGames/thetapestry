# 3c-A smoke testplan - itemized CMod + NPC defense to-hit + blast log (2026-05-23)

Covers the three surgical 3c-A fixes shipped to live this session. The
structural `useRollResolution` extraction (3c-B) + the realtime channel
migration (3d) are NOT in this batch - they are the next fresh-window work.

**Commits under test**
- `c47cdca` - pure `buildCmodBreakdown` helper + 8 unit tests (no UI on its own)
- `7350715` - itemized CMod end-to-end + NPC defense on the to-hit roll (Q1=b)
- `ff06d92` - grenade blast AoE consolidated feed line (Q3a)

All on live `main`. tsc + 532 unit tests green. The arch LOC ratchet is
temporarily relaxed (page.tsx grew for the shared helpers); 3c-B re-tightens it.

---

## Part 1 - Itemized CMod breakdown (the Aim fix)

Setup: combat active, a PC with a ranged weapon, at least one NPC enemy on the map.

1. **Aim then attack.** Have the PC take the **Aim** action (+2), then Attack an NPC.
   - In the roll **result feed row**, click the **▸** to expand.
   - PASS: the breakdown shows **`+2 Aim`** as its own positive term (blue), NOT folded into a single net "CMod". You should literally see your Aim called out.
   - If at range, you should ALSO see a **`-N Range`** term (amber) separately.
2. **Confirm the total reconciles.** Add the printed terms to the dice + AMod/SMod: it must equal the `= N` total shown. (e.g. `[6+3] +1 AMod +2 Aim -4 Range = 8`.)
3. **Stack more sources.** Attack the SAME NPC again next turn (no Aim): expect a **`+1 Same target`** term. If you used Coordinate / Coordinated Effort, expect those as their own terms.
4. **Manual CMod.** Type a number into the modal's CMod field that differs from the auto value, then roll: the difference shows as a generic **`CMod`** term (nothing silently lost).
5. **Old rows unaffected.** Scroll to a PRE-today attack roll and expand it: it still shows the single net **`CMod`** term (graceful fallback, no crash).

## Part 2 - NPC defense now lowers the to-hit roll (Q1=b, balance change)

This is the one intended behavior change - tough NPCs are now harder to hit.

1. Attack an NPC with a meaningful **Dexterity** (ranged) or **Physicality** (melee).
   - Expand the breakdown: PASS = a **`-N Target DEX`** (ranged) or **`-N Target PHY`** (melee) term appears, where N is the NPC's stat (+ any Defend/Take Cover bonus on them).
   - Before today this term was absent for NPC targets (it only applied when attacking another player). The attack total should now be correspondingly lower.
2. **PC target sanity.** Attack a player character: the `Target PHY/DEX` term should still appear (unchanged behavior, plus it now also includes a Defend/Take Cover bonus if active).
3. **Object/cell target.** Attack a barrel / throw at an empty cell: no target-defense term (objects have no defense).
4. **Switch target in the modal.** Open an attack, then change the target via the dropdown: the CMod must recompute AND keep the Aim term (previously a manual target switch silently dropped Aim).

## Part 3 - Grenade blast consolidated log (Q3a)

1. Throw a **grenade** into a cluster of 2+ NPCs (and ideally a PC + an object in radius).
   - Expand the thrower's feed row: PASS = a **"💥 Blast hit"** box listing **every** victim with their splash, e.g. `Avery (Engaged): 14 WP, 7 RP | Marla (Close): 7 WP, 3 RP | Barrel 1 (Close): 7 WP`.
2. **Fumble path (Xero's original repro).** Force a **Dire Failure** grenade throw (the one that scatters - "primary skipped, blast AoE resolves from override center").
   - PASS = the "Blast hit" box STILL appears listing the victims the scattered blast caught (this is the case that previously showed nothing per-victim).
3. **Damage still correct.** Cross-check the listed splash against the actual WP/RP drops on each token (the math was already correct; this fix only adds the logging).

---

## Visual reference
`tasks/roll-feed-log-preview.html` - two new sections: "Attack - itemized CMod breakdown" and the blast example under "Explosives". Open and click the ▸ to expand.

## Rollback
Any one fix reverts independently:
- `git revert ff06d92 --no-edit && git push origin main` (blast log)
- `git revert 7350715 --no-edit && git push origin main` (itemized CMod + NPC defense)
- `git revert c47cdca --no-edit && git push origin main` (pure helper - revert last, the others import it)

## Known follow-ups (NOT in this batch)
- 3c-B: extract `executeRoll` into `useRollResolution` (re-tightens the LOC ratchet). Fresh window.
- 3d: 11 channels / 23 events to `useCampaignChannel`; carve `useTacticalSync` / `useInitiative`. Fresh window.
- Reroll rows fall back to the single net CMod term (the breakdown isn't recomputed on reroll) - minor, rerolls are rare.
- The modal's CMod input still shows a single net while the FEED is itemized - if you want the modal itemized too, that's a small follow-up.
