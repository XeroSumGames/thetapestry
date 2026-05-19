import { describe, it, expect } from 'vitest'
import { getOutcome, outcomeColor, compactRollSummary } from '../../lib/roll-helpers'

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
    const label = 'Cree Hask has picked up a Lasting Wound and is now Skittish (-1 CMod on initiative rolls)'
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
      .toBe('ATTRIBUTE CHECK Enya unsuccessfully attempted to use their acumen and has a Moment of Insight as to why it went so badly')
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
      .toBe('STRESS CHECK Enya feels the weight (+1 stress)')
  })

  it('stress check mid-play Dire Failure', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Dire Failure' }))
      .toBe('STRESS CHECK Enya disastrously buckles under the pressure (+1 stress)')
  })

  it('stress check mid-play Low Insight', () => {
    expect(compactRollSummary({ label: 'Enya - Stress Check', character_name: 'Enya', outcome: 'Low Insight' }))
      .toBe('STRESS CHECK Enya feels the weight (+1 stress) and has a Moment of Insight as to why it went so badly')
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
      .toBe('STRESS CHECK Enya fails to calm and reaches their Breaking Point and has a Moment of Insight as to why it went so badly')
  })
})
