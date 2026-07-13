import { describe, it, expect } from 'vitest'
import { computeVisibleIds, buildOrgForest, hasFullOrgView, type OrgUser, type OrgViewer, type OrgRelation } from './organigrama'
import { HR_AREA } from '@/lib/sync/org-sync'

function user(id: string, over: Partial<OrgUser> = {}): OrgUser {
  return {
    id,
    full_name: id.toUpperCase(),
    email: `${id}@b-drive.com.mx`,
    puesto: null,
    nivel_puesto: 'O',
    sub_area: null,
    department_id: 'dep-1',
    is_active: true,
    role: 'collaborator',
    ...over,
  }
}

function viewer(base: OrgUser, departmentName: string | null = 'FINANZAS'): OrgViewer {
  return { ...base, departmentName }
}

// Árbol: dg → dir → ger → op1 ; ger → op2 (par de op1, misma subárea)
//        dir → ger2 (otra subárea) → op3
const USERS: OrgUser[] = [
  user('dg', { nivel_puesto: 'D', department_id: 'dep-dg' }),
  user('dir', { nivel_puesto: 'S', department_id: 'dep-1' }),
  user('ger', { nivel_puesto: 'G', department_id: 'dep-1', sub_area: 'TESORERIA' }),
  user('ger2', { nivel_puesto: 'G', department_id: 'dep-1', sub_area: 'CONTABILIDAD' }),
  user('op1', { sub_area: 'TESORERIA' }),
  user('op2', { sub_area: 'TESORERIA' }),
  user('op3', { sub_area: 'CONTABILIDAD' }),
  user('ajeno', { department_id: 'dep-9', sub_area: 'OTRA' }),
]
const RELATIONS: OrgRelation[] = [
  { leader_id: 'dg', collaborator_id: 'dir' },
  { leader_id: 'dir', collaborator_id: 'ger' },
  { leader_id: 'dir', collaborator_id: 'ger2' },
  { leader_id: 'ger', collaborator_id: 'op1' },
  { leader_id: 'ger', collaborator_id: 'op2' },
  { leader_id: 'ger2', collaborator_id: 'op3' },
]

describe('hasFullOrgView', () => {
  it('nivel D y CA ven todo', () => {
    expect(hasFullOrgView(viewer(user('x', { nivel_puesto: 'D' })))).toBe(true)
    expect(hasFullOrgView(viewer(user('x', { nivel_puesto: 'CA' })))).toBe(true)
  })
  it('role hr ve todo', () => {
    expect(hasFullOrgView(viewer(user('x', { role: 'hr' })))).toBe(true)
  })
  it('área AH&TT ve todo', () => {
    expect(hasFullOrgView(viewer(user('x'), HR_AREA))).toBe(true)
  })
  it('operativo normal NO ve todo', () => {
    expect(hasFullOrgView(viewer(user('x')))).toBe(false)
  })
})

describe('computeVisibleIds', () => {
  it('colaborador: línea de mando hacia arriba + pares de su subárea; nada más', () => {
    const v = computeVisibleIds(viewer(USERS.find((u) => u.id === 'op1') as OrgUser), USERS, RELATIONS)
    expect(v).not.toBe('all')
    const set = v as Set<string>
    // arriba: ger → dir → dg
    expect(set.has('ger')).toBe(true)
    expect(set.has('dir')).toBe(true)
    expect(set.has('dg')).toBe(true)
    // par de misma subárea
    expect(set.has('op2')).toBe(true)
    // otra subárea del mismo departamento: NO (ni el gerente ni su gente)
    expect(set.has('ger2')).toBe(false)
    expect(set.has('op3')).toBe(false)
    // otro departamento: NO
    expect(set.has('ajeno')).toBe(false)
  })

  it('líder: además de su línea, ve su subárbol completo', () => {
    const v = computeVisibleIds(viewer(USERS.find((u) => u.id === 'ger') as OrgUser), USERS, RELATIONS)
    const set = v as Set<string>
    expect(set.has('op1')).toBe(true)
    expect(set.has('op2')).toBe(true)
    expect(set.has('dir')).toBe(true)
    expect(set.has('dg')).toBe(true)
    // ger2 es par de nivel G pero de OTRA subárea → no
    expect(set.has('ger2')).toBe(false)
  })

  it('pares por área cuando el viewer no tiene subárea', () => {
    const users = [user('a', { sub_area: null }), user('b', { sub_area: null }), user('c', { sub_area: 'X' })]
    const v = computeVisibleIds(viewer(users[0]), users, [])
    const set = v as Set<string>
    expect(set.has('b')).toBe(true)
    // c está en la misma área pero el viewer sin subárea ve pares del área completa
    expect(set.has('c')).toBe(true)
  })

  it('multi-líder: ve TODAS sus líneas hacia arriba', () => {
    const users = [user('j1', { nivel_puesto: 'C' }), user('j2', { nivel_puesto: 'C', department_id: 'dep-2' }), user('yo')]
    const rels: OrgRelation[] = [
      { leader_id: 'j1', collaborator_id: 'yo' },
      { leader_id: 'j2', collaborator_id: 'yo' },
    ]
    const set = computeVisibleIds(viewer(users[2]), users, rels) as Set<string>
    expect(set.has('j1')).toBe(true)
    expect(set.has('j2')).toBe(true)
  })

  it('dirección: vista completa', () => {
    expect(computeVisibleIds(viewer(USERS.find((u) => u.id === 'dg') as OrgUser), USERS, RELATIONS)).toBe('all')
  })
})

describe('buildOrgForest', () => {
  it('arma el árbol completo con raíz en dg', () => {
    const forest = buildOrgForest(USERS, RELATIONS, 'all')
    // raíces: dg + ajeno (sin líder)
    expect(forest.map((n) => n.user.id).sort()).toEqual(['ajeno', 'dg'])
    const dg = forest.find((n) => n.user.id === 'dg') as ReturnType<typeof buildOrgForest>[number]
    expect(dg.children[0].user.id).toBe('dir')
    expect(dg.children[0].children.map((n) => n.user.id).sort()).toEqual(['ger', 'ger2'])
  })

  it('vista acotada: el subárbol solo contiene visibles y las raíces son los topes visibles', () => {
    const op1 = USERS.find((u) => u.id === 'op1') as OrgUser
    const visible = computeVisibleIds(viewer(op1), USERS, RELATIONS) as Set<string>
    const forest = buildOrgForest(USERS, RELATIONS, visible)
    expect(forest).toHaveLength(1)
    expect(forest[0].user.id).toBe('dg')
    const flat: string[] = []
    const walk = (nodes: typeof forest) => nodes.forEach((n) => { flat.push(n.user.id); walk(n.children) })
    walk(forest)
    expect(flat.sort()).toEqual(['dg', 'dir', 'ger', 'op1', 'op2'])
  })

  it('multi-líder cuelga del líder de mayor nivel y anota el resto', () => {
    const users = [user('g', { nivel_puesto: 'G' }), user('c', { nivel_puesto: 'C' }), user('yo')]
    const rels: OrgRelation[] = [
      { leader_id: 'g', collaborator_id: 'yo' },
      { leader_id: 'c', collaborator_id: 'yo' },
    ]
    const forest = buildOrgForest(users, rels, 'all')
    const g = forest.find((n) => n.user.id === 'g')
    const c = forest.find((n) => n.user.id === 'c')
    expect(g?.children.map((n) => n.user.id)).toEqual(['yo'])
    expect(c?.children).toHaveLength(0)
    expect(g?.children[0].alsoReportsTo).toEqual(['C'])
  })

  it('usuarios inactivos no aparecen', () => {
    const users = [user('a'), user('b', { is_active: false })]
    const forest = buildOrgForest(users, [], 'all')
    expect(forest.map((n) => n.user.id)).toEqual(['a'])
  })
})
