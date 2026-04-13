-- Add optional image URL to rewards catalog
alter table rewards_catalog add column if not exists image_url text;
