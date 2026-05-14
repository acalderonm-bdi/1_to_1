/**
 * Revierte el seed de qa-seed-test-data.ts + qa-final-verify.ts:
 *   - Restaura leader_id de la meeting transferida
 *   - Borra los agreements [QA-SEED*]
 *   - Resetea transfer_banner_dismissed_at a null (para no dejar estado raro
 *     en producción)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const CAROLINA = '380fb7e3-4583-47e3-b22f-afed90d578d0'
const PEDRO = 'a181eb52-ed6c-4b27-9182-f9f035718f8d'
const TRANSFERRED_MEETING = '013cafdb-935c-45e9-8182-e7b5043c1c4d'

async function main() {
  console.log('[revert] Restaurando leader_id de meeting transferida...')
  const { error: e1 } = await sb
    .from('one_on_ones')
    .update({ leader_id: CAROLINA })
    .eq('id', TRANSFERRED_MEETING)
  console.log(e1 ? `  ✗ ${e1.message}` : '  ✓ leader_id revertido a Carolina')

  console.log('[revert] Borrando agreements [QA-SEED*]...')
  const { data: toDel } = await sb
    .from('agreements')
    .select('id, description')
    .like('description', '[QA-SEED%')
  console.log(`  Encontrados ${toDel?.length ?? 0}`)
  if (toDel && toDel.length > 0) {
    const { error: e2 } = await sb
      .from('agreements')
      .delete()
      .in(
        'id',
        toDel.map((a: any) => a.id),
      )
    console.log(e2 ? `  ✗ ${e2.message}` : `  ✓ ${toDel.length} borrados`)
  }

  console.log('[revert] Reset transfer_banner_dismissed_at...')
  const { error: e3 } = await sb
    .from('leadership_relations')
    .update({ transfer_banner_dismissed_at: null } as never)
    .eq('leader_id', CAROLINA)
    .eq('collaborator_id', PEDRO)
    .is('ended_at', null)
  console.log(e3 ? `  ✗ ${e3.message}` : '  ✓ dismissed_at = null')

  console.log('\n=== Revert listo ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
