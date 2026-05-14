import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RefreshCcw } from 'lucide-react'
import { SyncPlaceholder } from '@/components/arquitectura-humana/sync-placeholder'

export default async function SincronizacionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><RefreshCcw size={12} /> Sincronización externa</span>
          <h1 className="page__title">Sincronización</h1>
          <p className="page__subtitle">Integración con Conexiones Humanas para mantener la estructura organizacional actualizada.</p>
        </div>
      </div>

      <SyncPlaceholder />
    </div>
  )
}
