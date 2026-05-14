'use client'

import { useState, useTransition } from 'react'

import { Calendar, Play, Plus, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  deleteScheduledReport,
  runReportNow,
  toggleScheduledReport,
} from '@/lib/actions/scheduled-reports'
import type { ScheduledReportRow } from '@/types/domain'

import {
  ScheduledReportModal,
  labelForReportType,
} from './scheduled-report-modal'

interface ScheduledReportsClientProps {
  initialReports: ScheduledReportRow[]
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ScheduledReportsClient({
  initialReports,
}: ScheduledReportsClientProps) {
  const [reports, setReports] = useState<ScheduledReportRow[]>(initialReports)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleCreated(saved: ScheduledReportRow) {
    setReports((prev) => [saved, ...prev])
  }

  function handleToggle(report: ScheduledReportRow, enabled: boolean) {
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, enabled } : r)),
    )
    startTransition(async () => {
      const r = await toggleScheduledReport(report.id, enabled)
      if (!r.success) {
        toast({
          title: 'No se pudo actualizar',
          description: r.error,
          variant: 'destructive',
        })
        setReports((prev) =>
          prev.map((x) => (x.id === report.id ? { ...x, enabled: !enabled } : x)),
        )
      }
    })
  }

  function handleRun(report: ScheduledReportRow) {
    startTransition(async () => {
      const r = await runReportNow(report.id)
      if (!r.success) {
        toast({
          title: 'No se pudo enviar',
          description: r.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Reporte enviado',
        description: `${r.data?.dispatched ?? 0} dispatch(es) registrados`,
      })
      // Actualizamos el último envío localmente — el server ya recalculó next_run_at.
      setReports((prev) =>
        prev.map((x) =>
          x.id === report.id
            ? { ...x, last_run_at: new Date().toISOString() }
            : x,
        ),
      )
    })
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    startTransition(async () => {
      const r = await deleteScheduledReport(id)
      if (!r.success) {
        toast({
          title: 'No se pudo eliminar',
          description: r.error,
          variant: 'destructive',
        })
        return
      }
      setReports((prev) => prev.filter((x) => x.id !== id))
      setPendingDeleteId(null)
      toast({ title: 'Reporte eliminado' })
    })
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={14} /> Nuevo reporte programado
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="ui-card">
          <EmptyState
            illustration="list"
            title="Sin reportes programados"
            description="Creá tu primer reporte recurrente para que llegue al correo del equipo cada semana o cada mes."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {reports.map((report) => (
            <div key={report.id} className="ui-card">
              <div className="ui-card__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar
                    size={15}
                    style={{
                      color: report.enabled ? 'var(--text-c)' : 'var(--text-muted)',
                    }}
                  />
                  <div>
                    <h3
                      className="ui-card__title"
                      style={{ opacity: report.enabled ? 1 : 0.7 }}
                    >
                      {report.name}
                    </h3>
                    <p className="ui-card__desc">
                      {labelForReportType(report.report_type)}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={report.enabled}
                  onCheckedChange={(v) => handleToggle(report, v)}
                  disabled={isPending}
                />
              </div>
              <div className="ui-card__body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-c)' }}>Cron:</strong>{' '}
                    <code style={{ fontSize: 11 }}>{report.schedule_cron}</code>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-c)' }}>Próximo:</strong>{' '}
                    {formatRelative(report.next_run_at)}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-c)' }}>Último:</strong>{' '}
                    {formatRelative(report.last_run_at)}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-c)' }}>Recipients:</strong>{' '}
                    {report.recipients.length}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 12,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Para:
                  </span>
                  {report.recipients.slice(0, 4).map((r) => (
                    <span
                      key={r}
                      className="ui-badge ui-badge--neutral"
                      style={{ fontSize: 11 }}
                    >
                      {r}
                    </span>
                  ))}
                  {report.recipients.length > 4 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      +{report.recipients.length - 4}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => handleRun(report)}
                    disabled={isPending}
                  >
                    <Play size={12} /> Enviar ahora
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => setPendingDeleteId(report.id)}
                    disabled={isPending}
                    style={{ color: 'var(--destructive, #c0392b)' }}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScheduledReportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={handleCreated}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(v) => !v && setPendingDeleteId(null)}
        title="Eliminar reporte programado"
        description="Esta acción no se puede deshacer. Los envíos pasados se conservan en el historial de dispatches."
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}
