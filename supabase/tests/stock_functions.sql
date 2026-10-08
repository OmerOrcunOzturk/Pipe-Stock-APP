-- =============================================================================
-- Stok fonksiyonları testleri (Aşama 4.3)
--
-- Supabase SQL Editor'da tamamını çalıştırın. Testler, profiles tablosundaki
-- ilk kullanıcı adına oturum açılmış gibi çalışır. Hiçbir veri kalıcı olarak
-- yazılmaz: testler bitince eklenen tüm satırlar geri alınır.
-- Sonuç tablosunda tüm satırlar 'GEÇTİ' olmalıdır.
-- =============================================================================

-- SQL'i çalıştırıp dönen uuid'yi veya 'HATA <kod>: <mesaj>' metnini verir.
create or replace function pg_temp.try_uuid(p_sql text)
returns text
language plpgsql
as $$
declare
  v uuid;
begin
  execute p_sql into v;
  return v::text;
exception when others then
  return 'HATA ' || sqlstate || ': ' || sqlerrm;
end;
$$;

-- Boru tipinin bakiyesi 'adet/metre' biçiminde.
create or replace function pg_temp.bal(p_product uuid)
returns text
language sql
as $$
  select pieces || '/' || meters from public.stock_balances where product_id = p_product;
$$;

-- Kısa JSON satır yardımcısı.
create or replace function pg_temp.line(p_product uuid, p_pieces int, p_meters numeric)
returns jsonb
language sql
as $$
  select jsonb_build_object('product_id', p_product, 'pieces', p_pieces, 'meters', p_meters);
$$;

create or replace function pg_temp.run_stock_function_tests()
returns table (no int, test text, result text)
language plpgsql
as $$
declare
  t      text[] := '{}';
  r      text[] := '{}';
  v_user uuid;
  v_a    uuid;  -- içme suyu test borusu (100 m)
  v_b    uuid;  -- koruge test borusu (6 m)
  v_vil  uuid;  -- aktif köy
  v_pas  uuid;  -- pasif köy
  v_rec1 uuid;
  v_dis1 uuid;
  v_rec2 uuid;
  v_can1 uuid;
  v_key  uuid := gen_random_uuid();
  v_ckey uuid := gen_random_uuid();
  v_out  text;
  v_num  numeric;
  v_cnt  int;
  d      date := public.today_tr();
begin
  begin
    -- ---- Hazırlık -----------------------------------------------------------
    select id into v_user from public.profiles order by created_at limit 1;
    update public.profiles set role = 'admin', is_active = true where id = v_user;

    insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
    values ('icme_suyu', 'TESTA', 991, 'PN10', 100) returning id into v_a;
    insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
    values ('korige', 'TESTB', 992, 'SN8', 6) returning id into v_b;
    insert into public.villages (name, district) values ('Test Köyü', 'Test İlçe') returning id into v_vil;
    insert into public.villages (name, district, is_active) values ('Pasif Köy', 'Test İlçe', false) returning id into v_pas;

    -- Bu kullanıcı adına oturum açılmış gibi davran (auth.uid()).
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    -- ---- Giriş --------------------------------------------------------------
    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test Tedarikçi'', ''IRS-1'', '''', %L)',
      v_key, d, jsonb_build_array(pg_temp.line(v_a, 5, 500), pg_temp.line(v_b, 10, 60))));
    t := t || 'Giriş: 5 adet A + 10 adet B'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_a) = '5/500.00' and pg_temp.bal(v_b) = '10/60.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || pg_temp.bal(v_a) end;
    v_rec1 := case when v_out !~ '^HATA' then v_out::uuid end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test Tedarikçi'', ''IRS-1'', '''', %L)',
      v_key, d, jsonb_build_array(pg_temp.line(v_a, 5, 500))));
    t := t || 'Aynı istek tekrar gelince yeni belge açılmaz'::text;
    r := r || case when v_out = v_rec1::text and pg_temp.bal(v_a) = '5/500.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || pg_temp.bal(v_a) end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      v_key, d, v_vil, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Aynı istek anahtarı başka işlemde kullanılamaz'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''   '', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Tedarikçisiz giriş reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- ---- Dağıtım ------------------------------------------------------------
    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, ''IRS-D1'', ''06 abc 123'', ''Şoför'', ''Muhtar'', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, 2, 200))));
    t := t || 'Dağıtım: 2 adet A'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_a) = '3/300.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || pg_temp.bal(v_a) end;
    v_dis1 := case when v_out !~ '^HATA' then v_out::uuid end;

    select count(*) into v_cnt from public.stock_documents
    where id = v_dis1 and vehicle_plate = '06 ABC 123' and created_by = v_user;
    t := t || 'Plaka büyük harfe çevrilir, belgeyi yapan kaydedilir'::text;
    r := r || case when v_cnt = 1 then 'GEÇTİ' else 'KALDI' end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_b, 1, 6), pg_temp.line(v_a, 4, 400))));
    t := t || 'Yetersiz stok reddedilir, diğer satır da kaydedilmez'::text;
    r := r || case when v_out like 'HATA P0001%' and pg_temp.bal(v_a) = '3/300.00' and pg_temp.bal(v_b) = '10/60.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' B=' || pg_temp.bal(v_b) end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_pas, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Pasif köye dağıtım reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d + 1, v_vil, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'İleri tarihli belge reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d - 30, v_vil, jsonb_build_array(pg_temp.line(v_b, 1, 6))));
    t := t || 'Geçmiş tarihli belge kabul edilir'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_b) = '9/54.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, 1, 100), pg_temp.line(v_a, 1, 100))));
    t := t || 'Aynı boru iki satırda olamaz'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, 0, 100))));
    t := t || 'Sıfır adet reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, -1, -100))));
    t := t || 'Dağıtımda eksi miktar reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, 1, 1500))));
    t := t || '1 adet için 1000 m üstü reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Son borular çıkarken metre farklı girilse de kabul edilir, kalan metreye eşitlenir.
    v_out := pg_temp.try_uuid(format(
      'select public.create_distribution(%L, %L, %L, '''', '''', '''', '''', '''', %L)',
      gen_random_uuid(), d, v_vil, jsonb_build_array(pg_temp.line(v_a, 3, 310))));
    select qty_meters into v_num from public.stock_movements
    where document_id = case when v_out !~ '^HATA' then v_out::uuid end and product_id = v_a;
    t := t || 'Son borular çıkarken metre kalan metreye eşitlenir'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_a) = '0/0.00' and v_num = -300
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || coalesce(pg_temp.bal(v_a), '?') end;

    -- ---- İptal --------------------------------------------------------------
    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''test'')', gen_random_uuid(), v_rec1));
    t := t || 'Dağıtılmış girişin iptali stoğu eksiye düşüreceği için reddedilir'::text;
    r := r || case when v_out like 'HATA P0001%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''   '')', gen_random_uuid(), v_dis1));
    t := t || 'Gerekçesiz iptal reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''Yanlış köye yazıldı'')', v_ckey, v_dis1));
    t := t || 'Dağıtım iptali stoğu geri ekler'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_a) = '2/200.00'
                   and exists (select 1 from public.stock_documents where id = v_dis1 and status = 'iptal_edildi')
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || pg_temp.bal(v_a) end;
    v_can1 := case when v_out !~ '^HATA' then v_out::uuid end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''Yanlış köye yazıldı'')', v_ckey, v_dis1));
    t := t || 'Aynı iptal isteği tekrar gelince aynı sonucu döner'::text;
    r := r || case when v_out = v_can1::text and pg_temp.bal(v_a) = '2/200.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''tekrar'')', gen_random_uuid(), v_dis1));
    t := t || 'İptal edilmiş belge tekrar iptal edilemez'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''tekrar'')', gen_random_uuid(), v_can1));
    t := t || 'İptal belgesi iptal edilemez'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- Pasif boru tipi: yeni işlem yok, ama geçmiş belgenin iptali serbest.
    v_rec2 := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_b, 2, 12))))::uuid;
    update public.products set is_active = false where id = v_b;

    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_b, 1, 6))));
    t := t || 'Pasif boru tipine yeni işlem yapılamaz'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''test'')', gen_random_uuid(), v_rec2));
    t := t || 'Pasif boru tipinin geçmiş belgesi iptal edilebilir'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_b) = '9/54.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' B=' || pg_temp.bal(v_b) end;

    -- ---- Düzeltme -----------------------------------------------------------
    v_out := pg_temp.try_uuid(format(
      'select public.create_adjustment(%L, %L, '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, -1, -100))));
    t := t || 'Gerekçesiz düzeltme reddedilir'::text;
    r := r || case when v_out like 'HATA 22023%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_adjustment(%L, %L, ''Sayımda 1 eksik çıktı'', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, -1, -100))));
    t := t || 'Düzeltme (eksi) uygulanır'::text;
    r := r || case when v_out !~ '^HATA' and pg_temp.bal(v_a) = '1/100.00'
                   then 'GEÇTİ' else 'KALDI: ' || v_out || ' A=' || pg_temp.bal(v_a) end;

    -- ---- Yetkiler -----------------------------------------------------------
    update public.profiles set role = 'depo' where id = v_user;

    v_out := pg_temp.try_uuid(format(
      'select public.create_adjustment(%L, %L, ''x'', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Depo rolü düzeltme yapamaz'::text;
    r := r || case when v_out like 'HATA 42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.cancel_document(%L, %L, ''x'')', gen_random_uuid(), v_rec1));
    t := t || 'Depo rolü iptal yapamaz'::text;
    r := r || case when v_out like 'HATA 42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Depo rolü giriş yapabilir'::text;
    r := r || case when v_out !~ '^HATA' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    update public.profiles set role = 'izleyici' where id = v_user;
    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'İzleyici rolü giriş yapamaz'::text;
    r := r || case when v_out like 'HATA 42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    update public.profiles set role = 'admin', is_active = false where id = v_user;
    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Pasif kullanıcı işlem yapamaz'::text;
    r := r || case when v_out like 'HATA 42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    update public.profiles set is_active = true where id = v_user;
    perform set_config('request.jwt.claims', '', true);
    v_out := pg_temp.try_uuid(format(
      'select public.create_receipt(%L, %L, ''Test'', '''', '''', %L)',
      gen_random_uuid(), d, jsonb_build_array(pg_temp.line(v_a, 1, 100))));
    t := t || 'Oturumsuz çağrı reddedilir'::text;
    r := r || case when v_out like 'HATA 42501%' then 'GEÇTİ' else 'KALDI: ' || v_out end;

    -- ---- Tutarlılık ---------------------------------------------------------
    select count(*) into v_cnt from public.v_stock_reconciliation;
    t := t || 'Tüm testlerden sonra bakiye = hareket toplamı'::text;
    r := r || case when v_cnt = 0 then 'GEÇTİ' else 'KALDI: ' || v_cnt || ' tutarsız boru' end;

    -- Eklenen tüm test verisini geri almak için bilinçli hata.
    raise exception using errcode = 'P0099', message = 'test-rollback';
  exception when sqlstate 'P0099' then
    null;
  end;

  return query
    select u.n::int, u.t, u.r
    from unnest(t, r) with ordinality as u(t, r, n);
end;
$$;

select * from pg_temp.run_stock_function_tests();
