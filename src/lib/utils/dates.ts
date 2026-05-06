import { format, formatDistance, isAfter, isBefore, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(date: string | Date): string {
  return format(new Date(date), "d 'de' MMMM, yyyy", { locale: es })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })
}

export function formatRelative(date: string | Date): string {
  return formatDistance(new Date(date), new Date(), { addSuffix: true, locale: es })
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return isBefore(new Date(dueDate), new Date())
}

export function isDueSoon(dueDate: string | null, withinDays = 3): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  const now = new Date()
  return isAfter(due, now) && isBefore(due, addDays(now, withinDays))
}
