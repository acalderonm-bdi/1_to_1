'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { markNonRealization } from '@/lib/actions/one-on-ones'
import { REASON_OPTIONS, type Reason } from './non-realization-reasons'

// Re-exporta para preservar API existente (otros componentes que
// importaban desde acá siguen funcionando). Los server components deben
// importar desde './non-realization-reasons' directamente.
export { REASON_OPTIONS, labelForReason } from './non-realization-reasons'
export type { Reason } from './non-realization-reasons'

interface NonRealizationModalProps {
  oneOnOneId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NonRealizationModal({ oneOnOneId, open, onOpenChange }: NonRealizationModalProps) {
  const [reason, setReason] = useState<Reason | ''>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit() {
    if (!reason) return
    setSubmitting(true)
    const result = await markNonRealization({
      oneOnOneId,
      reason,
      note: note.trim() || undefined,
    })
    setSubmitting(false)

    if (!result.success) {
      toast({ title: 'No se pudo marcar', description: result.error, variant: 'destructive' })
      return
    }

    if (result.data?.status === 'en_disputa') {
      toast({
        title: 'Se generó una disputa',
        description:
          'El motivo difiere del marcado por la otra persona. Arquitectura Humana revisará.',
      })
    } else {
      toast({ title: '1:1 marcada como no realizada', description: 'Quedó registrada con motivo.' })
    }

    onOpenChange(false)
    setReason('')
    setNote('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar 1:1 como no realizada</DialogTitle>
          <DialogDescription>
            Registrá el motivo. Si la otra persona marca con motivo distinto, la sesión queda en disputa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="non-realization-reason">Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
              <SelectTrigger id="non-realization-reason">
                <SelectValue placeholder="Seleccioná un motivo" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="non-realization-note">Nota (opcional)</Label>
            <Textarea
              id="non-realization-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Contexto adicional si querés…"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? 'Guardando…' : 'Guardar motivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
