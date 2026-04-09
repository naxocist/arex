alter table public.factories
  add column if not exists factory_profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'factories_factory_profile_id_fkey'
  ) then
    alter table public.factories
      add constraint factories_factory_profile_id_fkey
      foreign key (factory_profile_id)
      references public.profiles(id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists ux_factories_factory_profile_id
  on public.factories (factory_profile_id)
  where factory_profile_id is not null;
