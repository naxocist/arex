-- Add is_focal_point flag to factories
-- Source: AREX Product Changes.pdf section 4.1

alter table factories
  add column if not exists is_focal_point boolean not null default false;
