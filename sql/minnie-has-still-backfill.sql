-- minnie-has-still-backfill.sql
-- Stamps `has_still: true` onto every existing Minnie vehicle entry in
-- campaigns.vehicles so the Brew Check button shows up on the popout.
-- The campaign-creation seed (lib/setting-vehicles.ts) already includes
-- has_still for new campaigns; this is a one-shot for ones that were
-- seeded before the flag existed. Idempotent.

UPDATE campaigns
   SET vehicles = (
     SELECT jsonb_agg(
       CASE
         WHEN v->>'id' = 'minnie-001' OR v->>'name' = 'Minnie'
              THEN v || jsonb_build_object('has_still', true)
         ELSE v
       END
     )
     FROM jsonb_array_elements(vehicles) v
   )
 WHERE vehicles IS NOT NULL
   AND jsonb_typeof(vehicles) = 'array'
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(vehicles) v
     WHERE (v->>'id' = 'minnie-001' OR v->>'name' = 'Minnie')
       AND COALESCE((v->>'has_still')::boolean, false) IS DISTINCT FROM true
   );
