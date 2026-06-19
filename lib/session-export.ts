// Session log export.
//
// Produces a standalone HTML document mirroring the roll-feed preview's
// look (tasks/roll-feed-log-preview.html), populated with the current
// campaign's roll_log rows. The HTML is self-contained: CSS is inlined,
// no external assets. Downloads to the user's machine via a Blob URL.
//
// Design choices:
//   - Reuses compactRollSummary so each row's narrative matches the
//     live feed. Falls back to a stripped label first-line for unknown
//     types.
//   - Inlines the bulletproof outcome guard: even if a row's narrative
//     happens to contain "Moment of Insight" text, the row will only
//     show that + the +1 Insight Die badge when r.outcome is HI or LI.
//   - Skips outcome='action' rows from the dice-math display (matches
//     the live RollsFeed - no [0+0]=0 noise on no-roll system rows).

import { createClient } from './supabase-browser'
import { compactRollSummary, outcomeColor, formatTime } from './roll-helpers'
import { OUTCOME } from './roll-outcomes'

// HTML escape - exports might include user-authored character names,
// labels, etc. The escape covers the common XSS surface; the HTML is
// downloaded locally, not served, so this is defense-in-depth, not
// a load-bearing guard.
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Row type → border color class.
function colorClass(outcome: string): 'green' | 'blue' | 'amber' | 'red' {
  switch (outcome) {
    case OUTCOME.WildSuccess: return 'green'
    case OUTCOME.HighInsight: return 'green'
    case OUTCOME.Success: return 'blue'
    case OUTCOME.Failure: return 'amber'
    case OUTCOME.DireFailure: return 'red'
    case OUTCOME.LowInsight: return 'red'
    default: return 'blue'
  }
}

interface RollLogRow {
  id: string
  character_name: string
  label: string
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  insight_awarded: boolean
  insight_used: '3d6' | '+3cmod' | null
  target_name: string | null
  damage_json: any
  created_at: string
}

interface ChatMessageRow {
  id: string
  user_id: string
  character_name: string
  message: string
  is_whisper: boolean
  recipient_user_id: string | null
  created_at: string
}

// Bespoke banner renderer - mirrors RollsFeed.tsx's Tier-A banners so
// the export visually matches the live feed for the high-signal row
// types (combat start/end, initiative, drop, defer, sprint, death,
// incap, revive). Returns null for rows that should fall through to
// the generic skill-roll template below. Ported 2026-05-15.
//
// Out of scope (still falls through to generic for now): retention_check,
// fed_check, clothed_check, morale_check - those have their own row-
// table layouts that need bespoke porting too, larger surgery.
function renderBespokeBanner(r: RollLogRow): string | null {
  const time = formatTime(r.created_at)
  // combat_start - red banner + combatants list
  if (r.outcome === 'combat_start' && (r.damage_json as any)?.combatants) {
    const combatants = ((r.damage_json as any).combatants as string[]).map(n => `<span style="color:#f5f2ee;font-weight:600">${esc(n)}</span>`)
    const joined = combatants.length <= 1 ? combatants.join('')
      : combatants.slice(0, -1).join(', ') + ' and ' + combatants[combatants.length - 1]
    return `<div class="banner banner-combat-start">
  <div class="banner-head"><span class="banner-title">⚔️ Combat Started</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body">Between ${joined}</div>
</div>`
  }
  // combat_end - blue banner + combatants list
  if (r.outcome === 'combat_end' && (r.damage_json as any)?.combatants) {
    const combatants = ((r.damage_json as any).combatants as string[])
    const inner = combatants.length === 0 ? '' :
      `<div class="banner-body">Between ${combatants.map(n => `<span style="color:#f5f2ee;font-weight:600">${esc(n)}</span>`).reduce((acc, name, i, arr) => acc + name + (i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''), '')}</div>`
    return `<div class="banner banner-combat-end">
  <div class="banner-head"><span class="banner-title">⚔️ Combat Ended</span><span class="time">${esc(time)}</span></div>
  ${inner}
</div>`
  }
  // initiative - amber banner + per-row breakdown
  if (r.outcome === 'initiative' && (r.damage_json as any)?.initiative) {
    const rows = ((r.damage_json as any).initiative as any[]).map((e: any, i: number, arr: any[]) => {
      const init = (e.acu ?? 0) + (e.dex ?? 0)
      const nameColor = e.is_npc === false ? '#7ab3d4' : '#f5f2ee'
      const initChip = init !== 0 ? ` <span style="color:#7fc458">${init > 0 ? '+' : ''}${init} Init</span>` : ''
      const dropChip = e.drop !== 0 ? ` <span style="color:#f5a89a">${e.drop} Drop</span>` : ''
      const sep = i < arr.length - 1 ? 'border-bottom:1px solid #2e2e2e' : ''
      return `<div style="display:flex;align-items:baseline;gap:6px;padding:3px 0;${sep}">
  <span style="font-size:13px;font-weight:700;color:${nameColor};text-transform:uppercase;min-width:90px">${esc(e.name ?? '')}</span>
  <span style="font-size:13px;color:#f5f2ee">[${e.d1}+${e.d2}]${initChip}${dropChip}</span>
  <span style="margin-left:auto;font-size:14px;font-weight:700;color:#EF9F27">${e.total}</span>
</div>`
    }).join('')
    const round = (r.damage_json as any).round
    return `<div class="banner banner-initiative">
  <div class="banner-head"><span class="banner-title">⚔️ Initiative${round ? ` (Round ${esc(String(round))})` : ''}</span><span class="time">${esc(time)}</span></div>
  ${rows}
</div>`
  }
  // drop - amber banner with "acts alone" footer
  if (r.outcome === 'drop') {
    return `<div class="banner banner-amber">
  <div class="banner-head"><span class="banner-title amber">${esc(r.label)}</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body">Acts alone with 1 action before initiative is rolled.</div>
</div>`
  }
  // defer - blue, single-line tag
  if (r.outcome === 'defer') {
    return `<div class="banner banner-defer">
  <div class="banner-head"><span class="banner-title-sm blue">${esc(r.label)}</span><span class="time">${esc(time)}</span></div>
</div>`
  }
  // sprint - amber banner; export-time we always show the breakdown
  // (no expand/collapse toggle in static HTML).
  if (r.outcome === 'sprint') {
    const tr = (r.damage_json as any)?.trimmedRoll
    const windedFlag = (r.damage_json as any)?.winded
    const isWinded = typeof windedFlag === 'boolean'
      ? windedFlag
      : (tr?.rollOutcome === 'Failure' || tr?.rollOutcome === 'Dire Failure')
    let trBlock = ''
    if (tr) {
      const dice = Array.isArray(tr.diceRolled) && tr.diceRolled.length > 0 ? tr.diceRolled.join('+') : `${tr.die1}+${tr.die2}`
      const amodChip = tr.amod !== 0 ? ` <span style="color:${tr.amod > 0 ? '#7fc458' : '#c0392b'}">${tr.amod > 0 ? '+' : ''}${tr.amod} AMod</span>` : ''
      const smodChip = tr.smod !== 0 ? ` <span style="color:${tr.smod > 0 ? '#7fc458' : '#c0392b'}">${tr.smod > 0 ? '+' : ''}${tr.smod} SMod</span>` : ''
      const cmodChip = tr.cmod !== 0 ? ` <span style="color:${tr.cmod > 0 ? '#7ab3d4' : '#EF9F27'}">${tr.cmod > 0 ? '+' : ''}${tr.cmod} CMod</span>` : ''
      const oc = outcomeColor(tr.rollOutcome)
      trBlock = `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a3a3a;font-size:13px;color:#f5f2ee">
  <div>[${dice}]${amodChip}${smodChip}${cmodChip} <span style="color:#f5f2ee;font-weight:700"> = ${tr.total}</span> <span style="margin-left:8px;color:${oc};font-weight:700">${esc(tr.rollOutcome ?? '')}</span></div>
  <div style="margin-top:4px;color:${isWinded ? '#f5a89a' : '#7fc458'};font-weight:600">${isWinded ? 'Loses 1 Combat Action next round.' : 'Full 2 actions next round.'}</div>
</div>`
    }
    const sprintLabel = r.label.replace(/^🏃\s*/, '')
    return `<div class="banner banner-amber">
  <div class="banner-head"><span class="banner-title amber">🏃 Sprint</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body">${esc(sprintLabel)}</div>
  ${trBlock}
</div>`
  }
  // death - dark red banner; uses character_name as the header
  if (r.outcome === 'death' || r.character_name === 'Death is in the air') {
    return `<div class="banner banner-death">
  <div class="banner-head"><span class="banner-title red">${esc(r.character_name)}</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:#f5a89a">${esc(r.label)}</div>
</div>`
  }
  // incap - amber, less alarming than death
  if (r.outcome === 'incap' || r.character_name === 'Lights Out' || r.character_name === 'Lights out') {
    return `<div class="banner banner-incap">
  <div class="banner-head"><span class="banner-title amber">${esc(r.character_name)}</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:#f5d8a0">${esc(r.label)}</div>
</div>`
  }
  // revive - green palette
  if (r.outcome === 'revive' || r.character_name === 'Coming around') {
    return `<div class="banner banner-revive">
  <div class="banner-head"><span class="banner-title green">${esc(r.character_name)}</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:#c4e8a8">${esc(r.label)}</div>
</div>`
  }
  // wound_infection_warning - amber outline, fires once per character
  // per combat on first shot/stab/cut wound (canon §06 reminder).
  if (r.outcome === 'wound_infection_warning') {
    return `<div class="banner banner-incap">
  <div class="banner-head"><span class="banner-title amber">🩸 Wound Infection Warning</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:#f5d8a0">${esc(r.label)}</div>
</div>`
  }
  // weapon_malfunction - amber outline, Low Insight on a non-Unarmed
  // weapon roll. Same shape as the wound-infection banner.
  if (r.outcome === 'weapon_malfunction') {
    return `<div class="banner banner-incap">
  <div class="banner-head"><span class="banner-title amber">⚠️ Weapon Malfunction</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:#f5d8a0">${esc(r.label)}</div>
</div>`
  }

  // retention_check - community survival check (post-3-failures Morale).
  // Survived = community holds; not-survived = community dissolves. Dice
  // math always shown in export (no ▸/▾ toggle in static HTML).
  if (r.outcome === 'retention_check') {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const survived = !!dj.survived
    const colorHex = survived ? '#7fc458' : '#c0392b'
    const bgHex = survived ? '#0f1a2e' : '#1a0a0a'
    const leaderName = dj.leaderName || 'The leader'
    const communityName = dj.communityName || 'the Community'
    const narrative = survived
      ? `${esc(leaderName)} rallied the survivors and the Community still exists`
      : `With the members fragmenting in different directions, ${esc(communityName)} has dissolved.`
    const rolledBy = dj.leaderName
      ? `<div style="margin-bottom:4px;color:#cce0f5">Rolled by <span style="color:#f5f2ee;font-weight:700">${esc(dj.leaderName)}</span>${dj.leaderKind ? ` <span style="color:#f5f2ee">(${dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>` : ''}${dj.skillUsed ? ` - <span style="color:#7ab3d4">${esc(dj.skillUsed)}</span>` : ''}</div>`
      : ''
    const amodChip = r.amod !== 0 ? ` <span style="color:${r.amod > 0 ? '#7fc458' : '#c0392b'}">${r.amod > 0 ? '+' : ''}${r.amod} AMod</span>` : ''
    const smodChip = r.smod !== 0 ? ` <span style="color:${r.smod > 0 ? '#7fc458' : '#c0392b'}">${r.smod > 0 ? '+' : ''}${r.smod} SMod</span>` : ''
    const moodChip = ` <span style="color:${r.cmod < 0 ? '#f5a89a' : '#cce0f5'}">${r.cmod >= 0 ? '+' : ''}${r.cmod} Mood</span>`
    const survivedFooter = survived && typeof dj.consecutiveFailuresAfter === 'number'
      ? `<div style="margin-top:4px;color:#7fc458">Community retained - consecutive failures reset to <span style="font-weight:700">${dj.consecutiveFailuresAfter}</span>.</div>`
      : ''
    return `<div style="margin-bottom:8px;padding:10px;background:${bgHex};border:1px solid ${colorHex};border-radius:3px;border-left:3px solid ${colorHex}">
  <div class="banner-head"><span class="banner-title" style="color:#f5f2ee">🙏 Week ${esc(String(dj.weekNumber ?? '?'))} · ${esc(dj.communityName ?? '?')} · Retention</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body" style="color:${survived ? '#c4e8a8' : '#f5a89a'};font-weight:600">${narrative}</div>
  <div style="margin-top:8px;padding-top:6px;border-top:1px solid #2e2e2e;font-size:13px;color:#f5f2ee">
    ${rolledBy}
    <div>[${r.die1}+${r.die2}]${amodChip}${smodChip}${moodChip} <span style="color:#f5f2ee;font-weight:700"> = ${r.total}</span> <span style="margin-left:8px;color:${colorHex};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${esc(rollOutcome)}</span></div>
    ${survivedFooter}
  </div>
</div>`
  }

  // fed_check / clothed_check - weekly resource check.
  // 'fed_check' DB key, "Gather Check" display name per 2026-05-10 rename.
  if (r.outcome === 'fed_check' || r.outcome === 'clothed_check') {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const emoji = r.outcome === 'fed_check' ? '🌾' : '🔧'
    const title = r.outcome === 'fed_check' ? 'Gather Check' : 'Clothed Check'
    const colorHex = outcomeColor(rollOutcome)
    const isHit = rollOutcome === 'Success' || rollOutcome === 'Wild Success' || rollOutcome === 'High Insight'
    const successBody = r.outcome === 'fed_check'
      ? 'The residents were successful and will eat this week.'
      : 'The residents were successful and have scrounged up what they need.'
    const failBody = r.outcome === 'fed_check'
      ? 'The residents were unsuccessful and will go hungry this week.'
      : 'The residents were unsuccessful and will go without this week.'
    const body = isHit ? successBody : failBody
    const rolledBy = dj.leaderName
      ? `<div style="margin-bottom:4px;color:#cce0f5">Rolled by <span style="color:#f5f2ee;font-weight:700">${esc(dj.leaderName)}</span>${dj.leaderKind ? ` <span style="color:#f5f2ee">(${dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>` : ''}${dj.skillUsed ? ` - <span style="color:#7ab3d4">${esc(dj.skillUsed)}</span>` : ''}</div>`
      : ''
    const amodChip = r.amod !== 0 ? ` <span style="color:${r.amod > 0 ? '#7fc458' : '#c0392b'}">${r.amod > 0 ? '+' : ''}${r.amod} AMod</span>` : ''
    const smodChip = r.smod !== 0 ? ` <span style="color:${r.smod > 0 ? '#7fc458' : '#c0392b'}">${r.smod > 0 ? '+' : ''}${r.smod} SMod</span>` : ''
    const cmodChip = r.cmod !== 0 ? ` <span style="color:${r.cmod > 0 ? '#7ab3d4' : '#EF9F27'}">${r.cmod > 0 ? '+' : ''}${r.cmod} CMod</span>` : ''
    const nextCmod = dj.cmodForNextMorale ?? 0
    const nextCmodColor = nextCmod > 0 ? '#7fc458' : nextCmod < 0 ? '#f5a89a' : '#cce0f5'
    return `<div style="margin-bottom:8px;padding:8px 10px;background:#111;border:1px solid ${colorHex}33;border-radius:3px;border-left:3px solid ${colorHex}">
  <div class="banner-head"><span class="banner-title" style="color:#f5f2ee">${emoji} Week ${esc(String(dj.weekNumber ?? '?'))} · ${esc(dj.communityName ?? '?')} · ${title}</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body">${body}</div>
  <div style="margin-top:6px;padding-top:6px;border-top:1px solid #2e2e2e;font-size:13px;color:#f5f2ee">
    ${rolledBy}
    <div>[${r.die1}+${r.die2}]${amodChip}${smodChip}${cmodChip} <span style="color:#f5f2ee;font-weight:700"> = ${r.total}</span> <span style="margin-left:8px;color:${colorHex};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${esc(rollOutcome)}</span></div>
    <div style="margin-top:4px;color:#cce0f5">→ Next Morale CMod <span style="color:${nextCmodColor};font-weight:700">${nextCmod > 0 ? '+' : ''}${nextCmod}</span></div>
  </div>
</div>`
  }

  // morale_check - weekly community Morale Check with named-slot breakdown.
  // 3 consecutive failures = community dissolves; willDissolve flag from
  // damage_json drives the red palette + scattered-members narrative.
  if (r.outcome === 'morale_check') {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const slots = (dj.slots ?? {}) as any
    const willDissolve = !!dj.willDissolve
    const colorHex = willDissolve ? '#c0392b' : outcomeColor(rollOutcome)
    const isHit = rollOutcome === 'Success' || rollOutcome === 'Wild Success' || rollOutcome === 'High Insight'
    const leaderName = dj.leaderName || 'The leader'
    const communityName = dj.communityName || 'the Community'
    let narrative: string
    if (willDissolve) {
      narrative = `After 3 consecutive failures of confidence in ${esc(leaderName)}, ${esc(communityName)} has dissolved. All ${esc(String(dj.membersBefore ?? '?'))} members scattered.`
    } else if (isHit) {
      narrative = `${esc(leaderName)} inspired ${esc(communityName)} and morale was maintained. The Mood around the Campfire is good.`
    } else {
      narrative = `${esc(leaderName)} fails to inspire ${esc(communityName)}. Morale has dropped and people are leaving. The Mood around the Campfire is not good.`
    }
    const fmt = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
    const cmodClr = (n: number) => n > 0 ? '#7fc458' : n < 0 ? '#f5a89a' : '#cce0f5'
    const rolledBy = dj.leaderName
      ? `<div style="margin-bottom:4px;color:#cce0f5">Rolled by <span style="color:#f5f2ee;font-weight:700">${esc(dj.leaderName)}</span>${dj.leaderKind ? ` <span style="color:#f5f2ee">(${dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>` : ''}${dj.skillUsed ? ` - <span style="color:#7ab3d4">${esc(dj.skillUsed)}</span>` : ''}</div>`
      : ''
    const amodChip = r.amod !== 0 ? ` <span style="color:${r.amod > 0 ? '#7fc458' : '#c0392b'}">${r.amod > 0 ? '+' : ''}${r.amod} AMod</span>` : ''
    const smodChip = r.smod !== 0 ? ` <span style="color:${r.smod > 0 ? '#7fc458' : '#c0392b'}">${r.smod > 0 ? '+' : ''}${r.smod} SMod</span>` : ''
    const cmodChip = r.cmod !== 0 ? ` <span style="color:${r.cmod > 0 ? '#7ab3d4' : '#EF9F27'}">${r.cmod > 0 ? '+' : ''}${r.cmod} CMod</span>` : ''
    let slotsLine = ''
    if (slots && Object.keys(slots).length > 0) {
      const pairs: [string, number][] = [
        ['Mood', slots.mood ?? 0], ['Fed', slots.fed ?? 0], ['Clothed', slots.clothed ?? 0],
        ['Hands', slots.enoughHands ?? 0], ['Voice', slots.clearVoice ?? 0], ['Watch', slots.safety ?? 0],
      ]
      const parts = pairs.map(([n, v]) => ` · ${n} <span style="color:${cmodClr(v)};font-weight:700">${fmt(v)}</span>`)
      if (slots.additional !== 0 && slots.additional != null) {
        parts.push(` · Additional <span style="color:${cmodClr(slots.additional)};font-weight:700">${fmt(slots.additional)}</span>`)
      }
      slotsLine = `<div style="color:#cce0f5;line-height:1.6;margin-bottom:4px"><span style="color:#f5f2ee">Slots:</span>${parts.join('')}</div>`
    }
    let departureLine = ''
    if (!willDissolve && dj.departureCount > 0) {
      const names = Array.isArray(dj.departureNames) ? dj.departureNames.map((n: any) => esc(String(n))).join(', ') : ''
      departureLine = `<div style="color:#EF9F27">${esc(String(dj.departureCount))} left: <span style="color:#f5f2ee">${names}</span><span style="color:#cce0f5"> · ${esc(String(dj.membersAfter ?? '?'))}/${esc(String(dj.membersBefore ?? '?'))} remaining · ${esc(String(dj.consecutiveFailuresAfter ?? '?'))}/3 failures</span></div>`
    }
    let nextMoraleLine = ''
    if (!willDissolve) {
      nextMoraleLine = `<div style="color:#7fc458;margin-top:4px">${isHit ? 'Morale holds. ' : ''}Next Morale CMod: <span style="font-weight:700">${fmt(dj.cmodForNext ?? 0)}</span></div>`
    }
    return `<div style="margin-bottom:8px;padding:10px;background:${willDissolve ? '#1a0a0a' : '#111'};border:1px solid ${colorHex};border-radius:3px;border-left:3px solid ${colorHex}">
  <div class="banner-head"><span class="banner-title" style="color:#f5f2ee">📊 Week ${esc(String(dj.weekNumber ?? '?'))} · ${esc(dj.communityName ?? '?')} · Morale</span><span class="time">${esc(time)}</span></div>
  <div class="banner-body">${narrative}</div>
  <div style="margin-top:8px;padding-top:6px;border-top:1px solid #2e2e2e;font-size:13px;color:#f5f2ee">
    ${rolledBy}
    <div style="margin-bottom:4px">[${r.die1}+${r.die2}]${amodChip}${smodChip}${cmodChip} <span style="color:#f5f2ee;font-weight:700"> = ${r.total}</span> <span style="margin-left:8px;color:${colorHex};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${esc(rollOutcome)}</span></div>
    ${slotsLine}
    ${departureLine}
    ${nextMoraleLine}
  </div>
</div>`
  }

  return null
}

function renderChat(m: ChatMessageRow): string {
  const time = formatTime(m.created_at)
  const isW = m.is_whisper
  // Whispers get a distinct purple palette; regular chat is neutral.
  const cls = isW ? 'chat whisper' : 'chat'
  const tag = isW ? `<span class="whisper-tag">whisper</span>` : ''
  return `<div class="${cls}">
  <div class="chat-head"><span class="chat-name">${esc(m.character_name ?? '')}</span>${tag}<span class="time">${esc(time)}</span></div>
  <div class="chat-body">${esc(m.message ?? '')}</div>
</div>`
}

function renderRow(r: RollLogRow): string {
  // Bespoke banners short-circuit - high-signal row types (combat
  // start/end, drop, defer, sprint, death, incap, revive, initiative)
  // each have their own template that mirrors RollsFeed.tsx.
  const bespoke = renderBespokeBanner(r)
  if (bespoke) return bespoke

  // Compute the compact narrative the same way RollsFeed does, with the
  // safety fallback for unknown types.
  const compactRaw = compactRollSummary(r)
  let compact = compactRaw ?? r.label.split('\n')[0]
    .replace(/\s+Live feed adds.*$/, '')
    .replace(/\s+\+1 Insight Die\b.*$/, '')
    .trim()
  // Bulletproof outcome guard - strip baked-in "Moment of Insight" text
  // unless this row's outcome is actually HI or LI. Mirrors the same
  // guard in RollsFeed.tsx.
  const isInsightOutcome = r.outcome === 'High Insight' || r.outcome === 'Low Insight'
  if (!isInsightOutcome) {
    compact = compact
      .replace(/\s+and has a Moment of Insight\b.*$/, '')
      .replace(/\s+but has a Moment of Insight\b.*$/, '')
      .replace(/\s+and collectively have a Moment of Insight\b.*$/, '')
      .replace(/\s+but collectively have a Moment of Insight\b.*$/, '')
      .replace(/\s+collectively had a Moment of Insight\b.*$/, '')
      .replace(/\s+had a Moment of Insight\b.*$/, '')
  }
  const hasRealDice = r.die1 > 0 || r.die2 > 0
  const showBadge = !!r.insight_awarded && isInsightOutcome
  const time = formatTime(r.created_at)
  const color = colorClass(r.outcome)
  const out = outcomeColor(r.outcome)
  let diceLine = ''
  if (hasRealDice) {
    const die3 = (r.damage_json as any)?.die3
    const dieBracket = r.insight_used === '3d6' && typeof die3 === 'number'
      ? `[${r.die1}+${r.die2 - die3}+${die3} <span style="color:#7fc458;font-size:13px">(insight die)</span>]`
      : (r.die2 > 6
        ? `[${r.die1} + ${r.die2} <span style="color:#7fc458;font-size:13px">(d2+d3)</span>]`
        : `[${r.die1}+${r.die2}]`)
    const amodChip = r.amod !== 0 ? ` <span style="color:${r.amod > 0 ? '#7fc458' : '#c0392b'}">${r.amod > 0 ? '+' : ''}${r.amod} AMod</span>` : ''
    const smodChip = r.smod !== 0 ? ` <span style="color:${r.smod > 0 ? '#7fc458' : '#c0392b'}">${r.smod > 0 ? '+' : ''}${r.smod} SMod</span>` : ''
    const cmodChip = r.cmod !== 0 ? ` <span style="color:${r.cmod > 0 ? '#7ab3d4' : '#EF9F27'}">${r.cmod > 0 ? '+' : ''}${r.cmod} CMod${r.insight_used === '+3cmod' ? ' <span style="color:#7fc458;font-size:13px">(insight die)</span>' : ''}</span>` : ''
    diceLine = `<div class="dice">${dieBracket}${amodChip}${smodChip}${cmodChip} <span class="total">= ${r.total}</span> <span style="margin-left:8px;font-weight:700;color:${out};letter-spacing:.06em;text-transform:uppercase">${esc(r.outcome)}</span></div>`
  }
  const spendLine = (r.insight_used === '3d6' || r.insight_used === '+3cmod')
    ? `<div class="spent">Insight Die spent ${r.insight_used === '+3cmod' ? '- +3 CMod' : 'to pre-roll 3d6 and keep all 3'}</div>`
    : ''
  const badge = showBadge ? '<span class="badge">+1 Insight Die</span>' : ''
  return `<div class="row ${color}">
  <div class="head"><span class="name">${esc(r.character_name)}</span><span class="time">${esc(time)}</span></div>
  <div class="narrative">${esc(compact)}${badge}</div>
  ${diceLine}
  ${spendLine}
</div>`
}

// Combined feed item - discriminated union so the interleave can sort
// rolls + chat by created_at and render each through its own template.
type FeedItem =
  | { kind: 'roll'; created_at: string; row: RollLogRow }
  | { kind: 'chat'; created_at: string; msg: ChatMessageRow }

function renderHtml(args: { campaignName: string; sessionNumber: number; exportedAt: string; items: FeedItem[] }): string {
  const title = `${args.campaignName} - Session ${args.sessionNumber} Log`
  const body = args.items.length > 0
    ? args.items.map(it => it.kind === 'roll' ? renderRow(it.row) : renderChat(it.msg)).join('\n')
    : '<div class="empty">No roll-log or chat entries for this session.</div>'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root {
    --bg: #0e0e0e; --bg-row: #1a1a1a; --border: #2e2e2e;
    --text: #f5f2ee; --text-strong: #f5f2ee; --label: #cce0f5;
    --green: #7fc458; --blue: #7ab3d4; --amber: #EF9F27; --red: #c0392b;
  }
  html, body { background: var(--bg); margin: 0; padding: 24px 24px 80px; font-family: 'Carlito', 'Segoe UI', sans-serif; color: var(--text); }
  h1 { color: var(--text-strong); font-size: 22px; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 20px; }
  .feed { max-width: 720px; }
  .row { margin-bottom: 8px; padding: 8px; background: var(--bg-row); border: 1px solid var(--border); border-radius: 3px; border-left-width: 3px; border-left-style: solid; }
  .row.green { border-left-color: var(--green); }
  .row.blue { border-left-color: var(--blue); }
  .row.amber { border-left-color: var(--amber); }
  .row.red { border-left-color: var(--red); }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
  .name { font-size: 14px; font-weight: 700; color: var(--text-strong); letter-spacing: .04em; text-transform: uppercase; }
  .time { font-size: 13px; color: var(--label); }
  .narrative { font-size: 15px; color: var(--text); }
  .dice { font-size: 14px; color: var(--text); margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--border); font-family: 'Carlito', sans-serif; }
  .dice .total { color: var(--text-strong); font-weight: 700; }
  .badge { display: inline-block; font-size: 13px; color: var(--green); background: #1a2e10; border: 1px solid #2d5a1b; padding: 1px 5px; border-radius: 2px; margin-left: 6px; }
  .spent { font-size: 13px; color: var(--green); margin-top: 2px; }
  .empty { color: #888; font-style: italic; padding: 1rem; }
  /* Bespoke banners - mirror the live feed Tier-A row types. */
  .banner { margin-bottom: 8px; padding: 8px 10px; border-radius: 3px; border: 1px solid var(--border); border-left-width: 3px; border-left-style: solid; }
  .banner-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .banner-title { font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-family: 'Carlito', sans-serif; }
  .banner-title-sm { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; font-family: 'Carlito', sans-serif; }
  .banner-title.amber, .banner-title-sm.amber { color: var(--amber); }
  .banner-title.blue, .banner-title-sm.blue { color: var(--blue); }
  .banner-title.green, .banner-title-sm.green { color: var(--green); }
  .banner-title.red, .banner-title-sm.red { color: var(--red); }
  .banner-body { font-size: 15px; color: var(--text); font-family: 'Carlito', sans-serif; line-height: 1.5; }
  .banner-combat-start { background: #1a1010; border-color: var(--red); border-left-color: var(--red); }
  .banner-combat-start .banner-title { color: #f5a89a; }
  .banner-combat-end { background: #0f2035; border-color: #1a3a5c; border-left-color: var(--blue); }
  .banner-combat-end .banner-title { color: var(--blue); }
  .banner-initiative { background: #1a1a1a; border-color: var(--amber); border-left-color: var(--amber); padding: 8px; }
  .banner-initiative .banner-title { color: var(--amber); }
  .banner-amber { background: #1a2010; border-color: var(--amber); border-left-color: var(--amber); }
  .banner-defer { background: #0f1a2e; border-color: var(--blue); border-left-color: var(--blue); padding: 8px 10px; }
  .banner-death { background: #1a0a0a; border-color: #5a1b1b; border-left-color: var(--red); }
  .banner-incap { background: #1a1408; border-color: #5a4218; border-left-color: var(--amber); }
  .banner-revive { background: #0f1f08; border-color: #2d5a1b; border-left-color: var(--green); }
  /* Chat messages - interleaved with rolls by created_at. */
  .chat { margin-bottom: 6px; padding: 6px 10px; background: #14181c; border: 1px solid #2e2e2e; border-radius: 3px; }
  .chat.whisper { background: #1a0f1a; border-color: #5a2e5a; }
  .chat-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px; }
  .chat-name { font-size: 13px; font-weight: 700; color: var(--text-strong); letter-spacing: .04em; text-transform: uppercase; }
  .whisper-tag { font-size: 13px; color: #d48bd4; background: #2a102a; border: 1px solid #5a2e5a; padding: 0 5px; border-radius: 2px; text-transform: uppercase; letter-spacing: .04em; }
  .chat-body { font-size: 14px; color: var(--text); font-family: 'Carlito', sans-serif; }
  .chat .time { margin-left: auto; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">Exported ${esc(args.exportedAt)} · ${args.items.length} entries</div>
<div class="feed">
${body}
</div>
</body>
</html>
`
}

// Main entry point. Fetches roll_log + chat_messages, interleaves
// them by created_at, and writes a download. RLS applies to both
// fetches so whispers the exporter can't see stay invisible; the
// GM (who owns the campaign) sees everything they would see live.
export async function exportSessionLog(args: {
  campaignId: string
  campaignName: string
  sessionNumber: number
}): Promise<void> {
  const supabase = createClient()
  // Parallel fetches - independent tables.
  const [rollsRes, chatRes] = await Promise.all([
    supabase
      .from('roll_log')
      .select('id, character_name, label, die1, die2, amod, smod, cmod, total, outcome, insight_awarded, insight_used, target_name, damage_json, created_at')
      .eq('campaign_id', args.campaignId)
      .order('created_at', { ascending: true }),
    supabase
      .from('chat_messages')
      .select('id, user_id, character_name, message, is_whisper, recipient_user_id, created_at')
      .eq('campaign_id', args.campaignId)
      .order('created_at', { ascending: true }),
  ])
  if (rollsRes.error) {
    console.error('[session-export] roll_log fetch failed:', rollsRes.error.message)
    alert(`Export failed: ${rollsRes.error.message}`)
    return
  }
  if (chatRes.error) {
    // Don't fail the export on chat-fetch error - the roll log is the
    // higher-signal payload. Log + continue without chat.
    console.error('[session-export] chat_messages fetch failed (continuing without chat):', chatRes.error.message)
  }
  const rows = (rollsRes.data ?? []) as RollLogRow[]
  const chat = (chatRes.data ?? []) as ChatMessageRow[]
  // Interleave by created_at - rolls and chat ordered chronologically.
  const items: FeedItem[] = [
    ...rows.map(r => ({ kind: 'roll' as const, created_at: r.created_at, row: r })),
    ...chat.map(m => ({ kind: 'chat' as const, created_at: m.created_at, msg: m })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const exportedAt = new Date().toLocaleString('en-US')
  const html = renderHtml({
    campaignName: args.campaignName,
    sessionNumber: args.sessionNumber,
    exportedAt,
    items,
  })
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${args.campaignName.replace(/[^a-z0-9-]/gi, '_').toLowerCase()}-session-${args.sessionNumber}-${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
