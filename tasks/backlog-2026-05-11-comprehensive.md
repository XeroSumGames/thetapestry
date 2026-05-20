# Tapestry - Comprehensive Backlog

**Generated 2026-05-11.** Consolidates `tasks/todo.md`, `tasks/open-work-checklist-2026-05-06.md`, and `tasks/roadmap.md`. Items deduped and grouped by phase / overarching type. Time estimates assume one focused work session per row, solo.

**Audited 2026-05-11 (evening).** Every actionable item (Playtest carry-over, Bugs, Rules coverage, Tier 1 canon, Partials, UX/Polish, Pre-tester polish, Pin/Map/Tools, Older bugs, top-level /todo.md) walked against shipped code via grep + git log. Verdicts inlined per item as `[STATUS: ...]`. No items deleted; PARTIALs annotated with what's done vs. remaining.

Format: **name** - one-line description of what the change means. *Action + estimated time.*

---

## 🔥 Playtest carry-over (TOP PRIORITY)

- ~~**Random character - Medic skill seed**~~ - **RESOLVED 2026-05-11**. Verified implementation in `app/characters/random/page.tsx:146-167`: profession-skill floor distributes 10 CDP across the profession's 5 canonical skills (each min 1, max 3), then merges with the paradigm via `max()`. For Medic, Medicine\* always lands at level 1+. Player report was most likely a naming-confusion ("Medicine\*" expected to be called "First Aid") or unfamiliarity with level 1 being a real skill rank. *Polish follow-up flagged in tasks/todo.md: surface skill description on hover so "Medicine\*" tooltip reads "covers first aid, diagnosis, treatment, emergency stabilization..."*
- **Vehicle passenger sync - terrain rejection** - passengers auto-track onto walls/water when the vehicle moves. *Design call first (drag rejected vs. passengers stay behind), then plumb into move handler. **2-3h**.* `[STATUS: STILL_OPEN - vehicle seats exist; no sync-on-move or rejection logic]`

## 🐛 Bugs - need repro/decision

> **Console-traced for 5/11 playtest** (commit pending). All three of the
> bugs below now emit `[playtest-trace]`-prefixed `console.warn` lines.
> During repro: open DevTools console → filter on `[playtest-trace]` →
> copy the surrounding log block when the bug fires. Traces stay until
> we resolve the bugs, then I'll strip them.

- **Initiative lag** - perceived delay between End-Turn and next combatant. *Console trace added: nextTurn now emits `[playtest-trace] [nextTurn] done {total_ms, deactivate_ms, activate_ms, reload_ms, broadcast_ms, activated_name}` on every turn advance. Playtest 5/11 to capture timing. **1h** post-capture.*
- **Damage calc spot-check** - `2+2d6(6)=8 raw → should be 7/7` reported. *Console trace added at the calculateDamage call site (app/stories/[id]/table/page.tsx:4390+): emits `[playtest-trace] [damage-calc] {weapon, diceRoll, phyBonus, unarmedBonus, totalWP_raw, rpPercent, finalWP_after_calc, finalRP_after_calc, mitigated, ...}`. Playtest 5/11 to capture. **30m** post-capture.*
- **Failed skill checks still leave 2 actions** - consumeAction should fire on every path. *Console traces added: closeRollModal emits `[playtest-trace] [closeRollModal] gate` + `rollerIsActive?` decisions; consumeAction emits `[playtest-trace] [consumeAction] CALLED` with actions_before/cost/call-site stack and `WROTE actions_remaining: X -> Y` on every write. Playtest 5/11 - repro path: roll a skill check that fails on the active combatant's turn and watch the console. **1h** post-capture.*
- **Tactical map mouse-pan via drag - broken** - WASD works; click-drag doesn't. *Multiple ship+revert attempts; flagged as no-fix-path 2026-04-27. **Half a day** with fresh eyes.* `[STATUS: STILL_OPEN - pan path intact at TacticalMap.tsx:2887, trace shipped 63a0b05, awaits 5/11 playtest capture]`
- **HP render lag** - possibly already fixed by optimistic-local-patch sweep. *Runtime re-verify on Monday playtest. **15m** verify.* `[STATUS: STILL_OPEN - partial fixes in 3d80484 (open NPC card refresh); broader lag awaits playtest verify]`

## 🛡️ Rules coverage - verify/build

- **Armor Phase 2** - condition tracking (Pristine→Broken), per-armor Upkeep button, auto-Upkeep on Moment of Low Insight. *Spec locked; touches xse-schema.ts + InventoryPanel + executeRoll. **3-4h**.* `[STATUS: PARTIAL - ItemCondition type + Upkeep rules page shipped; per-armor button + auto-Upkeep on LI not wired]`
- **Subsistence Damage + Rations data-model** - promote `XSECharacter.rations` from `string` to `{type, count}` + wizard/edit/print/random/DB migration. *Design call first (2 of one type or mix-and-match), then plumb. **4-5h**.* `[STATUS: PARTIAL - rations { type, count } shipped (32c8fc0); subsistence damage doc lives at app/rules/combat/damage; gameplay tick not wired]`
- **Recruitment/Inspiration/Apprentice disambiguation cleanup** - rules-extract done; three Tier-2 cleanups remain. *Rename Inspiration line UI to SMod, suppress double-count when rolled skill IS Inspiration, approach-specific Success semantics for Recruitment. **3-4h**.* `[STATUS: PARTIAL - rules extract (3b01cfd) + FI outcome-ladder fix (7ca9569) shipped; three Tier-2 cleanups still open]`
- **Other explosives audit** - Grenade/Mortar/Shiv-Grenade/Flash-Bang/Rocket Launcher canon stats. *Blocked on QS Table 18 from Xero. **2h** once table lands.* `[STATUS: STILL_OPEN - Xero-blocked]`

---

## 📜 Canon promotions - Tier 1 (high-value CRB gaps)

- **Item Condition + Upkeep Check** - five-state degradation + Upkeep rules. *Mostly shipped; verify and document in canon §07. **1-2h** verify+doc.* `[STATUS: PARTIAL - rules pages at app/rules/equipment/item-condition + /upkeep shipped; condition states in schema; canon §07 doc-sync remaining]`
- **Vehicle subsystem + Vehicles-as-Cover** - Rarity, Size 1-6, Speed 1-5, WP/Encumbrance formulas, Range with ethanol/methanol, Cover-as-RDM by size. *Biggest single gap. Verify against existing vehicle/cargo features; add to canon §07. **1-2 days**.* `[STATUS: STILL_OPEN - /vehicle exists for management; no rules page, no Size/Speed formulas, no Cover-as-RDM]`
- **Activity Block taxonomy** - formal Daily/Weekly/Monthly/Seasonal ladder. *Sidebar addition to canon §08. **1h**.* `[STATUS: STILL_OPEN]`
- **NPC threat tiers** - Friendlies/Goons/Foes/Antagonists with stat templates. *Add to canon §10 as stat-block guide. **2-3h**.* `[STATUS: STILL_OPEN]`
- **Falling damage** - 3 WP + 3 RP per 10ft fallen. *Add to canon §06b. **1h** rule + small UI prompt.* `[STATUS: STILL_OPEN]`
- **Drowning rules** - 6+PHY AMod rounds breath; 3 WP + 3 RP per round after; -1 CMod per resist. *Add to canon §06b. **1h** rule + small UI prompt.* `[STATUS: PARTIAL - drowning section exists in app/rules/combat/damage; no UI prompt or combat wiring]`
- **Subsistence Damage canon doc** - 1 WP + 1 RP per day past day 2. *Already mostly shipped; doc-sync in canon. **30m**.* `[STATUS: PARTIAL - rules doc lives at app/rules/combat/damage; canon-snapshot doc-sync still pending]`
- **Travel Times subsystem** - 8h travel + 8h rest + 8h sleep cycle; 1 RP/hour overage. *Add to canon §07 + UI for overage tick. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Resource Quality / Supplies abstraction** - Common/Uncommon/Rare units of generic Supplies. *Document in canon §07. **2h** doc, **1-2 days** if implementing as inventory currency.* `[STATUS: STILL_OPEN - "Supplies" mentioned in community rules but not formalized]`
- **Per-activity yield rates** - Scavenging/Foraging/Fishing/Trapping/Hunting/Farming numbers. *Depends on Item Condition + Supplies landing first. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Base of Operations sizing** - Tiny/Small/Medium/Large/Massive thresholds + Supplies cost. *Pre-Community tier addendum to canon §08. **2-3h** doc, **2-3 days** if BoOs become first-class entities.* `[STATUS: STILL_OPEN]`

## 📜 Canon promotions - Tier 2 (Distemper supplement, not core canon)

- **Dog Flu signature mechanic** - 1 WP+RP per 6h, severity-tier disease. *Reconcile with canon Sick state. **3-4h**.*
- **Distemper-Infected Canines** - +1 Athletics & Unarmed Combat tag for infected wolves/dogs. *Already half-shipped in bestiary; flag the tag. **1h**.*
- **Fuel subsystem** - gasoline spoilage, ethanol/methanol modifiers, still build/conversion. *Hangs off Vehicles. **1-2 days**.*
- **Government Remnants / Beacons of Hope factions** - Cunningham/Buchanan/Wilkerson territories. *Document in Distemper setting docs. **2-3h**.*

## 📜 Canon promotions - Tier 3 (optional GM-aids, playtest first)

- **Negotiations Gambit/Rebuttal** - two-step Opposed Check for social scenes. *Modal flow + rules page. **3-4h**.*
- **Morality loss/regain ladder** - 3 lost → -1 INF, 6 regained → +1 INF, floor -2. *Schema + rule page + GM card prompt. **2-3h**.*
- **Called Shots** - Wild Success required, freeform effect via Fill in the Gaps. *Rules page + Attack modal note. **1h**.*
- **Tactical Advantages** - +1 to +3 CMod GM-discretion catch-all. *Rules page + GM CMod helper. **1h**.*
- **Chases subsystem** - Speed-matched Opposed checks across range bands; escape at Distant. *Modal flow + rules page. **4-5h**.*
- **Banishment** - Code-of-Conduct teeth for Communities. *Community modal button + rules page. **2h**.*
- **Luxury Ration clears 1 Stress pip** - gives Luxury Rations a real purpose. *Already infrastructure; UI button on rations panel. **1h**.*
- **Mundane vs Complex Tasks split + Simplified Group Check** - +2 CMod per participant, no AMods/SMods, Mundane-only label. *Group Check modal alternate path. **2h**.*
- **Apprentice continuity on PC death** - player promotes Apprentice → PC. *Death modal extension + character-transfer flow. **3-4h**.*

## 📜 Canon promotions - Tier 4 (drop from CRB, don't promote)

Stacking +1 CMod patterns; Distract↔Inspire backfire symmetry; Helper-clears-Stress check; eight Explosive/Special weapons (only if encounter design wants them).

---

## 📝 CRB rewrite sweeps (~150 FROM/TO blocks, mechanical doc-sync)

- **DMM/DMR → MDM/RDM sweep** - every chapter, ~40 sites including 33 NPC stat blocks. *Mechanical find/replace. **2-3h**.*
- **Intimidation skill removal** - replace with Manipulation or Psychology\* across Chs. 05/07/09/10 (~12 sites). *Find/replace. **1-2h**.*
- **General Knowledge → Specific Knowledge sweep** - Chs. 04/05/07. *Find/replace. **1h**.*
- **Mechanics\* → Mechanic\*** plural sweep - Chs. 06/08. *Find/replace. **30m**.*
- **Panic Threshold / Stress counter → Stress Level (0-5) + Stress Modifier (RSN+ACU AMod)** - wholesale replacement across Chs. 05/07/08/10. *Big rewrite, multi-section. **4-5h**.*
- **Insight Dice on Death** - "1 WP + 1 RP per die" → "1 WP + 1 RP total" at three sites including live `app/rules/core-mechanics/insight-dice/page.tsx`. *Quick fix. **30m**.*
- **Lv4 Skill Trait paragraphs** - pull from all 24 skill descriptions in Ch. 05 §05 pending unified Lv4 trait release. *Blocked on Lv4 from Xero. **2-3h** once unblocked.*
- **Combat Actions table** - 17 actions, "Grapple" (not Grappling), drop "Skill Check" action. *Table rewrite. **1h**.*
- **CMod ladder labels** - all 11 tiers renamed (Ch. 04 pp. 22, 25-26). *Find/replace + rules-page tweak. **1h**.*
- **All 12 Profession bundles** - wholesale 7-skill → 5-skill replacement (Ch. 05 pp. 41-43). *Schema + wizard data. **2-3h**.*
- **Paradigm roster** - 16 → 12 (drop 7, add 2, rename 1). *Schema + wizard data + character migration check. **3-4h**.*
- **Range Band movement** - Engaged→Close=3, →Medium=6, →Long=10, →Distant=15. *Schema + rules-page table. **1-2h**.*
- **Morale Check structure** - replace freeform CMod list with canon's 6 named slots. *Already canon-correct in code; CRB-side rewrite only. **2h**.*
- **Morale outcomes** - replace "1d6/2d6 leave" with percentage attrition (25%/50%/75%). *CRB-side rewrite. **1h**.*
- **Fed Check + Clothed Check** - both missing entirely from CRB; insert canon's two 6-row outcome tables. *CRB-side insertion. **1h**.*
- **Apprentice unlock** - Wild Success OR HI → HI only (3 sites). *Already shipped on platform 2026-05-09; CRB-side rewrite. **1h**.*
- **Apprentice creation CDP** - add canon's 3 RAPID + 5 skill CDP allocation. *Already in wizard; CRB-side doc only. **30m**.*

---

## 🧰 Partials to finish

- **Modal unification** - Stabilize / Distract / Coordinate / Group Check / Gut Instinct / First Impression → `<RollModal>`. *Each conversion ~30m, total 6 modals. **3-4h**.* `[STATUS: STILL_OPEN - all 6 still bespoke modals]`
- **Hide-NPCs reveal UX** - folder-level "Reveal all in folder" + panic button "reveal entire roster". *NpcRoster UI additions. **2-3h**.* `[STATUS: PARTIAL - multi-select reveal modal at NpcRoster.tsx:680-730; folder-level + panic-button not built]`
- **Featured items** - Thriver promote-to-featured for forum threads + war stories. *Schema + Thriver UI + listing page. **3-4h**.* `[STATUS: STILL_OPEN]`
- **DZ canon layer** - District Zero-specific canon scope/UX. *Filter + setting tag UI. **2-3h**.* `[STATUS: PARTIAL - /rumors recognizes district_zero setting; dedicated canon-scope filter UI not built]`
- **DZ timeline visualization** - chronological page surfacing world-event timeline pins. *New page + sort logic. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Play stats per module** - track session count + avg player count. *Schema + roll-up + display. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Tier C1 single snapshot RPC** for table-page mount. *Optimization, one RPC consolidation. **3-4h**.* `[STATUS: STILL_OPEN]`
- **In-app SRD search** - search UI on top of `/rules/*`. *Search index + input + result list. **4-5h**.* `[STATUS: STILL_OPEN]`

---

## ✅ Shipped 2026-05-11

- **Measure-tool travel-mode picker** (`590cdef`) - dropdown next to the Measure button: Walking 3 mph / Bicycle 10 mph / Minnie 32 mph. Switch mid-measurement and every leg label, TOTAL row, and on-map midpoint chip recomputes in place. Minnie speed sourced from `Minnie ^0 The Magnificent Mongrels v04.docx` (30-35 mph realistic cruise → 32 mph midpoint). Session-scoped, defaults to Walking on each load. Module-level `TRAVEL_MODES` constant makes adding new modes (horseback, boat) a one-line edit.
- **SHARE VIEW button on campaign map** (`b921b43`) - GM clicks → broadcasts `{lat, lng, zoom, tile}` over `cm_view_share` channel → players smoothly flyTo + swap tile layer. One-shot. GM-side button flashes green on send; player-side toast confirms receipt.
- **Measure-tool per-leg breakdown in toolbar** (`1f721b8`) - bottom toolbar now stacks one row per leg above the TOTAL row, so multi-waypoint paths show the full breakdown without squinting at midpoint chips.
- **Console traces for 5/11 playtest bug repros** (`aaa29af`) - Initiative lag / damage calc / failed-skill-checks-leave-actions all instrumented with `[playtest-trace]` prefix.
- **TacticalMap pan trace** (`63a0b05`) - to definitively confirm the click-and-drag pan path fires (I believe this bug is already fixed by side-effect).

---

## 🎨 UX / Polish

- **Skill-description hover tooltips on character sheet** - every skill row should surface its canonical description on hover (Medicine\* tooltip: "covers first aid, diagnosis, treatment, emergency stabilization..."). *Description prose already lives in `lib/xse-schema.ts:SKILLS[].description`; just need to wire a title-attribute or tooltip component in `components/CharacterCard.tsx`. **30m**.* `[STATUS: STILL_OPEN]`
- **Streamline /login → /table** - deep-link / "Resume last session" tile. *Auth callback + tile component. **2-3h**.* `[STATUS: STILL_OPEN - Resume tile mentioned in comments, not built]`
- **King's Crossing Mall tactical scenes** - mall complex maps. *Asset creation + scene wiring. **1-2 days**.* `[STATUS: STILL_OPEN]`
- **King's Crossing Mall handouts** - broadcasts, journals, ham-radio transcripts. *Content authoring + handout slots. **1-2 days**.* `[STATUS: STILL_OPEN]`
- **CMod Stack reusable component** - extract from Recruit modal; reuse in Grapple, First Impression, main Attack. *Component extraction + four refactors. **3-4h**.* `[STATUS: STILL_OPEN]`
- **GM force-push view to players** - switching campaign↔tactical or scene A↔B propagates. *Realtime broadcast + receiver. **2-3h**.* `[STATUS: PARTIAL - campaign-map SHARE VIEW button shipped (b921b43, one-shot push); auto-propagation on scene-switch + tactical↔campaign toggle not built]`
- **Multi-round haggling** - Barter currently single-roll. *Modal extension + state machine. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Character Evolution / CDP Calculator** - post-creation growth tool; spend earned CDP. *Already started; finish allocation flow + roll-feed integration. **4-6h**.* `[STATUS: PARTIAL - allocation flow started; roll-feed integration incomplete]`

## 🚀 Pre-tester polish

- **Cost-containment alarm** - Supabase 75% quota + Vercel bandwidth alert. *Vendor-portal config. **30m**.* `[STATUS: STILL_OPEN]`
- **Demo / sample campaign** - first-time GMs. *Content authoring. **2-3h**.* `[STATUS: STILL_OPEN]`
- **End-to-end smoke pass** - signup → /firsttimers → /welcome → /characters/new → /map → first whisper. *Manual walkthrough + bug capture. **2h**.* `[STATUS: STILL_OPEN]`
- **Quick Reference card on /welcome** - CDP / WP-RP / Stress / Inspiration cheat sheet + SRD/CRB links. *Static page content. **1-2h**.* `[STATUS: STILL_OPEN]`

## 🗺️ Pin / Map / Tools

- **Pin-image migration** - base64 → Supabase Storage. *Migration script + Storage policy. **3-4h**.* `[STATUS: STILL_OPEN]`
- **Timeline sort_order management UI** - drag-to-reorder for Thrivers. *UI component + persistence. **2-3h**.* `[STATUS: STILL_OPEN]`
- **Manual crop control** - drag-to-select instead of auto center-crop. *UI on upload flow. **2-3h**.* `[STATUS: STILL_OPEN]`
- **More tools** - handout generator, token template maker, roll table randomizer. *Three small tools. **1 day**.* `[STATUS: STILL_OPEN]`

---

## 🎙️ Phase 4 - Campfire tail

- **Full-text search across Forums / War Stories / LFG** - postgres FTS index + search UI. **4-5h**.
- **Reactions on War Stories + LFG** - persist Forums reactions; extend pattern. **2-3h**.
- **Comment threading on War Stories + LFG** - Forums has it; others flat. **3-4h**.
- **Formal campaign_invitations accept/reject flow** - replaces DM-with-link. *Schema + 3 surfaces. **4-5h**.*
- **LFG filters by setting + schedule** - filter UI + query. **2-3h**.
- **DZ community layer** - approved player Rumors visible to all DZ campaigns. *Schema + filter + Thriver approval. **4-5h**.*

## 🧱 Phase 5 - Module System (Phases D/E/F)

### Phase D - Monetization
- **Free/Paid/Premium pricing** - schema + Stripe + listing UI. *Big lift. **3-5 days**.*
- **Licensed GM permission unlocks paid modules** - entitlement + check. **1-2 days**.
- **Author payout flow + referral tracking** - Stripe Connect + accounting. **3-5 days**.

### Phase E - Extras
- **GM Kit Export v2** - printable PDF + module zip. **1-2 days**.
- **Module + Community cross-publish** - dual-write or shared-resource model. **2-3 days**.
- **In-session GM toolkit** - scene switcher, roster, handouts panel, roll tables linked to dice roller. **1-2 days**.
- **Third-party module import** - Roll20/Foundry → Tapestry parser. **3-5 days**.

### Phase F - GM Adventure Authoring Toolkit
- **Story Arc form** - guided 4-question creation surface. **1 day**.
- **NPC quick-build inline forms** - in-context creation. **4-6h**.
- **Map quick-build** - drop new tactical scene from inside a beat. **4-6h**.
- **Handout quick-build** - in-context creation. **3-4h**.
- **Encounter quick-build** - in-context creation. **4-6h**.
- **Route tables** - leg-by-leg encounters with roll-target each. **1 day**.
- **Adventure preview (playtest mode)** - non-destructive run-through. **1 day**.
- **Publish Adventure** - terminal step on Story Arc form. **4-6h**.

---

## 🎯 Tactical Map - long-term

- **Polygon vision mask** - cleaner rendering than per-cell black-rect fog. *Cosmetic polish, not gameplay-required. **1-2 days**.*
- **Token / character spawn returns to top-left** - visual verify on Monday playtest (no code change expected). **15m** verify.

### Lv4 Skill Traits - Xero-blocked, ships together
- **Inspiration Lv4 "Beacon of Hope"** - auto +4 to Morale. **2-3h**.
- **Psychology\* Lv4 "Insightful Counselor"** - auto +3 to Morale. **2-3h**.
- **Generic Lv4 Trait surface** on character sheet. **3-4h**.
- **Auto-application hooks** for any other Lv4 Trait. **3-4h**.
- **Barter Lv4 cheat-doubling**. **2-3h**.

## 🔒 Module Publishing

- **Publish-new-version from a non-source campaign** - snapshot fingerprint or "working copy of X" flag. **1-2 days**.

## 🩺 Code Health

- **Split table page into subcomponents** - currently 10,542 lines (grown from 5,365). *High risk; needs a clean day. **1-2 days**.*
- **Debounce realtime callbacks** - optimization-only. **2-3h**.

## 🔐 Security hardening

- **Public-bucket SELECT policy tightening** - 9 storage buckets listing all files. *Per-bucket UX decision. **3-4h** for all nine.*

## 🐞 Older bugs (genuinely open)

- **Gut Instinct results presentation rework** - narrative card vs. sheet overlay vs. GM DM. *Design call. **3-4h** once decided.* `[STATUS: STILL_OPEN - design call pending]`
- **Inventory migration** - auto-convert old string equipment to structured items on load. **2-3h**. `[STATUS: STILL_OPEN]`
- **Allow characters in multiple campaigns** - schema + UX. **1-2 days**. `[STATUS: STILL_OPEN]`
- **Transfer GM role** - move ownership without restart. **3-4h**. `[STATUS: STILL_OPEN]`
- **Player-facing NPC card on Show All click** - currently opens GM-editable view. **2-3h**. `[STATUS: STILL_OPEN]`

## 💬 Discussion / Undecided

- **NPC health as narrative feeling** - deferred 2026-04-26. Re-open with new framing.
- **Decide on hide-NPCs flag** - global "reveal to players" boolean vs. per-instance reveal events.
- **GM Notes / Assets merge** (flagged 2026-05-11) - the right-panel currently has separate tabs for Assets (objects/vehicles/etc.) and GM Notes (campaign_notes). Notes that describe ASSETS (a handout about a specific item, a quote attached to a vehicle, etc.) sit in the wrong tab and force a cognitive split. Decision pending: unify into a single Assets+Notes tab with type filters, OR add cross-linking (a Note can attach to an Asset, Asset card surfaces linked Notes inline), OR leave as-is. Design call first, then implement.
- **Coordinated Effort (player-initiated, GM-orchestrated)** (flagged 2026-05-11) - player-side button: "Coordinated Effort". Sends a request to the GM that reads "<player> wants to attempt <X> - who's involved and how are they involved?" The GM then designates the participants and how each one contributes (full action / assist / consult / etc.) before the rolls fire. Sister mechanic to the player-rolls-individually Group Check proposal also in this list. Open questions: does the GM pick the skill, or the initiating player? Does each participant get a Yes/No prompt to opt in? What's the failure mode if the GM doesn't respond within N seconds (timeout / auto-cancel)? Should this fold into the same code path as the redesigned Group Check, or stay a separate flow?
- **Group Check redesign: individual rolls feed leader's check** (flagged 2026-05-11) - alternative to today's "leader rolls with sum of others' AMods+SMods" canon. Each participant rolls individually; their outcome contributes a modifier to the leader's check (Success +1, Wild +2, HI +3, Failure -1, Dire -2, LI -3). Wider variance, more table time, more player engagement. Open questions: (1) can helpers spend Insight Dice on their helper roll? (2) does a helper's HI/LI award them an Insight Die personally on top of the modifier? (3) do skill-0 helpers still roll? (4) replace the current Group Check, or add as a second "Collaborative Check" mode alongside it? Recommended: ship as separate mode (fast Group Check for routine, this for dramatic moments).

## 📋 Top-level /todo.md (mostly stale, low-stakes admin)

- **Apply** `sql/initiative-order-rls-members-write.sql` (Nana attack-doesn't-advance bug). **15m**. `[STATUS: STILL_OPEN - SQL file exists; code at app/stories/[id]/table/page.tsx:3874,3913,5197 still warns "Run sql/...". Not yet applied to live DB]`
- **Apply** `sql/player-notes-session-tag.sql`. **15m**. `[STATUS: STILL_OPEN - SQL file exists; referenced at app/stories/[id]/table/page.tsx:5986. Not yet applied to live DB]`

---

## 🌅 Long-term roadmap (Phases 6-11, aspirational)

### Phase 6
- **LFG matching by setting + playstyle**. **2-3 days**.
- **Session scheduling - calendar view**. **3-5 days**.
- **The Gazette - auto campaign newsletter**. **3-5 days**.
- **Between-session experience** - scope undefined. **2-5 days**.
- **Subscriber tiers - Free/Paid/Premium**. **3-5 days**.
- **Graffiti - Distemper-branded reactions**. **1-2 days**.

### Phase 7 - Ghost Mode Advanced
- **Ghost-to-Survivor funnel analytics**. **3-4 days**.
- **A/B test soft wall messaging**. **1-2 days**.
- **QR-scanner onboarding flow**. **2-3 days**.
- **Reactivate /firsttimers onboarding page**. **1-2 days**.

### Phase 8 - Physical Products
- **Chased QR codes - fold-out map deep-links**. **2-3 days**.
- **Anonymous preview for QR scanners without accounts**. **2-3 days**.
- **Chased module - pre-populated with Delaware content**. **3-5 days content**.
- **Mongrels sourcebook upload, seed pins/NPCs**. **3-5 days content**.
- **Physical product landing pages**. **1-2 days**.

### Phase 9 - Maturity
- **Contextual rules links from sheet + dice roller**. **2-3 days**.
- **Mobile optimization pass**. **1-2 weeks**.
- **Mobile dice roller**. **3-5 days**.
- **Global search across characters / campaigns / pins / NPCs / Campfire**. **1 week**.

### Phase 10 - Future Platforms
- **Displaced - space setting on separate platform** - massive scope. **months**.
- **Extract `@xse/core` monorepo**. **2-3 weeks**.
- **Each setting gets own domain + branding**. **1-2 weeks**.

### Phase 11 - Cross-Platform Parity
- **Campaign Calendar - date-gated lore events**. **1-2 weeks**.
- **Roll20 Export - sheet HTML/CSS/JS, ZIP exporter, ingest**. **1-2 weeks**.

## 📆 Campaign Calendar backburner (revisit triggers)

- **Skip Week** → community frozen 4+ sessions. **3-4h**.
- **World events that should've ended still applying CMod**. **3-4h**.
- **"X days passed" → automatic ration/weather/community drift**. **1-2 days**.
- **Encumbrance tick auto-fire on time advancement**. **3-4h**.
- **DB: campaign_clock table or jsonb on campaigns**. **2-3h**.
- **Helper lib/campaign-clock.ts** with `advance(campaignId, hours)`. **3-4h**.
- **Clock widget in table page header**. **2-3h**.
- **Migrate Time button from Inventory #1 to unified clock**. **2-3h**.

---

## 🧮 Totals

- **Immediately actionable** (no blockers, no design calls): ~80 items
- **Design-call-blocked**: ~15 items (Rations mix-and-match, Recruitment approach semantics, Hide-NPCs flag, etc.)
- **Xero-content-blocked**: ~6 items (Lv4 traits, other explosives, Mongrels/Chased content)
- **Aspirational** (Phases 6-11): ~30 items

**Conservative near-term** (pre-tester polish + bugs + Tier 1 canon): ~3-4 weeks of focused solo work. The CRB rewrite sweep alone is ~3-4 days as a single batch.

---

## See also

- [tasks/todo.md](todo.md) - running backlog (canon-promotion items also flagged there)
- [tasks/open-work-checklist-2026-05-06.md](open-work-checklist-2026-05-06.md) - 2026-05-06 marathon-session prune
- [tasks/roadmap.md](roadmap.md) - strategic canon-promotion roadmap
- [tasks/froms-tos-crb.md](froms-tos-crb.md) - full per-chapter CRB audit with FROM/TO blocks
- [tasks/tapestry-rules-canon.md](tapestry-rules-canon.md) - current canon snapshot
