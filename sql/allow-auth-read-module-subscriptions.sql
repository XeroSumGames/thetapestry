-- Allow any authenticated user to read module_subscriptions.
-- Motivation: the join page (pre-membership) calls getCampaignModuleCover to show
-- the invite card cover image. The old policy only allowed GM / module-author / Thriver,
-- which blocked the cover lookup for a player who hasn't joined yet.
-- "Which module a campaign uses" is not sensitive - it's effectively public campaign metadata.

DROP POLICY IF EXISTS module_subscriptions_read ON module_subscriptions;

CREATE POLICY module_subscriptions_read ON module_subscriptions
  FOR SELECT USING (auth.uid() IS NOT NULL);
