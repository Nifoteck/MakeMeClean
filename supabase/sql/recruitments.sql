-- Run this in your Supabase SQL editor

create table if not exists recruitments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Recruitment',
  status      text not null default 'active' check (status in ('active','closed')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

alter table recruitments enable row level security;

-- Public can read only the currently active recruitment(s)
do $$ begin
  create policy "Public read active recruitments"
    on recruitments for select
    using (status = 'active');
exception when duplicate_object then null;
end $$;

-- Helper (shared with other scripts): is_admin(uid)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;

-- Admin management (uses public.admins so you can add/remove admins without editing policies)
drop policy if exists "Admins manage recruitments" on recruitments;
create policy "Admins manage recruitments"
  on recruitments for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Add recruitment + user linkage to job applications
alter table job_applications add column if not exists user_id uuid references auth.users(id);
alter table job_applications add column if not exists recruitment_id uuid references recruitments(id);

-- Recommended: keep one application per user+role per recruitment
create unique index if not exists job_applications_unique_role_per_recruitment
  on job_applications (user_id, recruitment_id, role)
  where user_id is not null and recruitment_id is not null;

-- Applicants can read their own applications (for the candidate portal)
do $$ begin
  create policy "Users can view own applications"
    on job_applications for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- Applicants can submit only while logged in, for themselves, to an active recruitment
drop policy if exists "Anyone can submit application" on job_applications;
do $$ begin
  create policy "Users can submit own application (active recruitment only)"
    on job_applications for insert
    with check (
      auth.uid() = user_id
      and exists (
        select 1 from recruitments r
        where r.id = recruitment_id and r.status = 'active'
      )
    );
exception when duplicate_object then null;
end $$;
