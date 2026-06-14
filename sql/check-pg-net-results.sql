-- Check pg_net outbound request results for notify-thriver calls
SELECT id, status_code, response_body, created, error_msg
FROM net._http_response
WHERE url LIKE '%notify-thriver%'
ORDER BY created DESC LIMIT 10;

-- Also check app settings are configured
SELECT current_setting('app.settings.supabase_url', true) AS supabase_url,
       left(current_setting('app.settings.service_role_key', true), 8) || '...' AS service_role_key_prefix;
