import { useMutation, useQueryClient } from '@tanstack/react-query'
import { stockKeys } from '@/features/stock/hooks'
import { createDistribution } from './api'

export function useCreateDistribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDistribution,
    // Başarılı da olsa hata da verse bakiyeleri tazele: hata, stok başkası
    // tarafından değiştirildiği için gelmiş olabilir.
    onSettled: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}
