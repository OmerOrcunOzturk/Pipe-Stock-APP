-- =============================================================================
-- Tanım silme: hiç kullanılmamış boru tipi ve köy kalıcı olarak silinebilir.
--
-- Kural:
--   - Sadece admin silebilir.
--   - Stok hareketi olan boru tipi / belgesi olan köy SİLİNEMEZ (iptal edilmiş
--     belgeler de sayılır: geçmiş kayıtlar bozulmamalı). Bunlar pasife alınır.
--   - Stok belgeleri ve hareketleri için silme YOKTUR; onlar iptal edilir.
-- =============================================================================

-- Köy silme -------------------------------------------------------------------
-- Belgesi olan köyde stock_documents.village_id yabancı anahtarı (ON DELETE
-- RESTRICT) silmeyi zaten engeller; uygulama bu hatayı Türkçe mesajla gösterir.
grant delete on public.villages to authenticated;

create policy "villages_delete_admin"
  on public.villages for delete
  to authenticated
  using (public.is_admin());

-- Boru tipi silme -------------------------------------------------------------
-- Boru tipinin stock_balances satırı da silinmeli. O tabloda silme şimdiye
-- kadar tamamen yasaktı; artık sadece yazma bayrağı açıkken (yani aşağıdaki
-- fonksiyonun içinden) mümkün.

-- guard_stock_write: DELETE tetikleyicisinde de kullanılabilsin diye OLD döndürür.
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
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger stock_balances_no_delete on public.stock_balances;

create trigger stock_balances_guard_delete
  before delete on public.stock_balances
  for each row execute function public.guard_stock_write();

create or replace function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev    text := coalesce(current_setting('app.stock_write', true), '');
  v_balance public.stock_balances;
begin
  perform public._require_role(array['admin']::public.user_role[]);

  -- Bakiye satırını kilitle: aynı anda bu boruya stok işlemi yapılamasın.
  select * into v_balance from public.stock_balances
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'Boru tipi bulunamadı.' using errcode = '22023';
  end if;

  if exists (select 1 from public.stock_movements m where m.product_id = p_product_id)
     or v_balance.pieces <> 0 or v_balance.meters <> 0
  then
    raise exception 'Bu boru tipinin stok hareketi var; silinemez. Bunun yerine pasife alabilirsiniz.'
      using errcode = 'P0001';
  end if;

  perform set_config('app.stock_write', 'on', true);
  delete from public.stock_balances where product_id = p_product_id;
  perform set_config('app.stock_write', v_prev, true);

  delete from public.products where id = p_product_id;
end;
$$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
