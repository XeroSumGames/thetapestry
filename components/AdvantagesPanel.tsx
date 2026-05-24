'use client'

import type { Advantage } from '../lib/advantages'

// Presentational list of pending Advantages (the orange ⭐ cards with a Use
// button, plus GM-only Delete). Extracted from the table page so it can render
// in BOTH the GM "Advantages" tab AND - folded in - the player Notes tab,
// without duplicating ~100 lines into the LOC-ratcheted page. All data logic
// (consume + feed-log + optimistic removal, delete) stays in the page via the
// onUse / onDelete callbacks; this component only renders + filters to visible.
interface Props {
  advantages: Advantage[]
  gmLike: boolean
  // Character ids owned by the viewing user (a player sees only their own).
  myCharacterIds: Set<string>
  // Resolve a holder PC's display name (GM sees other players' holders).
  holderNameFor: (characterId: string) => string
  // Advantage ids with an in-flight Use, to disable the button.
  useInFlight: Set<string>
  onUse: (a: Advantage) => void
  onDelete: (a: Advantage) => void
  // Notes-tab usage: render nothing when there's nothing to show (so an empty
  // panel doesn't clutter the player's Notes). GM tab leaves this off to keep
  // the "No advantages pending" guidance.
  hideWhenEmpty?: boolean
  // Optional label, shown above the cards when there are any. Used in the Notes
  // tab where the old ⭐ tab label is gone, so players still know what these are.
  heading?: string
}

export default function AdvantagesPanel({ advantages, gmLike, myCharacterIds, holderNameFor, useInFlight, onUse, onDelete, hideWhenEmpty, heading }: Props) {
  // Visibility mirrors the RLS scoping: GM sees all pending in the campaign;
  // a player sees only their own.
  const visible = gmLike ? advantages : advantages.filter(a => myCharacterIds.has(a.character_id))

  if (visible.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          No advantages pending
        </div>
        {gmLike && (
          <div style={{ textAlign: 'center', padding: '0 1rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', marginTop: '8px', fontStyle: 'italic' }}>
            Grant one via GM Tools → ⭐ Grant Advantage.
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {heading && (
        <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, padding: '4px 0 6px' }}>
          {heading}
        </div>
      )}
      {visible.map(a => {
        const isMyOwn = myCharacterIds.has(a.character_id)
        const inFlight = useInFlight.has(a.id)
        return (
          <div key={a.id} style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1a1a', border: '1px solid #2a2010', borderLeft: '3px solid #EF9F27', borderRadius: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {a.cmod_delta > 0 ? `+${a.cmod_delta}` : a.cmod_delta} {a.skill_name}
              </div>
              {gmLike && !isMyOwn && (
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', whiteSpace: 'nowrap' }}>{holderNameFor(a.character_id)}</div>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', lineHeight: 1.4 }}>
              {a.description}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(isMyOwn || gmLike) && (
                <button type="button" disabled={inFlight} onClick={() => onUse(a)}
                  style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight ? 0.5 : 1, fontWeight: 700 }}>
                  {inFlight ? 'Using…' : '✓ Use'}
                </button>
              )}
              {gmLike && (
                <button type="button" onClick={() => onDelete(a)}
                  style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #5a1f1f', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
