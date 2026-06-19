SELECT c.id, c.name, c.user_id, c.portrait_url, c.data->>'photoDataUrl' AS photo_data_url
FROM characters c
JOIN profiles p ON p.id = c.user_id
WHERE lower(c.name) LIKE '%vera%'
  AND lower(p.username) LIKE '%pesky%';
