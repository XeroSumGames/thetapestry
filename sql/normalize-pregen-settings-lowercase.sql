-- Normalize all pregen_library.setting values to lowercase
-- so they match campaign.setting which is stored lowercase
UPDATE pregen_library
SET setting = lower(setting)
WHERE setting IS NOT NULL
  AND setting != lower(setting);
