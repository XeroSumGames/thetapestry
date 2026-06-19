SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('portrait_bank','characters')
  AND column_name IN ('is_private','portrait_url')
ORDER BY table_name, column_name;
