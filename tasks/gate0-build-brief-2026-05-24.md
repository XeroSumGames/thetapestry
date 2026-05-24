# Gate 0 build brief - phase7 A-F automation specifics (2026-05-24)

Build-ready extract for automating tasks/phase7-acceptance-2client-testplan.md.
Companion to task #13. All seeding/teardown hits the Supabase REST API with a
session bearer token (reuse e2e/_teardown.ts creds pattern); RLS is the backstop.
SUPABASE base = https://jbudzglgtxeoaufpejrv.supabase.co/rest/v1/.

## Realtime preconditions
- `useCampaignChannel(campaignId, cfg)` - channel `campaign_${id}` (overridable), subscribes once per id.
- `usePostgresSubscription(channelName, cfg)` - global single-table; `null` name = don't subscribe (gates "only while tab open"); resubscribes when name changes (the Section D seam).
- **Publication:** postgres_changes deliver NOTHING for a table not in `supabase_realtime`. The 2026-05-24 fix added community_stockpile_items, map_pins, community_members, advantages, campaign_notes, campaign_events. Already-published: campaign_npcs, campaign_pins, scene_tokens, tactical_scenes, npc_relationships.
- **BLOCKER: `whispers` is NOT in any ALTER PUBLICATION in sql/.** Section E whispers will be DEAD unless published via dashboard. Pre-flight probe pg_publication_tables; if absent, needs `ALTER PUBLICATION supabase_realtime ADD TABLE whispers` (GM/DB change - FLAG to Xero, do not auto-apply).

## SEEDING
### Vehicle (Section B) - via RPC, GM token
`POST /rpc/update_vehicle_in_campaign` args: `p_campaign_id` (uuid), `p_vehicle_id` (TEXT slug, e.g. "e2e-test-rig"), `p_new_vehicle` (jsonb). GUARD: `p_new_vehicle.id` MUST equal `p_vehicle_id`. Vehicle JSONB lives in `campaigns.vehicles` (array). Fields: id,name,type,rarity,size,speed,passengers,encumbrance,range,wp_max,wp_current,stress,fuel_max,fuel_current,three_words,notes,image_url,mounted_weapons[],cargo[]. Mounted weapon = `{name, notes}` (Show Arc keys off its index; broadcast `firing_arc_toggle:{vehicleName,weaponIdx}`).
**Teardown:** RPC can't remove. Capture `campaigns.vehicles` before, GM-token `PATCH /campaigns?id=eq.<id>` to restore the original array.

### Community (Section D) - GM token only
`POST /communities` (Prefer: return=representation). Required: `campaign_id`, `name`. Defaults: status 'forming', week_number 0, consecutive_failures 0. Teardown `DELETE /communities?id=eq.<id>` (cascades stockpile). Arena already has 1 community - only seed a NEW one for the resubscribe step.

### Stockpile item (Section D) - any campaign member
`POST /community_stockpile_items`. Required: `community_id`, `name`. Defaults qty 1 (CHECK >0), enc 0, rarity 'Common', custom false. UNIQUE(community_id,name,custom) - dup 409s. Teardown DELETE or cascade.

## SECTION SEAMS
- **A3 (automatable realtime slice):** token move/fog/initiative reflect in player window; chat <=2s; tactical-share toggle opens/closes player pane (`tactical_shared:{shared}`); background-then-return refetch, NO resubscribe console spam. Token move = `<canvas>` -> needs JS-eval bridge.
- **C (NPC reveal):** channel `npc_roster_${campaignId}`; subs campaign_npcs(filter campaign_id) + community_members(no filter, was dead pre-fix). Reveal flips `campaign_npcs.hidden_from_players` true->false (RLS visibility gate). Assert player roster shows/hides the NPC name <=2s.
- **D (HIGHEST VALUE):** channel `stockpile-${campaignId}-${ids.join('_')}` (null when 0 communities); filter `community_id=in.(${ids.join(',')})`. Steps: (1) deposit/INSERT propagates to other open panel; (2) qty UPDATE propagates; (3) CREATE a new community while panel open -> deposit into it STILL propagates (proves channel-name change + resubscribe with widened IN-filter). Step 3 is the single highest-value, most-regression-prone.
- **E (pins/whispers):** map_pins channel `map_pins_changes` (constant). whispers channel `whispers_feed`, ONLY mounts when sidebarTab==='whispers'. whispers insert {author_user_id==auth.uid(), content 1-500}; only Thrivers DELETE (GM=Thriver OK for teardown). map_pins insert {user_id,lat,lng,title,notes,pin_type('gm'|'rumor'|'private'),status('approved'|'pending'),category}.
- **B (vehicle, seeded):** board/disembark (`vehicle_updated:{vehicle_id}`); mounted attack to 0 actions -> turn auto-advance (`turn_advance_requested`); Show Arc (`firing_arc_toggle`); MOVE HERE/dismount (`token_moved`). Canvas bridge needed.
- **A2 + F (most fragile, LAST):** assert outcome-CLASS + itemized-CMod breakdown structure, NOT exact dice. F = wound a PC (WP>0) -> "is wounded and may have to deal with infection" feed row both windows DURING fight; End Combat -> infection MODAL on the WOUNDED owner's window. Clear infection_state first.

## DOM
Zero data-testids in source (all 20 hits are planning docs). Use text/role: "Start Combat"/"End Combat"/"Next Turn"; assert feed rows by substring; community/stockpile by item `name` text; pins by Leaflet popup title text. `<canvas>` token-move (B + A3) needs a JS-eval bridge or a behavior-preserving DOM overlay (task #5).

## RLS identity per seed
communities INSERT/DELETE = GM token; stockpile = any member; whispers insert = author's own token; map_pins = author's own user_id; vehicle RPC = GM (or member).

---

## CORRECTION (puffer-fish, 2026-05-23): `whispers` IS published - Section E is unblocked

The flagged "whispers not in supabase_realtime" blocker is a FALSE ALARM. Verified against the LIVE DB this turn: `whispers` IS in the publication (alongside map_pins + community_stockpile_items), and `npm run check:publication` is green. The inference came from grepping `sql/` for `ALTER PUBLICATION ADD TABLE whispers` and finding none - but publication membership was never in version control until this session (whispers was published live-only). Do NOT run `ALTER PUBLICATION ... ADD TABLE whispers` - it would error (already a member).

**Authoritative source going forward:** `sql/_baseline/publication.sql` (21 tables, committed) + `npm run check:publication`, NOT a grep of ad-hoc `sql/` files. This confusion is exactly the bug class infra-as-code Stage A1 just closed.

So Section E whispers is good on the publication front. If a whispers propagation test still fails, the cause is elsewhere (note the Phase 7 sheet: the whispers sub only mounts when the whispers tab is active - confirm the tab is open in both contexts) - triage to evidence, not a publication fix.
