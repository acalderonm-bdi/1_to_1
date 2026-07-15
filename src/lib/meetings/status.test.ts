import { describe, it, expect } from 'vitest'
import { deriveStatusFromVobos } from './status'

describe('deriveStatusFromVobos', () => {
  it('ambos confirman → realizada', () => {
    expect(deriveStatusFromVobos({ confirmed: true }, { confirmed: true })).toBe('realizada')
  })
  it('se contradicen → en_disputa (líder sí, colab no)', () => {
    expect(deriveStatusFromVobos({ confirmed: true }, { confirmed: false })).toBe('en_disputa')
  })
  it('se contradicen → en_disputa (líder no, colab sí)', () => {
    expect(deriveStatusFromVobos({ confirmed: false }, { confirmed: true })).toBe('en_disputa')
  })
  it('ambos niegan → no_realizada', () => {
    expect(deriveStatusFromVobos({ confirmed: false }, { confirmed: false })).toBe('no_realizada')
  })
  it('falta un VoBo → null (no se toca el status)', () => {
    expect(deriveStatusFromVobos({ confirmed: true }, undefined)).toBeNull()
    expect(deriveStatusFromVobos(undefined, { confirmed: true })).toBeNull()
    expect(deriveStatusFromVobos(undefined, undefined)).toBeNull()
  })
})
