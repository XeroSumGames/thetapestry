export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee' }}>
      {children}
    </div>
  )
}
