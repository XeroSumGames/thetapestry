'use client'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false })

export default function MapPage() {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <MapView showHeader={false} />
    </div>
  )
}