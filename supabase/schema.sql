-- BodyBuddy (Goal-Based Nutrition Companion) — Supabase schema
-- Run this once in your project's SQL editor: https://supabase.com/dashboard/project/_/sql/new

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id          uuid references auth.users(id) on delete cascade primary key,
  name             text not null default '',
  goal_mode        text not null default 'gain', -- 'gain' | 'lose' | 'maintain'
  calorie_goal     numeric not null default 3500,
  protein_goal     numeric not null default 180,
  goal_weight_kg   numeric not null default 80,
  start_weight_kg  numeric not null default 70,
  water_goal_ml    numeric not null default 2500,
  units            text not null default 'metric',
  theme            text not null default 'dark',
  onboarded        boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table if not exists public.foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  emoji            text not null default 'Utensils',
  target_quantity  numeric not null default 1,
  unit             text not null default 'count',
  calories         numeric not null default 0,
  protein          numeric not null default 0,
  carbs            numeric not null default 0,
  fats             numeric not null default 0,
  aliases          text[] not null default '{}',
  sort_order       int not null default 0,
  archived         boolean not null default false,
  kind             text not null default 'quantity',
  active_days      smallint[] not null default '{0,1,2,3,4,5,6}',
  active_date      date,
  category         text not null default 'other',
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now()
);

create table if not exists public.day_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade not null,
  date                 date not null,
  food_id              uuid references public.foods(id) on delete cascade not null,
  logged_quantity      numeric not null default 0,
  contributed_quantity numeric not null default 0,
  updated_at           timestamptz not null default now(),
  unique (user_id, date, food_id)
);

create table if not exists public.daily_water (
  user_id   uuid references auth.users(id) on delete cascade not null,
  date      date not null,
  water_ml  numeric not null default 0,
  primary key (user_id, date)
);

create table if not exists public.weight_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  date       date not null,
  weight_kg  numeric not null,
  unique (user_id, date)
);

-- ── Recent Foods (Food System Redesign) ─────────────────────────────────

create table if not exists public.recent_foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  emoji            text not null default 'Utensils',
  target_quantity  numeric not null default 1,
  unit             text not null default 'serving',
  kind             text not null default 'binary',
  calories         numeric not null default 0,
  protein          numeric not null default 0,
  carbs            numeric not null default 0,
  fats             numeric not null default 0,
  aliases          text[] not null default '{}',
  category         text not null default 'other',
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now()
);

create table if not exists public.recent_food_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  date             date not null,
  recent_food_id   uuid references public.recent_foods(id) on delete cascade not null,
  logged_quantity  numeric not null default 0,
  mapped           boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (user_id, date, recent_food_id)
);

-- ── Meal Combos ──────────────────────────────────────────────────────────

create table if not exists public.meal_combos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  icon        text not null default 'UtensilsCrossed',
  items       jsonb not null default '[]',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Milestones ───────────────────────────────────────────────────────────

create table if not exists public.milestones (
  user_id      uuid references auth.users(id) on delete cascade not null,
  key          text not null,
  achieved_at  date not null default current_date,
  primary key (user_id, key)
);

-- ── Indexes ──────────────────────────────────────────────────────────────

create index if not exists day_logs_user_date_idx        on public.day_logs (user_id, date);
create index if not exists weight_entries_user_date_idx  on public.weight_entries (user_id, date);
create index if not exists meal_combos_user_idx          on public.meal_combos (user_id);
create index if not exists milestones_user_idx           on public.milestones (user_id);
create index if not exists recent_foods_user_idx         on public.recent_foods (user_id);
create index if not exists recent_food_logs_user_date_idx on public.recent_food_logs (user_id, date);

-- ── One-time emoji → icon key migration ──────────────────────────────────

update public.foods set emoji = 'Egg'       where emoji = '🥚';
update public.foods set emoji = 'CupSoda'   where emoji = '🥤';
update public.foods set emoji = 'Drumstick' where emoji = '🍗';
update public.foods set emoji = 'Wheat'     where emoji in ('🍚', '🥣');
update public.foods set emoji = 'Milk'      where emoji = '🥛';
update public.foods set emoji = 'Nut'       where emoji in ('🥜', '🫘');
update public.foods set emoji = 'Banana'    where emoji = '🍌';
update public.foods set emoji = 'Cookie'    where emoji = '🥞';
update public.foods set emoji = 'Milk'      where emoji = '🧀';
update public.foods set emoji = 'Carrot'    where emoji in ('🥑', '🍠');
update public.foods set emoji = 'Utensils'  where emoji = '🍽️';

-- ── Row Level Security ────────────────────────────────────────────────────

alter table public.user_settings   enable row level security;
alter table public.foods           enable row level security;
alter table public.day_logs        enable row level security;
alter table public.daily_water     enable row level security;
alter table public.weight_entries  enable row level security;
alter table public.meal_combos     enable row level security;
alter table public.milestones      enable row level security;
alter table public.recent_foods    enable row level security;
alter table public.recent_food_logs enable row level security;

drop policy if exists "own settings"          on public.user_settings;
drop policy if exists "own foods"             on public.foods;
drop policy if exists "own logs"              on public.day_logs;
drop policy if exists "own water"             on public.daily_water;
drop policy if exists "own weights"           on public.weight_entries;
drop policy if exists "own meal combos"       on public.meal_combos;
drop policy if exists "own milestones"        on public.milestones;
drop policy if exists "own recent foods"      on public.recent_foods;
drop policy if exists "own recent food logs"  on public.recent_food_logs;

create policy "own settings"         on public.user_settings    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own foods"            on public.foods            for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own logs"             on public.day_logs         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own water"            on public.daily_water      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weights"          on public.weight_entries   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meal combos"      on public.meal_combos      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own milestones"       on public.milestones       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recent foods"     on public.recent_foods     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recent food logs" on public.recent_food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Auto-create a settings row the moment someone signs up ───────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Realtime ──────────────────────────────────────────────────────────────

do $$ begin alter publication supabase_realtime add table public.user_settings;    exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.foods;            exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.day_logs;         exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.daily_water;      exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.weight_entries;   exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.meal_combos;      exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.milestones;       exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.recent_foods;     exception when duplicate_object then null; end; $$;
do $$ begin alter publication supabase_realtime add table public.recent_food_logs; exception when duplicate_object then null; end; $$;