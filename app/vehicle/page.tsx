'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { useSearchParams } from 'next/navigation'
import VehicleCard, { Vehicle } from '../../components/VehicleCard'
import { classifyRoll } from '../../lib/community-logic'
import { getWeaponByName } from '../../lib/weapons'

// Eligible driver / brewer — a campaign PC or campaign NPC. Stats are
// pulled at load time so the Driving / Brew check modal can prefill
// AMOD + SMOD without a second round trip.
interface CrewMember {
  id: string
  name: string
  kind: 'pc' | 'npc'
  dex: number
  rsn: number
  drivingLevel: number       // SMOD for Driving check
  mechanicLevel: number      // SMOD for Mechanic* (uses RSN)
  tinkererLevel: number      // SMOD for Tinkerer (uses DEX)
  rangedCombatLevel: number  // SMOD for mounted-weapon attack (uses DEX)
}

type CheckKind = 'driving' | 'brew' | 'attack'
type BrewSkill = 'mechanic' | 'tinkerer'

interface AttackTarget {
  id: string         // campaign_npcs.id
  name: string
}

interface CheckState {
  kind: CheckKind
  crewId: string
  amod: number
  smod: number
  cmod: number
  brewSkill: BrewSkill         // ignored for driving / attack
  weaponIndex?: number         // for kind='attack': index into vehicle.mounted_weapons
  targetNpcId?: string          // for kind='attack': which NPC is being shot at
  targets?: AttackTarget[]     // for kind='attack': dropdown options (NPCs on active scene)
  rolling: boolean
  result: { die1: number; die2: number; total: number; outcome: string } | null
}

export default function VehiclePage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const vehicleId = params.get('v')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [floorplanEnlarged, setFloorplanEnlarged] = useState(false)
  const [isGM, setIsGM] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [showAddCargo, setShowAddCargo] = useState(false)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  // Driver/Brewer crew pool — populated alongside the vehicle.
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [check, setCheck] = useState<CheckState | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!campaignId || !vehicleId) { setLoading(false); return }
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      setMyUserId(user.id)
      const { data: camp } = await supabase.from('campaigns').select('gm_user_id, vehicles').eq('id', campaignId).single()
      if (!camp) { setLoading(false); return }
      setIsGM(camp.gm_user_id === user.id)
      // Check if user is a campaign member or GM
      const { data: membership } = await supabase.from('campaign_members').select('id').eq('campaign_id', campaignId).eq('user_id', user.id).maybeSingle()
      setCanEdit(camp.gm_user_id === user.id || !!membership)
      const v = (camp.vehicles ?? []).find((v: Vehicle) => v.id === vehicleId)
      setVehicle(v ?? null)

      // ── Crew pool: PCs (campaign_members → characters) + NPCs ──
      const [memberRes, npcRes] = await Promise.all([
        supabase.from('campaign_members')
          .select('character_id, characters:character_id(id, name, data)')
          .eq('campaign_id', campaignId)
          .not('character_id', 'is', null),
        supabase.from('campaign_npcs')
          .select('id, name, reason, dexterity, skills, status, wp_current, death_countdown')
          .eq('campaign_id', campaignId),
      ])

      const pcs: CrewMember[] = ((memberRes.data ?? []) as any[])
        .map(r => r.characters as { id: string; name: string; data: any } | null)
        .filter((c): c is { id: string; name: string; data: any } => !!c && !!c.id && !!c.name)
        .map(c => {
          const rapid = c.data?.rapid ?? {}
          const skills: { skillName: string; level: number }[] = c.data?.skills ?? []
          const lvl = (n: string) => skills.find(s => s.skillName === n)?.level ?? 0
          return {
            id: c.id, name: c.name, kind: 'pc' as const,
            dex: rapid.DEX ?? 0,
            rsn: rapid.RSN ?? 0,
            drivingLevel: lvl('Driving'),
            mechanicLevel: lvl('Mechanic*'),
            tinkererLevel: lvl('Tinkerer'),
            rangedCombatLevel: lvl('Ranged Combat'),
          }
        })

      // NPCs: filter out dead ones (status='dead' or wp=0 + countdown elapsed)
      const npcs: CrewMember[] = ((npcRes.data ?? []) as any[])
        .filter(n => {
          if (n.status === 'dead') return false
          const wp = n.wp_current ?? 0
          if (wp === 0 && n.death_countdown != null && n.death_countdown <= 0) return false
          return true
        })
        .map(n => {
          // NPC skills.entries shape: [{ name, level }]
          const entries: { name: string; level: number }[] = n.skills?.entries ?? []
          const lvl = (name: string) => entries.find(e => e.name === name)?.level ?? 0
          return {
            id: n.id, name: n.name, kind: 'npc' as const,
            dex: n.dexterity ?? 0,
            rsn: n.reason ?? 0,
            drivingLevel: lvl('Driving'),
            mechanicLevel: lvl('Mechanic*'),
            tinkererLevel: lvl('Tinkerer'),
            rangedCombatLevel: lvl('Ranged Combat'),
          }
        })

      setCrew([...pcs, ...npcs])
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

  // Persist driver / brewer assignment back to the vehicle row.
  async function setCrewAssignment(slot: 'driver' | 'brewer', crewId: string) {
    if (!vehicle) return
    const member = crew.find(c => c.id === crewId)
    const patch: Partial<Vehicle> = slot === 'driver'
      ? { driver_character_id: crewId || null, driver_kind: member?.kind ?? null }
      : { brewer_character_id: crewId || null, brewer_kind: member?.kind ?? null }
    await updateVehicle({ ...vehicle, ...patch })
  }

  // Persist the shooter assignment for a specific mounted weapon.
  // Updates that weapon's entry in the mounted_weapons array; leaves
  // other weapons (and their shooters) untouched.
  async function setShooterAssignment(weaponIdx: number, crewId: string) {
    if (!vehicle) return
    const weapons = (vehicle.mounted_weapons ?? []).slice()
    if (!weapons[weaponIdx]) return
    const member = crew.find(c => c.id === crewId)
    weapons[weaponIdx] = {
      ...weapons[weaponIdx],
      shooter_character_id: crewId || null,
      shooter_kind: member?.kind ?? null,
    }
    await updateVehicle({ ...vehicle, mounted_weapons: weapons })
  }

  // Open the check modal for the assigned driver / brewer with sensible
  // defaults. Brew picks Mechanic* vs Tinkerer by whichever is higher
  // (ties → Mechanic*); GM can override in the modal.
  async function openCheck(kind: CheckKind, weaponIdx?: number) {
    if (!vehicle) return
    let crewId: string | null | undefined
    if (kind === 'driving') crewId = vehicle.driver_character_id
    else if (kind === 'brew') crewId = vehicle.brewer_character_id
    else crewId = vehicle.mounted_weapons?.[weaponIdx ?? 0]?.shooter_character_id
    const member = crew.find(c => c.id === crewId)
    if (!member) {
      alert(kind === 'driving'
        ? 'Pick a driver from the dropdown first.'
        : kind === 'brew'
          ? 'Pick a brewer from the dropdown first.'
          : 'Pick a shooter for this weapon first.')
      return
    }
    if (kind === 'driving') {
      setCheck({
        kind, crewId: member.id,
        amod: member.dex,
        smod: member.drivingLevel,
        cmod: 0,
        brewSkill: 'mechanic',
        rolling: false, result: null,
      })
    } else if (kind === 'brew') {
      const useTinkerer = member.tinkererLevel > member.mechanicLevel
      setCheck({
        kind, crewId: member.id,
        amod: useTinkerer ? member.dex : member.rsn,
        smod: useTinkerer ? member.tinkererLevel : member.mechanicLevel,
        cmod: 0,
        brewSkill: useTinkerer ? 'tinkerer' : 'mechanic',
        rolling: false, result: null,
      })
    } else {
      // attack — Ranged Combat (DEX) check against the weapon. Pull
      // the NPCs currently on the active tactical scene as the target
      // dropdown so the GM can fire at someone who's actually there.
      let targets: AttackTarget[] = []
      if (campaignId) {
        const { data: activeScene } = await supabase
          .from('tactical_scenes')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('is_active', true)
          .maybeSingle()
        if (activeScene?.id) {
          const { data: tokenRows } = await supabase
            .from('scene_tokens')
            .select('npc_id')
            .eq('scene_id', activeScene.id)
            .is('archived_at', null)
            .not('npc_id', 'is', null)
          const npcIds = Array.from(new Set(((tokenRows ?? []) as any[]).map(r => r.npc_id))).filter(Boolean)
          if (npcIds.length > 0) {
            const { data: npcRows } = await supabase
              .from('campaign_npcs')
              .select('id, name')
              .in('id', npcIds)
            targets = ((npcRows ?? []) as any[])
              .map(n => ({ id: n.id as string, name: n.name as string }))
              .sort((a, b) => a.name.localeCompare(b.name))
          }
        }
      }
      setCheck({
        kind: 'attack', crewId: member.id,
        amod: member.dex,
        smod: member.rangedCombatLevel,
        cmod: 0,
        brewSkill: 'mechanic',
        weaponIndex: weaponIdx,
        targets,
        targetNpcId: targets[0]?.id ?? undefined,
        rolling: false, result: null,
      })
    }
  }

  // Switch brew skill within the modal — also rewires AMOD/SMOD to the
  // chosen attribute/skill so the GM doesn't have to re-enter them.
  function switchBrewSkill(next: BrewSkill) {
    if (!check || check.kind !== 'brew') return
    const member = crew.find(c => c.id === check.crewId)
    if (!member) return
    setCheck({
      ...check,
      brewSkill: next,
      amod: next === 'tinkerer' ? member.dex : member.rsn,
      smod: next === 'tinkerer' ? member.tinkererLevel : member.mechanicLevel,
    })
  }

  // Roll 2d6 + amod + smod + cmod, classify, log to roll_log, and apply
  // any rules-mandated mechanical effect. For brew: Wild Success / Success
  // produces a full tank (+1 fuel_current, capped at fuel_max). Failure
  // and Dire Failure produce no fuel — already a no-op on the vehicle's
  // state. Driving outcomes are GM-narrative only (no auto-WP, no auto-
  // time-cost).
  async function rollCheck() {
    if (!check || !vehicle || !campaignId || !myUserId) return
    setCheck({ ...check, rolling: true })
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const total = die1 + die2 + check.amod + check.smod + check.cmod
    const outcome = classifyRoll(total, die1, die2)
    const member = crew.find(c => c.id === check.crewId)
    const weapon = check.kind === 'attack' && check.weaponIndex != null
      ? vehicle.mounted_weapons?.[check.weaponIndex]
      : undefined
    const weaponDef = weapon ? getWeaponByName(weapon.name) : undefined
    const skillLabel = check.kind === 'driving'
      ? 'Driving (DEX)'
      : check.kind === 'brew'
        ? (check.brewSkill === 'tinkerer' ? 'Tinkerer (DEX)' : 'Mechanic* (RSN)')
        : 'Ranged Combat (DEX)'
    const targetName = check.kind === 'attack' && check.targetNpcId
      ? (check.targets?.find(t => t.id === check.targetNpcId)?.name ?? null)
      : null
    const verb = check.kind === 'driving'
      ? '🚗 Driving check'
      : check.kind === 'brew'
        ? '⚗️ Brew check'
        : `🎯 ${weapon?.name ?? 'Mounted weapon'} attack${targetName ? ` → ${targetName}` : ''}`
    const fuelDelta = check.kind === 'brew' && (outcome === 'Wild Success' || outcome === 'Success' || outcome === 'High Insight') ? 1 : 0
    const newFuel = Math.min(vehicle.fuel_max, vehicle.fuel_current + fuelDelta)
    const fuelNote = fuelDelta > 0 && newFuel > vehicle.fuel_current
      ? ` — produced 1 day of fuel (${newFuel}/${vehicle.fuel_max})`
      : fuelDelta > 0
        ? ' — full tank but reserves are already full'
        : ''
    const label = `${verb} · ${vehicle.name} · ${member?.name ?? '—'} · ${skillLabel} · ${outcome}${fuelNote}`

    await supabase.from('roll_log').insert({
      campaign_id: campaignId,
      user_id: myUserId,
      character_name: member?.name ?? null,
      label,
      die1, die2,
      amod: check.amod, smod: check.smod, cmod: check.cmod, total,
      outcome,
      damage_json: {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        checkKind: check.kind,
        skillLabel,
        crewId: check.crewId,
        crewKind: member?.kind ?? null,
        fuelDelta,
        fuelBefore: vehicle.fuel_current,
        fuelAfter: newFuel,
        weaponName: weapon?.name ?? null,
        weaponDamage: weaponDef?.damage ?? null,
        weaponRpPercent: weaponDef?.rpPercent ?? null,
        targetNpcId: check.targetNpcId ?? null,
        targetName,
      },
    })
    if (newFuel !== vehicle.fuel_current) {
      await updateVehicle({ ...vehicle, fuel_current: newFuel })
    }
    setCheck({ ...check, rolling: false, result: { die1, die2, total, outcome } })
  }

  const lbl: React.CSSProperties = { fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }
  const bigVal: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', fontFamily: 'Barlow, sans-serif', padding: '16px' }}>

      {/* Header — Vehicle Inspection Record style */}
      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Vehicle Inspection Record</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{vehicle.name}</div>
          <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{vehicle.type}</span>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>Rarity: {vehicle.rarity}</span>
        </div>
        {vehicle.three_words && <div style={{ fontSize: '14px', color: '#d4cfc9', fontStyle: 'italic', marginTop: '4px' }}>"{vehicle.three_words}"</div>}
      </div>

      {/* Crew & Checks — driver/brewer dropdowns + roll buttons */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Crew &amp; Checks</div>
        <div style={{ display: 'grid', gridTemplateColumns: vehicle.has_still ? '1fr 1fr' : '1fr', gap: '12px' }}>
          {/* Driver */}
          <div>
            <div style={lbl}>Driver</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <select value={vehicle.driver_character_id ?? ''}
                onChange={e => setCrewAssignment('driver', e.target.value)}
                disabled={!canEdit}
                style={{ flex: 1, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                <option value="">— Select driver —</option>
                {crew.filter(c => c.kind === 'pc').length > 0 && (
                  <optgroup label="Player Characters">
                    {crew.filter(c => c.kind === 'pc').map(c => (
                      <option key={c.id} value={c.id}>{c.name} (DEX +{c.dex} · Driving +{c.drivingLevel})</option>
                    ))}
                  </optgroup>
                )}
                {crew.filter(c => c.kind === 'npc').length > 0 && (
                  <optgroup label="NPCs">
                    {crew.filter(c => c.kind === 'npc').map(c => (
                      <option key={c.id} value={c.id}>{c.name} (DEX +{c.dex} · Driving +{c.drivingLevel})</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button onClick={() => openCheck('driving')}
                disabled={!vehicle.driver_character_id}
                style={{ padding: '6px 14px', background: vehicle.driver_character_id ? '#1a3a5c' : '#242424', border: `1px solid ${vehicle.driver_character_id ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: vehicle.driver_character_id ? '#7ab3d4' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: vehicle.driver_character_id ? 'pointer' : 'not-allowed' }}>
                🚗 Driving Check
              </button>
            </div>
          </div>

          {/* Brewer — only when the vehicle has a still */}
          {vehicle.has_still && (
            <div>
              <div style={lbl}>Brewer</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select value={vehicle.brewer_character_id ?? ''}
                  onChange={e => setCrewAssignment('brewer', e.target.value)}
                  disabled={!canEdit}
                  style={{ flex: 1, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  <option value="">— Select brewer —</option>
                  {crew.filter(c => c.kind === 'pc').length > 0 && (
                    <optgroup label="Player Characters">
                      {crew.filter(c => c.kind === 'pc').map(c => (
                        <option key={c.id} value={c.id}>{c.name} (M* +{c.mechanicLevel} · Tink +{c.tinkererLevel})</option>
                      ))}
                    </optgroup>
                  )}
                  {crew.filter(c => c.kind === 'npc').length > 0 && (
                    <optgroup label="NPCs">
                      {crew.filter(c => c.kind === 'npc').map(c => (
                        <option key={c.id} value={c.id}>{c.name} (M* +{c.mechanicLevel} · Tink +{c.tinkererLevel})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button onClick={() => openCheck('brew')}
                  disabled={!vehicle.brewer_character_id}
                  style={{ padding: '6px 14px', background: vehicle.brewer_character_id ? '#3a2516' : '#242424', border: `1px solid ${vehicle.brewer_character_id ? '#b87333' : '#3a3a3a'}`, borderRadius: '3px', color: vehicle.brewer_character_id ? '#b87333' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: vehicle.brewer_character_id ? 'pointer' : 'not-allowed' }}>
                  ⚗️ Brew Check
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mounted Weapons — fitted weapons (sniper nest, MG, etc.).
          Each entry has its own Shooter dropdown so different crew
          members can man different stations. */}
      {(vehicle.mounted_weapons?.length ?? 0) > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Mounted Weapons</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {vehicle.mounted_weapons!.map((w, i) => {
              const def = getWeaponByName(w.name)
              return (
                <div key={i} style={{ background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{w.name}</span>
                    {def && (
                      <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {def.range} · {def.damage} · {def.rpPercent}% RP
                      </span>
                    )}
                  </div>
                  {w.notes && <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', marginBottom: '6px' }}>{w.notes}</div>}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>Shooter</span>
                    <select value={w.shooter_character_id ?? ''}
                      onChange={e => setShooterAssignment(i, e.target.value)}
                      disabled={!canEdit}
                      style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                      <option value="">— Select shooter —</option>
                      {crew.filter(c => c.kind === 'pc').length > 0 && (
                        <optgroup label="Player Characters">
                          {crew.filter(c => c.kind === 'pc').map(c => (
                            <option key={c.id} value={c.id}>{c.name} (DEX +{c.dex} · RC +{c.rangedCombatLevel})</option>
                          ))}
                        </optgroup>
                      )}
                      {crew.filter(c => c.kind === 'npc').length > 0 && (
                        <optgroup label="NPCs">
                          {crew.filter(c => c.kind === 'npc').map(c => (
                            <option key={c.id} value={c.id}>{c.name} (DEX +{c.dex} · RC +{c.rangedCombatLevel})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button onClick={() => openCheck('attack', i)}
                      disabled={!w.shooter_character_id}
                      style={{ padding: '6px 14px', background: w.shooter_character_id ? '#2a1210' : '#242424', border: `1px solid ${w.shooter_character_id ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: w.shooter_character_id ? '#f5a89a' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: w.shooter_character_id ? 'pointer' : 'not-allowed' }}>
                      🎯 Attack
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

          {/* Floorplan */}
          {(vehicle as any).floorplan_url && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginTop: '12px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Floorplan</div>
              <img src={(vehicle as any).floorplan_url} alt="Floorplan"
                onClick={() => setFloorplanEnlarged(true)}
                title="Click to enlarge"
                style={{ width: '100%', borderRadius: '3px', border: '1px solid #2e2e2e', cursor: 'zoom-in' }} />
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Cargo & Equipment */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
              <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', flex: 1 }}>Cargo & Equipment</div>
              {canEdit && (
                <button onClick={() => setShowAddCargo(!showAddCargo)}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                  {showAddCargo ? 'Cancel' : '+ Add'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              {vehicle.cargo.map((item, idx) => (
                <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: '3px 0', borderBottom: '1px solid #1a1a1a', fontSize: '15px' }}>
                  <span style={{ color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {item.name}
                    {item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
                  </span>
                  {item.notes && <span style={{ color: '#5a5550', fontSize: '14px' }}>{item.notes}</span>}
                  {canEdit && (
                    <button onClick={() => {
                      const newCargo = item.qty > 1
                        ? vehicle.cargo.map((c, i) => i === idx ? { ...c, qty: c.qty - 1 } : c)
                        : vehicle.cargo.filter((_, i) => i !== idx)
                      updateVehicle({ ...vehicle, cargo: newCargo })
                    }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
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
              <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', flex: 1 }}>Operator Notes</div>
              {canEdit && (
                <button onClick={() => { setEditingNotes(!editingNotes); setNotesValue(vehicle.notes) }}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
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
              <div style={{ fontSize: '16px', color: '#cce0f5', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{vehicle.notes || 'No notes.'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Check modal — Driving or Brew. Inputs prefilled from the assigned
          crew member's stats; result writes a row to roll_log and (for
          brew Success / Wild Success) bumps fuel_current. */}
      {check && vehicle && (() => {
        const member = crew.find(c => c.id === check.crewId)
        const modalWeapon = check.kind === 'attack' && check.weaponIndex != null
          ? vehicle.mounted_weapons?.[check.weaponIndex]
          : undefined
        const modalWeaponDef = modalWeapon ? getWeaponByName(modalWeapon.name) : undefined
        const verb = check.kind === 'driving'
          ? 'Driving Check'
          : check.kind === 'brew'
            ? 'Brew Check'
            : `${modalWeapon?.name ?? 'Mounted Weapon'} Attack`
        const accent = check.kind === 'driving' ? '#7ab3d4' : check.kind === 'brew' ? '#b87333' : '#c0392b'
        const accentBg = check.kind === 'driving' ? '#1a3a5c' : check.kind === 'brew' ? '#3a2516' : '#2a1210'
        const outcomeColor = (o: string) =>
          o === 'High Insight' || o === 'Wild Success' ? '#7fc458'
          : o === 'Success' ? '#cce0f5'
          : o === 'Failure' ? '#EF9F27'
          : '#c0392b'
        return (
          <div onClick={() => setCheck(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: `1px solid ${accent}`, borderLeft: `3px solid ${accent}`, borderRadius: '4px', padding: '1.25rem', width: '420px', maxWidth: '92vw' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: accent }}>{verb}</div>
                <button onClick={() => setCheck(null)} style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '14px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {member?.name ?? '—'} · {vehicle.name}
              </div>

              {/* Target picker — NPCs currently on the active scene
                  (live tokens). Pre-selected to the first option;
                  empty if no NPCs are on the map. */}
              {check.kind === 'attack' && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={lbl}>Target</div>
                  {(check.targets?.length ?? 0) === 0 ? (
                    <div style={{ fontSize: '13px', color: '#f5a89a', fontStyle: 'italic', padding: '6px 0' }}>
                      No NPCs on the active scene to target. Place some on the tactical map first.
                    </div>
                  ) : (
                    <select value={check.targetNpcId ?? ''}
                      onChange={e => setCheck({ ...check, targetNpcId: e.target.value || undefined })}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', boxSizing: 'border-box' }}>
                      {check.targets!.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Brew skill picker — Mechanic* (RSN) vs Tinkerer (DEX) */}
              {check.kind === 'brew' && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={lbl}>Skill</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    {(['mechanic', 'tinkerer'] as BrewSkill[]).map(s => {
                      const selected = check.brewSkill === s
                      const label = s === 'mechanic' ? `Mechanic* (RSN +${member?.rsn ?? 0} · Skill +${member?.mechanicLevel ?? 0})` : `Tinkerer (DEX +${member?.dex ?? 0} · Skill +${member?.tinkererLevel ?? 0})`
                      return (
                        <button key={s} onClick={() => switchBrewSkill(s)}
                          style={{ flex: 1, padding: '6px', background: selected ? accentBg : '#242424', border: `1px solid ${selected ? accent : '#3a3a3a'}`, borderRadius: '3px', color: selected ? accent : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Roll inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
                <div>
                  <div style={lbl}>AMOD</div>
                  <input type="number" value={check.amod}
                    onChange={e => setCheck({ ...check, amod: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={lbl}>SMOD</div>
                  <input type="number" value={check.smod}
                    onChange={e => setCheck({ ...check, smod: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={lbl}>CMOD</div>
                  <input type="number" value={check.cmod}
                    onChange={e => setCheck({ ...check, cmod: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Result */}
              {check.result ? (
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#0f0f0f', border: `1px solid ${outcomeColor(check.result.outcome)}`, borderRadius: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: outcomeColor(check.result.outcome) }}>{check.result.total}</span>
                    <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      ({check.result.die1} + {check.result.die2}) + {check.amod} + {check.smod}{check.cmod !== 0 ? ` ${check.cmod >= 0 ? '+' : ''}${check.cmod}` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: outcomeColor(check.result.outcome) }}>
                    {check.result.outcome}
                  </div>
                  {check.kind === 'brew' && (check.result.outcome === 'Success' || check.result.outcome === 'Wild Success' || check.result.outcome === 'High Insight') && (
                    <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '4px' }}>
                      ⛽ +1 day fuel produced
                    </div>
                  )}
                  {/* Attack damage info on a hit. The GM rolls damage
                      separately and applies via the standard combat
                      flow — this is just a reminder of the weapon's
                      stats so they don't have to look them up. */}
                  {check.kind === 'attack' && modalWeaponDef && (check.result.outcome === 'Success' || check.result.outcome === 'Wild Success' || check.result.outcome === 'High Insight') && (() => {
                    const targetName = check.targets?.find(t => t.id === check.targetNpcId)?.name
                    return (
                      <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '4px' }}>
                        🎯 Hit{targetName ? ` on ${targetName}` : ''} · damage {modalWeaponDef.damage} · {modalWeaponDef.rpPercent}% RP
                      </div>
                    )
                  })()}
                  {check.kind === 'attack' && (check.result.outcome === 'Failure' || check.result.outcome === 'Dire Failure' || check.result.outcome === 'Low Insight') && (() => {
                    const targetName = check.targets?.find(t => t.id === check.targetNpcId)?.name
                    return (
                      <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '4px' }}>
                        ✗ Miss{targetName ? ` (${targetName} unhurt)` : ''}
                      </div>
                    )
                  })()}
                </div>
              ) : null}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={rollCheck} disabled={check.rolling || !!check.result || (check.kind === 'attack' && !check.targetNpcId)}
                  style={{ flex: 1, padding: '10px', background: accentBg, border: `1px solid ${accent}`, borderRadius: '3px', color: accent, fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, cursor: check.rolling ? 'wait' : (check.result ? 'default' : 'pointer'), opacity: check.result ? 0.5 : 1 }}>
                  {check.rolling ? 'Rolling...' : check.result ? 'Rolled' : `🎲 Roll ${verb}`}
                </button>
                <button onClick={() => setCheck(null)}
                  style={{ padding: '10px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Floorplan lightbox — click image to enlarge, click backdrop
          to close. Mirrors the NpcCard portrait enlarge pattern. */}
      {floorplanEnlarged && (vehicle as any).floorplan_url && (
        <div onClick={() => setFloorplanEnlarged(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem' }}>
          <img src={(vehicle as any).floorplan_url} alt="Floorplan"
            style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: '4px', border: '2px solid #c0392b', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
