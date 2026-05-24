// Y11-e RLA-S: format a session's roll_log rows into a readable text digest,
// captured onto sessions.session_log at end-session so a past session's summary
// contains its log. Pure (no DB / no framework) so the formatting is unit-tested.

export interface SessionLogRow {
  created_at?: string | null
  character_name?: string | null
  label?: string | null
  die1?: number | null
  die2?: number | null
  total?: number | null
  outcome?: string | null
}

// UTC HH:MM from an ISO timestamp (deterministic for tests; a captured archive
// doesn't need viewer-local time). Empty string on a missing/invalid date.
function hhmm(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16)
}

export function buildSessionLogDigest(rows: SessionLogRow[]): string {
  if (!rows || rows.length === 0) return ''
  return rows
    .map(r => {
      const t = hhmm(r.created_at)
      const who = (r.character_name && r.character_name.trim()) || 'System'
      const label = (r.label ?? '').trim()
      // A real dice roll has nonzero dice; action / banner lines (die1=die2=0)
      // carry their content in the label only, no total/outcome suffix.
      const isRoll = (r.die1 ?? 0) !== 0 || (r.die2 ?? 0) !== 0
      const outcome = r.outcome && r.outcome !== 'action' ? ` (${r.outcome.replace(/_/g, ' ')})` : ''
      const rollPart = isRoll ? ` = ${r.total ?? 0}${outcome}` : ''
      const prefix = t ? `[${t}] ` : ''
      return `${prefix}${who}: ${label}${rollPart}`.trimEnd()
    })
    .join('\n')
}
