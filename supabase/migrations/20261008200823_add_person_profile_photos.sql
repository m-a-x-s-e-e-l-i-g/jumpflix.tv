alter table public.person_profiles
  add column profile_photo_path text,
  add column profile_photo_source text check (profile_photo_source in ('instagram', 'upload')),
  add column profile_photo_handle text,
  add constraint person_profile_photo_path_format check
    (profile_photo_path is null or profile_photo_path ~ '^[0-9a-f-]{36}\.webp$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('person-photos', 'person-photos', true, 1048576, array['image/webp']);

-- Existing person_profiles public SELECT policy covers these public photos.
-- Storage writes use the server service role; no client write policies are granted.
