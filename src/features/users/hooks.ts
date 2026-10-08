import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, listUsers, updateUser } from './api'

export const userKeys = {
  all: ['users'] as const,
}

export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: listUsers })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
      // Kullanıcı kendi profilini değiştirdiyse menüdeki ad/rol de güncellensin.
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
