-- ── Admin account approval system ──────────────────────────────────────────
-- 1. approval_status on profiles (pending | approved | rejected)
-- 2. approval_note on profiles
-- 3. admin_settings table for approval_required_roles toggle

alter table public.profiles
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approval_note text;

-- All existing profiles are already approved
update public.profiles set approval_status = 'approved' where approval_status is null;

-- Admin settings: one row, keyed by 'global'
create table if not exists public.admin_settings (
  key text primary key,
  approval_required_roles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Insert default row (no roles require approval out of the box)
insert into public.admin_settings (key, approval_required_roles)
values ('global', '["farmer"]'::jsonb)
on conflict (key) do nothing;

-- RLS: only service role reads/writes admin_settings
alter table public.admin_settings enable row level security;

create policy "service_role_only_admin_settings"
  on public.admin_settings
  for all
  using (false);
