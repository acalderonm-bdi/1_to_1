/**
 * Tests de la lógica pura de la alarma de cadencia (north star). La selección de
 * pares atrasados y la cadencia efectiva viven en la vista SQL overdue_relations
 * (validada en Supabase local con el CSV real); aquí cubrimos el mensaje.
 */
import { describe, it, expect } from 'vitest'
import { cadenceMessage } from './cadence'

describe('cadenceMessage', () => {
  it('nunca-reunidos (daysSince null) → mensaje de primera 1:1, days = cadencia', () => {
    const m = cadenceMessage(null, 14, 'María González')
    expect(m.title).toBe('Aún sin tu primera 1:1')
    expect(m.content).toContain('María González')
    expect(m.content).toContain('primera')
    expect(m.days).toBe(14)
  })

  it('con historial → mensaje con días transcurridos', () => {
    const m = cadenceMessage(37, 30, 'Luis Hernández')
    expect(m.title).toBe('Sin reunión hace varios días')
    expect(m.content).toContain('37 días')
    expect(m.content).toContain('Luis Hernández')
    expect(m.days).toBe(37)
  })

  it('fallback de nombre vacío', () => {
    expect(cadenceMessage(10, 14, '').content).toContain('tu colaborador')
  })
})
