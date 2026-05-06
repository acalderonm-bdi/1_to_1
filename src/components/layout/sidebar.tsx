'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar, Users, FileText, BarChart2, Map, AlertTriangle,
  Clock, Building2, LogOut, Sparkles, CheckSquare
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/domain'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  collaborator: [
    { label: 'Mis 1:1s', href: '/colaborador', icon: Calendar },
    { label: 'Mis acuerdos', href: '/colaborador/acuerdos', icon: CheckSquare },
  ],
  leader: [
    { label: 'Panel', href: '/lider', icon: BarChart2 },
    { label: 'Mi equipo', href: '/lider/equipo', icon: Users },
    { label: 'Sugerencias IA', href: '/lider/insights', icon: Sparkles },
  ],
  hr: [
    { label: 'Panel', href: '/arquitectura-humana', icon: BarChart2 },
    { label: 'Mapa de calor', href: '/arquitectura-humana/mapa-calor', icon: Map },
    { label: 'Reportes IA', href: '/arquitectura-humana/reportes', icon: FileText },
    { label: 'Disputas', href: '/arquitectura-humana/disputas', icon: AlertTriangle },
    { label: 'Cadencias', href: '/arquitectura-humana/cadencias', icon: Clock },
    { label: 'Estructura', href: '/arquitectura-humana/estructura', icon: Building2 },
    { label: 'Usuarios', href: '/arquitectura-humana/usuarios', icon: Users },
  ],
}

interface SidebarProps {
  role: UserRole
  currentPath: string
  userName?: string
}

export function Sidebar({ role, currentPath, userName }: SidebarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const items = NAV_ITEMS[role] ?? []

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 text-slate-100">
      <div className="p-6 border-b border-slate-800">
        <h1 className="font-semibold text-lg leading-tight">Sistema de 1:1s</h1>
        {userName && (
          <p className="text-xs text-slate-400 mt-1 truncate">{userName}</p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => {
          const Icon = item.icon
          const isActive =
            currentPath === item.href ||
            (
              item.href !== '/colaborador' &&
              item.href !== '/lider' &&
              item.href !== '/arquitectura-humana' &&
              currentPath.startsWith(item.href)
            )
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
