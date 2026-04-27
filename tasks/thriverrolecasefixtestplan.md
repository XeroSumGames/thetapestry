# Thriver role-case fix — testplan

## Bug
Creating a tactical scene as Xero in a campaign Xero doesn't GM failed with:
`Failed to create scene: new row violates row-level security policy for table "tactical_scenes"`

Root cause: `is_thriver()` compared `role = 'Thriver'` (capital T) but
`profiles.role` is auto-lowercased to `'thriver'` by the
`trg_normalize_role` trigger (see `tasks/lessons.md` line 4). So every
Thriver bypass policy in the system was silently a no-op. Latent twin
bug in `campaign-pins-rls-thriver-bypass.sql`.

## Step 1 — apply the migration
1. Open Supabase Studio → SQL Editor
2. Paste the contents of `sql/thriver-role-case-fix.sql`
3. Run it. Expect "Success. No rows returned."

## Step 2 — verify the fix at the DB level
Run in Supabase SQL Editor:
```sql
-- The bypass policy still exists, with WITH CHECK = is_thriver()
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'public.tactical_scenes'::regclass
  AND polname = 'tactical_scenes_thriver_bypass';
```
Expect: 1 row, both expressions = `is_thriver()`.

(Note: `SELECT public.is_thriver()` in the SQL editor will still
return false, because the editor runs as `postgres`, not as you.
That's expected — the function will return true in the app.)

## Step 3 — verify the original failure now succeeds
1. Log in as Xero
2. Open a campaign you don't GM
3. Open Tactical Map
4. Create a new scene with name "thriver bypass test"
5. Expect: scene creates successfully, no RLS error in console

## Step 4 — regression: GM workflow still works
1. Log in as Xero
2. Open a campaign you DO GM
3. Create a new scene the same way
4. Expect: scene creates successfully (GM policy still works alongside
   the bypass)

## Step 5 — bonus regression: campaign_pins
The campaign-pins fix is shipped in the same migration. Verify:
1. As Xero, open a campaign you don't GM
2. Drop a pin on the world map
3. Expect: pin saves without RLS error

## Step 6 — cleanup
After confirming, delete the test scene from Step 3 and the test pin
from Step 5.
