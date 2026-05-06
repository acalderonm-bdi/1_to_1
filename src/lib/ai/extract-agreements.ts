import type { ExtractedAgreement } from '@/types/domain'
import { getAIClient, parseJSONResponse } from './client'
import { extractAgreementsPrompt } from './prompts'

interface ExtractAgreementsInput {
  rawMinute: string
  leader: { name: string; email: string }
  collaborator: { name: string; email: string }
}

interface ExtractAgreementsOutput {
  agreements: ExtractedAgreement[]
  error?: string
}

export async function extractAgreements(
  input: ExtractAgreementsInput
): Promise<ExtractAgreementsOutput> {
  if (!input.rawMinute.trim()) {
    return { agreements: [] }
  }

  try {
    const client = getAIClient()
    const prompt = extractAgreementsPrompt(input.rawMinute, {
      leader: `${input.leader.name} (${input.leader.email})`,
      collaborator: `${input.collaborator.name} (${input.collaborator.email})`,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJSONResponse<{ agreements: ExtractedAgreement[] }>(text)
    return { agreements: parsed.agreements ?? [] }
  } catch {
    return { agreements: [], error: 'IA no disponible — edita los acuerdos manualmente' }
  }
}
