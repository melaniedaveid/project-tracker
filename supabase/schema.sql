-- Run this in the Supabase SQL Editor for the project used by Studio Ledger.
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  status text not null default 'Starting soon' check (status in ('In progress', 'Starting soon', 'On hold', 'Complete')),
  deadline date,
  budget numeric(12,2) not null default 0,
  invoice_status text not null default 'Not invoiced' check (invoice_status in ('Not invoiced', 'Invoiced', 'Part-paid', 'Paid')),
  team text[] not null default '{}',
  contacts jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Editors can manage projects" on public.projects;
create policy "Editors can manage projects" on public.projects
  for all to authenticated using (true) with check (true);

drop policy if exists "Editors can manage team members" on public.team_members;
create policy "Editors can manage team members" on public.team_members
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.team_members;
exception when duplicate_object then null; when undefined_object then null;
end $$;
