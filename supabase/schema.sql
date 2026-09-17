-- ============================================================================
-- Wenn — schéma Supabase (Postgres)
-- À exécuter dans l'éditeur SQL du projet Supabase (ou via `supabase db push`)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles : un profil par utilisateur Supabase Auth
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  theme_image_url text,
  theme_seed_color text,
  notifications_days_before smallint not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- couples : lie deux comptes (titulaire du cycle + partenaire)
-- Créée avant les policies de "profiles" car celles-ci la référencent.
-- ---------------------------------------------------------------------------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid references auth.users (id) on delete set null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  name text not null default 'Notre cycle',
  average_cycle_length smallint not null default 28,
  average_period_length smallint not null default 5,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles : policies (peuvent maintenant référencer public.couples)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: select partner profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.couples c
      where (c.owner_id = auth.uid() and c.partner_id = profiles.id)
         or (c.partner_id = auth.uid() and c.owner_id = profiles.id)
    )
  );

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-création du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- couples : policies + fonction de liaison par code d'invitation
-- ---------------------------------------------------------------------------
alter table public.couples enable row level security;

create policy "couples: select member"
  on public.couples for select
  using (auth.uid() = owner_id or auth.uid() = partner_id);

create policy "couples: insert as owner"
  on public.couples for insert
  with check (auth.uid() = owner_id);

create policy "couples: owner can update settings"
  on public.couples for update
  using (auth.uid() = owner_id);

-- Rejoindre un couple via un code d'invitation (sécurisé, évite le hijack de partner_id)
create or replace function public.join_couple(p_invite_code text)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  v_couple public.couples;
begin
  select * into v_couple from public.couples where invite_code = p_invite_code for update;

  if v_couple.id is null then
    raise exception 'Code d''invitation invalide';
  end if;

  if v_couple.owner_id = auth.uid() then
    raise exception 'Vous êtes déjà propriétaire de ce cycle';
  end if;

  if v_couple.partner_id is not null and v_couple.partner_id <> auth.uid() then
    raise exception 'Ce cycle a déjà un partenaire lié';
  end if;

  update public.couples set partner_id = auth.uid() where id = v_couple.id
  returning * into v_couple;

  return v_couple;
end;
$$;

-- ---------------------------------------------------------------------------
-- cycle_days : une ligne par jour suivi (règles, symptômes, humeur, note)
-- ---------------------------------------------------------------------------
create table if not exists public.cycle_days (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  date date not null,
  flow text check (flow in ('leger', 'moyen', 'abondant')),
  symptoms text[] not null default '{}',
  mood text,
  note text,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, date)
);

create index if not exists cycle_days_couple_date_idx on public.cycle_days (couple_id, date);

alter table public.cycle_days enable row level security;

create policy "cycle_days: select member"
  on public.cycle_days for select
  using (
    exists (
      select 1 from public.couples c
      where c.id = cycle_days.couple_id
        and (c.owner_id = auth.uid() or c.partner_id = auth.uid())
    )
  );

-- Seule la titulaire (owner) peut créer/modifier/supprimer ses données de cycle
create policy "cycle_days: owner insert"
  on public.cycle_days for insert
  with check (
    exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
  );

create policy "cycle_days: owner update"
  on public.cycle_days for update
  using (
    exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
  );

create policy "cycle_days: owner delete"
  on public.cycle_days for delete
  using (
    exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
  );

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cycle_days_set_updated_at on public.cycle_days;
create trigger cycle_days_set_updated_at
  before update on public.cycle_days
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_notes : notes/rappels ajoutés par le partenaire (ou la titulaire)
-- ---------------------------------------------------------------------------
create table if not exists public.partner_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  date date not null,
  author_id uuid not null references auth.users (id),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_notes_couple_date_idx on public.partner_notes (couple_id, date);

alter table public.partner_notes enable row level security;

create policy "partner_notes: select member"
  on public.partner_notes for select
  using (
    exists (
      select 1 from public.couples c
      where c.id = partner_notes.couple_id
        and (c.owner_id = auth.uid() or c.partner_id = auth.uid())
    )
  );

create policy "partner_notes: member insert"
  on public.partner_notes for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.couples c
      where c.id = couple_id
        and (c.owner_id = auth.uid() or c.partner_id = auth.uid())
    )
  );

create policy "partner_notes: author delete"
  on public.partner_notes for delete
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime : activer la réplication sur les tables partagées
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.cycle_days;
alter publication supabase_realtime add table public.partner_notes;
alter publication supabase_realtime add table public.couples;

-- ---------------------------------------------------------------------------
-- Storage : bucket pour l'image de fond (thème Material You)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('theme-images', 'theme-images', true)
on conflict (id) do nothing;

create policy "theme-images: public read"
  on storage.objects for select
  using (bucket_id = 'theme-images');

create policy "theme-images: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'theme-images' and auth.role() = 'authenticated');

create policy "theme-images: owner update"
  on storage.objects for update
  using (bucket_id = 'theme-images' and auth.uid() = owner);

create policy "theme-images: owner delete"
  on storage.objects for delete
  using (bucket_id = 'theme-images' and auth.uid() = owner);
