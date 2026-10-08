-- =============================================================================
-- Yerel sunucu temeli (migration'lardan ÖNCE çalışır, tekrar çalıştırılabilir)
--
-- Uygulama Supabase üzerinde geliştirildi; migration'lar Supabase'in hazır
-- sunduğu roller, auth şeması ve auth.uid() fonksiyonuna dayanır. Bu dosya
-- aynı ortamı sade bir PostgreSQL üzerinde kurar, böylece migration'lar ve
-- uygulama değişmeden çalışır.
--
--   anon           : giriş yapmamış istek (hiçbir tabloya erişemez)
--   authenticated  : giriş yapmış kullanıcı (yetkiler migration'larda verilir)
--   service_role   : sadece sunucu programının kullandığı iç rol
--   authenticator  : PostgREST'in bağlandığı rol; isteğe göre yukarıdakilere geçer
-- =============================================================================

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    -- Şifresi kurulum programı tarafından atanır.
    create role authenticator login noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'borustok_yedek') then
    -- Sadece yedek almak için: tüm veriyi okuyabilir, hiçbir şey yazamaz.
    create role borustok_yedek login;
  end if;
end;
$$;

grant anon, authenticated, service_role to authenticator;
grant pg_read_all_data to borustok_yedek;

create schema if not exists extensions;
create schema if not exists auth;
create extension if not exists pgcrypto with schema extensions;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;

-- Supabase'deki varsayılan: public şemasında oluşturulan her nesneye API rolleri
-- erişebilir; migration'lar bunu tablo tablo kısıtlar. Aynı başlangıç noktası.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Kullanıcı hesapları ---------------------------------------------------------
-- Sütun adları Supabase'in auth.users tablosuyla aynıdır (migration'lar bu
-- adları kullanır). Şifre bcrypt özetidir; düz şifre hiçbir yerde saklanmaz.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  -- Küçük harfe çevirme "C" kurallarıyla yapılır: Türkçe yerel ayarlı kurulumda
  -- lower('I') = 'ı' olur ve aynı adres iki farklı biçimde saklanabilirdi.
  email               text not null
                      check (email = lower(btrim(email) collate "C") and char_length(email) between 3 and 255),
  encrypted_password  text not null,
  raw_user_meta_data  jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Şifre değişince eski oturumların yenilenmesini engellemek için.
  password_changed_at timestamptz not null default now(),
  last_sign_in_at     timestamptz
);

create unique index if not exists users_email_key on auth.users (email);

revoke all on auth.users from public, anon, authenticated;

-- Oturumdaki kullanıcının kimliği: PostgREST, doğruladığı JWT'nin içeriğini
-- request.jwt.claims ayarına yazar.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
