# HP smoketest - 2026-05-31

Cumulative smoketest covering every HP commit shipped today against Puffer's
6-mechanics pickup ([tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md)).
Run cold: hard-refresh both browsers onto prod first.

## Items in this smoketest

| # | Item | Commit | Status |
|---|---|---|---|
| 1 | REST FINISH | `2ea7aaf` | shipped |
| 2 | VEHICLES-AS-COVER | (next push) | shipped |

---

## #1 - Rest button advances clock + writes feed row

**Setup:** GM + player both in a campaign session. GM opens any PC card (Cree
works; the character should ideally have less than max RP so you can see the
heal land).

**Run:**
1. GM clicks **Rest** on the PC card.
2. Enter `8` in the Hours field.
3. Confirm preview shows `WP healed: +0` and `RP recovered: +8` (assuming
   character was never mortally wounded; if was-MW, WP heals at 1 per 2 days).
4. Click **Apply Healing**.

**PASS criteria:**
- Character's RP bar jumps up by 8 (or to max).
- Roll feed on BOTH GM + player shows:
  - System row "Time advances 8 hours" (from clock advance).
  - Character row "Cree rested 8 hours (+8 RP, +0 WP)".
- Campaign clock display (campaign sheet) advances 8 hours.
- If any character has a pending Medicine\* heal queued that crosses the +12h
  or +24h boundary, the heal applies on the same tick (per existing drainer).

**FAIL clues:**
- RP bar updates but no clock advance -> import path on `advanceClock` broke.
- RP bar updates but no roll_log row -> `insertRollLog` failed; check console
  for `[rest] clock advance / log insert failed`.
- Player tab doesn't see the new rows -> realtime sync issue (NOT a rest
  fix; check `tactical_shared` / scene state).

**Known edge:**
- One PC's Rest advances the WHOLE campaign clock. If the party rests
  together, only ONE PC should click Rest to avoid double-counting.
- If multiple click in succession, manually rewind the clock via
  `npx supabase db query --linked "UPDATE campaigns SET clock = jsonb_build_object('canon_day', X, 'hour', Y) WHERE id = '<campaign>'"`.

---

## #2 - Vehicle-as-cover RDM bonus on ranged attacks

**Setup:**
- An active campaign with at least one vehicle in the roster (any of the
  pre-built ones is fine - e.g. Mongrels' truck).
- A tactical scene with the vehicle PLACED as an object token. The vehicle
  token should have its multi-cell footprint set (e.g. a Truck is typically
  `grid_w=4, grid_h=2`).
- A PC sitting ON the vehicle's footprint (any cell the truck occupies).
- An attacker (PC or NPC) elsewhere on the map with a RANGED weapon equipped.
- Combat active (Start Session + Start Combat).

**Run:**
1. Attacker's turn. Open the attack modal and pick the on-truck PC as target.
2. Look at the CMod breakdown chip on the modal.

**PASS criteria:**
- Breakdown shows a `Vehicle cover RDM (<vehicleName>, size N)` line with
  a NEGATIVE value (the bonus subtracts from the attacker's to-hit).
- For Size 3 truck: line value = `-1`. Size 4: `-2`. Size 5: `-3`. Size 6: `-4`.
- The CMod net total reflects the subtraction (compare a swap to a target
  NOT on the footprint - that line disappears).
- A MELEE attack against the same on-truck target should NOT show the
  vehicle-cover line (ranged-only per canon).
- If the PC steps OFF the footprint (next turn), the cover line disappears.

**FAIL clues:**
- Line doesn't appear at all -> check the `vehicles` array is being passed
  through `cmodCtx()` (page.tsx ~line 4400); check the PC token's
  `grid_x`/`grid_y` are reaching `mapTokens` (TacticalMap.tsx
  `onTokensUpdate` projection includes `grid_w`/`grid_h`).
- Line appears with `+N` instead of `-N` -> the sign got flipped in
  `computeAttackCmod`; the value should be `-cover.bonus` (cover lowers
  attacker's to-hit).
- Line appears on melee attacks -> the `isMelee` guard regressed in
  `computeAttackCmod`.
- Smaller vehicles still grant cover -> the size threshold check
  (`size < 3`) in `vehicleCoverRdm` regressed.

**Known edge / deferred to follow-up:**
- "Behind the vehicle relative to the attacker" (line-of-attack passes
  through the footprint) is NOT in this ship - footprint-only. The spec
  flags `behind` as needing canon LOS semantics consultation. Add a
  follow-up E2E + helper case when canon is locked.
- Vehicle damage state / wreckage doesn't currently degrade the cover
  bonus. A canon-aligned wreck rule could degrade by stress level.
