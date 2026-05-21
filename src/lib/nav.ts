// Navegación compartida entre Sidebar y AppShell (para que el breadcrumb del
// header coincida con el ítem activo del menú).

import {
  Home, CalendarPlus, CheckSquare, Users, LayoutDashboard,
  Grid, FileText, AlertTriangle, Repeat, Network, UsersRound, Settings,
  Bell, SlidersHorizontal, Download, RefreshCcw,
} from 'lucide-react'
import type { UserRole } from '@/types/domain'

export interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  href: string
  badge?: number
  divider?: boolean
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  collaborator: [
    { key: 'col-dash', label: 'Inicio', icon: Home, href: '/colaborador' },
    { key: 'col-acuerdos', label: 'Mis acuerdos', icon: CheckSquare, href: '/colaborador/acuerdos' },
    { key: 'col-historial', label: 'Historial', icon: Repeat, href: '/colaborador/historial' },
    { key: 'col-config', label: 'Configuración', icon: Settings, href: '/colaborador/configuracion', divider: true },
  ],
  leader: [
    { key: 'lid-dash', label: 'Resumen', icon: LayoutDashboard, href: '/lider' },
    { key: 'lid-equipo', label: 'Mi equipo', icon: Users, href: '/lider/equipo' },
    { key: 'lid-1to1-new', label: 'Agendar 1:1', icon: CalendarPlus, href: '/lider/1to1/nueva' },
    { key: 'lid-config', label: 'Configuración', icon: Settings, href: '/lider/configuracion', divider: true },
  ],
  hr: [
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
    { key: 'rh-config', label: 'Configuración', icon: Settings, href: '/arquitectura-humana/configuracion', divider: true },
  ],
}

// Roots de cada rol — un currentPath que termina exactamente acá debe matchear
// solo el ítem "dashboard" del rol, no cualquier descendiente.
const ROLE_ROOTS = new Set(['/colaborador', '/lider', '/arquitectura-humana'])

export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.href) return true
  if (ROLE_ROOTS.has(item.href)) return false
  return currentPath.startsWith(item.href + '/') || currentPath.startsWith(item.href)
}

// Devuelve el label del ítem activo, o 'Inicio' si nada matchea.
export function breadcrumbsFor(role: UserRole, currentPath: string): string[] {
  const items = NAV_BY_ROLE[role] ?? []
  // Buscar el match MÁS específico (href más largo)
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length)
  const match = sorted.find((i) => isNavItemActive(i, currentPath))
  return match ? [match.label] : ['Inicio']
}
