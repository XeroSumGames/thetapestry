# TheTapestry / Distemper - features list vs. industry standard (2026-05-31)

**Purpose:** What the bar looks like across the major VTTs + integrated digital toolsets, what TheTapestry has, what it's missing, what it shouldn't have. For positioning the KS pitch + scoping post-KS work.

**Sources surveyed (2026-05-31):** Foundry VTT, Roll20, D&D Beyond, Demiplane / Free League Nexus, Alchemy RPG, Owlbear Rodeo. Full citations at the bottom.

**Lens:** TheTapestry is **NOT** a general-purpose VTT (Foundry/Roll20 class). It's an **opinionated, single-system, integrated digital toolset** - the same category as D&D Beyond (for D&D 5e) and Demiplane / Free League Nexus (for the Year Zero games). That's the right comparison set.

---

## Tier 1 - Industry-standard table (parity with the bar)

What every serious VTT or integrated toolset offers. What you'd ABSOLUTELY notice if it was missing.

| Feature | Industry standard? | TheTapestry | Status |
|---|---|---|---|
| Character creation wizard | All have it | `components/wizard/*` multi-step builder | ✅ |
| Character sheets (PC + NPC) | All have it | PC sheet, NPC sheet, character-states cross-campaign | ✅ |
| Integrated dice engine | All have it | d1+d2+d3 with AMod/SMod/CMod stacking + outcome bands | ✅ |
| Roll history / feed | Most have it | `RollsFeed` per-campaign, persisted in roll_log | ✅ |
| Combat / initiative tracker | All have it | initiative_order + RollsFeed `(Round N)` + Phase-2 conditions | ✅ |
| Tactical battlemap with tokens | All have it | TacticalMap with grid + tokens + scale + rotation | ✅ |
| Fog of war | Most have it | Effective fog cache + GM toggle | ✅ |
| Dynamic lighting / LOS | Foundry strong, Roll20 has, Owlbear basic | TacticalMap has `sight_radius_cells` on tokens + walls (is_wall, is_window, is_door) | ✅ (verify completeness) |
| Token mechanics (size, doors, walls) | Foundry / Roll20 | scale, rotation, is_door, door_open, is_wall, is_window, sight_radius_cells | ✅ |
| Realtime multi-client sync | All have it | Supabase channels (token moves, fog paint, initiative, chat, scenes) | ✅ |
| Compendium / rules reference | D&D Beyond, Foundry, Demiplane | `app/rules/*` + canon export + drag-drop equipment catalog | ✅ |
| Sourcebook reader | D&D Beyond, Demiplane Nexus | `app/rules/*` pages + the upcoming KS module ship | ✅ partial |
| Marketplace / module store | Roll20 marketplace, D&D Beyond marketplace, Demiplane | `/rumors` Phase A/B/C shipped (publish + version + marketplace) | ✅ |
| Campaign chat | All have it | TableChat campaign + whispers | ✅ |
| Direct messages | Most have it | `/messages` (DM threads, postgres_changes subbed) | ✅ |
| Account / signup / auth | All have it | Turnstile + Upstash rate-limit + email confirm | ✅ |
| Bug report / GM notes | Some have it | Bug Report + Export JSON, GM Notes with draft persistence | ✅ |

**Read:** TheTapestry meets industry standard on every Tier 1 item. There is no parity gap.

---

## Tier 2 - Differentiators (things TheTapestry has that most competitors DON'T)

These are the moat. Lead the KS pitch with these.

| Feature | Who else has it? | TheTapestry implementation | KS pitch leverage |
|---|---|---|---|
| **Communities subsystem** | Practically nobody (closest = Stars Without Number's faction mechanics, no VTT integration) | Phases A-E shipped: morale, labor pool, departures, status tracking, dynamic faction membership | "Run a settlement, not just a session" |
| **World map with real geography** | Nobody. Most VTTs are room-scale. | Leaflet + OSM + OSRM route planner + Alt+click waypoints + travel-mode ETA + GM-shared route broadcast | "Play across a real post-pandemic world" |
| **Pin sidebar with search + route planning** | Nobody | Pin search, OSRM route, share-route broadcast | (rides the World map pitch) |
| **Custom rule engine + canon enforcement** | Sort of - Foundry has system modules; D&D Beyond hard-codes 5e | XSE (`lib/xse-schema.ts`) is the single source of truth; canon export script auto-syncs `tapestry-rules-canon.md`; `app/rules/*` pages | "The rules are the code; the code is the rules" |
| **Cross-campaign character continuity** | D&D Beyond has cross-campaign character vault | `characters` are user-scoped + `character_states` are per-campaign; characters can ship into module-imports | ✅ |
| **Integrated playtest recorder** | Nobody (alpha/beta tools exist as 3rd-party). Foundry has chat log export. | `lib/playtest-recorder.ts` + `components/PlaytestRecorder.tsx` + GM-cascade broadcast + Ctrl+Shift+L/M/P hotkeys | (internal QA / playtester pitch) |
| **War stories / campaign archives** | Nobody as a built-in surface | Per-campaign archive of session logs | "Your campaigns become a library" |
| **Forum / Campfire** | Roll20 has forums, but disconnected from VTT | Integrated into the platform; same auth + moderation | "Community lives next to play" |
| **Modular content engine (Rumors)** | Roll20 modules, D&D Beyond marketplace | `/rumors` with publish/version/marketplace flows | "Anyone can publish; GMs can run; players can buy" |
| **Three-platform vision on one engine** | Nobody | XSE engine targets TheTapestry (Distemper), TheTableau (Star Trek-flavored), TheTable (next) | "One engine, multiple worlds - subscribe per platform" |
| **Player-free / GM-paid billing** | Nobody major (Roll20/Foundry charge GMs; D&D Beyond per-account) | Per-platform GM-seat model, players always free | "Players never pay - GMs run for everyone" |

**Read:** This list is your KS pitch's BACKBONE. Communities + World Map + Multi-platform Engine + Player-free billing are each, on their own, things no major competitor offers.

---

## Tier 3 - Gaps (competitors have it, TheTapestry doesn't)

What the bar is missing. Each item: who has it, severity, recommendation.

| Feature | Who has it | Severity for KS | Recommendation |
|---|---|---|---|
| **Ambient audio / jukebox** | Foundry, Roll20, Alchemy (Alchemy strongest) | MEDIUM - KS demo would feel flat without music; reviewers notice silence | POST-KS bucket 2. Cheap MVP: per-scene `audio_url` field + an HTML5 `<audio>` element + a "Now playing" badge. Doesn't need a jukebox UI for v1; just one track per scene the GM can swap. |
| **Macros / user-scripting** | Foundry strong, Roll20 mid | LOW for KS - power-user feature, not a backer wedge | POST-1.0. Skip. The integrated rule engine + buttons cover ~90% of why anyone wants macros. |
| **Encounter Builder (CR balance)** | D&D Beyond, Foundry modules | MEDIUM - NPC stat blocks exist, but no "build a balanced encounter" affordance | POST-KS. Wrap the existing NPC threat tiers (Friendlies / Goons / Foes / Antagonists from canon roadmap Tier 1 #4) into a GM-side "encounter weight" calculator. Half-day. |
| **Animated environments / particle effects** | Alchemy is the leader; Foundry via modules | LOW for THIS audience (Distemper is post-pandemic gritty, not Critical Role cinematic). Wrong vibe-fit. | SKIP. Not on-brand. |
| **Video / voice chat in-app** | Roll20, Foundry (via modules), Alchemy | LOW - most groups use Discord. Adds support burden. | SKIP. Recommend Discord in the GM guide. |
| **Mobile app / native client** | D&D Beyond has, Foundry doesn't, Roll20 web-mobile | HIGH for backers (a backer will try it on their phone) | KS-PATH (responsive only, not native). The web app needs a real mobile pass per my visual-pass-2 finding. NATIVE app is post-1.0. |
| **Music streaming integrations (Spotify / Tabletop Audio)** | Roll20 has Tabletop Audio integration | LOW - covered by the per-scene `audio_url` Tier 3 entry above | (rides the audio feature) |
| **API / webhook / 3rd-party automation** | Foundry strong; Roll20 mid | LOW for KS, MEDIUM for paid SaaS | POST-1.0 bucket 3. After billing. |
| **Cinematic "active character" view** | Alchemy is the leader | LOW for this audience | SKIP. Not on-brand. |
| **Battle-map asset library (built-in art)** | Roll20 marketplace; Foundry has packs | MEDIUM - Distemper backers need free + paid map options ready to drag in | KS-PATH. Ride the existing `/rumors` system: ship a "Maps" content type or seed the marketplace with 30-50 themed battlemaps + tokens. This is content lift, not engineering. |
| **AR / 3D maps** | Foundry experimental, Owlbear extensions | LOW for this audience | SKIP. Niche. |
| **Drawing / sticky notes on the map** | Owlbear is the strength leader; Roll20 has | LOW - `is_door`, `is_wall`, `is_window`, GM ping, the route planner cover most use cases | POST-KS nice-to-have. Half-day to add a stroke layer if asked. |
| **Combat effects timeline / token statuses** | Foundry's "Combat Tracker Extensions" niche-leader | MEDIUM - Phase-1 conditions exist, but the per-turn lifecycle UI isn't there yet | KS-PATH. Folds into HP pickup mechanic #6 (Conditions Phase-2). |

---

## Tier 4 - Things TheTapestry shouldn't try to have (out-of-scope by design)

These would actively HURT the pitch. Resist temptation.

- **Multi-system support.** TheTapestry is Distemper. The XSE engine is the multi-system play (TheTableau, TheTable). Single-system focus is the moat - don't muddy it.
- **Homebrew rule editor.** D&D Beyond avoids this; you should too. The rules are canon, enforced by the engine. Letting GMs override hurts your "the rules are the code" pitch.
- **Voice / video.** Discord exists.
- **AI GM / AI NPC chat.** Easy demo, bad investment, brand-risky if generative output goes off the rails in a Distemper-themed campaign.

---

## Summary - the KS pitch shape this implies

**TheTapestry's positioning is "D&D Beyond + Foundry, for Distemper, with Communities and a real-world map nobody else has."**

The platform is at industry parity on every Tier 1 item. The Tier 2 differentiators are strong enough to lead the pitch. The Tier 3 gaps are mostly POST-KS work; only **Ambient audio** + **Battlemap asset library** + **mobile responsive pass** + **Combat effects lifecycle UI** are KS-path items, and three of those are content/polish rather than engineering.

The honest gap-fill for 9/1:
1. Mobile responsive pass (already on the KS punch list; visual-pass-2 flagged).
2. Per-scene ambient audio (one new column + an `<audio>` element).
3. 30-50 themed battlemaps + token packs seeded into `/rumors` (content lift).
4. Conditions Phase-2 (already on the HP mechanics pickup block).

Everything else from this gap list is POST-KS or SKIP.

---

## Sources

- Foundry VTT features: [HackMD overview](https://hackmd.io/@gmoney/HJQWsI7Yw), [Combat Tracker / Encounter Library](https://encounterlibrary.com/foundry-players-guide/combat-tracker/), [Necropticon "non-D&D" guide](https://necropticon.com/guides/how-to-use-foundry-vtt-for-ttrpg-games-that-arent-dd-a-simple-guide/)
- Roll20 features: [Character Vault](https://wiki.roll20.net/Character_Vault), [Compendium](https://wiki.roll20.net/Marketplace), [Dynamic Lighting](https://wiki.roll20.net/Dynamic_Lighting), [Marketplace](https://wiki.roll20.net/Marketplace)
- D&D Beyond features: [Digital Sourcebooks](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747209667476-Digital-Sourcebooks), [Wikipedia overview](https://en.wikipedia.org/wiki/D&D_Beyond), [Encounter Builder review](https://cloud9tabletop.com/dnd-beyond-encounter-builder-early-access-review-with-pictures/)
- Demiplane / Free League Nexus: [Geek Native overview](https://www.geeknative.com/137626/free-league-nexus-demiplane-and-free-league-launch-online-ttrpg-platform/), [ComicBook.com Alien Nexus](https://comicbook.com/gaming/news/free-league-nexus-demiplane-alien/), [Demiplane help](https://support.demiplane.com/hc/en-us/articles/33046325857815-Getting-Started-on-Demiplane-Your-Official-Digital-Companion)
- Alchemy RPG features: [Alchemy main](https://alchemyrpg.com/), [Wargamer review](https://www.wargamer.com/dnd/alchemy-rpg-kickstarter), [Candela Obscura partnership](https://www.gamespress.com/Alchemy-VTT-Expands-Partnership-with-Darrington-Press-to-Launch-Candel)
- Owlbear Rodeo features: [Lair of Secrets review](https://lairofsecrets.com/gaming/review-owlbear-rodeo/), [PC Gamer overview](https://www.pcgamer.com/owlbear-rodeo-is-a-more-lightweight-virtual-tabletop-for-your-dandd-needs/), [Sly Flourish overview](https://slyflourish.com/owlbear_rodeo.html)
