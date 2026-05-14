'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/hooks/use-toast'
import { saveOrgSetting } from '@/lib/actions/org-settings'
import { ParamsSection } from './params-section'

interface TransferBannerToggleProps {
  initialEnabled: boolean
}

export function TransferBannerToggle({ initialEnabled }: TransferBannerToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [savedEnabled, setSavedEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty = enabled !== savedEnabled

  function onSave() {
    startTransition(async () => {
      const r = await saveOrgSetting('transfer_banner_enabled', enabled)
      if (!r.success) {
        toast({
          title: 'No se pudo guardar',
          description: r.error,
          variant: 'destructive',
        })
        return
      }
      setSavedEnabled(enabled)
      toast({ title: 'Banner de transferencia actualizado' })
    })
  }

  return (
    <ParamsSection
      title="Transferencias de liderazgo"
      desc="Banner que avisa cambios recientes en la línea de reporte."
      dirty={dirty}
      isPending={isPending}
      onSave={onSave}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          fontSize: 13.5,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Mostrar banner cuando hubo transferencia reciente</span>
      </label>
    </ParamsSection>
  )
}
