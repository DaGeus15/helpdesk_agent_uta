-- Google Form URL per course for prefilled enrollment links.
-- Idempotent. Run before (or with) supabase/seed_ctt.sql after regenerating the scraper.

alter table courses add column if not exists enrollment_form_url text;
