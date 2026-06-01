# Canon extract - Rest mechanic (pre-routing prep for HP "Rest finish")

**Author:** Puffer, 2026-05-31.
**Purpose:** Walk the canon precedence stack TOP-DOWN for Rest before HP
picks up the "Rest / heal-over-time finish" item from
`tasks/hp-pickup-mechanics-to-wire-2026-05-31.md`. Names the gaps
between live code and canon so HP doesn't have to re-derive them mid-ship.
**Precedence walked:** Tapestry canon (`app/rules/*` + `lib/xse-schema.ts`
+ `tasks/tapestry-rules-canon.md` snapshot) was the only stack needed -
all four pieces of the Rest mechanic resolve at the top of the stack.
Quickstart / XSE SRD / CRB not consulted because canon was definitive.

## Tapestry canon - what Rest actually is

Rest is the no-check passive recovery mechanic that complements the
Medicine* heal check. Four distinct regen tracks, each with its own
cadence + gate:

### Track 1: Wound Points (incapacitation page)

Source: [`app/rules/combat/incapacitation/page.tsx`](app/rules/combat/incapacitation/page.tsx)
section `#healing`.

- Never-Mortally-Wounded characters: **1 WP per day of rest**.
- Post-Mortally-Wounded characters: **1 WP per 2 days of rest**, until
  fully recovered (back at `wp_max`).
- Lasting Wounds (from the 2d6 Table 12 result) are permanent - they
  do NOT regen via rest.

### Track 2: Resilience Points (incapacitation page)

Source: same page, same section.

- **1 RP per hour** when Resting AND not undertaking any activity.
- "Activity" is GM judgement: carrying loot back to camp = activity;
  napping in the back of the truck = rest. Don't auto-detect; ask.
- During Sickness (the Sick state from `combat/infection`), RP regen
  STILL works at 1/hour BUT the ceiling is **half-max (floor)**, not
  full max, until the sick countdown ticks to 0. Source:
  [`app/rules/combat/infection/page.tsx`](app/rules/combat/infection/page.tsx)
  `#sick-state` line 128.

### Track 3: Stress (stress page)

Source: [`app/rules/combat/stress/page.tsx`](app/rules/combat/stress/page.tsx)
section `#cooling-off` line 126.

> Cooling Off: characters can reduce their Stress Level by 1 by spending
> at least **8 uninterrupted in-game hours** free from combat,
> interpersonal conflict, or environmental threat - while doing
> something they enjoy (fishing, reading, drinking with friends).

Three gates, ALL three must hold:

1. **8+ uninterrupted hours**. Any combat round / threat tick during
   the window resets the clock.
2. **Free from threat**. No active combat, no interpersonal conflict
   (interrogation, faction tension), no environmental damage tick
   (cold, hunger, infection-day-tick if that counts as threat - GM
   judgement; default yes).
3. **Doing something they enjoy**. GM-affirmed activity match (fishing,
   reading, drinking with friends, the character's specific downtime
   beat).

If all three hold for 8h: -1 Stress (minimum 0).
Multiple cooling-off blocks can stack: a 24h continuous rest in a safe
home where the PC is reading their books = 3x -1 Stress = -3 total.

(Parallel path: Psychology* per-level offers an alternative -1 Stress
via Daily Activity Block + Psychology* check. NOT triggered by Rest;
it's its own action. See `tapestry-rules-canon.md:450-454`.)

### Track 4: Pending Medicine* heals (healing page)

Source: [`app/rules/combat/healing/page.tsx`](app/rules/combat/healing/page.tsx).

A queued Medicine* heal applies in two halves: 50% at +12 hours
in-world, 50% at +24 hours. Any time-advance crossing those
checkpoints fires the chunk. **Rest's clock advance must trigger any
queued heals it crosses.** (This is canon for the heal mechanic, not
the rest mechanic per se - Rest's job is to push the clock; the heal
queue's job is to fire on the clock-tick.)

### Permanent-state edges that Rest does NOT clear

For completeness (so HP doesn't accidentally implement these):

- **Lasting Wounds** (Table 12) - permanent. Compound on re-roll.
- **Breaking Point reactions** (Table 13) - permanent stat penalties.
  The reaction itself ends after 1d6 rounds and resets Stress to 0,
  but the table-13 stat penalty persists.
- **Death.** No, you cannot rest off being dead.

## Current implementation state

Single source surface today: the **Rest & Heal modal** in
[`components/CharacterCard.tsx:1191-1273`](components/CharacterCard.tsx).
Button at :665 (`<button onClick={() => setShowRestModal(true)}`).

What it does (per inspection 2026-05-31):

- Three inputs: Hours / Days / Weeks. Coalesces to `totalHours`.
- Computes `wpHeal = wasMortal ? floor(totalDays/2) : floor(totalDays)`
  where `wasMortal = wp_current === 0 || death_countdown != null`.
- Computes `rpHeal = totalHours` (1/hour, no activity gate).
- Writes new WP via `Math.min(wp_max, current + heal)` (clamped to
  max - no half-max sickness check).
- Writes new RP via `Math.min(rp_max, current + heal)` (same - no
  half-max sickness check).
- Calls `advanceClock(campaignId, totalHours)` - which (per the heal
  canon at #healing) SHOULD trigger any +12h/+24h pending-heal
  checkpoints the rest interval crosses. (Verify the clock-tick
  handlers exist before relying on this; if they don't, that's its
  own pickup.)
- Writes a `rest` outcome row to `roll_log` with `damage_json`
  including hours / wpHeal / rpHeal / wasMortal.

## Gaps - what's missing vs canon

### Gap A: Stress Cooling Off (Track 3) is not wired at all

The Rest modal computes WP + RP. It never touches Stress. Per canon,
Rest is the PRIMARY Stress-reduction vector outside the Psychology*
check.

**Fix shape.** Add a Stress block to the Rest modal:

- A "Was this rest uninterrupted and enjoyable?" GM toggle (default
  ON when totalHours >= 8; default OFF when < 8 since canon requires
  8h minimum per pip).
- When ON and totalHours >= 8, compute `stressDrop = floor(totalHours / 8)`
  pips dropped.
- When OFF, stressDrop = 0 regardless of duration.
- Apply `newStress = Math.max(0, currentStress - stressDrop)`.
- The toggle is a GM judgement call: "during these N hours, did anything
  threaten you? was the activity actually enjoyable for your character?"
  No auto-detection of threat ticks (too noisy + GM has narrative context
  the engine doesn't).
- Update the roll_log row to include the stress drop in the `recovered`
  string and in `damage_json`.

### Gap B: Sickness cap on RP regen is not enforced

Per canon, a Sick character's RP regen ceiling is `floor(rp_max / 2)`,
not `rp_max`. The current `Math.min(rp_max, ...)` ignores sickness state.

**Fix shape.** Detect sickness from the character's live state. The
infection countdown lives on... probably `character_states` (verify the
column - search for `sick_until` / `infection_days` / similar). When
the character is currently Sick:

```ts
const rpCap = isSick ? Math.floor(rp_max / 2) : rp_max
const newRP = Math.min(rpCap, rp_current + rpHeal)
```

If `current > rpCap` already (e.g. they got sick after a full-rest day),
the canon says clamp DOWN. That's a separate event from rest; rest
should not raise them ABOVE the cap but also should not lower them
below their pre-rest value if they were already above. Use `Math.min`
both ways:

```ts
const newRP = Math.min(rpCap, Math.max(rp_current, rp_current + rpHeal))
// equivalent to: if already over cap, leave it; else heal up to cap.
```

(Editorial - confirm with Xero whether clamp-down-during-rest is desired
behavior. Default behaviour above preserves whatever they had.)

### Gap C: `wasMortal` detection is wrong for post-mortal recovery

Current detection at line 1216:
`wasMortal = wp_current === 0 || death_countdown != null`.

This catches CURRENT mortal-wound state. But canon says a character who
WAS mortally wounded heals at 1 WP / 2 days **until they're back to
wp_max**. The current code uses the slow rate ONLY while they're at 0
WP - the moment they're stabilised + restored to 1 WP, the next rest
flips them to the fast 1/day rate. That undercuts the canon's intent
(slow recovery is the COST of going mortal; it should persist through
the whole healing cycle).

**Fix shape.** Add a persistent flag on `character_states`:
`recovering_from_mortal_wound boolean` (or a timestamp
`mortally_wounded_at` you can read back). Set true when the character
enters wp_current=0. Stays true through stabilisation + rest. Clears
itself when `wp_current >= wp_max`. The Rest modal reads this flag,
not just current WP.

This is a small schema add (Puffer or HP can write the SQL - happy to
pre-commit a `sql/character-state-mortal-recovery-flag-2026-XX-XX.sql`
if HP confirms the column name). Until shipped, the Rest modal's
behaviour is **wrong for stabilised-but-not-fully-healed patients**
(they regen too fast).

### Gap D: Lasting Wounds / Breaking Point penalties: no need to fix, but verify they don't get touched

Just-in-case audit: confirm the Rest modal doesn't accidentally clear
or buff anything in:

- `character_states.lasting_wounds` (or wherever Table 12 results live)
- `character_states.breaking_point_*` (or wherever Table 13 penalties live)

Current code only writes `wp_current` and `rp_current`, so this is a
non-issue. Note it in the test plan as a negative assertion.

### Gap E (verify, may already work): pending-heal checkpoint firing

Per canon, when Rest's `advanceClock` crosses a +12h or +24h checkpoint
on a queued Medicine* heal, that chunk applies. The modal DOES call
`advanceClock` - so this should work IF the clock-tick infrastructure
has the pending-heal handler wired. Spot-check the clock-advance handler
chain (search `advanceClock` or `tick_pending_heals` or similar) before
HP ships. If the handler doesn't exist, that's a separate pickup, not
part of "Rest finish."

## Recommended scope for "Rest finish" pickup

Ship A + B + C as one HP commit (single feature: rest accurately
heals all four tracks). E is a separate verification pass and may be
already working; HP confirms or routes a follow-up. D is an audit
checkbox.

Per the GM-modal pattern Xero locked on the modal-redesign spec, the
Rest modal SHOULD eventually migrate to the locked `RollModal` shell
(category accent - GM Tools gold, since this is GM-driven recovery).
That's Modal Phase E territory - DO NOT do that as part of Rest finish;
keep it inline in CharacterCard until the modal-redesign wave reaches
it. Modal migration is its own commit.

## Acceptance per gap

### A: Stress Cooling Off

- Rest modal at 8+ hours with GM-toggle ON: stress drops by
  `floor(hours / 8)`, capped at current stress level.
- Toggle OFF or < 8 hours: stress unchanged.
- Roll_log row mentions the stress drop in the recovered string.
- Verify against canon: 24h rest in a safe home doing enjoyable
  activity = -3 stress (3 cooling-off blocks).

### B: Sick RP cap

- Sick character resting 8h: RP regens up to `floor(rp_max / 2)`, not
  `rp_max`.
- Once the sick countdown ticks to 0, the next rest regens up to full
  `rp_max`.
- Pre-rest RP above the half-max cap stays where it is; rest doesn't
  push it down.

### C: Post-mortal slow regen

- Character with `recovering_from_mortal_wound = true` (or
  equivalent) regens 1 WP / 2 days regardless of current wp_current.
- Flag clears automatically when wp_current reaches wp_max.
- Schema change committed in the same HP commit.

### General

- Roll_log row's `damage_json` includes `stressDrop`, `wasSick`,
  `wasRecoveringFromMortal` for transparency.
- Build + 822 unit tests + font/role/em-dash/arch all green.
- Browser eyeball on a Rest at the table page.

## Out of scope (do NOT include in this pickup)

- Modal redesign migration (Phase E territory).
- Auto-rest-on-clock-tick (passive party-wide healing as in-world time
  passes). Would be cool, but it's a different feature - decide
  separately whether the platform auto-applies rest when the clock
  advances vs. requiring an explicit GM "Rest" click. Today's pattern
  is explicit; keep it.
- Activity-Block integration with communities (a PC at a settlement
  doing labour blocks rest activity per canon). That's Communities
  surface, not Rest.
- Long-Rest vs Short-Rest distinction. Canon doesn't use that
  vocabulary - just hours.

## Route to HP

Append to `tasks/todo.md` CURRENT OPEN under the existing mechanics-to-wire
block:

```
- [ ] **[PRE-EXTRACTED CANON for HP pickup 2026-05-31] Rest finish - 3 wired gaps + 1 verify** - canon walked top-down in [tasks/canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md). Gaps A (Stress Cooling Off track entirely missing), B (Sick RP cap not enforced), C (post-mortal slow regen flips off prematurely - needs persistent flag on character_states). Verify E (pending-heal checkpoint fires on Rest's clock advance). Surface: `components/CharacterCard.tsx:1191-1273` Rest & Heal modal. Ship A+B+C as one commit, E as verify pass.
```
