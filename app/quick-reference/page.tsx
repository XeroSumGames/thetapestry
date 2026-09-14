import Link from 'next/link'

// Quick Reference - the at-a-glance cheat-sheets a survivor needs at the table.
// Relocated out of /welcome (which is being retired) into its own top-level page,
// linked from the sidebar between The Rules and The DistemperVerse. Each block
// points into /rules for the full canon.
export default function QuickReferencePage() {
  const card: React.CSSProperties = { background: '#161616', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px 16px' }
  const heading: React.CSSProperties = { fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }
  const body: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }
  const inlineLink: React.CSSProperties = { fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', color: '#cce0f5', textDecoration: 'none', padding: '6px 14px', border: '1px solid #3a3a3a', borderRadius: '3px', background: '#242424' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3.5rem 1.5rem 4rem' }}>

        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '10px' }}>Reference</div>
        <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '46px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '14px' }}>Quick Reference</div>
        <div style={{ fontSize: '16px', color: '#cce0f5', maxWidth: '640px', lineHeight: 1.7, marginBottom: '2rem' }}>
          The basics a survivor needs at their fingertips. For the full canon, see <Link href="/rules" style={{ color: '#cce0f5' }}>The Rules</Link>.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>

          <div style={card}>
            <div style={heading}>Dice Check</div>
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>2d6 + AMod + SMod + CMod</div>
            <div style={body}>
              Total &#8805; 9 = Success.<br />
              <strong style={{ color: '#7fc458' }}>14+</strong> Wild Success<br />
              <strong style={{ color: '#7fc458' }}>6+6</strong> High Insight (+1 Insight Die)<br />
              <strong style={{ color: '#7ab3d4' }}>9-13</strong> Success<br />
              <strong style={{ color: '#EF9F27' }}>4-8</strong> Failure<br />
              <strong style={{ color: '#c0392b' }}>0-3</strong> Dire Failure<br />
              <strong style={{ color: '#c0392b' }}>1+1</strong> Low Insight (+1 Insight Die)
            </div>
          </div>

          <div style={card}>
            <div style={heading}>Insight Dice</div>
            <div style={body}>
              Start with <strong style={{ color: '#7fc458' }}>2</strong>. Earn +1 on every Moment of Insight (6+6 or 1+1). Spend on:<br />
              &#8226; <strong>Pre-roll 3d6</strong>, keep all 3<br />
              &#8226; Add <strong>+3 CMod</strong> before rolling<br />
              &#8226; <strong>Re-roll</strong> dice after seeing the result<br />
              &#8226; <strong>Save from Death</strong> - spend all dice for 1 WP + 1 RP total<br />
              &#8226; <strong>Stave off starvation</strong> - 1 die buys 1 extra day before Subsistence Damage
            </div>
          </div>

          <div style={card}>
            <div style={heading}>WP / RP / Stress</div>
            <div style={body}>
              <strong style={{ color: '#7fc458' }}>WP</strong> = 10 + PHY + DEX. At 0 = Mortally Wounded.<br />
              <strong style={{ color: '#7ab3d4' }}>RP</strong> = 6 + PHY. At 0 = Incapacitated.<br />
              <strong style={{ color: '#EF9F27' }}>Stress</strong> = 0-5 ladder. Hits 5 = Breaking Point roll.<br />
              <strong>Heal rate:</strong> 1 WP / day (2 days if was Mortally Wounded); 1 RP / hour resting.
            </div>
          </div>

          <div style={card}>
            <div style={heading}>CDP Spending</div>
            <div style={body}>
              Start with <strong style={{ color: '#7fc458' }}>20 CDP</strong> (5 attr + 15 skill) at creation.<br />
              <strong>Skill:</strong> Learn (Inept&#8594;Beginner) = 1 CDP. Raise +1&#8594;+2 = 3, +2&#8594;+3 = 5, +3&#8594;+4 = 7.<br />
              <strong>Attribute:</strong> +1&#8594;+2 = 6 CDP, +2&#8594;+3 = 9, +3&#8594;+4 = 12.<br />
              Vocational skills (marked *) jump from -3 straight to +1 on first level.
            </div>
          </div>

          <div style={card}>
            <div style={heading}>Combat Round</div>
            <div style={body}>
              <strong>3-6 seconds</strong>. Each character gets <strong style={{ color: '#7fc458' }}>2 Combat Actions</strong> per round.<br />
              Initiative = 2d6 + (ACU + DEX) AMod.<br />
              <strong>Get The Drop</strong> = 1 action before initiative (-2 CMod on next Init roll).<br />
              Common 1-action options: Aim (+2), Attack, Defend (+2 def), Move 1 band, Reload.
            </div>
          </div>

          <div style={card}>
            <div style={heading}>Full Rules</div>
            <div style={body}>
              <Link href="/rules" style={inlineLink}>/rules</Link> - full XSE / Distemper canon, organized by section.<br />
              <Link href="/rules/core-mechanics" style={inlineLink}>Core Mechanics</Link> - Insight Dice, Group Check, Coordinated Effort, Negotiations.<br />
              <Link href="/rules/combat" style={inlineLink}>Combat</Link> - Rounds, Range, Damage, Healing, Stress.<br />
              <Link href="/rules/communities" style={inlineLink}>Communities</Link> - Recruitment, Morale, Apprentices.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
