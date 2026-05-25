# Vehicle maintenance checks - E2E testplan (2026-05-24)

Durable Playwright coverage for the dice-gated **Install Fuel Drum** + **Gather
Materials** skill-checks shipped by Hunt & Peck in `12fbe58` and routed to this
lane (active-lanes "Hunt & Peck" + handoff NEXT).

## What ships
New spec `e2e/vehicle-maintenance-checks.spec.ts` (Ch9-adjacent, vehicle popout).
ONE test, ONE throwaway campaign, BOTH flows, ONE teardown.

## Why these assertions (dice-gated -> structure not values)
Both checks roll 2d6 in-client (`Math.random`), so the OUTCOME can't be forced
headless. Per the lane rule for bucket-C dice flows we assert the **flow + the
structural side-effects**, never the rolled value:
- the right modal opens (title),
- the roller picker renders (install/gather have no fixed seat),
- rolling produces SOME valid XSE outcome + the effect-message badge,
- a `roll_log` row lands tagged `damage_json->>checkKind = install|gather`.
The success-only vehicle deltas (fuel_max +1 / brewing_supplies +1) are NOT
asserted - they only fire on success tiers and would flake ~50% of runs.

## Seed (all via the GM's OWN REST token - RLS backstop, create-only-your-own)
1. Throwaway campaign via the real `/stories/new` form -> `campaignId` (GM owns it).
2. `POST campaign_npcs {campaign_id, name:"<RUN> Wrench"}` - one crew member so
   `openCheck()` doesn't alert "Add a crew member" (crew.length > 0). A null
   wp_current still passes the crew filter (death_countdown is null).
3. `PATCH campaigns {vehicles:[V]}` where V is configured to enable BOTH buttons:
   - Install: `fuel_max:4, fuel_max_base:4, fuel_storage_max:6` (headroom=2) +
     cargo holds one `55-Gallon Drum` (drumsInCargo=1).
   - Gather: `brewing_supplies_max:2, brewing_supplies_current:0` (room to gather).
   - `has_still:true`, `mounted_weapons:[]`, `passenger_seats:[null x6]`, all
     crew slots null, plus every required Vehicle field (size/speed/etc).
4. Navigate `/vehicle?c=<campaignId>&v=<vehicleId>`.

## Steps asserted
INSTALL:
1. vehicle name renders; "+ Install" enabled -> click.
2. modal title "Install Fuel Drum" visible.
3. roller picker ("Who's doing it") + the seeded NPC visible.
4. "Roll Install Fuel Drum" -> click.
5. outcome banner matches /Wild Success|High Insight|Success|Low Insight|Failure|Dire Failure/.
6. effect-message badge visible (always set by applyInstallOutcome).
7. REST poll: a roll_log row with damage_json->>checkKind=install exists.
8. Close.

GATHER (same vehicle, independent fields):
1. "+ Gather Materials" enabled -> click.
2. modal title "Gather Materials".
3. roller picker + NPC.
4. "Roll Gather Materials" -> click.
5. outcome banner matches the XSE-outcome regex.
6. effect-message badge visible.
7. REST poll: roll_log row with damage_json->>checkKind=gather.
8. Close.

## Teardown
`DELETE campaigns?id=eq.<campaignId>` in `finally` (GM token). CASCADE clears
campaign_npcs + roll_log. Nothing touched outside the row this test created.

## How to run (sibling worktree C:/TheTapestry-e2e)
```
# one-time per fresh worktree: creds + sessions (see handoff RUN PREREQ)
npx playwright test e2e/vehicle-maintenance-checks.spec.ts --project=chromium
```
Expect: 1 passed. retries:2 absorb prod 500s / realtime timing; a real
regression fails every attempt. Then a full re-cert (`npm run test:e2e`) to
confirm no cross-file regression before push.

## App testids needed
NONE - every selector is real DOM text (button labels, modal titles, outcome
text), consistent with the lane's zero-testid track record.
