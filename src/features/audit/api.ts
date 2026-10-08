import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'

const auditSelect = `
  id, table_name, record_id, action, old_data, new_data, changed_at,
  changer:profiles!audit_log_changed_by_fkey ( full_name )
` as const

/** Tanım tablolarındaki son değişiklikler, en yeni en üstte (sadece admin). */
export async function listAuditLog(limit = 100) {
  const { data, error } = await getSupabase()
    .from('audit_log')
    .select(auditSelect)
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw toUserError(error)
  return data
}

export type AuditEntry = Awaited<ReturnType<typeof listAuditLog>>[number]
