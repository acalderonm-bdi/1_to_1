import { redirect } from 'next/navigation'
import { Calendar, Download } from 'lucide-react'

import { ExportCard } from '@/components/arquitectura-humana/export-card'
import { ScheduledReportsClient } from '@/components/arquitectura-humana/scheduled-report-list'
import { createClient } from '@/lib/supabase/server'
import type { ScheduledReportRow } from '@/types/domain'

export default async function ExportesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scheduledResult = (await supabase
    .from('scheduled_reports' as never)
    .select('*')
    .order('created_at', { ascending: false })) as unknown as {
    data: ScheduledReportRow[] | null
  }
  const scheduledReports = scheduledResult.data ?? []

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow">
            <Download size={12} /> Reportería
          </span>
          <h1 className="page__title">Exportes</h1>
          <p className="page__subtitle">
            Bajadas ad-hoc en CSV + reportes programados al correo.
          </p>
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 12,
          }}
        >
          Descargas inmediatas
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          <ExportCard
            title="Cumplimiento"
            description="Por departamento, ratio de 1:1s realizadas vs agendadas + acuerdos cumplidos."
            href="/api/exports/cumplimiento"
          />
          <ExportCard
            title="Acuerdos"
            description="Todos los acuerdos con responsable, líder, due date, status y score IA."
            href="/api/exports/acuerdos"
          />
          <ExportCard
            title="Calidez"
            description="Métricas de calidez agregadas por líder."
            href="/api/exports/calidez"
          />
        </div>
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: 0,
            }}
          >
            Reportes programados
          </h2>
        </div>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            marginBottom: 14,
          }}
        >
          Envío recurrente al correo. El cron corre cada hora y dispara los
          reports cuyo próximo turno ya pasó.
        </p>
        <ScheduledReportsClient initialReports={scheduledReports} />
      </section>
    </div>
  )
}
