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
    case 'Wild Success': return 'green'
    case 'High Insight': return 'green'
    case 'Success': return 'blue'
    case 'Failure': return 'amber'
    case 'Dire Failure': return 'red'
    case 'Low Insight': return 'red'
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

function renderRow(r: RollLogRow): string {
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

function renderHtml(args: { campaignName: string; sessionNumber: number; exportedAt: string; rows: RollLogRow[] }): string {
  const title = `${args.campaignName} - Session ${args.sessionNumber} Log`
  const body = args.rows.length > 0
    ? args.rows.map(renderRow).join('\n')
    : '<div class="empty">No roll-log entries for this session.</div>'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root {
    --bg: #0e0e0e; --bg-row: #1a1a1a; --border: #2e2e2e;
    --text: #d4cfc9; --text-strong: #f5f2ee; --label: #cce0f5;
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
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">Exported ${esc(args.exportedAt)} · ${args.rows.length} entries</div>
<div class="feed">
${body}
</div>
</body>
</html>
`
}

// Main entry point. Fetches roll_log + writes a download.
export async function exportSessionLog(args: {
  campaignId: string
  campaignName: string
  sessionNumber: number
}): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('roll_log')
    .select('id, character_name, label, die1, die2, amod, smod, cmod, total, outcome, insight_awarded, insight_used, target_name, damage_json, created_at')
    .eq('campaign_id', args.campaignId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[session-export] roll_log fetch failed:', error.message)
    alert(`Export failed: ${error.message}`)
    return
  }
  const rows = (data ?? []) as RollLogRow[]
  const exportedAt = new Date().toLocaleString('en-US')
  const html = renderHtml({
    campaignName: args.campaignName,
    sessionNumber: args.sessionNumber,
    exportedAt,
    rows,
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
