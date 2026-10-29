-- Photos replaced in the website's edit mode (?edit).
--
-- The editor resizes a new photo in the browser and uploads it here. site_text then holds
-- "img:<original path>" -> {"src","w","h","pos"} (JSON in `en`), and the build puts the new
-- photo in place of the original on both pages.
--
-- Additive only: a new bucket and policies for it, nothing the v1 site uses.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can see the photos (they're on the website, served from the public URL);
-- only admins can add, replace or remove them
drop policy if exists "Admins add site photos" on storage.objects;
drop policy if exists "Admins replace site photos" on storage.objects;
drop policy if exists "Admins remove site photos" on storage.objects;
create policy "Admins add site photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-photos' and public.is_admin());
create policy "Admins replace site photos" on storage.objects for update to authenticated
  using (bucket_id = 'site-photos' and public.is_admin()) with check (bucket_id = 'site-photos' and public.is_admin());
create policy "Admins remove site photos" on storage.objects for delete to authenticated
  using (bucket_id = 'site-photos' and public.is_admin());
