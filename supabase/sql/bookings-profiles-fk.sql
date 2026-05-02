-- Enable PostgREST embedding: bookings -> profiles
-- Assumes public.profiles.id matches auth.users.id (true in this project).

-- Backfill missing profiles for any existing bookings
INSERT INTO public.profiles (id)
SELECT DISTINCT b.user_id
FROM public.bookings b
LEFT JOIN public.profiles p ON p.id = b.user_id
WHERE p.id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_user_id_profiles_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;
