import Link from 'next/link'

// Comparison test banner for /rules/communities (Style A) vs
// /rules/communities2 (Style B). Removed once the user picks one.

export default function StyleBanner({
  current,
  otherHref,
  otherLabel,
  description,
}: {
  current: 'A' | 'B'
  otherHref: string
  otherLabel: string
  description: string
}) {
  return (
    <div
      style={{
        marginBottom: '2rem',
        padding: '0.75rem 1rem',
        background: '#231510',
        borderLeft: '3px solid #EF9F27',
        borderRadius: 3,
        fontSize: 13,
        color: '#f5d5a8',
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: 'Carlito, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: '#EF9F27',
          background: '#1a1a1a',
          padding: '4px 10px',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        Style {current}
      </span>
      <span style={{ flex: 1 }}>{description}</span>
      <Link
        href={otherHref}
        style={{
          fontFamily: 'Carlito, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#EF9F27',
          textDecoration: 'underline',
          flexShrink: 0,
        }}
      >
        Try {otherLabel} →
      </Link>
    </div>
  )
}
