-- ════════════════════════════════════════════════════════════════════════
-- 002 — BB Health: Core Schema (Diet, Water, Weight, Recent Foods, Combos)
-- Depends on: 001_extensions_and_shared_functions.sql
--
-- CONSOLIDATION NOTE:
--   user_settings below includes THREE boolean flags that were bolted on
--   by later, unrelated subsystems via ALTER TABLE ... ADD COLUMN IF NOT
--   EXISTS in the original migration history:
--     - is_store_admin        (originally added in 002_store_schema.sql,
--                               re-guarded in 003_store_admin.sql)
--     - pending_email_verify  (added in 015_fix_signup_verify_otp.sql)
--     - password_set          (added in 016_password_set_flag.sql)
--   They are folded directly into this table's CREATE TABLE definition
--   (one authoritative definition per object, per the consolidation brief)
--   instead of being scattered across store/auth-specific files as
--   after-the-fact ALTERs. This table is still one logical object — see
--   003_auth_and_signup_security.sql and 006_store_admin_security.sql /
--   007_store_security_rls.sql for how each flag is used downstream.
-- ════════════════════════════════════════════════════════════════════════

-- ── user_settings ─────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id               uuid references auth.users(id) on delete cascade primary key,
  name                  text not null default '',
  goal_mode             text not null default 'gain', -- 'gain' | 'lose' | 'maintain'
  calorie_goal          numeric not null default 3500,
  protein_goal          numeric not null default 180,
  goal_weight_kg        numeric not null default 80,
  start_weight_kg       numeric not null default 70,
  water_goal_ml         numeric not null default 2500,
  units                 text not null default 'metric',
  theme                 text not null default 'dark',
  onboarded             boolean not null default false,

  -- ── BB Store admin flag (see 006_store_admin_security.sql /
  --    007_store_security_rls.sql — gates every store admin-write policy) ──
  is_store_admin        boolean not null default false,

  -- ── Manual-signup auth flags (see 003_auth_and_signup_security.sql) ──
  -- pending_email_verify: true = manual email signup, OTP not yet verified.
  -- password_set:         true = user has completed /set-password with a
  --                        real, self-chosen password.
  pending_email_verify  boolean not null default false,
  password_set          boolean not null default false,

  updated_at            timestamptz not null default now()
);

-- ── foods (the planned Diet / Today's Checklist) ────────────────────────
create table if not exists public.foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  emoji            text not null default 'Utensils', -- stores a lucide-react icon key (e.g. "Drumstick"), not a raw emoji
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
  active_date      date, -- when set, this food is a one-off shown only on this single calendar date
  category         text not null default 'other',
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now()
);

-- One-time data fix (idempotent, safe to re-run, no-op on a fresh project):
-- the app used to store a raw emoji character in `emoji` (e.g. '🥚'); it now
-- stores a lucide-react icon key (e.g. 'Egg'). Upgrades any pre-existing
-- rows still holding an old raw emoji to the closest icon key. Rows already
-- holding a valid icon key are left untouched; anything else still holding a
-- raw emoji falls back to the generic icon at render time — no data loss.
update public.foods set emoji = 'Egg' where emoji = '🥚';
update public.foods set emoji = 'CupSoda' where emoji = '🥤';
update public.foods set emoji = 'Drumstick' where emoji = '🍗';
update public.foods set emoji = 'Wheat' where emoji in ('🍚', '🥣');
update public.foods set emoji = 'Milk' where emoji = '🥛';
update public.foods set emoji = 'Nut' where emoji in ('🥜', '🫘');
update public.foods set emoji = 'Banana' where emoji = '🍌';
update public.foods set emoji = 'Cookie' where emoji = '🥞';
update public.foods set emoji = 'Milk' where emoji = '🧀';
update public.foods set emoji = 'Carrot' where emoji in ('🥑', '🍠');
update public.foods set emoji = 'Utensils' where emoji = '🍽️';

-- ── day_logs ──────────────────────────────────────────────────────────
create table if not exists public.day_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  date                  date not null,
  food_id               uuid references public.foods(id) on delete cascade not null,
  logged_quantity       numeric not null default 0,
  -- portion of logged_quantity credited via a Recent Food's ingredients
  -- (e.g. biryani crediting Rice) rather than a direct checklist tap
  contributed_quantity  numeric not null default 0,
  updated_at            timestamptz not null default now(),
  unique (user_id, date, food_id)
);

-- ── daily_water ───────────────────────────────────────────────────────
create table if not exists public.daily_water (
  user_id   uuid references auth.users(id) on delete cascade not null,
  date      date not null,
  water_ml  numeric not null default 0,
  primary key (user_id, date)
);

-- ── weight_entries ────────────────────────────────────────────────────
create table if not exists public.weight_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  date       date not null,
  weight_kg  numeric not null,
  unique (user_id, date)
);

-- ── Recent Foods ──────────────────────────────────────────────────────
-- Foods the user actually ate that are NOT part of their planned Diet
-- (e.g. a one-off pizza, biryani, cake). Kept entirely separate from
-- public.foods: Recent Foods never repeat automatically and never show up
-- in Today's Checklist. `recent_foods` is the reusable catalog entry;
-- `recent_food_logs` is the per-day history of actually eating it. A
-- Recent Food only becomes part of the Diet when the user explicitly
-- moves it there (creating a normal row in public.foods).
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
  -- true if this entry's log carried Diet contributions (a composite dish
  -- crediting Diet ingredients)
  mapped           boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (user_id, date, recent_food_id)
);

-- ── Meal Combos ───────────────────────────────────────────────────────
-- A saved group of foods the user can log in one tap. `items` is a small
-- JSON array of {"foodId"|"recentFoodId": "...", "quantity": number},
-- referencing rows in public.foods OR public.recent_foods.
create table if not exists public.meal_combos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  icon        text not null default 'UtensilsCrossed',
  items       jsonb not null default '[]',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Milestones ────────────────────────────────────────────────────────
-- One row per unlocked achievement per user. We only ever insert (never
-- update); presence of a row is what stops the celebration firing again.
create table if not exists public.milestones (
  user_id      uuid references auth.users(id) on delete cascade not null,
  key          text not null,
  achieved_at  date not null default current_date,
  primary key (user_id, key)
);

-- ── Indexes ───────────────────────────────────────────────────────────
create index if not exists recent_foods_user_idx on public.recent_foods (user_id);
create index if not exists recent_food_logs_user_date_idx on public.recent_food_logs (user_id, date);
create index if not exists day_logs_user_date_idx on public.day_logs (user_id, date);
create index if not exists weight_entries_user_date_idx on public.weight_entries (user_id, date);
create index if not exists meal_combos_user_idx on public.meal_combos (user_id);
create index if not exists milestones_user_idx on public.milestones (user_id);

-- ── Row Level Security — every user can only ever touch their own rows ──
alter table public.user_settings enable row level security;
alter table public.foods enable row level security;
alter table public.day_logs enable row level security;
alter table public.daily_water enable row level security;
alter table public.weight_entries enable row level security;
alter table public.meal_combos enable row level security;
alter table public.milestones enable row level security;
alter table public.recent_foods enable row level security;
alter table public.recent_food_logs enable row level security;

-- NOTE on user_settings policies: the historical 003_store_admin.sql added
-- a second, purely redundant SELECT-only policy ("user_settings_self_read")
-- alongside the pre-existing "own settings" ALL policy below — both used
-- the exact same `auth.uid() = user_id` condition, so the extra policy
-- changed nothing about effective access. It is not recreated here (see
-- CONSOLIDATION_REPORT.md, "Removed redundancies").
drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own foods" on public.foods;
create policy "own foods" on public.foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own logs" on public.day_logs;
create policy "own logs" on public.day_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own water" on public.daily_water;
create policy "own water" on public.daily_water
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own weights" on public.weight_entries;
create policy "own weights" on public.weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meal combos" on public.meal_combos;
create policy "own meal combos" on public.meal_combos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own milestones" on public.milestones;
create policy "own milestones" on public.milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own recent foods" on public.recent_foods;
create policy "own recent foods" on public.recent_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own recent food logs" on public.recent_food_logs;
create policy "own recent food logs" on public.recent_food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Realtime — lets the app sync instantly across a user's own devices ──
-- Safe to re-run; Postgres raises duplicate_object harmlessly if already added.
do $$ begin alter publication supabase_realtime add table public.foods; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.day_logs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.daily_water; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.weight_entries; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_settings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meal_combos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.milestones; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recent_foods; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recent_food_logs; exception when duplicate_object then null; end $$;
