'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home, CalendarPlus, CheckSquare, Users, Sparkles, LayoutDashboard,
  Grid, FileText, AlertTriangle, Repeat, Network, UsersRound, Settings, LogOut, X,
  Bell, SlidersHorizontal, Download, RefreshCcw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppShell } from '@/components/layout/app-shell'
import type { UserRole } from '@/types/domain'

interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  href: string
  badge?: number
  divider?: boolean
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  collaborator: [
    { key: 'col-dash', label: 'Inicio', icon: Home, href: '/colaborador' },
    { key: 'col-acuerdos', label: 'Mis acuerdos', icon: CheckSquare, href: '/colaborador/acuerdos' },
    { key: 'col-historial', label: 'Historial', icon: Repeat, href: '/colaborador/historial' },
    { key: 'col-config', label: 'Configuración', icon: Settings, href: '/colaborador/configuracion', divider: true },
  ],
  leader: [
    { key: 'lid-dash', label: 'Resumen', icon: LayoutDashboard, href: '/lider' },
    { key: 'lid-equipo', label: 'Mi equipo', icon: Users, href: '/lider/equipo' },
    { key: 'lid-1to1-new', label: 'Agendar 1:1', icon: CalendarPlus, href: '/colaborador/1to1/nueva' },
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

const ROLE_LABEL: Record<UserRole, string> = {
  collaborator: 'Colaborador',
  leader: 'Líder',
  hr: 'Arquitectura Humana',
}

interface SidebarProps {
  role: UserRole
  currentPath: string
  userName?: string
  userEmail?: string
}

export function Sidebar({ role, currentPath, userName, userEmail }: SidebarProps) {
  const router = useRouter()
  const { drawerOpen, closeDrawer } = useAppShell()
  const items = NAV_BY_ROLE[role] ?? []

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (userName ?? userEmail ?? '?')
    .split(' ')
    .map(p => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || '?'

  return (
    <aside className="sidebar" data-open={drawerOpen} aria-label="Navegación principal">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark" aria-hidden="true">1</div>
        <div>
          <div className="sidebar__brand-name">1to1</div>
          <div className="sidebar__brand-tag">B-Drive</div>
        </div>
        <button
          type="button"
          className="sidebar__close"
          onClick={closeDrawer}
          aria-label="Cerrar navegación"
        >
          <X size={16} />
        </button>
      </div>

      <div className="sidebar__section-label">Navegación</div>
      <nav className="sidebar__nav">
        {items.map(item => {
          const Icon = item.icon
          const isActive =
            currentPath === item.href ||
            (item.href !== '/colaborador' &&
              item.href !== '/lider' &&
              item.href !== '/arquitectura-humana' &&
              currentPath.startsWith(item.href))
          return (
            <div key={item.key}>
              {item.divider && <div className="sidebar__divider" aria-hidden="true" />}
              <Link
                href={item.href}
                className="sidebar__link"
                data-active={isActive}
                onClick={closeDrawer}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge ? <span className="sidebar__link-badge">{item.badge}</span> : null}
              </Link>
            </div>
          )
        })}
      </nav>

      <div className="sidebar__user">
        <div className="sidebar__user-avatar">{initials}</div>
        <div className="sidebar__user-meta">
          <div className="sidebar__user-name">{userName ?? 'Usuario'}</div>
          <div className="sidebar__user-role">{ROLE_LABEL[role]}</div>
        </div>
        <button className="sidebar__user-action" onClick={handleSignOut} title="Cerrar sesión" type="button" aria-label="Cerrar sesión">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )
}
