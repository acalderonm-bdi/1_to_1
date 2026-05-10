'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { Button } from '@/components/ui/button'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
      className={className}
    >
      {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  )
}
