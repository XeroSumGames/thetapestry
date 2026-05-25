-- Notification deep-links pointed at /campaigns/<id>[/table], but the app has
-- no /campaigns route (it lives under /stories), so clicking a notification
-- (session opened, player joined, character changed) 404'd. APPLIED LIVE
-- 2026-05-25.
--
-- Surgical fix: re-create every function whose body references /campaigns/
-- from its LIVE definition, swapping only the link prefix (no logic change,
-- catches notify_character_changed which had no standalone source file), then
-- backfill the 424 existing notification rows.
DO $$
DECLARE r record; def text;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE prosrc LIKE '%/campaigns/%' LOOP
    def := replace(pg_get_functiondef(r.oid), '/campaigns/', '/stories/');
    EXECUTE def;
  END LOOP;
END $$;

UPDATE notifications SET link = replace(link, '/campaigns/', '/stories/')
WHERE link LIKE '/campaigns/%';
