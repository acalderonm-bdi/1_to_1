'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/hooks/use-toast'
import { saveOrgSetting } from '@/lib/actions/org-settings'
import { ParamsSection } from './params-section'

interface AgreementQualityTunerProps {
  initialThreshold: number
  initialMaxOpen: number
  initialNonRealizationMaxDays: number
}

export function AgreementQualityTuner({
  initialThreshold,
  initialMaxOpen,
  initialNonRealizationMaxDays,
}: AgreementQualityTunerProps) {
  const [threshold, setThreshold] = useState(initialThreshold)
  const [maxOpen, setMaxOpen] = useState(initialMaxOpen)
  const [nonRealizationMaxDays, setNonRealizationMaxDays] = useState(initialNonRealizationMaxDays)
  const [savedThreshold, setSavedThreshold] = useState(initialThreshold)
  const [savedMaxOpen, setSavedMaxOpen] = useState(initialMaxOpen)
  const [savedNonRealizationMaxDays, setSavedNonRealizationMaxDays] = useState(
    initialNonRealizationMaxDays,
  )
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty =
    threshold !== savedThreshold ||
    maxOpen !== savedMaxOpen ||
    nonRealizationMaxDays !== savedNonRealizationMaxDays

  function onSave() {
    startTransition(async () => {
      const results = await Promise.all([
        threshold !== savedThreshold
          ? saveOrgSetting('agreement_quality_threshold', threshold)
          : Promise.resolve({ success: true as const }),
        maxOpen !== savedMaxOpen
          ? saveOrgSetting('collaborator_max_open_agreements', maxOpen)
          : Promise.resolve({ success: true as const }),
        nonRealizationMaxDays !== savedNonRealizationMaxDays
          ? saveOrgSetting('non_realization_max_days', nonRealizationMaxDays)
          : Promise.resolve({ success: true as const }),
      ])
      const failed = results.find((r) => !r.success)
      if (failed && !failed.success) {
        toast({
          title: 'No se pudo guardar',
          description: failed.error,
          variant: 'destructive',
        })
        return
      }
      setSavedThreshold(threshold)
      setSavedMaxOpen(maxOpen)
      setSavedNonRealizationMaxDays(nonRealizationMaxDays)
      toast({ title: 'Parámetros de acuerdos actualizados' })
    })
  }

  return (
    <ParamsSection
      title="Calidad de acuerdos"
      desc="Umbrales que disparan revisiones y avisos."
      dirty={dirty}
      isPending={isPending}
      onSave={onSave}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="ui-label" htmlFor="threshold">
            Umbral mínimo de calidad (0 — 5)
          </label>
          <input
            id="threshold"
            type="number"
            min={0}
            max={5}
            step={0.1}
            className="ui-input"
            style={{ width: 120 }}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Acuerdos por debajo de este valor se marcan para revisión.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="ui-label" htmlFor="max-open">
            Máximo de acuerdos abiertos por colaborador
          </label>
          <input
            id="max-open"
            type="number"
            min={1}
            max={50}
            step={1}
            className="ui-input"
            style={{ width: 120 }}
            value={maxOpen}
            onChange={(e) => setMaxOpen(Number(e.target.value))}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Más allá del tope se advierte al líder antes de crear nuevos compromisos.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="ui-label" htmlFor="non-realization">
            Plazo para marcar no-realización (días)
          </label>
          <input
            id="non-realization"
            type="number"
            min={1}
            max={90}
            step={1}
            className="ui-input"
            style={{ width: 120 }}
            value={nonRealizationMaxDays}
            onChange={(e) => setNonRealizationMaxDays(Number(e.target.value))}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Ventana sugerida para clasificar una sesión como no realizada.
          </p>
        </div>
      </div>
    </ParamsSection>
  )
}
