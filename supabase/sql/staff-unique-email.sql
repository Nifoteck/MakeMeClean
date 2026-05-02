-- Ensure staff email is unique for upserts (used by recruitment hiring flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_email_unique'
  ) THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_email_unique UNIQUE (email);
  END IF;
END $$;

