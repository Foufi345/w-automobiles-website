-- ============================================================================
-- W Automobiles — Supabase Initial Schema, Admin Auth & RLS Policies
-- Migration: 001_init.sql
-- Run this script once in the Supabase SQL Editor.
-- ============================================================================

-- 1. Extensions
create extension if not exists pgcrypto;

-- 2. Single-row admin configuration table (not readable by anon/authenticated)
create table if not exists public.admin_config (
  id boolean primary key default true check (id = true),
  email text not null check (length(trim(email)) > 3 and position('@' in email) > 1),
  updated_at timestamptz not null default now()
);

alter table public.admin_config enable row level security;

-- Lock down direct access completely: only postgres / service_role / security definer functions can read it
revoke all on table public.admin_config from public, anon, authenticated;

-- 3. Admin check function (SECURITY DEFINER, STABLE)
-- Returns true ONLY when the caller is authenticated and their JWT email matches
-- the single email stored in public.admin_config.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.admin_config ac
      where ac.id = true
        and lower(trim(ac.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 4. Updated-at trigger helper
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5. Vehicles table: public.cars
create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  brand text not null check (length(trim(brand)) > 0),
  model text not null check (length(trim(model)) > 0),
  year int not null check (year >= 1990 and year <= extract(year from now())::int + 1),
  price bigint check (price is null or price >= 0),
  price_on_request boolean not null default false,
  mileage int not null default 0 check (mileage >= 0),
  fuel text not null check (fuel in ('Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL')),
  transmission text not null check (transmission in ('Manuelle', 'Automatique')),
  body_type text not null check (body_type in ('Berline', 'SUV', 'Citadine', 'Break', 'Coupé', 'Utilitaire')),
  color text,
  power text,
  engine text,
  doors int check (doors is null or (doors >= 2 and doors <= 6)),
  seats int check (seats is null or (seats >= 1 and seats <= 9)),
  condition text not null check (condition in ('Neuf', 'Occasion')),
  status text not null default 'Disponible' check (status in ('Disponible', 'Réservé', 'Vendu')),
  featured boolean not null default false,
  published boolean not null default true,
  description text,
  features text[] not null default '{}',
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cars_price_required_unless_on_request
    check (price_on_request = true or price is not null)
);

-- Trigger to keep updated_at fresh on every update
drop trigger if exists set_cars_updated_at on public.cars;
create trigger set_cars_updated_at
  before update on public.cars
  for each row
  execute function public.handle_updated_at();

-- Indexes (slug already has a unique btree index from the UNIQUE constraint; explicit named indexes below)
create index if not exists idx_cars_slug on public.cars (slug);
create index if not exists idx_cars_published on public.cars (published);
create index if not exists idx_cars_featured on public.cars (featured);
create index if not exists idx_cars_status on public.cars (status);
create index if not exists idx_cars_brand on public.cars (brand);

-- 6. Table Grants & Row Level Security on public.cars
-- Postgres requires table-level GRANTs in addition to RLS policies.
-- RLS strictly enforces row-level access (anon = published SELECT only; admin = full CRUD).
grant usage on schema public to anon, authenticated;
grant select on table public.cars to anon, authenticated;
grant insert, update, delete on table public.cars to authenticated;

alter table public.cars enable row level security;

-- Drop any pre-existing policies so this migration is safe to re-run
drop policy if exists "Public can view published cars" on public.cars;
drop policy if exists "Admin can view all cars" on public.cars;
drop policy if exists "Admin can insert cars" on public.cars;
drop policy if exists "Admin can update cars" on public.cars;
drop policy if exists "Admin can delete cars" on public.cars;

-- SELECT for anon + authenticated: published cars only
create policy "Public can view published cars"
  on public.cars
  for select
  to anon, authenticated
  using (published = true);

-- SELECT for admin: all rows (including unpublished drafts)
create policy "Admin can view all cars"
  on public.cars
  for select
  to authenticated
  using (public.is_admin());

-- INSERT / UPDATE / DELETE: admin only
create policy "Admin can insert cars"
  on public.cars
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admin can update cars"
  on public.cars
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin can delete cars"
  on public.cars
  for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- SETUP: Register your single admin email (run once, replacing the email)
-- ============================================================================
-- insert into public.admin_config (id, email)
-- values (true, 'admin@w-automobiles.dz')
-- on conflict (id) do update set email = excluded.email, updated_at = now();


-- ============================================================================
-- VERIFICATION SNIPPET: Test RLS & privileges in the Supabase SQL Editor
-- Run inside a transaction that rolls back so no test data is left behind.
-- ============================================================================
/*
begin;

-- Insert a temporary published car and a temporary draft car (as postgres/owner)
insert into public.cars (slug, brand, model, year, price, price_on_request, mileage, fuel, transmission, body_type, condition, published)
values
  ('rls-test-published', 'Audi', 'Test Pub', 2025, 10000000, false, 0, 'Diesel', 'Automatique', 'Berline', 'Neuf', true),
  ('rls-test-draft',     'Audi', 'Test Draft', 2025, 10000000, false, 0, 'Diesel', 'Automatique', 'Berline', 'Neuf', false);

-- 1) Simulate ANON visitor
set local role anon;

-- Expected: returns ONLY 'rls-test-published' (count = 1), NEVER 'rls-test-draft'
select slug, published from public.cars where slug in ('rls-test-published', 'rls-test-draft');

-- Expected: false
select public.is_admin() as anon_is_admin;

-- Expected: ERROR (permission denied for table admin_config)
-- select * from public.admin_config;

-- Expected: ERROR (new row violates row-level security policy for table "cars")
-- insert into public.cars (slug, brand, model, year, price, price_on_request, mileage, fuel, transmission, body_type, condition)
-- values ('rls-test-anon-insert', 'Audi', 'Nope', 2025, 1000000, false, 0, 'Diesel', 'Automatique', 'Berline', 'Neuf');

-- Expected: 0 rows updated / deleted
update public.cars set price = 1 where slug = 'rls-test-published';
delete from public.cars where slug = 'rls-test-published';

reset role;

-- 2) Simulate AUTHENTICATED ADMIN (replace with the email you put in public.admin_config)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid()::text,
  'role', 'authenticated',
  'email', 'admin@w-automobiles.dz'
)::text, true);

-- Expected: true (once admin_config has matching email)
select public.is_admin() as admin_is_admin;

-- Expected: returns BOTH 'rls-test-published' AND 'rls-test-draft'
select slug, published from public.cars where slug in ('rls-test-published', 'rls-test-draft');

rollback;
*/
