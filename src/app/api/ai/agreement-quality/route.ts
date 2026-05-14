import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAIClient, parseJSONResponse } from '@/lib/ai/client'

// Misma familia que `extract-agreements`/`analyze-patterns` para mantener
// consistencia de modelo en el stack de IA.
const MODEL_NAME = 'claude-sonnet-4-5'

const requestSchema = z.object({
  description: z.string().min(1).max(1000),
  responsibleName: z.string(),
  dueDate: z.string().nullable(),
})

interface AIQualityResponse {
  quality_score: number
  warnings: Array<{ code: string; message: string; suggestion?: string | null }>
  refined_description: string | null
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { description, responsibleName, dueDate } = parsed.data

  const prompt = `Sos un asesor que evalúa la calidad de acuerdos en reuniones 1:1 según criterios SMART y el alcance apropiado para ese contexto.

Acuerdo:
- Descripción: "${description}"
- Responsable: ${responsibleName}
- Fecha límite: ${dueDate ?? 'sin fecha'}

Evaluá según estos criterios:
1. ¿Es específico? (descripción clara, no ambigua)
2. ¿Es medible? (hay un entregable verificable)
3. ¿Es realista en el plazo dado?
4. ¿Está bien escrito como compromiso accionable?
5. ¿Está dentro del alcance de lo que un líder puede comprometer en una 1:1? Las 1:1 NO son el espacio para decidir aumentos de sueldo, promociones formales, contrataciones, despidos, presupuestos o cambios organizacionales — esas decisiones requieren RH, comité de compensación o ejecutivos. Si el acuerdo implica que el líder "otorgue" / "apruebe" / "decida" uno de esos temas, es out-of-scope. El framing correcto suele ser "escalar a RH", "recomendar para próxima revisión", "proponer al comité" — eso SÍ está en el alcance del líder.

Respondé en JSON estricto con este shape:
{
  "quality_score": number (0-5),
  "warnings": [{"code": "ambiguous_wording" | "unrealistic_deadline" | "out_of_scope_for_11", "message": "string", "suggestion": "string" | null}],
  "refined_description": "string" | null
}

Códigos válidos: "ambiguous_wording", "unrealistic_deadline", "out_of_scope_for_11".
Si detectás out_of_scope_for_11, agregá refined_description proponiendo un reframing como acción de escalado/recomendación.
Si el acuerdo está bien en todos los criterios, devolvé score 5, warnings vacío, refined_description null.`

  try {
    const client = getAIClient()
    const completion = await client.messages.create({
      model: MODEL_NAME,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = completion.content[0]?.type === 'text' ? completion.content[0].text : ''
    if (!text) {
      return NextResponse.json({ error: 'IA no devolvió contenido' }, { status: 500 })
    }

    const result = parseJSONResponse<AIQualityResponse>(text)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agreement-quality] error:', msg)
    return NextResponse.json({ error: `IA no disponible: ${msg.slice(0, 120)}` }, { status: 500 })
  }
}
