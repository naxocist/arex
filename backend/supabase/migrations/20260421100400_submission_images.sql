-- Add image_url to submissions table (nullable; enforced at form layer)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS image_url text;
