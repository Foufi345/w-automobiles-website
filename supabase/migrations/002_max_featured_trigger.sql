-- ============================================================================
-- W Automobiles — Enforce max 6 featured vehicles at the database level
-- Migration: 002_max_featured_trigger.sql
-- ============================================================================

create or replace function public.enforce_max_featured_cars()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  featured_count int;
begin
  if new.featured = true then
    select count(*)
      into featured_count
      from public.cars
     where featured = true
       and (tg_op = 'INSERT' or id <> new.id);

    if featured_count >= 6 then
      raise exception '6 véhicules en vedette maximum. Retirez-en un d''abord.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_max_featured_cars on public.cars;
create trigger check_max_featured_cars
  before insert or update of featured on public.cars
  for each row
  execute function public.enforce_max_featured_cars();
