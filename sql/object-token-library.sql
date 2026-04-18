-- Campaign-scoped library of uploaded object-token images.
-- Every upload (via the "Upload new image" path in the Add/Edit Object flows)
-- writes a row here so the image can be reused on future tokens instead of
-- re-uploaded. Library rows mirror what's in the object-tokens storage bucket.

CREATE TABLE IF NOT EXISTS public.object_token_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_object_token_library_campaign
  ON public.object_token_library(campaign_id, created_at DESC);

ALTER TABLE public.object_token_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_select" ON public.object_token_library;
DROP POLICY IF EXISTS "library_insert" ON public.object_token_library;
DROP POLICY IF EXISTS "library_delete" ON public.object_token_library;

-- Campaign members (GM or accepted members) can read their campaign's library.
CREATE POLICY "library_select"
ON public.object_token_library
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = object_token_library.campaign_id
      AND (
        c.gm_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
        )
      )
  )
);

-- Only GM inserts (avoids randoms uploading). Could relax later.
CREATE POLICY "library_insert"
ON public.object_token_library
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = object_token_library.campaign_id AND c.gm_user_id = auth.uid()
  )
);

-- Only GM can delete library entries.
CREATE POLICY "library_delete"
ON public.object_token_library
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = object_token_library.campaign_id AND c.gm_user_id = auth.uid()
  )
);
