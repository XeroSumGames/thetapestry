// Player-bar status condition chips. Visible to everyone so a glance shows
// who is sick / dying / incapacitated / stressed out, for GM and players
// alike. Reads liveState (kept fresh by the character_states realtime sub).
// The lasting-wound chip is a fast-follow: lasting wounds are feed-derived
// (roll_log rows parsed in CharacterCard), not a character_states column.

import { LASTING_WOUNDS } from '../../../../../lib/xse-schema'

interface PlayerStatusChipsProps {
  liveState: any
  /** PC lasting wounds (characters.data.lastingWounds) - feed/sheet source. */
  lastingWounds?: string[]
}

export function PlayerStatusChips({ liveState, lastingWounds }: PlayerStatusChipsProps) {
  const ls: any = liveState ?? {}
  // Each chip carries a `title` so hovering shows the specifics (e.g. which
  // infection + days left), not just the icon. Same pattern the lasting-wound
  // chip will follow (hover -> the actual wound).
  const chips: { key: string; label: string; title: string; fg: string; bg: string }[] = []
  if (ls.infection_state) {
    const kind = ls.infection_state === 'sickness' ? 'Sickness' : 'Wound infection'
    const days = ls.infection_days_left ? ` - ${ls.infection_days_left} day${ls.infection_days_left === 1 ? '' : 's'} left` : ''
    const sev = ls.infection_severity ? ` (${ls.infection_severity === 'auto' ? 'Lasting Damage on Day 0' : 'PHY check at Day 0'})` : ''
    chips.push({ key: 'inf', label: `🦠 ${ls.infection_state === 'sickness' ? 'Sick' : 'Infected'}${ls.infection_days_left ? ` ${ls.infection_days_left}d` : ''}`, title: `${kind}${days}${sev}`, fg: '#d48bd4', bg: '#2e1a2e' })
  }
  if ((ls.death_countdown ?? 0) > 0) chips.push({ key: 'mw', label: `💀 MW ${ls.death_countdown}`, title: `Mortally wounded - dies in ${ls.death_countdown} round${ls.death_countdown === 1 ? '' : 's'} if not stabilized`, fg: '#f5a89a', bg: '#2a0f0f' })
  if ((ls.incap_rounds ?? 0) > 0) chips.push({ key: 'incap', label: '😵 Incap', title: `Incapacitated for ${ls.incap_rounds} more round${ls.incap_rounds === 1 ? '' : 's'}`, fg: '#9aa8f5', bg: '#16162a' })
  if ((ls.stress ?? 0) >= 5) chips.push({ key: 'stress', label: '😰 Stressed', title: `Stressed out (${ls.stress}/5) - at breaking point`, fg: '#EF9F27', bg: '#2a2010' })
  // Lasting wounds are not a character_states column - they live on
  // characters.data.lastingWounds (the same source the sheet chip strip
  // reads). One chip regardless of count; the tooltip lists each wound +
  // its canon effect (LASTING_WOUNDS lookup, mirrors CharacterCard).
  if ((lastingWounds?.length ?? 0) > 0) {
    const lw = lastingWounds as string[]
    const detail = lw.map(name => {
      const def = Object.values(LASTING_WOUNDS).find(w => w.name === name)
      return def?.effect ? `${name} - ${def.effect}` : name
    }).join('; ')
    chips.push({ key: 'wound', label: lw.length === 1 ? '🩸 Wounded' : `🩸 ${lw.length} Wounds`, title: `Lasting wound${lw.length === 1 ? '' : 's'}: ${detail}`, fg: '#f5a89a', bg: '#2a1210' })
  }
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px', alignItems: 'center' }}>
      {chips.map(c => (
        <span key={c.key} title={c.title} style={{ fontSize: '13px', background: c.bg, color: c.fg, border: `1px solid ${c.fg}`, borderRadius: '3px', padding: '0 4px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.03em', lineHeight: 1.35, whiteSpace: 'nowrap', cursor: 'help' }}>{c.label}</span>
      ))}
    </div>
  )
}
