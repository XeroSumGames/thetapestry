-- One-time backfill: copy legacy portrait from data->>'photoDataUrl' into
-- the portrait_url column for any character where the column is still null.
--
-- Characters built before the portrait_url column existed store their photo
-- as data->>'photoDataUrl' inside the JSON blob. The app-layer fallback in
-- lib/data/characters.ts getCharacterPortraits() handles the split at read
-- time, but this migration consolidates storage so the fallback never fires.
--
-- Safe to re-run: the WHERE clause is idempotent (only touches rows where
-- portrait_url IS NULL and the JSON field has a value).

UPDATE characters
SET portrait_url = data->>'photoDataUrl'
WHERE portrait_url IS NULL
  AND data->>'photoDataUrl' IS NOT NULL;
