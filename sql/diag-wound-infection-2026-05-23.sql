select created_at, outcome, character_name
from roll_log
where campaign_id = '35ed2133-498a-43d2-bbd6-21da05233af2'
  and outcome in ('combat_start','wound_infection_warning')
  and created_at >= '2026-05-23T21:40:00Z'
order by created_at asc;
