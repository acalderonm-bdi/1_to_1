'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, Calendar, CheckSquare, Sparkles, AlertTriangle, type LucideIcon } from 'lucide-react'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { formatRelative } from '@/lib/utils/dates'
import { ROLE_LABELS } from '@/lib/constants'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

interface HeaderProps {
  userId: string
  userName: string
  userRole: string
  breadcrumbs?: string[]
}

const NOTIF_ICONS: Record<string, LucideIcon> = {
  vobo: CheckSquare,
  meeting: Calendar,
  agreement: CheckSquare,
  ai: Sparkles,
  dispute: AlertTriangle,
}

function pickIcon(notifType?: string | null): LucideIcon {
  if (notifType && NOTIF_ICONS[notifType]) return NOTIF_ICONS[notifType]
  return Bell
}

export function Header({ userId, userName, userRole, breadcrumbs = ['Inicio'] }: HeaderProps) {
  const { notifications, unreadCount, markAllRead, markRead } = useRealtimeNotifications(userId)
  const router = useRouter()
  const [openNotif, setOpenNotif] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenNotif(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleNotificationClick(notif: { id: string; link: string | null; read: boolean }) {
    if (!notif.read) markRead(notif.id)
    if (notif.link) router.push(notif.link)
    setOpenNotif(false)
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="h-full flex items-center gap-3 px-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
          {breadcrumbs.map((b, i) => {
            const last = i === breadcrumbs.length - 1
            return (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-muted-foreground/60">/</span>}
                <span className={cn('truncate', last ? 'text-foreground font-medium' : 'text-muted-foreground')}>{b}</span>
              </span>
            )
          })}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          aria-label="Buscar"
          className="hidden md:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border bg-secondary/50 hover:bg-secondary text-[13px] text-muted-foreground transition-colors w-[280px] justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="size-3.5" />
            <span>Buscar persona, 1:1, acuerdo…</span>
          </span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-background text-muted-foreground">⌘K</kbd>
        </button>

        <ThemeToggle />

        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label="Notificaciones"
            onClick={() => setOpenNotif(o => !o)}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand ring-2 ring-background" />
            )}
          </button>
          {openNotif && (
            <div
              role="dialog"
              aria-label="Notificaciones"
              className="absolute top-[calc(100%+8px)] right-0 w-[380px] rounded-lg border bg-popover text-popover-foreground anim-scale-in origin-top-right"
              style={{ boxShadow: 'var(--shadow-popover)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="text-[13px] font-medium">
                  Notificaciones{' '}
                  {unreadCount > 0 && (
                    <span className="text-muted-foreground font-normal text-[11px]">· {unreadCount} sin leer</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] text-brand hover:underline"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">
                  <Bell className="mx-auto size-5 mb-2 text-muted-foreground/50" />
                  <div>Sin notificaciones</div>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.slice(0, 8).map(n => {
                    const Icon = pickIcon((n as { type?: string }).type)
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className="w-full grid grid-cols-[28px_1fr_auto] gap-3 px-4 py-3 border-b last:border-b-0 text-left hover:bg-secondary/60 transition-colors"
                      >
                        <span className="size-7 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium leading-tight flex items-center gap-1.5">
                            <span className="truncate">{n.title}</span>
                            {!n.read && <span className="size-1.5 rounded-full bg-brand shrink-0" />}
                          </div>
                          <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{n.content}</div>
                        </div>
                        <div className="text-[10.5px] text-muted-foreground whitespace-nowrap">{formatRelative(n.created_at)}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l h-6">
          <InitialsAvatar name={userName} size="md" />
          <div className="leading-tight">
            <div className="text-[12.5px] font-medium">{userName}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[userRole] ?? userRole}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
