-- Many-to-many: one pregen can appear in multiple stories/campaigns.
-- Replaces the single campaign_id FK as the source of truth for which
-- campaigns a pregen belongs to (campaign_id stays on pregen_library
-- for backward compat with snapshot/clone flow).

CREATE TABLE IF NOT EXISTS pregen_campaign_map (
  pregen_id   uuid NOT NULL REFERENCES pregen_library(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  PRIMARY KEY (pregen_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_pregen_campaign_map_campaign ON pregen_campaign_map(campaign_id);

-- Seed the join table from existing pregen_library.campaign_id values.
INSERT INTO pregen_campaign_map (pregen_id, campaign_id)
SELECT id, campaign_id
FROM pregen_library
WHERE campaign_id IS NOT NULL
ON CONFLICT DO NOTHING;
