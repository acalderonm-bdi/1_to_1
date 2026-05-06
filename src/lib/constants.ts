export const ROLES = {
  COLLABORATOR: 'collaborator',
  LEADER: 'leader',
  HR: 'hr',
} as const

export const MEETING_STATUS = {
  AGENDADA: 'agendada',
  REALIZADA: 'realizada',
  NO_REALIZADA: 'no_realizada',
  EN_DISPUTA: 'en_disputa',
} as const

export const AGREEMENT_STATUS = {
  PENDIENTE: 'pendiente',
  CUMPLIDO: 'cumplido',
  PARCIAL: 'parcial',
  NO_CUMPLIDO: 'no_cumplido',
} as const

export const ROLE_LABELS: Record<string, string> = {
  collaborator: 'Colaborador',
  leader: 'Líder',
  hr: 'Arquitectura Humana',
}

export const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  no_realizada: 'No realizada',
  en_disputa: 'En disputa',
}

export const AGREEMENT_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  cumplido: 'Cumplido',
  parcial: 'Parcial',
  no_cumplido: 'No cumplido',
}

export const SEVERITY_LABELS: Record<string, string> = {
  info: 'Informativo',
  warning: 'Atención',
  critical: 'Crítico',
}
