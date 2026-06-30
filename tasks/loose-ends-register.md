# Loose-Ends / Verification-Debt Register (2026-07-01)

The half-tested + incomplete items, consolidated from todo.md / active-lanes.md /
health-pulse.md so they stop rotting scattered. Grouped by HOW each closes. PF
code-audited Group A 2026-07-01 - findings inline.

---

## GROUP A - owed LIVE verifies (Xero's hands; code is WIRED, not broken)
PF read the code for the three longest-nagged "HOPED-FOR" items - all three are wired
and correct; they need an eyeball/2-client run, NOT a fix. Best closed in ONE focused
2-client session (PF to build a consolidated DO-step script).

- **FI Insight Die award** - WIRED. Award is `page.tsx:9846` (`insightDice + insightDieDelta`,
  +1 on High/Low Insight, -1 on pre-spend); single path, no double-award (does NOT call
  saveRollToLog). NOTE: health-pulse's "useRollResolution:264" pointer is mislabeled - that
  line is the SEPARATE general-roll Moment award. VERIFY: roll a First Impression that lands
  High/Low Insight, confirm the PC's insight pip +1.
- **Stress Check 12-string narratives** (8 paths: HEAL/UNJAM/REPAIR/Gut Instinct/Group/
  DRIVE/BREW/NAVIGATE) - WIRED in `lib/roll-helpers.ts:539-895`, likely already unit-covered
  in the 143 roll-helpers tests. VERIFY: trigger each special check, eyeball the feed line.
- **Vehicle popout Section B** - WIRED (`vehicle_updated` broadcast in `events.ts` +
  `TacticalMap.tsx:784` + page fallbacks). VERIFY: 2-client - change a seat in the popout,
  confirm it propagates to the other client.
- **Disarm-loot** (`tasks/disarm-loot-testplan-2026-06-23.md`) - 2-client: disarm -> ground
  token -> loot -> Ready -> fire.
- **Combat-UI eyeball** - grapple modal / Rest modal / Broken-weapon gate (unit+tsc green,
  never eyeballed on prod).
- **img_scale 2-client canvas** (`tasks/imgscale-divergence-testplan-2026-05-26.md`).
- **Stockpile deposit + pin-add realtime** across 2 windows (publication-fix re-test owed).
- **End-of-combat wound-infection modal** on the wounded PC's owner.

## GROUP B - HP code (genuinely incomplete app work)
- M-3 remove 3s vehicles poll; T2-4 incremental realtime payloads; T2-5 clock batching
- T3-6 jargon tooltips
- Hidden-NPC fog occlusion (feature, not built)
- Native `<select>` picker friction on 3 surfaces (Grant Advantage / Recruit / Add Member)
- Recorder mark prompt: `window.prompt()` -> in-app input
- Encumbrance: halve tactical-map movement for overloaded tokens (not wired)
- CampaignObjects spawn occupancy checks object tokens only
- Grapple canon expansion (defender action loss + Subdue) [~ in progress]
- ~~"6 mechanics" residue~~ - AUDITED 2026-07-01: all 6 (rest-finish, vehicles-as-cover,
  item-condition+upkeep, env-damage trio, travel-times, conditions-p2) are code-complete +
  unit-tested + wired into the app (vehicleCoverRdm -> table-roll-context combat RDM;
  incapRounds -> table page; upkeep -> useRollResolution; env-damage/travel/rest -> CharacterCard).
  NOT owed code; the 05-31 todo was stale. Live-eyeball moves to Group A.
- Stuck-click clusters on canvas (E2E observation -> HP if a cause confirms)

## GROUP C - Xero canon / content call
- Weapons audit: add Revolver + damage-balance pass (`lib/weapons.ts`)
- David Battersby pregen bio (Chased-era text on a pre-Chased scene)

## GROUP D - PF can close now (staging available to de-risk)
- `map_pins` "View pins" dead capital-`'Thriver'` clause - cleanup (test on staging first)
- PC-PC trade - NOT a security hole (audited 2026-07-01: `characters` UPDATE RLS is
  owner/GM/thriver-only, so cross-user writes are correctly blocked; peer trade is just
  non-functional, no exposure). It's a FEATURE-SCOPE call for Xero: build a
  `give_item_to_character` SECURITY DEFINER RPC (PF) + rewire the give-flow (HP) to enable
  peer trade in beta, OR leave it off (zero work). No urgency either way.

## GROUP F - weapon-catalog drift (found 2026-07-01 while adding Revolver) - PF/HP
The canon `lib/xse-schema.ts RANGED_WEAPONS` is a drifted DUPLICATE of the real runtime
source `lib/weapons.ts`. Name fixed (Automatic->Assault Rifle, both catalogs + snapshot,
2026-07-01) but the rest remains:
- canon MISSING 2 live guns: `Bolt-Action / Pump Rifle`, `Tranquilizer Gun` (Xero override)
- canon Taser is STALE: `rpPercent 600` / trait `Stunned` vs locked-canon + runtime `400` / `Stun`
- trait vocab differs between the two arrays (`Stunned` vs `Stun`, `Automatic Burst (3)` vs `{name,value:3}`)
- setting content still says "Automatic Rifle" in 4 spots: `lib/setting-handouts.ts:95`,
  `lib/setting-vehicles.ts:123`, `lib/setting-npcs.ts:899,920` (the 2 NPC ones are bespoke
  stat-blocks 4+2d3, not catalog refs - rename needs a stats decision)
- **also un-diffed:** melee / explosive / heavy categories may have the same drift
**The real fix is architectural:** two hand-maintained weapon catalogs WILL keep drifting.
Decide a single source of truth (runtime `weapons.ts` is the curated/used one; `xse-schema`
should derive from it or be retired as a separate array) - then one full reconciliation pass.

## GROUP E - bugs needing a repro before a fix
- Gus inventory-gun "Equip from Inventory" filter drops non-catalog-named guns
- CMod-on-NPC-target puzzle (the -2/-3 traces; recon done, needs canon + Xero expected values)

---

## Recommendation
Group A is the biggest single win - ONE consolidated 2-client playtest closes ~8 owed
verifies, and PF just confirmed the scary ones are wired (so it's confirmation, not
debugging). PF to build a single pure-DO-step verification script covering Group A.
Group D is PF-drivable now. Groups B/C are HP / Xero. Group E needs repro first.
