import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { NotificationRulesClient } from '@/components/arquitectura-humana/notification-rule-card'
import type { NotificationRuleRow } from '@/types/domain'

export default async function NotificacionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rulesResult = await supabase
    .from('notification_rules')
    .select('*')
    .order('created_at', { ascending: false })

  // DB-level types use `string`/`Json` for unioned columns; narrow at the
  // boundary because writes go through zod schemas in `notification-rules.ts`.
  const rules = (rulesResult.data ?? []) as unknown as NotificationRuleRow[]

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Bell size={12} /> Alertas configurables</span>
          <h1 className="page__title">Notificaciones</h1>
          <p className="page__subtitle">
            Reglas automáticas para avisar a líderes, colaboradores y Arquitectura Humana.
          </p>
        </div>
      </div>

      <NotificationRulesClient initialRules={rules} />
    </div>
  )
}
