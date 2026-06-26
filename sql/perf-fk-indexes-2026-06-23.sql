-- P1 from supabase-advisor-triage-2026-06-23.md: index the HOT unindexed foreign
-- keys (frequently filtered/joined, on growth tables, or hit by the RLS policy
-- subqueries added in rls-untrusted-user-hardening-2026-06-23.sql).
--
-- campaigns(gm_user_id) is the standout: every RLS policy added this session runs
-- `campaigns WHERE gm_user_id = auth.uid()`, so this one index serves all of them.
--
-- CONCURRENTLY so this stays lock-free when the tables are large (they're tiny in
-- beta, but the committed file should be safe to re-run at scale). CONCURRENTLY
-- cannot run inside a txn block - apply statement-by-statement, not wrapped.
-- The ~55 cold provenance/audit FKs (approved_by, created_by, ...) are a later batch.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_user_id             ON public.characters(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_states_user_id       ON public.character_states(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roll_log_user_id               ON public.roll_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_id          ON public.chat_messages(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_gm_user_id           ON public.campaigns(gm_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_members_character_id  ON public.campaign_members(character_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tactical_scenes_campaign_id    ON public.tactical_scenes(campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_campaign_id           ON public.sessions(campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_user_id        ON public.messages(sender_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_attachments_session_id ON public.session_attachments(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pregen_library_campaign_id     ON public.pregen_library(campaign_id);
