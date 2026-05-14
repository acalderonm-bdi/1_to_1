import type { ExtractedAgreement } from '@/types/domain'
import { getOrgSetting } from '@/lib/org-settings'
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

  // Feature flag: si RH desactivó la extracción automática, devolvemos vacío
  // sin llamar al modelo. El consumer (saveMinute) ya tolera 0 acuerdos.
  const features = await getOrgSetting('ai_features')
  if (!features.extract_agreements) {
    return { agreements: [] }
  }
  const model = await getOrgSetting('ai_model')

  try {
    const client = getAIClient()
    const prompt = extractAgreementsPrompt(input.rawMinute, {
      leader: `${input.leader.name} (${input.leader.email})`,
      collaborator: `${input.collaborator.name} (${input.collaborator.email})`,
    })

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJSONResponse<{ agreements: ExtractedAgreement[] }>(text)
    return { agreements: parsed.agreements ?? [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[extractAgreements] error:', msg)
    return { agreements: [], error: `IA no disponible: ${msg.slice(0, 120)}` }
  }
}
