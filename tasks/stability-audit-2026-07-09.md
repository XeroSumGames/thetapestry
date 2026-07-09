# Stability Audit - 2026-07-09 (Puffer Fish, full-codebase bug hunt)

Triggered by Xero: "audit my code and look for bugs." Seven parallel review
agents, one per subsystem, each briefed with this repo's known bug classes +
the already-open/routed items (so no re-reports). Every CRITICAL and HIGH below
was independently re-verified at the source by Puffer before landing here - the
`VERIFIED` tag means Claude read the cited lines, not just the agent's claim.

Scope: app/stories/[id]/table/** , lib/** (data + mechanics + realtime),
components/** (combat, community, inventory, map, vehicle), app/tools/** ,
auth/join/upload paths. NO code was changed in this pass (audit only).

Tally: **1 CRITICAL, 15 HIGH, 17 MEDIUM, 8 LOW.**

> **UPDATE 2026-07-09 (Puffer) - cluster 1 SHIPPED.** The CRITICAL + the T1
> read-swallow cluster are fixed and on main: **C1** (characters.ts, +4 unit
> tests), **H6** (modules archive gm_user_id), **H7** (reseed abort-on-read-err),
> **M6** (scenes dup-token abort), **M9** (gm-kit fail-loud), **M10** (pending-heal
> retry-not-consume). tsc + 913 tests + gates green. Remaining clusters 2-8
> below still OPEN (mostly HP app-code + a few Puffer lib/realtime).

---

## Cross-cutting themes (fix by theme, not one-off)

Most findings cluster into six root patterns. Fixing the pattern kills several
findings at once.

**T1. Read-error-swallowed-then-write** (same class as the 2026-07-09 Feature
Manifest CRITICAL). `const { data } = await query` ignores `error`; the null
result is then treated as "empty" and drives a write that destroys or
duplicates data. Hits: C1 (character sheet), H7 (reseed), M6 (scenes), M9
(gm-kit), M10 (pending-heals), H6 (module archive). **This is systemic - a
lint/grep sweep of `const { data }` feeding a write is warranted.**

**T2. Non-atomic multi-write with no rollback.** Two dependent writes; the
first commits, the second fails -> corruption (loss or duplication). PC->PC
item transfer already solved this with the `give_item_to_character` RPC; the
siblings never got the same treatment. Hits: H12 (give-to-NPC), M11 (barter),
H11 (CDP evolution), M4 (combat applyDamage).

**T3. Viewer-vs-attacker misattribution in the roll hook** (`myEntry`). One
root cause, four symptoms: melee/unarmed damage PHY (H1), ranged ammo decrement
(H2), Low-Insight jam target (H2), kill-credit (H2). The 2026-06-01 Cree fix
patched the INSIGHT half via `insightHolder`; the main `executeRoll` path still
reads `myEntry` for PHY/ammo.

**T4. Shared realtime channel-topic reuse.** `supabase.channel(topic)` returns
the EXISTING joined instance (realtime-js RealtimeClient.js:297); `.subscribe()`
on an already-joined channel is a silent no-op and a later `.on(postgres_changes)`
binding never registers. So a helper that spins up a channel on a topic the page
already holds either never fires or its awaited Promise hangs forever, and its
`finally removeChannel` tears down the PAGE's live channel. Hits: H13 (clock
drain hangs the table), H14 (pins), H15 (broadcastOnce), M12 (clock removeChannel),
M13 (presence).

**T5. Per-character action advances the SHARED campaign clock.** Rest/Travel
each call `advanceClock` per PC, so a party-wide rest multiplies time and every
clock drainer (rations/infection/subsistence/heals) by party size. Compounded
by `advance()` being a non-atomic read-modify-write. Hits: H10, M5.

**T6. One concept, two divergent code paths.** The same rule implemented twice
with different math. Hits: H8 (upkeep floor), H9 (13-member boundary), M8 (two
Env Damage buttons), M2 (retention CMod slots).

---

## CRITICAL

**C1. [VERIFIED] `lib/data/characters.ts:37` - `updateCharacterDataField` swallows the read error, then whole-blob-writes the merge, destroying the character sheet.**
A failed/timed-out read of `characters.data` -> `existing` null -> `base = {}` ->
`merged = { ...patch }` -> the UPDATE replaces the ENTIRE `data` JSONB (name,
RAPID, skills, inventory, everything) with just the patch (e.g. `{ wp: 9 }`).
Exact class as yesterday's Feature Manifest bug, but on the character sheet.
Callers: `app/characters/page.tsx:51` (every between-session stat change) and
`lib/data/combat.ts:113` (Disarm). Fix: destructure `error`, abort the merge on
error (never write on a failed read). OWNER: **Puffer** (lib/data).

---

## HIGH

**H1. [VERIFIED] `app/stories/[id]/table/hooks/useRollResolution.ts:365` (dup :1907) - melee/unarmed damage uses the VIEWER's PHY, not the attacker's.**
`attackerPhy = myEntry?.character.data?.rapid?.PHY ?? 0`. Every GM-run NPC melee
attack and every GM-rolled PC attack computes damage with the wrong (or zero)
PHY. T3. OWNER: **HP**.

**H2. [VERIFIED] `useRollResolution.ts:591` - ranged ammo decrement targets the viewer's PC weapon slots, not the attacker.**
NPCs never decrement ammo (infinite ammo); worse, if the GM viewer's own PC
holds a same-named weapon, THAT PC's ammo is drained by the NPC's shots. Same
misattribution corrupts the Low-Insight jam path (:1202, jams the GM's PC) and
kill-credit (:755). T3. OWNER: **HP**.

**H3. [VERIFIED] `app/stories/[id]/table/page.tsx:5045` + gate at :8558 - post-hit Insight reroll re-applies full damage (double hit) and ignores armor.**
The Spend-Insight gate only hides rerolls on High/Low Insight, not on a Success
that already auto-applied damage. Player rerolls fishing for Wild Success, lands
another Success, and the reroll block subtracts full WP/RP a SECOND time. The
reroll damage calc also omits `armor`/`attackerCategory`, so it ignores worn
armor the original path applied. OWNER: **HP**.

**H4. [VERIFIED] `app/stories/[id]/table/page.tsx:4574` - Cover Fire's -2 CMod is written to the target's `aim_bonus`, then wiped before it can apply.**
Only readers of `aim_bonus` read the ACTIVE entry's; `activateUpdate` (:2423)
sets `aim_bonus: 0` when the target's turn starts. The penalty is erased with
zero effect on any roll, but the action is still consumed. Guaranteed no-op.
OWNER: **HP**.

**H5. [VERIFIED] `lib/upkeep.ts:54,58` - Wild Success / High Insight on a Pristine item DEGRADES it to Used.**
`Math.max(UPKEEP_FLOOR_IDX=1, safeIdx-1)` with Pristine at idx 0 pushes an
already-better item DOWN: a strictly better roll yields a strictly worse result
than a plain Success (which keeps Pristine). Live via useRollResolution.ts:1338.
Fix: `min(safeIdx, max(1, safeIdx-N))`. **The unit test pins the bug** - see M-test.
OWNER: **HP** (lib + hook).

**H6. [VERIFIED] `lib/modules.ts:1374` - `archiveModule` embeds `campaigns(user_id)`, a column that does not exist (schema has `gm_user_id`).**
PostgREST 400s, error swallowed, `notifyUserIds` empty -> subscribers NEVER get
the "module archived" notification, while the function returns success. T1.
OWNER: **Puffer** (lib).

**H7. [VERIFIED] `lib/setting-reseed.ts:120` - swallowed errors on the 4 existing-content reads feed a bulk insert.**
A failed read of existing pins/npcs/scenes/notes -> planner sees an empty
campaign -> lists every seed item as missing -> GM confirms (preview looks like
a fresh campaign) -> `applyReseedPlan` mass-inserts duplicates. T1. OWNER:
**Puffer** (lib).

**H8. [VERIFIED] `lib/campaign-clock.ts:530` - sickness Day-0 mortal drop skips the canon +1 Stress pip.**
Drops PC to `wp_current=0, death_countdown=max(1,4+PHY)` with no stress bump,
violating "entering WP=0 auto-fills 1 Stress (cap 5), on-entry." Every sibling
site applies it (drainSubsistenceDamage:391, gm_apply_damage RPC). No DB trigger
backfills it. OWNER: **HP/Puffer** (lib).

**H9. [VERIFIED] Community 13-member boundary has two definitions -> a promoted Group can be permanently unable to run the Weekly Check.**
Promotion counts PCs+NPCs combined (`CommunityPromoteBanner.tsx:31`
`combinedMemberCount`); the Weekly Check gate counts only `community_members`
rows (`CommunityMoraleModal.tsx:336` `members.length >= 13`). PCs are never
enrolled as member rows, so 4 PCs + 9 NPCs promotes but then the modal refuses
to roll ("only 9 members"). T6. OWNER: **HP**.

**H10. [VERIFIED] `components/CharacterCard.tsx:1293` (Rest) + :680 (Travel) - per-character action advances the shared campaign clock.**
Resting 4 PCs overnight calls `advanceClock(campaignId, 24)` x4 = +96h and runs
rations/infection/subsistence drainers 4x. T5. OWNER: **HP**.

**H11. [VERIFIED] `components/CharacterEvolution.tsx:221` - CDP deduct-then-apply with no rollback.**
Step 1 deducts CDP; if step 2 (the raise write) fails, CDP is gone and the stat
is unraised, no refund. Retry deducts again. Read-modify-write race on
`cdpBalance` snapshot too. T2. OWNER: **HP**.

**H12. [VERIFIED] `components/InventoryPanel.tsx:171` - give-to-NPC/community/vehicle fires the receiver write un-awaited, then decrements the giver unconditionally.**
Receiver write fails -> giver already decremented -> items vanish. Reverse
timing -> duplication. PC->PC is atomic via RPC precisely for this; the other
three targets never got it. T2. OWNER: **HP** (needs an RPC, Puffer can build it).

**H13. [VERIFIED] `lib/campaign-clock.ts:557` - `drainInfectionDays` reuses the table page's live `initiative_${id}` channel; advance hangs the table.**
`supabase.channel('initiative_'+id)` returns the page's already-subscribed
instance; `.subscribe(cb)` no-ops; the awaited Promise never resolves; the drain
stalls mid-row (pending-lasting-check never set, summary never written,
AdvanceTimeModal stuck). The `finally removeChannel` then tears down the page's
live initiative channel. Fires when an infection is severity='check' at Day 0.
T4. OWNER: **Puffer** (lib) - needs the same "reuse ref if present, else REST"
pattern GmNotes uses.

**H14. [VERIFIED-by-source-facts] `components/CampaignPins.tsx:169` + `CampaignMap.tsx:996` share the `campaign_pins_${id}` topic while co-mounted (the table page's default pairing).**
Second mount gets the first's channel: its SUBSCRIBED catch-up never fires and
its postgres binding is dead (or errors the shared channel via bindings
mismatch); first unmount `removeChannel`s the shared instance, killing the
survivor's `pins_changed` reception. Reintroduces the 2026-05-18 pin-sync
regression. T4. OWNER: **HP/Puffer** (rename one topic + adopt the shared hook).

**H15. [VERIFIED-by-source-facts] `lib/realtime/broadcastOnce.ts:29` + `app/vehicle/page.tsx:594,1003` - broadcastOnce on an already-subscribed topic never sends and never resolves.**
The vehicle popout's long-lived `tactical_${id}` channel is subscribed; the
firing-arc toggle (:1003, pure-broadcast, no postgres fallback) is a dead
cross-window feature; the post-dismount `await broadcastOnce` (:594) hangs.
broadcastOnce also never resolves on CHANNEL_ERROR/TIMED_OUT. T4. OWNER: **Puffer**
(lib) + **HP** (vehicle call sites).

**H16. [VERIFIED] `app/tools/token-creator/page.tsx:618` - the "Bulk Upload" tab has no Thriver gate and writes to the SHARED public portrait bank.**
Only the "Crop & Upload" tab is `isThriver`-gated; Bulk Upload is unconditional
and `handleBulkUploadAll` guards only `!userId`. Any signed-in user can inject
images into the official NPC portrait pool + bump the global counter. **RLS does
NOT backstop**: `portrait_bank` INSERT policy is `created_by = auth.uid() OR
is_thriver()` (schema.sql:2931) - a non-Thriver setting their own `created_by`
passes. OWNER: **HP** (add the gate) - genuine authz hole, not RLS-covered.

---

## MEDIUM

**M1. [VERIFIED] `components/CommunityMoraleModal.tsx:405,438,548` - a successful Retention Check cancels the failed Morale's departures and writes `members_after:0`.**
`departureIds` is emptied when `willDissolve` (dissolution handles members at
persist time); if Retention then SAVES the community, the departure branch sees
`[]` and removes nobody, though the failed Morale canonically costs 25/50/75%.
History row records `members_after:0` for a community that kept everyone. T6.
OWNER: **HP**.

**M2. [VERIFIED] `components/CommunityMoraleModal.tsx:463` - the Retention Check drops every CMod slot except Mood, contradicting the in-file spec.**
`total = dice + moraleAmod + retentionSmod + mood` omits Enough Hands, Clear
Voice, Safety, World Events, Additional. Well-staffed communities are penalized,
wrecked ones over-survive. OWNER: **HP**.

**M3. [VERIFIED] `app/stories/[id]/table/page.tsx:3970` - the recruit "Current group" default always inline-creates a NEW group.**
`openRecruitModal` resets `recruitCommunityId='__new__'` every open; the dropdown
default option is labeled "Current group" but maps to `__new__`, which
unconditionally INSERTs a new `communities` row. Three default recruits = three
identically-named one-member groups, none progressing to 13. Contradicts the
2026-06-12 "default to Current group" ship. OWNER: **HP**.

**M4. [VERIFIED] `lib/data/combat.ts:52` - `applyDamageToPc/Npc` ignore the write result, then emit death-countdown feed rows + return the optimistic patch.**
Write fails -> table + feed announce a death that never hit the DB -> reload
shows the target at full WP. Mid-combat desync. T2. OWNER: **Puffer** (lib).

**M5. [VERIFIED] `lib/campaign-clock.ts:56` - `advance()` is a non-atomic read-modify-write of `campaigns.clock`.**
Two concurrent advances both read day 5, both write day 6 -> 8h lost AND both
run the per-day drainers -> rations/infection decremented for 2 crossings on a
clock that moved 1 day. T5. OWNER: **Puffer** (lib) - needs a compare-and-set or
an RPC.

**M6. [VERIFIED] `lib/data/scenes.ts:17` - `ensurePartyOnScene` swallows the scene_tokens read error, then inserts.**
Read fails -> every PC classified "never placed" -> duplicate PC tokens inserted
at top-left on every scene switch during the outage. T1. OWNER: **Puffer** (lib).

**M7. [VERIFIED] `useRollResolution.ts:655,689` - mortal/incap transition mixes fresh-DB damage math with STALE local state for the "was >0" check.**
`newWP` uses `freshState`, but the transition guard reads
`targetEntry.liveState.wp_current` - so a cross-client heal/hit window either
misses the mortal transition (no countdown/stress ever) or double-fires it
(countdown reset + double stress). OWNER: **HP**.

**M8. [VERIFIED] `components/CharacterCard.tsx:531 vs :619` - two Env-Damage buttons with contradictory canon math.**
One applies flat `rounds*3` Drowning with no hold-breath window; the adjacent
one applies `drowningDamage(PHY, rounds)` = 0 inside the 6+PHY window. Same
event, opposite results; also breaks the locked single-"Env. Damage"-slot button
order; first writes no feed row. T6. OWNER: **HP**.

**M9. [VERIFIED] `lib/gm-kit.ts:54` - `exportGmKit` swallows pins/npcs/scenes/notes/tokens read errors and ships an "OK" zip with empty sections.**
GM downloads a believed-complete backup that's silently empty on a transient
read failure. T1. OWNER: **Puffer** (lib).

**M10. [VERIFIED] `lib/campaign-clock.ts` drainPendingHeals (~:660) - stamps a heal event applied when the character_states read returns falsy for ANY reason (incl. query error).**
Heal permanently consumed, WP never granted, no feed row, unrecoverable. T1.
OWNER: **Puffer** (lib).

**M11. [VERIFIED] `app/stories/[id]/table/page.tsx:10849` - barter trade applies PC write then NPC write with no rollback; `TradeNegotiationModal.tsx:365` allows unlimited free re-rolls.**
Mid-flow failure leaves a half-applied trade (duplication + loss). Dire Failure
can be re-rolled until it passes. T2. OWNER: **HP** (+ Puffer for a trade RPC).

**M12. [VERIFIED-by-source-facts] `lib/campaign-clock.ts:137,829` - `removeChannel` on the shared `campaign_clock_${id}` topic kills the campaign sheet's own live subscription.**
Advancing the clock FROM the campaign sheet tears down the sheet's
`clock_advanced` subscription from the first advance on. T4. OWNER: **Puffer** (lib).

**M13. [VERIFIED-by-source-facts] `lib/realtime/useGlobalPresence.ts:27` - tracker joins with presence disabled in the join payload + races Sidebar's teardown of the same topic.**
No `.on('presence')` binding / `config.presence.enabled` -> server treats the
channel presence-less; topic-reuse race can leave `track()` never running -> user
invisible in "Survivors present" for the whole session. T4. OWNER: **Puffer** (lib).

**M14. [VERIFIED] `app/stories/[id]/table/page.tsx:191-194` - broadcast payloads on the public `initiative_${id}` channel are fully trusted (no sender/role check).**
Channels aren't `private:true`; any authenticated user who obtains a campaign
UUID can broadcast `player_kicked` (force-redirect victims off the table),
`logs_cleared`, `recorder_stop` (force a dump download), or spam
`turn_advance_requested` (drive the GM's real nextTurn writes). OWNER: **Puffer**
(threat-model) + **HP** (add a GM/sender guard) - low exploit likelihood (needs
the UUID), real impact. Consider Supabase private channels + RLS.

**M15. [VERIFIED] `app/stories/join/page.tsx:56` + `app/join/[code]/page.tsx:45` - stuck-observer: an existing observer who re-joins via a normal invite stays an observer forever.**
The prior fix only handles player->observer UPGRADE; the 23505 branch never
clears a stale `observer=true`, and the deep-link route never touches the flag.
OWNER: **HP**.

**M16. [VERIFIED] `components/QuickAddModal.tsx:267,374` - pin/community attachment uploads bypass `prepareUpload`.**
No size cap, no MIME/extension whitelist, raw user filename in the storage path -
every other uploader guards the same bucket. OWNER: **HP**.

**M17. [VERIFIED] `lib/modules.ts:686` (snapshot) + `gm-kit.ts:62` - unbounded `select('*')` capped at PostgREST's 1000-row default silently truncates published module content / GM-kit exports.**
A campaign with >1000 scene_tokens/NPCs/pins publishes a truncated module
version; subscribers clone the truncated set and the update diff shows dropped
rows as "removed." OWNER: **Puffer** (lib) - add ranged pagination.

---

## LOW

**L1. `lib/modules.ts:1023` - `applyModuleUpdate` pins.added index-correlates inserted rows against the UNfiltered accepted list; one unresolvable xid shifts every subsequent mapping.** `cloneModuleIntoCampaign` solved this with a parallel array; the update path didn't. OWNER: Puffer.

**L2. `lib/npc-generator.ts:101` `d3()` = `Math.ceil(Math.random()*3)` returns 0 when random()===0 (should be 1-3); `d6()` two lines down is correct.** OWNER: Puffer/HP.

**L3. `lib/npc-generator.ts:273,280,287` - generated loaded-rounds (1d6-1) not clamped to the weapon's clip; a clip-2 shotgun spawns `ammoCurrent 5 / ammoMax 2`.** OWNER: HP.

**L4. `lib/modules.ts:1069+` - `applyModuleUpdate` matches changed rows with `.ilike('name', p.name)`; `%`/`_` in content names act as SQL wildcards (contained to same campaign+module stamp).** OWNER: Puffer.

**L5. `lib/data/scenes.ts:50` - `activateCampaignScene` deactivates-all then activates-one, both awaits unchecked; a partial failure leaves 0 or 2 active scenes.** OWNER: Puffer.

**L6. `components/CampaignCommunity.tsx:1456` - PC-leader departure detection matches `invited_by_user_id`, which founder rows never set; a founding leader who leaves keeps the leader seat dangling (Clear Voice CMod wrong).** OWNER: HP.

**L7. `app/characters/page.tsx:73` + schema - character delete leaves dangling `scene_tokens` rows (no FK, no app cleanup); CharacterCard fallback delete (:353) deletes with NO confirm when no `onDelete` prop is passed.** OWNER: HP + Puffer (FK).

**L8. `components/TacticalMap.tsx:761` + `NpcRoster.tsx:428` - unfiltered whole-table `scene_tokens`/`community_members` subs -> cross-campaign refetch storm at scale (both columns exist + are filterable).** OWNER: HP.

**L-test. `tests/lib/upkeep.test.ts:19` - the unit test ASSERTS the H5 bug ("Pristine -> Used (defensive)"). Any H5 fix must flip this assertion; the "improve 2 levels" HI case has no Pristine test.** OWNER: whoever fixes H5.

---

## Recommended fix order (by blast radius, toward Beta-500 stability)

1. **C1 + the T1 read-swallow cluster** (H6, H7, M6, M9, M10) - data-destroying
   or data-losing, mostly lib/data, Puffer-ownable, mechanical. One focused pass.
2. **T3 combat misattribution** (H1, H2) - wrong damage / infinite ammo is a
   core-table-loop correctness break; HP, one root fix in the hook.
3. **H3 + H4** - double-damage reroll and dead Cover Fire; HP, contained.
4. **T4 realtime channel-reuse** (H13, H14, H15, M12, M13) - H13 hangs the
   table; Puffer owns the lib fixes, HP the call sites.
5. **H5 + L-test** (upkeep degrade), **H8** (sickness stress), **H9** (13-member
   deadlock) - canon-correctness; HP.
6. **T2 non-atomic transfers** (H11, H12, M4, M11) - needs RPCs (Puffer builds,
   HP wires). Larger, schedule deliberately.
7. **H16 + M14 + M15 + M16** - authz/gating; HP + Puffer threat-model.
8. MEDIUM/LOW remainder as capacity allows.

No fixes applied in this pass. Next action: Puffer takes cluster 1 (C1 + T1)
immediately - it is the highest-severity, lowest-risk, in-lane batch.
