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
- La confianza (confidence) va de 0.0 a 1.0

REGLAS DE PRIVACIDAD — críticas, no negociables:

NUNCA extraigas ni menciones en la descripción información sobre estos temas, aunque la persona los mencione en la minuta:
- Salud física o mental (diagnósticos, tratamientos, terapia, ansiedad, depresión, medicación)
- Vida familiar (divorcio, separación, problemas de pareja, hijos, embarazo, planes familiares)
- Relaciones personales o sentimentales
- Situación financiera personal (deudas, hipoteca, problemas económicos)
- Creencias religiosas, políticas o ideológicas
- Orientación sexual o identidad de género
- Consumo de sustancias o adicciones
- Situaciones legales personales (denuncias, demandas, herencias)
- Discriminación, acoso o violencia sufrida (esto debe escalar por canal separado de RH, NO como acuerdo)

CASO ESPECIAL: si en la minuta hay un compromiso DE TRABAJO legítimo (ej: ajuste de horario, cambio de carga, días de descanso adicionales) cuyo MOTIVO es uno de los temas privados de arriba, sí extrae el compromiso PERO redactá la descripción solo en términos de trabajo, sin mencionar el motivo personal. Ejemplo:

  Minuta dice: "Maria está pasando por un divorcio y necesita salir 30 min antes los jueves por 3 semanas. Acordamos ajustar su horario."
  ✅ Extraer: { "description": "Ajustar horario de salida los jueves: 30 min antes durante 3 semanas", "responsible_email": "<líder>", ... }
  ❌ NO extraer: { "description": "Apoyar a Maria con su divorcio ajustando horario", ... }

Si todo lo que detectás son temas personales sin un compromiso de trabajo concreto adjunto, devolvé { "agreements": [] }. La minuta queda en su forma libre (visible solo a los participantes); no creamos estructura visible a RH a partir de contenido íntimo.`
}

export function suggestQuestionsPrompt(context: {
  collaboratorName: string
  recentMeetings: Array<{ date: string; agreements: string[] }>
  pendingAgreements: Array<{ description: string; dueDate: string | null; status: string }>
}): string {
  return `Eres un coach ejecutivo que ayuda a líderes a tener mejores conversaciones 1:1.

Contexto del colaborador: ${context.collaboratorName}

Últimas 1:1s:
${context.recentMeetings.map(m => `- ${m.date}: ${m.agreements.join(', ') || 'Sin acuerdos registrados'}`).join('\n')}

Acuerdos pendientes:
${context.pendingAgreements.map(a => `- ${a.description} (vence: ${a.dueDate ?? 'sin fecha'}, estado: ${a.status})`).join('\n') || 'Ninguno'}

Sugiere 5 preguntas para la próxima 1:1. Responde ÚNICAMENTE con JSON válido, sin markdown:
{
  "questions": [
    {
      "question": "Pregunta específica y abierta",
      "rationale": "Por qué esta pregunta es relevante ahora",
      "category": "desempeño|desarrollo|bienestar|seguimiento|feedback"
    }
  ]
}

Reglas:
- Preguntas abiertas, no de sí/no
- Basadas en el contexto real, no genéricas
- En español, tono profesional pero cercano

REGLAS DE PRIVACIDAD — críticas, no negociables:

- Las preguntas deben ser sobre TRABAJO, desarrollo profesional, bienestar laboral, dinámica de equipo o feedback de la relación líder-colaborador.
- NUNCA generes preguntas que indaguen en temas personales sensibles: salud (física/mental, terapia, medicación, ansiedad, depresión), vida familiar (pareja, hijos, divorcio, embarazo, planes familiares), situación financiera personal, creencias religiosas/políticas/ideológicas, orientación sexual o identidad de género, adicciones, situaciones legales personales.
- Si el contexto del colaborador parece sugerir estos temas, NO los uses como pista para preguntar; respondé con preguntas neutras sobre carga, bloqueos, crecimiento profesional o cómo el líder puede apoyarlo en términos generales.
- La categoría "bienestar" se refiere a carga de trabajo, energía, estrés laboral — NO a salud mental clínica, vida personal o relaciones íntimas.`
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
- No hagas suposiciones sin evidencia en los datos

REGLAS DE PRIVACIDAD — críticas, no negociables:

- Tu análisis es a nivel agregado/estructural (cadencia, cumplimiento, disputas). NO inferas patrones sobre temas personales aunque aparezcan en las descripciones de los acuerdos.
- NUNCA menciones en title/description/recommendations información sobre salud, familia, divorcio, situación financiera, creencias, orientación, adicciones o situaciones legales personales — aunque los datos lo sugieran.
- Si detectás que muchos acuerdos parecen tener un trasfondo personal (ej: múltiples ajustes de horario, ausencias frecuentes), reportá el patrón estructural en términos neutros ("alta variabilidad en cadencia y horarios — recomendable conversación de RH con el colaborador") sin especular causa personal.
- Si un patrón sugiere posible discriminación, acoso o violencia, NO lo formalices en este reporte. En cambio, usa severity: "critical" y recommendation: "Iniciar conversación 1:1 directa con el colaborador desde RH para entender la situación y, si aplica, escalar al canal interno de denuncias". Sin detalles especulativos.`
}
