'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import VehicleCard, { Vehicle } from '../../components/VehicleCard'

export default function VehiclePage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const vehicleId = params.get('v')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [showAddCargo, setShowAddCargo] = useState(false)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addNotes, setAddNotes] = useState('')

  useEffect(() => {
    async function load() {
      if (!campaignId || !vehicleId) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: camp } = await supabase.from('campaigns').select('gm_user_id, vehicles').eq('id', campaignId).single()
      if (!camp) { setLoading(false); return }
      setIsGM(camp.gm_user_id === user.id)
      // Check if user is a campaign member or GM
      const { data: membership } = await supabase.from('campaign_members').select('id').eq('campaign_id', campaignId).eq('user_id', user.id).maybeSingle()
      setCanEdit(camp.gm_user_id === user.id || !!membership)
      const v = (camp.vehicles ?? []).find((v: Vehicle) => v.id === vehicleId)
      setVehicle(v ?? null)
      setLoading(false)
    }
    load()

    // Realtime sync — refresh when campaign.vehicles changes
    if (!campaignId) return
    const channel = supabase.channel(`vehicle_${campaignId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (payload: any) => {
        const vehicles = payload.new?.vehicles ?? []
        const v = vehicles.find((v: Vehicle) => v.id === vehicleId)
        if (v) setVehicle(v)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaignId, vehicleId])

  if (loading) return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
  if (!vehicle) return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Vehicle not found.</div>

  const wpPct = vehicle.wp_max > 0 ? vehicle.wp_current / vehicle.wp_max : 1
  const wpColor = wpPct > 0.5 ? '#7fc458' : wpPct > 0.25 ? '#EF9F27' : '#c0392b'
  const fuelPct = vehicle.fuel_max > 0 ? vehicle.fuel_current / vehicle.fuel_max : 0

  async function updateVehicle(updated: Vehicle) {
    setVehicle(updated)
    if (!campaignId) return
    const { data: camp } = await supabase.from('campaigns').select('vehicles').eq('id', campaignId).single()
    const vehicles = (camp?.vehicles ?? []).map((v: Vehicle) => v.id === updated.id ? updated : v)
    await supabase.from('campaigns').update({ vehicles }).eq('id', campaignId)
  }

  const lbl: React.CSSProperties = { fontSize: '12px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }
  const bigVal: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', fontFamily: 'Barlow, sans-serif', padding: '16px' }}>

      {/* Header — Vehicle Inspection Record style */}
      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Vehicle Inspection Record</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{vehicle.name}</div>
          <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{vehicle.type}</span>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>Rarity: {vehicle.rarity}</span>
        </div>
        {vehicle.three_words && <div style={{ fontSize: '14px', color: '#d4cfc9', fontStyle: 'italic', marginTop: '4px' }}>"{vehicle.three_words}"</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Left column */}
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {[
              { label: 'Size', value: vehicle.size },
              { label: 'Speed', value: vehicle.speed },
              { label: 'Pass', value: vehicle.passengers },
              { label: 'Enc', value: vehicle.encumbrance },
              { label: 'Range', value: vehicle.range },
            ].map(s => (
              <div key={s.label} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                <div style={lbl}>{s.label}</div>
                <div style={bigVal}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Vehicle image */}
          {vehicle.image_url && (
            <div style={{ marginBottom: '16px' }}>
              <img src={vehicle.image_url} alt={vehicle.name} style={{ width: '100%', borderRadius: '4px', border: '1px solid #2e2e2e' }} />
            </div>
          )}

          {/* WP */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Wound Points</span>
              <span style={{ fontSize: '18px', color: wpColor, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{vehicle.wp_current} / {vehicle.wp_max}</span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, wp_current: Math.max(0, vehicle.wp_current - 1) })} style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>-1</button>
                  <button onClick={() => updateVehicle({ ...vehicle, wp_current: Math.min(vehicle.wp_max, vehicle.wp_current + 1) })} style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>+1</button>
                </div>
              )}
            </div>
            <div style={{ height: '10px', background: '#242424', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${wpPct * 100}%`, background: wpColor, borderRadius: '5px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Stress */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Stress</span>
              <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: vehicle.stress >= 4 ? '#c0392b' : vehicle.stress >= 2 ? '#EF9F27' : '#7fc458' }}>{vehicle.stress} / 5</span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, stress: Math.max(0, vehicle.stress - 1) })} style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>-</button>
                  <button onClick={() => updateVehicle({ ...vehicle, stress: Math.min(5, vehicle.stress + 1) })} style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>+</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ flex: 1, height: '10px', borderRadius: '3px', background: i < vehicle.stress ? (i >= 4 ? '#c0392b' : i >= 2 ? '#EF9F27' : '#7fc458') : '#242424', border: '1px solid #3a3a3a' }} />
              ))}
            </div>
          </div>

          {/* Fuel */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Fuel Reserves</span>
              <span style={{ fontSize: '18px', color: '#EF9F27', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{vehicle.fuel_current} / {vehicle.fuel_max} days</span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, fuel_current: Math.max(0, vehicle.fuel_current - 1) })} style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>-1</button>
                  <button onClick={() => updateVehicle({ ...vehicle, fuel_current: Math.min(vehicle.fuel_max, vehicle.fuel_current + 1) })} style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>+1</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: vehicle.fuel_max }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '14px', borderRadius: '3px', background: i < vehicle.fuel_current ? '#EF9F27' : '#242424', border: '1px solid #3a3a3a' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Cargo & Equipment */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
              <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', flex: 1 }}>Cargo & Equipment</div>
              {canEdit && (
                <button onClick={() => setShowAddCargo(!showAddCargo)}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  {showAddCargo ? 'Cancel' : '+ Add'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              {vehicle.cargo.map((item, idx) => (
                <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: '3px 0', borderBottom: '1px solid #1a1a1a', fontSize: '13px' }}>
                  <span style={{ color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {item.name}
                    {item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
                  </span>
                  {item.notes && <span style={{ color: '#5a5550', fontSize: '12px' }}>{item.notes}</span>}
                  {canEdit && (
                    <button onClick={() => {
                      const newCargo = item.qty > 1
                        ? vehicle.cargo.map((c, i) => i === idx ? { ...c, qty: c.qty - 1 } : c)
                        : vehicle.cargo.filter((_, i) => i !== idx)
                      updateVehicle({ ...vehicle, cargo: newCargo })
                    }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '12px', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>×</button>
                  )}
                </div>
              ))}
            </div>
            {showAddCargo && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Item name"
                    autoFocus style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
                  <input value={addQty} onChange={e => setAddQty(e.target.value)} type="number" min="1" placeholder="Qty"
                    style={{ width: '50px', padding: '5px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
                </div>
                <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes (e.g. 300 rounds each)"
                  style={{ width: '100%', padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', marginBottom: '6px' }} />
                <button onClick={() => {
                  if (!addName.trim() || !vehicle) return
                  const existing = vehicle.cargo.find(c => c.name === addName.trim())
                  const newCargo = existing
                    ? vehicle.cargo.map(c => c === existing ? { ...c, qty: c.qty + (parseInt(addQty) || 1) } : c)
                    : [...vehicle.cargo, { name: addName.trim(), qty: parseInt(addQty) || 1, notes: addNotes.trim() }]
                  updateVehicle({ ...vehicle, cargo: newCargo })
                  setAddName(''); setAddQty('1'); setAddNotes(''); setShowAddCargo(false)
                }} disabled={!addName.trim()}
                  style={{ width: '100%', padding: '6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: addName.trim() ? 'pointer' : 'not-allowed', opacity: addName.trim() ? 1 : 0.5 }}>
                  Add Item
                </button>
              </div>
            )}
          </div>

          {/* Operator Notes */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
              <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', flex: 1 }}>Operator Notes</div>
              {canEdit && (
                <button onClick={() => { setEditingNotes(!editingNotes); setNotesValue(vehicle.notes) }}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  {editingNotes ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={6}
                  style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
                <button onClick={() => { updateVehicle({ ...vehicle, notes: notesValue }); setEditingNotes(false) }}
                  style={{ marginTop: '6px', padding: '6px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{vehicle.notes || 'No notes.'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
