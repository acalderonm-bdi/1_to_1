'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { submitVobo } from '@/lib/actions/vobos'

interface VoboButtonProps {
  oneOnOneId: string
  userVobo: boolean | null
  onVobo?: (confirmed: boolean) => void
}

export function VoboButton({ oneOnOneId, userVobo, onVobo }: VoboButtonProps) {
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
      <div className={`flex items-center gap-2 text-sm font-medium ${myVobo ? 'text-green-600' : 'text-red-600'}`}>
        {myVobo ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {myVobo ? 'Confirmaste que se realizó' : 'Indicaste que no se realizó'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">¿Esta 1:1 se realizó?</p>
      <div className="flex gap-3">
        <Button
          onClick={() => handleVobo(true)}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Sí, se realizó
        </Button>
        <Button
          variant="outline"
          onClick={() => handleVobo(false)}
          disabled={isPending}
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4 mr-2" />
          No se realizó
        </Button>
      </div>
    </div>
  )
}
