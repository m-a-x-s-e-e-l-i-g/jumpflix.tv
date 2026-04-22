alter table public.media_items
  drop constraint if exists media_items_facet_theme_check;

alter table public.media_items
  add constraint media_items_facet_theme_check check (
    facet_theme in (
      'journey',
      'team',
      'event',
      'competition',
      'educational',
      'travel',
      'creative',
      'showcase',
      'entertainment'
    )
  );

comment on column public.media_items.facet_theme is 'Theme/purpose: journey, team, event, competition, educational, travel, creative, showcase, entertainment (single-select)';