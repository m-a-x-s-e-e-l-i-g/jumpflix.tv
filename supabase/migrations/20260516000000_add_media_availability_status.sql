alter table public.media_items
    add column if not exists availability_status text not null default 'available';

alter table public.media_items
    drop constraint if exists media_items_availability_status_check;

alter table public.media_items
    add constraint media_items_availability_status_check
    check (availability_status in ('available', 'unavailable'));

create index if not exists media_items_availability_status_idx
    on public.media_items (availability_status);
