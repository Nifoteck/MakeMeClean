-- ══════════════════════════════════════════════════════════════
-- MakeMeClean — Seed Data Only
-- Run AFTER: supabase/migrations/20260811000000_init.sql (structure)
-- Run in: Supabase Dashboard → SQL Editor → New Query, or via `supabase db reset`
-- Safe to re-run: uses ON CONFLICT / IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. SEED DATA — Services
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.services (id, name, description, price, image_url, discount_percent, popular, active, category, badge, tagline, icon, sort_order)
VALUES
  ('standard-cleaning',   'Classic Domestic Cleaning',   'Day-to-day routine housekeeping & maintenance. Dusting surfaces, vacuuming & mopping floors, sanitising bathrooms & kitchens, making beds, and emptying bins.', 20.00, '/images/service-standard-clean.jpg', 0, true,  true, 'domestic', 'Most Popular', 'Day-to-day routine housekeeping & maintenance', '🧹', 1),
  ('regular-cleaning',    'Regular cleaning',            'Recurring cleaning to keep your home consistently tidy.',              20.00, '/images/service-regular-cleaning.jpg', 0, false, true, 'domestic', 'Recurring', 'Keep your home consistently tidy', '🧹', 1),
  ('one-off-cleaning',    'One-off cleaning',            'A single clean session for when you need it most.',                    20.00, '/images/service-one-off-cleaning.jpg', 0, false, true, 'domestic', 'Single Visit', 'Single visit cleaning session', '🧹', 1),
  ('deep-cleaning',       'Deep Cleaning & Spring Reset','Detailed top-to-bottom scrub for built-up grime, limescale, grout, skirting boards, sockets, and behind furniture.', 20.00, '/images/service-deep-cleaning.jpg', 0, true,  true, 'deep', 'Intensive Scrub', 'Thorough top-to-bottom scrub for built-up grime', '✨', 2),
  ('spring-cleaning',     'Spring cleaning',             'A seasonal refresh to get your home spotless.',                        20.00, '/images/service-spring-cleaning.jpg', 0, false, true, 'deep', 'Seasonal', 'A seasonal refresh to get your home spotless', '✨', 2),
  ('same-day-cleaning',   'Same day cleaning',           'Fast turnaround cleaning subject to availability.',                    20.00, '/images/service-same-day-cleaning.jpg', 0, false, true, 'domestic', 'Fast Priority', 'Fast turnaround cleaning subject to availability', '🧹', 1),
  ('airbnb-cleaning',     'Holiday Rental & Airbnb',     'Fast guest turnovers & staging between stays. Linen strip & fresh bed dressing, guest amenities check, bathroom shine, kitchen inventory and photo check-in.', 20.00, '/images/service-airbnb-cleaning.jpg', 0, false, true, 'airbnb', 'Host Special', 'Fast guest turnovers & staging between stays', '🏨', 3),
  ('ironing-service',     'Ironing & Laundry Service',   'Professional steam pressing, folding & wardrobe care. Shirts, trousers, delicates, and bedsheet pressing neatly done in your home.', 20.00, '/images/service-ironing-service.jpg', 0, false, true, 'ironing', 'Garment Care', 'Professional steam pressing, folding & wardrobe care', '🧺', 4),
  ('cleaning-and-ironing','Cleaning and ironing',        'Combined cleaning plus ironing in one visit.',                         20.00, '/images/service-cleaning-and-ironing.jpg', 0, false, true, 'ironing', 'Combined Care', 'Combined cleaning plus ironing in one visit', '🧺', 4),
  ('housekeeping',        'Housekeeping',                'Ongoing housekeeping support to help you stay on top of chores.',      20.00, '/images/service-housekeeping.jpg', 0, false, true, 'domestic', 'Routine Chores', 'Ongoing housekeeping support', '🧹', 1),
  ('office-cleaning',     'Office & Commercial Cleaning','Desks wiped, bin collection & recycling, washrooms sanitised, kitchenettes & meeting room glass buffed for workplaces and commercial buildings.', 20.00, '/images/service-office-cleaning.jpg', 0, false, true, 'commercial', 'Business', 'Professional cleanliness for workplaces and offices', '🏢', 5)
ON CONFLICT (id) DO UPDATE SET
  name             = excluded.name,
  description      = excluded.description,
  price            = excluded.price,
  image_url        = excluded.image_url,
  discount_percent = excluded.discount_percent,
  popular          = excluded.popular,
  active           = excluded.active,
  category         = excluded.category,
  badge            = excluded.badge,
  tagline          = excluded.tagline,
  icon             = excluded.icon,
  sort_order       = excluded.sort_order,
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
