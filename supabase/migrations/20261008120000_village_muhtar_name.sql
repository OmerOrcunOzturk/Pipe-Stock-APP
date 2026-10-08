-- =============================================================================
-- Köy muhtarı: villages.muhtar_name
--
-- Köye boru verilirken düzenlenen Ambar Talep Formu ve Malzeme Talep Fişinde
-- "teslim alan / talep eden" olarak muhtarın adı yazılır. Alan isteğe bağlıdır;
-- boş bırakılırsa formda ad satırı boş çıkar.
-- =============================================================================

alter table public.villages
  add column muhtar_name text not null default ''
  constraint villages_muhtar_name_check
  check (char_length(muhtar_name) <= 100
         and muhtar_name = btrim(muhtar_name) and muhtar_name !~ '\s{2,}');

comment on column public.villages.muhtar_name is 'Köy muhtarının adı soyadı (isteğe bağlı).';

-- Yazma yetkisi sütun bazındadır; yeni sütun için ayrıca verilmeli.
grant insert (muhtar_name), update (muhtar_name) on public.villages to authenticated;
