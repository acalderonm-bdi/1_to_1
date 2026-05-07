'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { formatRelative } from '@/lib/utils/dates'
import { ROLE_LABELS } from '@/lib/constants'

interface HeaderProps {
  userId: string
  userName: string
  userRole: string
  breadcrumbs?: string[]
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

  const initials = userName
    .split(' ')
    .map(p => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || '?'

  return (
    <header className="app-header">
      <div className="app-header__breadcrumb">
        {breadcrumbs.map((b, i) => (
          <span key={i} className={i === breadcrumbs.length - 1 ? 'app-header__breadcrumb-current' : undefined}>
            {i > 0 && <span className="app-header__sep" style={{ marginRight: 8 }}>/</span>}
            {b}
          </span>
        ))}
      </div>

      <div className="app-header__spacer" />

      <div className="app-header__search">
        <Search size={14} />
        <span>Buscar persona, 1:1, acuerdo…</span>
        <kbd>⌘K</kbd>
      </div>

      <div ref={ref} style={{ position: 'relative' }}>
        <button className="app-header__icon-btn" onClick={() => setOpenNotif(o => !o)} type="button" aria-label="Notificaciones">
          <Bell size={18} />
          {unreadCount > 0 && <span className="dot" />}
        </button>
        {openNotif && (
          <div className="popover notif-list" style={{ top: 'calc(100% + 6px)', right: 0 }}>
            <div className="notif-list__head">
              <div className="notif-list__title">
                Notificaciones{' '}
                {unreadCount > 0 && (
                  <span className="u-muted" style={{ fontSize: 11.5, fontWeight: 400 }}>· {unreadCount} sin leer</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button className="notif-list__action" type="button" onClick={markAllRead}>
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                Sin notificaciones
              </div>
            ) : (
              notifications.slice(0, 8).map(n => (
                <div key={n.id} className="notif-item" onClick={() => handleNotificationClick(n)}>
                  <div className="notif-item__icon av-blue">
                    <Bell size={14} />
                  </div>
                  <div>
                    <div className="notif-item__title">
                      {n.title}
                      {!n.read && <span className="unread-dot" />}
                    </div>
                    <div className="notif-item__body">{n.content}</div>
                  </div>
                  <div className="notif-item__time">{formatRelative(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="app-header__user-chip">
        <div className="app-header__user-avatar">{initials}</div>
        <div className="app-header__user-text">
          <strong>{userName}</strong>
          <span>{ROLE_LABELS[userRole] ?? userRole}</span>
        </div>
      </div>
    </header>
  )
}
