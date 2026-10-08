import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVillage, deleteVillage, listVillages, updateVillage } from './api'
import type { VillageInput } from './types'

export const villageKeys = {
  all: ['villages'] as const,
}

export function useVillages() {
  return useQuery({ queryKey: villageKeys.all, queryFn: listVillages })
}

export function useSaveVillage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: VillageInput }) =>
      id ? updateVillage(id, input) : createVillage(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: villageKeys.all }),
  })
}

export function useSetVillageActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateVillage(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: villageKeys.all }),
  })
}

export function useDeleteVillage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteVillage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: villageKeys.all }),
  })
}
