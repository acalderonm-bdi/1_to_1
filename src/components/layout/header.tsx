'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { formatRelative } from '@/lib/utils/dates'
import { ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

interface HeaderProps {
  userId: string
  userName: string
  userRole: string
}

export function Header({ userId, userName, userRole }: HeaderProps) {
  const { notifications, unreadCount, markAllRead, markRead } =
    useRealtimeNotifications(userId)
  const router = useRouter()

  function handleNotificationClick(notif: {
    id: string
    link: string | null
    read: boolean
  }) {
    if (!notif.read) markRead(notif.id)
    if (notif.link) router.push(notif.link)
  }

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-slate-500">
        <span className="font-medium text-slate-800">{userName}</span>
        <span className="mx-2">·</span>
        <span>{ROLE_LABELS[userRole] ?? userRole}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {unreadCount > 0 ? (
              <>
                <BellDot className="h-5 w-5 text-slate-600" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            ) : (
              <Bell className="h-5 w-5 text-slate-600" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline font-normal"
              >
                Marcar todas como leídas
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-400">
              Sin notificaciones
            </div>
          ) : (
            notifications.slice(0, 8).map(notif => (
              <DropdownMenuItem
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  'flex flex-col items-start gap-0.5 cursor-pointer py-2',
                  !notif.read && 'bg-blue-50/60'
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  {!notif.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium leading-tight',
                      !notif.read ? 'text-slate-900' : 'text-slate-600'
                    )}
                  >
                    {notif.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-snug pl-3.5 line-clamp-2">
                  {notif.content}
                </p>
                <p className="text-xs text-slate-400 pl-3.5">
                  {formatRelative(notif.created_at)}
                </p>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
