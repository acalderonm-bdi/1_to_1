'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/layout/command-palette'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { breadcrumbsFor } from '@/lib/nav'
import type { UserRole } from '@/types/domain'

interface AppShellContextValue {
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  cmdkOpen: boolean
  openCmdK: () => void
  closeCmdK: () => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used inside AppShell')
  return ctx
}

interface AppShellProps {
  role: UserRole
  currentPath: string
  userId: string
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function AppShell({ role, currentPath, userId, userName, userEmail, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  // `currentPath` viene del server layout (header x-pathname) y NO se actualiza
  // en navegación client-side. Usamos usePathname() para reflejar la ruta
  // real, con fallback al server value para el primer render.
  const pathname = usePathname() ?? currentPath
  const activePath = pathname
  const router = useRouter()

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const openCmdK = useCallback(() => setCmdkOpen(true), [])
  const closeCmdK = useCallback(() => setCmdkOpen(false), [])

  const homePath = role === 'leader' ? '/lider' : role === 'hr' ? '/arquitectura-humana' : '/colaborador'

  const shortcuts = useMemo(() => {
    const go = (path: string) => () => router.push(path)
    const base: Record<string, () => void> = {
      'g h': go(homePath),
      '?': openCmdK,
    }
    if (role === 'leader') {
      base['g a'] = go('/lider/1to1/nueva')
      base['g e'] = go('/lider/equipo')
      base['g s'] = go('/lider/configuracion')
    }
    if (role === 'collaborator') {
      base['g k'] = go('/colaborador/acuerdos')
      base['g s'] = go('/colaborador/configuracion')
    }
    if (role === 'hr') {
      base['g m'] = go('/arquitectura-humana/mapa-calor')
      base['g r'] = go('/arquitectura-humana/reportes')
      base['g d'] = go('/arquitectura-humana/disputas')
      base['g u'] = go('/arquitectura-humana/usuarios')
      base['g s'] = go('/arquitectura-humana/configuracion')
    }
    return base
  }, [role, router, homePath, openCmdK])

  useKeyboardShortcuts(shortcuts, !cmdkOpen && !drawerOpen)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
      const cmd = isMac ? e.metaKey : e.ctrlKey
      if (cmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCmdkOpen(o => !o)
      }
      if (e.key === 'Escape') {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (drawerOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [drawerOpen])

  const value = useMemo(
    () => ({ drawerOpen, openDrawer, closeDrawer, cmdkOpen, openCmdK, closeCmdK }),
    [drawerOpen, openDrawer, closeDrawer, cmdkOpen, openCmdK, closeCmdK]
  )

  return (
    <AppShellContext.Provider value={value}>
      <div className="min-h-screen bg-background text-foreground">
        <div
          className="app-drawer-backdrop"
          data-open={drawerOpen}
          onClick={closeDrawer}
          aria-hidden="true"
        />
        <Sidebar
          role={role}
          currentPath={activePath}
          userName={userName}
          userEmail={userEmail}
        />
        <div className="flex min-w-0 flex-col xl:ml-[var(--sidebar-width)] transition-[margin] duration-300">
          <Header userId={userId} userName={userName} userRole={role} breadcrumbs={breadcrumbsFor(role, activePath)} />
          <main className="min-w-0">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette
        open={cmdkOpen}
        onClose={closeCmdK}
        role={role}
        userName={userName}
      />
    </AppShellContext.Provider>
  )
}
