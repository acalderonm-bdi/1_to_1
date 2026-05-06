import type { FollowupPlan } from '@/types/domain'
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

  try {
    const client = getAIClient()
    const prompt = generateFollowupPlanPrompt(input)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
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
