'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Calendar, Clock, Video, MapPin, AlertCircle } from 'lucide-react'
import { scheduleOneOnOne } from '@/lib/actions/one-on-ones'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

interface Person { id: string; full_name: string; email: string }
interface MeetingFormProps {
  counterparts: Person[]
  currentRole: 'leader' | 'collaborator'
  currentUserId: string
}

export function MeetingForm({ counterparts, currentRole, currentUserId }: MeetingFormProps) {
  const router = useRouter()
  const [counterpartId, setCounterpartId] = useState(counterparts[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState<'15' | '30' | '45' | '60'>('30')
  const [modality, setModality] = useState<'virtual' | 'presencial'>('virtual')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!counterpartId || !date) {
      setError('Selecciona participante y fecha')
      return
    }
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
    startTransition(async () => {
      const collaboratorId = currentRole === 'leader' ? counterpartId : currentUserId
      const result = await scheduleOneOnOne({
        collaboratorId,
        scheduledAt,
        durationMinutes: parseInt(duration),
        modality,
        location: modality === 'presencial' ? location : undefined,
      })
      if (!result.success) { setError(result.error ?? 'Error al agendar'); return }
      const basePath = currentRole === 'leader' ? '/lider' : '/colaborador'
      router.push(`${basePath}/1to1/${result.data?.id}`)
    })
  }

  const counterpartLabel = currentRole === 'leader' ? 'Colaborador' : 'Líder'
  const minDate = new Date().toISOString().split('T')[0]
  const counterpart = counterparts.find(p => p.id === counterpartId)

  return (
    <Card className="max-w-[600px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" /> Detalles de la reunión
        </CardTitle>
        <CardDescription>Define cuándo, cuánto tiempo y dónde se realizará.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-5">
          <div>
            <Label className="mb-1.5 block">{counterpartLabel}</Label>
            <div className="flex items-center gap-3">
              {counterpart && <InitialsAvatar name={counterpart.full_name} size="md" />}
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                value={counterpartId}
                onChange={e => setCounterpartId(e.target.value)}
                required
              >
                {counterparts.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="meeting-date" className="mb-1.5 block">
                <span className="inline-flex items-center gap-1.5"><Calendar className="size-3" /> Fecha</span>
              </Label>
              <Input id="meeting-date" type="date" value={date} onChange={e => setDate(e.target.value)} required min={minDate} />
            </div>
            <div>
              <Label htmlFor="meeting-time" className="mb-1.5 block">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-3" /> Hora</span>
              </Label>
              <Input id="meeting-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Duración</Label>
            <Segmented<'15' | '30' | '45' | '60'>
              value={duration}
              options={[
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
                { value: '45', label: '45 min' },
                { value: '60', label: '1 hora' },
              ]}
              onChange={setDuration}
              cols={4}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Modalidad</Label>
            <Segmented<'virtual' | 'presencial'>
              value={modality}
              options={[
                { value: 'virtual', label: <span className="inline-flex items-center justify-center gap-1.5"><Video className="size-3.5" /> Virtual (Meet)</span> },
                { value: 'presencial', label: <span className="inline-flex items-center justify-center gap-1.5"><MapPin className="size-3.5" /> Presencial</span> },
              ]}
              onChange={setModality}
              cols={2}
            />
          </div>

          {modality === 'presencial' && (
            <div className="anim-fade-in">
              <Label htmlFor="meeting-loc" className="mb-1.5 block">Ubicación</Label>
              <Input id="meeting-loc" value={location} onChange={e => setLocation(e.target.value)} placeholder="Sala de juntas A" />
              <p className="text-[11.5px] text-muted-foreground mt-1.5">Indica dónde se reunirán dentro de la oficina.</p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 text-[12.5px] text-destructive">
              <AlertCircle className="size-3.5" /> {error}
            </div>
          )}
        </CardContent>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Agendar reunión
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Segmented<T extends string>({
  value, options, onChange, cols = 3,
}: {
  value: T
  options: Array<{ value: T; label: React.ReactNode }>
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <div
      className="grid gap-0.5 p-0.5 rounded-md border bg-secondary/50"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'text-[12.5px] font-medium rounded px-2 py-1.5 transition-colors',
            o.value === value ? 'bg-background text-foreground shadow-[0_0_0_1px_hsl(var(--border))]' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
