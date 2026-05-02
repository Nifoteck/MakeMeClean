-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Full Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- ── 1. PROFILES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 1b. SERVICES (Admin-managed) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY, -- slug, e.g. 'deep-cleaning'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  duration TEXT NOT NULL,
  icon_key TEXT NOT NULL DEFAULT 'home',
  popular BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. BOOKINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. JOB APPLICATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Role
  role TEXT NOT NULL,
  employment_type TEXT,
  available_days TEXT[],
  available_hours TEXT,
  earliest_start DATE,
  heard_from TEXT,

  -- Personal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postcode TEXT,

  -- Right to work
  rtw_eligible TEXT,
  rtw_type TEXT,
  ni_number TEXT,

  -- Experience
  years_experience TEXT,
  experience_types TEXT[],
  own_equipment TEXT,
  driving_licence TEXT,
  specialist_skills TEXT,

  -- Employment history (emp 1)
  emp1_company TEXT,
  emp1_role TEXT,
  emp1_start TEXT,
  emp1_end TEXT,
  emp1_leaving TEXT,
  emp1_contact TEXT,

  -- Employment history (emp 2)
  emp2_company TEXT,
  emp2_role TEXT,
  emp2_start TEXT,
  emp2_end TEXT,
  emp2_leaving TEXT,
  emp2_contact TEXT,

  -- References
  ref1_name TEXT,
  ref1_company TEXT,
  ref1_title TEXT,
  ref1_relationship TEXT,
  ref1_phone TEXT,
  ref1_email TEXT,
  ref2_name TEXT,
  ref2_company TEXT,
  ref2_title TEXT,
  ref2_relationship TEXT,
  ref2_phone TEXT,
  ref2_email TEXT,

  -- Emergency contact
  emergency_name TEXT,
  emergency_relationship TEXT,
  emergency_phone TEXT,

  -- Document URLs (from Supabase Storage)
  cv_url TEXT,
  id_proof_url TEXT,
  rtw_doc_url TEXT,
  dbs_cert_url TEXT,

  -- Status (for admin review)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- Allow joins from bookings query
CREATE POLICY "Profiles readable by all authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Bookings
CREATE POLICY "Users can view own bookings"   ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- Services (public read)
CREATE POLICY "Anyone can read active services"
  ON public.services FOR SELECT
  USING (active = true);

-- Job applications — anyone can INSERT (public apply), only admin can SELECT
CREATE POLICY "Anyone can submit application" ON public.job_applications FOR INSERT WITH CHECK (true);

-- ── 5. AUTO-CREATE PROFILE ON SIGN UP ─────────────────────────
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 6. STORAGE BUCKET FOR JOB APPLICATION DOCUMENTS ──────────
-- Run in SQL Editor OR via Supabase Dashboard → Storage → New Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to applications bucket (for job applications)
CREATE POLICY "Anyone can upload applications"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'applications');

CREATE POLICY "Public read applications"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'applications');

-- ══════════════════════════════════════════════════════════════
-- ADMIN SETUP — run AFTER signing up with aadeeniiyii@gmail.com
-- ══════════════════════════════════════════════════════════════
-- 1. Sign up in the app with aadeeniiyii@gmail.com
-- 2. Go to Supabase → Authentication → Users → copy your UUID
-- 3. Run these (replace YOUR-ADMIN-UUID):
--
-- CREATE POLICY "Admin select all bookings"
--   ON public.bookings FOR SELECT
--   USING (auth.uid() = 'YOUR-ADMIN-UUID');
--
-- CREATE POLICY "Admin update all bookings"
--   ON public.bookings FOR UPDATE
--   USING (auth.uid() = 'YOUR-ADMIN-UUID');
--
-- CREATE POLICY "Admin select all applications"
--   ON public.job_applications FOR SELECT
--   USING (auth.uid() = 'YOUR-ADMIN-UUID');
--
-- CREATE POLICY "Admin update all applications"
--   ON public.job_applications FOR UPDATE
--   USING (auth.uid() = 'YOUR-ADMIN-UUID');
--
-- CREATE POLICY "Admin manage services"
--   ON public.services FOR ALL
--   USING (auth.uid() = 'YOUR-ADMIN-UUID')
--   WITH CHECK (auth.uid() = 'YOUR-ADMIN-UUID');
