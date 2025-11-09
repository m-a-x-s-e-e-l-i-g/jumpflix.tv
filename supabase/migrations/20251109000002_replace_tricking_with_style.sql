-- Replace 'tricking' with 'style' in movement facets
-- Update all existing records that have 'tricking' to use 'style' instead

-- Update all media_items that have 'tricking' in their facet_movement array
update public.media_items
set facet_movement = array_replace(facet_movement, 'tricking', 'style')
where 'tricking' = any(facet_movement);

-- Update the comment to reflect the new movement style
comment on column public.media_items.facet_movement is 'Movement style: flow, big-sends, style, technical, speed, oldskool, contemporary (multi-select)';
