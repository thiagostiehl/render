-- ZordsBook v3: amizades + comunidades estilo Orkut + notificações
-- Rode no Supabase → SQL Editor DEPOIS das migrações anteriores

-- ── Amizades ─────────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

drop policy if exists "Ver amizades" on public.friendships;
create policy "Ver amizades"
  on public.friendships for select to authenticated using (true);

drop policy if exists "Enviar solicitação" on public.friendships;
create policy "Enviar solicitação"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Aceitar solicitação" on public.friendships;
create policy "Aceitar solicitação"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id);

drop policy if exists "Remover amizade" on public.friendships;
create policy "Remover amizade"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── Notificações ──────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('friend_request','friend_accepted','testimonial','post_on_wall')),
  ref_id uuid,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Ver próprias notificações" on public.notifications;
create policy "Ver próprias notificações"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Inserir notificação" on public.notifications;
create policy "Inserir notificação"
  on public.notifications for insert to authenticated
  with check (true);

drop policy if exists "Marcar como lida" on public.notifications;
create policy "Marcar como lida"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id);

-- ── Comunidades: adiciona campos se não existirem ─────────────────────────────
alter table public.communities
  add column if not exists description text default '',
  add column if not exists creator_id uuid references public.profiles (id) on delete set null;

-- Remove auto-join trigger da v2 (comunidades agora são opcionais)
drop trigger if exists on_profile_join_communities on public.profiles;
drop function if exists public.join_all_communities();

-- Qualquer logado pode criar comunidade
drop policy if exists "Criar comunidade" on public.communities;
create policy "Criar comunidade"
  on public.communities for insert to authenticated
  with check (true);

-- Sair de comunidade
drop policy if exists "Sair de comunidade" on public.community_members;
create policy "Sair de comunidade"
  on public.community_members for delete to authenticated
  using (auth.uid() = user_id);
