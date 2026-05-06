// Layout primitives shared by all /rules/* pages. The `RuleSection` H2 wrapper
// emits `id="…"` and `data-rule-anchor="…"` so the sticky nav's
// IntersectionObserver can highlight the right anchor as the user scrolls.

export function RuleSection({
  id,
  title,
  children,
  level = 2,
}: {
  id: string
  title: string
  children: React.ReactNode
  level?: 2 | 3
}) {
  const Tag = level === 2 ? 'h2' : 'h3'
  const headingStyle: React.CSSProperties =
    level === 2
      ? {
          fontFamily: 'Carlito, sans-serif',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: '#f5f2ee',
          margin: '3rem 0 1rem',
          paddingTop: 16,
          scrollMarginTop: 16,
        }
      : {
          fontFamily: 'Carlito, sans-serif',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#cce0f5',
          margin: '1.5rem 0 0.75rem',
          scrollMarginTop: 16,
        }
  return (
    <section data-rule-anchor={id} id={id}>
      <Tag style={headingStyle}>{title}</Tag>
      {children}
    </section>
  )
}

export function RuleHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string
  title: string
  intro: React.ReactNode
}) {
  return (
    <header style={{ marginBottom: '2rem' }}>
      <div
        style={{
          fontFamily: 'Carlito, sans-serif',
          fontSize: 13,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          color: '#c0392b',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: 'Carlito, sans-serif',
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          color: '#f5f2ee',
          lineHeight: 1,
          margin: '0 0 16px',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 17,
          color: '#f5f2ee',
          lineHeight: 1.8,
          margin: 0,
        }}
      >
        {intro}
      </p>
    </header>
  )
}

export function TryIt({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <aside
      style={{
        margin: '1.25rem 0',
        padding: '0.875rem 1rem',
        background: '#13202c',
        borderLeft: '3px solid #7ab3d4',
        borderRadius: 3,
        fontSize: 14,
        color: '#cce0f5',
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          fontFamily: 'Carlito, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: '#7ab3d4',
          marginRight: 10,
        }}
      >
        Try it →
      </span>
      <a
        href={href}
        style={{ color: '#cce0f5', textDecoration: 'underline' }}
      >
        {children}
      </a>
    </aside>
  )
}

// Simple table primitive — Carlito body + uppercase headers.
export function RuleTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: '1rem 0', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          fontFamily: 'Carlito, sans-serif',
          color: '#f5f2ee',
        }}
      >
        {children}
      </table>
    </div>
  )
}

export const ruleTableThStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid #2e2e2e',
  fontFamily: 'Carlito, sans-serif',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: '#cce0f5',
  background: '#161616',
}

export const ruleTableTdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #1f1f1f',
  verticalAlign: 'top',
}

// Para — body paragraph at the SRD reading-size.
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 17,
        color: '#f5f2ee',
        lineHeight: 1.8,
        margin: '0 0 1rem',
      }}
    >
      {children}
    </p>
  )
}

// Inline quote/term emphasis.
export function Term({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'Carlito, sans-serif',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: '#cce0f5',
      }}
    >
      {children}
    </span>
  )
}
