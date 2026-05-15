/**
 * Tests unitarios para `src/lib/actions/one-on-ones.ts`.
 *
 * Foco:
 *  - `markNonRealization`: bifurcación participante vs HR, lógica de disputa.
 *  - `dismissTransferBanner`: chequea que el UPDATE sólo afecta filas donde el
 *    usuario es leader (filtro `.eq('leader_id', user.id)`). Antes de la
 *    migration 23 las RLS policies dejaban que un líder dismiseara banners de
 *    OTRAS relations silenciosamente (no error, pero 0 rows actualizadas).
 *
 * Estrategia: mock total del cliente Supabase con `vi.mock`. Cada test arma
 * un chain mínimo con `auth.getSession` (one-on-ones usa session, no getUser)
 * y `from(table)` con la firma exacta que el código consume.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/google/calendar', () => ({
  createCalendarEvent: vi.fn().mockResolvedValue({ success: false }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/slack/notify', () => ({
  notifyDispute: vi.fn().mockResolvedValue({ sent: false, skipped: true }),
}))
vi.mock('@/lib/org-settings', () => ({
  // Default plazo amplio para que el soft-warning no entre en juego salvo que
  // el test lo decida explícitamente.
  getOrgSetting: vi.fn().mockResolvedValue(30),
}))

import { createClient } from '@/lib/supabase/server'
import { markNonRealization, dismissTransferBanner } from './one-on-ones'

type MeetingRow = {
  id: string
  leader_id: string
  collaborator_id: string
  status: string | null
  non_realization_reason: string | null
  scheduled_at: string | null
}

type MockOpts = {
  user?: { id: string } | null
  meeting?: MeetingRow | null
  profile?: { role: string } | null
  /** Error simulado en el UPDATE final de la tabla `one_on_ones` */
  oneOnOneUpdateError?: { message: string } | null
  /** Error simulado en el UPDATE de `leadership_relations` */
  leadershipUpdateError?: { message: string } | null
}

function mockSupabase(opts: MockOpts) {
  const spies = {
    oneOnOnesUpdate: vi
      .fn()
      .mockResolvedValue({ error: opts.oneOnOneUpdateError ?? null }),
    leadershipUpdate: vi
      .fn()
      .mockResolvedValue({ error: opts.leadershipUpdateError ?? null }),
    leadershipUpdateFirstEq: vi.fn(),
    auditLogsInsert: vi.fn().mockResolvedValue({ error: null }),
  }

  // Construimos el chain para `leadership_relations.update(...).eq(id).eq(leader_id)`:
  // primer `.eq` devuelve un objeto con otro `.eq` que es la spy final.
  spies.leadershipUpdateFirstEq.mockImplementation(() => ({
    eq: spies.leadershipUpdate,
  }))

  const chain = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: opts.user ? { user: opts.user } : null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'one_on_ones') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.meeting ?? null,
            error: opts.meeting ? null : { message: 'not found' },
          }),
          update: vi.fn(() => ({ eq: spies.oneOnOnesUpdate })),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: opts.profile ?? null,
            error: null,
          }),
        }
      }
      if (table === 'leadership_relations') {
        return {
          update: vi.fn(() => ({ eq: spies.leadershipUpdateFirstEq })),
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

const MEET_ID = '00000000-0000-0000-0000-0000000000d1'
const LEADER_ID = '00000000-0000-0000-0000-0000000000c1'
const COLAB_ID = '00000000-0000-0000-0000-0000000000c2'
const HR_ID = '00000000-0000-0000-0000-0000000000c8'
const OTHER_ID = '00000000-0000-0000-0000-0000000000c9'
const REL_ID = '00000000-0000-0000-0000-0000000000e1'

function baseMeeting(overrides: Partial<MeetingRow> = {}): MeetingRow {
  return {
    id: MEET_ID,
    leader_id: LEADER_ID,
    collaborator_id: COLAB_ID,
    status: 'pendiente',
    non_realization_reason: null,
    scheduled_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('markNonRealization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza no autenticado', async () => {
    mockSupabase({ user: null })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('rechaza si la reunión no existe', async () => {
    mockSupabase({ user: { id: LEADER_ID }, meeting: null })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reunión no encontrada')
  })

  it('participante marca con motivo → status no_realizada', async () => {
    const { spies } = mockSupabase({
      user: { id: LEADER_ID },
      meeting: baseMeeting(),
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
      note: 'no se presentó',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data?.status).toBe('no_realizada')
    expect(spies.oneOnOnesUpdate).toHaveBeenCalledTimes(1)
    expect(spies.auditLogsInsert).toHaveBeenCalledTimes(1)
    // El audit log debe registrar la acción correcta.
    const auditPayload = spies.auditLogsInsert.mock.calls[0]?.[0] as {
      action: string
    }
    expect(auditPayload.action).toBe('meeting_marked_not_realized')
  })

  it('otro participante marca con motivo distinto → goToDispute=true → en_disputa', async () => {
    const { spies } = mockSupabase({
      user: { id: COLAB_ID },
      meeting: baseMeeting({ non_realization_reason: 'reagendada' }),
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data?.status).toBe('en_disputa')
    expect(spies.oneOnOnesUpdate).toHaveBeenCalledTimes(1)
    const auditPayload = spies.auditLogsInsert.mock.calls[0]?.[0] as {
      action: string
    }
    expect(auditPayload.action).toBe('meeting_marked_disputed')
  })

  it('mismo motivo que el previo NO genera disputa', async () => {
    const { spies } = mockSupabase({
      user: { id: COLAB_ID },
      meeting: baseMeeting({ non_realization_reason: 'ausencia' }),
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data?.status).toBe('no_realizada')
    const auditPayload = spies.auditLogsInsert.mock.calls[0]?.[0] as {
      action: string
    }
    expect(auditPayload.action).toBe('meeting_marked_not_realized')
  })

  it('HR no participante puede marcar (policy lo permite)', async () => {
    const { spies } = mockSupabase({
      user: { id: HR_ID },
      meeting: baseMeeting(),
      profile: { role: 'hr' },
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'emergencia',
    })
    expect(result.success).toBe(true)
    expect(spies.oneOnOnesUpdate).toHaveBeenCalledTimes(1)
  })

  it('no participante non-HR → "Sin permisos" y sin UPDATE', async () => {
    const { spies } = mockSupabase({
      user: { id: OTHER_ID },
      meeting: baseMeeting(),
      profile: { role: 'collaborator' },
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Sin permisos')
    expect(spies.oneOnOnesUpdate).not.toHaveBeenCalled()
  })

  it('propaga error si el UPDATE final falla', async () => {
    mockSupabase({
      user: { id: LEADER_ID },
      meeting: baseMeeting(),
      oneOnOneUpdateError: { message: 'db kaput' },
    })
    const result = await markNonRealization({
      oneOnOneId: MEET_ID,
      reason: 'ausencia',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('db kaput')
  })

  it('rechaza input con UUID inválido', async () => {
    mockSupabase({ user: { id: LEADER_ID } })
    const result = await markNonRealization({
      oneOnOneId: 'no-es-uuid',
      reason: 'ausencia',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })
})

describe('dismissTransferBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza no autenticado', async () => {
    mockSupabase({ user: null })
    const result = await dismissTransferBanner({
      leadershipRelationId: REL_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No autenticado')
  })

  it('rechaza input con UUID inválido', async () => {
    mockSupabase({ user: { id: LEADER_ID } })
    const result = await dismissTransferBanner({
      leadershipRelationId: 'no-uuid',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Datos inválidos')
  })

  it('líder propio del relation dismissa correctamente (post-migration 23)', async () => {
    const { spies, chain } = mockSupabase({
      user: { id: LEADER_ID },
      // Sin error en el UPDATE → asumimos que la migration 23 ya permite a
      // los líderes UPDATE su propia leadership_relation y el dismiss persiste.
    })
    const result = await dismissTransferBanner({
      leadershipRelationId: REL_ID,
    })
    expect(result.success).toBe(true)
    // Verificamos que el UPDATE se llamó con el filtro doble id+leader_id.
    expect(chain.from).toHaveBeenCalledWith('leadership_relations')
    // Primer .eq(id) → second .eq(leader_id)
    expect(spies.leadershipUpdateFirstEq).toHaveBeenCalledWith('id', REL_ID)
    expect(spies.leadershipUpdate).toHaveBeenCalledWith(
      'leader_id',
      LEADER_ID,
    )
  })

  it('el flujo escribe `transfer_banner_dismissed_at` y termina en .eq(leader_id)', async () => {
    const { spies, chain } = mockSupabase({ user: { id: LEADER_ID } })
    await dismissTransferBanner({ leadershipRelationId: REL_ID })
    // Sanity check: el `from` se invocó con la tabla correcta y la cadena
    // de filtros llegó hasta la spy final del segundo .eq.
    expect(chain.from).toHaveBeenCalledWith('leadership_relations')
    expect(spies.leadershipUpdate).toHaveBeenCalledTimes(1)
  })

  it('líder intentando dismissar relation ajena: filtro leader_id corta la fila (RLS post-fix)', async () => {
    // Pre-migration 23: el UPDATE devolvía 0 filas y `error:null` → la acción
    // retornaba `success:true` engañoso. Post-fix, el filtro `.eq('leader_id',
    // user.id)` aplicado en server-side asegura que sólo se actualiza la
    // relation del propio líder. Mockeamos que el UPDATE devuelve sin error
    // (igual que el caso silencioso) y verificamos que el filtro está aplicado.
    const { spies } = mockSupabase({ user: { id: OTHER_ID } })
    const result = await dismissTransferBanner({
      leadershipRelationId: REL_ID,
    })
    // La acción retorna success porque Supabase no lanza error para 0 rows.
    // El test crítico es que el filtro leader_id está en su lugar — sin él,
    // RLS antigua dejaba pasar UPDATEs sobre relations ajenas.
    expect(result.success).toBe(true)
    expect(spies.leadershipUpdate).toHaveBeenCalledWith('leader_id', OTHER_ID)
  })

  it('propaga error si el UPDATE falla', async () => {
    mockSupabase({
      user: { id: LEADER_ID },
      leadershipUpdateError: { message: 'permission denied' },
    })
    const result = await dismissTransferBanner({
      leadershipRelationId: REL_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('permission denied')
  })
})
