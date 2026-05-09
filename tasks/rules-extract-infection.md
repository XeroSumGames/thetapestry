# Rules Extract — Infection

Source-of-record extraction for the Infection subsystem. Pulled
from `docs/Rules/Distemper CRB v0.9.2.pdf` p.114 (and adjacent
pages for the related Sickness & Disease branch). The XSE SRD
v1.1.17 does **not** cover Infection — CRB is canon for this
subsystem until / unless an SRD pass replaces it.

---

## Two related but distinct mechanics

The CRB describes two separate damage-over-time tracks, and they
need to be modeled separately on the platform:

| | Trigger | Severity |
|---|---|---|
| **Wound Infection** (CRB p.114) | Took a shot / stab / cut during combat. | Sick 1d3-1d6 days; possible Lasting Damage. |
| **Sickness & Disease** (CRB p.115) | Exposed to toxic conditions (pit of corpses, contaminated water, etc.) | Progressively unwell for 1d6 days → Mortally Wounded → possible Lasting Damage. |

The user's flag was "Infection rules coverage audit" — so this
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

## Source quotes (CRB p.115 — Sickness and Disease)

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

### Wound Infection — combat aftermath

1. **Trigger**: combat ends; character took at least one wound
   that broke skin (shot / stab / cut). GM judges from the round's
   damage log.
2. **Check**: Physicality check (per attacker hit, or once per
   character per combat? — see Open Q1 below).
3. **Outcomes:**
   - **Wild Success / Success**: no infection.
   - **Failure**: sick **1d3 days**. Resting in warm + dry shelter
     prevents Lasting Damage; otherwise Physicality check at the
     end of the sick period to avoid Lasting Damage.
   - **Dire Failure**: sick **1d6 days**, automatic Lasting Damage.
   - **Moments of Insight (1+1 / 6+6)**: not specified by CRB —
     see Open Q2.

### Sickness & Disease — environmental

1. **Trigger**: GM-arbitrated exposure to toxic conditions (corpse
   pit, sewer wade, contaminated water, etc.).
2. **First Check**: Physicality check to avoid getting sick at
   all.
3. **If sick**: second Physicality check to avoid progressing.
   - **Success**: shake it off (no progression).
   - **Failure**: progressively unwell for **1d6 days** → at end
     of period, become **Mortally Wounded** (WP=0 + 4 + PHY AMod
     death countdown).
   - **Dire Failure**: not specified — see Open Q3.
4. **If Mortally Wounded**: third Physicality check to avoid
   Lasting Damage (parallel to combat mortal-wound flow).

### Shared shape

Both mechanics resolve over **days**, not rounds. Both check
Physicality. Both terminate (on bad outcomes) at Lasting Damage —
which is already in the platform as `LASTING_WOUNDS` Table 12 in
`lib/xse-schema.ts:572`.

---

## Open questions for Xero

1. **Wound Infection roll cadence**: one Physicality check per
   character per combat (regardless of how many hits they took)?
   Or one check per discrete wound? CRB ambiguous; one-per-combat
   is simpler and aligns with the implicit "single state flag"
   model. Recommend one-per-combat.

2. **Insight outcomes on Infection**: CRB doesn't spell out 1+1
   (Low Insight) or 6+6 (High Insight) for the Infection check.
   Defaults from the platform's existing checks:
   - Low Insight: treat as Dire Failure (sick 1d6 + auto Lasting
     Damage). Burns 1 Insight Die earned.
   - High Insight: treat as Wild Success (no infection). +1 IDie
     earned.

3. **Dire Failure on the "progressively unwell" check** (Sickness
   & Disease branch): CRB caps at "Failure → 1d6 days → Mortally
   Wounded". Recommend Dire Failure compresses the timeline:
   1d3 days instead of 1d6 (faster slide to mortal wound).

4. **"Sick" as a state**: while sick, what's the gameplay impact?
   CRB doesn't specify in-day effects. Recommend per-day -1 CMod
   on physical checks (Athletics, Melee Combat, Ranged Combat,
   Stealth, Survival, Unarmed Combat) until cleared. Keeps the
   condition felt without WP/RP damage every day.

5. **Healing pathway**: CRB says "warm + dry rest" prevents Lasting
   Damage on Failure. Does that just mean GM-narrated rest, or
   should there be a Medicine* check to actively treat? Recommend:
   add an optional Medicine* check during the sick period — Wild
   Success cuts duration in half (round up), Success removes the
   Lasting Damage risk on Failure outcomes.

6. **Auto-application vs. manual GM trigger**: should the platform
   auto-fire a "wound check" prompt at combat-end for any PC who
   took ≥1 hit? Or stay GM-driven (button on character sheet)?
   Recommend: GM-driven button initially (matches the existing
   Env. Damage / Stabilize pattern); auto-prompt later if it feels
   noisy.

---

## Schema implications (preview for step 3)

Mirroring the existing `incap_rounds` / `death_countdown` pattern
on `character_states` and `campaign_npcs`. Two columns each,
covering both branches:

```sql
-- New columns on character_states + campaign_npcs:
infection_state    text NULL,       -- NULL | 'wound' | 'sickness'
infection_days_left smallint NULL,  -- ticks down 1 per in-game day
```

Or normalize harder:

```sql
infection_kind    text NULL,         -- NULL | 'wound' | 'sickness' | 'wound+sickness' (rare)
infection_started_at timestamptz,    -- for day-based countdown if game-clock is wallclock
infection_days_left smallint,        -- count-down if game-clock is GM-advanced
infection_will_lasting boolean,      -- true if Failure was rolled and rest-treatment hasn't been done
```

Open Q for the schema: does The Tapestry track game-clock at all?
Subsistence Damage (already shipped) currently asks the GM "how
many days?" via prompt — meaning there's no automated day tick
yet. Cleanest match: same pattern. GM clicks "Advance day" or
"Tick infection" and the column ticks. If/when a wallclock is
added (the parked Campaign Calendar work), upgrade to
`infection_started_at` and derive remaining days.

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

- **Lasting Wounds Table 12** — `lib/xse-schema.ts:572` (data) +
  `/rules/combat/incapacitation#lasting-wounds` (rendered).
  Both Infection branches' bad outcomes converge here.
- **Mortal Wound + Stabilise flow** — `lib/damage.ts` +
  `app/stories/[id]/table/page.tsx:5066-5104`. The Sickness &
  Disease "becomes Mortally Wounded" outcome should drop the
  character into the existing flow, not invent a parallel one.
- **Subsistence Damage** — `/rules/combat/damage#subsistence` +
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
