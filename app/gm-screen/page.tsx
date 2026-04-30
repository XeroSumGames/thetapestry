'use client'

const OUTCOMES = [
  { roll: '1+1', label: 'Low Insight', color: '#c0392b', desc: 'Critical failure. +1 Insight Die. Weapon jam possible.' },
  { roll: '0-3', label: 'Dire Failure', color: '#f5a89a', desc: 'Very bad result.' },
  { roll: '4-8', label: 'Failure', color: '#EF9F27', desc: 'Standard failure.' },
  { roll: '9-13', label: 'Success', color: '#7fc458', desc: 'Standard success.' },
  { roll: '14+', label: 'Wild Success', color: '#7ab3d4', desc: 'Exceptional success.' },
  { roll: '6+6', label: 'High Insight', color: '#d48bd4', desc: 'Critical success. +1 Insight Die.' },
]

const COMBAT_ACTIONS = [
  { name: 'Aim', cost: 1, desc: '+2 CMod on next attack. Must attack next or lost.' },
  { name: 'Attack', cost: 1, desc: 'Roll weapon skill. Damage on success.' },
  { name: 'Charge', cost: 2, desc: 'Move 20ft + melee/unarmed attack.' },
  { name: 'Coordinate', cost: 1, desc: 'Tactics roll. Allies in Close get +2 CMod vs target.' },
  { name: 'Cover Fire', cost: 1, desc: '-2 CMod to enemy\'s next action.' },
  { name: 'Defend', cost: 1, desc: '+2 defensive mod vs next attack. Clears after one hit.' },
  { name: 'Distract', cost: 1, desc: 'Steal 1 action from target.' },
  { name: 'Fire from Cover', cost: 2, desc: 'Attack from cover. Keep defense bonus.' },
  { name: 'Grapple', cost: 1, desc: 'Opposed PHY + Unarmed. Winner restrains or takes 1 RP.' },
  { name: 'Inspire', cost: 1, desc: 'Grant +1 action to ally. Once per round.' },
  { name: 'Move', cost: 1, desc: 'Move 10ft (Chebyshev).' },
  { name: 'Rapid Fire', cost: 2, desc: 'Two shots. -1 CMod first, -3 second. Ranged only.' },
  { name: 'Ready Weapon', cost: 1, desc: 'Switch, Reload, or Unjam weapon.' },
  { name: 'Reposition', cost: 1, desc: 'End-of-round positioning.' },
  { name: 'Sprint', cost: 2, desc: 'Move 30ft. Athletics check or Winded.' },
  { name: 'Subdue', cost: 1, desc: 'Non-lethal. Full RP, 50% WP damage.' },
  { name: 'Take Cover', cost: 1, desc: '+2 defense for all attacks this round. Once per round.' },
  { name: 'Unarmed', cost: 1, desc: 'PHY + Unarmed Combat. 1d3 damage.' },
  { name: 'Stabilize', cost: 1, desc: 'Medicine roll on mortally wounded. Must be Engaged.' },
]

const RANGE_BANDS = [
  { band: 'Engaged', range: '0-5ft', color: '#7fc458' },
  { band: 'Close', range: '6-30ft', color: '#7ab3d4' },
  { band: 'Medium', range: '31-100ft', color: '#EF9F27' },
  { band: 'Long', range: '101-300ft', color: '#f5a89a' },
  { band: 'Distant', range: '301-600ft', color: '#c0392b' },
]

const CONDITIONS = [
  { cond: 'Pristine', cmod: '+1', color: '#7fc458' },
  { cond: 'Used', cmod: '0', color: '#d4cfc9' },
  { cond: 'Worn', cmod: '-1', color: '#EF9F27' },
  { cond: 'Damaged', cmod: '-2', color: '#f5a89a' },
  { cond: 'Broken', cmod: 'Unusable', color: '#c0392b' },
]

const CMODS = [
  { source: 'Aim', mod: '+2' },
  { source: 'Defend', mod: '+2 defense' },
  { source: 'Take Cover', mod: '+2 defense (all attacks)' },
  { source: 'Same Target', mod: '+1 (second attack)' },
  { source: 'Coordinate', mod: '+2 vs coordinated target' },
  { source: 'Inspired', mod: '+1 action' },
  { source: 'Distracted', mod: '-1 action' },
  { source: 'Cover Fire', mod: '-2 to target' },
  { source: 'Winded', mod: '1 action next round' },
]

const HEALING = [
  { type: 'WP Recovery', rate: '1 WP per day of rest' },
  { type: 'WP (Mortally Wounded)', rate: '1 WP per 2 days of rest' },
  { type: 'RP Recovery', rate: '1 RP per hour' },
  { type: 'Death Countdown', rate: '4 + PHY rounds' },
  { type: 'Incapacitation', rate: '4 - PHY rounds, then 1 WP + 1 RP' },
  { type: 'Stress Check', rate: '2d6 + RSN + ACU >= 7' },
  { type: 'Reduce Stress', rate: '8+ hours narrative downtime' },
]

const SKILLS_MAP = [
  { skill: 'Animal Handling', attr: 'INF' }, { skill: 'Athletics', attr: 'PHY' },
  { skill: 'Barter', attr: 'INF' }, { skill: 'Demolitions', attr: 'PHY' },
  { skill: 'Driving', attr: 'DEX' }, { skill: 'Entertainment', attr: 'INF' },
  { skill: 'Farming', attr: 'ACU' }, { skill: 'Gambling', attr: 'ACU' },
  { skill: 'Heavy Weapons', attr: 'PHY' }, { skill: 'Inspiration', attr: 'INF' },
  { skill: 'Lock-Picking', attr: 'ACU' }, { skill: 'Manipulation', attr: 'INF' },
  { skill: 'Mechanic', attr: 'RSN' }, { skill: 'Medicine', attr: 'RSN' },
  { skill: 'Melee Combat', attr: 'PHY' }, { skill: 'Navigation', attr: 'RSN' },
  { skill: 'Psychology', attr: 'RSN' }, { skill: 'Ranged Combat', attr: 'DEX' },
  { skill: 'Research', attr: 'RSN' }, { skill: 'Scavenging', attr: 'ACU' },
  { skill: 'Sleight of Hand', attr: 'DEX' }, { skill: 'Specific Knowledge', attr: 'RSN' },
  { skill: 'Stealth', attr: 'PHY' }, { skill: 'Streetwise', attr: 'ACU' },
  { skill: 'Survival', attr: 'ACU' }, { skill: 'Tactics', attr: 'RSN' },
  { skill: 'Tinkerer', attr: 'DEX' }, { skill: 'Unarmed Combat', attr: 'PHY' },
  { skill: 'Weaponsmith', attr: 'DEX' },
]

const sectionStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '10px 12px' }
const headingStyle: React.CSSProperties = { fontSize: '15px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }
const cellStyle: React.CSSProperties = { fontSize: '15px', fontFamily: 'Carlito, sans-serif', padding: '2px 6px', borderBottom: '1px solid #2e2e2e' }

export default function GMScreen() {
  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', padding: '12px', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '8px' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>GM Screen</div>
        <div style={{ fontSize: '15px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Xero Sum Engine SRD v1.1</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>

        {/* Outcomes */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Outcomes</div>
          {OUTCOMES.map(o => (
            <div key={o.label} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '36px' }}>{o.roll}</span>
              <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '100px' }}>{o.label}</span>
              <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{o.desc}</span>
            </div>
          ))}
        </div>

        {/* Combat Actions */}
        <div style={{ ...sectionStyle, gridRow: 'span 2' }}>
          <div style={headingStyle}>Combat Actions</div>
          {COMBAT_ACTIONS.map(a => (
            <div key={a.name} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{ ...cellStyle, fontWeight: 700, color: '#f5f2ee', minWidth: '90px' }}>{a.name}</span>
              <span style={{ ...cellStyle, color: a.cost === 2 ? '#EF9F27' : '#7fc458', minWidth: '16px', textAlign: 'center' }}>{a.cost}</span>
              <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{a.desc}</span>
            </div>
          ))}
        </div>

        {/* Range Bands */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Range Bands</div>
          {RANGE_BANDS.map(r => (
            <div key={r.band} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ ...cellStyle, color: r.color, fontWeight: 700, minWidth: '70px' }}>{r.band}</span>
              <span style={{ ...cellStyle, color: '#d4cfc9' }}>{r.range}</span>
            </div>
          ))}
        </div>

        {/* Weapon Condition */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Weapon Condition</div>
          {CONDITIONS.map(c => (
            <div key={c.cond} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ ...cellStyle, color: c.color, fontWeight: 700, minWidth: '70px' }}>{c.cond}</span>
              <span style={{ ...cellStyle, color: c.color }}>{c.cmod}</span>
            </div>
          ))}
        </div>

        {/* CMod Bonuses */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Conditional Modifiers</div>
          {CMODS.map(c => (
            <div key={c.source} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '90px' }}>{c.source}</span>
              <span style={{ ...cellStyle, color: '#7fc458' }}>{c.mod}</span>
            </div>
          ))}
        </div>

        {/* Healing & Recovery */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Healing & Recovery</div>
          {HEALING.map(h => (
            <div key={h.type} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '130px' }}>{h.type}</span>
              <span style={{ ...cellStyle, color: '#d4cfc9' }}>{h.rate}</span>
            </div>
          ))}
        </div>

        {/* Skills → Attributes */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Skills → Attributes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
            {SKILLS_MAP.map(s => (
              <div key={s.skill} style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{s.skill}</span>
                <span style={{ ...cellStyle, color: '#7ab3d4', fontWeight: 700, minWidth: '30px' }}>{s.attr}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
