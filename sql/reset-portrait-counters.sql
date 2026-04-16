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


-- ── OPTION C: Full metadata wipe (recommended) ──
-- Clears all DB metadata and resets counters. Orphaned storage
-- files remain but don't break anything — re-uploads use
-- upsert=true, so the same path overwrites cleanly.
-- To clean storage too: Supabase Dashboard → Storage →
-- portrait-bank bucket → select folders → delete.
-- (Direct DELETE from storage.objects is blocked by Supabase.)

UPDATE portrait_counters SET count = 0;
DELETE FROM portrait_bank;
DELETE FROM campaign_portrait_usage;
