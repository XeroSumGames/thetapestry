'use client'
import { useState, useRef } from 'react'
import { WizardState } from '../../lib/xse-engine'

const ALL_WORDS = ["Adaptable","Adventurous","Affectionate","Altruistic","Ambitious","Argumentative","Articulate","Assertive","Authentic","Authoritative","Bold","Braggadocious","Calm","Candid","Charismatic","Clever","Collaborative","Combative","Compassionate","Confident","Conscientious","Contrarian","Courageous","Creative","Cultured","Cunning","Curious","Daring","Decisive","Deliberate","Determined","Dignified","Diligent","Diplomatic","Discreet","Eloquent","Empathetic","Energetic","Enterprising","Fair","Fervent","Fierce","Flexible","Focused","Forgiving","Generous","Genuine","Gregarious","Grounded","Honorable","Humble","Idealistic","Imaginative","Independent","Insightful","Intelligent","Intuitive","Inventive","Joyful","Just","Loyal","Mature","Meticulous","Observant","Original","Passionate","Patient","Perceptive","Persuasive","Philanthropic","Pragmatic","Precise","Principled","Prudent","Purposeful","Rational","Realistic","Reflective","Reliable","Resilient","Resourceful","Sensitive","Sincere","Sociable","Steadfast","Strategic","Tactful","Tenacious","Thoughtful","Tolerant","Trusting","Trustworthy","Understanding","Unique","Versatile","Vigilant","Visionary","Wise","Witty","Zealous"]

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepXero({ state, onChange }: Props) {
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const used = state.threeWords.map(w => w.toLowerCase())
  const filtered = ALL_WORDS.filter(w =>
    (!search || w.toLowerCase().includes(search.toLowerCase())) &&
    !used.includes(w.toLowerCase())
  )

  function pickWord(word: string) {
    const idx = state.threeWords.findIndex(w => !w)
    if (idx === -1) return
    const words: [string, string, string] = [...state.threeWords]
    words[idx] = word
    onChange({ threeWords: words })
  }

  function clearWord(i: number) {
    const words: [string, string, string] = [...state.threeWords]
    words[i] = ''
    onChange({ threeWords: words })
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange({ photoDataUrl: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div>

      {/* Basic details */}
      <div style={sh}>Basic details</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={lbl}>Name</label>
          <input style={inp} value={state.name} onChange={e => onChange({ name: e.target.value })} placeholder="Full name" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={lbl}>Age</label>
          <input style={inp} value={state.age} onChange={e => onChange({ age: e.target.value })} placeholder="e.g. 34" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={lbl}>Gender</label>
          <input style={inp} value={state.gender} onChange={e => onChange({ gender: e.target.value })} placeholder="Optional" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={lbl}>Height</label>
          <input style={inp} value={state.height} onChange={e => onChange({ height: e.target.value })} placeholder="e.g. 5'10&quot;" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={lbl}>Weight</label>
          <input style={inp} value={state.weight} onChange={e => onChange({ weight: e.target.value })} placeholder="e.g. 170 lbs" />
        </div>
      </div>

      {/* Character concept */}
      <div style={sh}>Character concept</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
        <label style={lbl}>In a sentence or two — who is this person before the story begins?</label>
        <textarea style={ta} value={state.concept}
          onChange={e => onChange({ concept: e.target.value })}
          placeholder="e.g. A disgraced detective who walked away from everything after a case went wrong..." />
      </div>
      
      {/* Physical description */}
      <div style={sh}>Physical description</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
        <label style={lbl}>How does this character look? Build, hair, distinguishing features...</label>
        <textarea style={ta} value={state.physdesc}
          onChange={e => onChange({ physdesc: e.target.value })}
          placeholder="e.g. Stocky, mid-40s, weathered skin, a jagged scar across the left cheek, always wears a faded red baseball cap..." />
      </div>

      {/* Photo */}
      <div style={sh}>Character photo (optional)</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
        {state.photoDataUrl
          ? <img src={state.photoDataUrl} alt="Character" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3a3a3a' }} />
          : <div style={{ width: '80px', height: '80px', border: '1px dashed #3a3a3a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#5a5550' }}>No photo</div>
        }
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={() => fileRef.current?.click()} style={nbtn}>Upload photo</button>
          {state.photoDataUrl && <button onClick={() => onChange({ photoDataUrl: '' })} style={nbtn}>Remove</button>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        </div>
      </div>

      {/* Three words */}
      <div style={sh}>Three words</div>
      <p style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px' }}>
        Type freely or pick from the list. Specific words beat broad ones.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={lbl}>Word {i + 1}</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: state.threeWords[i] ? '28px' : '10px', ...(state.threeWords[i] ? { borderColor: '#c0392b', background: '#2a1210', color: '#f5a89a' } : {}) }}
                value={state.threeWords[i]}
                onChange={e => {
                  const words: [string, string, string] = [...state.threeWords]
                  words[i] = e.target.value
                  onChange({ threeWords: words })
                }}
                placeholder={['e.g. Determined', 'e.g. Loyal', 'e.g. Ruthless'][i]} />
              {state.threeWords[i] && (
                <button onClick={() => clearWord(i)}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                  x
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={sh}>Or choose from the list</div>
      <input style={{ ...inp, marginBottom: '8px' }}
        placeholder="Search words..."
        value={search}
        onChange={e => setSearch(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px', marginBottom: '1rem' }}>
        {filtered.map(word => (
          <button key={word} onClick={() => pickWord(word)} style={chip}>{word}</button>
        ))}
        {filtered.length === 0 && <span style={{ fontSize: '12px', color: '#5a5550' }}>No matches</span>}
      </div>

    </div>
  )
}

const sh: React.CSSProperties = {
  fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '10px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}

const lbl: React.CSSProperties = {
  fontSize: '11px', color: '#f5f2ee',
  letterSpacing: '.05em', textTransform: 'uppercase',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#242424', border: '1px solid #3a3a3a',
  borderRadius: '3px', color: '#f5f2ee',
  fontSize: '14px', fontFamily: 'Barlow, sans-serif',
  boxSizing: 'border-box',
}

const ta: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#242424', border: '1px solid #3a3a3a',
  borderRadius: '3px', color: '#f5f2ee',
  fontSize: '14px', fontFamily: 'Barlow, sans-serif',
  minHeight: '60px', resize: 'vertical', lineHeight: 1.5,
  boxSizing: 'border-box',
}

const nbtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: '3px', fontSize: '12px', cursor: 'pointer',
  border: '1px solid #3a3a3a', background: '#242424', color: '#f5f2ee',
  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
}

const chip: React.CSSProperties = {
  background: '#242424', border: '1px solid #2e2e2e',
  borderRadius: '3px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer',
  textAlign: 'center', lineHeight: 1.3, color: '#f5f2ee',
  fontFamily: 'Barlow, sans-serif',
}