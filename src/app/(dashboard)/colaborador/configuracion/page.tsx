import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { SettingsShell } from '@/components/settings/settings-shell'

export default async function ConfiguracionColaboradorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users').select('full_name, email').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string; email: string } | null

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Settings size={12} /> Tu cuenta</span>
          <h1 className="page__title">Configuración</h1>
          <p className="page__subtitle">Personaliza tu experiencia en 1to1.</p>
        </div>
      </div>
      <SettingsShell
        role="collaborator"
        user={{
          name: profile?.full_name ?? 'Usuario',
          email: profile?.email ?? '',
        }}
      />
    </div>
  )
}
