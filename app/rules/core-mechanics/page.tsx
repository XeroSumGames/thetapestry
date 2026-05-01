import {
  RuleHero,
  RuleSection,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'

// /rules/core-mechanics — XSE SRD §02. Source: docs/Rules/XSE SRD v1.1.17 §02.

const outcomeRow = (
  range: string,
  label: string,
  desc: string,
  emphasized = false,
): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 90, fontWeight: 700 }}>
      {range}
    </td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220 }}>
      <Term>{label}</Term>
    </td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

const modRow = (mod: string, label: string): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 60, fontWeight: 700, color: '#cce0f5' }}>
      {mod}
    </td>
    <td style={ruleTableTdStyle}>{label}</td>
  </tr>
)

export const metadata = {
  title: 'Core Mechanics — XSE SRD',
  description:
    'Dice Check outcomes, modifiers (AMod, SMod, CMod), Insight Dice, Filling In The Gaps, and the various check types.',
}

export default function CoreMechanicsPage() {
  return (
    <>
      <RuleHero
        eyebrow="§02 · Core Mechanics"
        title="Core Mechanics"
        intro={
          <>
            If a player or non-player character does something that will
            affect the storyline — using a skill, making an attack, trying to
            persuade — they must make a <Term>Dice Check</Term> to clearly
            define the outcome. Every Dice Check is{' '}
            <Term>2d6 + AMod + SMod + CMod</Term>.
          </>
        }
      />

      <RuleSection id="dice-check" title="Dice Check Outcomes">
        <P>
          Although a total of 9 or above is a Success, there are gradations
          of success and failure. Roll <Term>2d6</Term>, add modifiers, and
          consult Table 1.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Total</th>
              <th style={ruleTableThStyle}>Outcome</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {outcomeRow('14+', 'Wild Success', "The action succeeds — and there is an additional positive result that benefits the character. The safe opens AND there's something unexpected of value inside.", true)}
            {outcomeRow('6+6', 'Moment of High Insight', 'A double-six. Counts as a Wild Success AND grants an Insight Die.', true)}
            {outcomeRow('9–13', 'Success', 'The action or task succeeds.')}
            {outcomeRow('4–8', 'Failure', 'The action or task fails.')}
            {outcomeRow('0–3', 'Dire Failure', 'Not only unsuccessful — there is an additional setback or consequence. A failed safe-cracking attempt irreparably jams the lock.')}
            {outcomeRow('1+1', 'Moment of Low Insight', 'A double-one. Counts as a Dire Failure AND grants an Insight Die.')}
          </tbody>
        </RuleTable>
        <RuleSection id="moments-of-insight" title="Moments of Insight" level={3}>
          <P>
            When characters perform exceptionally well or disastrously badly,
            they have a <Term>Moment of Insight</Term> and gain a deeper
            understanding of exactly why they succeeded or failed. Insight
            Dice cannot be used to re-roll dice in a Moment of Low Insight.
          </P>
        </RuleSection>
      </RuleSection>

      <RuleSection id="modifiers" title="Modifiers (AMod · SMod · CMod)">
        <P>
          Dice Checks are influenced by up to three modifiers, all
          cumulative: <Term>Attribute Modifier (AMod)</Term>,{' '}
          <Term>Skill Modifier (SMod)</Term>, and{' '}
          <Term>Conditional Modifier (CMod)</Term>.
        </P>

        <RuleSection id="amod" title="Attribute Modifier (AMod)" level={3}>
          <P>
            Each character has five attributes — <Term>R A P I D</Term>{' '}
            (Reason, Acuity, Physicality, Influence, Dexterity). Attributes
            range from −2 to +4 for humans (animals and machines can reach
            +5).
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Mod</th>
                <th style={ruleTableThStyle}>Label</th>
              </tr>
            </thead>
            <tbody>
              {modRow('−2', 'Diminished')}
              {modRow('−1', 'Weak')}
              {modRow('0', 'Average')}
              {modRow('+1', 'Good')}
              {modRow('+2', 'Strong')}
              {modRow('+3', 'Exceptional')}
              {modRow('+4', 'Human Peak')}
              {modRow('+5', 'Superhuman')}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection id="smod" title="Skill Modifier (SMod)" level={3}>
          <P>
            Each character has a variety of skills that range from −3 to +4
            based on their expertise. Each skill is linked to an attribute
            (e.g. Physicality → Unarmed Combat) — a Dice Check often
            includes both AMod and SMod.
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Mod</th>
                <th style={ruleTableThStyle}>Label</th>
              </tr>
            </thead>
            <tbody>
              {modRow('−3', 'Inept')}
              {modRow('0', 'Untrained')}
              {modRow('+1', 'Beginner')}
              {modRow('+2', 'Journeyman')}
              {modRow('+3', 'Professional')}
              {modRow('+4', "Life's Work")}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection id="cmod" title="Conditional Modifier (CMod)" level={3}>
          <P>
            Any number of external, unplanned, and unanticipated factors can
            influence a Dice Check. CMods are applied at GM discretion or at
            the request of a player who can <Term>Make The Case</Term> for
            them.
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Mod</th>
                <th style={ruleTableThStyle}>Label</th>
              </tr>
            </thead>
            <tbody>
              {modRow('−5', 'Doomed To Fail')}
              {modRow('−4', 'Insurmountable')}
              {modRow('−3', 'Hard')}
              {modRow('−2', 'Difficult')}
              {modRow('−1', 'Challenging')}
              {modRow('0', 'Average')}
              {modRow('+1', 'Simple')}
              {modRow('+2', 'Slight Favor')}
              {modRow('+3', 'Easy')}
              {modRow('+4', 'Trivial')}
              {modRow('+5', 'Divinely Inspired')}
            </tbody>
          </RuleTable>
        </RuleSection>
      </RuleSection>

      <RuleSection id="insight-dice" title="Insight Dice">
        <P>
          <Term>Insight Dice</Term> let players directly affect and influence
          the narrative. Characters get <Term>2 Insight Dice</Term> on
          creation and gain an additional one each time they roll a Moment
          of Insight (double-1 or double-6).
        </P>
        <P>Common uses, agreed between GM and players:</P>
        <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
          <li>Roll an extra d6 prior to the Dice Check (3d6 total).</li>
          <li>Add a +3 CMod to the Dice Check before rolling.</li>
          <li>After a Dice Check, drop one or both dice and replace them with an Insight Die rolled fresh.</li>
          <li>Spend Insight Dice for a flashback, retcon, or anything else the player can <Term>Make The Case</Term> for.</li>
          <li>Spend an Insight Die to introduce a story element (e.g. trying the door again and finding it unlocked) — with GM approval and a successful Make The Case.</li>
          <li>Spend ALL available Insight Dice to recover 1 Wound Point + 1 Resilience Point per die and save the character from Death.</li>
        </ul>
        <P>
          Once a player uses an Insight Die, they surrender it back to the
          GM. Insight Dice cannot transfer between characters and cannot
          re-roll a Moment of Low Insight, but they do carry over from
          session to session.
        </P>
        <TryIt href="/dashboard">
          Insight Dice are tracked on every character sheet — open one to
          see the running count.
        </TryIt>
      </RuleSection>

      <RuleSection id="filling-in-the-gaps" title="Filling In The Gaps">
        <P>
          <Term>Filling In The Gaps</Term> directly involves the group with
          worldbuilding and stage setting. The GM should prompt players to
          provide additional detail, context, or flavour during gameplay
          about what their character is seeing or experiencing.
        </P>
      </RuleSection>

      <RuleSection id="making-the-case" title="Making The Case">
        <P>
          A character can <Term>Make The Case</Term> and offer further
          context on how their actions are shaping the outcome of a Dice
          Check. If the GM agrees the proposal makes narrative sense, they
          may add a CMod to the Dice Check.
        </P>
      </RuleSection>

      <RuleSection id="attribute-checks" title="Attribute, Group, and Opposed Checks">
        <RuleSection id="attribute-check" title="Attribute Check" level={3}>
          <P>
            Players can use a character's RAPID Range attributes for checks
            that do not require a specific skill — e.g. Reason for a riddle
            or Physicality for a feat of strength. Only the relevant AMod
            applies.
          </P>
        </RuleSection>
        <RuleSection id="group-check" title="Group Check" level={3}>
          <P>
            Multiple players attempting the same task can work together. To
            take part in a Group Check, everyone must be using the same
            attribute or skill (even if they have 0). The player with the
            highest relevant AMod or SMod makes the check and applies any
            AMods or SMods from the other characters taking part.
          </P>
          <P>
            Insight Dice cannot be spent as part of a Group Check, but if the
            outcome is a Moment of Insight, all participants receive an
            Insight Die. Group Checks are at GM discretion and must make
            logical sense within the narrative.
          </P>
        </RuleSection>
        <RuleSection id="opposed-check" title="Opposed Check" level={3}>
          <P>
            Characters competing directly against one another make Opposed
            Checks. The first side to roll a Success, Wild Success, or
            Moment of High Insight while the other side simultaneously rolls
            a Failure, Dire Failure, or Moment of Low Insight wins. If both
            sides roll the same outcome, the result is negated and play
            continues until a clear winner emerges or one side changes
            strategy.
          </P>
        </RuleSection>
        <RuleSection id="perception-check" title="Perception Check" level={3}>
          <P>
            If a player wants to know whether their character has picked up
            on unspoken cues or subtle details, they may make a{' '}
            <Term>Perception Check</Term> using the secondary stat{' '}
            <Term>Perception</Term> as a modifier. The GM helps Fill In The
            Gaps with whatever is noticed.
          </P>
        </RuleSection>
      </RuleSection>

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
            <tr style={{ background: '#150f0e', borderLeft: '2px solid #c0392b' }}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Moment of High Insight (6+6)</Term></td>
              <td style={ruleTableTdStyle}>Favourable impression. Also gain an Insight Die.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>+2</td>
            </tr>
            <tr style={{ background: '#150f0e', borderLeft: '2px solid #c0392b' }}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Wild Success (14+)</Term></td>
              <td style={ruleTableTdStyle}>Favourable impression.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>+1</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Success (9–13)</Term></td>
              <td style={ruleTableTdStyle}>No strong feelings either way.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>0</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Failure (4–8)</Term></td>
              <td style={ruleTableTdStyle}>Bad impression.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>−1</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Dire Failure (0–3)</Term></td>
              <td style={ruleTableTdStyle}>Terrible impression — comes across as threatening or hostile.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>−2</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Moment of Low Insight (1+1)</Term></td>
              <td style={ruleTableTdStyle}>Terrible impression. Also gain an Insight Die.</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>−3</td>
            </tr>
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
          first meet NPCs to read what kind of impression they get from this
          person, or during an interaction to gauge how much the player
          feels they can trust them. Gut Instincts use the Perception
          modifier, or an appropriate skill (Psychology*, Streetwise,
          Tactics*).
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {outcomeRow('14+ / 6+6', 'Wild Success / High Insight', "The player feels like they understand the NPC's motivations.", true)}
            {outcomeRow('9–13', 'Success', 'The player gets some insight into how trustworthy they believe the NPC to be.')}
            {outcomeRow('4–8', 'Failure', "No good read on the NPC's trustworthiness.")}
            {outcomeRow('0–3 / 1+1', 'Dire Failure / Low Insight', 'The player takes everything the NPC says at face value.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <p
        style={{
          marginTop: '4rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #2e2e2e',
          fontSize: 13,
          color: '#7a7a7a',
          lineHeight: 1.7,
        }}
      >
        Source: <code>XSE SRD v1.1.17 §02 Core Mechanics</code>.
      </p>
    </>
  )
}
