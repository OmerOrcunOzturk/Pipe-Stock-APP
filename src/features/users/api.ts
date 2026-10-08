import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import type { UserRole } from '@/features/auth/roles'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  /** Hiç giriş yapmamış kullanıcıda null. */
  last_sign_in_at: string | null
}

export interface UserUpdateInput {
  id: string
  fullName: string
  role: UserRole
  isActive: boolean
  /** Doluysa kullanıcının şifresi bununla değiştirilir. */
  newPassword?: string
}

export interface UserCreateInput {
  email: string
  password: string
  fullName: string
  role: UserRole
}

export const MIN_PASSWORD_LENGTH = 8

const errorMessages = {
  '23505': 'Bu e-posta adresiyle bir kullanıcı zaten var.',
}

/** Tüm kullanıcılar (sadece admin). */
export async function listUsers(): Promise<AppUser[]> {
  const { data, error } = await getSupabase().rpc('admin_list_users')
  if (error) throw toUserError(error)
  return data
}

/** Kullanıcının adını, rolünü ve aktifliğini değiştirir (sadece admin). */
export async function updateUser(input: UserUpdateInput): Promise<void> {
  const { error } = await getSupabase().rpc('admin_update_user', {
    p_user_id: input.id,
    p_full_name: input.fullName,
    p_role: input.role,
    p_is_active: input.isActive,
  })
  if (error) throw toUserError(error)

  if (input.newPassword) {
    const { error: passwordError } = await getSupabase().rpc('admin_set_user_password', {
      p_user_id: input.id,
      p_password: input.newPassword,
    })
    if (passwordError) throw toUserError(passwordError)
  }
}

/** Yeni kullanıcı ekler (sadece admin). Kullanıcı bu e-posta ve şifreyle giriş yapar. */
export async function createUser(input: UserCreateInput): Promise<void> {
  const { error } = await getSupabase().rpc('admin_create_user', {
    p_email: input.email,
    p_password: input.password,
    p_full_name: input.fullName,
    p_role: input.role,
  })
  if (error) throw toUserError(error, errorMessages)
}
