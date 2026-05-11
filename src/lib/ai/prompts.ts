export function extractAgreementsPrompt(rawMinute: string, participants: { leader: string; collaborator: string }): string {
  return `Eres un asistente especializado en reuniones 1:1. Extrae los acuerdos de esta minuta de reunión.

Participantes:
- Líder: ${participants.leader}
- Colaborador: ${participants.collaborator}

Minuta:
${rawMinute}

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones. Formato exacto:
{
  "agreements": [
    {
      "description": "Descripción clara del acuerdo",
      "responsible_email": "email del responsable (usa exactamente uno de los dos participantes)",
      "due_date": "YYYY-MM-DD o null si no se mencionó fecha",
      "confidence": 0.95
    }
  ]
}

Reglas:
- Extrae solo compromisos concretos y verificables
- No inventes acuerdos que no estén en la minuta
- Si no hay acuerdos claros, devuelve { "agreements": [] }
- La confianza (confidence) va de 0.0 a 1.0`
}

export function generateFollowupPlanPrompt(context: {
  collaboratorName: string
  meetingDate: string
  agreements: Array<{ description: string; responsible: string; dueDate: string | null }>
}): string {
  return `Eres un asistente de productividad para líderes. Genera un plan de seguimiento post-reunión 1:1.

Colaborador: ${context.collaboratorName}
Fecha de la reunión: ${context.meetingDate}

Acuerdos de la reunión:
${context.agreements.map(a => `- [${a.responsible}] ${a.description} (fecha: ${a.dueDate ?? 'sin fecha'})`).join('\n')}

Genera un plan de seguimiento. Responde ÚNICAMENTE con JSON válido, sin markdown:
{
  "summary": "Resumen ejecutivo de los compromisos clave",
  "actions": [
    {
      "action": "Acción concreta de seguimiento para el líder",
      "timeline": "Cuándo hacerlo (ej: 'En 3 días', 'El día anterior al vencimiento')",
      "importance": "alta|media|baja"
    }
  ]
}

Reglas:
- El plan es para el LÍDER, no para el colaborador
- Máximo 5 acciones
- Ordenadas por importancia descendente`
}

export function analyzePatternsPrompt(context: {
  relationshipMonths: number
  totalMeetings: number
  missedMeetings: number
  disputedMeetings: number
  agreements: Array<{ status: string; description: string }>
  recentHistory: string
}): string {
  return `Eres un analista de bienestar organizacional para el área de Recursos Humanos. Analiza los patrones de una relación 1:1.

Datos de la relación:
- Meses de relación: ${context.relationshipMonths}
- Total de 1:1s: ${context.totalMeetings}
- 1:1s no realizadas: ${context.missedMeetings}
- 1:1s en disputa: ${context.disputedMeetings}

Acuerdos:
${context.agreements.map(a => `- ${a.description}: ${a.status}`).join('\n') || 'Sin acuerdos registrados'}

Historial reciente:
${context.recentHistory}

Analiza si hay patrones que requieran atención de RH. Responde ÚNICAMENTE con JSON válido, sin markdown:
{
  "pattern_detected": true,
  "severity": "info|warning|critical",
  "title": "Título conciso del patrón detectado",
  "description": "Descripción del patrón con evidencia específica",
  "recommendations": [
    "Recomendación 1 para RH",
    "Recomendación 2 para RH"
  ]
}

Reglas:
- Solo reporta si hay un patrón real y preocupante
- Si todo está bien, usa severity: "info" y pattern_detected: false
- Máximo 3 recomendaciones
- No hagas suposiciones sin evidencia en los datos`
}
