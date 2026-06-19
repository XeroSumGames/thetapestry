-- Sync Vera Jarn's portrait to any live scene tokens and initiative order entries
-- that were placed before her portrait was set.
UPDATE scene_tokens
SET portrait_url = 'https://jbudzglgtxeoaufpejrv.supabase.co/storage/v1/object/public/portrait-bank/woman/256/NPC-WOMAN-027.jpg'
WHERE character_id = '17170a17-5a72-4c46-8683-762d8ad3b341';

UPDATE initiative_order
SET portrait_url = 'https://jbudzglgtxeoaufpejrv.supabase.co/storage/v1/object/public/portrait-bank/woman/256/NPC-WOMAN-027.jpg'
WHERE character_id = '17170a17-5a72-4c46-8683-762d8ad3b341';
