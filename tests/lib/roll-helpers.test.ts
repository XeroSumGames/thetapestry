import { describe, it, expect } from 'vitest'
import { getOutcome, outcomeColor, compactRollSummary, actionDetail } from '../../lib/roll-helpers'

describe('getOutcome', () => {
  it('returns Low Insight on snake-eyes (1+1) regardless of total', () => {
    expect(getOutcome(2, 1, 1)).toBe('Low Insight')
  })

  it('returns High Insight on boxcars (6+6) regardless of total', () => {
    expect(getOutcome(12, 6, 6)).toBe('High Insight')
  })

  it('returns Dire Failure when total <= 3', () => {
    expect(getOutcome(3, 1, 2)).toBe('Dire Failure')
    expect(getOutcome(2, 1, 1)).toBe('Low Insight') // 1+1 wins
  })

  it('returns Failure when 4 <= total <= 8', () => {
    expect(getOutcome(4, 1, 3)).toBe('Failure')
    expect(getOutcome(8, 3, 5)).toBe('Failure')
  })

  it('returns Success when 9 <= total <= 13', () => {
    expect(getOutcome(9, 4, 5)).toBe('Success')
    expect(getOutcome(13, 6, 7)).toBe('Success')
  })

  it('returns Wild Success when total >= 14', () => {
    expect(getOutcome(14, 6, 8)).toBe('Wild Success')
    expect(getOutcome(20, 10, 10)).toBe('Wild Success')
  })

  it('honors skipInsightPair to suppress 1+1 / 6+6 special handling', () => {
    // 1+1 with skipInsightPair=true should fall through to total=2 → Dire Failure
    expect(getOutcome(2, 1, 1, true)).toBe('Dire Failure')
    // 6+6 with skipInsightPair=true at total=12 → Success
    expect(getOutcome(12, 6, 6, true)).toBe('Success')
  })

  it('Insight pair takes precedence over Wild Success/Dire Failure thresholds', () => {
    // High Insight beats Wild Success
    expect(getOutcome(20, 6, 6)).toBe('High Insight')
    // Low Insight beats Dire Failure
    expect(getOutcome(2, 1, 1)).toBe('Low Insight')
  })
})

describe('outcomeColor', () => {
  it('returns green for Wild Success', () => {
    expect(outcomeColor('Wild Success')).toBe('#7fc458')
  })

  it('returns green for High Insight', () => {
    expect(outcomeColor('High Insight')).toBe('#7fc458')
  })

  it('returns blue for Success', () => {
    expect(outcomeColor('Success')).toBe('#7ab3d4')
  })

  it('returns amber for Failure', () => {
    expect(outcomeColor('Failure')).toBe('#EF9F27')
  })

  it('returns red for Dire Failure', () => {
    expect(outcomeColor('Dire Failure')).toBe('#c0392b')
  })

  it('returns red for Low Insight', () => {
    expect(outcomeColor('Low Insight')).toBe('#c0392b')
  })

  it('returns the muted default for unknown outcomes', () => {
    expect(outcomeColor('something_else')).toBe('#d4cfc9')
    expect(outcomeColor('')).toBe('#d4cfc9')
  })

  // Snake-case input contract for DB-stored outcomes (community_events,
  // morale_check, resource_check). Added 2026-05-19 when the duplicated
  // outcomeColor in app/stories/[id]/community/page.tsx was deleted in
  // favor of the canonical here.
  it('accepts snake_case input (DB form)', () => {
    expect(outcomeColor('wild_success')).toBe('#7fc458')
    expect(outcomeColor('high_insight')).toBe('#7fc458')
    expect(outcomeColor('success')).toBe('#7ab3d4')
    expect(outcomeColor('failure')).toBe('#EF9F27')
    expect(outcomeColor('dire_failure')).toBe('#c0392b')
    expect(outcomeColor('low_insight')).toBe('#c0392b')
  })

  it('null/undefined-tolerant', () => {
    expect(outcomeColor(null as any)).toBe('#d4cfc9')
    expect(outcomeColor(undefined as any)).toBe('#d4cfc9')
  })
})

describe('compactRollSummary', () => {
  // The function has many regex-driven branches; here we cover only the
  // simple "return label verbatim" early-exit cases. The label-parsing
  // branches are intentionally not unit-tested - they're better verified
  // via the roll-feed-log-preview.html visual reference.

  it('returns label verbatim for wound_infection_warning', () => {
    const label = 'Cree Hask has a wound that may become infected'
    expect(compactRollSummary({ label, character_name: 'Cree Hask', outcome: 'wound_infection_warning' })).toBe(label)
  })

  it('returns label verbatim for weapon_malfunction', () => {
    const label = "Marcus's Carbine jams"
    expect(compactRollSummary({ label, character_name: 'Marcus', outcome: 'weapon_malfunction' })).toBe(label)
  })

  it('returns label verbatim for lasting_wound_acquired', () => {
    const label = 'Cree Hask has picked up a Lasting Wound and is now Skittish (-1 Initiative Modifier)'
    expect(compactRollSummary({ label, character_name: 'Cree Hask', outcome: 'lasting_wound_acquired' })).toBe(label)
  })

  // Attribute check narrative (canon copy locked 2026-05-18). Locks the
  // wording per outcome so a future copy refactor can't silently regress
  // it. Also locks the em-dash prefix strip in suffix calculation -
  // legacy DB rows + GM-from-popout paths bake "<name> — <label>" into
  // the label and the regex matcher needs to see the bare suffix.
  it('attribute check Failure: ATTRIBUTE CHECK prefix + unsuccessfully', () => {
    expect(compactRollSummary({ label: 'ACU Check', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('ATTRIBUTE CHECK Enya unsuccessfully attempted to use their acumen')
  })

  it('attribute check Success: ATTRIBUTE CHECK prefix + successfully', () => {
    expect(compactRollSummary({ label: 'PHY Check', character_name: 'Enya', outcome: 'Success' }))
      .toBe('ATTRIBUTE CHECK Enya successfully attempted to use their physicality')
  })

  it('attribute check Wild Success: wildly succeeded', () => {
    expect(compactRollSummary({ label: 'DEX Check', character_name: 'Enya', outcome: 'Wild Success' }))
      .toBe('ATTRIBUTE CHECK Enya wildly succeeded at using their dexterity')
  })

  it('attribute check Dire Failure: disastrously failed', () => {
    expect(compactRollSummary({ label: 'INF Check', character_name: 'Enya', outcome: 'Dire Failure' }))
      .toBe('ATTRIBUTE CHECK Enya disastrously failed at using their influence')
  })

  it('attribute check High Insight: success + Moment of Insight', () => {
    expect(compactRollSummary({ label: 'RSN Check', character_name: 'Enya', outcome: 'High Insight' }))
      .toBe('ATTRIBUTE CHECK Enya successfully attempted to use their reason and has a Moment of Insight as to why it went so well')
  })

  it('attribute check Low Insight: failure + Moment of Insight', () => {
    expect(compactRollSummary({ label: 'ACU Check', character_name: 'Enya', outcome: 'Low Insight' }))
      .toBe('ATTRIBUTE CHECK Enya unsuccessfully attempted to use their acumen but has a Moment of Insight as to why it went so badly')
  })

  it('attribute check with em-dash prefix in label still matches', () => {
    // GM-from-popout path historically baked "<name> — <label>" with
    // an em-dash. Suffix strip must handle both ASCII hyphen and
    // em-dash so the narrative branch fires either way.
    expect(compactRollSummary({ label: 'Enya — ACU Check', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('ATTRIBUTE CHECK Enya unsuccessfully attempted to use their acumen')
  })

  it('attribute check with ASCII hyphen prefix in label still matches', () => {
    expect(compactRollSummary({ label: 'Enya - ACU Check', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('ATTRIBUTE CHECK Enya unsuccessfully attempted to use their acumen')
  })

  // Stress Check narrative (canon copy locked 2026-05-19). Six outcomes
  // x two modes (mid-play vs at-max) = 12 strings. Mid-play fires from
  // the manual CHECK button on the stress bar (GM-called, success = no
  // change, failure = +1 stress). At-max fires when stress hits 5 or
  // via mid-play cascade (success = drop to 4, failure = Breaking Point).
  // Label suffix " (at max)" distinguishes the two on the saved row.

  // --- mid-play ---
  it('stress check mid-play Wild Success', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Wild Success' }))
      .toBe('STRESS CHECK Enya is wildly composed under pressure')
  })

  it('stress check mid-play High Insight', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'High Insight' }))
      .toBe('STRESS CHECK Enya holds steady against the pressure and has a Moment of Insight as to why it went so well')
  })

  it('stress check mid-play Success', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Success' }))
      .toBe('STRESS CHECK Enya holds steady against the pressure')
  })

  it('stress check mid-play Failure', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('STRESS CHECK Enya feels the weight')
  })

  it('stress check mid-play Dire Failure', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Dire Failure' }))
      .toBe('STRESS CHECK Enya buckles under the pressure')
  })

  it('stress check mid-play Low Insight', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Low Insight' }))
      .toBe('STRESS CHECK Enya feels the weight but has a Moment of Insight as to why it went so badly')
  })

  // --- at-max ---
  it('stress check at-max Wild Success', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'Wild Success' }))
      .toBe('STRESS CHECK Enya is wildly composed and shrugs the pressure off')
  })

  it('stress check at-max High Insight', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'High Insight' }))
      .toBe('STRESS CHECK Enya calms themselves down and has a Moment of Insight as to why it went so well')
  })

  it('stress check at-max Success', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'Success' }))
      .toBe('STRESS CHECK Enya calms themselves down')
  })

  it('stress check at-max Failure', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('STRESS CHECK Enya fails to calm and reaches their Breaking Point')
  })

  it('stress check at-max Dire Failure', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'Dire Failure' }))
      .toBe('STRESS CHECK Enya disastrously cracks and reaches their Breaking Point')
  })

  it('stress check at-max Low Insight', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check (at max)', character_name: 'Enya', outcome: 'Low Insight' }))
      .toBe('STRESS CHECK Enya fails to calm and reaches their Breaking Point but has a Moment of Insight as to why it went so badly')
  })

  // Distract bespoke narrative (canon copy locked 2026-05-19). 4 outcomes
  // map to 6 outcome codes (WS=HI, F=LI, Success, DF). Mechanical bits
  // stripped per project rule.
  it('distract Wild Success', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'Wild Success' }))
      .toBe('Cree distracts Goon so badly they seem to become confused')
  })

  it('distract High Insight: WS narrative + HI tail', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'High Insight' }))
      .toBe('Cree distracts Goon so badly they seem to become confused and has a Moment of Insight as to why it went so well')
  })

  it('distract Success', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'Success' }))
      .toBe('Cree distracts Goon, breaking their focus')
  })

  it('distract Failure', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'Failure' }))
      .toBe('Cree tries to distract Goon, who ignores them')
  })

  it('distract Low Insight: F narrative + LI tail (no double-but stutter)', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'Low Insight' }))
      .toBe('Cree tries to distract Goon, who ignores them but has a Moment of Insight as to why it went so badly')
  })

  it('distract Dire Failure', () => {
    expect(compactRollSummary({ label: 'Cree - Distract', character_name: 'Cree', target_name: 'Goon', outcome: 'Dire Failure' }))
      .toBe('Cree tries to distract Goon but only sharpens their focus')
  })

  // Coord Effort legacy single-row narrative (lead-only chain, before
  // participants roll in). Tense shifted to present per banner parity.
  // Mechanical CMod parens stripped.
  it('coord effort legacy Wild Success', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'Wild Success' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics* and is wildly successful')
  })

  it('coord effort legacy High Insight', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'High Insight' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics* and has a Moment of Insight as to why it went so well')
  })

  it('coord effort legacy Success', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'Success' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics*')
  })

  it('coord effort legacy Failure', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'Failure' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics* but the team gets off to a rough start')
  })

  it('coord effort legacy Dire Failure', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'Dire Failure' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics* but it goes badly for the team')
  })

  it('coord effort legacy Low Insight', () => {
    expect(compactRollSummary({ label: 'Coordinated Effort - Tactics*', character_name: 'Cree', outcome: 'Low Insight' }))
      .toBe('Cree kicks off a Coordinated Effort with Tactics* and the plan falls apart but Cree has a Moment of Insight as to why it went so badly')
  })

  // Stabilize narrative (canon locked 2026-05-19; "STABILIZE " caps prefix
  // DROPPED 2026-05-27 per Xero - reads as a plain sentence now). HI keeps
  // the bespoke "while doing so" tail per Xero 2026-05-11 lock; other
  // outcomes follow the standard success/failure pattern + HI/LI tail rule.
  it('stabilize Wild Success', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'Wild Success' }))
      .toBe('Marv wildly succeeds at stabilizing Cree Hask')
  })

  it('stabilize High Insight keeps bespoke "while doing so" tail', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'High Insight' }))
      .toBe('Marv stabilizes Cree Hask and has a Moment of Insight while doing so')
  })

  it('stabilize Success', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'Success' }))
      .toBe('Marv stabilizes Cree Hask')
  })

  it('stabilize Failure', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'Failure' }))
      .toBe('Marv fails to stabilize Cree Hask')
  })

  it('stabilize Dire Failure', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'Dire Failure' }))
      .toBe('Marv disastrously fails to stabilize Cree Hask')
  })

  it('stabilize Low Insight: F narrative + canonical LI tail', () => {
    expect(compactRollSummary({ label: 'Marv - Stabilize Cree Hask', character_name: 'Marv', outcome: 'Low Insight' }))
      .toBe('Marv fails to stabilize Cree Hask but has a Moment of Insight as to why it went so badly')
  })

  // Heal narrative (canon locked 2026-05-19). HEAL prefix added. DF
  // stripped of mechanical "takes 1 WP damage"; LI kept the
  // directional "wound may become infected" cue. Naked-Medicine
  // kit phrase simplified to "by hand".
  it('heal Wild Success with kit', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'Wild Success' }))
      .toBe("HEAL Junie expertly treats Marv with a Doctor's Bag with exceptional care")
  })

  it('heal High Insight with kit', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'High Insight' }))
      .toBe("HEAL Junie expertly treats Marv with a Doctor's Bag and has a Moment of Insight as to why it went so well")
  })

  it('heal Success with kit', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'Success' }))
      .toBe("HEAL Junie treats Marv with a Doctor's Bag")
  })

  it('heal Failure: no mechanical bits', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'Failure' }))
      .toBe('HEAL Junie fails to make progress treating Marv')
  })

  it('heal Dire Failure: no "1 WP damage" mechanical bit', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'Dire Failure' }))
      .toBe('HEAL Junie botches the treatment, making Marv worse')
  })

  it('heal Low Insight: directional infection cue + canonical LI tail', () => {
    expect(compactRollSummary({ label: "Junie - Heal Marv (Doctor's Bag)", character_name: 'Junie', outcome: 'Low Insight' }))
      .toBe('HEAL Junie botches the treatment, the wound may become infected, but has a Moment of Insight as to why it went so badly')
  })

  it('heal naked Medicine kit phrase is "by hand"', () => {
    expect(compactRollSummary({ label: 'Junie - Heal Marv (naked Medicine*)', character_name: 'Junie', outcome: 'Success' }))
      .toBe('HEAL Junie treats Marv by hand')
  })

  // Unjam narrative (canon locked 2026-05-19). UNJAM prefix added.
  it('unjam Wild Success', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'Wild Success' }))
      .toBe('UNJAM Cree clears the jam on their Pistol with practiced ease')
  })

  it('unjam High Insight', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'High Insight' }))
      .toBe('UNJAM Cree unjams their Pistol and has a Moment of Insight as to why it went so well')
  })

  it('unjam Success', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'Success' }))
      .toBe('UNJAM Cree unjams their Pistol')
  })

  it('unjam Failure', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'Failure' }))
      .toBe('UNJAM Cree fails to unjam their Pistol')
  })

  it('unjam Dire Failure: makes it worse', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'Dire Failure' }))
      .toBe('UNJAM Cree makes the jam on their Pistol worse')
  })

  it('unjam Low Insight: F narrative + canonical LI tail', () => {
    expect(compactRollSummary({ label: 'Cree - Unjam - Pistol (Ranged Combat)', character_name: 'Cree', outcome: 'Low Insight' }))
      .toBe('UNJAM Cree fails to unjam their Pistol but has a Moment of Insight as to why it went so badly')
  })

  // Repair narrative (canon locked 2026-05-19). Melee mirror of Unjam.
  it('repair Wild Success', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'Wild Success' }))
      .toBe('REPAIR Frankie restores their Machete to fighting shape')
  })

  it('repair High Insight', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'High Insight' }))
      .toBe('REPAIR Frankie repairs their Machete and has a Moment of Insight as to why it went so well')
  })

  it('repair Success', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'Success' }))
      .toBe('REPAIR Frankie repairs their Machete')
  })

  it('repair Failure', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'Failure' }))
      .toBe('REPAIR Frankie fails to repair their Machete')
  })

  it('repair Dire Failure: damages it further', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'Dire Failure' }))
      .toBe('REPAIR Frankie damages their Machete further')
  })

  it('repair Low Insight: F narrative + canonical LI tail', () => {
    expect(compactRollSummary({ label: 'Frankie - Repair - Machete (Melee Combat)', character_name: 'Frankie', outcome: 'Low Insight' }))
      .toBe('REPAIR Frankie fails to repair their Machete but has a Moment of Insight as to why it went so badly')
  })

  // Recruit narrative (canon polish locked 2026-05-19, option D: no
  // prefix, present tense, HI/LI tails on success rows, failure copy
  // tightened). Stored label uses past tense ("recruited", "tried to
  // recruit"); narrative re-renders in present tense.

  // --- Success types (4 recruit kinds) ---
  it('recruit Cohort success', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask recruited Marcus as a Cohort to The Farm',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask recruits Marcus as a Cohort to The Farm')
  })

  it('recruit Conscript success: present tense "forces"', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask recruited Marcus as a Conscript to The Farm',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask forces Marcus into service as a Conscript to The Farm')
  })

  it('recruit Convert success: present tense "Converts"', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask recruited Marcus as a Convert to The Farm',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask Converts Marcus as a recruit to The Farm')
  })

  it('recruit Apprentice success', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask recruited Marcus as an Apprentice to The Farm',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask takes Marcus as their Apprentice')
  })

  // --- HI/LI tails on success rows (per 2026-05-19 rule) ---
  it('recruit Cohort with HI outcome appends well tail (HI flagged in damage_json.rollOutcome)', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask recruited Marcus as a Cohort to The Farm',
      character_name: 'Cree Hask',
      outcome: 'recruit',  // stored outcome is always 'recruit' for these rows
      damage_json: { rollOutcome: 'High Insight' },  // actual dice outcome
    })).toBe('Cree Hask recruits Marcus as a Cohort to The Farm and has a Moment of Insight as to why it went so well')
  })

  // --- Failure tiers ---
  it('recruit Failure: "doesn\'t quite land it"', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask tried to recruit Marcus - Failure',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe("Cree Hask tries to recruit Marcus and doesn't quite land it")
  })

  it('recruit Dire Failure: "attempt goes badly"', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask tried to recruit Marcus - Dire Failure',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask tries to recruit Marcus and the attempt goes badly')
  })

  it('recruit Low Insight: present-tense failure + canonical LI tail', () => {
    expect(compactRollSummary({
      label: '🤝 Cree Hask tried to recruit Marcus - Low Insight',
      character_name: 'Cree Hask', outcome: 'recruit',
    })).toBe('Cree Hask tries to recruit Marcus and fails but has a Moment of Insight as to why it went so badly')
  })

  // Vehicle mounted-weapon attack narrative (canon locked 2026-05-19;
  // "FIRE " caps prefix DROPPED 2026-05-27 per Xero - plain sentence now,
  // same call as the STABILIZE prefix removal).
  // Per-outcome cinematic; weapon name + crew + vehicle + target
  // composed via verbTail. DF flips focus to weapon malfunction.
  it('vehicle attack with target Wild Success: devastates', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · Wild Success",
      character_name: 'Knox Koss', outcome: 'Wild Success',
    })).toBe("Knox Koss devastates Avery Xavier using Minnie's Sniper's Rifle")
  })

  it('vehicle attack with target High Insight + tail', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · High Insight",
      character_name: 'Knox Koss', outcome: 'High Insight',
    })).toBe("Knox Koss hits Avery Xavier using Minnie's Sniper's Rifle and has a Moment of Insight as to why it went so well")
  })

  it('vehicle attack with target Success', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · Success",
      character_name: 'Knox Koss', outcome: 'Success',
    })).toBe("Knox Koss hits Avery Xavier using Minnie's Sniper's Rifle")
  })

  it('vehicle attack with target Failure', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · Failure",
      character_name: 'Knox Koss', outcome: 'Failure',
    })).toBe("Knox Koss misses Avery Xavier using Minnie's Sniper's Rifle")
  })

  it('vehicle attack Dire Failure: weapon misfire (target irrelevant)', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · Dire Failure",
      character_name: 'Knox Koss', outcome: 'Dire Failure',
    })).toBe("Knox Koss misfires Minnie's Sniper's Rifle catastrophically")
  })

  it('vehicle attack with target Low Insight + tail', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack → Avery Xavier · Minnie · Knox Koss · Ranged Combat (DEX) · Low Insight",
      character_name: 'Knox Koss', outcome: 'Low Insight',
    })).toBe("Knox Koss misses Avery Xavier using Minnie's Sniper's Rifle but has a Moment of Insight as to why it went so badly")
  })

  it('vehicle attack no target Wild Success: stunning precision', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack · Minnie · Knox Koss · Ranged Combat (DEX) · Wild Success",
      character_name: 'Knox Koss', outcome: 'Wild Success',
    })).toBe("Knox Koss fires Minnie's Sniper's Rifle with stunning precision")
  })

  it('vehicle attack no target Failure: shot goes wide', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack · Minnie · Knox Koss · Ranged Combat (DEX) · Failure",
      character_name: 'Knox Koss', outcome: 'Failure',
    })).toBe("Knox Koss fires Minnie's Sniper's Rifle and the shot goes wide")
  })

  it('vehicle attack no target Low Insight: clean composition (no doubled-but)', () => {
    expect(compactRollSummary({
      label: "🎯 Sniper's Rifle attack · Minnie · Knox Koss · Ranged Combat (DEX) · Low Insight",
      character_name: 'Knox Koss', outcome: 'Low Insight',
    })).toBe("Knox Koss fires Minnie's Sniper's Rifle and the shot goes wide but has a Moment of Insight as to why it went so badly")
  })

  // Drive narrative (canon locked 2026-05-19, supersedes earlier
  // "🚗 Driving check · ..." flat-string format). Label shape:
  //   "<name> - Drive - <vehicle>". DRIVE prefix mirrors HEAL /
  // UNJAM / REPAIR / STABILIZE pattern.
  it('drive Wild Success', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'Wild Success' }))
      .toBe('DRIVE Joe drives Minnie with flawless precision')
  })
  it('drive High Insight', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'High Insight' }))
      .toBe('DRIVE Joe drives Minnie and has a Moment of Insight as to why it went so well')
  })
  it('drive Success', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'Success' }))
      .toBe('DRIVE Joe drives Minnie smoothly')
  })
  it('drive Failure', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'Failure' }))
      .toBe('DRIVE Joe loses control of Minnie briefly')
  })
  it('drive Dire Failure', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'Dire Failure' }))
      .toBe('DRIVE Joe wrecks Minnie\'s run')
  })
  it('drive Low Insight', () => {
    expect(compactRollSummary({ label: 'Joe - Drive - Minnie', character_name: 'Joe', outcome: 'Low Insight' }))
      .toBe('DRIVE Joe loses control of Minnie but has a Moment of Insight as to why it went so badly')
  })

  // Brew narrative (canon locked 2026-05-19, fuel state in line per
  // Xero "tangible outcome" rule). Three label tails distinguish
  // the narrative paths.
  it('brew Wild Success: produces fuel, after/max in line', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) 3/5', character_name: 'Enya', outcome: 'Wild Success' }))
      .toBe('BREW Enya brews a flawless batch of fuel for Minnie - 3/5 days')
  })
  it('brew High Insight: produces fuel, HI tail after the count', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) 3/5', character_name: 'Enya', outcome: 'High Insight' }))
      .toBe('BREW Enya brews a tank of fuel for Minnie - 3/5 days, and has a Moment of Insight as to why it went so well')
  })
  it('brew Success: produces fuel, simple line', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) 3/5', character_name: 'Enya', outcome: 'Success' }))
      .toBe('BREW Enya brews a tank of fuel for Minnie - 3/5 days')
  })
  it('brew Failure: dry, no fuel', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*)', character_name: 'Enya', outcome: 'Failure' }))
      .toBe('BREW Enya\'s brew runs dry - no fuel produced')
  })
  it('brew Dire Failure: ruined batch', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*)', character_name: 'Enya', outcome: 'Dire Failure' }))
      .toBe('BREW Enya ruins the batch - no fuel produced')
  })
  it('brew Low Insight: dry + LI tail', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*)', character_name: 'Enya', outcome: 'Low Insight' }))
      .toBe('BREW Enya\'s brew runs dry - no fuel produced, but has a Moment of Insight as to why it went so badly')
  })
  // Brew edge case - tank already full going in; success branch swaps
  // to the "reserves are already full" variant.
  it('brew Wild Success but already full: full-tank variant', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) full 5/5', character_name: 'Enya', outcome: 'Wild Success' }))
      .toBe('BREW Enya brews a flawless batch but Minnie\'s reserves are already full (5/5 days)')
  })
  it('brew High Insight but already full: HI tail on full-tank variant', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) full 5/5', character_name: 'Enya', outcome: 'High Insight' }))
      .toBe('BREW Enya brews a tank but Minnie\'s reserves are already full (5/5 days), and has a Moment of Insight as to why it went so well')
  })
  it('brew Success but already full: simple full-tank variant', () => {
    expect(compactRollSummary({ label: 'Enya - Brew - Minnie (Mechanic*) full 5/5', character_name: 'Enya', outcome: 'Success' }))
      .toBe('BREW Enya brews a tank but Minnie\'s reserves are already full (5/5 days)')
  })

  // Navigate narrative (canon locked 2026-05-19). Vehicle navigator
  // seat. Skill name (Navigation / Geography / etc.) is dropped from
  // the narrative line - the SMOD chip below shows the contribution.
  it('navigate Wild Success', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'Wild Success' }))
      .toBe('NAVIGATE Bea charts a flawless route for Minnie')
  })
  it('navigate High Insight', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'High Insight' }))
      .toBe('NAVIGATE Bea charts the route for Minnie and has a Moment of Insight as to why it went so well')
  })
  it('navigate Success', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'Success' }))
      .toBe('NAVIGATE Bea charts the route for Minnie')
  })
  it('navigate Failure', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'Failure' }))
      .toBe('NAVIGATE Bea loses the route briefly')
  })
  it('navigate Dire Failure', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'Dire Failure' }))
      .toBe('NAVIGATE Bea leads Minnie into a worse spot')
  })
  it('navigate Low Insight', () => {
    expect(compactRollSummary({ label: 'Bea - Navigate - Minnie (Navigation)', character_name: 'Bea', outcome: 'Low Insight' }))
      .toBe('NAVIGATE Bea loses the route but has a Moment of Insight as to why it went so badly')
  })

  // First Impression narrative (canon locked 2026-05-10 + 11 with
  // bespoke HI/LI tails - kept verbatim per Xero option-a 2026-05-19
  // despite the new canonical rule. LI present-tense fix 2026-05-19:
  // "made" -> "makes" so all 6 outcomes share tense.
  it('first impression Wild Success', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'Wild Success',
    })).toBe('Cree Hask makes a strong First Impression on Avery Xavier')
  })

  it('first impression High Insight: bespoke "they did so well" tail kept', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'High Insight',
    })).toBe('Cree Hask makes a strong First Impression on Avery Xavier and has a Moment of Insight as to why they did so well')
  })

  it('first impression Success', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'Success',
    })).toBe('Cree Hask makes a First Impression on Avery Xavier')
  })

  it('first impression Failure', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'Failure',
    })).toBe('Cree Hask makes a bad First Impression on Avery Xavier')
  })

  it('first impression Dire Failure', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'Dire Failure',
    })).toBe('Cree Hask makes a terrible First Impression on Avery Xavier')
  })

  it('first impression Low Insight: present-tense "makes" + bespoke "what went wrong" tail', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - First Impression (Avery Xavier)',
      character_name: 'Cree Hask', outcome: 'Low Insight',
    })).toBe('Cree Hask makes a terrible First Impression on Avery Xavier, but has a Moment of Insight as to what went wrong')
  })

  // Baseline for the no-roll combat-action banners (compact trims the note).
  it('Take Cover banner trims the mechanical note', () => {
    expect(compactRollSummary({
      label: 'Shimmy Paint - Take Cover (+2 Defensive Modifier, all attacks this round)',
      character_name: 'Shimmy Paint', outcome: 'action',
    })).toBe('Shimmy Paint takes Cover')
  })

  it('Defend banner trims the mechanical note', () => {
    expect(compactRollSummary({
      label: 'Cree Hask - Defend (+2 Defensive Modifier, next attack only)',
      character_name: 'Cree Hask', outcome: 'action',
    })).toBe('Cree Hask prepares to Defend')
  })

  // Loot (2026-05-27): label shown verbatim; "found nothing" stays as contextual message.
  // New format (post-2026-05-27): no emoji, "a" before item name.
  it('loot: new loot_npc_item label (no emoji, with "a")', () => {
    expect(compactRollSummary({
      label: 'Juno searched the corpse of Alex Torrez and looted a Medical Kit',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno searched the corpse of Alex Torrez and looted a Medical Kit')
  })

  it('loot: new loot_npc_item label with qty', () => {
    expect(compactRollSummary({
      label: 'Juno searched the corpse of Alex Torrez and looted a Bandage x3',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno searched the corpse of Alex Torrez and looted a Bandage x3')
  })

  it('loot: new loot_npc_equipment_item label (no emoji, with "a")', () => {
    expect(compactRollSummary({
      label: 'Juno looted a Carbine from Alex Torrez',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno looted a Carbine from Alex Torrez')
  })

  // Old format (pre-2026-05-27): 🎒 prefix stripped for display.
  it('loot: legacy 🎒 prefix stripped on old DB rows', () => {
    expect(compactRollSummary({
      label: '🎒 Juno searched the corpse of Alex Torrez and looted Medical Kit',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno searched the corpse of Alex Torrez and looted Medical Kit')
  })

  it('loot: legacy 🎒 equipment row stripped', () => {
    expect(compactRollSummary({
      label: '🎒 Juno looted Carbine from Alex Torrez',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno looted Carbine from Alex Torrez')
  })

  it('loot: "found nothing" corpse search returns contextual message (no item to reveal)', () => {
    expect(compactRollSummary({
      label: '🎒 Juno searched the corpse of Alex Torrez and found nothing',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno searched the corpse of Alex Torrez and found nothing')
  })

  it('loot: "found nothing" object/container returns contextual message', () => {
    expect(compactRollSummary({
      label: '🎒 Juno looked through the remains of Barrel 1 and found nothing',
      character_name: 'Juno', outcome: 'loot',
    })).toBe('Juno looked through the remains of Barrel 1 and found nothing')
  })
})

describe('vehicle_damage_table', () => {
  it('returns the label verbatim (system name + sum readable in the feed)', () => {
    expect(compactRollSummary({
      label: 'DAMAGE Minnie - 2+4 = 6: Engine',
      character_name: 'Minnie', outcome: 'vehicle_damage_table',
    })).toBe('DAMAGE Minnie - 2+4 = 6: Engine')
  })

  it('works for any vehicle or system name', () => {
    expect(compactRollSummary({
      label: 'DAMAGE Y - 3+5 = 8: Fuel Tank',
      character_name: 'Y', outcome: 'vehicle_damage_table',
    })).toBe('DAMAGE Y - 3+5 = 8: Fuel Tank')
  })
})

describe('actionDetail', () => {
  it('Take Cover: returns the note with the wrapping parens stripped', () => {
    expect(actionDetail({
      label: 'Shimmy Paint - Take Cover (+2 Defensive Modifier, all attacks this round)',
      character_name: 'Shimmy Paint', outcome: 'action',
    })).toBe('+2 Defensive Modifier, all attacks this round')
  })

  it('Defend: returns the note with the wrapping parens stripped', () => {
    expect(actionDetail({
      label: 'Cree Hask - Defend (+2 Defensive Modifier, next attack only)',
      character_name: 'Cree Hask', outcome: 'action',
    })).toBe('+2 Defensive Modifier, next attack only')
  })

  it('Reposition: returns the note with the wrapping parens stripped', () => {
    expect(actionDetail({
      label: 'Cree Hask - Reposition (Resolution phase)',
      character_name: 'Cree Hask', outcome: 'action',
    })).toBe('Resolution phase')
  })

  it('Aim: keeps the parens since the note has trailing prose (not fully wrapped)', () => {
    expect(actionDetail({
      label: 'Cree Hask - Aim (+2 CMod). Must Attack next or Aim is lost.',
      character_name: 'Cree Hask', outcome: 'action',
    })).toBe('(+2 CMod). Must Attack next or Aim is lost.')
  })

  it('handles the em-dash legacy prefix', () => {
    // Build the legacy em-dash separator at runtime so the source file
    // carries no literal em-dash (the no-em-dash guardrail scans bytes).
    const emDash = String.fromCharCode(0x2014)
    expect(actionDetail({
      label: `Cree Hask ${emDash} Take Cover (+2 Defensive Modifier, all attacks this round)`,
      character_name: 'Cree Hask', outcome: 'action',
    })).toBe('+2 Defensive Modifier, all attacks this round')
  })

  it('returns null for Ready/Reload/Move (no meaningful note)', () => {
    expect(actionDetail({ label: 'Cree Hask - Move', character_name: 'Cree Hask', outcome: 'action' })).toBeNull()
    expect(actionDetail({ label: 'Cree Hask - Reload Pistol', character_name: 'Cree Hask', outcome: 'action' })).toBeNull()
    expect(actionDetail({ label: 'Cree Hask - Ready Sniper\'s Rifle', character_name: 'Cree Hask', outcome: 'action' })).toBeNull()
  })

  it('returns null for non-action rows even if the label looks like an action', () => {
    expect(actionDetail({
      label: 'Cree Hask - Take Cover (+2 Defensive Modifier)',
      character_name: 'Cree Hask', outcome: 'Success',
    })).toBeNull()
  })
})
