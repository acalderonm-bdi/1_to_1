import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function getAIClient() {
  return client
}

export function parseJSONResponse<T>(text: string): T {
  // Limpia fences de markdown si los hay
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}
