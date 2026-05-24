// Player-bar status condition chips. Visible to everyone so a glance shows
// who is sick / dying / incapacitated / stressed out, for GM and players
// alike. Reads liveState (kept fresh by the character_states realtime sub).
// The lasting-wound chip is a fast-follow: lasting wounds are feed-derived
// (roll_log rows parsed in CharacterCard), not a character_states column.

interface PlayerStatusChipsProps {
  liveState: any
}

export function PlayerStatusChips({ liveState }: PlayerStatusChipsProps) {
  const ls: any = liveState ?? {}
  const chips: { key: string; label: string; fg: string; bg: string }[] = []
  if (ls.infection_state) chips.push({ key: 'inf', label: `🦠 ${ls.infection_state === 'sickness' ? 'Sick' : 'Infected'}${ls.infection_days_left ? ` ${ls.infection_days_left}d` : ''}`, fg: '#d48bd4', bg: '#2e1a2e' })
  if ((ls.death_countdown ?? 0) > 0) chips.push({ key: 'mw', label: `💀 MW ${ls.death_countdown}`, fg: '#f5a89a', bg: '#2a0f0f' })
  if ((ls.incap_rounds ?? 0) > 0) chips.push({ key: 'incap', label: '😵 Incap', fg: '#9aa8f5', bg: '#16162a' })
  if ((ls.stress ?? 0) >= 5) chips.push({ key: 'stress', label: '😰 Stressed', fg: '#EF9F27', bg: '#2a2010' })
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center', marginTop: '3px' }}>
      {chips.map(c => (
        <span key={c.key} style={{ fontSize: '13px', background: c.bg, color: c.fg, border: `1px solid ${c.fg}`, borderRadius: '3px', padding: '0 4px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.03em', lineHeight: 1.35, whiteSpace: 'nowrap' }}>{c.label}</span>
      ))}
    </div>
  )
}
