import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveRelationFlags } from '@/lib/relations'

export default async function LiderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Acceso por relación: las vistas de líder son para quien tiene reportes activos
  // (no por users.role). Un mando medio con role='collaborator' que lidera entra;
  // alguien sin reportes se va a su espacio personal (o al panel RH si es RH).
  const { isLeader } = await getActiveRelationFlags(supabase, user.id)
  if (!isLeader) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>()
    if (profile?.role === 'hr') redirect('/arquitectura-humana')
    redirect('/colaborador')
  }

  return <>{children}</>
}
