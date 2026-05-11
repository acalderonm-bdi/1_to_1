'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Suscripción en vivo a cambios en una 1:1: notas (minutes), acuerdos, VoBos y agenda.
 * Cuando llega un cambio, hace router.refresh() para re-renderizar las páginas server.
 * También devuelve un "pulso" (lastEventAt) por si el componente quiere mostrar indicador.
 */
export function useRealtimeMeeting(oneOnOneId: string, currentUserId: string) {
  const router = useRouter()
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [lastEventBy, setLastEventBy] = useState<string | null>(null)

  useEffect(() => {
    if (!oneOnOneId) return
    const supabase = createClient()

    function trigger(actorId: string | null) {
      // Ignora cambios hechos por uno mismo (ya se reflejan localmente).
      if (actorId && actorId === currentUserId) return
      setLastEventAt(Date.now())
      setLastEventBy(actorId)
      router.refresh()
    }

    const channel = supabase
      .channel(`meeting:${oneOnOneId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'minutes', filter: `one_on_one_id=eq.${oneOnOneId}` },
        payload => {
          const row = (payload.new ?? payload.old) as { author_id?: string } | undefined
          trigger(row?.author_id ?? null)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agreements', filter: `one_on_one_id=eq.${oneOnOneId}` },
        () => trigger(null)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vobos', filter: `one_on_one_id=eq.${oneOnOneId}` },
        payload => {
          const row = (payload.new ?? payload.old) as { user_id?: string } | undefined
          trigger(row?.user_id ?? null)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_items', filter: `one_on_one_id=eq.${oneOnOneId}` },
        payload => {
          const row = (payload.new ?? payload.old) as { author_id?: string } | undefined
          trigger(row?.author_id ?? null)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [oneOnOneId, currentUserId, router])

  return { lastEventAt, lastEventBy }
}
