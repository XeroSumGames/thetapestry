-- Hardened handle_new_user trigger.
-- Without the EXCEPTION block, any profile insert failure (username collision,
-- a newly-added NOT NULL column, etc.) aborts the auth.users insert and the
-- client sees "Database error saving new user". The signup page already has
-- an explicit profile upsert fallback, so swallowing trigger errors lets the
-- auth user land and the client-side fallback finish the job.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, username, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      NEW.email,
      'Survivor'
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  EXCEPTION WHEN OTHERS THEN
    -- Log the failure but do not abort the auth user creation.
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
