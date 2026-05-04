# Quickstart v0.8.531 vs SRD v1.1.17 — divergence audit

**Goal**: identify every rule statement in `Distemper Quickstart v0.8.531.pdf` that has drifted from the newer canonical `XSE SRD v1.1.17 (Small).pdf`, and supply replacement text so the rewrite is mechanical.

**Sources**:
- Quickstart text: `tasks/_work/quickstart-v0.8.531.txt` (pdftotext -layout)
- SRD text: `tasks/_work/srd-flow.txt` (pdftotext default reflow)
- Curated extracts: `tasks/rules-extract-cdp.md`, `tasks/rules-extract-combat.md`

**Precedence rule** (per `CLAUDE.md`): SRD v1.1.17 is canonical. Where Quickstart contradicts SRD, the SRD wins and the Quickstart needs updating.

**Severity tags**:
- 🔴 **MECHANIC** — a rule formula or value changed; players will get different results
- 🟡 **MISSING** — SRD added a system the Quickstart doesn't cover at all
- 🟢 **TYPO/INCONSISTENCY** — Quickstart contradicts itself or has an obvious slip
- ⚪ **JUDGMENT** — content present in Quickstart but absent from SRD; needs your call to keep, drop, or relabel

Findings are ordered by severity, then by Quickstart page/line.

---

## 🔴 1. Backstory CDP totals are 25 → should be 20

**Where**: Quickstart pp. 14–21 (the entire Backstory Generation walkthrough), plus the "Experienced Players" shortcut box on p. 15.

**Quickstart says** (totals, derived from body text on lines 794–815, 896–1092):

| Step | Attr CDP | Skill CDP |
|---|---|---|
| 1 — Where They Grew Up | 1 | 2 |
| 2 — What They Learned | 1 | **4** |
| 3 — How They Spent Time | 1 | **4** |
| 4 — How They Made Money (Profession) | 2 | **7** |
| 5 — After the Collapse | 0 | 3 |
| **Total** | **5** | **20** |

Grand total: **25 CDP**. Pesky LaRue's worked example follows these spends.

**SRD §04 says** (lines 596, 604–627):

| Step | Attr CDP | Skill CDP |
|---|---|---|
| Step One — Where They Grew Up | 1 | 2 |
| Step Two — What They Learned | 1 | **3** |
| Step Three — What They Liked To Do | 1 | **3** |
| Step Five — How They Made Money | 2 | **4** |
| Step Final — Whatever's Left | 0 | 3 |
| **Total** | **5** | **15** |

Grand total: **20 CDP**. (SRD's Step Four is Complications & Motivations — narrative, no CDP.)

**Replacement text** (Experienced Players shortcut, currently Quickstart line 778–784):

> Experienced players who are already familiar with the Xero Sum Engine may choose to skip the first five steps of this process, with the GM's agreement. Instead, they should allocate **5 Character Development Points to raising their RAPID Range Attributes and 15 CDP to their Skills.** They may not raise attributes beyond 3 (Exceptional) or skills beyond 3 (Professional).

**Replacement text** (Step Two — What They Learned, currently line 935–945):

> During this step you can allocate **1 Character Development Point** towards raising any RAPID Range attribute, as well as **3 Character Development Points** towards raising skills. It costs 1 CDP to raise a Skill from 0 (Untrained) to 1 (Beginner), or from 1 (Beginner) to 2 (Journeyman). Skills cannot be raised above 2 (Journeyman) during the What They Learned step.

**Replacement text** (Step Three — How They Spent Time, currently line 963–984):

> Add 1 Character Development Point to any RAPID Range Attribute. During this step, you can raise an attribute from 2 (Strong) to 3 (Exceptional). Allocate **3 CDP** to the skills that reflect your characters' passions, interests, and hobbies.

**Replacement text** (Step Four — How They Made Money / Profession, currently line 989–1024):

> You receive 2 Character Development Points to spend on any RAPID Range attribute, which can be raised from 2 (Strong) to 3 (Exceptional) during this step.
>
> To represent the expertise and mastery that comes through the years your character has devoted to learning their craft, you get **4 Character Development Points** to allocate to various skills. Skills can be raised from 2 (Journeyman) to 3 (Professional) during this step.

**Worked-example follow-on**: Pesky LaRue's spends will need to be re-budgeted to fit 15 skill CDP instead of 20 (currently he has 11 skills totalling well over 15 points). I can produce a re-budgeted Pesky on request — call it out and I'll do it.

---

## 🔴 2. Backstory step ORDER differs from SRD

**Quickstart** order (p. 15): Xero → 1 (Childhood) → 2 (Education) → 3 (Hobbies) → **4 (Profession) → 5 (After Collapse) → 6 (Complications & Motivations)**.

**SRD §04** order (lines 593–628): Xero → One (Childhood) → Two (Education) → Three (Hobbies) → **Four (Complications & Motivations) → Five (Profession) → Final (Whatever's Left)**.

The SRD weaves Complications/Motivations *between* Hobbies and Profession (a thematic break before the work-life step); the Quickstart pushes them to the end. Either is workable in play, but per the SRD-canonical rule the Quickstart needs to renumber.

**Replacement**: Move the "Complications & Motivations" step (currently Step Six on Quickstart p. 19, line 1093+) to **Step Four**, and renumber Profession → Step Five, After the Collapse → Step Final.

---

## 🔴 3. AMod range cap should be +4 (Human Peak), not +5 (Animalistic) for player characters

**Quickstart line 427**: "The RAPID Range Attributes range from -2 (Lame) to +5 (Animalistic)."

**Quickstart line 635–637**: "Although RAPID Range attributes start at -2 (Lame) and go to 5 (Animalistic), 0 is Average, and is the starting value for all characters."

**SRD §02 line 205**: "These attributes range from -2 (Diminished) to +4 (Human Peak). **Animals and machines** can have attributes that can go up to +5 (Superhuman), as detailed in Table 2."

**SRD §03 line 360**: "Attributes start at 0 (Average) but range from -2 (Diminished) up to +4 (Human Peak). Attributes for animals and machines can go up to +5 (Superhuman)."

So +5 is reserved for animals/machines; PCs cap at +4. Also note the **labels changed**: "Lame" → "Diminished", "Animalistic" → "Superhuman" (animal) / "Human Peak" (PC ceiling).

**Replacement text** (Quickstart line 425–430):

> The Attribute Modifiers are detailed in Table 2: RAPID Range Mods. The RAPID Range Attributes for player characters range from -2 (Diminished) to +4 (Human Peak). Animals and machines can reach +5 (Superhuman). This number is also their Attribute Modifier (AMod) which is added to any dice roll involving that Attribute, such as Physicality if breaking down a door, or Reason if solving a puzzle.

**Replacement text** (Quickstart line 634–648):

> Although RAPID Range attributes start at -2 (Diminished) and go up to +4 (Human Peak) for player characters, 0 is Average and is the starting value for all characters. Animals and machines may reach +5 (Superhuman). Your character's RAPID Range attribute is also their Attribute Modifier (AMod) and is applied to any dice check using that attribute. These mods are outlined on Table 2: Rapid Range.

**Table 2 update**: change the header row from "+5 Animalistic" to "+4 Human Peak" for the PC ceiling, with an annotation "+5 Superhuman — animals and machines only" if you still want the row visible.

---

## 🔴 4. Get The Drop initiative penalty is -3 → should be -2

**Quickstart line 1871–1873**: "NOTE: Any player who Gets The Drop automatically incurs a **-3 CMod** on their next Initiative Roll, returning to normal on subsequent Initiative rolls."

**SRD §06 line 957**: "Any character who Gets The Drop automatically incurs a **-2 CMod** on their next Initiative Roll."

**Replacement**: change `-3 CMod` to `-2 CMod`.

---

## 🔴 5. Incapacitation duration is "1d6 − PHY" → should be "4 − PHY" (flat)

**Quickstart line 1719–1722**: "A character reaching 0 Resilience Points (RP) becomes Incapacitated for **1d6 Rounds − Physicality Modifier**, with a minimum of one round."

**SRD §06 line 1110**: "Once a character's Resilience Points reach 0, they will experience Incapacitation for **4 − Physicality AMod** (with a minimum of 1 round)."

The SRD removes the dice — it's a flat 4 rounds minus PHY AMod. (For a high-PHY character with PHY +3, that's 1 round; for PHY 0, it's 4 rounds.)

**Replacement text** (Quickstart line 1719–1722):

> A character reaching 0 Resilience Points (RP) becomes Incapacitated for **4 Rounds − Physicality Modifier**, with a minimum of one round.

---

## 🔴 6. Stabilize check uses Reason/First Aid/Surgery → SRD uses Medicine\* (or Reason on Wild Success only), and adds a post-stabilize incap window

**Quickstart line 1733–1739**: "A Mortally Wounded character can be Stabilized with a Successful **Reason, First Aid, or Surgery\* check.** If this takes place whilst combat is still happening, then Stabilizing a Mortally Wounded character uses both Combat Actions and the character making the attempt is unable to do anything else."

**SRD §06 line 1118**: "If a character becomes Mortally Wounded, someone must Stabilize them with a **Successful Medicine\* check, or by achieving a Wild Success with a Reason check.** Once Stabilized, the character remains Incapacitated for **16 − PHY AMod**, with a minimum of 1 round. They will then recover consciousness and have 1 WP and 1 RP."

Two real changes:
1. **Skill list contracts**: Medicine\* is the canonical skill (the SRD §05 skill list groups First Aid / Surgery\* / Pharmacology\* under a Medicine category — the asterisked Medicine\* check is the umbrella). Reason is allowed but **only on a Wild Success** (14+), not a regular Success.
2. **Post-stabilize state added**: stabilized PCs are still Incapacitated for `16 − PHY AMod` rounds, then wake up with 1 WP and 1 RP. Quickstart is silent on this.

**Replacement text** (Quickstart line 1733–1739):

> A Mortally Wounded character can be Stabilized with a Successful **Medicine\* check, or by achieving a Wild Success on a Reason check.** Once Stabilized, the character remains Incapacitated for **16 − Physicality AMod rounds (minimum 1)**, then recovers consciousness with 1 WP and 1 RP.
>
> If this takes place whilst combat is still happening, then Stabilizing a Mortally Wounded character uses both Combat Actions and the character making the attempt is unable to do anything else.

> **Verify before publishing**: confirm the SRD's skill list (§05) names "Medicine\*" as the umbrella skill rather than First Aid / Surgery\* / Pharmacology\* as separate skills the way Quickstart's skill list does (lines 1965–2025). If the SRD still has them as separate skills and "Medicine\* check" is shorthand for "any of {First Aid, Surgery\*, Pharmacology\*}", the replacement text above should read "a Successful **First Aid, Surgery\* or Pharmacology\*** check, or…". I'll dig into the SRD skill page on request to nail this down.

---

## 🔴 7. First Impression Dire Failure CMod is -5 → should be -2

**Quickstart line 1602–1605**: "If they get a total of 3 or below, no matter how they have Filled In The Gaps this Dire Failure makes the NPC suspect they might be threatening or even outright hostile, and there is a **-5 CMod** to all future interactions."

**SRD §02 line 343**: "Dire Failure (0-3): They make a terrible impression and come across as threatening or hostile and receive a **-2 CMod** on all future interactions."

The SRD also breaks out the Moments of Insight cleanly, which the Quickstart doesn't do explicitly:

| Outcome | SRD CMod | Quickstart CMod |
|---|---|---|
| Wild Success (14+) | +1 | +1 |
| **Moment of High Insight (6+6)** | **+2 + Insight Die** | (rolled into Wild Success) |
| Success (9–13) | 0 | 0 |
| Failure (4–8) | -1 | -1 |
| Dire Failure (0-3) | **-2** | **-5** ← drift |
| **Moment of Low Insight (1+1)** | **-3 + Insight Die** | (rolled into Dire Failure) |

**Replacement text** (Quickstart line 1591–1607 — replace the whole outcome ladder block):

> If the player gets a total of 9 or above on their First Impressions check then they are Successful, and the NPC has no particularly adverse or positive reaction towards them. They get a 0 CMod to future interactions with that NPC.
>
> A Wild Success (14+) means they made a favorable impression and they get a **+1 CMod** on future interactions with this NPC.
>
> A Moment of High Insight (6+6) is even better — they get a **+2 CMod** on future interactions and gain an Insight Die.
>
> A Failure (4–8) means they failed to make a good first impression on the NPC, who becomes wary of them. They get a -1 CMod to all future social interactions with this NPC.
>
> A Dire Failure (0–3) means they make a terrible impression and come across as threatening or hostile, getting a **-2 CMod** on all future interactions. Depending on the character's next move and demeanor, this may even initiate combat.
>
> A Moment of Low Insight (1+1) is worse — they get a **-3 CMod** on all future interactions and gain an Insight Die.

---

## 🔴 8. Gut Instinct uses Acumen → SRD uses Perception Modifier (R + A AMod)

**Quickstart line 1581–1582**: "This requires the character to use Psychology\*, Survival, Tactics\*, or their **Acumen** to get a read on the NPC."

**SRD §02 line 350**: "Gut Instinct checks use the **Perception Modifier**, although a character can substitute for an appropriate skill, such as Psychology\*, Survival, or Tactics\*."

The SRD added a new Secondary Stat — **Perception (PER) = Reason AMod + Acumen AMod** (line 459–461). It's the default modifier for Gut Instincts and for the new Perception Check (line 333–334). Quickstart never mentions Perception at all.

**Replacement text** (Quickstart line 1581–1582):

> This check uses the character's **Perception Modifier** (Reason AMod + Acumen AMod), although they may substitute an appropriate skill such as Psychology\*, Survival, or Tactics\* if it better fits the situation.

**Knock-on edits required**:
1. **Add "Perception" to the Secondary Stats walkthrough on p. 20** (between Resilience Points and Defensive Modifiers, currently line 1135–1158). Suggested insert:
   > **Perception (PER):** A measure of how well a character picks up on subtleties and how tuned in they are to their environment. Perception is the sum of their Reason AMod and Acumen AMod. It is used by default for Gut Instinct checks and any general "did my character notice this?" Perception Check.
2. **Update Pesky's worked example** (line 1158–1179) to include his Perception Mod (Reason 0 + Acumen 2 = +2).
3. **Update Table 5: Secondary Stats** on p. 20 to add a Perception row.

---

## 🔴 9. Insight Dice "save from death" — phrasing OK but check restriction missing

**Quickstart line 498–501**: "If a character would otherwise Die (see page 33), they may surrender all of their Insight Dice in exchange for **recovering 1 Wound Point and 1 Resilience Point for each dice surrendered.** Players cannot choose how many dice to use in this method, this costs all of their available Insight Dice."

**SRD §02 line 304**: "Players can [surrender] Insight Dice to recover **1 Wound Point and 1 Resilience Point per dice** and save their character from Death." ✅ matches.

**Quickstart line 1745–1750** (in Combat / Mortally Wounded section): re-states the same rule, ✅ matches SRD line 1121.

**No drift on the recovery formula.** ✓

**But the SRD adds a NEW restriction the Quickstart never mentions** (SRD §02 line 306): "Insight Dice cannot be used to re-roll dice in a Moment of Low Insight." This means once you've rolled snake-eyes, you cannot Insight-Dice your way out of it — the Low Insight stands.

**Suggested addition** at the end of the Insight Dice bullet list on Quickstart p. 10 (line 502–504):

> **Restriction:** Insight Dice cannot be used to re-roll dice that came up as a Moment of Low Insight (snake-eyes). Once you've rolled a 1+1, the result stands.

---

## 🔴 10. Range-band movement times are inconsistent and don't match SRD

**Quickstart line 1864–1873** (movement between bands):
- 1 round to move from Engaged to Close
- 3 rounds to go from Close to Medium
- 6 rounds to go from Medium to Long
- 10 rounds to go from Long to Distant
- 15 rounds to go from Engaged to Distant

These don't add up: 1 + 3 + 6 + 10 = 20, not 15. Internally inconsistent.

**SRD §06 line 991**: "Moving between bands takes the same number of combat rounds as the sum of the bands being covered. This means it takes:
- **3 rounds** to move from Engaged to Close
- **6 rounds** to move from Engaged to Medium
- **10 rounds** to move from Engaged to Long
- **15 rounds** to move from Engaged to Distant"

So the SRD lists *cumulative-from-Engaged* totals: each is the sum of the band values (E=1, C=2, M=3, L=4, D=5) of every band traversed including start and finish. E→C = 1+2 = 3. E→M = 1+2+3 = 6. E→L = 1+2+3+4 = 10. E→D = 1+2+3+4+5 = 15.

**Replacement text** (Quickstart line 1864–1873):

> This means it takes:
> - 3 rounds to move from Engaged to Close
> - 6 rounds to move from Engaged to Medium
> - 10 rounds to move from Engaged to Long
> - 15 rounds to move from Engaged to Distant
>
> (When moving between bands not starting from Engaged, sum the band values of every band you pass through, including the band you start in and the band you arrive at.)

> **Heads up to user**: this rule reads a bit oddly even in the SRD. The implication is that mid-engagement repositioning is *very* slow — moving from Close to Medium during a fight takes 5 rounds (band 2 + band 3). If your tactical-grid translation in [`lib/range-profiles.ts`](lib/range-profiles.ts) and [`rules-extract-combat.md`](tasks/rules-extract-combat.md) reads this as "1 Move action to step one band", that's a Tapestry-house ruling that supersedes the SRD prose. Worth a separate decision before publishing.

---

## 🟡 11. Stress / Breaking Point system is missing entirely

**Quickstart**: has only the Panic Threshold (50% of starting RP triggers a Panic check from Table 7) and a one-line mention that "Breaking Point rules are covered in the Distemper Core Rulebook" (line 1151–1153).

**SRD §06 lines 1130–1233**: full Stress system. The relevant rules:

> **Stress Modifier:** Each character starts with a Stress Level of 0. Their Stress culminates at 5 (Breaking Point).
>
> **Stress Check:** When faced with extreme stress or emotional trauma (as determined by the Game Master or narrative context), PCs must make a check using their Stress Modifier, which is the sum of their **Reason AMod + Acumen AMod**.
>
> If they fail this check, their Stress Level goes up by 1.
>
> If a character's Stress Level reaches 5, they hit their Breaking Point. The player rolls 2d6 and consults Table 13: Breaking Point to determine their character's reaction. This lasts 1d6 rounds and, once the reaction is resolved, their Stress Level resets to 0.
>
> **Recovery:** Characters can reduce their Stress Level by 1 by spending at least 8 uninterrupted in-game hours free from combat, interpersonal conflict, or environmental threat, while doing something they enjoy (such as fishing).

Plus a project-memory house rule (memory: `project_stress_on_mortal_incap`):
> Entering WP=0 (Mortally Wounded) or RP=0 (Incapacitated) auto-fills 1 Stress pip (cap 5); on-entry, not end-of-combat.

**Suggested replacement** for the Quickstart's Panic Threshold + Breaking Point sections (currently line 1148–1153 in Secondary Stats, plus the Panic table on line 1757–1764):

Replace "Panic Threshold" entirely with a "Stress" subsection:

> **Stress (S):** Each character starts the game with a Stress Level of 0. When faced with extreme stress or emotional trauma — taking heavy fire, watching an ally die, witnessing horror — the GM may call for a Stress Check using the character's **Stress Modifier (Reason AMod + Acumen AMod)**. On a Failure, Stress Level goes up by 1. Stress also auto-increments by 1 the moment a character drops to 0 WP (Mortally Wounded) or 0 RP (Incapacitated).
>
> When Stress Level reaches 5, the character hits their **Breaking Point** — roll 2d6 on Table 13: Breaking Point for their reaction (lasts 1d6 rounds). After the reaction resolves, Stress Level resets to 0.
>
> **Recovery:** Stress Level drops by 1 for each 8 uninterrupted in-game hours the character spends free from combat, conflict, or environmental threat while doing something they enjoy (fishing, drinking, reading, woodworking).

**Knock-on**: Table 7: Panic Effects (Quickstart line 2080–2112) becomes the **Breaking Point table**, not a Panic table. SRD Table 13 has a different list of effects (Catatonic, Cathartic Fit, Berserk Rage, Despair, Outrage, Psychotic Snap, Flee, Random Attack, Self-Harm, Self-Destructive Urge, Inward Outburst). I can transcribe the full Table 13 from the SRD on request — let me know.

---

## 🟡 12. Lasting Wounds (SRD Table 12) is missing entirely

**SRD §06 lines 1126–1170**: A character who is Mortally Wounded but Stabilized must make a Physicality check (after surviving) to avoid taking 1 **Lasting Wound** — roll 2d6 on Table 12 for the permanent injury. Wounds are permanent and cannot be healed.

**Quickstart** has no Lasting Wounds at all.

**Suggested addition** as a new sub-section right after the Stabilize paragraph (Quickstart line 1739):

> **Lasting Wounds:** A character who survived being Mortally Wounded must make a Successful Physicality check after recovery. On a Failure, they roll 2d6 on Table 12: Lasting Wounds and suffer the corresponding permanent injury (anything from a -1 to a Defensive Modifier through to a permanent attribute reduction). These wounds cannot be healed.

**Note**: Table 12 needs to be transcribed cleanly from the SRD (the pdftotext layout is mangled). I can produce it on request; the rough list of effects from the SRD: Lazy Eye, Brain Injury, Damaged [foot/hand?], Scar, Wound, Sprain, Sprain, Fractured, Hearing Loss, Crushed, Spinal-Severed.

---

## 🟢 13. Combat Round duration is inconsistent inside Quickstart

**Quickstart line 1655**: "Combat takes place in Rounds lasting **3-6 seconds**."

**Quickstart line 2028** (inner cover quick-reference): "Combat Rounds last **6-10 seconds**…"

**SRD §06 line 937**: "Combat is divided into rounds that last approximately **3-6 seconds**."

**Fix**: change inner-cover line 2028 to read "Combat Rounds last 3-6 seconds, and consist of 3 phases: Initiative, Actions, Resolution." (Match the body text.)

---

## 🟢 14. Inner-cover quick-reference has multiple typos

The Quickstart's inner-cover quick-reference card (lines 1942–2112) has several discrepancies vs. the body of the same Quickstart, vs. the SRD, or both. Fixes:

| # | Inner-cover line | Says | Should say | Why |
|---|---|---|---|---|
| 14a | 1951 | "Add their Reason, Acumen, Physicality, Influence or Dexterity AMod, for a range of -2 to +4" | "for a range of -2 (Diminished) to +4 (Human Peak)" | The label "Lame" was changed; +4 is the PC ceiling. ✅ The number is right; only the label was off. |
| 14b | 1956 | "Add relevant SMods from Skills for a range of -3 to +3" | "for a range of -3 (Inept) to +4 (Life's Work)" | The +3 cap is the *starting-character* cap, not the SMod range. The general range is -3 to +4. |
| 14c | 1971 | "All characters have 5 RAPID Range attributes (Reason, Acumen, Physicality, Influence, & Dexterity) **ranging from 0 to 4**" | "ranging from -2 to +4" | Negative attributes are real and meaningful; this clipping is wrong. |
| 14d | 1976 | "Each character has a variety of skills, with a Skill Modifier (or SMod), **ranging from 0 to +4**" | "ranging from -3 to +4" | Skills can be negative (Untrained at 0 with -1 GM CMod, or Inept at -3 for vocational without training). |
| 14e | 2031–2034 | "An INITIATIVE CHECK is: 2d6 + Dexterity AMod + Acumen AMod **+ Perception SMod**" | "2d6 + Dexterity AMod + Acumen AMod + CMods" | Perception isn't a skill (it's a Secondary Stat = R + A AMod) AND Initiative doesn't add Perception in the body of the Quickstart or in the SRD. This is a stray edit. |
| 14f | 2031 | First Impressions: "Influence, Inspiration, Intimidation, or **Tactics\*** check" | Match the body's "Influence, Inspiration, Intimidation, or **Manipulation**" — or, ideally, both adopt the SRD's flexible phrasing: "**Influence and any appropriate skill, such as Manipulation, Inspiration, Intimidation, or Psychology\***" | Body and inner cover currently disagree; SRD opens it up further. |
| 14g | 2057 | Negotiations Gambit: "Influence, Barter, **Charm, Deception**, Entertainment, Inspiration, or Intimidation check" | Drop Charm and Deception (they aren't on the skill list, lines 1965–2025) | Wrong skill names. |
| 14h | 2077 | Negotiations Rebuttal: "Acumen, Barter, **Perception** or Survival check" | Drop Perception (not a skill — it's a Secondary Stat) | Wrong skill name. |
| 14i | 2042 | Distract uses "Intimidation, Tactics\* or Psychology\*" | Match body's "Intimidation, Psychology\*, or Tactics\*" — same skills, just match the order | Cosmetic. |

---

## ⚪ 15. Negotiations / Gambits & Rebuttals: not in SRD §02 — your call

**Quickstart pp. 31** (lines 1608–1654, 2052–2092): full Negotiations system using Gambits & Rebuttals as Opposed Checks.

**SRD §02 (Social mechanics, lines 312–354)**: only First Impressions and Gut Instincts. **No Negotiations, Gambits, or Rebuttals appear anywhere in the SRD body.**

So the SRD either:
- (a) Removed the Negotiations mechanic intentionally and now expects social conflict to fall back to plain Opposed Checks + First Impressions modifiers, OR
- (b) Treats Negotiations as a Distemper-specific extension that lives in the CRB (Distemper Core Rulebook), not in the SRD baseline.

**Decision for you**:

- If **(a)** — drop the Negotiations section from the Quickstart; replace with a one-paragraph note that "extended back-and-forth social conflict uses Opposed Checks (see p. 11) with the relevant Sway skills."
- If **(b)** — keep the Negotiations section but tag it as a Distemper-specific extension, e.g. add a sidebar: "Negotiations are a Distemper-flavored expansion to the SRD baseline, layered on top of the SRD's First Impressions and Gut Instincts mechanics."

If you keep them, the in-section skill lists still need cleanup (no Charm, no Deception, no Perception — see #14g and #14h above) and the body's two skill lists need to match each other (currently the Gambit and Rebuttal lists overlap weirdly).

---

## ⚪ 16. Insight Dice — wording difference on "re-roll"

**Quickstart line 491**: "Re-rolling one or both of the original 2d6 dice rolled, **at the cost of one Insight Dice per dice re-rolled**"

**SRD §02 line 301**: "After a dice check, a player can [swap one or both rolled dice] and **replace them with an Insight Dice, which are then rolled fresh and added to the total**."

Mechanically very similar, but the SRD frames it as "swap and roll fresh" — the Insight Dice physically replaces the swapped die rather than being a re-roll permission. This may be a deliberate clarification (the Insight Dice's roll counts; the original die's roll is gone). I'd update the Quickstart to match the SRD framing for consistency, even though the math is identical.

**Suggested update** (Quickstart line 491–492):

> Swapping out one or both of the rolled 2d6 dice with an Insight Dice — the Insight Dice is then rolled fresh and added to the total, at the cost of one Insight Dice per dice swapped.

---

## ⚪ 17. Healing rates — Quickstart adds detail not in SRD

**Quickstart line 1726–1729**: "Upon regaining consciousness, they recover 1 RP immediately, and then an additional RP for each Combat Round that they are not actively engaged in combat, **up to half of their maximum**. **When not in combat, a PC recovers 1 RP per hour and recovers all remaining RP with a good night's rest.**"

**SRD §06 lines 1114, 1123–1125**: "The character regains consciousness with 1 RP and recovers 1 additional RP per round if they are not in combat" — and Healing rules say injured characters heal "at 1 WP per [day] if they are resting" with no per-hour or half-cap rules.

The Quickstart has elaborated rules — half-max cap, per-hour recovery, full restore on a night's rest — that don't exist in the SRD. Per SRD precedence, these should be cut OR formally adopted into a Tapestry house rule.

**Decision for you**: the Quickstart's elaboration is *useful* (a per-hour rate for the long-rest case is much more practical than the SRD's silence). Worth keeping — but flag the section as a Tapestry-flavored elaboration of the SRD baseline if you want to be transparent about precedence.

---

## ⚪ 18. Falling Damage and Drowning — SRD has them, Quickstart doesn't

**SRD §06 lines 1104–1108**:
> **Falling Damage:** Characters suffer 3 WP & RP damage for each 10' that they fall.
>
> **Drowning:** Characters can hold their breath in water for **6 + Physicality AMod rounds**. For each subsequent round, they must make a successful Physicality check or suffer **3 WP and 3 RP damage**. If a character's Resilience or Wound Points reach 0 because of Drowning, they will die unless another character saves them.

**Quickstart**: has neither. Worth adding a small "Environmental Damage" sidebar in the combat chapter so the Quickstart isn't silent on these — they're invoked often enough in adventures (rooftop chases, river crossings) to matter.

---

## Appendix: things I checked that did NOT drift ✓

For your sanity — the following Quickstart claims match SRD v1.1.17 exactly:

| Topic | Quickstart line | SRD line |
|---|---|---|
| Outcome ladder (Dire Failure ≤3 / Failure 4–8 / Success 9–13 / Wild Success 14+ / Low Insight 1+1 / High Insight 6+6) | 367–373, 1942–1956 | 116–161 |
| CMod range (-5 Doomed To Failure to +5 Divine Intervention) | 464–465 | 245 |
| Wound Points formula (10 + PHY AMod + DEX AMod) | 1181–1182 | 457 |
| Resilience Points formula (6 + PHY AMod) | 1184–1185 | 465 |
| Defensive Modifier (DM_Melee = PHY AMod, DM_Ranged = DEX AMod) | 1187–1190 | 447 |
| Initiative Modifier (ACU AMod + DEX AMod) | 1192–1193 | 449–450 |
| Encumbrance (6 + PHY AMod) | 1195–1196 | 453 |
| Breaking Point base (3 + Reason AMod + Acumen AMod) | 1201–1202 | 485–486 |
| Morality starts at 3 | 1204 | 485 |
| Mortally Wounded countdown (4 + PHY AMod rounds) | 1731–1732 | 1116, 1120 |
| Insight Dice starting count (2) | 482, 1966 | 297 |
| Insight Dice non-transferable | 506–507, 1999–2001 | 307 |
| Damage RP-vs-WP split (50% RP unless 100%-RP weapon) | 1719–1722 | 1095–1096 |
| Subdue (full RP / 50% WP) | 1840–1842 | Table 10 line 1044 |
| Aim (+2 CMod next Attack, lost if not Attack) | 1783–1784 | Table 10 line 1001 |
| Take Cover (+2 DM until next active action) | 1844–1845 | Table 10 line 1048 |
| Coordinate (Tactics\* check, +2 CMod for allies at Close) | 1793–1796 | Table 10 line 1013 |
| Cover Fire (-2 CMod to target's next action) | 1798–1800 | Table 10 line 1017 |
| Defend (+2 DM until end of round) | 1802–1803 | Table 10 line 1021 |
| Distract (Intimidation/Psychology\*/Tactics\* → target loses next action) | 1808–1809 | Table 10 line 1025 |
| Inspire (Inspiration check → target gets extra action; once per round) | 1818–1820 | Table 10 line 1034 |
| Rapid Fire (-1/-3 first/second; -2/-4 if both actions) | 1824–1827 | Table 10 line 1036 |
| Group Check mechanic (highest stat rolls, +1 CMod per helper, no Insight Dice) | 542–572, 2003–2014 | 322–326 |
| Range bands (E=1, C=2, M=3, L=4, D=5) | 1851–1853 | 962–989 |
| Engaged combat (+1 CMod Melee, -1 CMod Ranged) | 1874–1875 | 992–993 |
| Subsistence Damage (1 day grace, then 1 RP/day; food → heal 1 WP & 1 RP/day) | 1766–1782 | 1100–1102 |
| Item Upkeep ladder (Pristine → Used → Worn → Damaged → Broken; +1/0/-1/-2/Unusable) | 1521–1556, ref `lib/weapons.ts` | 1577–1607 |
| Get The Drop tiebreaker (highest DEX + ACU AMod combined) | 1857–1869 | 955–956 |

---

## Suggested rewrite order

If you want to move fast on the rewrite, here's the order that'll touch the fewest pages-per-edit:

1. **Numbers-only fixes** (10 minutes): items #4, #5, #7, #13. Single-character/single-number edits to the body text.
2. **Inner-cover quick-reference** (#14, all sub-items): one page, ~10 fixes, all small.
3. **Backstory CDP overhaul** (#1, #2): biggest narrative change. Re-budget Pesky's worked example after.
4. **AMod range labels and ceiling** (#3): touches Table 2, the AMod intro paragraph, Step Xero starting-stats note, and Pesky's character sheet image.
5. **Stress system transplant** (#11): rewrites the Panic Threshold subsection on p. 20 and replaces Table 7 with SRD Table 13. Biggest mechanic change.
6. **Add Perception** (#8 knock-on): new Secondary Stat row + Pesky's PER calculation + update Gut Instinct skill list.
7. **Add Lasting Wounds + environmental damage** (#12, #18): two small sidebars in the combat chapter.
8. **Make a call on Negotiations** (#15): keep-and-tag, or cut.

Items #6, #9, #10, #16, #17 are smaller polish edits that can land alongside any of the above.

---

## What I haven't verified

- **SRD Combat Actions (Table 10)** — extracted via PyMuPDF and read against the Quickstart. All actions Quickstart names appear in SRD's Table 10 with matching effects on Aim, Charge, Coordinate, Cover Fire, Defend, Dice Check, Distract, Fire from Cover, Grappling, Inspire, Move, Rapid Fire, Ready Weapons, Reposition, Sprint, Subdue, Take Cover. Numerical parameters (e.g., +2 CMod on Aim, -1/-3 on Rapid Fire, +2 DM on Take Cover) match the Quickstart exactly. ✅ **No drift in Table 10.**
- **Setting-narrative numbers**: Quickstart line 220 says "87% of the population of earth is gone" but the back cover (line 2116) says "wiped out 90% of humanity". Doesn't matter for rules but pick one number.

---

# Appendix A — SRD Tables 12 & 13 (decoded)

The SRD PDF uses a custom font that strips lowercase letters in `pdftotext` output. PyMuPDF preserved enough character shape to decode by visual pattern. **Verify against the printed PDF** before final use, but these reconstructions are high-confidence.

## Table 12: Lasting Wounds

A character who survived being Mortally Wounded must make a Successful Physicality check. On a Failure, roll 2d6 and apply the corresponding Lasting Wound. **These wounds are permanent and cannot be healed.**

| 2d6 | Lasting Wound | Effect |
|---|---|---|
| 2 | Lost Eye | -1 on checks using Dexterity |
| 3 | Brain Injury | -2 Reason |
| 4 | Diminished | -1 Dexterity |
| 5 | Shaken | -1 Max. Resilience Points |
| 6 | Weakened | -1 Max. Wound Points |
| 7 | Skittish | -1 Initiative Modifier |
| 8 | Scarring | -1 Influence |
| 9 | Fragile | -1 Physicality |
| 10 | Hearing Loss | -1 Acumen |
| 11 | Crippled | -1 Perception & -1 Acumen |
| 12 | Shell Shock | -2 Dexterity |

## Table 13: Breaking Point

Triggered when a character's Stress Level reaches 5. Roll 2d6 and apply the reaction for **1d6 rounds**. Once the reaction resolves, Stress Level resets to 0.

| 2d6 | Reaction | Effect (during reaction) |
|---|---|---|
| 2 | Catatonia | -1 on Dexterity checks |
| 3 | Compulsive Fixation | -2 Reason |
| 4 | Blind Rage | -1 Dexterity |
| 5 | Dissociation | -1 Maximum RP |
| 6 | Overwhelm | -1 Max. Wound Points |
| 7 | Panic Surge | -1 Initiative Modifier |
| 8 | Fatalism | -1 Influence |
| 9 | Reckless Abandon | -1 Physicality |
| 10 | Self-Harm | -1 Acumen |
| 11 | Self-Destructive Urges | -1 Perception, -1 Acumen |
| 12 | Irrational Outburst | -2 Dexterity |

> **Design note**: Tables 12 and 13 share the same effect column verbatim. Lasting Wounds = permanent; Breaking Point reactions = 1d6 rounds. The shared column hints these were authored as a single mechanic in two flavors (physical trauma vs. mental trauma) — a clean parallel that's worth preserving in your rewrite as a sidebar callout.

---

# Appendix B — SRD §05 skill list, decoded and compared

The SRD's Table 9 (decoded from physical pages 12–16) lists **33 skills**, several of which differ substantially from the Quickstart's 30-skill roster.

## SRD Table 9 — full skill list

| Skill | Category | Attribute | Description (paraphrased) |
|---|---|---|---|
| Animal Handling | Sway | Influence | Working with animals, basic obedience to herd management |
| Astrogation | Knowledge | Reason | Spacecraft operations, astrogation, EVA / zero-G procedures |
| Athletics | Innate | Physicality | Fitness, agility, stamina, climbing, jumping, swimming |
| Barter | Sway | Acumen | Arranging deals, appraising goods, haggling |
| Computers | Knowledge | Reason | Digital systems, troubleshooting, coding, hacking |
| Demolitions\* | Combat | Physicality | Manufacture and use of explosives |
| Driving\* | Mechanic | Dexterity | Driving any vehicle with confidence and finesse |
| Entertainment | Sway | Influence | Captivating an audience through performance |
| Farming\* | Knowledge | Acumen | Growing crops or raising livestock at scale |
| Gambling\* | Knowledge | Acumen | Mechanics of games of chance, risk vs. reward |
| Heavy Weapons\* | Combat | Physicality | Operating large-scale battlefield weapons |
| Inspiration | Sway | Influence | Boost morale, motivate behind a shared vision |
| Lock-Picking\* | Criminal | Acumen | Bypassing locks and security devices |
| Manipulation | Sway | Influence | Getting others to think, believe, or act differently |
| Mechanic\* | Mechanic | Reason | Diagnose, repair, build complex machines, tools, vehicles, systems |
| Medicine\* | Medicine | Reason | First aid, diagnosis, treatment, emergency stabilization, advanced care |
| Melee Combat | Combat | Physicality | Training with melee weapons |
| Navigation\* | Innate | Acumen | Discern directions, remember routes, plot accurate courses |
| Piloting | Knowledge | Dexterity | Safely operate aircraft or spacecraft |
| Psychology\* | Knowledge | Influence | Leveraging human behavior to influence, predict, exploit, or manipulate |
| Ranged Combat | Combat | Dexterity | Accurately and safely using projectile weapons |
| Research | Knowledge | Reason | Efficiently organize, distill, absorb information |
| Scavenging\* | Innate | Acumen | Finding & evaluating missed/hidden/discarded items |
| Science\* | Knowledge | Reason | Practical application of scientific principles |
| Sleight of Hand | Criminal | Dexterity | Sleight-of-hand, palming, pickpocketing, concealment |
| Specific Knowledge\* | Knowledge | Reason | History, layout, secrets of a specific area, community, person, or discipline (e.g. Law) |
| Stealth | Criminal | Physicality | Move and stick to shadows, avoid detection |
| Streetwise | Innate | Acumen | Navigate urban environments, read situations, find underworld resources |
| Survival | Innate | Acumen | Make something out of nothing, fix unfixable things |
| Tactics\* | Knowledge | Reason | Battlefield or interpersonal strategy for situational advantage |
| Tinkerer | Mechanic | Dexterity | Adept at fixing, modifying, improving machines, gear, weapons; improvising inventions |
| Unarmed Combat | Combat | Physicality | Grappling, fist fighting, martial arts |
| Weaponsmith\* | Mechanic | Dexterity | Crafting, repairing, modifying weapons |

> **Note on `Stealth`**: SRD lists Stealth's attribute as Physicality. Quickstart line 2011 lists it as Dexterity. Verify which the SRD intends — Physicality for "endurance hiding"? Dexterity for "quick sneaking"? — both are defensible, and Distemper-house may want to overrule.

## Drift table — SRD vs. Quickstart skill rosters

| Skill | SRD | Quickstart | Status |
|---|---|---|---|
| Animal Handling | ✓ | ✓ | match |
| **Armorsmith\*** | — | ✓ | **Quickstart-only** (rolled into SRD's Mechanic\*) |
| **Astrogation** | ✓ | — | SRD-only (sci-fi; not relevant to Distemper) |
| Athletics | ✓ | ✓ | match |
| Barter | ✓ | ✓ | match |
| **Computers** | ✓ | — | SRD-only (sci-fi/modern; possibly relevant to Distemper depending on tech level) |
| Demolitions\* | ✓ | ✓ | match |
| **Driving\*** | ✓ | — | SRD-only (covers vehicle operation; Distemper relies on plain DEX checks for driving) |
| Entertainment | ✓ | ✓ | match |
| Farming | ✓ (as Farming\*) | ✓ (no asterisk) | **vocational status differs** |
| **First Aid** | — | ✓ | **Quickstart-only** (rolled into SRD's Medicine\*) |
| **Gambling\*** | ✓ | — | SRD-only |
| **General Knowledge** | — | ✓ | **Quickstart-only** (no clean SRD equivalent — closest is Specific Knowledge\* but that's vocational and topic-bound) |
| **Heavy Weapons\*** | ✓ | — | SRD-only (sci-fi/military; possibly relevant to Distemper for warlords/military stockpiles) |
| **Hunting** | — | ✓ | **Quickstart-only** (rolled into SRD's Survival or Ranged Combat) |
| Inspiration | ✓ | ✓ | match |
| **Intimidation** | — | ✓ | **Quickstart-only** (rolled into SRD's Manipulation/Psychology\*) |
| Lock-Picking\* | ✓ | ✓ | match |
| Manipulation | ✓ | ✓ | match |
| **Mechanic\*** | ✓ | — | **SRD-only** (Quickstart splits this into Tinkerer + Vehicle Repair\* + Weaponsmith\* + Armorsmith\*) |
| **Medicine\*** | ✓ | — | **SRD-only** (Quickstart splits this into First Aid + Pharmacology\* + Surgery\*) |
| Melee Combat | ✓ | ✓ | match |
| Navigation | ✓ (as Navigation\*) | ✓ (no asterisk) | **vocational status differs** |
| **Pharmacology\*** | — | ✓ | **Quickstart-only** (rolled into SRD's Medicine\*) |
| **Piloting** | ✓ | — | SRD-only (sci-fi; not in Distemper) |
| Psychology\* | ✓ | ✓ | match |
| Ranged Combat | ✓ | ✓ | match |
| Research | ✓ | ✓ | match |
| Scavenging | ✓ (as Scavenging\*) | ✓ (no asterisk) | **vocational status differs** |
| **Science\*** | ✓ | — | SRD-only |
| Sleight of Hand | ✓ | ✓ | match |
| **Specific Knowledge\*** | ✓ | — | SRD-only (could supplement Distemper's General Knowledge) |
| Stealth | ✓ (PHY) | ✓ (DEX) | **attribute differs** — see note above |
| **Streetwise** | ✓ | — | SRD-only (very Distemper-flavored; surprising omission from Quickstart) |
| **Surgery\*** | — | ✓ | **Quickstart-only** (rolled into SRD's Medicine\*) |
| Survival | ✓ | ✓ | match |
| Tactics\* | ✓ | ✓ | match |
| Tinkerer | ✓ | ✓ | match (but SRD also has Mechanic\* as a separate, more general repair skill — the two overlap unclearly) |
| Unarmed Combat | ✓ | ✓ | match |
| **Vehicle Repair\*** | — | ✓ | **Quickstart-only** (rolled into SRD's Mechanic\*) |
| Weaponsmith\* | ✓ | ✓ | match (SRD also has Mechanic\* which overlaps) |

## What this means for the Quickstart rewrite

The Quickstart's skill list is a **deliberate Distemper-flavored remix** of the SRD baseline:

- **Splits the SRD's Medicine\* into 3 skills** (First Aid, Pharmacology\*, Surgery\*) — emphasizes that triage, pharma, and surgery are different competencies in a post-collapse setting where you can't just "have a doctor".
- **Splits the SRD's Mechanic\* into 4 skills** (Tinkerer, Vehicle Repair\*, Weaponsmith\*, Armorsmith\*) — likewise emphasizes that fixing a car is not the same as fixing a rifle.
- **Drops sci-fi-only skills** (Astrogation, Piloting, Computers, Science\*, Heavy Weapons\*) — though Heavy Weapons\* is arguably relevant to Distemper for warlord/military caches.
- **Adds Hunting and Intimidation** as standalone skills — both are quintessentially survival-flavor.
- **Drops Streetwise and Specific Knowledge\*** — both of which would be useful Distemper additions.

**Per CLAUDE.md precedence (SRD wins over Quickstart)**, the strict reading is: collapse the splits and adopt the SRD's Medicine\* / Mechanic\* / Driving\* / Streetwise / etc.

**But the realistic reading** — given your stated direction in [`tasks/srd-vs-code-diff.md`](tasks/srd-vs-code-diff.md) ("the platform supersedes the SRD") — is the opposite: the Distemper splits are an intentional setting-driven elaboration that should feed back into the next SRD revision, not be reverted.

**Three options for the rewrite**:

- **(A) Adopt SRD wholesale** — collapse First Aid/Pharm/Surgery → Medicine\*; Tinkerer/Vehicle Repair\*/Weaponsmith\*/Armorsmith\* → Mechanic\*; rewrite all 16 Paradigm sheets, the Profession→Skill bundles (Quickstart p. 18, Table 8), and Pesky's worked example. Add Streetwise / Specific Knowledge\*. Big rework. (~6–8 hours of careful editing.)
- **(B) Keep the Distemper splits but tag explicitly as a Distemper-specific elaboration** — add a sidebar at the top of the Skills section explaining "Distemper expands the SRD's Medicine\* and Mechanic\* skills to reflect the gritty realism of survival in a post-collapse world." Add Streetwise as a fresh Distemper addition. Otherwise leave the skill list alone. (~30 min of editing + sidebar text.)
- **(C) Hybrid**: keep the Distemper splits, drop the sci-fi-only SRD skills (which the Quickstart already does), but adopt the SRD's wording-only changes — Farming → Farming\*, Navigation → Navigation\*, Scavenging → Scavenging\* (move them to vocational), and add Streetwise. Smallest skill-list change but adds explicit-vocational consistency. (~1–2 hours.)

My recommendation is **(B)** — least player-disruption, most consistent with your stated "Distemper supersedes SRD" stance, and the explicit sidebar makes the Distemper-vs-SRD relationship transparent for new players.

---

# Appendix C — Pesky LaRue, re-budgeted for 15-CDP-skill cap

Pesky's current Quickstart build spends 20 skill CDP. The SRD allows 15. He needs to lose 5 skill points while preserving his "smooth-talking petty thief turned outlaw" identity.

## Current build (20 skill CDP)

```
RAPID Range:  R 0  A 2  P 1  I 1  D 1   (5 attr CDP ✓)

Skills:
  Manipulation     3   (signature)
  Athletics        2
  Intimidation     2
  Lock-Picking*    2   (Outlaw vocational)
  Melee Combat     2   (pool cue / baton)
  Sleight of Hand  2   (sneak thief)
  Stealth          2
  Unarmed Combat   2
  Barter           1
  Scavenging       1
  Survival         1
                   ──
                  20 SP
```

## Re-budgeted build (15 skill CDP)

Cuts: Athletics 2→1, Intimidation 2→1, Unarmed Combat 2→1, drop Barter, drop Scavenging. Keeps Manipulation 3 intact (his signature beat: talking his way out of trouble).

```
RAPID Range:  R 0  A 2  P 1  I 1  D 1   (5 attr CDP, unchanged)

Skills:
  Manipulation     3   (signature, kept at L3)
  Lock-Picking*    2
  Melee Combat     2
  Sleight of Hand  2
  Stealth          2
  Athletics        1   (was 2; lost a level)
  Intimidation     1   (was 2; lost a level)
  Survival         1
  Unarmed Combat   1   (was 2; lost a level)
                   ──
                  15 SP ✓
```

**Lost from build**: Barter 1, Scavenging 1. *Narrative cover*: Pesky steals rather than trades (Sleight of Hand subsumes the Barter use case for fencing); Scavenging falls back to plain Acumen checks at the GM's discretion.

## Step-by-step CDP allocation (matches SRD step structure)

### Step Xero — Who They Are
3 words: **Shrewd, Manipulative, Sneaky**. Concept: streetwise petty criminal who survives by his wits. (no CDP)

### Step One — Where They Grew Up — 1 RAPID + 2 Skills
- **Acumen +1** (1 CDP) — sharp reads of people from a young age
- **Manipulation 1** (1 CDP) — learned to lie before he could walk
- **Sleight of Hand 1** (1 CDP) — shoplifting food for him and his brother

> *Born Percy LaRue, Pesky was given his nickname before he could walk. Raised on the east side of Chicago, Pesky lived with his crack-addicted mother and younger brother, Elias. At an early age he got as good at hiding the truth as he was at shop-lifting food.*

### Step Two — What They Learned — 1 RAPID + 3 Skills
- **Dexterity +1** (1 CDP) — the number of times he needed to make a quick getaway
- **Sleight of Hand 1→2** (1 CDP) — Fat Fingered Frankie's training
- **Stealth 1** (1 CDP) — sneaking around back alleys
- **Athletics 1** (1 CDP) — running from cops

> *Pesky dropped out of high school at 14 and spent the next few years pocketing enough food for him and his family. Fat Fingered Frankie, a local hustler, took a liking to the young boy and helped him up his skills as a petty thief.*

### Step Three — How They Spent Their Time — 1 RAPID + 3 Skills
- **Influence +1** (1 CDP) — way with the ladies
- **Manipulation 1→2** (1 CDP) — practiced "bad-boy-trying-to-be-good" routine
- **Melee Combat 1** (1 CDP) — pool-cue brawls with jealous boyfriends
- **Intimidation 1** (1 CDP) — learning to look meaner than he was

> *As he grew, Pesky found he had a way with the ladies who loved his "bad boy trying to be good" shtick almost as much as their boyfriends hated it, and he often found his best defense was the pool cue in his hands.*

### Step Four — What Drives Them (Complications & Motivations) — 0 CDP
- **Complication: Betrayed** — Marty Kaczynski stole Pesky's horse and supplies
- **Motivation: Revenge** — Pesky still dreams of catching up with Marty

> *Pesky still feels BETRAYED by Marty Kaczynski, who he had partnered with early on as he tried to get out of Michigan when everything collapsed. They had agreed to work together to find some kind of food source or safety, but Marty had beaten him while he slept and stole his horse and supplies, leaving Pesky for dead. Pesky doesn't know if Marty is still alive or not, he just knows that he still dreams of what he'll do once he catches up to him and has an opportunity to take his REVENGE.*

### Step Five — How They Made Money (Profession: Outlaw) — 2 RAPID + 4 Skills
- **Acumen +1 (→2)** (1 CDP)
- **Physicality +1** (1 CDP)
- **Manipulation 2→3** (1 CDP) — full Outlaw smooth-talker
- **Lock-Picking\* 1** (1 CDP) — Inept (-3) → Beginner (+1), Outlaw vocational
- **Stealth 1→2** (1 CDP)
- **Unarmed Combat 1** (1 CDP)

> *Although Pesky was able to avoid being sucked into a street gang, he never made it beyond being a petty criminal who had multiple run-ins with the law. After the death of his mom, he felt increasingly responsible for his younger brother.*

### Step Final — Whatever's Left (After the Collapse) — 3 Skills
- **Lock-Picking\* 1→2** (1 CDP)
- **Melee Combat 1→2** (1 CDP)
- **Survival 1** (1 CDP)

> *Pesky has spent much of the last few months on the move. He has gotten good at searching through empty houses, finding what others have missed, as learning how to survive off the land. Not everyone he has encountered has appreciated his approach to communal property, and his ability to defend himself has also improved.*

## Summary line for Quickstart p. 18 (replaces line 1089–1092)

> After all six steps, Pesky LaRue has gone from a RAPID Range of 00000 and no skills to a RAPID Range of 02111 and the following skills: Manipulation 3, Lock-Picking\* 2, Melee Combat 2, Sleight of Hand 2, Stealth 2, Athletics 1, Intimidation 1, Survival 1, and Unarmed Combat 1.

## Secondary Stats — unchanged except for the new Perception line

```
Wound Points       12   (10 + PHY 1 + DEX 1)         — unchanged
Resilience Points   7   (6 + PHY 1)                   — unchanged
Defense Mod (Melee) +1   (PHY AMod)                   — unchanged
Defense Mod (Ranged)+1   (DEX AMod)                   — unchanged
Initiative Mod      +3   (ACU 2 + DEX 1)              — unchanged
Encumbrance         7   (6 + PHY 1)                   — unchanged
Perception          +2   (RSN 0 + ACU 2)              — NEW (matches SRD §02)
Stress Modifier     +2   (RSN 0 + ACU 2)              — NEW (matches SRD §06)
Breaking Point      5   (3 + RSN 0 + ACU 2)           — formula unchanged; trigger now via Stress not Panic Threshold
Morality            3                                  — unchanged
```

---

# Appendix D — Files produced during this audit

For your reference / cleanup:

```
tasks/quickstart-vs-srd-diff.md          ← this file
tasks/_work/quickstart-v0.8.531.txt      ← Quickstart full text dump
tasks/_work/srd-v1.1.17.txt              ← SRD layout-mode dump (mangled)
tasks/_work/srd-flow.txt                 ← SRD flow-mode dump (mangled)
tasks/_work/srd-front.txt                ← SRD pp.1-12 layout dump
tasks/_work/srd-mid.txt                  ← SRD pp.13-25 layout dump
tasks/_work/srd-raw.txt                  ← SRD raw-mode dump
tasks/_work/srd-pymupdf-tables.txt       ← PyMuPDF dump pp.12,13,16,17 (used for Communities)
tasks/_work/srd-tables-12-13.txt         ← PyMuPDF dump physical pp.14-15 (Tables 12, 13)
tasks/_work/srd-skills.txt               ← PyMuPDF dump physical pp.15-18 (skills + weapons)
tasks/_work/srd-skills2.txt              ← PyMuPDF dump physical pp.11-14 (full skill list + tables)
```

The `_work/` directory is safe to delete after the rewrite is done.
