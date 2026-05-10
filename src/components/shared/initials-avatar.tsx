import { cn } from '@/lib/utils/cn'

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-[13px]',
  xl: 'h-12 w-12 text-base',
}

export function getInitials(name?: string | null, fallback = '?'): string {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

export function InitialsAvatar({
  name,
  email,
  size = 'md',
  className,
}: {
  name?: string | null
  email?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const initials = getInitials(name ?? email)
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-secondary text-foreground font-medium border border-border select-none shrink-0',
        SIZES[size],
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
