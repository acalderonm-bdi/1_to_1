// Server-only por construcción: importa `org-settings` que a su vez usa
// `next/headers`. Cualquier import desde un componente cliente fallaría en
// build, así que el archivo se mantiene aparte de `agreement-quality.ts` (que
// es shared entre cliente y servidor).
import { checkAgreementQuality, type AgreementDraft, type QualityCheck } from './agreement-quality'
import { getOrgSetting } from './org-settings'

/**
 * Server-only wrapper que lee `collaborator_max_open_agreements` desde
 * `org_settings` y delega en la función sincrónica. Los consumers cliente
 * (warnings inline en `agreement-list.tsx`) siguen usando la sincrónica con el
 * default — no queremos un fetch async por keystroke.
 *
 * Importante: este módulo arrastra `@/lib/supabase/server` (next/headers), por
 * eso vive en un archivo aparte de `agreement-quality.ts`, que es compartido
 * entre cliente y servidor.
 */
export async function checkAgreementQualityWithConfig(
  draft: AgreementDraft,
): Promise<QualityCheck> {
  const maxOpen = await getOrgSetting('collaborator_max_open_agreements')
  return checkAgreementQuality(draft, { maxOpen })
}
