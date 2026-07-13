import { redirect } from 'next/navigation'
import { Network, Eye, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeVisibleIds,
  buildOrgForest,
  hasFullOrgView,
  type OrgNode,
  type OrgUser,
  type OrgViewer,
} from '@/lib/org/organigrama'

// Organigrama con visibilidad acotada (requerimiento RH jul-2026).
//
// La RLS de leadership_relations solo deja leer relaciones propias, así que el
// armado usa el admin client server-side y computeVisibleIds es la frontera de
// visibilidad: colaborador ve su línea de mando + pares de su subárea/área;
// vista completa solo Direcciones (D/CA) y AH&TT. Nada de esto se expone como
// API — la página entrega el árbol YA filtrado.
export default async function OrganigramaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: viewerRaw } = await admin
    .from('users')
    .select('id, full_name, email, puesto, nivel_puesto, sub_area, department_id, is_active, role, departments(name)')
    .eq('id', user.id)
    .single()
  if (!viewerRaw) redirect('/login')

  type ViewerRow = OrgUser & { departments: { name: string } | { name: string }[] | null }
  const vr = viewerRaw as ViewerRow
  const dept = Array.isArray(vr.departments) ? vr.departments[0] : vr.departments
  const viewer: OrgViewer = { ...vr, departmentName: dept?.name ?? null }

  const [{ data: usersRaw }, { data: relsRaw }] = await Promise.all([
    admin
      .from('users')
      .select('id, full_name, email, puesto, nivel_puesto, sub_area, department_id, is_active, role')
      .eq('is_active', true),
    admin
      .from('leadership_relations')
      .select('leader_id, collaborator_id')
      .is('ended_at', null),
  ])
  const users = (usersRaw ?? []) as OrgUser[]
  const relations = (relsRaw ?? []) as Array<{ leader_id: string; collaborator_id: string }>

  const visible = computeVisibleIds(viewer, users, relations)
  const forest = buildOrgForest(users, relations, visible)
  const fullView = hasFullOrgView(viewer)
  const visibleCount = visible === 'all' ? users.length : visible.size

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Network size={12} /> Estructura organizacional</span>
          <h1 className="page__title">Organigrama</h1>
          <p className="page__subtitle">
            {fullView
              ? `Vista completa de la organización — ${visibleCount} personas activas.`
              : 'Tu línea de mando y tus pares dentro de tu misma área o subárea.'}
          </p>
        </div>
        <span className="ui-badge ui-badge--slate" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Eye size={12} /> {fullView ? 'Vista completa' : `${visibleCount} personas visibles`}
        </span>
      </div>

      {forest.length === 0 ? (
        <div className="ui-card">
          <div className="ui-card__body" style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            <Users size={16} /> Aún no hay estructura sincronizada. RH debe correr la sincronización de la base de líderes.
          </div>
        </div>
      ) : (
        <div className="ui-card">
          <div className="ui-card__body" style={{ overflowX: 'auto' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {forest.map((node) => (
                <OrgNodeItem key={node.user.id} node={node} viewerId={viewer.id} depth={0} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

const NIVEL_LABEL: Record<string, string> = {
  CA: 'Consejo', D: 'Dirección', S: 'Subdirección', SU: 'Supervisión',
  G: 'Gerencia', C: 'Coordinación', L: 'Líder', LT: 'Líder técnico', O: 'Operativo',
}

const NIVEL_TONE: Record<string, string> = {
  CA: 'violet', D: 'violet', S: 'blue', SU: 'blue', G: 'blue', C: 'green', L: 'green', LT: 'green', O: 'slate',
}

function OrgNodeItem({ node, viewerId, depth }: { node: OrgNode; viewerId: string; depth: number }) {
  const u = node.user
  const isViewer = u.id === viewerId
  const nivel = u.nivel_puesto ?? ''
  const hasChildren = node.children.length > 0

  const card = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderRadius: 8, border: '1px solid var(--border)',
        background: isViewer ? 'hsl(var(--accent) / 0.12)' : 'var(--card)',
        marginBottom: 6, minWidth: 320,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {u.full_name}
          {isViewer && <span className="ui-badge ui-badge--amber">Tú</span>}
          {node.alsoReportsTo.filter(Boolean).length > 0 && (
            <span className="ui-badge ui-badge--slate" title={`También reporta a ${node.alsoReportsTo.join(', ')}`}>
              +{node.alsoReportsTo.length} líder(es)
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.puesto ?? '—'}{u.sub_area ? ` · ${u.sub_area}` : ''}
        </div>
      </div>
      <span className={`ui-badge ui-badge--${NIVEL_TONE[nivel] ?? 'slate'}`}>
        {NIVEL_LABEL[nivel] ?? nivel ?? '—'}
      </span>
    </div>
  )

  return (
    <li style={{ paddingLeft: depth === 0 ? 0 : 22, borderLeft: depth === 0 ? 'none' : '1px solid var(--border)' }}>
      {hasChildren ? (
        <details open={depth < 2}>
          <summary style={{ cursor: 'pointer', listStyle: 'none' }}>{card}</summary>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {node.children.map((child) => (
              <OrgNodeItem key={child.user.id} node={child} viewerId={viewerId} depth={depth + 1} />
            ))}
          </ul>
        </details>
      ) : (
        card
      )}
    </li>
  )
}
