-- Vyana Soul v2 foundation.
-- Additive and safe for the live v1 site: v1 writes through its own edge function with the
-- service role, keeps the same status values, doesn't read the new columns, and sees no new rows.

-- ---------------------------------------------------------------------------
-- 1. Booking requests: extend the existing table
-- ---------------------------------------------------------------------------
alter table public.consultancy_requests
  add column if not exists ref text,
  add column if not exists timezone text not null default '',
  add column if not exists preferred_date date,
  add column if not exists session_language text not null default '',
  add column if not exists locale text not null default 'en',
  add column if not exists source text not null default 'v1',
  add column if not exists ip_hash text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists consultancy_requests_ref_key on public.consultancy_requests (ref) where ref is not null;
create index if not exists consultancy_requests_created_at_idx on public.consultancy_requests (created_at desc);
create index if not exists consultancy_requests_ip_recent_idx on public.consultancy_requests (ip_hash, created_at desc) where ip_hash is not null;

-- Anyone could insert rows straight into these tables with the public anon key, skipping all
-- validation. Both sites now write through edge functions that use the service role instead.
drop policy if exists "Anyone can submit consultancy request" on public.consultancy_requests;
drop policy if exists "Anyone can submit contact message" on public.contact_messages;

-- ---------------------------------------------------------------------------
-- 2. Notification log: one row per alert attempt (Telegram, email)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultancy_requests (id) on delete cascade,
  channel text not null check (channel in ('telegram', 'owner_email', 'client_email')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  attempts int not null default 1,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, channel)
);
create index if not exists notification_log_failed_idx on public.notification_log (updated_at) where status = 'failed';

alter table public.notification_log enable row level security;
drop policy if exists "Admins read notification log" on public.notification_log;
create policy "Admins read notification log" on public.notification_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Reviews: moderation fields and admin management
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists published boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists consent_obtained boolean not null default false,
  add column if not exists language text not null default 'en' check (language in ('en', 'hi', 'hinglish')),
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "Public read reviews" on public.reviews;
create policy "Public read published reviews" on public.reviews
  for select to anon, authenticated using (published = true or public.is_admin());

drop policy if exists "Admins insert reviews" on public.reviews;
drop policy if exists "Admins update reviews" on public.reviews;
drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Admins insert reviews" on public.reviews for insert to authenticated with check (public.is_admin());
create policy "Admins update reviews" on public.reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete reviews" on public.reviews for delete to authenticated using (public.is_admin());

-- Language of the existing reviews (detected from their script)
update public.reviews set language = 'hi' where review ~ '[ऀ-ॿ]' and language = 'en';
update public.reviews set language = 'hinglish'
  where language = 'en' and review ~* '\m(mera|mujhe|aapne|bahut|hai|raha|unhone|saath)\M';

-- (The four reviews the v2 frontend hard-coded are added at launch by the cut-over migration,
--  because the v1 site lists every row in this table.)

-- ---------------------------------------------------------------------------
-- 4. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists consultancy_requests_touch on public.consultancy_requests;
create trigger consultancy_requests_touch before update on public.consultancy_requests
  for each row execute function public.touch_updated_at();
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();
drop trigger if exists notification_log_touch on public.notification_log;
create trigger notification_log_touch before update on public.notification_log
  for each row execute function public.touch_updated_at();

-- is_admin() is SECURITY DEFINER; pin its search_path so it can't be hijacked
alter function public.is_admin() set search_path = public;
