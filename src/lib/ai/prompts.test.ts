import { describe, it, expect } from 'vitest'
import { extractAgreementsPrompt } from './prompts'

describe('extractAgreementsPrompt', () => {
  const prompt = extractAgreementsPrompt(
    'Acordamos entregar el reporte el viernes.',
    { leader: 'Líder (l@x.com)', collaborator: 'Colab (c@x.com)' },
    '2026-07-15',
  )

  it('ancla la fecha de hoy para que el modelo resuelva el año correcto', () => {
    expect(prompt).toContain('2026-07-15')
    expect(prompt).toContain('Fecha de hoy')
  })

  it('instruye que due_date nunca sea de un año pasado', () => {
    expect(prompt).toMatch(/NUNCA un año pasado/i)
    expect(prompt).toMatch(/due_date.*NUNCA.*anterior a hoy/is)
  })
})
