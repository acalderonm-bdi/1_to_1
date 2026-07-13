import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getActiveRelationFlags } from '@/lib/relations'
import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as { role: string; full_name: string; email: string } | null
  if (!profile) redirect('/login')

  const { isLeader, isCollaborator } = await getActiveRelationFlags(supabase, user.id)

  const headersList = headers()
  const currentPath = headersList.get('x-pathname') ?? '/'

  return (
    <AppShell
      role={profile.role as 'collaborator' | 'leader' | 'hr'}
      isLeader={isLeader}
      isCollaborator={isCollaborator}
      currentPath={currentPath}
      userId={user.id}
      userName={profile.full_name}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  )
}
