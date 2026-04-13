-- Logistics accounts table (mirrors factories pattern)
create table if not exists public.logistics_accounts (
  id uuid primary key default gen_random_uuid(),
  logistics_profile_id uuid not null references public.profiles(id) on delete cascade,
  name_th text not null,
  location_text text,
  lat double precision,
  lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_logistics_accounts_profile_id
  on public.logistics_accounts (logistics_profile_id);

alter table public.logistics_accounts enable row level security;
