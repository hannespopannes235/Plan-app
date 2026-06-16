-- ============================================================================
-- Plan – Familien-Haushalts-App
-- Initiale Migration: Schema, Indizes, RLS-Policies, Trigger & Funktionen
-- ============================================================================
-- Ausführen via Supabase SQL Editor (gesamten Inhalt einfügen & ausführen)
-- oder via Supabase CLI:  supabase db push
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM-Typen
-- ----------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurrence_freq as enum ('none', 'daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_slot as enum ('breakfast', 'lunch', 'dinner');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- profiles  (1:1 mit auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Mitglied',
  color       text not null default '#f59e0b',
  avatar_emoji text not null default '🙂',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- households
-- ----------------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users (id) on delete cascade,
  -- Geheimes Token für den öffentlichen .ics-Feed (kein Login im Kalender-Client)
  ics_token   uuid not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- household_members
-- ----------------------------------------------------------------------------
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user on public.household_members (user_id);

-- ----------------------------------------------------------------------------
-- invites  (Einladungs-Codes)
-- ----------------------------------------------------------------------------
create table if not exists public.invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code         text not null unique,
  created_by   uuid not null references auth.users (id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz not null default now()
);

create index if not exists idx_invites_code on public.invites (code);

-- ----------------------------------------------------------------------------
-- shopping_lists & shopping_items
-- ----------------------------------------------------------------------------
create table if not exists public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_shopping_lists_household on public.shopping_lists (household_id);

create table if not exists public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id      uuid not null references public.shopping_lists (id) on delete cascade,
  name         text not null,
  quantity     text,
  category     text not null default 'Sonstiges',
  is_checked   boolean not null default false,
  checked_by   uuid references auth.users (id) on delete set null,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_shopping_items_list on public.shopping_items (list_id);
create index if not exists idx_shopping_items_household on public.shopping_items (household_id);

-- ----------------------------------------------------------------------------
-- tasks  (Aufgaben / Putzplan)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  title         text not null,
  notes         text,
  assignee_id   uuid references auth.users (id) on delete set null,
  due_date      date,
  recurrence    recurrence_freq not null default 'none',
  recurrence_interval integer not null default 1,
  is_done       boolean not null default false,
  completed_at  timestamptz,
  completed_by  uuid references auth.users (id) on delete set null,
  points        integer not null default 1,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tasks_household on public.tasks (household_id);
create index if not exists idx_tasks_due on public.tasks (household_id, due_date);

-- ----------------------------------------------------------------------------
-- recipes & recipe_ingredients
-- ----------------------------------------------------------------------------
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  title         text not null,
  description   text,
  servings      integer not null default 2,
  created_at    timestamptz not null default now()
);

create index if not exists idx_recipes_household on public.recipes (household_id);

create table if not exists public.recipe_ingredients (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id    uuid not null references public.recipes (id) on delete cascade,
  name         text not null,
  quantity     text,
  category     text not null default 'Sonstiges',
  created_at   timestamptz not null default now()
);

create index if not exists idx_recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);

-- ----------------------------------------------------------------------------
-- meal_plan_entries
-- ----------------------------------------------------------------------------
create table if not exists public.meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date         date not null,
  slot         meal_slot not null default 'dinner',
  recipe_id    uuid references public.recipes (id) on delete set null,
  custom_title text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_meal_plan_household_date on public.meal_plan_entries (household_id, date);

-- ----------------------------------------------------------------------------
-- transactions  (Ausgaben)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  description  text not null,
  amount       numeric(12, 2) not null,
  category     text not null default 'Sonstiges',
  paid_by      uuid references auth.users (id) on delete set null,
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists idx_transactions_household_date on public.transactions (household_id, date);

-- ----------------------------------------------------------------------------
-- recurring_bills  (wiederkehrende Rechnungen)
-- ----------------------------------------------------------------------------
create table if not exists public.recurring_bills (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null,
  amount        numeric(12, 2) not null,
  category      text not null default 'Fixkosten',
  recurrence    recurrence_freq not null default 'monthly',
  next_due_date date not null,
  reminder_days integer not null default 3,
  created_at    timestamptz not null default now()
);

create index if not exists idx_recurring_bills_household on public.recurring_bills (household_id);

-- ============================================================================
-- Hilfsfunktionen
-- ============================================================================

-- Prüft Mitgliedschaft ohne RLS-Rekursion (SECURITY DEFINER umgeht RLS auf
-- household_members und verhindert dadurch endlose Policy-Rekursion).
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Neuen auth.users automatisch ein Profil geben
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Mitglied')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Haushalt anlegen + Ersteller als owner eintragen (eine RPC, atomar)
-- ----------------------------------------------------------------------------
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;

  insert into public.households (name, created_by)
  values (p_name, auth.uid())
  returning * into h;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'owner');

  return h;
end;
$$;

-- ----------------------------------------------------------------------------
-- Einladungs-Code einlösen → Mitglied werden
-- ----------------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
  h   public.households;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;

  select * into inv from public.invites
  where code = upper(trim(p_code))
  limit 1;

  if inv.id is null then
    raise exception 'Einladungs-Code ungültig';
  end if;

  if inv.expires_at < now() then
    raise exception 'Einladungs-Code abgelaufen';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  select * into h from public.households where id = inv.household_id;
  return h;
end;
$$;

-- ----------------------------------------------------------------------------
-- Wiederkehrende Aufgabe abschließen → nächste Instanz erzeugen
-- ----------------------------------------------------------------------------
create or replace function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  next_due date;
begin
  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Aufgabe nicht gefunden';
  end if;
  if not public.is_household_member(t.household_id) then
    raise exception 'Kein Zugriff';
  end if;

  -- Aktuelle Instanz als erledigt markieren
  update public.tasks
    set is_done = true, completed_at = now(), completed_by = auth.uid()
    where id = p_task_id
    returning * into t;

  -- Bei Wiederholung neue offene Instanz erzeugen
  if t.recurrence <> 'none' and t.due_date is not null then
    next_due := case t.recurrence
      when 'daily'   then t.due_date + (t.recurrence_interval || ' days')::interval
      when 'weekly'  then t.due_date + (t.recurrence_interval || ' weeks')::interval
      when 'monthly' then t.due_date + (t.recurrence_interval || ' months')::interval
    end;

    insert into public.tasks
      (household_id, title, notes, assignee_id, due_date, recurrence,
       recurrence_interval, points)
    values
      (t.household_id, t.title, t.notes, t.assignee_id, next_due, t.recurrence,
       t.recurrence_interval, t.points);
  end if;

  return t;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.households           enable row level security;
alter table public.household_members    enable row level security;
alter table public.invites              enable row level security;
alter table public.shopping_lists       enable row level security;
alter table public.shopping_items       enable row level security;
alter table public.tasks                enable row level security;
alter table public.recipes              enable row level security;
alter table public.recipe_ingredients   enable row level security;
alter table public.meal_plan_entries    enable row level security;
alter table public.transactions         enable row level security;
alter table public.recurring_bills      enable row level security;

-- ---- profiles --------------------------------------------------------------
-- Eigenes Profil + Profile von Haushaltsmitgliedern lesbar
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members me
      join public.household_members other
        on other.household_id = me.household_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

-- ---- households ------------------------------------------------------------
drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (public.is_household_member(id));

-- INSERT/Erstellung läuft ausschließlich über create_household() (SECURITY DEFINER)
drop policy if exists households_update on public.households;
create policy households_update on public.households for update
  using (public.is_household_member(id)) with check (public.is_household_member(id));

-- ---- household_members -----------------------------------------------------
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select
  using (public.is_household_member(household_id));

-- Mitglieder treten via redeem_invite() bei (SECURITY DEFINER); ein Mitglied
-- darf sich selbst entfernen (Haushalt verlassen).
drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members for delete
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- ---- invites ---------------------------------------------------------------
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select
  using (public.is_household_member(household_id));

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());

drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete
  using (public.is_household_member(household_id));

-- ---- Generische Policies für haushaltsgebundene Tabellen -------------------
-- Helfer-Makro per DO-Block: für jede Tabelle dieselben 4 Policies.
do $$
declare
  tbl text;
  tables text[] := array[
    'shopping_lists', 'shopping_items', 'tasks', 'recipes',
    'recipe_ingredients', 'meal_plan_entries', 'transactions', 'recurring_bills'
  ];
begin
  foreach tbl in array tables loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', tbl);
    execute format(
      'create policy %1$s_select on public.%1$s for select using (public.is_household_member(household_id));',
      tbl);

    execute format('drop policy if exists %1$s_insert on public.%1$s;', tbl);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (public.is_household_member(household_id));',
      tbl);

    execute format('drop policy if exists %1$s_update on public.%1$s;', tbl);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));',
      tbl);

    execute format('drop policy if exists %1$s_delete on public.%1$s;', tbl);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (public.is_household_member(household_id));',
      tbl);
  end loop;
end $$;

-- ============================================================================
-- Realtime: Tabellen zur Publication hinzufügen
-- ============================================================================
do $$
declare
  tbl text;
  tables text[] := array[
    'shopping_lists', 'shopping_items', 'tasks', 'recipes',
    'recipe_ingredients', 'meal_plan_entries', 'transactions',
    'recurring_bills', 'household_members'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
