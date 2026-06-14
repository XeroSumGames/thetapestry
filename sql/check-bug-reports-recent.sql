-- Check recent bug reports and Thriver email in profiles
SELECT id, reporter_name, reporter_email, page_url, created_at FROM bug_reports ORDER BY created_at DESC LIMIT 5;
SELECT email, role FROM profiles WHERE role = 'thriver';
