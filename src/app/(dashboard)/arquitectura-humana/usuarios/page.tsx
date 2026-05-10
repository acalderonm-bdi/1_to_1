import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

const ROLE_VARIANT: Record<string, 'brand' | 'solid' | 'muted'> = {
  hr: 'brand',
  leader: 'solid',
  collaborator: 'muted',
}

export default async function UsuariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawUsers } = await supabase
    .from('users').select('id, full_name, email, role, departments(name)').order('full_name')

  type Row = {
    id: string; full_name: string; email: string; role: string;
    departments: { name: string } | Array<{ name: string }> | null
  }
  const users = (rawUsers ?? []) as Row[]

  const counts = {
    total: users.length,
    hr: users.filter(u => u.role === 'hr').length,
    leader: users.filter(u => u.role === 'leader').length,
    collaborator: users.filter(u => u.role === 'collaborator').length,
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{counts.total} usuarios en el sistema.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 anim-stagger">
        <KpiTile label="Total" value={counts.total} empty={counts.total === 0} />
        <KpiTile label="Arq. Humana" value={counts.hr} empty={counts.hr === 0} />
        <KpiTile label="Líderes" value={counts.leader} empty={counts.leader === 0} />
        <KpiTile label="Colaboradores" value={counts.collaborator} empty={counts.collaborator === 0} />
      </div>

      <Card>
        <div className="divide-y">
          {users.map(u => {
            const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments
            return (
              <div key={u.id} className="flex items-center gap-3.5 px-6 py-3.5">
                <InitialsAvatar name={u.full_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium tracking-tight truncate">{u.full_name}</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {u.email} · {dept?.name ?? 'Sin área'}
                  </div>
                </div>
                <Badge variant={ROLE_VARIANT[u.role] ?? 'muted'}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function KpiTile({ label, value, empty }: { label: string; value: number; empty: boolean }) {
  return (
    <Card className="px-5 py-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="inline-flex items-center justify-center size-7 rounded-md bg-secondary text-muted-foreground">
          <UsersRound className="size-3.5" />
        </span>
      </div>
      <div className={cn(
        'font-mono-numeric text-[28px] font-medium leading-none mt-1 tracking-tight',
        empty ? 'text-muted-foreground/70' : 'text-foreground'
      )}>
        {empty ? '—' : value}
      </div>
    </Card>
  )
}
