# Testplan — Hide unrevealed NPCs from players

## What changed

Players were seeing every NPC in the GM's campaign roster the moment Start Combat fired (or the realtime sub delivered any campaign_npcs row). Root cause: the SELECT RLS policy on `campaign_npcs` granted any campaign member read access to every row.

This change adds a `hidden_from_players boolean NOT NULL DEFAULT true` column on `campaign_npcs`, replaces the SELECT policy so non-GMs only see `hidden_from_players = false`, and installs two AFTER INSERT triggers that auto-flip the flag to `false` whenever the NPC becomes visible by GM action:

- **`scene_token_reveals_npc`** on `scene_tokens` — placing an NPC token on a tactical map reveals the NPC.
- **`initiative_reveals_npc`** on `initiative_order` — adding an NPC to combat (rolled init or mid-combat add) reveals the NPC.

`NpcRoster.quickReveal` (the per-row Show/Hide button) now also flips the flag in lockstep with the per-PC `npc_relationships.revealed` rows, so the hard "exists at all to players" gate stays in sync with the granular per-PC reveal level.

`app/stories/[id]/table/page.tsx` — the `campaign_npcs` realtime handler now upserts on UPDATE (not just patches). A player whose RLS just gained access via a `hidden_from_players` flip needs the row added to local state, which a plain `.map()` would have silently dropped.

Existing campaigns: the migration backfills every row to `hidden_from_players = false` so in-progress campaigns keep their current visibility. The new default only affects NPCs created after the migration runs.

## Run-Me SQL

```
notepad C:\TheTapestry\sql\campaign-npcs-hidden-from-players.sql
```

Idempotent — safe to re-run. Without this, the new code paths still write `hidden_from_players` but the column doesn't exist and the UPDATE silently fails (Supabase will surface a 400 in the network tab). The triggers won't exist either, so place-on-map / start-combat reveal won't work.

## Test cases

### Setup
- A campaign with at least one player (non-GM) joined.
- Two browsers / two tabs / two profiles: GM tab and Player tab. Both on `/stories/<id>/table`.

### 1. New NPC defaults hidden
1. **GM tab** — open NpcRoster, click "+ Add NPC", create a new NPC (any name).
2. **Player tab** — open the NpcRoster panel (or whatever the player-side equivalent is). The new NPC should NOT appear.
3. Reopen in the **GM tab** — the new NPC IS visible (GM bypass).

**Expected:** new NPC invisible to player, visible to GM.

### 2. Place-on-map reveals
1. **GM tab** — with combat OFF, click the Map button on the new NPC's row to place its token on the active tactical scene.
2. **Player tab** — the NPC should now appear in lists / on the map.

**Expected:** placing the token flipped `hidden_from_players=false` via the trigger; the realtime UPDATE delivered the row to the player and the upsert added it to local state.

### 3. Start Combat reveals
1. **GM tab** — create a fresh hidden NPC (test 1 again).
2. **GM tab** — click "Fight" on that NPC (adds to initiative without placing on map).
3. **Player tab** — the NPC should appear once the initiative entry inserts.

**Expected:** initiative trigger flipped the flag; player sees them in initiative bar + roster.

### 4. Manual Show/Hide button toggles flag
1. **GM tab** — create a fresh hidden NPC.
2. **GM tab** — click "Show" on the row.
3. **Player tab** — NPC appears.
4. **GM tab** — click "Hide" on the same row.
5. **Player tab** — refresh. NPC should be gone (the realtime UPDATE may not auto-remove from local state — refresh is the reliable check here).

**Expected:** Show flips `hidden_from_players=false`, Hide flips it back to `true`.

### 5. Existing NPCs stay visible (backfill check)
1. Pick an NPC that existed before this migration applied (any campaign with old NPCs).
2. **Player tab** — verify they still see those NPCs as before.

**Expected:** the one-shot backfill set `hidden_from_players=false` for every pre-existing row.

### 6. NPC popout deep-link is gated
1. **Player tab** — open the URL `/npc-sheet?n=<HIDDEN_NPC_ID>&c=<CAMPAIGN_ID>` directly (paste in address bar). Use a hidden NPC's UUID (cheat: read it from the GM tab's URL or DB).
2. **Expected:** Page renders "NPC not found." instead of leaking the NPC's stats. RLS on `maybeSingle` returns null.

### 7. GM-side smoke
1. Verify the GM still sees every NPC (hidden + revealed) in NpcRoster.
2. Verify the realtime patches still apply for damage/disposition changes (no regression — the upsert change preserves the patch path).

## Watch for

- **Console warnings** — `[campaign_npcs] pgchange UPDATE` messages still fire normally on the player side when a hidden NPC becomes visible. No change.
- **Supabase logs** — the trigger UPDATEs run as the GM (the user inserting the scene_token / initiative_order). No SECURITY DEFINER, so RLS still applies. The existing `Campaign members update campaign_npcs` policy permits this.
- **Realtime backlog** — if the publication wasn't already including `campaign_npcs`, run `sql/campaign-npcs-realtime-publication.sql`. The handoff says this is already in place.
