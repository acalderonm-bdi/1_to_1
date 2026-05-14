import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LiderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'leader') {
    if (profile?.role === 'hr') redirect('/arquitectura-humana')
    redirect('/colaborador')
  }

  return <>{children}</>
}
