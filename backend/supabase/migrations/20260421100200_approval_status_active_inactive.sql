-- Rename approval_status values: approved→active, pending/rejected→inactive
-- Drop old check constraint, migrate data, add new constraint

alter table public.profiles
  drop constraint if exists profiles_approval_status_check;

update public.profiles set approval_status = 'active'   where approval_status = 'approved';
update public.profiles set approval_status = 'inactive' where approval_status in ('pending', 'rejected');

alter table public.profiles
  drop column if exists approval_note;

alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('active', 'inactive'));
