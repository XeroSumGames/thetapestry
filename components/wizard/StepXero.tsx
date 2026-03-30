'use client'
import { useState, useRef } from 'react'
import { WizardState } from '../../lib/xse-engine'

const ALL_WORDS = ["Accommodating","Accountable","Adaptable","Admirable","Adroit","Adventurous","Affectionate","Agreeable","Alert","Altruistic","Ambitious","Amiable","Articulate","Aspiring","Assertive","Attentive","Authentic","Authoritative","Balanced","Benevolent","Bold","Brave","Brilliant","Calm","Candid","Capable","Caring","Charismatic","Charming","Cheerful","Clever","Collaborative","Compassionate","Confident","Conscientious","Considerate","Convivial","Cooperative","Courageous","Courteous","Creative","Cultured","Cunning","Curious","Daring","Decisive","Dedicated","Deliberate","Dependable","Determined","Devoted","Dignified","Diligent","Diplomatic","Disciplined","Discreet","Dutiful","Dynamic","Earnest","Ebullient","Efficient","Egalitarian","Elegant","Eloquent","Empathetic","Encouraging","Energetic","Engaging","Enterprising","Enthusiastic","Ethical","Exemplary","Exuberant","Fair","Fair-minded","Faithful","Farsighted","Fearless","Fervent","Fierce","Flexible","Focused","Forgiving","Forthright","Frank","Friendly","Fun-loving","Generous","Gentle","Genuine","Good-humored","Gracious","Gregarious","Grounded","Hardworking","Helpful","Honest","Honorable","Hopeful","Humane","Humble","Humorous","Idealistic","Imaginative","Impartial","Independent","Industrious","Innovative","Inquisitive","Insightful","Inspirational","Intelligent","Intuitive","Inventive","Joyful","Judicious","Just","Keen","Kind","Kind-hearted","Knowledgeable","Laudable","Logical","Loyal","Magnanimous","Mature","Methodical","Meticulous","Modest","Motivated","Noble","Objective","Observant","Optimistic","Orderly","Organized","Original","Passionate","Patient","Perceptive","Perseverant","Persevering","Persistent","Persuasive","Philanthropic","Philosophical","Pioneering","Poised","Polished","Polite","Practical","Pragmatic","Precise","Principled","Proactive","Prudent","Punctual","Purposeful","Quiet","Rational","Realistic","Reflective","Reliable","Resilient","Resourceful","Respectful","Responsible","Responsive","Reverent","Selfless","Sensible","Sensitive","Serene","Sincere","Sociable","Sophisticated","Stable","Steadfast","Strategic","Supportive","Sympathetic","Systematic","Tactful","Tenacious","Thoughtful","Tolerant","Trusting","Trustworthy","Unassuming","Unbiased","Understanding","Unique","Upbeat","Valiant","Versatile","Vibrant","Vigilant","Visionary","Vivid","Warm","Warm-hearted","Willing","Wise","Witty","Youthful","Zealous"]

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Character concept */}
      <div>
        <div style={shStyle}>Character concept</div>
        <label style={labelStyle}>In a sentence or two — who is this person before the story begins?</label>
        <textarea style={textareaStyle} value={state.concept}
          onChange={e => onChange({ concept: e.target.value })}
          placeholder="e.g. A disgraced detective who walked away from everything after a case went wrong..." />
      </div>

      {/* Basic details */}
      <div>
        <div style={shStyle}>Basic details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={state.name}
              onChange={e => onChange({ name: e.target.value })}
              placeholder="Full name" />
          </div>
          <div>
            <label style={labelStyle}>Nickname</label>
            <input style={inputStyle} value={state.nickname ?? ''}
              onChange={e => onChange({ nickname: e.target.value })}
              placeholder="Optional" />
          </div>
          <div>
            <label style={labelStyle}>Age</label>
            <input style={inputStyle} value={state.age}
              onChange={e => onChange({ age: e.target.value })}
              placeholder="e.g. 34" />
          </div>
          <div>
            <label style={labelStyle}>Gender</label>
            <input style={inputStyle} value={state.gender}
              onChange={e => onChange({ gender: e.target.value })}
              placeholder="Optional" />
          </div>
          <div>
            <label style={labelStyle}>Height</label>
            <input style={inputStyle} value={state.height}
              onChange={e => onChange({ height: e.target.value })}
              placeholder="e.g. 5'10&quot;" />
          </div>
          <div>
            <label style={labelStyle}>Weight</label>
            <input style={inputStyle} value={state.weight}
              onChange={e => onChange({ weight: e.target.value })}
              placeholder="e.g. 170 lbs" />
          </div>
        </div>
      </div>

      {/* Physical description */}
      <div>
        <div style={shStyle}>Physical description</div>
        <label style={labelStyle}>How does this character look? Build, hair, distinguishing features...</label>
        <textarea style={textareaStyle} value={state.physdesc}
          onChange={e => onChange({ physdesc: e.target.value })}
          placeholder="e.g. Stocky, mid-40s, weathered skin, a jagged scar across the left cheek, always wears a faded red baseball cap..." />
      </div>

      {/* Photo */}
      <div>
        <div style={shStyle}>Character photo (optional)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {state.photoDataUrl
            ? <img src={state.photoDataUrl} alt="Character" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #2e2e2e' }} />
            : <div style={{ width: '80px', height: '80px', border: '1px dashed #2e2e2e', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#5a5550' }}>No photo</div>
          }
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={() => fileRef.current?.click()} style={nbtnStyle}>Upload photo</button>
            {state.photoDataUrl &&
              <button onClick={() => onChange({ photoDataUrl: '' })} style={nbtnStyle}>Remove</button>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          </div>
        </div>
      </div>

      {/* Three words */}
      <div>
        <div style={shStyle}>Three words</div>
        <p style={{ fontSize: '13px', color: '#9a948a', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Type freely or pick from the list. Specific words beat broad ones.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ position: 'relative' }}>
              <input style={inputStyle} value={state.threeWords[i]}
                onChange={e => {
                  const words: [string, string, string] = [...state.threeWords]
                  words[i] = e.target.value
                  onChange({ threeWords: words })
                }}
                placeholder={['e.g. Determined', 'e.g. Loyal', 'e.g. Ruthless'][i]} />
              {state.threeWords[i] && (
                <button onClick={() => clearWord(i)}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5a5550', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={shStyle}>Or choose from the list</div>
        <input style={{ ...inputStyle, marginBottom: '0.75rem' }}
          placeholder="Search words..."
          value={search}
          onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
          {filtered.map(word => (
            <button key={word} onClick={() => pickWord(word)} style={chipStyle}>{word}</button>
          ))}
          {filtered.length === 0 && (
            <span style={{ fontSize: '12px', color: '#5a5550' }}>No matches</span>
          )}
        </div>
      </div>

    </div>
  )
}

const shStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#c0392b',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '8px',
  fontFamily: 'monospace',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.06em',
  color: '#9a948a',
  marginBottom: '6px',
  fontFamily: 'monospace',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#1a1a1a',
  border: '1px solid #2e2e2e',
  borderRadius: '4px',
  color: '#e8e4dc',
  fontSize: '14px',
  fontFamily: 'monospace',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: '#1a1a1a',
  border: '1px solid #2e2e2e',
  borderRadius: '4px',
  color: '#e8e4dc',
  fontSize: '14px',
  fontFamily: 'monospace',
  minHeight: '80px',
  resize: 'vertical',
  lineHeight: 1.5,
}

const nbtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#242424',
  border: '1px solid #2e2e2e',
  borderRadius: '4px',
  color: '#e8e4dc',
  fontSize: '12px',
  cursor: 'pointer',
  fontFamily: 'monospace',
}

const chipStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#242424',
  border: '1px solid #2e2e2e',
  borderRadius: '3px',
  color: '#9a948a',
  fontSize: '12px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  letterSpacing: '0.03em',
}