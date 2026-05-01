import RulesNav from '../../components/rules/RulesNav'

// /rules/* layout. Visually: [Tapestry Sidebar] [RulesNav] [content].
//
// Scroll model: the OUTER flex container uses height: 100% + overflow:
// hidden so the rules layout fills its slot in LayoutShell exactly. The
// <main> column is the only scrolling region — that keeps RulesNav
// statically pinned in its own column. Position: sticky was unreliable
// here because LayoutShell's children-wrapper already provides the
// scrolling context; nesting another sticky inside that landed the
// "stick at top" behaviour intermittently.

export const metadata = {
  title: 'Rules — XSE SRD',
  description: 'The Xero Sum Engine SRD v1.1 — full system reference for Distemper.',
}

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        background: '#0f0f0f',
        color: '#f5f2ee',
        fontFamily: 'Barlow, sans-serif',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <RulesNav />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '2.5rem 2rem 5rem',
          scrollBehavior: 'smooth',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}
