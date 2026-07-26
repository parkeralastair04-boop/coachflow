-- Academy website visibility + public brand content (Launch Sprint 10)

alter table if exists public.academies
  add column if not exists public_description text;

alter table if exists public.academies
  add column if not exists public_address text;

comment on column public.academies.public_description is
  'Optional public About/home copy for the academy website.';
comment on column public.academies.public_address is
  'Optional public address shown on the contact page when set.';

-- Camps: explicit opt-in for public website (grandfather existing as visible)
alter table if exists public.camps
  add column if not exists website_visible boolean not null default false;

update public.camps
set website_visible = true
where website_visible = false;

alter table if exists public.camps
  alter column website_visible set default false;

create index if not exists camps_website_visible_idx
  on public.camps (academy_id, website_visible)
  where website_visible = true;

comment on column public.camps.website_visible is
  'When true, the camp may appear on the public academy website.';

-- Teams: explicit flag; existing teams stay public
alter table if exists public.teams
  add column if not exists website_visible boolean not null default true;

create index if not exists teams_website_visible_idx
  on public.teams (academy_id, website_visible)
  where website_visible = true;

comment on column public.teams.website_visible is
  'When true, the team may appear on the public academy website (no squad/PII).';

-- Matches/fixtures: explicit flag; existing matches stay public
alter table if exists public.matches
  add column if not exists website_visible boolean not null default true;

create index if not exists matches_website_visible_idx
  on public.matches (academy_id, website_visible)
  where website_visible = true;

comment on column public.matches.website_visible is
  'When true, fixtures/results for this match may appear on the public academy website.';
