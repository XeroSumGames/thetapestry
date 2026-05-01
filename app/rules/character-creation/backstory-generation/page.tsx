import {
  RuleHero,
  RuleSection,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Backstory Generation — XSE SRD §04' }

const stepRow = (step: string, name: string, spend: string, cap: string): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 60, fontWeight: 700, color: '#cce0f5' }}>{step}</td>
    <td style={{ ...ruleTableTdStyle, width: 220 }}><Term>{name}</Term></td>
    <td style={ruleTableTdStyle}>{spend}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>{cap}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-creation')!} />
      <RuleHero
        eyebrow="§04 · Character Creation › Backstory Generation"
        title="Backstory Generation"
        intro={
          <>
            The full character creation method: <Term>20 Character
            Development Points (CDP)</Term> allocated across nine life
            stages. Each stage adds 1–2 sentences to the character's
            backstory and a small CDP spend to RAPID attributes or skills.
          </>
        }
      />

      <P>
        At no point during Backstory Generation may a character raise an
        attribute beyond <Term>+3 (Exceptional)</Term> or a skill beyond{' '}
        <Term>+3 (Professional)</Term>.
      </P>

      <RuleSection id="steps" title="The nine steps">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Step</th>
              <th style={ruleTableThStyle}>Stage</th>
              <th style={ruleTableThStyle}>Spend</th>
              <th style={ruleTableThStyle}>Cap</th>
            </tr>
          </thead>
          <tbody>
            {stepRow('X', 'Who Are You?', 'Concept: name, age, height, weight, 3 thematic words. No CDP spent.', '—')}
            {stepRow('1', 'Where You Grew Up', '1 CDP on a RAPID attribute (0→+1). 2 CDP on skills — either +2 to one skill or +1 to two.', '+2 skill')}
            {stepRow('2', 'What You Learned', '1 CDP on attribute. 3 CDP on skills.', '+2 skill')}
            {stepRow('3', 'What You Learned That Day', "Skills picked up in spare time. 1 CDP on attribute. 3 CDP on skills.", '+2 skill')}
            {stepRow('4', 'What Drives You?', 'Pick a Complication + Motivation (or roll 2d6 on each table).', '+2 skill')}
            {stepRow('5', 'How You Make Your Money', "Profession pick (or freeform skills that fit). 2 CDP on attributes. 4 CDP on skills.", '+3 attr / +3 skill')}
            {stepRow('6', 'What Makes You Tick?', 'Round-out spend. 3 CDP on skills.', '+3 attr / +3 skill')}
            {stepRow('7', 'Secondary Stats', 'Auto-derived from RAPID — see Character Overview › Secondary Stats. No spend.', '—')}
            {stepRow('8', 'What You Have', "Pick primary + secondary weapon from Tables 16-19, 1 item from Table 20: Equipment, plus 1 incidental flavour item.", '—')}
            {stepRow('N', 'Final Form', 'Review + final tweaks. Confirm the character matches the concept and the 3 words still fit.', '—')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="cdp-costs" title="CDP costs after creation">
        <P>
          Once Backstory Generation is complete, players may earn additional
          CDP through play (see Character Evolution). Spending those CDP
          follows three rules:
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Action</th>
              <th style={ruleTableThStyle}>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={ruleTableTdStyle}><Term>Learn a new skill</Term></td>
              <td style={ruleTableTdStyle}>1 CDP to get to Beginner (+1).</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Raise a skill</Term></td>
              <td style={ruleTableTdStyle}>
                Current level + target level CDP.{' '}
                <span style={{ color: '#cce0f5' }}>+1 → +2: 3 CDP. +2 → +3: 5 CDP. +3 → +4: 7 CDP.</span>
              </td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Raise a RAPID attribute</Term></td>
              <td style={ruleTableTdStyle}>
                3× the level being raised.{' '}
                <span style={{ color: '#cce0f5' }}>+1 → +2: 6 CDP. +2 → +3: 9 CDP. +3 → +4: 12 CDP.</span>
              </td>
            </tr>
          </tbody>
        </RuleTable>
      </RuleSection>

      <TryIt href="/characters/new">
        Tapestry walks you through every step of Backstory Generation,
        including CDP totals, profession picks, and the final equipment
        loadout.
      </TryIt>
    </>
  )
}
