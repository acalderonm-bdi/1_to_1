import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'

export default async function UsuariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawUsers } = await supabase
    .from('users')
    .select('id, full_name, email, role, departments(name)')
    .order('full_name')

  type UserRow = {
    id: string
    full_name: string
    email: string
    role: string
    departments: { name: string } | Array<{ name: string }> | null
  }

  const users = rawUsers as UserRow[] | null

  const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
    hr: 'default',
    leader: 'secondary',
    collaborator: 'outline',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-slate-500 mt-1">{users?.length ?? 0} usuarios en el sistema</p>
      </div>

      {!users?.length ? (
        <EmptyState icon={Users} title="Sin usuarios" className="py-16" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {users.map(u => {
                const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments
                return (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email} · {dept?.name ?? 'Sin área'}</p>
                    </div>
                    <Badge variant={ROLE_VARIANTS[u.role] ?? 'outline'}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
