-- Shared Scrapbook MVP schema

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false,
  public_slug text unique
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  type text not null check (type in ('image','video_hosted','video_embed','text','link','shape','draw')),
  data jsonb not null default '{}'::jsonb,
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_locks (
  item_id uuid primary key references public.items on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  locked_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists items_board_id_idx on public.items (board_id);
create index if not exists items_updated_at_idx on public.items (updated_at);
create index if not exists board_members_user_id_idx on public.board_members (user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.touch_board()
returns trigger as $$
begin
  update public.boards
    set updated_at = now()
    where id = coalesce(new.board_id, old.board_id);
  return null;
end;
$$ language plpgsql;

drop trigger if exists set_items_updated_at on public.items;
create trigger set_items_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists touch_board_on_items on public.items;
create trigger touch_board_on_items
after insert or update or delete on public.items
for each row execute function public.touch_board();

create or replace function public.is_board_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.boards b
      where b.id = bid and b.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.board_members m
      where m.board_id = bid and m.user_id = auth.uid()
    );
$$;

create or replace function public.is_board_editor(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.boards b
      where b.id = bid and b.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.board_members m
      where m.board_id = bid and m.user_id = auth.uid() and m.role = 'editor'
    );
$$;

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.items enable row level security;
alter table public.item_locks enable row level security;

create policy "profiles_select" on public.profiles
  for select using (true);

create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update" on public.profiles
  for update using (id = auth.uid());

create policy "boards_select" on public.boards
  for select using (is_public = true or public.is_board_member(id));

create policy "boards_insert" on public.boards
  for insert with check (owner_id = auth.uid());

create policy "boards_update" on public.boards
  for update using (owner_id = auth.uid());

create policy "boards_delete" on public.boards
  for delete using (owner_id = auth.uid());

create or replace function public.create_board(p_title text)
returns public.boards
language plpgsql
security definer
set search_path = public
as $$
declare
  new_board public.boards;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.boards (owner_id, title)
  values (auth.uid(), p_title)
  returning * into new_board;

  insert into public.board_members (board_id, user_id, role, invited_by)
  values (new_board.id, auth.uid(), 'editor', auth.uid());

  return new_board;
end;
$$;

grant execute on function public.create_board(text) to authenticated;

create policy "board_members_select" on public.board_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "board_members_insert" on public.board_members
  for insert with check (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "board_members_update" on public.board_members
  for update using (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "board_members_delete" on public.board_members
  for delete using (
    exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "items_select" on public.items
  for select using (
    public.is_board_member(board_id)
    or exists (select 1 from public.boards b where b.id = board_id and b.is_public = true)
  );

create policy "items_insert" on public.items
  for insert with check (public.is_board_editor(board_id));

create policy "items_update" on public.items
  for update using (public.is_board_editor(board_id));

create policy "items_delete" on public.items
  for delete using (public.is_board_editor(board_id));

create policy "locks_select" on public.item_locks
  for select using (
    exists (select 1 from public.items i where i.id = item_id and public.is_board_member(i.board_id))
  );

create policy "locks_insert" on public.item_locks
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.items i where i.id = item_id and public.is_board_editor(i.board_id))
  );

create policy "locks_update" on public.item_locks
  for update using (
    user_id = auth.uid()
    and exists (select 1 from public.items i where i.id = item_id and public.is_board_editor(i.board_id))
  );

create policy "locks_delete" on public.item_locks
  for delete using (
    user_id = auth.uid()
    and exists (select 1 from public.items i where i.id = item_id and public.is_board_editor(i.board_id))
  );

-- Optional: create storage bucket for uploads.
insert into storage.buckets (id, name, public)
values ('board-media', 'board-media', true)
on conflict do nothing;
