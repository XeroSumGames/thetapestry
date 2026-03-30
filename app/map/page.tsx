'use client'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false })

export default function MapPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f0f0f' }}>
      <MapView />
    </div>
  )
}