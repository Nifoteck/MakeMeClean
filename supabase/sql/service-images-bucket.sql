-- Service images storage bucket + RLS

insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

-- Public can read service images
drop policy if exists "Public read service images" on storage.objects;
create policy "Public read service images"
  on storage.objects for select
  using (bucket_id = 'service-images');

-- Admins can upload/update/delete service images
drop policy if exists "Admins insert service images" on storage.objects;
create policy "Admins insert service images"
  on storage.objects for insert
  with check (bucket_id = 'service-images' and public.is_admin(auth.uid()));

drop policy if exists "Admins update service images" on storage.objects;
create policy "Admins update service images"
  on storage.objects for update
  using (bucket_id = 'service-images' and public.is_admin(auth.uid()))
  with check (bucket_id = 'service-images' and public.is_admin(auth.uid()));

drop policy if exists "Admins delete service images" on storage.objects;
create policy "Admins delete service images"
  on storage.objects for delete
  using (bucket_id = 'service-images' and public.is_admin(auth.uid()));

