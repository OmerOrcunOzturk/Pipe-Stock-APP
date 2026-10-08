import type { Database } from '@/types/database.types'

export type UserRole = Database['public']['Enums']['user_role']

export const roleLabels: Record<UserRole, string> = {
  admin: 'Yönetici',
  depo: 'Depo Sorumlusu',
  izleyici: 'İzleyici',
}
