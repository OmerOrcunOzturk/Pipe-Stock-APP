-- =============================================================================
-- Stok çekirdeği koruma testleri (Aşama 4.1)
--
-- Supabase SQL Editor'da tamamını çalıştırın. Hiçbir veri kalıcı olarak
-- yazılmaz: testler bitince eklenen tüm satırlar geri alınır.
-- Sonuç tablosunda tüm satırlar 'GEÇTİ' olmalıdır.
--
-- Beklenen hata kodları:
--   42501 = yetki / koruma tetikleyicisi   23514 = CHECK ihlali
--   23505 = UNIQUE ihlali                   P0001 = iş kuralı hatası
-- =============================================================================

-- Verilen SQL'i kendi alt işleminde çalıştırır; 'OK' veya 'HATAKODU: mesaj' döner.
create or replace function pg_temp.try_sql(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlstate || ': ' || sqlerrm;
end;
$$;

create or replace function pg_temp.run_stock_core_tests()
returns table (no int, test text, result text)
language plpgsql
as $$
declare
  v_tests   text[] := '{}';
  v_results text[] := '{}';
  v_user    uuid;
  v_prod    uuid;
  v_doc     uuid := gen_random_uuid();
  v_req     uuid := gen_random_uuid();
  v_count   int;
  v_out     text;
begin
  begin
    -- Belgelerin created_by alanı için mevcut bir kullanıcı.
    select id into v_user from public.profiles order by created_at limit 1;

    -- 1) Yeni boru tipi eklenince bakiye satırı otomatik açılır
    insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
    values ('icme_suyu', 'TESTMAT', 999, 'PN10', 100)
    returning id into v_prod;
    select count(*) into v_count from public.stock_balances where product_id = v_prod and pieces = 0 and meters = 0;
    v_tests := v_tests || 'Yeni boru tipine bakiye satırı açılır'::text;
    v_results := v_results || case when v_count = 1 then 'GEÇTİ' else 'KALDI: satır yok' end;

    -- Bayrak KAPALI iken doğrudan yazma denemeleri
    perform set_config('app.stock_write', '', true);

    v_out := pg_temp.try_sql(format('update public.stock_balances set pieces = 1, meters = 100 where product_id = %L', v_prod));
    v_tests := v_tests || 'Bakiye doğrudan güncellenemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('delete from public.stock_balances where product_id = %L', v_prod));
    v_tests := v_tests || 'Bakiye silinemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_documents (doc_type, doc_date, client_request_id, created_by) values (''giris'', current_date, %L, %L)',
      gen_random_uuid(), v_user));
    v_tests := v_tests || 'Belge doğrudan eklenemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Bayrak AÇIK iken (stok fonksiyonlarının çalıştığı ortam) kısıt testleri
    perform set_config('app.stock_write', 'on', true);

    v_out := pg_temp.try_sql(format('update public.stock_balances set pieces = -1, meters = 0 where product_id = %L', v_prod));
    v_tests := v_tests || 'Negatif stok reddedilir'::text;
    v_results := v_results || case when v_out like '23514%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('update public.stock_balances set pieces = 5, meters = 0 where product_id = %L', v_prod));
    v_tests := v_tests || 'Adet var, metre 0 reddedilir'::text;
    v_results := v_results || case when v_out like '23514%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_documents (doc_type, doc_date, client_request_id, created_by) values (''dagitim'', current_date, %L, %L)',
      gen_random_uuid(), v_user));
    v_tests := v_tests || 'Köysüz dağıtım belgesi reddedilir'::text;
    v_results := v_results || case when v_out like '23514%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_documents (doc_type, doc_date, client_request_id, created_by) values (''duzeltme'', current_date, %L, %L)',
      gen_random_uuid(), v_user));
    v_tests := v_tests || 'Gerekçesiz düzeltme belgesi reddedilir'::text;
    v_results := v_results || case when v_out like '23514%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_documents (id, doc_type, doc_date, supplier, client_request_id, created_by) values (%L, ''giris'', current_date, ''TEST'', %L, %L)',
      v_doc, v_req, v_user));
    v_tests := v_tests || 'Geçerli giriş belgesi eklenir'::text;
    v_results := v_results || case when v_out = 'OK' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_documents (doc_type, doc_date, supplier, client_request_id, created_by) values (''giris'', current_date, ''TEST'', %L, %L)',
      v_req, v_user));
    v_tests := v_tests || 'Aynı client_request_id tekrar kullanılamaz'::text;
    v_results := v_results || case when v_out like '23505%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_movements (document_id, product_id, qty_pieces, qty_meters) values (%L, %L, 2, -200)',
      v_doc, v_prod));
    v_tests := v_tests || 'Adet ve metre işareti farklı olamaz'::text;
    v_results := v_results || case when v_out like '23514%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format(
      'insert into public.stock_movements (document_id, product_id, qty_pieces, qty_meters) values (%L, %L, 2, 200)',
      v_doc, v_prod));
    v_tests := v_tests || 'Geçerli hareket eklenir'::text;
    v_results := v_results || case when v_out = 'OK' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Bakiye güncellenmeden bırakılırsa tutarlılık görünümü bunu yakalamalı
    select count(*) into v_count from public.v_stock_reconciliation where product_id = v_prod;
    v_tests := v_tests || 'Tutarsızlık görünümü uyumsuzluğu yakalar'::text;
    v_results := v_results || case when v_count = 1 then 'GEÇTİ' else 'KALDI: yakalanmadı' end;

    update public.stock_balances set pieces = 2, meters = 200 where product_id = v_prod;
    select count(*) into v_count from public.v_stock_reconciliation where product_id = v_prod;
    v_tests := v_tests || 'Bakiye düzelince tutarsızlık kalmaz'::text;
    v_results := v_results || case when v_count = 0 then 'GEÇTİ' else 'KALDI: hâlâ tutarsız' end;

    -- Değiştirilemezlik (bayrak açık olsa bile)
    v_out := pg_temp.try_sql(format('update public.stock_movements set qty_pieces = 3 where document_id = %L', v_doc));
    v_tests := v_tests || 'Hareket değiştirilemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('delete from public.stock_movements where document_id = %L', v_doc));
    v_tests := v_tests || 'Hareket silinemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('update public.stock_documents set note = ''değişti'' where id = %L', v_doc));
    v_tests := v_tests || 'Belgenin içeriği değiştirilemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('delete from public.stock_documents where id = %L', v_doc));
    v_tests := v_tests || 'Belge silinemez'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('update public.stock_documents set status = ''iptal_edildi'' where id = %L', v_doc));
    v_tests := v_tests || 'Belge durumu iptal edildi yapılabilir'::text;
    v_results := v_results || case when v_out = 'OK' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('update public.stock_documents set status = ''aktif'' where id = %L', v_doc));
    v_tests := v_tests || 'İptal edilen belge tekrar aktif yapılamaz'::text;
    v_results := v_results || case when v_out like '42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Tanım kilidi
    perform set_config('app.stock_write', '', true);

    v_out := pg_temp.try_sql(format('update public.products set diameter_mm = 998 where id = %L', v_prod));
    v_tests := v_tests || 'Hareket görmüş borunun çapı değiştirilemez'::text;
    v_results := v_results || case when v_out like 'P0001%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_sql(format('update public.products set standard_length_m = 50 where id = %L', v_prod));
    v_tests := v_tests || 'Hareket görmüş borunun standart boyu değiştirilebilir'::text;
    v_results := v_results || case when v_out = 'OK' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Eklenen tüm test verisini geri almak için bilinçli hata.
    raise exception using errcode = 'P0099', message = 'test-rollback';
  exception when sqlstate 'P0099' then
    null;
  end;

  return query
    select u.n::int, u.t, u.r
    from unnest(v_tests, v_results) with ordinality as u(t, r, n);
end;
$$;

select * from pg_temp.run_stock_core_tests();
