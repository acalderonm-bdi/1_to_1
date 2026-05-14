import Link from 'next/link'

interface AuthCardProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

// Wordmark texto en vez de <Image src="/logo-light.png"> porque el asset es
// placeholder transparente (105 bytes) — un image filter no alcanzaba. Cuando
// haya un asset real con contraste, revertir al <Image> con la clase
// `logo-img` (filter de invert en dark mode aplica via globals.css).
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Link
          href="/"
          aria-label="1to1"
          className="inline-flex items-center justify-center"
          style={{
            fontFamily: 'var(--font-serif, ui-serif, Georgia, serif)',
            fontSize: '2.25rem',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            color: 'hsl(var(--primary))',
            lineHeight: 1,
          }}
        >
          1to1
        </Link>
      </div>
      <h4 className="mb-2 text-xl font-semibold text-card-foreground">{title}</h4>
      <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      {children}
      {footer && (
        <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>
      )}
    </div>
  )
}
