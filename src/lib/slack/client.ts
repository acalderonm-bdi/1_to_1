import { WebClient } from '@slack/web-api'

let _client: WebClient | null = null

export function getSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null
  if (!_client) {
    _client = new WebClient(process.env.SLACK_BOT_TOKEN)
  }
  return _client
}
