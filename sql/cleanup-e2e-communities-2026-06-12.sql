-- Preview: shows which community rows will be deleted before committing
SELECT id, name, campaign_id, status, created_at
FROM communities
WHERE name LIKE '[E2E]%'
   OR name LIKE 'E2E%'
   OR name LIKE '%Resub New%';

-- DELETE applied 2026-06-12:
DELETE FROM communities
WHERE name LIKE '[E2E]%'
   OR name LIKE 'E2E%'
   OR name LIKE '%Resub New%';
