-- Fact-check the 2026-05-24 Arena smoke failures (read-only).
-- Arena: 35ed2133-498a-43d2-bbd6-21da05233af2
-- B: was there a vehicle to even test Show Arc / MOVE HERE?
select 'B: vehicles on Arena' as probe, coalesce(jsonb_array_length(vehicles),0)::text as val
  from campaigns where id='35ed2133-498a-43d2-bbd6-21da05233af2'
union all
-- D: did the new community get created? how many communities now?
select 'D: communities on Arena', count(*)::text
  from communities where campaign_id='35ed2133-498a-43d2-bbd6-21da05233af2'
union all
-- D: did the stockpile deposit actually persist (vs just not propagate)?
select 'D: stockpile items on Arena communities', count(*)::text
  from community_stockpile_items csi
  join communities c on csi.community_id = c.id
  where c.campaign_id='35ed2133-498a-43d2-bbd6-21da05233af2'
union all
-- F: did wound-infection WARNING/resolution rows get WRITTEN to the feed?
-- (the bisect: rows present => logging worked, broadcast/modal is the bug;
--  no rows => logging itself didn't queue/write)
select 'F: infection/wound roll_log rows last 3h', count(*)::text
  from roll_log
  where campaign_id='35ed2133-498a-43d2-bbd6-21da05233af2'
    and created_at > now() - interval '3 hours'
    and (label ilike '%infect%' or label ilike '%wound%');
