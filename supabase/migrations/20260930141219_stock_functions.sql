-- =============================================================================
-- Aşama 4.2: Stok işlem fonksiyonları (stoğu değiştirmenin TEK yolu)
--
-- Uygulamanın çağırdığı fonksiyonlar:
--   create_receipt       giriş               (admin, depo)
--   create_distribution  köye dağıtım        (admin, depo)
--   create_return        köyden iade         (admin, depo)
--   create_adjustment    sayım düzeltmesi    (admin)
--   cancel_document      ters kayıtla iptal  (admin)
--
-- Hepsi tek transaction'da çalışır: bir satırda bile hata olursa hiçbir şey
-- kaydedilmez. Aynı client_request_id ile gelen tekrar istek yeni belge
-- oluşturmaz, ilk belgenin id'sini döndürür.
--
-- Satır biçimi (p_lines, JSON dizi):
--   [{"product_id": "<uuid>", "pieces": 3, "meters": 300}, ...]
--   Giriş/dağıtım/iadede miktarlar POZİTİF girilir; yönü fonksiyon belirler.
--   Düzeltmede işaretli girilir (+ sayımda fazla, - sayımda eksik).
--
-- Adet asıl birimdir. Depodaki son borular çıkarken girilen metre ne olursa
-- olsun kabul edilir ve hareketin metresi depoda kalan metreye eşitlenir.
-- =============================================================================

-- Türkiye saatine göre bugünün tarihi (sunucu UTC çalışır; gece 00-03 arası
-- UTC tarihi bir gün geride kalır).
create or replace function public.today_tr()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Istanbul')::date;
$$;

-- -----------------------------------------------------------------------------
-- İç fonksiyon: rol kontrolü
-- -----------------------------------------------------------------------------
create or replace function public._require_role(p_roles public.user_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
begin
  if v_role is null then
    raise exception 'Oturum açmış aktif bir kullanıcı gerekli.' using errcode = '42501';
  end if;
  if not (v_role = any (p_roles)) then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- İç fonksiyon: belge + hareketler + bakiye. Tüm stok yazmaları buradan geçer.
-- p_lines işaretli miktarlar içerir (stoğa giren +, çıkan -).
-- Dönüş: belge id'si (tekrar istekte mevcut belgenin id'si).
-- -----------------------------------------------------------------------------
create or replace function public._post_stock_document(
  p_doc_type            public.stock_doc_type,
  p_client_request_id   uuid,
  p_doc_date            date,
  p_village_id          uuid,
  p_supplier            text,
  p_waybill_no          text,
  p_vehicle_plate       text,
  p_driver_name         text,
  p_receiver_name       text,
  p_note                text,
  p_cancels_document_id uuid,
  p_lines               jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_prev     text := coalesce(current_setting('app.stock_write', true), '');
  v_existing public.stock_documents;
  v_doc_id   uuid;
  v_count    int;
  v_line     record;
  v_stock    record;
  v_new_pcs  int;
  v_meters   numeric;
  v_new_m    numeric;
begin
  -- 1) Tekrar istek mi? (çift tıklama, bağlantı kopması, yeniden gönderme)
  if p_client_request_id is null then
    raise exception 'İstek anahtarı (client_request_id) zorunludur.' using errcode = '22023';
  end if;

  select * into v_existing from public.stock_documents
  where client_request_id = p_client_request_id;
  if found then
    if v_existing.doc_type <> p_doc_type or v_existing.created_by <> v_user then
      raise exception 'Bu istek anahtarı başka bir işlem için kullanılmış.' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  -- 2) Tarih: geçmiş serbest, gelecek yasak (Türkiye saatiyle).
  if p_doc_date is null then
    raise exception 'Belge tarihi zorunludur.' using errcode = '22023';
  end if;
  if p_doc_date > public.today_tr() then
    raise exception 'Belge tarihi ileri bir tarih olamaz.' using errcode = '22023';
  end if;

  -- 3) Satırları doğrula: biçim, tekrar eden boru tipi, adet/metre uyumu.
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Satırlar bir liste olmalıdır.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_lines);
  if v_count = 0 then
    raise exception 'En az bir satır girilmelidir.' using errcode = '22023';
  end if;
  if v_count > 100 then
    raise exception 'Bir belgede en fazla 100 satır olabilir.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'product_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or coalesce(e ->> 'pieces', '') !~ '^-?[0-9]{1,6}$'
       or coalesce(e ->> 'meters', '') !~ '^-?[0-9]{1,9}(\.[0-9]{1,2})?$'
  ) then
    raise exception 'Satırlardan birinin biçimi geçersiz (boru tipi, adet veya metre).' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) e
    group by lower(e ->> 'product_id') having count(*) > 1
  ) then
    raise exception 'Aynı boru tipi bir belgede birden fazla satırda olamaz.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) e
    where (e ->> 'pieces')::int = 0
       or (e ->> 'meters')::numeric = 0
       or sign((e ->> 'pieces')::int) <> sign((e ->> 'meters')::numeric)
       -- 1 adet en fazla 1000 m olabilir (boru tipi tanımındaki sınırla aynı).
       or abs((e ->> 'meters')::numeric) > abs((e ->> 'pieces')::int) * 1000
  ) then
    raise exception 'Adet ve metre sıfırdan farklı ve birbiriyle uyumlu olmalıdır (1 adet en fazla 1000 m).'
      using errcode = '22023';
  end if;

  -- 4) Köy kontrolü (dağıtım/iade). İptal belgesinde köy tutulmaz.
  if p_village_id is not null then
    perform 1 from public.villages v where v.id = p_village_id and v.is_active;
    if not found then
      raise exception 'Köy bulunamadı veya pasif.' using errcode = '22023';
    end if;
  end if;

  -- 5) Yazma bayrağını aç ve belgeyi ekle.
  perform set_config('app.stock_write', 'on', true);

  insert into public.stock_documents (
    doc_type, doc_date, village_id, supplier, waybill_no, vehicle_plate,
    driver_name, receiver_name, note, cancels_document_id, client_request_id, created_by
  ) values (
    p_doc_type, p_doc_date, p_village_id,
    btrim(coalesce(p_supplier, '')),
    btrim(coalesce(p_waybill_no, '')),
    upper(btrim(coalesce(p_vehicle_plate, ''))),
    btrim(coalesce(p_driver_name, '')),
    btrim(coalesce(p_receiver_name, '')),
    btrim(coalesce(p_note, '')),
    p_cancels_document_id, p_client_request_id, v_user
  )
  on conflict (client_request_id) do nothing
  returning id into v_doc_id;

  -- Aynı anahtarla eşzamanlı gelen başka istek bizden önce kaydedildiyse onu döndür.
  if v_doc_id is null then
    perform set_config('app.stock_write', v_prev, true);
    select * into v_existing from public.stock_documents
    where client_request_id = p_client_request_id;
    if v_existing.doc_type <> p_doc_type or v_existing.created_by <> v_user then
      raise exception 'Bu istek anahtarı başka bir işlem için kullanılmış.' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  -- 6) Satırları boru tipi sırasıyla işle. Sabit kilit sırası = deadlock yok.
  for v_line in
    select (e ->> 'product_id')::uuid as product_id,
           (e ->> 'pieces')::int      as pieces,
           (e ->> 'meters')::numeric  as meters
    from jsonb_array_elements(p_lines) e
    order by 1
  loop
    -- Bakiye satırını kilitle: aynı boru tipindeki eşzamanlı işlemler sıraya girer.
    select p.name, p.is_active, b.pieces, b.meters
      into v_stock
    from public.stock_balances b
    join public.products p on p.id = b.product_id
    where b.product_id = v_line.product_id
    for update of b;

    if not found then
      raise exception 'Boru tipi bulunamadı.' using errcode = '22023';
    end if;
    -- Pasif boru tipine yeni işlem yok; ama geçmiş kaydın iptaline izin var.
    if not v_stock.is_active and p_doc_type <> 'iptal' then
      raise exception '% pasif durumda; yeni işlem yapılamaz.', v_stock.name using errcode = '22023';
    end if;

    v_new_pcs := v_stock.pieces + v_line.pieces;
    v_meters  := v_line.meters;

    if v_new_pcs < 0 then
      raise exception 'Yetersiz stok: % için depoda % adet (% m) var, % adet çıkılmak isteniyor.',
        v_stock.name, v_stock.pieces, v_stock.meters, abs(v_line.pieces)
        using errcode = 'P0001';
    elsif v_new_pcs = 0 then
      -- Depodaki son borular çıkıyor: adet asıl birimdir, metre engel olmaz.
      -- Hareketin metresi depoda kalan metreye eşitlenir; böylece stok
      -- "0 adet, 0 m" olur ve hareket toplamı bakiyeyle tutarlı kalır.
      v_meters := -v_stock.meters;
    elsif v_stock.meters + v_meters <= 0 then
      raise exception 'Metre hatalı: % için depoda % adet (% m) var; % adet kalırken metre sıfır veya eksi olamaz.',
        v_stock.name, v_stock.pieces, v_stock.meters, v_new_pcs
        using errcode = 'P0001';
    end if;

    v_new_m := v_stock.meters + v_meters;

    insert into public.stock_movements (document_id, product_id, qty_pieces, qty_meters)
    values (v_doc_id, v_line.product_id, v_line.pieces, v_meters);

    update public.stock_balances
    set pieces = v_new_pcs, meters = v_new_m, updated_at = now()
    where product_id = v_line.product_id;
  end loop;

  perform set_config('app.stock_write', v_prev, true);
  return v_doc_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- İç fonksiyon: pozitif girilen satırları verilen yöne (+1 / -1) çevirir.
-- Pozitif olmayan satır varsa hata verir.
-- -----------------------------------------------------------------------------
create or replace function public._signed_lines(p_lines jsonb, p_sign int)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Satırlar bir liste olmalıdır.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'pieces', '') !~ '^[0-9]{1,6}$'
       or coalesce(e ->> 'meters', '') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
  ) then
    raise exception 'Adet ve metre pozitif sayı olmalıdır.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_id', e ->> 'product_id',
      'pieces', p_sign * (e ->> 'pieces')::int,
      'meters', p_sign * (e ->> 'meters')::numeric
    ))
    from jsonb_array_elements(p_lines) e
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Giriş: tedarikçiden depoya
-- -----------------------------------------------------------------------------
create or replace function public.create_receipt(
  p_client_request_id uuid,
  p_doc_date          date,
  p_supplier          text,
  p_waybill_no        text,
  p_note              text,
  p_lines             jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_role(array['admin', 'depo']::public.user_role[]);

  if char_length(btrim(coalesce(p_supplier, ''))) = 0 then
    raise exception 'Tedarikçi zorunludur (açılış stoğu için "Devir / Açılış stoğu" yazılabilir).'
      using errcode = '22023';
  end if;

  return public._post_stock_document(
    'giris', p_client_request_id, p_doc_date, null,
    p_supplier, p_waybill_no, '', '', '', p_note, null,
    public._signed_lines(p_lines, 1)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Dağıtım: depodan köye
-- -----------------------------------------------------------------------------
create or replace function public.create_distribution(
  p_client_request_id uuid,
  p_doc_date          date,
  p_village_id        uuid,
  p_waybill_no        text,
  p_vehicle_plate     text,
  p_driver_name       text,
  p_receiver_name     text,
  p_note              text,
  p_lines             jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_role(array['admin', 'depo']::public.user_role[]);

  if p_village_id is null then
    raise exception 'Köy seçilmelidir.' using errcode = '22023';
  end if;

  return public._post_stock_document(
    'dagitim', p_client_request_id, p_doc_date, p_village_id,
    '', p_waybill_no, p_vehicle_plate, p_driver_name, p_receiver_name, p_note, null,
    public._signed_lines(p_lines, -1)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- İade: köyden depoya
-- -----------------------------------------------------------------------------
create or replace function public.create_return(
  p_client_request_id uuid,
  p_doc_date          date,
  p_village_id        uuid,
  p_waybill_no        text,
  p_note              text,
  p_lines             jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_role(array['admin', 'depo']::public.user_role[]);

  if p_village_id is null then
    raise exception 'Köy seçilmelidir.' using errcode = '22023';
  end if;

  return public._post_stock_document(
    'iade', p_client_request_id, p_doc_date, p_village_id,
    '', p_waybill_no, '', '', '', p_note, null,
    public._signed_lines(p_lines, 1)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Sayım düzeltmesi: işaretli satırlar, gerekçe zorunlu (sadece admin)
-- -----------------------------------------------------------------------------
create or replace function public.create_adjustment(
  p_client_request_id uuid,
  p_doc_date          date,
  p_note              text,
  p_lines             jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_role(array['admin']::public.user_role[]);

  if char_length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Düzeltme için gerekçe yazılmalıdır.' using errcode = '22023';
  end if;

  return public._post_stock_document(
    'duzeltme', p_client_request_id, p_doc_date, null,
    '', '', '', '', '', p_note, null,
    p_lines
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- İptal: belgenin tüm hareketlerini ters kayıtla geri alır (sadece admin).
-- Orijinal belge silinmez; durumu 'iptal_edildi' olur.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_document(
  p_client_request_id uuid,
  p_document_id       uuid,
  p_reason            text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc     public.stock_documents;
  v_lines   jsonb;
  v_prev    text;
  v_cancel  uuid;
begin
  perform public._require_role(array['admin']::public.user_role[]);

  -- Tekrar istek: bu anahtarla iptal zaten yapıldıysa aynı sonucu döndür.
  select d.id into v_cancel from public.stock_documents d
  where d.client_request_id = p_client_request_id
    and d.doc_type = 'iptal'
    and d.cancels_document_id = p_document_id;
  if found then
    return v_cancel;
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'İptal gerekçesi yazılmalıdır.' using errcode = '22023';
  end if;

  -- Orijinal belgeyi kilitle: aynı belgeyi aynı anda iki kişi iptal edemez.
  select * into v_doc from public.stock_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Belge bulunamadı.' using errcode = '22023';
  end if;

  -- Aynı anahtarlı eşzamanlı istek kilidi bizden önce alıp iptali yaptıysa
  -- onun sonucunu döndür (hata vermek yerine).
  select d.id into v_cancel from public.stock_documents d
  where d.client_request_id = p_client_request_id
    and d.doc_type = 'iptal'
    and d.cancels_document_id = p_document_id;
  if found then
    return v_cancel;
  end if;

  if v_doc.doc_type = 'iptal' then
    raise exception 'İptal belgesi iptal edilemez.' using errcode = '22023';
  end if;
  if v_doc.status <> 'aktif' then
    raise exception 'Bu belge zaten iptal edilmiş.' using errcode = '22023';
  end if;

  -- Ters satırlar: her hareketin adet ve metresi eksiyle çarpılır.
  select jsonb_agg(jsonb_build_object(
           'product_id', m.product_id,
           'pieces', -m.qty_pieces,
           'meters', -m.qty_meters))
    into v_lines
  from public.stock_movements m
  where m.document_id = v_doc.id;

  v_cancel := public._post_stock_document(
    'iptal', p_client_request_id, public.today_tr(), null,
    '', '', '', '', '',
    format('Belge #%s iptali: %s', v_doc.doc_no, btrim(p_reason)),
    v_doc.id,
    v_lines
  );

  v_prev := coalesce(current_setting('app.stock_write', true), '');
  perform set_config('app.stock_write', 'on', true);
  update public.stock_documents set status = 'iptal_edildi' where id = v_doc.id;
  perform set_config('app.stock_write', v_prev, true);

  return v_cancel;
end;
$$;

-- -----------------------------------------------------------------------------
-- Yetkiler: iç fonksiyonlar dışarıdan çağrılamaz; genel fonksiyonlar sadece
-- giriş yapmış kullanıcılar için (rol kontrolü fonksiyon içinde).
-- -----------------------------------------------------------------------------
revoke execute on function public._require_role(public.user_role[]) from public, anon, authenticated;
revoke execute on function public._post_stock_document(
  public.stock_doc_type, uuid, date, uuid, text, text, text, text, text, text, uuid, jsonb
) from public, anon, authenticated;
revoke execute on function public._signed_lines(jsonb, int) from public, anon, authenticated;

revoke execute on function public.create_receipt(uuid, date, text, text, text, jsonb) from public, anon;
revoke execute on function public.create_distribution(uuid, date, uuid, text, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.create_return(uuid, date, uuid, text, text, jsonb) from public, anon;
revoke execute on function public.create_adjustment(uuid, date, text, jsonb) from public, anon;
revoke execute on function public.cancel_document(uuid, uuid, text) from public, anon;

grant execute on function public.create_receipt(uuid, date, text, text, text, jsonb) to authenticated;
grant execute on function public.create_distribution(uuid, date, uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.create_return(uuid, date, uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_adjustment(uuid, date, text, jsonb) to authenticated;
grant execute on function public.cancel_document(uuid, uuid, text) to authenticated;

-- today_tr zararsız; uygulama formdaki varsayılan tarih için kullanabilir.
revoke execute on function public.today_tr() from public, anon;
grant execute on function public.today_tr() to authenticated;
