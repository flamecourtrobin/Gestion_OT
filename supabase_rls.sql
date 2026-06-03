-- V4 Gestion OT - règles de sécurité Supabase
-- À lancer dans Supabase > SQL Editor après la création des tables et du profil admin.

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_user_role() to anon, authenticated;

-- Nettoyage si tu relances ce script
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "ots_select_by_role" on public.ots;
drop policy if exists "ots_insert_admin_responsable" on public.ots;
drop policy if exists "ots_update_by_role" on public.ots;
drop policy if exists "ots_delete_admin" on public.ots;
drop policy if exists "history_select_admin" on public.ot_history;
drop policy if exists "history_insert_authenticated" on public.ot_history;
drop policy if exists "access_requests_insert_anyone" on public.access_requests;
drop policy if exists "access_requests_select_admin" on public.access_requests;
drop policy if exists "access_requests_delete_admin" on public.access_requests;

-- PROFILES
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "profiles_insert_admin"
on public.profiles for insert
with check (public.current_user_role() = 'admin');

create policy "profiles_update_admin"
on public.profiles for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "profiles_delete_admin"
on public.profiles for delete
using (public.current_user_role() = 'admin');

-- OT
create policy "ots_select_by_role"
on public.ots for select
using (
  public.current_user_role() in ('admin','responsable','lecture')
  or statut = 'Disponible'
  or pris_par = auth.uid()
);

create policy "ots_insert_admin_responsable"
on public.ots for insert
with check (public.current_user_role() in ('admin','responsable'));

create policy "ots_update_by_role"
on public.ots for update
using (
  public.current_user_role() in ('admin','responsable')
  or statut = 'Disponible'
  or pris_par = auth.uid()
)
with check (
  public.current_user_role() in ('admin','responsable')
  or pris_par = auth.uid()
);

create policy "ots_delete_admin"
on public.ots for delete
using (public.current_user_role() = 'admin');

-- HISTORIQUE
create policy "history_select_admin"
on public.ot_history for select
using (public.current_user_role() = 'admin');

create policy "history_insert_authenticated"
on public.ot_history for insert
with check (auth.uid() is not null);

-- DEMANDES D'ACCÈS
create policy "access_requests_insert_anyone"
on public.access_requests for insert
to anon, authenticated
with check (true);

create policy "access_requests_select_admin"
on public.access_requests for select
using (public.current_user_role() = 'admin');

create policy "access_requests_delete_admin"
on public.access_requests for delete
using (public.current_user_role() = 'admin');
