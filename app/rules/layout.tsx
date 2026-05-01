import RulesNav from '../../components/rules/RulesNav'

// /rules/* layout — sticky left rail nav + scrolling content. Sits inside
// the global Tapestry sidebar (LayoutShell), so visually we have:
//   [Tapestry Sidebar] [RulesNav] [content]

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
        minHeight: '100vh',
      }}
    >
      <RulesNav />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '2.5rem 2rem 5rem',
          maxWidth: 880,
        }}
      >
        {children}
      </main>
    </div>
  )
}
