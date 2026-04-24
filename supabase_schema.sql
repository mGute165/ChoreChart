create extension if not exists pgcrypto;
create table if not exists public.households (id uuid primary key default gen_random_uuid(), name text not null, timezone text not null default 'America/Phoenix', main_background text not null default 'default', created_by uuid, created_at timestamptz not null default now());
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, household_id uuid not null references public.households(id) on delete cascade, display_name text not null, role text not null default 'owner', created_at timestamptz not null default now());
create table if not exists public.kids (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, name text not null, avatar text default '⭐', theme text default 'race', palette text default 'blue', total_points integer not null default 0, start_date date not null default current_date, created_at timestamptz not null default now());
create table if not exists public.chores (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, kid_id uuid not null references public.kids(id) on delete cascade, name text not null, points integer not null default 0, frequency text not null default 'daily', chore_type text not null default 'mandatory', required_days text default '', created_at timestamptz not null default now());
create table if not exists public.completions (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, kid_id uuid not null references public.kids(id) on delete cascade, chore_id uuid not null references public.chores(id) on delete cascade, date date not null, status text not null default 'open', updated_by uuid references public.profiles(id), created_at timestamptz not null default now(), unique (household_id,kid_id,chore_id,date));
create table if not exists public.activity_log (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, kid_id uuid references public.kids(id) on delete set null, chore_id uuid references public.chores(id) on delete set null, message text not null, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
alter table public.households enable row level security; alter table public.profiles enable row level security; alter table public.kids enable row level security; alter table public.chores enable row level security; alter table public.completions enable row level security; alter table public.activity_log enable row level security;
create or replace function public.current_household_id() returns uuid language sql security definer set search_path=public as $$ select household_id from public.profiles where id=auth.uid() limit 1 $$;
grant execute on function public.current_household_id() to authenticated;
create or replace function public.create_household_and_profile(household_name text, display_name text) returns uuid language plpgsql security definer set search_path=public as $$ declare new_household_id uuid; begin if auth.uid() is null then raise exception 'Not authenticated'; end if; insert into public.households(name,created_by) values(household_name,auth.uid()) returning id into new_household_id; insert into public.profiles(id,household_id,display_name,role) values(auth.uid(),new_household_id,display_name,'owner') on conflict(id) do update set household_id=excluded.household_id, display_name=excluded.display_name, role=excluded.role; return new_household_id; end; $$;
grant execute on function public.create_household_and_profile(text,text) to authenticated;
drop policy if exists "members read household" on public.households; drop policy if exists "members update household" on public.households; drop policy if exists "profiles read same household" on public.profiles; drop policy if exists "profiles insert self" on public.profiles; drop policy if exists "members manage kids" on public.kids; drop policy if exists "members manage chores" on public.chores; drop policy if exists "members manage completions" on public.completions; drop policy if exists "members manage activity" on public.activity_log;
create policy "members read household" on public.households for select to authenticated using (id=public.current_household_id());
create policy "members update household" on public.households for update to authenticated using (id=public.current_household_id()) with check (id=public.current_household_id());
create policy "profiles read same household" on public.profiles for select to authenticated using (household_id=public.current_household_id() or id=auth.uid());
create policy "profiles insert self" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "members manage kids" on public.kids for all to authenticated using (household_id=public.current_household_id()) with check (household_id=public.current_household_id());
create policy "members manage chores" on public.chores for all to authenticated using (household_id=public.current_household_id()) with check (household_id=public.current_household_id());
create policy "members manage completions" on public.completions for all to authenticated using (household_id=public.current_household_id()) with check (household_id=public.current_household_id());
create policy "members manage activity" on public.activity_log for all to authenticated using (household_id=public.current_household_id()) with check (household_id=public.current_household_id());


-- v13 additions: family invite codes and multi-admin join.
alter table public.households
add column if not exists invite_code text unique;

update public.households
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.households
alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

create or replace function public.join_household_with_code(
  invite_code_input text,
  display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into found_household_id
  from public.households
  where upper(invite_code) = upper(invite_code_input)
  limit 1;

  if found_household_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.profiles (id, household_id, display_name, role)
  values (auth.uid(), found_household_id, display_name, 'admin')
  on conflict (id) do update
  set household_id = excluded.household_id,
      display_name = excluded.display_name,
      role = excluded.role;

  return found_household_id;
end;
$$;

grant execute on function public.join_household_with_code(text, text) to authenticated;



-- v14 timeline columns
alter table public.activity_log
add column if not exists event_type text;

alter table public.activity_log
add column if not exists status text;

alter table public.activity_log
add column if not exists point_delta integer;
