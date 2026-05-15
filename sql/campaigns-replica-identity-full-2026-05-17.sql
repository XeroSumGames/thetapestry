-- ============================================================
-- Set campaigns.REPLICA IDENTITY = FULL so realtime postgres_changes
-- events deliver the entire updated row, not just the changed columns
-- + primary key. With DEFAULT, jsonb columns (especially TOAST'd ones
-- like campaigns.vehicles) silently get dropped from payload.new
-- when other columns are also in the UPDATE - which is exactly what
-- happened to the vehicle popout: writes landed, no event fired the
-- vehicles field through to subscribers, players had to manually
-- refresh to see boarding take effect.
--
-- Matches the REPLICA IDENTITY FULL setting on scene_tokens and
-- campaign_npcs (both of which carry jsonb and rely on realtime).
-- Idempotent.
-- ============================================================

ALTER TABLE campaigns REPLICA IDENTITY FULL;
