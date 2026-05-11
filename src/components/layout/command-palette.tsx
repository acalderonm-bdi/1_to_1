'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Home, LayoutDashboard, Users, Sparkles, CalendarPlus, CheckSquare,
  Grid, FileText, AlertTriangle, Repeat, Network, UsersRound, Settings,
  Sun, Moon, LogOut, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/domain'

interface PaletteItem {
  id: string
  group: 'Navegación' | 'Acciones' | 'Tema' | 'Atajos'
  label: string
  hint?: string
  icon: LucideIcon
  kbd?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  role: UserRole
  userName: string
}

export function CommandPalette({ open, onClose, role }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const go = (path: string) => () => { router.push(path); onClose() }

    const navByRole: Record<UserRole, PaletteItem[]> = {
      collaborator: [
        { id: 'col-home', group: 'Navegación', label: 'Inicio', icon: Home, kbd: 'g h', run: go('/colaborador') },
        { id: 'col-agree', group: 'Navegación', label: 'Mis acuerdos', icon: CheckSquare, kbd: 'g k', run: go('/colaborador/acuerdos') },
        { id: 'col-config', group: 'Navegación', label: 'Configuración', icon: Settings, kbd: 'g s', run: go('/colaborador/configuracion') },
      ],
      leader: [
        { id: 'lid-dash', group: 'Navegación', label: 'Resumen', icon: LayoutDashboard, kbd: 'g h', run: go('/lider') },
        { id: 'lid-team', group: 'Navegación', label: 'Mi equipo', icon: Users, kbd: 'g e', run: go('/lider/equipo') },
        { id: 'lid-new', group: 'Navegación', label: 'Agendar 1:1', icon: CalendarPlus, kbd: 'g a', run: go('/colaborador/1to1/nueva') },
        { id: 'lid-config', group: 'Navegación', label: 'Configuración', icon: Settings, kbd: 'g s', run: go('/lider/configuracion') },
      ],
      hr: [
        { id: 'rh-dash', group: 'Navegación', label: 'Panel general', icon: LayoutDashboard, kbd: 'g h', run: go('/arquitectura-humana') },
        { id: 'rh-mapa', group: 'Navegación', label: 'Mapa de calor', icon: Grid, kbd: 'g m', run: go('/arquitectura-humana/mapa-calor') },
        { id: 'rh-reportes', group: 'Navegación', label: 'Reportes IA', icon: FileText, kbd: 'g r', run: go('/arquitectura-humana/reportes') },
        { id: 'rh-disputas', group: 'Navegación', label: 'Disputas', icon: AlertTriangle, kbd: 'g d', run: go('/arquitectura-humana/disputas') },
        { id: 'rh-cadencias', group: 'Navegación', label: 'Cadencias', icon: Repeat, run: go('/arquitectura-humana/cadencias') },
        { id: 'rh-estructura', group: 'Navegación', label: 'Estructura', icon: Network, run: go('/arquitectura-humana/estructura') },
        { id: 'rh-usuarios', group: 'Navegación', label: 'Usuarios', icon: UsersRound, kbd: 'g u', run: go('/arquitectura-humana/usuarios') },
        { id: 'rh-config', group: 'Navegación', label: 'Configuración', icon: Settings, kbd: 'g s', run: go('/arquitectura-humana/configuracion') },
      ],
    }

    const themeActions: PaletteItem[] = [
      {
        id: 'theme-light', group: 'Tema', label: 'Tema claro', icon: Sun,
        run: () => { document.documentElement.setAttribute('data-theme', 'light'); try { localStorage.setItem('theme', 'light') } catch {} ; onClose() },
      },
      {
        id: 'theme-dark', group: 'Tema', label: 'Tema oscuro', icon: Moon,
        run: () => { document.documentElement.setAttribute('data-theme', 'dark'); try { localStorage.setItem('theme', 'dark') } catch {} ; onClose() },
      },
    ]

    const actions: PaletteItem[] = [
      {
        id: 'sign-out', group: 'Acciones', label: 'Cerrar sesión', icon: LogOut,
        run: async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          onClose()
          router.push('/login')
          router.refresh()
        },
      },
    ]

    return [...(navByRole[role] ?? []), ...themeActions, ...actions]
  }, [role, router, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase().trim()
    return items.filter(it =>
      it.label.toLowerCase().includes(q) ||
      it.hint?.toLowerCase().includes(q) ||
      it.group.toLowerCase().includes(q)
    )
  }, [items, query])

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>()
    for (const it of filtered) {
      if (!map.has(it.group)) map.set(it.group, [])
      map.get(it.group)!.push(it)
    }
    return Array.from(map.entries())
  }, [filtered])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1))
  }, [filtered.length, activeIdx])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(filtered.length - 1, i + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(0, i - 1))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[activeIdx]
        if (item) item.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, activeIdx, onClose])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmdk-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!open) return null

  let runningIdx = -1

  return (
    <div className="cmdk-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Paleta de comandos">
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div className="cmdk__head">
          <Search size={18} />
          <input
            ref={inputRef}
            className="cmdk__input"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Buscar páginas, comandos, atajos…"
            aria-label="Buscar"
          />
          <span className="cmdk__esc">esc</span>
        </div>
        <div className="cmdk__list" ref={listRef}>
          {grouped.length === 0 && (
            <div className="cmdk__empty">Sin resultados para «{query}»</div>
          )}
          {grouped.map(([group, groupItems]) => (
            <div key={group}>
              <div className="cmdk__group">{group}</div>
              {groupItems.map(it => {
                runningIdx += 1
                const isActive = runningIdx === activeIdx
                const Icon = it.icon
                const myIdx = runningIdx
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="cmdk__item"
                    data-active={isActive}
                    data-cmdk-idx={myIdx}
                    onMouseEnter={() => setActiveIdx(myIdx)}
                    onClick={it.run}
                  >
                    <span className="cmdk__item-icon"><Icon size={14} /></span>
                    <span className="cmdk__item-text">
                      <div className="cmdk__item-label">{it.label}</div>
                      {it.hint && <div className="cmdk__item-hint">{it.hint}</div>}
                    </span>
                    {it.kbd && <span className="cmdk__kbd" aria-hidden="true">{it.kbd}</span>}
                    {isActive && <ArrowRight size={14} style={{ color: 'var(--accent-600)', marginLeft: 4 }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmdk__foot">
          <span className="cmdk__foot-key">
            <span className="cmdk__kbd">↑↓</span> navegar
          </span>
          <span className="cmdk__foot-key">
            <span className="cmdk__kbd">↵</span> seleccionar
          </span>
          <span className="cmdk__foot-key">
            <span className="cmdk__kbd">esc</span> cerrar
          </span>
        </div>
      </div>
    </div>
  )
}
