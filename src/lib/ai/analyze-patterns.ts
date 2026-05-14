import type { PatternAnalysis } from '@/types/domain'
import { getOrgSetting } from '@/lib/org-settings'
import { getAIClient, parseJSONResponse } from './client'
import { analyzePatternsPrompt } from './prompts'

interface AnalyzePatternsInput {
  relationshipMonths: number
  totalMeetings: number
  missedMeetings: number
  disputedMeetings: number
  agreements: Array<{ status: string; description: string }>
  recentHistory: string
}

interface AnalyzePatternsOutput {
  analysis: PatternAnalysis | null
  error?: string
}

export async function analyzePatterns(
  input: AnalyzePatternsInput
): Promise<AnalyzePatternsOutput> {
  // Feature flag: análisis de patrones es opt-out por organización.
  const features = await getOrgSetting('ai_features')
  if (!features.analyze_patterns) {
    return { analysis: null }
  }
  const model = await getOrgSetting('ai_model')

  try {
    const client = getAIClient()
    const prompt = analyzePatternsPrompt(input)

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = parseJSONResponse<PatternAnalysis>(text)
    return { analysis: parsed }
  } catch {
    return { analysis: null, error: 'IA no disponible' }
  }
}
