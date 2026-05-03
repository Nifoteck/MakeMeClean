-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Seed Data Only
-- Run AFTER: supabase-schema.sql (structure)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: uses ON CONFLICT / IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. SEED DATA — Services
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.services (id, name, description, price, image_url, discount_percent, popular, active)
VALUES
  ('standard-cleaning',   'Standard cleaning',    'A thorough clean for everyday freshness.',                              20.00, '/images/service-standard-clean.jpg', 0, true,  true),
  ('regular-cleaning',    'Regular cleaning',     'Recurring cleaning to keep your home consistently tidy.',              20.00, '/images/service-standard-clean.jpg', 0, true,  true),
  ('one-off-cleaning',    'One-off cleaning',     'A single clean session for when you need it most.',                    20.00, '/images/service-standard-clean.jpg', 0, false, true),
  ('deep-cleaning',       'Deep cleaning',        'A detailed deep clean focusing on built-up dirt and grime.',           20.00, '/images/service-deep-clean.jpg', 0, true,  true),
  ('spring-cleaning',     'Spring cleaning',      'A seasonal refresh to get your home spotless.',                        20.00, '/images/service-standard-clean.jpg', 0, false, true),
  ('same-day-cleaning',   'Same day cleaning',    'Fast turnaround cleaning subject to availability.',                    20.00, '/images/service-standard-clean.jpg', 0, false, true),
  ('airbnb-cleaning',     'Airbnb cleaning',      'Turnover cleaning for short lets, with attention to detail.',          20.00, '/images/service-airbnb-clean.jpg', 0, false, true),
  ('ironing-service',     'Ironing service',      'Professional ironing and folding at your convenience.',                20.00, '/images/service-kitchen-clean.jpg', 0, false, true),
  ('cleaning-and-ironing','Cleaning and ironing', 'Combined cleaning plus ironing in one visit.',                         20.00, '/images/service-standard-clean.jpg', 0, false, true),
  ('housekeeping',        'Housekeeping',         'Ongoing housekeeping support to help you stay on top of chores.',      20.00, '/images/service-standard-clean.jpg', 0, false, true)
ON CONFLICT (id) DO UPDATE SET
  name             = excluded.name,
  description      = excluded.description,
  price            = excluded.price,
  image_url        = excluded.image_url,
  discount_percent = excluded.discount_percent,
  popular          = excluded.popular,
  active           = excluded.active,
  updated_at       = NOW();


-- ─────────────────────────────────────────────────────────────
-- 2. PAYROLL SETTINGS
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.payroll_settings (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 3. SETTINGS (admin-editable key-value store)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.settings (key, value) VALUES
  -- Recurring plan discounts
  ('discount_weekly',      '15'),
  ('discount_fortnightly', '10'),
  ('discount_monthly',     '5'),
  -- Business contact info (admin-editable via /admin/settings)
  ('business_phone',    '+44 7362 068202'),
  ('contact_email',     'contact@makemeclean.co.uk'),
  ('business_hours',    '7 days a week, 8am–8pm'),
  ('email_info',        'info@makemeclean.co.uk'),
  ('email_recruitment', 'recruitment@makemeclean.co.uk'),
  ('email_payment',     'payment@makemeclean.co.uk'),
  ('email_payroll',     'payroll@makemeclean.co.uk'),
  ('email_staffing',    'staffing@makemeclean.co.uk')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
