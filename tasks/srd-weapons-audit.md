# SRD weapons audit — `lib/weapons.ts` vs Distemper CRB v0.9.2

**Source:** `docs/Rules/Distemper CRB v0.9.2.pdf` — extracted via `pdftotext -layout`. The SRD itself (`XSE SRD v1.1.17 (Small).pdf`) uses a custom font CMap that mangles all multi-letter words to single chars, so it's unreadable as text. The CRB has the same weapon table with cleaner extraction. CLAUDE.md precedence: SRD > CRB; for the names below I'll flag any that could plausibly differ between the two and Xero can confirm against the SRD by eye.

## Headline finding

The current `lib/weapons.ts` contains **four name mismatches** where the stats match a CRB weapon exactly but the label is wrong. The most likely cause: the original author transcribed names from the SRD's mangled extraction and guessed wrong on the abbreviations.

| Code label (current) | Stats | CRB label (canonical) | Confidence |
|---|---|---|---|
| Bayonet / Bowie Knife | 4+1d6, 100%, Engaged, Common, no traits | **Baseball Bat** | High — exact stat match |
| Bat / Stick | 1+1d3, 100%, Close, Uncommon, Unwieldy(2) | **Bullwhip** | High — exact stat match |
| Cleaver | 5+1d6, 100%, Engaged, Common, Cumbersome(1) | **Club** | High — exact stat match (and "Club is missing" is exactly your reported gap) |
| Makeshift Cleaver | 3+1d3, 100%, Engaged, Common, no traits | **Makeshift Club** | High — exact stat match |
| Compact Bow | 4+2d3, 50%, Medium, Common, clip 1, Tracking | **Compound Bow** | Medium — same stats but CRB has it at Long range, Uncommon rarity, enc 2 |

## Stat discrepancies (independent of naming)

| Weapon | Field | Code | CRB |
|---|---|---|---|
| Machete | range | Close | **Engaged** |
| ~~Slingshot~~ | ~~clip~~ | ~~1~~ | ~~30~~ (Xero confirmed 2026-04-28: clip 1 is correct in the engine — slingshot doesn't trigger the Reload-action gate even though CRB shows 30 stones, so leaving as-is) |
| Compound Bow (formerly Compact Bow) | range | Medium | **Long** |
| Compound Bow | rarity | Common | **Uncommon** |

## Missing from `lib/weapons.ts` entirely

| Weapon | Category | Stats |
|---|---|---|
| Black Powder Rifle | ranged | Long, Uncommon, 5+1d6, 50%, enc 2, Uncommon ammo, clip 1, no traits |
| Mortar | ranged/explosive (CRB lists under ranged near grenades) | needs full readthrough — flagged |
| Tranquilizer Gun | special | needs full readthrough — flagged |

## In code, NOT in CRB

These appear to be code-side custom additions:

| Weapon | Likely source |
|---|---|
| Katana | Custom add (Melee, Engaged, Rare, 4+3d3, 50%, 1, Unwieldy 1). Note: trait string is `'Unwieldy 1'` without parens — should be `'Unwieldy (1)'` to match the parser at `getTraitValue`. Real bug. |
| Cattle Prod | Custom add (Melee, Engaged, Uncommon, 2, **400%**, 1, Stun). Xero confirmed 2026-04-28: 400% is correct — "get hit once or twice with that and you're out". Keeping. |
| Shiv-Grenade | Custom add (Explosive, 0 dmg, 0% RP, Stun) — a homemade flashbang? |
| Flash-Bang Grenade | Custom add — duplicates Shiv-Grenade behavior |
| ~~RPG Launcher~~ | Renamed 2026-04-29 → **Rocket Launcher** (CRB canonical name). Stat changes applied per CRB: range Long → Distant, enc 2 → 3, ammo (none) → Uncommon. DB migration `sql/weapons-rocket-flame-rename.sql`. |
| ~~Flamethrower~~ | Renamed 2026-04-29 → **Flame-Thrower** (CRB hyphenated form). Xero kept code values for rpPercent (50%, vs CRB 100%) and clip (30, vs CRB 1) — gameplay tradeoffs. ammo added: Rare. Same DB migration above. |

## Recommended path forward (decision needed from Xero)

**Option A — Rename + add missing, fix stat bugs** (recommended)
1. Rename the 4 high-confidence mismatches in `lib/weapons.ts` (Bayonet→Baseball Bat, Bat/Stick→Bullwhip, Cleaver→Club, Makeshift Cleaver→Makeshift Club).
2. Rename Compact Bow → Compound Bow + fix range/rarity/enc.
3. Fix Machete range Close→Engaged.
4. Fix Slingshot clip 1→30.
5. Fix Katana trait string `Unwieldy 1` → `Unwieldy (1)` (parser bug).
6. Add Black Powder Rifle. Defer Mortar / Tranquilizer Gun until I confirm their full stats.
7. **Migration risk:** characters in the DB store weapon names as strings (`character.data.equipment[].name`, `character_weapons.weapon_name`). Renaming will orphan old picks. Need a one-time UPDATE: `UPDATE characters SET data = jsonb_set(...) WHERE data ->> 'weaponName' IN ('Cleaver', 'Bat / Stick', ...)`. I can write the SQL.

**Option B — Add Club as a NEW entry, leave Cleaver alone**
Treat Cleaver/Bat/Stick/Bayonet as code-canonical and ship Club as a separate weapon. Keeps existing characters working. But code now has duplicates of the same stats with different names — confusing for new picks.

**Option C — Defer the audit, just add Club and Black Powder Rifle**
Smallest possible patch. Doesn't address the rename / stat bugs. Quick win, but you'll see the same audit again on the next pass.

## Open question

Does the SRD precedence matter here? Per CLAUDE.md, SRD > CRB. The SRD's mangled extraction shows entries that letter-pattern-match `Baseball Bat` / `Bullwhip` / `Club` / `Makeshift Club` (B B / B / C / M C in the broken extraction). My read is that the SRD agrees with the CRB on these names. **Xero, can you eyeball the SRD's Table 16 and confirm?** That settles whether to rename in code or rename in the SRD.
