-- =============================================================================
-- Aşama 2.2: Kullanıcı profilleri ve roller
--
-- - Her Supabase Auth kullanıcısı için bir profil satırı tutulur.
-- - Rol: admin (tam yetki), depo (giriş/dağıtım), izleyici (salt okuma).
-- - Kullanıcılar silinmez, pasife alınır (is_active = false). Böylece geçmiş
--   stok hareketlerinde "kim yaptı" bilgisi kaybolmaz.
-- - Rol ve aktiflik sadece admin_set_user_access() ile değiştirilebilir;
--   son aktif admin kendini kilitleyemez.
-- =============================================================================

-- Rol tipi -------------------------------------------------------------------
create type public.user_role as enum ('admin', 'depo', 'izleyici');

-- Ortak: updated_at alanını otomatik güncelleyen tetikleyici fonksiyonu --------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profil tablosu -------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  full_name   text not null default ''
              check (char_length(full_name) <= 100),
  role        public.user_role not null default 'izleyici',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Uygulama kullanıcıları: ad, rol ve aktiflik durumu.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Yeni Auth kullanıcısı eklenince profil otomatik oluşturulur -----------------
-- Varsayılan rol en düşük yetki olan 'izleyici'dir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yetki yardımcı fonksiyonları -----------------------------------------------
-- SECURITY DEFINER: RLS politikaları içinde profiles tablosunu okurken
-- sonsuz döngüye (recursive RLS) girmemek için.

-- Oturumdaki kullanıcının rolü; pasif veya profili yoksa NULL döner.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- Admin: kullanıcının rolünü ve aktifliğini değiştirir ------------------------
create or replace function public.admin_set_user_access(
  p_user_id   uuid,
  p_role      public.user_role,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.'
      using errcode = '42501';
  end if;

  -- Aynı anda iki admin birbirini düşürmesin diye admin satırları kilitlenir.
  perform 1 from public.profiles
  where role = 'admin' and is_active
  for update;

  -- Son aktif admin düşürülemez / pasife alınamaz.
  if (p_role <> 'admin' or not p_is_active)
     and exists (
       select 1 from public.profiles
       where id = p_user_id and role = 'admin' and is_active
     )
     and (
       select count(*) from public.profiles
       where role = 'admin' and is_active
     ) = 1
  then
    raise exception 'Sistemde en az bir aktif admin kalmalıdır.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set role = p_role,
      is_active = p_is_active
  where id = p_user_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

-- Tablo yetkileri ------------------------------------------------------------
-- Supabase varsayılan olarak anon/authenticated rollerine tüm yetkileri verir;
-- burada en aza indiriyoruz. Kullanıcı kendi profilinde sadece adını
-- değiştirebilir. Ekleme tetikleyici ile, rol değişikliği fonksiyon ile olur.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Fonksiyon yetkileri: giriş yapmamış (anon) kullanıcılar çağıramaz.
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_set_user_access(uuid, public.user_role, boolean) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_set_user_access(uuid, public.user_role, boolean) to authenticated;

-- Satır güvenliği (RLS) ------------------------------------------------------
alter table public.profiles enable row level security;

-- Herkes kendi profilini görür (pasif olsa bile, durumunu anlayabilsin).
-- Aktif kullanıcılar tüm profilleri görür (hareket geçmişinde isimler için).
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.current_user_role() is not null);

-- Aktif kullanıcı sadece kendi satırını güncelleyebilir (sadece full_name,
-- sütun yetkisiyle sınırlı).
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and public.current_user_role() is not null)
  with check (id = (select auth.uid()));

-- INSERT ve DELETE için politika yok: doğrudan ekleme/silme yapılamaz.
