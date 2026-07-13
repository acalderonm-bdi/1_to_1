'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppShell } from '@/components/layout/app-shell'
import { isNavItemActive, type NavItem } from '@/lib/nav'
import type { UserRole } from '@/types/domain'

const ROLE_LABEL: Record<UserRole, string> = {
  collaborator: 'Colaborador',
  leader: 'Líder',
  hr: 'Arquitectura Humana',
}

interface SidebarProps {
  role: UserRole
  items: NavItem[]
  currentPath: string
  userName?: string
  userEmail?: string
}

export function Sidebar({ role, items, currentPath, userName, userEmail }: SidebarProps) {
  const router = useRouter()
  const { drawerOpen, closeDrawer } = useAppShell()

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
          const isActive = isNavItemActive(item, currentPath)
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
