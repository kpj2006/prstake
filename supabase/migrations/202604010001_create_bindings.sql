-- PRStake bindings table
-- Apply with Supabase CLI: supabase db push

create table if not exists public.bindings (
  wallet_address text primary key,
  github_username text unique not null,
  signature text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bindings_set_updated_at on public.bindings;
create trigger bindings_set_updated_at
before update on public.bindings
for each row
execute function public.set_updated_at();

create index if not exists idx_bindings_github_username on public.bindings (github_username);
