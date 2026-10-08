-- =============================================================================
-- Yerel kimlik doğrulama ve kullanıcı yönetimi (migration'lardan SONRA çalışır,
-- tekrar çalıştırılabilir)
--
-- Supabase'de giriş ve kullanıcı ekleme işini Supabase Auth yapıyordu. Yerel
-- kurulumda:
--   auth_api.*              : sadece sunucu programı çağırır (giriş, oturum yenileme)
--   admin_create_user()     : admin yeni kullanıcı ekler
--   admin_set_user_password : admin bir kullanıcının şifresini sıfırlar
-- =============================================================================

create schema if not exists auth_api;
revoke all on schema auth_api from public;
grant usage on schema auth_api to service_role;

-- Ortak kurallar --------------------------------------------------------------
create or replace function auth_api.check_password(p_password text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_password is null or char_length(p_password) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır.' using errcode = '22023';
  end if;
  -- bcrypt ilk 72 baytı kullanır; daha uzunu sessizce kırpılmasın.
  if octet_length(p_password) > 72 then
    raise exception 'Şifre en fazla 72 karakter olabilir.' using errcode = '22023';
  end if;
end;
$$;

create or replace function auth_api.user_json(p_user auth.users)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_user.id,
    'email', p_user.email,
    'user_metadata', p_user.raw_user_meta_data,
    'created_at', p_user.created_at,
    'updated_at', p_user.updated_at,
    'last_sign_in_at', p_user.last_sign_in_at,
    -- Mikrosaniye: aynı saniyedeki iki şifre değişikliği de ayırt edilsin.
    'password_version', (extract(epoch from p_user.password_changed_at) * 1000000)::bigint
  );
$$;

-- Giriş: e-posta ve şifre doğruysa kullanıcıyı döndürür, değilse NULL.
create or replace function auth_api.login(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users;
begin
  select * into v_user from auth.users u where u.email = lower(btrim(coalesce(p_email, '')) collate "C");

  if not found
     or p_password is null
     or v_user.encrypted_password <> extensions.crypt(p_password, v_user.encrypted_password)
  then
    return null;
  end if;

  update auth.users set last_sign_in_at = now() where id = v_user.id returning * into v_user;
  return auth_api.user_json(v_user);
end;
$$;

-- Oturum yenileme ve "ben kimim" için.
create or replace function auth_api.get_user(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select auth_api.user_json(u) from auth.users u where u.id = p_user_id;
$$;

revoke execute on all functions in schema auth_api from public, anon, authenticated;
grant execute on all functions in schema auth_api to service_role;

-- Admin: yeni kullanıcı --------------------------------------------------------
create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_full_name text,
  p_role      public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')) collate "C");
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;
  if v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' or char_length(v_email) > 255 then
    raise exception 'Geçerli bir e-posta adresi girin.' using errcode = '22023';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Ad en fazla 100 karakter olabilir.' using errcode = '22023';
  end if;
  perform auth_api.check_password(p_password);
  if exists (select 1 from auth.users u where u.email = v_email) then
    raise exception 'Bu e-posta adresiyle bir kullanıcı zaten var.' using errcode = '23505';
  end if;

  -- Profil satırını on_auth_user_created tetikleyicisi oluşturur.
  insert into auth.users (email, encrypted_password, raw_user_meta_data)
  values (
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    jsonb_build_object('full_name', v_name)
  )
  returning id into v_id;

  update public.profiles set role = p_role where id = v_id;
  return v_id;
end;
$$;

-- Admin: şifre sıfırlama --------------------------------------------------------
create or replace function public.admin_set_user_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;
  perform auth_api.check_password(p_password);

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      password_changed_at = now(),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_create_user(text, text, text, public.user_role) from public, anon;
revoke execute on function public.admin_set_user_password(uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, public.user_role) to authenticated;
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;

-- PostgREST şema önbelleğini yenilesin.
notify pgrst, 'reload schema';
