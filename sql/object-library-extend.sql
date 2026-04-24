-- object-library-extend.sql
-- Extends object_token_library to store full object metadata so GMs can
-- build their object roster without an active scene. Existing rows are
-- unaffected (metadata stays null = image-only library entry).
ALTER TABLE public.object_token_library
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.object_token_library.metadata IS
  'Full object template data stored when the GM adds an object with no active
   scene. Shape: { icon: string, wp_max: number|null, indestructible: boolean,
   properties: TokenProperty[], contents: ContentItem[] }. Null for image-only
   library entries added via the Upload path.';

-- Allow UPDATE so the GM can edit a staged library template.
DROP POLICY IF EXISTS "library_update" ON public.object_token_library;
CREATE POLICY "library_update"
ON public.object_token_library
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = object_token_library.campaign_id AND c.gm_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = object_token_library.campaign_id AND c.gm_user_id = auth.uid()
  )
);
