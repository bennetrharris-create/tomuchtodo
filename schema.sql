-- My Life v0.3 Supabase schema
-- Run this in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'School',
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);

alter table public.tasks enable row level security;

drop policy if exists "users read own tasks" on public.tasks;
create policy "users read own tasks"
on public.tasks for select
using (auth.uid() = user_id);

drop policy if exists "users insert own tasks" on public.tasks;
create policy "users insert own tasks"
on public.tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "users update own tasks" on public.tasks;
create policy "users update own tasks"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users delete own tasks" on public.tasks;
create policy "users delete own tasks"
on public.tasks for delete
using (auth.uid() = user_id);


create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now()
);

create index if not exists meals_user_time_idx on public.meals(user_id, eaten_at desc);

alter table public.meals enable row level security;

drop policy if exists "users read own meals" on public.meals;
create policy "users read own meals"
on public.meals for select using (auth.uid() = user_id);

drop policy if exists "users insert own meals" on public.meals;
create policy "users insert own meals"
on public.meals for insert with check (auth.uid() = user_id);

drop policy if exists "users delete own meals" on public.meals;
create policy "users delete own meals"
on public.meals for delete using (auth.uid() = user_id);


create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value_lb numeric(6,2) not null check (value_lb > 0),
  measured_at timestamptz not null default now()
);

create index if not exists weights_user_time_idx on public.weights(user_id, measured_at desc);

alter table public.weights enable row level security;

drop policy if exists "users read own weights" on public.weights;
create policy "users read own weights"
on public.weights for select using (auth.uid() = user_id);

drop policy if exists "users insert own weights" on public.weights;
create policy "users insert own weights"
on public.weights for insert with check (auth.uid() = user_id);

drop policy if exists "users delete own weights" on public.weights;
create policy "users delete own weights"
on public.weights for delete using (auth.uid() = user_id);


-- OAuth refresh tokens are server-only.
-- RLS is enabled and there are deliberately no browser policies.
-- Netlify Functions use the service-role key, which bypasses RLS.
create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  google_email text,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;
