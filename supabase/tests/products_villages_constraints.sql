-- =============================================================================
-- Tanım tabloları kısıt testleri (Aşama 3.1)
--
-- Supabase SQL Editor'da tamamını çalıştırın. Hiçbir veri kalıcı olarak
-- yazılmaz: testler bitince eklenen tüm satırlar geri alınır.
-- Sonuç tablosunda tüm satırlar 'GEÇTİ' olmalıdır.
-- =============================================================================

create or replace function pg_temp.run_definition_tests()
returns table (test text, result text)
language plpgsql
as $$
declare
  v_tests   text[] := '{}';
  v_results text[] := '{}';
  v_name    text;
begin
  begin
    -- 1) Geçerli içme suyu borusu kabul edilmeli
    begin
      insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
      values ('icme_suyu', 'PE100', 110, 'PN16', 100);
      v_tests := v_tests || 'Geçerli içme suyu borusu eklenir'::text; v_results := v_results || 'GEÇTİ'::text;
    exception when others then
      v_tests := v_tests || 'Geçerli içme suyu borusu eklenir'::text; v_results := v_results || ('KALDI: ' || sqlerrm);
    end;

    -- 2) Ad otomatik üretilmeli
    select p.name into v_name from public.products p
    where p.category = 'icme_suyu' and p.material = 'PE100'
      and p.diameter_mm = 110 and p.pressure_class = 'PN16';
    v_tests := v_tests || 'Ad otomatik üretilir (Ø110 PE100 PN16)'::text;
    v_results := v_results || case when v_name = 'Ø110 PE100 PN16' then 'GEÇTİ'
                                   else 'KALDI: ' || coalesce(v_name, 'NULL') end;

    -- 3) Aynı boru ikinci kez eklenemez
    begin
      insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
      values ('icme_suyu', 'PE100', 110, 'PN16', 50);
      v_tests := v_tests || 'Aynı boru tipi tekrar eklenemez'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when unique_violation then
      v_tests := v_tests || 'Aynı boru tipi tekrar eklenemez'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 4) Koruge boruya PN sınıfı verilemez
    begin
      insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
      values ('korige', 'PE', 200, 'PN16', 6);
      v_tests := v_tests || 'Koruge boruya PN sınıfı verilemez'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when check_violation then
      v_tests := v_tests || 'Koruge boruya PN sınıfı verilemez'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 5) Küçük harfli malzeme kodu reddedilir
    begin
      insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
      values ('icme_suyu', 'pe100', 90, 'PN10', 100);
      v_tests := v_tests || 'Küçük harfli malzeme reddedilir'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when check_violation then
      v_tests := v_tests || 'Küçük harfli malzeme reddedilir'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 6) Sıfır boy reddedilir
    begin
      insert into public.products (category, material, diameter_mm, pressure_class, standard_length_m)
      values ('korige', 'PE', 300, 'SN8', 0);
      v_tests := v_tests || 'Sıfır boy reddedilir'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when check_violation then
      v_tests := v_tests || 'Sıfır boy reddedilir'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 7) Geçerli köy kabul edilir
    begin
      insert into public.villages (name, district) values ('Yeşilköy', 'Merkez');
      v_tests := v_tests || 'Geçerli köy eklenir'::text; v_results := v_results || 'GEÇTİ'::text;
    exception when others then
      v_tests := v_tests || 'Geçerli köy eklenir'::text; v_results := v_results || ('KALDI: ' || sqlerrm);
    end;

    -- 8) Aynı ilçede aynı köy (farklı harf büyüklüğü) eklenemez
    begin
      insert into public.villages (name, district) values ('yeşilköy', 'merkez');
      v_tests := v_tests || 'Aynı köy tekrar eklenemez (büyük/küçük harf)'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when unique_violation then
      v_tests := v_tests || 'Aynı köy tekrar eklenemez (büyük/küçük harf)'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 9) Başında boşluk olan köy adı reddedilir
    begin
      insert into public.villages (name) values (' Karaköy');
      v_tests := v_tests || 'Baştaki boşluk reddedilir'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when check_violation then
      v_tests := v_tests || 'Baştaki boşluk reddedilir'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- 10) Farklı ilçede aynı isim kabul edilir
    begin
      insert into public.villages (name, district) values ('Yeşilköy', 'Kuzey');
      v_tests := v_tests || 'Farklı ilçede aynı isim eklenir'::text; v_results := v_results || 'GEÇTİ'::text;
    exception when others then
      v_tests := v_tests || 'Farklı ilçede aynı isim eklenir'::text; v_results := v_results || ('KALDI: ' || sqlerrm);
    end;

    -- 11) Muhtar adı isteğe bağlıdır; verilmezse boş kalır
    select v.muhtar_name into v_name from public.villages v
    where v.name = 'Yeşilköy' and v.district = 'Merkez';
    v_tests := v_tests || 'Muhtar adı verilmezse boş kalır'::text;
    v_results := v_results || case when v_name = '' then 'GEÇTİ' else 'KALDI: ' || coalesce(v_name, 'null') end;

    -- 12) Muhtar adıyla köy eklenir
    begin
      insert into public.villages (name, district, muhtar_name) values ('Muhtarlı', 'Merkez', 'Ali Veli');
      v_tests := v_tests || 'Muhtar adıyla köy eklenir'::text; v_results := v_results || 'GEÇTİ'::text;
    exception when others then
      v_tests := v_tests || 'Muhtar adıyla köy eklenir'::text; v_results := v_results || ('KALDI: ' || sqlerrm);
    end;

    -- 13) Sonunda boşluk olan muhtar adı reddedilir
    begin
      insert into public.villages (name, district, muhtar_name) values ('Boşluklu', 'Merkez', 'Ali Veli ');
      v_tests := v_tests || 'Muhtar adında sondaki boşluk reddedilir'::text; v_results := v_results || 'KALDI: kabul edildi'::text;
    exception when check_violation then
      v_tests := v_tests || 'Muhtar adında sondaki boşluk reddedilir'::text; v_results := v_results || 'GEÇTİ'::text;
    end;

    -- Eklenen tüm test verisini geri almak için bilinçli hata.
    raise exception using errcode = 'P0099', message = 'test-rollback';
  exception when sqlstate 'P0099' then
    null;
  end;

  return query select t, r from unnest(v_tests, v_results) as u(t, r);
end;
$$;

select * from pg_temp.run_definition_tests();
