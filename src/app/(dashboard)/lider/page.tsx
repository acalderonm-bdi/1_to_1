import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Calendar, TrendingUp, Plus, ArrowRight, UserPlus } from 'lucide-react'
import { formatPct, formatCount } from '@/lib/utils/format'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

export default async function LiderPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const nowIso = new Date().toISOString()

  // 4 queries en paralelo (4 RTTs → 1 RTT efectivo)
  const [
    { data: rawProfile },
    { data: rawRelations },
    { data: rawMeetings },
    { data: rawUpcoming },
  ] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).single(),
    supabase
      .from('leadership_relations')
      .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
      .eq('leader_id', user.id)
      .is('ended_at', null),
    supabase
      .from('one_on_ones')
      .select('id, status, collaborator_id, scheduled_at')
      .eq('leader_id', user.id)
      .gte('scheduled_at', startOfMonth.toISOString()),
    supabase
      .from('one_on_ones')
      .select('id, collaborator_id, scheduled_at')
      .eq('leader_id', user.id)
      .eq('status', 'agendada')
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true }),
  ])

  const profile = rawProfile as { full_name: string } | null
  const relations = (rawRelations ?? []) as Array<{
    collaborator_id: string
    users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
  }>
  const collaboratorIds = relations.map(r => r.collaborator_id)
  const monthMeetings = (rawMeetings ?? []) as Array<{ id: string; status: string; collaborator_id: string; scheduled_at: string }>

  const realized = monthMeetings.filter(m => m.status === 'realizada').length
  const total = monthMeetings.length
  const compliance = total > 0 ? Math.round((realized / total) * 100) : 0

  const upcomingMap: Record<string, { id: string; scheduled_at: string }> = {}
  const upcoming = (rawUpcoming ?? []) as Array<{ id: string; collaborator_id: string; scheduled_at: string }>
  upcoming.forEach(m => {
    if (!upcomingMap[m.collaborator_id]) upcomingMap[m.collaborator_id] = { id: m.id, scheduled_at: m.scheduled_at }
  })

  const firstName = profile?.full_name.split(' ')[0] ?? 'Líder'
  const hasMeetings = total > 0
  const hasTeam = collaboratorIds.length > 0

  const compTone: 'neutral' | 'success' | 'warning' | 'destructive' =
    !hasMeetings ? 'neutral' :
    compliance >= 80 ? 'success' :
    compliance >= 60 ? 'warning' :
    'destructive'

  const compBarColor =
    compTone === 'success' ? 'bg-success' :
    compTone === 'warning' ? 'bg-warning' :
    compTone === 'destructive' ? 'bg-destructive' :
    'bg-muted-foreground/40'

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Hola, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Resumen de tu equipo y cumplimiento de cadencia este mes.
          </p>
        </div>
        <Button asChild>
          <Link href="/colaborador/1to1/nueva">
            <Plus className="size-3.5" /> Agendar 1:1
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7 anim-stagger">
        <Kpi
          label="Colaboradores" value={formatCount(collaboratorIds.length, { hasData: hasTeam })}
          empty={!hasTeam} icon={Users} hint="a tu cargo"
        />
        <Kpi
          label="1:1s este mes" value={formatCount(total, { hasData: hasMeetings })}
          empty={!hasMeetings} icon={Calendar} hint={`${realized} realizadas`}
        />
        <Kpi
          label="Cumplimiento" value={formatPct(compliance, { hasData: hasMeetings })}
          empty={!hasMeetings} icon={TrendingUp} hint=""
          extra={
            hasMeetings ? (
              <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full transition-[width]', compBarColor)} style={{ width: `${compliance}%` }} />
              </div>
            ) : null
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" /> Mi equipo
            </CardTitle>
            <CardDescription>Próximas 1:1s con cada colaborador.</CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/lider/equipo">Ver todos <ArrowRight className="size-3" /></Link>
          </Button>
        </CardHeader>
        <div>
          {relations.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Sin colaboradores asignados"
              description="Contacta a Arquitectura Humana para que configure tu relación con tu equipo."
            />
          ) : (
            <div className="divide-y">
              {relations.map(rel => {
                const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
                if (!collab) return null
                const next = upcomingMap[rel.collaborator_id]
                return (
                  <div key={rel.collaborator_id} className="flex items-center gap-3.5 px-6 py-3.5">
                    <InitialsAvatar name={collab.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium tracking-tight truncate">{collab.full_name}</div>
                      <div className="text-[12px] text-muted-foreground truncate">{collab.email}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {next ? (
                        <>
                          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Próxima</div>
                          <div className="text-[13px] font-medium font-mono-numeric mt-0.5">
                            {new Date(next.scheduled_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </div>
                        </>
                      ) : (
                        <Badge variant="muted">Sin agendar</Badge>
                      )}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={next ? `/lider/1to1/${next.id}` : '/colaborador/1to1/nueva'}>
                        {next ? 'Ver' : 'Agendar'} <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function Kpi({
  label, value, icon: Icon, hint, empty, extra,
}: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; hint: string; empty: boolean; extra?: React.ReactNode
}) {
  return (
    <Card className="px-5 py-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="inline-flex items-center justify-center size-7 rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn(
        'font-mono-numeric text-[28px] font-medium leading-none mt-1 tracking-tight',
        empty ? 'text-muted-foreground/70' : 'text-foreground'
      )}>
        {value}
      </div>
      {hint && <div className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</div>}
      {extra}
    </Card>
  )
}
