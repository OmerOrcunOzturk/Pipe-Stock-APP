import { useQuery } from '@tanstack/react-query'
import {
  fetchMovementDetails,
  fetchProductSummary,
  fetchVillageDistribution,
  type DateRange,
  type MovementFilters,
} from './api'

const isValidRange = (range: DateRange) => !!range.from && !!range.to && range.from <= range.to

// Raporlar her açılışta güncel veriyle gelsin (staleTime: 0).

export function useVillageDistribution(range: DateRange) {
  return useQuery({
    queryKey: ['reports', 'village-distribution', range.from, range.to],
    queryFn: () => fetchVillageDistribution(range),
    enabled: isValidRange(range),
    staleTime: 0,
  })
}

export function useProductSummary(range: DateRange) {
  return useQuery({
    queryKey: ['reports', 'product-summary', range.from, range.to],
    queryFn: () => fetchProductSummary(range),
    enabled: isValidRange(range),
    staleTime: 0,
  })
}

export function useMovementDetails(filters: MovementFilters) {
  return useQuery({
    queryKey: ['reports', 'movements', filters],
    queryFn: () => fetchMovementDetails(filters),
    enabled: isValidRange(filters),
    staleTime: 0,
  })
}
