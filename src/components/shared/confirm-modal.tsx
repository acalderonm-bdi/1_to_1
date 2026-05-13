'use client'

/**
 * ConfirmModalProvider — imperative confirm API.
 *
 * Use `useConfirm()` when you need to ask the user `await`-style from inside
 * an event handler:
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: '¿Eliminar?', variant: 'destructive' })
 *   if (ok) doDelete()
 *
 * For the declarative `<ConfirmDialog open={...} onOpenChange={...} onConfirm={...} />`
 * controlled-component pattern, use `confirm-dialog.tsx` instead.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmModalProvider')
  return ctx.confirm
}

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    opts: ConfirmOptions | null
    resolve: ((v: boolean) => void) | null
  }>({ open: false, opts: null, resolve: null })

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve })
    })
  }, [])

  const close = useCallback(
    (value: boolean) => {
      state.resolve?.(value)
      setState({ open: false, opts: null, resolve: null })
    },
    [state]
  )

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.opts?.title}</AlertDialogTitle>
            {state.opts?.description && (
              <AlertDialogDescription>{state.opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {state.opts?.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={
                state.opts?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {state.opts?.confirmLabel ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
