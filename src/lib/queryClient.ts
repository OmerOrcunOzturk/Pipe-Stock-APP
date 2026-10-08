import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Stok işlemleri asla otomatik tekrar denenmez; çift kayıt riskine karşı.
      retry: false,
    },
  },
})
