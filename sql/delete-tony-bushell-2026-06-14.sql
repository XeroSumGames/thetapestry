-- Delete test account tony_bushell@yahoo.com so the email can be reused
-- Profiles cascade-delete via FK; auth.users is the root.
DELETE FROM auth.users WHERE email = 'tony_bushell@yahoo.com';
