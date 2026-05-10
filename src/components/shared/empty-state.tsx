import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number | string; className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4 gap-1' : 'py-12 px-6 gap-1.5',
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-secondary text-muted-foreground mb-2',
            compact ? 'h-9 w-9' : 'h-11 w-11'
          )}
          aria-hidden="true"
        >
          <Icon className={compact ? 'size-4' : 'size-5'} />
        </div>
      )}
      <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
      {description && <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
