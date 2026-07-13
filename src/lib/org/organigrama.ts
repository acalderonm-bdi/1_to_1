/**
 * Organigrama con visibilidad acotada (requerimiento RH jul-2026):
 *
 * - Un colaborador ve su estructura desde su posición hacia ARRIBA (su línea
 *   de mando completa) y sus niveles IGUALES (pares) únicamente dentro de su
 *   misma área o subárea, según corresponda (subárea si tiene; si no, área).
 * - Quien lidera ve además su propio subárbol (su gente a cargo).
 * - La vista COMPLETA es exclusiva de las Direcciones (nivel D, y CA —
 *   presidencia del consejo) y del equipo de Arquitectura Humana y
 *   Transformación del Talento (área AH&TT o role hr).
 *
 * La página consulta con el admin client (la RLS de leadership_relations solo
 * deja leer relaciones propias) y ESTE módulo es la frontera de visibilidad:
 * todo lo que se renderiza pasa por computeVisibleIds. Lógica pura y testeable.
 */
import { HR_AREA } from '@/lib/sync/org-sync'

/** Niveles con vista completa del organigrama (además del área AH&TT y role hr). */
export const FULL_VIEW_LEVELS = new Set(['D', 'CA'])

/** Orden de niveles para presentación (mayor = más arriba en la jerarquía). */
export const NIVEL_RANK: Record<string, number> = {
  CA: 90, // presidencia consejo de administración
  D: 80,  // dirección (incl. general/ejecutiva)
  S: 70,  // subdirección
  SU: 65, // supervisión
  G: 60,  // gerencia
  C: 50,  // coordinación
  L: 45,  // líder (p.ej. seguridad)
  LT: 40, // líder técnico
  O: 10,  // operativo
}

export interface OrgUser {
  id: string
  full_name: string
  email: string
  puesto: string | null
  nivel_puesto: string | null
  sub_area: string | null
  department_id: string | null
  is_active: boolean
  role: string
}

export interface OrgRelation {
  leader_id: string
  collaborator_id: string
}

export interface OrgViewer extends OrgUser {
  /** Nombre del departamento (área) del viewer, para el check AH&TT. */
  departmentName: string | null
}

/** ¿El viewer tiene vista completa del organigrama? */
export function hasFullOrgView(viewer: OrgViewer): boolean {
  if (viewer.role === 'hr') return true
  if (viewer.nivel_puesto && FULL_VIEW_LEVELS.has(viewer.nivel_puesto)) return true
  if (viewer.departmentName === HR_AREA) return true
  return false
}

/**
 * Calcula el conjunto de usuarios visibles para el viewer: 'all' (vista
 * completa) o el set {él mismo ∪ línea de mando hacia arriba ∪ su subárbol ∪
 * pares de su mismo nivel en su misma subárea/área}.
 */
export function computeVisibleIds(
  viewer: OrgViewer,
  users: OrgUser[],
  relations: OrgRelation[],
): Set<string> | 'all' {
  if (hasFullOrgView(viewer)) return 'all'

  const leadersOf = new Map<string, string[]>()
  const reportsOf = new Map<string, string[]>()
  for (const r of relations) {
    leadersOf.set(r.collaborator_id, [...(leadersOf.get(r.collaborator_id) ?? []), r.leader_id])
    reportsOf.set(r.leader_id, [...(reportsOf.get(r.leader_id) ?? []), r.collaborator_id])
  }

  const visible = new Set<string>([viewer.id])

  // Hacia arriba: toda la línea de mando (multi-líder incluido, cruza áreas).
  const upQueue = [...(leadersOf.get(viewer.id) ?? [])]
  while (upQueue.length > 0) {
    const id = upQueue.pop() as string
    if (visible.has(id)) continue
    visible.add(id)
    upQueue.push(...(leadersOf.get(id) ?? []))
  }

  // Hacia abajo: su propio subárbol (quien lidera ve a su gente).
  const downQueue = [...(reportsOf.get(viewer.id) ?? [])]
  while (downQueue.length > 0) {
    const id = downQueue.pop() as string
    if (visible.has(id)) continue
    visible.add(id)
    downQueue.push(...(reportsOf.get(id) ?? []))
  }

  // Pares: mismo nivel dentro de su misma subárea (si tiene) o área.
  for (const u of users) {
    if (!u.is_active || u.id === viewer.id) continue
    if (u.nivel_puesto !== viewer.nivel_puesto) continue
    if (u.department_id !== viewer.department_id) continue
    if (viewer.sub_area !== null && u.sub_area !== viewer.sub_area) continue
    visible.add(u.id)
  }

  return visible
}

export interface OrgNode {
  user: OrgUser
  children: OrgNode[]
  /** true si la persona también reporta a otro líder visible (multi-líder). */
  alsoReportsTo: string[]
}

/**
 * Arma el bosque del organigrama con los usuarios visibles. Cada persona
 * cuelga de UN solo nodo (su primer líder visible, por orden de nivel del
 * líder) y los demás líderes se anotan en `alsoReportsTo` — evita duplicar
 * subárboles enteros con multi-líder. Raíces = visibles sin líder visible.
 */
export function buildOrgForest(
  users: OrgUser[],
  relations: OrgRelation[],
  visible: Set<string> | 'all',
): OrgNode[] {
  const isVisible = (id: string) => visible === 'all' || visible.has(id)
  const byId = new Map(users.map((u) => [u.id, u]))

  const leadersOf = new Map<string, string[]>()
  for (const r of relations) {
    if (!isVisible(r.leader_id) || !isVisible(r.collaborator_id)) continue
    if (!byId.has(r.leader_id) || !byId.has(r.collaborator_id)) continue
    leadersOf.set(r.collaborator_id, [...(leadersOf.get(r.collaborator_id) ?? []), r.leader_id])
  }

  const rank = (u: OrgUser | undefined) => NIVEL_RANK[u?.nivel_puesto ?? ''] ?? 0
  const nodes = new Map<string, OrgNode>()
  for (const u of users) {
    if (!u.is_active || !isVisible(u.id)) continue
    nodes.set(u.id, { user: u, children: [], alsoReportsTo: [] })
  }

  const roots: OrgNode[] = []
  for (const node of nodes.values()) {
    const leaderIds = (leadersOf.get(node.user.id) ?? []).filter((id) => nodes.has(id))
    if (leaderIds.length === 0) { roots.push(node); continue }
    // Cuelga del líder de mayor nivel; el resto queda como anotación.
    const sorted = [...leaderIds].sort((a, b) => rank(byId.get(b)) - rank(byId.get(a)))
    const primary = nodes.get(sorted[0]) as OrgNode
    primary.children.push(node)
    node.alsoReportsTo = sorted.slice(1).map((id) => byId.get(id)?.full_name ?? '')
  }

  const sortNodes = (list: OrgNode[]) => {
    list.sort((a, b) => rank(b.user) - rank(a.user) || a.user.full_name.localeCompare(b.user.full_name))
    for (const n of list) sortNodes(n.children)
  }
  sortNodes(roots)
  return roots
}
