import { redirect } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrgSetting } from '@/lib/org-settings'
import { AgreementQualityTuner } from '@/components/arquitectura-humana/agreement-quality-tuner'
import { WarmthQuestionsEditor } from '@/components/arquitectura-humana/warmth-questions-editor'
import { AIFeaturesConfig } from '@/components/arquitectura-humana/ai-features-config'
import { TransferBannerToggle } from '@/components/arquitectura-humana/transfer-banner-toggle'

export default async function ParametrosPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    threshold,
    maxOpen,
    nonRealizationMaxDays,
    warmthRequired,
    warmthQuestions,
    aiFeatures,
    aiModel,
    aiBudget,
    transferBannerEnabled,
  ] = await Promise.all([
    getOrgSetting('agreement_quality_threshold'),
    getOrgSetting('collaborator_max_open_agreements'),
    getOrgSetting('non_realization_max_days'),
    getOrgSetting('warmth_survey_required'),
    getOrgSetting('warmth_questions'),
    getOrgSetting('ai_features'),
    getOrgSetting('ai_model'),
    getOrgSetting('ai_monthly_budget_usd'),
    getOrgSetting('transfer_banner_enabled'),
  ])

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow">
            <SlidersHorizontal size={12} /> Configuración tuneable
          </span>
          <h1 className="page__title">Parámetros</h1>
          <p className="page__subtitle">
            Umbrales, encuestas, IA y comportamiento por defecto del sistema.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AgreementQualityTuner
          initialThreshold={threshold}
          initialMaxOpen={maxOpen}
          initialNonRealizationMaxDays={nonRealizationMaxDays}
        />
        <WarmthQuestionsEditor
          initialRequired={warmthRequired}
          initialQuestions={warmthQuestions}
        />
        <AIFeaturesConfig
          initialFeatures={aiFeatures}
          initialModel={aiModel}
          initialBudget={aiBudget}
        />
        <TransferBannerToggle initialEnabled={transferBannerEnabled} />
      </div>
    </div>
  )
}
