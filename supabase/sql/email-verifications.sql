-- Run this in your Supabase SQL editor

create table if not exists email_verifications (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  purpose      text not null default 'registration',
  otp          text not null,
  expires_at   timestamptz not null,
  verified_at  timestamptz,
  created_at   timestamptz default now()
);

create index if not exists email_verifications_lookup
  on email_verifications (email, purpose, expires_at);

-- No RLS policies = only accessible via service role (edge functions)
alter table email_verifications enable row level security;

-- Career application drafts column (add to existing table)
alter table job_applications add column if not exists status_draft boolean default false;
alter table job_applications add column if not exists draft_data jsonb;
