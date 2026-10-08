-- =============================================================================
-- Aşama 8.2: Kullanıcı yönetimi (sadece admin)
--
--   admin_list_users()   : kullanıcıları e-posta ve son giriş bilgisiyle listeler
--   admin_update_user()  : bir kullanıcının adını, rolünü ve aktifliğini değiştirir
--
-- E-posta ve son giriş bilgisi auth.users tablosundadır; uygulama o tabloyu
-- okuyamaz. Bu yüzden liste SECURITY DEFINER bir fonksiyonla ve sadece admin'e
-- verilir. Rol/aktiflik değişikliği mevcut admin_set_user_access() üzerinden
-- yapılır; "en az bir aktif admin kalmalı" kuralı orada uygulanır.
-- =============================================================================

create or replace function public.admin_list_users()
returns table (
  id              uuid,
  email           text,
  full_name       text,
  role            public.user_role,
  is_active       boolean,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.role, p.is_active, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_full_name text,
  p_role      public.user_role,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(coalesce(p_full_name, ''));
  v_result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Ad en fazla 100 karakter olabilir.' using errcode = '22023';
  end if;

  -- Rol ve aktiflik: yetki kontrolü, kilitleme ve "son admin" koruması burada.
  perform public.admin_set_user_access(p_user_id, p_role, p_is_active);

  update public.profiles
  set full_name = v_name
  where id = p_user_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_update_user(uuid, text, public.user_role, boolean) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, public.user_role, boolean) to authenticated;
