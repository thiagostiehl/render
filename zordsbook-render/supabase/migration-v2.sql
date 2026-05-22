-- ZordsBook v2: rode no Supabase → SQL Editor (depois do schema.sql)

-- Comunidades
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz default now()
);

insert into public.communities (name, slug) values
  ('Ximbinhas', 'ximbinhas'),
  ('Soberanos', 'soberanos'),
  ('Marcianos', 'marcianos')
on conflict (slug) do nothing;

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (community_id, user_id)
);

alter table public.posts
  add column if not exists community_id uuid references public.communities (id) on delete set null;

-- Depoimentos no perfil
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz default now(),
  check (profile_user_id <> author_user_id)
);

-- Novos usuários entram nas 3 comunidades
create or replace function public.join_all_communities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_members (community_id, user_id)
  select c.id, new.id from public.communities c
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_join_communities on public.profiles;
create trigger on_profile_join_communities
  after insert on public.profiles
  for each row execute function public.join_all_communities();

-- Quem já tinha conta antes da migração
insert into public.community_members (community_id, user_id)
select c.id, p.id
from public.communities c
cross join public.profiles p
on conflict do nothing;

-- RLS comunidades
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "Comunidades visíveis" on public.communities;
create policy "Comunidades visíveis"
  on public.communities for select to authenticated using (true);

drop policy if exists "Membros visíveis" on public.community_members;
create policy "Membros visíveis"
  on public.community_members for select to authenticated using (true);

drop policy if exists "Entrar em comunidade" on public.community_members;
create policy "Entrar em comunidade"
  on public.community_members for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Depoimentos visíveis" on public.testimonials;
create policy "Depoimentos visíveis"
  on public.testimonials for select to authenticated using (true);

drop policy if exists "Escrever depoimento" on public.testimonials;
create policy "Escrever depoimento"
  on public.testimonials for insert to authenticated
  with check (auth.uid() = author_user_id);

drop policy if exists "Apagar próprio depoimento" on public.testimonials;
create policy "Apagar próprio depoimento"
  on public.testimonials for delete to authenticated
  using (auth.uid() = author_user_id);

-- Storage: fotos (crie os buckets se o insert falhar — veja HOSPEDAGEM.md)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar público leitura" on storage.objects;
create policy "Avatar público leitura"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Capa pública leitura" on storage.objects;
create policy "Capa pública leitura"
  on storage.objects for select to public
  using (bucket_id = 'covers');

drop policy if exists "Upload avatar próprio" on storage.objects;
create policy "Upload avatar próprio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Upload capa própria" on storage.objects;
create policy "Upload capa própria"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Atualizar avatar próprio" on storage.objects;
create policy "Atualizar avatar próprio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Atualizar capa própria" on storage.objects;
create policy "Atualizar capa própria"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
