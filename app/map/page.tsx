'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false })

export default function MapPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      })
      const results = await res.json()
      if (results.length > 0) {
        window.dispatchEvent(new CustomEvent('tapestry-fly-to', {
          detail: { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) }
        }))
      }
    } catch (e) {
      console.error('Search failed:', e)
    }
    setSearching(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <MapView showHeader={false} />
      <form onSubmit={handleSearch} style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '4px' }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search address..."
          style={{ padding: '6px 10px', background: 'rgba(15,15,15,0.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '220px', outline: 'none' }}
        />
        <button type="submit" disabled={searching}
          style={{ padding: '6px 12px', background: 'rgba(15,15,15,0.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: searching ? '#5a5550' : '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'not-allowed' : 'pointer' }}>
          {searching ? '...' : 'Go'}
        </button>
      </form>
    </div>
  )
}

