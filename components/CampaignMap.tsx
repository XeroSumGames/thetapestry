'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface CampaignPin {
  id: string
  name: string
  lat: number
  lng: number
  notes: string | null
  category: string
  revealed: boolean
}

interface Props {
  campaignId: string
  isGM: boolean
}

export default function CampaignMap({ campaignId, isGM }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])

  async function loadPins(L?: any) {
    const { data } = await supabase
      .from('campaign_pins')
      .select('*')
      .eq('campaign_id', campaignId)
    const allPins = data ?? []
    // GM sees all, players see only revealed
    const visible = isGM ? allPins : allPins.filter(p => p.revealed)
    setPins(visible)

    const leaflet = L ?? (await import('leaflet')).default
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers
    Object.values(markersRef.current).forEach((m: any) => { try { m.remove() } catch {} })
    markersRef.current = {}

    visible.forEach(pin => {
      const color = pin.revealed ? '#7fc458' : '#cce0f5'
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));cursor:pointer;" title="${pin.name}">📍</div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 20],
      })
      const marker = leaflet.marker([pin.lat, pin.lng], { icon }).addTo(map)
      marker.bindPopup(`<div style="font-family:Barlow Condensed,sans-serif;"><strong style="text-transform:uppercase;letter-spacing:.04em;">${pin.name}</strong>${pin.notes ? `<br/><span style="color:#666;">${pin.notes}</span>` : ''}${!pin.revealed && isGM ? '<br/><em style="color:#c0392b;">Hidden from players</em>' : ''}</div>`)
      markersRef.current[pin.id] = marker
    })
  }

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [39, -111], zoom: 5, zoomControl: true })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
      await loadPins(L)

      // Realtime subscription for pin changes
      supabase.channel(`campaign_pins_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_pins', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()
    }
    init()
  }, [campaignId])

  return <div ref={mapRef} style={{ flex: 1, height: '100%', borderRadius: '4px' }} />
}
