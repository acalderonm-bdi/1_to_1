import { cn } from '@/lib/utils/cn'

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  const fontSize = Math.round(size * 0.5)
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-foreground text-background font-mono-numeric font-medium shrink-0',
        className
      )}
      style={{ width: size, height: size, fontSize, letterSpacing: '-0.02em' }}
      aria-hidden="true"
    >
      1
    </div>
  )
}

export function BrandLockup({ tag = 'B-Drive', className }: { tag?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <div className="leading-tight">
        <div className="text-[15px] font-medium tracking-tight">1to1</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{tag}</div>
      </div>
    </div>
  )
}
