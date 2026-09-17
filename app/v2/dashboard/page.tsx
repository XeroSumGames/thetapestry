'use client'
// /v2/dashboard - the Dashboard in the house frame.
//
// Client, unlike its five sibling sections, for one reason: the world map is a
// dynamic import with ssr:false (Leaflet touches window on import), and that
// needs a client component. Everything else it needs comes from V2Shell.
//
// The map renders with its own inner pins LIST suppressed, so the canvas is
// full width. Pin markers still draw. That list is the panel moving into the
// right rail in 1.2b, which is also when this page stops being two-column.
import dynamic from 'next/dynamic'
import V2Shell from '../../../components/V2Shell'

const MapView = dynamic(() => import('../../../components/MapView'), { ssr: false })

export default function V2DashboardPage() {
  return <V2Shell active="dashboard" centre={<MapView embedded />} />
}
