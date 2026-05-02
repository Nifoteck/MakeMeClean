-- RLS for Admin + Staff portals

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;

-- Helper: is_admin(uid)
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = uid);
$$;

-- Admins can read their own admin row
DROP POLICY IF EXISTS "Admins can read self" ON public.admins;
CREATE POLICY "Admins can read self" ON public.admins
FOR SELECT USING (auth.uid() = user_id);

-- Staff can read their own staff row
DROP POLICY IF EXISTS "Staff can read self" ON public.staff;
CREATE POLICY "Staff can read self" ON public.staff
FOR SELECT USING (auth.uid() = user_id);

-- Admin can manage staff
DROP POLICY IF EXISTS "Admins manage staff" ON public.staff;
CREATE POLICY "Admins manage staff" ON public.staff
FOR ALL USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Booking assignments
DROP POLICY IF EXISTS "Admins manage assignments" ON public.booking_assignments;
CREATE POLICY "Admins manage assignments" ON public.booking_assignments
FOR ALL USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff read assignments" ON public.booking_assignments;
CREATE POLICY "Staff read assignments" ON public.booking_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = booking_assignments.staff_id
      AND s.user_id = auth.uid()
      AND s.active = true
  )
);

-- Staff can update assignment status (accepted/completed/cancelled)
DROP POLICY IF EXISTS "Staff update assignment status" ON public.booking_assignments;
CREATE POLICY "Staff update assignment status" ON public.booking_assignments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = booking_assignments.staff_id
      AND s.user_id = auth.uid()
      AND s.active = true
  )
);

-- Bookings: allow admins full access
DROP POLICY IF EXISTS "Admins select all bookings" ON public.bookings;
CREATE POLICY "Admins select all bookings" ON public.bookings
FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update all bookings" ON public.bookings;
CREATE POLICY "Admins update all bookings" ON public.bookings
FOR UPDATE USING (public.is_admin(auth.uid()));

-- Bookings: allow staff to read bookings they are assigned to
DROP POLICY IF EXISTS "Staff read assigned bookings" ON public.bookings;
CREATE POLICY "Staff read assigned bookings" ON public.bookings
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.booking_assignments ba
    JOIN public.staff s ON s.id = ba.staff_id
    WHERE ba.booking_id = bookings.id
      AND s.user_id = auth.uid()
      AND s.active = true
  )
);

-- Job applications: admin access
DROP POLICY IF EXISTS "Admins select all applications" ON public.job_applications;
CREATE POLICY "Admins select all applications" ON public.job_applications
FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update all applications" ON public.job_applications;
CREATE POLICY "Admins update all applications" ON public.job_applications
FOR UPDATE USING (public.is_admin(auth.uid()));

-- Services: admin manage
DROP POLICY IF EXISTS "Admins manage services" ON public.services;
CREATE POLICY "Admins manage services" ON public.services
FOR ALL USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- NOTE: To grant yourself admin, insert your user_id into public.admins.

