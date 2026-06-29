create table if not exists public.user_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_states enable row level security;

drop policy if exists "Users can read their own state" on public.user_states;
create policy "Users can read their own state"
on public.user_states for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own state" on public.user_states;
create policy "Users can insert their own state"
on public.user_states for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own state" on public.user_states;
create policy "Users can update their own state"
on public.user_states for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
