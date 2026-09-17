'use client'
// /v2/dashboard - the Dashboard in the house frame.
//
// Client, unlike its five sibling sections, for two reasons: the world map is a
// dynamic import with ssr:false (Leaflet touches window on import), and the
// right rail needs a ref to hand the map a portal target.
//
// THE PINS PANEL LIVES IN THE RIGHT RAIL (1.2b), as the approved mockup has it.
// It is PORTALED there by MapView rather than lifted out of it: the panel needs
// ~25 pieces of MapView's state, and moving all of that would have been a large
// change to a component with no way to prove nothing broke. A portal keeps
// MapView the owner, gets the panel into the rail, and leaves the old Dashboard
// untouched because the prop is simply absent there.
//
// pinsEl starts null, so the first paint has no panel and the second - once the
// rail element exists - portals it in. That is also why this is state rather
// than a useRef: a ref would not re-render the map with its target.
import { useState } from 'react'
import dynamic from 'next/dynamic'
import V2Shell from '../../../components/V2Shell'

const MapView = dynamic(() => import('../../../components/MapView'), { ssr: false })

export default function V2DashboardPage() {
  const [pinsEl, setPinsEl] = useState<HTMLElement | null>(null)
  return (
    <V2Shell
      active="dashboard"
      centre={<MapView embedded pinsPanelTarget={pinsEl} />}
      right={<div ref={setPinsEl} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} />}
    />
  )
}
