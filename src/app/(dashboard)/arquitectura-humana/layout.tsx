import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ArquitecturaHumanaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'hr') {
    if (profile?.role === 'leader') redirect('/lider')
    if (profile?.role === 'collaborator') redirect('/colaborador')
    redirect('/login')
  }

  return <>{children}</>
}
