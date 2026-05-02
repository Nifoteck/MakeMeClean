-- Set service images (Unsplash images CDN URLs)
-- Avoids https://source.unsplash.com which can rate-limit (503).

update public.services set image_url = case id
  when 'standard-cleaning' then 'https://images.unsplash.com/photo-1764344815057-15a438b636ed?auto=format&fit=crop&w=1600&q=80'
  when 'regular-cleaning' then 'https://images.unsplash.com/photo-1758523670739-0d26a3ee976d?auto=format&fit=crop&w=1600&q=80'
  when 'one-off-cleaning' then 'https://images.unsplash.com/photo-1550963295-019d8a8a61c5?auto=format&fit=crop&w=1600&q=80'
  when 'deep-cleaning' then 'https://images.unsplash.com/photo-1759846865576-84caf9a9e32c?auto=format&fit=crop&w=1600&q=80'
  when 'spring-cleaning' then 'https://images.unsplash.com/photo-1765970101624-31e3a737d90e?auto=format&fit=crop&w=1600&q=80'
  when 'same-day-cleaning' then 'https://images.unsplash.com/photo-1762500825301-569628303acb?auto=format&fit=crop&w=1600&q=80'
  when 'airbnb-cleaning' then 'https://images.unsplash.com/photo-1772476361154-e894ba10d757?auto=format&fit=crop&w=1600&q=80'
  when 'ironing-service' then 'https://images.unsplash.com/photo-1758279744970-b32360a5e907?auto=format&fit=crop&w=1600&q=80'
  when 'cleaning-and-ironing' then 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?auto=format&fit=crop&w=1600&q=80'
  when 'housekeeping' then 'https://images.unsplash.com/photo-1765970101654-337b573142fb?auto=format&fit=crop&w=1600&q=80'
  else image_url
end
where id in (
  'standard-cleaning','regular-cleaning','one-off-cleaning','deep-cleaning','spring-cleaning',
  'same-day-cleaning','airbnb-cleaning','ironing-service','cleaning-and-ironing','housekeeping'
);
