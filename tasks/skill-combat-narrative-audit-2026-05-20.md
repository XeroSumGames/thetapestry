# Skill + Combat Narrative Audit (2026-05-20)

Read-only cross-reference of `lib/roll-helpers.ts::compactRollSummary` (the canonical narrative renderer) against `tasks/roll-feed-log-preview.html` (the canonical visual reference). All line numbers are absolute in the respective files.

## Summary

- 40 narrative branches audited (every code branch in `compactRollSummary` that returns a string).
- 6 drift bugs found (text / character-level mismatches between code output and preview).
- 9 missing-preview entries (code branch produces output, preview has no row for that case OR is missing outcomes within an existing case).
- 0 missing-code entries (every preview row maps to a code path - the Tier A Coordinated Effort banner and bespoke combat-start/end/initiative banners live outside `compactRollSummary` and are rendered directly in `components/RollsFeed.tsx`, which is expected).
- The audit-day commits (Stabilize Phase 1 `2255ced`, Distract Phase 2 `54dec35`, Gut Instinct `097e87f`, mounted-weapon FIRE `e72dd40`, vehicle check modal uniformity `b1b698a`) all landed cleanly in both files; no drift was introduced by those commits.
- Most drift is in non-recently-touched branches (gather_materials, Coordinate-vs-target legacy, Coordinated-Effort emoji-strip dead path) and in preview omissions for HI/LI/WS/DF tail variants on Infection / Lasting Damage / Gut Instinct / Perception / Grapple.

---

## Drift bugs (code returns X, preview shows Y)

### Gather Materials

- **Outcome**: `gather_materials` (event-tag row, no dice).
- **Code**: `app/vehicle/page.tsx:1686` writes label as `${vehicle.name} stockpile updated - gathered 1 day of brewing materials (now ${newCur}/${effectiveBrewingMax(vehicle)})` (ASCII hyphen between "updated" and "gathered"). `lib/roll-helpers.ts:94` returns the label verbatim.
- **Preview**: `tasks/roll-feed-log-preview.html:917-918` shows `Minnie stockpile updated [U+2014] gathered 1 day of brewing materials (now 1/2)` and `... (now 2/2)` - both use the em-dash character (U+2014, written here as the literal escape so this audit file itself doesn't trip the guardrail), not ASCII hyphen.
- **Severity**: high (em-dash anywhere is a hard project rule violation; preview is the canonical reference for what the feed SHOULD show, so this misleads future audits).
- **Suspected cause**: Preview was likely typed by hand from the comment in `lib/roll-helpers.ts:92` (which says `<name> gathers a day of brewing materials for <vehicle>` - itself ALSO stale relative to the actual emit) rather than copied from a real feed sample; em-dash got autocorrected in.

### Gather Materials (stale code comment)

- **Outcome**: `gather_materials` (documentation drift, not a runtime bug).
- **Code**: `lib/roll-helpers.ts:92` comment says label is `"<name> gathers a day of brewing materials for <vehicle> (now N/M)"`. The same stale comment is duplicated at `lib/roll-outcomes.ts:90`.
- **Reality**: `app/vehicle/page.tsx:1686` emits `"<vehicle> stockpile updated - gathered 1 day of brewing materials (now N/M)"` (vehicle-first, not name-first; "stockpile updated" wording, no "for <vehicle>" clause).
- **Severity**: low (comment-only, doesn't affect feed output - but causes drift hazards for anyone touching the area without grepping the actual emit site).
- **Suspected cause**: Label wording was changed at the emit site without updating the doc-comment in roll-helpers.ts (and the duplicate in roll-outcomes.ts).

### Coordinated Effort - legacy single-row Wild Success

- **Outcome**: `Wild Success` on lead-only chain (no participants yet).
- **Code** (`lib/roll-helpers.ts:515`): `${r.character_name} kicks off a Coordinated Effort with ${skill} and is wildly successful`
- **Preview** (`tasks/roll-feed-log-preview.html:757`): `Cree Hask kicks off a Coordinated Effort with Tactics* and is wildly successful`
- **Status**: ✓ MATCHES. (Listed here only because the Coordinated-Effort area has nearby drift in the Tier A banner section - see below.)

### Coordinated Effort - Tier A banner WS tail asymmetry

- **Outcome**: `Wild Success` on enriched chain (Tier A banner).
- **Code** (`components/RollsFeed.tsx:795`): adverbClause for WS = `"is wildly successful using ${skill}"` → full sentence becomes `${r.character_name} is wildly successful using Tactics* to coordinate an effort with Marcus, Knox, and Enya`.
- **Preview** (`tasks/roll-feed-log-preview.html:736`): `Cree Hask is wildly successful using Tactics* to coordinate an effort with Marcus, Knox, and Enya` ✓ MATCHES.
- **Severity**: NO DRIFT (verified for completeness because preview lists 6 outcome variants and this is the easiest one to drift). All 6 Tier A banner outcomes (`tasks/roll-feed-log-preview.html:732,736,740,744,748,752`) match `components/RollsFeed.tsx:793-807` adverbClause + L804-806 insightTail.

### Coordinate (vs target) - dead branch with no preview

- **Outcome**: any outcome on the legacy `"Coordinate (vs <target>)"` label (pre-2026-05-10 single-row form, before the unified Tier A / lead-only design).
- **Code** (`lib/roll-helpers.ts:445-450`): regex `^Coordinate\s*\(vs\s+([^)]+)\)/` matches → returns `"${r.character_name} coordinates allies against ${tgt}${outcomeTag}"` (hit) / `"${r.character_name} fails to coordinate allies against ${tgt}${outcomeTag}"` (miss).
- **Preview**: NO ROW for this branch anywhere.
- **Severity**: low (likely dead - L444 comment says "Coordinate" with `(vs <target>)` parens; no recent code writes that label format - the only Coordinate-y label writers now are Coordinated Effort chains and the unified `🎯 ... Successfully coordinated an attack against` form at L457).
- **Suspected cause**: Legacy branch kept for back-compat with old roll_log rows; should either be documented in the preview as a legacy-only row OR removed from code if no live rows still match it.

### Distract - HI text wording cross-reference

- **Outcome**: `High Insight` on Distract.
- **Code** (`lib/roll-helpers.ts:265`): `${name} distracts ${tgt} so badly they seem to become confused and has a Moment of Insight as to why it went so well`
- **Preview** (`tasks/roll-feed-log-preview.html:670`): identical ✓
- **Status**: NO DRIFT. Verified all 6 Distract outcomes (`lib/roll-helpers.ts:264-269` vs `tasks/roll-feed-log-preview.html:669-674`).

### Unified-coordinate `🎯 Successfully coordinated an attack against` strip

- **Outcome**: any non-`action` outcome on label `"🎯 <name> Successfully coordinated an attack against <target> with <allies>"`.
- **Code** (`lib/roll-helpers.ts:457-459`): strips leading `🎯 ` and returns rest of label verbatim.
- **Preview**: NO ROW.
- **Severity**: medium (preview should show at least one example since the emit site is live at `app/stories/[id]/table/page.tsx:6658`; without a row in preview, hand-audits can't tell whether the emoji-strip output reads naturally).
- **Suspected cause**: This emoji-strip path was added when the unified coordinate form was introduced; preview was never given an example row for it (preview only covers the Tier A banner + legacy lead-only single-row narratives for Coordinated Effort, NOT the emit-time `🎯 Successfully coordinated...` label).

### First Impression - canonical tail asymmetry (intentional, documented but worth flagging)

- **Outcome**: `High Insight` and `Low Insight` on First Impression.
- **Code** (`lib/roll-helpers.ts:623,641`): HI tail = `"and has a Moment of Insight as to why they did so well"`. LI tail = `"but has a Moment of Insight as to what went wrong"`.
- **Preview** (`tasks/roll-feed-log-preview.html:691,695`): identical text ✓.
- **Status**: NO DRIFT. Verified ✓. Both files agree these are Xero-locked bespoke deviations from the global tail pattern; preview header at L108-111 and L688-689 explicitly notes them as kept-on-purpose.

### Lasting Wound acquired - effect text format

- **Outcome**: `lasting_wound_acquired` (pass-through label).
- **Code** (`lib/roll-helpers.ts:86`): returns label verbatim.
- **Preview** (`tasks/roll-feed-log-preview.html:717`): `Cree Hask has picked up a Lasting Wound and is now Skittish (-1 CMod on initiative rolls)` - says "CMod on initiative rolls".
- **Preview** (`tasks/roll-feed-log-preview.html:716`): `Cree Hask suffered a Lasting Wound: Skittish (-1 Initiative Modifier) [2d6=7]` - same wound, but effect text says "Initiative Modifier" not "CMod on initiative rolls".
- **Severity**: low (these are two different label paths - L86 pass-through is the post-LDC resolution row, L148 is the LDC row itself; the wound_effect field is sourced from different sites). Either both should say the same thing for the same wound OR the preview should clarify they're separate rows from separate code paths.
- **Suspected cause**: `lib/wounds.ts` (or wherever the wound catalog lives) likely has one canonical effect string; one emit path lowercases / reformats it, the other passes it through. Worth grepping `Skittish` to find the source of truth before fixing.

---

## Missing-preview entries (code branch produces narrative but preview has no example)

### Infection Check - Shrug (Sickness) and HI/LI tails

- **Code location**: `lib/roll-helpers.ts:189-202`.
- **Coverage gap**:
  - Sickness-Shrug variant `"${r.character_name} shrugged off the sickness${outcomeTag}"` has NO preview row (only Wound-Shrug at preview L708 is shown).
  - All four Infection narratives append `${outcomeTag}` - meaning Wild Success, High Insight, Dire Failure (after the Sickness path), and Low Insight variants all exist in code but preview only shows the BASE outcome for each kind/severity (one Wound-Shrug, one Wound-Fail, one Wound-Dire, one Sickness-Fail, one Sickness-Dire - 5 rows total). Missing: Sickness-Shrug, all HI tails (4 of them), all LI tails (4 of them), all WS variants, all DF tails on Sickness-Dire/Wound-Dire (the base lines already mention severity, but the WS/HI/DF/LI tag would compose).

### Lasting Damage Check - HI/LI/WS/DF tail coverage

- **Code location**: `lib/roll-helpers.ts:134-151`.
- **Coverage gap**: Preview L715 shows the bare Shrug (Success), L716 shows the bare Fail with wound details. Code appends `${outcomeTag}` to BOTH branches (L137, L148, L150). Preview doesn't have the HI Shrug ("...and has a Moment of Insight"), the LI Wound ("...but has a Moment of Insight as to why it went so badly"), the WS Shrug ("...and was wildly successful"), or the DF Wound ("...and failed miserably") - four missing rows.

### Perception Check - WS / HI / DF / LI variants

- **Code location**: `lib/roll-helpers.ts:597-601`.
- **Coverage gap**: Preview L703-704 only shows plain Success and plain Failure. Code appends `${outcomeTag}` for ALL six outcomes. Missing rows: WS, HI, DF, LI - four variants.

### Gut Instinct - WS / HI / DF / LI variants

- **Code location**: `lib/roll-helpers.ts:602-606`.
- **Coverage gap**: Preview L699-700 only shows plain Success and plain Failure. Code appends `${outcomeTag}` for all six. Missing: WS, HI, DF, LI - four variants.

### Grapple - all outcomes incomplete

- **Code location**: `lib/roll-helpers.ts:575-583`.
- **Coverage gap**: Code handles three custom grapple outcomes (`'Grappled!'`, `'Failed - 1 RP'`, `'No clear victor'`) plus a default fallback. Preview L721-723 shows three rows but two of them are mismatched to which outcome string they imply:
  - Preview L721 (green) "Frankie grapples with Avery Xavier" maps to `'Grappled!'` outcome ✓
  - Preview L722 (amber) "Frankie unsuccessfully attempts to grapple with Avery Xavier" maps to `'No clear victor'` outcome (code L580) ✓
  - Preview L723 (red) "Frankie fails to grapple with Avery Xavier" maps to `'Failed - 1 RP'` outcome (code L579) ✓
  - All three custom outcomes ARE covered. No drift, but the preview color-coding amber/red is misleading because grapple outcomes don't carry the standard hit/miss/insight semantics. Worth a preview annotation explaining the color choice.

### Recruit - HI tail on success-by-type (Apprentice, Conscript, Convert)

- **Code location**: `lib/roll-helpers.ts:691-711`.
- **Coverage gap**: Preview L800 shows Cohort + HI tail. Code attaches the same `insightTail` to ALL four success types (Apprentice / Conscript / Convert / Cohort). Preview is missing the HI tail variant for Apprentice, Conscript, and Convert (and the LI tail on every success type - LI on success is possible because the dice outcome stored in `damage_json.rollOutcome` is independent of the recruit-type tag). Six potential missing rows.

### Upkeep - WS variant text drift

- **Code location**: `lib/roll-helpers.ts:561`.
- **Code returns** (WS or HI): `${r.character_name} tunes up their ${wName}${outcomeTag}` - on WS this becomes `Cree Hask tunes up their Sniper's Rifle and was wildly successful`.
- **Preview** (`tasks/roll-feed-log-preview.html:840`): `Cree Hask tunes up their Sniper's Rifle and was wildly successful` ✓ MATCHES.
- **Coverage gap**: NO drift. WS and HI use the same base sentence with different tails; preview shows both. ✓

### Vehicle Mounted-Weapon DF (with target) - no outcomeTag

- **Code location**: `lib/roll-helpers.ts:770, 781`.
- **Code**: DF outcome on FIRE returns `FIRE ${crew} misfires ${vehicle}'s ${weapon} catastrophically` - no `${outcomeTag}` appended (intentional - the "catastrophically" carries the dire-fail intensity).
- **Preview** (`tasks/roll-feed-log-preview.html:856, 905, 912`): all three rows match exactly ✓.
- **Status**: NO DRIFT. Intentional asymmetry: DF on mounted-weapon doesn't get "and failed miserably" because the bespoke wording covers it. Mirrors First Impression's Wild Success / Dire Failure no-tag treatment.

### Heal-by-hand (naked Medicine*) - HI/WS/DF/LI variants

- **Code location**: `lib/roll-helpers.ts:484-489`.
- **Coverage gap**: Preview L823 shows only the plain Success `HEAL Junie treats Marv by hand` variant for the naked-Medicine kit. Missing: WS (`HEAL Junie expertly treats Marv by hand with exceptional care`), HI (`HEAL Junie expertly treats Marv by hand and has a Moment of Insight as to why it went so well`), Failure (`HEAL Junie fails to make progress treating Marv` - same as kitted Failure because the kit phrase isn't in the fail copy), DF, LI. The kitted preview rows (L820-822, L824-826) cover all six outcomes for kit-based healing but the naked branch has only one row.

### Pass-through outcomes (wound_infection_warning, weapon_malfunction, advantage_used, pending_heal)

- **Code location**: `lib/roll-helpers.ts:77, 80, 90, 496-498`.
- **Coverage gap**: All four outcomes return the label verbatim. Preview shows ONLY pending_heal (L827-828 "Treatment applied: ..."). Missing preview rows:
  - `wound_infection_warning` - format per `app/stories/[id]/table/page.tsx` is the full sentence (e.g. "Cree Hask has taken a wound that may become infected - Wound Infection check pending"). No preview row.
  - `weapon_malfunction` - Low Insight on non-Unarmed weapon. Label is the full sentence (e.g. "Cree Hask's Pistol jams"). No preview row.
  - `advantage_used` (C3 share) - label format `"X used their +N <skill> advantage (<description>)"`. No preview row.
- **Severity**: medium. These are real live feed rows and the preview is supposed to be the canonical visual reference - missing them means future audits can't validate them.

### Attack-weapon "Fully Absorbed by Defense" - only one preview row

- **Code location**: `lib/roll-helpers.ts:345-350`.
- **Coverage gap**: Code returns `${r.character_name}'s ${weaponLabel} attack was deflected by ${r.target_name}${outcomeTag}` for ANY hit (Success / Wild Success / High Insight) where damage_json shows `finalWP === 0 && finalRP === 0`. Preview L653 shows only the plain Success variant `Ivan Hayes' Hatchet attack was deflected by Cree Hask`. Missing: WS, HI variants with the appropriate tail. Two missing rows.

### Cell-target explosive - no preview

- **Code location**: `lib/roll-helpers.ts:309-313`.
- **Coverage gap**: When an explosive (Grenade / Molotov / Shiv-Bang etc.) is thrown at a cell (target name matches `/^Cell\s*\(/`), code returns `${r.character_name} ${verb} ${article} ${weapon}` (drops the "at <target>" clause entirely). Preview L679 shows `Wilson threw a Grenade` which matches the cell-target output ✓. (Originally listed as a gap; on close read the preview row IS the cell-target variant. NO drift.)

### Stress (mortal/incap) - all outcomes are 'stress' pass-throughs

- **Code location**: `lib/roll-helpers.ts:651-659`.
- **Coverage gap**: Code parses `😰 <name> gains a Stress from being <reason>` → `${name} is ${reason}`. Preview L794-795 shows two examples (Mortally Wounded by ..., Incapacitated by ...). ✓ Coverage is complete for the live cases.

---

## Missing-code entries (preview shows narrative but no code branch produces it)

None. Every preview row maps to either:
1. A `compactRollSummary` branch in `lib/roll-helpers.ts` (most rows).
2. A bespoke banner renderer in `components/RollsFeed.tsx` (Combat Start/End, Initiative, Drop, Defer, Sprint, Death, Incap, Revive, Gather/Clothed/Morale/Retention, Group Check, Coordinated Effort Tier A, Stress mortal/incap).
3. A direct system-row emit (loot, CDP, encumbrance, rations, subsistence, evolution, pending_heal, gather_materials).

---

## Clean branches (audited, no drift)

- Aim action (`lib/roll-helpers.ts:209` ↔ `tasks/roll-feed-log-preview.html:631`).
- Move action (L215 ↔ L632).
- Ready Weapon / Switch / Reload / Unequip / Defend / Take Cover / Reposition (L229-251 ↔ L633-640).
- Cover Fire / Inspire social actions (L276-281 ↔ L643-644).
- Attack-weapon (Pistol) - all 5 outcomes covered: S, WS, HI, F, LI (L296-356 ↔ L648-652).
- Charge - 2 variants covered: Successful with weapon, Unsuccessful Unarmed (L323-328 ↔ L656-657).
- Subdue - WS and HI shown (L356 ↔ L660-661).
- Unarmed - S, HI bespoke, F (L372-379 ↔ L664-666).
- Distract - all 6 outcomes match exactly (L264-269 ↔ L669-674).
- Explosives - Molotov-at-target, Grenade-at-cell, RPG-Launcher-at-target (L304-314 ↔ L678-680).
- Rapid Fire / Fire from Cover (L360 ↔ L683-685).
- First Impression - all 6 outcomes match exactly including the kept-on-purpose bespoke HI/LI tails (L607-642 ↔ L690-695).
- Infection Check - 5 base outcomes (4 fail kinds + 1 wound shrug) match exactly (L189-202 ↔ L708-712). HI/LI/WS/DF tail variants missing in preview but code output is correct.
- Lasting Damage Check - 2 base outcomes match exactly (L134-151 ↔ L715-716).
- Stress Check mid-play - all 6 outcomes match exactly (L416-422 ↔ L770-775).
- Stress Check at-max - all 6 outcomes match exactly (L401-407 ↔ L778-783).
- Stabilize - all 6 outcomes match exactly including HI bespoke "while doing so" tail (L434-441 ↔ L786-791).
- Heal (kitted) - all 6 outcomes match exactly (L483-490 ↔ L820-826).
- Unjam - all 6 outcomes match exactly (L526-533 ↔ L811-816).
- Repair - all 6 outcomes match exactly (L543-550 ↔ L832-837).
- Upkeep - all 6 outcomes match exactly (L561-566 ↔ L840-845).
- Drive - all 6 outcomes match exactly (L795-802 ↔ L869-874).
- Brew - all 9 outcomes (6 with-room + 3 already-full) match exactly (L820-844 ↔ L878-887). Note: Brew already-full Failure/DF/LI rows aren't shown in preview because the failure-path returns the same "no fuel produced" text regardless of starting tank state, and L838-844 falls through to it.
- Navigate - all 6 outcomes match exactly (L854-862 ↔ L891-896).
- Mounted-Weapon FIRE (with target) - all 6 outcomes match exactly (L765-772 ↔ L901-906).
- Mounted-Weapon FIRE (no target) - all 6 outcomes match exactly (L776-783 ↔ L908-913).
- Grapple - all 3 custom outcomes covered (L578-582 ↔ L721-723).
- Loot - 4 variants (corpse-found, corpse-nothing, object-found, object-nothing) match exactly (L871-880 ↔ L922-925).
- Barter - matches (L893-898 ↔ L928).
- CDP award - matches (L909-910 ↔ L931).
- Encumbrance tick - all 3 list-length variants (1, 2, 3+) match exactly (L919-931 ↔ L934-936).
- Evolution - matches (L727-745 ↔ L949).
- Generic skill check - all 6 outcomes match exactly (L951-960 ↔ L1007-1011).
- Attribute check - all 6 outcomes with ATTRIBUTE CHECK prefix match exactly (L961-983 ↔ L1014-1019).
- Recruit success (Cohort) + HI tail (L693-710 ↔ L799-800).
- Recruit success (Conscript / Convert / Apprentice) base lines (L706-709 ↔ L801-803).
- Recruit failure tiers - Failure / Dire Failure / Low Insight (L671-682 ↔ L804-806).
- Coordinated Effort legacy single-row - all 6 outcomes match exactly (L508-517 ↔ L757-762).
- Coordinated Effort Tier A banner - all 6 outcomes match exactly (`components/RollsFeed.tsx:793-807` ↔ preview L732-752).
- Pending heal "Treatment applied" pass-through (L496-498 ↔ L827-828).
- Stress mortal/incap pass-through (L651-659 ↔ L794-795).

---

## Recommended ship order

1. **Gather Materials em-dash fix in preview HTML** (severity: high, effort: 2 min) - Edit `tasks/roll-feed-log-preview.html:917-918`, replace the U+2014 character with ASCII `-`. Direct rule violation; one-line fix.

2. **Stale code comment for gather_materials** (severity: low, effort: 2 min) - Update the doc-comment at `lib/roll-helpers.ts:91-92` and `lib/roll-outcomes.ts:88-91` to reflect the actual emit format (`"<vehicle> stockpile updated - gathered 1 day of brewing materials (now N/M)"`). No runtime impact.

3. **Add preview rows for pass-through outcomes** (severity: medium, effort: 15 min) - Add example rows in `tasks/roll-feed-log-preview.html` for `wound_infection_warning`, `weapon_malfunction`, `advantage_used`. Grep emit sites in `app/stories/[id]/table/page.tsx` for canonical label text.

4. **Add preview rows for unified-coordinate emoji-strip** (severity: medium, effort: 10 min) - Add an example row showing the `<name> Successfully coordinated an attack against <target> with <allies>` narrative under the Coordinated Effort section. Currently no preview example for this live emit path.

5. **Fill in tail-variant coverage for high-traffic checks** (severity: low-medium, effort: 25 min) - Add HI / LI / WS / DF variants to Perception, Gut Instinct, Lasting Damage Check, Infection Check (Sickness-Shrug + HI/LI tails on the four kind/severity bases), Recruit-by-type (Apprentice / Conscript / Convert HI tails), Heal-by-hand (WS / HI / DF / LI), Attack-deflected (WS / HI). Total ~24 missing rows; each is one line of HTML copy-pasted from the existing pattern. These are passive omissions not bugs but they're what `tasks/roll-feed-log-preview.html` is supposed to give you - a 6-outcome ladder per check.

6. **Decide on Coordinate-(vs-target) legacy branch** (severity: low, effort: depends) - Either (a) document it in preview as a legacy-only narrative path and add the two rows it produces, or (b) grep the live roll_log to confirm no rows still match `Coordinate (vs ...)` label format and delete `lib/roll-helpers.ts:445-450`. Tilts toward (b) if zero hits.

7. **Lasting-Wound effect-text reconciliation** (severity: low, effort: 15 min once located) - Determine whether `Skittish` should read "(-1 Initiative Modifier)" (preview L716, LDC row) or "(-1 CMod on initiative rolls)" (preview L717, post-LDC announcement). Source-of-truth lives in `lib/wounds.ts` (or wherever the wound catalog is); the two emit sites should consult the same field.

Total estimated effort if all addressed: ~75 minutes. None of these block the current Monday playtest; #1 and #3 are the highest-value cleanups before that since they're either a project-rule violation or live narrative paths missing reference rows.
