-- Add in-app notification bell entries for every Thriver on new bug reports.
-- Previously only emailed via call_notify_thriver(); email still fires but
-- the bell was silent. Same pattern extended to all moderation triggers.
--
-- Apply: npx supabase db query --linked -f sql/bug-report-inapp-notification-2026-06-14.sql

-- ── bug_reports ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_bug_report()
RETURNS trigger AS $$
DECLARE
  v_label   text;
  v_body    text;
  v_thriver RECORD;
BEGIN
  v_label := COALESCE(NULLIF(NEW.reporter_name, ''), NULLIF(NEW.reporter_email, ''), 'Anonymous');
  v_body := v_label || ' reported a bug at ' || COALESCE(NEW.page_url, '(no URL)') || E'\n\n' || COALESCE(NEW.description, '(no description)');

  -- In-app notification for every Thriver
  FOR v_thriver IN SELECT id FROM profiles WHERE role = 'thriver' LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_thriver.id, 'moderation_bug', 'Bug Report', v_label || ': ' || left(COALESCE(NEW.description, ''), 120), '/moderate?tab=bugs');
  END LOOP;

  -- Email via Edge Function (requires app.settings.supabase_url configured)
  PERFORM call_notify_thriver('moderation_bug', 'New Bug Report', v_body, '/moderate?tab=bugs');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── modules ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_module_submission()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body     text;
  v_thriver  RECORD;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a module: ' || COALESCE(NEW.name, 'Untitled');

  FOR v_thriver IN SELECT id FROM profiles WHERE role = 'thriver' LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_thriver.id, 'moderation_module', 'New Module in Queue', v_body, '/moderate?tab=modules');
  END LOOP;

  PERFORM call_notify_thriver('moderation_module', 'New Module in Queue', v_body, '/moderate?tab=modules');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── war_stories ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_war_story_submission()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body     text;
  v_thriver  RECORD;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a war story: ' || COALESCE(NEW.title, 'Untitled');

  FOR v_thriver IN SELECT id FROM profiles WHERE role = 'thriver' LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_thriver.id, 'moderation_war_story', 'New War Story in Queue', v_body, '/moderate?tab=war-stories');
  END LOOP;

  PERFORM call_notify_thriver('moderation_war_story', 'New War Story in Queue', v_body, '/moderate?tab=war-stories');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── lfg_posts ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_lfg_post()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body     text;
  v_thriver  RECORD;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' posted to LFG: ' || COALESCE(NEW.title, 'Untitled');

  FOR v_thriver IN SELECT id FROM profiles WHERE role = 'thriver' LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_thriver.id, 'moderation_lfg', 'New LFG Post in Queue', v_body, '/moderate?tab=lfg');
  END LOOP;

  PERFORM call_notify_thriver('moderation_lfg', 'New LFG Post in Queue', v_body, '/moderate?tab=lfg');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── forum_threads ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_forum_thread()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body     text;
  v_thriver  RECORD;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.author_user_id;
  v_body := COALESCE(v_username, 'Someone') || ' started a forum thread: ' || COALESCE(NEW.title, 'Untitled');

  FOR v_thriver IN SELECT id FROM profiles WHERE role = 'thriver' LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_thriver.id, 'moderation_forum', 'New Forum Thread in Queue', v_body, '/moderate?tab=forums');
  END LOOP;

  PERFORM call_notify_thriver('moderation_forum', 'New Forum Thread in Queue', v_body, '/moderate?tab=forums');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
