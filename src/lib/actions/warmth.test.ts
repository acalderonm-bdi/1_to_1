/**
 * Tests unitarios para `src/lib/actions/warmth.ts`.
 *
 * Cubrimos `submitWarmthResponse`:
 *  - happy path: colaborador de la 1:1 envía encuesta correctamente
 *  - rechazo por no autenticación
 *  - rechazo si el usuario no es el colaborador de esa 1:1
 *  - validación de rango (1-5) para las 5 métricas
 *  - protección contra doble envío (unique constraint simulado)
 *  - 1:1 inexistente
 *
 * Estrategia: mock total de `@/lib/supabase/server` con `vi.mock`. El cliente
 * Supabase devuelve respuestas configurables por tabla. No se toca DB real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { submitWarmthResponse } from './warmth'

// ---------------------------------------------------------------------------
// IDs fijos para mantener tests legibles
// ---------------------------------------------------------------------------
const OO_ID    = '00000000-0000-0000-0000-000000001101'
const COLAB_ID = '00000000-0000-0000-0000-000000001102'
const LEADER_ID = '00000000-0000-0000-0000-000000001103'
const OTHER_ID  = '00000000-0000-0000-0000-000000001199'

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------
type WarmthMockOpts = {
  user?: { id: string } | null
  /** meeting devuelto por `one_on_ones.select.eq.single` */
  meeting?: { collaborator_id: string } | null
  /** Error simulado en el INSERT de warmth response */
  insertError?: { message: string } | null
  /** Id del registro insertado */
  insertedId?: string
}

function mockWarmth(opts: WarmthMockOpts) {
  const insertedId = opts.insertedId ?? 'warmth-resp-id'

  const spies = {
    warmthInsert: vi.fn().mockReturnThis(),
    auditLogsInsert: vi.fn().mockResolvedValue({ error: null }),
  }

  // chain para meeting_warmth_responses.insert().select('id').single()
  const warmthChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.insertError ? null : { id: insertedId },
      error: opts.insertError ?? null,
    }),
  }
  spies.warmthInsert.mockReturnValue(warmthChain)

  const chain = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'one_on_ones') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.meeting !== undefined ? opts.meeting : null,
            error: opts.meeting === null ? { message: 'not found' } : null,
          }),
        }
      }
      if (table === 'meeting_warmth_responses') {
        return {
          insert: spies.warmthInsert,
        }
      }
      if (table === 'audit_logs') {
        return {
          insert: spies.auditLogsInsert,
        }
      }
      throw new Error(`mockWarmth: tabla no soportada: ${table}`)
    }),
  }
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return { chain, spies }
}

// ---------------------------------------------------------------------------
// Input base válido
// ---------------------------------------------------------------------------
const BASE_INPUT = {
  oneOnOneId:          OO_ID,
  feltHeard:           4,
  comfortableSharing:  4,
  leaderEngaged:       5,
  conversationQuality: 4,
  clarityAfterSession: 3,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('submitWarmthResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza usuario no autenticado', async () => {
    mockWarmth({ user: null })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('rechaza si el oneOnOneId no es UUID válido', async () => {
    mockWarmth({ user: { id: COLAB_ID } })
    const result = await submitWarmthResponse({ ...BASE_INPUT, oneOnOneId: 'no-es-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('rechaza feltHeard = 0 (fuera de rango 1-5)', async () => {
    mockWarmth({ user: { id: COLAB_ID }, meeting: { collaborator_id: COLAB_ID } })
    const result = await submitWarmthResponse({ ...BASE_INPUT, feltHeard: 0 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('rechaza feltHeard = 6 (fuera de rango 1-5)', async () => {
    mockWarmth({ user: { id: COLAB_ID }, meeting: { collaborator_id: COLAB_ID } })
    const result = await submitWarmthResponse({ ...BASE_INPUT, feltHeard: 6 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('rechaza conversationQuality = 6 (fuera de rango 1-5)', async () => {
    mockWarmth({ user: { id: COLAB_ID }, meeting: { collaborator_id: COLAB_ID } })
    const result = await submitWarmthResponse({ ...BASE_INPUT, conversationQuality: 6 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('retorna error si la reunión no existe', async () => {
    mockWarmth({ user: { id: COLAB_ID }, meeting: null })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reunión no encontrada')
  })

  it('solo el colaborador puede responder — líder recibe error', async () => {
    const { spies } = mockWarmth({
      user: { id: LEADER_ID },
      meeting: { collaborator_id: COLAB_ID },
    })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/colaborador/)
    // No debe haberse insertado nada
    expect(spies.warmthInsert).not.toHaveBeenCalled()
  })

  it('usuario ajeno recibe error (no es líder ni colaborador)', async () => {
    const { spies } = mockWarmth({
      user: { id: OTHER_ID },
      meeting: { collaborator_id: COLAB_ID },
    })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/colaborador/)
    expect(spies.warmthInsert).not.toHaveBeenCalled()
  })

  it('colaborador envía encuesta válida → success:true con id', async () => {
    const { spies } = mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
      insertedId: 'warmth-abc-123',
    })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data?.id).toBe('warmth-abc-123')
    expect(spies.warmthInsert).toHaveBeenCalledTimes(1)
    expect(spies.auditLogsInsert).toHaveBeenCalledTimes(1)
  })

  it('colaborador puede enviar con freeComment opcional', async () => {
    const { spies } = mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
    })
    const result = await submitWarmthResponse({
      ...BASE_INPUT,
      freeComment: 'Muy buena sesión',
    })
    expect(result.success).toBe(true)
    expect(spies.warmthInsert).toHaveBeenCalledTimes(1)
  })

  it('doble envío — error de unique constraint se propaga como failure', async () => {
    // La DB lanza unique constraint violation en el segundo INSERT.
    mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
      insertError: { message: 'duplicate key value violates unique constraint' },
    })
    const result = await submitWarmthResponse(BASE_INPUT)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toMatch(/duplicate key/)
  })

  it('el audit_log se inserta con user_id, action y resource_type correctos', async () => {
    const { spies } = mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
      insertedId: 'w-id-999',
    })
    await submitWarmthResponse(BASE_INPUT)
    const auditCall = spies.auditLogsInsert.mock.calls[0]?.[0] as {
      user_id: string
      action: string
      resource_type: string
      resource_id: string
    }
    expect(auditCall.user_id).toBe(COLAB_ID)
    expect(auditCall.action).toBe('warmth_submitted')
    expect(auditCall.resource_type).toBe('meeting_warmth_response')
    expect(auditCall.resource_id).toBe('w-id-999')
  })

  it('valores mínimos válidos (todas las métricas = 1) son aceptados', async () => {
    mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
    })
    const result = await submitWarmthResponse({
      oneOnOneId:          OO_ID,
      feltHeard:           1,
      comfortableSharing:  1,
      leaderEngaged:       1,
      conversationQuality: 1,
      clarityAfterSession: 1,
    })
    expect(result.success).toBe(true)
  })

  it('valores máximos válidos (todas las métricas = 5) son aceptados', async () => {
    mockWarmth({
      user: { id: COLAB_ID },
      meeting: { collaborator_id: COLAB_ID },
    })
    const result = await submitWarmthResponse({
      oneOnOneId:          OO_ID,
      feltHeard:           5,
      comfortableSharing:  5,
      leaderEngaged:       5,
      conversationQuality: 5,
      clarityAfterSession: 5,
    })
    expect(result.success).toBe(true)
  })
})
