import { describe, it, expect } from 'vitest'
import { meetingTime, meetingDate } from './format'

// El instante se guarda en UTC. 13:12 en México (UTC−6) se guarda como 19:12Z.
// El formateo debe devolver la hora local de la org, no la del runtime.
describe('meetingTime', () => {
  it('convierte el instante UTC a la hora local de la org (México)', () => {
    // 19:12Z → 13:12 en América/México_City
    expect(meetingTime('2026-07-15T19:12:00Z')).toBe('13:12')
  })
  it('maneja el cruce de medianoche hacia el día anterior', () => {
    // 03:00Z → 21:00 del día anterior en México
    expect(meetingTime('2026-07-15T03:00:00Z')).toBe('21:00')
  })
})

describe('meetingDate', () => {
  it('usa la fecha local de la org, no la del runtime', () => {
    // 03:00Z del 15 = 21:00 del 14 en México → el día debe ser 14
    expect(meetingDate('2026-07-15T03:00:00Z', { day: 'numeric' })).toBe('14')
  })
})
