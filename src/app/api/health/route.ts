/**
 * Health check endpoint para monitoreo externo (uptime robots, status pages, Vercel).
 *
 * Verifica:
 *   - Database (Supabase): SELECT 1 con latencia
 *   - Slack: auth.test() si SLACK_BOT_TOKEN está; si no, skipped
 *   - Email: presencia de RESEND_API_KEY + EMAIL_FROM (no llama API); si falta, skipped
 *
 * Reglas:
 *   - Público (sin auth) — solo expone estados, NO PII
 *   - Cada check con timeout de 5s
 *   - Cache-Control: no-store
 *   - 200 si ok=true, 503 si ok=false
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSlackClient } from '@/lib/slack/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CHECK_TIMEOUT_MS = 5_000

type OkCheck = { ok: true; latency_ms?: number; skipped?: false }
type SkippedCheck = { ok: false; skipped: true; reason: string }
type FailedCheck = { ok: false; skipped?: false; error: string; latency_ms?: number }
type CheckResult = OkCheck | SkippedCheck | FailedCheck

type HealthResponse = {
  ok: boolean
  checks: {
    database: CheckResult
    slack: CheckResult
    email: CheckResult
  }
  timestamp: string
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timeout after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return 'unknown_error'
}

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now()
  try {
    const admin = createAdminClient()
    // SELECT 1 equivalente: head:true + count exact en una tabla liviana.
    // No exponemos datos, solo confirmamos que la DB responde.
    const { error } = await withTimeout<{ error: { message: string } | null }>(
      admin.from('users').select('id', { head: true, count: 'exact' }).limit(1),
      CHECK_TIMEOUT_MS
    )
    const latency_ms = Date.now() - started
    if (error) {
      return { ok: false, error: error.message, latency_ms }
    }
    return { ok: true, latency_ms, skipped: false }
  } catch (e) {
    return {
      ok: false,
      error: errMessage(e),
      latency_ms: Date.now() - started,
    }
  }
}

async function checkSlack(): Promise<CheckResult> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, skipped: true, reason: 'no_token' }
  }
  const client = getSlackClient()
  if (!client) {
    return { ok: false, skipped: true, reason: 'no_token' }
  }
  const started = Date.now()
  try {
    const res = await withTimeout(client.auth.test(), CHECK_TIMEOUT_MS)
    const latency_ms = Date.now() - started
    if (!res.ok) {
      return { ok: false, error: 'auth_test_not_ok', latency_ms }
    }
    return { ok: true, latency_ms, skipped: false }
  } catch (e) {
    return {
      ok: false,
      error: errMessage(e),
      latency_ms: Date.now() - started,
    }
  }
}

async function checkEmail(): Promise<CheckResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, skipped: true, reason: 'no_token' }
  }
  if (!process.env.EMAIL_FROM) {
    return { ok: false, skipped: true, reason: 'no_token' }
  }
  // Resend no expone un health-check barato; solo validamos config presente.
  return { ok: true, skipped: false }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const [database, slack, email] = await Promise.all([
    checkDatabase(),
    checkSlack(),
    checkEmail(),
  ])

  // Un check "skipped" no cuenta como falla del sistema (config ausente intencional).
  // Solo cuenta como falla cuando ok=false y skipped !== true.
  const isFailure = (c: CheckResult): boolean =>
    c.ok === false && !('skipped' in c && c.skipped === true)

  const ok = !isFailure(database) && !isFailure(slack) && !isFailure(email)

  const body: HealthResponse = {
    ok,
    checks: { database, slack, email },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
