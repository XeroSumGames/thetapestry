-- Backfill portrait_url on characters that were created from a pregen
-- but before the fix that wrote portrait_url on insert.
-- Matches by name (pregen names are canonical per campaign) and only
-- touches rows that currently have no portrait.
UPDATE characters c
SET portrait_url = pl.portrait_url
FROM pregen_library pl
WHERE c.name = pl.name
  AND c.portrait_url IS NULL
  AND pl.portrait_url IS NOT NULL;
