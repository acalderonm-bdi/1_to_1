'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Calendar } from 'lucide-react'
import { scheduleOneOnOne } from '@/lib/actions/one-on-ones'

interface Person {
  id: string
  full_name: string
  email: string
}

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
  const [duration, setDuration] = useState('30')
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
      const leaderId = currentRole === 'leader' ? currentUserId : counterpartId
      const collaboratorId = currentRole === 'leader' ? counterpartId : currentUserId

      const result = await scheduleOneOnOne({
        collaboratorId: collaboratorId,
        scheduledAt,
        durationMinutes: parseInt(duration),
        modality,
        location: modality === 'presencial' ? location : undefined,
      })

      if (!result.success) {
        setError(result.error ?? 'Error al agendar')
        return
      }

      const basePath = currentRole === 'leader' ? '/lider' : '/colaborador'
      router.push(`${basePath}/1to1/${result.data?.id}`)
    })
  }

  const counterpartLabel = currentRole === 'leader' ? 'Colaborador' : 'Líder'

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Agendar 1:1
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{counterpartLabel}</Label>
            <Select value={counterpartId} onValueChange={setCounterpartId}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecciona ${counterpartLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {counterparts.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora</Label>
              <Input id="time" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Duración</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modalidad</Label>
              <Select value={modality} onValueChange={(v: 'virtual' | 'presencial') => setModality(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual (Meet)</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {modality === 'presencial' && (
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación (sala, oficina...)</Label>
              <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Sala de juntas A" />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Agendar reunión
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
