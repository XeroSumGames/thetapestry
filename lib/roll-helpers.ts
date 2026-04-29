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
  // roll types where those SRD triggers don't apply — e.g. 3d6 Insight-Die
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
 *  unchanged — some already have their own styled cards, others need
 *  the full breakdown). */
export function compactRollSummary(r: { label: string; character_name: string; target_name?: string | null; outcome: string }): string | null {
  const suffix = r.label.startsWith(r.character_name + ' — ') ? r.label.slice(r.character_name.length + 3) : r.label
  const hit = r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight'
  const wild = r.outcome === 'Wild Success' || r.outcome === 'High Insight'
  const outcomeTag = wild ? ' (critical)' : r.outcome === 'Low Insight' ? ' (critical failure)' : ''

  // Aim action — no dice, no target.
  if (r.outcome === 'action' && /^Aim\b/.test(suffix)) {
    return `${r.character_name} takes Aim`
  }
  // Move action — no dice, no target. Narrative compact banner, with
  // the verbose breakdown (label / [0+0]=0 / action) available via the ▸
  // expand for GMs who want to audit the raw action log.
  if (r.outcome === 'action' && /^Move\b/.test(suffix)) {
    return `${r.character_name} Moves`
  }
  // Distract — roll-resolved as of 2026-04-29. Label format:
  // "<name> — Distract" (no target in label; target lives in r.target_name
  // via the dropdown selection). Compact reads as a hit/miss sentence.
  if (/^Distract$/.test(suffix) && r.target_name) {
    const adverb = hit ? 'Successfully' : 'Failed to'
    return `${r.character_name} ${adverb} Distract${hit ? 's' : ''} ${r.target_name}${outcomeTag}`
  }
  // Social action banners — Cover Fire / Inspire. Label format
  // "<name> — <Action> → <target> (...)" written by applySocialAction
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
  //   - Explosive launcher (RPG Launcher etc. — category explosive AND
  //     name contains 'Launcher'):
  //       "X fired a <weapon> at <target>"
  //   - Firearm / melee with single-word action (Attack, Charge, Subdue):
  //       "X used a <weapon> to Successfully|Unsuccessfully <Action> <target>"
  //       (the adverb makes the hit/miss legible from the narrative alone;
  //        crit tag still appended for Wild Success / High Insight / Low Insight)
  //   - Multi-word action (Rapid Fire, Fire from Cover) — awkward to
  //     force into "to X Y" phrasing; falls back to the older neutral
  //     "X used <weapon> <Action> on <target>" form.
  const attackMatch = suffix.match(/^(Attack|Rapid Fire|Charge|Subdue|Fire from Cover)(?:\s*\(([^)]+)\))?/)
  if (attackMatch && r.target_name) {
    const action = attackMatch[1]
    const weapon = attackMatch[2]
    if (weapon) {
      const w = getWeaponByName(weapon)
      // a / an article handling — keeps "an Assault Rifle" from reading
      // as "a Assault Rifle". Matches first letter against vowel set.
      const article = /^[aeiouAEIOU]/.test(weapon.trim()) ? 'an' : 'a'
      if (w?.category === 'explosive') {
        const verb = /launcher/i.test(weapon) ? 'fired' : 'threw'
        // Cell-only target: grenade was thrown at an empty cell, not a
        // combatant. The synthetic target name "Cell (x,y)" reads ugly in
        // the feed ("threw a Grenade at Cell (3,5)") — drop the "at ..."
        // suffix entirely when the target is a cell.
        if (/^Cell\s*\(/.test(r.target_name)) {
          return `${r.character_name} ${verb} ${article} ${weapon}`
        }
        return `${r.character_name} ${verb} ${article} ${weapon} at ${r.target_name}`
      }
      if (/^(Attack|Charge|Subdue)$/.test(action)) {
        const adverb = hit ? 'Successfully' : 'Unsuccessfully'
        return `${r.character_name} used ${article} ${weapon} to ${adverb} ${action} ${r.target_name}${outcomeTag}`
      }
      // Rapid Fire / Fire from Cover — fall back to neutral phrasing
      return `${r.character_name} used ${weapon} ${action} on ${r.target_name}`
    }
    // Bare action with no weapon in parens — rare (Unarmed has its own
    // branch below); keep the neutral form.
    return `${r.character_name} used ${action} on ${r.target_name}`
  }
  // Unarmed attack — label "<name> — Unarmed" (no Attack() wrapper,
  // since Unarmed IS the action). Reads "Successfully used Unarmed
  // Combat on X" per the log-trimming playtest spec — "Combat" adds
  // verb weight so the line parses like a sentence instead of
  // "used Unarmed on X". Adverb makes hit/miss legible from the
  // narrative alone, matching the firearm/melee Attack branch above.
  if (/^Unarmed$/.test(suffix) && r.target_name) {
    const adverb = hit ? 'Successfully' : 'Unsuccessfully'
    return `${r.character_name} ${adverb} used Unarmed Combat on ${r.target_name}${outcomeTag}`
  }
  // Stress Check — label "<name> — Stress Check" written by CharacterCard
  // when an at-max stress prompt resolves. Hit (Success) reads "Calms
  // Themselves"; miss (Failure) reads "fails to" and the Breaking Point
  // flow takes over.
  if (/^Stress Check\b/.test(suffix)) {
    const adverb = hit ? 'Successfully' : 'Unsuccessfully'
    return `${r.character_name} ${adverb} Calms Themselves${outcomeTag}`
  }
  // Stabilize — label "<name> — Stabilize <target>". Adverb pattern
  // matches the Attack / Unarmed branches so hit/miss is legible from
  // the narrative alone — bordered card's left color cue is too subtle
  // when rolls scroll fast.
  const stabilizeMatch = suffix.match(/^Stabilize\s+(.+)$/)
  if (stabilizeMatch) {
    const tgt = stabilizeMatch[1]
    const adverb = hit ? 'Successfully' : 'Unsuccessfully'
    return `${r.character_name} ${adverb} Stabilizes ${tgt}${outcomeTag}`
  }
  // Coordinate — "<name> — Coordinate (vs <target>)"
  const coordMatch = suffix.match(/^Coordinate\s*\(vs\s+([^)]+)\)/)
  if (coordMatch) {
    const tgt = coordMatch[1]
    return hit ? `${r.character_name} coordinates allies against ${tgt}${outcomeTag}`
               : `${r.character_name} fails to coordinate against ${tgt}${outcomeTag}`
  }
  // Unjam — "Unjam — <weaponName> (<skill>)"
  const unjamMatch = suffix.match(/^Unjam\s+—\s+(.+?)(?:\s*\(|$)/)
  if (unjamMatch) {
    const wName = unjamMatch[1].trim()
    return hit ? `${r.character_name} unjams ${wName}${outcomeTag}`
               : `${r.character_name} fails to unjam ${wName}${outcomeTag}`
  }
  // Upkeep — "Upkeep — <weaponName>". Each outcome maps to its own
  // narrative because the mechanical effect varies (improve vs.
  // maintain vs. degrade vs. break). The condition delta itself is
  // applied inline by executeRoll's upkeep block; this banner just
  // narrates what the player sees in the feed.
  const upkeepMatch = suffix.match(/^Upkeep\s+—\s+(.+)$/)
  if (upkeepMatch) {
    const wName = upkeepMatch[1].trim()
    if (r.outcome === 'Wild Success' || r.outcome === 'High Insight') return `${r.character_name} tunes up ${wName}${outcomeTag}`
    if (r.outcome === 'Success') return `${r.character_name} maintains ${wName}`
    if (r.outcome === 'Failure') return `${r.character_name} fails upkeep — ${wName} degrades`
    if (r.outcome === 'Dire Failure') return `${r.character_name} breaks ${wName} during upkeep`
    if (r.outcome === 'Low Insight') return `${r.character_name} breaks ${wName} during upkeep${outcomeTag}`
    return `${r.character_name} attempts upkeep on ${wName}`
  }
  // Grapple — label "<name> — Grapple <target>[ (insight tag)]". The
  // outcome here is a custom grapple-result string ('Grappled!',
  // 'Failed — 1 RP', 'No clear victor') written by executeGrapple,
  // not the standard hit/miss enum, so we pick the narrative off
  // r.outcome directly. Trailing insight tag is dropped from the
  // target name for the compact form — the dice breakdown still
  // shows the bonus when the row is expanded.
  const grappleMatch = suffix.match(/^Grapple\s+(.+?)(?:\s+\(.+\))?$/)
  if (grappleMatch) {
    const tgt = grappleMatch[1].trim()
    if (r.outcome === 'Grappled!') return `${r.character_name} grapples ${tgt}`
    if (r.outcome === 'Failed — 1 RP') return `${r.character_name} fails to grapple ${tgt}`
    if (r.outcome === 'No clear victor') return `${r.character_name} unsuccessfully attempts to grapple ${tgt}`
    // Fallback for any future grapple outcome we haven't handled.
    return `${r.character_name} attempts to grapple ${tgt}`
  }
  // Special narrative checks — Perception, Gut Instinct, First Impression.
  // Reads as a sentence rather than the mechanical "Name — Check" form,
  // per playtest feedback ("Cree Hask successfully uses Perception"
  // instead of "Cree Hask — Perception Check"). First Impression uses
  // "make" because "uses First Impression" reads awkwardly.
  const narrativeMatch = suffix.match(/^(Perception Check|Gut Instinct|First Impression)/)
  if (narrativeMatch) {
    const check = narrativeMatch[1]
    const verbs: Record<string, { hit: string; miss: string }> = {
      'Perception Check': { hit: 'successfully uses Perception',     miss: 'fails to use Perception' },
      'Gut Instinct':     { hit: 'successfully uses Gut Instinct',   miss: 'fails to use Gut Instinct' },
      'First Impression': { hit: 'makes a strong First Impression',  miss: 'fails to make a First Impression' },
    }
    const v = verbs[check]
    return v
      ? `${r.character_name} ${hit ? v.hit : v.miss}${outcomeTag}`
      : `${r.character_name} — ${check}${hit ? '' : ' (failed)'}${outcomeTag}`
  }
  // Stress log — label "😰 <name> gains a Stress from being <reason>"
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
  // Recruitment outcome — label starts with "🤝" and we stash the full
  // structured metadata in damage_json (approach, community, apprentice
  // flag). Compact banner narrativizes failure tiers instead of the
  // mechanical "— Failure / Dire Failure / Low Insight" suffix the
  // stored label carries.
  if (r.outcome === 'recruit') {
    const failMatch = r.label.match(/^🤝\s+(.+?)\s+tried to recruit\s+(.+?)\s+—\s+(.+)$/)
    if (failMatch) {
      const name = failMatch[1]
      const target = failMatch[2]
      const rollOutcome = failMatch[3]
      if (rollOutcome === 'Dire Failure' || rollOutcome === 'Low Insight') {
        return `${name} tried to recruit ${target} — it went badly`
      }
      return `${name} tried to recruit ${target} but it didn't go well`
    }
    // Success label is already narrative ("X recruited Y as Z to W");
    // just strip the 🤝 emoji.
    return r.label.replace(/^🤝\s*/, '')
  }
  // Community weekly checks — Fed / Clothed / Morale. The Logs tab has
  // dedicated custom cards for these (colored border, slot breakdown).
  // The Both tab (chat + rolls interleaved) has a simpler renderer that
  // falls through to this function, so give it a clean one-liner from
  // the stored label instead of showing the raw category outcome.
  if (r.outcome === 'fed_check' || r.outcome === 'clothed_check' || r.outcome === 'morale_check' || r.outcome === 'retention_check') {
    return r.label.replace(/^[\u{1F33E}\u{1F527}\u{1F4CA}\u{1F64F}]\s*/u, '')
  }
  // Vehicle mounted-weapon attack — label format from /vehicle popout:
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
  // Vehicle Driving / Brew checks — keep them readable in the feed too.
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
  // Loot — label "🎒 <name> looted <items> from <container>". Narrative
  // compact banner hides WHAT was looted (keeps players reading the log
  // without spoiling everyone's hauls); ▸ expand reveals the full list.
  if (r.outcome === 'loot') {
    const lootMatch = r.label.match(/^🎒\s+(.+?)\s+looted\s+.+\s+from\s+(.+)$/)
    if (lootMatch) {
      const container = lootMatch[2]
      return `${r.character_name} looked through the remains of ${container} and found something`
    }
  }
  // Generic skill / attribute check — label "<skillName> (<attrKey>)" or "<attrKey> Check"
  // These come in with no "<name> — " prefix when fired from CharacterCard.
  const skillMatch = suffix.match(/^([A-Z][A-Za-z\s]+?)\s*\(([A-Z]{3})\)$/)
  if (skillMatch) {
    const skill = skillMatch[1]
    return hit ? `${r.character_name} succeeds at ${skill}${outcomeTag}`
               : `${r.character_name} fails at ${skill}${outcomeTag}`
  }
  const attrMatch = suffix.match(/^([A-Z]{3})\s+Check$/)
  if (attrMatch) {
    const attr = attrMatch[1]
    return hit ? `${r.character_name} succeeds at ${attr} check${outcomeTag}`
               : `${r.character_name} fails ${attr} check${outcomeTag}`
  }
  return null
}


// Identical to the inline definition that lived inside the table page
// component. Pulled out so chat + rolls feeds share one source of truth
// and the merged Both-tab timestamps match.
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
