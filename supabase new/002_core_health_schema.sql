-- ════════════════════════════════════════════════════════════════════════
-- 002 — BB Health: core schema
-- Depends on: 001. (Requires Supabase's auth.users.)
--
-- Everything the nutrition-tracking half of the app stores. Every table is
-- per-user and protected by Row Level Security: a signed-in user can only
-- ever read or write rows whose user_id is their own.
--
--   user_settings                  goals, profile, preferences (1 row / user)
--   foods                          the planned Diet / Today's Checklist
--   day_logs                       how much of each Diet food was eaten per day
--   daily_water                    water intake per day
--   weight_entries                 weight per day
--   recent_foods                   one-off foods eaten outside the Diet
--   recent_food_logs               per-day history of eating a Recent Food
--   recent_food_log_contributions  which dish credited which Diet food
--   meal_combos / meal_combo_items saved one-tap meal groups
--   milestones                     unlocked achievements
--
-- Auth / admin flags are NOT on user_settings — see 003 (user_security).
-- ════════════════════════════════════════════════════════════════════════

-- ── user_settings ───────────────────────────────────────────────────────
-- Users may freely update their own row, so nothing security-sensitive
-- lives here.
create table if not exists public.user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  name             text    not null default '',
  goal_mode        text    not null default 'gain',
  calorie_goal     numeric not null default 3500,
  protein_goal     numeric not null default 180,
  goal_weight_kg   numeric not null default 80,
  start_weight_kg  numeric not null default 70,
  water_goal_ml    numeric not null default 2500,
  units            text    not null default 'metric',
  theme            text    not null default 'dark',
  onboarded        boolean not null default false,
  gender           text,        -- set during onboarding; used for calorie/protein targets
  height_cm        numeric,     -- set during onboarding
  updated_at       timestamptz not null default now(),

  constraint user_settings_goal_mode_chk check (goal_mode in ('gain','lose','maintain')),
  constraint user_settings_units_chk     check (units in ('metric','imperial')),
  constraint user_settings_theme_chk     check (theme in ('light','dark','system','princess')),
  constraint user_settings_gender_chk    check (gender is null or gender in ('male','female','other'))
);

-- ── foods — the planned Diet (Today's Checklist) ────────────────────────
create table if not exists public.foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  emoji            text not null default 'Utensils',   -- a lucide-react icon key, not a raw emoji
  target_quantity  numeric not null default 1,
  unit             text not null default 'count',
  calories         numeric not null default 0,
  protein          numeric not null default 0,
  carbs            numeric not null default 0,
  fats             numeric not null default 0,
  aliases          text[]  not null default '{}',
  sort_order       int     not null default 0,
  archived         boolean not null default false,
  kind             text    not null default 'quantity',
  active_days      smallint[] not null default '{0,1,2,3,4,5,6}',  -- 0 = Sunday
  active_date      date,                                -- set = one-off food shown only on this date
  category         text not null default 'other',
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now(),

  constraint foods_kind_chk     check (kind in ('binary','quantity')),
  constraint foods_unit_chk     check (unit in ('g','ml','serving','count','oz')),
  constraint foods_category_chk check (category in ('protein','grain','vegetable','fruit','dairy','fat','custom','other'))
);

-- ── day_logs — one row per (user, date, Diet food) ──────────────────────
create table if not exists public.day_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  date                  date not null,
  food_id               uuid not null references public.foods(id) on delete cascade,
  logged_quantity       numeric not null default 0,
  -- Part of logged_quantity credited by a dish (e.g. biryani crediting Rice)
  -- rather than a direct checklist tap. Per-dish detail is in
  -- recent_food_log_contributions; this column is the fast per-day total.
  contributed_quantity  numeric not null default 0,
  updated_at            timestamptz not null default now(),
  unique (user_id, date, food_id)
);

-- ── daily_water / weight_entries ────────────────────────────────────────
create table if not exists public.daily_water (
  user_id   uuid not null references auth.users(id) on delete cascade,
  date      date not null,
  water_ml  numeric not null default 0,
  primary key (user_id, date)
);

create table if not exists public.weight_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  weight_kg  numeric not null,
  unique (user_id, date)
);

-- ── Recent Foods ────────────────────────────────────────────────────────
-- Foods eaten that are NOT part of the planned Diet (a one-off pizza,
-- biryani, cake). They never repeat automatically and never appear in
-- Today's Checklist, which is why they are separate from public.foods.
-- A Recent Food becomes part of the Diet only when the user explicitly
-- moves it there (creating a normal row in public.foods).
create table if not exists public.recent_foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  emoji            text not null default 'Utensils',
  target_quantity  numeric not null default 1,
  unit             text not null default 'serving',
  kind             text not null default 'binary',
  calories         numeric not null default 0,
  protein          numeric not null default 0,
  carbs            numeric not null default 0,
  fats             numeric not null default 0,
  aliases          text[]  not null default '{}',
  category         text not null default 'other',
  custom_category  text not null default '',
  base_ingredient  text not null default '',
  created_at       timestamptz not null default now(),

  constraint recent_foods_kind_chk     check (kind in ('binary','quantity')),
  constraint recent_foods_unit_chk     check (unit in ('g','ml','serving','count','oz')),
  constraint recent_foods_category_chk check (category in ('protein','grain','vegetable','fruit','dairy','fat','custom','other'))
);

create table if not exists public.recent_food_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  recent_food_id   uuid not null references public.recent_foods(id) on delete cascade,
  logged_quantity  numeric not null default 0,
  mapped           boolean not null default false,  -- true if this log credited Diet foods
  created_at       timestamptz not null default now(),
  unique (user_id, date, recent_food_id)
);

-- ── recent_food_log_contributions ───────────────────────────────────────
-- One row per (dish log → Diet food) credit, so the credit is traceable and
-- reversible: deleting a dish log (or the dish) deletes its rows, and a
-- trigger subtracts exactly that quantity from day_logs.
create table if not exists public.recent_food_log_contributions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  recent_food_log_id  uuid not null references public.recent_food_logs(id) on delete cascade,
  food_id             uuid not null references public.foods(id) on delete cascade,
  date                date not null,   -- copied from the log so reversal works mid-cascade
  quantity            numeric not null check (quantity > 0),
  created_at          timestamptz not null default now(),
  unique (recent_food_log_id, food_id)
);

-- ── Meal combos ─────────────────────────────────────────────────────────
-- A saved group of foods logged in one tap. Items live in meal_combo_items
-- (real foreign keys), not in a JSON column.
create table if not exists public.meal_combos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  icon        text not null default 'UtensilsCrossed',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.meal_combo_items (
  id              uuid primary key default gen_random_uuid(),
  combo_id        uuid not null references public.meal_combos(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Exactly one is set: a combo references existing items, never copies them.
  food_id         uuid references public.foods(id) on delete cascade,
  recent_food_id  uuid references public.recent_foods(id) on delete cascade,
  quantity        numeric not null default 0,
  sort_order      int not null default 0,
  constraint meal_combo_items_exactly_one_ref check ((food_id is null) <> (recent_food_id is null))
);

-- ── milestones — insert-only; a row's existence stops the celebration re-firing
create table if not exists public.milestones (
  user_id      uuid not null references auth.users(id) on delete cascade,
  key          text not null,
  achieved_at  date not null default current_date,
  primary key (user_id, key)
);

-- ── Indexes ─────────────────────────────────────────────────────────────
create index if not exists day_logs_user_date_idx          on public.day_logs (user_id, date);
create index if not exists weight_entries_user_date_idx    on public.weight_entries (user_id, date);
create index if not exists recent_foods_user_idx           on public.recent_foods (user_id);
create index if not exists recent_food_logs_user_date_idx  on public.recent_food_logs (user_id, date);
create index if not exists rflc_user_date_idx              on public.recent_food_log_contributions (user_id, date);
create index if not exists rflc_food_idx                   on public.recent_food_log_contributions (food_id);
create index if not exists meal_combos_user_idx            on public.meal_combos (user_id);
create index if not exists meal_combo_items_combo_idx      on public.meal_combo_items (combo_id);
create index if not exists meal_combo_items_user_idx       on public.meal_combo_items (user_id);
create index if not exists meal_combo_items_food_idx       on public.meal_combo_items (food_id)        where food_id is not null;
create index if not exists meal_combo_items_recent_idx     on public.meal_combo_items (recent_food_id) where recent_food_id is not null;
create index if not exists milestones_user_idx             on public.milestones (user_id);

-- ── Dish-credit functions ───────────────────────────────────────────────
-- Records (or adds to) one dish's credit toward one Diet food.
-- SECURITY INVOKER: runs under the caller's RLS, so users only touch their own rows.
create or replace function public.add_dish_contribution(
  p_recent_food_log_id uuid,
  p_food_id uuid,
  p_quantity numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_date date;
begin
  if p_quantity is null or p_quantity <= 0 then
    return;
  end if;
  select date into v_date from public.recent_food_logs where id = p_recent_food_log_id;
  if v_date is null then
    raise exception 'recent_food_log % not found', p_recent_food_log_id;
  end if;
  insert into public.recent_food_log_contributions (user_id, recent_food_log_id, food_id, date, quantity)
  values (auth.uid(), p_recent_food_log_id, p_food_id, v_date, p_quantity)
  on conflict (recent_food_log_id, food_id)
  do update set quantity = public.recent_food_log_contributions.quantity + excluded.quantity;
end;
$$;

revoke execute on function public.add_dish_contribution(uuid, uuid, numeric) from public, anon;
grant  execute on function public.add_dish_contribution(uuid, uuid, numeric) to authenticated;

-- When a credit row disappears (dish or log deleted), take exactly that
-- amount back off the Diet food's day total. SECURITY DEFINER so it also
-- works inside cascades; it only touches the same user's row.
create or replace function public.reverse_dish_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.day_logs
     set logged_quantity      = greatest(0, logged_quantity      - old.quantity),
         contributed_quantity = greatest(0, contributed_quantity - old.quantity),
         updated_at           = now()
   where user_id = old.user_id
     and food_id = old.food_id
     and date    = old.date;
  return old;
end;
$$;

revoke execute on function public.reverse_dish_contribution() from public, anon, authenticated;

drop trigger if exists trg_reverse_dish_contribution on public.recent_food_log_contributions;
create trigger trg_reverse_dish_contribution
  after delete on public.recent_food_log_contributions
  for each row execute function public.reverse_dish_contribution();

-- ── Row Level Security ──────────────────────────────────────────────────
-- Every policy is "FOR ALL": a user can select/insert/update/delete only
-- rows whose user_id = auth.uid(). Tables that point at other user-owned
-- rows additionally verify ownership of the referenced rows on write, so
-- nobody can attach another user's data to their own.
alter table public.user_settings                  enable row level security;
alter table public.foods                          enable row level security;
alter table public.day_logs                       enable row level security;
alter table public.daily_water                    enable row level security;
alter table public.weight_entries                 enable row level security;
alter table public.recent_foods                   enable row level security;
alter table public.recent_food_logs               enable row level security;
alter table public.recent_food_log_contributions  enable row level security;
alter table public.meal_combos                    enable row level security;
alter table public.meal_combo_items               enable row level security;
alter table public.milestones                     enable row level security;

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

drop policy if exists "own recent foods" on public.recent_foods;
create policy "own recent foods" on public.recent_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own recent food logs" on public.recent_food_logs;
create policy "own recent food logs" on public.recent_food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own dish contributions" on public.recent_food_log_contributions;
create policy "own dish contributions" on public.recent_food_log_contributions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.recent_food_logs l where l.id = recent_food_log_id and l.user_id = auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = auth.uid())
  );

drop policy if exists "own meal combos" on public.meal_combos;
create policy "own meal combos" on public.meal_combos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meal combo items" on public.meal_combo_items;
create policy "own meal combo items" on public.meal_combo_items
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.meal_combos c where c.id = combo_id and c.user_id = auth.uid())
    and (food_id is null
         or exists (select 1 from public.foods f where f.id = food_id and f.user_id = auth.uid()))
    and (recent_food_id is null
         or exists (select 1 from public.recent_foods r where r.id = recent_food_id and r.user_id = auth.uid()))
  );

drop policy if exists "own milestones" on public.milestones;
create policy "own milestones" on public.milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Realtime — instant sync across a user's own devices ─────────────────
do $$ begin alter publication supabase_realtime add table public.user_settings;                 exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.foods;                         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.day_logs;                      exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.daily_water;                   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.weight_entries;                exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recent_foods;                  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recent_food_logs;              exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recent_food_log_contributions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meal_combos;                   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meal_combo_items;              exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.milestones;                    exception when duplicate_object then null; end $$;
