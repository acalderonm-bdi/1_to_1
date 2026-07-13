import type { SupabaseClient } from '@supabase/supabase-js'

export interface RelationFlags {
  /** Tiene al menos un colaborador activo a cargo (lidera un equipo). */
  isLeader: boolean
  /** Tiene un líder activo (es alguien a quien se le hacen 1:1 hacia arriba). */
  isCollaborator: boolean
}

/**
 * Capacidades de una persona derivadas de `leadership_relations`, NO de `users.role`.
 *
 * El org de B-Drive es un árbol multinivel: la mayoría de los líderes también
 * reportan a alguien más arriba. El campo `role` solo decide el dashboard de
 * entrada y los poderes de RH; ser líder/colaborador se resuelve por relaciones
 * activas (`ended_at is null`). Reusado por los guards de layout, el armado del
 * nav y la action de agendar.
 */
export async function getActiveRelationFlags(
  supabase: SupabaseClient,
  userId: string,
): Promise<RelationFlags> {
  const [{ count: leadCount }, { count: collabCount }] = await Promise.all([
    supabase
      .from('leadership_relations')
      .select('id', { count: 'exact', head: true })
      .eq('leader_id', userId)
      .is('ended_at', null),
    supabase
      .from('leadership_relations')
      .select('id', { count: 'exact', head: true })
      .eq('collaborator_id', userId)
      .is('ended_at', null),
  ])

  return {
    isLeader: (leadCount ?? 0) > 0,
    isCollaborator: (collabCount ?? 0) > 0,
  }
}
