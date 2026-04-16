-- ============================================================
-- Reset Portrait Counters
-- Run in Supabase SQL Editor. Pick ONE option below based on
-- whether you want to keep existing portraits or start totally
-- fresh. Uncomment the block you want, then run.
-- ============================================================

-- ── OPTION A: Reset counter ONLY (keeps bank + storage files) ──
-- ⚠️  WARNING: will collide with portrait_bank UNIQUE (gender, number)
--     on re-upload unless you manually clear overlapping numbers first.
--     Safe only if bank is already empty or you'll skip past existing numbers.
--
-- UPDATE portrait_counters SET count = 0;


-- ── OPTION B: Reset counter + clear bank metadata (keeps storage files) ──
-- Clears the portrait_bank table so re-uploads won't collide.
-- Old storage files remain in the bucket (orphaned).
--
-- UPDATE portrait_counters SET count = 0;
-- DELETE FROM portrait_bank;
-- DELETE FROM campaign_portrait_usage;


-- ── OPTION C: FULL WIPE — counter + metadata + storage files ──
-- Clears everything. The storage file delete requires that you
-- list the files first. Use the Supabase dashboard Storage UI
-- to select all files in portrait-bank/ and delete them, OR
-- run the object query below.

-- Reset metadata + counters:
UPDATE portrait_counters SET count = 0;
DELETE FROM portrait_bank;
DELETE FROM campaign_portrait_usage;

-- Delete storage objects (requires storage.objects access — run in SQL editor):
DELETE FROM storage.objects WHERE bucket_id = 'portrait-bank';
