interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number | string; className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`empty ${className ?? ''}`}>
      {Icon && (
        <div className="empty__icon">
          <Icon />
        </div>
      )}
      <h3 className="empty__title">{title}</h3>
      {description && <p className="empty__desc">{description}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}
