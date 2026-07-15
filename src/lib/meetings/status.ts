/**
 * Fuente única de verdad del estado de una 1:1 a partir de los VoBos de ambos
 * participantes. Antes el estado se derivaba de los vobos en unas vistas y se
 * leía de la columna `status` en otras → la misma reunión se veía distinta
 * (ver F3). Esta función se usa al registrar un VoBo para dejar la columna
 * `status` consistente con lo que ve el usuario.
 */
export interface VoboState {
  confirmed: boolean
}

export type DerivedMeetingStatus = 'realizada' | 'en_disputa' | 'no_realizada'

/**
 * - Ambos confirman → realizada.
 * - Se contradicen → en_disputa.
 * - Ambos niegan → no_realizada.
 * - Falta el VoBo de alguno → null (no se toca el status; sigue agendada).
 */
export function deriveStatusFromVobos(
  leader: VoboState | undefined,
  collaborator: VoboState | undefined,
): DerivedMeetingStatus | null {
  if (!leader || !collaborator) return null
  if (leader.confirmed && collaborator.confirmed) return 'realizada'
  if (leader.confirmed !== collaborator.confirmed) return 'en_disputa'
  return 'no_realizada'
}
