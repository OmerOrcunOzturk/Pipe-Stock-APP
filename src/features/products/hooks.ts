import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProduct, deleteProduct, listProducts, updateProduct } from './api'
import type { ProductInput } from './types'

export const productKeys = {
  all: ['products'] as const,
}

export function useProducts() {
  return useQuery({ queryKey: productKeys.all, queryFn: listProducts })
}

export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) =>
      id ? updateProduct(id, input) : createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useSetProductActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateProduct(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
