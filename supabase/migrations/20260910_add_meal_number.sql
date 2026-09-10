-- Add persistent Meal 1–5 slots to the existing meal tracker.
-- Safe to run more than once.

alter table public.meals
  add column if not exists meal_number smallint;

-- Give any meals still active during the migration a sensible slot so the
-- current tracker does not suddenly appear empty. Older history can remain
-- unnumbered because only the rolling 24-hour window is shown in My Life.
with active_unassigned as (
  select
    id,
    (((row_number() over (partition by user_id order by eaten_at)) - 1) % 5 + 1)::smallint as slot
  from public.meals
  where meal_number is null
    and eaten_at >= now() - interval '24 hours'
)
update public.meals m
set meal_number = a.slot
from active_unassigned a
where m.id = a.id;

alter table public.meals
  drop constraint if exists meals_meal_number_check;

alter table public.meals
  add constraint meals_meal_number_check
  check (meal_number is null or meal_number between 1 and 5);

create index if not exists meals_user_number_time_idx
  on public.meals(user_id, meal_number, eaten_at desc);
