import { RuleHero, RuleSection, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Damage - XSE SRD §06' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Damage"
        title="Damage"
        intro={
          <>
            Each attack deals two types of damage:{' '}
            <Term>Wound Points (WP)</Term> and{' '}
            <Term>Resilience Points (RP)</Term>. Weapons inflict a
            consistent base + a random roll, written as e.g.{' '}
            <code>5+1d6</code>.
          </>
        }
      />

      <RuleSection id="weapon-damage" title="Weapon Damage">
        <P>
          For most ranged and slashing weapons,{' '}
          <Term>RP damage = 50% of WP damage</Term>, rounded down. Attacks
          that inflict concussive damage or blunt force trauma (fists,
          batons, grenades) often do equal RP and WP damage.{' '}
          <Term>Tables 16-19</Term> in §07 list each weapon's WP/RP split.
        </P>
        <P>
          When using Melee Weapons or Unarmed Combat, the user adds their{' '}
          <Term>Physicality AMod</Term> to the damage. Format:{' '}
          <code>4+1d6 + PHY AMod</code>.
        </P>
        <P>
          Bare-fisted damage is <Term>1d3 + PHY AMod + Unarmed Combat SMod</Term>.
        </P>
      </RuleSection>

      <RuleSection id="defensive-mod" title="Defensive Modifiers">
        <P>
          Defensive Modifiers (DM) lower the chance of getting hit and
          mitigate any damage that lands. <Term>Melee Defense Mod (MDM)</Term>{' '}
          uses the defender's PHY AMod; <Term>Ranged Defense Mod (RDM)</Term>{' '}
          uses DEX AMod. Both can be boosted temporarily by combat actions
          like Defend (+2) or Take Cover (+2 against all attacks until the
          character takes an active combat action).
        </P>
      </RuleSection>

      <RuleSection id="environmental" title="Environmental Damage">
        <RuleSection id="subsistence" title="Subsistence Damage" level={3}>
          <P>
            A character without food and water gets a{' '}
            <Term>two-day grace period</Term> (days 1 and 2 hungry, no
            damage). Starting on day 3 of hunger, they lose{' '}
            <Term>1 WP and 1 RP per day</Term> until rations are
            restored.
          </P>
          <P>
            <Term>Insight Dice</Term> can stave off the start of
            Subsistence Damage. Surrender 1 Insight Die per additional
            day of grace before WP/RP loss begins.
          </P>
          <P>
            If <Term>RP reaches 0</Term> from Subsistence Damage, they are
            <Term> Incapacitated</Term> until another character tends to
            them. If <Term>WP reaches 0</Term>, they are{' '}
            <Term>Mortally Wounded</Term> and must be fed to{' '}
            <Term>Stabilise</Term> them, or they die.
          </P>
          <P>
            Once a regular food and water supply is restored, the
            character recovers at <Term>1 WP and 1 RP per day</Term> until
            full. Each <Term>Ration</Term> covers one day of food and
            water (see <a href="/rules/equipment/rations" style={{ color: '#7ab3d4' }}>§07 Rations</a>).
          </P>
          <P>
            See also: <a href="/rules/combat/infection" style={{ color: '#7ab3d4' }}>Infection, Sickness &amp; Disease</a> for the
            day-by-day track triggered by combat wounds or toxic
            exposure.
          </P>
        </RuleSection>
        <RuleSection id="falling" title="Falling" level={3}>
          <P>
            Characters suffer <Term>3 WP and 3 RP damage</Term> per 10 ft
            fallen.
          </P>
        </RuleSection>
        <RuleSection id="drowning" title="Drowning" level={3}>
          <P>
            Characters can hold their breath for <Term>6 + PHY AMod
            rounds</Term>. After that, they must make a Physicality check
            each round or suffer <Term>3 WP + 3 RP</Term>. If WP or RP
            reach 0 from drowning, they die unless saved by another
            character.
          </P>
        </RuleSection>
      </RuleSection>
    </>
  )
}
