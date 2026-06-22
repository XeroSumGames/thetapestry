SELECT COUNT(*) AS rows_to_backfill
FROM characters
WHERE portrait_url IS NULL
  AND data->>'photoDataUrl' IS NOT NULL;
