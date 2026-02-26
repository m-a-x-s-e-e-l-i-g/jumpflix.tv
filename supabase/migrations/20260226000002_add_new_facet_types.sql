-- Migration: Expand facet_type values (music-video, talk)
-- Issue #69: https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/69

-- Drop the canonical constraint name (common case)
alter table public.media_items
	drop constraint if exists media_items_facet_type_check;

do $$
declare
	constraint_name text;
begin
	-- Drop the existing facet_type CHECK constraint (name may vary across environments)
	for constraint_name in
		select c.conname
		from pg_constraint c
		where c.conrelid = 'public.media_items'::regclass
			and c.contype = 'c'
			and pg_get_constraintdef(c.oid) like '%facet_type%'
	loop
		execute format('alter table public.media_items drop constraint %I', constraint_name);
	end loop;
end $$;

-- Best-effort data migration (safe even if no rows match)
-- Note: do this after dropping constraints, since older constraints may not allow 'talk'.
update public.media_items
set facet_type = 'talk'
where facet_type = 'ted-talk';

alter table public.media_items
	add constraint media_items_facet_type_check check (
		facet_type in (
			'fiction',
			'documentary',
			'session',
			'event',
			'tutorial',
			'music-video',
			'talk'
		)
	);

comment on column public.media_items.facet_type is 'Content type: fiction, documentary, session, event, tutorial, music-video, talk (single-select)';
comment on column public.media_items.facet_movement is 'Movement style: flow, big-sends, style, descents, technical, speed, oldskool, contemporary (multi-select)';
