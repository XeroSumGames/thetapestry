'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import {
  createWizardState, buildCharacter, roll2d6, roll1d3,
  rollComplication, rollMotivation
} from '../../../lib/xse-engine'
import {
  PARADIGMS, MELEE_WEAPONS, RANGED_WEAPONS, EQUIPMENT,
  AttributeName
} from '../../../lib/xse-schema'

const FIRST_NAMES = [
  'Mara','Cole','Jesse','Petra','Dex','Avery','Rook','Sloane','Cas','Wren',
  'Holt','Nadia','Flynn','Sable','Cruz','Tatum','Bram','Lena','Gus','Vera',
  'Kai','Thea','Reed','Nova','Ash','Juno','Pike','Cora','Finn','Zara',
]
const LAST_NAMES = [
  'Voss','Harlan','Reyes','Mack','Steele','Doran','Cross','Fenn','Bale','Marsh',
  'Solis','Grime','Ward','Thorn','Hess','Crane','Pike','Dunn','Fox','Lowe',
  'Nox','Caine','Stone','Weld','Carr','Drax','Hull','Vale','Roan','Shade',
]
const GENDERS = ['Male', 'Female', 'Non-binary']

const THREE_WORDS = [
  'Cautious', 'Reckless', 'Loyal', 'Bitter', 'Hopeful', 'Ruthless', 'Quiet', 'Fierce',
  'Broken', 'Stubborn', 'Cunning', 'Weary', 'Driven', 'Haunted', 'Pragmatic', 'Bold',
  'Volatile', 'Steady', 'Scarred', 'Resourceful', 'Cold', 'Warm', 'Lost', 'Focused',
  'Suspicious', 'Generous', 'Hardened', 'Idealistic', 'Cynical', 'Determined',
]
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randAge(): string {
  return String(18 + Math.floor(Math.random() * 42))
}

function randHeight(): string {
  const inches = 60 + Math.floor(Math.random() * 18)
  const ft = Math.floor(inches / 12)
  const inn = inches % 12
  return `${ft}'${inn}"`
}

function randWeight(): string {
  return `${110 + Math.floor(Math.random() * 130)} lbs`
}

export default function RandomCharacterPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Generating character...')

  useEffect(() => {
    async function generate() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Pick a random paradigm
      const paradigm = pick(PARADIGMS)

      // Build wizard state
      const state = createWizardState()
      state.name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
      state.gender = pick(GENDERS)
      state.age = randAge()
      state.height = randHeight()
      state.weight = randWeight()
      state.currentStep = 9
      state.threeWords = [pick(THREE_WORDS), pick(THREE_WORDS), pick(THREE_WORDS)]
      state.rations = 'Standard'

      // Map paradigm RAPID onto step data via attrSpent
      state.steps[3] = {
        ...state.steps[3],
        profession: paradigm.profession,
        attrSpent: paradigm.rapid as Partial<Record<AttributeName, number>>,
      }

      // Map paradigm skills onto step 4 deltas
      const skillDeltas: Partial<Record<string, number>> = {}
      for (const entry of paradigm.skills) {
        const skillName = entry.skillName
        const found = Object.keys(skillDeltas).find(k => k === skillName)
        if (!found) skillDeltas[skillName] = entry.level
      }
      state.steps[4] = { ...state.steps[4], skillDeltas }

      // Complication + motivation
      state.steps[5] = {
        ...state.steps[5],
        complication: rollComplication(),
        motivation: rollMotivation(),
      }

      // Random weapons
      const meleeWeapons = MELEE_WEAPONS.filter(w => w.rarity !== 'Rare')
      const rangedWeapons = RANGED_WEAPONS.filter(w => w.rarity !== 'Rare')
      const primaryWeapon = pick(rangedWeapons)
      const secondaryWeapon = pick(meleeWeapons)
      state.weaponPrimary = primaryWeapon.name
      state.weaponSecondary = secondaryWeapon.name
      state.primaryAmmo = roll1d3()
      state.secondaryAmmo = 0

      // Random equipment
      const commonEquip = EQUIPMENT.filter(e => e.rarity === 'Common')
      state.equipment = pick(commonEquip).name
      state.incidentalItem = pick(commonEquip).name

      setStatus('Saving...')

      const character = buildCharacter(state)
      character.paradigmName = paradigm.name
      character.creationMethod = 'paradigm'

      const { error, data: newChar } = await supabase.from('characters').insert({
        user_id: user.id,
        name: character.name || 'Random Survivor',
        data: character,
      }).select().single()

      if (error) {
        setStatus('Error: ' + error.message)
        return
      }

      router.push(`/characters/${newChar.id}/edit?step=4`)
    }

    generate()
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>
          Random Character
        </div>
        <div style={{ fontSize: '14px', color: '#b0aaa4', letterSpacing: '.06em' }}>{status}</div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c0392b', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }`}</style>
    </div>
  )
}
