import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as { role: string; full_name: string } | null
  if (!profile) redirect('/login')

  const headersList = headers()
  const currentPath = headersList.get('x-pathname') ?? '/'

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={profile.role as 'collaborator' | 'leader' | 'hr'}
        currentPath={currentPath}
        userName={profile.full_name}
      />
      <div className="flex flex-col flex-1 min-h-screen">
        <Header
          userId={user.id}
          userName={profile.full_name}
          userRole={profile.role}
        />
        <main className="flex-1 bg-slate-50 overflow-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
