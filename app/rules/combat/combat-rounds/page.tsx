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

export const metadata = { title: 'Combat Rounds — XSE SRD §06' }

const COMBAT_ACTIONS: Array<[string, string, string]> = [
  ['Aim', '1', '+2 CMod on the next Attack this round; lost if anything but Attack is taken next.'],
  ['Attack', '1', 'Roll Unarmed, Ranged, or Melee Combat. Damage on success.'],
  ['Charge', '2', 'Move + a melee/unarmed attack with a +1 CMod.'],
  ['Coordinate', '1', "Tactics* check; allies in Close get +2 CMod vs target. On Wild Success, allies also get +1 CMod on their attack."],
  ['Cover Fire', '1', "Expend ammo to suppress an Attacker. Subjects take −2 CMod on their next attack, dodge, or move."],
  ['Defend', '1', '+2 to MDM/RDM against the next attack on this character. Cleared after one hit.'],
  ['Distract', '1', 'Steal 1 Combat Action from a target via an Opposed Check (skill or attribute as agreed). On Wild Success, steal 2 actions.'],
  ['Fire from Cover', '2', "Attack from cover; keep the cover's defensive bonus."],
  ['Grapple', '1', 'Opposed Physicality + Unarmed Combat. Winner restrains or takes 1 RP from the loser.'],
  ['Inspire', '1', 'Grant +1 Combat Action to an ally. Once per round.'],
  ['Move', '1', 'Move up to 1 Range Band per Move action.'],
  ['Rapid Fire', '2', 'Two shots from a Ranged Weapon (Table 17). −1 CMod on first, −3 CMod on second. As a single Combat Action: −2 first / −4 second.'],
  ['Ready Weapon', '1', 'Switch, reload, or unjam a weapon.'],
  ['Reposition', '1', "End-of-round positioning move that doesn't trigger combat-action consumption checks."],
  ['Sprint', '2', 'Move 2 bands. Athletics check on completion or become Winded (1 action next round).'],
  ['Subdue', '1', 'Non-lethal attack — full RP damage but only 50% WP damage.'],
  ['Take Cover', '1', '+2 Defensive Modifier against all attacks until the character takes an active combat action.'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Rounds"
        title="Combat Rounds"
        intro={
          <>
            Combat is divided into rounds that last approximately{' '}
            <Term>3–6 seconds</Term>. Each round has three phases:{' '}
            <Term>Initiative</Term>, <Term>Action</Term>,{' '}
            <Term>Recovery</Term>.
          </>
        }
      />

      <RuleSection id="initiative" title="Initiative">
        <P>
          Each participant rolls <Term>2d6 + Initiative Mod</Term> (ACU +
          DEX from Secondary Stats). Highest goes first; ties between PCs
          and NPCs go to the PC, ties between PCs act simultaneously.
        </P>
        <P>
          Characters may choose to <Term>delay</Term> their action until
          later in the round.
        </P>
        <P>
          In each subsequent round, any participant who was neither
          attacked nor attacked anyone else gets a <Term>+1 modifier</Term>{' '}
          on their next Initiative check.
        </P>
      </RuleSection>

      <RuleSection id="get-the-drop" title="Get The Drop">
        <P>
          Before combat starts, one character (including NPCs) can
          preemptively <Term>Get The Drop</Term> and take a single combat
          action before anyone else rolls for initiative.
        </P>
        <P>
          If multiple characters attempt it, the one with the highest
          combined <Term>Dexterity + Acuity AMods</Term> wins. If there's
          no clear winner, no one gets the drop and combat moves directly
          to Initiative.
        </P>
        <P>
          Any character who Got The Drop incurs a <Term>−2 CMod</Term> on
          their next Initiative roll.
        </P>
      </RuleSection>

      <RuleSection id="actions" title="Actions">
        <P>
          Each participant gets <Term>2 Combat Actions</Term> per round.
          Take the same action twice or two different actions.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Action</th>
              <th style={{ ...ruleTableThStyle, width: 70, textAlign: 'center' }}>Cost</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {COMBAT_ACTIONS.map(([name, cost, desc]) => (
              <tr key={name}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 140, fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: cost === '2' ? '#EF9F27' : '#7fc458' }}>{cost}</td>
                <td style={ruleTableTdStyle}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="recovery" title="Recovery">
        <P>
          The Recovery phase resolves delayed effects from actions and
          weapons (e.g. grenades). Once each character has taken both
          actions and after delayed effects resolve, the round concludes
          and the next begins with a fresh Initiative check.
        </P>
      </RuleSection>

      <TryIt href="/dashboard">
        Tapestry's combat tracker handles initiative, the 2-action budget,
        and round/phase advancement automatically.
      </TryIt>
    </>
  )
}
