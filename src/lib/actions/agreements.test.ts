/**
 * Tests unitarios para `src/lib/actions/agreements.ts`.
 *
 * Cubrimos:
 *  - happy paths (líder/colab/HR según corresponda)
 *  - rechazos por no autenticación
 *  - el bug RLS silently fails sin pre-validation: si el usuario no es
 *    participante, las acciones deben devolver `success:false` con un mensaje
 *    explícito en lugar de `success:true` engañoso.
 *
 * Estrategia: mockeamos `@/lib/supabase/server` para no requerir DB real.
 * Cada test setupea respuestas para `auth.getUser` y para cada `from(table)`
 * mediante un builder configurable (`mockSupabase`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
// `createAgreement` usa este helper; lo neutralizamos para no traer la
// dependencia de `org-settings` ni del cliente Supabase real.
vi.mock('@/lib/agreement-quality-server', () => ({
  checkAgreementQualityWithConfig: vi.fn().mockResolvedValue({
    score: 4,
    warnings: [],
  }),
}))

import { createClient } from '@/lib/supabase/server'
import {
  updateAgreementStatus,
  deleteAgreement,
  reportAgreementFollowup,
} from './agreements'

type MockOpts = {
  user?: { id: string } | null
  /** `null` para forzar "agreement no existe", undefined para no override */
  agreement?: { one_on_one_id: string } | null
  meeting?: { leader_id: string; collaborator_id: string } | null
  profile?: { role: string } | null
  /** Error simulado en el UPDATE/DELETE/INSERT final */
  finalError?: { message: string } | null
}

/**
 * Construye un mock del cliente Supabase con respuestas configurables por
 * tabla. Devolvemos también las spies de update/delete/insert por tabla para
 * que cada test pueda hacer assertions sobre los payloads.
 */
function mockSupabase(opts: MockOpts) {
  const finalErrorResult = { error: opts.finalError ?? null }

  const spies = {
    agreementsUpdate: vi.fn().mockResolvedValue(finalErrorResult),
    agreementsDelete: vi.fn().mockResolvedValue(finalErrorResult),
    agreementFollowupsInsert: vi.fn().mockResolvedValue(finalErrorResult),
    auditLogsInsert: vi.fn().mockResolvedValue({ error: null }),
  }

  const chain = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: opts.user ?? null }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'agreements') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.agreement === undefined ? null : opts.agreement,
            error: opts.agreement === null ? { message: 'not found' } : null,
          }),
          // update().eq() es la cadena final — devolvemos un thenable
          update: vi.fn(() => ({
            eq: spies.agreementsUpdate,
          })),
          delete: vi.fn(() => ({
            eq: spies.agreementsDelete,
          })),
        }
      }
      if (table === 'one_on_ones') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.meeting === undefined ? null : opts.meeting,
            error: opts.meeting === null ? { message: 'not found' } : null,
          }),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.profile ?? null,
            error: null,
          }),
        }
      }
      if (table === 'agreement_followups') {
        return {
          insert: spies.agreementFollowupsInsert,
        }
      }
      if (table === 'audit_logs') {
        return {
          insert: spies.auditLogsInsert,
        }
      }
      throw new Error(`mockSupabase: tabla no soportada en este test: ${table}`)
    }),
  }
  ;(createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return { chain, spies }
}

const A_ID = '00000000-0000-0000-0000-0000000000a1'
const MEET_ID = '00000000-0000-0000-0000-0000000000b1'
const LEADER_ID = '00000000-0000-0000-0000-0000000000c1'
const COLAB_ID = '00000000-0000-0000-0000-0000000000c2'
const OTHER_ID = '00000000-0000-0000-0000-0000000000c9'
const HR_ID = '00000000-0000-0000-0000-0000000000c8'

describe('updateAgreementStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza usuario no autenticado', async () => {
    mockSupabase({ user: null })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('rechaza input con UUID inválido', async () => {
    mockSupabase({ user: { id: LEADER_ID } })
    const result = await updateAgreementStatus({
      agreementId: 'no-es-uuid',
      status: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('líder participante puede actualizar status', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(true)
    expect(spies.agreementsUpdate).toHaveBeenCalledTimes(1)
  })

  it('colaborador participante puede actualizar status', async () => {
    const { spies } = mockSupabase({
      user: { id: COLAB_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'parcial',
    })
    expect(result.success).toBe(true)
    expect(spies.agreementsUpdate).toHaveBeenCalledTimes(1)
  })

  it('HR no participante puede actualizar (policy lo permite)', async () => {
    const { spies } = mockSupabase({
      user: { id: HR_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
      profile: { role: 'hr' },
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(true)
    expect(spies.agreementsUpdate).toHaveBeenCalledTimes(1)
  })

  it('usuario no participante non-HR recibe error explícito (bug RLS pre-validation)', async () => {
    const { spies } = mockSupabase({
      user: { id: OTHER_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
      profile: { role: 'collaborator' },
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    // El bug clave: sin pre-validation, RLS rechazaba silenciosamente y
    // llegábamos al UPDATE. Ahora cortamos antes — spy debe estar limpia.
    expect(spies.agreementsUpdate).not.toHaveBeenCalled()
  })

  it('agreement inexistente → mismo error de permisos (RLS oculta existencia)', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      agreement: null,
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    expect(spies.agreementsUpdate).not.toHaveBeenCalled()
  })

  it('propaga error de Supabase si el UPDATE final falla', async () => {
    mockSupabase({
      user: { id: LEADER_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
      finalError: { message: 'db boom' },
    })
    const result = await updateAgreementStatus({
      agreementId: A_ID,
      status: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('db boom')
  })
})

describe('deleteAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza usuario no autenticado', async () => {
    mockSupabase({ user: null })
    const result = await deleteAgreement({ agreementId: A_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('líder participante puede borrar', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await deleteAgreement({ agreementId: A_ID })
    expect(result.success).toBe(true)
    expect(spies.agreementsDelete).toHaveBeenCalledTimes(1)
    expect(spies.auditLogsInsert).toHaveBeenCalledTimes(1)
  })

  it('colaborador participante puede borrar', async () => {
    const { spies } = mockSupabase({
      user: { id: COLAB_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await deleteAgreement({ agreementId: A_ID })
    expect(result.success).toBe(true)
    expect(spies.agreementsDelete).toHaveBeenCalledTimes(1)
  })

  it('usuario no participante (incluso HR) recibe error', async () => {
    // `deleteAgreement` NO tiene escape hatch para HR — solo participantes.
    const { spies } = mockSupabase({
      user: { id: HR_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
      profile: { role: 'hr' },
    })
    const result = await deleteAgreement({ agreementId: A_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    expect(spies.agreementsDelete).not.toHaveBeenCalled()
    expect(spies.auditLogsInsert).not.toHaveBeenCalled()
  })

  it('agreement inexistente → error de permisos', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      agreement: null,
    })
    const result = await deleteAgreement({ agreementId: A_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    expect(spies.agreementsDelete).not.toHaveBeenCalled()
  })
})

describe('reportAgreementFollowup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza usuario no autenticado', async () => {
    mockSupabase({ user: null })
    const result = await reportAgreementFollowup({
      agreementId: A_ID,
      reportedStatus: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('participante puede reportar followup', async () => {
    const { spies } = mockSupabase({
      user: { id: COLAB_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await reportAgreementFollowup({
      agreementId: A_ID,
      reportedStatus: 'parcial',
      justification: 'avance parcial',
    })
    expect(result.success).toBe(true)
    expect(spies.agreementFollowupsInsert).toHaveBeenCalledTimes(1)
    // El INSERT al followup precede el UPDATE del status. Ambos deben llamarse.
    expect(spies.agreementsUpdate).toHaveBeenCalledTimes(1)
  })

  it('usuario no participante recibe error (no se hace INSERT ni UPDATE)', async () => {
    const { spies } = mockSupabase({
      user: { id: OTHER_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
    })
    const result = await reportAgreementFollowup({
      agreementId: A_ID,
      reportedStatus: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    expect(spies.agreementFollowupsInsert).not.toHaveBeenCalled()
    expect(spies.agreementsUpdate).not.toHaveBeenCalled()
  })

  it('agreement inexistente → error de permisos', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      agreement: null,
    })
    const result = await reportAgreementFollowup({
      agreementId: A_ID,
      reportedStatus: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No tenés permisos')
    expect(spies.agreementFollowupsInsert).not.toHaveBeenCalled()
  })

  it('propaga error si el INSERT de followup falla', async () => {
    mockSupabase({
      user: { id: COLAB_ID },
      agreement: { one_on_one_id: MEET_ID },
      meeting: { leader_id: LEADER_ID, collaborator_id: COLAB_ID },
      finalError: { message: 'fk violation' },
    })
    const result = await reportAgreementFollowup({
      agreementId: A_ID,
      reportedStatus: 'cumplido',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('fk violation')
  })
})
