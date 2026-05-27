// Navegación compartida entre Sidebar y AppShell (para que el breadcrumb del
// header coincida con el ítem activo del menú).
//
// El menú se compone por CAPACIDADES (no por rol único): la sección personal se
// muestra a quien tiene un líder activo, la de líder a quien tiene reportes, y la
// de RH a quien tiene role='hr'. Una persona puede ver varias secciones a la vez
// (un mando medio que lidera y a la vez reporta hacia arriba). Ver `navFor`.

import {
  Home, CalendarPlus, CheckSquare, Users, LayoutDashboard,
  Grid, FileText, AlertTriangle, Repeat, Network, UsersRound, Settings,
  Bell, SlidersHorizontal, Download, RefreshCcw,
} from 'lucide-react'
import type { UserRole } from '@/types/domain'
import type { RelationFlags } from '@/lib/relations'

export interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  href: string
  badge?: number
  divider?: boolean
}

// Secciones por capacidad (sin el ítem de Configuración: se añade uno solo al final).
const PERSONAL_NAV: NavItem[] = [
  { key: 'col-dash', label: 'Inicio', icon: Home, href: '/colaborador' },
  { key: 'col-acuerdos', label: 'Mis acuerdos', icon: CheckSquare, href: '/colaborador/acuerdos' },
  { key: 'col-historial', label: 'Historial', icon: Repeat, href: '/colaborador/historial' },
]

const LEADER_NAV: NavItem[] = [
  { key: 'lid-dash', label: 'Resumen', icon: LayoutDashboard, href: '/lider' },
  { key: 'lid-equipo', label: 'Mi equipo', icon: Users, href: '/lider/equipo' },
  { key: 'lid-1to1-new', label: 'Agendar 1:1', icon: CalendarPlus, href: '/lider/1to1/nueva' },
]

const HR_NAV: NavItem[] = [
  { key: 'rh-dash', label: 'Panel general', icon: LayoutDashboard, href: '/arquitectura-humana' },
  { key: 'rh-mapa', label: 'Mapa de calor', icon: Grid, href: '/arquitectura-humana/mapa-calor' },
  { key: 'rh-reportes', label: 'Reportes IA', icon: FileText, href: '/arquitectura-humana/reportes' },
  { key: 'rh-disputas', label: 'Disputas', icon: AlertTriangle, href: '/arquitectura-humana/disputas' },
  { key: 'rh-cadencias', label: 'Cadencias', icon: Repeat, href: '/arquitectura-humana/cadencias' },
  { key: 'rh-estructura', label: 'Estructura', icon: Network, href: '/arquitectura-humana/estructura' },
  { key: 'rh-notif', label: 'Notificaciones', icon: Bell, href: '/arquitectura-humana/notificaciones' },
  { key: 'rh-params', label: 'Parámetros', icon: SlidersHorizontal, href: '/arquitectura-humana/parametros' },
  { key: 'rh-export', label: 'Exportes', icon: Download, href: '/arquitectura-humana/exportes' },
  { key: 'rh-sync', label: 'Sincronización', icon: RefreshCcw, href: '/arquitectura-humana/sincronizacion' },
  { key: 'rh-usuarios', label: 'Usuarios', icon: UsersRound, href: '/arquitectura-humana/usuarios' },
]

const CONFIG_BY_ROLE: Record<UserRole, NavItem> = {
  collaborator: { key: 'cfg', label: 'Configuración', icon: Settings, href: '/colaborador/configuracion', divider: true },
  leader: { key: 'cfg', label: 'Configuración', icon: Settings, href: '/lider/configuracion', divider: true },
  hr: { key: 'cfg', label: 'Configuración', icon: Settings, href: '/arquitectura-humana/configuracion', divider: true },
}

interface NavContext extends RelationFlags {
  role: UserRole
}

/**
 * Arma el menú según rol + capacidades relacionales.
 * - Personal: si `isCollaborator` (tiene líder; ve sus propios 1:1 hacia arriba).
 * - Líder: si `isLeader` (tiene reportes a cargo).
 * - RH: si `role === 'hr'`.
 * Más una única "Configuración" al final, según el rol principal.
 */
export function navFor({ role, isLeader, isCollaborator }: NavContext): NavItem[] {
  const items: NavItem[] = []
  if (isCollaborator) items.push(...PERSONAL_NAV)
  if (isLeader) items.push(...LEADER_NAV)
  if (role === 'hr') items.push(...HR_NAV)
  // Fallback: si por datos raros (p.ej. un dueño sin líder ni reportes y sin rol hr)
  // el menú quedara vacío, mostrar al menos la vista personal.
  if (items.length === 0) items.push(...PERSONAL_NAV)
  items.push(CONFIG_BY_ROLE[role])
  return items
}

// Todos los ítems posibles, para resolver breadcrumbs sin importar la sección.
const ALL_NAV_ITEMS: NavItem[] = [
  ...PERSONAL_NAV, ...LEADER_NAV, ...HR_NAV,
  ...Object.values(CONFIG_BY_ROLE),
]

// Roots de cada rol — un currentPath que termina exactamente acá debe matchear
// solo el ítem "dashboard" del rol, no cualquier descendiente.
const ROLE_ROOTS = new Set(['/colaborador', '/lider', '/arquitectura-humana'])

export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.href) return true
  if (ROLE_ROOTS.has(item.href)) return false
  return currentPath.startsWith(item.href + '/') || currentPath.startsWith(item.href)
}

// Devuelve el label del ítem activo (match más específico), o 'Inicio' si nada matchea.
export function breadcrumbsFor(currentPath: string): string[] {
  const sorted = [...ALL_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length)
  const match = sorted.find((i) => isNavItemActive(i, currentPath))
  return match ? [match.label] : ['Inicio']
}
