import type { FollowupPlan } from '@/types/domain'
import { getOrgSetting } from '@/lib/org-settings'
import { getAIClient, parseJSONResponse } from './client'
import { generateFollowupPlanPrompt } from './prompts'

interface FollowupPlanInput {
  collaboratorName: string
  meetingDate: string
  agreements: Array<{ description: string; responsible: string; dueDate: string | null }>
}

interface FollowupPlanOutput {
  plan: FollowupPlan | null
  error?: string
}

export async function generateFollowupPlan(
  input: FollowupPlanInput
): Promise<FollowupPlanOutput> {
  if (input.agreements.length === 0) {
    return { plan: null }
  }

  // El plan de follow-up es parte de la familia "refinar acuerdo" (sugerir
  // próximos pasos sobre compromisos vigentes). Si RH desactiva ese feature, no
  // generamos plan.
  const features = await getOrgSetting('ai_features')
  if (!features.refine_agreement) {
    return { plan: null }
  }
  const model = await getOrgSetting('ai_model')

  try {
    const client = getAIClient()
    const prompt = generateFollowupPlanPrompt(input)

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJSONResponse<FollowupPlan>(text)
    return { plan: parsed }
  } catch {
    return { plan: null, error: 'IA no disponible' }
  }
}
