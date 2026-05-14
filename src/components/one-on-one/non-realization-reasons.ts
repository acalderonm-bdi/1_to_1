// Shared (server + client safe): constantes y helper para los motivos de
// no-realización. SIN 'use client' — server components pueden importar
// `labelForReason` sin que Next.js falle en la boundary client/server.

export const REASON_OPTIONS = [
  { value: 'reagendada', label: 'Reagendada' },
  { value: 'cancelada_cargas', label: 'Cancelada por carga de trabajo' },
  { value: 'ausencia', label: 'Ausencia' },
  { value: 'emergencia', label: 'Emergencia' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'sin_justificacion', label: 'Sin justificación' },
] as const

export type Reason = (typeof REASON_OPTIONS)[number]['value']

export function labelForReason(value: string): string {
  return REASON_OPTIONS.find((o) => o.value === value)?.label ?? value
}
