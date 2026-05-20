# Rules Extract - Infection

Source-of-record extraction for the Infection subsystem. Pulled
from `docs/Rules/Distemper CRB v0.9.2.pdf` p.114 (and adjacent
pages for the related Sickness & Disease branch). The XSE SRD
v1.1.17 does **not** cover Infection - CRB is canon for this
subsystem until / unless an SRD pass replaces it.

**Status:** All design questions answered by Xero on 2026-05-09.
Decisions are folded into the "Distilled mechanics" section
below and pinned in `memory/project_infection_canon.md`. This
doc is the source-of-truth spec for the platform implementation.

---

## Two related but distinct mechanics

The CRB describes two separate damage-over-time tracks, and they
need to be modeled separately on the platform:

| | Trigger | Severity |
|---|---|---|
| **Wound Infection** (CRB p.114) | Took a shot / stab / cut during combat. | Sick 1d3-1d6 days; possible Lasting Damage. |
| **Sickness & Disease** (CRB p.115) | Exposed to toxic conditions (pit of corpses, contaminated water, etc.) | Progressively unwell for 1d6 days → Mortally Wounded → possible Lasting Damage. |

The user's flag was "Infection rules coverage audit" - so this
extract covers BOTH branches even though only Wound Infection is
named "Infection" in the CRB. They share so much machinery
(Physicality checks, day-by-day progression, Lasting Damage tie-in)
that one schema can serve both.

---

## Source quotes (CRB p.114)

> **Infection**
>
> If a character was shot, stabbed, or cut during combat then
> there is a chance that their wounds might become infected. Once
> combat is done, characters who suffered that kind of damage
> must make a Physicality check to see if their wound becomes
> Infected.
>
> On a Failure, the character will become sick for **1d3 days**
> and need to be able to rest and recuperate somewhere relatively
> warm and dry or make another Physicality check to avoid
> suffering Lasting Damage (see below).
>
> On a Dire Failure, the character is sick for **1d6 days** and
> automatically suffers Lasting Damage.

## Source quotes (CRB p.115 - Sickness and Disease)

> In the wake of the Dog Flu, disease and pestilence remain rife.
> Although a year on, most of the dead bodies liquified, the
> germs and danger remain prevalent. Characters who are exposed
> to particularly toxic conditions, such as being thrown into a
> pit of dead bodies, may need to make a Physicality check to
> avoid getting a disease.
>
> If they do become sick or infected, they must make a successful
> Physicality check to avoid becoming progressively unwell for
> **1d6 days**, at which point they become **Mortally Wounded**.
> If this happens, they will need to make a successful Physicality
> check or suffer Lasting Damage because of their sickness.

---

## Distilled mechanics

### Wound Infection - combat aftermath

1. **Trigger**: combat ends; character took at least one wound
   that broke skin (shot / stab / cut). GM judges from the round's
   damage log.
2. **Check**: **one Physicality check per character per combat**
   regardless of how many hits they took (locked).
3. **Outcomes:**
   - **High Insight (6+6)** → Wild Success outcome + 1 Insight Die.
   - **Wild Success (14+)** → no infection.
   - **Success (9-13)** → no infection.
   - **Failure (4-8)** → sick **1d3 days**. Active care or rest in
     warm + dry shelter prevents Lasting Damage; otherwise final
     Physicality check at the end of the sick period to avoid
     Lasting Damage.
   - **Dire Failure (0-3)** → sick **1d6 days**, automatic Lasting
     Damage on Day 0.
   - **Low Insight (1+1)** → Dire Failure outcome + 1 Insight Die.

### Sickness & Disease - environmental

1. **Trigger**: GM-arbitrated exposure to toxic conditions (corpse
   pit, sewer wade, contaminated water, etc.).
2. **First Check**: Physicality check to avoid getting sick at
   all.
3. **If sick**: second Physicality check to avoid progressing.
   - **Success / Wild Success / High Insight** → shake it off
     (no progression).
   - **Failure** → progressively unwell for **1d3 days** → on
     final day, become **Mortally Wounded** (WP=0 + 4 + PHY AMod
     death countdown). Note: shorter than CRB's 1d6 - Xero's call
     2026-05-09 to flip the timeline so Dire Failure is the longer
     slide, matching player intuition.
   - **Dire Failure / Low Insight** → progressively unwell for
     **1d6 days** → on final day, Mortally Wounded.
4. **If Mortally Wounded**: third Physicality check to avoid
   Lasting Damage (parallel to combat mortal-wound flow).

### "Sick" gameplay state - what it costs

While `infection_state IS NOT NULL` and `infection_days_left > 0`:

- **-2 CMod** on physical checks: Athletics, Melee Combat,
  Ranged Combat, Stealth, Survival, Unarmed Combat.
- **RP capped at half-max** (floor): if their RP max is 8, they
  can't be above 4 RP for the duration. If they're already
  above the cap when they get sick, current RP gets clamped down.
- WP regen still works at the standard 1/day. RP regen still
  works at the standard 1/round-out-of-combat - but the
  half-max cap is the ceiling.

When days_left ticks to 0, all sick-state penalties clear (RP
cap lifts; CMod restored). Lasting Damage may still apply
depending on `infection_lasting_risk`.

### Treatment - Medicine\* check

An ally with Medicine\* can attempt a single treatment per sick
incident (not per day). One check, period. Outcomes:

| Roll | Effect |
|---|---|
| **Wild Success** | Cuts remaining `infection_days_left` in half (round up). Clears `infection_lasting_risk`. |
| **Success** | Clears `infection_lasting_risk`. Days unchanged. |
| **Failure** | No help, no harm. (`infection_treated_at` is set so they can't try again.) |
| **Dire Failure** | +1 to `infection_days_left` (botched care). |
| **High Insight (6+6)** | Wild Success outcome + 1 IDie. |
| **Low Insight (1+1)** | Dire Failure outcome + 1 IDie + medic earns 1 Stress pip. |

**Note:** the Medicine\* attempt is GM-triggered from the medic's
character sheet, not from the patient's. Targets the patient via
the standard target picker. RLS pattern same as Stabilize.

### Shared shape

Both mechanics resolve over **days**, not rounds. Both check
Physicality. Both terminate (on bad outcomes) at Lasting Damage -
which is already in the platform as `LASTING_WOUNDS` Table 12 in
`lib/xse-schema.ts:572`.

---

## Design decisions (locked 2026-05-09 by Xero)

| # | Question | Decision |
|---|---|---|
| 1 | Wound Infection roll cadence | One Physicality check per character per combat. |
| 2 | Insight outcomes on Infection check | Standard XSE mapping. Low Insight = Dire Failure outcome, High Insight = Wild Success outcome. Insight Die awarded as standard. |
| 3 | Dire Failure on Sickness & Disease "progressively unwell" check | Failure = 1d3 days, Dire Failure = 1d6 days. Dire is the longer slide to mortal wound. |
| 4 | "Sick" gameplay state | -2 CMod on physical checks (Athletics / Melee Combat / Ranged Combat / Stealth / Survival / Unarmed Combat) + RP capped at half-max (floor) for duration. |
| 5 | Healing pathway | Optional Medicine\* check, one per sick incident. Wild Success halves remaining days + clears Lasting risk. Success clears Lasting risk only. Dire Failure +1 day. |
| 6 | Auto-fire vs. manual | GM-driven button on the character/NPC sheet. No auto-prompt at combat end. Revisit if noisy. |

---

## Schema (locked 2026-05-09)

Five new columns on **both** `character_states` and `campaign_npcs`:

```sql
infection_state          text NULL,         -- NULL | 'wound' | 'sickness'
infection_days_left      smallint NULL,     -- counts down per GM "Tick Day" click
infection_lasting_risk   boolean NOT NULL DEFAULT false,
                         -- true if a Failure was rolled and Medicine* hasn't cleared it
infection_started_at     timestamptz NULL,  -- when the GM rolled the infection
infection_infected_by    text NULL,         -- attacker name / source description (free text)
```

Day-tick is **GM-driven** (matches existing Subsistence Damage
pattern - GM clicks "Tick Day" / "Advance Day" and the counter
decrements). No automated wallclock until the parked Campaign
Calendar work lands.

When `infection_days_left` ticks to 0:
- If `infection_lasting_risk` is true, fire the Lasting Damage
  roll (Physicality check; failure rolls on `LASTING_WOUNDS`
  Table 12).
- Clear all infection columns (set state back to NULL).
- For Sickness & Disease branch on Day 0: also drop the
  character into the existing Mortally Wounded flow (set
  `wp_current = 0`, `death_countdown = 4 + PHY AMod`). The
  existing Stabilize machinery handles it from there.

`infection_infected_by` is free text so the GM can write
anything: "Frankie's Sword", "Corpse pit at the Gibblets
warehouse", "Dog flu mutation Q-7". Useful for narrative / pin
backreferences later.

---

## Where rules-page goes

Slot under §06 Combat as a sub-section (matching the
Incapacitation / Stress structure):

- New page: `app/rules/combat/infection/page.tsx`
- Route: `/rules/combat/infection`
- Sub-nav anchor in `lib/rules/sections.ts` under the `combat`
  section, after `stress`.

Page content: condensed CRB extracts above + clarification of the
two branches + reference link out to Lasting Wounds (Table 12).

---

## Reference: existing related rules already on the platform

- **Lasting Wounds Table 12** - `lib/xse-schema.ts:572` (data) +
  `/rules/combat/incapacitation#lasting-wounds` (rendered).
  Both Infection branches' bad outcomes converge here.
- **Mortal Wound + Stabilise flow** - `lib/damage.ts` +
  `app/stories/[id]/table/page.tsx:5066-5104`. The Sickness &
  Disease "becomes Mortally Wounded" outcome should drop the
  character into the existing flow, not invent a parallel one.
- **Subsistence Damage** - `/rules/combat/damage#subsistence` +
  `components/CharacterCard.tsx:899` Env. Damage prompt.
  Day-counter pattern is the closest precedent for Infection's
  day-by-day tick.

---

## Recommended next steps

After Xero answers Open Qs 1-6:

- **Step 2**: write `app/rules/combat/infection/page.tsx`,
  add `{ id: 'infection', label: 'Infection' }` to `sections.ts`
  combat anchors, and link from
  `/rules/combat/damage#subsistence` ("see also").
- **Step 3**: ship one SQL migration adding `infection_state` +
  `infection_days_left` (or whatever shape Xero confirms) to
  `character_states` + `campaign_npcs`. Then a GM button on
  `CharacterCard.tsx` + `NpcCard.tsx` to roll Infection. Hook
  into the Stabilize/Mortally Wounded flow when Sickness &
  Disease's countdown expires.
