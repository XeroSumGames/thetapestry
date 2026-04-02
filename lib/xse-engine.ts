import {
  AttributeName,
  AttributeValue,
  SkillValue,
  SKILLS,
  BACKSTORY_STEPS,
  deriveSecondaryStats,
  createBlankCharacter,
  XSECharacter,
  COMPLICATIONS,
  MOTIVATIONS,
} from './xse-schema'

export function getBaseSkillValue(skillName: string): SkillValue {
  const skill = SKILLS.find(s => s.name === skillName)
  return skill?.vocational ? -3 : 0
}

export function getStepBudget(stepIndex: number) {
  return BACKSTORY_STEPS[stepIndex] ?? null
}

export function getCumulativeAttributes(
  stepData: StepData[]
): Record<AttributeName, AttributeValue> {
  const result: Record<AttributeName, AttributeValue> = {
    RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0,
  }
  for (const step of stepData) {
    if (step.attrKey) {
      result[step.attrKey] = Math.min(result[step.attrKey] + 1, 4) as AttributeValue
    }
    if (step.attrSpent) {
      for (const key of Object.keys(step.attrSpent) as AttributeName[]) {
        result[key] = Math.min(result[key] + (step.attrSpent[key] ?? 0), 4) as AttributeValue
      }
    }
  }
  return result
}

export function getCumulativeSkills(
  stepData: StepData[]
): Record<string, SkillValue> {
  const result: Record<string, SkillValue> = {}
  for (const skill of SKILLS) {
    result[skill.name] = skill.vocational ? -3 : 0
  }
  for (const step of stepData) {
    for (const [name, delta] of Object.entries(step.skillDeltas ?? {})) {
      result[name] = Math.min((result[name] ?? 0) + (delta ?? 0), 4) as SkillValue
    }
  }
  return result
}

export function skillStepUp(current: SkillValue, vocational: boolean): SkillValue {
  if (vocational && current === -3) return 1
  const steps: SkillValue[] = [-3, 0, 1, 2, 3, 4]
  const idx = steps.indexOf(current)
  return idx < steps.length - 1 ? steps[idx + 1] : current
}

export function skillStepDown(current: SkillValue, base: SkillValue): SkillValue {
  const steps: SkillValue[] = [-3, 0, 1, 2, 3, 4]
  const idx = steps.indexOf(current)
  const prev = idx > 0 ? steps[idx - 1] : current
  return prev < base ? base : prev
}

export interface StepData {
  attrKey?: AttributeName | null
  attrSpent?: Partial<Record<AttributeName, number>>
  skillDeltas?: Partial<Record<string, number>>
  skillCDPSpent?: number
  skillCDPMap?: Partial<Record<string, number>>
  profession?: string
  complication?: string
  motivation?: string
  note?: string
}

export interface WizardState {
  currentStep: number
  name: string
  nickname: string
  age: string
  gender: string
  height: string
  weight: string
  concept: string
  physdesc: string
  photoDataUrl: string
  threeWords: [string, string, string]
  steps: StepData[]
  weaponPrimary: string
  weaponSecondary: string
  primaryAmmo: number
  secondaryAmmo: number
  equipment: string
  incidentalItem: string
  rations: string
}

export function createWizardState(): WizardState {
  return {
    currentStep: 0,
    name: '',
    nickname: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    concept: '',
    physdesc: '',
    photoDataUrl: '',
    threeWords: ['', '', ''],
    steps: Array.from({ length: 7 }, () => ({})),
    weaponPrimary: '',
    weaponSecondary: '',
    primaryAmmo: 0,
    secondaryAmmo: 0,
    equipment: '',
    incidentalItem: '',
    rations: '',
  }
}

export function roll2d6(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1
}

export function roll1d3(): number {
  return Math.floor(Math.random() * 3) + 1
}

export function rollComplication(): string {
  return COMPLICATIONS[roll2d6()] ?? ''
}

export function rollMotivation(): string {
  return MOTIVATIONS[roll2d6()] ?? ''
}

export function buildCharacter(state: WizardState): XSECharacter {
  const char = createBlankCharacter()

  char.name = state.name
  char.gender = state.gender
  char.height = state.height
  char.weight = state.weight
  char.threeWords = state.threeWords
  char.notes = state.concept
  char.creationMethod = 'backstory'

  const rapid = getCumulativeAttributes(state.steps)
  char.rapid = rapid
  char.secondary = deriveSecondaryStats(rapid)

  const skills = getCumulativeSkills(state.steps)
  char.skills = Object.entries(skills).map(([skillName, level]) => ({
    skillName,
    level,
  }))

  const step4 = state.steps[3]
  char.profession = step4?.profession ?? ''

  const step6 = state.steps[5]
  char.complication = step6?.complication ?? ''
  char.motivation = step6?.motivation ?? ''

  char.weaponPrimary = {
    weaponName: state.weaponPrimary,
    condition: 'Used',
    ammoCurrent: state.primaryAmmo,
  }
  char.weaponSecondary = {
    weaponName: state.weaponSecondary,
    condition: 'Used',
    ammoCurrent: state.secondaryAmmo,
  }
  char.equipment = state.equipment ? [state.equipment] : []
  char.incidentalItem = state.incidentalItem

  return char
}
