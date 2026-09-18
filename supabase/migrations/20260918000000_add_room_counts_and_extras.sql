-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Add Room Counts, Extras, and Duration to Bookings
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS living_rooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'House/Flat',
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(4,2) DEFAULT 2.0;

ALTER TABLE public.recurring_plans 
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS living_rooms INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'House/Flat';

