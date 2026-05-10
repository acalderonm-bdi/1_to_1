import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, Check, X, ArrowRight, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { InitialsAvatar } from '@/components/shared/initials-avatar'

interface Participant { id: string; full_name: string; email: string }
interface DisputeRow {
  id: string; scheduled_at: string; modality: string
  leader: Participant | Participant[] | null
  collaborator: Participant | Participant[] | null
  vobos: Array<{ user_id: string; confirmed: boolean }> | null
}

export default async function DisputasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, modality,
      leader:users!one_on_ones_leader_id_fkey(id, full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(id, full_name, email),
      vobos(user_id, confirmed)
    `)
    .eq('status', 'en_disputa')
    .order('scheduled_at', { ascending: false })

  const disputes = (raw ?? []) as DisputeRow[]

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Disputas</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
          1:1s con VoBos contradictorios donde líder y colaborador no concuerdan sobre si la reunión se realizó.
        </p>
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Check}
              title="Sin disputas activas"
              description="Todas las 1:1s tienen VoBos consistentes entre líder y colaborador."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3.5 anim-stagger">
          {disputes.map(d => {
            const leader = Array.isArray(d.leader) ? d.leader[0] : d.leader
            const collab = Array.isArray(d.collaborator) ? d.collaborator[0] : d.collaborator
            const vobos = d.vobos ?? []
            const leaderVobo = vobos.find(v => v.user_id === leader?.id)
            const collabVobo = vobos.find(v => v.user_id === collab?.id)
            return (
              <Card key={d.id} className="border-l-2 border-l-warning">
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex items-center justify-center size-8 rounded-md bg-warning-muted text-warning shrink-0">
                      <AlertTriangle className="size-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="warning">En disputa</Badge>
                      </div>
                      <h3 className="text-[15.5px] font-medium tracking-tight inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        {new Date(d.scheduled_at).toLocaleDateString('es-MX', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })}
                      </h3>
                    </div>
                  </div>
                  <Button asChild variant="brand" size="sm">
                    <Link href={`/lider/1to1/${d.id}`}>Resolver disputa <ArrowRight className="size-3" /></Link>
                  </Button>
                </div>
                <CardContent className="grid grid-cols-2 gap-6">
                  <ParticipantBlock role="Líder" name={leader?.full_name} email={leader?.email} vobo={leaderVobo} />
                  <ParticipantBlock role="Colaborador" name={collab?.full_name} email={collab?.email} vobo={collabVobo} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ParticipantBlock({
  role, name, email, vobo,
}: { role: string; name?: string; email?: string; vobo?: { confirmed: boolean } }) {
  return (
    <div className="flex items-start gap-3">
      <InitialsAvatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium mb-0.5">{role}</div>
        <div className="text-[13.5px] font-medium truncate">{name ?? '—'}</div>
        <div className="text-[12px] text-muted-foreground truncate mb-2">{email ?? ''}</div>
        {vobo === undefined ? (
          <Badge variant="muted">Sin VoBo</Badge>
        ) : vobo.confirmed ? (
          <Badge variant="success"><Check className="size-3" /> Confirmó realizada</Badge>
        ) : (
          <Badge variant="destructive"><X className="size-3" /> Indicó no realizada</Badge>
        )}
      </div>
    </div>
  )
}
