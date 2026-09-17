-- LIVE BUG: non-Thrivers cannot create an LFG post AT ALL.
--
-- NOT YET APPLIED. Needs Xero's go, and carries a product question (below).
--
-- SYMPTOM, measured against prod by the E2E lane as `percy`:
--   HTTP 403  {"code":"42703","message":"record \"new\" has no field \"campaign_id\""}
--
-- CAUSE. `enforce_moderation_on_insert()` is ONE trigger function shared by
-- three tables. Thrivers take an early `RETURN NEW`. Everyone else falls
-- through to:
--
--     IF NEW.campaign_id IS NOT NULL THEN
--
-- plpgsql resolves `NEW.campaign_id` at RUNTIME, so a table without that
-- column only fails when a non-Thriver actually inserts. Confirmed by reading
-- pg_proc and by listing the trigger's tables against their columns:
--
--     forum_threads   campaign_id present   safe
--     war_stories     campaign_id present   safe
--     lfg_posts       campaign_id ABSENT    42703 for every non-Thriver
--
-- BLAST RADIUS: lfg_posts only, and total for the affected group. It is a
-- database trigger, so no UI path can route around it.
--
-- HOW LONG: measured on prod, lfg_posts holds ONE row ever, authored by a
-- Thriver. Zero posts by any of the 25 non-Thriver accounts. Consistent with
-- the feature never having worked for an ordinary user.
--
-- WHY IT SURVIVED: both existing E2E specs post as `gm`, who is a Thriver and
-- therefore takes the early return. The entire coverage of LFG posting ran on
-- the one account class the bug cannot reach. It surfaced only because the new
-- rate-limit spec needed an account no other spec posts with, and every free
-- account is a non-Thriver.
--
-- THE FIX. Guard the field reference instead of assuming the column. The
-- function's own semantics already decide the outcome: campaign scope means
-- auto-approved, no campaign scope means pending. A table with no campaign_id
-- column HAS no campaign scope, so it takes the existing ELSE branch. This is
-- not new behaviour - it is the behaviour the function already specifies,
-- reached without erroring.
--
-- `to_jsonb(NEW) ? 'campaign_id'` is preferred over TG_TABLE_NAME branching so
-- the rule stays about the SHAPE of the row rather than a hard-coded list of
-- table names that the next table to adopt this trigger would have to be added
-- to - which is the same class of mistake as the one being fixed.
--
-- PRODUCT QUESTION FOR XERO, which this file deliberately does NOT decide:
-- with this fix, a non-Thriver's LFG post is created as `pending`, so the
-- author sees it (lfg_select_own) but nobody else does until a Thriver
-- approves it. That unblocks posting but leaves LFG gated on moderation, and
-- LFG is how a player with no campaign finds a table. If he would rather LFG
-- posts from non-Thrivers were auto-approved, that is a one-word change to the
-- ELSE branch for this table and should be made deliberately, not inherited.

CREATE OR REPLACE FUNCTION public.enforce_moderation_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_thriver boolean;
  v_campaign_id uuid;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    -- Thriver inserts: respect status, but force approved_by to the
    -- real auth.uid() so a thriver cannot credit a different thriver.
    IF NEW.moderation_status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  -- Non-thriver inserts: scope decides moderation outcome.
  --
  -- This function is shared by tables that do NOT all carry campaign_id
  -- (lfg_posts does not), and plpgsql resolves NEW.<field> at runtime, so a
  -- bare NEW.campaign_id raises 42703 on those tables instead of behaving as
  -- "no campaign scope". Read it through to_jsonb so a missing column means
  -- absent rather than fatal.
  IF to_jsonb(NEW) ? 'campaign_id' THEN
    v_campaign_id := (to_jsonb(NEW) ->> 'campaign_id')::uuid;
  ELSE
    v_campaign_id := NULL;
  END IF;

  IF v_campaign_id IS NOT NULL THEN
    NEW.moderation_status := 'approved';
    NEW.approved_by := NULL;  -- system-approved by campaign-scope rule
    NEW.approved_at := now();
  ELSE
    NEW.moderation_status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- VERIFY AFTER APPLYING (as a non-Thriver, through PostgREST - not as the CLI
-- superuser role, which bypasses RLS and would prove nothing):
--   1. A non-Thriver INSERT into lfg_posts succeeds and returns a row.
--   2. That row's moderation_status is 'pending'.
--   3. A non-Thriver INSERT into forum_threads WITH a campaign_id is still
--      auto-approved - the branch that already worked must not regress.
--   4. A Thriver INSERT into lfg_posts is still approved on arrival.
