-- H-SCALE-1 (corrected): the 3 unfiltered realtime subs (scene_tokens,
-- npc_relationships, community_members) can't be campaign-scoped because none
-- had a campaign_id column. Denormalize one onto each (backfill from the parent
-- + BEFORE INSERT trigger to maintain), so the client subscription can add
-- `filter: campaign_id=eq.<id>` exactly like the 6 already-working filtered subs.
--
-- Safe by precedent: character_states already filters by campaign_id on an
-- event:'*' sub with default(pk) replica identity and works; scene_tokens +
-- npc_relationships are REPLICA IDENTITY FULL anyway. Additive nullable column
-- + trigger -> existing inserts keep working (trigger fills the value).
-- Idempotent. Reversible (drop column/trigger).

-- ── scene_tokens <- tactical_scenes(scene_id).campaign_id (the chatty one) ──
ALTER TABLE public.scene_tokens ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
UPDATE public.scene_tokens st SET campaign_id = ts.campaign_id
  FROM public.tactical_scenes ts WHERE ts.id = st.scene_id AND st.campaign_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_scene_tokens_campaign_id ON public.scene_tokens(campaign_id);
CREATE OR REPLACE FUNCTION public.set_scene_token_campaign_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.campaign_id IS NULL AND NEW.scene_id IS NOT NULL THEN
    SELECT campaign_id INTO NEW.campaign_id FROM public.tactical_scenes WHERE id = NEW.scene_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_scene_token_campaign_id ON public.scene_tokens;
CREATE TRIGGER trg_scene_token_campaign_id BEFORE INSERT ON public.scene_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_scene_token_campaign_id();

-- ── npc_relationships <- campaign_npcs(npc_id).campaign_id ──────────────────
ALTER TABLE public.npc_relationships ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
UPDATE public.npc_relationships nr SET campaign_id = cn.campaign_id
  FROM public.campaign_npcs cn WHERE cn.id = nr.npc_id AND nr.campaign_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_npc_relationships_campaign_id ON public.npc_relationships(campaign_id);
CREATE OR REPLACE FUNCTION public.set_npc_relationship_campaign_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.campaign_id IS NULL AND NEW.npc_id IS NOT NULL THEN
    SELECT campaign_id INTO NEW.campaign_id FROM public.campaign_npcs WHERE id = NEW.npc_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_npc_relationship_campaign_id ON public.npc_relationships;
CREATE TRIGGER trg_npc_relationship_campaign_id BEFORE INSERT ON public.npc_relationships
  FOR EACH ROW EXECUTE FUNCTION public.set_npc_relationship_campaign_id();

-- ── community_members <- communities(community_id).campaign_id ──────────────
ALTER TABLE public.community_members ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
UPDATE public.community_members cm SET campaign_id = co.campaign_id
  FROM public.communities co WHERE co.id = cm.community_id AND cm.campaign_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_campaign_id ON public.community_members(campaign_id);
CREATE OR REPLACE FUNCTION public.set_community_member_campaign_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.campaign_id IS NULL AND NEW.community_id IS NOT NULL THEN
    SELECT campaign_id INTO NEW.campaign_id FROM public.communities WHERE id = NEW.community_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_community_member_campaign_id ON public.community_members;
CREATE TRIGGER trg_community_member_campaign_id BEFORE INSERT ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.set_community_member_campaign_id();
