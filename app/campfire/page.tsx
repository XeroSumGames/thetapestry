'use client'
import { useRouter } from 'next/navigation'

interface Tool {
  label: string
  description: string
  href: string
  color: string
  soon?: boolean
}

const TOOLS: Tool[] = [
  {
    label: 'Messages',
    description: 'Direct messages between players and GMs.',
    href: '/messages',
    color: '#8b5cf6',
  },
  {
    label: 'Looking for Group',
    description: 'Find campaigns to join, or players for your table.',
    href: '/campfire/lfg',
    color: '#c0392b',
    soon: true,
  },
  {
    label: 'Forums',
    description: 'Community threads — lore, rules questions, session recaps.',
    href: '/campfire/forums',
    color: '#2d5a1b',
    soon: true,
  },
  {
    label: 'War Stories',
    description: 'Share session highlights, character moments, and legendary plays.',
    href: '/campfire/war-stories',
    color: '#b87333',
    soon: true,
  },
  {
    label: 'Homebrew',
    description: 'Custom rules, house variants, fan content — all in one place.',
    href: '/campfire/homebrew',
    color: '#1a4a6b',
    soon: true,
  },
]

export default function CampfirePage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
          The Campfire
        </div>
        <div style={{ fontSize: '14px', color: '#7a7268', lineHeight: 1.6 }}>
          The meta layer — where players, GMs, and visitors connect across campaigns.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {TOOLS.map(tool => (
          <div
            key={tool.label}
            onClick={() => !tool.soon && router.push(tool.href)}
            style={{
              padding: '18px 20px',
              background: '#1a1a1a',
              border: `1px solid ${tool.soon ? '#2e2e2e' : tool.color}`,
              borderRadius: '4px',
              cursor: tool.soon ? 'default' : 'pointer',
              opacity: tool.soon ? 0.55 : 1,
              transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { if (!tool.soon) (e.currentTarget as HTMLDivElement).style.background = '#242424' }}
            onMouseLeave={e => { if (!tool.soon) (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: tool.soon ? '#5a5550' : '#f5f2ee' }}>
                {tool.label}
              </span>
              {tool.soon && (
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Coming Soon
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#7a7268', lineHeight: 1.5 }}>
              {tool.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
