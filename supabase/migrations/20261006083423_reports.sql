-- =============================================================================
-- Aşama 9: Raporlar (sadece okuma)
--
--   report_village_distribution(from, to) : köy × boru tipi net dağıtım
--   report_product_summary(from, to)      : boru tipi başına giriş/dağıtım/iade/
--                                           düzeltme ve güncel stok
--   v_movement_details                    : hareket dökümü için düz görünüm
--
-- Toplamlar veritabanında hesaplanır; böylece satır sayısı ne olursa olsun
-- rapor tüm kayıtları kapsar (istemci tarafı 1000 satır sınırına takılmaz).
--
-- Ortak kural: iptal edilmiş belgeler ve iptal kayıtları raporlara girmez.
-- Fonksiyonlar çağıranın yetkisiyle çalışır (SECURITY INVOKER); mevcut RLS
-- kuralları geçerlidir: sadece aktif kullanıcılar veri görür.
-- Tarih parametresi NULL ise o yönde sınır yoktur.
-- =============================================================================

-- Köy bazlı dağıtım -----------------------------------------------------------
-- Net dağıtım = dağıtımlar − iadeler. Net sıfır olan satırlar gösterilmez.
create or replace function public.report_village_distribution(p_from date, p_to date)
returns table (
  village_id     uuid,
  village_name   text,
  district       text,
  product_id     uuid,
  product_name   text,
  category       public.pipe_category,
  diameter_mm    integer,
  pieces         bigint,
  meters         numeric,
  document_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.district,
    p.id,
    p.name,
    p.category,
    p.diameter_mm,
    (-sum(m.qty_pieces))::bigint,
    -sum(m.qty_meters),
    count(distinct d.id)
  from public.stock_movements m
  join public.stock_documents d on d.id = m.document_id
  join public.villages v on v.id = d.village_id
  join public.products p on p.id = m.product_id
  where d.doc_type in ('dagitim', 'iade')
    and d.status = 'aktif'
    and (p_from is null or d.doc_date >= p_from)
    and (p_to is null or d.doc_date <= p_to)
  group by v.id, v.name, v.district, p.id, p.name, p.category, p.diameter_mm
  having sum(m.qty_pieces) <> 0
  order by v.district, v.name, p.category, p.diameter_mm, p.name;
$$;

-- Boru bazlı özet -------------------------------------------------------------
-- Dönem içi hareketler + GÜNCEL stok (dönem sonu stoğu değil).
create or replace function public.report_product_summary(p_from date, p_to date)
returns table (
  product_id         uuid,
  product_name       text,
  category           public.pipe_category,
  diameter_mm        integer,
  is_active          boolean,
  received_pieces    bigint,
  received_meters    numeric,
  distributed_pieces bigint,
  distributed_meters numeric,
  returned_pieces    bigint,
  returned_meters    numeric,
  adjusted_pieces    bigint,
  adjusted_meters    numeric,
  balance_pieces     integer,
  balance_meters     numeric
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.category,
    p.diameter_mm,
    p.is_active,
    coalesce(sum(x.qty_pieces) filter (where x.doc_type = 'giris'), 0)::bigint,
    coalesce(sum(x.qty_meters) filter (where x.doc_type = 'giris'), 0),
    coalesce(-sum(x.qty_pieces) filter (where x.doc_type = 'dagitim'), 0)::bigint,
    coalesce(-sum(x.qty_meters) filter (where x.doc_type = 'dagitim'), 0),
    coalesce(sum(x.qty_pieces) filter (where x.doc_type = 'iade'), 0)::bigint,
    coalesce(sum(x.qty_meters) filter (where x.doc_type = 'iade'), 0),
    coalesce(sum(x.qty_pieces) filter (where x.doc_type = 'duzeltme'), 0)::bigint,
    coalesce(sum(x.qty_meters) filter (where x.doc_type = 'duzeltme'), 0),
    b.pieces,
    b.meters
  from public.products p
  join public.stock_balances b on b.product_id = p.id
  left join (
    select m.product_id, m.qty_pieces, m.qty_meters, d.doc_type
    from public.stock_movements m
    join public.stock_documents d on d.id = m.document_id
    where d.status = 'aktif'
      and d.doc_type <> 'iptal'
      and (p_from is null or d.doc_date >= p_from)
      and (p_to is null or d.doc_date <= p_to)
  ) x on x.product_id = p.id
  group by p.id, p.name, p.category, p.diameter_mm, p.is_active, b.pieces, b.meters
  order by p.category, p.diameter_mm, p.name;
$$;

-- Hareket dökümü --------------------------------------------------------------
-- Her hareket satırı, belge/köy/boru/kullanıcı bilgisiyle düzleştirilmiş.
-- İptal edilmiş belgeler ve iptal kayıtları da görünür (status ve doc_type ile
-- ayırt edilir); filtreleme uygulamada yapılır.
create view public.v_movement_details
with (security_invoker = true)
as
select
  m.id             as movement_id,
  d.id             as document_id,
  d.doc_no,
  d.doc_type,
  d.doc_date,
  d.status,
  d.village_id,
  v.name           as village_name,
  v.district,
  d.supplier,
  d.waybill_no,
  d.vehicle_plate,
  d.driver_name,
  d.receiver_name,
  d.note,
  m.product_id,
  p.name           as product_name,
  p.category,
  m.qty_pieces,
  m.qty_meters,
  pr.full_name     as created_by_name,
  m.created_at
from public.stock_movements m
join public.stock_documents d on d.id = m.document_id
join public.products p on p.id = m.product_id
left join public.villages v on v.id = d.village_id
left join public.profiles pr on pr.id = d.created_by;

-- Yetkiler --------------------------------------------------------------------
revoke execute on function public.report_village_distribution(date, date) from public, anon;
revoke execute on function public.report_product_summary(date, date) from public, anon;
grant execute on function public.report_village_distribution(date, date) to authenticated;
grant execute on function public.report_product_summary(date, date) to authenticated;

revoke all on public.v_movement_details from anon, authenticated;
grant select on public.v_movement_details to authenticated;
