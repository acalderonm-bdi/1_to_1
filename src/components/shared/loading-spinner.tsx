import { cn } from '@/lib/utils/cn'
import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  )
}
