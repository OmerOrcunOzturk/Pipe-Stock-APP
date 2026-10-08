import { useMutation, useQueryClient } from '@tanstack/react-query'
import { stockKeys } from '@/features/stock/hooks'
import { createReceipt } from './api'

export function useCreateReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createReceipt,
    // Bakiye ve belge listeleri değişti.
    onSettled: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}
