import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ColaboradorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Acceso por relación: /colaborador es "tus propios 1:1" (hacia arriba con tu
  // líder). Cualquier usuario autenticado entra — incluidos líderes que también
  // reportan a alguien y RH. Las queries de cada página filtran por participante.
  return <>{children}</>
}
