'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/hooks/use-toast'
import { saveOrgSetting } from '@/lib/actions/org-settings'
import { ParamsSection } from './params-section'

type AIFeatures = {
  extract_agreements: boolean
  suggest_questions: boolean
  analyze_patterns: boolean
  refine_agreement: boolean
}

type AIModel = 'claude-sonnet-4-5' | 'claude-haiku-4-5-20251001'

interface AIFeaturesConfigProps {
  initialFeatures: AIFeatures
  initialModel: AIModel
  initialBudget: number
}

const FEATURE_LABELS: Record<keyof AIFeatures, string> = {
  extract_agreements: 'Extraer acuerdos automáticamente de las minutas',
  suggest_questions: 'Sugerir preguntas para preparar la 1:1',
  analyze_patterns: 'Detectar patrones y generar reportes',
  refine_agreement: 'Refinar acuerdos y plan de seguimiento',
}

export function AIFeaturesConfig({
  initialFeatures,
  initialModel,
  initialBudget,
}: AIFeaturesConfigProps) {
  const [features, setFeatures] = useState<AIFeatures>(initialFeatures)
  const [model, setModel] = useState<AIModel>(initialModel)
  const [budget, setBudget] = useState(initialBudget)
  const [savedFeatures, setSavedFeatures] = useState<AIFeatures>(initialFeatures)
  const [savedModel, setSavedModel] = useState<AIModel>(initialModel)
  const [savedBudget, setSavedBudget] = useState(initialBudget)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty =
    JSON.stringify(features) !== JSON.stringify(savedFeatures) ||
    model !== savedModel ||
    budget !== savedBudget

  function toggle(key: keyof AIFeatures) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function onSave() {
    startTransition(async () => {
      const tasks: Array<Promise<{ success: boolean; error?: string }>> = []
      if (JSON.stringify(features) !== JSON.stringify(savedFeatures)) {
        tasks.push(saveOrgSetting('ai_features', features))
      }
      if (model !== savedModel) {
        tasks.push(saveOrgSetting('ai_model', model))
      }
      if (budget !== savedBudget) {
        tasks.push(saveOrgSetting('ai_monthly_budget_usd', budget))
      }
      const results = await Promise.all(tasks)
      const failed = results.find((r) => !r.success)
      if (failed) {
        toast({
          title: 'No se pudo guardar',
          description: failed.error,
          variant: 'destructive',
        })
        return
      }
      setSavedFeatures(features)
      setSavedModel(model)
      setSavedBudget(budget)
      toast({ title: 'Configuración de IA actualizada' })
    })
  }

  return (
    <ParamsSection
      title="Inteligencia artificial"
      desc="Activá funciones de IA, modelo y presupuesto mensual."
      dirty={dirty}
      isPending={isPending}
      onSave={onSave}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(Object.keys(FEATURE_LABELS) as Array<keyof AIFeatures>).map((key) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 13.5,
              }}
            >
              <input
                type="checkbox"
                checked={features[key]}
                onChange={() => toggle(key)}
              />
              <span>{FEATURE_LABELS[key]}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="ui-label" htmlFor="ai-model">
            Modelo
          </label>
          <select
            id="ai-model"
            className="ui-input"
            style={{ width: 280 }}
            value={model}
            onChange={(e) => setModel(e.target.value as AIModel)}
          >
            <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (más capaz)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (más rápido y barato)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="ui-label" htmlFor="ai-budget">
            Presupuesto mensual estimado (USD)
          </label>
          <input
            id="ai-budget"
            type="number"
            min={0}
            step={5}
            className="ui-input"
            style={{ width: 160 }}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </div>
      </div>
    </ParamsSection>
  )
}
