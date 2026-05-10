'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home, CalendarPlus, CheckSquare, Users, Sparkles, LayoutDashboard,
  Grid3x3, FileText, AlertTriangle, Repeat, Network, UsersRound, Settings, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/domain'
import { BrandLockup } from './brand-mark'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number | string }>
  href: string
  divider?: boolean
}

type Section = 'collaborator' | 'leader' | 'hr'

const NAV_BY_SECTION: Record<Section, NavItem[]> = {
  collaborator: [
    { key: 'col-dash', label: 'Inicio', icon: Home, href: '/colaborador' },
    { key: 'col-1to1-new', label: 'Agendar 1:1', icon: CalendarPlus, href: '/colaborador/1to1/nueva' },
    { key: 'col-acuerdos', label: 'Mis acuerdos', icon: CheckSquare, href: '/colaborador/acuerdos' },
    { key: 'col-config', label: 'Configuración', icon: Settings, href: '/colaborador/configuracion', divider: true },
  ],
  leader: [
    { key: 'lid-dash', label: 'Resumen', icon: LayoutDashboard, href: '/lider' },
    { key: 'lid-equipo', label: 'Mi equipo', icon: Users, href: '/lider/equipo' },
    { key: 'lid-insights', label: 'Insights', icon: Sparkles, href: '/lider/insights' },
    { key: 'lid-1to1-new', label: 'Agendar 1:1', icon: CalendarPlus, href: '/colaborador/1to1/nueva' },
    { key: 'lid-config', label: 'Configuración', icon: Settings, href: '/lider/configuracion', divider: true },
  ],
  hr: [
    { key: 'rh-dash', label: 'Panel general', icon: LayoutDashboard, href: '/arquitectura-humana' },
    { key: 'rh-mapa', label: 'Mapa de calor', icon: Grid3x3, href: '/arquitectura-humana/mapa-calor' },
    { key: 'rh-reportes', label: 'Reportes IA', icon: FileText, href: '/arquitectura-humana/reportes' },
    { key: 'rh-disputas', label: 'Disputas', icon: AlertTriangle, href: '/arquitectura-humana/disputas' },
    { key: 'rh-cadencias', label: 'Cadencias', icon: Repeat, href: '/arquitectura-humana/cadencias' },
    { key: 'rh-estructura', label: 'Estructura', icon: Network, href: '/arquitectura-humana/estructura' },
    { key: 'rh-usuarios', label: 'Usuarios', icon: UsersRound, href: '/arquitectura-humana/usuarios' },
    { key: 'rh-config', label: 'Configuración', icon: Settings, href: '/arquitectura-humana/configuracion', divider: true },
  ],
}

const SECTION_HOME: Record<Section, string> = {
  collaborator: '/colaborador',
  leader: '/lider',
  hr: '/arquitectura-humana',
}

const SECTION_LABEL: Record<Section, string> = {
  collaborator: 'Colaborador',
  leader: 'Líder',
  hr: 'Arq. Humana',
}

const ROLE_LABEL: Record<UserRole, string> = {
  collaborator: 'Colaborador',
  leader: 'Líder',
  hr: 'Arquitectura Humana',
}

function accessibleSections(role: UserRole): Section[] {
  if (role === 'hr') return ['hr', 'leader', 'collaborator']
  if (role === 'leader') return ['leader', 'collaborator']
  return ['collaborator']
}

function detectSection(path: string, fallback: Section): Section {
  if (path.startsWith('/arquitectura-humana')) return 'hr'
  if (path.startsWith('/lider')) return 'leader'
  if (path.startsWith('/colaborador')) return 'collaborator'
  return fallback
}

interface SidebarProps {
  role: UserRole
  userName?: string
  userEmail?: string
}

export function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const router = useRouter()
  const currentPath = usePathname() ?? '/'
  const sections = accessibleSections(role)
  const currentSection = detectSection(currentPath, sections[0] ?? 'collaborator')
  const items = NAV_BY_SECTION[currentSection] ?? []

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 border-r bg-surface-2 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b">
        <BrandLockup />
      </div>

      {sections.length > 1 && (
        <div
          role="tablist"
          aria-label="Cambiar de sección"
          className="m-3 grid gap-0.5 p-0.5 rounded-md border bg-background"
          style={{ gridTemplateColumns: `repeat(${sections.length}, 1fr)` }}
        >
          {sections.map(s => {
            const active = s === currentSection
            return (
              <Link
                key={s}
                href={SECTION_HOME[s]}
                role="tab"
                aria-selected={active}
                className={cn(
                  'text-center text-[11px] font-medium px-1.5 py-1.5 rounded transition-colors',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {SECTION_LABEL[s]}
              </Link>
            )
          })}
        </div>
      )}

      <div className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-muted-foreground">
        Navegación
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
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
              {item.divider && <div className="my-2 border-t mx-2" aria-hidden="true" />}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                <Icon className={cn('size-4 shrink-0', isActive ? 'text-foreground' : '')} />
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      <div className="border-t p-3 flex items-center gap-2.5">
        <InitialsAvatar name={userName} email={userEmail} size="md" />
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[13px] font-medium truncate">{userName ?? 'Usuario'}</div>
          <div className="text-[11px] text-muted-foreground truncate">{ROLE_LABEL[role]}</div>
        </div>
        <button
          onClick={handleSignOut}
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    </aside>
  )
}
