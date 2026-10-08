import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import type { Product, ProductInput } from './types'

const errorMessages = {
  '23505': 'Bu boru tipi (kategori, malzeme, çap ve sınıf) zaten tanımlı.',
  '23514': 'Girilen değerlerden biri geçersiz. Malzeme, sınıf ve boy alanlarını kontrol edin.',
  PGRST116: 'Kayıt bulunamadı veya bu işlem için yetkiniz yok.',
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .order('category')
    .order('diameter_mm')
    .order('material')
    .order('pressure_class')
  if (error) throw toUserError(error)
  return data
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await getSupabase().from('products').insert(input).select().single()
  if (error) throw toUserError(error, errorMessages)
  return data
}

export async function updateProduct(
  id: string,
  changes: Partial<ProductInput> & { is_active?: boolean },
): Promise<Product> {
  const { data, error } = await getSupabase()
    .from('products')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw toUserError(error, errorMessages)
  return data
}

/** Hiç stok hareketi olmayan boru tipini kalıcı olarak siler (sadece admin). */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_product', { p_product_id: id })
  if (error) throw toUserError(error)
}
