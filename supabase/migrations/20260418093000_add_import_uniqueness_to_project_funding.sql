create unique index if not exists project_costs_source_import_unique
on public.project_costs (source_system, source_reference)
where source_system is not null and source_reference is not null;

create unique index if not exists project_donations_source_import_unique
on public.project_donations (source_system, source_reference)
where source_system is not null and source_reference is not null;