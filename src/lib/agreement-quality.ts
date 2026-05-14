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
  | 'out_of_scope_for_11'

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

/**
 * Temas que típicamente exceden el alcance de lo que se puede comprometer en
 * una 1:1 entre líder y colaborador: compensación, promociones formales,
 * contrataciones/desvinculaciones, decisiones de presupuesto. Estas
 * resoluciones requieren intervención de RH, comité de compensación o
 * ejecutivos. El compromiso accionable correcto suele ser "escalar / plantear
 * a RH / proponer en la próxima revisión", no "otorgar / aprobar".
 *
 * Patrón laxo (mejor false-positive que dejar pasar uno real): si la
 * descripción menciona estos sustantivos, mostramos warning soft. El usuario
 * puede ignorarlo si reformuló como acción de escalado.
 */
const OUT_OF_SCOPE_KEYWORDS =
  /\b(aumento\s+de\s+sueldo|aumento\s+salarial|sueldo|salario|compensaci[oó]n|bono|comisi[oó]n|promoci[oó]n|ascenso|asciender|promover|despid|finiquito|desvinculaci[oó]n|terminaci[oó]n\s+laboral|contrataci[oó]n\s+de|presupuesto|capex|opex)\b/i

/**
 * Default fallback para el umbral de "colaborador sobrecargado". Se usa cuando
 * no se pasa `opts.maxOpen` explícito — los consumers cliente (warnings inline
 * por keystroke) no pueden hacer un fetch async sin penalizar el render. Los
 * consumers server-side prefieren `checkAgreementQualityWithConfig`, que lee
 * el valor real desde `org_settings.collaborator_max_open_agreements`.
 */
const DEFAULT_MAX_OPEN_AGREEMENTS = 7

export function checkAgreementQuality(
  draft: AgreementDraft,
  opts: { maxOpen?: number } = {},
): QualityCheck {
  const maxOpen = opts.maxOpen ?? DEFAULT_MAX_OPEN_AGREEMENTS
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

  if (draft.collaboratorOpenAgreementsCount >= maxOpen) {
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

  if (OUT_OF_SCOPE_KEYWORDS.test(draft.description)) {
    warnings.push({
      code: 'out_of_scope_for_11',
      message:
        'Este compromiso menciona temas (compensación, promoción, contratación o presupuesto) que típicamente no se resuelven en una 1:1 — requieren RH, comité o ejecutivos. Reformulalo como una acción concreta dentro de lo que el líder sí puede hacer (ej: "Escalar a RH la solicitud de aumento", "Recomendar para la próxima revisión de promociones", "Proponer en el comité").',
      suggestion:
        'Reformular como acción de escalado/recomendación, no como decisión final',
    })
  }

  const passed = warnings.length === 0
  const score = Math.max(0, 5 - warnings.length * 0.7)

  return { passed, warnings, score: Number(score.toFixed(1)) }
}
