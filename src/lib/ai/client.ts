import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAIClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY no está configurada en el server')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export function parseJSONResponse<T>(text: string): T {
  // Limpia fences de markdown si los hay
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}
