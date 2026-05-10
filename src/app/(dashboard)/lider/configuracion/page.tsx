import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsShell } from '@/components/settings/settings-shell'

export default async function ConfiguracionLiderPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users').select('full_name, email').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string; email: string } | null

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Personaliza tu experiencia en 1to1.</p>
      </div>
      <SettingsShell
        role="leader"
        user={{
          name: profile?.full_name ?? 'Usuario',
          email: profile?.email ?? '',
        }}
      />
    </div>
  )
}
