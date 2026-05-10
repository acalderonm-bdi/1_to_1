import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Calendar, CheckSquare, Plus, ArrowRight, Video, MapPin, Sparkles,
  CalendarPlus, AlertCircle, Clock,
} from 'lucide-react'
import { STATUS_LABELS, AGREEMENT_LABELS } from '@/lib/constants'
import { formatCount } from '@/lib/utils/format'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils/cn'

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export default async function ColaboradorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nowIso = new Date().toISOString()
  const orFilter = `leader_id.eq.${user.id},collaborator_id.eq.${user.id}`

  // Lanzar todas las queries independientes en paralelo (6 RTTs → 1 RTT efectivo)
  const [
    { data: rawProfile },
    { data: rawUpcoming },
    { data: rawPending },
    { data: rawAgreements },
    { count: realizedCount },
    { count: completedAgreements },
  ] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).single(),
    supabase
      .from('one_on_ones')
      .select('id, scheduled_at, modality, location, meet_link, status, leader_id, collaborator_id')
      .or(orFilter)
      .eq('status', 'agendada')
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabase
      .from('one_on_ones')
      .select('id, scheduled_at, modality, location, status, leader_id, collaborator_id, vobos(user_id, confirmed)')
      .or(orFilter)
      .eq('status', 'agendada')
      .lt('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: false })
      .limit(8),
    supabase
      .from('agreements')
      .select('id, description, status, due_date')
      .eq('responsible_id', user.id)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from('one_on_ones')
      .select('id', { count: 'exact', head: true })
      .or(orFilter)
      .eq('status', 'realizada'),
    supabase
      .from('agreements')
      .select('id', { count: 'exact', head: true })
      .eq('responsible_id', user.id)
      .eq('status', 'cumplido'),
  ])

  const profile = rawProfile as { full_name: string } | null
  const upcoming = (rawUpcoming ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; location: string | null;
    meet_link: string | null; status: string; leader_id: string; collaborator_id: string
  }>
  const pendingMeetings = ((rawPending ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; location: string | null; status: string;
    leader_id: string; collaborator_id: string; vobos: Array<{ user_id: string; confirmed: boolean }> | null
  }>).filter(m => !(m.vobos ?? []).some(v => v.user_id === user.id))
  const pendingAgreements = (rawAgreements ?? []) as Array<{ id: string; description: string; status: string; due_date: string | null }>

  // Una sola query de users para upcoming + pending combinados (en vez de 2 queries condicionales secuenciales)
  const allOtherIds = Array.from(new Set([
    ...upcoming.map(m => m.leader_id === user.id ? m.collaborator_id : m.leader_id),
    ...pendingMeetings.map(m => m.leader_id === user.id ? m.collaborator_id : m.leader_id),
  ]))
  let userMap: Record<string, string> = {}
  if (allOtherIds.length > 0) {
    const { data: others } = await supabase.from('users').select('id, full_name').in('id', allOtherIds)
    userMap = Object.fromEntries((others ?? []).map(u => [u.id, (u as { full_name: string }).full_name]))
  }
  const otherPartyName = (m: { leader_id: string; collaborator_id: string }) => {
    const otherId = m.leader_id === user.id ? m.collaborator_id : m.leader_id
    return userMap[otherId] ?? 'tu contraparte'
  }

  const firstName = profile?.full_name.split(' ')[0] ?? 'equipo'
  const today = new Date()
  const isOverdue = (dueIso: string | null) => dueIso ? new Date(dueIso) < today : false

  function formatDueDate(due: string) {
    const d = new Date(due)
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      {/* Page head */}
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Hola, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Resumen de tus próximas 1:1s y los compromisos que tienes abiertos.
          </p>
        </div>
        <Button asChild>
          <Link href="/colaborador/1to1/nueva">
            <Plus className="size-3.5" /> Agendar 1:1
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6 anim-stagger">
        <Kpi
          label="Próximas 1:1s"
          value={upcoming.length}
          icon={Calendar}
          hint="agendadas"
          empty={upcoming.length === 0}
        />
        <Kpi
          label="Acuerdos cumplidos"
          value={completedAgreements ?? 0}
          icon={CheckSquare}
          hint="en total"
          empty={(completedAgreements ?? 0) === 0}
        />
        <Kpi
          label="1:1s realizadas"
          value={realizedCount ?? 0}
          icon={Sparkles}
          hint="tu historial"
          empty={(realizedCount ?? 0) === 0}
        />
      </div>

      {/* Pendientes de confirmar — solo si hay */}
      {pendingMeetings.length > 0 && (
        <Card className="mb-6 border-l-2 border-l-warning anim-fade-in-up">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center size-8 rounded-md bg-warning-muted text-warning shrink-0">
                <Clock className="size-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle>Pendientes de confirmar</CardTitle>
                  <Badge variant="warning" className="text-[10.5px]">
                    <AlertCircle className="size-3" /> Acción pendiente
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  {pendingMeetings.length === 1
                    ? '1 reunión ya pasó. Confirma si se realizó para mantener el registro transparente.'
                    : `${pendingMeetings.length} reuniones ya pasaron. Confirma si se realizaron para mantener el registro transparente.`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="divide-y">
            {pendingMeetings.map(m => {
              const d = new Date(m.scheduled_at)
              const day = d.getDate().toString().padStart(2, '0')
              const month = MONTHS[d.getMonth()]
              const time = d.toTimeString().slice(0, 5)
              const otherId = m.leader_id === user.id ? m.collaborator_id : m.leader_id
              const otherName = userMap[otherId] ?? 'tu contraparte'
              const partnerVobo = (m.vobos ?? []).find(v => v.user_id !== user.id)
              const detailHref = m.leader_id === user.id ? `/lider/1to1/${m.id}` : `/colaborador/1to1/${m.id}`
              return (
                <div key={m.id} className="grid grid-cols-[80px_1fr_auto] gap-4 items-center px-6 py-3.5">
                  <DateChip day={day} month={month} time={time} />
                  <div>
                    <div className="text-sm font-medium tracking-tight">1:1 con {otherName}</div>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-muted-foreground">
                      <ModalityChip modality={m.modality} location={m.location} />
                      {partnerVobo !== undefined && (
                        <Badge variant={partnerVobo.confirmed ? 'success' : 'destructive'} className="text-[10.5px]">
                          {otherName.split(' ')[0]} {partnerVobo.confirmed ? 'confirmó' : 'indicó no'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="brand">
                    <Link href={detailHref}>Confirmar <ArrowRight className="size-3" /></Link>
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Próximas reuniones + Acuerdos pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" /> Próximas reuniones
            </CardTitle>
            <CardDescription>
              {upcoming.length === 0 ? 'Sin reuniones próximas' : `${upcoming.length} agendada${upcoming.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <div>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="Sin reuniones próximas"
                description="Agenda tu próxima 1:1 con tu líder para mantener el ritmo."
                action={
                  <Button asChild size="sm" variant="brand">
                    <Link href="/colaborador/1to1/nueva"><Plus className="size-3.5" /> Agendar 1:1</Link>
                  </Button>
                }
              />
            ) : (
              <div className="divide-y">
                {upcoming.map(m => {
                  const d = new Date(m.scheduled_at)
                  const day = d.getDate().toString().padStart(2, '0')
                  const month = MONTHS[d.getMonth()]
                  const time = d.toTimeString().slice(0, 5)
                  return (
                    <div key={m.id} className="grid grid-cols-[80px_1fr_auto] gap-4 items-center px-6 py-3.5">
                      <DateChip day={day} month={month} time={time} />
                      <div>
                        <div className="text-sm font-medium tracking-tight">1:1 con {otherPartyName(m)}</div>
                        <div className="flex items-center gap-3 mt-1 text-[12px] text-muted-foreground">
                          <ModalityChip modality={m.modality} location={m.location} />
                          <Badge variant="muted" className="text-[10.5px]">{STATUS_LABELS[m.status]}</Badge>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/colaborador/1to1/${m.id}`}>Ver <ArrowRight className="size-3" /></Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="size-4 text-muted-foreground" /> Acuerdos pendientes
              </CardTitle>
              <CardDescription>Compromisos que tienes abiertos</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/colaborador/acuerdos">Ver todos <ArrowRight className="size-3" /></Link>
            </Button>
          </CardHeader>
          <div>
            {pendingAgreements.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="Estás al día"
                description="No tienes acuerdos pendientes."
              />
            ) : (
              <div className="divide-y">
                {pendingAgreements.map(a => {
                  const overdue = isOverdue(a.due_date)
                  return (
                    <div key={a.id} className="px-6 py-3.5">
                      <div className="text-[13.5px] leading-relaxed">{a.description}</div>
                      <div className="flex items-center gap-2.5 mt-2">
                        <Badge variant={overdue ? 'destructive' : 'warning'} className="text-[10.5px]">
                          {overdue ? 'Vencido' : AGREEMENT_LABELS[a.status]}
                        </Badge>
                        {a.due_date && (
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[11.5px]',
                            overdue ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            <Calendar className="size-3" /> Vence {formatDueDate(a.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Sub-components colocados en el archivo (no se reutilizan fuera).
// ----------------------------------------------------------------

function Kpi({
  label, value, icon: Icon, hint, empty,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  hint: string
  empty: boolean
}) {
  return (
    <Card className="px-5 py-4 flex flex-col gap-1.5 relative">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className={cn(
          'inline-flex items-center justify-center size-7 rounded-md',
          empty ? 'bg-secondary text-muted-foreground' : 'bg-secondary text-foreground'
        )}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn(
        'font-mono-numeric text-[28px] font-medium leading-none mt-1 tracking-tight',
        empty ? 'text-muted-foreground/70' : 'text-foreground'
      )}>
        {empty ? '—' : formatCount(value)}
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</div>
    </Card>
  )
}

function DateChip({ day, month, time }: { day: string; month: string; time: string }) {
  return (
    <div className="text-center border-r pr-3 leading-tight">
      <div className="text-[22px] font-medium tracking-tight font-mono-numeric leading-none">{day}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1 font-medium">{month}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono-numeric">{time}</div>
    </div>
  )
}

function ModalityChip({ modality, location }: { modality: string; location: string | null }) {
  if (modality === 'virtual') {
    return <span className="inline-flex items-center gap-1"><Video className="size-3" /> Virtual</span>
  }
  return <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {location ?? 'Presencial'}</span>
}
