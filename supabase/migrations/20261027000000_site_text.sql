-- Text edited in the admin ("Website text").
--
-- The website's own text stays in index.html, privacy.html and i18n/hi.json. A row here
-- replaces one of those texts when the site is built: `key` is the original English text
-- (whitespace-normalised) or, for messages written by the scripts, "js:<group>.<name>".
-- A null `en` or `hi` keeps the original for that language.
--
-- Additive only: two new tables, nothing the v1 site reads.

create table if not exists public.site_text (
  key text primary key check (length(key) between 1 and 2000),
  en text check (en is null or length(btrim(en)) between 1 and 4000),
  hi text check (hi is null or length(btrim(hi)) between 1 and 4000),
  en_updated_at timestamptz,
  hi_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Every earlier version, so a mistaken edit can be put back
create table if not exists public.site_text_history (
  id bigint generated always as identity primary key,
  key text not null,
  en text,
  hi text,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  replaced_by uuid default auth.uid()
);
create index if not exists site_text_history_key on public.site_text_history (key, changed_at desc);

create or replace function public.site_text_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    if new.en is not null then new.en_updated_at := now(); end if;
    if new.hi is not null then new.hi_updated_at := now(); end if;
  else
    new.en_updated_at := case when new.en is distinct from old.en then now() else old.en_updated_at end;
    new.hi_updated_at := case when new.hi is distinct from old.hi then now() else old.hi_updated_at end;
  end if;
  return new;
end $$;

create or replace function public.site_text_keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_text_history (key, en, hi, changed_at, changed_by)
  values (old.key, old.en, old.hi, old.updated_at, old.updated_by);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.site_text_keep_history() from public, anon, authenticated;

drop trigger if exists site_text_touch on public.site_text;
create trigger site_text_touch before insert or update on public.site_text
  for each row execute function public.site_text_touch();
drop trigger if exists site_text_history on public.site_text;
create trigger site_text_history after update or delete on public.site_text
  for each row execute function public.site_text_keep_history();

alter table public.site_text enable row level security;
alter table public.site_text_history enable row level security;

-- The text is public (it's on the website), and the build reads it with the publishable key.
-- Who edited it is not: anon may read only the text columns.
revoke all on public.site_text from anon;
grant select (key, en, hi) on public.site_text to anon;
drop policy if exists "Anyone reads site text" on public.site_text;
create policy "Anyone reads site text" on public.site_text for select to anon, authenticated using (true);
drop policy if exists "Admins insert site text" on public.site_text;
drop policy if exists "Admins update site text" on public.site_text;
drop policy if exists "Admins delete site text" on public.site_text;
create policy "Admins insert site text" on public.site_text for insert to authenticated with check (public.is_admin());
create policy "Admins update site text" on public.site_text for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete site text" on public.site_text for delete to authenticated using (public.is_admin());

revoke all on public.site_text_history from anon;
drop policy if exists "Admins read site text history" on public.site_text_history;
create policy "Admins read site text history" on public.site_text_history for select to authenticated using (public.is_admin());
