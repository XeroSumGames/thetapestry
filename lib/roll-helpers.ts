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

export function getOutcome(total: number, die1: number, die2: number, skipInsightPair = false): string {
  // `skipInsightPair` suppresses the Low/High Insight (1+1 / 6+6) checks for
  // roll types where those SRD triggers don't apply - e.g. 3d6 Insight-Die
  // rolls that were themselves purchased with an Insight Die (awarding or
  // consuming another Insight Die on top would double-dip).
  if (!skipInsightPair) {
    if (die1 === 1 && die2 === 1) return 'Low Insight'
    if (die1 === 6 && die2 === 6) return 'High Insight'
  }
  if (total <= 3) return 'Dire Failure'
  if (total <= 8) return 'Failure'
  if (total <= 13) return 'Success'
  return 'Wild Success'
}

export function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'Wild Success': return '#7fc458'
    case 'High Insight': return '#7fc458'
    case 'Success': return '#7ab3d4'
    case 'Failure': return '#EF9F27'
    case 'Dire Failure': return '#c0392b'
    case 'Low Insight': return '#c0392b'
    default: return '#d4cfc9'
  }
}

/** Compact one-line summary for common roll types. Returns null to fall
 *  through to the verbose view (initiative, combat_start/end, sprint,
 *  death, drop, and anything this function doesn't recognize render
 *  unchanged - some already have their own styled cards, others need
 *  the full breakdown). */
export function compactRollSummary(r: { label: string; character_name: string; target_name?: string | null; outcome: string }): string | null {
  const suffix = r.label.startsWith(r.character_name + ' - ') ? r.label.slice(r.character_name.length + 3) : r.label
  const hit = r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight'
  const wild = r.outcome === 'Wild Success' || r.outcome === 'High Insight'
  // Canon-correct outcome suffix. (Was "(critical)" / "failed miserably"
  // pre-2026-05-10 - Xero called the "(critical)" tag out of canon. XSE
  // doesn't use "critical"; the right framing for HI/LI is the Moment-
  // of-Insight die award.) Wild Success and High Insight are lumped here
  // for the trim; Wild without dice 6+6 doesn't actually award an Insight
  // Die at the dice-engine layer, but the narrative tag matches the
  // user-facing wording in lessons.md.
  const outcomeTag = wild
    ? ' and has a Moment of Insight as to why'
    : r.outcome === 'Low Insight'
      ? ', but has a Moment of Insight as to why they were unsuccessful'
      : ''

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
  // via the dropdown selection). Compact reads as a hit/miss sentence.
  if (/^Distract$/.test(suffix) && r.target_name) {
    const adverb = hit ? 'Successfully' : 'Failed to'
    return `${r.character_name} ${adverb} Distract${hit ? 's' : ''} ${r.target_name}${outcomeTag}`
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
        const verb = /launcher/i.test(weapon) ? 'fired' : 'threw'
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
  // Stress Check - label "<name> - Stress Check" written by CharacterCard
  // when an at-max stress prompt resolves. Hit (Success) reads "Calms
  // Themselves"; miss (Failure) reads "fails to" and the Breaking Point
  // flow takes over.
  if (/^Stress Check\b/.test(suffix)) {
    if (hit) return `${r.character_name} Successfully Calms Themselves${outcomeTag}`
    return `${r.character_name} Unsuccessfully Attempts to Calm Themselves${outcomeTag}`
  }
  // Stabilize - label "<name> - Stabilize <target>". Adverb pattern
  // matches the Attack / Unarmed branches so hit/miss is legible from
  // the narrative alone - bordered card's left color cue is too subtle
  // when rolls scroll fast.
  const stabilizeMatch = suffix.match(/^Stabilize\s+(.+)$/)
  if (stabilizeMatch) {
    const tgt = stabilizeMatch[1]
    // Bespoke HI phrasing per Xero's wording - the moment-of-insight
    // beat is woven into "while doing so" rather than the generic tag.
    if (r.outcome === 'High Insight') {
      return `${r.character_name} Successfully Stabilizes ${tgt} and has a Moment of Insight while doing so`
    }
    if (hit) return `${r.character_name} Successfully Stabilizes ${tgt}${outcomeTag}`
    return `${r.character_name} is Unsuccessful in attempting to Stabilize ${tgt}${outcomeTag}`
  }
  // Coordinate - "<name> - Coordinate (vs <target>)"
  const coordMatch = suffix.match(/^Coordinate\s*\(vs\s+([^)]+)\)/)
  if (coordMatch) {
    const tgt = coordMatch[1]
    return hit ? `${r.character_name} coordinates allies against ${tgt}${outcomeTag}`
               : `${r.character_name} fails to coordinate allies against ${tgt}${outcomeTag}`
  }
  // Coordinate-effect broadcast row - written by the apply step after a
  // successful Coordinate roll, label format
  // "🎯 <names> get(s) +<N> CMod when attacking <target>". The dice are
  // 0+0 (no roll); narrative trim drops the emoji. Outcome value is
  // 'coordinate'.
  if (r.outcome === 'coordinate') {
    return r.label.replace(/^🎯\s*/, '')
  }
  // Unjam - "Unjam - <weaponName> (<skill>)"
  const unjamMatch = suffix.match(/^Unjam\s+-\s+(.+?)(?:\s*\(|$)/)
  if (unjamMatch) {
    const wName = unjamMatch[1].trim()
    return hit ? `${r.character_name} unjams their ${wName}${outcomeTag}`
               : `${r.character_name} fails to unjam their ${wName}${outcomeTag}`
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
      // Five outcome bands per SRD §07 ladder. HI and LI use bespoke
      // tags that override the global outcomeTag - the moment-of-
      // insight beat reads more naturally with FI-specific phrasing
      // ("why they did so well" / "what went wrong") than the generic
      // "as to why they failed".
      if (wild) {
        return `${r.character_name} makes a strong First Impression and has a Moment of Insight as to why they did so well`
      }
      if (r.outcome === 'Success') {
        return `${r.character_name} makes a First Impression`
      }
      if (r.outcome === 'Failure') {
        return `${r.character_name} makes a bad First Impression`
      }
      if (r.outcome === 'Dire Failure') {
        return `${r.character_name} makes a terrible First Impression`
      }
      // Low Insight - bespoke phrasing per Xero (2026-05-10).
      return `${r.character_name} made a terrible First Impression, but has a Moment of Insight as to what went wrong`
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
    const failMatch = r.label.match(/^🤝\s+(.+?)\s+tried to recruit\s+(.+?)\s+-\s+(.+)$/)
    if (failMatch) {
      const name = failMatch[1]
      const target = failMatch[2]
      const rollOutcome = failMatch[3]
      if (rollOutcome === 'Dire Failure' || rollOutcome === 'Low Insight') {
        return `${name} tried to recruit ${target} - it went badly`
      }
      return `${name} tried to recruit ${target} but it didn't go well`
    }
    // Success label format:
    //   "🤝 <recruiter> recruited <target> as <article> <type> to <community>"
    // where <type> is Cohort | Conscript | Convert | Apprentice.
    // Each type has bespoke flavor per Xero's playtest copy (2026-05-10).
    const successMatch = r.label.match(/^🤝\s+(.+?)\s+recruited\s+(.+?)\s+as\s+(?:a|an)\s+(Cohort|Conscript|Convert|Apprentice)\s+to\s+(.+)$/)
    if (successMatch) {
      const recruiter = successMatch[1]
      const target = successMatch[2]
      const recType = successMatch[3]
      const community = successMatch[4]
      if (recType === 'Apprentice') {
        return `${recruiter} takes ${target} as their Apprentice`
      }
      if (recType === 'Conscript') {
        return `${recruiter} forced ${target} into service as a Conscript to ${community}`
      }
      if (recType === 'Convert') {
        return `${recruiter} Converted ${target} as a recruit to ${community}`
      }
      // Cohort - keep the canonical phrasing.
      return `${recruiter} recruited ${target} as a Cohort to ${community}`
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
      return `${charName} spent ${cdp} CDP raising ${what} from Lv ${fromLv} to Lv ${toLv}`
    }
    return r.label.replace(/^📈\s*/, '')
  }
  // Vehicle mounted-weapon attack - label format from /vehicle popout:
  //   "🎯 <weapon> attack → <target> · <vehicle> · <crew> · Ranged Combat (DEX) · <outcome>"
  //   (or without "→ <target>" when no target was selected)
  // Narrative form: "Knox Koss shot at and hit <target> using Minnie's
  // Sniper's Rifle". Expanded view keeps the original label/dice for
  // GMs who want to audit. Lives ahead of the loot block because the
  // 🎯 prefix is unambiguous.
  const vehAtkMatch = r.label.match(/^🎯\s+(.+?)\s+attack(?:\s+→\s+(.+?))?\s+·\s+([^·]+?)\s+·\s+([^·]+?)\s+·\s+Ranged Combat/)
  if (vehAtkMatch) {
    const weapon  = vehAtkMatch[1].trim()
    const target  = vehAtkMatch[2]?.trim() || null
    const vehicle = vehAtkMatch[3].trim()
    const crew    = vehAtkMatch[4].trim()
    const verbTail = `using ${vehicle}'s ${weapon}`
    if (target) {
      if (hit)  return `${crew} shot at and hit ${target} ${verbTail}${outcomeTag}`
      return `${crew} shot at and missed ${target} ${verbTail}${outcomeTag}`
    }
    return hit
      ? `${crew} fired ${verbTail}${outcomeTag}`
      : `${crew} missed firing ${verbTail}${outcomeTag}`
  }
  // Vehicle Driving / Brew checks - keep them readable in the feed too.
  const drivingMatch = r.label.match(/^🚗\s+Driving check\s+·\s+([^·]+?)\s+·\s+([^·]+?)\s+·/)
  if (drivingMatch) {
    const vehicle = drivingMatch[1].trim()
    const driver  = drivingMatch[2].trim()
    return hit
      ? `${driver} drives ${vehicle}${outcomeTag}`
      : `${driver} struggles driving ${vehicle}${outcomeTag}`
  }
  const brewMatch = r.label.match(/^⚗️\s+Brew check\s+·\s+([^·]+?)\s+·\s+([^·]+?)\s+·/)
  if (brewMatch) {
    const vehicle = brewMatch[1].trim()
    const brewer  = brewMatch[2].trim()
    return hit
      ? `${brewer} brews fuel in ${vehicle}${outcomeTag}`
      : `${brewer} botches the brew in ${vehicle}${outcomeTag}`
  }
  // Loot - label "🎒 <name> looted <items> from <container>". Narrative
  // compact banner hides WHAT was looted (keeps players reading the log
  // without spoiling everyone's hauls); ▸ expand reveals the full list.
  if (r.outcome === 'loot') {
    const lootMatch = r.label.match(/^🎒\s+(.+?)\s+looted\s+.+\s+from\s+(.+)$/)
    if (lootMatch) {
      const container = lootMatch[2]
      return `${r.character_name} looked through the remains of ${container} and found something`
    }
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
      return `Time advances ${timePart}, ${nameList}`
    }
    return r.label.replace(/^⏳\s*/, '')
  }
  // Generic skill / attribute check - label "<skillName> (<attrKey>)" or "<attrKey> Check"
  // These come in with no "<name> - " prefix when fired from CharacterCard.
  const skillMatch = suffix.match(/^([A-Z][A-Za-z\s]+?)\s*\(([A-Z]{3})\)$/)
  if (skillMatch) {
    const skill = skillMatch[1]
    return hit ? `${r.character_name} succeeds at ${skill}${outcomeTag}`
               : `${r.character_name} fails at ${skill}${outcomeTag}`
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
    return hit ? `${r.character_name} succeeds at a ${attrName} check${outcomeTag}`
               : `${r.character_name} fails at a ${attrName} check${outcomeTag}`
  }
  return null
}


// Identical to the inline definition that lived inside the table page
// component. Pulled out so chat + rolls feeds share one source of truth
// and the merged Both-tab timestamps match.
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
