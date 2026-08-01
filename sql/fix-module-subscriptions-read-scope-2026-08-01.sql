-- Fix: module_subscriptions_read was widened from "campaign GM / module
-- author / Thriver" to bare (auth.uid() IS NOT NULL) - sql/allow-auth-
-- read-module-subscriptions.sql, motivated by the pre-membership join
-- page needing to show a campaign's module cover image before the
-- visitor has joined. That's a real need, but the fix over-granted: any
-- signed-in user can currently read every module_subscriptions row
-- platform-wide (campaign_id, module_id, current_version_id, status,
-- subscribed_at) for every campaign that's ever subscribed to a module,
-- not just the one campaign_id a join-page visit is actually about.
-- Practical exploitability is low (campaign_id is an unguessable UUID)
-- but it's a broader grant than the actual need, and the "not sensitive"
-- judgment applies to the module's cover image, not to enumerating every
-- campaign-to-module mapping on the platform.
--
-- Fix: revert the table-level SELECT policy to the original scoped rule
-- (GM of the campaign, regular member of the campaign, the module's
-- author, or a Thriver) and add a narrow SECURITY DEFINER RPC that
-- returns just the cover_image_url for one campaign's active module
-- subscription - which is all the pre-membership join page actually
-- needs, and is safe to expose unconditionally to any authenticated
-- caller since it leaks nothing but a public-facing cover image.

BEGIN;

DROP POLICY IF EXISTS module_subscriptions_read ON public.module_subscriptions;
CREATE POLICY module_subscriptions_read ON public.module_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns c WHERE c.id = module_subscriptions.campaign_id AND c.gm_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = module_subscriptions.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM modules m WHERE m.id = module_subscriptions.module_id AND m.author_user_id = auth.uid())
    OR is_thriver()
  );

CREATE OR REPLACE FUNCTION public.get_campaign_module_cover(p_campaign_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT m.cover_image_url
  FROM public.module_subscriptions ms
  JOIN public.modules m ON m.id = ms.module_id
  WHERE ms.campaign_id = p_campaign_id AND ms.status = 'active'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_campaign_module_cover(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_campaign_module_cover(uuid) TO authenticated;

COMMIT;
