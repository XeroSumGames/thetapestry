-- Read-only readiness probe: does THE ARENA have the fixtures the Phase 7
-- manual smoke (Sections A/C/E) needs? No writes.
-- Arena campaign id: 35ed2133-498a-43d2-bbd6-21da05233af2
-- GM (Xero) user id:  5806fd27-fcac-4163-b8a8-61476150962c
-- NOTE: map_pins is USER-scoped (user_id + lat/lng), not campaign-scoped -
-- its realtime channel is global. Section E creates its own pin anyway, so
-- the GM-pin count below is informational only.
select 'player_pcs (Section A: need >=1)'                  as item, count(*)::text as n
  from campaign_members where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2' and character_id is not null
union all
select 'npcs (Section A/C: need >=1)',                     count(*)::text
  from campaign_npcs where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'tactical_scenes (Section A3: need >=1)',           count(*)::text
  from tactical_scenes where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'scene_tokens on Arena scenes (need >=2)',          count(*)::text
  from scene_tokens st join tactical_scenes ts on st.scene_id = ts.id
  where ts.campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'GM map_pins (Section E: informational, test makes its own)', count(*)::text
  from map_pins where user_id = '5806fd27-fcac-4163-b8a8-61476150962c'
union all
select 'communities (Section D: need >=1)',                count(*)::text
  from communities where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'vehicles on Arena (Section B: need >=1 named)',    coalesce(jsonb_array_length(vehicles), 0)::text
  from campaigns where id = '35ed2133-498a-43d2-bbd6-21da05233af2';
