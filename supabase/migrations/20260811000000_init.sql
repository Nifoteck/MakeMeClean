-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Full Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DO blocks
-- ══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- Auto-update updated_at column on services
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a user is an admin (used in RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  exists_admins BOOLEAN;
BEGIN
  IF to_regclass('public.admins') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = $1)'
    INTO exists_admins
    USING uid;

  RETURN exists_admins;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. TABLES
-- ─────────────────────────────────────────────────────────────

-- Profiles (one per auth user, created automatically on sign-up)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone     TEXT,
  address   TEXT,
  city      TEXT,
  postcode  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services (admin-managed, price is per hour)
CREATE TABLE IF NOT EXISTS public.services (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  image_url        TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  popular          BOOLEAN DEFAULT false,
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services DROP COLUMN IF EXISTS duration;
ALTER TABLE public.services DROP COLUMN IF EXISTS icon_key;
ALTER TABLE public.services DROP COLUMN IF EXISTS sort_order;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_discount_percent_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_discount_percent_check
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type   TEXT NOT NULL,
  service_name   TEXT NOT NULL,
  date           DATE NOT NULL,
  time_slot      TEXT NOT NULL,
  address        TEXT NOT NULL,
  city           TEXT NOT NULL,
  postcode       TEXT NOT NULL,
  status         TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending'  CHECK (payment_status IN ('pending', 'paid', 'refunded', 'disputed')),
  price          NUMERIC(10,2) NOT NULL,
  notes          TEXT,
  invoice_number TEXT,
  refunded_amount NUMERIC(10,2) DEFAULT 0,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  reminder_sent  BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Job applications (careers form)
CREATE TABLE IF NOT EXISTS public.job_applications (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Recruitment link
  user_id          UUID REFERENCES auth.users(id),
  recruitment_id   UUID,                               -- FK added below after recruitments table

  -- Role
  role             TEXT NOT NULL,
  employment_type  TEXT,
  available_days   TEXT[],
  available_hours  TEXT,
  earliest_start   DATE,
  heard_from       TEXT,

  -- Personal
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  dob         DATE,
  gender      TEXT,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  postcode    TEXT,

  -- Right to work
  rtw_eligible TEXT,
  rtw_type     TEXT,
  ni_number    TEXT,

  -- Experience
  years_experience  TEXT,
  experience_types  TEXT[],
  own_equipment     TEXT,
  driving_licence   TEXT,
  specialist_skills TEXT,
  own_transport     TEXT,

  -- Employment history
  current_employer   TEXT,
  current_job_title  TEXT,
  reason_for_leaving TEXT,
  notice_period      TEXT,

  emp1_company  TEXT,
  emp1_role     TEXT,
  emp1_start    TEXT,
  emp1_end      TEXT,
  emp1_leaving  TEXT,
  emp1_contact  TEXT,

  emp2_company  TEXT,
  emp2_role     TEXT,
  emp2_start    TEXT,
  emp2_end      TEXT,
  emp2_leaving  TEXT,
  emp2_contact  TEXT,

  -- References
  ref1_name         TEXT,
  ref1_company      TEXT,
  ref1_title        TEXT,
  ref1_relationship TEXT,
  ref1_phone        TEXT,
  ref1_email        TEXT,

  ref2_name         TEXT,
  ref2_company      TEXT,
  ref2_title        TEXT,
  ref2_relationship TEXT,
  ref2_phone        TEXT,
  ref2_email        TEXT,

  -- Emergency contact
  date_of_birth           TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  emergency_name          TEXT,
  emergency_relationship  TEXT,
  emergency_phone         TEXT,

  -- Declarations
  has_convictions          TEXT,
  convictions_details      TEXT,
  health_declaration       TEXT,
  health_details           TEXT,
  has_staff_relationship   TEXT,
  staff_relationship_details TEXT,
  heard_about_us           TEXT,

  -- Equal opportunities
  equal_opps_gender             TEXT,
  equal_opps_age                TEXT,
  equal_opps_ethnicity          TEXT,
  equal_opps_disability         TEXT,
  equal_opps_sexual_orientation TEXT,
  equal_opps_religion           TEXT,

  -- Documents (Supabase Storage URLs)
  cv_url       TEXT,
  id_proof_url TEXT,
  rtw_doc_url  TEXT,
  dbs_cert_url TEXT,

  -- Draft / submission state
  status_draft BOOLEAN DEFAULT false,
  draft_data   JSONB,

  -- Admin review
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email OTP verifications (used by careers form, accessed via service role only)
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'registration',
  otp         TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verifications_lookup
  ON public.email_verifications (email, purpose, expires_at);

-- Recruitments (admin creates/closes recruitment rounds)
CREATE TABLE IF NOT EXISTS public.recruitments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL DEFAULT 'Recruitment',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at  TIMESTAMPTZ
);

-- Add FK from job_applications to recruitments (now that recruitments exists)
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS recruitment_id UUID REFERENCES public.recruitments(id);

-- Admins (who can access /admin)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff (hired employees; user_id links to their auth account)
CREATE TABLE IF NOT EXISTS public.staff (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.job_applications(id) ON DELETE SET NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  city           TEXT,
  postcode       TEXT,
  role           TEXT,
  active         BOOLEAN DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Unique email constraint on staff (used by hire-applicant edge function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_email_unique'
  ) THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_email_unique UNIQUE (email);
  END IF;
END $$;

-- Booking assignments (which staff member covers which booking)
CREATE TABLE IF NOT EXISTS public.booking_assignments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  staff_id   UUID REFERENCES public.staff(id)    ON DELETE CASCADE NOT NULL,
  status     TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'completed', 'cancelled')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, staff_id)
);

-- Reviews (post-job customer survey)
CREATE TABLE IF NOT EXISTS public.reviews (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id      UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id         UUID REFERENCES auth.users(id)      ON DELETE CASCADE NOT NULL,
  overall_rating  INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  punctuality     INT CHECK (punctuality   BETWEEN 1 AND 5),
  quality         INT CHECK (quality       BETWEEN 1 AND 5),
  friendliness    INT CHECK (friendliness  BETWEEN 1 AND 5),
  value_for_money INT CHECK (value_for_money BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  comments        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- 3. TRIGGERS
-- ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- 4. FOREIGN KEY: bookings → profiles
-- ─────────────────────────────────────────────────────────────

-- Backfill missing profile rows before adding the FK
INSERT INTO public.profiles (id)
SELECT DISTINCT b.user_id
FROM   public.bookings b
LEFT   JOIN public.profiles p ON p.id = b.user_id
WHERE  p.id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 5. UNIQUE INDEX: one application per user+role per recruitment
-- ─────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_unique_role_per_recruitment
  ON public.job_applications (user_id, recruitment_id, role)
  WHERE user_id IS NOT NULL AND recruitment_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY — enable on all tables
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile"                  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"                ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"                ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by all authenticated"      ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles readable by all authenticated"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Services
DROP POLICY IF EXISTS "Anyone can read active services" ON public.services;
DROP POLICY IF EXISTS "Admins manage services"          ON public.services;
CREATE POLICY "Anyone can read active services"
  ON public.services FOR SELECT USING (active = true);
CREATE POLICY "Admins manage services"
  ON public.services FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Bookings
DROP POLICY IF EXISTS "Users can view own bookings"      ON public.bookings;
DROP POLICY IF EXISTS "Users can create own bookings"    ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings"    ON public.bookings;
DROP POLICY IF EXISTS "Admins select all bookings"       ON public.bookings;
DROP POLICY IF EXISTS "Admins update all bookings"       ON public.bookings;
DROP POLICY IF EXISTS "Staff read assigned bookings"     ON public.bookings;
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bookings"
  ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins select all bookings"
  ON public.bookings FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update all bookings"
  ON public.bookings FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff read assigned bookings"
  ON public.bookings FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.booking_assignments ba
      JOIN   public.staff s ON s.id = ba.staff_id
      WHERE  ba.booking_id = bookings.id
        AND  s.user_id = auth.uid()
        AND  s.active = true
    )
  );

-- Job applications
DROP POLICY IF EXISTS "Anyone can submit application"                         ON public.job_applications;
DROP POLICY IF EXISTS "Users can view own applications"                       ON public.job_applications;
DROP POLICY IF EXISTS "Users can submit own application (active recruitment only)" ON public.job_applications;
DROP POLICY IF EXISTS "Admins select all applications"                        ON public.job_applications;
DROP POLICY IF EXISTS "Admins update all applications"                        ON public.job_applications;
CREATE POLICY "Users can view own applications"
  ON public.job_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can submit own application (active recruitment only)"
  ON public.job_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.recruitments r
      WHERE r.id = recruitment_id AND r.status = 'active'
    )
  );
CREATE POLICY "Admins select all applications"
  ON public.job_applications FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update all applications"
  ON public.job_applications FOR UPDATE USING (public.is_admin(auth.uid()));

-- Email verifications (service role only — no public policies)

-- Recruitments
DROP POLICY IF EXISTS "Public read active recruitments" ON public.recruitments;
DROP POLICY IF EXISTS "Admins manage recruitments"      ON public.recruitments;
CREATE POLICY "Public read active recruitments"
  ON public.recruitments FOR SELECT USING (status = 'active');
CREATE POLICY "Admins manage recruitments"
  ON public.recruitments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins
DROP POLICY IF EXISTS "Admins can read self" ON public.admins;
CREATE POLICY "Admins can read self"
  ON public.admins FOR SELECT USING (auth.uid() = user_id);

-- Staff
DROP POLICY IF EXISTS "Staff can read self"  ON public.staff;
DROP POLICY IF EXISTS "Admins manage staff"  ON public.staff;
CREATE POLICY "Staff can read self"
  ON public.staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage staff"
  ON public.staff FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Booking assignments
DROP POLICY IF EXISTS "Admins manage assignments"      ON public.booking_assignments;
DROP POLICY IF EXISTS "Staff read assignments"         ON public.booking_assignments;
DROP POLICY IF EXISTS "Staff update assignment status" ON public.booking_assignments;
CREATE POLICY "Admins manage assignments"
  ON public.booking_assignments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Staff read assignments"
  ON public.booking_assignments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = booking_assignments.staff_id
        AND s.user_id = auth.uid()
        AND s.active = true
    )
  );
CREATE POLICY "Staff update assignment status"
  ON public.booking_assignments FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = booking_assignments.staff_id
        AND s.user_id = auth.uid()
        AND s.active = true
    )
  );

-- Reviews
DROP POLICY IF EXISTS "Users can insert own reviews"  ON public.reviews;
DROP POLICY IF EXISTS "Users can view own reviews"    ON public.reviews;
DROP POLICY IF EXISTS "Admins can view all reviews"   ON public.reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reviews"
  ON public.reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all reviews"
  ON public.reviews FOR SELECT USING (public.is_admin(auth.uid()));


-- ─────────────────────────────────────────────────────────────
-- 8. STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────

-- Job application documents (CV, ID proof, right-to-work, DBS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', true)
ON CONFLICT (id) DO NOTHING;

-- Service images (uploaded via admin panel)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 9. STORAGE BUCKET POLICIES
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can upload applications" ON storage.objects;
DROP POLICY IF EXISTS "Public read applications"       ON storage.objects;
CREATE POLICY "Anyone can upload applications"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'applications');
CREATE POLICY "Public read applications"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'applications');

DROP POLICY IF EXISTS "Public read service images"   ON storage.objects;
DROP POLICY IF EXISTS "Admins insert service images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update service images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete service images" ON storage.objects;
CREATE POLICY "Public read service images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-images');
CREATE POLICY "Admins insert service images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'service-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update service images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'service-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'service-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete service images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'service-images' AND public.is_admin(auth.uid()));


-- ─────────────────────────────────────────────────────────────
-- 10. GRANT ADMIN ACCESS
-- ─────────────────────────────────────────────────────────────
-- After signing up in the app, go to Supabase → Authentication → Users,
-- copy your UUID, then run (in supabase-seed.sql or directly):
--
-- INSERT INTO public.admins (user_id)
-- VALUES ('<YOUR-UUID-HERE>')
-- ON CONFLICT (user_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 11. STAFF AVAILABILITY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id    UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  week_start  DATE NOT NULL,
  day_slots   JSONB NOT NULL DEFAULT '{}',
  -- day_slots shape: { "Mon": {"from":"08:00","to":"14:00"}, "Tue": null, ... }
  -- A null or absent key means unavailable that day
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, week_start)
);

ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own availability
CREATE POLICY "staff_avail_own" ON public.staff_availability
  FOR ALL USING (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );

-- Admins can view all
CREATE POLICY "staff_avail_admin_read" ON public.staff_availability
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.admins)
  );


-- ─────────────────────────────────────────────────────────────
-- 12. PAYROLL SETTINGS  (single-row config)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id               INT  PRIMARY KEY DEFAULT 1,
  pay_period       TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_period IN ('weekly','monthly')),
  hourly_rate      NUMERIC(10,2) NOT NULL DEFAULT 12.00,
  hours_per_shift  NUMERIC(5,2)  NOT NULL DEFAULT 3.00,
  default_tax_code TEXT NOT NULL DEFAULT '1257L',
  ni_category      TEXT NOT NULL DEFAULT 'A',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.payroll_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_settings_admin" ON public.payroll_settings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));


-- ─────────────────────────────────────────────────────────────
-- 13. PAYSLIPS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payslips (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id      UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  shifts_count  INT          NOT NULL DEFAULT 0,
  gross_hours   NUMERIC(10,2) DEFAULT 0,
  gross_pay     NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_code      TEXT NOT NULL DEFAULT '1257L',
  paye_tax      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ni_employee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ni_employer   NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_pay       NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalised')),
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Staff see only their own payslips
CREATE POLICY "payslips_own" ON public.payslips
  FOR SELECT USING (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "payslips_admin" ON public.payslips
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 14. BOOKING ASSIGNMENT ACCEPTANCE
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.booking_assignments
  ADD COLUMN IF NOT EXISTS acceptance_status TEXT DEFAULT 'pending'
    CHECK (acceptance_status IN ('pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- ─────────────────────────────────────────────────────────────
-- 15. RESCHEDULE REQUESTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reschedule_requests (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id       UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID REFERENCES auth.users(id) NOT NULL,
  requested_date   DATE NOT NULL,
  requested_time   TEXT NOT NULL,
  reason           TEXT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reschedule_own" ON public.reschedule_requests
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "reschedule_admin" ON public.reschedule_requests
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 16. CONTACT MESSAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_insert" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_admin_read" ON public.contact_messages
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 17. RECURRING PLANS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_plans (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type     TEXT NOT NULL,
  service_name     TEXT NOT NULL,
  frequency        TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
  start_time       TEXT NOT NULL,
  duration_hours   NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  address          TEXT NOT NULL,
  city             TEXT NOT NULL,
  postcode         TEXT NOT NULL,
  price_per_visit  NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  notes            TEXT,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recurring_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_own" ON public.recurring_plans
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "recurring_admin" ON public.recurring_plans
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 18. SETTINGS (admin-editable key-value store)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_public_read" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- Newsletter Subscriptions
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS newsletter_subscriptions_email_idx ON public.newsletter_subscriptions (email);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_public_insert" ON public.newsletter_subscriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "newsletter_admin_read" ON public.newsletter_subscriptions
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 19. REFUND REQUESTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id    UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  requested_at  TIMESTAMPTZ DEFAULT NOW(),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source        TEXT DEFAULT 'user' CHECK (source IN ('user', 'stripe_dispute')),
  admin_notes   TEXT,
  refund_amount NUMERIC(10,2),
  stripe_refund_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_dispute_id TEXT,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refund_requests_booking_idx ON public.refund_requests (booking_id);
CREATE INDEX IF NOT EXISTS refund_requests_user_idx ON public.refund_requests (user_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON public.refund_requests (status);
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_pending_user_per_booking_idx
  ON public.refund_requests (booking_id, user_id, source)
  WHERE status = 'pending' AND source = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_checkout_session_uidx
  ON public.bookings (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_payment_intent_uidx
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_charge_uidx
  ON public.bookings (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund_requests_user_view" ON public.refund_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "refund_requests_user_create" ON public.refund_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "refund_requests_admin_all" ON public.refund_requests
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 20. BOOKING PHOTOS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.booking_photos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_photos_booking_idx ON public.booking_photos (booking_id);
CREATE INDEX IF NOT EXISTS booking_photos_user_idx ON public.booking_photos (user_id);

ALTER TABLE public.booking_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_photos_user_view" ON public.booking_photos
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM public.admins));

CREATE POLICY "booking_photos_user_upload" ON public.booking_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "booking_photos_user_delete" ON public.booking_photos
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM public.admins));

CREATE POLICY "booking_photos_admin_all" ON public.booking_photos
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 21. LOYALTY POINTS & REWARDS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  points     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_points_user_idx ON public.loyalty_points (user_id);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_points_user_view" ON public.loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "loyalty_points_admin_all" ON public.loyalty_points
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT DEFAULT '',
  points_required  INTEGER NOT NULL,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_rewards_public_read" ON public.loyalty_rewards
  FOR SELECT USING (true);

CREATE POLICY "loyalty_rewards_admin_all" ON public.loyalty_rewards
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- ─────────────────────────────────────────────────────────────
-- 22. STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────

-- Booking photos bucket (already exists in typical Supabase, but defined here for completeness)
-- Create via Supabase Dashboard: Storage → New Bucket → Name: "booking-photos" → Public

-- Service images bucket (already in use)
-- Create via Supabase Dashboard: Storage → New Bucket → Name: "service-images" → Public
