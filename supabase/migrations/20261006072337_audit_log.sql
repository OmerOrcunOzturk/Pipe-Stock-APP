-- =============================================================================
-- Aşama 8.3: Değişiklik geçmişi (audit log)
--
-- products, villages ve profiles tablolarındaki her ekleme, değiştirme ve silme
-- tetikleyiciyle otomatik kaydedilir: kim, ne zaman, eski ve yeni değer.
--
-- - Kayıtlar değiştirilemez ve silinemez.
-- - Sadece admin okuyabilir; uygulama yazamaz (sadece tetikleyici ekler).
-- - Stok belgeleri burada izlenmez: onlar zaten silinemez ve kendi geçmişidir.
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  -- Supabase panelinden / SQL Editor'dan yapılan değişikliklerde NULL.
  changed_by  uuid references public.profiles (id) on delete restrict,
  changed_at  timestamptz not null default now(),

  constraint audit_log_data_matches_action check (
    (action = 'INSERT' and old_data is null and new_data is not null)
    or (action = 'UPDATE' and old_data is not null and new_data is not null)
    or (action = 'DELETE' and old_data is not null and new_data is null)
  )
);

comment on table public.audit_log is 'Tanım tablolarındaki değişikliklerin geçmişi. Değiştirilemez.';

create index audit_log_changed_at_idx on public.audit_log (changed_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

-- Değişikliği kaydeden tetikleyici fonksiyonu ---------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  -- updated_at her güncellemede değişir; anlamlı bir değişiklik değildir.
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old) - 'updated_at';
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new) - 'updated_at';
  end if;

  -- Hiçbir alan değişmediyse kayıt açma.
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  insert into public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    (coalesce(v_new, v_old) ->> 'id')::uuid,
    tg_op,
    v_old,
    v_new,
    auth.uid()
  );
  return null;
end;
$$;

create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change();

create trigger villages_audit
  after insert or update or delete on public.villages
  for each row execute function public.audit_row_change();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

-- Geçmiş kayıtları değiştirilemez / silinemez ---------------------------------
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Değişiklik geçmişi kayıtları değiştirilemez veya silinemez.'
    using errcode = '42501';
end;
$$;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_audit_mutation();

revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.prevent_audit_mutation() from public, anon, authenticated;

-- Yetkiler ve satır güvenliği -------------------------------------------------
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- INSERT / UPDATE / DELETE politikası yok: sadece tetikleyici yazar.
