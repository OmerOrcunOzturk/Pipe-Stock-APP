import { useCallback, useRef } from 'react'
import { newUuid } from '@/utils/uuid'

/**
 * Stok formları için istek anahtarı (client_request_id).
 *
 * - Form içeriği değişmeden "Kaydet"e tekrar basılırsa (örn. bağlantı koptu)
 *   aynı anahtar gider; veritabanı ikinci belge oluşturmaz.
 * - Form içeriği değişirse anahtar yenilenir; böylece değişiklikler, önceki
 *   denemenin sonucuna sessizce eşlenip kaybolmaz.
 */
export function useRequestKey() {
  const key = useRef(newUuid())
  const renew = useCallback(() => {
    key.current = newUuid()
  }, [])
  return { getKey: () => key.current, renew }
}
