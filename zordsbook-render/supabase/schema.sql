-- ZordsBook: rode no Supabase → SQL Editor → New query → Run

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  bio text default '',
  avatar_url text default '',
  cover_url text default '',
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Usuário'),
    ''
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Perfis visíveis para logados" on public.profiles;
create policy "Perfis visíveis para logados"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Usuário edita próprio perfil" on public.profiles;
create policy "Usuário edita próprio perfil"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Posts visíveis para logados" on public.posts;
create policy "Posts visíveis para logados"
  on public.posts for select to authenticated using (true);

drop policy if exists "Usuário cria post" on public.posts;
create policy "Usuário cria post"
  on public.posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Curtidas visíveis" on public.post_likes;
create policy "Curtidas visíveis"
  on public.post_likes for select to authenticated using (true);

drop policy if exists "Curtir post" on public.post_likes;
create policy "Curtir post"
  on public.post_likes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Descurtir post" on public.post_likes;
create policy "Descurtir post"
  on public.post_likes for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Comentários visíveis" on public.comments;
create policy "Comentários visíveis"
  on public.comments for select to authenticated using (true);

drop policy if exists "Comentar post" on public.comments;
create policy "Comentar post"
  on public.comments for insert to authenticated
  with check (auth.uid() = user_id);
