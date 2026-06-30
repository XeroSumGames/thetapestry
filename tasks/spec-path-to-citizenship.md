# Feature Spec - Path to Citizenship (District Zero onboarding + drop-in campaign)

**Status**: Authoring spec. Approved direction 2026-06-30. Not yet seeded.

**One line**: A GM-run, Western-Marches-style onboarding arc + hook pool seeded into the
existing **District Zero** persistent world, so a table is never dead when a player is
missing - whoever shows up drops in, gets integrated, and picks a self-contained adventure.

---

## 1. Source

`docs/Rules/The District Zero Road to Citizenship Sourcebook v0.1.01.txt` (internal title:
"The Road to Citizenship - Life in District Zero Sourcebook v.1"). 20 pages, 21 scenes.
This is canon source content; mechanics defer to canon precedence
(`lib/xse-schema.ts` + `app/rules/*` > Quickstart > SRD > CRB).

If Xero drops a newer `.docx` revision into `docs/Rules/`, diff it against this before seeding.

---

## 2. Decisions (locked 2026-06-30)

- **Build method (b): seeded official campaign on the existing DZ setting**, modeled on The
  Arena. NOT a /rumors module - the Module System is spec-only / unimplemented
  (`tasks/spec-modules.md:5`). District Zero is a first-class built-in setting
  (`lib/settings.ts` `STORY_SETTING_VALUES`), so it deliberately lives outside the marketplace.
- **Target campaign**: the existing **"District Zero"** story
  `6dd8611b-62ef-4810-b998-b9c5682d0a62` (GM `5806fd27-fcac-4163-b8a8-61476150962c`).
  Path to Citizenship is the structured arc seeded INTO this persistent world, not a new row.
- **Solo (GM-less) play is deferred** - "later" feature. Build for a **GM to run** now
  (group, and single-player + GM). Structure the scene content so a future oracle layer
  (yes/no/random prompts, solo scene-runner) slots in without a rebuild. See Section 8.
- **Pins are being reset by Xero** to fix drift. Seed authoring of scene briefs is gated on
  the corrected pin set (scene briefs reference pin titles). Do NOT re-seed the stale
  `sql/district-zero-seed.sql` pin coordinates.

---

## 3. Current state of the target campaign (verified via live DB, 2026-06-30)

| Table | Count | Status for this build |
|---|---|---|
| `campaign_npcs` | 18 | Cast authored. Gaps: George Meeker, Marty, foe statblocks. |
| `campaign_pins` | 31 | Being reset by Xero. Scenes reference by title. |
| `map_pins` (GM id) | 36 | World-map pins. |
| `tactical_scenes` | 0 | **Author 4 combat maps** (Scenes 10, 13, 14, 20). |
| `campaign_notes` | 0 | **Author 21 scene briefs + ~4 player handouts.** |
| `pregen_library` | 6 | None tagged `district_zero`, none mapped here. **Author drop-in roster.** |
| `pregen_campaign_map` | 0 (for this campaign) | Map the drop-in roster. |

Authored NPCs: Carol Philips, David Battersby, District Deputy (generic), Emma Hernandez,
Father Donalds, Gio Leone, Jemimah Sawyer, Jeremy Barrow, Johnson Walker, Lincoln Sawyer,
Marcy Cunningham, Milo Cantwell, Mitch Kosinski, Morgan Lieu, Nana Welch, Nate Landry,
Tom Orchard, Wesley Spencer.

---

## 4. Data-model mapping (verified table shapes)

| Sourcebook element | Platform table | Notes |
|---|---|---|
| Narrative scene / hook (GM brief) | `campaign_notes` | `shared=false`, `sort_order`=scene #, `title`="PtC NN. <name>". One row per scene. |
| Player-facing handout | `campaign_notes` | `shared=true`. City Rules read-aloud, starting-kit/BB briefing, status-chip explainer, "Arriving at the Mile" intro. |
| Combat scene | `tactical_scenes` (+ `scene_tokens`) | `cell_px=35` (locked), grid sized per map. background_url uploaded by GM. |
| NPC | `campaign_npcs` | Add gaps (Section 6). Foes = `role`/type foe. |
| Location | `campaign_pins` | Already seeded; referenced by title. |
| Pregen (drop-in PC) | `pregen_library` (`setting='district_zero'`) + `pregen_campaign_map` | 4-6 newcomers. |

There is **no generic encounter/hook table** - narrative scenes live in `campaign_notes`.
(`community_encounters` is a Communities feature, unrelated.)

---

## 5. Scene roster (renumbered clean; source numbering is duplicated/messy)

**Arc A - Onboarding ("become a citizen"). Linear-ish tutorial; every drop-in runs it.**

| # | Scene | Pin | Key NPCs | Checks | Tactical? |
|---|---|---|---|---|---|
| 0 | Shining City on the Hill (Session Zero) | (outside) | - | - | no |
| 1 | New Faces in Town (the Gate) | West Gate | George Meeker, District Deputy, Wesley(files) | First Impressions | no |
| 2 | It's Happy Hour Somewhere | Main Street Tavern | Jemimah, George | social | no |
| 3 | Renting a Room (filler/link) | Rose Rooms | Marcy | - | no |
| 4 | Roughing It (filler/link) | Rose Rooms | Marcy | - | no |
| 5 | Becoming One Of You | Chamber of Commerce | Wesley | First Impressions | no |
| 6 | Putting These Hands To Work | Chamber of Commerce | Wesley | Barter / Manipulation | no |
| 7 | Riding the Shit Truck (hazing) | Auto Shop / compost depot | Johnson Walker, Marty, Gio | Physicality | no |
| 8 | Dinner with Nana and the Angels (repeatable backdrop) | The Kitchen | Nana, Johnson, Marty | social | no |
| 9 | Down on the Farm | The Farm | David Battersby | Athletics / Mechanics / Tinkerer | no |

**Arc B - Hook pool. Self-contained, non-linear, replayable. The Western Marches core.**

| # | Scene | Pin | Key NPCs | Checks | Tactical? |
|---|---|---|---|---|---|
| 10 | Dinner and a Show (faction tension reveal) | The Kitchen | Lincoln, Mitch, Milo | Manipulation | no |
| 11 | Scavenger Run (M&M Machining, Morris OK) | Auto Shop -> road | Nate Landry, Johnson | Group Physicality -3, Scavenging, Mechanic/Tinkerer | **YES** |
| 12 | Sulphur (Vinita Mines) + parasite plot seed | Auto Shop -> mines | Gio, Johnson, (Marty sick), Morgan | Scavenging, Medicine | optional |
| 13 | Echoes of the Past (the Vault tunnel) | The Vault | Nate Landry, Wesley | exploration, radiation risk | no |
| 14 | Loose Threads (bike repair / resource allocation) | The Bike Shop | Johnson, Nate, Emma | Mechanics | no |
| 15 | Into the Wild (watchtower shift, spot ambush) | Watchtowers | George Meeker, Deputies, Lincoln | Perception | **YES** |
| 16 | Market Mayhem (trade-dispute brawl) | Farmer's Market | Tom Orchard, Jemimah, traders | Manipulation / Unarmed | **YES** |
| 17 | First Church of the District (mediate factions) | First Church | Father Donalds, Milo, Lincoln | Manipulation | no |
| 18 | Fuel for the Fire (secure ethanol fuel) | The Refinery | David Battersby, scavengers | varies | no |
| 19 | Seeds of Discord (college sabotage) | The College | David, Wesley, Carol Philips, farmers | Investigation | no |
| 20 | Night Watch (strangers seek refuge - trust call) | Entrances & Watchtowers | George Meeker, Wesley, Lincoln, newcomers | First Impressions | optional |
| 21 | Medical Crisis (outbreak - ties to Scene 12) | The Clinic | Morgan, Nana, Wesley | Medicine | no |
| 22 | Supply Run Gone Wrong (missing crew rescue) | Auto Shop -> field | Johnson, Nate, scavenger crews | Scavenging, combat | **YES** |

(23 scene rows total counting the two filler dupes; collapse 3+4 if Xero prefers one
"Lodging" filler. The parasite thread links Scene 7 -> 12 -> 21 as a slow-burn arc.)

---

## 6. NPC gaps to author

- **George Meeker** - 42, lifelong local, off-shift deputy who escorts newcomers (Scenes 1,
  15, 20). Friendly, circumspect. Author full statblock.
- **Marty** - newcomer in the work detail; contracts a parasitic infection from the humanure
  haul (Scene 7), which seeds the outbreak (Scenes 12, 21). Minor statblock + plot flag.
- **Foe statblocks** for tactical scenes:
  - Desperate Survivors x3 (Scene 11 ambush) - want the truck.
  - Territorial Raiders x5 (Scene 11 confrontation) - 1 shotgun, 1 pistol, rest melee.
  - Generic raider/scavenger foes for Scenes 15, 16, 22 (reuse a small foe set).

---

## 7. Drop-in / Western Marches structure

The persistent-world spine that makes "show up whenever" work:

- **BB economy**: currency = Bullets + Batteries ("beebee"). New arrivals start 5d6 bullets +
  5d6 batteries (10-30 BB), primary + secondary weapon, Survival Kit, 3 days Rations.
  Weapons are confiscated at the gate (1 BB lockbox fee, chit to reclaim).
- **Status chips**: Red (daily) / Blue (extended stay) / Green (resident). Drives access.
- **Work-roster loop**: register at the Chamber of Commerce, 5 BB/day + a meal, credit
  redeemable at the Vault / Tavern / Rose Rooms. This is the repeatable daily heartbeat.
- **Non-linear hook pool (Arc B)**: any subset of present players grabs one self-contained
  scene per session. No fixed party. Missing players = their PCs are "on another work crew."
- **Filler/backdrop scenes** (3/4 Lodging, 8 Dinner): connective tissue, repeatable, used to
  open/close sessions and let latecomers slot in.

Each `campaign_notes` scene brief includes a **"Drop-in scaling"** line: how to run it for
1, 2, or a full table (adjust foe counts, check difficulty, NPC support).

---

## 8. Solo (GM-less) - deferred, but design forward

Not built now. To keep the door open without a future rebuild, author every Arc B scene brief
with a consistent internal structure the future solo-runner can parse:
**Setup -> Trigger -> 2-4 branch outcomes (success / partial / failure) -> consequences/links.**
The oracle layer (yes/no + random-event tables + a guided scene-runner UI) becomes a separate
spec when Xero greenlights it. Tag deferred work in `tasks/todo.md`.

---

## 9. Seed plan

Single idempotent file: `sql/path-to-citizenship-seed.sql`, targeting campaign
`6dd8611b-62ef-4810-b998-b9c5682d0a62`. Sections:

1. NPC gaps -> `campaign_npcs` (George Meeker, Marty, foes). Upsert by (campaign_id, name).
2. Scene briefs -> `campaign_notes` (`shared=false`, sort_order = scene #).
3. Player handouts -> `campaign_notes` (`shared=true`).
4. Tactical maps -> `tactical_scenes` (4 maps, `cell_px=35`, background_url left NULL for GM
   upload) + foe `scene_tokens` where placement is known.
5. Drop-in pregens -> `pregen_library` (`setting='district_zero'`) + `pregen_campaign_map`.

**Idempotency caveat**: `campaign_notes` has no natural unique key. Either add a
`(campaign_id, title)` unique index (Puffer - schema change) or seed with a deterministic
delete-then-insert scoped to the "PtC NN." title prefix. Decide with Puffer before applying.

**Application**: per `feedback_i_apply_live_sql`, confirm intent with Xero, then run
`npx supabase db query --linked -f sql/path-to-citizenship-seed.sql` myself and verify.

**Gate**: do not write/apply the seed until Xero confirms the pin reset is done, then re-read
the corrected `campaign_pins` titles so scene briefs reference them exactly.

---

## 10. Lane ownership

- **Hunt & Peck** (this work): scene briefs, NPC gaps, handouts, pregen roster, the seed file.
- **Puffer Fish**: the `campaign_notes` unique-index question (if we go that route); any RLS.
- **E2E**: coverage later, if/when the arc gets app surfaces beyond the GM table.

---

## 11. Open items / dependencies

1. [x] Pin reset DONE (2026-06-30). 35 pins, 3 folders (Gates 4 / Watchtowers 12 /
   Town Buildings 19). Locations captured in `sql/district-zero-pins-capture-2026-06-30.sql`.
   Scene briefs reference these names. Naming RESOLVED by Xero: "Watchtower 12"
   (typo fixed), and two distinct locations - "The Bike Clinic" (bike repair) +
   "Dr Zee's Clinic" (medical, renamed from "The Clinic"; Scene 21 Medical Crisis
   uses this pin). Open content point for Part 2: is "Dr Zee" a new NPC running the
   clinic, or does Morgan Lieu still run it under the new name?
   RESOLVED (Xero): Dr Zee was the Mile's original doctor; he died, and Morgan Lieu
   (existing vet-tech NPC) took over. The clinic keeps his name because Morgan is
   still too new for it to be renamed after her. NO new NPC - Morgan is the clinic
   NPC; "Dr Zee" is backstory only. Use this texture in Scene 21 + the clinic pin
   description (offer to enrich the live pin notes when authoring that scene).
2. [ ] Confirm filler scenes 3+4 collapse to one "Lodging" or stay separate. (Author's call.)
3. [x] DONE + LIVE 2026-06-30. Authored 6 District Zero newcomer pregens (Rae Okafor,
   Boone Tucker, Imani Reyes, Hank Delgado, Lonnie Pace, Dot Mwangi),
   `sql/path-to-citizenship-pregens.sql`, tagged `district_zero` + mapped to the campaign.
   Canon-correct (5 attr pts, 15 skill pts, derived secondaries). Parts 1 (NPCs+handouts)
   and 2 (pregens) BOTH APPLIED to live + verified (campaign_npcs 18 -> 22, 6 pregens mapped).
4. [x] Idempotency RESOLVED - seed uses `INSERT ... SELECT ... WHERE NOT EXISTS`
   guards keyed on (campaign_id, name|title). Non-destructive, re-runnable, no
   schema change / no Puffer index needed. Part 1 (`sql/path-to-citizenship-seed.sql`:
   2 NPC gaps + 2 foe statblocks + 2 player handouts) authored + dry-run verified
   (rolled back) 2026-06-30. Not yet applied to live.
5. [ ] Tactical map backgrounds - GM uploads art per map post-seed.
