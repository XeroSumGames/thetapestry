SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'campaigns'
ORDER BY cmd, policyname;
