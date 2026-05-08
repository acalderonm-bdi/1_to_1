export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
      }}
    >
      <span
        className="spinner"
        style={{
          width: 22,
          height: 22,
          borderWidth: 2.5,
          color: 'var(--text-subtle)',
        }}
      />
    </div>
  )
}
