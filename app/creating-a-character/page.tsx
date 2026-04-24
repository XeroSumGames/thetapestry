'use client'

export default function CreatingACharacterPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

        {/* Hero */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>
            Character Creation
          </div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '48px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, margin: '0 0 16px' }}>
            Building Your Survivor
          </h1>
          <p style={{ fontSize: '17px', color: '#f5f2ee', lineHeight: 1.8, margin: 0 }}>
            Every character in Distemper has a story before the story begins. The Xero Sum Engine give you three ways to tell yours — from a detailed lifepathing, point-buy approach to a quick-start option for when you just want to get to the table.
          </p>
        </div>

        {/* Three methods */}
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2d5a1b', marginBottom: '1rem' }}>
            Three Ways to Build
          </div>

          {[
            {
              href: '/characters/new',
              label: 'Backstory Generation',
              tag: 'Recommended',
              tagColor: '#2d5a1b',
              tagText: '#7fc458',
              desc: 'The full experience. You spend Character Development Points (CDP) across nine chapters of your character\'s life — where they grew up, what they learned, how they made their way in the world. Every decision shapes who they are and what they can do.',
              bestFor: 'Players who want to know their character inside and out before the first session.',
              time: '15–30 minutes',
            },
            {
              href: '/characters/quick',
              label: 'Quick Character',
              tag: 'Experienced Players',
              tagColor: '#1a3a5c',
              tagText: '#7ab3d4',
              desc: 'Skip the life-stage structure and spend 20 CDP directly — 5 on attributes and 15 on skills. You pick a profession for context, choose your complication and motivation, then gear up and go.',
              bestFor: 'Players who know the XSE system and have a clear character concept in mind.',
              time: '5–10 minutes',
            },
            {
              href: '/characters/random',
              label: 'Random Character',
              tag: 'Just Get Playing',
              tagColor: '#3a2800',
              tagText: '#EF9F27',
              desc: 'The Tapestry generates a complete character for you using one of the 12 Distemper Paradigms — pre-built archetypes like Biker, EMT, Mercenary, or Flea Market Trader. You land in the Final Review to add your name and personal touches.',
              bestFor: 'New players, one-shots, or anyone who wants to be surprised by who they are.',
              time: 'Under 2 minutes',
            },
          ].map(({ href, label, tag, tagColor, tagText, desc, bestFor, time }) => (
            <div key={label} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1.25rem', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee' }}>{label}</div>
                <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: tagColor, color: tagText, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{tag}</span>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#cce0f5' }}>{time}</span>
              </div>
              <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.7, margin: '0 0 8px' }}>{desc}</p>
              <p style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, margin: '0 0 14px' }}><span style={{ color: '#cce0f5' }}>Best for:</span> {bestFor}</p>
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '8px 20px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
                {label} →
              </a>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '60px', height: '2px', background: '#c0392b', marginBottom: '3rem' }} />

        {/* Backstory system explained */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', margin: '0 0 16px' }}>
            The Backstory System
          </h2>
          <p style={{ fontSize: '16px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1.5rem' }}>
            Distemper uses the Xero Sum Engine backstory generation system, which builds your character through the chapters of their life rather than allocating stats on a blank sheet. You\'re not picking numbers — you\'re making decisions about who this person was before everything fell apart.
          </p>

          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#c0392b', margin: '2rem 0 8px' }}>
            Character Development Points (CDP)
          </h3>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1rem' }}>
            CDP is the currency of character creation. You get a fixed budget at each life stage and spend it raising attributes and skills. Unspent CDP is gone — the rules do not allow banking between steps. This keeps characters grounded in their history rather than optimised in a vacuum.
          </p>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8 }}>
            Over the full backstory, you spend a total of 20 CDP: 5 on attributes and 15 on skills.
          </p>

          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#c0392b', margin: '2rem 0 8px' }}>
            RAPID Range Attributes
          </h3>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1rem' }}>
            Every character has five attributes — <strong>Reason, Acumen, Physicality, Influence, Dexterity</strong> — referred to as RAPID. They start at 0 (Average) and range from −2 (Diminished) to +4 (Human Peak). During character creation they can only be raised to +3 (Exceptional).
          </p>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8 }}>
            Attributes feed directly into secondary stats like Wound Points, Initiative, and Perception, and add their modifier to every dice check using that attribute.
          </p>

          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#c0392b', margin: '2rem 0 8px' }}>
            Skills
          </h3>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1rem' }}>
            Distemper has 29 skills, each linked to an attribute. Most start at 0 (Untrained). Vocational skills — marked with an asterisk like <strong>Medicine*</strong> or <strong>Tactics*</strong> — start at −3 (Inept) and require 1 CDP to reach Beginner (+1). They represent specialised training that most people simply don\'t have.
          </p>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8 }}>
            Skills cap at +3 (Professional) during creation. +4 (Life\'s Work) is only achievable through play.
          </p>

          <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#c0392b', margin: '2rem 0 8px' }}>
            The Nine Steps
          </h3>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1.25rem' }}>
            Each step covers a period of your character\'s life and has its own CDP budget and caps:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
            {[
              { step: 'Step Zero', title: 'Who Are They?', desc: 'Name, age, gender, three defining words.' },
              { step: 'Step One', title: 'Where They Grew Up', desc: '1 attr CDP (max Good +1) + 2 skill CDP (max Journeyman +2).' },
              { step: 'Step Two', title: 'What They Learned', desc: '1 attr CDP (max Good +1) + 3 skill CDP (max Journeyman +2).' },
              { step: 'Step Three', title: 'What They Liked To Do', desc: '1 attr CDP (max Good +1) + 3 skill CDP (max Journeyman +2).' },
              { step: 'Step Four', title: 'How They Made Money', desc: '2 attr CDP (max Exceptional +3) + 4 skill CDP (max Professional +3). Choose a Profession.' },
              { step: 'Step Five', title: 'What Makes Them Them', desc: '0 attr CDP + 3 skill CDP (max Professional +3).' },
              { step: 'Step Six', title: 'What Drives Them?', desc: 'Choose or roll a Complication and Motivation.' },
              { step: 'Step Seven', title: 'Secondary Stats', desc: 'Auto-derived from attributes. No action needed.' },
              { step: 'Step Eight', title: 'What They Have', desc: 'Primary and secondary weapon, equipment, incidental item.' },
              { step: 'Step Nine', title: 'Final Review', desc: 'Review, adjust, and save.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '80px', paddingTop: '2px' }}>{step}</div>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>{title}</div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* XSE Dice System */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', margin: '0 0 16px' }}>
            How the Dice Work
          </h2>
          <p style={{ fontSize: '16px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1.5rem' }}>
            When your character attempts something with uncertain outcome, you roll <strong>2d6</strong> and add up to three modifiers: an <strong>Attribute Modifier (AMod)</strong>, a <strong>Skill Modifier (SMod)</strong>, and a <strong>Conditional Modifier (CMod)</strong> set by the GM based on circumstances.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '1.5rem' }}>
            {[
              { range: '0–3', label: 'Dire Failure', desc: 'Failed with an additional setback or consequence.', color: '#7a1f16' },
              { range: '4–8', label: 'Failure', desc: 'The action simply fails.', color: '#3a3a3a' },
              { range: '9–13', label: 'Success', desc: 'The action succeeds.', color: '#2d5a1b' },
              { range: '14+', label: 'Wild Success', desc: 'Succeeds with an additional positive result.', color: '#1a3a5c' },
              { range: '1+1', label: 'Moment of Low Insight', desc: 'Dire Failure — but earn an Insight Die.', color: '#3a2800' },
              { range: '6+6', label: 'Moment of High Insight', desc: 'Wild Success — and earn an Insight Die.', color: '#3a2800' },
            ].map(({ range, label, desc, color }) => (
              <div key={range} style={{ background: '#1a1a1a', border: `1px solid ${color}`, borderRadius: '3px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee' }}>{range}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '1rem' }}>
            <strong>Insight Dice</strong> are earned on Moments of Insight and can be spent in three ways: roll 3d6 and take the best two, add +3 to a conditional modifier before rolling, or re-roll one or both dice after seeing the result. Characters start with 2 Insight Dice and carry them between sessions.
          </p>
          <p style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.8 }}>
            This is why your attribute and skill choices matter — every point of AMod or SMod shifts your probability meaningfully on a 2d6 curve. A character with +3 in a skill is genuinely dangerous at it. A character with 0 is taking a real risk.
          </p>
        </div>

        {/* CTA */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '2rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href='/characters/new' target="_blank" rel="noopener noreferrer" style={{ padding: '12px 28px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Start Backstory Generation
          </a>
          <a href='/characters/quick' target="_blank" rel="noopener noreferrer" style={{ padding: '12px 28px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Quick Character
          </a>
          <a href='/characters/random' target="_blank" rel="noopener noreferrer" style={{ padding: '12px 28px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Random Character
          </a>
        </div>

      </div>
    </div>
  )
}