-- Seed/Upsert services shown on the site

insert into public.services (id, name, description, price, image_url, discount_percent, popular, active)
values
  ('standard-cleaning', 'Standard cleaning', 'A thorough clean for everyday freshness.', 20.00, null, 0, true, true),
  ('regular-cleaning', 'Regular cleaning', 'Recurring cleaning to keep your home consistently tidy.', 20.00, null, 0, true, true),
  ('one-off-cleaning', 'One-off cleaning', 'A single clean session for when you need it most.', 20.00, null, 0, false, true),
  ('deep-cleaning', 'Deep cleaning', 'A detailed deep clean focusing on built-up dirt and grime.', 20.00, null, 0, true, true),
  ('spring-cleaning', 'Spring cleaning', 'A seasonal refresh to get your home spotless.', 20.00, null, 0, false, true),
  ('same-day-cleaning', 'Same day cleaning', 'Fast turnaround cleaning subject to availability.', 20.00, null, 0, false, true),
  ('airbnb-cleaning', 'Airbnb cleaning', 'Turnover cleaning for short lets, with attention to detail.', 20.00, null, 0, false, true),
  ('ironing-service', 'Ironing service', 'Professional ironing and folding at your convenience.', 20.00, null, 0, false, true),
  ('cleaning-and-ironing', 'Cleaning and ironing', 'Combined cleaning plus ironing in one visit.', 20.00, null, 0, false, true),
  ('housekeeping', 'Housekeeping', 'Ongoing housekeeping support to help you stay on top of chores.', 20.00, null, 0, false, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  discount_percent = excluded.discount_percent,
  popular = excluded.popular,
  active = excluded.active,
  updated_at = now();
