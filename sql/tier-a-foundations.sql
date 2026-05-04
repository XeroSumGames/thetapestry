-- tier-a-foundations.sql
-- Three plumbing pieces for Tier A (50-100 invited testers):
--
--   1. Invite-code signup gate — table + atomic redemption RPC.
--      Schema only at this point; enforcement at the /signup UI is a
--      separate code change so this can ship without disrupting any
--      currently-mid-flight signup.
--
--   2. Rate limits — generic table + helper RPC. Per-user-per-hour
--      counter, callable from RLS policies via WITH CHECK
--      check_rate_limit('whisper', 60). Wiring to specific tables
--      lands in follow-up SQL after we've seen the schema doesn't
--      break anything.
--
--   3. Account suspension — profiles.suspended_until + helper
--      function is_user_suspended(). Same plumbing-first pattern;
--      RLS wiring on individual tables is incremental.
--
-- Idempotent — safe to re-run.

-- ── 1. Invite codes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signup_codes (
  code            text PRIMARY KEY,
  max_uses        int NOT NULL DEFAULT 1,
  used_count      int NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz,
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signup_codes_select ON public.signup_codes;
CREATE POLICY signup_codes_select ON public.signup_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS signup_codes_insert ON public.signup_codes;
CREATE POLICY signup_codes_insert ON public.signup_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS signup_codes_update ON public.signup_codes;
CREATE POLICY signup_codes_update ON public.signup_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Atomic redeem: returns true on success, false if invalid/exhausted/
-- expired. SECURITY DEFINER so it can read + update the row even
-- when the caller is the unauthenticated signup flow (auth.uid()
-- IS NULL during signUp). Caller passes the code; we increment
-- used_count if there's room.
CREATE OR REPLACE FUNCTION public.redeem_signup_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row signup_codes%ROWTYPE;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN false;
  END IF;
  -- Lock the row so concurrent redeems don't both succeed past max_uses.
  SELECT * INTO v_row FROM signup_codes WHERE code = trim(p_code) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN RETURN false; END IF;
  IF v_row.used_count >= v_row.max_uses THEN RETURN false; END IF;
  UPDATE signup_codes SET used_count = used_count + 1 WHERE code = v_row.code;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_signup_code(text) TO anon, authenticated;

-- ── 2. Rate limits ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id      uuid NOT NULL,
  action       text NOT NULL,
  hour_bucket  timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket
  ON public.rate_limits (hour_bucket);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct read/write — this table is owned by the helper RPC.
DROP POLICY IF EXISTS rate_limits_select ON public.rate_limits;
CREATE POLICY rate_limits_select ON public.rate_limits
  FOR SELECT TO authenticated USING (false);

-- Increments the (user, action, current-hour) counter and returns
-- true if the new count is ≤ p_max_per_hour, false otherwise. RLS
-- predicates wrap this — a row that fails the rate-limit check is
-- rejected at the WITH CHECK boundary so the user never sees a
-- partial insert.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action text, p_max_per_hour int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bucket timestamptz := date_trunc('hour', now());
  v_new_count int;
BEGIN
  -- Anonymous callers (no auth.uid()) can't be rate-limited per-user;
  -- treat them as unrestricted for plumbing simplicity. The signup
  -- flow + bug-report-from-ghost paths rely on this.
  IF v_user IS NULL THEN RETURN true; END IF;
  INSERT INTO rate_limits (user_id, action, hour_bucket, count)
    VALUES (v_user, p_action, v_bucket, 1)
    ON CONFLICT (user_id, action, hour_bucket)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count INTO v_new_count;
  RETURN v_new_count <= p_max_per_hour;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int) TO authenticated;

-- Daily cleanup of old buckets — keeps the table small. Buckets older
-- than 24h are useless (we only check the current hour).
CREATE OR REPLACE FUNCTION public.rate_limits_purge_old()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM rate_limits WHERE hour_bucket < now() - interval '1 day';
END;
$$;

-- ── 3. Account suspension ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE OR REPLACE FUNCTION public.is_user_suspended()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND suspended_until IS NOT NULL
      AND suspended_until > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_suspended() TO authenticated;

NOTIFY pgrst, 'reload schema';
