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
'Ellis','Milo','Sage','Dani','Crew','Lyra','Beck','Faye','Jax','Nora',
'Tris','Orin','Cleo','Soren','Bex','Maren','Levi','Willa','Rue','Daxton',
'Iris','Otto','Vale','Remy','Slade','Bryn','Cade','Pia','Fox','Elara',
'Nash','Celeste','Rowan','Arlo','Suki','Penn','Daire','Lior','Zev','Mila',
'Cian','Vesper','Bode','Ines','Rafe','Tova','Leif','Opal','Colt','Fern',
'Ewan','Liora','Blaise','Mira','Thorn','Ada','Corbin','Zia','Pax','Elowen',
'Sable','Ren','Cato','Wren','Odette','Tam','Blythe','Quill','Zola','Caspian',
'Brix','Niamh','Gage','Soleil','Zane','Rhea','Strider','Calla','Dov','Lark',
'Stellan','Fen','Merritt','Oberon','Tali','Cree','Senna','Wolf','Piper','Idris',
'Vida','Cael','Orion','Bess','Iver','Thane','Riona','Beckett','Luz','Sable',
'Caius','Veda','Knox','Ione','Rafferty','Saoirse','Idra','Tegan','Bao','Luce',
'Ozzy','Calyx','Dex','Eira','Matteo','Zephyr','Sable','Neve','Cain','Lyric',
'Amos','Vesna','Cree','Fallon','Rigel','Mabel','Cove','Petra','Shaw','Indra',
'Lex','Corin','Dara','Stellan','Owyn','Cira','Blaze','Tindra','Rook','Esme',
'Jett','Calla','Soren','Brin','Ode','Lacey','Ciar','Vex','Mads','Theron',
'Lena','Dakarai','Cree','Yael','Aldric','Zuri','Cael','Nox','Sable','Fen',
'Arlo','Clio','Daire','Vesper','Rook','Sable','Tov','Lyra','Cove','Maren',
]
const LAST_NAMES = [
  'Voss','Harlan','Reyes','Mack','Steele','Doran','Cross','Fenn','Bale','Holt',
'Crane','Mercer','Ashby','Vane','Rook','Calloway','Drex','Finch','Sable','Thorn',
'Graves','Wicker','Ashford','Blaine','Corso','Dusk','Emery','Falco','Gable','Hale',
'Irons','Janeway','Keene','Lorne','Mace','Noor','Okafor','Pell','Quinn','Rand',
'Sayer','Tull','Ulric','Vance','Wren','Yuen','Zell','Archer','Bowen','Cain',
'Daley','Egan','Frost','Greer','Haven','Innis','Jarvik','Kade','Lund','Morrow',
'Niven','Orin','Pryce','Quill','Rowe','Saxon','Thane','Upton','Vale','Wilder',
'Yates','Zeleny','Alden','Brand','Corvin','Drake','Elara','Falk','Goss','Herd',
'Irwin','Joss','Kline','Langford','Munroe','Neff','Oban','Pax','Remy','Shire',
'Taft','Ulmer','Veld','Wace','Xan','Yarrow','Zorn','Alcott','Beckett','Croft',
'Danvers','Ennis','Forde','Garrick','Hewitt','Ives','Jericho','Kell','Layne','Marsh',
'Norris','Osei','Preen','Radley','Soren','Tayne','Umbra','Voss','Wade','Xander',
'Yardley','Zane','Ashworth','Bram','Cooke','Daws','Elkin','Fenwick','Gore','Hext',
'Ingram','Judd','Kray','Lask','Maren','Noel','Ormond','Penn','Rake','Sable',
'Theron','Udale','Varro','Weld','Xenos','Yarvis','Zwick','Alford','Birch','Carver',
'Dade','Eskin','Fey','Gant','Heron','Inwood','Jurgen','Kelso','Lark','Mast',
'Nace','Orin','Pruett','Rask','Slade','Teel','Ulric','Vex','Watt','Yorn',
'Zavala','Aldiss','Brek','Coyle','Dann','Elvin','Firth','Grail','Hask','Idris',
'Jarn','Koss','Lune','Marek','Neld','Oban','Pell','Rand','Skov','Thane',
'Uvell','Vorn','Wisk','Xell','Yeld','Zask','Arken','Beld','Corvus','Darke',
]
const GENDERS = ['Male', 'Female', 'Non-binary']

const THREE_WORDS = [
   'Adaptable ', 'Adventurous ', 'Affectionate ', 'Altruistic ', 'Ambitious ', 'Argumentative ', 'Articulate ', 'Assertive ', 'Authentic ', 'Authoritative ', 'Bold ', 'Braggadocious ', 'Calm ', 'Candid ', 'Charismatic ', 'Clever ', 'Collaborative ', 'Combative ', 'Compassionate ', 'Confident ', 'Conscientious ', 'Contrarian ', 'Courageous ', 'Creative ', 'Cultured ', 'Cunning ', 'Curious ', 'Daring ', 'Decisive ', 'Deliberate ', 'Determined ', 'Dignified ', 'Diligent ', 'Diplomatic ', 'Discreet ', 'Eloquent ', 'Empathetic ', 'Energetic ', 'Enterprising ', 'Fair ', 'Fervent ', 'Fierce ', 'Flexible ', 'Focused ', 'Forgiving ', 'Generous ', 'Genuine ', 'Gregarious ', 'Grounded ', 'Honorable ', 'Humble ', 'Idealistic ', 'Imaginative ', 'Independent ', 'Insightful ', 'Intelligent ', 'Intuitive ', 'Inventive ', 'Joyful ', 'Just ', 'Loyal ', 'Mature ', 'Meticulous ', 'Observant ', 'Original ', 'Passionate ', 'Patient ', 'Perceptive ', 'Persuasive ', 'Philanthropic ', 'Pragmatic ', 'Precise ', 'Principled ', 'Prudent ', 'Purposeful ', 'Rational ', 'Realistic ', 'Reflective ', 'Reliable ', 'Resilient ', 'Resourceful ', 'Sensitive ', 'Sincere ', 'Sociable ', 'Steadfast ', 'Strategic ', 'Tactful ', 'Tenacious ', 'Thoughtful ', 'Tolerant ', 'Trusting ', 'Trustworthy ', 'Understanding ', 'Unique ', 'Versatile ', 'Vigilant ', 'Visionary ', 'Wise ', 'Witty ', 'Zealous ',
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
        <div style={{ fontSize: '14px', color: '#d4cfc9', letterSpacing: '.06em' }}>{status}</div>
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
