-- ============================================================
-- Email Thrivers immediately on every moderation event
--
-- Existing triggers only covered new survivors, world pins, world
-- NPCs, and world communities. Bugs, modules, forum threads, LFG
-- posts, and war stories landed in the moderation queue with no
-- email - the Thrivers had to remember to check /moderate. This
-- fills those gaps using the existing call_notify_thriver() helper
-- (which posts to the notify-thriver edge function → Resend).
--
-- Strategy: for content tables that have a moderation_status column
-- (modules / war_stories / lfg_posts / forum_threads), only fire
-- when status = 'pending' on insert. Thrivers' own posts auto-
-- approve (status='approved' from the start), so they never trigger
-- a notification. bug_reports has no auto-approve concept; every
-- insert notifies.
--
-- Idempotent. Run via Supabase SQL Editor or
-- `npx supabase db query --linked -f sql/notify-thriver-moderation-events-2026-05-17.sql`.
-- ============================================================

-- ── bug_reports ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_bug_report()
RETURNS trigger AS $$
DECLARE
  v_label text;
  v_body text;
BEGIN
  v_label := COALESCE(NULLIF(NEW.reporter_name, ''), NULLIF(NEW.reporter_email, ''), 'Anonymous');
  v_body := v_label || ' reported a bug at ' || COALESCE(NEW.page_url, '(no URL)') || E'\n\n' || COALESCE(NEW.description, '(no description)');
  PERFORM call_notify_thriver('moderation_bug', 'New Bug Report', v_body, '/moderate?tab=bugs');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bug_report_notify ON bug_reports;
CREATE TRIGGER trg_bug_report_notify
AFTER INSERT ON bug_reports
FOR EACH ROW EXECUTE FUNCTION notify_new_bug_report();

-- ── modules ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_module_submission()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a module: ' || COALESCE(NEW.name, 'Untitled');
  PERFORM call_notify_thriver('moderation_module', 'New Module in Queue', v_body, '/moderate?tab=modules');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_module_submission_notify ON modules;
CREATE TRIGGER trg_module_submission_notify
AFTER INSERT ON modules
FOR EACH ROW EXECUTE FUNCTION notify_new_module_submission();

-- ── war_stories ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_war_story_submission()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a war story: ' || COALESCE(NEW.title, 'Untitled');
  PERFORM call_notify_thriver('moderation_war_story', 'New War Story in Queue', v_body, '/moderate?tab=war-stories');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_war_story_submission_notify ON war_stories;
CREATE TRIGGER trg_war_story_submission_notify
AFTER INSERT ON war_stories
FOR EACH ROW EXECUTE FUNCTION notify_new_war_story_submission();

-- ── lfg_posts ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_lfg_post()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' posted to LFG: ' || COALESCE(NEW.title, 'Untitled');
  PERFORM call_notify_thriver('moderation_lfg', 'New LFG Post in Queue', v_body, '/moderate?tab=lfg');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lfg_post_notify ON lfg_posts;
CREATE TRIGGER trg_lfg_post_notify
AFTER INSERT ON lfg_posts
FOR EACH ROW EXECUTE FUNCTION notify_new_lfg_post();

-- ── forum_threads ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_forum_thread()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' started a forum thread: ' || COALESCE(NEW.title, 'Untitled');
  PERFORM call_notify_thriver('moderation_forum', 'New Forum Thread in Queue', v_body, '/moderate?tab=forums');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_forum_thread_notify ON forum_threads;
CREATE TRIGGER trg_forum_thread_notify
AFTER INSERT ON forum_threads
FOR EACH ROW EXECUTE FUNCTION notify_new_forum_thread();
