import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelDocument, createAdjustment, listBalances, listDocuments, listMovements, listRecentDocuments } from './api'
import type { StockDocType } from './docTypes'

export const stockKeys = {
  all: ['stock'] as const,
  balances: ['stock', 'balances'] as const,
  documents: (type: StockDocType) => ['stock', 'documents', type] as const,
  recentDocuments: ['stock', 'documents', 'recent'] as const,
  movements: (productId: string) => ['stock', 'movements', productId] as const,
}

export function useBalances() {
  return useQuery({ queryKey: stockKeys.balances, queryFn: listBalances })
}

/** product_id -> bakiye eşlemesi (satır düzenleyicide hızlı erişim için). */
export function useBalanceMap() {
  const query = useBalances()
  const map = new Map((query.data ?? []).map((b) => [b.product_id, b]))
  return { ...query, map }
}

export function useDocuments(type: StockDocType) {
  return useQuery({ queryKey: stockKeys.documents(type), queryFn: () => listDocuments(type) })
}

export function useRecentDocuments() {
  return useQuery({ queryKey: stockKeys.recentDocuments, queryFn: () => listRecentDocuments() })
}

export function useMovements(productId: string) {
  return useQuery({ queryKey: stockKeys.movements(productId), queryFn: () => listMovements(productId) })
}

export function useCancelDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelDocument,
    onSettled: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAdjustment,
    onSettled: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}
