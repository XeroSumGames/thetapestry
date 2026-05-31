# Finding - `gm_apply_damage` `p_infection_risk` flag has no app-side bridge yet

**Lane:** E2E (discovered) -> route to Puffer (preferred) or HP (alternative).
**Date:** 2026-05-30. **Severity:** non-blocking - the RPC contract is sound; this is a data-to-UI wiring gap that prevents the end-of-combat infection-modal E2E assertion from being meaningful.

## What's in place (verified GREEN on prod)

- **RPC contract**: `gm_apply_damage` v2 (`sql/gm-apply-damage-rpc-v2-infection-2026-05-30.sql`, commit `4259d67`, applied live + pg_proc-verified). New 5th arg `p_infection_risk boolean DEFAULT false`. When `p_infection_risk=true` AND `target_kind='pc'` AND damage crosses to `wp_current=0`, the inserted `roll_log` row's `damage_json` carries `infection_risk: true` alongside the v1 fields (`via='gm_apply'`, `target_kind`, `target_id`, `wp_before`/`after`, `stress_before`/`after`).
- **E2E lock-in**: [e2e/combat-flow.spec.ts](../e2e/combat-flow.spec.ts) test 3 (`p_infection_risk gates...`, this batch). 4 contract gates asserted in a single throwaway-campaign run: positive (PC mortal-wound), negative non-mortal, negative NPC target, backward-compat (omit arg = v1 byte-identical). Passes 23.9s on prod.

## The gap

**Nothing in the app reads `damage_json.infection_risk`.** Verified by `grep -rnE "infection_risk|damage_json.*infection|infectionRisk" app components lib --include="*.ts" --include="*.tsx"` -- the only hit is `lib/roll-helpers.ts:187`, which reads the unrelated `infection_days` / `infection_severity` env-sickness fields.

The existing "wound infection warning" surface is **the orange `RollsFeed` banner** (`components/RollsFeed.tsx:433-447`, `🩸 Wound Infection Warning`, amber border), gated on `roll_log.outcome === 'wound_infection_warning'`. The trigger is a **separate roll_log insert** via `maybeLogWoundInfection()` (`app/stories/[id]/table/page.tsx:4661`), called from the in-combat attack handler when `weaponCausesWoundInfection(weaponName)` AND `pendingWoundInfectionRef` carries the target.

So today: a GM calling `gm_apply_damage(pc, wp_max, p_infection_risk=true)` writes the `damage_json` flag but produces **no user-visible signal**. The data hook exists; nothing acts on it.

## What this blocks

The brief's Phase C item #4 -- "assert the infection-modal renders on the OWNER's client only". As implemented, the gate would either silently pass (asserting absence of a modal that has no trigger) or never trigger anything to assert against. Per the lesson `2026-05-27 section-c rewrite` (assert what actually DRIVES the UI, not a plausible-looking flag), I held the DOM assertion until the bridge lands.

## Recommended fix

**Option A (preferred -- Puffer, atomic):** extend `gm_apply_damage` so that when the flag fires (`p_infection_risk=true` AND `target_kind='pc'` AND mortal-wound entry), the RPC ALSO inserts a second `roll_log` row with `outcome='wound_infection_warning'` + `character_name=<resolved target_name>` + the existing `label` shape that `maybeLogWoundInfection` uses (`'<name> is wounded and may have to deal with infection'`). One transaction; no client-side wiring; the existing `RollsFeed` banner renders automatically; my E2E can assert the orange banner on the owner's client.

- Pros: atomic with the damage; no client race; one source of truth (the RPC); zero app-code change; works the same whether the damage comes from an in-combat attack or a GM apply.
- Cons: the RPC now does two inserts (small extra cost).

**Option B (alternative -- HP, client-side):** add a client handler that reacts to a `roll_log` insert whose `damage_json.via='gm_apply'` + `damage_json.infection_risk=true` + `target_kind='pc'` by calling `maybeLogWoundInfection(damage_json.target_name)`. Probably hangs off the existing `roll_log` realtime sub in `table/page.tsx`.

- Pros: keeps the RPC narrow.
- Cons: another client-side guard to dedupe (`maybeLogWoundInfection` already has its own dedup but the new path races the existing one); a client that wasn't on the table when the RPC fired wouldn't queue the warning -- subtle.

**Recommendation: Option A.** It mirrors the canon "wound infection check fires on mortal-wound entry" rule at the data-write boundary instead of behind a UI handler, and it keeps the `wound_infection_warning` row as the single source of truth that the RPC, the in-combat attack handler, and any future trigger all converge on.

## On ship

Ping E2E. I extend `combat-flow.spec.ts` with a DOM assertion that, after the RPC fires + the throwaway-campaign teardown waits a beat, the `🩸 Wound Infection Warning` banner is present on marv's `RollsFeed` (owner-context) -- one additive test, ~15 min.

## Cross-references

- RPC: `sql/gm-apply-damage-rpc-v2-infection-2026-05-30.sql` (`4259d67`).
- Combat-flow plan: `tasks/e2e-combat-flow-plan-2026-05-30.md` (Phase C item #4).
- Existing trigger: `app/stories/[id]/table/page.tsx:4661` `maybeLogWoundInfection`.
- Existing banner render: `components/RollsFeed.tsx:433-447`.
- Lock-in lesson: `tasks/lessons.md` "2026-05-27 section-c rewrite -- assert what actually drives the UI".
