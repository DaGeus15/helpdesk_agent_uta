-- Detect INSCRIBIRME button on the public listing (idempotent).

alter table courses
  add column if not exists enroll_open_on_site boolean not null default false;
