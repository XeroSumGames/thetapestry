-- Read-only readiness probe: does THE ARENA have the fixtures the Phase 7
-- manual smoke (Sections A/C/E + B/D) needs? No writes.
-- Arena campaign id: 35ed2133-498a-43d2-bbd6-21da05233af2
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
select 'map_pins (Section E: need >=1)',                   count(*)::text
  from map_pins where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'communities (Section D: need >=1)',                count(*)::text
  from communities where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
union all
select 'vehicles on Arena (Section B: need >=1 named)',    coalesce(jsonb_array_length(vehicles), 0)::text
  from campaigns where id = '35ed2133-498a-43d2-bbd6-21da05233af2';
