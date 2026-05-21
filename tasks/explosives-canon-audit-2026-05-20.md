# Explosives Canon Audit (2026-05-20)

Closes the "Other explosives audit (QS Table 18)" todo item. The 5 non-Molotov explosives were flagged 2026-05-09 (`tasks/rules-extract-armor-explosives.md` L26/L52/L144) as "not yet verified against canon - existing values left as-is." This audit verifies them.

**Canon sources walked (precedence top-down per CLAUDE.md):**
1. `lib/xse-schema.ts` + `app/rules/*` - no explosives data table in schema; rules pages render from `lib/weapons.ts`.
2. **Distemper Quickstart v1.0.2** - the explosives live in **Table 13: Special & Explosive Weapons** (NOT "Table 18/19" - the extract assumed the older v0.8.530 numbering; v1.0.2 renumbered to Table 13). Image-only table, extracted via PyMuPDF render + vision read 2026-05-20.
3. **Distemper CRB v0.9.2** - full per-weapon detail block at L3192-3303. AGREES with QS v1.0.2 on every shared value. Adds Smoke-Grenade + per-weapon Characteristics that QS's table omits.

**Status:** AUDIT - findings + recommendations below. No code edited in this pass (balance-affecting changes + a locked decision + a naming question all need Xero's ruling). Code fixes ship after Xero approves the batch.

---

## Canon table (QS v1.0.2 Table 13 + CRB v0.9.2, reconciled)

| Weapon | Skill | Range | Rarity | Damage | RP | ENC | Clip | Characteristics |
|---|---|---|---|---|---|---|---|---|
| Grenade | Athletics | Close | Uncommon | 2+2d6 | 100% | 1 | 1 | Tracking; Blast Radius |
| Smoke-Grenade | Athletics | Close | Uncommon | - | - | 1 | 1 | Stunned |
| Flash-Bang Grenade | Athletics | Close | Uncommon | - | - | 1 | 1 | Stunned |
| Mortar | Demolitions* | Distant | Rare | 5+2d6 | 100% | 2 | 1 (Ammo Rare) | Blast Radius |
| Rocket Launcher | Demolitions* | Distant | Rare | 3+3d6 | 100% | 3 | 1 (Ammo Uncommon) | Blast Radius |
| Flame-Thrower | Demolitions* | Close | Rare | 3+2d6 | 100% | 2 | 1 (Ammo Rare) | Burning (3) |
| Molotov Cocktail | Athletics | Close | QS: Uncommon / CRB: Common | 1+1d3 | 100% | 0 | 1 | Tracking; Burning (1) |
| Tranquilizer Gun | Ranged | Medium | Rare | 0 (canon) | 100% (canon) | 1 | 1 | Stun |

CRB clarifications:
- **Throw range (CRB L2542):** "Handheld explosives such as grenades or Molotov cocktails can be thrown as far as Medium range with a Successful Athletics check." So the base Range is Close, but Medium is reachable on a success. This reconciles the code's `Medium` range field with the table's `Close`.
- **Grenade traits (CRB L2671):** "Grenades having both Tracking and Blast Radius" - confirms the code's traits are canon.
- **Grenade damage (CRB L2583):** "A Grenade will do 2+2d6 WP Damage" - confirms 2+2d6, NOT the code's 4+4d3.

---

## Per-weapon findings vs `lib/weapons.ts`

### MATCHES canon (no change)

- **Mortar** (L117): Distant / Rare / 5+2d6 / 100% / enc 2 / ammo Rare / clip 1 / Blast Radius. Exact match.
- **Rocket Launcher** (L126): Distant / Rare / 3+3d6 / 100% / enc 3 / ammo Uncommon / clip 1 / Blast Radius. Exact match.
- **Flash-Bang Grenade** (L119): Close / Uncommon / 0 dmg / 0% RP / enc 1 / clip 1 / Stun. Matches CRB (- damage = 0/0; Stunned = Stun trait).
- **Tranquilizer Gun** (L108): the Xero override (1d3 x 400% RP). Canon is 0 dmg / 100% (useless). Override intentional + documented L102. No change.

### DRIFT - canon correction recommended

1. **Grenade damage** (L116): code `4+4d3` -> canon `2+2d6`. **Both QS + CRB agree.** Unambiguous drift. Balance impact: avg 12 -> avg 9, max 16 -> max 14. Recommend FIX.
   - Range `Medium` vs canon base `Close`: KEEP `Medium` (encodes the CRB throw-to-Medium-on-success mechanic; the platform `range` field = max reachable). No change, but documented here so a future audit doesn't re-flag it.
   - Traits `[Tracking, Blast Radius]`: canon-confirmed. No change.

2. **Flame-Thrower** (L132, in HEAVY_WEAPONS): code `50% RP / clip 30` vs canon `100% RP / clip 1`. The 2026-05-09 extract CLAIMED Flame-Thrower "already matches QS canon" - it does NOT. Both QS v1.0.2 + CRB say 100% RP / clip 1. Recommend FIX RP 50 -> 100. Clip 30 -> 1 is a judgment call (clip 30 is arguably more realistic for a fuel-tank weapon; canon says 1). FLAG clip for Xero.

3. **Molotov** (L125): code `50% RP / enc 2` vs canon `100% RP / enc 0`.
   - RP: the extract LOCKED 50% on 2026-05-09 ("flipping to canon: 1+1d3 Uncommon 50% RP"). But that "canon" was the older Table 19 misread - QS v1.0.2 Table 13 AND CRB both say **100%**. The locked decision was based on stale data. NEEDS XERO RE-RULING: keep the locked 50% (deliberate nerf) or correct to canon 100%?
   - ENC: code `2` vs canon `0`. Recommend FIX to 0 (both sources agree).
   - Rarity: code `Uncommon` (matches QS) - CRB says Common, but QS wins per precedence. No change.

### PROVENANCE / NAMING question

4. **Shiv-Grenade** (L118): Close / Uncommon / 0 dmg / Stun. **NOT in QS Table 13. NOT in the CRB.** No canon source anywhere. The CRB DOES have a **Smoke-Grenade** (Close / Uncommon / - / Stunned) occupying exactly this slot, which the platform is MISSING. Strong hypothesis: "Shiv-Grenade" is a mis-named or homebrew stand-in for the canon Smoke-Grenade. NEEDS XERO RULING:
   - (a) Rename Shiv-Grenade -> Smoke-Grenade (adopt canon), OR
   - (b) Keep Shiv-Grenade as homebrew + ADD Smoke-Grenade alongside, OR
   - (c) Shiv-Grenade is intentional homebrew; leave it, add Smoke-Grenade separately.

### MISSING from platform

5. **Smoke-Grenade** - in CRB canon (Close / Uncommon / - / enc 1 / clip 1 / Stunned), absent from `EXPLOSIVE_WEAPONS`. Add it (pending the Shiv-Grenade naming ruling above).

---

## Recommended fix batch (pending Xero ruling)

Clear (canon agrees, no lock, no naming Q):
- [ ] Grenade damage `4+4d3` -> `2+2d6`.
- [ ] Flame-Thrower RP `50` -> `100`.
- [ ] Molotov ENC `2` -> `0`.

Needs Xero ruling before fix:
- [ ] Molotov RP: keep locked `50` or correct to canon `100`?
- [ ] Flame-Thrower clip: keep `30` (realism) or canon `1`?
- [ ] Shiv-Grenade: rename to Smoke-Grenade / keep + add Smoke-Grenade / leave homebrew?
- [ ] Grenade range: confirmed KEEP `Medium` (throw mechanic) - documented, no action.

Once ruled, the fix is a single `lib/weapons.ts` edit + a note in `rules-extract-armor-explosives.md` correcting the "Flame-Thrower matches" + "Molotov 50%" claims + the Table 18/19 -> Table 13 renumber. The `/rules/appendix-equipment` page renders from `lib/weapons.ts` so it propagates automatically.

---

## Source-of-truth correction for the extract

`tasks/rules-extract-armor-explosives.md` has two now-known-wrong claims:
- L23: "Flame-Thrower already in HEAVY_WEAPONS matching QS canon." -> WRONG: RP 50 vs canon 100, clip 30 vs canon 1.
- L24/L18: Molotov "50% RP" cited as QS Table 19 canon. -> The current QS v1.0.2 Table 13 + CRB both say 100%. The 50% was likely the older v0.8.530 edition or a misread.
- Throughout: "Table 18" / "Table 19" numbering. -> v1.0.2 uses **Table 13** for Special & Explosive Weapons. Update the references when the extract is next touched (puffer-fish lane owns rules-extract docs).
