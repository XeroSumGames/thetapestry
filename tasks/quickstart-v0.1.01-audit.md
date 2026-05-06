# Distemper Quickstart Export v0.1.01 — full audit

**Source PDF**: `Distemper Quickstart Export v0.1.01.pdf` (16 MB, 23 pages)
**Reference SRD**: `XSE SRD Export v1.1.17.pdf`
**Canonical schema**: `lib/xse-schema.ts` (the platform — wins all conflicts)

**Precedence rule (locked)**: **Tapestry > SRD > Quickstart > Core Rulebook**.
Anything in the Quickstart that isn't in the platform schema or the SRD gets deleted, not preserved.

**Methodology**: I built the canonical reference from `lib/xse-schema.ts` (skills, professions, complications, motivations, paradigms, weapons, equipment, lasting wounds, breaking point, backstory steps, secondary-stat formulas) and the `app/rules/*` pages (combat actions, range bands, prose), THEN read the Quickstart looking for deviations. Every replacement skill, paradigm, profession bundle, table value below is verbatim from the platform schema.

---

# Section A — Canonical reference (the platform schema)

For convenience, here is the platform's 29-skill list as it should appear in the Quickstart:

| Skill | Category | Attribute | Vocational |
|---|---|---|---|
| Animal Handling | Sway | INF | – |
| Athletics | Innate | PHY | – |
| Barter | Sway | INF | – |
| Demolitions* | Combat | PHY | ✓ |
| Driving | Mechanic | DEX | – |
| Entertainment | Sway | INF | – |
| Farming | Knowledge | ACU | – |
| Gambling | Knowledge | ACU | – |
| Heavy Weapons* | Combat | PHY | ✓ |
| Inspiration | Sway | INF | – |
| Lock-Picking* | Criminal | ACU | ✓ |
| Manipulation | Sway | INF | – |
| Mechanic* | Mechanic | RSN | ✓ |
| Medicine* | Medicine | RSN | ✓ |
| Melee Combat | Combat | PHY | – |
| Navigation | Innate | ACU | – |
| Psychology* | Knowledge | RSN | ✓ |
| Ranged Combat | Combat | DEX | – |
| Research | Knowledge | RSN | – |
| Scavenging | Innate | ACU | – |
| Sleight of Hand | Criminal | DEX | – |
| Specific Knowledge | Knowledge | RSN | – |
| Stealth | Criminal | PHY | – |
| Streetwise | Innate | ACU | – |
| Survival | Innate | ACU | – |
| Tactics* | Knowledge | RSN | ✓ |
| Tinkerer | Mechanic | DEX | – |
| Unarmed Combat | Combat | PHY | – |
| Weaponsmith* | Mechanic | DEX | ✓ |

> Note: the platform's `Psychology*` is RSN-attributed, not INF as the Quickstart's inner-cover skill list shows. Verify against `lib/xse-schema.ts:97` if uncertain.

## Skills currently in the Quickstart that AREN'T on the platform

These are the deletions. Anywhere they appear in the Quickstart, replace per the right-hand column:

| Quickstart skill | Replace with |
|---|---|
| Intimidation | Manipulation (or Psychology* if the context is reading/exploiting) |
| Hunting | Survival (for tracking/wilderness) or Ranged Combat (for shooting game) |
| First Aid | Medicine* |
| Surgery* | Medicine* |
| Pharmacology* | Medicine* |
| Vehicle Repair* | Mechanic* |
| Armorsmith* | Mechanic* |
| General Knowledge | Specific Knowledge |

## Skills that aren't yet in the Quickstart but should be added

- **Driving** (DEX, non-vocational)
- **Gambling** (ACU, non-vocational)
- **Heavy Weapons*** (PHY, vocational)
- **Mechanic*** (RSN, vocational — replaces 4 Quickstart skills)
- **Medicine*** (RSN, vocational — replaces 3 Quickstart skills)
- **Specific Knowledge** (RSN, non-vocational)
- **Streetwise** (ACU, non-vocational)

---

# Section B — Page 18 Profession → Vocational Skills table (full rewrite)

The Quickstart's Profession bundles list 7 skills each. The platform has 5. Both the count and the contents differ. Replace the entire **PROFESSIONS & VOCATIONAL SKILLS** block on page 18 with the canonical platform bundles below (verbatim from `lib/xse-schema.ts:157–170`):

| Profession | Skills (5 each) |
|---|---|
| **Academic** | Mechanic\*, Psychology\*, Research, Specific Knowledge, Tactics\* |
| **Driver** | Animal Handling, Driving, Lock-Picking\*, Mechanic\*, Navigation |
| **Entrepreneur** | Barter, Gambling, Inspiration, Manipulation, Research |
| **Law Enforcement** | Athletics, Ranged Combat, Streetwise, Survival, Tactics\* |
| **Mechanic** | Barter, Demolitions\*, Mechanic\*, Scavenging, Tinkerer |
| **Medic** | Manipulation, Medicine\*, Psychology\*, Research, Sleight of Hand |
| **Military** | Demolitions\*, Heavy Weapons\*, Ranged Combat, Tactics\*, Unarmed Combat |
| **Outdoorsman** | Animal Handling, Navigation, Ranged Combat, Stealth, Survival |
| **Outlaw** | Gambling, Lock-Picking\*, Sleight of Hand, Stealth, Streetwise |
| **Performer** | Athletics, Entertainment, Inspiration, Manipulation, Specific Knowledge |
| **Politician** | Inspiration, Manipulation, Psychology\*, Streetwise, Tactics\* |
| **Trader** | Barter, Scavenging, Sleight of Hand, Specific Knowledge, Tinkerer |

Knock-on: the **Step Four CDP allocation** (page 18 body and summary box) currently says "allocate 4 CDP to any of the vocation skills" in the summary box, which is correct. But the body still has stale references:

**FROM (page 18 body):**

> If none of the listed Professions align with your vision, you can create a custom profession by allocating 7 CDP on the skills that match the idea you have in mind.

**TO:**

> If none of the listed Professions align with your vision, you can create a custom profession by allocating 4 CDP on the skills that match the idea you have in mind.

---

# Section C — Paradigm list cleanup (page 24 + sheets on pages 26–27)

The Quickstart lists **16 Paradigms**; the platform has **12**. Per Tapestry > Quickstart, the four paradigms not on the platform should be removed, and three names need correcting.

## Paradigms on the platform (canonical, from `lib/xse-schema.ts:325–566`)

| Paradigm | Profession |
|---|---|
| School Teacher | Academic |
| Biker | Driver |
| Bar Owner | Entrepreneur |
| Rural Sheriff | Law Enforcement |
| Hot Rod Mechanic | Mechanic |
| EMT | Medic |
| Farmer | Outdoorsman |
| Petty Criminal | Outlaw |
| Mercenary | Military |
| Preacher | Performer |
| **Small Town Mayor** | Politician |
| **Antiques Dealer** | Trader |

## Quickstart Paradigms to DELETE (not on platform)

- **Beat Cop** — overlaps with Rural Sheriff (Law Enforcement). Delete.
- **Cosmetic Surgeon** — not on platform (the Medic-profession Paradigm is EMT). Delete the entire Cosmetic Surgeon stat block on page 26.
- **Family Doctor** — appears in the page-24 list of Paradigms but no matching stat block exists. Delete from the list.
- **Flea Market Trader** — overlaps with Antiques Dealer (Trader). Delete.
- **Semi-Pro Athlete** — not on platform. Delete.
- **Trucker** — not on platform. Delete.

## Quickstart Paradigm to RENAME

- **Mayor** → **Small Town Mayor** (per `lib/xse-schema.ts:530`)

## Page 24 Paradigm-list paragraph

**FROM:**

> The Paradigms included are: Bar Owner, Beat Cop, Biker, EMT, Family Doctor, Farmer, Flea Market Trader, Hot Rod Mechanic, Mayor, Mercenary, Petty Criminal, Preacher, Rural Sheriff, School Teacher, Semi-Pro Athlete and Trucker.

**TO:**

> The Paradigms included are: Antiques Dealer, Bar Owner, Biker, EMT, Farmer, Hot Rod Mechanic, Mercenary, Petty Criminal, Preacher, Rural Sheriff, School Teacher, and Small Town Mayor.

## Page 13 Paradigms blurb

**FROM:**

> If you prefer to quickly jump into the game without much preparation, you can choose from the dozen available Paradigms (see page 24).

**TO:** unchanged ("dozen" = 12, which now matches).

## Page 24 Paradigm count

**FROM:**

> For those wishing to just get into the thick of the action, there are 16 Paradigms included that ,with a minimum of customization, can be played almost immediately.

**TO:**

> For those wishing to just get into the thick of the action, there are 12 Paradigms included that, with a minimum of customization, can be played almost immediately.

(Also fixes the misplaced space before the comma.)

## Each remaining Paradigm sheet on pages 26–27 needs a skill rewrite

Every Paradigm sheet currently contains skills not on the platform (Intimidation, Hunting, First Aid, Surgery\*, Pharmacology\*, Vehicle Repair\*, Armorsmith\*, General Knowledge). The canonical skill load-out for each of the 12 Paradigms is in `lib/xse-schema.ts:325–566` — match each sheet's SKILLS line to the canonical entries there. RAPID values, weapons, and equipment for each Paradigm are also in the schema and should be checked against the printed sheet.

---

# Section D — Editorial placeholders left in document

Two literal "REWRITE" headings appear in the printed Quickstart. They are unmissable. Both must be replaced.

## D1. Page 31 — "REWRITE NEGOTIATIONS" heading

**Issue**: line 1014 of the extracted text has an actual heading that reads:

> **REWRITE NEGOTIATIONS**

This is an editorial leftover. Either:
- (a) **Delete the entire Negotiations section** if you decide to drop Negotiations as a Distemper extension (the platform doesn't model them), or
- (b) **Restore the heading to "NEGOTIATIONS"** and continue with the Distemper Negotiations mechanic.

If keeping (b), the Gambit and Rebuttal skill lists in the body need cleanup (Intimidation removed):

**FROM (Making A Gambit):**

> ...by making an Influence, Barter, Entertainment, Inspiration, Intimidation, Manipulation or Psychology* check, depending on the situation, their approach, and the desired outcome.

**TO:**

> ...by making an Influence, Barter, Entertainment, Inspiration, Manipulation or Psychology* check, depending on the situation, their approach, and the desired outcome.

**FROM (Making A Rebuttal):**

> A Rebuttal check uses Acumen or any skill that matches the tone of their response. This could be Barter, Inspiration, Intimidation, Manipulation, Psychology*, or Tactics*, all depending on the situation.

**TO:**

> A Rebuttal check uses Acumen or any skill that matches the tone of their response. This could be Barter, Inspiration, Manipulation, Psychology*, or Tactics*, all depending on the situation.

## D2. Page 33 — "REWRITE RANGE" heading

**Issue**: line 1145 of the extracted text has an actual heading that reads:

> **REWRITE RANGE**

The body text below it correctly describes the Range section (Engaged, Close, Medium, Long, Distant). Just restore the heading.

**FROM:**

> REWRITE RANGE

**TO:**

> RANGE

The body's movement-between-bands list still has the broken numbers from the earlier version (1+3+6+10 ≠ 15):

**FROM:**

> This means it takes:
>
>   � 1 round to move from Engaged to Close
>   � 3 rounds to go from Close to Medium
>   � 6 rounds to go from Medium to Long
>   � 10 rounds to go from Long to Distant
>   � 15 rounds to go from Engaged to Distant.

**TO:**

> Moving between bands takes the same number of combat rounds as the sum of the band values being covered, including the band you start in and the band you arrive at. This means it takes:
>
>   � 3 rounds to move from Engaged to Close
>   � 6 rounds to move from Engaged to Medium
>   � 10 rounds to move from Engaged to Long
>   � 15 rounds to move from Engaged to Distant

(Per `app/rules/combat/range/page.tsx` and SRD §06.)

---

# Section E — Page-by-page rules deviations (FROM/TO)

Ordered by page number. Items already shipped correctly in v0.1.01 (e.g., 20 CDP total, AMod cap fix, Get The Drop -2, Incapacitation 4-PHY, Stress Modifier line on p.20) are not listed here.

## E1. Credits (page 1) — version mismatch

The cover and folder title both say v0.1.01 but the credits block reads:

**FROM:**

> CREDITS V0.8.531

**TO:**

> CREDITS V0.1.01

## E2. Page 8 — "ROLL MODIFIERS" intro paragraph

The "range of somewhere between -3 and +5" line is wrong — that's neither AMod, SMod, nor CMod range. AMods are -2 to +4; SMods are -3 to +4; CMods are -5 to +5.

**FROM:**

> Each dice check can have up to 3 different Modifiers that are added or subtracted to the result of the 2d6 roll. These modifiers are for Attributes, Skills, and Conditions, each of which has a range of somewhere between -3 and +5.

**TO:**

> Each dice check can have up to 3 different Modifiers that are added or subtracted to the result of the 2d6 roll. These modifiers are for Attributes (-2 to +4), Skills (-3 to +4), and Conditions (-5 to +5).

## E3. Page 13 — "RAPID Range Modifiers" paragraph (still has Lame/Animalistic in inner blurb)

**FROM:**

> Although RAPID Range attributes start at -2 (Lame) and go to 5 (Animalistic), 0 is Average, and is the starting value for all characters.

**TO:**

> Although RAPID Range attributes for player characters start at -2 (Diminished) and go up to +4 (Human Peak), 0 is Average and is the starting value for all characters. Animals and machines may reach +5 (Superhuman).

(Already fixed in the page 8 paragraph — fix the page 13 instance to match.)

## E4. Page 18 — Step Four Pesky-example body still has stale "7 CDP"

**FROM:**

> Choosing Outlaw as his Profession, he gets 7 CDP to spend on raising skills. He spends 2 points on both Lock-Picking* and Stealth, and then an additional point in Intimidation, Manipulation, and Unarmed Combat.

**TO (note: also drops Intimidation since it's not a platform skill):**

> Choosing Outlaw as his Profession, he gets 4 CDP to spend on raising skills. He spends 1 point each on Lock-Picking*, Sleight of Hand, Stealth, and Streetwise.

(This makes Pesky's Outlaw spend match the canonical Outlaw profession bundle: Gambling, Lock-Picking\*, Sleight of Hand, Stealth, Streetwise. He'll need to drop the Intimidation/Manipulation/Unarmed Combat picks, which were chosen from a different — non-platform — profession bundle.)

## E5. Page 18 — Pesky's Step Three body uses Intimidation

**FROM:**

> Pesky puts 1 Character Development Point towards Influence, raising it to 1 (Good) and spends one of his 4 Character Development Points on getting another level in Manipulation to take it to 2 (Journeyman), and 3 points on getting 1 (Beginner) in Intimidation, Melee Combat, and Unarmed Combat

**TO (note: 4 CDP → 3 CDP for Step Three; replace Intimidation with another skill that fits Pesky):**

> Pesky puts 1 Character Development Point towards Influence, raising it to 1 (Good) and spends one of his 3 Character Development Points on getting another level in Manipulation to take it to 2 (Journeyman), then takes 1 (Beginner) in Melee Combat and Unarmed Combat.

(Also fixes missing terminal period.)

## E6. Page 18 — "After these steps, Pesky LaRue..." Step 3 summary

**FROM:**

> After these steps, Pesky LaRue has gone from a RAPID Range of 00000 and no skills to a RAPID Range of 01011. He has the following Skills: Athletics 2, Barter 1, Intimidation 1, Manipulation 2, Melee Combat 1, Sleight of Hand 2, and Unarmed Combat 1

**TO:**

> After these steps, Pesky LaRue has gone from a RAPID Range of 00000 and no skills to a RAPID Range of 01011. He has the following Skills: Athletics 2, Barter 1, Manipulation 2, Melee Combat 1, Sleight of Hand 2, and Unarmed Combat 1.

(Drop Intimidation; add terminal period.)

## E7. Page 19 — Final Pesky skill summary

**FROM:**

> After these first five steps, Pesky LaRue has gone from a RAPID Range of 00000 and no skills to a RAPID Range of 02111 and the following skills: Manipulation 3, Athletics 2, Intimidation 2, Lock-Picking* 2, Melee Combat 2, Sleight of Hand 2, Stealth 2, Unarmed Combat 2, Barter 1, Scavenging 1, and Survival 1.

**TO (re-budgeted to 15 skill CDP, no Intimidation):**

> After these first five steps, Pesky LaRue has gone from a RAPID Range of 00000 and no skills to a RAPID Range of 02111 and the following skills: Manipulation 3, Lock-Picking* 2, Melee Combat 2, Sleight of Hand 2, Stealth 2, Athletics 1, Streetwise 1, Survival 1, and Unarmed Combat 1.

> User said exclude Pesky character-sheet edits — but his skill-summary paragraphs in the body are how the rules walkthrough plays out and contain non-platform skills. Flagging here in case you want them included in the rewrite.

## E8. Page 20 — Step Seven body and summary box still describe Panic Threshold

**FROM (in Step Seven body — the third paragraph from top of right column):**

> some other impact on gameplay, such as how much weight the character can carry (Encumbrance), their Panic Threshold, their Breaking Point, and their Morality score.

**TO:**

> some other impact on gameplay, such as how much weight the character can carry (Encumbrance), their Stress Level and Breaking Point, and their Morality score.

**FROM (Step Seven summary box on right column):**

> Panic Threshold (PT): Each character has a Panic Threshold that is half of their original Resilience Point total,rounded down

**TO:**

> Stress Modifier (SM): Reason AMod + Acumen AMod. Added to Stress Checks at the end of brutal scenes.

(Per `lib/xse-schema.ts` deriveSecondaryStats and `app/rules/character-overview/secondary-stats/page.tsx` — Panic Threshold doesn't exist as a stat on the platform; Stress Modifier replaces it.)

## E9. Page 20 — Apostrophe error on Defensive Modifiers (× 2)

**FROM:**

> Defensive Modifiers (DM): A characters' Melee Defensive Modifier is their Physicality AMod
>
> A characters' Ranged Defensive Modifier is their Dexterity AMod

**TO:**

> Defensive Modifiers (DM): A character's Melee Defensive Modifier is their Physicality AMod.
>
> A character's Ranged Defensive Modifier is their Dexterity AMod.

(Singular character takes `character's`, not `characters'`. Also adds terminal periods.)

## E10. Page 30 — duplicate "First Impressions check" sentence (unmerged edits)

The page has TWO consecutive paragraphs describing the First Impressions check, with different skill lists:

**FROM:**

> A First Impressions check uses Influence and any appropriate skill, such as Inspiration, Manipulation, or Psychology*, with the players Filling in the Gaps as to the specifics of their attempt and what they are saying.
>
> A First Impressions uses Influence, Inspiration, Intimidation, or Manipulation, with the players Filling in the Gaps as to the specifics of their attempt and what they are saying.

**TO** (delete the second paragraph entirely; the first one is canonical, except drop "Inspiration" too — per platform `app/rules/core-mechanics/first-impressions/page.tsx`, the canonical skills are "Manipulation, Streetwise, Psychology\*"):

> A First Impressions check uses Influence and any appropriate skill, such as Manipulation, Psychology\*, or Streetwise, with the players Filling in the Gaps as to the specifics of their attempt and what they are saying.

## E11. Page 33 — Stabilize check still uses First Aid / Surgery\*

**FROM:**

> A Mortally Wounded character can be Stabilized with a Successful First Aid or Surgery* check, or by achieving a Wild Success on a Reason check.

**TO:**

> A Mortally Wounded character can be Stabilized with a Successful Medicine* check, or by achieving a Wild Success on a Reason check.

## E12. Page 34 — Distract Combat Action references Intimidation

**FROM:**

> DISTRACT: A Successful Intimidation, Psychology* or Tactics* check Distracts a target who then loses one of their next Combat Actions.

**TO:**

> DISTRACT: A Successful Manipulation, Psychology* or Tactics* check Distracts a target who then loses one of their next Combat Actions.

## E13. Page 33 — Mortally Wounded "to the GM," stray comma before parenthesis

**FROM:**

> the only way to prevent a character who wasn't Stabilized from subsequently Dying, is if the player surrenders all of their Insight Dice to the GM, (assuming that the player has at least one Insight Dice).

**TO:**

> the only way to prevent a character who wasn't Stabilized from subsequently Dying is if the player surrenders all of their Insight Dice to the GM (assuming that the player has at least one Insight Dice).

(Drops both stray commas — the one separating the subject from the verb, and the one before the open parenthesis.)

## E14. Page 11 — Opposed Checks heading typo

**FROM:**

> There are times when characters might need to make an Opposing Check to quantify their response to the situation

**TO:**

> There are times when characters might need to make an Opposed Check to quantify their response to the situation

---

# Section F — Inner-cover Rules Reference (pages 38–39) — wholesale rewrite

Per your instruction: rewrite ALL boxes. Below are the canonical replacements for every box on the inner cover. Every term, formula, and skill list comes from `lib/xse-schema.ts` and the SRD.

## Box 1 — DICE CHECKS

> All attribute or skill checks require a total of 9 or above to be Successful.
>
> The format is:
>
>     2d6 + Attribute Modifier (AMod)
>          Add the relevant Reason, Acumen, Physicality, Influence, or
>          Dexterity AMod, for a range of -2 (Diminished) to +4 (Human Peak).
>
>        + Skill Modifier (SMod)
>          Add the relevant skill SMod, for a range of -3 (Inept) to +4 (Life's Work).
>          Starting characters are capped at +3 (Professional).
>
>        + Conditional Modifier (CMod)
>          For external influences or unexpected factors, ranging from
>          -5 to +5 at the GM's discretion.

## Box 2 — OUTCOMES

> | Roll | Result |
> |---|---|
> | 0–3 | Dire Failure |
> | 4–8 | Failure |
> | 9–13 | Success |
> | 14+ | Wild Success |
> | 1+1 | Moment of Low Insight |
> | 6+6 | Moment of High Insight |

## Box 3 — MODIFIERS

> **Attribute Modifiers (AMods):** All characters have 5 RAPID Range attributes (Reason, Acumen, Physicality, Influence, & Dexterity) ranging from -2 (Diminished) to +4 (Human Peak). This number is the AMod, added to any check using that Attribute.
>
> **Skill Modifiers (SMods):** Each character has skills with a SMod ranging from -3 (Inept) to +4 (Life's Work), added to any check using that skill. Vocational skills (marked with `*`) start at -3 (Inept); the first level taken jumps the skill straight to +1 (Beginner).
>
> **Conditional Modifiers (CMods):** Any dice roll can have a CMod from -5 to +5, added at the GM's discretion to reflect external factors influencing the dice check.

## Box 4 — MOMENTS OF INSIGHT

> A roll of double-one or double-six is a Moment of Low or High Insight. Regardless of any AMod, SMod, or CMods being applied to the roll, a double-one is always treated as a Dire Failure and a double-six is always treated as a Wild Success.
>
> The character also receives an Insight Die that can be used to affect the outcome of future dice checks.

## Box 5 — INSIGHT DICE

> Insight Dice allow players to affect dice rolls or other elements of gameplay in their favor. Each player starts the game with 2 Insight Dice and receives an additional Insight Die each time they roll a Moment of Insight.
>
> Common uses:
> - Roll an additional dice before a check, for a 3d6 dice pool.
> - Add a +3 Conditional Modifier to a check before rolling.
> - After a check, swap one or both rolled dice with an Insight Die rolled fresh, at the cost of one Insight Die per swap. (Cannot swap dice from a Moment of Low Insight — once 1+1 is rolled, it stands.)
> - "Bend reality" by allowing a player to find an unexpected clue or have a missing piece of equipment, on a successful Make The Case.
> - Instead of Dying, a character may surrender ALL of their Insight Dice to recover 1 Wound Point and 1 Resilience Point per dice surrendered.
>
> Insight Dice are non-transferable, do not transfer between characters, and carry over from session to session. Once used, they are surrendered back to the GM.

## Box 6 — FILLING IN THE GAPS

> Having players Fill in the Gaps about what their character is seeing or doing helps the GM ensure that the whole group contributes to the narrative. The GM may call upon players to provide details about what their character is seeing, hearing, or doing that flesh out the scene or actions for the rest of the group.

## Box 7 — GROUP CHECKS

> A group of players may elect to make a Group Check and pool their abilities so long as they are using the same Attribute or Skill.
>
> The player with the highest individual Attribute or Skill makes a dice check, factoring in AMods and SMods from the group members, and adding a +1 CMod for each person contributing. Insight Dice cannot be used during Group Checks.

## Box 8 — OPPOSED CHECKS

> If two characters are working against one another, an Opposed Check is used. Both characters make an Initiative check to see who goes first; the winner makes a dice check using the relevant attribute or skill, and the other side makes a responding check.
>
> Unlike most dice checks in Distemper, an Opposed Check relies purely on one side beating the score of the other. If there is no clear winner, the Opposed Check starts over.
>
> Moments of Insight still apply: a character who rolls a Moment of Low Insight automatically loses (unless the opponent also rolls a Moment of Low Insight), and a character who rolls a Moment of High Insight automatically wins (unless the opponent rolls the same). If both sides get a Moment of Insight, Initiative is re-rolled.

## Box 9 — SKILL LIST

Replace the existing skill list verbatim with the canonical 29-skill list. Format: `<Skill> [<Category>] (<Attribute>)`.

> Animal Handling [Sway] (INF)
> Athletics [Innate] (PHY)
> Barter [Sway] (INF)
> Demolitions* [Combat] (PHY)
> Driving [Mechanic] (DEX)
> Entertainment [Sway] (INF)
> Farming [Knowledge] (ACU)
> Gambling [Knowledge] (ACU)
> Heavy Weapons* [Combat] (PHY)
> Inspiration [Sway] (INF)
> Lock-Picking* [Criminal] (ACU)
> Manipulation [Sway] (INF)
> Mechanic* [Mechanic] (RSN)
> Medicine* [Medicine] (RSN)
> Melee Combat [Combat] (PHY)
> Navigation [Innate] (ACU)
> Psychology* [Knowledge] (RSN)
> Ranged Combat [Combat] (DEX)
> Research [Knowledge] (RSN)
> Scavenging [Innate] (ACU)
> Sleight of Hand [Criminal] (DEX)
> Specific Knowledge [Knowledge] (RSN)
> Stealth [Criminal] (PHY)
> Streetwise [Innate] (ACU)
> Survival [Innate] (ACU)
> Tactics* [Knowledge] (RSN)
> Tinkerer [Mechanic] (DEX)
> Unarmed Combat [Combat] (PHY)
> Weaponsmith* [Mechanic] (DEX)

(Note: Stealth's attribute on the platform is PHY, not DEX. Barter's category in the schema treats it as INF-attributed Sway. Verify against `lib/xse-schema.ts` if uncertain.)

## Box 10 — COMBAT ROUNDS

> Combat Rounds last 3-6 seconds, and consist of 3 phases: Initiative, Actions, Resolution.
>
> 1. Initiative: At the beginning of each round, all participants make an Initiative check (2d6 + Init Mod) to determine the order in which they act, going from highest to lowest, with draws taking place simultaneously. Anyone who was neither attacked nor attacked someone else gets a +1 to their next Initiative roll.
>
> 2. Actions: Each combatant gets two Combat Actions per round and may take the same action twice or choose two different actions.
>
> 3. Resolution: Certain actions, weapons, or effects will be resolved in this phase after all characters have taken their actions and before the round is complete.
>
> At the end of the Resolution phase, combat cycles to a new round and a fresh Initiative check.

## Box 11 — INITIATIVE

> An Initiative Check is:
>
>     2d6 + Dexterity AMod
>          + Acumen AMod
>          + CMods (where applicable)

(Drop the stray "+ Perception SMod" line that appears in v0.1.01. Initiative Mod is ACU + DEX, no Perception involvement, per `lib/xse-schema.ts:714`.)

## Box 12 — COMBAT ATTACKS

> Attack rolls, like all other checks, require a score of 9 or above to be successful. Attack rolls take the format:
>
>     2d6 + AMod
>           Physicality for Melee & Unarmed
>           Dexterity for Ranged
>         + SMod
>           Melee Combat, Ranged Combat, Unarmed Combat, or Demolitions*
>         + CMod as determined by the GM
>         + Any Weapon-specific Modifiers
>         - Target's Ranged or Melee Defensive Modifier

## Box 13 — COMBAT ACTIONS

Replace verbatim with canonical platform Combat Actions list (from `app/rules/combat/combat-rounds/page.tsx:16-34`):

> **Aim** (1): +2 CMod on the next Attack this round; lost if anything but Attack is taken next.
> **Attack** (1): Roll Unarmed, Ranged, or Melee Combat. Damage on success.
> **Charge** (2): Move + a melee/unarmed attack with a +1 CMod.
> **Coordinate** (1): Tactics\* check; allies in Close get +2 CMod vs target. On Wild Success, allies also get +1 CMod on their attack.
> **Cover Fire** (1): Expend ammo to suppress an attacker. Subjects take −2 CMod on their next attack, dodge, or move.
> **Defend** (1): +2 to MDM/RDM against the next attack on this character. Cleared after one hit.
> **Distract** (1): Steal 1 Combat Action from a target via an Opposed Check (skill or attribute as agreed). On Wild Success, steal 2 actions.
> **Fire from Cover** (2): Attack from cover; keep the cover's defensive bonus.
> **Grapple** (1): Opposed Physicality + Unarmed Combat. Winner restrains or takes 1 RP from the loser.
> **Inspire** (1): Grant +1 Combat Action to an ally. Once per round.
> **Move** (1): Move up to 1 Range Band per Move action.
> **Rapid Fire** (2): Two shots from a Ranged Weapon. −1 CMod on first, −3 CMod on second. As a single Combat Action: −2 first / −4 second.
> **Ready Weapon** (1): Switch, reload, or unjam a weapon.
> **Reposition** (1): End-of-round positioning move that doesn't trigger combat-action consumption checks.
> **Sprint** (2): Move 2 bands. Athletics check on completion or become Winded (1 action next round).
> **Subdue** (1): Non-lethal attack — full RP damage but only 50% WP damage.
> **Take Cover** (1): +2 Defensive Modifier against all attacks until the character takes an active combat action.

## Box 14 — FIRST IMPRESSIONS

> Characters meeting NPCs for the first time should see how they are being perceived by the NPC by making an Influence-based check using any appropriate skill (such as Manipulation, Psychology\*, or Streetwise), and Fill in the Gaps as to the specifics of what they are doing.
>
> If multiple characters encounter the NPC at the same time, they should make a Group First Impressions check.

## Box 15 — GUT INSTINCTS

> Characters can also gauge their Gut Instinct about an NPC by making a Perception check (Reason AMod + Acumen AMod), or substituting an appropriate skill such as Psychology\*, Streetwise, or Tactics\*.
>
> On a Success, the GM gives the player some insight as to what their take is. On a Failure, the GM may mislead them.

## Box 16 — STRESS & BREAKING POINT

(Replaces the v0.1.01 PANIC box, which uses Panic Threshold mechanics that no longer exist on the platform.)

> A character's Stress Level rises by 1 each time they fail a Stress Check, drop to 0 WP (Mortally Wounded), or drop to 0 RP (Incapacitated). Stress Modifier = Reason AMod + Acumen AMod.
>
> When Stress Level reaches 5, the character hits their Breaking Point. Roll 2d6 on Table 13: Breaking Point for the reaction (lasts 1d6 rounds). Stress resets to 0 once the reaction resolves.
>
> Stress drops by 1 for each 8 uninterrupted in-game hours spent free from combat, conflict, or threat while doing something the character enjoys.

(Full Table 13 lives on page 33; the inner cover need not duplicate it.)

## Box 17 — NEGOTIATIONS

If keeping Negotiations as a Distemper extension (Section D1 above):

> Negotiations are broken into Gambits & Rebuttals.
>
> A character or NPC states their offer or request by making an Influence, Barter, Entertainment, Inspiration, Manipulation, or Psychology\* check, and Filling in the Gaps. If the other side agrees to the request or demand, the Negotiation is over.
>
> On a Dire Failure, the Negotiation immediately falls apart.
> On a Failure, the other side gets a +1 CMod on their Rebuttal.
> On a Success, there is a -1 CMod to any Rebuttal.
> On a Wild Success, there is a -3 CMod to any Rebuttal.
>
> Once the other side has heard the opening Gambit, they offer their Rebuttal by making an Acumen, Barter, Manipulation, Psychology\*, Survival, or Tactics\* check.
>
> On a Dire Failure or Failure, there is no common ground but there is potential to have created an enormous amount of bad feeling.
> On a Success or Wild Success, the counter is met favorably and a deal or agreement can be reached.

(Charm, Deception, Intimidation, and Perception removed from skill lists — none of those are platform skills.)

If dropping Negotiations entirely, replace this box with:

> Extended back-and-forth social conflict uses Opposed Checks (see Box 8) with the relevant Sway-category skills (Animal Handling, Barter, Entertainment, Inspiration, Manipulation).

## Box 18 — ITEM UPKEEP

> Characters maintain weapons and equipment to ensure they continue to work. After prolonged or careless use, a character with at least 1 level in Mechanic\*, Tinkerer, or Weaponsmith\* can make an Upkeep Check.
>
> On a Success, the item stays at the same Condition.
> On a Failure, the item drops one level of Condition.
> On a Wild Success or Moment of High Insight, the Condition improves by 1 level (max Used).
> On a Dire Failure or Moment of Low Insight, the item is immediately Broken.
>
> Conditions ladder: Pristine (+1 CMod) → Used (0) → Worn (-1) → Damaged (-2) → Broken (unusable).

(Drops references to Vehicle Repair\* and Armorsmith\* — both consolidated into Mechanic\* on the platform.)

---

# Section G — Grammar, spelling, and consistency (separate from rules deviations)

These are non-rules editorial fixes. Many were flagged in the prior pass on v0.8.531 and persist in v0.1.01.

## G1. Page 1 — "Who Is Distemper For?"

**FROM:** "Distemper is a game for people that would prefer to explore"
**TO:** "Distemper is a game for people who would prefer to explore"

## G2. Page 1 — "The DistemperVerse" (×3 fixes in one section)

**FROM:** "comic-book stories in which the stories provide an ongoing"
**TO:** "comic-book stories that provide an ongoing"

**FROM:** "may be weaved into the developing tapestry"
**TO:** "may be woven into the developing tapestry"

**FROM:** "Instructions on how to submit your own stories, can be found"
**TO:** "Instructions on how to submit your own stories can be found"

## G3. Pages 2–5 — Timeline (×4 fixes)

**FROM:** "South Korean is quickly followed by many other countries"
**TO:** "South Korea is quickly followed by many other countries"

**FROM:** "It was noted than in his last moments"
**TO:** "It was noted that in his last moments"

**FROM:** "Another wave of riots swell throughout Europe"
**TO:** "Another wave of riots swells throughout Europe"

**FROM:** "A pair of nuclear explosion in Finland create a localized"
**TO:** "A pair of nuclear explosions in Finland creates a localized"

## G4. Page 8 — "Making A Dice Check"

**FROM:** "negotiating with an Non-Player Character"
**TO:** "negotiating with a Non-Player Character"

## G5. Page 8 — "Dice Terms"

**FROM:** "A single, six-side dice is referred to as d6"
**TO:** "A single, six-sided die is referred to as d6"

## G6. Page 9 — "Skill Modifiers (SMod):"

**FROM:** "denoted with an asterisks when written, such as Surgery\*, Mechanics\* or Demolitions\*"
**TO:** "denoted with an asterisk when written, such as Demolitions\*, Mechanic\*, or Psychology\*" (also fixes the skill examples to platform-canonical)

**FROM:** "This means means that someone with a Dexterity of 1"
**TO:** "This means that someone with a Dexterity of 1"

## G7. Page 10 — "Group Checks"

**FROM:** "A group take also takes any other group members'"
**TO:** "A group also takes any other group members'"

## G8. Page 10 — "Making The Case" example

**FROM:** "a character reasoning that because they grew up in East Texas that their native accent"
**TO:** "a character reasoning that, because they grew up in East Texas, their native accent"

## G9. Page 12 — "Character Sheet Overview" intro

**FROM:** "vital that each players has a clear understanding"
**TO:** "vital that each player has a clear understanding"

## G10. Page 12 — "Skills" body

**FROM (sheet with an asterisks ref):** "These skills are denoted on the character sheet with an asterisks, such as Surgery\*."
**TO:** "These skills are denoted on the character sheet with an asterisk, such as Lock-Picking\* or Medicine\*."

## G11. Page 12 — RAPID Range Attributes section letter overflow

**FROM:** "D4EXTERITY:" (with stray digit)
**TO:** "DEXTERITY:"

**FROM:** "A5dditionally, this section has a Rations tracker."
**TO:** "Additionally, this section has a Rations tracker."

## G12. Page 13 — "Paradigms" blurb

**FROM:** "such as a school teacher, a small town sheriff a biker, or a preacher"
**TO:** "such as a school teacher, a small town sheriff, a biker, or a preacher"

## G13. Page 15 — "Step Xero" body (×3 fixes)

**FROM:** "summarize you character to the group"
**TO:** "summarize your character to the group"

**FROM:** "depending on you preference"
**TO:** "depending on your preference"

**FROM:** "as you have already define"
**TO:** "as you have already defined"

## G14. Page 15 — Backstory bullet pronoun shift

**FROM:** "did you grow up in a circus where their ability to Entertain and Charm others was crucial"
**TO:** "did you grow up in a circus where your ability to Entertain and Charm others was crucial"

## G15. Page 15 — Redundant "three 3"

**FROM:** "Write the three 3 words under Personal Information"
**TO:** "Write the 3 words under Personal Information"

## G16. Page 16 — Pesky narrative

**FROM:** "as he was at shop-lifting food"
**TO:** "as he was at shoplifting food"

## G17. Page 17 — Pesky narrative

**FROM:** "took a liking to the young boy and helped him up his skills as a petty thief"
**TO:** "took a liking to the young boy and helped him hone his skills as a petty thief"

## G18. Page 18 — "in you life"

**FROM:** "during this time in you life"
**TO:** "during this time in your life"

## G19. Page 18 — Missing comma

**FROM:** "raising it to 2 (Strong), and 1 point into Physicality raising it to 1 (Good)"
**TO:** "raising it to 2 (Strong), and 1 point into Physicality, raising it to 1 (Good)"

## G20. Page 19 — Missing word

**FROM:** "finding what others have missed, as learning how to survive off the land"
**TO:** "finding what others have missed, as well as learning how to survive off the land"

## G21. Page 20 — Apostrophe missing

**FROM:** "and a characters Initiative Modifier (Init) influences"
**TO:** "and a character's Initiative Modifier (Init) influences"

## G22. Page 20 — Missing space after comma

**FROM:** "half of their original Resilience Point total,rounded down"
**TO:** "half of their original Resilience Point total, rounded down"

(Note: this line also needs Panic Threshold replaced with Stress Modifier per Section E8.)

## G23. Page 21 — "gallows humor" missing verb

**FROM:** "Your character might gallows humor and find laughter"
**TO:** "Your character might have a gallows humor and find laughter"

## G24. Page 24 — Skills intro run-on

**FROM:** "Skills denote training or aptitude at performing certain tasks, like picking a lock or riding a horse and a character's familiarity and aptitude in that area will affect their dice checks."
**TO:** "Skills denote training or aptitude at performing certain tasks, like picking a lock or riding a horse. A character's familiarity and aptitude in that area will affect their dice checks."

## G25. Page 24 — "anyone… are considered" + "an asterisks"

**FROM:** "anyone without that training are considered Inept and automatically incur a -3 SMod. These skills are denoted by an asterisks"
**TO:** "anyone without that training is considered Inept and automatically incurs a -3 SMod. These skills are denoted by an asterisk"

## G26. Page 24 — "Paradigms vs. Pregens"

**FROM:** "Paradigms represents a familiar trope, stereotype, or role within a group"
**TO:** "Paradigms represent a familiar trope, stereotype, or role within a group"

**FROM:** "give you a sense of who you character is"
**TO:** "give you a sense of who your character is"

**FROM:** "an easy jump off pointing while still allowing"
**TO:** "an easy jumping off point while still allowing"

## G27. Page 28 — "Starting Load-Out"

**FROM:** "Each character also get a Survival Kit containing a tent and sleeping bag, and 2 Rations, which is enough to keep them fed for 2 day."
**TO:** "Each character also gets a Survival Kit containing a tent and sleeping bag, and 2 Rations, which is enough to keep them fed for 2 days."

**FROM:** "Write of all this on your character sheet."
**TO:** "Write all of this on your character sheet."

## G28. Page 30 — Gut Instincts missing word

**FROM:** "Do they get a sense that this NPC be trusted?"
**TO:** "Do they get a sense that this NPC can be trusted?"

## G29. Page 31 — Missing terminal period

**FROM:** "they were unable to present a cogent argument and Negotiations are at an impasse"
**TO:** "they were unable to present a cogent argument and Negotiations are at an impasse."

## G30. Page 32 — Apostrophe error

**FROM:** "In a tie, PC's always beat NPCs"
**TO:** "In a tie, PCs always beat NPCs"

## G31. Page 32 — Missing apostrophe

**FROM:** "wait to see how other players actions are resolved"
**TO:** "wait to see how other players' actions are resolved"

## G32. Page 32 — Missing comma after long parenthetical

**FROM:** "or a character Repositioning) the Round is considered Resolved"
**TO:** "or a character Repositioning), the Round is considered Resolved"

## G33. Page 34 — Attack action sentence missing subject + period

**FROM:** "ATTACK: Any attack, Unarmed or with a Ranged or Melee Weapon. If this is used for both actions against the same target brings a +1 CMod to the second use as the first attack helped them narrow in on their target"
**TO:** "ATTACK: Any attack, Unarmed or with a Ranged or Melee Weapon. If this is used for both actions against the same target, it brings a +1 CMod to the second use, as the first attack helped them narrow in on their target."

## G34. Page 36 — Apostrophe placement

**FROM:** "A characters' strength (reflected in their Physicality AMod)"
**TO:** "A character's strength (reflected in their Physicality AMod)"

## G35. Page 37 — "Now What?"

**FROM:** "guides a new group though the basics of the game"
**TO:** "guides a new group through the basics of the game"

**FROM:** "the group should discuss the tone of game"
**TO:** "the group should discuss the tone of the game"

**FROM:** "or are they are more interested in role-playing"
**TO:** "or are they more interested in role-playing"

## G36. Page 39 — Comma splice in Insight Dice bullet

**FROM:** "Players cannot choose how many dice to use in this method, this costs all of their Insight Dice"
**TO:** "Players cannot choose how many dice to use in this method; this costs all of their Insight Dice."

## G37. Page 39 — Take Cover dangling fragment

**FROM:** "TAKE COVER: +2 Defensive Modifier against all incoming attacks during that round. on next attack"
**TO:** "TAKE COVER: +2 Defensive Modifier against all attacks until the character takes an active combat action."

(Also aligns Take Cover wording to the platform's canonical Combat Action description.)

## G38. Page 40 — Back cover

**FROM:** "take on the roles of a survivors who must navigate"
**TO:** "take on the roles of survivors who must navigate"

**FROM:** "Food, water, and shelter Food, water, and shelter are the most basic needs"
**TO:** "Food, water, and shelter are the most basic needs"

**FROM:** "recruit NPCs to you cause"
**TO:** "recruit NPCs to your cause"

**FROM:** "start you own religious sect"
**TO:** "start your own religious sect"

**FROM:** "transmitted by Man's Best Friend has wiped out 90% of humanity"
**TO:** "transmitted by Man's Best Friend — wiped out 90% of humanity"

(Removes the dangling subject; uses an em-dash to set off the parenthetical.)

---

# Section H — Style notes (consistency, no FROM/TO required)

These aren't errors but are worth one editorial pass:

1. **`whilst` vs `while`** — manuscript mixes both. Pick one.
2. **Collective-noun verb agreement** — "Berglund's research team are no closer..." (British plural) clashes with "a wave… swells" (American singular). Pick one.
3. **`any more` vs `anymore`** — Page 7. Modern American closes the form.
4. **Date-header capitalization on the timeline** — most are `MARCH 2ND` but a few are `MARcH 9Th`. Normalize.
5. **`Roleplaying` vs `Role-Playing`** — both forms appear. Pick one.
6. **`Initiative Roll` vs `Initiative Check`** — same thing in two phrasings. The platform uses "Initiative Check"; align Quickstart to match.
7. **`W.H.O.` vs `WHO`** — both forms appear on Pages 4–5. Pick one.
8. **`Insight Dice` used as both singular and plural** — appears throughout. Tabletop-jargon-acceptable, but stricter would be `Insight Die` (sing.) / `Insight Dice` (pl.).
9. **Em-dashes** — manuscript uses spaced hyphens (` - `) where em-dashes (`—`) would read better. Batch convert if you have a typesetting pass scheduled.

---

# Section I — Files generated during this audit

```
tasks/quickstart-v0.1.01-audit.md            ← this file
tasks/_work/quickstart-export-v0.1.01-layout.txt   ← pdftotext -layout extraction
tasks/_work/quickstart-export-v0.1.01-pymupdf.txt  ← PyMuPDF extraction
tasks/_work/srd-export-v1.1.17.txt                 ← pdftotext SRD extract
tasks/_work/srd-export-v1.1.17-pymupdf.txt         ← PyMuPDF SRD extract
```

The `_work/` directory is safe to delete after the rewrite is done.
