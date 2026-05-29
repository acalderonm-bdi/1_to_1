/**
 * Autorización compartida para los endpoints de cron.
 *
 * Endurece el chequeo previo (comparación directa de string contra
 * `Bearer ${CRON_SECRET}`): rechaza secretos ausentes/placeholder/cortos como
 * misconfig (500) y usa comparación timing-safe para el bearer (401). El admin
 * client de los crons salta RLS, así que un secret débil = cualquiera dispara o
 * suprime las alarmas. Ver docs/runbook-rotation.md.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'

// Valores de ejemplo que NUNCA deben pasar como secret real.
const PLACEHOLDERS = new Set([
  'cambiar-en-produccion-rotar-mensualmente',
  'change-me', 'changeme', 'your-cron-secret', 'secret', 'cron-secret',
])

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/**
 * Devuelve `null` si la petición está autorizada, o una `NextResponse` de error
 * (500 misconfig / 401 no autorizado) que el handler debe retornar tal cual.
 */
export function assertCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16 || PLACEHOLDERS.has(secret.toLowerCase())) {
    return NextResponse.json(
      { error: 'CRON_SECRET ausente, placeholder o demasiado corto' },
      { status: 500 },
    )
  }
  const header = request.headers.get('authorization') ?? ''
  // Hash a longitud fija: evita filtrar longitud y el throw de timingSafeEqual
  // cuando los buffers difieren en tamaño.
  const ok = timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`))
  return ok ? null : NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
