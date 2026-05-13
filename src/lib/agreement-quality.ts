/**
 * F1 — Client-side SMART rules checker para acuerdos 1:1.
 *
 * Reglas heurísticas que corren tanto en el cliente (warnings inline al
 * escribir el acuerdo) como en el servidor (al persistir el acuerdo, para
 * guardar score y warnings en `agreements.ai_quality_score` /
 * `ai_quality_warnings`). La IA puede agregar warnings adicionales
 * (`ambiguous_wording`, `unrealistic_deadline`) vía la ruta
 * `/api/ai/agreement-quality`, pero los checks de este módulo son
 * deterministas y rápidos.
 */

export interface AgreementDraft {
  description: string
  responsibleId: string | null
  dueDate: string | null
  collaboratorOpenAgreementsCount: number
}

export type QualityWarningCode =
  | 'too_short'
  | 'no_due_date'
  | 'past_due_date'
  | 'no_responsible'
  | 'overloaded_collaborator'
  | 'ambiguous_wording'
  | 'no_measurable_outcome'
  | 'unrealistic_deadline'

export interface QualityWarning {
  code: QualityWarningCode
  message: string
  suggestion?: string
}

export interface QualityCheck {
  passed: boolean
  warnings: QualityWarning[]
  score: number // 0.0 - 5.0
}

const MEASURABLE_VERBS =
  /\b(entreg|present|complet|enviar|firm|aprobar|implement|escrib|public|capacitar|formaliz|notificar|coordinar|finaliz|cumplir|resolver|estabilizar)\w*\b/i

export function checkAgreementQuality(draft: AgreementDraft): QualityCheck {
  const warnings: QualityWarning[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (draft.description.trim().length < 12) {
    warnings.push({
      code: 'too_short',
      message: 'La descripción es muy corta para que sea accionable.',
    })
  }

  if (!draft.responsibleId) {
    warnings.push({
      code: 'no_responsible',
      message: 'Hay que asignar a alguien responsable.',
    })
  }

  if (!draft.dueDate) {
    warnings.push({
      code: 'no_due_date',
      message: 'Sin fecha límite no se puede dar seguimiento.',
    })
  } else {
    const due = new Date(draft.dueDate)
    if (due < today) {
      warnings.push({
        code: 'past_due_date',
        message: 'La fecha límite ya pasó.',
      })
    } else {
      const oneDay = 24 * 60 * 60 * 1000
      const diff = due.getTime() - today.getTime()
      if (diff < oneDay) {
        warnings.push({
          code: 'unrealistic_deadline',
          message: 'Menos de 24h para cumplir — verificá que sea realista.',
        })
      }
    }
  }

  if (draft.collaboratorOpenAgreementsCount >= 7) {
    warnings.push({
      code: 'overloaded_collaborator',
      message: `Este colaborador ya tiene ${draft.collaboratorOpenAgreementsCount} acuerdos abiertos. Considerá priorizar antes de agregar más.`,
    })
  }

  if (
    draft.description.trim().length >= 12 &&
    !MEASURABLE_VERBS.test(draft.description)
  ) {
    warnings.push({
      code: 'no_measurable_outcome',
      message:
        'No queda claro qué entregable se verificará. Usá un verbo accionable (entregar, presentar, completar…).',
    })
  }

  const passed = warnings.length === 0
  const score = Math.max(0, 5 - warnings.length * 0.7)

  return { passed, warnings, score: Number(score.toFixed(1)) }
}
