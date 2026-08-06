'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getCachedAuth } from '../../lib/auth-cache'
import { createClient } from '../../lib/supabase-browser'
import WelcomeModal from '../../components/WelcomeModal'

// "A Guide to the Tapestry" - the reference hub AND the replayable home of the
// stepped welcome tour (WelcomeModal). Visiting /welcome opens the tour on
// mount (ungated by profiles.onboarded - that flag only gates the automatic
// first-login trigger on /dashboard), so it's a "watch it again" entry point.
// It's skippable, and the static reference cards below stay as the backdrop
// once dismissed. Sidebar provided by LayoutShell.
export default function WelcomePage() {
  const supabase = createClient()
  const [showTour, setShowTour] = useState(true)
  const [username, setUsername] = useState('')
  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) return
      const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      setUsername((data as any)?.username ?? '')
    })()
  }, [])

  // ---- Shared styles ----
  const card: React.CSSProperties = {
    background: '#161616',
    border: '1px solid #2e2e2e',
    borderRadius: '4px',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }
  const cardTitle: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#f5f2ee',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }
  const cardBody: React.CSSProperties = {
    fontSize: '15px',
    color: '#f5f2ee',
    lineHeight: 1.65,
    flex: 1,
  }
  const cardLink: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif',
    fontSize: '13px',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#cce0f5',
    textDecoration: 'none',
    alignSelf: 'flex-start',
    padding: '6px 14px',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    background: '#242424',
  }
  const sectionHeading: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif',
    fontSize: '13px',
    letterSpacing: '.2em',
    textTransform: 'uppercase',
    color: '#c0392b',
    marginBottom: '10px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', overflowY: 'auto' }}>

      {showTour && <WelcomeModal username={username} onClose={() => setShowTour(false)} />}

      {/* Hero */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3.5rem 1.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '10px' }}>
          Reference &amp; Help
        </div>
        <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '46px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '14px' }}>
          A Guide to the Tapestry
        </div>
        <div style={{ fontSize: '16px', color: '#cce0f5', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
          Come back here whenever you need a refresher on what lives where. There is a link to each section of the platform along with a note on what it&apos;s for and how to get the most out of it.
        </div>
        <div style={{ marginTop: '16px' }}>
          <button onClick={() => setShowTour(true)}
            style={{ padding: '8px 20px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
            &#9654; Take the tour
          </button>
        </div>
        <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '2rem auto 0' }} />
      </div>

      {/* Main destinations */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>

          <div style={card}>
            <div style={cardTitle}><span>🗺️</span>The World</div>
            <div style={cardBody}>This interactive map of the post-dog flu world allows you to drop pins for yourself or others, report rumors, and see what other survivors are reporting. Substantiated rumors shape the canon over time and are reflected here, on the world map.</div>
            <Link href="/map" style={cardLink}>Open Map</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🧬</span>My Survivors</div>
            <div style={cardBody}>Your roster of characters. Here you can create new ones via the Backstory Generation process that guides you through every step of your characters life before the pandemic, the Quick Character Generator for those that know the system and have a concept in mind, or pick a completely Random Character.</div>
            <Link href="/characters" style={cardLink}>My Survivors</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📖</span>My Stories</div>
            <div style={cardBody}>Whether it is as a player or GM, here is where you can find the various campaigns and one-shots you&apos;re part of. This is where you launch The Table, where stories are told.</div>
            <Link href="/stories" style={cardLink}>My Stories</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🏘️</span>My Communities</div>
            <div style={cardBody}>Communities are persistent groups of survivors who share a base and resources. Recruit NPCs to your side as cohorts, conscripts, or converts as you grow across sessions, leaving an indelible mark on this persistent world.</div>
            <Link href="/communities" style={cardLink}>My Communities</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🔥</span>The Campfire</div>
            <div style={cardBody}>The heart of the Tapestry, here players can find groups and GMs can find players. Built-in Looking-for-Group tools, Messaging, Forums, player-reported War Stories, and both rumors and confirmed world events. <span style={{ color: '#8a8a8a' }}>(In progress.)</span></div>
            <Link href="/campfire" style={cardLink}>Visit the Campfire</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📦</span>Rumors</div>
            <div style={cardBody}>Pre-built scenes, encounters, adventures and campaigns that include NPCs, items, and storylines that you can subscribe to and import to play with your own group. Authors snapshot their content; GMs pull versioned copies.</div>
            <Link href="/rumors" style={cardLink}>Browse Rumors</Link>
          </div>

        </div>

        {/* Survivor creation paths - Creating a Survivor sits alone on
            its own row as the top-of-funnel guide; the three creation
            paths (Backstory, Quick, Random) share the row below. */}
        <div style={sectionHeading}>Building a Survivor</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '14px' }}>
          <div style={card}>
            <div style={cardTitle}>Creating a Survivor</div>
            <div style={cardBody}>The full guide - how Character Development Points (CDP), chapters, and trait acquisition work.</div>
            <Link href="/creating-a-character" style={cardLink}>Read Guide</Link>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '2.5rem' }}>
          {([
            { href: '/characters/new',       label: 'Backstory Generation', action: 'Start',    desc: 'Recommended for first-timers. Spend CDP across life stages to craft a character that matches your vision.' },
            { href: '/characters/quick',     label: 'Quick Character',      action: 'Start',    desc: 'Recommended for experienced players. Spend 20 CDP directly on attributes and skills and go.' },
            { href: '/characters/random',    label: 'Random Character',     action: 'Roll',     desc: 'Roll up a survivor on the fly. Great for NPCs or table emergencies.' },
            { href: '/characters/paradigms', label: 'Paradigms',            action: 'Pick One', desc: 'Pick from 12 Distemper templates. Pre-built RAPID, skills, and loadout - add a name and play.' },
          ] as const).map(({ href, label, action, desc }) => (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', background: '#161616', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: '#8a8a8a', lineHeight: 1.5 }}>{desc}</div>
              </div>
              <div style={{ padding: '6px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>{action}</div>
            </Link>
          ))}
        </div>

        {/* Beginners' Guide - twelve chapters covering navigation,
            character creation, sessions, combat, communities, etc.
            Source-of-truth lives in docs/beginners-guide-NN.txt; the
            /welcome/guide route reads them at request time. */}
        <div style={sectionHeading}>Beginners&apos; Guide</div>
        <Link href="/welcome/guide" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...card, marginBottom: '1rem', cursor: 'pointer' }}>
            <div style={{ ...cardTitle, marginBottom: '4px' }}>📖 Twelve-Chapter Walkthrough</div>
            <div style={cardBody}>
              From your first login through running a community: navigation, characters, the world map, sessions, the tactical map, combat, communities, NPCs, the Campfire, and Rumors. Read straight through or jump to whatever you&apos;re stuck on.
            </div>
            <div style={{ ...cardLink, marginTop: '8px', display: 'inline-block' }}>Open the Guide →</div>
          </div>
        </Link>

        {/* Quick reference cheat-sheet - the basics a new player needs
            at their fingertips. Each block links into /rules for the
            full canon page. */}
        <div style={sectionHeading}>Quick Reference</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>
          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Dice Check</div>
              <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>2d6 + AMod + SMod + CMod</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                Total ≥ 9 = Success.<br />
                <strong style={{ color: '#7fc458' }}>14+</strong> Wild Success<br />
                <strong style={{ color: '#7fc458' }}>6+6</strong> High Insight (+1 Insight Die)<br />
                <strong style={{ color: '#7ab3d4' }}>9-13</strong> Success<br />
                <strong style={{ color: '#EF9F27' }}>4-8</strong> Failure<br />
                <strong style={{ color: '#c0392b' }}>0-3</strong> Dire Failure<br />
                <strong style={{ color: '#c0392b' }}>1+1</strong> Low Insight (+1 Insight Die)
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Insight Dice</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                Start with <strong style={{ color: '#7fc458' }}>2</strong>. Earn +1 on every Moment of Insight (6+6 or 1+1). Spend on:<br />
                • <strong>Pre-roll 3d6</strong>, keep all 3<br />
                • Add <strong>+3 CMod</strong> before rolling<br />
                • <strong>Re-roll</strong> dice after seeing the result<br />
                • <strong>Save from Death</strong> - spend all dice for 1 WP + 1 RP total<br />
                • <strong>Stave off starvation</strong> - 1 die buys 1 extra day before Subsistence Damage
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>WP / RP / Stress</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                <strong style={{ color: '#7fc458' }}>WP</strong> = 10 + PHY + DEX. At 0 = Mortally Wounded.<br />
                <strong style={{ color: '#7ab3d4' }}>RP</strong> = 6 + PHY. At 0 = Incapacitated.<br />
                <strong style={{ color: '#EF9F27' }}>Stress</strong> = 0-5 ladder. Hits 5 = Breaking Point roll.<br />
                <strong>Heal rate:</strong> 1 WP / day (2 days if was Mortally Wounded); 1 RP / hour resting.
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>CDP Spending</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                Start with <strong style={{ color: '#7fc458' }}>20 CDP</strong> (5 attr + 15 skill) at creation.<br />
                <strong>Skill:</strong> Learn (Inept→Beginner) = 1 CDP. Raise +1→+2 = 3, +2→+3 = 5, +3→+4 = 7.<br />
                <strong>Attribute:</strong> +1→+2 = 6 CDP, +2→+3 = 9, +3→+4 = 12.<br />
                Vocational skills (marked *) jump from -3 straight to +1 on first level.
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Combat Round</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                <strong>3-6 seconds</strong>. Each character gets <strong style={{ color: '#7fc458' }}>2 Combat Actions</strong> per round.<br />
                Initiative = 2d6 + (ACU + DEX) AMod.<br />
                <strong>Get The Drop</strong> = 1 action before initiative (-2 CMod on next Init roll).<br />
                Common 1-action options: Aim (+2), Attack, Defend (+2 def), Move 1 band, Reload.
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ ...cardBody, padding: '14px 16px' }}>
              <div style={{ fontSize: '15px', color: '#EF9F27', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Full Rules</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.6 }}>
                <a href="/rules" style={cardLink}>/rules</a> - full XSE / Distemper canon, organized by section.<br />
                <a href="/rules/core-mechanics" style={cardLink}>Core Mechanics</a> - Insight Dice, Group Check, Coordinated Effort, Negotiations.<br />
                <a href="/rules/combat" style={cardLink}>Combat</a> - Rounds, Range, Damage, Healing, Stress.<br />
                <a href="/rules/communities" style={cardLink}>Communities</a> - Recruitment, Morale, Apprentices.
              </div>
            </div>
          </div>
        </div>

        {/* External links - three equal-width tiles, each centred:
            logo on top, name+link below. Order: XeroSumGames →
            DistemperVerse → XeroSumStudio. */}
        <div style={{ ...sectionHeading, textAlign: 'center' }}>Off-Platform</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', justifyItems: 'center', alignItems: 'start', marginBottom: '4rem' }}>
          {/* Each tile reserves a uniform 80px-tall logo slot so the three
              logos centre on the same horizontal midline regardless of
              their native dimensions (Distemper is square-ish at 80px,
              XeroSum logos are landscape at 48px). Link buttons then
              sit at the same Y across all three columns. */}
          <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/XeroSumGamesLogoV13.png" alt="XeroSumGames" style={{ width: '180px', height: '48px', objectFit: 'contain' }} />
            </div>
            <span style={cardLink}>XeroSumGames.com 🔗</span>
          </a>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/distemper-dogsign-logo.png" alt="DistemperVerse" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <span style={cardLink}>DistemperVerse.com 🔗</span>
          </a>
          <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/XeroSumStudioLogoV13.png" alt="XeroSumStudio" style={{ width: '180px', height: '48px', objectFit: 'contain' }} />
            </div>
            <span style={cardLink}>XeroSumStudio.com 🔗</span>
          </a>
        </div>

      </div>
    </div>
  )
}
