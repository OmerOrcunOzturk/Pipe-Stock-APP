-- =============================================================================
-- Aşama 4.1: Stok çekirdeği — tablolar, kısıtlar, koruma tetikleyicileri, RLS
--
-- Yapı:
--   stock_documents  : işlem belgesi (giriş, dağıtım, iade, düzeltme, iptal)
--   stock_movements  : belge satırları; işaretli adet ve metre (değiştirilemez)
--   stock_balances   : boru tipi başına güncel stok (adet + metre)
--
-- Kurallar:
--   - Bu tablolara sadece stok işlem fonksiyonları (Aşama 4.2) yazabilir.
--     Fonksiyonlar işlem süresince 'app.stock_write' bayrağını açar; bayrak
--     kapalıyken yapılan her yazma (SQL Editor dahil) reddedilir.
--   - Hareketler hiçbir koşulda güncellenemez/silinemez.
--   - Belgede sadece durum değişikliği (aktif -> iptal_edildi) yapılabilir.
--   - Hareket görmüş boru tipinin temel alanları değiştirilemez.
-- =============================================================================

-- Tipler ---------------------------------------------------------------------
create type public.stock_doc_type as enum ('giris', 'dagitim', 'iade', 'duzeltme', 'iptal');
create type public.stock_doc_status as enum ('aktif', 'iptal_edildi');

-- Belgeler -------------------------------------------------------------------
create table public.stock_documents (
  id                   uuid primary key default gen_random_uuid(),
  -- İnsan tarafından okunabilir, artan belge numarası.
  doc_no               bigint generated always as identity unique,
  doc_type             public.stock_doc_type not null,
  doc_date             date not null check (doc_date >= date '2000-01-01'),
  village_id           uuid references public.villages (id) on delete restrict,
  supplier             text not null default '' check (char_length(supplier) <= 200),
  waybill_no           text not null default '' check (char_length(waybill_no) <= 50),
  vehicle_plate        text not null default '' check (char_length(vehicle_plate) <= 20),
  driver_name          text not null default '' check (char_length(driver_name) <= 100),
  receiver_name        text not null default '' check (char_length(receiver_name) <= 100),
  note                 text not null default '' check (char_length(note) <= 1000),
  status               public.stock_doc_status not null default 'aktif',
  -- İptal belgesinin iptal ettiği belge. UNIQUE: bir belge en fazla bir kez iptal edilir.
  cancels_document_id  uuid unique references public.stock_documents (id) on delete restrict,
  -- İstemcinin form başına ürettiği anahtar: aynı istek iki kez kaydedilmez.
  client_request_id    uuid not null unique,
  created_by           uuid not null references public.profiles (id) on delete restrict,
  created_at           timestamptz not null default now(),

  -- Köy sadece dağıtım ve iadede var, onlarda zorunlu.
  constraint stock_documents_village_rule
    check ((doc_type in ('dagitim', 'iade')) = (village_id is not null)),
  -- İptal belgesi mutlaka bir belgeye bağlı; diğerleri bağlı olamaz.
  constraint stock_documents_cancel_link
    check ((doc_type = 'iptal') = (cancels_document_id is not null)),
  -- Düzeltme ve iptalde gerekçe zorunlu.
  constraint stock_documents_note_required
    check (doc_type not in ('duzeltme', 'iptal') or char_length(btrim(note)) > 0),
  -- İptal belgesi iptal edilemez.
  constraint stock_documents_cancel_not_cancelled
    check (doc_type <> 'iptal' or status = 'aktif')
);

comment on table public.stock_documents is 'Stok işlem belgeleri. Silinmez; hata iptal belgesiyle düzeltilir.';

create index stock_documents_type_date_idx on public.stock_documents (doc_type, doc_date desc);
create index stock_documents_village_idx on public.stock_documents (village_id) where village_id is not null;
create index stock_documents_created_at_idx on public.stock_documents (created_at desc);

-- Hareketler -----------------------------------------------------------------
create table public.stock_movements (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.stock_documents (id) on delete restrict,
  product_id   uuid not null references public.products (id) on delete restrict,
  -- İşaretli miktarlar: stoğa giren +, çıkan -.
  qty_pieces   integer not null check (qty_pieces <> 0),
  qty_meters   numeric(12, 2) not null check (qty_meters <> 0),
  created_at   timestamptz not null default now(),

  constraint stock_movements_sign_match check (sign(qty_pieces) = sign(qty_meters)),
  constraint stock_movements_product_once_per_doc unique (document_id, product_id)
);

comment on table public.stock_movements is 'Stok hareketleri (belge satırları). Değiştirilemez.';

create index stock_movements_product_idx on public.stock_movements (product_id);

-- Güncel stok ----------------------------------------------------------------
create table public.stock_balances (
  product_id  uuid primary key references public.products (id) on delete restrict,
  pieces      integer not null default 0 check (pieces >= 0),
  meters      numeric(14, 2) not null default 0 check (meters >= 0),
  updated_at  timestamptz not null default now(),

  -- Adet 0 ise metre de 0 olmalı (ve tersi).
  constraint stock_balances_pieces_meters_consistent check ((pieces = 0) = (meters = 0))
);

comment on table public.stock_balances is 'Boru tipi başına güncel stok. Sadece stok fonksiyonları günceller.';

-- Mevcut boru tipleri için bakiye satırları (koruma tetikleyicilerinden önce).
insert into public.stock_balances (product_id)
select id from public.products;

-- Koruma: yazma bayrağı ------------------------------------------------------
-- Stok fonksiyonları yazmadan önce bayrağı açar, bitince eski değerine döndürür.
create or replace function public.guard_stock_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.stock_write', true), '') <> 'on' then
    raise exception 'Stok tablolarına doğrudan yazılamaz; stok işlem fonksiyonlarını kullanın.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger stock_documents_guard_write
  before insert or update on public.stock_documents
  for each row execute function public.guard_stock_write();

create trigger stock_movements_guard_write
  before insert on public.stock_movements
  for each row execute function public.guard_stock_write();

create trigger stock_balances_guard_write
  before insert or update on public.stock_balances
  for each row execute function public.guard_stock_write();

-- Koruma: silme / değiştirme yasağı ------------------------------------------
create or replace function public.prevent_stock_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Stok kayıtları silinemez veya değiştirilemez (%). Hatalı işlemler iptal belgesiyle düzeltilir.',
    tg_table_name
    using errcode = '42501';
end;
$$;

create trigger stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function public.prevent_stock_mutation();

create trigger stock_documents_no_delete
  before delete on public.stock_documents
  for each row execute function public.prevent_stock_mutation();

create trigger stock_balances_no_delete
  before delete on public.stock_balances
  for each row execute function public.prevent_stock_mutation();

create trigger stock_documents_no_truncate
  before truncate on public.stock_documents
  for each statement execute function public.prevent_stock_mutation();

create trigger stock_movements_no_truncate
  before truncate on public.stock_movements
  for each statement execute function public.prevent_stock_mutation();

create trigger stock_balances_no_truncate
  before truncate on public.stock_balances
  for each statement execute function public.prevent_stock_mutation();

-- Belgede sadece aktif -> iptal_edildi geçişine izin verilir.
create or replace function public.check_stock_document_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'aktif'
     or new.status <> 'iptal_edildi'
     or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
  then
    raise exception 'Belgede sadece "aktif -> iptal edildi" durum değişikliği yapılabilir.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger stock_documents_status_only
  before update on public.stock_documents
  for each row execute function public.check_stock_document_update();

-- Yeni boru tipine otomatik bakiye satırı ------------------------------------
create or replace function public.create_stock_balance_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('app.stock_write', true), '');
begin
  perform set_config('app.stock_write', 'on', true);
  insert into public.stock_balances (product_id) values (new.id);
  perform set_config('app.stock_write', v_prev, true);
  return new;
end;
$$;

create trigger products_create_stock_balance
  after insert on public.products
  for each row execute function public.create_stock_balance_row();

-- Hareket görmüş boru tipinin temel alanları kilitlenir ----------------------
create or replace function public.lock_used_product_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.category, new.material, new.diameter_mm, new.pressure_class)
       is distinct from (old.category, old.material, old.diameter_mm, old.pressure_class)
     and exists (select 1 from public.stock_movements m where m.product_id = old.id)
  then
    raise exception 'Bu boru tipinin stok hareketi var; kategori, malzeme, çap ve sınıf değiştirilemez.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger products_lock_used_fields
  before update on public.products
  for each row execute function public.lock_used_product_fields();

-- Tetikleyici fonksiyonları doğrudan çağrılamaz.
revoke execute on function public.guard_stock_write() from public, anon, authenticated;
revoke execute on function public.prevent_stock_mutation() from public, anon, authenticated;
revoke execute on function public.check_stock_document_update() from public, anon, authenticated;
revoke execute on function public.create_stock_balance_row() from public, anon, authenticated;
revoke execute on function public.lock_used_product_fields() from public, anon, authenticated;

-- Görünümler -----------------------------------------------------------------
-- Güncel stok, boru tipi bilgisiyle birlikte (liste ekranları için).
create view public.v_stock_balances
with (security_invoker = true)
as
select
  p.id           as product_id,
  p.name,
  p.category,
  p.material,
  p.diameter_mm,
  p.pressure_class,
  p.standard_length_m,
  p.is_active,
  b.pieces,
  b.meters,
  b.updated_at
from public.products p
join public.stock_balances b on b.product_id = p.id;

-- Tutarlılık kontrolü: bakiye, hareket toplamıyla eşleşmeyen boru tipleri.
-- Bu görünüm HER ZAMAN BOŞ olmalıdır.
create view public.v_stock_reconciliation
with (security_invoker = true)
as
select
  p.id                     as product_id,
  p.name,
  b.pieces                 as balance_pieces,
  b.meters                 as balance_meters,
  coalesce(m.pieces, 0)    as movement_pieces,
  coalesce(m.meters, 0)    as movement_meters
from public.products p
left join public.stock_balances b on b.product_id = p.id
left join (
  select product_id, sum(qty_pieces) as pieces, sum(qty_meters) as meters
  from public.stock_movements
  group by product_id
) m on m.product_id = p.id
where b.product_id is null
   or b.pieces <> coalesce(m.pieces, 0)
   or b.meters <> coalesce(m.meters, 0);

-- Yetkiler: uygulama sadece okuyabilir; yazma Aşama 4.2 fonksiyonlarıyla. ------
revoke all on public.stock_documents, public.stock_movements, public.stock_balances
  from anon, authenticated;
revoke all on public.v_stock_balances, public.v_stock_reconciliation from anon, authenticated;

grant select on public.stock_documents, public.stock_movements, public.stock_balances
  to authenticated;
grant select on public.v_stock_balances, public.v_stock_reconciliation to authenticated;

-- Satır güvenliği (RLS) ------------------------------------------------------
alter table public.stock_documents enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_balances enable row level security;

create policy "stock_documents_select_active_users"
  on public.stock_documents for select
  to authenticated
  using (public.current_user_role() is not null);

create policy "stock_movements_select_active_users"
  on public.stock_movements for select
  to authenticated
  using (public.current_user_role() is not null);

create policy "stock_balances_select_active_users"
  on public.stock_balances for select
  to authenticated
  using (public.current_user_role() is not null);

-- INSERT / UPDATE / DELETE politikası yok.
