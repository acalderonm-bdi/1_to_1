import Link from 'next/link'
import Image from 'next/image'

interface AuthCardProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Link href="/">
          <Image
            src="/logo-light.png"
            alt="1to1"
            width={80}
            height={80}
            className="logo-img h-20 w-auto"
            priority
          />
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
