import type { SuggestedQuestion } from '@/types/domain'
import { getOrgSetting } from '@/lib/org-settings'
import { getAIClient, parseJSONResponse } from './client'
import { suggestQuestionsPrompt } from './prompts'

interface SuggestQuestionsInput {
  collaboratorName: string
  recentMeetings: Array<{ date: string; agreements: string[] }>
  pendingAgreements: Array<{ description: string; dueDate: string | null; status: string }>
}

interface SuggestQuestionsOutput {
  questions: SuggestedQuestion[]
  error?: string
}

export async function suggestQuestions(
  input: SuggestQuestionsInput,
): Promise<SuggestQuestionsOutput> {
  // Feature flag: la sugerencia de preguntas previas a la 1:1 es opt-out.
  const features = await getOrgSetting('ai_features')
  if (!features.suggest_questions) {
    return { questions: [] }
  }
  const model = await getOrgSetting('ai_model')

  try {
    const client = getAIClient()
    const prompt = suggestQuestionsPrompt(input)

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJSONResponse<{ questions: SuggestedQuestion[] }>(text)
    return { questions: parsed.questions ?? [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[suggest-questions] error:', msg)
    return { questions: [], error: 'IA no disponible' }
  }
}
