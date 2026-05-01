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

export const metadata = { title: 'First Impressions & Gut Instincts — XSE SRD §02' }

const fiRow = (label: string, effect: string, cmod: string, emphasized = false): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>{label}</Term></td>
    <td style={ruleTableTdStyle}>{effect}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>{cmod}</td>
  </tr>
)

const giRow = (label: string, effect: string, emphasized = false): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 280 }}><Term>{label}</Term></td>
    <td style={ruleTableTdStyle}>{effect}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › First Impressions"
        title="First Impressions & Gut Instincts"
        intro={
          <>
            Two social-reading rolls. <Term>First Impressions</Term> shape
            how an NPC will respond to a PC for the rest of the campaign;{' '}
            <Term>Gut Instincts</Term> tell the player how trustworthy that
            NPC seems.
          </>
        }
      />

      <RuleSection id="first-impressions" title="First Impressions">
        <P>
          When encountering an NPC for the first time, the character may
          make a <Term>First Impression</Term> check to influence how they
          are perceived. The roll uses Influence + an appropriate skill
          (Manipulation, Streetwise, Psychology*, etc.). The result becomes
          a CMod on every future interaction with that NPC and should be
          noted on the character sheet.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
              <th style={{ ...ruleTableThStyle, width: 100, textAlign: 'center' }}>CMod</th>
            </tr>
          </thead>
          <tbody>
            {fiRow('Moment of High Insight (6+6)', 'Favourable impression. Also gain an Insight Die.', '+2', true)}
            {fiRow('Wild Success (14+)', 'Favourable impression.', '+1', true)}
            {fiRow('Success (9–13)', 'No strong feelings either way.', '0')}
            {fiRow('Failure (4–8)', 'Bad impression.', '−1')}
            {fiRow('Dire Failure (0–3)', 'Terrible impression — comes across as threatening or hostile.', '−2')}
            {fiRow('Moment of Low Insight (1+1)', 'Terrible impression. Also gain an Insight Die.', '−3')}
          </tbody>
        </RuleTable>
        <TryIt href="/dashboard">
          First Impressions are stored per-PC, per-NPC and auto-applied to
          Recruitment Checks and other social rolls.
        </TryIt>
      </RuleSection>

      <RuleSection id="gut-instincts" title="Gut Instincts">
        <P>
          Characters can make <Term>Gut Instincts</Term> checks when they
          first meet NPCs to read what kind of impression they get from
          this person, or during an interaction to gauge how much the
          player feels they can trust them. Gut Instincts use the
          Perception modifier, or an appropriate skill (Psychology*,
          Streetwise, Tactics*).
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {giRow('Wild Success (14+) / Moment of High Insight (6+6)', "The player feels like they understand the NPC's motivations.", true)}
            {giRow('Success (9–13)', 'The player gets some insight into how trustworthy they believe the NPC to be.')}
            {giRow('Failure (4–8)', "No good read on the NPC's trustworthiness.")}
            {giRow('Dire Failure (0–3) / Moment of Low Insight (1+1)', 'The player takes everything the NPC says at face value.')}
          </tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
