-- admin-users-with-login.sql
-- SECURITY DEFINER RPC that returns profiles + auth.users.last_sign_in_at
-- in one round trip for the /moderate user list. The client SDK can't
-- read auth.users directly, so we proxy the join through this function
-- and gate it on the caller being a Thriver.
--
-- Used by app/moderate/page.tsx (user list) and the new
-- app/moderate/users/[userId]/activity page (single-user header).
--
-- Idempotent — CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.admin_users_with_login()
RETURNS TABLE (
  id               uuid,
  username         text,
  email            text,
  role             text,
  created_at       timestamptz,
  suspended_until  timestamptz,
  suspended_reason text,
  last_sign_in_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(role) = 'thriver'
  ) THEN
    RAISE EXCEPTION 'forbidden: thriver role required';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.username,
         p.email,
         p.role,
         p.created_at,
         p.suspended_until,
         p.suspended_reason,
         u.last_sign_in_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_with_login() TO authenticated;

-- Single-user variant for the /moderate/users/[userId]/activity page header.
-- Same Thriver gate, same shape — just filtered to one row.

CREATE OR REPLACE FUNCTION public.admin_user_with_login(target_user_id uuid)
RETURNS TABLE (
  id               uuid,
  username         text,
  email            text,
  role             text,
  created_at       timestamptz,
  suspended_until  timestamptz,
  suspended_reason text,
  last_sign_in_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(role) = 'thriver'
  ) THEN
    RAISE EXCEPTION 'forbidden: thriver role required';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.username,
         p.email,
         p.role,
         p.created_at,
         p.suspended_until,
         p.suspended_reason,
         u.last_sign_in_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_with_login(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
