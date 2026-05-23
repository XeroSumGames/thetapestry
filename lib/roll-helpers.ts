// Roll-related pure helpers extracted from app/stories/[id]/table/page.tsx
// during the B2 perf pass (load-times roadmap).
//
// All four functions are pure and side-effect-free. They were originally
// inline in the 9300-line table page where they bloated initial parse
// time and prevented the chat extraction from sharing them. Moving them
// here:
//   - shrinks the table page bundle by ~280 lines
//   - lets components/TableChat.tsx import formatTime directly (the chat
//     time format must match the rolls feed time format for the merged
//     "Both" tab to look consistent)
//   - lets future ranged-feed extractions reuse the same helpers without
//     a circular dep through the table page
//
// External dep: getWeaponByName from lib/weapons.ts (used inside
// compactRollSummary's attack-narrative branch).

import { getWeaponByName } from './weapons'
import { OUTCOME, type RollResult } from './roll-outcomes'

export function getOutcome(total: number, die1: number, die2: number, skipInsightPair = false): RollResult {
  // `skipInsightPair` suppresses the Low/High Insight (1+1 / 6+6) checks for
  // roll types where those SRD triggers don't apply - e.g. 3d6 Insight-Die
  // rolls that were themselves purchased with an Insight Die (awarding or
  // consuming another Insight Die on top would double-dip).
  if (!skipInsightPair) {
    if (die1 === 1 && die2 === 1) return OUTCOME.LowInsight
    if (die1 === 6 && die2 === 6) return OUTCOME.HighInsight
  }
  if (total <= 3) return OUTCOME.DireFailure
  if (total <= 8) return OUTCOME.Failure
  if (total <= 13) return OUTCOME.Success
  return OUTCOME.WildSuccess
}

// Outcome -> color. Accepts BOTH input shapes:
//   - Display-form: 'Wild Success', 'Dire Failure', etc. (what RollResult uses)
//   - Snake-case:   'wild_success', 'dire_failure', etc. (what some DB rows store
//                   for community_events / morale_check / resource_check)
// Returns the canonical Tapestry feed palette. Note: components/RollModal.tsx
// uses a deliberately different palette (Success=green, Failure=light-red) for
// in-modal celebration/softening; see modalOutcomeColor there.
export function outcomeColor(outcome: string): string {
  const k = (outcome ?? '').toLowerCase().replace(/_/g, ' ')
  switch (k) {
    case 'wild success':
    case 'high insight':
      return '#7fc458'
    case 'success':
      return '#7ab3d4'
    case 'failure':
      return '#EF9F27'
    case 'dire failure':
    case 'low insight':
      return '#c0392b'
    default:
      return '#d4cfc9'
  }
}

/** Compact one-line summary for common roll types. Returns null to fall
 *  through to the verbose view (initiative, combat_start/end, sprint,
 *  death, drop, and anything this function doesn't recognize render
 *  unchanged - some already have their own styled cards, others need
 *  the full breakdown). */
// damage_json is loosely typed: the DB shape carries finalWP / finalRP
// per app/stories/[id]/table/page.tsx:130-140, but components/RollsFeed.tsx
// has a stale local DamageResult interface with appliedWP/appliedRP.
// Accepting `unknown` here lets both callers pass through; we
// runtime-guard the fields we actually read (finalWP, finalRP) inside
// the attack-narrative branch.
export function compactRollSummary(r: { label: string; character_name: string; target_name?: string | null; outcome: string; damage_json?: unknown }): string | null {
  // Wound-infection warning fires once per character per combat (first
  // shot/stab/cut wound). Label is already the full sentence; just
  // return verbatim so the renderer shows it instead of falling
  // through to the verbose dice card.
  if (r.outcome === 'wound_infection_warning') return r.label
  // Weapon malfunction (Low Insight on a non-Unarmed weapon roll).
  // Label is the full sentence - return verbatim, no trim needed.
  if (r.outcome === 'weapon_malfunction') return r.label
  // Lasting Wound acquired announcement (post-Lasting-Damage-Check
  // resolution). Label is the full sentence, e.g.
  //   "Cree Hask has picked up a Lasting Wound and is now Skittish
  //    (-1 Initiative Modifier)"
  // Return verbatim - no compact transformation needed.
  if (r.outcome === 'lasting_wound_acquired') return r.label
  // Advantage consumed (C3 share). Label is the full sentence -
  // "X used their +N <skill> advantage (<description>)" - return
  // verbatim so the feed shows the redemption cleanly.
  if (r.outcome === 'advantage_used') return r.label
  // Brewing materials gathered (Q4-d). Label is the full sentence -
  // "<vehicle> stockpile updated - gathered 1 day of brewing materials
  // (now N/M)" - return verbatim. Passive 1-day action, no dice.
  // (Comment refreshed 2026-05-20 per skill+combat narrative audit;
  // earlier text described a draft format that never shipped.)
  if (r.outcome === 'gather_materials') return r.label
  // Strip the "<name> - " or "<name> - " prefix that GM-from-popout rolls
  // and some legacy paths bake into the label, so the downstream regex
  // matchers see the bare suffix ("ACU Check", "Medicine* (RSN)", etc.).
  // Handles ASCII hyphen (current convention per project rule "no em-dash
  // anywhere") AND em-dash (legacy DB rows + any code path that hasn't
  // been swept yet).
  let suffix = r.label
  const namePrefix = r.character_name + ' '
  if (r.label.startsWith(namePrefix + '- ')) suffix = r.label.slice(namePrefix.length + 2)
  else if (r.label.startsWith(namePrefix + '— ')) suffix = r.label.slice(namePrefix.length + 2)
  const hit = r.outcome === OUTCOME.Success || r.outcome === OUTCOME.WildSuccess || r.outcome === OUTCOME.HighInsight
  // Outcome suffix appended to the trim sentence. Canon rule per Xero
  // (2026-05-11): the phrase "a Moment of Insight" ONLY applies to High
  // Insight / Low Insight outcomes (the actual Insight Die awards).
  // Wild Success gets "was wildly successful"; Dire Failure gets "failed
  // miserably". Earlier pass lumped WS into the Moment-of-Insight bucket
  // which conflated the intensity modifier (WS/DF) with the Insight Die
  // award (HI/LI). Order matters: HI/LI checked before WS/DF since HI
  // is also a hit and LI is also a fail.
  // Tail phrasing locked per Xero 2026-05-19 (final). Symmetric long
  // form on both HI and LI - earlier short HI tail attempt was wrong.
  // WS / DF tails unchanged.
  const outcomeTag =
    r.outcome === 'High Insight'  ? ' and has a Moment of Insight as to why it went so well'
    : r.outcome === 'Low Insight' ? ' but has a Moment of Insight as to why it went so badly'
    : r.outcome === 'Wild Success' ? ' and was wildly successful'
    : r.outcome === 'Dire Failure' ? ' and failed miserably'
    : ''

  // Lasting Damage Check - canon §06.lasting-damage. Fired on Day 0 of
  // a sick period when the original Infection check was a Failure
  // (severity='check'). The Dire path applies Lasting Damage
  // automatically at drain time and never opens this modal. Outcome:
  //   Wild Success / High Insight / Success - no wound.
  //   Failure / Dire Failure / Low Insight   - 2d6 on Table 12, wound
  //                                            description rolled
  //                                            server-side in
  //                                            executeRoll and surfaced
  //                                            via traitNotes.
  if (/^Lasting Damage Check\b/.test(suffix)) {
    const ldShrug = r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight'
    if (ldShrug) {
      return `${r.character_name} shrugged off the Lasting Damage${outcomeTag}`
    }
    // Read the wound name + effect from damage_json so the feed can
    // name the specific wound (Skittish / Lost Eye / etc). Falls back
    // to the generic line for pre-fix rows that didn't stash this.
    const ldj = (r.damage_json && typeof r.damage_json === 'object')
      ? r.damage_json as { wound_name?: string; wound_effect?: string; wound_roll?: number }
      : null
    if (ldj?.wound_name) {
      const effect = ldj.wound_effect ? ` (${ldj.wound_effect})` : ''
      const roll = ldj.wound_roll != null ? ` [2d6=${ldj.wound_roll}]` : ''
      return `${r.character_name} suffered a Lasting Wound: ${ldj.wound_name}${effect}${roll}${outcomeTag}`
    }
    return `${r.character_name} suffered a Lasting Wound from infection${outcomeTag}`
  }

  // Infection Check - canon §06 (post-combat wound / environmental
  // sickness). Label shape:
  //   "<name> - Infection Check (Wound)"
  //   "<name> - Infection Check (Sickness)"
  // Outcome semantics (executeRoll's infection branch at
  // app/stories/[id]/table/page.tsx:5811):
  //   Success / Wild Success / High Insight - shrug it off, no state.
  //   Failure                                - infected 1d3 days,
  //                                            Lasting Damage RISK.
  //   Dire Failure / Low Insight             - infected 1d6 days.
  //                                            Wound: auto Lasting
  //                                            Damage on Day 0.
  //                                            Sickness: auto Mortally
  //                                            Wounded on Day 0.
  // Either failure also caps RP at half max. Compact line is the
  // narrative consequence; the math panel ▸ still shows dice on
  // expand.
  const infMatch = suffix.match(/^Infection Check\s*\((Wound|Sickness)\)/)
  if (infMatch) {
    const kind = infMatch[1] as 'Wound' | 'Sickness'
    const shrug = r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight'
    const dire = r.outcome === 'Dire Failure' || r.outcome === 'Low Insight'
    const fail = r.outcome === 'Failure'
    // executeRoll stashes the rolled sick-day count + severity into
    // damage_json so the compact line can show the actual number
    // instead of "1d3" / "1d6". Falls back to the dice range if a
    // pre-fix row from an older deploy lacks the metadata.
    const dj = (r.damage_json && typeof r.damage_json === 'object')
      ? r.damage_json as { infection_days?: number; infection_severity?: 'check' | 'auto' }
      : null
    const days: number | null = dj?.infection_days ?? null
    // First name only - "Cree" reads better than "Cree Hask" in the
    // second clause. Falls back to the full name if there's no space.
    const first = r.character_name.split(/\s+/)[0]
    if (shrug) {
      return kind === 'Wound'
        ? `${r.character_name} shrugged off the wound infection${outcomeTag}`
        : `${r.character_name} shrugged off the sickness${outcomeTag}`
    }
    if (fail) {
      const daysText = days != null ? `${days} day${days === 1 ? '' : 's'}` : '1d3 days'
      return kind === 'Wound'
        ? `${r.character_name} has a wound that has become infected. ${first} will be sick for ${daysText}. Lasting damage is possible if untreated.${outcomeTag}`
        : `${r.character_name} has fallen sick. ${first} will be ill for ${daysText}. Lasting damage is possible if untreated.${outcomeTag}`
    }
    if (dire) {
      const daysText = days != null ? `${days} day${days === 1 ? '' : 's'}` : '1d6 days'
      return kind === 'Wound'
        ? `${r.character_name} has a wound that has become severely infected. ${first} will be sick for ${daysText}. This will likely leave a lasting wound.${outcomeTag}`
        : `${r.character_name} has fallen gravely sick. ${first} will be ill for ${daysText}. Will progress to Mortally Wounded on Day 0.${outcomeTag}`
    }
    // Defensive fallback for any outcome we didn't anticipate.
    return `${r.character_name} - Infection Check (${kind})${outcomeTag}`
  }

  // Aim action - no dice, no target.
  if (r.outcome === 'action' && /^Aim\b/.test(suffix)) {
    return `${r.character_name} takes Aim`
  }
  // Move action - no dice, no target. Narrative compact banner, with
  // the verbose breakdown (label / [0+0]=0 / action) available via the ▸
  // expand for GMs who want to audit the raw action log.
  if (r.outcome === 'action' && /^Move\b/.test(suffix)) {
    return `${r.character_name} Moves`
  }
  // Ready Weapon family - all come through as outcome='action' with a
  // 0+0 dice payload that's pointless to show (no roll happened, just
  // an action consumed). Compact narrativizes; the expand toggle is
  // suppressed in the renderer for outcome='action' rows since there's
  // nothing meaningful to expand to. Variants:
  //   "Ready Weapon"                - generic ready (e.g. Tracking +N)
  //   "Ready <weaponName>"          - equipping from inventory
  //   "Ready <weaponName> (Secondary)" - equipping to secondary slot
  //   "Switch to <weaponName>"      - primary↔secondary swap
  //   "Reload <weaponName>"         - clip reload
  //   "Unequip <weaponName>"        - slot → inventory
  if (r.outcome === 'action') {
    // Possessive "their" on personal weapons - gender-neutral default
    // since we don't track pronouns yet. (Generic "Ready Weapon" with
    // no specific weapon falls back to "a weapon".)
    const readyMatch = suffix.match(/^Ready\s+(.+?)(?:\s+\(.+\))?$/)
    if (readyMatch) {
      const what = readyMatch[1].trim()
      if (/^weapon$/i.test(what)) return `${r.character_name} readies a weapon`
      return `${r.character_name} readies their ${what}`
    }
    const switchMatch = suffix.match(/^Switch to\s+(.+?)(?:\s+\(.+\))?$/)
    if (switchMatch) return `${r.character_name} switches to their ${switchMatch[1].trim()}`
    const reloadMatch = suffix.match(/^Reload\s+(.+?)(?:\s+\(.+\))?$/)
    if (reloadMatch) return `${r.character_name} reloads their ${reloadMatch[1].trim()}`
    const unequipMatch = suffix.match(/^Unequip\s+(.+?)(?:\s+\(.+\))?$/)
    if (unequipMatch) return `${r.character_name} unequips their ${unequipMatch[1].trim()}`
    // Defend / Take Cover / Reposition - also no-roll actions.
    const defendMatch = suffix.match(/^Defend\b/)
    if (defendMatch) return `${r.character_name} prepares to Defend`
    const takeCoverMatch = suffix.match(/^Take Cover\b/)
    if (takeCoverMatch) return `${r.character_name} takes Cover`
    const repositionMatch = suffix.match(/^Reposition\b/)
    if (repositionMatch) return `${r.character_name} repositions`
  }
  // Distract - roll-resolved as of 2026-04-29. Label format:
  // "<name> - Distract" (no target in label; target lives in r.target_name
  // via the dropdown selection). Bespoke narrative per outcome locked
  // 2026-05-19 per Xero - outcome carries narrative weight, mechanical
  // bits (action delta) live in the expanded view + target's action
  // pips updating live. Per project rule "Compact log narratives NEVER
  // show mechanical bits" (lessons.md 2026-05-19).
  if (/^Distract$/.test(suffix) && r.target_name) {
    const name = r.character_name
    const tgt = r.target_name
    switch (r.outcome) {
      case 'Wild Success':  return `${name} distracts ${tgt} so badly they seem to become confused`
      case 'High Insight':  return `${name} distracts ${tgt} so badly they seem to become confused and has a Moment of Insight as to why it went so well`
      case 'Success':       return `${name} distracts ${tgt}, breaking their focus`
      case 'Failure':       return `${name} tries to distract ${tgt}, who shrugs it off`
      case 'Low Insight':   return `${name} tries to distract ${tgt}, who shrugs it off but has a Moment of Insight as to why it went so badly`
      case 'Dire Failure':  return `${name} tries to distract ${tgt} but only sharpens their focus`
      default:              return `${name} ${hit ? 'distracts' : 'tries to distract'} ${tgt}`
    }
  }
  // Social action banners - Cover Fire / Inspire. Label format
  // "<name> - <Action> → <target> (...)" written by applySocialAction
  // (auto-apply, no roll). Compact trims the parenthetical effect.
  const socialMatch = suffix.match(/^(Cover Fire|Inspire)\s+→\s+(.+?)(?:\s*\(.+\))?$/)
  if (r.outcome === 'action' && socialMatch) {
    const action = socialMatch[1]
    const target = socialMatch[2].trim()
    if (action === 'Inspire') return `${r.character_name} Inspires ${target}!`
    return `${r.character_name} lays down covering fire on ${target}!`
  }
  // Attack-like rolls against a named target. Phrasing per playtest spec:
  //   - Explosive thrown (Grenade, Molotov, Shiv-/Flash-Bang):
  //       "X threw a <weapon> at <target>"
  //   - Explosive launcher (RPG Launcher etc. - category explosive AND
  //     name contains 'Launcher'):
  //       "X fired a <weapon> at <target>"
  //   - Firearm / melee with single-word action (Attack, Charge, Subdue):
  //       "X used a <weapon> to Successfully|Unsuccessfully <Action> <target>"
  //       (the adverb makes the hit/miss legible from the narrative alone;
  //        crit tag still appended for Wild Success / High Insight / Low Insight)
  //   - Multi-word action (Rapid Fire, Fire from Cover) - awkward to
  //     force into "to X Y" phrasing; falls back to the older neutral
  //     "X used <weapon> <Action> on <target>" form.
  const attackMatch = suffix.match(/^(Attack|Rapid Fire|Charge|Subdue|Fire from Cover)(?:\s*\(([^)]+)\))?/)
  if (attackMatch && r.target_name) {
    const action = attackMatch[1]
    const weapon = attackMatch[2]
    if (weapon) {
      const w = getWeaponByName(weapon)
      // a / an article handling - keeps "an Assault Rifle" from reading
      // as "a Assault Rifle". Matches first letter against vowel set.
      const article = /^[aeiouAEIOU]/.test(weapon.trim()) ? 'an' : 'a'
      if (w?.category === 'explosive') {
        // A thrown explosive that misses (Failure / Dire Failure / Low
        // Insight) FUMBLES - the grenade still detonates but scatters off
        // target (or at the thrower's feet on Low Insight), so the narrative
        // reads "fumbled throwing a Grenade" instead of "threw a Grenade"
        // (Xero 2026-05-23). Launchers keep "fired".
        const isLauncher = /launcher/i.test(weapon)
        const verb = isLauncher ? 'fired' : (hit ? 'threw' : 'fumbled throwing')
        // Cell-only target: grenade was thrown at an empty cell, not a
        // combatant. The synthetic target name "Cell (x,y)" reads ugly in
        // the feed ("threw a Grenade at Cell (3,5)") - drop the "at ..."
        // suffix entirely when the target is a cell.
        if (/^Cell\s*\(/.test(r.target_name)) {
          return `${r.character_name} ${verb} ${article} ${weapon}`
        }
        return `${r.character_name} ${verb} ${article} ${weapon} at ${r.target_name}`
      }
      if (/^(Attack|Charge|Subdue)$/.test(action)) {
        const adverb = hit ? 'Successfully' : 'Unsuccessfully'
        // Charge has its own narrative shape per Xero (2026-05-10):
        // frame the Charge as movement that PRECEDES the attack, so the
        // attack is the noun and Charge is the qualifying clause. Reads:
        //   "X Unsuccessfully made an Unarmed attack after Charge at Y"
        //   "X Successfully made a Pistol attack after Charge at Y"
        if (action === 'Charge') {
          // "Unarmed attack" reads as "Unarmed [adj] attack [noun]";
          // other weapons read as "Pistol attack" / "Sword attack" etc.
          const chargeNoun = `${weapon} attack`
          const chargeArticle = /^[aeiouAEIOU]/.test(chargeNoun.trim()) ? 'an' : 'a'
          return `${r.character_name} ${adverb} made ${chargeArticle} ${chargeNoun} after Charge at ${r.target_name}${outcomeTag}`
        }
        // "Unarmed" reads weirdly as a noun ("with an Unarmed") - append
        // "attack" so the sentence has a noun. Doesn't apply to the
        // standalone Unarmed branch below (label "<name> - Unarmed")
        // which has its own phrasing.
        const weaponLabel = /^unarmed$/i.test(weapon.trim()) ? `${weapon} attack` : weapon
        const labelArticle = /^[aeiouAEIOU]/.test(weaponLabel.trim()) ? 'an' : 'a'
        // Fully-absorbed attack (Xero 2026-05-15): when an Attack /
        // Subdue lands the to-hit roll but the target's mitigation
        // (PHY + armor + Defend + Take Cover) eats the entire damage
        // pool (finalWP === 0 && finalRP === 0), the "Successfully
        // Attacked" wording is misleading - the table can't tell
        // Defend did anything. Swap to a deflected-by-defense reading
        // so the action is visible. Only applies to hits with damage
        // data; misses already read "Unsuccessfully Attacked" and
        // skip this branch.
        if (hit && r.damage_json && typeof r.damage_json === 'object') {
          const dj = r.damage_json as { finalWP?: number; finalRP?: number }
          if (dj.finalWP === 0 && dj.finalRP === 0) {
            return `${r.character_name}'s ${weaponLabel} attack was deflected by ${r.target_name}${outcomeTag}`
          }
        }
        // Past-tense restructure per Xero (2026-05-10): adverb before
        // verb, target before weapon, "using" clause at the end. Applies
        // to Attack + Subdue; Charge has its own shape above.
        const PAST: Record<string, string> = { Attack: 'Attacked', Subdue: 'Subdued' }
        const pastAction = PAST[action] ?? action
        return `${r.character_name} ${adverb} ${pastAction} ${r.target_name} using ${labelArticle} ${weaponLabel}${outcomeTag}`
      }
      // Rapid Fire / Fire from Cover - possessive "their" so the weapon
      // reads as the character's gear rather than a free-floating noun.
      return `${r.character_name} used their ${weapon} ${action} on ${r.target_name}${outcomeTag}`
    }
    // Bare action with no weapon in parens - rare (Unarmed has its own
    // branch below); keep the neutral form.
    return `${r.character_name} used ${action} on ${r.target_name}`
  }
  // Unarmed attack - label "<name> - Unarmed" (no Attack() wrapper,
  // since Unarmed IS the action). Reads "Successfully used Unarmed
  // Combat on X" per the log-trimming playtest spec - "Combat" adds
  // verb weight so the line parses like a sentence instead of
  // "used Unarmed on X". Adverb makes hit/miss legible from the
  // narrative alone, matching the firearm/melee Attack branch above.
  if (/^Unarmed$/.test(suffix) && r.target_name) {
    // High Insight has bespoke phrasing per Xero's wording: the moment-
    // of-insight beat is woven into the verb, not appended as a tag.
    if (r.outcome === 'High Insight') {
      return `${r.character_name} had a Moment of Insight when using Unarmed Combat on ${r.target_name}`
    }
    const adverb = hit ? 'Successfully' : 'Unsuccessfully'
    return `${r.character_name} ${adverb} used Unarmed Combat on ${r.target_name}${outcomeTag}`
  }
  // Stress Check - canon copy locked 2026-05-19 per Xero. Two distinct
  // labels written by CharacterCard's onPostRollClose:
  //   "<name> - Stress Check"           = mid-play (GM-called).
  //                                       Success = no change.
  //                                       Failure = +1 stress.
  //   "<name> - Stress Check (at max)"  = at-max (auto-fires when stress
  //                                       hits 5, or via mid-play cascade).
  //                                       Success = drop to 4.
  //                                       Failure = Breaking Point.
  // Old DB rows pre-2026-05-19 used bare "Stress Check" without the
  // (at max) suffix but were always at-max behavior. They render with
  // mid-play wording in the feed - not a regression vs the prior generic
  // "Successfully Calms Themselves" copy, just mode-mismatched on
  // <50 pre-existing rows. New rows are correctly distinguished.
  const stressMatch = suffix.match(/^Stress Check(?:\s+\(at max\))?$/)
  if (stressMatch) {
    const isAtMax = /\(at max\)/.test(suffix)
    const name = r.character_name
    if (isAtMax) {
      switch (r.outcome) {
        case 'Wild Success':  return `STRESS CHECK ${name} is wildly composed and shrugs the pressure off`
        case 'High Insight':  return `STRESS CHECK ${name} calms themselves down and has a Moment of Insight as to why it went so well`
        case 'Success':       return `STRESS CHECK ${name} calms themselves down`
        case 'Failure':       return `STRESS CHECK ${name} fails to calm and reaches their Breaking Point`
        case 'Dire Failure':  return `STRESS CHECK ${name} disastrously cracks and reaches their Breaking Point`
        case 'Low Insight':   return `STRESS CHECK ${name} fails to calm and reaches their Breaking Point but has a Moment of Insight as to why it went so badly`
        default:              return `STRESS CHECK ${name} ${hit ? 'calms themselves down' : 'fails to calm and reaches their Breaking Point'}`
      }
    }
    // mid-play - no mechanical bits per project rule "Compact log
    // narratives NEVER show mechanical bits" (lessons.md 2026-05-19).
    // The +1 stress consequence is visible via the live stress pips
    // on the character card; repeating it in the feed line is
    // duplication.
    switch (r.outcome) {
      case 'Wild Success':  return `STRESS CHECK ${name} is wildly composed under pressure`
      case 'High Insight':  return `STRESS CHECK ${name} holds steady against the pressure and has a Moment of Insight as to why it went so well`
      case 'Success':       return `STRESS CHECK ${name} holds steady against the pressure`
      case 'Failure':       return `STRESS CHECK ${name} feels the weight`
      case 'Dire Failure':  return `STRESS CHECK ${name} buckles under the pressure`
      case 'Low Insight':   return `STRESS CHECK ${name} feels the weight but has a Moment of Insight as to why it went so badly`
      default:              return `STRESS CHECK ${name} ${hit ? 'holds steady against the pressure' : 'feels the weight'}`
    }
  }
  // Stabilize - label "<name> - Stabilize <target>". Canon locked
  // 2026-05-19 per Xero. STABILIZE prefix mirrors ATTRIBUTE CHECK /
  // STRESS CHECK pattern. HI keeps the bespoke "while doing so" tail
  // (Xero 2026-05-11 lock); other outcomes follow the standard
  // success/failure narrative + HI/LI tail rule.
  const stabilizeMatch = suffix.match(/^Stabilize\s+(.+)$/)
  if (stabilizeMatch) {
    const tgt = stabilizeMatch[1]
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `STABILIZE ${name} wildly succeeds at stabilizing ${tgt}`
      case 'High Insight':  return `STABILIZE ${name} stabilizes ${tgt} and has a Moment of Insight while doing so`
      case 'Success':       return `STABILIZE ${name} stabilizes ${tgt}`
      case 'Failure':       return `STABILIZE ${name} fails to stabilize ${tgt}`
      case 'Dire Failure':  return `STABILIZE ${name} disastrously fails to stabilize ${tgt}`
      case 'Low Insight':   return `STABILIZE ${name} fails to stabilize ${tgt} but has a Moment of Insight as to why it went so badly`
      default:              return `STABILIZE ${name} ${hit ? 'stabilizes' : 'fails to stabilize'} ${tgt}`
    }
  }
  // Coordinate - "<name> - Coordinate (vs <target>)"
  const coordMatch = suffix.match(/^Coordinate\s*\(vs\s+([^)]+)\)/)
  if (coordMatch) {
    const tgt = coordMatch[1]
    return hit ? `${r.character_name} coordinates allies against ${tgt}${outcomeTag}`
               : `${r.character_name} fails to coordinate allies against ${tgt}${outcomeTag}`
  }
  // Unified Coordinate success row (post-2026-05-10). Label format:
  //   "🎯 <coordinator> Successfully coordinated an attack against
  //    <target> with <allies>"
  // The row carries the real dice + outcome (Success / Wild / HI);
  // compactRollSummary just strips the emoji so the narrative reads
  // naturally and the ▸ expand path renders the dice breakdown.
  if (r.outcome !== 'action' && /^🎯\s+.+?\s+Successfully coordinated an attack against/.test(r.label)) {
    return r.label.replace(/^🎯\s*/, '')
  }
  // Legacy Coordinate-effect broadcast row (pre-2026-05-10). Label
  // format was "🎯 <names> get(s) +<N> CMod when attacking <target>"
  // with outcome='coordinate' and 0+0 dice. Kept for backwards
  // compatibility with historical roll_log rows; new rows go through
  // the unified path above.
  if (r.outcome === 'coordinate') {
    return r.label.replace(/^🎯\s*/, '')
  }
  // Heal check - "<healer> - Heal <target> (<kit>)". Canon locked
  // 2026-05-19 per Xero. HEAL prefix mirrors ATTRIBUTE / STRESS /
  // STABILIZE pattern. DF + LI narratives stripped of mechanical
  // bits ("takes 1 WP damage" was a clear rule violation; the WP
  // delta is visible on the target's HP pips). LI keeps the
  // "the wound may become infected" cue because it's directional
  // not numeric (auto-cascade fires the actual Wound Infection
  // check on the patient's client). Naked-Medicine kit phrase
  // simplified from "with a naked Medicine* check" to "by hand".
  const healMatch = suffix.match(/^Heal\s+(.+?)\s+\((.+?)\)$/)
  if (healMatch) {
    const target = healMatch[1].trim()
    const kit = healMatch[2].trim()
    const kitPhrase = kit === 'naked Medicine*' ? 'by hand' : `with a ${kit}`
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `HEAL ${name} expertly treats ${target} ${kitPhrase} with exceptional care`
      case 'High Insight':  return `HEAL ${name} expertly treats ${target} ${kitPhrase} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `HEAL ${name} treats ${target} ${kitPhrase}`
      case 'Failure':       return `HEAL ${name} fails to make progress treating ${target}`
      case 'Dire Failure':  return `HEAL ${name} botches the treatment, making ${target} worse`
      case 'Low Insight':   return `HEAL ${name} botches the treatment, the wound may become infected, but has a Moment of Insight as to why it went so badly`
      default:              return `HEAL ${name} attempts to treat ${target} ${kitPhrase}`
    }
  }
  // Pending heal tick - System row emitted by drainPendingHeals when a
  // queued heal applies at its +12h or +24h checkpoint. Label already
  // narrative-shaped; just strip the leading 🩹.
  if (r.outcome === 'pending_heal') {
    return r.label.replace(/^🩹\s*/, '')
  }
  // Coordinated Effort lead roll - "Coordinated Effort - <skill>".
  // Fires only when the chain is lead-only (no participants yet). Once
  // participants exist, collapseCoordEffortChains in RollsFeed enriches
  // the lead row and renders the bespoke Tier A banner instead. So this
  // path is the "chain just started, waiting for the rest to roll" view.
  // Tense matches the new banner (present, not past). No mechanical
  // bits per project rule "Compact log narratives NEVER show mechanical
  // bits" (lessons.md 2026-05-19) - the CMod chain effect is visible on
  // the chain banner once participants join.
  const coordEffortMatch = suffix.match(/^Coordinated Effort\s+-\s+(.+)$/)
  if (coordEffortMatch) {
    const skill = coordEffortMatch[1].trim()
    if (r.outcome === 'Low Insight') {
      // First name in the Insight tail so "but <name> has a Moment..."
      // isn't a dangling clause after "the plan falls apart" (Xero
      // 2026-05-20). The lead's full name opens the sentence.
      const first = r.character_name.split(/\s+/)[0]
      return `${r.character_name} kicks off a Coordinated Effort with ${skill} and the plan falls apart but ${first} has a Moment of Insight as to why it went so badly`
    }
    if (r.outcome === 'Dire Failure') return `${r.character_name} kicks off a Coordinated Effort with ${skill} but it goes badly for the team`
    if (r.outcome === 'Failure') return `${r.character_name} kicks off a Coordinated Effort with ${skill} but the team gets off to a rough start`
    if (r.outcome === 'High Insight') return `${r.character_name} kicks off a Coordinated Effort with ${skill} and has a Moment of Insight as to why it went so well`
    if (r.outcome === 'Wild Success') return `${r.character_name} kicks off a Coordinated Effort with ${skill} and is wildly successful`
    if (r.outcome === 'Success') return `${r.character_name} kicks off a Coordinated Effort with ${skill}`
    return `${r.character_name} kicks off a Coordinated Effort with ${skill}`
  }
  // Unjam (firearm) - "Unjam - <weaponName> (<skill>)". Canon locked
  // 2026-05-19. UNJAM prefix mirrors ATTRIBUTE / STRESS / STABILIZE /
  // HEAL pattern. WS = quick clear; DF = wreck/break; LI = fail + tail.
  const unjamMatch = suffix.match(/^Unjam\s+-\s+(.+?)(?:\s*\(|$)/)
  if (unjamMatch) {
    const wName = unjamMatch[1].trim()
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `UNJAM ${name} clears the jam on their ${wName} with practiced ease`
      case 'High Insight':  return `UNJAM ${name} unjams their ${wName} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `UNJAM ${name} unjams their ${wName}`
      case 'Failure':       return `UNJAM ${name} fails to unjam their ${wName}`
      case 'Dire Failure':  return `UNJAM ${name} makes the jam on their ${wName} worse`
      case 'Low Insight':   return `UNJAM ${name} fails to unjam their ${wName} but has a Moment of Insight as to why it went so badly`
      default:              return `UNJAM ${name} ${hit ? 'unjams' : 'fails to unjam'} their ${wName}`
    }
  }
  // Repair (melee) - "Repair - <weaponName> (<skill>)". Mirror of Unjam
  // for melee. Canon locked 2026-05-19. REPAIR prefix mirrors
  // ATTRIBUTE / STRESS / STABILIZE / HEAL / UNJAM pattern.
  const repairMatch = suffix.match(/^Repair\s+-\s+(.+?)(?:\s*\(|$)/)
  if (repairMatch) {
    const wName = repairMatch[1].trim()
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `REPAIR ${name} restores their ${wName} to fighting shape`
      case 'High Insight':  return `REPAIR ${name} repairs their ${wName} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `REPAIR ${name} repairs their ${wName}`
      case 'Failure':       return `REPAIR ${name} fails to repair their ${wName}`
      case 'Dire Failure':  return `REPAIR ${name} damages their ${wName} further`
      case 'Low Insight':   return `REPAIR ${name} fails to repair their ${wName} but has a Moment of Insight as to why it went so badly`
      default:              return `REPAIR ${name} ${hit ? 'repairs' : 'fails to repair'} their ${wName}`
    }
  }
  // Upkeep - "Upkeep - <weaponName>". Each outcome maps to its own
  // narrative because the mechanical effect varies (improve vs.
  // maintain vs. degrade vs. break). The condition delta itself is
  // applied inline by executeRoll's upkeep block; this banner just
  // narrates what the player sees in the feed.
  const upkeepMatch = suffix.match(/^Upkeep\s+-\s+(.+)$/)
  if (upkeepMatch) {
    const wName = upkeepMatch[1].trim()
    if (r.outcome === 'Wild Success' || r.outcome === 'High Insight') return `${r.character_name} tunes up their ${wName}${outcomeTag}`
    if (r.outcome === 'Success') return `${r.character_name} maintains the condition of their ${wName}`
    if (r.outcome === 'Failure') return `${r.character_name} fails to upkeep the condition of their ${wName} and it degrades`
    if (r.outcome === 'Dire Failure') return `${r.character_name} irreparably damages their ${wName} while performing upkeep`
    if (r.outcome === 'Low Insight') return `${r.character_name} breaks their ${wName} while attempting to maintain its condition${outcomeTag}`
    return `${r.character_name} attempts upkeep on their ${wName}`
  }
  // Grapple - label "<name> - Grapple <target>[ (insight tag)]". The
  // outcome here is a custom grapple-result string ('Grappled!',
  // 'Failed - 1 RP', 'No clear victor') written by executeGrapple,
  // not the standard hit/miss enum, so we pick the narrative off
  // r.outcome directly. Trailing insight tag is dropped from the
  // target name for the compact form - the dice breakdown still
  // shows the bonus when the row is expanded.
  const grappleMatch = suffix.match(/^Grapple\s+(.+?)(?:\s+\(.+\))?$/)
  if (grappleMatch) {
    const tgt = grappleMatch[1].trim()
    if (r.outcome === 'Grappled!') return `${r.character_name} grapples with ${tgt}`
    if (r.outcome === 'Failed - 1 RP') return `${r.character_name} fails to grapple with ${tgt}`
    if (r.outcome === 'No clear victor') return `${r.character_name} unsuccessfully attempts to grapple with ${tgt}`
    // Fallback for any future grapple outcome we haven't handled.
    return `${r.character_name} attempts to grapple with ${tgt}`
  }
  // Special narrative checks - Perception, Gut Instinct, First Impression.
  // Reads as a sentence rather than the mechanical "Name - Check" form,
  // per playtest feedback ("Cree Hask successfully uses Perception"
  // instead of "Cree Hask - Perception Check"). First Impression uses
  // "make" because "uses First Impression" reads awkwardly.
  const narrativeMatch = suffix.match(/^(Perception Check|Gut Instinct|First Impression)/)
  if (narrativeMatch) {
    const check = narrativeMatch[1]
    // Bespoke phrasing per Xero's log-trimming pass (2026-05-10).
    // Each check has its own metaphor - generic "successfully uses X"
    // / "fails to use X" was placeholder. First Impression also has
    // distinct copy per failure tier (plain Failure vs. Low Insight
    // soft-pedal vs. catastrophic) per SRD First Impression flavor.
    if (check === 'Perception Check') {
      return hit
        ? `${r.character_name} successfully Perceives something useful${outcomeTag}`
        : `${r.character_name} does not Perceive anything useful${outcomeTag}`
    }
    if (check === 'Gut Instinct') {
      return hit
        ? `${r.character_name}'s Gut Instinct lets them know something is amiss${outcomeTag}`
        : `${r.character_name}'s Gut Instinct is quiet${outcomeTag}`
    }
    if (check === 'First Impression') {
      // Six outcome bands per SRD §07 ladder. HI and LI keep their FI-
      // specific Moment-of-Insight phrasing ("why they did so well" /
      // "what went wrong"). Wild Success and Dire Failure carry their
      // intensity entirely in the "strong" / "terrible" qualifier - no
      // separate tag needed since the bespoke phrasing already conveys
      // the wild/dire beat. (Canon rule per Xero 2026-05-11: "Moment of
      // Insight" only on HI/LI; WS/DF use distinct phrasing.)
      //
      // 2026-05-19 playtest feedback: the bare verb "makes a First
      // Impression" loses the target NPC. Extract it from the label's
      // parenthesized suffix ("First Impression (NpcName)") and append
      // " on <NpcName>" so the feed reads as a sentence.
      const fiMatch = suffix.match(/^First Impression\s+\((.+?)\)\s*$/)
      const fiTarget = fiMatch?.[1] ? ` on ${fiMatch[1]}` : ''
      if (r.outcome === 'High Insight') {
        return `${r.character_name} makes a strong First Impression${fiTarget} and has a Moment of Insight as to why they did so well`
      }
      if (r.outcome === 'Wild Success') {
        return `${r.character_name} makes a strong First Impression${fiTarget}`
      }
      if (r.outcome === 'Success') {
        return `${r.character_name} makes a First Impression${fiTarget}`
      }
      if (r.outcome === 'Failure') {
        return `${r.character_name} makes a bad First Impression${fiTarget}`
      }
      if (r.outcome === 'Dire Failure') {
        return `${r.character_name} makes a terrible First Impression${fiTarget}`
      }
      // Low Insight - bespoke phrasing per Xero (2026-05-10, present-
      // tense parity fix 2026-05-19: "made" -> "makes"). Bespoke tail
      // "what went wrong" kept verbatim per Xero (option a, 2026-05-19);
      // does not align to the canonical "as to why it went so badly".
      return `${r.character_name} makes a terrible First Impression${fiTarget}, but has a Moment of Insight as to what went wrong`
    }
    // Fallthrough - should never hit given the regex.
    return `${r.character_name} - ${check}${hit ? '' : ' (failed)'}${outcomeTag}`
  }
  // Stress log - label "😰 <name> gains a Stress from being <reason>"
  // written by executeRoll's damage-application branches when a target
  // hits Mortal Wound or is Incapacitated. Compact narrativizes the
  // event ("Cree Hask is Incapacitated"); ▸ expand reveals the full
  // emoji/Stress text.
  if (r.outcome === 'stress') {
    const stressMatch = r.label.match(/^😰\s+(.+?)\s+gains\s+a\s+Stress\s+from\s+being\s+(.+)$/)
    if (stressMatch) {
      const name = stressMatch[1]
      const reason = stressMatch[2]
      return `${name} is ${reason}`
    }
    return r.label.replace(/^😰\s*/, '')
  }
  // Recruitment outcome - label starts with "🤝" and we stash the full
  // structured metadata in damage_json (approach, community, apprentice
  // flag). Compact banner narrativizes failure tiers instead of the
  // mechanical "- Failure / Dire Failure / Low Insight" suffix the
  // stored label carries.
  if (r.outcome === 'recruit') {
    // Recruit narrative polish locked 2026-05-19 per Xero (option D:
    // no prefix, present tense, HI/LI tails on success rows, failure
    // copy tightened). Stored label still says "tried to recruit" /
    // "recruited" (past tense, written by the recruit modal at table
    // page); narrative re-renders in present tense.
    const failMatch = r.label.match(/^🤝\s+(.+?)\s+tried to recruit\s+(.+?)\s+-\s+(.+)$/)
    if (failMatch) {
      const name = failMatch[1]
      const target = failMatch[2]
      const rollOutcome = failMatch[3]
      if (rollOutcome === 'Low Insight') {
        return `${name} tries to recruit ${target} and fails but has a Moment of Insight as to why it went so badly`
      }
      if (rollOutcome === 'Dire Failure') {
        return `${name} tries to recruit ${target} and the attempt goes badly`
      }
      return `${name} tries to recruit ${target} and doesn't quite land it`
    }
    // Success label format:
    //   "🤝 <recruiter> recruited <target> as <article> <type> to <community>"
    // where <type> is Cohort | Conscript | Convert | Apprentice.
    // Each type has bespoke flavor per Xero's playtest copy (2026-05-10),
    // present-tense polish 2026-05-19, and HI/LI tail appended when
    // r.outcome indicates a Moment of Insight (stored label doesn't
    // distinguish HI from regular Success - r.outcome does).
    const successMatch = r.label.match(/^🤝\s+(.+?)\s+recruited\s+(.+?)\s+as\s+(?:a|an)\s+(Cohort|Conscript|Convert|Apprentice)\s+to\s+(.+)$/)
    if (successMatch) {
      const recruiter = successMatch[1]
      const target = successMatch[2]
      const recType = successMatch[3]
      const community = successMatch[4]
      // Recruit rows are stored with outcome='recruit' (special tag),
      // not the dice outcome. The actual dice outcome lives in
      // damage_json.rollOutcome (written by the recruit modal at table
      // page L3938). Read from there so HI/LI tails can attach.
      const diceOutcome = (r.damage_json as any)?.rollOutcome ?? ''
      const insightTail = diceOutcome === 'High Insight' ? ' and has a Moment of Insight as to why it went so well'
                        : diceOutcome === 'Low Insight'  ? ' but has a Moment of Insight as to why it went so badly'
                        : ''
      let base: string
      if (recType === 'Apprentice')      base = `${recruiter} takes ${target} as their Apprentice`
      else if (recType === 'Conscript')  base = `${recruiter} forces ${target} into service as a Conscript to ${community}`
      else if (recType === 'Convert')    base = `${recruiter} Converts ${target} as a recruit to ${community}`
      else                               base = `${recruiter} recruits ${target} as a Cohort to ${community}`
      return base + insightTail
    }
    // Unknown structure - strip the emoji and pass through.
    return r.label.replace(/^🤝\s*/, '')
  }
  // Community weekly checks - Fed / Clothed / Morale. The Logs tab has
  // dedicated custom cards for these (colored border, slot breakdown).
  // The Both tab (chat + rolls interleaved) has a simpler renderer that
  // falls through to this function, so give it a clean one-liner from
  // the stored label instead of showing the raw category outcome.
  if (r.outcome === 'fed_check' || r.outcome === 'clothed_check' || r.outcome === 'morale_check' || r.outcome === 'retention_check') {
    return r.label.replace(/^[\u{1F33E}\u{1F527}\u{1F4CA}\u{1F64F}]\s*/u, '')
  }
  // CDP Calculator spends. Stored label is the headline from
  // CharacterEvolution ("<character> - <Skill> Lv 2 → Lv 3 - 5 CDP."),
  // already narrative-friendly - just strip any leading emoji and keep
  // the rest. Lv 4 narrative quote stays inline if present.
  if (r.outcome === 'evolution') {
    // Label format from CharacterEvolution:
    //   "<character> - <Skill> Lv 2 → Lv 3 - 5 CDP."
    // Rewrite to natural-sentence form with spend amount + level delta.
    // Other shapes (attribute raise, trait pick) keep the pass-through.
    const evoMatch = r.label.match(/^(?:📈\s*)?(.+?)\s+-\s+(.+?)\s+Lv\s+(\d+)\s+→\s+Lv\s+(\d+)\s+-\s+(\d+)\s+CDP\.?$/)
    if (evoMatch) {
      const charName = evoMatch[1].trim()
      const what = evoMatch[2].trim()
      const fromLv = evoMatch[3]
      const toLv = evoMatch[4]
      const cdp = evoMatch[5]
      // "Character Development Points" spelled out per Xero (2026-05-10)
      // - newcomers shouldn't have to decode "CDP" in the live feed.
      // Pluralize 'Point' on counts != 1 for grammatical correctness.
      const noun = cdp === '1' ? 'Character Development Point' : 'Character Development Points'
      return `${charName} spent ${cdp} ${noun} raising ${what} from ${fromLv} to ${toLv}`
    }
    return r.label.replace(/^📈\s*/, '')
  }
  // Vehicle mounted-weapon attack - label format from /vehicle popout:
  //   "🎯 <weapon> attack → <target> · <vehicle> · <crew> · Ranged Combat (DEX) · <outcome>"
  //   (or without "→ <target>" when no target was selected)
  // Per-outcome cinematic narrative locked 2026-05-19 per Xero - WS
  // 'devastates', HI/S 'hits', F/LI 'misses', DF 'misfires
  // catastrophically' (weapon malfunction outweighs target). No-target
  // variant uses 'fires ... goes wide' so the LI tail composes without
  // doubled connector. FIRE prefix-CAPS added 2026-05-20 to align with
  // DRIVE / BREW / NAVIGATE / HEAL / UNJAM / REPAIR / STABILIZE pattern -
  // mounted-weapon was the last narrative holdout without a prefix.
  const vehAtkMatch = r.label.match(/^🎯\s+(.+?)\s+attack(?:\s+→\s+(.+?))?\s+·\s+([^·]+?)\s+·\s+([^·]+?)\s+·\s+Ranged Combat/)
  if (vehAtkMatch) {
    const weapon  = vehAtkMatch[1].trim()
    const target  = vehAtkMatch[2]?.trim() || null
    const vehicle = vehAtkMatch[3].trim()
    const crew    = vehAtkMatch[4].trim()
    const verbTail = `using ${vehicle}'s ${weapon}`
    if (target) {
      switch (r.outcome) {
        case 'Wild Success':  return `FIRE ${crew} devastates ${target} ${verbTail}`
        case 'High Insight':  return `FIRE ${crew} hits ${target} ${verbTail} and has a Moment of Insight as to why it went so well`
        case 'Success':       return `FIRE ${crew} hits ${target} ${verbTail}`
        case 'Failure':       return `FIRE ${crew} misses ${target} ${verbTail}`
        case 'Dire Failure':  return `FIRE ${crew} misfires ${vehicle}'s ${weapon} catastrophically`
        case 'Low Insight':   return `FIRE ${crew} misses ${target} ${verbTail} but has a Moment of Insight as to why it went so badly`
        default:              return `FIRE ${crew} ${hit ? 'hits' : 'misses'} ${target} ${verbTail}`
      }
    }
    // No target - firing into the air or for effect.
    switch (r.outcome) {
      case 'Wild Success':  return `FIRE ${crew} fires ${vehicle}'s ${weapon} with stunning precision`
      case 'High Insight':  return `FIRE ${crew} fires ${vehicle}'s ${weapon} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `FIRE ${crew} fires ${vehicle}'s ${weapon}`
      case 'Failure':       return `FIRE ${crew} fires ${vehicle}'s ${weapon} and the shot goes wide`
      case 'Dire Failure':  return `FIRE ${crew} misfires ${vehicle}'s ${weapon} catastrophically`
      case 'Low Insight':   return `FIRE ${crew} fires ${vehicle}'s ${weapon} and the shot goes wide but has a Moment of Insight as to why it went so badly`
      default:              return `FIRE ${crew} fires ${verbTail}`
    }
  }
  // Drive - "<name> - Drive - <vehicle>". Vehicle driving check.
  // Canon locked 2026-05-19 per Xero (supersedes the earlier
  // 🚗 Driving check · ... format). DRIVE prefix mirrors HEAL /
  // UNJAM / REPAIR / STABILIZE pattern; mechanical bits stripped
  // (AMOD chip below the narrative shows the DEX contribution).
  const driveMatch = suffix.match(/^Drive\s+-\s+(.+?)$/)
  if (driveMatch) {
    const veh = driveMatch[1].trim()
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `DRIVE ${name} drives ${veh} with flawless precision`
      case 'High Insight':  return `DRIVE ${name} drives ${veh} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `DRIVE ${name} drives ${veh} smoothly`
      case 'Failure':       return `DRIVE ${name} loses control of ${veh} briefly`
      case 'Dire Failure':  return `DRIVE ${name} wrecks ${veh}'s run`
      case 'Low Insight':   return `DRIVE ${name} loses control of ${veh} but has a Moment of Insight as to why it went so badly`
      default:              return `DRIVE ${name} ${hit ? 'drives' : 'loses control of'} ${veh}`
    }
  }
  // Brew - "<name> - Brew - <vehicle> (<skill>) [<after>/<max>|full <max>/<max>]".
  // Vehicle fuel-brewing check (Mechanic* / Tinkerer). Canon locked
  // 2026-05-19 per Xero (supersedes the earlier ⚗️ Brew check · ...
  // format). BREW prefix mirrors HEAL / UNJAM / REPAIR. Fuel state
  // is tangible game outcome (Xero rule 2026-05-19): the after/max
  // numbers stay in the narrative line. Three label tails distinguish:
  //   "<n>/<m>"           - had room, produced 1 day, n = before+1
  //   "full <m>/<m>"      - tank already full, no delta
  //   ""                  - failure path, no fuel produced
  // Parser branches on the tail + outcome together.
  const brewVehicleMatch = suffix.match(/^Brew\s+-\s+(.+?)\s+\((.+?)\)(?:\s+(.+))?$/)
  if (brewVehicleMatch) {
    const veh = brewVehicleMatch[1].trim()
    const tail = (brewVehicleMatch[3] ?? '').trim()
    const name = r.character_name
    const fullMatch = tail.match(/^full\s+(\d+)\/(\d+)$/)
    const deltaMatch = tail.match(/^(\d+)\/(\d+)$/)
    if (fullMatch && hit) {
      const max = fullMatch[2]
      switch (r.outcome) {
        case 'Wild Success':  return `BREW ${name} brews a flawless batch but ${veh}'s reserves are already full (${max}/${max} days)`
        case 'High Insight':  return `BREW ${name} brews a tank but ${veh}'s reserves are already full (${max}/${max} days), and has a Moment of Insight as to why it went so well`
        case 'Success':       return `BREW ${name} brews a tank but ${veh}'s reserves are already full (${max}/${max} days)`
      }
    }
    if (deltaMatch && hit) {
      const after = deltaMatch[1], max = deltaMatch[2]
      switch (r.outcome) {
        case 'Wild Success':  return `BREW ${name} brews a flawless batch of fuel for ${veh} - ${after}/${max} days`
        case 'High Insight':  return `BREW ${name} brews a tank of fuel for ${veh} - ${after}/${max} days, and has a Moment of Insight as to why it went so well`
        case 'Success':       return `BREW ${name} brews a tank of fuel for ${veh} - ${after}/${max} days`
      }
    }
    // Failure paths - no fuel produced regardless of tail.
    switch (r.outcome) {
      case 'Failure':       return `BREW ${name}'s brew runs dry - no fuel produced`
      case 'Dire Failure':  return `BREW ${name} ruins the batch - no fuel produced`
      case 'Low Insight':   return `BREW ${name}'s brew runs dry - no fuel produced, but has a Moment of Insight as to why it went so badly`
    }
    return `BREW ${name} ${hit ? 'brews fuel for' : 'fails to brew fuel for'} ${veh}`
  }
  // Navigate - "<name> - Navigate - <vehicle> (<skill>)". Vehicle
  // navigator-seat check. Canon locked 2026-05-19. NAVIGATE prefix
  // mirrors HEAL / UNJAM / REPAIR. Skill (Navigation, Geography,
  // etc.) is stripped from the narrative line; SMOD chip below
  // shows the contribution.
  const navigateMatch = suffix.match(/^Navigate\s+-\s+(.+?)\s+\((.+?)\)$/)
  if (navigateMatch) {
    const veh = navigateMatch[1].trim()
    const name = r.character_name
    switch (r.outcome) {
      case 'Wild Success':  return `NAVIGATE ${name} charts a flawless route for ${veh}`
      case 'High Insight':  return `NAVIGATE ${name} charts the route for ${veh} and has a Moment of Insight as to why it went so well`
      case 'Success':       return `NAVIGATE ${name} charts the route for ${veh}`
      case 'Failure':       return `NAVIGATE ${name} loses the route briefly`
      case 'Dire Failure':  return `NAVIGATE ${name} leads ${veh} into a worse spot`
      case 'Low Insight':   return `NAVIGATE ${name} loses the route but has a Moment of Insight as to why it went so badly`
      default:              return `NAVIGATE ${name} ${hit ? 'charts the route for' : 'loses the route for'} ${veh}`
    }
  }
  // Loot - label "🎒 <name> looted <items> from <container>". Narrative
  // compact banner hides WHAT was looted (keeps players reading the log
  // without spoiling everyone's hauls); ▸ expand reveals the full list.
  if (r.outcome === 'loot') {
    // "Found nothing" - label "🎒 <PC> searched the corpse of <NPC> and found nothing"
    // or "🎒 <PC> looked through the remains of <Object> and found nothing".
    const nothingCorpseMatch = r.label.match(/^🎒\s+(.+?)\s+searched the corpse of\s+(.+?)\s+and found nothing/)
    if (nothingCorpseMatch) return `${r.character_name} searched the corpse of ${nothingCorpseMatch[2]} and found nothing`
    const nothingObjMatch = r.label.match(/^🎒\s+(.+?)\s+looked through the remains of\s+(.+?)\s+and found nothing/)
    if (nothingObjMatch) return `${r.character_name} looked through the remains of ${nothingObjMatch[2]} and found nothing`
    // NPC corpse search - label "🎒 <PC> searched the corpse of <NPC> and looted <Item>".
    const corpseMatch = r.label.match(/^🎒\s+(.+?)\s+searched the corpse of\s+(.+?)\s+and looted/)
    if (corpseMatch) return `${r.character_name} searched the corpse of ${corpseMatch[2]} and found something`
    // Object/container loot - "🎒 <PC> looted <Item> from <Object>".
    const lootMatch = r.label.match(/^🎒\s+(.+?)\s+looted\s+.+\s+from\s+(.+)$/)
    if (lootMatch) return `${r.character_name} looked through the remains of ${lootMatch[2]} and found something`
  }
  // (Group Check moved to a bespoke Tier A banner in components/RollsFeed.tsx
  // - keyed off label prefix + damage_json.groupCheckParticipants - so it
  // can render the multi-participant body. compactRollSummary never sees
  // these rows after the banner branch intercepts them.)
  // Barter - label format (post-2026-05-10):
  //   "⚖ Trade with <partner> · <rollSummary> · gave <give> got <get>"
  // Narrative collapses to one line with the partner + give/got intact
  // (those are the interesting part) and the inline rollSummary
  // stripped - the row's outcome color on the border already conveys
  // hit/miss.
  if (r.outcome === 'barter') {
    const tradeMatch = r.label.match(/^⚖\s+Trade\s+with\s+(.+?)\s+·\s+[^·]+·\s+gave\s+(.+?)\s+got\s+(.+)$/)
    if (tradeMatch) {
      const partner = tradeMatch[1].trim()
      const gave = tradeMatch[2].trim()
      const got = tradeMatch[3].trim()
      return `${r.character_name} traded with ${partner} - gave ${gave}, got ${got}${outcomeTag}`
    }
    // Legacy label (pre-partner-name bump) - best-effort fallback.
    const legacyMatch = r.label.match(/^⚖\s+Trade\s+·\s+[^·]+·\s+gave\s+(.+?)\s+got\s+(.+)$/)
    if (legacyMatch) {
      return `${r.character_name} traded - gave ${legacyMatch[1].trim()}, got ${legacyMatch[2].trim()}${outcomeTag}`
    }
    return r.label.replace(/^⚖\s*/, '')
  }
  // CDP award - label "📚 +<N> CDP awarded to <names>" (system row, dice
  // are 0+0). Already narrative-shaped; just strip the leading emoji.
  if (r.outcome === 'cdp') {
    return r.label.replace(/^📚\s*/, '')
  }
  // Encumbrance tick - label "⏳ Time advances <N>h · overencumbered:
  // <name (cur→next)>, <name (cur→next)>, ...". The pre-trim form
  // exposed the encumbrance numbers, which are visible on the
  // character sheets and just clutter the feed. New form drops the
  // numbers and uses a natural list ("X is overencumbered" /
  // "X and Y are both overencumbered" / "X, Y, and Z are all
  // overencumbered").
  if (r.outcome === 'encumbrance') {
    const encMatch = r.label.match(/^⏳\s+Time advances\s+(\S+)\s+·\s+overencumbered:\s+(.+)$/)
    if (encMatch) {
      const timePart = encMatch[1]
      const names = encMatch[2].split(/,\s*/).map(s => s.replace(/\s*\([^)]+\)\s*$/, '').trim()).filter(Boolean)
      let nameList: string
      if (names.length <= 1) nameList = `${names[0] ?? 'Someone'} is overencumbered`
      else if (names.length === 2) nameList = `${names[0]} and ${names[1]} are both overencumbered`
      else nameList = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are all overencumbered`
      const hours = parseInt(timePart, 10)
      const hourStr = isNaN(hours) ? timePart : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
      return `time advances ${hourStr}, ${nameList}`
    }
    return r.label.replace(/^⏳\s*/, '')
  }
  // Generic skill / attribute check - label "<skillName> (<attrKey>)" or "<attrKey> Check"
  // These come in with no "<name> - " prefix when fired from CharacterCard.
  // Character class includes `*` for tagged/professional skills (Medicine*,
  // Demolitions*, Heavy Weapons*, etc.) and `-` for hyphenated skill names
  // (Lock-Picking*). Without these the regex silently fails on the most
  // common pro skills and the verbose dice card renders.
  //
  // Outcome wording table (canon per Xero 2026-05-11):
  //   Success       -> "X was successful at Y"
  //   Wild Success  -> "X was wildly successful at Y"
  //   High Insight  -> "X was successful at Y and has a Moment of Insight..."
  //   Failure       -> "X failed at Y"
  //   Dire Failure  -> "X failed miserably at Y"
  //   Low Insight   -> "X failed at Y and has a Moment of Insight..."
  // Self-contained per outcome instead of appending the generic outcomeTag,
  // because the old "succeeds at X and was wildly successful" double-marked
  // success and read redundantly. Phrasings drop the verb redundancy.
  const skillMatch = suffix.match(/^([A-Z][A-Za-z\s\*\-]+?)\s*\(([A-Z]{3})\)$/)
  if (skillMatch) {
    const skill = skillMatch[1]
    if (r.outcome === 'Wild Success') return `${r.character_name} was wildly successful at ${skill}`
    if (r.outcome === 'High Insight') return `${r.character_name} was successful at ${skill} and has a Moment of Insight as to why it went so well`
    if (r.outcome === 'Dire Failure') return `${r.character_name} failed miserably at ${skill}`
    if (r.outcome === 'Low Insight') return `${r.character_name} failed at ${skill} but has a Moment of Insight as to why it went so badly`
    return hit ? `${r.character_name} was successful at ${skill}`
               : `${r.character_name} failed at ${skill}`
  }
  const attrMatch = suffix.match(/^([A-Z]{3})\s+Check$/)
  if (attrMatch) {
    const attr = attrMatch[1]
    // Map 3-letter key to lowercase full word for readability.
    // RSN/ACU/PHY/INF/DEX is shorthand; the feed should narrate.
    const ATTR_FULL: Record<string, string> = {
      RSN: 'reason',
      ACU: 'acumen',
      PHY: 'physicality',
      INF: 'influence',
      DEX: 'dexterity',
    }
    const attrName = ATTR_FULL[attr] ?? attr.toLowerCase()
    // Format per Xero 2026-05-18: "ATTRIBUTE CHECK <name> {success-adverb}
    // attempted to use their <attribute>". Category prefix on every
    // outcome so feed scanners can spot attribute checks at a glance.
    const prefix = 'ATTRIBUTE CHECK'
    if (r.outcome === 'Wild Success') return `${prefix} ${r.character_name} wildly succeeded at using their ${attrName}`
    if (r.outcome === 'High Insight') return `${prefix} ${r.character_name} successfully attempted to use their ${attrName} and has a Moment of Insight as to why it went so well`
    if (r.outcome === 'Dire Failure') return `${prefix} ${r.character_name} disastrously failed at using their ${attrName}`
    if (r.outcome === 'Low Insight') return `${prefix} ${r.character_name} unsuccessfully attempted to use their ${attrName} but has a Moment of Insight as to why it went so badly`
    return hit ? `${prefix} ${r.character_name} successfully attempted to use their ${attrName}`
               : `${prefix} ${r.character_name} unsuccessfully attempted to use their ${attrName}`
  }
  // Last-resort fallback for old verbose labels that predate compactRollSummary.
  // These rows have baked-in outcome text (Moment of Insight, wildly successful,
  // etc.) that may contradict r.outcome. Strip the first line of the label,
  // remove the baked-in outcome text, and re-apply the correct tag from r.outcome.
  // Only triggers when baked-in outcome text is detected - new unhandled label
  // types fall through to the verbose renderer so they still show their data.
  const firstLine = r.label.split('\n')[0].trim()
  const bakedIn = /\s+(and has a Moment of Insight|but has a Moment of Insight|and was wildly successful|and failed miserably|\+1 Insight Die)/
  if (firstLine && bakedIn.test(firstLine)) {
    const cleaned = firstLine
      .replace(/\s+and has a Moment of Insight\b.*$/, '')
      .replace(/\s+but has a Moment of Insight\b.*$/, '')
      .replace(/\s+and was wildly successful\b.*$/, '')
      .replace(/\s+and failed miserably\b.*$/, '')
      .replace(/\s+\+1 Insight Die\b.*$/, '')
    return `${cleaned}${outcomeTag}`
  }
  // Unarmed HI bespoke: "X had a Moment of Insight when using Unarmed Combat on Y +1 Insight Die"
  // The insight text is the narrative, not a suffix - strip badge only, return as-is.
  if (firstLine && /had a Moment of Insight when/.test(firstLine)) {
    return firstLine.replace(/\s+\+1 Insight Die\b.*$/, '')
  }
  return null
}


// Identical to the inline definition that lived inside the table page
// component. Pulled out so chat + rolls feeds share one source of truth
// and the merged Both-tab timestamps match.
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
