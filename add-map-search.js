const fs = require('fs');

const filePath = 'C:/TheTapestry/components/MapView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add search state after existing state declarations
content = content.replace(
  "  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'dark'>('street')",
  "  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'dark'>('street')\n  const [searchQuery, setSearchQuery] = useState('')\n  const [searching, setSearching] = useState(false)"
);

// Add search function before switchLayer
content = content.replace(
  "  async function switchLayer(",
  `  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !mapInstanceRef.current) return
    setSearching(true)
    try {
      const res = await fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(searchQuery)}&limit=1\`, {
        headers: { 'Accept-Language': 'en' }
      })
      const results = await res.json()
      if (results.length > 0) {
        const { lat, lon } = results[0]
        mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 13, { duration: 1.2 })
      }
    } catch (e) {
      console.error('Search failed:', e)
    }
    setSearching(false)
  }

  async function switchLayer(`
);

// Add search bar to the header, after the flex spacer
content = content.replace(
  "          <div style={{ flex: 1 }} />\n          <button onClick={() => setSidebarOpen",
  `          <div style={{ flex: 1 }} />
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search address..."
              style={{ padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '200px', outline: 'none' }}
            />
            <button type="submit" disabled={searching}
              style={{ padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: searching ? '#5a5550' : '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'not-allowed' : 'pointer' }}>
              {searching ? '...' : 'Go'}
            </button>
          </form>
          <button onClick={() => setSidebarOpen`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('done');
