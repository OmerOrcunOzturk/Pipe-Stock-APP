-- =============================================================================
-- Aşama 3.1: Tanım tabloları — boru tipleri (products) ve köyler (villages)
--
-- - Tanımlar silinmez, pasife alınır (is_active = false).
-- - Ekleme/düzenleme sadece admin; tüm aktif kullanıcılar okuyabilir.
-- - Kullanıcı sadece iş alanlarını yazabilir; id, created_by, created_at,
--   updated_at veritabanı tarafından doldurulur (sütun yetkileriyle).
-- - Hareket gören boru tipinin temel alanlarının kilitlenmesi Aşama 4'te
--   (stok hareketleri tablosuyla birlikte) eklenecek.
-- =============================================================================

-- Boru kategorisi ------------------------------------------------------------
create type public.pipe_category as enum ('icme_suyu', 'korige');

-- Boru tipleri ---------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  category           public.pipe_category not null,
  -- Malzeme kodu büyük harf: PE100, PVC-U, HDPE, PP ...
  material           text not null
                     check (material ~ '^[A-Z0-9][A-Z0-9 .\-]{0,29}$'),
  diameter_mm        integer not null
                     check (diameter_mm between 1 and 5000),
  -- İçme suyu: basınç sınıfı (PN10, PN12.5, PN16 ...)
  -- Koruge:    halka rijitliği (SN4, SN8, SN16 ...)
  pressure_class     text not null,
  -- 1 adet borunun standart uzunluğu (içme suyu genelde 100 m, koruge 6 m).
  standard_length_m  numeric(8, 2) not null
                     check (standard_length_m > 0 and standard_length_m <= 1000),
  -- Görünen ad otomatik üretilir; elle yazılamaz, böylece isimler tutarlı kalır.
  name               text generated always as (
                       'Ø' || diameter_mm::text || ' ' || material || ' ' || pressure_class
                     ) stored,
  is_active          boolean not null default true,
  created_by         uuid default auth.uid() references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint products_pressure_class_matches_category check (
    (category = 'icme_suyu' and pressure_class ~ '^PN[0-9]{1,3}(\.[0-9])?$')
    or (category = 'korige' and pressure_class ~ '^SN[0-9]{1,3}$')
  ),
  constraint products_unique_spec unique (category, material, diameter_mm, pressure_class)
);

comment on table public.products is 'Boru tipleri (içme suyu ve koruge).';
comment on column public.products.standard_length_m is '1 adet borunun standart uzunluğu (metre).';

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Köyler ---------------------------------------------------------------------
create table public.villages (
  id          uuid primary key default gen_random_uuid(),
  -- Baş/son boşluk ve art arda boşluk kabul edilmez.
  name        text not null
              check (char_length(name) between 1 and 100
                     and name = btrim(name) and name !~ '\s{2,}'),
  district    text not null default ''
              check (char_length(district) <= 100
                     and district = btrim(district) and district !~ '\s{2,}'),
  note        text not null default ''
              check (char_length(note) <= 500),
  is_active   boolean not null default true,
  created_by  uuid default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.villages is 'Boru dağıtımı yapılan köyler.';

-- Aynı ilçede aynı isimli köy bir kez tanımlanabilir (büyük/küçük harf duyarsız).
create unique index villages_district_name_key
  on public.villages (lower(district), lower(name));

create trigger villages_set_updated_at
  before update on public.villages
  for each row execute function public.set_updated_at();

-- Tablo yetkileri ------------------------------------------------------------
revoke all on public.products, public.villages from anon, authenticated;

grant select on public.products, public.villages to authenticated;

grant insert (category, material, diameter_mm, pressure_class, standard_length_m, is_active),
      update (category, material, diameter_mm, pressure_class, standard_length_m, is_active)
  on public.products to authenticated;

grant insert (name, district, note, is_active),
      update (name, district, note, is_active)
  on public.villages to authenticated;

-- Satır güvenliği (RLS) ------------------------------------------------------
alter table public.products enable row level security;
alter table public.villages enable row level security;

create policy "products_select_active_users"
  on public.products for select
  to authenticated
  using (public.current_user_role() is not null);

create policy "products_insert_admin"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

create policy "products_update_admin"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "villages_select_active_users"
  on public.villages for select
  to authenticated
  using (public.current_user_role() is not null);

create policy "villages_insert_admin"
  on public.villages for insert
  to authenticated
  with check (public.is_admin());

create policy "villages_update_admin"
  on public.villages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE için politika ve yetki yok: tanımlar silinemez, pasife alınır.
