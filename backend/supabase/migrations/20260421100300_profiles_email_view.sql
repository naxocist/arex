create or replace view public.profiles_with_email as
select
  p.id,
  p.role,
  p.display_name,
  p.phone,
  p.province,
  p.approval_status,
  p.created_at,
  p.updated_at,
  u.email
from public.profiles p
join auth.users u on u.id = p.id;
