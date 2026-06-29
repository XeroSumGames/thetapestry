-- ============================================================================
-- DO NOT APPLY YET. Apply ONLY after HP rewires the email + invite_code readers
-- (handoff-hp-pii-revokes-2026-06-23.md). Applying before the rewire breaks the
-- account page, bug report, moderation, the join-by-code flow, and the GM invite
-- display - they'd hit "permission denied for column". PF applies this on HP's go.
-- ============================================================================
--
-- profiles + campaigns both have TABLE-level SELECT granted to anon+authenticated,
-- so a column-level REVOKE SELECT(col) is a no-op. The correct way to hide ONE
-- column is: revoke table SELECT, then re-grant SELECT on every column EXCEPT the
-- sensitive one. RLS still gates rows on top of this; this only removes the
-- column from the grant so PostgREST can't return it.
--
-- After this, the legit reads go through the definer RPCs already shipped:
--   email      -> public.get_profile_email(uuid)        (own / thriver)
--   invite_code-> public.get_campaign_invite_code(uuid) (GM/member display)
--                 public.find_campaign_by_invite_code(text) (join-by-code)

-- profiles.email -------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, created_at, role, suspended, onboarded, avatar_url,
              suspended_until, suspended_reason, tableau_role)
  ON public.profiles TO anon, authenticated;

-- campaigns.invite_code ------------------------------------------------------
REVOKE SELECT ON public.campaigns FROM anon, authenticated;
GRANT SELECT (id, name, description, setting, gm_user_id, status, created_at,
              session_status, session_count, session_started_at, map_style,
              map_center_lat, map_center_lng, vehicles, last_accessed_at, clock,
              start_canon_day, cover_image_url)
  ON public.campaigns TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
