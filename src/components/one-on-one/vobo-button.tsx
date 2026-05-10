'use client'

import { useState, useTransition } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { submitVobo } from '@/lib/actions/vobos'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface VoboButtonProps {
  oneOnOneId: string
  userVobo: boolean | null
  onVobo?: (confirmed: boolean) => void
  partnerName?: string
}

export function VoboButton({ oneOnOneId, userVobo, onVobo, partnerName }: VoboButtonProps) {
  const [myVobo, setMyVobo] = useState<boolean | null>(userVobo)
  const [isPending, startTransition] = useTransition()

  async function handleVobo(confirmed: boolean) {
    startTransition(async () => {
      const result = await submitVobo({ oneOnOneId, confirmed })
      if (result.success) {
        setMyVobo(confirmed)
        onVobo?.(confirmed)
      }
    })
  }

  if (myVobo !== null) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center size-9 rounded-full ${myVobo ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive'}`}>
              {myVobo ? <Check className="size-4" /> : <X className="size-4" />}
            </span>
            <div>
              <div className="text-sm font-medium">
                {myVobo ? 'Confirmaste que sí se realizó' : 'Indicaste que no se realizó'}
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-0.5">
                {partnerName ? `Esperando confirmación de ${partnerName.split(' ')[0]}` : 'Confirmación registrada'}
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMyVobo(null)}>Cambiar</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-medium tracking-tight">¿Esta reunión se realizó?</h3>
      <p className="text-[13.5px] text-muted-foreground mt-1.5 mb-5 max-w-lg leading-relaxed">
        Tu confirmación es independiente. Si hay contradicción, se levanta una disputa para revisión.
      </p>
      <div className="flex gap-2.5">
        <Button type="button" size="lg" onClick={() => handleVobo(true)} disabled={isPending} className="bg-success hover:bg-success/90 text-white">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Sí, se realizó
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => handleVobo(false)} disabled={isPending} className="text-destructive border-destructive/30 hover:bg-destructive/5">
          <X className="size-4" /> No se realizó
        </Button>
      </div>
    </Card>
  )
}
