import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5'
  return (
    <div className={cn('flex items-center justify-center py-12', className)} aria-label="Cargando" role="status">
      <Loader2 className={cn(px, 'animate-spin text-muted-foreground')} />
    </div>
  )
}
