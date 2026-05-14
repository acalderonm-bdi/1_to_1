'use client'

import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  createScheduledReport,
  type ScheduledReportInput,
} from '@/lib/actions/scheduled-reports'
import type { ScheduledReportRow, ScheduledReportType } from '@/types/domain'

export const REPORT_TYPE_OPTIONS: Array<{
  value: ScheduledReportType
  label: string
  description: string
}> = [
  {
    value: 'cumplimiento_mensual',
    label: 'Cumplimiento mensual',
    description: 'CSV con ratio de 1:1s realizadas vs agendadas por departamento.',
  },
  {
    value: 'acuerdos_baja_calidad',
    label: 'Acuerdos (todos)',
    description: 'CSV completo de acuerdos con responsable, líder, due date y score IA.',
  },
  {
    value: 'calidez_por_lider',
    label: 'Calidez por líder',
    description: 'CSV con promedios de calidez agregados por líder.',
  },
]

const CRON_PRESETS: Array<{ value: string; label: string }> = [
  { value: '0 9 1 * *', label: 'Mensual — día 1, 9:00' },
  { value: '0 9 * * 1', label: 'Semanal — lunes, 9:00' },
  { value: '0 9 * * 1-5', label: 'Días hábiles, 9:00' },
  { value: '0 9 * * *', label: 'Diario, 9:00' },
  { value: 'custom', label: 'Custom (cron expression)' },
]

interface ScheduledReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (report: ScheduledReportRow) => void
}

export function ScheduledReportModal({
  open,
  onOpenChange,
  onCreated,
}: ScheduledReportModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [reportType, setReportType] = useState<ScheduledReportType>(
    'cumplimiento_mensual',
  )
  const [cronPreset, setCronPreset] = useState<string>('0 9 1 * *')
  const [cronCustom, setCronCustom] = useState<string>('')
  const [recipientsRaw, setRecipientsRaw] = useState<string>('')

  useEffect(() => {
    if (!open) return
    // Reset on open.
    setName('')
    setReportType('cumplimiento_mensual')
    setCronPreset('0 9 1 * *')
    setCronCustom('')
    setRecipientsRaw('')
  }, [open])

  function parseRecipients(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }

    const scheduleCron =
      cronPreset === 'custom' ? cronCustom.trim() : cronPreset
    if (!scheduleCron) {
      toast({ title: 'Cron expression requerida', variant: 'destructive' })
      return
    }

    const recipients = parseRecipients(recipientsRaw)
    if (recipients.length === 0) {
      toast({ title: 'Agregá al menos un destinatario', variant: 'destructive' })
      return
    }

    // Validación básica de email en cliente (zod hace la final en server).
    const invalidEmail = recipients.find((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
    if (invalidEmail) {
      toast({
        title: 'Email inválido',
        description: invalidEmail,
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    const payload: ScheduledReportInput = {
      name: name.trim(),
      reportType,
      scheduleCron,
      recipients,
    }

    try {
      const r = await createScheduledReport(payload)
      if (!r.success || !r.data) {
        toast({
          title: 'No se pudo crear',
          description: r.error,
          variant: 'destructive',
        })
        return
      }

      const created: ScheduledReportRow = {
        id: r.data.id,
        name: payload.name,
        enabled: true,
        report_type: payload.reportType,
        schedule_cron: payload.scheduleCron,
        recipients: payload.recipients,
        format: 'csv',
        filters: null,
        last_run_at: null,
        next_run_at: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      onCreated(created)
      toast({ title: 'Reporte programado' })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTypeDesc = REPORT_TYPE_OPTIONS.find((t) => t.value === reportType)
    ?.description

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo reporte programado</DialogTitle>
          <DialogDescription>
            Configurá qué CSV se envía, con qué frecuencia y a quiénes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sr-name" className="ui-label">
              Nombre
            </Label>
            <input
              id="sr-name"
              type="text"
              className="ui-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Ej: Cumplimiento mensual ejecutivo"
              style={{ width: '100%' }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-type" className="ui-label">
              Tipo
            </Label>
            <Select
              value={reportType}
              onValueChange={(v) => setReportType(v as ScheduledReportType)}
            >
              <SelectTrigger id="sr-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeDesc && (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                {selectedTypeDesc}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-cron" className="ui-label">
              Frecuencia
            </Label>
            <Select value={cronPreset} onValueChange={setCronPreset}>
              <SelectTrigger id="sr-cron">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cronPreset === 'custom' && (
              <input
                type="text"
                className="ui-input"
                value={cronCustom}
                onChange={(e) => setCronCustom(e.target.value)}
                placeholder="0 9 * * 1"
                style={{ width: '100%', marginTop: 6, fontFamily: 'var(--font-mono, monospace)' }}
              />
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Hora UTC. Los presets son referencia — el cron corre cada hora y
              dispara los reports cuyo `next_run_at` ya pasó.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-recipients" className="ui-label">
              Destinatarios
            </Label>
            <textarea
              id="sr-recipients"
              className="ui-input"
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder="ariel@b-drive.com.mx, otra@empresa.com"
              rows={3}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Separar con comas, espacios o saltos de línea. Solo emails de
              usuarios registrados reciben dispatch.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Guardando…' : 'Programar reporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function labelForReportType(t: ScheduledReportType): string {
  return REPORT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t
}
