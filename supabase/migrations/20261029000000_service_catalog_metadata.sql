-- ══════════════════════════════════════════════════════════════
-- Migration: Add service categories & catalog metadata to services
-- ══════════════════════════════════════════════════════════════

-- 1. Extend services table with category, badge, tagline, icon, sort_order
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category         TEXT NOT NULL DEFAULT 'domestic',
  ADD COLUMN IF NOT EXISTS badge            TEXT,
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS icon             TEXT DEFAULT '🧹',
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER DEFAULT 0;

-- 2. Backfill existing and core services with proper category metadata
UPDATE public.services
SET category = 'domestic',
    badge = 'Most Popular',
    tagline = 'Day-to-day routine housekeeping & maintenance',
    icon = '🧹',
    sort_order = 1
WHERE id IN ('standard-cleaning', 'regular-cleaning', 'one-off-cleaning', 'housekeeping', 'same-day-cleaning');

UPDATE public.services
SET category = 'deep',
    badge = 'Intensive Scrub',
    tagline = 'Thorough top-to-bottom scrub for built-up grime',
    icon = '✨',
    sort_order = 2
WHERE id IN ('deep-cleaning', 'spring-cleaning');

UPDATE public.services
SET category = 'airbnb',
    badge = 'Host Turnover',
    tagline = 'Fast guest turnovers & staging between stays',
    icon = '🏨',
    sort_order = 3
WHERE id = 'airbnb-cleaning';

UPDATE public.services
SET category = 'ironing',
    badge = 'Garment Care',
    tagline = 'Professional steam pressing, folding & wardrobe care',
    icon = '🧺',
    sort_order = 4
WHERE id IN ('ironing-service', 'cleaning-and-ironing');

UPDATE public.services
SET category = 'commercial',
    badge = 'Business',
    tagline = 'Professional cleanliness for workplaces and offices',
    icon = '🏢',
    sort_order = 5
WHERE id = 'office-cleaning';

