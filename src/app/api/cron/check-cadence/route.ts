import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyMissedMeeting } from '@/lib/slack/notify'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: globalCadence } = await admin
    .from('cadence_configs')
    .select('frequency_days')
    .eq('scope_type', 'global')
    .maybeSingle()

  const cadenceDays = globalCadence?.frequency_days ?? 14

  const { data: relations } = await admin
    .from('leadership_relations')
    .select(`
      leader_id, collaborator_id,
      leader:users!leadership_relations_leader_id_fkey(full_name, slack_user_id),
      collaborator:users!leadership_relations_collaborator_id_fkey(full_name)
    `)
    .is('ended_at', null)

  let notified = 0

  for (const rel of relations ?? []) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - cadenceDays)

    const { data: lastMeeting } = await admin
      .from('one_on_ones')
      .select('scheduled_at')
      .eq('leader_id', rel.leader_id)
      .eq('collaborator_id', rel.collaborator_id)
      .eq('status', 'realizada')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const isOverdue = !lastMeeting || new Date(lastMeeting.scheduled_at) < cutoff
    if (!isOverdue) continue

    const leader = Array.isArray(rel.leader) ? rel.leader[0] : rel.leader
    const collaborator = Array.isArray(rel.collaborator) ? rel.collaborator[0] : rel.collaborator

    if (leader?.slack_user_id) {
      const daysSince = lastMeeting
        ? Math.floor((Date.now() - new Date(lastMeeting.scheduled_at).getTime()) / (1000 * 60 * 60 * 24))
        : cadenceDays

      await notifyMissedMeeting(
        leader.slack_user_id,
        leader.full_name,
        collaborator?.full_name ?? 'tu colaborador',
        daysSince
      )
      notified++
    }
  }

  return NextResponse.json({ ok: true, notified })
}
